const db = require('../db');
async function deleteReqs() {
  const reqs = await db.getAllRequests();
  for (const r of reqs) {
    await db.db.collection('requests').doc(String(r.id)).delete();
  }
  console.log('Deleted all requests from DB');
  process.exit(0);
}
deleteReqs();
