const { Pool } = require('pg');
require('dotenv').config();

const connectionString = (process.env.DATABASE_URL || '').trim();

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function getEffectivePermission(tz, classification, appId = 'bitulim') {
  try {
    // 1. Check explicit user override
    const explicitRes = await pool.query(
      "SELECT access_level FROM app_user_permissions WHERE t_z = $1 AND app_id = $2",
      [tz, appId]
    );
    if (explicitRes.rows.length > 0) {
      return explicitRes.rows[0].access_level;
    }

    // 2. Fallback to classification default
    if (classification) {
      const defRes = await pool.query(
        "SELECT default_access FROM classification_defaults WHERE classification = $1 AND app_id = $2",
        [classification, appId]
      );
      if (defRes.rows.length > 0) {
        return defRes.rows[0].default_access;
      }
    }
    return 'none';
  } catch (err) {
    console.error('Error fetching effective permission for bitulim:', err);
    return 'none';
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  getEffectivePermission
};
