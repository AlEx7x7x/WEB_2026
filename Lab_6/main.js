const http = require("http");
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { program } = require("commander");

program
  .requiredOption("-h, --host <host>", "server host address")
  .requiredOption("-p, --port <port>", "server port", parseInt)
  .requiredOption("-c, --cache <path>", "path to cache directory");

program.parse(process.argv);
const options = program.opts();

if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
  console.log(`Created cache directory: ${options.cache}`);
}

function getInventoryPath(id) {
  return path.join(options.cache, `${id}.json`);
}

function getPhotoPath(id) {
  return path.join(options.cache, `${id}.jpg`);
}

function loadInventory(id) {
  const filePath = getInventoryPath(id);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveInventory(id, data) {
  fs.writeFileSync(getInventoryPath(id), JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString();
}

function buildItem(id) {
  const item = loadInventory(id);
  if (!item) return null;
  const photoPath = getPhotoPath(id);
  return {
    ...item,
    photoUrl: fs.existsSync(photoPath)
      ? `http://${options.host}:${options.port}/inventory/${id}/photo`
      : null,
  };
}

const app = express();

// ---------- Swagger ----------
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory Service API",
      version: "1.0.0",
      description: "API для сервісу інвентаризації - Лабораторна робота №6",
    },
    servers: [{ url: "http://localhost:3000" }],
  },
  apis: ["./main.js"],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ---------- Middleware ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, options.cache),
  filename: (req, file, cb) => cb(null, `${req.itemId}.jpg`),
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Routes ----------

/**
 * @swagger
 * /RegisterForm.html:
 *   get:
 *     summary: Отримати HTML форму реєстрації
 *     responses:
 *       200:
 *         description: HTML сторінка форми реєстрації
 */
app.get("/RegisterForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

/**
 * @swagger
 * /SearchForm.html:
 *   get:
 *     summary: Отримати HTML форму пошуку
 *     responses:
 *       200:
 *         description: HTML сторінка форми пошуку
 */
app.get("/SearchForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "SearchForm.html"));
});

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація нового предмета інвентаризації
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_name
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Назва предмета (обовязкове)
 *               description:
 *                 type: string
 *                 description: Опис предмета
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Фото предмета
 *     responses:
 *       201:
 *         description: Предмет успішно зареєстровано
 *       400:
 *         description: inventory_name не передано
 */
app.post("/register", (req, res, next) => {
  req.itemId = generateId();
  next();
}, upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name || inventory_name.trim() === "") {
    const photoPath = getPhotoPath(req.itemId);
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    return res.status(400).json({ error: "inventory_name is required" });
  }
  const id = req.itemId;
  const item = { id, inventory_name: inventory_name.trim(), description: description || "" };
  saveInventory(id, item);
  res.status(201).json(buildItem(id));
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати список всіх предметів
 *     responses:
 *       200:
 *         description: Список всіх предметів інвентаризації
 */
app.get("/inventory", (req, res) => {
  const files = fs.readdirSync(options.cache).filter((f) => f.endsWith(".json"));
  const list = files.map((f) => buildItem(path.basename(f, ".json")));
  res.status(200).json(list);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати предмет за ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Інформація про предмет
 *       404:
 *         description: Предмет не знайдено
 *   put:
 *     summary: Оновити назву або опис предмета
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Предмет оновлено
 *       404:
 *         description: Предмет не знайдено
 *   delete:
 *     summary: Видалити предмет
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Предмет видалено
 *       404:
 *         description: Предмет не знайдено
 */
app.get("/inventory/:id", (req, res) => {
  const item = buildItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Not Found" });
  res.status(200).json(item);
});

app.put("/inventory/:id", (req, res) => {
  const item = loadInventory(req.params.id);
  if (!item) return res.status(404).json({ error: "Not Found" });
  if (req.body.inventory_name !== undefined) item.inventory_name = req.body.inventory_name;
  if (req.body.description !== undefined) item.description = req.body.description;
  saveInventory(req.params.id, item);
  res.status(200).json(buildItem(req.params.id));
});

app.delete("/inventory/:id", (req, res) => {
  const item = loadInventory(req.params.id);
  if (!item) return res.status(404).json({ error: "Not Found" });
  fs.unlinkSync(getInventoryPath(req.params.id));
  const photoPath = getPhotoPath(req.params.id);
  if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  res.status(200).json({ message: "Deleted" });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото предмета
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Фото предмета (image/jpeg)
 *       404:
 *         description: Предмет або фото не знайдено
 *   put:
 *     summary: Оновити фото предмета
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         image/jpeg:
 *           schema:
 *             type: string
 *             format: binary
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       404:
 *         description: Предмет не знайдено
 */
app.get("/inventory/:id/photo", (req, res) => {
  const item = loadInventory(req.params.id);
  if (!item) return res.status(404).json({ error: "Not Found" });
  const photoPath = getPhotoPath(req.params.id);
  if (!fs.existsSync(photoPath)) return res.status(404).json({ error: "Photo Not Found" });
  res.setHeader("Content-Type", "image/jpeg");
  res.status(200).sendFile(path.resolve(photoPath));
});

app.put("/inventory/:id/photo", (req, res) => {
  const item = loadInventory(req.params.id);
  if (!item) return res.status(404).json({ error: "Not Found" });
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    fs.writeFileSync(getPhotoPath(req.params.id), Buffer.concat(chunks));
    res.status(200).json({ message: "Photo updated" });
  });
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук предмета за ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID предмета
 *               has_photo:
 *                 type: string
 *                 description: Додати посилання на фото (on/true)
 *     responses:
 *       200:
 *         description: Знайдений предмет
 *       400:
 *         description: ID не передано
 *       404:
 *         description: Предмет не знайдено
 */
app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  const item = loadInventory(id);
  if (!item) return res.status(404).json({ error: "Not Found" });
  const result = { ...item };
  if (has_photo === "on" || has_photo === "true") {
    const photoPath = getPhotoPath(id);
    result.photoUrl = fs.existsSync(photoPath)
      ? `http://${options.host}:${options.port}/inventory/${id}/photo`
      : null;
  }
  res.status(200).json(result);
});

app.all("/register", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));
app.all("/inventory", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));
app.all("/inventory/:id", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));
app.all("/inventory/:id/photo", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));
app.all("/search", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));

http.createServer(app).listen(options.port, options.host, () => {
  console.log(`Inventory server running at http://${options.host}:${options.port}`);
  console.log(`Swagger docs: http://${options.host}:${options.port}/api-docs`);
  console.log(`Cache directory: ${options.cache}`);
});