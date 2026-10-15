// Add one or more clues written by anyone (any LLM, or a person).
//
//   npm run add -- pista.json                 # next free days
//   npm run add -- pista.json --date 2026-11-02
//   cat pista.json | npm run add
//   npm run add -- pista.json --dry           # validate only
//
// Input: a JSON object or array in the format described in prompts/pista-criptica.md.
import fs from "node:fs";
import path from "node:path";
import { MIN_LETTERS, PUZZLE_DIR, addDays, letters, madridDate, readManifest, savePuzzle, usedAnswers, validateClue } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i > -1 ? args.splice(i, i + 1 < args.length && !args[i + 1].startsWith("--") ? 2 : 1)[1] ?? true : null; };
const dry = flag("--dry");
let date = flag("--date");
const file = args[0];

const raw = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
// Tolerate LLM output wrapped in ```json fences or surrounded by prose.
const json = raw.slice(Math.min(...["{", "["].map((c) => raw.indexOf(c)).filter((i) => i >= 0)), Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]")) + 1);
const list = [].concat(JSON.parse(json));

const used = usedAnswers();
const taken = new Set(readManifest().dates);
let next = date ?? madridDate();
let failed = 0;

for (const item of list) {
  const c = { ...item, answer: String(item.answer).trim().toUpperCase(), indicator: item.indicator || null, fodder: item.fodder || null };
  const errs = validateClue(c);
  if (letters(c.answer).length < MIN_LETTERS) errs.push(`respuesta demasiado corta: mínimo ${MIN_LETTERS} letras`);
  if (c.clue.includes(":")) errs.push("sin dos puntos: la pista debe leerse como una frase normal");
  if (used.has(letters(c.answer))) errs.push(`la respuesta ${c.answer} ya se usó`);
  if (errs.length) { failed++; console.error(`✗ ${c.clue}\n    ${errs.join("\n    ")}`); continue; }

  if (!date) while (taken.has(next)) next = addDays(next, 1);
  else if (fs.existsSync(path.join(PUZZLE_DIR, `${next}.json`))) { failed++; console.error(`✗ ${next} ya tiene pista`); continue; }

  if (!dry) savePuzzle(next, c);
  console.log(`✓ ${next}  [${c.difficulty ?? "auto"}] ${c.clue}  → ${c.answer}${dry ? "  (sin guardar)" : ""}`);
  taken.add(next);
  used.add(letters(c.answer));
  next = addDays(next, 1);
}
if (failed) process.exit(1);
