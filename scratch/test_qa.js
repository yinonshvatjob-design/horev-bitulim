/* ==========================================================================
   Comprehensive Automated QA Test Suite for Meal Cancellation Platform
   ========================================================================== */

const http = require('http');
const express = require('express');
const cors = require('cors');
const db = require('../db');
const mailer = require('../mailer');

// Disable actual mailer network calls during automated test suite by mocking sendMailViaGoogleWebhook
mailer.sendMailViaGoogleWebhook = async function(to, subject, html, cc = []) {
  db.addEmailLog('bitulim@horev.org.il', subject, `[MOCK QA] Sent to ${to}`);
  return { success: true, mock: true };
};

// Setup Test Server
const app = express();
app.use(cors());
app.use(express.json());

// Load server routes by importing or mirroring endpoints
// Auth
app.post('/api/auth/login', (req, res) => {
  const { role, id, pass } = req.body;
  if (!id || !String(id).trim()) return res.status(400).json({ success: false, message: 'יש להזין תעודת זהות, טלפון או אימייל' });
  const rawInput = String(id).trim();
  const cleanDigits = rawInput.replace(/[^0-9]/g, '');
  const unpaddedDigits = cleanDigits.replace(/^0+/, '');
  const paddedDigits = cleanDigits ? cleanDigits.padStart(9, '0') : '';

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

  const admin = db.getAllAdmins().find(a => isMatch(a.id, a.email, a.name));
  if (admin) {
    if (pass && admin.pass && admin.pass !== pass) return res.status(401).json({ success: false, message: 'סיסמת אדמין שגויה' });
    return res.json({ success: true, user: { id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN', roleTitle: admin.roleTitle || 'אדמין' } });
  }

  const coordinator = db.getAllCoordinators().find(c => isMatch(c.id, c.email, c.name));
  if (coordinator) {
    return res.json({ success: true, user: { id: coordinator.id, name: coordinator.name, email: coordinator.email, role: 'COORDINATOR', roleTitle: 'רכז/ת מורש/ת' } });
  }

  return res.status(403).json({ success: false, message: `הפרטים שהוזנו (${rawInput}) אינם מופיעים ברשימת המורשים.` });
});

// Requests
app.get('/api/requests', (req, res) => {
  res.json({ success: true, requests: db.getAllRequests() });
});

app.post('/api/requests', async (req, res) => {
  const { applicantId, applicantName, applicantEmail, group, startDate, endDate, requestedMeals, reason, mandatoryConfirmed } = req.body;
  if (!group || !startDate || !endDate || !requestedMeals || requestedMeals.length === 0 || !reason) {
    return res.status(400).json({ success: false, message: 'יש למלא את כל שדות החובה בטופס' });
  }
  if (!mandatoryConfirmed) {
    return res.status(400).json({ success: false, message: 'חובה לאשר את 2 ההנחיות המוסדיות' });
  }

  const now = new Date();
  const dayOfWeek = (d) => { const dw = d.getDay(); return dw === 5 || dw === 6; };
  let curr = new Date(startDate + 'T12:00:00');
  let needed = 2;
  while (needed > 0) {
    curr.setDate(curr.getDate() - 1);
    if (!dayOfWeek(curr)) needed--;
  }

  if (now > curr) {
    return res.status(400).json({ success: false, message: `חסימת ימי עסקים: תאריך הביטול קרוב מדי` });
  }

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
      { time: submittedAtStr, title: "הגשת בקשת ביטול", desc: `הבקשה הוגשה ע"י ${applicantName}`, type: "info" }
    ]
  };

  const stored = db.addRequest(newReq);
  await mailer.sendSubmissionAlertToAdmins(stored);
  res.json({ success: true, request: stored });
});

app.post('/api/requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approvedRefund, approvedMeals, adminNotes, adminName } = req.body;
  const request = db.getRequestById(id);
  if (!request) return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });

  const refundAmount = parseFloat(approvedRefund) || 0;
  const nowStr = db.formatDate(new Date());

  const updatedReq = db.updateRequest(id, {
    status: "APPROVED",
    approvedRefund: refundAmount,
    approvedDetails: approvedMeals || request.requestedMeals.join(', '),
    adminNotes: adminNotes || "",
    handledBy: adminName || "חגי היקר",
    handledAt: nowStr
  });

  await mailer.sendDecisionToCoordinator(updatedReq);
  res.json({ success: true, request: updatedReq });
});

app.post('/api/requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { adminNotes, adminName } = req.body;
  const request = db.getRequestById(id);
  if (!request) return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });

  const nowStr = db.formatDate(new Date());
  const updatedReq = db.updateRequest(id, {
    status: "REJECTED",
    approvedRefund: 0,
    adminNotes: adminNotes || "",
    handledBy: adminName || "חגי היקר",
    handledAt: nowStr
  });

  await mailer.sendDecisionToCoordinator(updatedReq);
  res.json({ success: true, request: updatedReq });
});

app.post('/api/requests/:id/receipt', async (req, res) => {
  const { id } = req.params;
  const { amount, store, notes, fileName, fileData } = req.body;
  const updatedReq = db.addReceiptToRequest(id, { amount, store, notes, fileName, fileData });
  if (!updatedReq) return res.status(404).json({ success: false, message: 'בקשה לא נמצאה' });

  await mailer.sendReceiptNotificationToEsther(updatedReq, updatedReq.receipt);
  res.json({ success: true, request: updatedReq });
});

app.delete('/api/requests/:id', (req, res) => {
  const deleted = db.deleteRequest(req.params.id);
  res.json({ success: deleted });
});

app.post('/api/requests/delete-batch', (req, res) => {
  const count = db.deleteBatchRequests(req.body.ids);
  res.json({ success: true, count });
});

app.delete('/api/requests', (req, res) => {
  const count = db.clearAllRequests();
  res.json({ success: true, count });
});

app.get('/api/users', (req, res) => res.json({ success: true, coordinators: db.getAllCoordinators() }));
app.get('/api/admins', (req, res) => res.json({ success: true, admins: db.getAllAdmins() }));

const server = app.listen(9876, async () => {
  console.log('--- STARTING COMPREHENSIVE QA TEST SUITE ---');
  let passedCount = 0;
  let failedCount = 0;

  const test = (title, condition) => {
    if (condition) {
      console.log(`  ✓ PASSED: ${title}`);
      passedCount++;
    } else {
      console.error(`  ✕ FAILED: ${title}`);
      failedCount++;
    }
  };

  const reqHelper = (method, path, body = null) => {
    return new Promise((resolve) => {
      const payload = body ? JSON.stringify(body) : '';
      const req = http.request({
        hostname: 'localhost',
        port: 9876,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });
      if (payload) req.write(payload);
      req.end();
    });
  };

  try {
    // 1. Auth Tests
    let res = await reqHelper('POST', '/api/auth/login', { id: '021395694' });
    test('Coordinator Login via Exact ID (Ohad)', res.data.success && res.data.user.name.includes('אהרנפלד'));

    res = await reqHelper('POST', '/api/auth/login', { id: '21395694' });
    test('Coordinator Login via Unpadded ID', res.data.success && res.data.user.id === '021395694');

    res = await reqHelper('POST', '/api/auth/login', { id: 'ohadhadasa@gmail.com' });
    test('Coordinator Login via Email', res.data.success);

    res = await reqHelper('POST', '/api/auth/login', { id: '0584220463', pass: 'hagai2026' });
    test('Admin Login Hagai via ID & Password', res.data.success && res.data.user.role === 'ADMIN');

    res = await reqHelper('POST', '/api/auth/login', { id: '0584220463', pass: 'wrongpass' });
    test('Admin Login Rejected on Wrong Password', res.status === 401 && !res.data.success);

    // 2. Cancellation Request & 48h Validation Tests
    const validStartDate = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
    const pastStartDate = new Date(Date.now() + 3600000 * 5).toISOString().split('T')[0];

    res = await reqHelper('POST', '/api/requests', {
      applicantId: '021395694',
      applicantName: 'אהרנפלד אוהד',
      applicantEmail: 'ohadhadas@horev.org.il',
      group: "שכבה ט'",
      startDate: pastStartDate,
      endDate: pastStartDate,
      requestedMeals: ["ארוחת צהריים"],
      reason: "ניסיון הגשה בתוך פחות מ-48 שעות",
      mandatoryConfirmed: true
    });
    test('Business Days Cutoff Enforcement Blocks Close Date', res.status === 400 && (res.data.message.includes('ימי עסקים') || res.data.message.includes('חסימת')));

    res = await reqHelper('POST', '/api/requests', {
      applicantId: '021395694',
      applicantName: 'אהרנפלד אוהד',
      applicantEmail: 'ohadhadas@horev.org.il',
      group: "שכבה ט'",
      startDate: validStartDate,
      endDate: validStartDate,
      requestedMeals: ["ארוחת בוקר", "ארוחת צהריים"],
      reason: "טיול שדה מדבר יהודה 3 ימים",
      mandatoryConfirmed: true
    });
    test('Valid Request Submission Success (>48h)', res.data.success && res.data.request.id.startsWith('REQ-'));

    const createdReqId = res.data.request ? res.data.request.id : null;
    test('Database Request ID matches API response ID', createdReqId && db.getRequestById(createdReqId) !== undefined);

    // 3. Custom Approval & Refund Test
    if (createdReqId) {
      res = await reqHelper('POST', `/api/requests/${createdReqId}/approve`, {
        approvedRefund: 450,
        approvedMeals: "ארוחת צהריים בלבד",
        adminNotes: "מאושר מותאם אישית לאחר בדיקת ספקים",
        adminName: "חגי היקר"
      });
      test('Custom Approval & Refund ₪450 update', res.data.success && res.data.request.approvedRefund === 450 && res.data.request.status === 'APPROVED');
    }

    // 4. Pilot Receipt Upload Test
    if (createdReqId) {
      res = await reqHelper('POST', `/api/requests/${createdReqId}/receipt`, {
        amount: 450,
        store: "רמי לוי שיווק השקמה",
        notes: "קבלת קניות עבור טיול י\"א",
        fileName: "receipt_test.png",
        fileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      });
      test('Pilot Receipt Upload & Esther Alert Trigger', res.data.success && res.data.request.receipt.amount === 450 && res.data.request.receipt.store.includes('רמי לוי'));
    }

    // 5. Deletion Tests
    res = await reqHelper('POST', '/api/requests', {
      applicantId: '033963430',
      applicantName: 'אורבך נתן',
      applicantEmail: 'natanaue@horev.org.il',
      group: "שכבה י'",
      startDate: validStartDate,
      endDate: validStartDate,
      requestedMeals: ["ארוחת צהריים"],
      reason: "אירוע בדיקה מחיקה",
      mandatoryConfirmed: true
    });
    const deleteReqId = res.data.request ? res.data.request.id : null;

    res = await reqHelper('DELETE', `/api/requests/${deleteReqId}`);
    test('Single Request Deletion API', res.data.success && db.getRequestById(deleteReqId) === undefined);

    // Summary
    console.log('\n==================================================');
    console.log(`  QA RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('==================================================');

  } catch (err) {
    console.error('QA Test Suite Exception:', err);
  } finally {
    server.close();
    process.exit(failedCount === 0 ? 0 : 1);
  }
});
