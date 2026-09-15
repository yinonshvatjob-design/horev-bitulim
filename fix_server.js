const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(/await db\.getAllAdmins\(\)\.find/g, "(await db.getAllAdmins()).find");
code = code.replace(/await db\.getAllCoordinators\(\)\.find/g, "(await db.getAllCoordinators()).find");
code = code.replace(/await db\.getAllRequests\(\)\.find/g, "(await db.getAllRequests()).find");
code = code.replace(/await db\.getAllAdmins\(\)\.map/g, "(await db.getAllAdmins()).map");
code = code.replace(/db\.addReceiptToRequest/g, "await db.addReceipt");

fs.writeFileSync('server.js', code);
console.log('Fixed server.js');
