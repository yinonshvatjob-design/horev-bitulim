const http = require('http');
const app = require('../server');
require('dotenv').config({ path: '../.env' });

const port = 4055;
const server = http.createServer(app);

server.listen(port, async () => {
  try {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ role: 'ADMIN' }, process.env.JWT_SECRET || 'horev_bitulim_super_secret_jwt_key_2026', { expiresIn: '1h' });

    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => require('node-fetch')(...args));

    console.log('Fetching /api/users...');
    const usersRes = await fetch(`http://localhost:${port}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('GET /api/users response:');
    console.log(usersRes.status);
    const usersBody = await usersRes.text();
    console.log(usersBody.substring(0, 200));

    console.log('Fetching /api/admins...');
    const adminsRes = await fetch(`http://localhost:${port}/api/admins`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('GET /api/admins response:');
    console.log(adminsRes.status);
    const adminsBody = await adminsRes.text();
    console.log(adminsBody.substring(0, 200));

  } catch (e) {
    console.error(e);
  } finally {
    server.close();
    process.exit(0);
  }
});
