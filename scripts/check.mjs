// Sanity check over every published puzzle. Runs in CI on every push and daily.
import fs from "node:fs";
import { addDays, madridDate, readManifest, readPuzzle, validateClue } from "./lib.mjs";

const { dates } = readManifest();
let bad = 0;
for (const d of dates) {
  const errs = validateClue(readPuzzle(d));
  if (errs.length) { bad++; console.error(`${d}: ${errs.join("; ")}`); }
}

// Consecutive days covered from today on (a gap means the site falls back to an older clue).
const today = madridDate();
let ahead = 0;
while (dates.includes(addDays(today, ahead + 1))) ahead++;
const last = addDays(today, ahead);
console.log(`${dates.length} pistas. Cubierto hasta ${last} (${ahead} días por delante de hoy, ${today}).`);
if (!dates.includes(today)) console.warn("Aviso: no hay pista para hoy; la web muestra la última disponible.");
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `ahead=${ahead}\nlast=${last}\n`);
if (bad) process.exit(1);
