---
name: nueva-pista
description: Escribe, verifica y publica pistas crípticas en español para enredo. Úsala cuando pidan "una pista nueva", "una tanda de pistas", "rellenar días", o subir/bajar la dificultad.
---

# Nueva pista críptica

1. Lee `prompts/pista-criptica.md` entero: son las reglas, los tipos, la escala de dificultad y el formato JSON. No lo resumas, aplícalo.
2. Mira qué respuestas ya existen para no repetir: `node -e "import('./scripts/lib.mjs').then(l=>console.log([...l.usedAnswers()].join(' ')))"`.
3. Escribe las pistas en un archivo nuevo `tandas/tanda-NN.json` (lista de objetos).
   Para una tanda con dificultad variada, alterna en ola: 1, 2, 3, 2, 1, 2, 3...
4. **Verificación a ciegas**: pasa SOLO las pistas (sin respuestas) a un subagente que las resuelva y puntúe justicia (1-5) y dificultad (1-3).
   - Descarta o reescribe toda pista que no resuelva, o con justicia < 4.
   - Un solucionador experto puntúa la dificultad 1 o 2 niveles por debajo de lo que notaría una persona: úsala para *ordenar* las pistas, no como valor absoluto.
5. `npm run add -- tandas/tanda-NN.json --dry` → corrige lo que marque.
6. `npm run add -- tandas/tanda-NN.json` (ocupa los siguientes días libres; `--date AAAA-MM-DD` para fijar el primero) y `npm run check`.
