// ── Pure procedural generators (no external API) ─────────────────────────────

import { randomInt, pick, pickN } from './utils.js'

// ── Monster ──────────────────────────────────────────────────────────────────

const PREFIXES = ['Demone', 'Spettro', 'Berserker', 'Guardiano', 'Arciduca', 'Servo', 'Cacciatore', 'Revenant']
const SUFFIXES = ['Fiammante', 'Corrotto', 'delle Ombre', "dell'Abisso", 'Malefico', 'Infernale', 'Oscuro', 'Maledetto']

const LORE_POOL = [
  'Una creatura strappata dalle profondità dell\'inferno, condannata a vagare per l\'eternità.',
  'Forgiato dal fuoco eterno, non conosce pietà né stanchezza.',
  'Un tempo guerriero mortale, ora servo eterno delle forze oscure.',
  'Emerge dalle crepe tra le dimensioni, attratto dall\'odore della paura.',
  'I suoi occhi bruciano come braci, la sua voce è un grido di guerra senza fine.',
]

const SPECIAL_ATTACKS_POOL = [
  { name: 'Carica Devastante', description: 'Si lancia in avanti a velocità folle causando danno massiccio.' },
  { name: 'Palla di Fuoco', description: 'Spara un proiettile infuocato che esplode all\'impatto.' },
  { name: 'Urlo Paralizzante', description: 'Un grido soprannaturale che rallenta il bersaglio.' },
  { name: 'Rigenerazione', description: 'Recupera lentamente vita nel tempo.' },
  { name: 'Teletrasporto', description: 'Scompare e riappare accanto al bersaglio.' },
  { name: 'Esplosione di Bile', description: 'Spruzza acido corrosivo in un\'ampia area.' },
  { name: 'Scudo di Ossa', description: 'Evoca un barriera temporanea di ossa che assorbe danni.' },
]

const RESISTANCES_POOL = ['fire', 'ice', 'electric', 'explosion', 'bullet']

const ARCHETYPES = {
  patrol:     { healthRange: [40, 150],  speedRange: [3, 5], damageRange: [10, 25] },
  chase:      { healthRange: [80, 220],  speedRange: [5, 8], damageRange: [15, 40] },
  shoot:      { healthRange: [100, 300], speedRange: [2, 4], damageRange: [20, 55] },
  ambush:     { healthRange: [60, 180],  speedRange: [6, 9], damageRange: [25, 65] },
  stationary: { healthRange: [200, 500], speedRange: [1, 2], damageRange: [35, 90] },
}

export function generateMonster({ name, behavior } = {}) {
  const behaviors = Object.keys(ARCHETYPES)
  const chosenBehavior = behavior && ARCHETYPES[behavior] ? behavior : pick(behaviors)
  const arch = ARCHETYPES[chosenBehavior]

  return {
    name: name || `${pick(PREFIXES)} ${pick(SUFFIXES)}`,
    health: randomInt(...arch.healthRange),
    speed: randomInt(...arch.speedRange),
    damage: randomInt(...arch.damageRange),
    behavior: chosenBehavior,
    resistances: pickN(RESISTANCES_POOL, randomInt(0, 2)),
    appearance: 'Figura demoniaca con arti contorti e occhi incandescenti.',
    special_attacks: pickN(SPECIAL_ATTACKS_POOL, randomInt(1, 2)),
    lore: pick(LORE_POOL),
  }
}

// ── Surface ──────────────────────────────────────────────────────────────────

const PALETTES = {
  wall: [
    { name: 'Mattoni Infernali', primary: '#7a3a1a', secondary: '#3a1a08', pattern: 'brick', mood: 'hellish' },
    { name: 'Pietra Antica',     primary: '#5a5248', secondary: '#2e2a24', pattern: 'stone', mood: 'ancient' },
    { name: 'Metallo Ossidato',  primary: '#3a4a3a', secondary: '#1a2a1a', pattern: 'metal', mood: 'industrial' },
    { name: 'Mattoni Scuri',     primary: '#4a3020', secondary: '#1e1208', pattern: 'brick', mood: 'dark' },
    { name: 'Muro Organico',     primary: '#2a3a1a', secondary: '#0e1a06', pattern: 'organic', mood: 'corrupted' },
    { name: 'Acciaio Corroso',   primary: '#4a4040', secondary: '#221a1a', pattern: 'metal', mood: 'industrial' },
  ],
  floor: [
    { name: 'Pietra Consumata',  primary: '#3a3028', secondary: '#1e1a10', pattern: 'stone', mood: 'ancient' },
    { name: 'Piastrelle Scure',  primary: '#1a1a1a', secondary: '#0a0a0a', pattern: 'solid', mood: 'dark' },
    { name: 'Cemento Grezzo',    primary: '#4a4035', secondary: '#2a2018', pattern: 'stone', mood: 'industrial' },
    { name: 'Legno Marcio',      primary: '#3a2a18', secondary: '#1a1208', pattern: 'wood', mood: 'corrupted' },
  ],
  ceiling: [
    { name: 'Soffitto di Pietra', primary: '#1e1e1e', secondary: '#0a0a0a', pattern: 'solid', mood: 'dark' },
    { name: 'Volta in Mattoni',   primary: '#3a2a1a', secondary: '#1a1008', pattern: 'brick', mood: 'ancient' },
    { name: 'Lamiera',            primary: '#2a2a2a', secondary: '#111',    pattern: 'metal', mood: 'industrial' },
  ],
}

export function generateSurface({ type } = {}) {
  const t = PALETTES[type] ? type : 'wall'
  return { ...pick(PALETTES[t]) }
}

// ── Level ────────────────────────────────────────────────────────────────────

const LEVEL_NAMES = [
  'Antrum Inferni', 'Corridoio della Morte', 'Sala del Tormento',
  'Labirinto Oscuro', 'Fortezza Maledetta', 'Catacombe Profonde',
  'Arena Insanguinata', 'Cripta degli Dannati',
]

const LEVEL_TEMPLATES = [templateA, templateB, templateC]

function templateA() {
  // Cross-shaped layout
  const G = 20
  const grid = Array.from({ length: G }, () => Array(G).fill(1))
  const carve = (r1, c1, r2, c2) => {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        if (r > 0 && r < G - 1 && c > 0 && c < G - 1) grid[r][c] = 0
  }
  // Main rooms
  carve(2, 2, 6, 8); carve(2, 10, 6, 17)
  carve(8, 2, 13, 8); carve(8, 10, 13, 17)
  carve(14, 4, 17, 15)
  // Corridors
  carve(4, 8, 4, 10); carve(10, 8, 10, 10)
  carve(6, 4, 8, 5); carve(6, 14, 8, 15)
  carve(13, 4, 14, 5); carve(13, 14, 14, 15)
  carve(3, 3, 3, 3) // extra nook
  grid[3][3] = 2; grid[16][15] = 3
  return { grid, name: pick(LEVEL_NAMES) }
}

function templateB() {
  // Spiral / concentric
  const G = 20
  const grid = Array.from({ length: G }, () => Array(G).fill(1))
  const carve = (r1, c1, r2, c2) => {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        if (r > 0 && r < G - 1 && c > 0 && c < G - 1) grid[r][c] = 0
  }
  // Outer ring
  carve(2, 2, 2, 17); carve(17, 2, 17, 17)
  carve(2, 2, 17, 2); carve(2, 17, 17, 17)
  // Inner corridors
  carve(4, 4, 4, 15); carve(15, 4, 15, 15)
  carve(4, 4, 15, 4); carve(4, 15, 15, 15)
  // Center room
  carve(7, 7, 12, 12)
  // Connections
  carve(2, 9, 4, 9); carve(15, 9, 17, 9)
  carve(7, 4, 7, 7); carve(7, 12, 7, 15)
  carve(12, 4, 12, 7); carve(12, 12, 12, 15)
  grid[2][2] = 2; grid[17][17] = 3
  return { grid, name: pick(LEVEL_NAMES) }
}

function templateC() {
  // Open arena with pillars
  const G = 20
  const grid = Array.from({ length: G }, () => Array(G).fill(0))
  // Borders
  for (let i = 0; i < G; i++) { grid[0][i] = 1; grid[G-1][i] = 1; grid[i][0] = 1; grid[i][G-1] = 1 }
  // Pillars
  const pillars = [[4,4],[4,9],[4,14],[9,4],[9,14],[14,4],[14,9],[14,14]]
  for (const [r,c] of pillars) {
    grid[r][c] = 1; grid[r][c+1] = 1; grid[r+1][c] = 1; grid[r+1][c+1] = 1
  }
  // Some walls
  for (let i = 2; i <= 6; i++) grid[7][i] = 1
  for (let i = 13; i <= 17; i++) grid[7][i] = 1
  for (let i = 10; i <= 17; i++) grid[12][i] = 1
  grid[2][2] = 2; grid[17][17] = 3
  return { grid, name: pick(LEVEL_NAMES) }
}

export function generateLevel() {
  return pick(LEVEL_TEMPLATES)()
}
