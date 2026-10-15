# enredo: guía para agentes (cualquier LLM)

Juego web de una pista críptica en español al día. Web estática en `public/`, pistas en `public/puzzles/AAAA-MM-DD.json`.

## Crear pistas nuevas

- **Instrucciones completas:** `prompts/pista-criptica.md`. Es la única fuente de verdad: sirve para pegarla en cualquier chat (ChatGPT, Gemini, Claude…) o seguirla a mano.
- **Flujo en Claude Code:** la skill `.claude/skills/nueva-pista/SKILL.md`.
- **Validar y publicar lo que devuelva cualquier LLM:** guarda su JSON en un archivo y ejecuta `npm run add -- archivo.json` (acepta la salida aunque venga envuelta en ```json o con texto alrededor).

## Comandos

| | |
|---|---|
| `npm run dev` | Sirve la web en http://localhost:5173 |
| `npm run add -- f.json [--date AAAA-MM-DD] [--dry]` | Valida y publica pistas |
| `npm run check` | Revisa todas las pistas publicadas |

No edites `manifest.json` a mano: se regenera a partir de los archivos.

Las pistas se crean a mano (sin API de pago). Cuando quedan menos de 7 días, una Action abre un issue «Quedan pocas pistas».
