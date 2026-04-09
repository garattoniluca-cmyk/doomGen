import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import PageHeader from '../PageHeader.jsx'
import MonsterViewer from './MonsterViewer.jsx'

// ── Default geometry: demone base ─────────────────────────────────────────────
const DEFAULT_GEOMETRY = {
  v: 1,
  parts: [
    { id:'leg_l',  label:'Gamba Sx',    shape:'cylinder', w:0,    h:0.65, d:0,    r:0.12, x:-0.19, y:0.325, z:0,    rx:0,  ry:0, rz:0,   color:'#661111' },
    { id:'leg_r',  label:'Gamba Dx',    shape:'cylinder', w:0,    h:0.65, d:0,    r:0.12, x:0.19,  y:0.325, z:0,    rx:0,  ry:0, rz:0,   color:'#661111' },
    { id:'body',   label:'Corpo',       shape:'box',      w:0.72, h:0.85, d:0.48, r:0,    x:0,     y:1.075, z:0,    rx:0,  ry:0, rz:0,   color:'#8B2222' },
    { id:'arm_l',  label:'Braccio Sx',  shape:'cylinder', w:0,    h:0.65, d:0,    r:0.1,  x:-0.51, y:0.97,  z:0,    rx:0,  ry:0, rz:22,  color:'#661111' },
    { id:'arm_r',  label:'Braccio Dx',  shape:'cylinder', w:0,    h:0.65, d:0,    r:0.1,  x:0.51,  y:0.97,  z:0,    rx:0,  ry:0, rz:-22, color:'#661111' },
    { id:'head',   label:'Testa',       shape:'sphere',   w:0,    h:0,    d:0,    r:0.28, x:0,     y:1.73,  z:0,    rx:0,  ry:0, rz:0,   color:'#8B2222' },
    { id:'eye_l',  label:'Occhio Sx',   shape:'sphere',   w:0,    h:0,    d:0,    r:0.07, x:-0.1,  y:1.75,  z:0.24, rx:0,  ry:0, rz:0,   color:'#ff5500' },
    { id:'eye_r',  label:'Occhio Dx',   shape:'sphere',   w:0,    h:0,    d:0,    r:0.07, x:0.1,   y:1.75,  z:0.24, rx:0,  ry:0, rz:0,   color:'#ff5500' },
    { id:'horn_l', label:'Corno Sx',    shape:'cone',     w:0,    h:0.28, d:0,    r:0.07, x:-0.14, y:1.98,  z:0.06, rx:-15,ry:0, rz:-10, color:'#441111' },
    { id:'horn_r', label:'Corno Dx',    shape:'cone',     w:0,    h:0.28, d:0,    r:0.07, x:0.14,  y:1.98,  z:0.06, rx:-15,ry:0, rz:10,  color:'#441111' },
  ],
}

const DEFAULT_STATE = () => ({
  id: null, name: 'Nuovo Mostro',
  health:100, speed:5, damage:20, behavior:'patrol',
  sight_range:10, attack_range:2,
  resistances: { fire:0, ice:0, bullet:0 },
  geometry: { v:1, parts: DEFAULT_GEOMETRY.parts.map(p => ({...p})) },
  lore: '',
})

const uid = () => Math.random().toString(36).slice(2,8)
const newPart = () => ({ id:uid(), label:'Parte', shape:'box', w:0.5, h:0.5, d:0.5, r:0.25, x:0, y:0.25, z:0, rx:0, ry:0, rz:0, color:'#cc2200' })
const BEHAVIORS = ['patrol','chase','shoot','ambush','stationary']
const SHAPE_ICONS = { box:'□', sphere:'○', cylinder:'⊙', cone:'△' }

// ── Main component ────────────────────────────────────────────────────────────
export default function MonsterEditor() {
  const { token } = useAuth()
  const [monsters, setMonsters] = useState([])
  const [editing, setEditing] = useState(null)
  const [thumbnail, setThumbnail] = useState(null)
  const [tab, setTab] = useState('stats')
  const [expandedPart, setExpandedPart] = useState(null)
  const [saving, setSaving] = useState(false)

  const loadMonsters = useCallback(async () => {
    try {
      const r = await fetch('/api/monsters', { headers: { Authorization:`Bearer ${token}` } })
      if (r.ok) setMonsters(await r.json())
    } catch {}
  }, [token])

  useEffect(() => { loadMonsters() }, [loadMonsters])

  const selectMonster = (m) => {
    setEditing({ id:m.id, name:m.name, health:m.health, speed:m.speed, damage:m.damage, behavior:m.behavior, sight_range:m.sight_range??10, attack_range:m.attack_range??2, resistances:m.resistances||{fire:0,ice:0,bullet:0}, geometry:m.geometry||{v:1,parts:[]}, lore:m.lore||'' })
    setThumbnail(m.thumbnail||null); setTab('stats'); setExpandedPart(null)
  }

  const newMonster = () => { setEditing(DEFAULT_STATE()); setThumbnail(null); setTab('stats'); setExpandedPart(null) }

  const saveMonster = async () => {
    if (!editing || saving) return
    setSaving(true)
    try {
      const url = editing.id ? `/api/monsters/${editing.id}` : '/api/monsters'
      const r = await fetch(url, {
        method: editing.id ? 'PUT' : 'POST',
        headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ name:editing.name, health:editing.health, speed:editing.speed, damage:editing.damage, behavior:editing.behavior, sight_range:editing.sight_range, attack_range:editing.attack_range, resistances:editing.resistances, geometry:editing.geometry, thumbnail, lore:editing.lore }),
      })
      if (r.ok) {
        const data = await r.json()
        if (!editing.id && data.id) setEditing(e => ({...e, id:data.id}))
        await loadMonsters()
      }
    } finally { setSaving(false) }
  }

  const deleteMonster = async (id) => {
    if (!confirm('Eliminare questo mostro?')) return
    await fetch(`/api/monsters/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } })
    if (editing?.id === id) setEditing(null)
    await loadMonsters()
  }

  const set     = (k, v) => setEditing(e => ({...e, [k]:v}))
  const setRes  = (k, v) => setEditing(e => ({...e, resistances:{...e.resistances,[k]:v}}))
  const setPart = (id, ch) => setEditing(e => ({...e, geometry:{...e.geometry, parts:e.geometry.parts.map(p => p.id===id?{...p,...ch}:p)}}))
  const addPart = () => { const p=newPart(); setEditing(e=>({...e,geometry:{...e.geometry,parts:[...e.geometry.parts,p]}})); setExpandedPart(p.id) }
  const delPart = (id) => { setEditing(e=>({...e,geometry:{...e.geometry,parts:e.geometry.parts.filter(p=>p.id!==id)}})); if(expandedPart===id) setExpandedPart(null) }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'Courier New, monospace', background:'#060402' }}>
      <PageHeader title="Editor Mostri" />

      {/* ── 3-column layout ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ── LEFT: monster list ── */}
        <div style={{ width:230, background:'#060402', borderRight:'1px solid #1a0a00', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'10px', borderBottom:'1px solid #1a0a00' }}>
            <button onClick={newMonster}
              style={{ width:'100%', background:'#150400', border:'1px solid #881500', color:'#cc3300', fontFamily:'monospace', fontSize:10, letterSpacing:3, padding:'8px', cursor:'pointer' }}
              onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#220600',borderColor:'#cc2200'})}
              onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:'#150400',borderColor:'#881500'})}>
              + NUOVO MOSTRO
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
            {monsters.length === 0 && <div style={{ color:'#1e0c04', fontSize:10, textAlign:'center', marginTop:40, letterSpacing:2 }}>NESSUN MOSTRO<br/>CREANE UNO</div>}
            {monsters.map(m => <MonsterCard key={m.id} monster={m} selected={editing?.id===m.id} onClick={()=>selectMonster(m)} onDelete={()=>deleteMonster(m.id)} />)}
          </div>
        </div>

        {/* ── CENTER: 3D scene (full height) ── */}
        <div style={{ flex:1, overflow:'hidden' }}>
          {!editing ? (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#3a7aaa', color:'#1a3a5a', fontSize:11, letterSpacing:3, textAlign:'center' }}>
              SELEZIONA UN MOSTRO<br/>O CREANE UNO NUOVO
            </div>
          ) : (
            <MonsterViewer geometry={editing.geometry} onThumbnailCapture={setThumbnail} />
          )}
        </div>

        {/* ── RIGHT: inspector (Unity-style) ── */}
        <div style={{ width:310, background:'#0a0705', borderLeft:'1px solid #1a0a00', display:'flex', flexDirection:'column', flexShrink:0 }}>
          {!editing ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#1e0c04', fontSize:10, letterSpacing:2, textAlign:'center' }}>
              INSPECTOR
            </div>
          ) : (
            <>
              {/* Name + actions */}
              <div style={{ padding:'10px 12px', borderBottom:'1px solid #1a0a00', flexShrink:0 }}>
                <input value={editing.name} onChange={e=>set('name',e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box', background:'#110800', border:'1px solid #331500', color:'#cc8844', fontFamily:'monospace', fontSize:12, padding:'5px 8px', outline:'none', letterSpacing:1, marginBottom:8 }} />
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={saveMonster} disabled={saving}
                    style={{ flex:1, background:'#aa1c00', border:'none', color:'#fff', fontFamily:'monospace', fontSize:10, letterSpacing:2, padding:'6px 0', cursor:'pointer', opacity:saving?0.6:1 }}>
                    {saving ? '...' : (editing.id ? 'AGGIORNA' : 'SALVA')}
                  </button>
                  {editing.id && (
                    <button onClick={()=>deleteMonster(editing.id)}
                      style={{ background:'transparent', border:'1px solid #441100', color:'#663300', fontFamily:'monospace', fontSize:10, padding:'6px 10px', cursor:'pointer' }}>
                      ×
                    </button>
                  )}
                  <button onClick={()=>setEditing(null)}
                    style={{ background:'transparent', border:'1px solid #221208', color:'#332211', fontFamily:'monospace', fontSize:11, padding:'6px 8px', cursor:'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>

              {/* Tab bar */}
              <div style={{ display:'flex', borderBottom:'1px solid #1a0a00', flexShrink:0 }}>
                {[['stats','STATS'],['geometry','GEO'],['json','JSON']].map(([t,l]) => (
                  <div key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'7px 0', fontSize:9, letterSpacing:2, cursor:'pointer', textAlign:'center', color:tab===t?'#cc4400':'#331500', borderBottom:tab===t?'2px solid #cc2200':'2px solid transparent', background:tab===t?'#130700':'transparent' }}>
                    {l}
                  </div>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
                {tab==='stats'    && <StatsTab    editing={editing} set={set} setRes={setRes} />}
                {tab==='geometry' && <GeometryTab parts={editing.geometry?.parts||[]} expandedPart={expandedPart} setExpandedPart={setExpandedPart} onAdd={addPart} onDelete={delPart} onUpdate={setPart} />}
                {tab==='json'     && <JSONTab     editing={editing} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Monster card ──────────────────────────────────────────────────────────────
function MonsterCard({ monster, selected, onClick, onDelete }) {
  return (
    <div onClick={onClick}
      style={{ border:`1px solid ${selected?'#cc2200':'#1a0900'}`, background:selected?'#180500':'#0a0503', padding:'7px 8px', marginBottom:5, cursor:'pointer', display:'flex', gap:8, alignItems:'center', position:'relative' }}
      onMouseEnter={e=>{ if(!selected) e.currentTarget.style.borderColor='#441500' }}
      onMouseLeave={e=>{ if(!selected) e.currentTarget.style.borderColor='#1a0900' }}>
      <div style={{ width:54, height:40, background:'#0c0805', border:'1px solid #1a0a00', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {monster.thumbnail ? <img src={monster.thumbnail} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : <span style={{ color:'#2a1000', fontSize:18 }}>☠</span>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:selected?'#ff4400':'#cc6633', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:1 }}>{monster.name}</div>
        <div style={{ color:'#2a1200', fontSize:9, marginTop:2 }}>HP:{monster.health} · SPD:{monster.speed} · DMG:{monster.damage}</div>
        <div style={{ color:'#1e0c04', fontSize:9 }}>{monster.behavior}</div>
      </div>
      <button onClick={e=>{e.stopPropagation();onDelete()}} style={{ position:'absolute', top:3, right:4, background:'transparent', border:'none', color:'#331100', cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px' }}>×</button>
    </div>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ editing, set, setRes }) {
  const r = editing.resistances || {}
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <Slider label={`VITA (${editing.health})`}           value={editing.health}       min={1}  max={500} color='#cc4400' onChange={v=>set('health',v)} />
      <Slider label={`VELOCITÀ (${editing.speed}/20)`}     value={editing.speed}        min={1}  max={20}  color='#ffcc00' onChange={v=>set('speed',v)} />
      <Slider label={`DANNO (${editing.damage})`}          value={editing.damage}       min={1}  max={200} color='#cc0000' onChange={v=>set('damage',v)} />
      <Slider label={`VISUALE (${editing.sight_range}m)`}  value={editing.sight_range}  min={1}  max={30}  color='#4488cc' onChange={v=>set('sight_range',v)} />
      <Slider label={`ATTACCO (${editing.attack_range}m)`} value={editing.attack_range} min={1}  max={10}  color='#cc8800' onChange={v=>set('attack_range',v)} />

      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:2 }}>
        <span style={{ color:'#442211', fontSize:10, letterSpacing:1 }}>COMPORTAMENTO</span>
        <select value={editing.behavior} onChange={e=>set('behavior',e.target.value)}
          style={{ flex:1, background:'#110800', border:'1px solid #331500', color:'#cc8844', fontFamily:'monospace', fontSize:11, padding:'4px 6px', outline:'none' }}>
          {BEHAVIORS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div style={{ borderTop:'1px solid #1a0a00', paddingTop:10, marginTop:4 }}>
        <div style={{ color:'#331500', fontSize:10, letterSpacing:2, marginBottom:8 }}>RESISTENZE</div>
        <Slider label={`FUOCO (${r.fire||0}%)`}        value={r.fire||0}   min={0} max={100} color='#ff4400' onChange={v=>setRes('fire',v)} />
        <div style={{ marginTop:8 }} />
        <Slider label={`GHIACCIO (${r.ice||0}%)`}      value={r.ice||0}    min={0} max={100} color='#44aaff' onChange={v=>setRes('ice',v)} />
        <div style={{ marginTop:8 }} />
        <Slider label={`PROIETTILE (${r.bullet||0}%)`} value={r.bullet||0} min={0} max={100} color='#88aa44' onChange={v=>setRes('bullet',v)} />
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, color, onChange }) {
  return (
    <div>
      <div style={{ color:'#553322', fontSize:10, letterSpacing:1, marginBottom:3 }}>{label}</div>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}
        style={{ width:'100%', accentColor:color, cursor:'pointer' }} />
    </div>
  )
}

// ── Geometry tab ──────────────────────────────────────────────────────────────
function GeometryTab({ parts, expandedPart, setExpandedPart, onAdd, onDelete, onUpdate }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ color:'#442211', fontSize:10, letterSpacing:2 }}>{parts.length} PARTI</span>
        <button onClick={onAdd}
          style={{ background:'#1a0500', border:'1px solid #663300', color:'#cc6622', fontFamily:'monospace', fontSize:10, letterSpacing:1, padding:'4px 12px', cursor:'pointer' }}>
          + AGGIUNGI
        </button>
      </div>
      {parts.map(part => (
        <PartRow key={part.id} part={part}
          expanded={expandedPart===part.id}
          onToggle={()=>setExpandedPart(expandedPart===part.id ? null : part.id)}
          onUpdate={ch=>onUpdate(part.id,ch)}
          onDelete={()=>onDelete(part.id)} />
      ))}
    </div>
  )
}

function PartRow({ part, expanded, onToggle, onUpdate, onDelete }) {
  return (
    <div style={{ marginBottom:3, border:`1px solid ${expanded?'#3a1500':'#1e0900'}`, background:expanded?'#120800':'#0c0503' }}>
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 8px', cursor:'pointer', userSelect:'none' }}>
        <span style={{ color:'#442211', fontSize:10, width:10 }}>{expanded?'▼':'▶'}</span>
        <span style={{ color:'#553322', fontSize:14 }}>{SHAPE_ICONS[part.shape]||'?'}</span>
        <div style={{ width:13, height:13, background:part.color, border:'1px solid #33000066', flexShrink:0 }} />
        <span style={{ flex:1, color:'#996644', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{part.label}</span>
        <span style={{ color:'#331500', fontSize:9, fontFamily:'monospace', flexShrink:0 }}>
          {(part.x||0).toFixed(2)},{(part.y||0).toFixed(2)},{(part.z||0).toFixed(2)}
        </span>
        <button onClick={e=>{e.stopPropagation();onDelete()}} style={{ background:'transparent', border:'none', color:'#551100', cursor:'pointer', fontSize:15, lineHeight:1, padding:'0 3px', flexShrink:0 }}>×</button>
      </div>
      {expanded && (
        <div style={{ padding:'10px 12px 12px', borderTop:'1px solid #1e0900' }}>
          <PartEditor part={part} onChange={onUpdate} />
        </div>
      )}
    </div>
  )
}

function PartEditor({ part, onChange }) {
  const Num = ({ label, k, step=0.05 }) => (
    <label style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <span style={{ color:'#664422', fontSize:10, letterSpacing:1 }}>{label}</span>
      <input type="number" step={step}
        value={+(part[k]??0).toFixed(3)}
        onChange={e=>onChange({[k]:parseFloat(e.target.value)||0})}
        style={{ width:'100%', background:'#0e0603', border:'1px solid #2a1000', color:'#ffaa66', fontFamily:'monospace', fontSize:12, padding:'4px 6px', outline:'none', textAlign:'right', boxSizing:'border-box' }}
      />
    </label>
  )

  const Row = ({ children }) => (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${children.length||1}, 1fr)`, gap:6 }}>
      {children}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Label + Shape + Color */}
      <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
        <label style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
          <span style={{ color:'#664422', fontSize:10, letterSpacing:1 }}>NOME</span>
          <input value={part.label} onChange={e=>onChange({label:e.target.value})}
            style={{ background:'#0e0603', border:'1px solid #2a1000', color:'#ffaa66', fontFamily:'monospace', fontSize:12, padding:'4px 6px', outline:'none', width:'100%', boxSizing:'border-box' }} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <span style={{ color:'#664422', fontSize:10, letterSpacing:1 }}>FORMA</span>
          <select value={part.shape} onChange={e=>onChange({shape:e.target.value})}
            style={{ background:'#0e0603', border:'1px solid #2a1000', color:'#ffaa66', fontFamily:'monospace', fontSize:12, padding:'4px 6px', outline:'none' }}>
            {['box','sphere','cylinder','cone'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <span style={{ color:'#664422', fontSize:10, letterSpacing:1 }}>COLORE</span>
          <input type="color" value={part.color||'#cc2200'} onChange={e=>onChange({color:e.target.value})}
            style={{ width:40, height:32, border:'1px solid #2a1000', padding:1, cursor:'pointer', background:'#0e0603' }} />
        </label>
      </div>

      {/* Dimensions */}
      <div>
        <div style={{ color:'#442211', fontSize:10, letterSpacing:2, marginBottom:6 }}>DIMENSIONI</div>
        {part.shape==='box'      && <Row><Num label="W" k="w"/><Num label="H" k="h"/><Num label="D" k="d"/></Row>}
        {part.shape==='sphere'   && <Row><Num label="RAGGIO" k="r"/></Row>}
        {(part.shape==='cylinder'||part.shape==='cone') && <Row><Num label="R" k="r"/><Num label="H" k="h"/></Row>}
      </div>

      {/* Position */}
      <div>
        <div style={{ color:'#442211', fontSize:10, letterSpacing:2, marginBottom:6 }}>POSIZIONE</div>
        <Row><Num label="X" k="x"/><Num label="Y" k="y"/><Num label="Z" k="z"/></Row>
      </div>

      {/* Rotation */}
      <div>
        <div style={{ color:'#442211', fontSize:10, letterSpacing:2, marginBottom:6 }}>ROTAZIONE °</div>
        <Row><Num label="RX" k="rx" step={1}/><Num label="RY" k="ry" step={1}/><Num label="RZ" k="rz" step={1}/></Row>
      </div>
    </div>
  )
}

// ── JSON tab ──────────────────────────────────────────────────────────────────
function JSONTab({ editing }) {
  const json = {
    v:1,
    meta:{ name:editing.name, generated_by:'manual' },
    stats:{ health:editing.health, speed:editing.speed, damage:editing.damage, behavior:editing.behavior, sight_range:editing.sight_range, attack_range:editing.attack_range },
    resistances:editing.resistances,
    geometry:editing.geometry,
    lore:editing.lore,
  }
  return (
    <pre style={{ color:'#664422', fontSize:10, fontFamily:'monospace', whiteSpace:'pre-wrap', wordBreak:'break-all', margin:0, lineHeight:1.7 }}>
      {JSON.stringify(json, null, 2)}
    </pre>
  )
}
