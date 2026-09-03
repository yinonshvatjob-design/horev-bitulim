/* ==========================================================================
   פלטפורמת ביטול ארוחות - מוסדות חורב (Database Layer עם תמיכת PostgreSQL ענני)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Initial Admins (Yinon, Hagai, Esther)
const SEED_ADMINS = [
  { id: "0542065606", name: "ינון", role: "מנהל תוכנה (Admin)", email: "yinonshvat@horev.org.il", pass: "yinon2026" },
  { id: "0584220463", name: "חגי היקר", role: "גזבר המוסד (Admin)", email: "chagi@horev.org.il", pass: "hagai2026" },
  { id: "05455408280", name: "אסתר", role: "מזכירת המוסד (Admin)", email: "esters@horev.org.il", pass: "esther2026" },
  { id: "0545540828", name: "אסתר", role: "מזכירת המוסד (Admin)", email: "esters@horev.org.il", pass: "esther2026" }
];

// Initial 26 Authorized Coordinators from Horev list
const SEED_COORDINATORS = [
  { id: "021395694", name: "אהרנפלד אוהד", email: "ohadhadas@horev.org.il" },
  { id: "033963430", name: "אורבך נתן", email: "natanaue@horev.org.il" },
  { id: "308000000", name: "בוהרון מנשה", email: "menasheb@horev.org.il" },
  { id: "040975641", name: "בולבין צבי", email: "zb0527155@horev.org.il" },
  { id: "025018417", name: "ברוך אושרי", email: "oshrib547@horev.org.il" },
  { id: "037670692", name: "גרינברג שמואל", email: "mbibeg@horev.org.il" },
  { id: "057332009", name: "דור יצחק", email: "dorledor@horev.org.il" },
  { id: "033212911", name: "דנטלסקי צביקה", email: "tzvika.yesh@horev.org.il" },
  { id: "036194520", name: "זהבי חן", email: "123chen1@horev.org.il" },
  { id: "058281403", name: "טויבר עופר", email: "ofertb@horev.org.il" },
  { id: "060936481", name: "ירדני אלעד", email: "nahumy7@horev.org.il" },
  { id: "059641555", name: "כהן נחמיה", email: "mnkohen@horev.org.il" },
  { id: "057654667", name: "ליבוביץ דוד", email: "dudilei@horev.org.il" },
  { id: "023642846", name: "מורביה חיים", email: "hmor10@horev.org.il" },
  { id: "312000000", name: "מסילתי עמנואל", email: "amitmesi9@horev.org.il" },
  { id: "206000000", name: "מסינג נתנאל", email: "netanelme@horev.org.il" },
  { id: "029517455", name: "נגיד איתי", email: "naitay@horev.org.il" },
  { id: "204000000", name: "נמיר נריה", email: "nreya56@horev.org.il" },
  { id: "066171638", name: "פיג'ו קובי", email: "kmpecho@horev.org.il" },
  { id: "066385527", name: "פיינגולד נריה", email: "neriyafg@horev.org.il" },
  { id: "303000000", name: "צדק איתמר", email: "itamartzed@horev.org.il" },
  { id: "025352881", name: "קורש רון", email: "koreshhore@horev.org.il" },
  { id: "040119331", name: "קליין מיכאל", email: "mklain80@horev.org.il" },
  { id: "028635092", name: "שוחטמן מוטי", email: "motis@horev.org.il" },
  { id: "059805002", name: "שטיינר אברהם", email: "maleip@horev.org.il" },
  { id: "028536654", name: "שלוסברג שמואל", email: "s.shlosberg@horev.org.il" }
];

const DB_FILE = path.join(__dirname, 'database.json');

class DatabaseManager {
  constructor() {
    this.data = {
      admins: SEED_ADMINS,
      coordinators: SEED_COORDINATORS,
      requests: [
        {
          id: "REQ-101",
          applicantId: "021395694",
          applicantName: "אהרנפלד אוהד",
          applicantEmail: "ohadhadas@horev.org.il",
          group: "שכבה ט'",
          startDate: this.getFutureDate(3),
          endDate: this.getFutureDate(5),
          requestedMeals: ["ארוחת בוקר", "ארוחת צהריים"],
          reason: "טיול שנתי מדבר יהודה למשך 3 ימים",
          submittedAt: this.formatDate(new Date(Date.now() - 3600000 * 5)),
          status: "PENDING",
          approvedRefund: 0,
          approvedDetails: null,
          adminNotes: "",
          handledBy: null,
          handledAt: null,
          timeline: [
            { time: this.formatDate(new Date(Date.now() - 3600000 * 5)), title: "הגשת בקשה", desc: "הבקשה הוגשה ע\"י הרכז אהרנפלד אוהד עבור שכבה ט'", type: "info" },
            { time: this.formatDate(new Date(Date.now() - 3600000 * 4.9)), title: "שליחת אימייל התראה לחגי היקר ואסתר", desc: "נשלח אימייל התראה ל-chagi@horev.org.il ול-esters@horev.org.il", type: "info" }
          ]
        }
      ],
      emailLogs: [
        { time: this.formatDate(new Date()), to: "chagi@horev.org.il", subject: "מערכת ביטול ארוחות מוסדות חורב אותחלה בהצלחה", status: "נשלח בהצלחה (Gmail)" }
      ]
    };

    this.pool = null;
    if (process.env.DATABASE_URL) {
      console.log('Connecting to PostgreSQL Managed Database...');
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
      });
      this.initPg();
    } else {
      this.load();
    }
  }

  getFutureDate(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  }

  formatDate(d = new Date()) {
    if (!d) d = new Date();
    try {
      const options = {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(d);
      const p = {};
      parts.forEach(pt => p[pt.type] = pt.value);
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
    } catch (e) {
      return d.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    }
  }

  async initPg() {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS system_store (
          id VARCHAR(50) PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const res = await this.pool.query(`SELECT payload FROM system_store WHERE id = 'main_store';`);
      if (res.rows.length > 0) {
        this.data = res.rows[0].payload;
        console.log('Loaded live data successfully from PostgreSQL Cloud Database!');
      } else {
        await this.savePg();
        console.log('Initialized initial database store in PostgreSQL Cloud Database!');
      }
    } catch (err) {
      console.error('PostgreSQL Connection Error, falling back to local file:', err.message);
      this.load();
    }
  }

  async savePg() {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO system_store (id, payload, updated_at)
         VALUES ('main_store', $1, NOW())
         ON CONFLICT (id) DO UPDATE SET payload = $1, updated_at = NOW();`,
        [JSON.stringify(this.data)]
      );
    } catch (err) {
      console.error('Error saving to PostgreSQL:', err.message);
    }
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileData = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileData);
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading database.json:', err.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      if (this.pool) {
        this.savePg().catch(err => console.error('Background PG save error:', err));
      }
    } catch (err) {
      console.error('Error saving database.json:', err.message);
    }
  }

  // --- Admins & Coordinators ---
  findAdmin(id, pass) {
    return this.data.admins.find(a => a.id === id && a.pass === pass);
  }

  findCoordinator(id) {
    return this.data.coordinators.find(c => c.id === id);
  }

  getAllCoordinators() {
    return this.data.coordinators;
  }

  addCoordinator(newCoord) {
    const existingIndex = this.data.coordinators.findIndex(c => c.id === newCoord.id);
    if (existingIndex !== -1) {
      this.data.coordinators[existingIndex] = { ...this.data.coordinators[existingIndex], ...newCoord };
    } else {
      this.data.coordinators.push(newCoord);
    }
    this.save();
    return { success: true, coordinator: newCoord };
  }

  updateCoordinator(id, updatedFields) {
    const coord = this.findCoordinator(id);
    if (!coord) return null;
    Object.assign(coord, updatedFields);
    this.save();
    return coord;
  }

  removeCoordinator(id) {
    const initialLength = this.data.coordinators.length;
    this.data.coordinators = this.data.coordinators.filter(c => c.id !== id);
    this.save();
    return this.data.coordinators.length < initialLength;
  }

  // --- Cancellation Requests ---
  getAllRequests() {
    return this.data.requests;
  }

  getRequestById(id) {
    return this.data.requests.find(r => r.id === id);
  }

  getRequestsByApplicant(applicantId) {
    return this.data.requests.filter(r => r.applicantId === applicantId);
  }

  addRequest(reqData) {
    const nextIdNumber = 100 + this.data.requests.length + 1;
    const newReq = {
      id: `REQ-${nextIdNumber}`,
      applicantId: reqData.applicantId,
      applicantName: reqData.applicantName,
      applicantEmail: reqData.applicantEmail,
      group: reqData.group,
      startDate: reqData.startDate,
      endDate: reqData.endDate,
      requestedMeals: reqData.requestedMeals || [],
      reason: reqData.reason,
      submittedAt: this.formatDate(new Date()),
      status: "PENDING",
      approvedRefund: 0,
      approvedDetails: null,
      adminNotes: "",
      handledBy: null,
      handledAt: null,
      timeline: [
        {
          time: this.formatDate(new Date()),
          title: "הגשת בקשת ביטול",
          desc: `הבקשה הוגשה ע"י ${reqData.applicantName} עבור ${reqData.group}`,
          type: "info"
        }
      ]
    };

    this.data.requests.unshift(newReq);
    this.save();
    return newReq;
  }

  updateRequest(id, updatedFields) {
    const req = this.getRequestById(id);
    if (!req) return null;
    Object.assign(req, updatedFields);
    this.save();
    return req;
  }

  approveRequest(id, refundAmount, adminNotes, handledByName) {
    const req = this.getRequestById(id);
    if (!req) return null;

    req.status = "APPROVED";
    req.approvedRefund = parseFloat(refundAmount) || 0;
    req.adminNotes = adminNotes || "";
    req.handledBy = handledByName;
    req.handledAt = this.formatDate(new Date());
    req.timeline.push({
      time: this.formatDate(new Date()),
      title: `אושר ע"י ${handledByName}`,
      desc: `הבקשה אושרה בסכום החזר של ₪${req.approvedRefund}. הערות: ${adminNotes || 'אין'}`,
      type: "success"
    });

    this.save();
    return req;
  }

  rejectRequest(id, reason, handledByName) {
    const req = this.getRequestById(id);
    if (!req) return null;

    req.status = "REJECTED";
    req.adminNotes = reason || "";
    req.handledBy = handledByName;
    req.handledAt = this.formatDate(new Date());
    req.timeline.push({
      time: this.formatDate(new Date()),
      title: `נדחה ע"י ${handledByName}`,
      desc: `סיבת הדחייה: ${reason || 'לא צוינה'}`,
      type: "danger"
    });

    this.save();
    return req;
  }

  // --- Email Logs ---
  addEmailLog(to, subject, status) {
    const entry = {
      time: this.formatDate(new Date()),
      to,
      subject,
      status
    };
    this.data.emailLogs.unshift(entry);
    this.save();
    return entry;
  }

  getEmailLogs() {
    return this.data.emailLogs;
  }
}

module.exports = new DatabaseManager();
