const fs = require("fs");
const os = require("os");
const path = require("path");

const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "webapp-tests-"));
process.env.DATA_DIR = TEST_DIR;

const request = require("supertest");
const app = require("../app");
const { resetAndSeed, db } = require("../db");

beforeEach(() => {
  resetAndSeed();
});

afterAll(() => {
  try {
    db.close();
  } catch (e) {
    // ignore
  }
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

async function firstCategoryId() {
  const res = await request(app).get("/categories");
  return res.body.data[0].id;
}

async function firstProductId() {
  const res = await request(app).get("/products");
  return res.body.data[0].id;
}

describe("API HTTP – pruebas de endpoints", () => {
  describe("GET /", () => {
    test("responde 202 con status ok", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(202);
      expect(res.body.statusCode).toBe(202);
      expect(res.body.data[0].endpoints.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("GET /api/health", () => {
    test("responde 202 con status ok", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(202);
      expect(res.body.statusCode).toBe(202);
      expect(res.body.data[0].status).toBe("ok");
    });
  });

  describe("GET /categories", () => {
    test("lista categorias existentes", async () => {
      const res = await request(app).get("/categories");
      expect(res.status).toBe(202);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    test("lista vacia despues de reset", async () => {
      await request(app).delete("/db/reset");
      const res = await request(app).get("/categories");
      expect(res.status).toBe(202);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe("POST /categories", () => {
    test("crea una categoria con datos validos", async () => {
      const res = await request(app)
        .post("/categories")
        .send({ name: "Frutas" });
      expect(res.status).toBe(201);
      expect(res.body.data[0].name).toBe("Frutas");
    });

    test("falla si name falta (error del consumidor)", async () => {
      const res = await request(app).post("/categories").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    test("falla si el nombre ya existe", async () => {
      const res = await request(app)
        .post("/categories")
        .send({ name: "Bebidas" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ya existe/i);
    });
  });

  describe("PUT /categories/:id", () => {
    test("actualiza una categoria existente", async () => {
      const id = await firstCategoryId();
      const res = await request(app)
        .put(`/categories/${id}`)
        .send({ name: "Bebidas Premium" });
      expect(res.status).toBe(202);
      expect(res.body.data[0].name).toBe("Bebidas Premium");
    });

    test("regresa 404 al actualizar un id inexistente", async () => {
      const res = await request(app)
        .put("/categories/9999")
        .send({ name: "Nueva" });
      expect(res.status).toBe(404);
    });

    test("regresa 400 si el body esta incompleto", async () => {
      const id = await firstCategoryId();
      const res = await request(app).put(`/categories/${id}`).send({});
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /categories/:id", () => {
    test("elimina una categoria existente", async () => {
      const created = await request(app)
        .post("/categories")
        .send({ name: "Temporal" });
      const id = created.body.data[0].id;
      const res = await request(app).delete(`/categories/${id}`);
      expect(res.status).toBe(202);
      expect(res.body.data[0].deleted).toBe(true);
    });

    test("regresa 404 si el id no existe", async () => {
      const res = await request(app).delete("/categories/9999");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /products", () => {
    test("lista productos existentes", async () => {
      const res = await request(app).get("/products");
      expect(res.status).toBe(202);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("GET /products/:id", () => {
    test("obtiene un producto existente", async () => {
      const id = await firstProductId();
      const res = await request(app).get(`/products/${id}`);
      expect(res.status).toBe(202);
      expect(res.body.data[0].id).toBe(id);
    });

    test("regresa 404 si el id no existe", async () => {
      const res = await request(app).get("/products/9999");
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/no encontrado/i);
    });
  });

  describe("POST /products", () => {
    test("crea un producto con datos validos", async () => {
      const categoryId = await firstCategoryId();
      const res = await request(app)
        .post("/products")
        .send({ name: "Galletas", price: 20, category_id: categoryId });
      expect(res.status).toBe(201);
      expect(res.body.data[0].name).toBe("Galletas");
    });

    test("falla si name falta (error del consumidor)", async () => {
      const categoryId = await firstCategoryId();
      const res = await request(app)
        .post("/products")
        .send({ price: 10, category_id: categoryId });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    test("falla con price invalido", async () => {
      const categoryId = await firstCategoryId();
      const res = await request(app)
        .post("/products")
        .send({ name: "X", price: -5, category_id: categoryId });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/price/i);
    });

    test("falla si category_id no existe", async () => {
      const res = await request(app)
        .post("/products")
        .send({ name: "X", price: 10, category_id: 999 });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /products/:id", () => {
    test("actualiza un producto existente", async () => {
      const id = await firstProductId();
      const categoryId = await firstCategoryId();
      const res = await request(app)
        .put(`/products/${id}`)
        .send({ name: "Agua Mineral", price: 15, category_id: categoryId });
      expect(res.status).toBe(202);
      expect(res.body.data[0].name).toBe("Agua Mineral");
    });

    test("regresa 404 al actualizar un id inexistente", async () => {
      const categoryId = await firstCategoryId();
      const res = await request(app)
        .put("/products/9999")
        .send({ name: "X", price: 1, category_id: categoryId });
      expect(res.status).toBe(404);
    });

    test("regresa 400 si el price es invalido", async () => {
      const id = await firstProductId();
      const res = await request(app).put(`/products/${id}`).send({ price: -1 });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /products/:id", () => {
    test("elimina un producto existente", async () => {
      const id = await firstProductId();
      const res = await request(app).delete(`/products/${id}`);
      expect(res.status).toBe(202);
      expect(res.body.data[0].deleted).toBe(true);
    });

    test("regresa 404 si el id no existe", async () => {
      const res = await request(app).delete("/products/9999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /db/backup", () => {
    test("crea un backup de la base de datos", async () => {
      const res = await request(app).post("/db/backup");
      expect(res.status).toBe(202);
      expect(res.body.data[0].file).toMatch(/\.db$/);
    });
  });

  describe("DELETE /db/reset", () => {
    test("vacia la base de datos", async () => {
      const res = await request(app).delete("/db/reset");
      expect(res.status).toBe(202);
      const prods = await request(app).get("/products");
      expect(prods.body.data.length).toBe(0);
    });
  });
});
