// Cuentas opcionales (Supabase + Google). Sin cuenta todo sigue igual: el progreso vive en
// localStorage. Con sesión, cada partida se copia también a la tabla `plays`.
const SB_URL = "https://dcoftqtmtajcxsvwtukg.supabase.co";
// Clave pública por diseño: lo que protege los datos son las políticas RLS de la base.
const SB_KEY = "sb_publishable_Qs8w0eebpbYypO6eb4JITw_M47SxF8p";
const SESSION_KEY = "sb-dcoftqtmtajcxsvwtukg-auth-token";
const PLAY_KEY = /^enredo:(\d{4}-\d{2}-\d{2})$/;
const COLUMNS = "puzzle_date,status,guesses,hints,revealed,live";

const $ = (id) => document.getElementById(id);
let clientPromise, user = null, onSynced = () => {};

// supabase-js pesa ~200 KB: solo se descarga si hay sesión o si alguien quiere entrar.
function client() {
  clientPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "vendor/supabase-2.118.0.js";
    s.onload = () => resolve(window.supabase.createClient(SB_URL, SB_KEY, { auth: { flowType: "pkce" } }));
    s.onerror = () => { clientPromise = null; reject(new Error("no se pudo cargar supabase-js")); };
    document.head.append(s);
  });
  return clientPromise;
}

// ---------- local <-> remoto ----------
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const toRow = (date, s) => ({ puzzle_date: date, status: s.status, guesses: s.guesses, hints: s.hints, revealed: s.revealed, live: !!s.live });
const fromRow = (r) => ({ guesses: r.guesses, hints: r.hints, revealed: r.revealed, status: r.status, live: r.live });
// Gana la partida más avanzada: terminada > a medias, y luego la que tiene más intentos y ayudas.
const progress = (s) => (s.status === "playing" ? 0 : 1000) + 10 * s.guesses.length + s.hints.length + s.revealed.length;

function merge(local, remote) {
  if (!local || !remote) return local ?? remote;
  const best = progress(remote) > progress(local) ? remote : local;
  return { ...best, live: !!(local.live || remote.live) };
}

async function syncAll() {
  const sb = await client();
  const { data, error } = await sb.from("plays").select(COLUMNS);
  if (error) throw error;
  const remote = new Map(data.map((r) => [r.puzzle_date, fromRow(r)]));
  const dates = new Set(remote.keys());
  for (let i = 0; i < localStorage.length; i++) {
    const m = localStorage.key(i).match(PLAY_KEY);
    if (m) dates.add(m[1]);
  }
  const upload = [];
  let changed = false;
  for (const d of dates) {
    const local = read(`enredo:${d}`), rem = remote.get(d);
    const best = merge(local, rem);
    const same = (s) => s && JSON.stringify(toRow(d, s)) === JSON.stringify(toRow(d, best));
    if (!same(local)) { localStorage.setItem(`enredo:${d}`, JSON.stringify(best)); changed = true; }
    if (!same(rem)) upload.push(toRow(d, best));
  }
  if (upload.length) {
    const { error: e } = await sb.from("plays").upsert(upload);
    if (e) throw e;
  }
  if (changed) onSynced();
}

export async function pushPlay(date, state) {
  if (!user) return;
  try {
    const sb = await client();
    const { error } = await sb.from("plays").upsert(toRow(date, state));
    if (error) throw error;
  } catch (err) {
    console.warn("no se pudo guardar en la nube", err);
  }
}

// ---------- UI ----------
function paint() {
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "";
  $("account-out").hidden = !!user;
  $("account-in").hidden = !user;
  $("account-name").textContent = name;
  document.querySelector('[data-open="account"]').classList.toggle("signed", !!user);
}

async function signIn() {
  const btn = $("google");
  btn.disabled = true;
  try {
    const sb = await client();
    const back = new URL(location.href);
    back.hash = "";
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back.href } });
    if (error) throw error;
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    $("account-error").textContent = "No se pudo conectar con Google. Prueba otra vez.";
  }
}

async function signOut() {
  const sb = await client();
  await sb.auth.signOut();
  // El progreso local se queda en este dispositivo.
}

export async function initAccount({ synced }) {
  onSynced = synced;
  $("google").addEventListener("click", signIn);
  $("signout").addEventListener("click", signOut);
  paint();

  const params = new URLSearchParams(location.search);
  const returning = params.has("code") || params.has("error");
  if (!returning && !localStorage.getItem(SESSION_KEY)) return;

  const sb = await client();
  sb.auth.onAuthStateChange((_event, session) => {
    const next = session?.user ?? null;
    if (next?.id === user?.id) return;
    user = next;
    paint();
    // Fuera del callback: supabase-js no admite llamadas a la base dentro de onAuthStateChange.
    if (user) setTimeout(() => syncAll().catch((err) => console.warn("sincronización fallida", err)));
  });
  await sb.auth.getSession();
  if (returning) {
    if (params.has("error")) console.warn("login con Google cancelado o fallido:", params.get("error_description"));
    for (const k of ["code", "error", "error_code", "error_description"]) params.delete(k);
    const qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
  }
}
