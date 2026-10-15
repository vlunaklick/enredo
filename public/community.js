// Pistas de la comunidad dentro del juego: lectura anónima por PostgREST (sin supabase-js),
// la hoja «Comunidad» (recientes, mejores, mis pistas) y las reacciones/denuncias tras jugar.
import { SB_URL, SB_KEY, client, currentUser, onUserChange } from "./account.js";

const $ = (id) => document.getElementById(id);
const FEED_COLS = "id,author_name,clue,enumeration,type,difficulty,likes,hard,unclear,created_at";
const ID_RE = /^[0-9a-z]{4,32}$/i;
export const stateKey = (id) => `enredo:c:${id}`;

async function rest(query) {
  const r = await fetch(`${SB_URL}/rest/v1/community_puzzles?${query}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    cache: "no-cache",
  });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

/** La pista publicada con ese id, o null si no existe o está oculta. */
export async function fetchPuzzle(id) {
  if (!ID_RE.test(id)) return null;
  const rows = await rest(`select=${FEED_COLS},secret&status=eq.published&id=eq.${encodeURIComponent(id)}`);
  return rows[0] ?? null;
}

const localStatus = (id) => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(stateKey(id))); } catch { /* nada */ }
  return !s ? null : s.status === "won" ? "resuelta" : s.status === "lost" ? "fallada" : "a medias";
};

function levelBars(n) {
  const el = document.createElement("span");
  el.className = "level";
  el.setAttribute("aria-label", `dificultad ${n} de 3`);
  for (let i = 1; i <= 3; i++) {
    const b = document.createElement("i");
    if (i <= n) b.className = "on";
    el.append(b);
  }
  return el;
}

// ---------- hoja «Comunidad» ----------
let tab = "recent", ticket = 0;

function feedItem(p, mine) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = `?c=${encodeURIComponent(p.id)}`;
  const clue = document.createElement("span");
  clue.className = "feed-clue";
  clue.textContent = p.clue;
  const meta = document.createElement("span");
  meta.className = "feed-meta";
  const by = document.createElement("span");
  by.textContent = mine ? new Date(p.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : `por ${p.author_name}`;
  const likes = document.createElement("span");
  likes.textContent = `👍 ${p.likes}`;
  meta.append(by, levelBars(p.difficulty), likes);
  if (mine && p.status === "hidden") {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "oculta por denuncias";
    meta.append(tag);
  }
  const st = localStatus(p.id);
  if (st) {
    const s = document.createElement("span");
    s.className = "st" + (st === "resuelta" ? " won" : "");
    s.textContent = st;
    meta.append(s);
  }
  a.append(clue, meta);
  li.append(a);
  if (mine) {
    const del = document.createElement("button");
    del.className = "link danger";
    del.textContent = "Borrar";
    del.setAttribute("aria-label", `Borrar «${p.clue}»`);
    del.addEventListener("click", () => removeMine(p));
    li.append(del);
  }
  return li;
}

async function loadTab() {
  const mine = tab === "mine";
  const list = $("feed-list"), note = $("feed-note");
  const me = ++ticket;
  list.replaceChildren();
  note.textContent = "cargando…";
  try {
    let rows;
    if (mine) {
      const sb = await client();
      const { data, error } = await sb.rpc("my_community_puzzles").limit(30);
      if (error) throw error;
      rows = data;
    } else {
      const order = tab === "top" ? "likes.desc,created_at.desc" : "created_at.desc";
      rows = await rest(`select=${FEED_COLS}&status=eq.published&order=${order}&limit=30`);
    }
    if (me !== ticket) return;
    list.replaceChildren(...rows.map((p) => feedItem(p, mine)));
    note.textContent = rows.length ? "" : mine ? "Todavía no has creado ninguna pista." : "Todavía no hay pistas. ¡Estrena tú la comunidad!";
  } catch (err) {
    console.error(err);
    if (me === ticket) note.textContent = "No se pudieron cargar las pistas. Prueba otra vez.";
  }
}

async function removeMine(p) {
  if (!confirm(`¿Borrar «${p.clue}»? Desaparece para todo el mundo.`)) return;
  const sb = await client();
  const { error } = await sb.from("community_puzzles").delete().eq("id", p.id);
  if (error) { console.error(error); alert("No se pudo borrar. Prueba otra vez."); return; }
  loadTab();
}

function selectTab(next) {
  tab = next;
  document.querySelectorAll("#community [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  loadTab();
}

/** Se llama cada vez que se abre la hoja. */
export function openFeed() {
  if (tab === "mine" && !currentUser()) tab = "recent";
  selectTab(tab);
}

export function initFeed() {
  document.querySelectorAll("#community [data-tab]").forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
  const paintMine = (u) => {
    $("tab-mine").hidden = !u;
    if (!u && tab === "mine" && $("community").open) selectTab("recent");
  };
  onUserChange(paintMine);
  paintMine(currentUser());
}

// ---------- reacciones y denuncia (tras terminar una pista de la comunidad) ----------
const REACTIONS = ["like", "hard", "unclear"];
let puzzle, mine = null, toast = () => {};

function paintReactions() {
  document.querySelectorAll("#reactions [data-reaction]").forEach((b) => {
    const r = b.dataset.reaction;
    b.setAttribute("aria-pressed", String(mine === r));
    if (r === "like") b.querySelector("small").textContent = puzzle.likes || "";
  });
}

function needAccount(msg) {
  if (currentUser()) return false;
  toast(msg);
  $("account").showModal();
  return true;
}

async function react(r) {
  if (needAccount("entra para reaccionar")) return;
  const prev = mine;
  const next = prev === r ? null : r;
  // Optimista: se pinta ya y se deshace si la base dice que no.
  const bump = (k, n) => { if (k === "like") puzzle.likes = Math.max(0, puzzle.likes + n); };
  bump(prev, -1); bump(next, 1); mine = next; paintReactions();
  try {
    const sb = await client();
    const { error } = next
      ? await sb.from("community_reactions").upsert({ puzzle_id: puzzle.id, reaction: next })
      : await sb.from("community_reactions").delete().eq("puzzle_id", puzzle.id).eq("user_id", currentUser().id);
    if (error) throw error;
  } catch (err) {
    console.error(err);
    bump(next, -1); bump(prev, 1); mine = prev; paintReactions();
    toast("no se pudo guardar");
  }
}

async function report() {
  if (needAccount("entra para denunciar")) return;
  const reason = prompt("¿Qué problema tiene esta pista? (opcional)\nOfensiva, spam, no tiene solución…");
  if (reason === null) return;
  try {
    const sb = await client();
    const { error } = await sb.from("community_reports").insert({ puzzle_id: puzzle.id, reason: reason.trim().slice(0, 200) || null });
    if (error && error.code !== "23505") throw error;
    toast(error ? "ya la habías denunciado" : "denuncia enviada, gracias");
  } catch (err) {
    console.error(err);
    toast("no se pudo enviar la denuncia");
  }
}

async function loadMine() {
  mine = null;
  if (currentUser()) {
    try {
      const sb = await client();
      const { data, error } = await sb.from("community_reactions").select("reaction").eq("puzzle_id", puzzle.id).maybeSingle();
      if (error) throw error;
      mine = REACTIONS.includes(data?.reaction) ? data.reaction : null;
    } catch (err) { console.warn("no se pudo leer tu reacción", err); }
  }
  paintReactions();
}

export function initReactions(p, { notify }) {
  puzzle = p;
  toast = notify;
  $("reactions").hidden = false;
  $("report").hidden = false;
  document.querySelectorAll("#reactions [data-reaction]").forEach((b) => b.addEventListener("click", () => react(b.dataset.reaction)));
  $("report").addEventListener("click", report);
  onUserChange(loadMine);
  loadMine();
}
