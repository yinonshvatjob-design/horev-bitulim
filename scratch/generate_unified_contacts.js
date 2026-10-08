const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const excelFile = path.join(__dirname, '..', 'teachers_temp.xlsx');
const workbook = xlsx.readFile(excelFile);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" });

// Find the row that contains the actual headers
let headerRowIdx = -1;
for (let i = 0; i < rawData.length; i++) {
  if (rawData[i]['__EMPTY'] === 'ת.ז') {
    headerRowIdx = i;
    break;
  }
}

const adminEmails = ["yinonshvat@horev.org.il", "yinonshvat@gmail.com"];
const adminNames = ["ינון", "חגי", "אסתר"];

const unifiedContacts = [];

if (headerRowIdx !== -1) {
  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    
    // Some rows might be completely empty
    if (!row['__EMPTY_1']) continue;

    const name = row['__EMPTY_1'].trim();
    const tz = String(row['__EMPTY']).trim();
    let phone = row['__EMPTY_3'].trim() || row['__EMPTY_2'].trim();
    const email = row['__EMPTY_6'].trim();
    const excelRole = row['__EMPTY_8'].trim();
    
    // Format phone (sometimes xlsx reads it as number and drops leading zero)
    if (phone && !phone.startsWith('0') && phone.length === 9) {
      phone = '0' + phone;
    }
    
    // Check if this user is an admin to skip them
    const isNameAdmin = adminNames.some(adminName => name === adminName || name.includes(adminName + " "));
    const isEmailAdmin = email && adminEmails.includes(email);
    
    if (isNameAdmin || isEmailAdmin || excelRole.includes('מנהל')) {
      console.log(`Skipping Admin: ${name}`);
      continue;
    }

    const contact = {
      id: crypto.randomUUID(), // New global unified ID
      tz: tz,
      full_name: name,
      phone_number: phone,
      email: email,
      role: 'client', // Base role for unified DB (coordinator/borrower/etc depending on app)
      metadata: {
        city: row['__EMPTY_4'].trim(),
        address: row['__EMPTY_5'].trim(),
        subjects: row['__EMPTY_7'].trim()
      }
    };
    
    unifiedContacts.push(contact);
  }
}

const outputPath = path.join(__dirname, 'unified_contacts.json');
fs.writeFileSync(outputPath, JSON.stringify(unifiedContacts, null, 2), 'utf-8');

console.log(`Successfully generated unified_contacts.json with ${unifiedContacts.length} contacts.`);
