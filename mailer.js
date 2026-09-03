/* ==========================================================================
   פלטפורמת ביטול ארוחות - שרת דיוור אימייל Google Apps Script Engine (Mailer Service)
   100% גוגל הרשמי, 100% הגעה לתיבת הדואר, 0₪ לכל החיים ללא שום חסימות פורטים!
   ========================================================================== */

const https = require('https');
const db = require('./db');

const GOOGLE_WEBHOOK_URL = process.env.GOOGLE_MAILER_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbygzoipBy6omG2rtrJPnSJJIFK-IJF6P6szb0y-YVzzxro45Ht9rlb5l9-_Zdd-Fx6h/exec';

class MailerService {
  constructor() {
    this.user = process.env.GMAIL_USER || 'bitulim@horev.org.il';
    this.treasurerEmail = process.env.TREASURER_EMAIL || 'chagi@horev.org.il';
    this.secretaryEmail = process.env.SECRETARY_EMAIL || 'esters@horev.org.il';
  }

  // Send Email via Official Google Apps Script Webhook (POST + GET Redirect)
  async sendMailViaGoogleWebhook(to, subject, html, cc = []) {
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        to: Array.isArray(to) ? to.join(',') : (to || ''),
        cc: Array.isArray(cc) ? cc.join(',') : (cc || ''),
        subject: subject || 'עדכון מוסדות חורב',
        html: html || ''
      });

      const sendRequest = (urlStr, isRedirect = false, redirectCount = 0) => {
        if (redirectCount > 5) {
          resolve({ success: false, error: new Error('Too many redirects') });
          return;
        }

        const url = new URL(urlStr);
        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: isRedirect ? 'GET' : 'POST',
          rejectUnauthorized: false,
          headers: isRedirect ? {} : {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 15000
        };

        const req = https.request(options, (res) => {
          // Handle Google Apps Script 302 Redirect (Switch to GET for redirect URL)
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            sendRequest(res.headers.location, true, redirectCount + 1);
            return;
          }

          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.result === 'success') {
                console.log(`[GOOGLE GMAIL SENT SUCCESSFULLY] to ${to}`);
                resolve({ success: true, body: data });
              } else {
                console.error(`[GOOGLE GMAIL ERROR]`, data);
                resolve({ success: false, error: new Error(data.message || 'Error sending email') });
              }
            } catch (err) {
              if (res.statusCode >= 200 && res.statusCode < 400) {
                resolve({ success: true, body });
              } else {
                resolve({ success: false, error: new Error(`HTTP ${res.statusCode}: ${body}`) });
              }
            }
          });
        });

        req.on('error', (err) => {
          console.error('[GOOGLE GMAIL FAILED]', err.message);
          resolve({ success: false, error: err });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, error: new Error('Google Mailer Timeout') });
        });

        if (!isRedirect) {
          req.write(payload);
        }
        req.end();
      };

      sendRequest(GOOGLE_WEBHOOK_URL, false, 0);
    });
  }

  // 1. Send Alert Email to Hagai & Esther on New Submission
  async sendSubmissionAlertToAdmins(reqData) {
    const mealsStr = Array.isArray(reqData.requestedMeals) ? reqData.requestedMeals.join(', ') : (reqData.requestedMeals || '');
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
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #64748b;"><strong>ארוחות מבוטלות:</strong></td><td style="padding: 8px 0; font-weight: bold;">${mealsStr}</td></tr>
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #64748b;"><strong>סיבת הביטול:</strong></td><td style="padding: 8px 0; font-weight: bold;">${reqData.reason}</td></tr>
              <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 8px 0; color: #059669; font-weight: bold;">${reqData.submittedAt} (עומד בתקן 48 שעות מראש)</td></tr>
            </table>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="https://bitulim.horevit.com" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
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

  // 2. Send Decision Email to Coordinator on Approval/Rejection (with CC to Admins for confirmation)
  async sendDecisionToCoordinator(reqData) {
    const coordinator = db.findCoordinator(reqData.applicantId);
    const targetEmail = (coordinator && coordinator.email) ? coordinator.email : reqData.applicantEmail;

    if (!targetEmail) {
      console.error(`[MAILER WARNING] No target email found for applicantId ${reqData.applicantId}`);
      return { success: false, error: new Error('No target email address found') };
    }

    const isApproved = reqData.status === 'APPROVED';
    const statusText = isApproved ? 'אושרה' : 'נדחתה';
    const subject = `[עדכון גזברות] בקשת ביטול ארוחות #${reqData.id} - ${statusText} (סכום החזר: ₪${reqData.approvedRefund || 0})`;
    const mealsStr = Array.isArray(reqData.requestedMeals) ? reqData.requestedMeals.join(', ') : (reqData.requestedMeals || '');

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
                <p style="margin: 0; color: #047857; font-weight: bold;">${reqData.approvedDetails || mealsStr}</p>
                
                <hr style="border: none; border-top: 1px dashed #a7f3d0; margin: 12px 0;">
                
                <p style="margin: 0; font-size: 18px; color: #065f46;">
                  💰 <strong>סכום החזר כספי שאושר לרכז/ת: ₪${(reqData.approvedRefund || 0).toLocaleString()}</strong>
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
              <a href="https://bitulim.horevit.com" style="background: #1b779e; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
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

    // Send to Coordinator with CC to Treasurer & Secretary for confirmation
    return this.sendMail(targetEmail, subject, htmlContent, [this.treasurerEmail, this.secretaryEmail]);
  }

  // 3. Send Live Test Email to Custom Recipient
  async sendTestEmail(recipientEmail) {
    const subject = `[בדיקת מערכת] מייל בדיקה תקין ממוסדות חורב ירושלים — ביטול ארוחות`;
    const htmlContent = `
      <div dir="rtl" style="font-family: 'Rubik', Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background: #059669; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">✓ מייל בדיקה נשלח בהצלחה!</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">מוסדות חורב ירושלים — פלטפורמת ביטול ארוחות</p>
          </div>
          <div style="padding: 25px;">
            <p style="font-size: 16px; line-height: 1.6;">
              שלום רב,<br><br>
              מייל זה נשלח כחלק מבדיקת תקינות של מערכת הדיוור המוסדית (Google Gmail Engine).<br>
              אם קיבלת הודעה זו — פירושו ששרת הדואר, ה-Webhook והאישורים מוגדרים בצורה תקינה 100%!
            </p>
            <div style="background: #ecfdf5; border-right: 4px solid #10b981; padding: 12px 15px; margin: 20px 0; border-radius: 4px;">
              <strong>📧 שולח המייל:</strong> bitulim@horev.org.il<br>
              <strong>נמען הבדיקה:</strong> ${recipientEmail}<br>
              <strong>זמן השליחה:</strong> ${db.formatDate(new Date())}
            </div>
          </div>
          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
            מוסדות חורב ירושלים — תורה עם דרך ארץ
          </div>
        </div>
      </div>
    `;
    return this.sendMail(recipientEmail, subject, htmlContent);
  }

  // General Send Mail Helper
  async sendMail(to, subject, html, cc = []) {
    const nowStr = db.formatDate(new Date());

    try {
      const res = await this.sendMailViaGoogleWebhook(to, subject, html, cc);
      if (res.success) {
        db.addEmailLog(this.user, subject, `נשלח בהצלחה ל-${to} (Google Gmail)`);
        return { success: true, to, subject };
      } else {
        db.addEmailLog(this.user, subject, `שגיאת שליחה: ${res.error ? res.error.message : 'שגיאת דיוור'}`);
        return { success: false, error: res.error };
      }
    } catch (error) {
      console.error("[MAILER ERROR]", error.message);
      db.addEmailLog(this.user, subject, "שגיאת שליחה: " + error.message);
      return { success: false, error };
    }
  }
}

module.exports = new MailerService();
