/**
 * monsterSfx.js — Motore procedurale suoni mostri
 *
 * SCHEMA JSON (salvato in monster.sounds):
 * ─────────────────────────────────────────
 * Ogni suono è un oggetto con:
 *
 *   mood      string   Descrittore semantico per LLM: "aggressive"|"ethereal"|
 *                      "mechanical"|"organic"|"infernal"|"ghostly"
 *   intensity  0–1     Volume/aggressività complessiva (LLM: più alto = più forte/duro)
 *   layers     Array   Strati audio sovrapposti (vedere Layer sotto)
 *   dur        sec     Durata totale in secondi
 *   crush      0–1     Distorsione/bitcrusher (0=pulito, 1=maxdistorto)
 *   room       0–1     Riverbero sintetico (0=asciutto, 1=grande stanza)
 *
 * LAYER:
 *   src        "osc"|"noise"
 *   wave       "sine"|"square"|"saw"|"tri"   (solo src:osc)
 *   noiseColor "white"|"pink"|"brown"        (solo src:noise)
 *   freq       Hz base                       (solo src:osc)
 *   freqSweep  {from, to, curve:"lin"|"exp"} sweep di frequenza (opzionale)
 *   amp        0–1     Ampiezza del layer
 *   adsr       [a,d,s,r]  Envelope: attack/decay/sustain(0-1)/release in secondi
 *   filter     {type:"lp"|"hp"|"bp"|"off", freq:Hz, q:0–20}
 *   lfo        {wave, rate:Hz, depth:0-1, target:"amp"|"pitch"|"filter"} (opzionale)
 *
 * MOVEMENT:
 *   category   "organic_walk"|"mechanical_walk"|"fly"|"slide"
 *   loop       bool   true=continuo (fly/slide), false=ritmico (walk)
 *   rhythm     {pattern:[0–1,...], stepMs, swing:0-1}  (solo loop:false)
 *
 * ─────────────────────────────────────────
 * USO LLM: per generare suoni verosimili, fornire al LLM:
 *   - mood/intensity del mostro
 *   - categoria movimento
 *   - descrizione geometria (organic/mechanical, size, etc.)
 *   Il LLM deve rispettare i vincoli di range di ogni campo.
 * ─────────────────────────────────────────
 */

// ── seededRng (stessa convenzione del progetto) ───────────────────────────────
function seededRng(seed) {
  let s = seed | 0
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 0xFFFFFFFF }
}

function strSeed(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0 }
  return h
}

// ── Generatori random ─────────────────────────────────────────────────────────
function makeRngHelpers(rng) {
  const pick = arr => arr[Math.floor(rng() * arr.length)]
  const r    = (min, max, dec = 2) => +((min + rng() * (max - min)).toFixed(dec))
  const bool = (p = 0.5) => rng() < p
  return { pick, r, bool }
}

export function randomAlertSound(rng) {
  const { pick, r, bool } = makeRngHelpers(rng)

  const mood = pick(['aggressive', 'infernal', 'organic', 'mechanical', 'ethereal', 'ghostly'])
  const intensity = r(0.4, 1.0)

  // Layer principale: oscillatore
  const oscLayer = {
    src: 'osc',
    wave: pick(['saw', 'square', 'tri']),
    freq: r(60, 320),
    freqSweep: bool(0.6)
      ? { from: r(100, 500), to: r(30, 150), curve: pick(['exp', 'lin']) }
      : null,
    amp: r(0.4, 0.85),
    adsr: [r(0.01, 0.06), r(0.05, 0.25), r(0.1, 0.5), r(0.2, 0.9)],
    filter: { type: pick(['lp', 'bp']), freq: r(250, 2200), q: r(0.5, 5) },
    lfo: bool(0.55)
      ? { wave: 'sine', rate: r(1.5, 10), depth: r(0.08, 0.45), target: pick(['amp', 'pitch']) }
      : null,
  }

  const layers = [oscLayer]

  // Layer secondario: noise (opzionale)
  if (bool(0.65)) {
    layers.push({
      src: 'noise',
      noiseColor: pick(['brown', 'pink']),
      amp: r(0.08, 0.3),
      adsr: [r(0.005, 0.03), r(0.05, 0.2), 0, r(0.04, 0.15)],
      filter: { type: pick(['lp', 'bp']), freq: r(150, 1200), q: r(0.4, 2.5) },
      lfo: null,
    })
  }

  // Terzo layer harmonico (opzionale)
  if (bool(0.3)) {
    layers.push({
      src: 'osc',
      wave: 'sine',
      freq: r(oscLayer.freq * 1.5, oscLayer.freq * 3),
      freqSweep: null,
      amp: r(0.05, 0.2),
      adsr: [r(0.02, 0.1), r(0.1, 0.4), 0, r(0.1, 0.3)],
      filter: { type: 'lp', freq: r(400, 3000), q: 1 },
      lfo: null,
    })
  }

  return {
    mood,
    intensity,
    layers,
    dur:   r(0.3, 0.8),
    crush: bool(0.3) ? r(0.05, 0.45) : 0,
    room:  r(0.1, 0.55),
  }
}

const MOVEMENT_PATTERNS = {
  organic_walk:   [[1, 0, 0.7, 0], [1, 0, 0.6, 0, 0.4, 0], [1, 0.05, 0.8, 0.05]],
  mechanical_walk:[[1, 0, 1, 0],   [1, 0.2, 0.8, 0.2],     [1, 0, 0, 1, 0, 0]],
}

export function randomMovementSound(rng, category) {
  const { pick, r, bool } = makeRngHelpers(rng)
  if (!category) category = pick(['organic_walk', 'mechanical_walk', 'fly', 'slide'])

  // ── Continuo: fly / slide ────────────────────────────────────────────────
  if (category === 'fly' || category === 'slide') {
    const isFly = category === 'fly'
    const layers = [{
      src: 'osc',
      wave: isFly ? pick(['square', 'saw']) : 'sine',
      freq: isFly ? r(80, 260) : r(30, 100),
      freqSweep: null,
      amp: r(0.15, 0.45),
      adsr: [r(0.1, 0.4), 0, 1, r(0.1, 0.4)],
      filter: { type: isFly ? 'bp' : 'lp', freq: r(150, 900), q: r(1, 6) },
      lfo: {
        wave: 'sine',
        rate:  isFly ? r(5, 20) : r(0.2, 1.2),
        depth: isFly ? r(0.2, 0.6) : r(0.05, 0.25),
        target: isFly ? 'amp' : 'filter',
      },
    }]

    if (!isFly || bool(0.5)) {
      layers.push({
        src: 'noise',
        noiseColor: isFly ? 'white' : 'pink',
        amp: r(0.05, 0.2),
        adsr: [0.2, 0, 1, 0.2],
        filter: { type: 'bp', freq: r(200, 700), q: r(0.5, 2) },
        lfo: null,
      })
    }

    return {
      category,
      mood: isFly ? 'ethereal' : 'organic',
      loop: true,
      continuous: true,  // tono sostenuto oscillante
      bpm: null,
      layers,
      dur:   r(0.8, 1.8),
      crush: 0,
      room:  r(0.05, 0.25),
    }
  }

  // ── Ritmico con loop: organic_walk / mechanical_walk ────────────────────
  // loop:true + continuous:false = loop ritmico schedulato a BPM
  // bpm = passi per minuto (legato alla velocità del mostro in game)
  const isMech = category === 'mechanical_walk'
  const pattern = pick(MOVEMENT_PATTERNS[category])
  const bpm = r(isMech ? 100 : 80, isMech ? 220 : 180, 0)

  const stepLayer = {
    src: isMech ? 'osc' : 'noise',
    wave: 'square',
    noiseColor: 'brown',
    freq: isMech ? r(150, 700) : undefined,
    freqSweep: isMech
      ? { from: r(300, 900), to: r(80, 250), curve: 'exp' }
      : null,
    amp: r(0.4, 0.75),
    adsr: [0.002, r(isMech ? 0.02 : 0.04, isMech ? 0.07 : 0.14), 0, r(0.01, 0.06)],
    filter: {
      type: isMech ? 'hp' : 'lp',
      freq: isMech ? r(400, 2500) : r(80, 350),
      q:    r(0.5, 2.5),
    },
    lfo: null,
  }

  return {
    category,
    mood: isMech ? 'mechanical' : 'organic',
    loop: true,
    continuous: false,   // true=tono sostenuto, false=passo ritmico schedulato
    bpm,                 // passi/minuto — in game verrà scalato con monster.speed
    layers: [stepLayer],
    rhythm: { pattern, swing: r(0, 0.18) },
    dur:   r(0.04, 0.13),
    crush: isMech ? r(0, 0.35) : 0,
    room:  r(0.03, 0.18),
  }
}

export function randomMonsterSounds(nameOrSeed, movCategory) {
  const seed = typeof nameOrSeed === 'string' ? strSeed(nameOrSeed) : (nameOrSeed | 0)
  const rng  = seededRng(seed)
  return {
    alert:    randomAlertSound(rng),
    movement: randomMovementSound(rng, movCategory || null),
  }
}

// ── Motore di sintesi ─────────────────────────────────────────────────────────
class MonsterSoundEngine {
  constructor() { this._ctx = null }

  get ctx() {
    if (!this._ctx || this._ctx.state === 'closed')
      this._ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (this._ctx.state === 'suspended') this._ctx.resume()
    return this._ctx
  }

  // ── Noise buffer ───────────────────────────────────────────────────────────
  _makeNoiseSrc(color) {
    const ctx = this.ctx
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d   = buf.getChannelData(0)
    if (color === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    } else if (color === 'pink') {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0
      for (let i = 0; i < len; i++) {
        const w = Math.random()*2-1
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980
        d[i] = (b0+b1+b2+b3+b4+b5+w*0.5362)*0.11
      }
    } else { // brown
      let last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random()*2-1; last = (last+0.02*w)/1.02; d[i] = last*3.5
      }
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    return src
  }

  // ── Reverb sintetico (nessun file IR) ──────────────────────────────────────
  _makeReverb(room) {
    const ctx   = this.ctx
    const dur   = 0.3 + room * 2.5
    const len   = Math.floor(ctx.sampleRate * dur)
    const buf   = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++)
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 1.5)
    }
    const conv  = ctx.createConvolver(); conv.buffer = buf
    const dry   = ctx.createGain(); dry.gain.value  = 1 - room * 0.6
    const wet   = ctx.createGain(); wet.gain.value  = room * 0.6
    const merge = ctx.createGain(); merge.gain.value = 1
    dry.connect(merge); conv.connect(wet); wet.connect(merge)
    return { input: dry, convInput: conv, output: merge }
  }

  // ── Distorsione ────────────────────────────────────────────────────────────
  _makeDistortion(amount) {
    const ctx = this.ctx
    const ws  = ctx.createWaveShaper()
    const n = 256; const curve = new Float32Array(n); const k = amount * 150
    for (let i = 0; i < n; i++) {
      const x = (i*2)/n - 1
      curve[i] = k ? ((Math.PI+k)*x)/(Math.PI+k*Math.abs(x)) : x
    }
    ws.curve = curve; ws.oversample = '4x'
    return ws
  }

  // ── Sintetizza un layer ────────────────────────────────────────────────────
  _synthLayer(layer, dest, t, dur, masterAmp = 1) {
    const ctx = this.ctx

    // Source
    let src
    if (layer.src === 'noise') {
      src = this._makeNoiseSrc(layer.noiseColor || 'white')
    } else {
      src = ctx.createOscillator()
      const waveMap = { sine:'sine', square:'square', saw:'sawtooth', tri:'triangle' }
      src.type = waveMap[layer.wave] || 'sawtooth'
      src.frequency.value = layer.freq || 220
      if (layer.freqSweep) {
        const fs = layer.freqSweep
        src.frequency.setValueAtTime(fs.from, t)
        if (fs.curve === 'exp')
          src.frequency.exponentialRampToValueAtTime(Math.max(fs.to, 1), t + dur)
        else
          src.frequency.linearRampToValueAtTime(fs.to, t + dur)
      }
    }

    // Envelope
    const env = ctx.createGain(); env.gain.value = 0
    const [a, d, s, r] = layer.adsr || [0.01, 0.1, 0.5, 0.2]
    const peak = (layer.amp ?? 0.5) * masterAmp
    const sus  = peak * Math.max(0, Math.min(1, s))
    const envEnd = t + Math.max(dur, a + d + 0.01)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(peak, t + a)
    env.gain.linearRampToValueAtTime(sus, t + a + d)
    env.gain.setValueAtTime(sus, envEnd - r)
    env.gain.linearRampToValueAtTime(0, envEnd)

    // Filter
    let node = env
    if (layer.filter && layer.filter.type !== 'off') {
      const flt = ctx.createBiquadFilter()
      const typeMap = { lp:'lowpass', hp:'highpass', bp:'bandpass' }
      flt.type = typeMap[layer.filter.type] || 'lowpass'
      flt.frequency.value = layer.filter.freq || 1000
      flt.Q.value = layer.filter.q ?? 1
      env.connect(flt); node = flt

      // LFO on filter
      if (layer.lfo?.target === 'filter') {
        const lfo = ctx.createOscillator(); lfo.type = 'sine'
        lfo.frequency.value = layer.lfo.rate || 2
        const lg = ctx.createGain(); lg.gain.value = (layer.lfo.depth||0.2) * (layer.filter.freq||1000)
        lfo.connect(lg); lg.connect(flt.frequency)
        lfo.start(t); lfo.stop(t + dur + 0.2)
      }
    }
    node.connect(dest)

    // LFO on amp
    if (layer.lfo && layer.lfo.target === 'amp') {
      const lfo = ctx.createOscillator(); lfo.type = 'sine'
      lfo.frequency.value = layer.lfo.rate || 4
      const lg = ctx.createGain(); lg.gain.value = (layer.lfo.depth||0.2) * peak
      lfo.connect(lg); lg.connect(env.gain)
      lfo.start(t); lfo.stop(t + dur + 0.2)
    }

    // LFO on pitch
    if (layer.lfo && layer.lfo.target === 'pitch' && src.frequency) {
      const lfo = ctx.createOscillator(); lfo.type = 'sine'
      lfo.frequency.value = layer.lfo.rate || 5
      const lg = ctx.createGain(); lg.gain.value = (layer.lfo.depth||0.2) * (layer.freq||220)
      lfo.connect(lg); lg.connect(src.frequency)
      lfo.start(t); lfo.stop(t + dur + 0.2)
    }

    src.connect(env)
    src.start(t)
    src.stop(t + dur + 0.3)
    return src
  }

  // ── Catena output con crush + reverb ──────────────────────────────────────
  _makeChain(crush, room) {
    const ctx = this.ctx
    const master = ctx.createGain(); master.gain.value = 0.75
    let last = master

    if (crush > 0.02) {
      const dist = this._makeDistortion(crush)
      last.connect(dist); last = dist
    }

    if (room > 0.05) {
      const rev = this._makeReverb(room)
      last.connect(rev.input)
      last.connect(rev.convInput)
      rev.output.connect(ctx.destination)
    } else {
      last.connect(ctx.destination)
    }
    return master
  }

  // ── API pubblica ───────────────────────────────────────────────────────────

  playAlert(soundDef) {
    if (!soundDef?.layers?.length) return { stop: () => {} }
    const ctx  = this.ctx
    const t    = ctx.currentTime + 0.04
    const dur  = soundDef.dur || 1.2
    const dest = this._makeChain(soundDef.crush || 0, soundDef.room || 0)
    for (const layer of soundDef.layers)
      this._synthLayer(layer, dest, t, dur, soundDef.intensity ?? 1)
    return {
      stop: () => {
        const now = ctx.currentTime
        dest.gain.setValueAtTime(dest.gain.value, now)
        dest.gain.linearRampToValueAtTime(0, now + 0.08)
      }
    }
  }

  playMovementStep(soundDef) {
    if (!soundDef?.layers?.length || soundDef.loop) return
    const ctx  = this.ctx
    const t    = ctx.currentTime + 0.01
    const dur  = soundDef.dur || 0.08
    const dest = this._makeChain(soundDef.crush || 0, soundDef.room || 0)
    for (const layer of soundDef.layers)
      this._synthLayer(layer, dest, t, dur, soundDef.intensity ?? 0.8)
  }

  // Avvia loop movimento — restituisce { stop }
  // continuous:true  → tono sostenuto (fly/slide)
  // continuous:false → passi ritmici schedulati a BPM (walk)
  startMovementLoop(soundDef, bpmOverride) {
    if (!soundDef?.layers?.length || !soundDef.loop) return null
    const ctx    = this.ctx
    const master = ctx.createGain(); master.gain.value = 0
    master.connect(ctx.destination)
    let stopped = false

    if (soundDef.continuous === false) {
      // ── Ritmico ────────────────────────────────────────────────────────────
      const bpm     = bpmOverride || soundDef.bpm || 160
      const stepMs  = Math.round(60000 / bpm)
      const pattern = soundDef.rhythm?.pattern || [1, 0, 1, 0]
      const swing   = soundDef.rhythm?.swing   || 0
      const dur     = soundDef.dur || 0.08
      const amp     = soundDef.intensity ?? 0.8

      master.gain.setValueAtTime(0.7, ctx.currentTime)

      let stepIdx = 0
      const tick = () => {
        if (stopped) return
        const vol = pattern[stepIdx % pattern.length] ?? 0
        if (vol > 0) {
          const g = ctx.createGain(); g.gain.value = vol
          g.connect(master)
          const t = ctx.currentTime + 0.005
          for (const layer of soundDef.layers)
            this._synthLayer(layer, g, t, dur, amp * vol)
        }
        stepIdx++
        // Swing: passo pari leggermente anticipato, dispari ritardato
        const delay = stepMs + (stepIdx % 2 === 0 ? -swing * stepMs * 0.5 : swing * stepMs * 0.5)
        if (!stopped) setTimeout(tick, Math.max(delay, 20))
      }
      tick()

      return {
        stop: () => {
          if (stopped) return; stopped = true
          const now = ctx.currentTime
          master.gain.setValueAtTime(master.gain.value, now)
          master.gain.linearRampToValueAtTime(0, now + 0.1)
        }
      }
    }

    // ── Tono sostenuto (fly/slide) ───────────────────────────────────────────
    master.gain.linearRampToValueAtTime(0.5 * (soundDef.intensity ?? 0.8), ctx.currentTime + 0.4)
    const nodes = []
    for (const layer of soundDef.layers) {
      const node = this._synthLayer(layer, master, ctx.currentTime, 9999, soundDef.intensity ?? 0.8)
      nodes.push(node)
    }
    return {
      stop: () => {
        if (stopped) return; stopped = true
        const now = ctx.currentTime
        master.gain.setValueAtTime(master.gain.value, now)
        master.gain.linearRampToValueAtTime(0, now + 0.25)
        setTimeout(() => nodes.forEach(n => { try { n.stop() } catch {} }), 400)
      }
    }
  }

  // Utility: play un passo del ritmo con volume scalato dal pattern
  playRhythmStep(soundDef, stepVol) {
    if (!soundDef?.layers?.length || soundDef.loop || stepVol <= 0) return
    const ctx  = this.ctx
    const t    = ctx.currentTime + 0.01
    const dur  = soundDef.dur || 0.08
    const dest = this._makeChain(soundDef.crush || 0, soundDef.room || 0)
    for (const layer of soundDef.layers)
      this._synthLayer(layer, dest, t, dur, (soundDef.intensity ?? 0.8) * stepVol)
  }
}

export const monsterSfx = new MonsterSoundEngine()

// ── Costanti schema (per UI e validazione) ────────────────────────────────────
export const MOVEMENT_CATEGORIES = [
  { value: 'organic_walk',   label: 'Passo organico',    icon: '🦶' },
  { value: 'mechanical_walk',label: 'Passo meccanico',   icon: '⚙' },
  { value: 'fly',            label: 'Volo / Ronzio',     icon: '〜' },
  { value: 'slide',          label: 'Scivolamento',      icon: '≈' },
]

export const MOOD_COLORS = {
  aggressive: '#cc2200', infernal: '#ff4400', mechanical: '#4488cc',
  organic:    '#448833', ethereal: '#aa44cc', ghostly:    '#88aacc',
}
