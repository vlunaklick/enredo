// /crear: formulario para publicar una pista de la comunidad. Valida en vivo con las mismas
// reglas que `npm run add` (clue-rules.js) y guarda con supabase-js; hace falta sesión.
import { client, displayName, onUserChange, restoreSession, signIn } from "./account.js";
import { NEEDS_FODDER, NEEDS_INDICATOR, TYPES, clueSpans, encode, enumeration, letters, validateClue } from "./clue-rules.js";

const $ = (id) => document.getElementById(id);
const NAME_KEY = "enredo:autor";
const LEVELS = { 1: "fácil", 2: "media", 3: "difícil" };
const TYPE_LABELS = {
  anagrama: "Anagrama", oculta: "Palabra oculta", inversion: "Inversión", charada: "Charada", doble: "Doble definición",
  contenedor: "Contenedor", eliminacion: "Eliminación", homofono: "Homófono", combinada: "Combinada",
};
// Filtro mínimo y a propósito corto: lo serio lo frenan las denuncias. Se compara por palabras ya normalizadas.
const BLOCKED = new Set(["PUTA", "PUTO", "PUTAS", "PUTOS", "MARICON", "MARICONES", "MARICA", "BOLLERA", "ZORRA",
  "SUBNORMAL", "RETRASADO", "MONGOLO", "GILIPOLLAS", "CABRON", "HIJOPUTA", "SUDACA", "NEGRATA", "MOROMIERDA"]);
const BLOCKED_JOINED = ["HIJODEPUTA", "HIJADEPUTA"];
const ENUM_TAIL = /\s*\(\d+(,\d+)*\)\s*$/;

const field = {
  clue: $("f-clue"), answer: $("f-answer"), type: $("f-type"), definition: $("f-definition"),
  indicator: $("f-indicator"), fodder: $("f-fodder"), explanation: $("f-explanation"), name: $("f-name"),
};

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1800);
}

function offensive(...texts) {
  return texts.some((t) => {
    const words = t.split(/[\s.,;:!?¡¿«»"'()\-]+/).map(letters);
    return words.some((w) => BLOCKED.has(w)) || BLOCKED_JOINED.some((b) => letters(t).includes(b));
  });
}

// ---------- lectura del formulario ----------
function readForm() {
  const v = (k) => field[k].value.trim();
  const text = v("clue").replace(ENUM_TAIL, "");
  const answer = v("answer").toUpperCase();
  const type = field.type.value;
  const en = letters(answer) ? enumeration(answer) : "";
  return {
    text, answer, type, en,
    clue: text && en ? `${text} (${en})` : "",
    definition: v("definition"),
    indicator: type === "doble" ? null : v("indicator") || null,
    fodder: [...NEEDS_FODDER, "eliminacion"].includes(type) ? v("fodder") || null : null,
    explanation: v("explanation"),
    difficulty: Number(document.querySelector('[name="difficulty"]:checked').value),
    name: v("name"),
  };
}

// Mensajes de validateClue pensados para el JSON, reescritos para el formulario.
const FRIENDLY = [
  [/^longitud de respuesta fuera de rango$/, "La respuesta debe tener entre 3 y 12 letras."],
  [/^falta indicador$/, "Este tipo de truco necesita un indicador."],
  [/^falta el material \(fodder\)$/, "Este tipo de truco necesita el material."],
  [/^el material del anagrama\/inversión/, "El material debe aparecer tal cual en la pista."],
];
const friendly = (m) => {
  const hit = FRIENDLY.find(([re]) => re.test(m));
  const s = hit ? hit[1] : m;
  return s[0].toUpperCase() + s.slice(1) + (/[.)]$/.test(s) ? "" : ".");
};

/** { errors, warnings }: los errores bloquean el envío; los avisos solo aconsejan. */
function check(c) {
  const missing = [["text", "la pista"], ["answer", "la respuesta"], ["definition", "la definición"], ["explanation", "la explicación"], ["name", "tu nombre"]]
    .filter(([k]) => !c[k]).map(([, label]) => label);
  const errors = [], warnings = [];
  if (missing.length) errors.push(`Falta ${missing.join(", ")}.`);
  // La explicación se comprueba aparte: así los fallos mecánicos salen mientras se escribe.
  if (c.clue && c.answer && c.definition)
    errors.push(...validateClue({ ...c, explanation: c.explanation || "-" }).map(friendly));
  if (c.clue.length > 200) errors.push("La pista es demasiado larga (máximo 200 caracteres con la enumeración).");
  if (c.explanation && c.explanation.length < 15) errors.push("La explicación es muy corta: cuenta la definición y el truco.");
  if (offensive(c.clue, c.answer, c.name, c.explanation)) errors.push("Hay palabras ofensivas. Reescríbelo, por favor.");
  if (c.definition && c.text.includes(c.definition)) {
    const bare = c.text.replace(/[\s.,;:!?…]+$/, "");
    if (!bare.startsWith(c.definition) && !bare.endsWith(c.definition))
      warnings.push("Consejo: la definición suele ir al principio o al final de la pista.");
  }
  return { errors, warnings };
}

// ---------- pintado en vivo ----------
function paintPreview(c) {
  $("p-meta").textContent = `comunidad · por ${c.name || "…"}`;
  const lvl = $("p-level");
  lvl.textContent = `${LEVELS[c.difficulty]} `;
  for (let n = 1; n <= 3; n++) {
    const i = document.createElement("i");
    if (n <= c.difficulty) i.className = "on";
    lvl.append(i);
  }
  const el = $("p-clue");
  el.textContent = "";
  el.classList.toggle("empty", !c.text);
  if (!c.text) { el.textContent = "Tu pista aparecerá aquí"; return; }
  let pos = 0;
  for (const s of clueSpans(c.text, c.definition, c.indicator)) {
    el.append(c.text.slice(pos, s.start));
    const mk = document.createElement("mark");
    mk.className = `${s.cls} on`;
    mk.textContent = c.text.slice(s.start, s.end);
    el.append(mk);
    pos = s.end;
  }
  el.append(c.text.slice(pos), " ");
  const en = document.createElement("span");
  en.className = "enum";
  en.textContent = `(${c.en || "?"})`;
  el.append(en);
}

let touched = false;
function update() {
  const c = readForm();
  const needsInd = NEEDS_INDICATOR.includes(c.type);
  const showFodder = [...NEEDS_FODDER, "eliminacion"].includes(c.type);
  $("indicator-field").hidden = c.type === "doble";
  $("indicator-req").textContent = needsInd ? "(obligatorio)" : "(si hay)";
  $("fodder-field").hidden = !showFodder;
  $("fodder-req").textContent = NEEDS_FODDER.includes(c.type) ? "(obligatorio)" : "(opcional)";
  $("type-help").textContent = TYPES[c.type];
  $("enum").textContent = c.en ? `(${c.en})` : "";
  paintPreview(c);

  const { errors, warnings } = check(c);
  $("problems").replaceChildren(...(touched ? [...errors, ...warnings] : []).map((m, i) => {
    const li = document.createElement("li");
    li.textContent = m;
    if (i >= errors.length) li.className = "warn";
    return li;
  }));
  $("submit").disabled = errors.length > 0;
  return { c, errors };
}

// ---------- envío ----------
async function submit(e) {
  e.preventDefault();
  touched = true;
  const { c, errors } = update();
  if (errors.length) return;
  const btn = $("submit");
  btn.disabled = true;
  btn.textContent = "Publicando…";
  $("form-error").textContent = "";
  try {
    const sb = await client();
    const secret = encode({ answer: c.answer, definition: c.definition, indicator: c.indicator, fodder: c.fodder, explanation: c.explanation }, "comunidad");
    const { data, error } = await sb.from("community_puzzles")
      .insert({ author_name: c.name, clue: c.clue, enumeration: c.en, type: c.type, difficulty: c.difficulty, secret })
      .select("id").single();
    if (error) throw error;
    localStorage.setItem(NAME_KEY, c.name);
    showDone(data.id);
  } catch (err) {
    console.error(err);
    $("form-error").textContent = /rate_limit/.test(err?.message ?? "")
      ? "Has creado 5 pistas hoy, que es el máximo. Vuelve mañana para publicar más."
      : "No se pudo publicar. Revisa tu conexión y prueba otra vez.";
  } finally {
    btn.textContent = "Publicar pista";
    update();
  }
}

function showDone(id) {
  const url = `${location.origin}/?c=${id}`;
  const link = $("done-link");
  link.href = url;
  link.textContent = url;
  $("form").hidden = true;
  $("done").hidden = false;
  $("share-native").hidden = !navigator.share;
  $("done").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("done-link").href); toast("enlace copiado"); }
  catch { toast("no se pudo copiar"); }
});
$("share-native").addEventListener("click", async () => {
  try { await navigator.share({ text: "Te reto a resolver mi pista en enredo", url: $("done-link").href }); } catch { /* cancelada */ }
});
$("again").addEventListener("click", () => {
  for (const k of ["clue", "answer", "definition", "indicator", "fodder", "explanation"]) field[k].value = "";
  touched = false;
  $("done").hidden = true;
  $("form").hidden = false;
  update();
  field.clue.focus();
});

// ---------- arranque ----------
field.type.append(...Object.keys(TYPES).map((t) => new Option(TYPE_LABELS[t], t)));
$("form").addEventListener("input", () => { touched = true; update(); });
$("form").addEventListener("submit", submit);
$("google").addEventListener("click", async () => {
  $("google").disabled = true;
  try { await signIn(); } catch (err) {
    console.error(err);
    $("google").disabled = false;
    $("gate-error").textContent = "No se pudo conectar con Google. Prueba otra vez.";
  }
});

function paint(user) {
  $("booting").hidden = true;
  $("gate").hidden = !!user;
  $("form").hidden = !user || !$("done").hidden;
  if (user && !field.name.value) field.name.value = (localStorage.getItem(NAME_KEY) || displayName(user)).slice(0, 40);
  update();
}
onUserChange(paint);
restoreSession().then(paint, (err) => {
  console.error(err);
  $("booting").textContent = "No se pudo cargar. Recarga la página.";
});
