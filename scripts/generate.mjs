// Keeps a buffer of future puzzles filled. Run daily (GitHub Actions does it).
//
//   ANTHROPIC_API_KEY=... npm run generate            # fill today + BUFFER_DAYS
//   ANTHROPIC_API_KEY=... npm run generate -- --days 3
//
// Pipeline per missing day: Claude writes candidates -> mechanical checks
// (anagram letters, hidden word, reversal, enumeration...) -> a separate blind
// Claude solver must reach the same answer and rate it fair. Only then it ships.
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  DIFFICULTY_NAMES, PUZZLE_DIR, TYPES, addDays, difficultyFor, letters, madridDate, readManifest, readPuzzle,
  savePuzzle, usedAnswers, validateClue, writeManifest,
} from "./lib.mjs";

const MODEL = "claude-opus-5-5";
const argDays = process.argv.indexOf("--days");
const BUFFER_DAYS = argDays > -1 ? Number(process.argv[argDays + 1]) : 14;
const ROUNDS = 3;
// Types whose wordplay we can verify mechanically or that are easy to judge.
const ROTATION = ["anagrama", "charada", "oculta", "doble", "contenedor", "inversion", "eliminacion"];

const client = new Anthropic();

async function askJSON({ system, prompt, schema, effort }) {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error(`refusal: ${res.stop_details?.category ?? "?"}`);
  if (res.stop_reason === "max_tokens") throw new Error("respuesta truncada (max_tokens)");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

// Single source of truth shared with humans and any other LLM.
const SETTER_SYSTEM = fs.readFileSync(new URL("../prompts/pista-criptica.md", import.meta.url), "utf8");

const CANDIDATES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clue", "answer", "difficulty", "definition", "indicator", "fodder", "explanation"],
        properties: {
          difficulty: { type: "integer", enum: [1, 2, 3] },
          clue: { type: "string" },
          answer: { type: "string" },
          definition: { type: "string" },
          indicator: { type: "string" },
          fodder: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
  },
};

const SOLVER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "reasoning", "fairness", "surface", "difficulty"],
  properties: {
    answer: { type: "string" },
    reasoning: { type: "string" },
    fairness: { type: "integer", description: "1-5: ¿es la pista justa y precisa?" },
    surface: { type: "integer", description: "1-5: ¿se lee como una frase natural?" },
    difficulty: { type: "integer", description: "1 fácil, 2 media, 3 difícil (3 = un jugador habitual necesitaría varios minutos o una ayuda)" },
  },
};

async function solve(clue) {
  return askJSON({
    system:
      "Eres un solucionador experto de crucigramas crípticos en español. Resuelve la pista y luego evalúala con criterio exigente: " +
      "fairness = si la definición es precisa y el mecanismo funciona letra a letra sin trampas; surface = naturalidad de la frase. Si no estás seguro de la respuesta, da tu mejor intento.",
    prompt: `Pista: ${clue}`,
    schema: SOLVER_SCHEMA,
    effort: "high",
  });
}

async function makeClue(date, type, difficulty, banned) {
  const feedback = [];
  for (let round = 1; round <= ROUNDS; round++) {
    const { candidates } = await askJSON({
      system: SETTER_SYSTEM,
      prompt:
        `Escribe 5 pistas crípticas candidatas de tipo «${type}» (${TYPES[type]}) y dificultad ${difficulty} (${DIFFICULTY_NAMES[difficulty]}).\n` +
        `Varía la temática y la longitud de las respuestas. Prohibido usar estas respuestas ya publicadas: ${[...banned].slice(-300).join(", ") || "(ninguna)"}.\n` +
        (feedback.length ? `\nIntentos anteriores rechazados, no repitas sus errores:\n${feedback.slice(-15).join("\n")}` : ""),
      schema: CANDIDATES_SCHEMA,
      effort: "high",
    });

    for (const raw of candidates) {
      const c = {
        ...raw,
        type,
        // Trust the blind solver's perception over the setter's claim (set below).
        difficulty,
        answer: raw.answer.trim().toUpperCase(),
        indicator: raw.indicator || null,
        fodder: raw.fodder || null,
      };
      if (banned.has(letters(c.answer))) { feedback.push(`- ${c.clue}: respuesta repetida`); continue; }
      const errs = validateClue(c);
      if (errs.length) { feedback.push(`- ${c.clue} [${c.answer}]: ${errs.join("; ")}`); continue; }

      const s = await solve(c.clue);
      // Allow ±1 on difficulty: solvers who know the answer tend to underrate it.
      const ok = letters(s.answer) === letters(c.answer) && s.fairness >= 4 && s.surface >= 3 && Math.abs(s.difficulty - difficulty) <= 1;
      console.log(`  ${ok ? "✓" : "✗"} ${c.clue} [${c.answer}] solver=${s.answer} justa=${s.fairness} superficie=${s.surface} dificultad=${s.difficulty}/${difficulty}`);
      if (ok) return { ...c, difficulty: s.difficulty };
      feedback.push(`- ${c.clue} [${c.answer}]: un solucionador respondió ${s.answer} (justicia ${s.fairness}/5, superficie ${s.surface}/5, dificultad ${s.difficulty} vs ${difficulty} pedida). ${s.reasoning.slice(0, 200)}`);
    }
  }
  throw new Error(`No se consiguió una pista válida de tipo ${type} para ${date}`);
}

function typeFor(date) {
  // Avoid repeating yesterday's type; otherwise rotate by day number.
  const prev = addDays(date, -1);
  const prevType = fs.existsSync(path.join(PUZZLE_DIR, `${prev}.json`)) ? readPuzzle(prev).type : null;
  const idx = Math.round(Date.parse(date) / 86400000) % ROTATION.length;
  const t = ROTATION[idx];
  return t === prevType ? ROTATION[(idx + 1) % ROTATION.length] : t;
}

writeManifest();
const today = madridDate();
const have = new Set(readManifest().dates);
const banned = usedAnswers();
let failures = 0;

for (let i = 0; i <= BUFFER_DAYS; i++) {
  const date = addDays(today, i);
  if (have.has(date)) continue;
  const type = typeFor(date);
  const difficulty = difficultyFor(date);
  console.log(`${date}: generando (${type}, dificultad ${difficulty})...`);
  try {
    const clue = await makeClue(date, type, difficulty, banned);
    savePuzzle(date, clue);
    banned.add(letters(clue.answer));
    console.log(`${date}: guardada → ${clue.clue}`);
  } catch (err) {
    failures++;
    console.error(`${date}: ERROR ${err.message}`);
  }
}

// Only fail the job if *today* has no puzzle; future gaps get retried tomorrow.
if (!readManifest().dates.includes(today)) {
  console.error(`No hay pista para hoy (${today}).`);
  process.exit(1);
}
if (failures) console.warn(`${failures} día(s) sin generar; se reintentará en la próxima ejecución.`);
