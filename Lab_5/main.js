const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Command } = require('commander');
const superagent = require('superagent');

const program = new Command();

// Налаштовуємо параметри
program
  .option('-h, --host <address>', 'адреса сервера')
  .option('-p, --port <number>', 'порт сервера')
  .option('-c, --cache <path>', 'шлях до директорії кешу');

// КРИТИЧНО: Очищуємо аргументи від порожніх рядків, які пхає PowerShell
const cleanArgs = process.argv.filter(arg => arg.trim() !== '');
program.parse(cleanArgs);

const options = program.opts();

// Перевірка наявності аргументів
if (!options.host || !options.port || !options.cache) {
  console.error('Помилка: Параметри --host, --port та --cache є обов’язковими!');
  process.exit(1);
}

const { host, port, cache } = options;

// Функція, яка САМА СТВОРЮЄ папку кешу
async function initCache() {
  try {
    const cachePath = path.resolve(cache);
    await fs.mkdir(cachePath, { recursive: true });
    console.log(`Папка кешу готова: ${cachePath}`);
  } catch (err) {
    console.error('Не вдалося створити папку кешу:', err);
  }
}

const server = http.createServer(async (req, res) => {
  const statusCode = req.url.slice(1);
  const filePath = path.join(cache, `${statusCode}.jpg`);

  // Якщо це просто корінь "/", то ігноруємо
  if (!statusCode || !/^\d+$/.test(statusCode)) {
    res.writeHead(400);
    return res.end('Введіть код статусу в URL, наприклад: /200');
  }

  try {
    switch (req.method) {
      case 'GET':
        try {
          // Шукаємо в кеші
          const data = await fs.readFile(filePath);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(data);
        } catch {
          // Якщо в кеші нема — йдемо в інтернет
          try {
            const response = await superagent.get(`https://http.cat/${statusCode}`);
            await fs.writeFile(filePath, response.body);
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(response.body);
          } catch {
            res.writeHead(404);
            res.end('Not Found on http.cat');
          }
        }
        break;

      case 'PUT':
        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
          await fs.writeFile(filePath, Buffer.concat(chunks));
          res.writeHead(201);
          res.end('Created in cache');
        });
        break;

      case 'DELETE':
        try {
          await fs.unlink(filePath);
          res.writeHead(200);
          res.end('Deleted');
        } catch {
          res.writeHead(404);
          res.end('Not Found in cache');
        }
        break;

      default:
        res.writeHead(405);
        res.end('Method Not Allowed');
    }
  } catch (err) {
    res.writeHead(500);
    res.end(err.message);
  }
});

// Запуск
initCache().then(() => {
  server.listen(port, host, () => {
    console.log(`Сервер запущено: http://${host}:${port}`);
  });
});