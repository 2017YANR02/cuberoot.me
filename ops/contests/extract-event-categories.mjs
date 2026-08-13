import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  throw new Error("usage: node extract-event-categories.mjs <events.json> <categories.csv>");
}

const payload = JSON.parse(readFileSync(inputPath, "utf8"));
const events = Array.isArray(payload) ? payload : payload.data;

if (!Array.isArray(events) || events.length === 0) {
  throw new Error("upstream events response is empty or malformed");
}

const preferredRanks = new Map([
  ["unofficial", 10],
  ["wca", 20],
  ["extreme-bld", 30],
  ["miscellaneous", 40],
  ["removed", 50],
]);
const categories = new Map();

for (const event of events) {
  const id = Number(event.categoryId);
  const category = event.category;
  if (!Number.isInteger(id) || id < 1 || !category || typeof category.categoryId !== "string") {
    throw new Error(`event ${event.eventId ?? "<unknown>"} has an invalid category`);
  }

  const normalized = {
    id,
    categoryId: category.categoryId,
    rank: preferredRanks.get(category.categoryId) ?? 1_000 + id * 10,
    name: category.name,
    shortName: category.shortName,
    color: category.color,
    hidden: category.hidden,
    videoBased: category.videoBased,
  };
  const existing = categories.get(id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(normalized)) {
    throw new Error(`category ${id} has inconsistent metadata`);
  }
  categories.set(id, normalized);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const header = ["id", "category_id", "rank", "name", "short_name", "color", "hidden", "video_based"];
const rows = [...categories.values()]
  .sort((a, b) => a.id - b.id)
  .map((category) =>
    [
      category.id,
      category.categoryId,
      category.rank,
      category.name,
      category.shortName,
      category.color,
      String(category.hidden).toUpperCase(),
      String(category.videoBased).toUpperCase(),
    ]
      .map(csvCell)
      .join(","),
  );

writeFileSync(outputPath, `${[header.join(","), ...rows].join("\n")}\n`, "utf8");
