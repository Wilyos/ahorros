const path = require('path');
const Database = require('better-sqlite3');

// En Railway/producción usar /tmp (filesystem ephemeral); en desarrollo usar local
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT_NAME;
const dbPath = isProduction 
  ? '/tmp/data.sqlite' 
  : (process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.sqlite'));
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const getProfileStmt = db.prepare('SELECT data, updated_at FROM profiles WHERE key = ?');
const upsertProfileStmt = db.prepare(`
  INSERT INTO profiles (key, data, updated_at)
  VALUES (@key, @data, @updated_at)
  ON CONFLICT(key) DO UPDATE SET
    data = excluded.data,
    updated_at = excluded.updated_at
`);

function getProfile(key) {
  const row = getProfileStmt.get(key);
  if (!row) {
    return null;
  }

  return {
    data: JSON.parse(row.data),
    updatedAt: row.updated_at
  };
}

function saveProfile(key, data) {
  const updatedAt = new Date().toISOString();

  upsertProfileStmt.run({
    key,
    data: JSON.stringify(data),
    updated_at: updatedAt
  });

  return { updatedAt };
}

module.exports = {
  getProfile,
  saveProfile
};
