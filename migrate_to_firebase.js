const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function migrate() {
  console.log('Starting Migration from database.json to Firestore...');
  
  // Read local DB
  const dbPath = path.join(__dirname, 'database.json');
  if (!fs.existsSync(dbPath)) {
    console.error('database.json not found!');
    process.exit(1);
  }
  
  const rawData = fs.readFileSync(dbPath, 'utf8');
  const data = JSON.parse(rawData);
  
  // Migrate Settings
  if (data.settings) {
    console.log('Migrating settings...');
    await db.collection('system').doc('settings').set(data.settings);
  }

  // Migrate Admins
  if (data.admins && data.admins.length > 0) {
    console.log(`Migrating ${data.admins.length} admins...`);
    const batch = db.batch();
    data.admins.forEach(a => {
      // Use their id as document ID, but since id could be string with special chars, use carefully.
      // Firestore IDs can be alphanumeric. Phone numbers are fine.
      const docRef = db.collection('admins').doc(String(a.id));
      batch.set(docRef, a);
    });
    await batch.commit();
  }

  // Migrate Coordinators
  if (data.coordinators && data.coordinators.length > 0) {
    console.log(`Migrating ${data.coordinators.length} coordinators...`);
    // Firestore batches have a limit of 500 operations. Coordinators is ~80, so it's fine.
    const batch = db.batch();
    data.coordinators.forEach(c => {
      const docRef = db.collection('coordinators').doc(String(c.id));
      batch.set(docRef, c);
    });
    await batch.commit();
  }

  // Migrate Requests
  if (data.requests && data.requests.length > 0) {
    console.log(`Migrating ${data.requests.length} requests...`);
    
    // Process in chunks of 400 to avoid batch limit (500)
    for (let i = 0; i < data.requests.length; i += 400) {
      const chunk = data.requests.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach(req => {
        const docRef = db.collection('requests').doc(String(req.id));
        batch.set(docRef, req);
      });
      await batch.commit();
      console.log(`Committed chunk of ${chunk.length} requests...`);
    }
  }

  console.log('Migration Completed Successfully!');
  process.exit(0);
}

migrate().catch(console.error);
