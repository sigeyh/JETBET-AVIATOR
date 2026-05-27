const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_FILE = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data.db');

let db;

function run(dbConn, sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConn.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(dbConn, sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConn.get(sql, params, function (err, row) {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function initDb() {

  const conn = db || new sqlite3.Database(DB_FILE);
  db = conn;

  await run(conn, `PRAGMA journal_mode = WAL;`);

  await run(
    conn,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
  );

  await run(
    conn,
    `CREATE TABLE IF NOT EXISTS balances (
      user_id INTEGER PRIMARY KEY,
      balance REAL NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );`
  );

  await run(
    conn,
    `CREATE TABLE IF NOT EXISTS deposit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      phone TEXT,
      payload_json TEXT NOT NULL,
      payment_success INTEGER NOT NULL,
      provider_reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );`
  );

  return conn;
}

module.exports = {
  initDb,
  get,
  run,
  getDb: () => db
};

