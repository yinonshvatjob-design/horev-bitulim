/* ==========================================================================
   פלטפורמת ביטול ארוחות - מוסדות חורב (Database Layer)
   ========================================================================== */

const fs = require('fs');
const path = require('path');

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
    this.load();
  }

  getFutureDate(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  }

  formatDate(d) {
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileData = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileData);
      } else {
        this.save();
      }
    } catch (e) {
      console.error("Failed to load database.json, initializing defaults", e);
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error("Failed to save database.json", e);
    }
  }

  // Auth queries
  findAdmin(id, pass) {
    const cleanId = id.replace(/[^0-9]/g, '');
    return this.data.admins.find(a => (a.id === cleanId || a.id === id) && a.pass === pass);
  }

  findCoordinator(id) {
    const cleanId = id.replace(/[^0-9]/g, '');
    return this.data.coordinators.find(c => c.id === cleanId || c.id === id);
  }

  // Requests
  getAllRequests() {
    return this.data.requests;
  }

  addRequest(reqData) {
    this.data.requests.unshift(reqData);
    this.save();
    return reqData;
  }

  updateRequest(reqId, updateFields) {
    const idx = this.data.requests.findIndex(r => r.id === reqId);
    if (idx !== -1) {
      this.data.requests[idx] = { ...this.data.requests[idx], ...updateFields };
      this.save();
      return this.data.requests[idx];
    }
    return null;
  }

  // Coordinators Management
  addCoordinator(coord) {
    this.data.coordinators.push(coord);
    this.save();
  }

  removeCoordinator(id) {
    this.data.coordinators = this.data.coordinators.filter(c => c.id !== id);
    this.save();
  }

  // Email Logs
  addEmailLog(logItem) {
    this.data.emailLogs.unshift(logItem);
    this.save();
  }
}

module.exports = new DatabaseManager();
