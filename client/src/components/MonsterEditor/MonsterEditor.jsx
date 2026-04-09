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
    setEditing({
      id:m.id, name:m.name,
      health:m.health, speed:m.speed, damage:m.damage, behavior:m.behavior,
      sight_range:m.sight_range??10, attack_range:m.attack_range??2,
      resistances:m.resistances || {fire:0,ice:0,bullet:0},
      geometry:m.geometry || {v:1,parts:[]},
      lore:m.lore||'',
    })
    setThumbnail(m.thumbnail||null)
    setTab('stats'); setExpandedPart(null)
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

  const set    = (k, v) => setEditing(e => ({...e, [k]:v}))
  const setRes = (k, v) => setEditing(e => ({...e, resistances:{...e.resistances,[k]:v}}))
  const setPart = (id, changes) => setEditing(e => ({...e, geometry:{...e.geometry, parts:e.geometry.parts.map(p => p.id===id ? {...p,...changes} : p)}}))
  const addPart = () => { const p=newPart(); setEditing(e=>({...e,geometry:{...e.geometry,parts:[...e.geometry.parts,p]}})); setExpandedPart(p.id) }
  const delPart = (id) => { setEditing(e=>({...e,geometry:{...e.geometry,parts:e.geometry.parts.filter(p=>p.id!==id)}})); if(expandedPart===id) setExpandedPart(null) }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'Courier New, monospace', background:'#080604' }}>
      <PageHeader title="Editor Mostri" />

      {editing && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', background:'#0a0805', borderBottom:'1px solid #1a0a00', flexShrink:0 }}>
          <input value={editing.name} onChange={e=>set('name',e.target.value)}
            style={{ flex:1, maxWidth:220, background:'#110800', border:'1px solid #2a1000', color:'#cc8844', fontFamily:'monospace', fontSize:12, padding:'4px 8px', outline:'none', letterSpacing:1 }} />
          <button onClick={saveMonster} disabled={saving} style={{ background:'#aa1c00', border:'none', color:'#fff', fontFamily:'monospace', fontSize:10, letterSpacing:2, padding:'5px 16px', cursor:'pointer', opacity:saving?0.6:1 }}>
            {saving ? '...' : (editing.id ? 'AGGIORNA' : 'SALVA')}
          </button>
          {editing.id && (
            <button onClick={()=>deleteMonster(editing.id)} style={{ background:'transparent', border:'1px solid #441100', color:'#663300', fontFamily:'monospace', fontSize:10, padding:'5px 10px', cursor:'pointer' }}>ELIMINA</button>
          )}
          <button onClick={()=>setEditing(null)} style={{ marginLeft:'auto', background:'transparent', border:'1px solid #221208', color:'#332211', fontFamily:'monospace', fontSize:11, padding:'4px 8px', cursor:'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* ── Left panel ── */}
        <div style={{ width:248, background:'#060402', borderRight:'1px solid #1a0a00', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'10px', borderBottom:'1px solid #1a0a00' }}>
            <button onClick={newMonster} style={{ width:'100%', background:'#150400', border:'1px solid #881500', color:'#cc3300', fontFamily:'monospace', fontSize:10, letterSpacing:3, padding:'8px', cursor:'pointer' }}
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

        {/* ── Center ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {!editing ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#1a0800', fontSize:11, letterSpacing:3, textAlign:'center' }}>
              SELEZIONA UN MOSTRO<br/>O CREANE UNO NUOVO
            </div>
          ) : (
            <>
              <div style={{ flex:1, minHeight:0 }}>
                <MonsterViewer geometry={editing.geometry} onThumbnailCapture={setThumbnail} />
              </div>
              <div style={{ height:265, borderTop:'1px solid #1a0a00', display:'flex', flexDirection:'column', flexShrink:0, background:'#080604' }}>
                <div style={{ display:'flex', borderBottom:'1px solid #1a0a00', flexShrink:0 }}>
                  {[['stats','STATISTICHE'],['geometry','GEOMETRIA'],['json','JSON']].map(([t,l]) => (
                    <div key={t} onClick={()=>setTab(t)} style={{ padding:'5px 16px', fontSize:9, letterSpacing:2, cursor:'pointer', color:tab===t?'#cc4400':'#331500', borderBottom:tab===t?'2px solid #cc2200':'2px solid transparent', background:tab===t?'#110600':'transparent' }}>
                      {l}
                    </div>
                  ))}
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'10px 14px' }}>
                  {tab==='stats'    && <StatsTab editing={editing} set={set} setRes={setRes} />}
                  {tab==='geometry' && <GeometryTab parts={editing.geometry?.parts||[]} expandedPart={expandedPart} setExpandedPart={setExpandedPart} onAdd={addPart} onDelete={delPart} onUpdate={setPart} />}
                  {tab==='json'     && <JSONTab editing={editing} />}
                </div>
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
    <div onClick={onClick} style={{ border:`1px solid ${selected?'#cc2200':'#1a0900'}`, background:selected?'#180500':'#0a0503', padding:'7px 8px', marginBottom:5, cursor:'pointer', display:'flex', gap:8, alignItems:'center', position:'relative' }}
      onMouseEnter={e=>{ if(!selected) e.currentTarget.style.borderColor='#441500' }}
      onMouseLeave={e=>{ if(!selected) e.currentTarget.style.borderColor='#1a0900' }}>
      <div style={{ width:54, height:40, background:'#0c0805', border:'1px solid #1a0a00', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {monster.thumbnail
          ? <img src={monster.thumbnail} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : <span style={{ color:'#2a1000', fontSize:18 }}>☠</span>}
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
    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 20px' }}>
        <Slider label={`VITA (${editing.health})`}          value={editing.health}       min={1}  max={500} color='#cc4400' onChange={v=>set('health',v)} />
        <Slider label={`VELOCITÀ (${editing.speed}/20)`}    value={editing.speed}        min={1}  max={20}  color='#ffcc00' onChange={v=>set('speed',v)} />
        <Slider label={`DANNO (${editing.damage})`}         value={editing.damage}       min={1}  max={200} color='#cc0000' onChange={v=>set('damage',v)} />
        <Slider label={`VISUALE (${editing.sight_range}m)`} value={editing.sight_range}  min={1}  max={30}  color='#4488cc' onChange={v=>set('sight_range',v)} />
        <Slider label={`ATTACCO (${editing.attack_range}m)`}value={editing.attack_range} min={1}  max={10}  color='#cc8800' onChange={v=>set('attack_range',v)} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ color:'#442211', fontSize:9, letterSpacing:2 }}>COMPORTAMENTO</span>
        <select value={editing.behavior} onChange={e=>set('behavior',e.target.value)} style={{ background:'#0f0a05', border:'1px solid #2a1000', color:'#cc8844', fontFamily:'monospace', fontSize:10, padding:'3px 6px', outline:'none' }}>
          {BEHAVIORS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div style={{ borderTop:'1px solid #1a0a00', paddingTop:6 }}>
        <div style={{ color:'#331500', fontSize:9, letterSpacing:2, marginBottom:4 }}>RESISTENZE</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'4px 10px' }}>
          <Slider label={`FUOCO (${r.fire||0}%)`}        value={r.fire||0}   min={0} max={100} color='#ff4400' onChange={v=>setRes('fire',v)} />
          <Slider label={`GHIACCIO (${r.ice||0}%)`}      value={r.ice||0}    min={0} max={100} color='#44aaff' onChange={v=>setRes('ice',v)} />
          <Slider label={`PROIETTILE (${r.bullet||0}%)`} value={r.bullet||0} min={0} max={100} color='#88aa44' onChange={v=>setRes('bullet',v)} />
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, color, onChange }) {
  return (
    <div>
      <div style={{ color:'#442211', fontSize:9, letterSpacing:1, marginBottom:2 }}>{label}</div>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))} style={{ width:'100%', accentColor:color, cursor:'pointer' }} />
    </div>
  )
}

// ── Geometry tab ──────────────────────────────────────────────────────────────
function GeometryTab({ parts, expandedPart, setExpandedPart, onAdd, onDelete, onUpdate }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
        <span style={{ color:'#331500', fontSize:9, letterSpacing:2 }}>{parts.length} PARTI</span>
        <button onClick={onAdd} style={{ background:'#150400', border:'1px solid #553300', color:'#cc6622', fontFamily:'monospace', fontSize:9, letterSpacing:1, padding:'3px 10px', cursor:'pointer' }}>+ AGGIUNGI</button>
      </div>
      {parts.map(part => (
        <PartRow key={part.id} part={part}
          expanded={expandedPart===part.id}
          onToggle={()=>setExpandedPart(expandedPart===part.id ? null : part.id)}
          onUpdate={changes=>onUpdate(part.id,changes)}
          onDelete={()=>onDelete(part.id)} />
      ))}
    </div>
  )
}

function PartRow({ part, expanded, onToggle, onUpdate, onDelete }) {
  return (
    <div style={{ marginBottom:2, border:`1px solid ${expanded?'#2a1000':'#160800'}`, background:expanded?'#110700':'#0a0503' }}>
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', cursor:'pointer', userSelect:'none' }}>
        <span style={{ color:'#331500', fontSize:9, width:8 }}>{expanded?'▼':'▶'}</span>
        <span style={{ color:'#441800', fontSize:12 }}>{SHAPE_ICONS[part.shape]||'?'}</span>
        <div style={{ width:10, height:10, background:part.color, border:'1px solid #33000066', flexShrink:0 }} />
        <span style={{ flex:1, color:'#886644', fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{part.label}</span>
        <span style={{ color:'#2a1000', fontSize:8, fontFamily:'monospace' }}>{(part.x||0).toFixed(1)},{(part.y||0).toFixed(1)},{(part.z||0).toFixed(1)}</span>
        <button onClick={e=>{e.stopPropagation();onDelete()}} style={{ background:'transparent', border:'none', color:'#441100', cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px' }}>×</button>
      </div>
      {expanded && <div style={{ padding:'8px 12px 10px', borderTop:'1px solid #1a0800' }}><PartEditor part={part} onChange={onUpdate} /></div>}
    </div>
  )
}

function PartEditor({ part, onChange }) {
  const Num = ({ label, k, step=0.05 }) => (
    <label style={{ display:'flex', alignItems:'center', gap:3 }}>
      <span style={{ color:'#441800', fontSize:8, minWidth:14 }}>{label}</span>
      <input type="number" step={step} value={+(part[k]??0).toFixed(3)} onChange={e=>onChange({[k]:parseFloat(e.target.value)||0})}
        style={{ width:52, background:'#0c0603', border:'1px solid #1e0a00', color:'#cc8844', fontFamily:'monospace', fontSize:9, padding:'2px 4px', outline:'none', textAlign:'right' }} />
    </label>
  )
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <input value={part.label} onChange={e=>onChange({label:e.target.value})} style={{ flex:1, background:'#0c0603', border:'1px solid #1e0a00', color:'#cc8844', fontFamily:'monospace', fontSize:10, padding:'3px 6px', outline:'none' }} />
        <select value={part.shape} onChange={e=>onChange({shape:e.target.value})} style={{ background:'#0c0603', border:'1px solid #1e0a00', color:'#cc8844', fontFamily:'monospace', fontSize:9, padding:'3px 4px', outline:'none' }}>
          {['box','sphere','cylinder','cone'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <input type="color" value={part.color||'#cc2200'} onChange={e=>onChange({color:e.target.value})} style={{ width:26, height:20, border:'none', padding:0, cursor:'pointer', background:'transparent' }} />
      </div>
      <div>
        <div style={{ color:'#2a1000', fontSize:8, letterSpacing:1, marginBottom:3 }}>DIMENSIONI</div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {part.shape==='box'      && <><Num label="W" k="w"/><Num label="H" k="h"/><Num label="D" k="d"/></>}
          {part.shape==='sphere'   && <Num label="R" k="r"/>}
          {(part.shape==='cylinder'||part.shape==='cone') && <><Num label="R" k="r"/><Num label="H" k="h"/></>}
        </div>
      </div>
      <div>
        <div style={{ color:'#2a1000', fontSize:8, letterSpacing:1, marginBottom:3 }}>POSIZIONE</div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}><Num label="X" k="x"/><Num label="Y" k="y"/><Num label="Z" k="z"/></div>
      </div>
      <div>
        <div style={{ color:'#2a1000', fontSize:8, letterSpacing:1, marginBottom:3 }}>ROTAZIONE (°)</div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}><Num label="RX" k="rx" step={1}/><Num label="RY" k="ry" step={1}/><Num label="RZ" k="rz" step={1}/></div>
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
    <pre style={{ color:'#554422', fontSize:9, fontFamily:'monospace', whiteSpace:'pre-wrap', wordBreak:'break-all', margin:0, lineHeight:1.6 }}>
      {JSON.stringify(json, null, 2)}
    </pre>
  )
}
