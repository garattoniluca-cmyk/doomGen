import { GoogleGenerativeAI } from '@google/generative-ai'

let genAI = null

function getClient() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY non impostata nel file .env')
    genAI = new GoogleGenerativeAI(key)
  }
  return genAI
}

async function askGemini(prompt) {
  const model = getClient().getGenerativeModel({ model: 'gemini-1.5-flash' })
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1].trim())
  }
  return JSON.parse(text.trim())
}

// ── Monster generation ──────────────────────────────────────────────────────

export async function generateMonster({ description, name }) {
  const prompt = `Sei un game designer per un videogioco FPS stile Doom. Genera un mostro basato su questa descrizione: "${description}"${name ? ` Il nome suggerito è "${name}".` : ''}

Rispondi SOLO con un oggetto JSON valido (nessun testo extra), con questa struttura:
{
  "name": "nome del mostro",
  "health": numero intero tra 10 e 500,
  "speed": numero intero tra 1 e 10,
  "damage": numero intero tra 5 e 100,
  "behavior": uno tra "patrol" | "chase" | "shoot" | "ambush" | "stationary",
  "resistances": array di stringhe tra "fire" | "ice" | "electric" | "explosion" | "bullet",
  "appearance": "breve descrizione visiva del mostro",
  "special_attacks": [{ "name": "nome attacco", "description": "descrizione" }],
  "lore": "breve testo di lore sul mostro"
}`
  return askGemini(prompt)
}

// ── Surface/texture generation ──────────────────────────────────────────────

export async function generateSurface({ description, type }) {
  const typeNames = { wall: 'parete', floor: 'pavimento', ceiling: 'soffitto' }
  const prompt = `Sei un texture artist per un videogioco FPS stile Doom. Genera una texture per un ${typeNames[type] || 'superficie'} con questa descrizione: "${description}"

Rispondi SOLO con un oggetto JSON valido (nessun testo extra), con questa struttura:
{
  "name": "nome della texture",
  "primaryColor": "colore esadecimale principale es #6b4e32",
  "secondaryColor": "colore esadecimale secondario es #3a2010",
  "pattern": uno tra "solid" | "brick" | "stone" | "metal" | "wood" | "organic",
  "description": "descrizione visiva della texture",
  "mood": uno tra "dark" | "industrial" | "ancient" | "corrupted" | "hellish"
}`
  return askGemini(prompt)
}

// ── Level generation ────────────────────────────────────────────────────────

const GRID_SIZE = 20

function generateRandomLevel() {
  // Simple random dungeon: start with all walls, carve rooms and corridors
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(1))

  const carve = (r1, c1, r2, c2) => {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        if (r > 0 && r < GRID_SIZE - 1 && c > 0 && c < GRID_SIZE - 1)
          grid[r][c] = 0
  }

  // Carve some rooms
  carve(2, 2, 5, 7)
  carve(2, 11, 5, 17)
  carve(8, 2, 12, 8)
  carve(8, 11, 12, 17)
  carve(14, 4, 17, 15)
  carve(6, 4, 7, 6)   // small connector

  // Corridors
  carve(5, 4, 8, 5)   // N room to mid-W
  carve(5, 13, 8, 14) // N room to mid-E
  carve(12, 4, 14, 5)
  carve(12, 13, 14, 14)
  carve(3, 7, 3, 11)  // horizontal connector top
  carve(10, 8, 10, 11) // horizontal connector mid

  // Spawn and exit
  grid[3][3] = 2   // spawn
  grid[16][14] = 3 // exit

  return grid
}

export async function generateLevel({ description, random }) {
  if (random && !description) {
    return {
      grid: generateRandomLevel(),
      name: 'Livello Generato',
      description: 'Livello casuale generato proceduralmente',
    }
  }

  const prompt = `Sei un level designer per un videogioco FPS stile Doom. Genera un livello basato su questa descrizione: "${description}"

Crea una griglia ${GRID_SIZE}x${GRID_SIZE} dove:
- 0 = pavimento (percorribile)
- 1 = muro
- 2 = punto di spawn del giocatore (ESATTAMENTE UNO)
- 3 = uscita del livello (ESATTAMENTE UNA)

Regole importanti:
- I bordi (riga 0, riga 19, colonna 0, colonna 19) devono essere TUTTI muri (1)
- Il livello deve essere giocabile: ci devono essere percorsi dal punto spawn all'uscita
- Almeno il 40% delle celle interne deve essere pavimento (0)
- Spawn e uscita devono essere su celle di pavimento (non sui bordi)

Rispondi SOLO con un oggetto JSON valido:
{
  "name": "nome del livello",
  "description": "descrizione breve",
  "grid": [[array 20x20 di interi 0/1/2/3]]
}`

  try {
    const data = await askGemini(prompt)
    // Validate and fix grid
    if (!data.grid || data.grid.length !== GRID_SIZE) {
      throw new Error('Grid non valida, uso generazione casuale')
    }
    return data
  } catch {
    return {
      grid: generateRandomLevel(),
      name: description.slice(0, 30) || 'Livello AI',
      description,
    }
  }
}
