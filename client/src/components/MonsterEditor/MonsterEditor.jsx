import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import PageHeader from '../PageHeader.jsx'
import MonsterViewer from './MonsterViewer.jsx'

// ── Inject spinner + scrollbar styles once ────────────────────────────────────
const STYLE_ID = 'monster-editor-styles'
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    .me-num::-webkit-inner-spin-button,
    .me-num::-webkit-outer-spin-button {
      opacity: 1;
      width: 22px;
      height: 100%;
      cursor: pointer;
    }
    .me-num { -moz-appearance: number-input; }
    .me-scroll::-webkit-scrollbar { width: 5px; }
    .me-scroll::-webkit-scrollbar-track { background: #0a0705; }
    .me-scroll::-webkit-scrollbar-thumb { background: #2a1000; border-radius: 2px; }
    .me-scroll::-webkit-scrollbar-thumb:hover { background: #551800; }
    .me-btn-icon:hover { color: #ff4400 !important; }
    .me-part-row:hover { border-color: #441800 !important; }
    .me-card:hover .me-card-delete { opacity: 1 !important; }
  `
  document.head.appendChild(s)
}

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:         '#060402',
  bgPanel:    '#0a0705',
  bgInput:    '#120800',
  bgInputHov: '#1a0c00',
  bgCard:     '#0d0603',
  bgCardSel:  '#1c0800',
  bgTabAct:   '#180900',
  bgBtn:      '#1a0500',
  border:     '#261200',
  borderMed:  '#3a1800',
  borderAct:  '#cc2200',
  // Text
  txtBright:  '#ffcc88',   // input values, selected names
  txtMain:    '#cc7744',   // main readable text
  txtSub:     '#996644',   // labels, section headers
  txtDim:     '#664433',   // secondary info, tab inactive
  txtGhost:   '#3a2010',   // very subtle hints
  txtAccent:  '#ff6633',   // highlights, active tabs
  // Red tones
  red:        '#cc2200',
  redDim:     '#881500',
  redGhost:   '#441100',
}

// ── Default geometry ──────────────────────────────────────────────────────────
const DEFAULT_GEOMETRY = {
  v: 1,
  parts: [
    { id:'leg_l',  label:'Gamba Sx',   shape:'cylinder', w:0,    h:0.65, d:0,    r:0.12, x:-0.19, y:0.325, z:0,    rx:0,   ry:0, rz:0,   color:'#661111' },
    { id:'leg_r',  label:'Gamba Dx',   shape:'cylinder', w:0,    h:0.65, d:0,    r:0.12, x:0.19,  y:0.325, z:0,    rx:0,   ry:0, rz:0,   color:'#661111' },
    { id:'body',   label:'Corpo',      shape:'box',      w:0.72, h:0.85, d:0.48, r:0,    x:0,     y:1.075, z:0,    rx:0,   ry:0, rz:0,   color:'#8B2222' },
    { id:'arm_l',  label:'Braccio Sx', shape:'cylinder', w:0,    h:0.65, d:0,    r:0.1,  x:-0.51, y:0.97,  z:0,    rx:0,   ry:0, rz:22,  color:'#661111' },
    { id:'arm_r',  label:'Braccio Dx', shape:'cylinder', w:0,    h:0.65, d:0,    r:0.1,  x:0.51,  y:0.97,  z:0,    rx:0,   ry:0, rz:-22, color:'#661111' },
    { id:'head',   label:'Testa',      shape:'sphere',   w:0,    h:0,    d:0,    r:0.28, x:0,     y:1.73,  z:0,    rx:0,   ry:0, rz:0,   color:'#8B2222' },
    { id:'eye_l',  label:'Occhio Sx',  shape:'sphere',   w:0,    h:0,    d:0,    r:0.07, x:-0.1,  y:1.75,  z:0.24, rx:0,   ry:0, rz:0,   color:'#ff5500' },
    { id:'eye_r',  label:'Occhio Dx',  shape:'sphere',   w:0,    h:0,    d:0,    r:0.07, x:0.1,   y:1.75,  z:0.24, rx:0,   ry:0, rz:0,   color:'#ff5500' },
    { id:'horn_l', label:'Corno Sx',   shape:'cone',     w:0,    h:0.28, d:0,    r:0.07, x:-0.14, y:1.98,  z:0.06, rx:-15, ry:0, rz:-10, color:'#441111' },
    { id:'horn_r', label:'Corno Dx',   shape:'cone',     w:0,    h:0.28, d:0,    r:0.07, x:0.14,  y:1.98,  z:0.06, rx:-15, ry:0, rz:10,  color:'#441111' },
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

const uid   = () => Math.random().toString(36).slice(2,8)
const newPart = () => ({ id:uid(), label:'Parte', shape:'box', w:0.5, h:0.5, d:0.5, r:0.25, x:0, y:0.25, z:0, rx:0, ry:0, rz:0, color:'#cc2200' })
const BEHAVIORS   = ['patrol','chase','shoot','ambush','stationary']
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
  const [selectedPart, setSelectedPart] = useState(null)

  const loadMonsters = useCallback(async () => {
    try {
      const r = await fetch('/api/monsters', { headers: { Authorization:`Bearer ${token}` } })
      if (r.ok) setMonsters(await r.json())
    } catch {}
  }, [token])

  useEffect(() => { loadMonsters() }, [loadMonsters])

  const selectMonster = (m) => {
    setEditing({ id:m.id, name:m.name, health:m.health, speed:m.speed, damage:m.damage,
      behavior:m.behavior, sight_range:m.sight_range??10, attack_range:m.attack_range??2,
      resistances:m.resistances||{fire:0,ice:0,bullet:0},
      geometry:m.geometry||{v:1,parts:[]}, lore:m.lore||'' })
    setThumbnail(m.thumbnail||null); setTab('stats'); setExpandedPart(null); setSelectedPart(null)
  }

  const newMonster = () => {
    setEditing(DEFAULT_STATE()); setThumbnail(null); setTab('stats'); setExpandedPart(null); setSelectedPart(null)
  }

  const handlePartSelect = useCallback((partId) => {
    setSelectedPart(partId)
    setExpandedPart(partId)
    setTab('geometry')
  }, [])

  const saveMonster = async () => {
    if (!editing || saving) return
    setSaving(true)
    try {
      const url = editing.id ? `/api/monsters/${editing.id}` : '/api/monsters'
      const r = await fetch(url, {
        method: editing.id ? 'PUT' : 'POST',
        headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ name:editing.name, health:editing.health, speed:editing.speed,
          damage:editing.damage, behavior:editing.behavior, sight_range:editing.sight_range,
          attack_range:editing.attack_range, resistances:editing.resistances,
          geometry:editing.geometry, thumbnail, lore:editing.lore }),
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
  const addPart = () => { const p=newPart(); setEditing(e=>({...e,geometry:{...e.geometry,parts:[...e.geometry.parts,p]}})); setExpandedPart(p.id); setSelectedPart(p.id) }
  const delPart = (id) => { setEditing(e=>({...e,geometry:{...e.geometry,parts:e.geometry.parts.filter(p=>p.id!==id)}})); if(expandedPart===id) setExpandedPart(null); if(selectedPart===id) setSelectedPart(null) }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'Courier New, monospace',
      backgroundImage:'url(/bg-monsters.png)', backgroundSize:'cover', backgroundPosition:'center', position:'relative' }}>

      <PageHeader title="Editor Mostri" icon="/card-mostri.png" />

      {/* ── 3-column layout ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ── LEFT: monster list ── */}
        <div style={{ width:240, background:'rgba(6,4,2,0.88)', borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'10px', borderBottom:`1px solid ${C.border}` }}>
            <button onClick={newMonster}
              style={{ width:'100%', background:C.bgBtn, border:`1px solid ${C.redDim}`, color:C.txtAccent,
                fontFamily:'monospace', fontSize:11, letterSpacing:3, padding:'9px', cursor:'pointer',
                transition:'all 0.15s' }}
              onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#2a0800',borderColor:C.red,color:'#ff8844'})}
              onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:C.bgBtn,borderColor:C.redDim,color:C.txtAccent})}>
              + NUOVO MOSTRO
            </button>
          </div>
          <div className="me-scroll" style={{ flex:1, overflowY:'auto', padding:'8px' }}>
            {monsters.length === 0 &&
              <div style={{ color:C.txtGhost, fontSize:10, textAlign:'center', marginTop:40, letterSpacing:2, lineHeight:2 }}>
                NESSUN MOSTRO<br/>CREANE UNO
              </div>}
            {monsters.map(m =>
              <MonsterCard key={m.id} monster={m} selected={editing?.id===m.id}
                onClick={()=>selectMonster(m)} onDelete={()=>deleteMonster(m.id)} />)}
          </div>
        </div>

        {/* ── CENTER: 3D scene (transparent — bg-monsters shows through) ── */}
        <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
          {!editing ? (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center',
              justifyContent:'center',
              color:'#00eedd', fontSize:12, letterSpacing:4, textAlign:'center', lineHeight:2,
              textShadow:'0 0 16px #00ffee, 0 2px 6px #000' }}>
              SELEZIONA UN MOSTRO<br/>O CREANE UNO NUOVO
            </div>
          ) : (
            <MonsterViewer geometry={editing.geometry} onThumbnailCapture={setThumbnail}
              selectedPartId={selectedPart} onPartSelect={handlePartSelect} />
          )}
        </div>

        {/* ── RIGHT: inspector ── */}
        <div style={{ width:320, background:'rgba(10,7,5,0.90)', borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column', flexShrink:0 }}>
          {!editing ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              color:C.txtGhost, fontSize:11, letterSpacing:3, textAlign:'center' }}>
              INSPECTOR
            </div>
          ) : (
            <>
              {/* ── Name + actions ── */}
              <div style={{ padding:'10px 12px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                <input value={editing.name} onChange={e=>set('name',e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box', background:C.bgInput,
                    border:`1px solid ${C.borderMed}`, color:C.txtBright,
                    fontFamily:'monospace', fontSize:13, padding:'6px 9px',
                    outline:'none', letterSpacing:1, marginBottom:8 }} />
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={saveMonster} disabled={saving}
                    style={{ flex:1, background:saving?'#661100':'#aa1c00', border:'none', color:'#fff',
                      fontFamily:'monospace', fontSize:11, letterSpacing:2, padding:'7px 0',
                      cursor:saving?'default':'pointer', transition:'background 0.15s' }}>
                    {saving ? '...' : (editing.id ? '↑ AGGIORNA' : '✓ SALVA')}
                  </button>
                  {editing.id && (
                    <button onClick={()=>deleteMonster(editing.id)}
                      style={{ background:'transparent', border:`1px solid ${C.redGhost}`,
                        color:C.txtDim, fontFamily:'monospace', fontSize:13,
                        padding:'7px 11px', cursor:'pointer', transition:'all 0.15s' }}
                      onMouseEnter={e=>Object.assign(e.currentTarget.style,{borderColor:C.red,color:'#ff4400'})}
                      onMouseLeave={e=>Object.assign(e.currentTarget.style,{borderColor:C.redGhost,color:C.txtDim})}>
                      ×
                    </button>
                  )}
                  <button onClick={()=>setEditing(null)}
                    style={{ background:'transparent', border:`1px solid ${C.border}`,
                      color:C.txtGhost, fontFamily:'monospace', fontSize:13,
                      padding:'7px 9px', cursor:'pointer', transition:'all 0.15s' }}
                    onMouseEnter={e=>Object.assign(e.currentTarget.style,{borderColor:'#444',color:'#888'})}
                    onMouseLeave={e=>Object.assign(e.currentTarget.style,{borderColor:C.border,color:C.txtGhost})}>
                    ✕
                  </button>
                </div>
              </div>

              {/* ── Tab bar ── */}
              <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                {[['stats','STATS'],['geometry','GEO'],['json','JSON']].map(([t,l]) => (
                  <div key={t} onClick={()=>setTab(t)}
                    style={{ flex:1, padding:'8px 0', fontSize:10, letterSpacing:2, cursor:'pointer',
                      textAlign:'center', transition:'all 0.15s',
                      color: tab===t ? C.txtAccent : C.txtDim,
                      borderBottom: tab===t ? `2px solid ${C.red}` : '2px solid transparent',
                      background: tab===t ? C.bgTabAct : 'transparent' }}
                    onMouseEnter={e=>{ if(tab!==t) e.currentTarget.style.color=C.txtSub }}
                    onMouseLeave={e=>{ if(tab!==t) e.currentTarget.style.color=C.txtDim }}>
                    {l}
                  </div>
                ))}
              </div>

              {/* ── Tab content ── */}
              <div className="me-scroll" style={{ flex:1, overflowY:'auto', padding:'14px 12px' }}>
                {tab==='stats'    && <StatsTab    editing={editing} set={set} setRes={setRes} />}
                {tab==='geometry' && <GeometryTab parts={editing.geometry?.parts||[]}
                  expandedPart={expandedPart} setExpandedPart={setExpandedPart}
                  selectedPart={selectedPart} setSelectedPart={setSelectedPart}
                  onAdd={addPart} onDelete={delPart} onUpdate={setPart} />}
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
    <div className="me-card" onClick={onClick}
      style={{ border:`1px solid ${selected?C.red:C.border}`, background:selected?C.bgCardSel:C.bgCard,
        padding:'7px 8px', marginBottom:5, cursor:'pointer', display:'flex', gap:8,
        alignItems:'center', position:'relative', transition:'all 0.12s' }}
      onMouseEnter={e=>{ if(!selected) e.currentTarget.style.borderColor=C.borderMed }}
      onMouseLeave={e=>{ if(!selected) e.currentTarget.style.borderColor=C.border }}>
      {/* Thumbnail */}
      <div style={{ width:56, height:42, background:'#0c0805', border:`1px solid ${C.border}`,
        flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {monster.thumbnail
          ? <img src={monster.thumbnail} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : <span style={{ color:C.txtGhost, fontSize:20 }}>☠</span>}
      </div>
      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:selected?'#ff6633':C.txtMain, fontSize:11, overflow:'hidden',
          textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:1, fontWeight:'bold' }}>
          {monster.name}
        </div>
        <div style={{ color:C.txtDim, fontSize:9, marginTop:3, letterSpacing:1 }}>
          HP:{monster.health} · SPD:{monster.speed} · DMG:{monster.damage}
        </div>
        <div style={{ color:C.txtGhost, fontSize:9, marginTop:1, letterSpacing:1 }}>{monster.behavior}</div>
      </div>
      {/* Delete */}
      <button className="me-btn-icon" onClick={e=>{e.stopPropagation();onDelete()}}
        style={{ position:'absolute', top:3, right:4, background:'transparent', border:'none',
          color:C.txtGhost, cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 3px',
          opacity:0, transition:'opacity 0.15s, color 0.15s' }}>×</button>
    </div>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ editing, set, setRes }) {
  const r = editing.resistances || {}
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Slider label="VITA"      value={editing.health}       min={1} max={500} color='#cc4400' unit={editing.health}            onChange={v=>set('health',v)} />
      <Slider label="VELOCITÀ"  value={editing.speed}        min={1} max={20}  color='#ffcc00' unit={`${editing.speed}/20`}     onChange={v=>set('speed',v)} />
      <Slider label="DANNO"     value={editing.damage}       min={1} max={200} color='#cc0000' unit={editing.damage}            onChange={v=>set('damage',v)} />
      <Slider label="VISUALE"   value={editing.sight_range}  min={1} max={30}  color='#4488cc' unit={`${editing.sight_range}m`} onChange={v=>set('sight_range',v)} />
      <Slider label="ATTACCO"   value={editing.attack_range} min={1} max={10}  color='#cc8800' unit={`${editing.attack_range}m`}onChange={v=>set('attack_range',v)} />

      <div style={{ marginTop:2 }}>
        <Label>COMPORTAMENTO</Label>
        <select value={editing.behavior} onChange={e=>set('behavior',e.target.value)}
          style={{ width:'100%', background:C.bgInput, border:`1px solid ${C.borderMed}`,
            color:C.txtBright, fontFamily:'monospace', fontSize:12, padding:'6px 8px',
            outline:'none', cursor:'pointer', marginTop:5 }}>
          {BEHAVIORS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, marginTop:4 }}>
        <Label>RESISTENZE</Label>
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:10 }}>
          <Slider label="FUOCO"      value={r.fire||0}   min={0} max={100} color='#ff4400' unit={`${r.fire||0}%`}   onChange={v=>setRes('fire',v)} />
          <Slider label="GHIACCIO"   value={r.ice||0}    min={0} max={100} color='#44aaff' unit={`${r.ice||0}%`}    onChange={v=>setRes('ice',v)} />
          <Slider label="PROIETTILE" value={r.bullet||0} min={0} max={100} color='#88aa44' unit={`${r.bullet||0}%`} onChange={v=>setRes('bullet',v)} />
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, color, unit, onChange }) {
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
        <span style={{ color:C.txtSub, fontSize:10, letterSpacing:2 }}>{label}</span>
        <span style={{ color:color, fontSize:11, fontFamily:'monospace', fontWeight:'bold' }}>{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        style={{ width:'100%', accentColor:color, cursor:'pointer', height:4 }} />
    </div>
  )
}

// ── Geometry tab ──────────────────────────────────────────────────────────────
function GeometryTab({ parts, expandedPart, setExpandedPart, selectedPart, setSelectedPart, onAdd, onDelete, onUpdate }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <span style={{ color:C.txtDim, fontSize:10, letterSpacing:2 }}>{parts.length} PARTI</span>
        <button onClick={onAdd}
          style={{ background:C.bgBtn, border:`1px solid #663300`, color:'#cc7733',
            fontFamily:'monospace', fontSize:10, letterSpacing:1, padding:'5px 14px',
            cursor:'pointer', transition:'all 0.15s' }}
          onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#2a0a00',borderColor:C.red,color:'#ff8844'})}
          onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:C.bgBtn,borderColor:'#663300',color:'#cc7733'})}>
          + AGGIUNGI
        </button>
      </div>
      {parts.map(part => (
        <PartRow key={part.id} part={part}
          expanded={expandedPart===part.id}
          selected={selectedPart===part.id}
          onToggle={() => {
            const next = expandedPart===part.id ? null : part.id
            setExpandedPart(next)
            setSelectedPart(part.id)
          }}
          onUpdate={ch=>onUpdate(part.id,ch)}
          onDelete={()=>onDelete(part.id)} />
      ))}
    </div>
  )
}

function PartRow({ part, expanded, selected, onToggle, onUpdate, onDelete }) {
  const borderColor = selected ? C.red : expanded ? C.borderMed : C.border
  const bg = selected ? '#200a00' : expanded ? '#150900' : '#0d0603'
  return (
    <div className="me-part-row"
      style={{ marginBottom:3, border:`1px solid ${borderColor}`,
        background: bg, transition:'border-color 0.12s',
        boxShadow: selected ? `0 0 6px ${C.red}44` : 'none' }}>
      {/* Header */}
      <div onClick={onToggle}
        style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 8px',
          cursor:'pointer', userSelect:'none' }}>
        <span style={{ color:C.txtDim, fontSize:9, width:10 }}>{expanded?'▼':'▶'}</span>
        <span style={{ color:C.txtSub, fontSize:15 }}>{SHAPE_ICONS[part.shape]||'?'}</span>
        <div style={{ width:14, height:14, background:part.color, border:`1px solid #33000066`, flexShrink:0, borderRadius:1 }} />
        <span style={{ flex:1, color:selected?C.txtAccent:C.txtMain, fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:selected?'bold':'normal' }}>
          {part.label}
        </span>
        <span style={{ color:C.txtGhost, fontSize:9, fontFamily:'monospace', flexShrink:0, marginRight:4 }}>
          {(part.x||0).toFixed(2)},{(part.y||0).toFixed(2)},{(part.z||0).toFixed(2)}
        </span>
        <button className="me-btn-icon" onClick={e=>{e.stopPropagation();onDelete()}}
          style={{ background:'transparent', border:'none', color:C.txtGhost,
            cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px',
            flexShrink:0, transition:'color 0.15s' }}>×</button>
      </div>
      {/* Expanded editor */}
      {expanded && (
        <div style={{ padding:'12px 12px 14px', borderTop:`1px solid ${C.border}` }}>
          <PartEditor part={part} onChange={onUpdate} />
        </div>
      )}
    </div>
  )
}

function PartEditor({ part, onChange }) {
  const Num = ({ label, k, step=0.05 }) => (
    <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <span style={{ color:C.txtSub, fontSize:10, letterSpacing:1 }}>{label}</span>
      <input type="number" step={step} className="me-num"
        value={+(part[k]??0).toFixed(3)}
        onChange={e => onChange({ [k]: parseFloat(e.target.value) || 0 })}
        style={{ width:'100%', background:C.bgInput, border:`1px solid ${C.borderMed}`,
          color:C.txtBright, fontFamily:'monospace', fontSize:13,
          padding:'5px 6px', outline:'none', textAlign:'right',
          boxSizing:'border-box', height:34 }}
      />
    </label>
  )

  const Row = ({ children }) => (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${children.length||1}, 1fr)`, gap:7 }}>
      {children}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Label + Shape + Color */}
      <div style={{ display:'flex', gap:7, alignItems:'flex-end' }}>
        <label style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
          <span style={{ color:C.txtSub, fontSize:10, letterSpacing:1 }}>NOME</span>
          <input value={part.label} onChange={e=>onChange({label:e.target.value})}
            style={{ background:C.bgInput, border:`1px solid ${C.borderMed}`, color:C.txtBright,
              fontFamily:'monospace', fontSize:12, padding:'5px 7px', outline:'none',
              width:'100%', boxSizing:'border-box', height:34 }} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={{ color:C.txtSub, fontSize:10, letterSpacing:1 }}>FORMA</span>
          <select value={part.shape} onChange={e=>onChange({shape:e.target.value})}
            style={{ background:C.bgInput, border:`1px solid ${C.borderMed}`, color:C.txtBright,
              fontFamily:'monospace', fontSize:12, padding:'5px 7px', outline:'none',
              cursor:'pointer', height:34 }}>
            {['box','sphere','cylinder','cone'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={{ color:C.txtSub, fontSize:10, letterSpacing:1 }}>COLORE</span>
          <input type="color" value={part.color||'#cc2200'} onChange={e=>onChange({color:e.target.value})}
            style={{ width:44, height:34, border:`1px solid ${C.borderMed}`,
              padding:2, cursor:'pointer', background:C.bgInput }} />
        </label>
      </div>

      {/* Dimensions */}
      <div>
        <SectionLabel>DIMENSIONI</SectionLabel>
        {part.shape==='box'      && <Row><Num label="W" k="w"/><Num label="H" k="h"/><Num label="D" k="d"/></Row>}
        {part.shape==='sphere'   && <Row><Num label="RAGGIO" k="r"/></Row>}
        {(part.shape==='cylinder'||part.shape==='cone') && <Row><Num label="R" k="r"/><Num label="H" k="h"/></Row>}
      </div>

      {/* Position */}
      <div>
        <SectionLabel>POSIZIONE</SectionLabel>
        <Row><Num label="X" k="x"/><Num label="Y" k="y"/><Num label="Z" k="z"/></Row>
      </div>

      {/* Rotation */}
      <div>
        <SectionLabel>ROTAZIONE °</SectionLabel>
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
    stats:{ health:editing.health, speed:editing.speed, damage:editing.damage,
      behavior:editing.behavior, sight_range:editing.sight_range, attack_range:editing.attack_range },
    resistances:editing.resistances,
    geometry:editing.geometry,
    lore:editing.lore,
  }
  return (
    <pre style={{ color:'#997755', fontSize:10, fontFamily:'monospace', whiteSpace:'pre-wrap',
      wordBreak:'break-all', margin:0, lineHeight:1.8 }}>
      {JSON.stringify(json, null, 2)}
    </pre>
  )
}

// ── Shared micro-components ───────────────────────────────────────────────────
function Label({ children }) {
  return <div style={{ color:C.txtSub, fontSize:10, letterSpacing:2, marginBottom:2 }}>{children}</div>
}
function SectionLabel({ children }) {
  return <div style={{ color:C.txtDim, fontSize:10, letterSpacing:2, marginBottom:7,
    borderBottom:`1px solid ${C.border}`, paddingBottom:4 }}>{children}</div>
}
