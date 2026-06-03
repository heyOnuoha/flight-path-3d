import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

// Public CC0/MIT airport dataset — 28k+ airports with IATA/ICAO/lat/lon/tz.
// No API key, no quota cost, larger and more accurate than Aviationstack's
// 6,471-entry /airports endpoint. Pulled once at install time; the resulting
// lib/airports.json is consumed by the server-side flight enrichment.
const SOURCE_URL =
  "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
const OUT = path.resolve("lib/airports.json");

async function isAlreadyPopulated() {
  try {
    const raw = await readFile(OUT, "utf8");
    const parsed = JSON.parse(raw);
    return Object.keys(parsed.byIata ?? {}).length > 0;
  } catch {
    return false;
  }
}

if (process.argv.includes("--force") === false && (await isAlreadyPopulated())) {
  console.log("[airports] already populated, skipping (use --force to refresh)");
  process.exit(0);
}

console.log(`[airports] fetching from ${SOURCE_URL}`);
const res = await fetch(SOURCE_URL);
if (!res.ok) {
  console.error(`[airports] HTTP ${res.status} from upstream`);
  process.exit(1);
}
const raw = await res.json();

const byIata = {};
const byIcao = {};

for (const [icaoKey, info] of Object.entries(raw)) {
  if (typeof info !== "object" || info === null) continue;
  const i = info;
  const lat = Number(i.lat);
  const lon = Number(i.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const record = {
    name: i.name ?? null,
    iata: i.iata || null,
    icao: i.icao || icaoKey,
    lat,
    lon,
    tz: i.tz ?? null,
    country: i.country ?? null,
  };
  if (record.iata) byIata[record.iata] = record;
  if (record.icao) byIcao[record.icao] = record;
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ byIata, byIcao }, null, 0));
console.log(
  `[airports] wrote ${Object.keys(byIata).length} IATA / ${Object.keys(byIcao).length} ICAO → ${OUT}`
);
