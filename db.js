/* ==========================================================================
   פלטפורמת ביטול ארוחות - מוסדות חורב (Database Layer עם תמיכת PostgreSQL ענני)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Initial Admins (Yinon, Hagai, Esther)
const SEED_ADMINS = [
  { id: "ADMIN_DEV", name: "ינון", role: "מנהל תוכנה (Admin)", email: "yinonshvat@horev.org.il", pass: "203084637" },
  { id: "0584220463", name: "חגי", role: "מנהל המוסד (Admin)", email: "yinonshvat@gmail.com", pass: "hagai2026" },
  { id: "0545540828", name: "אסתר", role: "מזכירת המוסד (Admin)", email: "yinonshvat@gmail.com", pass: "esther2026" }
];

// Initial 26 Authorized Coordinators from Horev list
const SEED_COORDINATORS = [
  {
    "id": "025181975",
    "name": "אברהם ליפשיץ",
    "email": "avilif2@gmail.com"
  },
  {
    "id": "316097542",
    "name": "אורי מאיר קרוק",
    "email": "ori.kruk.7@gmail.com"
  },
  {
    "id": "058265687",
    "name": "אורלי דברי",
    "email": "orlydevary@gmail.com"
  },
  {
    "id": "206147621",
    "name": "אלחנן חיים יגודה",
    "email": "8441985@gmail.com"
  },
  {
    "id": "036029577",
    "name": "אסתר סופר",
    "email": "jkstso@gmail.com"
  },
  {
    "id": "003749561",
    "name": "ד\"ר זאב פרידמן",
    "email": "frzeev@gmail.com"
  },
  {
    "id": "057756868",
    "name": "ד\"ר צבי אריכא",
    "email": "zvikaarica@gmail.com"
  },
  {
    "id": "318925278",
    "name": "דולב סופר",
    "email": "dolevsss2@gmail.com"
  },
  {
    "id": "206673832",
    "name": "הילל יהונתן ביבי",
    "email": "hilelbibi@gmail.com"
  },
  {
    "id": "200545432",
    "name": "הרב א. קירשנבוים",
    "email": "assafhorev@gmail.com"
  },
  {
    "id": "055707087",
    "name": "הרב אבנר ששר",
    "email": "sasar10@walla.com"
  },
  {
    "id": "059805002",
    "name": "הרב אברהם שטיינר",
    "email": "maleip@gmail.com"
  },
  {
    "id": "021395694",
    "name": "הרב אוהד אהרנפלד",
    "email": "ohadhadasa@gmail.com"
  },
  {
    "id": "033226523",
    "name": "הרב אהרן כהן",
    "email": "ravitroni5@gmail.com"
  },
  {
    "id": "025018417",
    "name": "הרב אושרי ברוך",
    "email": "oshrib547@gmail.com"
  },
  {
    "id": "029517455",
    "name": "הרב איתי נגיד",
    "email": "naitay@walla.com"
  },
  {
    "id": "303184477",
    "name": "הרב איתמר צדק",
    "email": "zedek_i@walla.com"
  },
  {
    "id": "038707311",
    "name": "הרב אליהו י. שינפלד",
    "email": "elidid@gmail.com"
  },
  {
    "id": "038757514",
    "name": "הרב אליקים קובץ'",
    "email": "elikovacs@gmail.com"
  },
  {
    "id": "060936481",
    "name": "הרב אלעד ירדני",
    "email": "nahumy7@gmail.com"
  },
  {
    "id": "056771736",
    "name": "הרב אמציה לוי",
    "email": "amatzya61@gmail.com"
  },
  {
    "id": "029524535",
    "name": "הרב גואל אהרוני",
    "email": "goelbendavid@gmail.com"
  },
  {
    "id": "057654667",
    "name": "הרב דוד ליבוביץ",
    "email": "dudilei@gmail.com"
  },
  {
    "id": "058031337",
    "name": "הרב דוד מ. מוריה",
    "email": "davidmoriah@gmail.com"
  },
  {
    "id": "028074342",
    "name": "הרב דורון עקיבא",
    "email": "doro999@gmail.com"
  },
  {
    "id": "058028341",
    "name": "הרב חגי קלמנוביץ",
    "email": "chagi6@walla.co.il"
  },
  {
    "id": "023642846",
    "name": "הרב חיים מורביה",
    "email": "hmor10@walla.co.il"
  },
  {
    "id": "036194520",
    "name": "הרב חן זהבי",
    "email": "123chen1@gmail.com"
  },
  {
    "id": "024453094",
    "name": "הרב יאיר שינקולבסקי",
    "email": "Yairshe11@gmail.com"
  },
  {
    "id": "201430485",
    "name": "הרב יהודה אוחנה",
    "email": "yehudam801@gmail.com"
  },
  {
    "id": "055560379",
    "name": "הרב יוסי אליאב",
    "email": "eliavfam@walla.com"
  },
  {
    "id": "203084637",
    "name": "הרב ינון שבט",
    "email": "yinonshvatjob@gmail.com"
  },
  {
    "id": "025630633",
    "name": "הרב יעקב הכט",
    "email": "hectyac@gmail.com"
  },
  {
    "id": "037145182",
    "name": "הרב יעקב כהן",
    "email": "yakovchn@gmail.com"
  },
  {
    "id": "057332009",
    "name": "הרב יצחק דור",
    "email": "ydor@horev.org.il"
  },
  {
    "id": "054856364",
    "name": "הרב יצחק שטיינר",
    "email": "iziksteiner@gmail.com"
  },
  {
    "id": "015389414",
    "name": "הרב ירוחם שמשוביץ",
    "email": "yeroham.simsovic@gmail.com"
  },
  {
    "id": "040119331",
    "name": "הרב מיכאל קליין",
    "email": "mklain80@gmail.com"
  },
  {
    "id": "028618627",
    "name": "הרב מרדכי ד. כהן",
    "email": "Motkecohen6@gmail.com"
  },
  {
    "id": "012763819",
    "name": "הרב משה טרשנסקי",
    "email": "horevmoshe@gmail.com"
  },
  {
    "id": "059641555",
    "name": "הרב נחמיה י. כהן",
    "email": "mnkohen@gmail.com"
  },
  {
    "id": "313368367",
    "name": "הרב נריה חסיד",
    "email": "neriyahas@gmail.com"
  },
  {
    "id": "204070197",
    "name": "הרב נריה נמיר",
    "email": "nreya56@gmail.com"
  },
  {
    "id": "066385527",
    "name": "הרב נריה פיינגולד",
    "email": "neriyafg@gmail.com"
  },
  {
    "id": "033963430",
    "name": "הרב נתן אורבך",
    "email": "natanaue@gmail.com"
  },
  {
    "id": "205785710",
    "name": "הרב נתנאל מסינג",
    "email": "netanelmessing@gmail.com"
  },
  {
    "id": "058281403",
    "name": "הרב עופר י. טויבר",
    "email": "ofertb@gmail.com"
  },
  {
    "id": "312173628",
    "name": "הרב עמית מסילתי",
    "email": "amitmesi9@gmail.com"
  },
  {
    "id": "040975641",
    "name": "הרב צביקה בולבין",
    "email": "zb0527155206@gmail.com"
  },
  {
    "id": "033212911",
    "name": "הרב צביקה דנטלסקי",
    "email": "zviden0@gmail.com"
  },
  {
    "id": "029702511",
    "name": "הרב ציון אבירם",
    "email": "zionaviram@gmail.com"
  },
  {
    "id": "066171638",
    "name": "הרב קובי פיג'ו",
    "email": "kmpecho@gmail.com"
  },
  {
    "id": "025352881",
    "name": "הרב רון קורש",
    "email": "koreshhorev@gmail.com"
  },
  {
    "id": "028536654",
    "name": "הרב שלמה שלוסברג",
    "email": "s.shlosberg@gmail.com"
  },
  {
    "id": "200989911",
    "name": "הרב שלמה שרים",
    "email": "shlomishrem7@gmail.com"
  },
  {
    "id": "037670692",
    "name": "הרב שמואל גרינברג",
    "email": "mbibeg@gmail.com"
  },
  {
    "id": "036616530",
    "name": "חדוה לב",
    "email": "chlev6000@gmail.com"
  },
  {
    "id": "204643563",
    "name": "חיים יצחק רובין",
    "email": "hy.rubin@gmail.com"
  },
  {
    "id": "037696036",
    "name": "חיים סופר",
    "email": "hsofer@gmail.com"
  },
  {
    "id": "013895537",
    "name": "חנה מגורי",
    "email": "channah.magori@gmail.com"
  },
  {
    "id": "034741538",
    "name": "סוכמן אורי אברהם",
    "email": "orituchman85@gmail.com"
  },
  {
    "id": "033664087",
    "name": "טל עזריאל",
    "email": "taliozeri100@gmail.com"
  },
  {
    "id": "315249722",
    "name": "יאיר זכריה",
    "email": "yzach@gmail.com"
  },
  {
    "id": "302737580",
    "name": "יוסף קליין",
    "email": "josefklein@gmail.com"
  },
  {
    "id": "012345678",
    "name": "ישיבת חורב",
    "email": "y-info@yeshiva.horev.org.il"
  },
  {
    "id": "012259222",
    "name": "ישעיהו פורסטנברג",
    "email": "yeshayahuf@gmail.com"
  },
  {
    "id": "028635092",
    "name": "מוטי שוחטמן",
    "email": "motis@horev.org.il"
  },
  {
    "id": "051987691",
    "name": "מלכה אסנת גלד",
    "email": "osnatbag@hotmail.com"
  },
  {
    "id": "308122787",
    "name": "מנשה רחמים ישראל בוהרון",
    "email": "menashebo@gmail.com"
  },
  {
    "id": "023809999",
    "name": "מר אליהו אביטל",
    "email": "eli.avital999@gmail.com"
  },
  {
    "id": "021982780",
    "name": "מר ברוך צבי טלר",
    "email": "baruchteller@gmail.com"
  }
];

const DB_FILE = path.join(__dirname, 'database.json');

class DatabaseManager {
  constructor() {
    this.data = {
      settings: {
        googleWebhookUrl: process.env.GOOGLE_MAILER_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbygzoipBy6omG2rtrJPnSJJIFK-IJF6P6szb0y-YVzzxro45Ht9rlb5l9-_Zdd-Fx6h/exec'
      },
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
            { time: this.formatDate(new Date(Date.now() - 3600000 * 4.9)), title: "שליחת אימייל התראה לחגי ואסתר", desc: "נשלח אימייל התראה ל-chagi@horev.org.il ול-esters@horev.org.il", type: "info" }
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
      this.sanitizeData();
      await this.savePg();
    } catch (err) {
      console.error('PostgreSQL Connection Error, falling back to local file:', err.message);
      this.load();
    }
  }

  sanitizeData() {
    if (!this.data) return;

    // Purge & migrate 0542065606 completely from admins
    if (Array.isArray(this.data.admins)) {
      this.data.admins.forEach(a => {
        if (a.id === '0542065606' || a.id === '05455408280' || a.id === 'ADMIN_DEV' || (a.name && (a.name === 'ינון' || a.name.includes('ינון (מנהל ראשי)')))) {
          a.id = 'sudo admin';
          a.pass = 'YEWzi47b#N!6LY';
          a.name = 'ינון';
          a.role = 'מנהל תוכנה (Admin)';
          a.email = 'yinonshvat@horev.org.il';
        }
        if (a.role && (a.role.includes('גזבר') || a.role.includes('גזברות'))) {
          a.role = a.role.replace(/גזברות/g, 'אדמיניסטרציה').replace(/גזבר/g, 'מנהל');
        }
        if (a.roleTitle && (a.roleTitle.includes('גזבר') || a.roleTitle.includes('גזברות'))) {
          a.roleTitle = a.roleTitle.replace(/גזברות/g, 'אדמיניסטרציה').replace(/גזבר/g, 'מנהל');
        }
      });

      // Filter out any admin record that still has id 0542065606 or duplicates
      const seenIds = new Set();
      this.data.admins = this.data.admins.filter(a => {
        if (a.id === '0542065606' || a.id === '05455408280') return false;
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });

      // Guarantee sudo admin is present
      if (!this.data.admins.some(a => a.id === 'sudo admin')) {
        this.data.admins.unshift({
          id: "sudo admin",
          name: "ינון",
          role: "מנהל תוכנה (Admin)",
          email: "yinonshvat@horev.org.il",
          pass: "YEWzi47b#N!6LY"
        });
      }
    }

    // Purge 0542065606 completely from coordinators
    if (Array.isArray(this.data.coordinators)) {
      this.data.coordinators = this.data.coordinators.filter(c => c.id !== '0542065606' && c.id !== '05455408280');
    }

    // Purge 0542065606 from requests applicantId
    if (Array.isArray(this.data.requests)) {
      this.data.requests.forEach(r => {
        if (r.applicantId === '0542065606') {
          r.applicantId = 'ADMIN_DEV';
        }
      });
    }

    // Merge SEED_COORDINATORS into this.data.coordinators so cloud PostgreSQL store is always up-to-date!
    if (Array.isArray(SEED_COORDINATORS)) {
      if (!Array.isArray(this.data.coordinators)) {
        this.data.coordinators = [];
      }

      let updatedCount = 0;
      SEED_COORDINATORS.forEach(seedCoord => {
        const index = this.data.coordinators.findIndex(c => c.id === seedCoord.id || c.name === seedCoord.name);
        if (index === -1) {
          this.data.coordinators.push(seedCoord);
          updatedCount++;
        } else {
          if (this.data.coordinators[index].email !== seedCoord.email || this.data.coordinators[index].name !== seedCoord.name || this.data.coordinators[index].id !== seedCoord.id) {
            this.data.coordinators[index].id = seedCoord.id;
            this.data.coordinators[index].name = seedCoord.name;
            this.data.coordinators[index].email = seedCoord.email;
            updatedCount++;
          }
        }
      });

      if (updatedCount > 0) {
        console.log(`[DatabaseManager] Synced ${updatedCount} coordinators from SEED_COORDINATORS into live database store.`);
      }
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
      this.sanitizeData();
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

  // --- Webhook Settings & Security Secret Key ---
  getGoogleWebhookUrl() {
    if (this.data && this.data.settings && this.data.settings.googleWebhookUrl) {
      return this.data.settings.googleWebhookUrl;
    }
    return process.env.GOOGLE_MAILER_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbygzoipBy6omG2rtrJPnSJJIFK-IJF6P6szb0y-YVzzxro45Ht9rlb5l9-_Zdd-Fx6h/exec';
  }

  updateGoogleWebhookUrl(url) {
    if (!this.data.settings) {
      this.data.settings = {};
    }
    this.data.settings.googleWebhookUrl = url;
    this.save();
    return url;
  }

  getMailerSecretKey() {
    if (this.data && this.data.settings && this.data.settings.mailerSecretKey) {
      return this.data.settings.mailerSecretKey;
    }
    return process.env.MAILER_SECRET_KEY || 'HOREV_SECURE_MAIL_2026_SECRET_KEY';
  }

  updateMailerSecretKey(secretKey) {
    if (!this.data.settings) {
      this.data.settings = {};
    }
    this.data.settings.mailerSecretKey = secretKey;
    this.save();
    return secretKey;
  }

  // --- Admins & Coordinators ---
  findAdmin(id, pass) {
    return this.data.admins.find(a => a.id === id && a.pass === pass);
  }

  getAllAdmins() {
    return this.data.admins;
  }

  findAdminById(id) {
    return this.data.admins.find(a => a.id === id);
  }

  updateAdmin(id, updatedFields) {
    const admin = this.findAdminById(id);
    if (!admin) return null;
    Object.assign(admin, updatedFields);
    this.save();
    return admin;
  }

  addAdmin(newAdmin) {
    const existingIndex = this.data.admins.findIndex(a => a.id === newAdmin.id);
    if (existingIndex !== -1) {
      this.data.admins[existingIndex] = { ...this.data.admins[existingIndex], ...newAdmin };
    } else {
      this.data.admins.push({ ...newAdmin, role: 'ADMIN' });
    }
    this.save();
    return newAdmin;
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
      id: reqData.id || `REQ-${nextIdNumber}`,
      applicantId: reqData.applicantId,
      applicantName: reqData.applicantName,
      applicantEmail: reqData.applicantEmail,
      group: reqData.group,
      startDate: reqData.startDate,
      endDate: reqData.endDate,
      requestedMeals: reqData.requestedMeals || [],
      reason: reqData.reason,
      submittedAt: reqData.submittedAt || this.formatDate(new Date()),
      status: reqData.status || "PENDING",
      approvedRefund: reqData.approvedRefund || 0,
      approvedDetails: reqData.approvedDetails || null,
      adminNotes: reqData.adminNotes || "",
      handledBy: reqData.handledBy || null,
      handledAt: reqData.handledAt || null,
      timeline: reqData.timeline || [
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

  addReceiptToRequest(id, receiptData) {
    const req = this.getRequestById(id);
    if (!req) return null;

    const nowStr = this.formatDate(new Date());
    const receiptObj = {
      id: "REC-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000),
      amount: parseFloat(receiptData.amount) || 0,
      store: receiptData.store || "לא צוין ספק",
      notes: receiptData.notes || "",
      fileName: receiptData.fileName || "receipt.png",
      fileData: receiptData.fileData || null,
      uploadedAt: nowStr
    };

    if (!Array.isArray(req.receipts)) {
      req.receipts = req.receipt ? [req.receipt] : [];
    }
    req.receipts.push(receiptObj);
    req.receipt = receiptObj; // latest receipt fallback

    const totalReceiptsAmount = req.receipts.reduce((sum, r) => sum + (r.amount || 0), 0);

    if (!req.timeline) req.timeline = [];
    req.timeline.push({
      time: nowStr,
      title: `📸 הועלתה קבלה ע"ס ₪${receiptObj.amount} (${receiptObj.store})`,
      desc: `הועלתה קבלה #${req.receipts.length} ע"ס ₪${receiptObj.amount} (חנות/ספק: ${receiptObj.store}). סך מצטבר בקבלות: ₪${totalReceiptsAmount.toLocaleString()}. נשלח מייל מרוכז לאסתר וחגי.`,
      type: "success"
    });

    this.save();
    return req;
  }

  deleteRequest(id) {
    const initialLength = this.data.requests.length;
    this.data.requests = this.data.requests.filter(r => r.id !== id);
    this.save();
    return this.data.requests.length < initialLength;
  }

  deleteBatchRequests(ids = []) {
    const idSet = new Set(ids);
    const initialLength = this.data.requests.length;
    this.data.requests = this.data.requests.filter(r => !idSet.has(r.id));
    this.save();
    return initialLength - this.data.requests.length;
  }

  clearAllRequests() {
    const count = this.data.requests.length;
    this.data.requests = [];
    this.save();
    return count;
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
