const http = require('http');

async function testLogin(id, role, pass = '') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ role, id, pass });

    const req = http.request({
      hostname: 'localhost',
      port: 4050,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('--- TESTING AUTH LOGIN ENDPOINT ---');
  console.log('Testing Coordinator login with 021395694 (Ohad):', await testLogin('021395694', 'coordinator'));
  console.log('Testing Admin login Hagai 0584220463 (pass 123456):', await testLogin('0584220463', 'admin', '123456'));
}

run();
