// Reglas de las pistas compartidas por la web y los scripts de Node (scripts/lib.mjs las reexporta).
// Sin DOM ni APIs de Node: solo JS estándar, para que funcione en ambos lados.

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
};

// Tipos que necesitan indicador o material literal en la pista.
export const NEEDS_INDICATOR = ["anagrama", "oculta", "inversion", "eliminacion", "contenedor"];
export const NEEDS_FODDER = ["anagrama", "inversion"];

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
  if (NEEDS_INDICATOR.includes(c.type) && !c.indicator)
    errs.push("falta indicador");
  if (!/^(.*\S)\s\(\d+(,\d+)*\)$/.test(c.clue)) errs.push("la pista debe terminar con la enumeración, p. ej. (5)");
  if (!c.clue.endsWith(`(${enumeration(c.answer)})`)) errs.push(`enumeración incorrecta, debería ser (${enumeration(c.answer)})`);
  // The answer must not appear verbatim in the clue (except as a hidden word).
  if (c.type !== "oculta" && letters(c.clue).includes(ans) && ans.length > 3) {
    const words = c.clue.split(/\s+/).map(letters);
    if (words.includes(ans)) errs.push("la respuesta aparece tal cual en la pista");
  }
  if (NEEDS_FODDER.includes(c.type) && !c.fodder) errs.push("falta el material (fodder)");
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
  if (NEEDS_FODDER.includes(c.type) && c.fodder && !c.clue.includes(c.fodder))
    errs.push("el material del anagrama/inversión debe aparecer literalmente en la pista");
  return errs;
}

/** Tramos a resaltar en el texto de la pista (sin enumeración): definición e indicador sin solaparse. */
export function clueSpans(text, definition, indicator) {
  const spans = [];
  const defAt = definition ? text.indexOf(definition) : -1;
  if (defAt >= 0) spans.push({ start: defAt, end: defAt + definition.length, cls: "def" });
  if (indicator) {
    let at = text.indexOf(indicator);
    while (at >= 0 && spans.some((s) => at < s.end && at + indicator.length > s.start)) at = text.indexOf(indicator, at + 1);
    if (at >= 0) spans.push({ start: at, end: at + indicator.length, cls: "ind" });
  }
  return spans.sort((a, b) => a.start - b.start);
}

// --- Light obfuscation so the answer isn't readable in DevTools at a glance. ---
// Not security: anyone determined can decode it, same as every static word game.
// `salt` es la fecha (pistas diarias) o "comunidad" (pistas de la comunidad).
const keyFor = (salt) => [...`enredo-${salt}`].map((ch) => ch.charCodeAt(0));
const xor = (bytes, salt) => { const k = keyFor(salt); return bytes.map((b, i) => b ^ k[i % k.length]); };

export function encode(obj, salt) {
  const bytes = xor(new TextEncoder().encode(JSON.stringify(obj)), salt);
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}
export function decode(str, salt) {
  const bytes = xor(Uint8Array.from(atob(str), (c) => c.charCodeAt(0)), salt);
  return JSON.parse(new TextDecoder().decode(bytes));
}
