const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "app.db");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    category_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );
`);

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM categories").get().c;
  if (count > 0) return;

  const insertCat = db.prepare("INSERT INTO categories (name) VALUES (?)");
  const insertProd = db.prepare(
    "INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)"
  );

  const info1 = insertCat.run("Bebidas");
  const info2 = insertCat.run("Snacks");

  insertProd.run("Agua", 12.5, info1.lastInsertRowid);
  insertProd.run("Refresco", 18.0, info1.lastInsertRowid);
  insertProd.run("Papas", 15.0, info2.lastInsertRowid);
}

seedIfEmpty();

function resetAndSeed() {
  db.exec("DELETE FROM products; DELETE FROM categories;");
  try {
    db.exec(
      "DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories');"
    );
  } catch (e) {
    // sqlite_sequence puede no existir aun
  }
  seedIfEmpty();
}

module.exports = {
  db,
  DB_PATH,
  BACKUP_DIR,
  resetAndSeed,
};
