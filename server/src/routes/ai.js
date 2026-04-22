import express from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
]
const GEMINI_BASE   = 'https://generativelanguage.googleapis.com/v1beta/models'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Gemini call helper (con retry + support multimodale + grounding) ───────────
// opts: { imageBase64?: string, imageMime?: string, tools?: object[], maxOutputTokens?: number }
async function callGemini(apiKey, systemText, userText, opts = {}) {
  const fullText = `${systemText}\n\n---\n\n${userText}`
  const parts = [{ text: fullText }]

  if (opts.imageBase64) {
    parts.push({
      inline_data: {
        mime_type: opts.imageMime || 'image/jpeg',
        data: opts.imageBase64,
      }
    })
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.7, maxOutputTokens: opts.maxOutputTokens || 32768 },
  }

  if (opts.tools && opts.tools.length) {
    body.tools = opts.tools
  }

  const RETRIES_PER_MODEL = 2    // tentativi su 503 prima di passare al prossimo
  const RETRY_DELAY_MS    = 1500
  let lastErr

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`

    for (let attempt = 0; attempt < RETRIES_PER_MODEL; attempt++) {
      let res
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch (netErr) {
        lastErr = netErr
        break   // network error → prova modello successivo
      }

      // 429 = quota esaurita → non ha senso riprovare stesso modello
      if (res.status === 429) {
        const errText = await res.text()
        lastErr = new Error(`Gemini HTTP 429 (${model}): ${errText}`)
        console.log(`[AI] ${model} quota esaurita, provo successivo`)
        break
      }

      // 503 = overload temporaneo → retry con delay sullo stesso modello
      if (res.status === 503) {
        const errText = await res.text()
        lastErr = new Error(`Gemini HTTP 503 (${model}): ${errText}`)
        console.log(`[AI] ${model} 503 tentativo ${attempt+1}/${RETRIES_PER_MODEL}`)
        if (attempt < RETRIES_PER_MODEL - 1) {
          await sleep(RETRY_DELAY_MS * (attempt + 1))   // backoff lineare
          continue
        }
        break   // dopo tutti i retry, passa al modello successivo
      }

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Gemini HTTP ${res.status}: ${err}`)
      }

      const data = await res.json()
      const candidate = data?.candidates?.[0]
      const text = candidate?.content?.parts?.map(p => p.text).filter(Boolean).join('\n')
      const finishReason = candidate?.finishReason
      const grounding = candidate?.groundingMetadata || null
      if (!text) throw new Error('Risposta Gemini vuota o malformata')
      console.log(`[AI] Modello: ${model}${attempt > 0 ? ` (retry ${attempt})` : ''} | finishReason: ${finishReason}${grounding ? ' | grounding attivo' : ''}`)
      if (finishReason === 'MAX_TOKENS') {
        console.warn('[AI] ATTENZIONE: risposta troncata per MAX_TOKENS')
      }
      return { text: text.trim(), model, grounding, finishReason, truncated: finishReason === 'MAX_TOKENS' }
    }
  }

  throw lastErr || new Error('Tutti i modelli Gemini non disponibili')
}

// ── Helper: scarica un'immagine da un URL e la converte in base64 ──────────────
async function fetchImageAsBase64(url, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) throw new Error(`content-type non immagine: ${ct}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 10 * 1024 * 1024) throw new Error(`file troppo grande: ${buf.length} B`)
    if (buf.length < 200) throw new Error(`file troppo piccolo: ${buf.length} B`)
    return { base64: buf.toString('base64'), mime: ct.split(';')[0].trim(), size: buf.length }
  } finally {
    clearTimeout(timer)
  }
}

// ── Helper: estrae il più grande blocco JSON bilanciato dal testo ─────────────
function extractBalancedJson(text) {
  if (!text) return null
  // Strip markdown fences
  let s = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '')
  // Find first '{' and walk to its matching '}' tracking string state
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) { esc = false; continue }
      if (c === '\\') { esc = true; continue }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

// ── Helper: piccole riparazioni di JSON malformato dei modelli ────────────────
function sanitizeJsonish(s) {
  if (!s) return s
  return s
    // rimuovi commenti line // ...
    .replace(/(^|[^:"])\/\/[^\n\r]*/g, '$1')
    // rimuovi commenti block /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // trailing commas prima di } o ]
    .replace(/,\s*([}\]])/g, '$1')
    // virgolette tipografiche → ASCII
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

function tryParseJson(rawText) {
  const extracted = extractBalancedJson(rawText) || rawText
  // Primo tentativo: parse diretto
  try { return { ok: true, value: JSON.parse(extracted) } } catch (e1) {
    // Secondo tentativo: sanitize
    try {
      const cleaned = sanitizeJsonish(extracted)
      return { ok: true, value: JSON.parse(cleaned), repaired: true }
    } catch (e2) {
      return { ok: false, error: e2.message, snippet: extracted }
    }
  }
}

// ── Helper: estrae URL immagini dalla risposta del modello ────────────────────
function extractImageUrls(text) {
  if (!text) return []
  // Cerca la riga "IMAGE_URLS: ..."
  const match = text.match(/IMAGE_URLS?:\s*(.+)/i)
  const candidates = []
  if (match) {
    const urlPart = match[1]
    const urls = urlPart.match(/https?:\/\/[^\s<>"'`]+/gi) || []
    candidates.push(...urls)
  }
  // Fallback: cerca QUALSIASI URL immagine nel testo
  const allUrls = text.match(/https?:\/\/[^\s<>"'`]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s<>"'`]*)?/gi) || []
  for (const u of allUrls) if (!candidates.includes(u)) candidates.push(u)
  return candidates
}

// ── Prompts ────────────────────────────────────────────────────────────────────
const SYSTEM_WEB_RESEARCH = `Sei un ricercatore visivo per un videogioco infernale stile Doom (dungeon di pietra, fuoco, sangue, metalli corrosi).
Ti viene fornita una breve descrizione di un oggetto di arredamento/fornitura.

Usa Google Search per trovare riferimenti visivi reali (immagini, descrizioni, arte concettuale, oggetti storici simili) che aiutino a visualizzare l'oggetto in modo concreto.

Produci la tua risposta in DUE SEZIONI separate esattamente così:

═══ SEZIONE 1: SINTESI VISIVA ═══
Scrivi in italiano una sintesi di ricerca che includa:
1. DESCRIZIONE VISIVA CONCRETA: forma, proporzioni, materiali, dettagli caratteristici (2-4 frasi)
2. RIFERIMENTI STORICI/ARTISTICI trovati: cita 2-3 esempi reali
3. DETTAGLI DISTINTIVI: elementi visivi unici da replicare nel modello 3D
4. SUGGERIMENTI SCALA: dimensioni reali tipiche dell'oggetto

═══ SEZIONE 2: URL IMMAGINI ═══
Alla fine della risposta, aggiungi OBBLIGATORIAMENTE una riga con il prefisso "IMAGE_URLS:" seguita da 3-5 URL DIRETTI a file immagine (devono finire in .jpg, .jpeg, .png, o .webp — NO pagine HTML), separati da spazio. Esempio:
IMAGE_URLS: https://example.com/a.jpg https://example.com/b.png https://example.com/c.webp

Le immagini devono essere il più rilevanti possibile per l'oggetto richiesto e vere (trovate via Google Search). Prediligi:
- Foto di oggetti storici reali (musei, archeologia)
- Arte concettuale o illustrazioni di dungeon/fantasy dark
- Render 3D di videogiochi simili (Doom, Diablo, Dark Souls)

NON usare URL di pagine HTML (es. wikipedia.org/wiki/...) — solo link diretti a file immagine.`

const SYSTEM_IMAGE_ANALYSIS = `Sei un analista visivo esperto. Ti viene fornita un'immagine di riferimento.
Il tuo compito è descriverla in modo ESTREMAMENTE dettagliato e strutturato, così che un artista 3D possa ricostruirla fedelmente in primitive geometriche.

Rispondi in italiano con QUESTA struttura esatta (non aggiungere altro):

═══ 1. SOGGETTO PRINCIPALE ═══
Cosa raffigura l'immagine? (es. "personaggio umano maschile in piedi con bastone magico e lupo sulla spalla", "barile di legno con cerchi metallici", "torcia da parete in ferro battuto")

═══ 2. TIPO DI OGGETTO ═══
Classifica: personaggio/creatura | statua | arredamento | architettura | arma | ornamento | altro
Indica se è adatto a essere ricostruito come singolo oggetto 3D.

═══ 3. SILHOUETTE E POSA ═══
Descrivi la forma complessiva, la direzione principale (verticale/orizzontale), la posa se è una figura, gli assi di simmetria.

═══ 4. PARTI ANATOMICHE/STRUTTURALI ═══
Elenca TUTTE le parti visibili con proporzioni relative. Per ogni parte indica:
- Nome (es. "testa", "busto", "braccio destro", "bastone", "base del barile")
- Proporzione (es. "1/8 dell'altezza totale")
- Forma geometrica (cubica/cilindrica/sferica/conica/irregolare)
- Posizione spaziale (in alto, centro, laterale sinistro/destro, frontale...)

═══ 5. COLORI DOMINANTI PER PARTE ═══
Per ogni parte identificata sopra, indica 1-2 colori dominanti in hex (es. "armatura: #5a4830, #3d2510").

═══ 6. DETTAGLI CARATTERISTICI ═══
Elementi visivi distintivi che definiscono l'oggetto (es. "palchi di cervo sulla cima del bastone", "cristallo verde luminescente", "cappuccio di pelliccia grigio-argento").

═══ 7. PROPORZIONI GLOBALI ═══
Stima le dimensioni reali dell'oggetto raffigurato in metri (larghezza × profondità × altezza). Es. "personaggio umano ~ 0.6w × 0.4d × 1.85h".

Se l'immagine è irriconoscibile, di qualità troppo bassa o non contiene un oggetto/soggetto chiaro, scrivi solo "IMMAGINE NON UTILIZZABILE" e motiva brevemente.`

const SYSTEM_EXPAND = `Sei un art director 3D per un videogioco in ambientazione infernale stile Doom (pietra corrosa, fuoco, sangue, metalli ossidati, legno bruciato).
Ti viene fornita una descrizione di un oggetto 3D da modellare con primitive geometriche (box, cylinder, cone, sphere). Potresti ricevere anche:
- Un'ANALISI VISIVA strutturata di un'immagine di riferimento → usala come GUIDA STRUTTURALE PRIMARIA (soggetto, silhouette, parti, proporzioni, colori). NON trasformare il soggetto in qualcos'altro: se è un personaggio, genera un personaggio; se è una torcia, genera una torcia.
- Un'immagine di riferimento inline → usala per verificare composizione e dettagli mentre leggi l'analisi
- Una sintesi di ricerca web → contesto aggiuntivo per proporzioni e dettagli distintivi

REGOLA FONDAMENTALE: l'oggetto generato deve essere RICONOSCIBILMENTE lo stesso soggetto dell'immagine/descrizione. Se l'analisi descrive un personaggio con lupo e bastone, NON generare un palo di legno. Mantieni la silhouette, le parti, le proporzioni.

Produci una SCHEDA TECNICA 3D completa e precisa in italiano.

═══ SISTEMA DI UNITÀ ═══
1 unità di gioco = 1 metro reale. Scale di riferimento per categoria:

OGGETTI/ARREDAMENTO:
  Sedia              : seduta 0.45w×0.45d h=0.05, gambe 0.06×0.06 h=0.43, schienale fino a y=0.90
  Tavolo             : piano 1.2w×0.6d h=0.05 a y=0.74, gambe 0.06×0.06 h=0.74
  Barile piccolo     : cylinder r=0.25 h=0.55 | standard: r=0.32 h=0.85
  Cassa/baule        : corpo 0.8w×0.5d h=0.4, coperchio 0.82w×0.52d h=0.08
  Torcia da parete   : supporto r=0.04 h=0.20, coppa r=0.07 h=0.08, fiamma r=0.05 h=0.15
  Colonna            : plinto 0.5×0.5 h=0.3, fusto r=0.18 h=2.8, capitello 0.5×0.5 h=0.25
  Altare             : gradino 1.4×1.0 h=0.2, corpo 1.2×0.8 h=0.5, piano 1.3×0.9 h=0.08
  Porta/cancello     : stipiti 0.12×0.12 h=2.3, traversa 1.2 h=0.1, anta 0.55 h=2.2
  Trono              : seduta 0.6×0.55 h=0.06 a y=0.48, braccioli h=0.25, schienale h=0.90

PERSONAGGI/CREATURE (anche statue) — altezza totale guida tutto:
  Umano medio (h=1.80): testa sphere r=0.12 | collo cyl r=0.05 h=0.10 | busto box 0.40w×0.55h×0.22d
                        spalle sphere r=0.09 | bracci sup cyl r=0.05 h=0.30 | avambracci cyl r=0.045 h=0.28
                        mani sphere r=0.06 | bacino box 0.38w×0.15h×0.22d
                        cosce cyl r=0.08 h=0.45 | polpacci cyl r=0.07 h=0.42 | piedi box 0.12w×0.08h×0.25d
  Accessori: bastone cyl r=0.025 h=1.80 | spada lama box 0.06×0.80×0.01 | mantello box 0.45×0.95×0.04
  Cristalli/gemme: sphere r=0.05-0.10 o cone r=0.04 h=0.15
  Animale medio (lupo h=0.70): corpo box 0.70w×0.30h×0.30d | testa sphere r=0.12 | zampe cyl r=0.04 h=0.35

ARCHITETTURA/GRANDE SCALA:
  Statua monumentale : 1.5-3.0m altezza | cippo funerario 0.5×0.5 h=1.5-2.0m
  Obelisco           : base 0.4×0.4 h=0.2, fusto 0.3×0.3 h=2.5, punta cone r=0.15 h=0.3

ADATTA la scala al tipo di soggetto dall'analisi visiva. Un personaggio a terra ha y_base=0, NON deve essere alto come una colonna a meno che non sia una statua.

═══ USO CREATIVO DELLE SFERE — FORME TONDEGGIANTI/ORGANICHE ═══
Le sfere (e le sfere schiacciate simulate con box arrotondati) sono lo strumento per forme gonfie, panciute, organiche, bulbose. Usale per:
- **Vasi, anfore, brocche, urne**: corpo = sphere grande (r=0.20-0.45), collo = cylinder stretto, orlo = cylinder piatto (r_orlo > r_collo)
- **Borse, sacchi gonfi, pance**: sphere r=0.15-0.30
- **Teschi, occhi, gemme, sfere magiche**: sphere r=0.05-0.20
- **Coperchi a cupola**: sphere posizionata con y_centro al livello dell'apertura così la metà inferiore è nascosta dentro il contenitore → effetto semisfera
- **Corpi di insetti/creature**: sphere o catena di sphere di dimensioni diverse per addome, torace, capo
- **Nodi su bastoni, manici rigonfi**: sphere piccole r=0.04-0.08 infilate lungo un cilindro
- **Bocce, globi, pianeti ornamentali**: sphere r=0.10-0.35

TECNICA "PILA DI SFERE A DIAMETRO VARIABILE" per vasi/urne/forme panciute:
  Una forma organica si approssima con 4-6 sphere sovrapposte a r crescente poi decrescente:
    Esempio vaso di terracotta (h totale ~0.55):
      - sfera base (piatta):   sphere r=0.12  y = 0.00 + 0.12 = 0.12
      - sfera ventre inf:      sphere r=0.20  y = 0.12 + 0.20 = 0.32   ← raggio massimo
      - sfera ventre sup:      sphere r=0.18  y = 0.32 + 0.18 = 0.50
      - sfera spalle:          sphere r=0.12  y = 0.50 + 0.12 = 0.62
      - cylinder collo:        r=0.07 h=0.08  y = 0.62 + 0.04 = 0.66
      - cylinder orlo:         r=0.10 h=0.02  y = 0.66 + 0.08 + 0.01 = 0.75
      - sphere coperchio:      r=0.13  y = 0.75 + 0.13 = 0.88
      - sphere pomello:        r=0.04  y = 0.88 + 0.13 + 0.04 = 1.05
  Le sfere si sovrappongono intenzionalmente: i vuoti tra di loro si nascondono e la sagoma risulta continua.
  REGOLA: più sfere sovrappongono = forma più morbida. Minimo 3 sfere per un vaso degno.

DISCO PIATTO = cylinder con h molto piccola (h=0.01-0.04):
  Piattini, sottocoppe, coperchi piatti, basi ornamentali: cylinder r=0.15-0.35 h=0.02-0.04
  Esempio piatto sottovaso: cylinder r=0.28 h=0.025, posizionato a y = y_corpo + r_corpo + 0.0125

IMPORTANTE: per vasi, urne, calici, coppe, brocche → NON usare un singolo box. Costruisci sempre la forma con sfere sovrapposte + collo cilindrico.

═══ USO CREATIVO DEI CONI — FORME CURVE/AFFUSOLATE ═══
I coni sono lo strumento principale per simulare sagome curve o affusolate che non possono essere rappresentate con box/cylinder/sphere. Usali per:
- **Corna, zanne, artigli, spine**: cono r_base 0.04-0.10, h 0.15-0.60, ruotato con rx/rz per inclinarlo
- **Punte di lance/frecce, lame appuntite**: cono sottile r=0.02-0.05, h=0.20-0.50
- **Archi curvi (corna di toro, mezzelune)**: CATENE DI CONI concatenati, ognuno ruotato progressivamente
    Esempio corna a mezzaluna (2 corna simmetriche):
      corna sinistra = 3-4 coni in catena, ogni segmento più sottile e più ruotato dell'altro
      - segmento 1: cono r_base=0.08 h=0.18 x=-0.25 y=1.10 rz=-20
      - segmento 2: cono r_base=0.06 h=0.16 x=-0.42 y=1.04 rz=-45
      - segmento 3: cono r_base=0.04 h=0.14 x=-0.55 y=0.92 rz=-70
      - segmento 4 (punta): cono r_base=0.02 h=0.10 x=-0.62 y=0.78 rz=-95
      Specchia con x positivo e rz opposto per la corna destra
- **Archi, volte, ponti**: catene di coni o cilindri ruotati a formare un arco
- **Cappelli a cono, elmi appuntiti, cuspidi di torri**: cono r=0.15-0.30, h=0.30-0.80
- **Nasi prominenti, becchi, musi allungati**: cono r=0.03-0.08, h=0.10-0.25
- **Code affusolate**: cono inverso o catena di coni che si assottigliano
- **Fiamme, raggi di luce**: cono r=0.05-0.15, h=0.15-0.40, colore arancio/oro
- **Radici, rami, tentacoli**: catene di cilindri→coni che si assottigliano verso la punta

IMPORTANTE: il cono ha la punta verso l'alto di default (asse y). Per orientarlo in altra direzione usa rx/rz:
  rz=+90  → punta verso destra (+x)
  rz=-90  → punta verso sinistra (-x)
  rx=+90  → punta verso fondo (+z)
  rx=-90  → punta verso avanti (-z)
  rz=+45 o -45 → punta obliqua in alto

REGOLA: se l'analisi visiva indica forme curve, ricurve, a mezzaluna, appuntite, affusolate — NON usare un singolo box o cilindro diritto. Scomponi in una catena di 3-5 coni (o coni+cilindri) ruotati progressivamente.

═══ ELEMENTI DI SUPERFICIE — REGOLA CRITICA ═══
Quando modelli un contenitore con frontali (credenze, armadi, casse, bauli, scrivanie con cassetti):
- Il corpo/cassa ha una certa profondità d_corpo e un bordo frontale a z_bordo = d_corpo/2
- OGNI pannello frontale (anta, cassetto, sportello) DEVE SPORGERE VISIBILMENTE dal bordo:
    posizione_z_frontale = z_bordo + spessore_pannello/2 + 0.005
  Esempio: corpo d=0.40 → z_bordo=0.20; pannello spessore 0.02 → z_pannello = 0.20 + 0.01 + 0.005 = 0.215
- MAI mettere il pannello dentro il box (z < z_bordo) — sparirebbe nella visualizzazione
- Le maniglie sporgono ancora di più: z_maniglia = z_pannello_sup + r_maniglia + 0.005
- Per un effetto più pulito, usa COLORE DIVERSO per frontali rispetto al corpo (es. corpo #3d2510, frontali #6b4a28)
- Le cerniere vanno sul LATO del pannello (x oltre il bordo x), non frontali

ESEMPIO CREDENZA 3 ANTE + 3 CASSETTI (1.40w × 0.45d × 0.90h):
  p01 base:         box 1.44×0.08×0.48 a y=0.04, z=0, color="#2a1a08"
  p02 corpo ante:   box 1.40×0.40×0.42 a y=0.28, z=0, color="#3d2510"
  p03 corpo casset: box 1.40×0.20×0.42 a y=0.58, z=0, color="#3d2510"
  p04 piano top:    box 1.44×0.04×0.46 a y=0.70, z=0, color="#5c3a18"
  p05-07 cassetti:  box 0.44×0.18×0.02 a y=0.58, z=0.235 (0.21+0.01+0.015), x={-0.46,0,+0.46}, color="#6b4a28"
  p08-10 ante:      box 0.44×0.36×0.02 a y=0.28, z=0.235, x={-0.46,0,+0.46}, color="#6b4a28"
  p11-13 man. cass: sphere r=0.025 a y=0.58, z=0.27 (0.235+0.025+0.01), x={-0.46,0,+0.46}, color="#2a2a28"
  p14-16 man. ante: sphere r=0.025 a y=0.28, z=0.27, x={-0.46,0,+0.46}, color="#2a2a28"
  Le cerniere sono visibili solo se grandi abbastanza (min 0.06×0.10×0.02): meglio ometterle se microscopiche.

═══ REGOLA DI VISIBILITÀ GENERALE ═══
Ogni parte deve essere VISIBILE da almeno una direzione cardinale. Se una parte è interamente dentro il volume di un'altra con colore simile, rimuovila o spostala fuori. Minimo sporgenza utile: 0.01m (1cm).

═══ CALCOLO POSIZIONI Y ═══
y=0 è il pavimento. Ogni parte ha un y_centro calcolato così:
  y_centro = y_base_inferiore_parte + (dimensione_verticale_parte / 2)

Esempi obbligatori da rispettare:
  - Gamba tavolo h=0.74 poggiata a terra → y_centro = 0 + 0.74/2 = 0.370
  - Piano tavolo h=0.05 con fondo a y=0.74 → y_centro = 0.74 + 0.05/2 = 0.765
  - Oggetto sopra piano: y_base = 0.74+0.05 = 0.79 → y_centro = 0.79 + h_oggetto/2
  - Schienale sedia h=0.40 con fondo a y=0.50 → y_centro = 0.50 + 0.40/2 = 0.70
  - Fiamma cono h=0.15 sopra coppa torcia (cima a y=0.33) → y_centro = 0.33 + 0.15/2 = 0.405

IMPORTANTE: specifica sempre y_base e y_centro per ogni parte, così il JSON sarà corretto.

═══ STRUTTURA SCHEDA ═══
1. NOME: breve, evocativo, in italiano (es. "Trono degli Ossicini", "Barile del Sangue Rappreso")
2. DESCRIZIONE VISIVA: 2-3 frasi sull'aspetto nell'ambientazione infernale
3. DIMENSIONI GLOBALI: larghezza × profondità × altezza totale dell'oggetto assemblato
4. PARTI (6-14 per oggetti semplici, 16-24 per soggetti complessi come personaggi/creature):
   Per ogni parte:
   ┌─ ID: p01, p02, ...
   ├─ Nome: italiano, descrittivo
   ├─ Shape: box | cylinder | cone | sphere
   ├─ Dimensioni: w/h/d per box; r/h per cylinder e cone; r per sphere
   ├─ Posizione: x (0=centro), y_centro (calcolato), z (0=centro)
   ├─ Rotazioni: rx/ry/rz in gradi (0 se assente)
   └─ Colore HEX dalla palette infernale
5. NOTE DI ASSEMBLAGGIO: spiega come le parti si sovrappongono e si appoggiano

SE HAI RICEVUTO UN'IMMAGINE DI RIFERIMENTO:
- Replica fedelmente proporzioni, colori dominanti e dettagli caratteristici
- **I COLORI DELL'IMMAGINE HANNO PRIORITÀ ASSOLUTA sulla palette infernale**. Se la poltrona è verde, resta verde (usa #2d5020, #3a6b28, #4a8835 o hex esatti dall'analisi). Se il barile è blu, resta blu. NON convertire automaticamente tutto in toni bruciati/rossastri.
- La palette infernale qui sotto è un FALLBACK per quando non hai riferimenti visivi o per testo generico ("barile infernale").
- Se l'analisi visiva ha indicato colori hex specifici per parte, USA quegli hex — non rimpiazzarli.

═══ PALETTE COLORI (FALLBACK — solo per generazioni da solo testo, NON sovrascrive colori immagine) ═══
Pietra scura    : #0f0c0a #1a1410 #2d2218 #3d3025 #4a3820 #5a4830
Legno bruciato  : #1a0f05 #2a1a08 #3d2510 #5c3a18 #6b4a28 #7a5535
Metallo corroso : #12120e #1e1e16 #2d2d20 #3a3830 #4a4840 #5a5550
Ferro antico    : #1a1a1a #2a2a28 #3a3530 #4a4540 #5a5550
Sangue/carne    : #2a0505 #4a0808 #6b1010 #8b1515 #aa1818 #cc2200
Fuoco/brace     : #4a2000 #6b3500 #8b4500 #b86000 #cc7700 #ff9900
Ambra/candela   : #5c4000 #7a5500 #996600 #b88800 #cc9900 #ddaa10
Osso/avorio     : #5a4a35 #6b5a45 #8b7355 #a08060 #b89470
Oro corroso     : #2a2000 #3d3005 #5c4800 #7a6200 #8b7000 #9a8010
Verde muffa     : #0f1a08 #1a2a10 #253d18 #2d4a1c #3a5a25
Ruggine         : #2a1005 #3d1808 #552010 #6b2a10 #7a3518`

const SYSTEM_JSON = `Sei un generatore JSON preciso per un motore 3D. Converti la descrizione tecnica di un oggetto 3D nel seguente JSON con SCHEMA ESATTO:

{
  "name": "Nome italiano dell'oggetto",
  "parts": [
    {
      "id": "p01",
      "label": "Nome parte italiano",
      "shape": "box",
      "w": 1.0,
      "h": 1.0,
      "d": 1.0,
      "r": 0.0,
      "x": 0.0,
      "y": 0.0,
      "z": 0.0,
      "rx": 0,
      "ry": 0,
      "rz": 0,
      "color": "#6b4a28"
    }
  ]
}

═══ REGOLE ASSOLUTE (qualsiasi violazione produce un JSON inutilizzabile) ═══

SHAPES E DIMENSIONI:
1. "shape" deve essere ESATTAMENTE una di: "box", "sphere", "cylinder", "cone"
2. shape "box"      → usa w (larghezza), h (altezza), d (profondità). Imposta r=0
3. shape "sphere"   → usa r (raggio). Imposta w=0, h=0, d=0
4. shape "cylinder" → usa r (raggio) e h (altezza). Imposta w=0, d=0
5. shape "cone"     → usa r (raggio base) e h (altezza). Imposta w=0, d=0
6. Tutti i campi w, h, d, r DEVONO essere sempre presenti anche se valgono 0
7. Tutti i valori numerici DEVONO essere numeri JSON puri (non stringhe: scrivi 0.5 non "0.5")

POSIZIONAMENTO Y — REGOLA CRITICA:
8. y=0 è il pavimento. Il campo "y" è il CENTRO GEOMETRICO della parte, NON il fondo.
   Formula: y = y_base_inferiore + (dimensione_verticale / 2)

   Esempi corretti per parti impilate:
   ┌ Gamba h=0.74 poggiata a terra:      y = 0 + 0.74/2 = 0.37
   ├ Piano h=0.05 con fondo a y=0.74:    y = 0.74 + 0.05/2 = 0.765
   ├ Coperchio h=0.08 con fondo a y=0.4: y = 0.40 + 0.08/2 = 0.44
   ├ Cylinder r=0.3 h=0.9 a terra:       y = 0 + 0.9/2 = 0.45
   └ Sphere r=0.15 sopra piano a y=0.79: y = 0.79 + 0.15 = 0.94 (r=raggio, non h)

   ATTENZIONE sphere: y = y_base_appoggio + r  (il centro della sfera è a r dal fondo)

POSIZIONAMENTO X e Z:
9. x=0, z=0 è il centro dell'oggetto. Usa valori simmetrici per parti speculari.
   Esempio 4 gambe tavolo: x=±0.55, z=±0.25 (o adattati alle dimensioni)

ROTAZIONI:
10. rx, ry, rz sono gradi (float o int). Usa 0 se non necessario.
    Esempi utili: rz=45 per elementi inclinati, ry=45 per ruotare un box a rombo in pianta

SFERE A DIAMETRO VARIABILE per forme organiche/tondeggianti:
10b. Per vasi, urne, brocche, sacchi, corpi panciuti, cupole: usa una PILA DI SFERE sovrapposte a r variabile.
     Le sfere si sovrappongono intenzionalmente — i vuoti si nascondono, la sagoma risulta continua.
     Esempio vaso (h~0.55): sphere r=0.12 y=0.12 | sphere r=0.20 y=0.32 | sphere r=0.18 y=0.50 | sphere r=0.12 y=0.62
     + cylinder r=0.07 h=0.08 collo | cylinder r=0.10 h=0.02 orlo | sphere r=0.13 coperchio | sphere r=0.04 pomello
     NON usare mai un singolo box o cylinder per rappresentare un vaso, un'urna o qualsiasi forma sferica/panciuta.
     Disco/piatto/sottocoppa = cylinder con h=0.02-0.04 e r grande (0.15-0.35).

FORME CURVE CON CONI:
10c. Per simulare sagome curve/ricurve/affusolate (corna, zanne, mezzelune, archi, becchi, fiamme),
     costruisci CATENE DI CONI (3-5 coni concatenati) con rotazioni progressive.
     Il cono di default ha la punta in +y; usa rz per inclinarlo sul piano frontale, rx per inclinarlo in profondità.
     Esempio corno a mezzaluna (lato sinistro): 4 coni a r_base decrescente (0.08→0.02), h simile (0.18→0.10),
     con rz che passa da -20 a -95 gradi e x, y che seguono l'arco.
     NON rappresentare mai un corno o una zanna come un singolo cilindro dritto.

COERENZA GEOMETRICA:
11. Le dimensioni devono essere fisicamente coerenti con la descrizione.
    Una sedia NON può avere gambe h=2.0. Un barile NON può avere r=2.0.
    Rispetta rigorosamente le dimensioni dalla descrizione tecnica ricevuta.

NUMERO DI PARTI:
12. Genera tra 8 e 24 parti. Punta a 10-14 per oggetti semplici, 16-24 per soggetti complessi (personaggi, creature, scene).
    Separa ogni elemento visivamente distinto (es. 4 gambe tavolo = 4 parti; 2 bracci + 2 avambracci + 2 mani di un personaggio = 6 parti).

VISIBILITÀ DEGLI ELEMENTI DI SUPERFICIE (ANTE, CASSETTI, PANNELLI):
13. I pannelli frontali (ante, cassetti, sportelli) DEVONO sporgere dal corpo del contenitore.
    Regola: z_pannello = (d_corpo / 2) + (spessore_pannello / 2) + 0.005
    Se z_pannello è minore del bordo del corpo, il pannello sparisce dentro la cassa — è un errore.
14. Maniglie e pomelli sporgono ancora più avanti: z_maniglia = z_faccia_pannello + r + 0.005
15. Le parti decorative (frontali, maniglie, elementi distintivi) devono avere COLORE CONTRASTANTE rispetto alla cassa.
    Esempio credenza: cassa #3d2510, frontali #6b4a28, maniglie #2a2a28
16. Ometti elementi troppo piccoli per essere visibili (cerniere < 0.06m, chiodini, decorazioni < 0.02m).

OUTPUT:
17. Restituisci SOLO il JSON valido — zero markdown (no \`\`\`), zero testo prima o dopo, zero commenti`

// ── POST /api/ai/generate-supply ───────────────────────────────────────────────
router.post('/generate-supply', requireAuth, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(503).json({ error: 'GEMINI_API_KEY non configurata nel server' })
  }

  const { description, imageBase64, imageMime, useWebSearch } = req.body
  if (!description?.trim()) {
    return res.status(400).json({ error: 'Descrizione mancante' })
  }

  try {
    const chain = []
    let webResearch = null
    let autoImage = null           // { base64, mime, url } se scaricata
    let effectiveImageB64  = imageBase64
    let effectiveImageMime = imageMime
    let imageSource = imageBase64 ? 'user' : null   // 'user' | 'auto' | null

    // ── Step 0 (opzionale): ricerca web con grounding ──────────────────────────
    if (useWebSearch) {
      const user0 = `Oggetto da cercare: "${description.trim()}"\n\nCerca riferimenti visivi reali e sintetizza per la progettazione 3D. Restituisci anche URL immagini alla fine come specificato.`
      console.log('\n[AI] ── STEP 0: WEB SEARCH ─────────────────────────────────')
      console.log(user0)

      try {
        const r = await callGemini(apiKey, SYSTEM_WEB_RESEARCH, user0, {
          tools: [{ google_search: {} }],
          maxOutputTokens: 4096,
        })
        webResearch = r.text
        console.log('[AI] ── STEP 0: RESPONSE ──────────────────────────────────')
        console.log(webResearch)

        // Se l'utente NON ha caricato un'immagine, prova a scaricarne una
        // dai candidati trovati da Gemini
        let autoImageLog = ''
        if (!imageBase64) {
          const candidates = extractImageUrls(webResearch)
          console.log(`[AI] Step 0b: ${candidates.length} URL candidati trovati`)
          for (const url of candidates) {
            try {
              console.log(`[AI] Tentativo download: ${url}`)
              const dl = await fetchImageAsBase64(url, 8000)
              autoImage = { base64: dl.base64, mime: dl.mime, url, size: dl.size }
              effectiveImageB64  = dl.base64
              effectiveImageMime = dl.mime
              imageSource = 'auto'
              autoImageLog = `\n\n[AUTO-IMAGE] scaricata da ${url} (${dl.mime}, ${(dl.size/1024).toFixed(1)}KB)`
              console.log(`[AI] ✓ Immagine scaricata: ${(dl.size/1024).toFixed(1)}KB ${dl.mime}`)
              break
            } catch (dlErr) {
              console.log(`[AI] ✗ Download fallito (${url}): ${dlErr.message}`)
            }
          }
          if (!autoImage) autoImageLog = '\n\n[AUTO-IMAGE] nessun URL valido scaricabile'
        }

        chain.push({
          step: 0,
          label: 'Ricerca web (grounding)' + (autoImage ? ' + immagine auto' : ''),
          system: SYSTEM_WEB_RESEARCH,
          user: user0,
          response: webResearch + autoImageLog,
          grounding: r.grounding,
          autoImage: autoImage ? { url: autoImage.url, mime: autoImage.mime, size: autoImage.size } : null,
        })
      } catch (searchErr) {
        console.warn('[AI] Web search fallita, procedo senza:', searchErr.message)
        chain.push({
          step: 0,
          label: 'Ricerca web (fallita)',
          system: SYSTEM_WEB_RESEARCH,
          user: user0,
          response: `[ERRORE ricerca web: ${searchErr.message}]`,
        })
      }
    }

    // ── Step 0.5: analisi dettagliata dell'immagine (se presente) ─────────────
    let imageAnalysis = null
    if (effectiveImageB64) {
      const user05 = `Analizza l'immagine allegata in modo estremamente dettagliato seguendo la struttura richiesta. L'utente ha descritto il soggetto come: "${description.trim()}".`
      console.log('\n[AI] ── STEP 0.5: ANALISI IMMAGINE ────────────────────────')
      try {
        const r05 = await callGemini(apiKey, SYSTEM_IMAGE_ANALYSIS, user05, {
          imageBase64: effectiveImageB64,
          imageMime:   effectiveImageMime,
          maxOutputTokens: 8192,
        })
        imageAnalysis = r05.text
        console.log('[AI] ── STEP 0.5: RESPONSE ─────────────────────────────────')
        console.log(imageAnalysis)
        chain.push({
          step: 0.5,
          label: `Analisi immagine (${imageSource})`,
          system: SYSTEM_IMAGE_ANALYSIS,
          user: user05 + `\n\n[+ immagine: ${imageSource === 'auto' ? autoImage.url : 'upload utente'}]`,
          response: imageAnalysis,
        })
      } catch (anErr) {
        console.warn('[AI] Analisi immagine fallita, procedo senza:', anErr.message)
      }
    }

    // ── Step 1: espansione descrizione (con eventuale analisi + ricerca web) ──
    const user1Parts = [`Descrizione utente: "${description.trim()}"`]
    if (imageAnalysis) user1Parts.push(`ANALISI VISIVA STRUTTURATA dell'immagine di riferimento (usa questa come GUIDA STRUTTURALE PRIMARIA — silhouette, parti, proporzioni, colori):\n${imageAnalysis}`)
    else if (imageSource === 'user') user1Parts.push(`È allegata un'immagine di riferimento caricata dall'utente: usala come GUIDA PRIMARIA per forma, proporzioni, colori dominanti e dettagli distintivi.`)
    else if (imageSource === 'auto') user1Parts.push(`È allegata un'immagine di riferimento scaricata automaticamente dal web (fonte: ${autoImage.url}): usala come guida visiva per forma, proporzioni, colori dominanti e dettagli distintivi.`)
    if (webResearch)  user1Parts.push(`Sintesi di ricerca web:\n${webResearch.replace(/IMAGE_URLS?:.*$/is, '').trim()}`)
    user1Parts.push('Espandi in scheda tecnica 3D dettagliata. RISPETTA FEDELMENTE la struttura dall\'analisi visiva se presente — non trasformare il soggetto in un archetipo diverso. I COLORI dell\'immagine (se presente) hanno priorità assoluta: NON rimpiazzarli con toni infernali. Se il soggetto è verde, resta verde. Per forme CURVE/AFFUSOLATE (corna, zanne, archi, mezzelune, lame, code) scomponi in CATENE DI 3-5 CONI con rotazioni progressive. Per forme TONDEGGIANTI/PANCIUTE (vasi, urne, brocche, sacchi, cupole) usa PILE DI SFERE a r variabile sovrapposte — mai un box o cylinder singolo per queste forme.')
    const user1 = user1Parts.join('\n\n')

    console.log('\n[AI] ── STEP 1: USER ───────────────────────────────────────')
    console.log(user1)
    console.log(effectiveImageB64 ? `[AI] + immagine (${imageSource}, ${effectiveImageB64.length} chars b64, mime=${effectiveImageMime})` : '[AI] nessuna immagine')

    const r1 = await callGemini(apiKey, SYSTEM_EXPAND, user1, {
      imageBase64: effectiveImageB64,
      imageMime:   effectiveImageMime,
    })
    const expanded = r1.text

    console.log('[AI] ── STEP 1: RESPONSE ───────────────────────────────────')
    console.log(expanded)
    const s1Label = imageSource === 'user' ? 'Espansione descrizione (+ immagine utente)'
                  : imageSource === 'auto' ? 'Espansione descrizione (+ immagine auto dal web)'
                  : 'Espansione descrizione'
    const s1UserLog = effectiveImageB64
      ? user1 + `\n\n[+ immagine di riferimento allegata: ${imageSource === 'auto' ? autoImage.url : 'uploadata dall\'utente'}]`
      : user1
    chain.push({
      step: 1,
      label: s1Label,
      system: SYSTEM_EXPAND,
      user: s1UserLog,
      response: expanded,
    })

    // ── Step 2: genera il JSON geometry dalla descrizione espansa ──────────────
    const user2 = `Descrizione 3D dell'oggetto:\n${expanded}\n\nGenera il JSON esatto.`
    console.log('\n[AI] ── STEP 2: USER ───────────────────────────────────────')
    console.log(user2)

    const r2 = await callGemini(apiKey, SYSTEM_JSON, user2)
    const rawJson = r2.text

    console.log('[AI] ── STEP 2: RESPONSE ───────────────────────────────────')
    console.log(rawJson)
    chain.push({ step: 2, label: 'Generazione JSON', system: SYSTEM_JSON, user: user2, response: rawJson })

    // ── Parsing e validazione (con eventuale retry di riparazione) ────────────
    let parsed
    let parseAttempt = tryParseJson(rawJson)
    if (!parseAttempt.ok) {
      console.warn('[AI] Parse JSON fallito:', parseAttempt.error)
      console.warn('[AI] Snippet (first 400):', (parseAttempt.snippet || rawJson).slice(0, 400))

      // Retry: chiedi al modello di correggere il JSON
      const userRepair = `Il seguente testo doveva essere JSON valido ma contiene errori di sintassi: "${parseAttempt.error}".\n\nTesto originale:\n${rawJson}\n\nRestituisci SOLO il JSON corretto, senza markdown, senza commenti, senza testo extra. Mantieni tutti i dati (nome, parti, campi numerici) invariati, correggi solo la sintassi (virgole mancanti, parentesi, stringhe non chiuse).`
      console.log('\n[AI] ── STEP 2.5: JSON REPAIR ─────────────────────────────')
      try {
        const rRepair = await callGemini(apiKey, SYSTEM_JSON, userRepair, { maxOutputTokens: 8192 })
        const repairedText = rRepair.text
        console.log('[AI] ── STEP 2.5: RESPONSE ──────────────────────────────')
        console.log(repairedText)
        chain.push({ step: 2.5, label: 'Riparazione JSON', system: SYSTEM_JSON, user: userRepair, response: repairedText })
        const retry = tryParseJson(repairedText)
        if (retry.ok) {
          parsed = retry.value
        } else {
          console.error('[AI] Retry parse fallito:', retry.error)
          return res.status(422).json({
            error: 'Il modello ha restituito JSON non valido anche dopo retry: ' + retry.error,
            chain,
          })
        }
      } catch (repairErr) {
        console.error('[AI] Repair call fallita:', repairErr.message)
        return res.status(422).json({
          error: 'Il modello ha restituito JSON non valido: ' + parseAttempt.error,
          chain,
        })
      }
    } else {
      parsed = parseAttempt.value
      if (parseAttempt.repaired) console.log('[AI] JSON riparato localmente (sanitize)')
    }

    // Normalizzazione parti
    const VALID_SHAPES = new Set(['box', 'sphere', 'cylinder', 'cone'])
    const parts = (parsed.parts || parsed).map((p, i) => ({
      id:    p.id    || `p${String(i + 1).padStart(2, '0')}`,
      label: p.label || `Parte ${i + 1}`,
      shape: VALID_SHAPES.has(p.shape) ? p.shape : 'box',
      w:     Number(p.w  ?? 0),
      h:     Number(p.h  ?? 0),
      d:     Number(p.d  ?? 0),
      r:     Number(p.r  ?? 0),
      x:     Number(p.x  ?? 0),
      y:     Number(p.y  ?? 0),
      z:     Number(p.z  ?? 0),
      rx:    Number(p.rx ?? 0),
      ry:    Number(p.ry ?? 0),
      rz:    Number(p.rz ?? 0),
      color: typeof p.color === 'string' && p.color.startsWith('#') ? p.color : '#6b4a28',
    }))

    res.json({
      name:     parsed.name || description.trim(),
      expanded,
      geometry: { v: 1, parts },
      chain,
      autoImage: autoImage ? {
        url:  autoImage.url,
        mime: autoImage.mime,
        size: autoImage.size,
        dataUrl: `data:${autoImage.mime};base64,${autoImage.base64}`,
      } : null,
    })

  } catch (err) {
    console.error('[ai] generate-supply error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
