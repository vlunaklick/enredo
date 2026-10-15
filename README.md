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

- Web 100 % estática (`public/`): sin servidor, sin base de datos, sin cuentas, sin dependencias.
  Racha, estadísticas y progreso viven en el `localStorage` del jugador.
- Si un día falta la pista, la web muestra la última disponible.

## Escribir pistas nuevas

1. **Instrucciones:** `prompts/pista-criptica.md` (tipos, indicadores, abreviaturas, dificultad, formato JSON y autocomprobación). Pégalo en cualquier LLM (ChatGPT, Gemini, Claude…) o síguelo a mano.
2. **Guarda el resultado** en `tandas/tanda-NN.json` (un objeto o una lista).
3. **Verifica a ciegas:** pasa solo las pistas, sin respuestas, a otra persona o a otro chat, y que las resuelva. Descarta las que no salgan o tengan dos respuestas posibles.
4. `npm run add -- tandas/tanda-NN.json --dry` para validar, y sin `--dry` para publicar. `--date AAAA-MM-DD` fija el primer día.
5. `npm run check`, commit y push.

En Claude Code, la skill `.claude/skills/nueva-pista/` hace todo el flujo, incluida la verificación a ciegas con un subagente.
`AGENTS.md` es el punto de entrada para Codex, Cursor y otros agentes.

## Dificultad

Cada pista lleva `difficulty` 1 (fácil), 2 (media) o 3 (difícil); la web lo muestra con tres barras.
Si una pista no la indica, se asigna por día de la semana: lunes fácil, martes a jueves y domingo medias, viernes y sábado difíciles.
Las respuestas tienen al menos 6 letras (`npm run add` rechaza las más cortas). Para una tanda, reparte con peso hacia arriba: mitad 3, el resto casi todo 2 (`tandas/tanda-03.json`).

Ojo al verificar con un LLM: un solucionador experto puntúa la dificultad 1-2 niveles por debajo de lo que notaría una persona. Úsalo para ordenar, no como valor absoluto.

## Desplegar tu propia copia (fork)

1. Haz fork y cambia `vlunaklick/enredo` por tu repo en `.github/workflows/daily.yml` (condición `if:` del job `remind`).
2. En Vercel: **Add New → Project → importa el repo**. `vercel.json` ya define la carpeta `public/` y las cabeceras de seguridad.

## Seguridad

Ver [SECURITY.md](SECURITY.md). Resumen: sitio estático, sin backend, sin secretos ni datos personales, CSP estricta.

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
