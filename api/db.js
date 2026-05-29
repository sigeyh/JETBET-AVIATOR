const { Pool } = require('pg');

// DATABASE_URL is the standard env var for Postgres (Vercel/Neon)
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pool;

async function getPool() {
  if (!pool) {
    if (!connectionString) {
      console.warn('DATABASE_URL or POSTGRES_URL is missing. DB might fail!');
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false // Required for Neon/Vercel Postgres
      }
    });
  }
  return pool;
}

/**
 * Executes a query and returns the first row.
 */
async function get(sql, params = []) {
  const p = await getPool();
  const res = await p.query(sql, params);
  return res.rows[0];
}

/**
 * Executes a query (INSERT/UPDATE/DELETE).
 * returns an object with lastID if possible (for compatibility)
 */
async function run(sql, params = []) {
  const p = await getPool();
  const res = await p.query(sql, params);
  // Postgres doesn't have "lastID" directly; usually we use RETURNING id.
  // I will return the rows array so the caller can pick what they need.
  return { 
    lastID: res.rows[0]?.id,
    rows: res.rows,
    rowCount: res.rowCount
  };
}

async function initDb() {
  const p = await getPool();

  // Create tables using Postgres syntax
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS balances (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      balance NUMERIC(20, 2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS deposit_events (
      id SERIAL PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount NUMERIC(20, 2) NOT NULL,
      phone TEXT,
      payload_json TEXT NOT NULL,
      payment_success INTEGER NOT NULL DEFAULT 0,
      provider_reference TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Postgres schema initialized');
  return p;
}

module.exports = {
  initDb,
  get,
  run,
  getPool
};
