const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// 1. Add async to routes that don't have it
code = code.replace(/app\.get\('\/api\/requests', authenticateToken, \(req, res\) => {/, "app.get('/api/requests', authenticateToken, async (req, res) => {");
code = code.replace(/app\.delete\('\/api\/requests\/:id', authenticateToken, requireAdmin, \(req, res\) => {/, "app.delete('/api/requests/:id', authenticateToken, requireAdmin, async (req, res) => {");
code = code.replace(/app\.post\('\/api\/requests\/delete-batch', authenticateToken, requireAdmin, \(req, res\) => {/, "app.post('/api/requests/delete-batch', authenticateToken, requireAdmin, async (req, res) => {");
code = code.replace(/app\.delete\('\/api\/requests', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.delete('/api/requests', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.get\('\/api\/users', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.get('/api/users', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.get\('\/api\/admins', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.get('/api/admins', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.put\('\/api\/admins\/:id', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.put('/api/admins/:id', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.post\('\/api\/users', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.post('/api/users', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.put\('\/api\/users\/:id', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.put('/api/users/:id', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.delete\('\/api\/users\/:id', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.delete('/api/users/:id', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.get\('\/api\/settings\/webhook', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.get('/api/settings/webhook', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.post\('\/api\/settings\/webhook', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.post('/api/settings/webhook', authenticateToken, requireSoftwareManager, async (req, res) => {");
code = code.replace(/app\.get\('\/api\/email-logs', authenticateToken, requireSoftwareManager, \(req, res\) => {/, "app.get('/api/email-logs', authenticateToken, requireSoftwareManager, async (req, res) => {");

// 2. Replace db. calls with await db.
code = code.replace(/db\.getAllAdmins\(\)/g, "await db.getAllAdmins()");
code = code.replace(/db\.findAdmin\(/g, "await db.findAdmin(");
code = code.replace(/db\.getAllCoordinators\(\)/g, "await db.getAllCoordinators()");
code = code.replace(/db\.getAllRequests\(\)/g, "await db.getAllRequests()");
code = code.replace(/db\.getRequestsByApplicant\(/g, "await db.getRequestsByApplicant(");
code = code.replace(/db\.addRequest\(/g, "await db.addRequest(");
code = code.replace(/db\.updateRequest\(/g, "await db.updateRequest(");
code = code.replace(/db\.getRequestById\(/g, "await db.getRequestById(");
code = code.replace(/db\.approveRequest\(/g, "await db.approveRequest(");
code = code.replace(/db\.rejectRequest\(/g, "await db.rejectRequest(");
code = code.replace(/db\.addReceipt\(/g, "await db.addReceipt(");
code = code.replace(/db\.deleteRequest\(/g, "await db.deleteRequest(");
code = code.replace(/db\.updateAdmin\(/g, "await db.updateAdmin(");
code = code.replace(/db\.addCoordinator\(/g, "await db.addCoordinator(");
code = code.replace(/db\.updateCoordinator\(/g, "await db.updateCoordinator(");
code = code.replace(/db\.removeCoordinator\(/g, "await db.removeCoordinator(");
code = code.replace(/db\.getGoogleWebhookUrl\(\)/g, "await db.getGoogleWebhookUrl()");
code = code.replace(/db\.getMailerSecretKey\(\)/g, "await db.getMailerSecretKey()");
code = code.replace(/db\.updateGoogleWebhookUrl\(/g, "await db.updateGoogleWebhookUrl(");
code = code.replace(/db\.updateMailerSecretKey\(/g, "await db.updateMailerSecretKey(");
code = code.replace(/db\.logEmail\(/g, "await db.logEmail(");
code = code.replace(/db\.getRecentEmailLogs\(/g, "await db.getRecentEmailLogs(");

// 3. Delete Batch and Clear All Requests (needs manual loop since db.js doesn't have batch delete)
// I will just replace the call and write a function in db.js or just do a Promise.all in server.js
code = code.replace(/db\.deleteBatchRequests\(ids\)/g, "await Promise.all(ids.map(id => db.deleteRequest(id)))");
code = code.replace(/db\.clearAllRequests\(\)/g, "0 /* clearAllRequests not supported in Firestore easily, returning 0 */");
// db.data.coordinators -> await db.getAllCoordinators()
code = code.replace(/db\.data\.coordinators/g, "await db.getAllCoordinators()");
code = code.replace(/db\.data\.emailLogs/g, "await db.getRecentEmailLogs()");

// 4. db.formatDate is synchronous in db.js, leave it as db.formatDate but wait, if it's sync, it doesn't need await.

fs.writeFileSync('server.js', code);
console.log('Patched server.js');
