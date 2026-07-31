require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initSchema() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[db] schema ensured');
}

// Allow `npm run db:init` to just apply the schema and exit.
if (require.main === module && process.argv.includes('--init')) {
  initSchema()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[db] failed to init schema', err);
      process.exit(1);
    });
}

module.exports = { pool, initSchema };
