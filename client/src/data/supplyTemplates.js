// ── Supply Templates ──────────────────────────────────────────────────────────
// 4 pre-built "forniture" (oggetti/arredi) procedural con primitive.
// Usati come starting points nel picker "Nuova Fornitura".
// Stored as static JSON — NOT in the DB.
//
// Coordinate system: local space, y=0 at floor level, +Z forward.

const TEMPLATES = [

  // ── 1. Cassa di Legno ─────────────────────────────────────────────────────────
  {
    id: 'wood_crate',
    name: 'Cassa di Legno',
    description: 'Cassa chiusa con rinforzi metallici',
    geometry: {
      v: 1,
      parts: [
        { id:'p01', label:'Corpo',         shape:'box', w:0.90, h:0.75, d:0.70, r:0, x:0,    y:0.375, z:0,    rx:0, ry:0, rz:0, color:'#6b4a28' },
        { id:'p02', label:'Coperchio',     shape:'box', w:0.92, h:0.06, d:0.72, r:0, x:0,    y:0.78,  z:0,    rx:0, ry:0, rz:0, color:'#4a3018' },
        { id:'p03', label:'Asse Front 1',  shape:'box', w:0.86, h:0.08, d:0.02, r:0, x:0,    y:0.15,  z:0.36, rx:0, ry:0, rz:0, color:'#3a2410' },
        { id:'p04', label:'Asse Front 2',  shape:'box', w:0.86, h:0.08, d:0.02, r:0, x:0,    y:0.60,  z:0.36, rx:0, ry:0, rz:0, color:'#3a2410' },
        { id:'p05', label:'Bordo Ang Sx',  shape:'box', w:0.04, h:0.75, d:0.04, r:0, x:-0.45,y:0.375, z: 0.35,rx:0, ry:0, rz:0, color:'#2a2018' },
        { id:'p06', label:'Bordo Ang Dx',  shape:'box', w:0.04, h:0.75, d:0.04, r:0, x: 0.45,y:0.375, z: 0.35,rx:0, ry:0, rz:0, color:'#2a2018' },
        { id:'p07', label:'Bordo Ret Sx',  shape:'box', w:0.04, h:0.75, d:0.04, r:0, x:-0.45,y:0.375, z:-0.35,rx:0, ry:0, rz:0, color:'#2a2018' },
        { id:'p08', label:'Bordo Ret Dx',  shape:'box', w:0.04, h:0.75, d:0.04, r:0, x: 0.45,y:0.375, z:-0.35,rx:0, ry:0, rz:0, color:'#2a2018' },
        { id:'p09', label:'Lucchetto',     shape:'box', w:0.08, h:0.10, d:0.04, r:0, x:0,    y:0.75,  z:0.36, rx:0, ry:0, rz:0, color:'#999999' },
      ],
    },
  },

  // ── 2. Barile Esplosivo ───────────────────────────────────────────────────────
  {
    id: 'explosive_barrel',
    name: 'Barile Esplosivo',
    description: 'Barile rosso contenente materiale instabile',
    geometry: {
      v: 1,
      parts: [
        { id:'p01', label:'Corpo',       shape:'cylinder', w:0, h:1.10, d:0, r:0.42, x:0, y:0.55, z:0,    rx:0, ry:0, rz:0, color:'#aa1c00' },
        { id:'p02', label:'Cerchio Sup', shape:'cylinder', w:0, h:0.06, d:0, r:0.46, x:0, y:1.00, z:0,    rx:0, ry:0, rz:0, color:'#552200' },
        { id:'p03', label:'Cerchio Inf', shape:'cylinder', w:0, h:0.06, d:0, r:0.46, x:0, y:0.12, z:0,    rx:0, ry:0, rz:0, color:'#552200' },
        { id:'p04', label:'Tappo',       shape:'cylinder', w:0, h:0.08, d:0, r:0.18, x:0, y:1.14, z:0,    rx:0, ry:0, rz:0, color:'#333333' },
        { id:'p05', label:'Etich. Front', shape:'box',     w:0.45, h:0.20, d:0.02, r:0, x:0, y:0.62, z:0.42, rx:0, ry:0, rz:0, color:'#ffcc00' },
        { id:'p06', label:'Teschio',      shape:'sphere',  w:0, h:0, d:0, r:0.06, x:0, y:0.62, z:0.44, rx:0, ry:0, rz:0, color:'#111111' },
        { id:'p07', label:'Etich. Retro', shape:'box',     w:0.45, h:0.20, d:0.02, r:0, x:0, y:0.62, z:-0.42, rx:0, ry:0, rz:0, color:'#ffcc00' },
      ],
    },
  },

  // ── 3. Lampada da Parete ──────────────────────────────────────────────────────
  {
    id: 'wall_lamp',
    name: 'Lampada a Stelo',
    description: 'Lampada da terra con paralume conico',
    geometry: {
      v: 1,
      parts: [
        { id:'p01', label:'Base',      shape:'cylinder', w:0, h:0.10, d:0, r:0.30, x:0, y:0.05, z:0, rx:0, ry:0, rz:0, color:'#2a2a2a' },
        { id:'p02', label:'Stelo',     shape:'cylinder', w:0, h:1.60, d:0, r:0.04, x:0, y:0.90, z:0, rx:0, ry:0, rz:0, color:'#444444' },
        { id:'p03', label:'Paralume',  shape:'cone',     w:0, h:0.40, d:0, r:0.28, x:0, y:1.90, z:0, rx:180, ry:0, rz:0, color:'#cc8844' },
        { id:'p04', label:'Lampadina', shape:'sphere',   w:0, h:0, d:0, r:0.09, x:0, y:1.75, z:0, rx:0, ry:0, rz:0, color:'#fff5aa' },
      ],
    },
  },

  // ── 4. Tavolo Tondo ───────────────────────────────────────────────────────────
  {
    id: 'round_table',
    name: 'Tavolo Tondo',
    description: 'Tavolo da taverna in legno massello',
    geometry: {
      v: 1,
      parts: [
        { id:'p01', label:'Piano',      shape:'cylinder', w:0, h:0.08, d:0, r:0.70, x:0, y:0.82, z:0, rx:0, ry:0, rz:0, color:'#6b4424' },
        { id:'p02', label:'Bordo Piano',shape:'cylinder', w:0, h:0.04, d:0, r:0.72, x:0, y:0.86, z:0, rx:0, ry:0, rz:0, color:'#3a2410' },
        { id:'p03', label:'Colonna',    shape:'cylinder', w:0, h:0.78, d:0, r:0.09, x:0, y:0.39, z:0, rx:0, ry:0, rz:0, color:'#4a3018' },
        { id:'p04', label:'Base',       shape:'cylinder', w:0, h:0.08, d:0, r:0.35, x:0, y:0.04, z:0, rx:0, ry:0, rz:0, color:'#3a2410' },
        { id:'p05', label:'Zampa 1',    shape:'box', w:0.30, h:0.08, d:0.06, r:0, x: 0.22, y:0.04, z: 0.22, rx:0, ry: 45, rz:0, color:'#3a2410' },
        { id:'p06', label:'Zampa 2',    shape:'box', w:0.30, h:0.08, d:0.06, r:0, x:-0.22, y:0.04, z: 0.22, rx:0, ry:-45, rz:0, color:'#3a2410' },
        { id:'p07', label:'Zampa 3',    shape:'box', w:0.30, h:0.08, d:0.06, r:0, x: 0.22, y:0.04, z:-0.22, rx:0, ry:-45, rz:0, color:'#3a2410' },
        { id:'p08', label:'Zampa 4',    shape:'box', w:0.30, h:0.08, d:0.06, r:0, x:-0.22, y:0.04, z:-0.22, rx:0, ry: 45, rz:0, color:'#3a2410' },
      ],
    },
  },


  // ── 5. Sedia di Legno ─────────────────────────────────────────────────────────
  {
    id: 'wooden_chair',
    name: 'Sedia di Legno',
    description: 'Sedia rustica da taverna con schienale',
    geometry: {
      v: 1,
      parts: [
        { id:'p01', label:'Seduta',       shape:'box',      w:0.50, h:0.05, d:0.45, r:0, x:0,     y:0.48,  z:0,     rx:0, ry:0, rz:0, color:'#6b4a28' },
        { id:'p02', label:'Schienale',    shape:'box',      w:0.50, h:0.50, d:0.05, r:0, x:0,     y:0.73,  z:-0.20, rx:0, ry:0, rz:0, color:'#6b4a28' },
        { id:'p03', label:'Traversa Sup', shape:'box',      w:0.44, h:0.05, d:0.05, r:0, x:0,     y:0.88,  z:-0.20, rx:0, ry:0, rz:0, color:'#4a3018' },
        { id:'p04', label:'Gamba Ant Sx', shape:'box',      w:0.06, h:0.48, d:0.06, r:0, x:-0.21, y:0.24,  z: 0.18, rx:0, ry:0, rz:0, color:'#3a2410' },
        { id:'p05', label:'Gamba Ant Dx', shape:'box',      w:0.06, h:0.48, d:0.06, r:0, x: 0.21, y:0.24,  z: 0.18, rx:0, ry:0, rz:0, color:'#3a2410' },
        { id:'p06', label:'Gamba Ret Sx', shape:'box',      w:0.06, h:0.98, d:0.06, r:0, x:-0.21, y:0.49,  z:-0.18, rx:0, ry:0, rz:0, color:'#3a2410' },
        { id:'p07', label:'Gamba Ret Dx', shape:'box',      w:0.06, h:0.98, d:0.06, r:0, x: 0.21, y:0.49,  z:-0.18, rx:0, ry:0, rz:0, color:'#3a2410' },
        { id:'p08', label:'Traversa Inf', shape:'box',      w:0.38, h:0.04, d:0.04, r:0, x:0,     y:0.18,  z:0,     rx:0, ry:0, rz:0, color:'#3a2410' },
      ],
    },
  },

  // ── 6. Colonna Gotica ─────────────────────────────────────────────────────────
  {
    id: 'gothic_column',
    name: 'Colonna Gotica',
    description: 'Pilastro in pietra con capitello decorato',
    geometry: {
      v: 1,
      parts: [
        { id:'p01', label:'Plinto',     shape:'box',      w:0.66, h:0.14, d:0.66, r:0,    x:0, y:0.07,  z:0, rx:0, ry:0, rz:0, color:'#3a3228' },
        { id:'p02', label:'Base',       shape:'cylinder', w:0,    h:0.12, d:0,    r:0.30, x:0, y:0.20,  z:0, rx:0, ry:0, rz:0, color:'#2e2820' },
        { id:'p03', label:'Fusto',      shape:'cylinder', w:0,    h:1.55, d:0,    r:0.19, x:0, y:0.975, z:0, rx:0, ry:0, rz:0, color:'#332c22' },
        { id:'p04', label:'Capitello',  shape:'cylinder', w:0,    h:0.14, d:0,    r:0.28, x:0, y:1.82,  z:0, rx:0, ry:0, rz:0, color:'#2e2820' },
        { id:'p05', label:'Abaco',      shape:'box',      w:0.62, h:0.12, d:0.62, r:0,    x:0, y:1.95,  z:0, rx:0, ry:0, rz:0, color:'#3a3228' },
        { id:'p06', label:'Modanatura', shape:'cylinder', w:0,    h:0.06, d:0,    r:0.23, x:0, y:0.30,  z:0, rx:0, ry:0, rz:0, color:'#443c2e' },
        { id:'p07', label:'Anello Sup', shape:'cylinder', w:0,    h:0.06, d:0,    r:0.23, x:0, y:1.72,  z:0, rx:0, ry:0, rz:0, color:'#443c2e' },
      ],
    },
  },

  // ── 7. Altare Infernale ───────────────────────────────────────────────────────
  {
    id: 'hell_altar',
    name: 'Altare Infernale',
    description: 'Altare in pietra nera con candele e simboli oscuri',
    geometry: {
      v: 1,
      parts: [
        { id:'p01', label:'Gradino',      shape:'box',      w:1.20, h:0.12, d:0.72, r:0,    x:0,     y:0.06,  z:0,     rx:0, ry:0, rz:0, color:'#1e1a14' },
        { id:'p02', label:'Corpo',        shape:'box',      w:1.00, h:0.76, d:0.56, r:0,    x:0,     y:0.50,  z:0,     rx:0, ry:0, rz:0, color:'#221e16' },
        { id:'p03', label:'Piano',        shape:'box',      w:1.08, h:0.08, d:0.64, r:0,    x:0,     y:0.92,  z:0,     rx:0, ry:0, rz:0, color:'#181410' },
        { id:'p04', label:'Incisione',    shape:'box',      w:0.50, h:0.30, d:0.03, r:0,    x:0,     y:0.50,  z:0.29,  rx:0, ry:0, rz:0, color:'#440800' },
        { id:'p05', label:'Candela Sx',   shape:'cylinder', w:0,    h:0.32, d:0,    r:0.05, x:-0.38, y:1.12,  z:0,     rx:0, ry:0, rz:0, color:'#d4c89a' },
        { id:'p06', label:'Candela Dx',   shape:'cylinder', w:0,    h:0.32, d:0,    r:0.05, x: 0.38, y:1.12,  z:0,     rx:0, ry:0, rz:0, color:'#d4c89a' },
        { id:'p07', label:'Fiamma Sx',    shape:'sphere',   w:0,    h:0,    d:0,    r:0.07, x:-0.38, y:1.32,  z:0,     rx:0, ry:0, rz:0, color:'#ff8800' },
        { id:'p08', label:'Fiamma Dx',    shape:'sphere',   w:0,    h:0,    d:0,    r:0.07, x: 0.38, y:1.32,  z:0,     rx:0, ry:0, rz:0, color:'#ff8800' },
        { id:'p09', label:'Coppa',        shape:'cylinder', w:0,    h:0.14, d:0,    r:0.13, x:0,     y:1.06,  z:0,     rx:0, ry:0, rz:0, color:'#664400' },
      ],
    },
  },

  // ── 8. Armadio Gotico ─────────────────────────────────────────────────────────
  {
    id: 'gothic_wardrobe',
    name: 'Armadio Gotico',
    description: 'Armadio in legno scuro con ante e cornici intagliate',
    geometry: {
      v: 1,
      parts: [
        { id:'p01', label:'Corpo',        shape:'box', w:0.86, h:1.62, d:0.50, r:0, x:0,     y:0.87,  z:0,     rx:0, ry:0, rz:0, color:'#2a1e0e' },
        { id:'p02', label:'Tetto',        shape:'box', w:0.96, h:0.12, d:0.58, r:0, x:0,     y:1.74,  z:0,     rx:0, ry:0, rz:0, color:'#1e1408' },
        { id:'p03', label:'Cornice Top',  shape:'box', w:1.00, h:0.08, d:0.60, r:0, x:0,     y:1.86,  z:0,     rx:0, ry:0, rz:0, color:'#3a2a14' },
        { id:'p04', label:'Anta Sx',      shape:'box', w:0.40, h:1.54, d:0.05, r:0, x:-0.21, y:0.85,  z:0.275, rx:0, ry:0, rz:0, color:'#3a2810' },
        { id:'p05', label:'Anta Dx',      shape:'box', w:0.40, h:1.54, d:0.05, r:0, x: 0.21, y:0.85,  z:0.275, rx:0, ry:0, rz:0, color:'#3a2810' },
        { id:'p06', label:'Maniglia Sx',  shape:'box', w:0.04, h:0.16, d:0.05, r:0, x:-0.04, y:0.85,  z:0.31,  rx:0, ry:0, rz:0, color:'#887744' },
        { id:'p07', label:'Maniglia Dx',  shape:'box', w:0.04, h:0.16, d:0.05, r:0, x: 0.04, y:0.85,  z:0.31,  rx:0, ry:0, rz:0, color:'#887744' },
        { id:'p08', label:'Pannello Sx',  shape:'box', w:0.30, h:0.60, d:0.03, r:0, x:-0.21, y:1.20,  z:0.27,  rx:0, ry:0, rz:0, color:'#221608' },
        { id:'p09', label:'Pannello Dx',  shape:'box', w:0.30, h:0.60, d:0.03, r:0, x: 0.21, y:1.20,  z:0.27,  rx:0, ry:0, rz:0, color:'#221608' },
        { id:'p10', label:'Base',         shape:'box', w:0.90, h:0.10, d:0.52, r:0, x:0,     y:0.05,  z:0,     rx:0, ry:0, rz:0, color:'#1e1408' },
      ],
    },
  },

]

export default TEMPLATES
