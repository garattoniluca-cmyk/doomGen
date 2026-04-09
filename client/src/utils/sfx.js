/**
 * SoundManager — procedural Web Audio API sounds for DoomGen UI
 * No audio files. Two sounds: hover (ascending blip) + click (descending punch).
 */
class SoundManager {
  constructor() {
    this._ctx       = null
    this._muted     = localStorage.getItem('dg_sfx_muted') === '1'
    this._lastHover = 0          // timestamp of last hover sound
    this._lastEl    = null       // last element that triggered hover
  }

  // ── AudioContext (lazy, unlocked on first interaction) ────────────────────
  get ctx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this._ctx.state === 'suspended') this._ctx.resume()
    return this._ctx
  }

  get muted() { return this._muted }

  toggle() {
    this._muted = !this._muted
    localStorage.setItem('dg_sfx_muted', this._muted ? '1' : '0')
    // Play a confirm sound on unmute
    if (!this._muted) setTimeout(() => this._playHoverRaw(), 20)
    return this._muted
  }

  // ── Public API ────────────────────────────────────────────────────────────
  /**
   * Play hover only when entering a NEW interactive element.
   * @param {Element} el  — the element being entered
   */
  hover(el) {
    if (this._muted) return
    if (el === this._lastEl) return
    const now = performance.now()
    if (now - this._lastHover < 55) { this._lastEl = el; return } // debounce 55 ms
    this._lastEl    = el
    this._lastHover = now
    this._playHoverRaw()
  }

  click() {
    if (this._muted) return
    this._playClickRaw()
  }

  // ── Procedural sounds ─────────────────────────────────────────────────────

  /** Short ascending 8-bit blip  880→1320 Hz, 55 ms */
  _playHoverRaw() {
    try {
      const c = this.ctx
      const t = c.currentTime

      const osc = c.createOscillator()
      const g   = c.createGain()
      osc.connect(g)
      g.connect(c.destination)

      osc.type = 'square'
      osc.frequency.setValueAtTime(880, t)
      osc.frequency.linearRampToValueAtTime(1320, t + 0.04)

      g.gain.setValueAtTime(0.0, t)
      g.gain.linearRampToValueAtTime(0.032, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055)

      osc.start(t)
      osc.stop(t + 0.055)
    } catch { /* AudioContext not ready */ }
  }

  /**
   * Descending square-wave punch  660→110 Hz (90 ms)
   * + short white-noise burst (18 ms) for tactile click feel
   */
  _playClickRaw() {
    try {
      const c = this.ctx
      const t = c.currentTime

      // — Tone layer —
      const osc = c.createOscillator()
      const gOsc = c.createGain()
      osc.connect(gOsc)
      gOsc.connect(c.destination)

      osc.type = 'square'
      osc.frequency.setValueAtTime(660, t)
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.09)

      gOsc.gain.setValueAtTime(0.0, t)
      gOsc.gain.linearRampToValueAtTime(0.11, t + 0.003)
      gOsc.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)

      osc.start(t)
      osc.stop(t + 0.1)

      // — Noise layer (tactile transient) —
      const sr    = c.sampleRate
      const len   = Math.floor(sr * 0.018)
      const buf   = c.createBuffer(1, len, sr)
      const data  = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

      const ns   = c.createBufferSource()
      const gNs  = c.createGain()
      ns.buffer  = buf
      ns.connect(gNs)
      gNs.connect(c.destination)

      gNs.gain.setValueAtTime(0.18, t)
      gNs.gain.exponentialRampToValueAtTime(0.0001, t + 0.018)

      ns.start(t)
    } catch { /* ignore */ }
  }
}

export const sfx = new SoundManager()
