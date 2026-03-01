const fs = require("fs");
const { Command } = require("commander");

const program = new Command();

program
  .requiredOption("-i, --input <path>", "input file")
  .option("-o, --output <path>", "output file")
  .option("-d, --display", "display in console")
  .option("-h, --humidity", "show humidity")
  .option("-r, --rainfall <value>", "filter by rainfall");

program.parse(process.argv);
const options = program.opts();

// ❗ перевірка існування файлу
if (!fs.existsSync(options.input)) {
  console.error("Cannot find input file");
  process.exit(1);
}

let data;

try {
  const fileContent = fs.readFileSync(options.input, "utf-8");
  data = JSON.parse(fileContent);
} catch (err) {
  console.error("Error reading or parsing JSON");
  process.exit(1);
}

// 🔽 фільтрація
let filtered = data;

if (options.rainfall !== undefined) {
  const rainValue = Number(options.rainfall);
  filtered = filtered.filter(
    item => Number(item.Rainfall) > rainValue
  );
}

// 🔽 формування результату
let result = filtered
  .map(item => {
    const rain = item.Rainfall ?? "";
    const pressure = item.Pressure3pm ?? "";

    if (options.humidity) {
      const humidity = item.Humidity3pm ?? "";
      return `${rain} ${pressure} ${humidity}`;
    }

    return `${rain} ${pressure}`;
  })
  .join("\n");

// ❗ якщо нема -o і -d — нічого не робимо
if (!options.output && !options.display) {
  process.exit(0);
}

// 🔽 запис у файл
if (options.output) {
  fs.writeFileSync(options.output, result);
}

// 🔽 вивід у консоль
if (options.display) {
  console.log(result);
}