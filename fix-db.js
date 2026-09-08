const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  try {
    const res = await pool.query(`SELECT payload FROM system_store WHERE id = 'main_store';`);
    if (res.rows.length > 0) {
      let payload = res.rows[0].payload;
      let changed = false;
      if (payload.admins) {
        payload.admins.forEach(a => {
          if (a.id === '123456' || a.id === '0542065606' || (a.name && a.name.includes('ינון'))) {
            a.id = 'ADMIN_DEV';
            a.pass = '203084637';
            a.name = 'ינון';
            a.role = 'מנהל תוכנה (Admin)';
            changed = true;
          }
        });
        
        // Guarantee ADMIN_DEV is present
        if (!payload.admins.some(a => a.id === 'ADMIN_DEV')) {
          payload.admins.unshift({
            id: "ADMIN_DEV",
            name: "ינון",
            role: "מנהל תוכנה (Admin)",
            email: "yinonshvat@horev.org.il",
            pass: "203084637"
          });
          changed = true;
        }

        if (changed) {
          await pool.query('UPDATE system_store SET payload = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(payload), 'main_store']);
          console.log('Successfully forced ADMIN_DEV into PostgreSQL payload!');
        } else {
          console.log('ADMIN_DEV was already correct in PostgreSQL payload.');
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fix();
