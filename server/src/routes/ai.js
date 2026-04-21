import express from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']
const GEMINI_BASE   = 'https://generativelanguage.googleapis.com/v1beta/models'

// ── Gemini call helper (con retry su modelli alternativi) ──────────────────────
async function callGemini(apiKey, systemText, userText) {
  const fullText = `${systemText}\n\n---\n\n${userText}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: fullText }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
  }

  let lastErr
  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (netErr) {
      lastErr = netErr
      continue
    }

    if (res.status === 503 || res.status === 429) {
      const errText = await res.text()
      lastErr = new Error(`Gemini HTTP ${res.status} (${model}): ${errText}`)
      // 429 = quota esaurita su questo modello → prova il prossimo
      // 503 = overload → prova il prossimo
      continue
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini HTTP ${res.status}: ${err}`)
    }

    const data = await res.json()
    const candidate = data?.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text
    const finishReason = candidate?.finishReason
    if (!text) throw new Error('Risposta Gemini vuota o malformata')
    console.log(`[AI] Modello usato: ${model} | finishReason: ${finishReason}`)
    if (finishReason === 'MAX_TOKENS') {
      console.warn('[AI] ATTENZIONE: risposta troncata per MAX_TOKENS')
    }
    return text.trim()
  }

  throw lastErr || new Error('Tutti i modelli Gemini non disponibili')
}

// ── Prompts ────────────────────────────────────────────────────────────────────
const SYSTEM_EXPAND = `Sei un art director 3D specializzato in oggetti per un dungeon infernale stile Doom (pietra corrosa, fuoco, sangue, metalli ossidati, legno bruciato).
Ti viene fornita una breve descrizione di un oggetto di arredamento/fornitura da inserire nel dungeon.

Produce una SCHEDA TECNICA 3D completa e precisa in italiano.

═══ SISTEMA DI UNITÀ ═══
1 unità di gioco = 1 metro reale. Scala obbligatoria di riferimento:
  Sedia da dungeon   : seduta 0.45w×0.45d h=0.05, gambe sezione 0.06×0.06 h=0.43, schienale fino a y=0.90
  Tavolo             : piano 1.2w×0.6d h=0.05 a y=0.74, gambe 0.06×0.06 h=0.74
  Barile piccolo     : cylinder r=0.25 h=0.55 | Barile standard: r=0.32 h=0.85
  Cassa/baule        : corpo 0.8w×0.5d h=0.4, coperchio 0.82w×0.52d h=0.08
  Torcia da parete   : supporto cylinder r=0.04 h=0.20, coppa r=0.07 h=0.08, fiamma cone r=0.05 h=0.15
  Candelabro da terra: base r=0.12 h=0.05, stelo r=0.03 h=1.10, porta-candela r=0.06 h=0.06, fiamma r=0.04 h=0.12
  Colonna            : plinto 0.5×0.5 h=0.3, fusto r=0.18 h=2.8, capitello 0.5×0.5 h=0.25
  Altare             : gradino 1.4w×1.0d h=0.2, corpo 1.2w×0.8d h=0.5, piano 1.3w×0.9d h=0.08
  Porta/cancello     : stipiti 0.12w×0.12d h=2.3, traversa 1.2w h=0.1, anta/e 0.55w h=2.2
  Trono              : seduta 0.6w×0.55d h=0.06 a y=0.48, braccioli h=0.25 su seduta, schienale h=0.90
  Scaffale           : pannelli orizzontali 1.0w×0.3d h=0.04, montanti laterali 0.06w h=1.8
  Catena/ceppi       : anelli cylinder r=0.04 h=0.04 inclinati, barra 0.05r h=1.2

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
4. PARTI (punta a 10-14 parti per oggetti complessi, minimo 6):
   Per ogni parte:
   ┌─ ID: p01, p02, ...
   ├─ Nome: italiano, descrittivo
   ├─ Shape: box | cylinder | cone | sphere
   ├─ Dimensioni: w/h/d per box; r/h per cylinder e cone; r per sphere
   ├─ Posizione: x (0=centro), y_centro (calcolato), z (0=centro)
   ├─ Rotazioni: rx/ry/rz in gradi (0 se assente)
   └─ Colore HEX dalla palette infernale
5. NOTE DI ASSEMBLAGGIO: spiega come le parti si sovrappongono e si appoggiano

═══ PALETTE COLORI INFERNALE ═══
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

COERENZA GEOMETRICA:
11. Le dimensioni devono essere fisicamente coerenti con la descrizione.
    Una sedia NON può avere gambe h=2.0. Un barile NON può avere r=2.0.
    Rispetta rigorosamente le dimensioni dalla descrizione tecnica ricevuta.

NUMERO DI PARTI:
12. Genera tra 8 e 16 parti. Punta a 10-14 per oggetti ben dettagliati.
    Separa ogni elemento visivamente distinto (es. 4 gambe = 4 parti separate).

OUTPUT:
13. Restituisci SOLO il JSON valido — zero markdown (no \`\`\`), zero testo prima o dopo, zero commenti`

// ── POST /api/ai/generate-supply ───────────────────────────────────────────────
router.post('/generate-supply', requireAuth, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(503).json({ error: 'GEMINI_API_KEY non configurata nel server' })
  }

  const { description } = req.body
  if (!description?.trim()) {
    return res.status(400).json({ error: 'Descrizione mancante' })
  }

  try {
    const chain = []

    // ── Step 1: espandi la descrizione in dettagli 3D ──────────────────────────
    const user1 = `Descrizione utente: "${description.trim()}"\n\nEspandi in descrizione 3D dettagliata per il dungeon.`
    console.log('\n[AI] ── STEP 1: SYSTEM ─────────────────────────────────────────')
    console.log(SYSTEM_EXPAND)
    console.log('[AI] ── STEP 1: USER ───────────────────────────────────────────')
    console.log(user1)

    const expanded = await callGemini(apiKey, SYSTEM_EXPAND, user1)

    console.log('[AI] ── STEP 1: RESPONSE ───────────────────────────────────────')
    console.log(expanded)
    chain.push({ step: 1, label: 'Espansione descrizione', system: SYSTEM_EXPAND, user: user1, response: expanded })

    // ── Step 2: genera il JSON geometry dalla descrizione espansa ──────────────
    const user2 = `Descrizione 3D dell'oggetto:\n${expanded}\n\nGenera il JSON esatto.`
    console.log('\n[AI] ── STEP 2: SYSTEM ─────────────────────────────────────────')
    console.log(SYSTEM_JSON)
    console.log('[AI] ── STEP 2: USER ───────────────────────────────────────────')
    console.log(user2)

    const rawJson = await callGemini(apiKey, SYSTEM_JSON, user2)

    console.log('[AI] ── STEP 2: RESPONSE ───────────────────────────────────────')
    console.log(rawJson)
    chain.push({ step: 2, label: 'Generazione JSON', system: SYSTEM_JSON, user: user2, response: rawJson })

    // ── Parsing e validazione ──────────────────────────────────────────────────
    let parsed
    try {
      // Strategia 1: estrai il blocco JSON grezzo (da { a } finale)
      const jsonMatch = rawJson.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Nessun oggetto JSON trovato nella risposta')
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('[AI] Parse error:', parseErr.message)
      console.error('[AI] Raw response (first 500):', rawJson.slice(0, 500))
      return res.status(422).json({
        error: 'Il modello ha restituito JSON non valido: ' + parseErr.message,
        chain,
      })
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
    })

  } catch (err) {
    console.error('[ai] generate-supply error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
