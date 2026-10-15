// Hand-written starter clues so the site works before the generator has an API key.
// Usage: npm run seed   (only fills dates that don't have a puzzle yet)
import fs from "node:fs";
import path from "node:path";
import { EPOCH, PUZZLE_DIR, addDays, savePuzzle, validateClue } from "./lib.mjs";

const SEEDS = [
  {
    clue: "Ciudad eterna con amor alocado (4)",
    answer: "ROMA", difficulty: 1, type: "anagrama", definition: "Ciudad eterna", indicator: "alocado", fodder: "amor",
    explanation: "«Ciudad eterna» es la definición. «alocado» indica anagrama de AMOR → ROMA.",
  },
  {
    clue: "Extremidad oculta en la rama nostálgica (4)",
    answer: "MANO", difficulty: 1, type: "oculta", definition: "Extremidad", indicator: "oculta en", fodder: null,
    explanation: "«Extremidad» es la definición. La respuesta se esconde en «raMA NOstálgica» → MANO.",
  },
  {
    clue: "Ocas de vuelta en el costal (4)",
    answer: "SACO", difficulty: 1, type: "inversion", definition: "costal", indicator: "de vuelta", fodder: "Ocas",
    explanation: "«costal» es la definición. OCAS leído «de vuelta» (al revés) da SACO.",
  },
  {
    clue: "Militar: astro y cubo de juego (7)",
    answer: "SOLDADO", difficulty: 2, type: "charada", definition: "Militar", indicator: "y", fodder: null,
    explanation: "«Militar» es la definición. Astro = SOL, cubo de juego = DADO: SOL + DADO → SOLDADO.",
  },
  {
    clue: "Asiento que guarda tu dinero (5)",
    answer: "BANCO", difficulty: 1, type: "doble", definition: "Asiento", indicator: null, fodder: null,
    explanation: "Doble definición: un BANCO es un asiento y también la entidad que guarda tu dinero.",
  },
  {
    clue: "Litro en la pata: metal precioso (5)",
    answer: "PLATA", difficulty: 2, type: "contenedor", definition: "metal precioso", indicator: "en", fodder: null,
    explanation: "«metal precioso» es la definición. Litro = L, metida «en» PATA: P(L)ATA → PLATA.",
  },
  {
    clue: "Fruta de un clima descabezado (4)",
    answer: "LIMA", difficulty: 2, type: "eliminacion", definition: "Fruta", indicator: "descabezado", fodder: "clima",
    explanation: "«Fruta» es la definición. CLIMA «descabezado» (sin la primera letra) → LIMA.",
  },
];

let date = EPOCH;
for (const s of SEEDS) {
  const errs = validateClue(s);
  if (errs.length) throw new Error(`Seed "${s.clue}" inválida: ${errs.join("; ")}`);
  if (!fs.existsSync(path.join(PUZZLE_DIR, `${date}.json`))) {
    savePuzzle(date, s);
    console.log(`${date}  ${s.clue}`);
  }
  date = addDays(date, 1);
}
