// Pull the best-liked community clues into a tanda, so they can become a daily clue
// (with credit to their author). Review the file by hand, then publish it with `npm run add`.
//
//   npm run destacadas                      # top 10 by likes -> tandas/comunidad-AAAA-MM-DD.json
//   npm run destacadas -- --top 5 --min 3   # top 5 with at least 3 likes
//
// Skips clues whose answer was already used and clues that no longer pass validateClue.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decode, letters, madridDate, usedAnswers, validateClue } from "./lib.mjs";

const SB_URL = process.env.SB_URL ?? "https://dcoftqtmtajcxsvwtukg.supabase.co";
const SB_KEY = process.env.SB_KEY ?? "sb_publishable_Qs8w0eebpbYypO6eb4JITw_M47SxF8p";

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i > -1 ? Number(args[i + 1]) : d; };
const top = opt("--top", 10);
const min = opt("--min", 1);

const url = `${SB_URL}/rest/v1/community_puzzles?select=id,author_name,clue,type,difficulty,secret,likes,unclear`
  + `&status=eq.published&likes=gte.${min}&order=likes.desc,created_at.asc&limit=${top * 3}`;
const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);

const used = usedAnswers();
const out = [];
for (const row of await r.json()) {
  if (out.length >= top) break;
  let s;
  try { s = decode(row.secret, "comunidad"); } catch { console.error(`✗ ${row.clue} (${row.id}): secret ilegible`); continue; }
  const c = {
    clue: row.clue, answer: s.answer, type: row.type, difficulty: row.difficulty,
    definition: s.definition, indicator: s.indicator, fodder: s.fodder, explanation: s.explanation,
    author: row.author_name,
  };
  const errs = validateClue(c);
  if (used.has(letters(c.answer))) errs.push("respuesta ya usada");
  // "No se entiende" con muchos votos: mejor no llevarla a la diaria.
  if (row.unclear > row.likes / 2) errs.push(`${row.unclear} «no se entiende»`);
  if (errs.length) { console.error(`✗ ${row.clue} (${row.id}): ${errs.join(", ")}`); continue; }
  used.add(letters(c.answer));
  out.push(c);
  console.log(`✓ ${row.likes}👍  ${row.clue}  → ${c.answer}  · ${c.author}`);
}

if (!out.length) { console.log("No hay pistas de la comunidad que cumplan el filtro."); process.exit(0); }
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tandas", `comunidad-${madridDate()}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`\n${out.length} pistas en ${path.relative(process.cwd(), file)}. Revísalas y publica con: npm run add -- ${path.relative(process.cwd(), file)}`);
