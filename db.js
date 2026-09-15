const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

let serviceAccount;
try {
  const saPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(saPath)) {
    serviceAccount = require('./serviceAccountKey.json');
  }
} catch (e) {
  console.log('No local serviceAccountKey.json found. Will use environment variables if available.');
}

if (!getApps().length) {
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(creds) });
  } else {
    console.error('CRITICAL: No Firebase credentials found!');
  }
} else {
  getApp(); // if already initialized
}

const db = getFirestore();

class DatabaseManager {
  constructor() {
    this.db = db;
  }

  // ==========================================
  // SYSTEM BACKUP
  // ==========================================
  async getAllData() {
    try {
      const admins = await this.getAllAdmins();
      const coordinators = await this.getAllCoordinators();
      const requests = await this.getAllRequests();
      const webhook = await this.getWebhookSettings();

      return {
        timestamp: new Date().toISOString(),
        version: '2.0',
        counts: {
          admins: admins.length,
          coordinators: coordinators.length,
          requests: requests.length
        },
        data: {
          admins,
          coordinators,
          requests,
          webhook
        }
      };
    } catch (err) {
      console.error('Error fetching all data for backup:', err);
      throw err;
    }
  }

  async getWebhookSettings() {
    const doc = await this.db.collection('system').doc('settings').get();
    if (doc.exists) return doc.data();
    return {
      googleWebhookUrl: process.env.GOOGLE_MAILER_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbygzoipBy6omG2rtrJPnSJJIFK-IJF6P6szb0y-YVzzxro45Ht9rlb5l9-_Zdd-Fx6h/exec',
      mailerSecretKey: process.env.MAILER_SECRET_KEY || 'HOREV_SECURE_MAIL_2026_SECRET_KEY'
    };
  }

  // Helper date formats
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
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      };
      const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(d);
      const p = {}; parts.forEach(pt => p[pt.type] = pt.value);
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
    } catch (e) {
      return d.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    }
  }

  async getGoogleWebhookUrl() {
    const doc = await this.db.collection('system').doc('settings').get();
    if (doc.exists && doc.data().googleWebhookUrl) return doc.data().googleWebhookUrl;
    return process.env.GOOGLE_MAILER_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbygzoipBy6omG2rtrJPnSJJIFK-IJF6P6szb0y-YVzzxro45Ht9rlb5l9-_Zdd-Fx6h/exec';
  }

  async updateGoogleWebhookUrl(url) {
    await this.db.collection('system').doc('settings').set({ googleWebhookUrl: url }, { merge: true });
    return url;
  }

  async getMailerSecretKey() {
    const doc = await this.db.collection('system').doc('settings').get();
    if (doc.exists && doc.data().mailerSecretKey) return doc.data().mailerSecretKey;
    return process.env.MAILER_SECRET_KEY || 'HOREV_SECURE_MAIL_2026_SECRET_KEY';
  }

  async updateMailerSecretKey(secretKey) {
    await this.db.collection('system').doc('settings').set({ mailerSecretKey: secretKey }, { merge: true });
    return secretKey;
  }

  async findAdmin(id, pass) {
    const doc = await this.db.collection('admins').doc(String(id)).get();
    if (!doc.exists) return null;
    const a = doc.data();
    if (a.pass === pass) return a;
    if (bcrypt.compareSync(pass, a.pass)) return a;
    return null;
  }

  async getAllAdmins() {
    const snap = await this.db.collection('admins').get();
    return snap.docs.map(d => d.data());
  }

  async findAdminById(id) {
    const doc = await this.db.collection('admins').doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  async updateAdmin(id, updatedFields) {
    // Note: 'id' here might not match the document ID for legacy accounts (like ADMIN_DEV).
    // We should search by doc ID if it exists, otherwise we'll try searching the collection.
    let docRef = this.db.collection('admins').doc(String(id));
    let doc = await docRef.get();
    
    if (!doc.exists) {
      // Fallback: search by 'id' field in case doc ID doesn't match
      const snap = await this.db.collection('admins').where('id', '==', String(id)).limit(1).get();
      if (snap.empty) return null;
      doc = snap.docs[0];
      docRef = doc.ref;
    }

    if (updatedFields.pass && !updatedFields.pass.startsWith('$2a$')) {
      updatedFields.pass = bcrypt.hashSync(updatedFields.pass, 10);
    }

    const mergedData = { ...(doc.data()), ...updatedFields };

    if (updatedFields.id && String(updatedFields.id) !== doc.id) {
      // Create new doc, delete old
      await this.db.collection('admins').doc(String(updatedFields.id)).set(mergedData);
      await docRef.delete();
    } else {
      await docRef.update(updatedFields);
    }
    
    return mergedData;
  }

  async addAdmin(newAdmin) {
    if (newAdmin.pass && !newAdmin.pass.startsWith('$2a$')) {
      newAdmin.pass = bcrypt.hashSync(newAdmin.pass, 10);
    }
    newAdmin.role = 'ADMIN';
    await this.db.collection('admins').doc(String(newAdmin.id)).set(newAdmin);
    return newAdmin;
  }

  async findCoordinator(id) {
    const doc = await this.db.collection('coordinators').doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  async getAllCoordinators() {
    const snap = await this.db.collection('coordinators').get();
    return snap.docs.map(d => d.data());
  }

  async addCoordinator(newCoord) {
    await this.db.collection('coordinators').doc(String(newCoord.id)).set(newCoord, { merge: true });
    return { success: true, coordinator: newCoord };
  }

  async updateCoordinator(id, updatedFields) {
    let docRef = this.db.collection('coordinators').doc(String(id));
    let doc = await docRef.get();
    
    if (!doc.exists) {
      // Fallback: search by 'id' field
      const snap = await this.db.collection('coordinators').where('id', '==', String(id)).limit(1).get();
      if (snap.empty) return null;
      doc = snap.docs[0];
      docRef = doc.ref;
    }

    const mergedData = { ...(doc.data()), ...updatedFields };

    if (updatedFields.id && String(updatedFields.id) !== doc.id) {
      await this.db.collection('coordinators').doc(String(updatedFields.id)).set(mergedData);
      await docRef.delete();
    } else {
      await docRef.update(updatedFields);
    }
    return mergedData;
  }

  async removeCoordinator(id) {
    await this.db.collection('coordinators').doc(String(id)).delete();
    return true;
  }

  async getAllRequests() {
    const snap = await this.db.collection('requests').get();
    const results = snap.docs.map(d => d.data());
    // Sort in memory to avoid missing index issues on Firestore initially
    results.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    return results;
  }

  async getRequestById(id) {
    const doc = await this.db.collection('requests').doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  async getRequestsByApplicant(applicantId) {
    const snap = await this.db.collection('requests').where('applicantId', '==', String(applicantId)).get();
    const results = snap.docs.map(d => d.data());
    results.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    return results;
  }

  async addRequest(reqData) {
    // Generate an ID (fetch all, find max ID) - basic approach since we don't have thousands
    const snap = await this.db.collection('requests').get();
    let maxId = 100;
    snap.docs.forEach(d => {
      const idStr = d.data().id;
      if (idStr && idStr.startsWith('REQ-')) {
        const num = parseInt(idStr.replace('REQ-', ''), 10);
        if (num > maxId) maxId = num;
      }
    });
    const nextIdNumber = maxId + 1;
    
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

    await this.db.collection('requests').doc(String(newReq.id)).set(newReq);
    return newReq;
  }

  async updateRequest(id, updatedFields) {
    const docRef = this.db.collection('requests').doc(String(id));
    const doc = await docRef.get();
    if (!doc.exists) return null;
    await docRef.update(updatedFields);
    return { ...(doc.data()), ...updatedFields };
  }

  async approveRequest(id, refundAmount, adminNotes, handledByName) {
    const docRef = this.db.collection('requests').doc(String(id));
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const req = doc.data();

    req.status = "APPROVED";
    req.approvedRefund = parseFloat(refundAmount) || 0;
    req.adminNotes = adminNotes || "";
    req.handledBy = handledByName;
    req.handledAt = this.formatDate(new Date());
    
    req.timeline = req.timeline || [];
    req.timeline.push({
      time: this.formatDate(new Date()),
      title: `אושר ע"י ${handledByName}`,
      desc: `הבקשה אושרה בסכום החזר של ₪${req.approvedRefund}. הערות: ${adminNotes || 'אין'}`,
      type: "success"
    });

    await docRef.set(req);
    return req;
  }

  async rejectRequest(id, reason, handledByName) {
    const docRef = this.db.collection('requests').doc(String(id));
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const req = doc.data();

    req.status = "REJECTED";
    req.adminNotes = reason || "";
    req.handledBy = handledByName;
    req.handledAt = this.formatDate(new Date());
    req.approvedRefund = 0;
    req.approvedDetails = null;

    req.timeline = req.timeline || [];
    req.timeline.push({
      time: this.formatDate(new Date()),
      title: `נדחה ע"י ${handledByName}`,
      desc: `הבקשה נדחתה. סיבה: ${reason || 'לא צוינה'}`,
      type: "danger"
    });

    await docRef.set(req);
    return req;
  }

  async deleteRequest(id) {
    await this.db.collection('requests').doc(String(id)).delete();
    return true;
  }

  async addReceipt(id, receiptData) {
    const docRef = this.db.collection('requests').doc(String(id));
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const req = doc.data();

    if (!Array.isArray(req.receipts)) {
      if (req.receipt) {
        req.receipts = [req.receipt];
        delete req.receipt;
      } else {
        req.receipts = [];
      }
    }

    req.receipts.push(receiptData);
    req.timeline = req.timeline || [];
    req.timeline.push({
      time: this.formatDate(new Date()),
      title: "קבלה הועלתה",
      desc: `הועלתה קבלה ע"ס ₪${receiptData.amount || 0} מ-${receiptData.store || 'חנות כלשהי'}`,
      type: "info"
    });

    await docRef.set(req);
    return req;
  }

  async deleteReceipt(reqId, receiptId) {
    const docRef = this.db.collection('requests').doc(String(reqId));
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const req = doc.data();

    if (!Array.isArray(req.receipts)) return null;
    const initialLength = req.receipts.length;
    req.receipts = req.receipts.filter(r => r.id !== receiptId);
    
    if (req.receipts.length < initialLength) {
      req.timeline = req.timeline || [];
      req.timeline.push({
         time: this.formatDate(new Date()),
         title: "קבלה נמחקה",
         desc: "קבלה נמחקה ע\"י המשתמש",
         type: "warning"
      });
      await docRef.set(req);
      return req;
    }
    return null;
  }

  async logEmail(to, subject, status) {
    const log = { time: this.formatDate(new Date()), to, subject, status };
    await this.db.collection('emailLogs').add(log);
  }

  async getRecentEmailLogs(limit = 100) {
    const snap = await this.db.collection('emailLogs').orderBy('time', 'desc').limit(limit).get();
    return snap.docs.map(d => d.data());
  }
}

module.exports = new DatabaseManager();
