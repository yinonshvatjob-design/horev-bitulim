const db = require('../db');
const mailer = require('../mailer');
const yinonEmail = 'yinonshvat@horev.org.il';
mailer.getSecretaryEmail = async () => yinonEmail;
mailer.getSecretaryAdmin = async () => ({
  name: 'ינון (מזכירות)',
  roleTitle: 'מזכירות',
  email: yinonEmail
});

async function run() {
  const reqId = 'REQ-127';
  const receiptObj = {
    amount: 1500,
    store: 'טסט בדיקה בע"מ',
    notes: 'קבלת ניסיון',
    fileName: 'test_receipt.png',
    fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  };
  const updated = await db.addReceipt(reqId, receiptObj);
  console.log(`Receipt added to ${reqId}`);
  await mailer.sendReceiptNotificationToEsther(updated, updated.receipt);
  console.log('Receipt email sent!');
}
run();
