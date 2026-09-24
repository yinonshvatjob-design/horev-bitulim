const db = require('../db');

async function fetchRecent() {
  try {
    const requests = await db.getAllRequests();
    // Sort by submission date (newest first)
    requests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    
    console.log(`Total requests: ${requests.length}`);
    console.log('--- RECENT 10 REQUESTS ---');
    
    const recent = requests.slice(0, 10);
    recent.forEach(req => {
      console.log(`ID: ${req.id}`);
      console.log(`Coordinator: ${req.applicantName} (${req.applicantEmail})`);
      console.log(`Classes: ${Array.isArray(req.classes) ? req.classes.join(', ') : req.classes}`);
      console.log(`Dates: ${req.dates ? req.dates.join(', ') : ''}`);
      console.log(`Meals: ${req.requestedMeals ? (Array.isArray(req.requestedMeals) ? req.requestedMeals.join(', ') : req.requestedMeals) : ''}`);
      console.log(`Status: ${req.status}`);
      console.log(`Submitted: ${req.submittedAt}`);
      console.log('---------------------------');
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fetchRecent();
