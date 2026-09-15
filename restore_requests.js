const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function restore() {
  const data = JSON.parse(fs.readFileSync('database.json', 'utf8'));
  const requests = data.requests || [];
  
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  
  let restoredCount = 0;
  
  for (const r of requests) {
    if (!r.submittedAt) continue;
    
    let submitDate;
    if (r.submittedAt.includes('/')) {
      const parts = r.submittedAt.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        const [dd, mm, yyyy] = dateParts;
        submitDate = new Date(`${yyyy}-${mm}-${dd}T${parts[1] || '00:00:00'}`);
      }
    } else if (r.submittedAt.includes('-')) {
      const parts = r.submittedAt.split(' ');
      submitDate = new Date(`${parts[0]}T${parts[1] || '00:00:00'}`);
    } else if (r.submittedAt.includes('.')) {
      const parts = r.submittedAt.split(' ');
      const dateParts = parts[0].split('.');
      if (dateParts.length === 3) {
        const dd = dateParts[0].padStart(2, '0');
        const mm = dateParts[1].padStart(2, '0');
        const yyyy = dateParts[2];
        submitDate = new Date(`${yyyy}-${mm}-${dd}T${parts[1] || '00:00:00'}`);
      }
    }
    
    if (!submitDate || isNaN(submitDate)) {
      console.log('Skipping unparseable date:', r.submittedAt);
      continue;
    }
    
    if (submitDate >= tenDaysAgo) {
      // Check if exists in Firebase
      const doc = await db.collection('requests').doc(String(r.id)).get();
      if (!doc.exists) {
        console.log(`Restoring request ${r.id} from ${r.submittedAt}...`);
        await db.collection('requests').doc(String(r.id)).set(r);
        restoredCount++;
      }
    }
  }
  console.log(`Restoration complete! Restored ${restoredCount} requests.`);
}

restore().catch(console.error);
