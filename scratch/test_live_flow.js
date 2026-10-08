const db = require('../db');
const mailer = require('../mailer');

// Override admin fetching so everything goes to Yinon
const yinonEmail = 'yinonshvat@horev.org.il';

mailer.getTreasurerEmail = async () => yinonEmail;
mailer.getSecretaryEmail = async () => yinonEmail;
mailer.getSoftwareManagerAdmin = async () => ({
  name: 'ינון',
  roleTitle: 'מנהל תוכנה',
  email: yinonEmail
});
mailer.getSecretaryAdmin = async () => ({
  name: 'ינון (מזכירות)',
  roleTitle: 'מזכירות',
  email: yinonEmail
});
mailer.getTreasurerAdmin = async () => ({
  name: 'ינון (מנהל)',
  roleTitle: 'מנהל',
  email: yinonEmail
});

async function runFlow() {
  try {
    console.log('1. Creating test request for Yinon...');
    const reqId = "REQ-" + (Math.floor(Math.random() * 900) + 100);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);
    const dateStr = startDate.toISOString().split('T')[0];
    
    const newReq = {
      id: reqId,
      applicantId: '203084637',
      applicantName: 'ינון שבת (בדיקה אוטומטית)',
      applicantEmail: yinonEmail,
      group: 'קבוצת בדיקה',
      startDate: dateStr,
      endDate: dateStr,
      requestedMeals: ['ארוחת בוקר', 'ארוחת ערב'],
      reason: 'בדיקת יציבות מערכת E2E ע"י AI',
      mandatoryConfirmed: true,
      submittedAt: db.formatDate(new Date()),
      status: 'PENDING',
      approvedRefund: 0,
      approvedDetails: null,
      adminNotes: '',
      handledBy: null,
      handledAt: null,
      timeline: [{ time: db.formatDate(new Date()), title: "הגשת בקשת ביטול", desc: "הוגש ע\"י ינון (בדיקה)", type: "info" }]
    };
    
    await db.addRequest(newReq);
    console.log(`Request ${reqId} added to Firestore.`);
    
    console.log('2. Sending submission alert to Manager (Yinon)...');
    await mailer.sendSubmissionAlertToAdmins(newReq);
    console.log('Submission email sent!');
    
    console.log('3. Approving the request...');
    const updatedReq = await db.updateRequest(reqId, {
      status: 'APPROVED',
      approvedRefund: 1500,
      approvedDetails: 'ארוחת בוקר, ארוחת ערב',
      adminNotes: 'מאושר במסגרת בדיקת תקינות מלאה',
      handledBy: 'ינון (כמנהל טסט)',
      handledAt: db.formatDate(new Date())
    });
    console.log(`Request ${reqId} approved in Firestore.`);
    
    console.log('4. Sending decision email to Coordinator (Yinon)...');
    await mailer.sendDecisionToCoordinator(updatedReq);
    console.log('Decision email sent!');
    
    console.log('5. Uploading receipt...');
    const receiptObj = {
      amount: 1500,
      store: 'טסט בדיקה בע"מ',
      notes: 'קבלת ניסיון',
      fileName: 'test_receipt.png',
      fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };
    const reqWithReceipt = await db.addReceiptToRequest(reqId, receiptObj);
    console.log(`Receipt added to request ${reqId}.`);
    
    console.log('6. Sending receipt email to Secretary (Yinon)...');
    await mailer.sendReceiptNotificationToEsther(reqWithReceipt, reqWithReceipt.receipt);
    console.log('Receipt email sent!');
    
    console.log(`\n--- SUCCESS! ALL 3 EMAILS SENT TO ${yinonEmail} ---`);
    console.log(`You can now check Firestore or the UI. The request ID is ${reqId}.`);
    process.exit(0);
  } catch (err) {
    console.error('Error during flow:', err);
    process.exit(1);
  }
}
runFlow();
