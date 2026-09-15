const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkAdmins() {
  const snapshot = await db.collection('admins').get();
  const admins = [];
  snapshot.forEach(doc => {
    admins.push({ docId: doc.id, data: doc.data() });
  });
  console.log(JSON.stringify(admins, null, 2));
}

checkAdmins().catch(console.error);
