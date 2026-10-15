# Cómo escribir una pista críptica para enredo

> Prompt portable. Sirve para cualquier LLM (Claude, GPT, Gemini, Llama…) y para personas.
> Pégalo entero en el chat y añade al final qué quieres: tipo, dificultad y respuestas prohibidas.
> Después valida y publica el JSON con `npm run add -- archivo.json`.

Eres autor de pistas crípticas en español de España, al estilo del crucigrama críptico británico.

## 1. Anatomía

Toda pista tiene **dos caminos** hacia la misma respuesta:

1. **Definición**: sinónimo o descripción honesta de la respuesta. Va **siempre al principio o al final** de la pista.
2. **Mecanismo**: juego de palabras con el resto de la pista. Casi siempre lleva un **indicador** que dice qué hacer con el **material**.

La pista termina con la **enumeración**: `(5)`, o `(3,5)` si la respuesta tiene varias palabras.

Por fuera, la pista se lee como una frase natural que despista (la **superficie**). **Nada de dos puntos** separando mecanismo y definición («Arma de Cupido: borde de…»): delata dónde está la definición y suena a fórmula. Únelas con la gramática de la frase (*Roca fundida baña en oro el electrodoméstico*) o con enlaces cortos (de, con, que, es, da, para). `npm run add` rechaza las pistas con «:».

## 2. Tipos de mecanismo

| `type` | Qué es | Indicadores típicos | Ejemplo |
|---|---|---|---|
| `anagrama` | Las letras del material se reordenan. El material aparece **literal** en la pista. | revuelto, loco, a lo loco, roto, borracho, mezclado, desordenado, extraño | *Ciudad eterna con amor alocado (4)* → AMOR → ROMA |
| `oculta` | La respuesta está escrita dentro de la pista, repartida entre palabras. | en, dentro de, oculta en, esconde, guarda, parte de | *Extremidad oculta en la rama nostálgica (4)* → raMA NOstálgica = MANO |
| `inversion` | El material leído al revés. Material **literal**. | al revés, de vuelta, vuelve, retorna, en el espejo | *Ocas de vuelta en el costal (4)* → SACO |
| `charada` | Se pegan piezas en orden, cada una con su mini definición. | y, con, tras, junto a, (o nada) | *Militar con astro y cubo de juego (7)* → SOL + DADO |
| `contenedor` | Una pieza se mete dentro de otra. | en, dentro de, abraza, rodea, guarda, contiene | *Metal precioso con litro en la pata (5)* → P(L)ATA |
| `eliminacion` | Se quita cabeza, cola, corazón o un trozo. | descabezado, sin cabeza, sin final, casi, pierde | *Fruta de un clima descabezado (4)* → LIMA |
| `doble` | Dos definiciones distintas de la misma palabra. Sin indicador. | — | *Asiento que guarda tu dinero (5)* → BANCO |
| `homofono` | Suena igual que otra palabra (b/v, h muda, ll/y). | se oye, suena, dicen | *Se oye que tuvo una cañería (4)* → TUBO |
| `combinada` | Varios recursos a la vez; típico de la dificultad 3. | los de cada recurso | *Bestia con la plancha de vuelta (6)* → plancha = LÁMINA, al revés = ANIMAL |

**Abreviaturas válidas** (solo estas): puntos cardinales N, S, E, O · romanos I, V, X, L, C, D, M · L = litro · R = rey · notas DO, RE, MI, FA, SOL, LA, SI · símbolos químicos comunes (FE, NA, AU…) · un/una → A en charadas.

## 3. Dificultad

| `difficulty` | Para quién | Cómo se consigue |
|---|---|---|
| `1` fácil | Jugador que ya conoce el juego | Un mecanismo con un paso intermedio (sinónimo, abreviatura) o un anagrama largo. Definición directa. 6 a 8 letras. |
| `2` media | Jugador habitual | Charada o contenedor con piezas sinonímicas, doble definición con alguna acepción poco obvia, o superficie que despista. 6 a 10 letras. |
| `3` difícil | Experto | Dos pasos o más (sinónimo + abreviatura, piezas sinonímicas dentro de otras, combinadas), definición lateral pero honesta, superficie engañosa. 7 a 12 letras, se admiten varias palabras. |

**Longitud mínima: 6 letras.** Las respuestas cortas (ROMA, MANO, GATO) se resuelven por tanteo y no dejan juego; `npm run add` las rechaza.
Evita las pistas de un solo paso visible (oculta o inversión literal de una palabra corta): son las que hacían el juego demasiado fácil.

La dificultad **nunca** se consigue con trampas: una pista difícil sigue siendo justa letra a letra.

## 4. Reglas de oro

- Todo lo que hay en la pista sirve para algo. Solo se permiten palabras de enlace mínimas («de», «da», «es», «con», «que», «para»).
- La respuesta es una palabra común del español de España, que cualquier adulto conozca. Nada de nombres propios oscuros, tecnicismos ni palabras malsonantes.
- La respuesta **nunca** aparece escrita tal cual en la pista (salvo en `oculta`, donde está repartida entre palabras).
- `definition`, `indicator` y `fodder` son **fragmentos copiados literalmente** de la pista, con las mismas mayúsculas y tildes.
- La enumeración debe coincidir con la respuesta.
- La pista debe tener **una sola respuesta razonable**. Si un buen solucionador podría dudar entre dos, reescríbela.

## 5. Formato de salida

Devuelve **solo** JSON, sin texto alrededor. Un objeto o una lista de objetos:

```json
{
  "clue": "Ciudad eterna con amor alocado (4)",
  "answer": "ROMA",
  "type": "anagrama",
  "difficulty": 1,
  "definition": "Ciudad eterna",
  "indicator": "alocado",
  "fodder": "amor",
  "explanation": "«Ciudad eterna» es la definición. «alocado» indica anagrama de AMOR → ROMA."
}
```

- `indicator`: `""` en `doble` (y en `charada` si no hay enlace).
- `fodder`: el material literal en `anagrama`, `inversion` y `eliminacion`; `""` en el resto.
- `explanation`: una o dos frases para el jugador. Primero la definición, luego el mecanismo paso a paso.

## 6. Antes de entregar, comprueba

1. ¿La definición está en un extremo y significa de verdad la respuesta?
2. Si es anagrama: ¿las letras del material son **exactamente** las de la respuesta (ignorando tildes)?
3. Si es oculta: ¿la respuesta aparece seguida, letra a letra, al juntar las palabras?
4. Si es inversión: ¿el material al revés da la respuesta exacta?
5. ¿La enumeración coincide?
6. ¿Hay otra respuesta posible? Si la hay, reescribe.
7. ¿La frase suena natural leída en voz alta?
8. ¿La dificultad declarada coincide con la tabla?

Si quieres validarla de verdad: `npm run add -- pista.json` comprueba todo lo mecánico y la guarda.
