const xlsx = require('xlsx');
const path = require('path');

const excelFile = path.join(__dirname, '..', 'אלפון מורים (2).xlsx');
const workbook = xlsx.readFile(excelFile);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

console.log("Headers (keys of first row):", Object.keys(data[0] || {}));
console.log("First 3 rows:", JSON.stringify(data.slice(0, 3), null, 2));
