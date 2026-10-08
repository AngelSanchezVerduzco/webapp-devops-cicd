const net = require("net");
const { db } = require("./db");

const SOCKET_PORT = Number(process.env.SOCKET_PORT || 6061);

function ok(data = [], statusCode = 200) {
  return JSON.stringify({ statusCode, data }) + "\n";
}

function fail(message, statusCode = 400) {
  return JSON.stringify({ statusCode, data: [], error: message }) + "\n";
}

function insertProduct(body) {
  const name = (body?.name || "").trim();
  const price = Number(body?.price);
  const category_id = Number(body?.category_id);

  if (!name) return fail("name es requerido");
  if (Number.isNaN(price) || price < 0) return fail("price invalido");
  if (!category_id) return fail("category_id es requerido");

  const cat = db.prepare("SELECT id FROM categories WHERE id = ?").get(category_id);
  if (!cat) return fail("category_id no existe", 404);

  const info = db
    .prepare("INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)")
    .run(name, price, category_id);

  const row = db
    .prepare(
      `SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name, p.created_at
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(info.lastInsertRowid);

  return ok([row], 201);
}

function insertCategory(body) {
  const name = (body?.name || "").trim();
  if (!name) return fail("name es requerido");

  try {
    const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    const row = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(info.lastInsertRowid);
    return ok([row], 201);
  } catch (e) {
    return fail("No se pudo crear la categoria (quiza ya existe)");
  }
}

function handleInsert(rawElement) {
  let body;
  try {
    body = JSON.parse(rawElement);
  } catch (e) {
    return fail("Elemento invalido. Usa JSON, ejemplo: {\"name\":\"Galletas\",\"price\":20,\"category_id\":2}");
  }

  // Mismo body de la practica anterior (producto)
  if (body.price !== undefined || body.category_id !== undefined) {
    return insertProduct(body);
  }
  // Si solo trae name, inserta categoria
  return insertCategory(body);
}

function getProductById(id) {
  const row = db
    .prepare(
      `SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name, p.created_at
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id);

  if (!row) return fail("Producto no encontrado", 404);
  return ok([row]);
}

function handleGet(rawElement) {
  const key = String(rawElement || "").trim();

  if (key === "products") {
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name, p.created_at
         FROM products p
         INNER JOIN categories c ON c.id = p.category_id
         ORDER BY p.id`
      )
      .all();
    return ok(rows);
  }

  if (key === "categories") {
    const rows = db.prepare("SELECT * FROM categories ORDER BY id").all();
    return ok(rows);
  }

  // {get:1} o {get:{"id":1}}
  if (/^\d+$/.test(key)) {
    return getProductById(Number(key));
  }

  try {
    const body = JSON.parse(key);
    if (body.id !== undefined) return getProductById(Number(body.id));
    if (body.name) {
      const rows = db
        .prepare(
          `SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name, p.created_at
           FROM products p
           INNER JOIN categories c ON c.id = p.category_id
           WHERE p.name = ?
           ORDER BY p.id`
        )
        .all(String(body.name).trim());
      return ok(rows);
    }
  } catch (e) {
    // no es JSON
  }

  return fail(
    "get invalido. Usa: {get:1} o {get:products} o {get:categories} o {get:{\"id\":1}}"
  );
}

function processMessage(msg) {
  const text = String(msg || "").trim();
  if (!text) return null;

  const match = text.match(/^\{(insert|get):([\s\S]+)\}$/i);
  if (!match) {
    return fail(
      "Formato invalido. Usa {insert:<element>} o {get:<element>}"
    );
  }

  const cmd = match[1].toLowerCase();
  const element = match[2].trim();

  if (cmd === "insert") return handleInsert(element);
  return handleGet(element);
}

function startSocketServer() {
  const server = net.createServer((socket) => {
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      // Procesa por lineas (facil con telnet / nc)
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, "");
        buffer = buffer.slice(idx + 1);
        const response = processMessage(line);
        if (response) socket.write(response);
      }

      // Si mando el mensaje completo sin salto de linea
      const trimmed = buffer.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const response = processMessage(trimmed);
        buffer = "";
        if (response) socket.write(response);
      }
    });

    socket.on("error", () => {
      // cliente cerro de golpe
    });
  });

  server.listen(SOCKET_PORT, "0.0.0.0", () => {
    console.log(`Socket TCP escuchando en puerto ${SOCKET_PORT}`);
  });

  return server;
}

module.exports = { startSocketServer, SOCKET_PORT };
