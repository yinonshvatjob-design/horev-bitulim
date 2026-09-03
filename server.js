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

// Middlewares
app.use(cors());
app.use(express.json());

// Serve Static Frontend Assets (Web Client)
app.use(express.static(__dirname));

// --------------------------------------------------------------------------
// 1. Auth REST API
// --------------------------------------------------------------------------

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { role, id, pass } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: 'יש להזין תעודת זהות / טלפון' });
  }

  if (role === 'admin') {
    const admin = db.findAdmin(id, pass);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'פרטי אדמין שגויים (ת"ז או סיסמה לא נכונים)' });
    }
    return res.json({
      success: true,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'ADMIN',
        roleTitle: admin.role
      }
    });
  } else {
    // Coordinator Login
    const coordinator = db.findCoordinator(id);
    if (!coordinator) {
      return res.status(403).json({ success: false, message: 'תעודת הזהות אינה מופיעה ברשימת הרכזים המורשים' });
    }
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

  // 48-Hour Cutoff Validation Rule
  const now = new Date();
  const eventDate = new Date(startDate);
  const diffHours = (eventDate - now) / (1000 * 60 * 60);

  if (diffHours < 48) {
    return res.status(400).json({
      success: false,
      message: `חסימת 48 שעות: תאריך הביטול ${startDate} קרוב מדי (נותרו ${Math.max(0, Math.round(diffHours))} שעות). חוק קשיח: הגשת בקשה לפחות 48 שעות מראש!`
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
      { time: submittedAtStr, title: "שליחת התראה לחגי היקר ואסתר", desc: "נשלח אימייל התראה ל-chagi@horev.org.il ול-esters@horev.org.il", type: "info" }
    ]
  };

  db.addRequest(newReq);

  // Send Alert Email to Admins (Hagai & Esther)
  await mailer.sendSubmissionAlertToAdmins(newReq);

  res.json({ success: true, request: newReq, message: 'הבקשה הוגשה בהצלחה ונשלחה לאישור חגי היקר!' });
});

// POST /api/requests/:id/approve (Custom Approval & Manual Refund in ₪)
app.post('/api/requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approvedRefund, approvedMeals, adminNotes, adminName } = req.body;

  const request = db.getAllRequests().find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });
  }

  const refundAmount = parseFloat(approvedRefund) || 0;
  const nowStr = db.formatDate(new Date());

  const updatedTimeline = [
    ...request.timeline,
    {
      time: nowStr,
      title: `אושר ע"י ${adminName || 'חגי היקר'}`,
      desc: `אושר מותאם אישית. ארוחות מאושרות: ${approvedMeals || request.requestedMeals.join(', ')} | סכום החזר: ₪${refundAmount.toLocaleString()}`,
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
    approvedDetails: approvedMeals || request.requestedMeals.join(', '),
    adminNotes: adminNotes || "",
    handledBy: adminName || "חגי היקר (גזבר)",
    handledAt: nowStr,
    timeline: updatedTimeline
  });

  // Send Automatic Update Email to Coordinator
  await mailer.sendDecisionToCoordinator(updatedReq);

  res.json({ success: true, request: updatedReq, message: `הבקשה אושרה בהצלחה! נשלח מייל עדכון לרכז/ת (${request.applicantEmail}) עם סכום החזר ₪${refundAmount}.` });
});

// POST /api/requests/:id/reject (Rejection with Email to Coordinator)
app.post('/api/requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { adminNotes, adminName } = req.body;

  const request = db.getAllRequests().find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });
  }

  const nowStr = db.formatDate(new Date());

  const updatedTimeline = [
    ...request.timeline,
    {
      time: nowStr,
      title: `נדחה ע"י ${adminName || 'חגי היקר'}`,
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
    handledBy: adminName || "חגי היקר (גזבר)",
    handledAt: nowStr,
    timeline: updatedTimeline
  });

  // Send Automatic Update Email to Coordinator
  await mailer.sendDecisionToCoordinator(updatedReq);

  res.json({ success: true, request: updatedReq, message: 'הבקשה נדחתה. נשלח מייל עדכון לרכז/ת.' });
});

// --------------------------------------------------------------------------
// 3. User & Admin Management REST API
// --------------------------------------------------------------------------

// GET /api/users
app.get('/api/users', (req, res) => {
  res.json({ success: true, coordinators: db.data.coordinators });
});

// POST /api/users
app.post('/api/users', (req, res) => {
  const { id, name, email } = req.body;
  if (!id || !name || !email) {
    return res.status(400).json({ success: false, message: 'יש למלא ת"ז, שם מלא ואימייל' });
  }
  const cleanId = id.replace(/[^0-9]/g, '');
  db.addCoordinator({ id: cleanId, name, email });
  res.json({ success: true, message: 'הרכז/ת הוסף/ה בהצלחה לרשימת המורשים!' });
});

// PUT /api/users/:id (Edit coordinator)
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const updated = db.updateCoordinator(id, { name, email });
  if (!updated) {
    return res.status(404).json({ success: false, message: 'רכז/ת לא נמצא/ה' });
  }
  res.json({ success: true, coordinator: updated, message: 'פרטי הרכז/ת עודכנו בהצלחה!' });
});

// DELETE /api/users/:id
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.removeCoordinator(id);
  res.json({ success: true, message: 'הרכז/ת הוסר/ה מורשי המערכת' });
});

// GET /api/email-logs
app.get('/api/email-logs', (req, res) => {
  res.json({ success: true, logs: db.data.emailLogs });
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
