// Sanity check over every published puzzle. Runs in CI before deploying.
import { addDays, madridDate, readManifest, readPuzzle, validateClue } from "./lib.mjs";

const { dates } = readManifest();
let bad = 0;
for (const d of dates) {
  const p = readPuzzle(d);
  const errs = validateClue(p);
  if (errs.length) { bad++; console.error(`${d}: ${errs.join("; ")}`); }
}
const today = madridDate();
const ahead = dates.filter((d) => d > today).length;
console.log(`${dates.length} pistas, ${ahead} por delante de hoy (${today}).`);
if (!dates.includes(addDays(today, 1))) console.warn("Aviso: no hay pista para mañana.");
if (bad) process.exit(1);
