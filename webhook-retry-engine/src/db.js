const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "webhook.db");

let db;

async function initializeDatabase() {
    const SQL = await initSqlJs();

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
        const file = fs.readFileSync(dbPath);
        db = new SQL.Database(file);
    } else {
        db = new SQL.Database();
    }

    db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS delivery_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      http_status INTEGER,
      error TEXT
    )
  `);

    saveDatabase();
}

function saveDatabase() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
}

function getDatabase() {
    return db;
}

module.exports = {
    initializeDatabase,
    getDatabase,
    saveDatabase
};