const xlsx = require('xlsx');
const db = require('../db');

async function run() {
  console.log('Loading Excel file...');
  const workbook = xlsx.readFile('./אלפון מורים (2).xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  // Headers are in row 1 (0-indexed 1)
  const coordinators = await db.getAllCoordinators();
  const admins = await db.getAllAdmins();
  
  let matchCount = 0;
  let updateCount = 0;
  
  // Create a normalized list of excel rows with name and phone
  const excelUsers = data.slice(1).map(row => {
    // Some rows might not have __EMPTY_1 or __EMPTY_3
    return {
      name: row['__EMPTY_1'] ? String(row['__EMPTY_1']).trim() : null,
      phone: row['__EMPTY_3'] ? String(row['__EMPTY_3']).trim() : null
    };
  }).filter(r => r.name && r.phone);

  const normalizeName = (name) => {
    return name.replace(/ד"ר/g, '').replace(/הרב/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  };
  
  for (const user of [...coordinators, ...admins]) {
    const userNorm = normalizeName(user.name);
    const row = excelUsers.find(r => {
      const excelNorm = normalizeName(r.name);
      return excelNorm.includes(userNorm) || userNorm.includes(excelNorm);
    });
    
    if (row) {
      matchCount++;
      const phoneStr = row.phone;
      
      // Let's decide if it's admin or coordinator
      const isAdmin = admins.some(a => a.id === user.id);
      
      try {
        if (isAdmin) {
          await db.updateAdmin(user.id, { phone: phoneStr });
        } else {
          await db.updateCoordinator(user.id, { phone: phoneStr });
        }
        console.log(`Updated ${user.name} -> ${phoneStr}`);
        updateCount++;
      } catch (err) {
        console.error(`Failed to update ${user.name}`, err);
      }
    } else {
      console.log(`No match for ${user.name}`);
    }
  }
  
  console.log(`Matched: ${matchCount}. Updated: ${updateCount}.`);
  process.exit(0);
}

run();
