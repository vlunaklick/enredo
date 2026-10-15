# enredo

Una pista críptica en español al día. Código abierto (MIT).

## Cómo funciona

```
Alguien escribe una tanda de pistas (a mano o con cualquier LLM)
  └─ npm run add -- tandas/tanda-NN.json   valida y asigna los próximos días libres
  └─ commit + push a main
       ├─ GitHub Actions: npm run check (valida todas las pistas)
       └─ Vercel despliega la web
GitHub Actions, cada día: si quedan menos de 7 días de pistas, abre un issue de aviso.
```

- Web estática (`public/`), sin build ni dependencias de npm. Se puede jugar sin cuenta:
  racha, estadísticas y progreso viven en el `localStorage` del jugador.
- Cuentas opcionales con Google (Supabase) para sincronizar el progreso y crear pistas de la comunidad.
- Si un día falta la pista, la web muestra la última disponible.

## Escribir pistas nuevas

1. **Instrucciones:** `prompts/pista-criptica.md` (tipos, indicadores, abreviaturas, dificultad, formato JSON y autocomprobación). Pégalo en cualquier LLM (ChatGPT, Gemini, Claude…) o síguelo a mano.
2. **Guarda el resultado** en `tandas/tanda-NN.json` (un objeto o una lista).
3. **Verifica a ciegas:** pasa solo las pistas, sin respuestas, a otra persona o a otro chat, y que las resuelva. Descarta las que no salgan o tengan dos respuestas posibles.
4. `npm run add -- tandas/tanda-NN.json --dry` para validar, y sin `--dry` para publicar. `--date AAAA-MM-DD` fija el primer día.
5. `npm run check`, commit y push.

En Claude Code, la skill `.claude/skills/nueva-pista/` hace todo el flujo, incluida la verificación a ciegas con un subagente.
`AGENTS.md` es el punto de entrada para Codex, Cursor y otros agentes.

## Comunidad

Cualquiera con cuenta puede escribir pistas en `/crear` (`public/crear.html`). Se validan en el navegador con las
mismas reglas que `npm run add` (`public/clue-rules.js`, compartido con `scripts/lib.mjs`) y se guardan en Supabase
(tabla `community_puzzles`, migraciones en `supabase/migrations/`).

- Se juegan en `/?c=<id>` con la misma interfaz; no cuentan para la racha ni el archivo y el progreso es solo local.
- La hoja «Comunidad» lista recientes, mejores (por «Me gusta») y las tuyas, que puedes borrar.
- Moderación: máximo 5 pistas por persona y día, filtro básico de palabras y ocultación automática a las 3 denuncias.
- Las mejores pueden pasar a ser la pista del día: `npm run destacadas` vuelca las más votadas a `tandas/comunidad-AAAA-MM-DD.json`
  (con su autor, que la web muestra como «por …»); revísalas y publícalas con `npm run add`.
- Para probar contra un Supabase local: `localStorage.setItem("enredo:sb", JSON.stringify({ url, key }))` en la consola (ver `public/account.js`).

## Dificultad

Cada pista lleva `difficulty` 1 (fácil), 2 (media) o 3 (difícil); la web lo muestra con tres barras.
Si una pista no la indica, se asigna por día de la semana: lunes y martes fáciles, miércoles y jueves medias, viernes y sábado difíciles, domingo media.
Para tandas con dificultad variada funciona bien una ola: 1, 2, 3, 2, 1, 2, 3… (`tandas/tanda-01.json`).

Ojo al verificar con un LLM: un solucionador experto puntúa la dificultad 1-2 niveles por debajo de lo que notaría una persona. Úsalo para ordenar, no como valor absoluto.

## Desplegar tu propia copia (fork)

1. Haz fork y cambia `vlunaklick/enredo` por tu repo en `.github/workflows/daily.yml` (condición `if:` del job `remind`).
2. En Vercel: **Add New → Project → importa el repo**. `vercel.json` ya define la carpeta `public/` y las cabeceras de seguridad.

## Seguridad

Ver [SECURITY.md](SECURITY.md). Resumen: sitio estático con Supabase como único backend (protegido con RLS), sin secretos en el repo, CSP estricta.

## Local

```bash
npm run dev      # sirve public/ en http://localhost:5173
npm run check    # valida todas las pistas y dice hasta qué día hay
```

## Ajustes

| Qué | Dónde |
|---|---|
| Nombre del juego | `public/index.html`, `public/app.js` (`enredo`) |
| Fecha del día #1 | `EPOCH` en `scripts/lib.mjs` |
| Curva semanal de dificultad | `WEEK_CURVE` en `scripts/lib.mjs` |
| Aviso de pocas pistas | `< 7` en `.github/workflows/daily.yml` |
| Corregir o quitar una pista | edita o borra `public/puzzles/AAAA-MM-DD.json`; `npm run check` avisa si algo queda mal |
