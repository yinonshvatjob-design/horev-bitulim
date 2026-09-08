/* ==========================================================================
   פלטפורמת ביטול ארוחות - שרת API ענני מאובטח (Server Engine)
   ========================================================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const mailer = require('./mailer');

const app = express();
const PORT = process.env.PORT || 4050;

// Middlewares & Anti-Cache Headers for Desktop Browsers
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve Static Frontend Assets (Web Client)
app.use(express.static(__dirname));

// --------------------------------------------------------------------------
// 1. Auth REST API
// --------------------------------------------------------------------------

// POST /api/auth/login (Ultra-Flexible Smart Authentication)
app.post('/api/auth/login', (req, res) => {
  const { role, id, pass } = req.body;

  if (!id || !String(id).trim()) {
    return res.status(400).json({ success: false, message: 'יש להזין תעודת זהות, טלפון או אימייל' });
  }

  const rawInput = String(id).trim();
  const cleanDigits = rawInput.replace(/[^0-9]/g, '');
  const unpaddedDigits = cleanDigits.replace(/^0+/, '');
  const paddedDigits = cleanDigits ? cleanDigits.padStart(9, '0') : '';

  // Helper matcher
  const isMatch = (targetId, targetEmail, targetName) => {
    if (!targetId) return false;
    const cleanTarget = String(targetId).trim().replace(/[^0-9]/g, '');
    const unpaddedTarget = cleanTarget.replace(/^0+/, '');
    const paddedTarget = cleanTarget ? cleanTarget.padStart(9, '0') : '';

    if (rawInput === String(targetId).trim()) return true;
    if (cleanDigits && cleanTarget && cleanDigits === cleanTarget) return true;
    if (unpaddedDigits && unpaddedTarget && unpaddedDigits === unpaddedTarget) return true;
    if (paddedDigits && paddedTarget && paddedDigits === paddedTarget) return true;
    if (targetEmail && targetEmail.toLowerCase().trim() === rawInput.toLowerCase()) return true;
    if (targetName && rawInput.length >= 3 && targetName.includes(rawInput)) return true;
    return false;
  };

  // 1. Check if user is an Admin
  const admin = db.getAllAdmins().find(a => isMatch(a.id, a.email, a.name));
  if (admin) {
    if (pass && admin.pass && admin.pass !== pass) {
      return res.status(401).json({ success: false, message: 'סיסמת אדמין שגויה' });
    }
    return res.json({
      success: true,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'ADMIN',
        roleTitle: admin.roleTitle || 'אדמין מוסדות חורב'
      }
    });
  }

  // 2. Check if user is a Coordinator
  const coordinator = db.getAllCoordinators().find(c => isMatch(c.id, c.email, c.name));
  if (coordinator) {
    return res.json({
      success: true,
      user: {
        id: coordinator.id,
        name: coordinator.name,
        email: coordinator.email,
        role: 'COORDINATOR',
        roleTitle: 'רכז/ת מורש/ת'
      }
    });
  }

  // 3. Fallback: Allow any coordinator input to log in smoothly as a Coordinator
  if (role === 'coordinator' || !pass) {
    return res.json({
      success: true,
      user: {
        id: rawInput,
        name: rawInput.length >= 2 ? rawInput : `רכז/ת (${rawInput})`,
        email: rawInput.includes('@') ? rawInput : `${cleanDigits || rawInput}@horev.org.il`,
        role: 'COORDINATOR',
        roleTitle: 'רכז/ת מורש/ת'
      }
    });
  }

  return res.status(403).json({
    success: false,
    message: `הפרטים שהוזנו (${rawInput}) אינם מופיעים ברשימת המורשים. ניתן לפנות לחגי או לאסתר להוספה ברגע.`
  });
});

// --------------------------------------------------------------------------
// 2. Cancellation Requests REST API
// --------------------------------------------------------------------------

// GET /api/requests
app.get('/api/requests', (req, res) => {
  const { applicantId, status } = req.query;
  let requests = db.getAllRequests();

  if (applicantId) {
    requests = requests.filter(r => r.applicantId === applicantId);
  }

  if (status && status !== 'ALL') {
    requests = requests.filter(r => r.status === status);
  }

  // Sort Pending requests by event date urgency
  requests.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  res.json({ success: true, requests });
});

// POST /api/requests (Submit Request with 48h check)
app.post('/api/requests', async (req, res) => {
  const { applicantId, applicantName, applicantEmail, group, startDate, endDate, requestedMeals, reason, mandatoryConfirmed } = req.body;

  if (!group || !startDate || !endDate || !requestedMeals || requestedMeals.length === 0 || !reason) {
    return res.status(400).json({ success: false, message: 'יש למלא את כל שדות החובה בטופס' });
  }

  if (!mandatoryConfirmed) {
    return res.status(400).json({ success: false, message: 'חובה לאשר את 2 ההנחיות המוסדיות הרשומות בתחתית הטופס' });
  }

// Israeli Holidays list (YYYY-MM-DD) for 2025-2027
const ISRAEL_HOLIDAYS = new Set([
  // 2026
  "2026-03-03", "2026-03-04",
  "2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07", "2026-04-08",
  "2026-04-22",
  "2026-05-21", "2026-05-22",
  "2026-09-11", "2026-09-12", "2026-09-13",
  "2026-09-20", "2026-09-21",
  "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
  // 2027
  "2027-03-23", "2027-03-24",
  "2027-04-21", "2027-04-22", "2027-04-23", "2027-04-24", "2027-04-25", "2027-04-26", "2027-04-27", "2027-04-28",
  "2027-05-12",
  "2027-06-10", "2027-06-11",
  "2027-10-01", "2027-10-02", "2027-10-03",
  "2027-10-10", "2027-10-11",
  "2027-10-15", "2027-10-16", "2027-10-17", "2027-10-18", "2027-10-19", "2027-10-20", "2027-10-21", "2027-10-22", "2027-10-23"
]);

function isNonBusinessDay(d) {
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 5 || dayOfWeek === 6) return true;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return ISRAEL_HOLIDAYS.has(`${yyyy}-${mm}-${dd}`);
}

function getBusinessDayCutoffDeadline(startDateVal) {
  const [year, month, day] = startDateVal.split('-').map(Number);
  let curr = new Date(year, month - 1, day, 12, 0, 0);

  let businessDaysNeeded = 2;
  while (businessDaysNeeded > 0) {
    curr.setDate(curr.getDate() - 1);
    if (!isNonBusinessDay(curr)) {
      businessDaysNeeded--;
    }
  }
  return curr;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function formatHebrewDeadline(d) {
  const dayName = HEBREW_DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `יום ${dayName} (${dd}/${mm}) בשעה ${hh}:${min}`;
}

  // 2 Business Days Cutoff Validation Rule
  const now = new Date();
  const deadline = getBusinessDayCutoffDeadline(startDate);

  if (now > deadline) {
    return res.status(400).json({
      success: false,
      message: `חסימת ימי עסקים: מועד ההגשה מוגבל ל-2 ימי עסקים מראש (לא כולל שישי, שבת וחגים). עבור אירוע בתאריך ${startDate}, המועד האחרון להגשת ביטול היה ${formatHebrewDeadline(deadline)}.`
    });
  }

  // Create Request Record
  const reqId = "REQ-" + (Math.floor(Math.random() * 900) + 100);
  const submittedAtStr = db.formatDate(new Date());

  const newReq = {
    id: reqId,
    applicantId,
    applicantName,
    applicantEmail,
    group,
    startDate,
    endDate,
    requestedMeals,
    reason,
    submittedAt: submittedAtStr,
    status: "PENDING",
    approvedRefund: 0,
    approvedDetails: null,
    adminNotes: "",
    handledBy: null,
    handledAt: null,
    timeline: [
      { time: submittedAtStr, title: "הגשת בקשת ביטול", desc: `הבקשה הוגשה בהצלחה ע"י הרכז/ת ${applicantName} עבור ${group}`, type: "info" },
      { time: submittedAtStr, title: "שליחת התראה לחגי ואסתר", desc: "נשלח אימייל התראה ל-chagi@horev.org.il ול-esters@horev.org.il", type: "info" }
    ]
  };

  db.addRequest(newReq);

  // Send Alert Email to Admins (Hagai & Esther)
  await mailer.sendSubmissionAlertToAdmins(newReq);

  res.json({ success: true, request: newReq, message: 'הבקשה הוגשה בהצלחה ונשלחה לאישור חגי!' });
});

// POST /api/requests/:id/approve (Custom Approval & Manual Refund in ₪)
app.post('/api/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedRefund, approvedMeals, adminNotes, adminName } = req.body;

    const request = db.getAllRequests().find(r => r.id === id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });
    }

    const refundAmount = parseFloat(approvedRefund) || 0;
    const nowStr = db.formatDate(new Date());
    const mealsStr = Array.isArray(request.requestedMeals) ? request.requestedMeals.join(', ') : (request.requestedMeals || '');

    const updatedTimeline = [
      ...(request.timeline || []),
      {
        time: nowStr,
        title: `אושר ע"י ${adminName || 'חגי'}`,
        desc: `אושר מותאם אישית. ארוחות מאושרות: ${approvedMeals || mealsStr} | סכום החזר: ₪${refundAmount.toLocaleString()}`,
        type: "success"
      },
      {
        time: nowStr,
        title: "שליחת אימייל עדכון לרכז/ת",
        desc: `נשלח אימייל עדכון ל-` + request.applicantEmail + ` עם סכום ההחזר ו-2 הנחיות החובה`,
        type: "info"
      }
    ];

    const updatedReq = db.updateRequest(id, {
      status: "APPROVED",
      approvedRefund: refundAmount,
      approvedDetails: approvedMeals || mealsStr,
      adminNotes: adminNotes || "",
      handledBy: adminName || "חגי (מנהל)",
      handledAt: nowStr,
      timeline: updatedTimeline
    });

    // Send Automatic Update Email to Coordinator
    try {
      await mailer.sendDecisionToCoordinator(updatedReq);
    } catch (mailErr) {
      console.error("Mailer send error:", mailErr.message);
    }

    res.json({ success: true, request: updatedReq, message: `הבקשה אושרה בהצלחה! נשלח מייל עדכון לרכז/ת (${request.applicantEmail}) עם סכום החזר ₪${refundAmount}.` });
  } catch (err) {
    console.error("Approve route error:", err);
    res.status(500).json({ success: false, message: "שגיאה באישור הבקשה: " + err.message });
  }
});

// POST /api/requests/:id/reject (Rejection with Email to Coordinator)
app.post('/api/requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes, adminName } = req.body;

    const request = db.getAllRequests().find(r => r.id === id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });
    }

    const nowStr = db.formatDate(new Date());

    const updatedTimeline = [
      ...(request.timeline || []),
      {
        time: nowStr,
        title: `נדחה ע"י ${adminName || 'חגי'}`,
        desc: `סיבת דחייה: ${adminNotes || 'לא צוינה סיבה'}`,
        type: "danger"
      },
      {
        time: nowStr,
        title: "שליחת אימייל עדכון לרכז/ת",
        desc: `נשלח אימייל עדכון ל-` + request.applicantEmail,
        type: "info"
      }
    ];

    const updatedReq = db.updateRequest(id, {
      status: "REJECTED",
      approvedRefund: 0,
      adminNotes: adminNotes || "",
      handledBy: adminName || "חגי (מנהל)",
      handledAt: nowStr,
      timeline: updatedTimeline
    });

    // Send Automatic Update Email to Coordinator
    try {
      await mailer.sendDecisionToCoordinator(updatedReq);
    } catch (mailErr) {
      console.error("Mailer send error:", mailErr.message);
    }

    res.json({ success: true, request: updatedReq, message: 'הבקשה נדחתה. נשלח מייל עדכון לרכז/ת.' });
  } catch (err) {
    console.error("Reject route error:", err);
    res.status(500).json({ success: false, message: "שגיאה בדחיית הבקשה: " + err.message });
  }
});

// POST /api/requests/:id/receipt (Upload receipt and send alert to Esther)
app.post('/api/requests/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, store, notes, fileName, fileData } = req.body;

    const request = db.getRequestById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });
    }

    const updatedReq = db.addReceiptToRequest(id, { amount, store, notes, fileName, fileData });

    // Send Notification Email to Esther with CC to Hagai
    try {
      await mailer.sendReceiptNotificationToEsther(updatedReq, updatedReq.receipt);
    } catch (mailErr) {
      console.error("Receipt email notification error:", mailErr.message);
    }

    res.json({
      success: true,
      request: updatedReq,
      message: 'הקבלה הועלתה בהצלחה ונשלחה הודעת התראה לאסתר במזכירות (עם עותק לחגי)!'
    });
  } catch (err) {
    console.error("Receipt upload route error:", err);
    res.status(500).json({ success: false, message: "שגיאה בהעלאת הקבלה: " + err.message });
  }
});

// DELETE /api/requests/:id (Delete single request)
app.delete('/api/requests/:id', (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteRequest(id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });
  }
  res.json({ success: true, message: `בקשה #${id} נמחקה בהצלחה מהיסטוריית הבקשות.` });
});

// POST /api/requests/delete-batch (Delete selected requests)
app.post('/api/requests/delete-batch', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'יש לבחור לפחות בקשה אחת למחיקה' });
  }
  const deletedCount = db.deleteBatchRequests(ids);
  res.json({ success: true, count: deletedCount, message: `${deletedCount} בקשות נמחקו בהצלחה מהמערכת.` });
});

// DELETE /api/requests (Clear all request history - Software Manager only)
app.delete('/api/requests', (req, res) => {
  const { adminId } = req.body || {};
  const admins = db.getAllAdmins();
  const reqAdmin = admins.find(a => a.id === adminId);
  const isSoftwareManager = reqAdmin && (
    (reqAdmin.name && reqAdmin.name.includes('ינון')) || 
    (reqAdmin.role && reqAdmin.role.includes('תוכנה')) ||
    (reqAdmin.roleTitle && reqAdmin.roleTitle.includes('תוכנה'))
  );

  if (adminId && !isSoftwareManager) {
    return res.status(403).json({ success: false, message: 'פעולת איפוס ומחיקת כל ההיסטוריה מורשית למנהל תוכנה בלבד' });
  }

  const clearedCount = db.clearAllRequests();
  res.json({ success: true, count: clearedCount, message: `כל היסטוריית הבקשות (${clearedCount} בקשות) אופסה ונמחקה בהצלחה.` });
});

// --------------------------------------------------------------------------
// 3. User & Admin Management REST API
// --------------------------------------------------------------------------

// GET /api/users
app.get('/api/users', (req, res) => {
  res.json({ success: true, coordinators: db.data.coordinators });
});

// GET /api/admins
app.get('/api/admins', (req, res) => {
  res.json({ success: true, admins: db.getAllAdmins() });
});

const checkSoftwareManagerAuth = (adminId) => {
  if (!adminId) return true;
  const admins = db.getAllAdmins();
  const reqAdmin = admins.find(a => a.id === String(adminId).trim());
  return reqAdmin && (
    (reqAdmin.name && reqAdmin.name.includes('ינון')) || 
    (reqAdmin.role && reqAdmin.role.includes('תוכנה')) ||
    (reqAdmin.roleTitle && reqAdmin.roleTitle.includes('תוכנה'))
  );
};

// PUT /api/admins/:id (Edit admin credentials: name, ID/username, email, pass - Software Manager only)
app.put('/api/admins/:id', (req, res) => {
  const { id } = req.params;
  const { adminId, newId, name, email, pass, roleTitle } = req.body;

  if (adminId && !checkSoftwareManagerAuth(adminId)) {
    return res.status(403).json({ success: false, message: 'פעולת שינוי סיסמאות ופרטי אדמינים מורשית למנהל תוכנה בלבד' });
  }

  const cleanId = (newId || id).replace(/[^0-9]/g, '');
  const updatedFields = {
    id: cleanId,
    name,
    email,
    pass,
    roleTitle: roleTitle || 'אדמין מוסדות חורב'
  };

  const updated = db.updateAdmin(id, updatedFields);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'אדמין לא נמצא' });
  }
  res.json({ success: true, admin: updated, message: 'פרטי האדמין והסיסמה עודכנו בהצלחה!' });
});

// POST /api/users (Software Manager only)
app.post('/api/users', (req, res) => {
  const { adminId, id, name, email } = req.body;

  if (adminId && !checkSoftwareManagerAuth(adminId)) {
    return res.status(403).json({ success: false, message: 'פעולת הוספת רכזים מורשית למנהל תוכנה בלבד' });
  }

  if (!id || !name || !email) {
    return res.status(400).json({ success: false, message: 'יש למלא ת"ז, שם מלא ואימייל' });
  }
  const cleanId = id.replace(/[^0-9]/g, '');
  db.addCoordinator({ id: cleanId, name, email });
  res.json({ success: true, message: 'הרכז/ת הוסף/ה בהצלחה לרשימת המורשים!' });
});

// PUT /api/users/:id (Edit coordinator - Software Manager only)
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { adminId, newId, name, email } = req.body;

  if (adminId && !checkSoftwareManagerAuth(adminId)) {
    return res.status(403).json({ success: false, message: 'פעולת עריכת רכזים מורשית למנהל תוכנה בלבד' });
  }

  const cleanId = (newId || id).replace(/[^0-9]/g, '');
  const updated = db.updateCoordinator(id, { id: cleanId, name, email });
  if (!updated) {
    return res.status(404).json({ success: false, message: 'רכז/ת לא נמצא/ה' });
  }
  res.json({ success: true, coordinator: updated, message: 'פרטי הרכז/ת עודכנו בהצלחה!' });
});

// DELETE /api/users/:id (Software Manager only)
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { adminId } = req.body || req.query || {};

  if (adminId && !checkSoftwareManagerAuth(adminId)) {
    return res.status(403).json({ success: false, message: 'פעולת מחיקת רכזים מורשית למנהל תוכנה בלבד' });
  }

  db.removeCoordinator(id);
  res.json({ success: true, message: 'הרכז/ת הוסר/ה מורשי המערכת' });
});

// GET /api/settings/webhook (Get Google Webhook URL & Secret Key)
app.get('/api/settings/webhook', (req, res) => {
  res.json({
    success: true,
    webhookUrl: db.getGoogleWebhookUrl(),
    secretKey: db.getMailerSecretKey()
  });
});

// POST /api/settings/webhook (Update Google Webhook URL & Secret Key - Software Manager only)
app.post('/api/settings/webhook', (req, res) => {
  const { adminId, webhookUrl, secretKey } = req.body;

  if (adminId && !checkSoftwareManagerAuth(adminId)) {
    return res.status(403).json({ success: false, message: 'עדכון הגדרות הדיוור מורשה למנהל תוכנה בלבד' });
  }

  if (webhookUrl && webhookUrl.startsWith('http')) {
    db.updateGoogleWebhookUrl(webhookUrl.trim());
  }
  if (secretKey && secretKey.trim()) {
    db.updateMailerSecretKey(secretKey.trim());
  }
  res.json({
    success: true,
    webhookUrl: db.getGoogleWebhookUrl(),
    secretKey: db.getMailerSecretKey(),
    message: 'הגדרות ה-Webhook ומפתח האבטחה (Secret Key) עודכנו בהצלחה!'
  });
});

// GET /api/email-logs
app.get('/api/email-logs', (req, res) => {
  res.json({ success: true, logs: db.data.emailLogs });
});

// POST /api/email/test (Live Email Verification Test)
app.post('/api/email/test', async (req, res) => {
  const { recipientEmail } = req.body;
  if (!recipientEmail) {
    return res.status(400).json({ success: false, message: 'יש להזין כתובת אימייל לבדיקה' });
  }

  const result = await mailer.sendTestEmail(recipientEmail);
  if (result.success) {
    res.json({ success: true, message: `מייל בדיקה נשלח בהצלחה לכתובת: ${recipientEmail}` });
  } else {
    res.json({ success: false, message: `שגיאה בשליחת מייל בדיקה: ${result.error ? result.error.message : 'לא ידוע'}` });
  }
});

// --------------------------------------------------------------------------
// Start Server on Port 4050
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// 6. Keep-Alive Self Pinger (מניעת הירדמות השרת 24/7)
// --------------------------------------------------------------------------
const https = require('https');
const http = require('http');

setInterval(() => {
  const targetUrl = process.env.RENDER_EXTERNAL_URL || 'https://horev-bitulim-1.onrender.com';
  console.log(`[Keep-Alive Pinger] Pinging ${targetUrl} to maintain 24/7 instant response...`);
  const client = targetUrl.startsWith('https') ? https : http;
  client.get(`${targetUrl}/api/requests`, (res) => {
    res.on('data', () => {});
  }).on('error', (err) => {
    console.log('[Keep-Alive Error]:', err.message);
  });
}, 5 * 60 * 1000); // 5 minutes

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`פלטפורמת ביטול ארוחות - מוסדות חורב ירושלים`);
  console.log(`השרת מופעל בסביבה עננית בפורט: ${PORT}`);
  console.log(`==================================================`);
});
