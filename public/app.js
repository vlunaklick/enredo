import { initAccount, pushPlay } from "./account.js";
import { clueSpans, decode, enumeration, letters, validateClue } from "./clue-rules.js";
import { fetchPuzzle, initFeed, initReactions, openFeed, stateKey } from "./community.js";

const TZ = "Europe/Madrid";
const MAX_ATTEMPTS = 5;
const HINT_COST = 10;
const MISS_COST = 10;
const LEVELS = { 1: "fácil", 2: "media", 3: "difícil" };
const TYPE_NAMES = {
  anagrama: "Anagrama: reordena las letras del material.",
  oculta: "Palabra oculta: está escrita dentro de la pista.",
  inversion: "Al revés: lee el material de derecha a izquierda.",
  charada: "Charada: junta piezas en orden.",
  doble: "Doble definición: dos significados de la misma palabra.",
  contenedor: "Contenedor: una pieza va dentro de otra.",
  eliminacion: "Quitar letras: a una palabra le falta un trozo.",
  homofono: "Suena como: se oye igual que otra cosa.",
  combinada: "Combinada: varios trucos a la vez.",
};

const $ = (id) => document.getElementById(id);
const today = madridDate();

// ---------- utils ----------
function madridDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}
function shortDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
function longDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
function shift(iso, n) {
  const x = new Date(`${iso}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1800);
}
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const isTouch = matchMedia("(pointer: coarse)").matches;

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// ---------- state ----------
let manifest, puzzle, secret, answer, state, key;
const input = $("input");
// ?c=<id>: pista de la comunidad. Va aparte de las diarias: sin racha, sin archivo, sin nube.
const communityId = new URLSearchParams(location.search).get("c");
const newState = (live) => ({ guesses: [], hints: [], revealed: [], status: "playing", live });

async function init() {
  manifest = await fetchJSON("puzzles/manifest.json");
  if (communityId) return initCommunity();
  const available = manifest.dates.filter((d) => d <= today);
  const asked = new URLSearchParams(location.search).get("d");
  // Never serve the future; if today is missing (generator hiccup), fall back to the latest one.
  const date = asked && available.includes(asked) ? asked : available.includes(today) ? today : available.at(-1);
  if (!date) { $("loading").textContent = "todavía no hay pistas"; return; }

  puzzle = await fetchJSON(`puzzles/${date}.json`);
  secret = decode(puzzle.secret, date);
  answer = letters(secret.answer);
  key = `enredo:${date}`;
  state = load(key, null) ?? newState(date === today);

  const lvl = puzzle.difficulty ?? 2;
  $("meta-left").innerHTML = `#${puzzle.number} · ${shortDate(date)}${date === today ? "" : ' · <span class="archived">archivo</span>'}`;
  // Pistas de la comunidad promovidas a diaria (npm run destacadas): crédito a su autor, como texto.
  if (puzzle.author && puzzle.author !== "Enredo") $("meta-left").append(` · por ${puzzle.author}`);
  show(lvl);
}

function show(lvl) {
  $("level").innerHTML = `${LEVELS[lvl]} ${[1, 2, 3].map((n) => `<i class="${n <= lvl ? "on" : ""}"></i>`).join("")}`;
  renderClue();
  render();
  $("loading").hidden = true;
  $("game").hidden = false;
  if (!isTouch && state.status === "playing") input.focus();
}

async function initCommunity() {
  const row = await fetchPuzzle(communityId);
  if (!row) return notFound();
  puzzle = row;
  // Las filas se pueden insertar por la API sin pasar por /crear: se revalida todo.
  try {
    secret = decode(row.secret, "comunidad");
    const bad = validateClue({ ...secret, clue: row.clue, type: row.type, difficulty: row.difficulty }).length
      || enumeration(secret.answer) !== row.enumeration;
    if (bad) return notFound();
  } catch { return notFound(); }
  answer = letters(secret.answer);
  key = stateKey(row.id);
  state = load(key, null) ?? newState(false);
  // author_name lo escribe cualquiera: siempre como texto, nunca como HTML.
  $("meta-left").textContent = `comunidad · por ${row.author_name}`;
  $("next").hidden = true;
  initReactions(puzzle, { notify: toast });
  show(row.difficulty);
}

function notFound() {
  const box = $("loading");
  box.textContent = "Esta pista no existe o se ha retirado. ";
  const more = document.createElement("button");
  more.className = "link";
  more.textContent = "Ver pistas de la comunidad";
  more.addEventListener("click", () => { openFeed(); $("community").showModal(); });
  const home = document.createElement("a");
  home.href = "./";
  home.textContent = "Ir a la pista de hoy";
  const p = document.createElement("p");
  p.className = "account-links center";
  p.append(more, home);
  box.append(p);
}

// ---------- clue with highlightable spans ----------
function renderClue() {
  const el = $("clue");
  const m = puzzle.clue.match(/^(.*?)\s*(\([\d,]+\))$/);
  const text = m ? m[1] : puzzle.clue;
  const spans = clueSpans(text, secret.definition, secret.indicator);
  el.textContent = "";
  let pos = 0;
  for (const s of spans) {
    el.append(text.slice(pos, s.start));
    const mk = document.createElement("mark");
    mk.className = s.cls;
    mk.textContent = text.slice(s.start, s.end);
    el.append(mk);
    pos = s.end;
  }
  el.append(text.slice(pos), " ");
  const en = document.createElement("span");
  en.className = "enum";
  en.textContent = m ? m[2] : `(${puzzle.enumeration})`;
  el.append(en);
}

// ---------- answer: one hidden input feeding the free (non-revealed) slots ----------
const freeSlots = () => [...answer].map((_, i) => i).filter((i) => !state.revealed.includes(i));

function currentGuess() {
  const typed = letters(input.value);
  const free = freeSlots();
  const out = [...answer].map((ch, i) => (state.revealed.includes(i) ? ch : ""));
  free.forEach((pos, k) => { out[pos] = typed[k] ?? ""; });
  return out;
}

function paintSlots() {
  const done = state.status !== "playing";
  const shown = done ? [...answer] : currentGuess();
  const nextPos = done ? -1 : shown.findIndex((ch) => !ch);
  const box = $("slots");
  box.textContent = "";
  let i = 0;
  for (const len of puzzle.enumeration.split(",").map(Number)) {
    const w = document.createElement("span");
    w.className = "word";
    for (let k = 0; k < len; k++, i++) {
      const s = document.createElement("span");
      s.className = "slot" + (shown[i] ? " filled" : "") + (state.revealed.includes(i) ? " given" : "") + (i === nextPos ? " next" : "");
      s.textContent = shown[i] || "";
      w.append(s);
    }
    box.append(w);
  }
  const a = $("answer");
  a.classList.toggle("won", state.status === "won");
  a.classList.toggle("lost", state.status === "lost");
}

input.addEventListener("input", () => {
  const max = freeSlots().length;
  const clean = letters(input.value).slice(0, max);
  if (input.value !== clean) input.value = clean;
  paintSlots();
});
input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
input.addEventListener("focus", () => $("answer").classList.add("focus"));
input.addEventListener("blur", () => $("answer").classList.remove("focus"));
// Typing anywhere on desktop goes to the answer.
document.addEventListener("keydown", (e) => {
  if (document.activeElement === input || document.querySelector("dialog[open]") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (state?.status === "playing" && letters(e.key).length === 1) input.focus();
});

function submit() {
  if (state.status !== "playing") return;
  const guess = currentGuess();
  if (!guess.every(Boolean)) { toast(`faltan ${guess.filter((c) => !c).length} letras`); input.focus(); return; }
  const g = guess.join("");
  if (state.guesses.includes(g)) { toast("ya lo has probado"); return; }
  state.guesses.push(g);
  if (g === answer) state.status = "won";
  else if (state.guesses.length >= MAX_ATTEMPTS) state.status = "lost";
  else {
    const a = $("answer");
    a.classList.remove("shake"); void a.offsetWidth; a.classList.add("shake");
    input.value = "";
  }
  if (state.status !== "playing") { input.blur(); input.value = ""; }
  persist();
  render();
}
$("go").addEventListener("click", submit);

// ---------- hints ----------
function useHint(kind) {
  if (state.status !== "playing") return;
  if (kind === "letter") {
    const free = freeSlots();
    if (free.length <= 1) return;
    // Keep what was typed: rebuild input without the newly revealed slot.
    const guess = currentGuess();
    state.revealed.push(free[0]);
    input.value = freeSlots().map((i) => guess[i]).join("");
  } else if (state.hints.includes(kind)) return;
  state.hints.push(kind);
  persist();
  render();
}
document.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => useHint(b.dataset.hint)));

function paintHints() {
  const used = new Set(state.hints);
  const done = state.status !== "playing";
  document.querySelector(".clue .def")?.classList.toggle("on", used.has("definition") || done);
  document.querySelector(".clue .ind")?.classList.toggle("on", used.has("indicator") || done);
  const msgs = [];
  if (used.has("definition")) msgs.push(`Definición: «${secret.definition}»`);
  if (used.has("indicator")) msgs.push(secret.indicator ? `Indicador: «${secret.indicator}»` : "No hay indicador");
  if (used.has("type")) msgs.push(TYPE_NAMES[puzzle.type] ?? puzzle.type);
  const ht = $("hint-text");
  ht.textContent = msgs.at(-1) ?? "Pide ayuda si te atascas. Cada ayuda cuesta 10 puntos.";
  ht.classList.toggle("idle", !msgs.length);
  document.querySelectorAll(".chip").forEach((b) => {
    const k = b.dataset.hint;
    const isUsed = k === "letter" ? state.revealed.length > 0 : used.has(k);
    b.classList.toggle("used", isUsed && k !== "letter");
    b.disabled = done || (k === "letter" ? freeSlots().length <= 1 : used.has(k));
    if (k === "letter" && state.revealed.length) b.querySelector("small").textContent = `−10 · ${state.revealed.length}`;
  });
}

// ---------- render ----------
function score() {
  const misses = state.guesses.filter((g) => g !== answer).length;
  return Math.max(0, 100 - HINT_COST * state.hints.length - MISS_COST * misses);
}

function render() {
  paintSlots();
  paintHints();
  const done = state.status !== "playing";
  const misses = state.guesses.filter((g) => g !== answer);
  $("status").innerHTML = misses.map((g) => `<span class="miss">${g}</span>`).join("");
  const left = MAX_ATTEMPTS - state.guesses.length;
  $("tries").textContent = `${left}/${MAX_ATTEMPTS}`;
  $("play").hidden = done;
  $("result").hidden = !done;
  if (done) {
    const n = state.guesses.length;
    $("result-title").textContent = state.status === "won"
      ? ["¡A la primera!", "¡Bien visto!", "¡Lo tienes!", "¡Por poco!", "¡Al límite!"][n - 1]
      : "Esta se resistió";
    $("score").textContent = state.status === "won" ? `${score()} pts` : "0 pts";
    $("explanation").textContent = secret.explanation;
    if (!communityId) tickCountdown();
  }
}

function persist() {
  save(key, state);
  if (!communityId) pushPlay(puzzle.date, state);
}

// ---------- share ----------
$("share").addEventListener("click", async () => {
  const marks = state.guesses.map((g) => (g === answer ? "🟢" : "⚫")).join("");
  const text = [
    communityId ? `enredo comunidad · ${LEVELS[puzzle.difficulty]}` : `enredo #${puzzle.number} · ${LEVELS[puzzle.difficulty ?? 2]}`,
    `${marks} ${state.status === "won" ? `${state.guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`}${state.hints.length ? ` · ${state.hints.length} ayuda${state.hints.length === 1 ? "" : "s"}` : ""}`,
    location.origin + location.pathname + (communityId ? `?c=${encodeURIComponent(puzzle.id)}` : ""),
  ].join("\n");
  try {
    if (navigator.share && isTouch) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast("copiado"); }
  } catch { /* cancelled */ }
});

// ---------- countdown ----------
function tickCountdown() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  const secs = 86400 - (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second));
  const pad = (n) => String(n).padStart(2, "0");
  $("countdown").textContent = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`;
  if (madridDate() !== today) location.reload();
}
setInterval(() => { if (!communityId && state && state.status !== "playing") tickCountdown(); }, 1000);

// ---------- stats & archive ----------
function allStates() {
  return manifest.dates.filter((d) => d <= today).map((d) => [d, load(`enredo:${d}`, null)]);
}
function renderStats() {
  const live = allStates().filter(([, s]) => s?.live && s.status !== "playing");
  const wins = live.filter(([, s]) => s.status === "won");
  const won = new Set(wins.map(([d]) => d));
  let streak = 0;
  let d = won.has(today) ? today : shift(today, -1);
  while (won.has(d)) { streak++; d = shift(d, -1); }
  let max = 0, run = 0, prev = null;
  for (const [day] of wins) { run = prev && shift(prev, 1) === day ? run + 1 : 1; max = Math.max(max, run); prev = day; }

  $("s-played").textContent = live.length;
  $("s-win").textContent = live.length ? Math.round((100 * wins.length) / live.length) : 0;
  $("s-streak").textContent = streak;
  $("s-max").textContent = max;
  const dist = Array(MAX_ATTEMPTS).fill(0);
  for (const [, s] of wins) dist[s.guesses.length - 1]++;
  const top = Math.max(1, ...dist);
  // Built with DOM APIs (not innerHTML + style="") so the CSP can forbid inline styles.
  $("s-dist").replaceChildren(...dist.map((n, i) => {
    const row = document.createElement("div");
    row.className = "bar" + (!communityId && state?.status === "won" && state.guesses.length === i + 1 ? " now" : "");
    const label = document.createElement("span");
    label.textContent = i + 1;
    const fill = document.createElement("div");
    fill.textContent = n;
    fill.style.width = `${Math.max(8, (100 * n) / top)}%`;
    row.append(label, fill);
    return row;
  }));
}

function renderArchive() {
  const list = $("archive-list");
  list.innerHTML = "";
  for (const [d, s] of allStates().reverse()) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = d === today ? "./" : `?d=${d}`;
    const st = !s ? "" : s.status === "won" ? "resuelta" : s.status === "lost" ? "fallada" : "a medias";
    a.innerHTML = `<span>${longDate(d)}${d === today ? " · hoy" : ""}</span><span class="st ${s?.status === "won" ? "won" : ""}">${st}</span>`;
    li.append(a);
    list.append(li);
  }
}

// ---------- dialogs ----------
document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => {
  const id = b.dataset.open;
  if (id === "stats") renderStats();
  if (id === "archive") renderArchive();
  if (id === "community") openFeed();
  $(id).showModal();
}));
document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

initFeed();
init().then(() => { if (location.hash === "#comunidad") { openFeed(); $("community").showModal(); } }).catch((err) => {
  console.error(err);
  $("loading").textContent = "no se pudo cargar la pista";
});

// Al entrar desde otro dispositivo puede llegar progreso más avanzado de la pista abierta.
initAccount({
  synced() {
    if (!puzzle || communityId) return;
    state = load(key, null) ?? state;
    render();
  },
}).catch((err) => console.warn("cuentas no disponibles", err));
