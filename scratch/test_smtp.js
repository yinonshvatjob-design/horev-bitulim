require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.GMAIL_USER || 'bitulim@horev.org.il';
const pass = process.env.GMAIL_APP_PASSWORD || 'yxrtocjadwegsyio';

console.log('Testing Direct Gmail SMTP for:', user);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: user,
    pass: pass
  }
});

transporter.sendMail({
  from: `"מוסדות חורב ירושלים" <${user}>`,
  to: 'yinonshvat@gmail.com',
  subject: '[בדיקה קריטית] מייל ישיר מ-Gmail SMTP בלייב',
  html: '<h2>בדיקת הגעת מייל בלייב מ-bitulim@horev.org.il</h2><p>אם קיבלת מייל זה - הכל עובד 100% בתיבת הדואר!</p>'
}, (err, info) => {
  if (err) {
    console.error('❌ SMTP Error:', err);
  } else {
    console.log('✅ SMTP Success! MessageId:', info.messageId, 'Response:', info.response);
  }
});
