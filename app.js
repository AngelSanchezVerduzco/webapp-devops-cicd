const express = require("express");
const fs = require("fs");
const path = require("path");
const { db, DB_PATH, BACKUP_DIR } = require("./db");

const app = express();
app.use(express.json());

function ok(res, data = [], statusCode = 202) {
  return res.status(statusCode).json({ statusCode, data });
}

function fail(res, message, statusCode = 400) {
  return res.status(statusCode).json({ statusCode, data: [], error: message });
}

function getProductById(id) {
  return db
    .prepare(
      `SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name, p.created_at
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id);
}

function healthPayload() {
  return [
    {
      message: "WebApp API CI/CD Demo test profe",
      status: "ok",
      socket: "TCP puerto 6061 — {insert:<element>} / {get:<element>}",
      endpoints: [
        "GET /",
        "GET /api/health",
        "GET /categories",
        "POST /categories",
        "PUT /categories/:id",
        "DELETE /categories/:id",
        "GET /products",
        "GET /products/:id",
        "POST /products",
        "PUT /products/:id",
        "DELETE /products/:id",
        "POST /db/backup",
        "DELETE /db/reset",
      ],
    },
  ];
}

// 1) Health
app.get("/", (req, res) => {
  return ok(res, healthPayload());
});

// Health bajo /api (requerimiento del proyecto integrador)
app.get("/api/health", (req, res) => {
  return ok(res, healthPayload());
});

// 2) Listar categorias
app.get("/categories", (req, res) => {
  const rows = db.prepare("SELECT * FROM categories ORDER BY id").all();
  return ok(res, rows);
});

// 3) Crear categoria
app.post("/categories", (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return fail(res, "name es requerido");

  try {
    const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    const row = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(info.lastInsertRowid);
    return ok(res, [row], 201);
  } catch (e) {
    return fail(res, "No se pudo crear la categoria (quiza ya existe)");
  }
});

// 4) Actualizar categoria (PUT / update)
app.put("/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const name = (req.body?.name || "").trim();
  if (!name) return fail(res, "name es requerido");

  const exists = db.prepare("SELECT id FROM categories WHERE id = ?").get(id);
  if (!exists) return fail(res, "Categoria no encontrada", 404);

  try {
    db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
    const row = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
    return ok(res, [row]);
  } catch (e) {
    return fail(res, "No se pudo actualizar la categoria (quiza el nombre ya existe)");
  }
});

// 5) Eliminar categoria
app.delete("/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  if (info.changes === 0) return fail(res, "Categoria no encontrada", 404);
  return ok(res, [{ deleted: true, id }]);
});

// 6) Listar productos
app.get("/products", (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name, p.created_at
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       ORDER BY p.id`
    )
    .all();
  return ok(res, rows);
});

// 7) Producto por id
app.get("/products/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = getProductById(id);
  if (!row) return fail(res, "Producto no encontrado", 404);
  return ok(res, [row]);
});

// 8) Crear producto
app.post("/products", (req, res) => {
  const name = (req.body?.name || "").trim();
  const price = Number(req.body?.price);
  const category_id = Number(req.body?.category_id);

  if (!name) return fail(res, "name es requerido");
  if (Number.isNaN(price) || price < 0) return fail(res, "price invalido");
  if (!category_id) return fail(res, "category_id es requerido");

  const cat = db.prepare("SELECT id FROM categories WHERE id = ?").get(category_id);
  if (!cat) return fail(res, "category_id no existe", 404);

  const info = db
    .prepare("INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)")
    .run(name, price, category_id);

  return ok(res, [getProductById(info.lastInsertRowid)], 201);
});

// 9) Actualizar producto (PUT / update)
app.put("/products/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = getProductById(id);
  if (!existing) return fail(res, "Producto no encontrado", 404);

  const name =
    req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
  const price =
    req.body?.price !== undefined ? Number(req.body.price) : existing.price;
  const category_id =
    req.body?.category_id !== undefined
      ? Number(req.body.category_id)
      : existing.category_id;

  if (!name) return fail(res, "name es requerido");
  if (Number.isNaN(price) || price < 0) return fail(res, "price invalido");
  if (!category_id) return fail(res, "category_id es requerido");

  const cat = db.prepare("SELECT id FROM categories WHERE id = ?").get(category_id);
  if (!cat) return fail(res, "category_id no existe", 404);

  db.prepare(
    "UPDATE products SET name = ?, price = ?, category_id = ? WHERE id = ?"
  ).run(name, price, category_id, id);

  return ok(res, [getProductById(id)]);
});

// 10) Eliminar producto
app.delete("/products/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (info.changes === 0) return fail(res, "Producto no encontrado", 404);
  return ok(res, [{ deleted: true, id }]);
});

// 11) Backup de la BD
app.post("/db/backup", (req, res) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `app-backup-${stamp}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  return ok(res, [
    {
      message: "Backup creado",
      file: path.basename(backupPath),
      path: backupPath,
    },
  ]);
});

// 12) Vaciar BD
app.delete("/db/reset", (req, res) => {
  const wipe = db.transaction(() => {
    db.prepare("DELETE FROM products").run();
    db.prepare("DELETE FROM categories").run();
  });
  wipe();
  return ok(res, [{ message: "Base de datos vaciada" }]);
});

module.exports = app;
