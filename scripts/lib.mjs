// Shared helpers for the puzzle pipeline (generator, seeder, checker).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decode, encode, enumeration, letters } from "../public/clue-rules.js";

// Las reglas de las pistas viven en public/clue-rules.js para que la web (/crear) valide igual.
export { TYPES, decode, encode, enumeration, letters, validateClue } from "../public/clue-rules.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PUZZLE_DIR = path.join(here, "..", "public", "puzzles");
export const MANIFEST = path.join(PUZZLE_DIR, "manifest.json");
export const TIMEZONE = "Europe/Madrid";
// Day #1 of the game. Puzzle numbers are days since this date + 1.
export const EPOCH = "2026-10-15";

// Weekly curve like the NYT crossword: easy on Monday, hardest on Friday/Saturday.
// Index = getUTCDay() (0 = Sunday).
export const WEEK_CURVE = [2, 1, 1, 2, 2, 3, 3];
export const DIFFICULTY_NAMES = { 1: "fácil", 2: "media", 3: "difícil" };
export function difficultyFor(iso) {
  return WEEK_CURVE[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

/** YYYY-MM-DD in Madrid for a Date (default: now). */
export function madridDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d);
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function puzzleNumber(iso) {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${EPOCH}T12:00:00Z`)) / 86400000) + 1;
}

/** Write a puzzle file and register it in the manifest. */
export function savePuzzle(date, c) {
  fs.mkdirSync(PUZZLE_DIR, { recursive: true });
  const data = {
    date,
    number: puzzleNumber(date),
    clue: c.clue,
    enumeration: enumeration(c.answer),
    type: c.type,
    difficulty: c.difficulty ?? difficultyFor(date),
    author: c.author ?? "Enredo",
    // Spoilers (answer, definition span, indicator, explanation) are obfuscated.
    secret: encode(
      {
        answer: c.answer.toUpperCase(),
        definition: c.definition,
        indicator: c.indicator ?? null,
        fodder: c.fodder ?? null,
        explanation: c.explanation,
      },
      date,
    ),
  };
  fs.writeFileSync(path.join(PUZZLE_DIR, `${date}.json`), JSON.stringify(data, null, 2) + "\n");
  writeManifest();
}

/** The manifest is always rebuilt from the files on disk, so deleting a puzzle file is enough. */
export function writeManifest() {
  fs.writeFileSync(MANIFEST, JSON.stringify(readManifest(), null, 2) + "\n");
}

export function readManifest() {
  const dates = fs.existsSync(PUZZLE_DIR)
    ? fs.readdirSync(PUZZLE_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort()
    : [];
  return { dates };
}

export function readPuzzle(date) {
  const p = JSON.parse(fs.readFileSync(path.join(PUZZLE_DIR, `${date}.json`), "utf8"));
  return { ...p, ...decode(p.secret, date) };
}

export function usedAnswers() {
  return new Set(readManifest().dates.map((d) => letters(readPuzzle(d).answer)));
}
