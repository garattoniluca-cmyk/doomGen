import { useState, useRef, useEffect } from 'react'
import PageHeader from '../PageHeader.jsx'

const SURFACE_TYPES = ['wall', 'floor', 'ceiling']
const TYPE_LABELS = { wall: 'Pareti', floor: 'Pavimenti', ceiling: 'Soffitti' }
const PATTERNS = ['solid', 'brick', 'stone', 'metal', 'wood', 'organic']
const PATTERN_LABELS = {
  solid: 'Solido', brick: 'Mattoni', stone: 'Pietra',
  metal: 'Metallo', wood: 'Legno', organic: 'Organico'
}

const DEFAULT_FORM = {
  name: '',
  description: '',
  primaryColor: '#6b4e32',
  secondaryColor: '#3a2010',
  pattern: 'brick',
}

// Draw a pattern onto a canvas context
function drawPattern(ctx, pattern, primary, secondary, size = 128) {
  const hexToRgb = h => {
    const r = parseInt(h.slice(1, 3), 16)
    const g = parseInt(h.slice(3, 5), 16)
    const b = parseInt(h.slice(5, 7), 16)
    return `rgb(${r},${g},${b})`
  }

  ctx.fillStyle = primary
  ctx.fillRect(0, 0, size, size)

  switch (pattern) {
    case 'brick': {
      ctx.fillStyle = secondary
      for (let row = 0; row < 8; row++) {
        const offset = row % 2 === 0 ? 0 : 16
        for (let col = 0; col < 10; col++) {
          ctx.fillRect(col * 32 + offset + 1, row * 16 + 1, 29, 13)
        }
      }
      ctx.strokeStyle = secondary
      ctx.lineWidth = 1
      break
    }
    case 'stone': {
      ctx.fillStyle = secondary
      const rects = [
        [2, 2, 38, 28], [42, 2, 50, 28], [94, 2, 32, 28],
        [2, 32, 58, 26], [62, 32, 64, 26], [2, 60, 30, 26],
        [34, 60, 60, 26], [96, 60, 30, 26], [2, 88, 52, 38],
        [56, 88, 70, 38],
      ]
      rects.forEach(([x, y, w, h]) => ctx.fillRect(x, y, Math.min(w, size - x - 2), Math.min(h, size - y - 2)))
      break
    }
    case 'metal': {
      ctx.fillStyle = secondary
      for (let i = 0; i < size; i += 16) {
        ctx.fillRect(0, i, size, 2)
      }
      for (let i = 0; i < size; i += 32) {
        ctx.fillRect(i, 0, 2, size)
      }
      // Rivets
      ctx.fillStyle = hexToRgb(primary)
      const lighter = primary
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.beginPath()
          ctx.arc(col * 32 + 16, row * 16 + 8, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
    case 'wood': {
      // Wood grain lines
      for (let i = 0; i < 24; i++) {
        const x = i * (size / 24)
        const grad = ctx.createLinearGradient(x, 0, x + size / 24, 0)
        grad.addColorStop(0, primary)
        grad.addColorStop(0.5, secondary)
        grad.addColorStop(1, primary)
        ctx.fillStyle = grad
        ctx.fillRect(x, 0, size / 24 + 1, size)
      }
      break
    }
    case 'organic': {
      // Blotchy pattern
      ctx.fillStyle = secondary
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const r = 4 + Math.random() * 16
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    default: break
  }
}

function SurfacePreview({ pattern, primaryColor, secondaryColor, surfaceType }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 128, 128)
    drawPattern(ctx, pattern, primaryColor, secondaryColor)
  }, [pattern, primaryColor, secondaryColor])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      {/* Canvas texture preview */}
      <canvas ref={canvasRef} width={128} height={128}
        style={{ border: '1px solid #444', imageRendering: 'pixelated' }} />

      {/* 3D-ish mock box */}
      <div style={{ position: 'relative', width: 100, height: 80 }}>
        {surfaceType === 'wall' && (
          <canvas ref={r => {
            if (!r) return
            const ctx2 = r.getContext('2d')
            ctx2.clearRect(0, 0, 100, 80)
            // Front face
            ctx2.save()
            ctx2.scale(100 / 128, 80 / 128)
            drawPattern(ctx2, pattern, primaryColor, secondaryColor)
            ctx2.restore()
            ctx2.fillStyle = 'rgba(0,0,0,0.3)'
            ctx2.fillRect(0, 0, 100, 80)
          }} width={100} height={80} style={{ border: '1px solid #333' }} />
        )}
        {surfaceType === 'floor' && (
          <div style={{
            width: 100, height: 50,
            background: primaryColor,
            transform: 'perspective(150px) rotateX(50deg)',
            transformOrigin: 'bottom',
            border: '1px solid #333',
          }} />
        )}
        {surfaceType === 'ceiling' && (
          <div style={{
            width: 100, height: 50,
            background: primaryColor,
            transform: 'perspective(150px) rotateX(-50deg)',
            transformOrigin: 'top',
            border: '1px solid #333',
          }} />
        )}
      </div>
    </div>
  )
}

export default function SurfaceEditor() {
  const [activeType, setActiveType] = useState('wall')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [surfaces, setSurfaces] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filteredSurfaces = surfaces.filter(s => s.surfaceType === activeType)

  const generateWithAI = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/surfaces/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore server')
      setForm(f => ({
        ...f,
        name: data.name || f.name,
        primaryColor: data.primaryColor || f.primaryColor,
        secondaryColor: data.secondaryColor || f.secondaryColor,
        pattern: data.pattern || f.pattern,
        _generated: data,
      }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const saveSurface = () => {
    if (!form.name.trim()) { setError('Inserisci un nome'); return }
    const surface = { ...form, surfaceType: activeType, id: Date.now() }
    setSurfaces(s => [...s, surface])
    setSelected(surface)
    setForm(DEFAULT_FORM)
    setError('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Editor Superfici" />
      {/* Tab bar */}
      <div className="tab-bar">
        {SURFACE_TYPES.map(t => (
          <div key={t} className={`tab ${activeType === t ? 'active' : ''}`} onClick={() => setActiveType(t)}>
            {TYPE_LABELS[t]}
          </div>
        ))}
      </div>

      <div className="editor-layout" style={{ flex: 1, overflow: 'hidden' }}>
        {/* ── Left panel ── */}
        <div className="editor-panel">
          <div className="panel-section">
            <div className="panel-title">Nuova Superficie · {TYPE_LABELS[activeType]}</div>

            <div className="field">
              <label>Nome</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Es: Muro di Pietra Infernale" />
            </div>

            <div className="field">
              <label>Note (opzionale)</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Note libere sulla superficie..."
                rows={2}
              />
            </div>

            <button className="btn btn-ai" onClick={generateWithAI} disabled={loading}>
              {loading ? <><span className="spinner" />Generazione...</> : '⚙ Genera Casualmente'}
            </button>

            {error && <div style={{ color: '#ff4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
          </div>

          <div className="panel-section">
            <div className="panel-title">Colori</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>PRIMARIO</div>
                <input type="color" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                  style={{ width: 48, height: 32, cursor: 'pointer', border: 'none', background: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>SECONDARIO</div>
                <input type="color" value={form.secondaryColor} onChange={e => set('secondaryColor', e.target.value)}
                  style={{ width: 48, height: 32, cursor: 'pointer', border: 'none', background: 'none' }} />
              </div>
            </div>

            <div className="field">
              <label>Pattern</label>
              <select value={form.pattern} onChange={e => set('pattern', e.target.value)}>
                {PATTERNS.map(p => <option key={p} value={p}>{PATTERN_LABELS[p]}</option>)}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="panel-section">
            <div className="panel-title">Anteprima</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <SurfacePreview
                pattern={form.pattern}
                primaryColor={form.primaryColor}
                secondaryColor={form.secondaryColor}
                surfaceType={activeType}
              />
            </div>
          </div>

          <div className="panel-section">
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveSurface}>
              Salva Superficie
            </button>
          </div>
        </div>

        {/* ── Right: list ── */}
        <div className="editor-main" style={{ padding: 16, overflowY: 'auto' }}>
          <div className="panel-title" style={{ marginBottom: 16 }}>
            {TYPE_LABELS[activeType]} Salvate ({filteredSurfaces.length})
          </div>

          {filteredSurfaces.length === 0 && (
            <div style={{ color: '#444', fontSize: 13, textAlign: 'center', marginTop: 60 }}>
              Nessuna superficie ancora per questa categoria.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {filteredSurfaces.map(s => (
              <div key={s.id}
                onClick={() => setSelected(s)}
                style={{
                  cursor: 'pointer',
                  border: `1px solid ${selected?.id === s.id ? '#ff4400' : '#333'}`,
                  background: '#111',
                  padding: 10,
                  transition: 'border-color 0.15s',
                }}>
                {/* Mini canvas */}
                <canvas width={120} height={80} style={{ width: '100%', imageRendering: 'pixelated', display: 'block' }}
                  ref={r => {
                    if (!r) return
                    const ctx = r.getContext('2d')
                    drawPattern(ctx, s.pattern, s.primaryColor, s.secondaryColor, 120)
                  }}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 10, color: '#555' }}>{PATTERN_LABELS[s.pattern]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
