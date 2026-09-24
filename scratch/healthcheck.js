const db = require('../db');

async function check() {
  try {
    console.log('Fetching requests from Firebase...');
    const reqs = await db.getAllRequests();
    console.log(`Successfully fetched ${reqs.length} requests.`);
    
    console.log('Fetching admins from Firebase...');
    const admins = await db.getAllAdmins();
    console.log(`Successfully fetched ${admins.length} admins.`);
    
    console.log('Fetching coordinators from Firebase...');
    const coords = await db.getAllCoordinators();
    console.log(`Successfully fetched ${coords.length} coordinators.`);
    
    console.log('HEALTHCHECK PASSED');
    process.exit(0);
  } catch(e) {
    console.error('HEALTHCHECK FAILED:', e);
    process.exit(1);
  }
}
check();
