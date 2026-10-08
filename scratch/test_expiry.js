const jwt = require('jsonwebtoken');

// Token created 7 days ago
const payload = { id: 'sudo admin', name: 'ינון', role: 'ADMIN' };
const token = jwt.sign(payload, 'secret', { expiresIn: '12h' }); // This token will expire 12h from now.
// Wait, if it was generated 7 days ago...
const expiredToken = jwt.sign(payload, 'secret', { expiresIn: '-1000s' }); // Already expired

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payloadBase64 = token.split('.')[1];
    const decodedJson = atob(payloadBase64);
    const decodedPayload = JSON.parse(decodedJson);
    return Date.now() >= (decodedPayload.exp * 1000);
  } catch (e) {
    return true;
  }
}

console.log('Expired Token:', isTokenExpired(expiredToken));
