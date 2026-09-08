const mailer = require('../mailer');
const db = require('../db');

async function testLiveEmail() {
  console.log('--- TESTING LIVE GOOGLE MAILER SERVICE ---');
  console.log('Current Admins in DB:', db.getAllAdmins());

  const testEmail = 'yinonshvat@gmail.com';
  console.log(`Sending test email to ${testEmail}...`);

  const res = await mailer.sendTestEmail(testEmail);
  console.log('Result for test email:', res);

  console.log('\nSending submission alert test to admins...');
  const alertRes = await mailer.sendSubmissionAlertToAdmins({
    id: 'REQ-TEST-LIVE',
    applicantId: '021395694',
    applicantName: 'אהרנפלד אוהד (בדיקת לייב)',
    applicantEmail: 'ohadhadas@horev.org.il',
    group: 'שכבה ט\'',
    startDate: '2026-09-15',
    endDate: '2026-09-15',
    requestedMeals: ['ארוחת בוקר', 'ארוחת צהריים'],
    reason: 'בדיקת מערכת הדיוור בזמן אמת',
    submittedAt: db.formatDate(new Date())
  });
  console.log('Submission Alert Result:', alertRes);
}

testLiveEmail().catch(err => console.error('Live Email Error:', err));
