# enredo: guía para agentes (cualquier LLM)

Juego web de una pista críptica en español al día. Web estática en `public/`, pistas en `public/puzzles/AAAA-MM-DD.json`.

## Crear pistas nuevas

- **Instrucciones completas:** `prompts/pista-criptica.md`. Es la única fuente de verdad: la usa el generador automático y sirve para pegarla en cualquier chat (ChatGPT, Gemini, Claude…).
- **Flujo en Claude Code:** la skill `.claude/skills/nueva-pista/SKILL.md`.
- **Validar y publicar lo que devuelva cualquier LLM:** guarda su JSON en un archivo y ejecuta `npm run add -- archivo.json` (acepta la salida aunque venga envuelta en ```json o con texto alrededor).

## Comandos

| | |
|---|---|
| `npm run dev` | Sirve la web en http://localhost:5173 |
| `npm run add -- f.json [--date AAAA-MM-DD] [--dry]` | Valida y publica pistas |
| `npm run check` | Revisa todas las pistas publicadas |
| `npm run generate` | Rellena 14 días con Claude (necesita `ANTHROPIC_API_KEY`) |

No edites `manifest.json` a mano: se regenera a partir de los archivos.
