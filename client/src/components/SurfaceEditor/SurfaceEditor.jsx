import { useState, useRef, useEffect, useCallback } from 'react'
import PageHeader from '../PageHeader.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

// ── Config ────────────────────────────────────────────────────────────────────
const SURFACE_TYPES  = ['wall', 'floor', 'ceiling']
const TYPE_LABELS    = { wall: 'Pareti', floor: 'Pavimenti', ceiling: 'Soffitti' }

const PATTERNS = ['hellstone', 'redstone', 'lava', 'bone', 'flesh', 'metal', 'solid']
const PATTERN_LABELS = {
  hellstone: 'Pietra Infernale',
  redstone:  'Roccia Rossa',
  lava:      'Lava',
  bone:      'Ossa',
  flesh:     'Carne Demoniaca',
  metal:     'Metallo Corroso',
  solid:     'Solido',
}

// Default colors by pattern
const PATTERN_DEFAULTS = {
  hellstone: { primary: '#1a0604', secondary: '#cc1100' },
  redstone:  { primary: '#120403', secondary: '#991100' },
  lava:      { primary: '#080100', secondary: '#ff4400' },
  bone:      { primary: '#150804', secondary: '#705040' },
  flesh:     { primary: '#2a0606', secondary: '#660a0a' },
  metal:     { primary: '#0e0808', secondary: '#441010' },
  solid:     { primary: '#1a0604', secondary: '#220a06' },
}

const DEFAULT_FORM = {
  name: '', description: '',
  primaryColor:   PATTERN_DEFAULTS.hellstone.primary,
  secondaryColor: PATTERN_DEFAULTS.hellstone.secondary,
  pattern: 'hellstone',
}

// ── Seeded RNG (reproducible per pattern render) ──────────────────────────────
function rng(seed) {
  let s = seed | 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 0xffffffff }
}

// ── Pattern renderer ──────────────────────────────────────────────────────────
function drawPattern(ctx, pattern, primary, secondary, size = 128) {
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = primary
  ctx.fillRect(0, 0, size, size)

  const r = rng(pattern.charCodeAt(0) * 31 + pattern.charCodeAt(1) * 7)

  switch (pattern) {

    // ── Hellstone: dark volcanic blocks + glowing lava crack ─────────────────
    case 'hellstone': {
      const blockColors = [primary, secondary + '55', primary]
      for (let row = 0; row < 4; row++) {
        const off = row % 2 === 0 ? 0 : size * 0.25
        for (let col = 0; col < 5; col++) {
          const bx = col * size * 0.28 + off - 4
          const by = row * size * 0.25 + 1
          const bw = size * 0.26
          const bh = size * 0.23
          ctx.fillStyle = row % 2 === 0 ? '#200905' : '#1a0604'
          ctx.fillRect(bx, by, bw, bh)
          // Edge highlight (subtle darker top)
          ctx.fillStyle = 'rgba(0,0,0,0.3)'
          ctx.fillRect(bx, by, bw, 2)
        }
      }
      // Mortar
      ctx.fillStyle = '#08010080'
      for (let i = 0; i < 4; i++) ctx.fillRect(0, i * size * 0.25, size, 2)
      // Lava crack
      ctx.save()
      ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 6
      ctx.strokeStyle = '#cc1100'; ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(size * 0.25, 0)
      ctx.lineTo(size * 0.27, size * 0.28)
      ctx.lineTo(size * 0.22, size * 0.55)
      ctx.lineTo(size * 0.26, size * 0.80)
      ctx.lineTo(size * 0.24, size)
      ctx.stroke()
      // Ember dots
      ctx.fillStyle = '#ff2200'
      ctx.shadowBlur = 4
      for (let i = 0; i < 5; i++) {
        ctx.fillRect((size * 0.22 + r() * size * 0.08) | 0, (r() * size) | 0, 1, 1)
      }
      ctx.restore()
      break
    }

    // ── Redstone: irregular volcanic flagstones + lava seams ─────────────────
    case 'redstone': {
      const tiles = [
        [0,0,.46,.46], [.49,0,.50,.46], [0,.49,.30,.50], [.32,.49,.34,.50], [.68,.49,.31,.50],
        [0,.25,.46,.23], [.49,.25,.50,.23],
      ]
      tiles.forEach(([x, y, w, h]) => {
        const shade = r() > 0.5 ? '#1c0806' : '#160504'
        ctx.fillStyle = shade
        ctx.fillRect(x*size+1, y*size+1, w*size-2, h*size-2)
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.fillRect(x*size+1, y*size+1, w*size-2, 3)
      })
      // Lava seams
      ctx.save()
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 5
      ctx.strokeStyle = '#cc2200'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, size*.47); ctx.lineTo(size, size*.47); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, size*.25); ctx.lineTo(size*.46, size*.25); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(size*.49, size*.25); ctx.lineTo(size, size*.25); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(size*.48, 0); ctx.lineTo(size*.48, size*.46); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(size*.31, size*.48); ctx.lineTo(size*.31, size); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(size*.67, size*.48); ctx.lineTo(size*.67, size); ctx.stroke()
      ctx.restore()
      // Ember specks
      ctx.save()
      ctx.shadowColor = '#ff5500'; ctx.shadowBlur = 3
      ctx.fillStyle = '#ff3300'
      for (let i = 0; i < 12; i++) ctx.fillRect(r()*size|0, r()*size|0, 1, 1)
      ctx.restore()
      break
    }

    // ── Lava: black rock with glowing orange-yellow magma channels ────────────
    case 'lava': {
      // Base near-black volcanic rock with texture noise
      ctx.fillStyle = '#0a0100'
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = '#0d0202'
      for (let i = 0; i < 40; i++) ctx.fillRect(r()*size|0, r()*size|0, r()*6+2|0, r()*4+1|0)
      // Main lava channels — branching tree from bottom
      ctx.save()
      const drawLavaBranch = (x, y, angle, length, depth) => {
        if (depth < 0 || length < 4) return
        const ex = x + Math.cos(angle) * length
        const ey = y + Math.sin(angle) * length
        // Outer glow
        ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 8
        ctx.strokeStyle = `rgba(255,${80+depth*20},0,${0.5+depth*0.1})`
        ctx.lineWidth = depth * 1.2 + 0.5
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke()
        // Bright core
        ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 3
        ctx.strokeStyle = `rgba(255,${160+depth*15},${depth*20},0.9)`
        ctx.lineWidth = depth * 0.5 + 0.3
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke()
        drawLavaBranch(ex, ey, angle - 0.4 + r()*0.2, length * 0.65, depth - 1)
        drawLavaBranch(ex, ey, angle + 0.4 - r()*0.2, length * 0.6, depth - 1)
      }
      ctx.lineCap = 'round'
      drawLavaBranch(size*0.5, size, -Math.PI/2, size*0.3, 4)
      drawLavaBranch(size*0.2, size, -Math.PI/2 + 0.3, size*0.25, 3)
      drawLavaBranch(size*0.8, size, -Math.PI/2 - 0.3, size*0.25, 3)
      ctx.restore()
      break
    }

    // ── Bone: aged skeletal/bone texture ─────────────────────────────────────
    case 'bone': {
      ctx.fillStyle = '#100604'
      ctx.fillRect(0, 0, size, size)
      // Bone segment shapes
      const boneSegs = [
        [.1,.05,.25,.9], [.4,.05,.22,.88], [.68,.08,.2,.85],
        [.05,.05,.05,.88], [.35,.05,.04,.88], [.63,.05,.04,.88], [.9,.05,.04,.88],
      ]
      boneSegs.forEach(([x,y,w,h]) => {
        const bx = x*size, by = y*size, bw = w*size, bh = h*size
        // Main bone color
        ctx.fillStyle = '#6a4a30'
        ctx.fillRect(bx, by+bh*.08, bw, bh*.84)
        // Rounded ends (simulate)
        ctx.fillStyle = '#7a5540'
        ctx.fillRect(bx-2, by, bw+4, bh*.1)
        ctx.fillRect(bx-2, by+bh*.9, bw+4, bh*.1)
        // Highlight
        ctx.fillStyle = 'rgba(255,200,140,0.08)'
        ctx.fillRect(bx+bw*.25, by, bw*.2, bh)
        // Dark edge groove
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fillRect(bx, by+bh*.08, 2, bh*.84)
        ctx.fillRect(bx+bw-2, by+bh*.08, 2, bh*.84)
      })
      // Blood/rot stains
      ctx.fillStyle = '#440606'
      for (let i = 0; i < 8; i++) {
        ctx.beginPath()
        ctx.arc(r()*size, r()*size, r()*8+3, 0, Math.PI*2)
        ctx.fill()
      }
      break
    }

    // ── Flesh: demon skin texture with veins ──────────────────────────────────
    case 'flesh': {
      // Base fleshy color
      ctx.fillStyle = '#2e0808'
      ctx.fillRect(0, 0, size, size)
      // Skin variation blobs
      const fleshTones = ['#380a0a','#2a0606','#3a0c0c','#300808']
      for (let i = 0; i < 25; i++) {
        ctx.fillStyle = fleshTones[i%4]
        ctx.beginPath()
        ctx.ellipse(r()*size, r()*size, r()*22+6, r()*16+4, r()*Math.PI, 0, Math.PI*2)
        ctx.fill()
      }
      // Surface bumps (pores/scales)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      for (let i = 0; i < 30; i++) {
        const bx = r()*size, by = r()*size, br = r()*4+1
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI*2); ctx.fill()
      }
      // Veins
      ctx.save()
      ctx.strokeStyle = '#770808'; ctx.lineWidth = 1; ctx.globalAlpha = 0.7
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.moveTo(r()*size, r()*size)
        ctx.bezierCurveTo(r()*size, r()*size, r()*size, r()*size, r()*size, r()*size)
        ctx.stroke()
      }
      ctx.globalAlpha = 0.4; ctx.strokeStyle = '#cc0a0a'; ctx.lineWidth = 0.5
      for (let i = 0; i < 8; i++) {
        ctx.beginPath()
        ctx.moveTo(r()*size, r()*size)
        ctx.lineTo(r()*size, r()*size)
        ctx.stroke()
      }
      ctx.restore()
      break
    }

    // ── Metal corroso: dark hellish iron plates with rust/blood ──────────────
    case 'metal': {
      // Plate base
      ctx.fillStyle = '#0e0808'
      ctx.fillRect(0, 0, size, size)
      // Metal panels
      const panels = [
        [1,1,61,61],[64,1,62,61],[1,64,30,62],[33,64,30,62],[65,64,62,62],
      ]
      panels.forEach(([x,y,w,h]) => {
        ctx.fillStyle = '#150c0c'
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = 'rgba(255,50,0,0.05)'
        ctx.fillRect(x, y, w, 2)
        ctx.fillRect(x, y, 2, h)
      })
      // Rivet bolts
      ctx.save()
      ctx.shadowColor = '#331100'; ctx.shadowBlur = 2
      ctx.fillStyle = '#221010'
      const rivets = [[4,4],[60,4],[4,60],[60,60],[32,32],[96,4],[124,4],[96,60],[124,60],[4,96],[60,96],[4,124],[60,124],[96,96],[124,96],[96,124],[124,124]]
      rivets.forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = 'rgba(255,80,0,0.2)'
        ctx.beginPath(); ctx.arc(x-0.5, y-0.5, 1, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = '#221010'
      })
      ctx.restore()
      // Rust/blood streaks
      ctx.save()
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#771100'
      for (let i = 0; i < 12; i++) {
        const sx = r()*size, sy = r()*size
        ctx.fillRect(sx|0, sy|0, r()*3+1|0, r()*20+4|0)
      }
      // Panel gap lines
      ctx.globalAlpha = 1
      ctx.fillStyle = '#050202'
      ctx.fillRect(63, 0, 2, size); ctx.fillRect(0, 63, size, 2)
      ctx.fillRect(32, 63, 2, size); ctx.fillRect(64, 63, 2, size)
      ctx.restore()
      break
    }

    // ── Solid ─────────────────────────────────────────────────────────────────
    case 'solid': {
      // Simple solid with slight surface noise
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(0,0,0,${r()*0.15})`
        ctx.fillRect(r()*size|0, r()*size|0, r()*8+2|0, r()*6+2|0)
      }
      break
    }

    default: break
  }
}

// ── Surface preview canvas ────────────────────────────────────────────────────
function SurfacePreview({ pattern, primaryColor, secondaryColor, surfaceType, size = 128 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawPattern(canvas.getContext('2d'), pattern, primaryColor, secondaryColor, size)
  }, [pattern, primaryColor, secondaryColor, size])

  return (
    <canvas ref={canvasRef} width={size} height={size}
      style={{ border: '1px solid #2a1000', imageRendering: 'pixelated', display: 'block' }} />
  )
}

// ── Mini card canvas (list grid) ──────────────────────────────────────────────
function SurfaceCardCanvas({ surface }) {
  const ref = useCallback(canvas => {
    if (!canvas) return
    drawPattern(canvas.getContext('2d'), surface.pattern, surface.primaryColor, surface.secondaryColor, 120)
  }, [surface.pattern, surface.primaryColor, surface.secondaryColor])

  return <canvas ref={ref} width={120} height={80}
    style={{ width:'100%', imageRendering:'pixelated', display:'block' }} />
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SurfaceEditor() {
  const { token } = useAuth()
  const [activeType, setActiveType]   = useState('wall')
  const [form, setForm]               = useState(DEFAULT_FORM)
  const [surfaces, setSurfaces]       = useState([])
  const [selected, setSelected]       = useState(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const authH = { Authorization: `Bearer ${token}` }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const setPattern = (p) => setForm(f => ({
    ...f, pattern: p,
    primaryColor:   PATTERN_DEFAULTS[p]?.primary   ?? f.primaryColor,
    secondaryColor: PATTERN_DEFAULTS[p]?.secondary ?? f.secondaryColor,
  }))

  // ── Load from DB ────────────────────────────────────────────────────────────
  const loadSurfaces = useCallback(async () => {
    try {
      const r = await fetch('/api/surfaces', { headers: authH })
      if (r.ok) {
        const rows = await r.json()
        // Map snake_case DB fields to camelCase used in UI
        setSurfaces(rows.map(s => ({
          id:             s.id,
          name:           s.name,
          surfaceType:    s.surface_type,
          primaryColor:   s.primary_color,
          secondaryColor: s.secondary_color,
          pattern:        s.pattern,
          description:    s.description ?? '',
        })))
      }
    } catch {}
  }, [token])

  useEffect(() => { loadSurfaces() }, [loadSurfaces])

  const filteredSurfaces = surfaces.filter(s => s.surfaceType === activeType)

  // ── Save to DB ──────────────────────────────────────────────────────────────
  const saveSurface = async () => {
    if (!form.name.trim()) { setError('Inserisci un nome'); return }
    if (saving) return
    setSaving(true); setError('')
    try {
      const body = {
        name:           form.name,
        surface_type:   activeType,
        primary_color:  form.primaryColor,
        secondary_color:form.secondaryColor,
        pattern:        form.pattern,
        description:    form.description,
      }
      const r = await fetch('/api/surfaces', {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error) }
      await loadSurfaces()
      setForm(DEFAULT_FORM)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Delete from DB ──────────────────────────────────────────────────────────
  const deleteSurface = async (id) => {
    if (!confirm('Eliminare questa superficie?')) return
    try {
      await fetch(`/api/surfaces/${id}`, { method: 'DELETE', headers: authH })
      if (selected?.id === id) setSelected(null)
      await loadSurfaces()
    } catch {}
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%',
      background:'#060402', fontFamily:'Courier New, monospace', color:'#cc7744' }}>
      <PageHeader title="Editor Superfici" />

      {/* ── Type tabs ── */}
      <div style={{ display:'flex', borderBottom:'1px solid #1e0e00', flexShrink:0 }}>
        {SURFACE_TYPES.map(t => (
          <div key={t} onClick={() => setActiveType(t)} style={{
            flex:1, padding:'8px 0', fontSize:10, letterSpacing:3, textAlign:'center',
            cursor:'pointer', transition:'all 0.15s',
            color:      activeType===t ? '#ff6633' : '#664433',
            borderBottom: activeType===t ? '2px solid #cc2200' : '2px solid transparent',
            background: activeType===t ? '#180900' : 'transparent',
          }}>{TYPE_LABELS[t]}</div>
        ))}
      </div>

      {/* ── 2-column layout ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ── LEFT: form + preview ── */}
        <div style={{ width:300, borderRight:'1px solid #1e0e00', display:'flex',
          flexDirection:'column', flexShrink:0, overflowY:'auto' }}
          className="me-scroll">

          {/* Name */}
          <Section label="NUOVA SUPERFICIE · TIPO: PARETI">
            <FieldLabel>NOME</FieldLabel>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Es: Pietra Infernale Ovest"
              style={INPUT_STYLE} />
            <FieldLabel style={{ marginTop:8 }}>NOTE</FieldLabel>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Descrizione libera..." rows={2}
              style={{ ...INPUT_STYLE, resize:'none', height:48, fontFamily:'monospace' }} />
          </Section>

          {/* Pattern */}
          <Section label="PATTERN">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {PATTERNS.map(p => (
                <div key={p} onClick={() => setPattern(p)}
                  style={{
                    padding:'7px 6px', fontSize:10, letterSpacing:1, cursor:'pointer',
                    border:`1px solid ${form.pattern===p ? '#cc2200' : '#1e0e00'}`,
                    background: form.pattern===p ? '#1a0800' : '#0a0503',
                    color: form.pattern===p ? '#ff8844' : '#664433',
                    textAlign:'center', transition:'all 0.12s',
                  }}>
                  {PATTERN_LABELS[p]}
                </div>
              ))}
            </div>
          </Section>

          {/* Colors */}
          <Section label="COLORI">
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <ColorPicker label="PRIMARIO"   value={form.primaryColor}   onChange={v=>set('primaryColor',v)} />
              <ColorPicker label="SECONDARIO" value={form.secondaryColor} onChange={v=>set('secondaryColor',v)} />
            </div>
          </Section>

          {/* Preview */}
          <Section label="ANTEPRIMA">
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
              <SurfacePreview
                pattern={form.pattern}
                primaryColor={form.primaryColor}
                secondaryColor={form.secondaryColor}
                surfaceType={activeType}
              />
              <div style={{ fontSize:9, color:'#443322', letterSpacing:2 }}>
                {PATTERN_LABELS[form.pattern]} · {activeType.toUpperCase()}
              </div>
            </div>
          </Section>

          {error && <div style={{ color:'#ff4444', fontSize:11, padding:'0 14px 6px' }}>{error}</div>}

          {/* Save button */}
          <div style={{ padding:'12px 14px 16px', flexShrink:0, borderTop:'1px solid #1e0e00' }}>
            <button onClick={saveSurface} disabled={saving} style={{
              width:'100%', background: saving ? '#661100' : '#aa1c00', border:'none', color:'#fff',
              fontFamily:'monospace', fontSize:11, letterSpacing:2, padding:'8px 0',
              cursor: saving ? 'default' : 'pointer', transition:'background 0.15s',
            }}>{saving ? '...' : '✓ SALVA SUPERFICIE'}</button>
          </div>
        </div>

        {/* ── RIGHT: saved surfaces grid ── */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }} className="me-scroll">
          <div style={{ color:'#664433', fontSize:10, letterSpacing:3, marginBottom:14 }}>
            {TYPE_LABELS[activeType].toUpperCase()} SALVATE — {filteredSurfaces.length}
          </div>

          {filteredSurfaces.length === 0 && (
            <div style={{ color:'#2a1200', fontSize:11, textAlign:'center', marginTop:60, letterSpacing:2 }}>
              NESSUNA SUPERFICIE<br/>CREANE UNA
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
            {filteredSurfaces.map(s => (
              <div key={s.id} onClick={() => setSelected(s)}
                style={{
                  cursor:'pointer', position:'relative',
                  border:`1px solid ${selected?.id===s.id ? '#cc2200' : '#1e0e00'}`,
                  background: selected?.id===s.id ? '#1a0800' : '#0a0503',
                  padding:8, transition:'all 0.15s',
                }}
                onMouseEnter={e => {
                  if(selected?.id!==s.id) e.currentTarget.style.borderColor='#441800'
                  e.currentTarget.querySelector('.del-btn').style.opacity='1'
                }}
                onMouseLeave={e => {
                  if(selected?.id!==s.id) e.currentTarget.style.borderColor='#1e0e00'
                  e.currentTarget.querySelector('.del-btn').style.opacity='0'
                }}>
                <SurfaceCardCanvas surface={s} />
                <div style={{ marginTop:6, fontSize:10, color:'#cc7744',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:1 }}>
                  {s.name}
                </div>
                <div style={{ fontSize:9, color:'#664433', marginTop:2, letterSpacing:1 }}>
                  {PATTERN_LABELS[s.pattern] ?? s.pattern}
                </div>
                {/* Delete button - appears on hover */}
                <button className="del-btn"
                  onClick={e => { e.stopPropagation(); deleteSurface(s.id) }}
                  style={{
                    position:'absolute', top:4, right:4, opacity:0,
                    background:'rgba(0,0,0,0.7)', border:'1px solid #441100',
                    color:'#cc3300', fontSize:13, lineHeight:1,
                    padding:'1px 5px', cursor:'pointer', transition:'opacity 0.15s',
                  }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Micro components ──────────────────────────────────────────────────────────
const INPUT_STYLE = {
  width:'100%', boxSizing:'border-box',
  background:'#120800', border:'1px solid #2a1200',
  color:'#ffcc88', fontFamily:'monospace', fontSize:12,
  padding:'5px 8px', outline:'none',
}

function Section({ label, children }) {
  return (
    <div style={{ padding:'12px 14px', borderBottom:'1px solid #1a0800', flexShrink:0 }}>
      <div style={{ color:'#664433', fontSize:9, letterSpacing:3, marginBottom:10 }}>{label}</div>
      {children}
    </div>
  )
}

function FieldLabel({ children, style = {} }) {
  return <div style={{ color:'#885533', fontSize:10, letterSpacing:1, marginBottom:4, ...style }}>{children}</div>
}

function ColorPicker({ label, value, onChange }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center' }}>
      <span style={{ color:'#885533', fontSize:9, letterSpacing:2 }}>{label}</span>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width:44, height:32, border:'1px solid #2a1200', padding:2,
          cursor:'pointer', background:'#120800' }} />
      <span style={{ color:'#664433', fontSize:9 }}>{value}</span>
    </label>
  )
}
