// ── Procedural Sound Engine (Web Audio API) ──────────────────────────────────

export class SoundEngine {
  constructor() {
    this._ctx = null
  }

  get ctx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this._ctx.state === 'suspended') this._ctx.resume()
    return this._ctx
  }

  // White noise buffer of given duration (seconds)
  _noiseBuf(duration) {
    const ctx = this.ctx
    const n = Math.floor(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    return src
  }

  // ── Sparo ─────────────────────────────────────────────────────────────────
  shoot() {
    const ctx = this.ctx
    const t = ctx.currentTime

    // Boom: oscillatore che scende di frequenza
    const boom = ctx.createOscillator()
    boom.type = 'sawtooth'
    boom.frequency.setValueAtTime(200, t)
    boom.frequency.exponentialRampToValueAtTime(28, t + 0.28)
    const boomGain = ctx.createGain()
    boomGain.gain.setValueAtTime(1.4, t)
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    boom.connect(boomGain)
    boomGain.connect(ctx.destination)
    boom.start(t); boom.stop(t + 0.28)

    // Crack: burst di rumore filtrato (parte acuta dello sparo)
    const crack = this._noiseBuf(0.1)
    const crackFilter = ctx.createBiquadFilter()
    crackFilter.type = 'bandpass'
    crackFilter.frequency.value = 1200
    crackFilter.Q.value = 0.7
    const crackGain = ctx.createGain()
    crackGain.gain.setValueAtTime(1.1, t)
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    crack.connect(crackFilter)
    crackFilter.connect(crackGain)
    crackGain.connect(ctx.destination)
    crack.start(t); crack.stop(t + 0.1)

    // Coda reverb simulata: secondo burst ritardato e attenuato
    const tail = this._noiseBuf(0.18)
    const tailFilter = ctx.createBiquadFilter()
    tailFilter.type = 'lowpass'
    tailFilter.frequency.value = 600
    const tailGain = ctx.createGain()
    tailGain.gain.setValueAtTime(0.001, t + 0.06)
    tailGain.gain.linearRampToValueAtTime(0.3, t + 0.09)
    tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    tail.connect(tailFilter)
    tailFilter.connect(tailGain)
    tailGain.connect(ctx.destination)
    tail.start(t + 0.06); tail.stop(t + 0.24)
  }

  // ── Passo ─────────────────────────────────────────────────────────────────
  // Ogni passo è leggermente diverso grazie alla variazione casuale
  footstep() {
    const ctx = this.ctx
    const t = ctx.currentTime
    const pitch = 80 + Math.random() * 30   // 80–110 Hz
    const vol = 0.45 + Math.random() * 0.15  // variazione volume

    // Tono basso (impatto del piede)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(pitch, t)
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.45, t + 0.09)
    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(vol, t)
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.1)

    // Strisciamento sulla pietra: rumore basso freq
    const scrape = this._noiseBuf(0.055)
    const scrapeFilter = ctx.createBiquadFilter()
    scrapeFilter.type = 'lowpass'
    scrapeFilter.frequency.value = 350
    const scrapeGain = ctx.createGain()
    scrapeGain.gain.setValueAtTime(vol * 0.4, t)
    scrapeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055)
    scrape.connect(scrapeFilter)
    scrapeFilter.connect(scrapeGain)
    scrapeGain.connect(ctx.destination)
    scrape.start(t); scrape.stop(t + 0.055)
  }

  // ── Collisione muro ───────────────────────────────────────────────────────
  wallHit() {
    const ctx = this.ctx
    const t = ctx.currentTime

    // Botta sorda
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(58, t)
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.14)
    const thudGain = ctx.createGain()
    thudGain.gain.setValueAtTime(0.8, t)
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    osc.connect(thudGain)
    thudGain.connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.14)

    // Impatto: scatto breve di rumore
    const impact = this._noiseBuf(0.035)
    const impFilter = ctx.createBiquadFilter()
    impFilter.type = 'lowpass'
    impFilter.frequency.value = 400
    const impGain = ctx.createGain()
    impGain.gain.setValueAtTime(0.55, t)
    impGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
    impact.connect(impFilter)
    impFilter.connect(impGain)
    impGain.connect(ctx.destination)
    impact.start(t); impact.stop(t + 0.035)
  }

  dispose() {
    this._ctx?.close()
    this._ctx = null
  }
}
