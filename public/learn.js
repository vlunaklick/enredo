// "Aprender": short step-by-step lessons, one per wordplay type.
// Each lesson: idea + indicators -> worked example (tap to reveal) -> practice clues.

const LESSONS = [
  {
    id: "fundamentos", title: "Lo básico",
    idea: "Toda pista críptica se lee de dos maneras. Por fuera es una frase normal que despista. Por dentro esconde <b>dos caminos</b> hacia la misma respuesta: una <b>definición</b> (al principio o al final) y un <b>juego de palabras</b>. El número entre paréntesis es la longitud.",
    indicators: [],
    example: {
      clue: "Ciudad eterna con amor alocado (4)", answer: "ROMA",
      def: "Ciudad eterna", ind: "alocado",
      why: "Definición: «Ciudad eterna». «alocado» avisa de un anagrama: AMOR desordenado → ROMA. Los dos caminos llegan a lo mismo.",
    },
    practice: [],
  },
  {
    id: "oculta", title: "Palabra oculta",
    idea: "La respuesta está <b>escrita dentro de la pista</b>, repartida entre varias palabras. Ignora espacios y tildes.",
    indicators: ["en", "dentro de", "oculta en", "esconde", "guarda", "parte de"],
    example: { clue: "Extremidad oculta en la rama nostálgica (4)", answer: "MANO", def: "Extremidad", ind: "oculta en", why: "ra<b>MA NO</b>stálgica → MANO." },
    practice: [
      { clue: "Animal que se esconde en el cuadro sobrio (3)", answer: "OSO", why: "cuadr<b>O SO</b>brio → OSO." },
      { clue: "Bebida que guarda una vaca feliz (4)", answer: "CAFÉ", why: "va<b>CA FE</b>liz → CAFÉ." },
    ],
  },
  {
    id: "selector", title: "Iniciales y finales",
    idea: "Se toman <b>primeras o últimas letras</b> de varias palabras y se juntan.",
    indicators: ["al principio", "cabeza de", "primeras", "iniciales", "al final", "cola de"],
    example: { clue: "Al principio, sus ojos lloran: astro rey (3)", answer: "SOL", def: "astro rey", ind: "Al principio", why: "<b>S</b>us <b>O</b>jos <b>L</b>loran → SOL." },
    practice: [
      { clue: "Cabezas de muchos animales raros: océano (3)", answer: "MAR", why: "<b>M</b>uchos <b>A</b>nimales <b>R</b>aros → MAR." },
      { clue: "Primeras letras de un viaje alegre: fruta de la vid (3)", answer: "UVA", why: "<b>U</b>n <b>V</b>iaje <b>A</b>legre → UVA." },
    ],
  },
  {
    id: "anagrama", title: "Anagrama",
    idea: "Las letras de un trozo de la pista (el <b>material</b>) se <b>reordenan</b>. El material aparece tal cual en la pista.",
    indicators: ["revuelto", "loco", "alocado", "roto", "borracho", "mezclado", "desordenado", "extraño"],
    example: { clue: "Ciudad eterna con amor alocado (4)", answer: "ROMA", def: "Ciudad eterna", ind: "alocado", why: "AMOR → ROMA." },
    practice: [
      { clue: "Expediente judicial: saco revuelto (4)", answer: "CASO", why: "«revuelto» → SACO reordenado = CASO." },
      { clue: "Sentimiento de un ramo desordenado (4)", answer: "AMOR", why: "«desordenado» → RAMO reordenado = AMOR." },
    ],
  },
  {
    id: "inversion", title: "Al revés",
    idea: "Una palabra <b>leída de derecha a izquierda</b> da la respuesta.",
    indicators: ["al revés", "de vuelta", "vuelve", "retorna", "en el espejo"],
    example: { clue: "Ocas de vuelta en el costal (4)", answer: "SACO", def: "costal", ind: "de vuelta", why: "OCAS al revés → SACO." },
    practice: [
      { clue: "Pasión de Roma, al revés (4)", answer: "AMOR", why: "ROMA al revés → AMOR." },
      { clue: "Raposa: arroz de vuelta (5)", answer: "ZORRA", why: "ARROZ al revés → ZORRA (raposa)." },
    ],
  },
  {
    id: "charada", title: "Charada",
    idea: "La respuesta se construye <b>pegando piezas en orden</b>; cada pieza tiene su propia mini definición.",
    indicators: ["y", "con", "tras", "junto a", "después de"],
    example: { clue: "Militar: astro y cubo de juego (7)", answer: "SOLDADO", def: "Militar", ind: "y", why: "astro = SOL, cubo de juego = DADO → SOL + DADO." },
    practice: [
      { clue: "Flor: da vueltas el astro (7)", answer: "GIRASOL", why: "da vueltas = GIRA, astro = SOL → GIRA + SOL." },
      { clue: "Día de la semana: océano con infusiones (6)", answer: "MARTES", why: "océano = MAR, infusiones = TES → MAR + TES." },
    ],
  },
  {
    id: "contenedor", title: "Contenedor",
    idea: "Una pieza <b>se mete dentro</b> de otra.",
    indicators: ["en", "dentro de", "abraza", "rodea", "guarda", "contiene"],
    example: { clue: "Litro en la pata: metal precioso (5)", answer: "PLATA", def: "metal precioso", ind: "en", why: "litro = L, dentro de PATA → P(L)ATA." },
    practice: [
      { clue: "Rey dentro de la objeción: animal fiel (5)", answer: "PERRO", why: "rey = R, objeción = PERO → PE(R)RO." },
      { clue: "Degustación con el rey dentro: misiva (5)", answer: "CARTA", why: "degustación = CATA, rey = R → CA(R)TA." },
    ],
  },
  {
    id: "eliminacion", title: "Quitar letras",
    idea: "A una palabra se le <b>quita</b> la cabeza (primera letra), la cola (última), el corazón (centro) o un trozo.",
    indicators: ["descabezado", "sin cabeza", "sin fin", "casi", "sin cola", "pierde"],
    example: { clue: "Fruta de un clima descabezado (4)", answer: "LIMA", def: "Fruta", ind: "descabezado", why: "CLIMA sin la C → LIMA." },
    practice: [
      { clue: "Espíritu de una palma descabezada (4)", answer: "ALMA", why: "PALMA sin la P → ALMA." },
      { clue: "Ave de boca descabezada (3)", answer: "OCA", why: "BOCA sin la B → OCA." },
    ],
  },
  {
    id: "homofono", title: "Suena como",
    idea: "La respuesta <b>suena igual</b> que otra palabra: b/v, h muda, ll/y…",
    indicators: ["se oye", "suena", "dicen", "de oídas"],
    example: { clue: "Suena a saludo la del mar (3)", answer: "OLA", def: "la del mar", ind: "Suena a", why: "HOLA (saludo) suena como OLA." },
    practice: [
      { clue: "Se oye que tuvo una cañería (4)", answer: "TUBO", why: "TUVO suena como TUBO (cañería)." },
      { clue: "Se oye una vaca en el techo del coche (4)", answer: "BACA", why: "VACA suena como BACA (portaequipajes)." },
    ],
  },
  {
    id: "doble", title: "Doble definición",
    idea: "Dos definiciones <b>muy distintas</b> de la misma palabra, una detrás de otra. No hay indicador.",
    indicators: [],
    example: { clue: "Asiento que guarda tu dinero (5)", answer: "BANCO", def: "Asiento", ind: "", why: "Un BANCO es un asiento y también donde guardas dinero." },
    practice: [
      { clue: "Felino que levanta coches (4)", answer: "GATO", why: "GATO: el animal y la herramienta para levantar el coche." },
      { clue: "Capital de Perú para las uñas (4)", answer: "LIMA", why: "LIMA: la ciudad y la lima de uñas." },
    ],
  },
  {
    id: "abreviaturas", title: "Abreviaturas",
    idea: "Algunas palabras se convierten en <b>una o dos letras</b>: puntos cardinales (N, S, E, O), números romanos (I, V, X, L, C, M), litro (L), rey (R), notas (DO, RE, MI…), símbolos químicos (FE, NA…), artículos (un, una → A).",
    indicators: ["norte → N", "oeste → O", "cien → C", "mil → M", "cinco → V", "rey → R", "litro → L"],
    example: { clue: "Único: astro hacia el oeste (4)", answer: "SOLO", def: "Único", ind: "oeste", why: "astro = SOL, oeste = O → SOL + O." },
    practice: [
      { clue: "Hogar de cien con asa (4)", answer: "CASA", why: "cien = C + ASA → CASA." },
      { clue: "Amansar: nota musical junto al océano (5)", answer: "DOMAR", why: "nota = DO, océano = MAR → DO + MAR." },
    ],
  },
  {
    id: "combinadas", title: "Combinadas",
    idea: "Las pistas difíciles <b>mezclan recursos</b>: un anagrama más una abreviatura, una charada con una inversión… Resuélvelas por piezas.",
    indicators: [],
    example: { clue: "Regla: norte con Roma revuelta (5)", answer: "NORMA", def: "Regla", ind: "revuelta", why: "norte = N, ROMA revuelta = ORMA → N + ORMA." },
    practice: [
      { clue: "Arrecife: roca rota con un litro (5)", answer: "CORAL", why: "ROCA rota = CORA, litro = L → CORA + L." },
      { clue: "Fragancia de una capital italiana (5)", answer: "AROMA", why: "una = A, capital italiana = ROMA → A + ROMA." },
    ],
  },
];

const KEY = "enredo:learn";
const norm = (s) => s.toUpperCase().replace(/Ñ/g, "\0").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\0/g, "Ñ").replace(/[^A-ZÑ]/g, "");
const progress = () => JSON.parse(localStorage.getItem(KEY) || "{}");
const markDone = (id, i) => {
  const p = progress();
  p[id] = [...new Set([...(p[id] || []), i])];
  localStorage.setItem(KEY, JSON.stringify(p));
};
const doneCount = (l) => (l.practice.length ? (progress()[l.id] || []).length : progress()[l.id] ? 1 : 0);
const total = (l) => l.practice.length || 1;

function highlight(clue, def, ind) {
  let html = clue;
  if (def) html = html.replace(def, `<mark class="def on">${def}</mark>`);
  if (ind) {
    // Replace the indicator outside the definition mark.
    const parts = html.split(/(<mark[^>]*>.*?<\/mark>)/);
    const i = parts.findIndex((p) => !p.startsWith("<mark") && p.includes(ind));
    if (i >= 0) parts[i] = parts[i].replace(ind, `<mark class="ind on">${ind}</mark>`);
    html = parts.join("");
  }
  return html;
}

export function openLearn(dialog, lessonId) {
  const body = dialog.querySelector(".learn-body");
  if (lessonId) showLesson(body, LESSONS.find((l) => l.id === lessonId), 0);
  else showIndex(body);
  if (!dialog.open) dialog.showModal();
}

function showIndex(body) {
  body.innerHTML = `
    <h2>Aprender</h2>
    <p class="lead">Un tipo de truco por lección. Un minuto cada una.</p>
    <div class="lessons">${LESSONS.map((l) => {
      const d = doneCount(l), t = total(l);
      return `<button class="lesson ${d >= t ? "done" : ""}" data-id="${l.id}">
        <span class="li">${String(LESSONS.indexOf(l) + 1).padStart(2, "0")}</span><span class="lt">${l.title}</span><span class="lp">${d >= t ? "✓" : ""}</span>
      </button>`;
    }).join("")}</div>`;
  body.querySelectorAll(".lesson").forEach((b) =>
    b.addEventListener("click", () => showLesson(body, LESSONS.find((l) => l.id === b.dataset.id), 0)));
}

function showLesson(body, l, step) {
  const steps = 2 + l.practice.length;
  const dots = Array.from({ length: steps }, (_, i) => `<i class="${i === step ? "on" : i < step ? "past" : ""}"></i>`).join("");
  const idx = LESSONS.indexOf(l);
  const next = LESSONS[idx + 1];
  let content = "";

  if (step === 0) {
    content = `<p class="idea">${l.idea}</p>
      ${l.indicators.length ? `<p class="label">Indicadores típicos</p><div class="tags">${l.indicators.map((i) => `<span>${i}</span>`).join("")}</div>` : ""}`;
  } else if (step === 1) {
    const e = l.example;
    content = `<p class="label">Ejemplo</p>
      <p class="learn-clue" id="ex-clue">${e.clue}</p>
      <div class="reveal">
        <button data-r="def">Definición</button>
        ${e.ind ? `<button data-r="ind">Indicador</button>` : ""}
        <button data-r="sol">Solución</button>
      </div>
      <p class="why" id="ex-why"></p>`;
  } else {
    const p = l.practice[step - 2];
    const solved = (progress()[l.id] || []).includes(step - 2);
    content = `<p class="label">Practica ${step - 1}/${l.practice.length}</p>
      <p class="learn-clue">${p.clue}</p>
      <form class="try" autocomplete="off">
        <input name="a" placeholder="Tu respuesta" autocapitalize="characters" spellcheck="false" />
        <button class="go small">Comprobar</button>
      </form>
      <button class="link" data-show>Ver solución</button>
      <p class="why" id="pr-why">${solved ? `<b>${p.answer}</b> — ${p.why}` : ""}</p>`;
  }

  const last = step === steps - 1;
  body.innerHTML = `
    <div class="lesson-head"><button class="back" aria-label="Lecciones">←</button><h2>${l.title}</h2></div>
    <div class="steps">${dots}</div>
    <div class="step">${content}</div>
    <div class="nav">
      <button class="ghost" data-prev ${step === 0 ? "disabled" : ""}>Atrás</button>
      ${last
        ? next ? `<button class="go small" data-nextlesson>${next.title} →</button>` : `<button class="go small" data-index>Terminar</button>`
        : `<button class="go small" data-next>Siguiente</button>`}
    </div>`;

  body.querySelector(".back").onclick = () => showIndex(body);
  body.querySelector("[data-prev]").onclick = () => showLesson(body, l, step - 1);
  body.querySelector("[data-next]")?.addEventListener("click", () => showLesson(body, l, step + 1));
  body.querySelector("[data-nextlesson]")?.addEventListener("click", () => showLesson(body, next, 0));
  body.querySelector("[data-index]")?.addEventListener("click", () => showIndex(body));

  if (step === 1) {
    const e = l.example;
    const shown = new Set();
    if (!l.practice.length) markDone(l.id, 0);
    body.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => {
      shown.add(b.dataset.r);
      if (shown.has("sol")) body.querySelectorAll("[data-r]").forEach((x) => (x.disabled = true));
      else b.disabled = true;
      body.querySelector("#ex-clue").innerHTML = highlight(e.clue, shown.has("def") || shown.has("sol") ? e.def : "", shown.has("ind") || shown.has("sol") ? e.ind : "");
      if (shown.has("sol")) body.querySelector("#ex-why").innerHTML = `<b>${e.answer}</b> — ${e.why}`;
    }));
  }
  if (step >= 2) {
    const p = l.practice[step - 2];
    const why = body.querySelector("#pr-why");
    const form = body.querySelector(".try");
    const reveal = (ok) => {
      markDone(l.id, step - 2);
      why.innerHTML = `${ok ? "✓ " : ""}<b>${p.answer}</b> — ${p.why}`;
    };
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = norm(form.a.value);
      if (!v) return;
      if (v === norm(p.answer)) reveal(true);
      else { why.textContent = `No es ${v}. Busca la definición en un extremo.`; form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); }
    });
    body.querySelector("[data-show]").onclick = () => reveal(false);
    form.a.focus({ preventScroll: true });
  }
}
