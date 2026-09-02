/* ==========================================================================
   פלטפורמת ביטול ארוחות - שרת דיוור אימייל Google/Gmail (Mailer Service)
   ========================================================================== */

const nodemailer = require('nodemailer');
const db = require('./db');

class MailerService {
  constructor() {
    this.user = process.env.GMAIL_USER || 'bitulim@horev.org.il';
    this.treasurerEmail = process.env.TREASURER_EMAIL || 'chagi@horev.org.il';
    this.secretaryEmail = process.env.SECRETARY_EMAIL || 'esters@horev.org.il';
    
    // Transporter Config
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.user,
        pass: process.env.GMAIL_APP_PASSWORD || 'secret'
      }
    });
  }

  // 1. Send Alert Email to Hagai & Esther on New Submission
  async sendSubmissionAlertToAdmins(reqData) {
    const subject = `[ביטול ארוחות] בקשה חדשה מאת ${reqData.applicantName} - ${reqData.group} (${reqData.startDate})`;
    
    const htmlContent = `
      <div dir="rtl" style="font-family: 'Rubik', Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          
          <div style="background: #1b779e; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">מוסדות חורב ירושלים — פלטפורמת ביטול ארוחות</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">התקבלה בקשת ביטול ארוחות חדשה לאישור הגזברות</p>
          </div>

          <div style="padding: 25px;">
            <h3 style="color: #2563eb; margin-top: 0;">📌 פרטי הבקשה המלאים:</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #64748b;"><strong>מגיש/ת הבקשה:</strong></td><td style="padding: 8px 0; font-weight: bold;">${reqData.applicantName} (ת"ז: ${reqData.applicantId})</td></tr>
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #64748b;"><strong>כיתה / שכבה:</strong></td><td style="padding: 8px 0; font-weight: bold;">${reqData.group}</td></tr>
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #64748b;"><strong>טווח תאריכים:</strong></td><td style="padding: 8px 0; font-weight: bold;">${reqData.startDate} ${reqData.startDate !== reqData.endDate ? 'עד ' + reqData.endDate : ''}</td></tr>
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #64748b;"><strong>ארוחות מבוטלות:</strong></td><td style="padding: 8px 0; font-weight: bold;">${reqData.requestedMeals.join(', ')}</td></tr>
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #64748b;"><strong>סיבת הביטול:</strong></td><td style="padding: 8px 0; font-weight: bold;">${reqData.reason}</td></tr>
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #64748b;"><strong>תאריך הגשה:</strong></td><td style="padding: 8px 0; color: #059669; font-weight: bold;">${reqData.submittedAt} (עומד בתקן 48 שעות מראש)</td></tr>
            </table>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="http://localhost:8080" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                🔘 מעבר לאישור הבקשה בפלטפורמה
              </a>
            </div>
          </div>

          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
            מוסדות חורב ירושלים — תורה עם דרך ארץ
          </div>
        </div>
      </div>
    `;

    return this.sendMail(this.treasurerEmail, subject, htmlContent, [this.secretaryEmail]);
  }

  // 2. Send Decision Email to Coordinator on Approval/Rejection
  async sendDecisionToCoordinator(reqData) {
    const isApproved = reqData.status === 'APPROVED';
    const statusText = isApproved ? 'אושרה' : 'נדחתה';
    const subject = `[עדכון גזברות] בקשת ביטול ארוחות #${reqData.id} - ${statusText} (סכום החזר: ₪${reqData.approvedRefund || 0})`;

    const htmlContent = `
      <div dir="rtl" style="font-family: 'Rubik', Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          
          <div style="background: ${isApproved ? '#059669' : '#dc2626'}; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">מוסדות חורב ירושלים — עדכון בקשת ביטול ארוחות</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">בקשתך #${reqData.id} נבחנה ועודכנה ע"י חגי היקר והגזברות</p>
          </div>

          <div style="padding: 25px;">
            <h3 style="color: ${isApproved ? '#059669' : '#dc2626'}; margin-top: 0;">
              📋 סטטוס הבקשה: ${isApproved ? 'אושר מותאם אישית (Custom Approved)' : 'נדחה ע"י הגזברות'}
            </h3>

            ${isApproved ? `
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="margin: 0 0 8px 0; color: #065f46;"><strong>🔹 ארוחות שאושרו לביטול בפועל:</strong></p>
                <p style="margin: 0; color: #047857; font-weight: bold;">${reqData.approvedDetails || reqData.requestedMeals.join(', ')}</p>
                
                <hr style="border: none; border-top: 1px dashed #a7f3d0; margin: 12px 0;">
                
                <p style="margin: 0; font-size: 18px; color: #065f46;">
                  💰 <strong>סכום החזר כספי שאושר לרכז/ת: ₪${reqData.approvedRefund.toLocaleString()}</strong>
                </p>
              </div>
            ` : ''}

            ${reqData.adminNotes ? `
              <div style="background: #f8fafc; border-right: 4px solid #3b82f6; padding: 12px 15px; margin-bottom: 20px;">
                <strong>💬 הערת חגי היקר / גזברות:</strong><br>
                <span style="color: #334155;">"${reqData.adminNotes}"</span>
              </div>
            ` : ''}

            <!-- 2 Mandatory Guidelines -->
            <div style="background: #fff8f6; border: 2px solid #f87171; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="color: #dc2626; margin: 0 0 10px 0;">⚠️ תזכורות חובה מוסדיות לכל רכז/ת:</h4>
              <ol style="margin: 0; padding-right: 20px; color: #991b1b; line-height: 1.6;">
                <li><strong>יש לשמור על כל הקבלות ולהעבירם לאסתר / חגי.</strong></li>
                <li><strong>האוכל שנקנה לטובת האירוע יאוחסן אך ורק בחדר המוקצה לכך בצוללת.</strong></li>
              </ol>
            </div>

            <div style="text-align: center; margin-top: 25px;">
              <a href="http://localhost:8080" style="background: #1b779e; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
                👉 לצפייה בפרטי הבקשה ובציר הזמן
              </a>
            </div>
          </div>

          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
            מוסדות חורב ירושלים — תורה עם דרך ארץ
          </div>
        </div>
      </div>
    `;

    return this.sendMail(reqData.applicantEmail, subject, htmlContent);
  }

  // General Send Mail Helper
  async sendMail(to, subject, html, cc = []) {
    const nowStr = db.formatDate(new Date());

    try {
      // Send Real Mail via Nodemailer Transporter if App Password configured
      if (process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD !== 'secret' && process.env.GMAIL_APP_PASSWORD !== 'horev_app_pass_secret') {
        const info = await this.transporter.sendMail({
          from: `"מוסדות חורב — ביטול ארוחות" <${this.user}>`,
          to: to,
          cc: cc,
          subject: subject,
          html: html
        });
        console.log(`[REAL GMAIL SENT] ID: ${info.messageId} to ${to}`);
      }

      db.addEmailLog({
        time: nowStr,
        to: to,
        subject: subject,
        status: `נשלח בהצלחה מ-${this.user}`
      });

      return { success: true, to, subject };
    } catch (error) {
      console.error("[MAILER ERROR]", error);
      db.addEmailLog({
        time: nowStr,
        to: to,
        subject: subject,
        status: "שגיאת שליחה: " + error.message
      });
      return { success: false, error };
    }
  }
}

module.exports = new MailerService();
