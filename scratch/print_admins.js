const db = require('../db');

async function printAdmins() {
  const admins = await db.getAllAdmins();
  console.log(admins);
  process.exit(0);
}
printAdmins();
