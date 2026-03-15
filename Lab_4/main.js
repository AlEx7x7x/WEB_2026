const http = require("http");
const fs = require("fs");
const { Command } = require("commander");
const { XMLBuilder } = require("fast-xml-parser");
const url = require("url");

const program = new Command();

program
  .requiredOption("-i, --input <file>", "Input file")
  .requiredOption("-h, --host <host>", "Server host")
  .requiredOption("-p, --port <port>", "Server port");

program.parse(process.argv);
const options = program.opts();

if (!fs.existsSync(options.input)) {
  console.error("Cannot find input file");
  process.exit(1);
}

const server = http.createServer((req, res) => {

  const query = url.parse(req.url, true).query;

  fs.readFile(options.input, "utf8", (err, data) => {

    if (err) {
      res.writeHead(500);
      res.end("Error reading file");
      return;
    }

    const jsonData = JSON.parse(data);

    let result = [];

    jsonData.forEach(item => {

      if (query.min_rainfall && item.Rainfall <= query.min_rainfall) {
        return;
      }

      result.push({
        rainfall: item.Rainfall,
        pressure3pm: item.Pressure3pm,
        humidity: query.humidity ? item.Humidity3pm : undefined
      });

    });

    const builder = new XMLBuilder();
    const xml = builder.build({ weather_data: { record: result } });

    res.writeHead(200, { "Content-Type": "application/xml" });
    res.end(xml);

  });

});

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});

// const http = require("http");
// const fs = require("fs");
// const { Command } = require("commander");

// const program = new Command();

// program
//   .requiredOption("-i, --input <file>", "Input file")
//   .requiredOption("-h, --host <host>", "Server host")
//   .requiredOption("-p, --port <port>", "Server port");

// program.parse(process.argv);

// const options = program.opts();

// // перевірка файлу
// if (!fs.existsSync(options.input)) {
//   console.error("Cannot find input file");
//   process.exit(1);
// }

// const server = http.createServer((req, res) => {
//   res.writeHead(200, { "Content-Type": "text/plain" });
//   res.end("Server is running");
// });

// server.listen(options.port, options.host, () => {
//   console.log(`Server running at http://${options.host}:${options.port}`);
// });