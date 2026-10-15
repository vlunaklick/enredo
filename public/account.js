// Cuentas opcionales (Supabase + Google). Sin cuenta todo sigue igual: el progreso vive en
// localStorage. Con sesión, cada partida se copia también a la tabla `plays`.
// La sesión (client, restoreSession, signIn…) sirve a cualquier página; initAccount pinta la
// hoja «Tu cuenta» de index.html.

// Escape para desarrollo: apunta la web a otro Supabase (p. ej. el local de `supabase start`) con
//   localStorage.setItem("enredo:sb", JSON.stringify({ url: "http://127.0.0.1:54321", key: "<anon key>" }))
// y bórralo con localStorage.removeItem("enredo:sb"). Solo se respeta en localhost/127.0.0.1; en producción se usan los de abajo.
const DEV = !["localhost", "127.0.0.1"].includes(location.hostname) ? null : (() => { try { return JSON.parse(localStorage.getItem("enredo:sb")); } catch { return null; } })();
export const SB_URL = DEV?.url || "https://dcoftqtmtajcxsvwtukg.supabase.co";
// Clave pública por diseño: lo que protege los datos son las políticas RLS de la base.
export const SB_KEY = DEV?.key || "sb_publishable_Qs8w0eebpbYypO6eb4JITw_M47SxF8p";
// Donde supabase-js guarda la sesión: sb-<primer trozo del host>-auth-token.
const SESSION_KEY = `sb-${new URL(SB_URL).hostname.split(".")[0]}-auth-token`;
const PLAY_KEY = /^enredo:(\d{4}-\d{2}-\d{2})$/;
const COLUMNS = "puzzle_date,status,guesses,hints,revealed,live,updated_at";
// Las pistas cambiaron de fecha: todo progreso anterior a esto pertenece a otra pista y se descarta.
const RESET_AT = "2026-10-15T19:30:00Z";
const RESET_KEY = "enredo:reset";

if (localStorage.getItem(RESET_KEY) !== RESET_AT) {
  const stale = [];
  for (let i = 0; i < localStorage.length; i++) if (PLAY_KEY.test(localStorage.key(i))) stale.push(localStorage.key(i));
  stale.forEach((k) => localStorage.removeItem(k));
  localStorage.setItem(RESET_KEY, RESET_AT);
}

const $ = (id) => document.getElementById(id);
let clientPromise, sessionPromise, user = null, onSynced = null;
const listeners = new Set();

// supabase-js pesa ~200 KB: solo se descarga si hay sesión o si alguien quiere entrar.
export function client() {
  clientPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "vendor/supabase-2.118.0.js";
    s.onload = () => resolve(window.supabase.createClient(SB_URL, SB_KEY, { auth: { flowType: "pkce" } }));
    s.onerror = () => { clientPromise = null; reject(new Error("no se pudo cargar supabase-js")); };
    document.head.append(s);
  });
  return clientPromise;
}

export const currentUser = () => user;
/** Avisa cada vez que se entra o se sale (y una vez al restaurar la sesión). */
export const onUserChange = (fn) => listeners.add(fn);
export const displayName = (u = user) => u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email || "";

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
  const remote = new Map(data.filter((r) => new Date(r.updated_at) >= new Date(RESET_AT)).map((r) => [r.puzzle_date, fromRow(r)]));
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
  if (changed) onSynced?.();
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

// ---------- sesión ----------
/** Recupera la sesión (o termina el login de Google al volver). Devuelve el usuario o null. */
export function restoreSession() {
  sessionPromise ??= (async () => {
    const params = new URLSearchParams(location.search);
    const returning = params.has("code") || params.has("error");
    if (!returning && !localStorage.getItem(SESSION_KEY)) return null;

    const sb = await client();
    sb.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      if (next?.id === user?.id) return;
      user = next;
      listeners.forEach((fn) => fn(user));
      // Fuera del callback: supabase-js no admite llamadas a la base dentro de onAuthStateChange.
      if (user && onSynced) setTimeout(() => syncAll().catch((err) => console.warn("sincronización fallida", err)));
    });
    await sb.auth.getSession();
    if (returning) {
      if (params.has("error")) console.warn("login con Google cancelado o fallido:", params.get("error_description"));
      for (const k of ["code", "error", "error_code", "error_description"]) params.delete(k);
      const qs = params.toString();
      history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
    }
    return user;
  })();
  return sessionPromise;
}

/** Redirige a Google; al volver, restoreSession() completa el login en la misma URL. */
export async function signIn() {
  const sb = await client();
  const back = new URL(location.href);
  back.hash = "";
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back.href } });
  if (error) throw error;
}

// ---------- UI (hoja «Tu cuenta» de index.html) ----------
function paint() {
  $("account-out").hidden = !!user;
  $("account-in").hidden = !user;
  $("account-name").textContent = displayName();
  document.querySelector('[data-open="account"]').classList.toggle("signed", !!user);
}

async function signInClick() {
  const btn = $("google");
  btn.disabled = true;
  try {
    await signIn();
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

async function deleteAccount() {
  if (!confirm("¿Borrar tu cuenta? Se elimina tu progreso guardado en la nube y las pistas que hayas creado. El progreso de este dispositivo se queda.")) return;
  const sb = await client();
  const { error } = await sb.rpc("delete_account");
  if (error) {
    console.error(error);
    $("account-error").textContent = "No se pudo borrar la cuenta. Prueba otra vez.";
    return;
  }
  await sb.auth.signOut({ scope: "local" });
}

export async function initAccount({ synced }) {
  onSynced = synced;
  $("google").addEventListener("click", signInClick);
  $("signout").addEventListener("click", signOut);
  $("delete-account").addEventListener("click", deleteAccount);
  onUserChange(paint);
  paint();
  await restoreSession();
}
