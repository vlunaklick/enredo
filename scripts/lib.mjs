// Shared helpers for the puzzle pipeline (generator, seeder, checker).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PUZZLE_DIR = path.join(here, "..", "public", "puzzles");
export const MANIFEST = path.join(PUZZLE_DIR, "manifest.json");
export const TIMEZONE = "Europe/Madrid";
// Day #1 of the game. Puzzle numbers are days since this date + 1.
export const EPOCH = "2026-09-19";

export const TYPES = {
  anagrama: "Anagrama: las letras del material se reordenan.",
  oculta: "Palabra oculta: la respuesta aparece escondida dentro del texto de la pista.",
  inversion: "Inversión: el material leído al revés da la respuesta.",
  charada: "Charada: la respuesta se forma juntando piezas en orden.",
  doble: "Doble definición: dos definiciones distintas de la misma palabra.",
  contenedor: "Contenedor: una pieza se mete dentro de otra.",
  eliminacion: "Eliminación: se quitan letras a una palabra (cabeza, cola, corazón...).",
  homofono: "Homófono: suena igual que otra palabra o expresión.",
  combinada: "Combinada: mezcla varios recursos (p. ej. un sinónimo leído al revés más otra pieza).",
  adivinanza: "Adivinanza: toda la pista es una definición con trampa, sin juego de letras.",
};

// Weekly curve like the NYT crossword: easy on Monday, hardest on Friday/Saturday.
// Index = getUTCDay() (0 = Sunday).
export const WEEK_CURVE = [2, 1, 2, 2, 2, 3, 3];
// New clues must be at least this long; short answers get solved by trial and error.
export const MIN_LETTERS = 6;
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

/** Uppercase, strip accents but keep Ñ, drop everything that isn't a letter. */
export function letters(s) {
  return s
    .toUpperCase()
    .replace(/Ñ/g, "\u0000")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0000/g, "Ñ")
    .replace(/[^A-ZÑ]/g, "");
}

/** "PIE DE CABRA" -> "3,2,5" */
export function enumeration(answer) {
  return answer.trim().split(/[\s-]+/).map((w) => letters(w).length).join(",");
}

const sorted = (s) => [...letters(s)].sort().join("");

/**
 * Mechanical checks a clue must pass before it's ever shown to a solver.
 * Returns a list of problems (empty = ok).
 */
export function validateClue(c) {
  const errs = [];
  if (!c.clue || !c.answer || !c.definition || !c.explanation) return ["faltan campos: clue, answer, definition, explanation"];
  if (!TYPES[c.type]) errs.push(`tipo desconocido: ${c.type}`);
  if (c.difficulty != null && ![1, 2, 3].includes(c.difficulty)) errs.push("difficulty debe ser 1, 2 o 3");
  const ans = letters(c.answer);
  if (ans.length < 3 || ans.length > 12) errs.push("longitud de respuesta fuera de rango");
  if (!c.clue.includes(c.definition)) errs.push("la definición no es un fragmento literal de la pista");
  if (c.indicator && !c.clue.includes(c.indicator)) errs.push("el indicador no es un fragmento literal de la pista");
  if (["anagrama", "oculta", "inversion", "eliminacion", "contenedor"].includes(c.type) && !c.indicator)
    errs.push("falta indicador");
  if (!/^(.*\S)\s\(\d+(,\d+)*\)$/.test(c.clue)) errs.push("la pista debe terminar con la enumeración, p. ej. (5)");
  if (!c.clue.endsWith(`(${enumeration(c.answer)})`)) errs.push(`enumeración incorrecta, debería ser (${enumeration(c.answer)})`);
  // The answer must not appear verbatim in the clue (except as a hidden word).
  if (c.type !== "oculta" && letters(c.clue).includes(ans) && ans.length > 3) {
    const words = c.clue.split(/\s+/).map(letters);
    if (words.includes(ans)) errs.push("la respuesta aparece tal cual en la pista");
  }
  if (["anagrama", "inversion"].includes(c.type) && !c.fodder) errs.push("falta el material (fodder)");
  else if (c.type === "anagrama" && sorted(c.fodder) !== sorted(c.answer))
    errs.push(`el material "${c.fodder}" no es anagrama de ${ans}`);
  if (c.type === "anagrama" && c.fodder && letters(c.fodder) === ans) errs.push("el anagrama no reordena nada");
  if (c.type === "inversion" && c.fodder && [...letters(c.fodder)].reverse().join("") !== ans)
    errs.push(`"${c.fodder}" al revés no da ${ans}`);
  if (c.type === "oculta") {
    const body = letters(c.clue.replace(/\(\d+(,\d+)*\)$/, "").replace(c.definition, " "));
    if (!body.includes(ans)) errs.push(`${ans} no aparece oculta en la pista`);
    if (c.clue.split(/\s+/).map(letters).includes(ans)) errs.push("la palabra oculta está a la vista");
  }
  if (["anagrama", "inversion"].includes(c.type) && c.fodder && !c.clue.includes(c.fodder))
    errs.push("el material del anagrama/inversión debe aparecer literalmente en la pista");
  return errs;
}

// --- Light obfuscation so the answer isn't readable in DevTools at a glance. ---
// Not security: anyone determined can decode it, same as every static word game.
function keyFor(date) {
  return [...`enredo-${date}`].map((ch) => ch.charCodeAt(0));
}
export function encode(obj, date) {
  const bytes = Buffer.from(JSON.stringify(obj), "utf8");
  const k = keyFor(date);
  return Buffer.from(bytes.map((b, i) => b ^ k[i % k.length])).toString("base64");
}
export function decode(str, date) {
  const bytes = Buffer.from(str, "base64");
  const k = keyFor(date);
  return JSON.parse(Buffer.from(bytes.map((b, i) => b ^ k[i % k.length])).toString("utf8"));
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
