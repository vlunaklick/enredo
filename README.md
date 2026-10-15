# enredo

Una pista críptica en español al día, publicada sin intervención humana. Código abierto (MIT).

## Cómo funciona

```
GitHub Actions (cada noche, 21:30 UTC)
  └─ scripts/generate.mjs
       1. Claude escribe 5 pistas candidatas del tipo del día
       2. Comprobación mecánica: anagrama, palabra oculta, inversión, enumeración,
          definición/indicador literales en la pista, respuesta no repetida
       3. Otra llamada a Claude resuelve la pista a ciegas y puntúa justicia y naturalidad
       4. Solo se publica si el solucionador acierta con justicia ≥4 y naturalidad ≥3
  └─ commit de public/puzzles/*.json en main
Vercel (integración con Git) despliega cada commit de main
```

- Mantiene **14 días de colchón** por delante: si la API falla unos días, el juego sigue.
- Si aun así falta la pista de hoy, la web muestra la última disponible.
- Web 100 % estática (`public/`): sin servidor, sin base de datos, sin cuentas.
  Racha, estadísticas y progreso viven en `localStorage`.

## Dificultad

Cada pista lleva `difficulty` 1 (fácil), 2 (media) o 3 (difícil); la web lo muestra con tres barras.
El generador sigue una curva semanal: lunes y martes fáciles, miércoles y jueves medias, viernes y sábado difíciles, domingo media.
El solucionador ciego también puntúa la dificultad y se guarda la suya. Un LLM experto la infravalora 1-2 niveles, así que solo se exige que no se aleje más de 1 de la pedida.

## Escribir pistas con cualquier LLM

- `prompts/pista-criptica.md`: instrucciones completas (tipos, indicadores, abreviaturas, dificultad, formato JSON, autocomprobación). Pégalo en ChatGPT, Gemini, Claude… El generador usa este mismo archivo.
- `npm run add -- archivo.json`: valida y publica lo que devuelva el LLM (acepta ```json y texto alrededor). `--dry` solo valida; `--date` fija el primer día.
- `.claude/skills/nueva-pista/`: el flujo completo en Claude Code, con verificación a ciegas por un subagente.
- `AGENTS.md`: punto de entrada para Codex, Cursor y otros agentes.
- `tandas/`: tandas escritas a mano. `tanda-01.json` son 10 pistas en ola de dificultad (1,2,3,2,1,2,3,1,2,3).

## Despliegue en tu propia cuenta (fork)

1. Haz fork del repo y cambia `vlunaklick/enredo` por tu repo en `.github/workflows/daily.yml` (condición `if:` del job `generate`).
2. **Settings → Environments → New environment `generator`**. Restringe *Deployment branches* a `main` y añade el secret `ANTHROPIC_API_KEY`.
3. En Vercel: **Add New → Project → importa el repo**. No hace falta configurar nada: `vercel.json` define la carpeta `public/` y las cabeceras.
4. **Actions → Pistas diarias → Run workflow** para generar el colchón de pistas.

## Seguridad

Ver [SECURITY.md](SECURITY.md). Resumen: sitio estático, sin backend ni datos personales, CSP estricta, un único secreto aislado en un entorno de Actions.

## Local

```bash
npm install
npm run dev                                   # sirve public/ en http://localhost:5173
ANTHROPIC_API_KEY=... npm run generate -- --days 3
npm run check                                 # valida todas las pistas publicadas
```

## Ajustes

| Qué | Dónde |
|---|---|
| Nombre del juego | `public/index.html`, `public/app.js` (`enredo`) |
| Fecha del día #1 | `EPOCH` en `scripts/lib.mjs` |
| Días de colchón | `BUFFER_DAYS` en `scripts/generate.mjs` |
| Tipos que rotan | `ROTATION` en `scripts/generate.mjs` |
| Exigencia del control de calidad | `fairness >= 4 && surface >= 3` en `scripts/generate.mjs` |
| Corregir o sustituir una pista | edita `public/puzzles/AAAA-MM-DD.json` o bórralo y vuelve a lanzar el workflow (el `manifest.json` se regenera solo) |
