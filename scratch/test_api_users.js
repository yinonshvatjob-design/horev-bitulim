const request = require('supertest');
const app = require('../server'); // Express app

async function run() {
  try {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ input: 'sudo admin', pass: 'this_will_fail_but_thats_ok' });
    
    // I can just mock the token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ role: 'ADMIN' }, process.env.JWT_SECRET || 'horev_bitulim_super_secret_jwt_key_2026', { expiresIn: '1h' });

    const usersRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    
    console.log('GET /api/users response:');
    console.log(usersRes.status);
    console.log(usersRes.body);

    const adminsRes = await request(app)
      .get('/api/admins')
      .set('Authorization', `Bearer ${token}`);
    
    console.log('GET /api/admins response:');
    console.log(adminsRes.status);
    console.log(adminsRes.body);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
