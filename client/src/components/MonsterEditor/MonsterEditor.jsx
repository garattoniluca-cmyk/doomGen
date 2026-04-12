import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import PageHeader from '../PageHeader.jsx'
import MonsterViewer from './MonsterViewer.jsx'
import { monsterSfx, randomMonsterSounds, randomAlertSound, randomMovementSound,
         MOVEMENT_CATEGORIES, MOOD_COLORS } from '../../utils/monsterSfx.js'

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
    .me-card:hover .me-card-actions { opacity: 1 !important; }
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
  sounds: randomMonsterSounds('Nuovo Mostro'),
})

const uid   = () => Math.random().toString(36).slice(2,8)
const newPart = () => ({ id:uid(), label:'Parte', shape:'box', w:0.5, h:0.5, d:0.5, r:0.25, x:0, y:0.25, z:0, rx:0, ry:0, rz:0, color:'#cc2200' })
const BEHAVIORS   = ['patrol','chase','shoot','ambush','stationary']
const SHAPE_ICONS = { box:'□', sphere:'○', cylinder:'⊙', cone:'△' }

// ── Symmetry helpers ──────────────────────────────────────────────────────────
const SYM_EPS = 0.001
function isMirrorPair(a, b) {
  return Math.abs(a.x) > SYM_EPS &&
    Math.abs(b.x + a.x) < SYM_EPS &&
    Math.abs(b.y  - a.y)  < SYM_EPS &&
    Math.abs(b.z  - a.z)  < SYM_EPS &&
    Math.abs(b.rx - a.rx) < SYM_EPS &&
    Math.abs(b.ry + a.ry) < SYM_EPS &&
    Math.abs(b.rz + a.rz) < SYM_EPS &&
    a.shape === b.shape &&
    Math.abs((b.w||0) - (a.w||0)) < SYM_EPS &&
    Math.abs((b.h||0) - (a.h||0)) < SYM_EPS &&
    Math.abs((b.d||0) - (a.d||0)) < SYM_EPS &&
    Math.abs((b.r||0) - (a.r||0)) < SYM_EPS &&
    a.color === b.color
}
function buildSymMap(parts) {
  const map = {}
  for (let i = 0; i < parts.length; i++) {
    if (map[parts[i].id]) continue
    for (let j = i + 1; j < parts.length; j++) {
      if (map[parts[j].id]) continue
      if (isMirrorPair(parts[i], parts[j]) || isMirrorPair(parts[j], parts[i])) {
        map[parts[i].id] = parts[j].id
        map[parts[j].id] = parts[i].id
        break
      }
    }
  }
  return map
}
// Mirror a change dict across the X axis
function mirrorChange(ch) {
  const m = { ...ch }
  if ('x'  in ch) m.x  = -ch.x
  if ('ry' in ch) m.ry = -ch.ry
  if ('rz' in ch) m.rz = -ch.rz
  return m
}

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
  const [transformMode, setTransformMode] = useState('translate')
  const [transformSpace, setTransformSpace] = useState('world')

  // ── Undo / Redo ───────────────────────────────────────────────────────────────
  // curRef è aggiornato SINCRONICAMENTE ad ogni mutazione (non aspetta il render)
  // così pushUndo cattura sempre lo stato reale corrente, anche in chiamate rapide consecutive
  const undoStack = useRef([])
  const redoStack = useRef([])
  const curRef    = useRef(null)
  const [histLen, setHistLen] = useState({ u:0, r:0 })

  // ── Dirty tracking ────────────────────────────────────────────────────────────
  const savedRef      = useRef(null)
  const savedThumbRef = useRef(null)

  // ── Symmetry ─────────────────────────────────────────────────────────────────
  // symMapRef: { partId → mirrorPartId } — recomputed on load/save, volatile
  // symActiveRef: always current (avoids stale closure in memoized callbacks)
  const symMapRef    = useRef({})
  const symActiveRef = useRef(new Set())
  const [symActive, _setSymActive] = useState(new Set())
  const setSymActive = (val) => {
    const next = typeof val === 'function' ? val(symActiveRef.current) : val
    symActiveRef.current = next
    _setSymActive(next)
  }

  // Aggiorna stato e curRef insieme — usato da tutti i setter
  const _commit = (next) => { curRef.current = next; setEditing(next) }

  const _pushUndo = () => {
    if (!curRef.current) return
    undoStack.current = [...undoStack.current.slice(-49), curRef.current]
    redoStack.current = []
    setHistLen({ u: undoStack.current.length, r: 0 })
  }

  const _rebuildSym = (state) => {
    const map = buildSymMap(state?.geometry?.parts || [])
    symMapRef.current = map
    const all = new Set(Object.keys(map))
    symActiveRef.current = all
    _setSymActive(all)
  }

  const undo = useCallback(() => {
    if (!undoStack.current.length) return
    if (curRef.current)
      redoStack.current = [curRef.current, ...redoStack.current.slice(0, 49)]
    const prev = undoStack.current[undoStack.current.length - 1]
    undoStack.current = undoStack.current.slice(0, -1)
    curRef.current = prev
    setEditing(prev)
    setHistLen({ u: undoStack.current.length, r: redoStack.current.length })
    _rebuildSym(prev)
  }, [])

  const redo = useCallback(() => {
    if (!redoStack.current.length) return
    if (curRef.current)
      undoStack.current = [...undoStack.current.slice(-49), curRef.current]
    const next = redoStack.current[0]
    redoStack.current = redoStack.current.slice(1)
    curRef.current = next
    setEditing(next)
    setHistLen({ u: undoStack.current.length, r: redoStack.current.length })
    _rebuildSym(next)
  }, [])

  useEffect(() => {
    const handler = e => {
      // Ignore if focus is inside a text input / textarea
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected part
        if (selectedPart) { e.preventDefault(); delPart(selectedPart) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, selectedPart])

  const loadMonsters = useCallback(async () => {
    try {
      const r = await fetch('/api/monsters', { headers: { Authorization:`Bearer ${token}` } })
      if (r.ok) setMonsters(await r.json())
    } catch {}
  }, [token])

  useEffect(() => { loadMonsters() }, [loadMonsters])

  const _initSym = (parts) => {
    const map = buildSymMap(parts)
    symMapRef.current = map
    // Auto-activate all detected pairs
    setSymActive(new Set(Object.keys(map)))
  }

  const selectMonster = (m) => {
    undoStack.current = []; redoStack.current = []; setHistLen({ u:0, r:0 })
    const s = { id:m.id, name:m.name, health:m.health, speed:m.speed, damage:m.damage,
      behavior:m.behavior, sight_range:m.sight_range??10, attack_range:m.attack_range??2,
      resistances:m.resistances||{fire:0,ice:0,bullet:0},
      geometry:m.geometry||{v:1,parts:[]}, lore:m.lore||'',
      sounds:m.sounds||randomMonsterSounds(m.name||'monster') }
    curRef.current = s; savedRef.current = s; setEditing(s)
    savedThumbRef.current = m.thumbnail||null
    _initSym(s.geometry?.parts || [])
    setThumbnail(m.thumbnail||null); setTab('stats'); setExpandedPart(null); setSelectedPart(null)
  }

  const newMonster = () => {
    undoStack.current = []; redoStack.current = []; setHistLen({ u:0, r:0 })
    const s = DEFAULT_STATE(); curRef.current = s; savedRef.current = null; setEditing(s)
    savedThumbRef.current = null
    _initSym(s.geometry.parts)
    setThumbnail(null); setTab('stats'); setExpandedPart(null); setSelectedPart(null)
  }

  const handlePartSelect = useCallback((partId) => {
    setSelectedPart(partId)
    setExpandedPart(partId)
  }, [])

  const handlePartTransform = useCallback((partId, updates) => {
    setPart(partId, updates)
  }, [])

  const saveMonster = async () => {
    if (!editing || saving) return
    setSaving(true)
    const snapEditing = curRef.current
    const snapThumb   = thumbnail
    try {
      const url = editing.id ? `/api/monsters/${editing.id}` : '/api/monsters'
      const r = await fetch(url, {
        method: editing.id ? 'PUT' : 'POST',
        headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ name:editing.name, health:editing.health, speed:editing.speed,
          damage:editing.damage, behavior:editing.behavior, sight_range:editing.sight_range,
          attack_range:editing.attack_range, resistances:editing.resistances,
          geometry:editing.geometry, thumbnail, lore:editing.lore,
          sounds:editing.sounds }),
      })
      if (r.ok) {
        const data = await r.json()
        if (!editing.id && data.id) {
          const updated = { ...snapEditing, id: data.id }
          savedRef.current = updated
          curRef.current   = updated
          setEditing(updated)
        } else {
          savedRef.current = snapEditing
        }
        savedThumbRef.current = snapThumb
        // Rebuild symmetry map after save — volatile, based on saved geometry
        _initSym(snapEditing.geometry?.parts || [])
        await loadMonsters()
      }
    } finally { setSaving(false) }
  }

  const duplicateMonster = () => {
    if (!editing) return
    duplicateFrom(editing)
  }

  const duplicateFrom = (m) => {
    undoStack.current = []; redoStack.current = []; setHistLen({ u:0, r:0 })
    const s = {
      id: null,
      name: m.name + ' (copia)',
      health: m.health, speed: m.speed, damage: m.damage,
      behavior: m.behavior, sight_range: m.sight_range ?? 10, attack_range: m.attack_range ?? 2,
      resistances: m.resistances || { fire:0, ice:0, bullet:0 },
      geometry: { v:1, parts: (m.geometry?.parts || []).map(p => ({ ...p, id: uid() })) },
      lore: m.lore || '',
      sounds: m.sounds ? JSON.parse(JSON.stringify(m.sounds)) : randomMonsterSounds(m.name||'monster'),
    }
    curRef.current = s; savedRef.current = null; setEditing(s)
    savedThumbRef.current = null
    _initSym(s.geometry?.parts || [])
    setThumbnail(null); setTab('stats'); setExpandedPart(null); setSelectedPart(null)
  }

  const deleteMonster = async (id) => {
    if (!confirm('Eliminare questo mostro?')) return
    await fetch(`/api/monsters/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } })
    if (editing?.id === id) setEditing(null)
    await loadMonsters()
  }

  const setSounds   = (ch)       => { _pushUndo(); _commit({...curRef.current, sounds:{...curRef.current.sounds,...ch}}) }

  // Apply a part change (and optionally its mirror) to an arbitrary base state
  const _applyPartChange = (base, id, ch, mirrorId) => {
    const parts = base.geometry.parts.map(p =>
      p.id === id       ? { ...p, ...ch } :
      p.id === mirrorId ? { ...p, ...mirrorChange(ch) } : p)
    return { ...base, geometry: { ...base.geometry, parts } }
  }

  const set     = (k, v) => { _pushUndo(); _commit({...curRef.current, [k]:v}) }
  const setRes  = (k, v) => { _pushUndo(); _commit({...curRef.current, resistances:{...curRef.current.resistances,[k]:v}}) }

  const setPart = (id, ch) => {
    _pushUndo()
    const mid = symMapRef.current[id]
    const useSym = mid && symActiveRef.current.has(id)
    const next = _applyPartChange(curRef.current, id, ch, useSym ? mid : null)
    _commit(next)
    // Asymmetric change (sym off) → break the pair so it's not re-detected
    if (mid && !useSym) {
      const m = { ...symMapRef.current }; delete m[id]; delete m[mid]; symMapRef.current = m
      setSymActive(prev => { const s = new Set(prev); s.delete(id); s.delete(mid); return s })
    }
  }

  // setPartLive: preview visivo solo — NON aggiorna curRef
  const setPartLive = (id, ch) => {
    const mid = symMapRef.current[id]
    const useSym = mid && symActiveRef.current.has(id)
    setEditing(_applyPartChange(curRef.current, id, ch, useSym ? mid : null))
  }

  const toggleSym = (id) => {
    const mid = symMapRef.current[id]
    if (!mid) return
    setSymActive(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id); s.delete(mid) }
      else           { s.add(id);    s.add(mid) }
      return s
    })
  }

  const addPart = () => {
    const p = newPart()
    _pushUndo()
    _commit({...curRef.current, geometry:{...curRef.current.geometry, parts:[...curRef.current.geometry.parts, p]}})
    setExpandedPart(p.id); setSelectedPart(p.id)
  }

  const addSymPair = () => {
    const id1 = uid(), id2 = uid()
    const base = newPart()
    const p1 = { ...base, id:id1, x: 0.3 }
    const p2 = { ...base, id:id2, x:-0.3 }
    _pushUndo()
    _commit({...curRef.current, geometry:{...curRef.current.geometry, parts:[...curRef.current.geometry.parts, p1, p2]}})
    symMapRef.current = { ...symMapRef.current, [id1]:id2, [id2]:id1 }
    setSymActive(prev => { const s = new Set(prev); s.add(id1); s.add(id2); return s })
    setExpandedPart(id1); setSelectedPart(id1)
  }

  const copyPart = (id, withMirror) => {
    const src = curRef.current.geometry.parts.find(p => p.id === id)
    if (!src) return
    const mid = symMapRef.current[id]
    const srcMirror = (withMirror && mid) ? curRef.current.geometry.parts.find(p => p.id === mid) : null
    const newId1 = uid()
    const newId2 = srcMirror ? uid() : null
    const newParts = [...curRef.current.geometry.parts, { ...src, id: newId1 },
      ...(srcMirror ? [{ ...srcMirror, id: newId2 }] : [])]
    _pushUndo()
    _commit({ ...curRef.current, geometry: { ...curRef.current.geometry, parts: newParts } })
    if (srcMirror) {
      symMapRef.current = { ...symMapRef.current, [newId1]: newId2, [newId2]: newId1 }
      setSymActive(prev => { const s = new Set(prev); s.add(newId1); s.add(newId2); return s })
    }
    setExpandedPart(newId1); setSelectedPart(newId1)
  }

  const delPart = (id) => {
    const mid = symMapRef.current[id]
    _pushUndo()
    _commit({...curRef.current, geometry:{...curRef.current.geometry,
      parts:curRef.current.geometry.parts.filter(p=>p.id!==id)}})
    if (mid) { const m = { ...symMapRef.current }; delete m[id]; delete m[mid]; symMapRef.current = m }
    setSymActive(prev => { const s = new Set(prev); s.delete(id); if(mid) s.delete(mid); return s })
    if (expandedPart===id) setExpandedPart(null)
    if (selectedPart===id) setSelectedPart(null)
  }

  // true when editing state differs from last DB save (or monster has never been saved)
  const isDirty = !editing ? false
    : editing.id === null
      ? true
      : JSON.stringify(editing) !== JSON.stringify(savedRef.current) || thumbnail !== savedThumbRef.current

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
                onClick={()=>selectMonster(m)} onDelete={()=>deleteMonster(m.id)}
                onDuplicate={()=>duplicateFrom(m)} />)}
          </div>
        </div>

        {/* ── CENTER: 3D scene ── */}
        <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
          {!editing ? (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center',
              justifyContent:'center',
              color:'#00eedd', fontSize:12, letterSpacing:4, textAlign:'center', lineHeight:2,
              textShadow:'0 0 16px #00ffee, 0 2px 6px #000' }}>
              SELEZIONA UN MOSTRO<br/>O CREANE UNO NUOVO
            </div>
          ) : (
            <>
              <MonsterViewer
                geometry={editing.geometry} onThumbnailCapture={setThumbnail}
                selectedPartId={selectedPart}
                onPartSelect={tab === 'geometry' ? handlePartSelect : null}
                onPartTransform={handlePartTransform}
                transformMode={transformMode} transformSpace={transformSpace}
              />
              {/* ── Gizmo toolbar overlay ── */}
              {selectedPart && (
                <div style={{
                  position:'absolute', top:10, left:'50%', transform:'translateX(-50%)',
                  display:'flex', gap:4, alignItems:'center',
                  background:'rgba(6,4,2,0.82)', border:`1px solid ${C.border}`,
                  padding:'4px 8px', pointerEvents:'auto',
                }}>
                  {[['translate','T','Traslazione'],['rotate','R','Rotazione'],['scale','S','Scala']].map(([m,k,label]) => (
                    <button key={m} onClick={() => setTransformMode(m)} title={label}
                      style={{
                        background: transformMode===m ? C.red : 'transparent',
                        border: `1px solid ${transformMode===m ? C.red : C.borderMed}`,
                        color: transformMode===m ? '#fff' : C.txtSub,
                        fontFamily:'monospace', fontSize:11, fontWeight:'bold',
                        padding:'3px 10px', cursor:'pointer', letterSpacing:1,
                        transition:'all 0.1s',
                      }}>{k}</button>
                  ))}
                  <div style={{ width:1, height:18, background:C.border, margin:'0 4px' }} />
                  {[['world','MONDO'],['local','LOCALE']].map(([s,label]) => (
                    <button key={s} onClick={() => setTransformSpace(s)} title={label}
                      style={{
                        background: transformSpace===s ? '#1a0900' : 'transparent',
                        border: `1px solid ${transformSpace===s ? C.borderMed : C.border}`,
                        color: transformSpace===s ? C.txtMain : C.txtGhost,
                        fontFamily:'monospace', fontSize:9, letterSpacing:2,
                        padding:'3px 8px', cursor:'pointer', transition:'all 0.1s',
                      }}>{label}</button>
                  ))}
                  <div style={{ width:1, height:18, background:C.border, margin:'0 4px' }} />
                  <button onClick={() => delPart(selectedPart)} title="Elimina parte (Canc)"
                    style={{
                      background: C.redGhost, border:`1px solid ${C.redDim}`,
                      color:'#cc4422', fontFamily:'monospace', fontSize:11, fontWeight:'bold',
                      padding:'3px 10px', cursor:'pointer', letterSpacing:1, transition:'all 0.1s',
                    }}
                    onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#3a0000',borderColor:C.red,color:'#ff5533'})}
                    onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:C.redGhost,borderColor:C.redDim,color:'#cc4422'})}>
                    ⊗
                  </button>
                </div>
              )}
            </>
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
                  {(isDirty || saving) && (
                  <button onClick={saveMonster} disabled={saving}
                    style={{ flex:1, background:saving?'#661100':'#aa1c00', border:'none', color:'#fff',
                      fontFamily:'monospace', fontSize:11, letterSpacing:2, padding:'7px 0',
                      cursor:saving?'default':'pointer', transition:'background 0.15s' }}>
                    {saving ? '...' : (editing.id ? '↑ AGGIORNA' : '✓ SALVA')}
                  </button>
                  )}
                  {/* Duplicate */}
                  <IconBtn onClick={duplicateMonster} title="Duplica mostro"
                    icon="⧉" label="COPIA"
                    base={{ bg:'transparent', border:C.borderMed, color:C.txtSub }}
                    hover={{ bg:'#0d1a0d', border:'#336633', color:'#88cc88' }} />
                  {/* Delete from DB */}
                  {editing.id && (
                    <IconBtn onClick={()=>deleteMonster(editing.id)} title="Elimina dal database"
                      icon="⊗" label="ELIMINA"
                      base={{ bg:C.redGhost, border:C.redDim, color:'#cc4422' }}
                      hover={{ bg:'#3a0000', border:C.red, color:'#ff5533' }} />
                  )}
                  {/* Close panel */}
                  <IconBtn onClick={()=>setEditing(null)} title="Chiudi"
                    icon="←" label="CHIUDI"
                    base={{ bg:'transparent', border:'#2a2a2a', color:'#555' }}
                    hover={{ bg:'#1a1a1a', border:'#666', color:'#aaa' }} />
                </div>
                {/* ── Undo / Redo buttons ── */}
                <div style={{ display:'flex', gap:6, marginTop:6 }}>
                  {[
                    { fn: undo, enabled: histLen.u > 0, label:'⟲', title:`Annulla (Ctrl+Z) — ${histLen.u} step` },
                    { fn: redo, enabled: histLen.r > 0, label:'⟳', title:`Ripristina (Ctrl+Y) — ${histLen.r} step` },
                  ].map(({ fn, enabled, label, title }) => (
                    <button key={label} onClick={fn} disabled={!enabled} title={title}
                      style={{
                        flex:1, background: enabled ? C.bgBtn : 'transparent',
                        border: `1px solid ${enabled ? C.borderMed : C.border}`,
                        color: enabled ? C.txtMain : C.txtGhost,
                        fontFamily:'monospace', fontSize:15, padding:'4px 0',
                        cursor: enabled ? 'pointer' : 'default', transition:'all 0.15s',
                        opacity: enabled ? 1 : 0.35,
                      }}
                      onMouseEnter={e=>{ if(enabled) Object.assign(e.currentTarget.style,{borderColor:C.red,color:C.txtAccent}) }}
                      onMouseLeave={e=>{ if(enabled) Object.assign(e.currentTarget.style,{borderColor:C.borderMed,color:C.txtMain}) }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Tab bar ── */}
              <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                {[['stats','≡','STATS'],['geometry','⬡','GEO'],['sfx','♪','SFX'],['json','{}','JSON']].map(([t,icon,l]) => {
                  const active = tab === t
                  return (
                    <div key={t} onClick={()=>{ setTab(t); if(t!=='geometry'){ setSelectedPart(null); setExpandedPart(null) } }}
                      style={{ flex:1, padding:'8px 0', cursor:'pointer', textAlign:'center',
                        transition:'all 0.15s', display:'flex', flexDirection:'column',
                        alignItems:'center', gap:3,
                        color: active ? C.txtAccent : C.txtDim,
                        borderBottom: active ? `2px solid ${C.red}` : '2px solid transparent',
                        background: active ? C.bgTabAct : 'transparent' }}
                      onMouseEnter={e=>{ if(!active){ e.currentTarget.style.color=C.txtSub; e.currentTarget.style.background='#0d0703' } }}
                      onMouseLeave={e=>{ if(!active){ e.currentTarget.style.color=C.txtDim; e.currentTarget.style.background='transparent' } }}>
                      <span style={{ fontSize:17, lineHeight:1 }}>{icon}</span>
                      <span style={{ fontSize:8, letterSpacing:2 }}>{l}</span>
                    </div>
                  )
                })}
              </div>

              {/* ── Tab content ── */}
              <div className="me-scroll" style={{ flex:1, overflowY:'auto', padding:'14px 12px' }}>
                {tab==='stats'    && <StatsTab    editing={editing} set={set} setRes={setRes} />}
                {tab==='geometry' && <GeometryTab parts={editing.geometry?.parts||[]}
                  expandedPart={expandedPart} setExpandedPart={setExpandedPart}
                  selectedPart={selectedPart} setSelectedPart={setSelectedPart}
                  symMap={symMapRef.current} symActive={symActive} onSymToggle={toggleSym}
                  onAdd={addPart} onAddPair={addSymPair} onDelete={delPart} onCopy={copyPart} onUpdate={setPart} onLiveUpdate={setPartLive} />}
                {tab==='sfx'      && <SfxTab sounds={editing.sounds} setSounds={setSounds} monsterName={editing.name} />}
                {tab==='json'     && <JSONTab     editing={editing} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Icon button (icon + small label stacked) ─────────────────────────────────
function IconBtn({ onClick, title, icon, label, base, hover }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background:base.bg, border:`1px solid ${base.border}`, color:base.color,
        fontFamily:'monospace', cursor:'pointer', transition:'all 0.15s',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:'5px 10px', gap:2, minWidth:48 }}
      onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:hover.bg,borderColor:hover.border,color:hover.color})}
      onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:base.bg,borderColor:base.border,color:base.color})}>
      <span style={{ fontSize:16, lineHeight:1 }}>{icon}</span>
      <span style={{ fontSize:8, letterSpacing:1 }}>{label}</span>
    </button>
  )
}

// ── Monster card ──────────────────────────────────────────────────────────────
function MonsterCard({ monster, selected, onClick, onDelete, onDuplicate }) {
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
      {/* Hover actions */}
      <div className="me-card-actions"
        style={{ position:'absolute', top:0, right:0, bottom:0, display:'flex', flexDirection:'column',
          opacity:0, transition:'opacity 0.15s' }}>
        <button title="Duplica" onClick={e=>{e.stopPropagation();onDuplicate()}}
          style={{ flex:1, background:'#0d1a0d', border:'none', borderLeft:`1px solid #224422`,
            color:'#66aa66', cursor:'pointer', fontSize:13, padding:'0 8px', transition:'all 0.1s' }}
          onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#1a3a1a',color:'#88dd88'})}
          onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:'#0d1a0d',color:'#66aa66'})}>
          ⧉
        </button>
        <button title="Elimina" onClick={e=>{e.stopPropagation();onDelete()}}
          style={{ flex:1, background:C.redGhost, border:'none', borderLeft:`1px solid ${C.redDim}`,
            borderTop:`1px solid #1a0000`, color:'#aa3322', cursor:'pointer', fontSize:13, padding:'0 8px', transition:'all 0.1s' }}
          onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#3a0000',color:'#ff4422'})}
          onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:C.redGhost,color:'#aa3322'})}>
          ⊗
        </button>
      </div>
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
function GeometryTab({ parts, expandedPart, setExpandedPart, selectedPart, setSelectedPart,
    symMap, symActive, onSymToggle, onAdd, onAddPair, onDelete, onCopy, onUpdate, onLiveUpdate }) {
  const allColors = [...new Set(parts.map(p=>p.color).filter(Boolean))]
  const Btn = ({ onClick, children, title }) => (
    <button onClick={onClick} title={title}
      style={{ background:C.bgBtn, border:`1px solid #663300`, color:'#cc7733',
        fontFamily:'monospace', fontSize:10, letterSpacing:1, padding:'5px 10px',
        cursor:'pointer', transition:'all 0.15s' }}
      onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#2a0a00',borderColor:C.red,color:'#ff8844'})}
      onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:C.bgBtn,borderColor:'#663300',color:'#cc7733'})}>
      {children}
    </button>
  )
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:5 }}>
        <span style={{ color:C.txtDim, fontSize:10, letterSpacing:2 }}>{parts.length} PARTI</span>
        <div style={{ display:'flex', gap:5 }}>
          <Btn onClick={onAddPair} title="Aggiungi coppia simmetrica">⟺ COPPIA</Btn>
          <Btn onClick={onAdd}     title="Aggiungi parte singola">+ SINGOLA</Btn>
        </div>
      </div>
      {parts.map(part => (
        <PartRow key={part.id} part={part}
          expanded={expandedPart===part.id}
          selected={selectedPart===part.id}
          allColors={allColors}
          hasMirror={!!symMap[part.id]}
          symOn={symActive.has(part.id)}
          onSymToggle={()=>onSymToggle(part.id)}
          onCopy={(withMirror)=>onCopy(part.id, withMirror)}
          onToggle={() => {
            const next = expandedPart===part.id ? null : part.id
            setExpandedPart(next)
            setSelectedPart(part.id)
          }}
          onUpdate={ch=>onUpdate(part.id,ch)}
          onLiveUpdate={ch=>onLiveUpdate(part.id,ch)}
          onDelete={()=>onDelete(part.id)} />
      ))}
    </div>
  )
}

function PartRow({ part, expanded, selected, allColors, hasMirror, symOn, onSymToggle, onCopy, onToggle, onUpdate, onLiveUpdate, onDelete }) {
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
        <span style={{ color:C.txtGhost, fontSize:9, fontFamily:'monospace', flexShrink:0 }}>
          {(part.x||0).toFixed(2)},{(part.y||0).toFixed(2)},{(part.z||0).toFixed(2)}
        </span>
        {hasMirror && (
          <button title={symOn ? 'Simmetria attiva — click per disattivare' : 'Attiva simmetria con controparte'}
            onClick={e=>{e.stopPropagation(); onSymToggle()}}
            style={{ background: symOn ? '#002244' : 'transparent',
              border: `1px solid ${symOn ? '#2266aa' : C.border}`,
              color: symOn ? '#44aaff' : C.txtGhost,
              fontFamily:'monospace', fontSize:11, lineHeight:1,
              padding:'1px 5px', cursor:'pointer', flexShrink:0,
              transition:'all 0.15s', borderRadius:1 }}>
            ⟺
          </button>
        )}
        <button className="me-btn-icon"
          title={hasMirror ? 'Copia parte (click) / copia coppia (shift+click)' : 'Copia parte'}
          onClick={e=>{e.stopPropagation(); onCopy(hasMirror && e.shiftKey)}}
          style={{ background:'transparent', border:'none', color:C.txtGhost,
            cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px',
            flexShrink:0, transition:'color 0.15s' }}>⧉</button>
        <button className="me-btn-icon" onClick={e=>{e.stopPropagation();onDelete()}}
          style={{ background:'transparent', border:'none', color:C.txtGhost,
            cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px',
            flexShrink:0, transition:'color 0.15s' }}>×</button>
      </div>
      {/* Expanded editor */}
      {expanded && (
        <div style={{ padding:'12px 12px 14px', borderTop:`1px solid ${C.border}` }}>
          <PartEditor part={part} onChange={onUpdate} onLive={onLiveUpdate} allColors={allColors} />
        </div>
      )}
    </div>
  )
}

function PartEditor({ part, onChange, onLive, allColors = [] }) {
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
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={{ color:C.txtSub, fontSize:10, letterSpacing:1 }}>COLORE</span>
          <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
            <input type="color" value={part.color||'#cc2200'}
              onInput={e => onLive?.({color:e.target.value})}
              onBlur={e => onChange({color:e.target.value})}
              style={{ width:44, height:34, border:`1px solid ${C.borderMed}`,
                padding:2, cursor:'pointer', background:C.bgInput, flexShrink:0 }} />
            {allColors.map(c => (
              <div key={c} title={c}
                onClick={() => onChange({color:c})}
                style={{
                  width: 18, height: 18, background: c, cursor:'pointer', flexShrink:0,
                  border: `2px solid ${c === part.color ? '#fff' : '#33000066'}`,
                  borderRadius:2, transition:'transform 0.1s',
                }}
                onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.25)' }}
                onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)' }} />
            ))}
          </div>
        </div>
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
    sounds:editing.sounds,
    lore:editing.lore,
  }
  return (
    <pre style={{ color:'#997755', fontSize:10, fontFamily:'monospace', whiteSpace:'pre-wrap',
      wordBreak:'break-all', margin:0, lineHeight:1.8 }}>
      {JSON.stringify(json, null, 2)}
    </pre>
  )
}

// ── SFX tab ───────────────────────────────────────────────────────────────────
const WAVE_LABEL   = { saw:'sega', square:'quadra', tri:'triangolo', sine:'sinusoide' }
const FILTER_LABEL = { lp:'LP', hp:'HP', bp:'BP' }
const NOISE_LABEL  = { brown:'marrone', pink:'rosa', white:'bianco' }

function layerDesc(l) {
  if (l.src === 'osc') {
    const hz   = Math.round(l.freq || 0)
    const wave = WAVE_LABEL[l.wave] || l.wave || '?'
    const flt  = l.filter?.type && l.filter.type !== 'off'
      ? `  ${FILTER_LABEL[l.filter.type] || l.filter.type} ${Math.round(l.filter.freq || 0)}Hz` : ''
    const lfo  = l.lfo ? `  mod:${l.lfo.target} ${+(l.lfo.rate||0).toFixed(1)}Hz` : ''
    const swp  = l.freqSweep ? `  sweep ${Math.round(l.freqSweep.from)}→${Math.round(l.freqSweep.to)}Hz` : ''
    return `osc ${wave} ${hz}Hz${swp}${flt}${lfo}`
  }
  const nc  = NOISE_LABEL[l.noiseColor] || l.noiseColor || '?'
  const flt = l.filter?.type && l.filter.type !== 'off'
    ? `  ${FILTER_LABEL[l.filter.type] || l.filter.type} ${Math.round(l.filter.freq || 0)}Hz` : ''
  return `rumore ${nc}${flt}`
}

function sfxRng() {
  let s = (Math.random() * 0xFFFFFFFF) | 0
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 0xFFFFFFFF }
}

function SfxTab({ sounds, setSounds }) {
  const alertHandleRef = useRef(null)
  const loopHandleRef  = useRef(null)
  const [alertPlaying, setAlertPlaying] = useState(false)
  const [loopPlaying,  setLoopPlaying]  = useState(false)

  // Cleanup on unmount or when sounds change
  useEffect(() => () => {
    alertHandleRef.current?.stop(); loopHandleRef.current?.stop()
  }, [])

  if (!sounds) return null

  const regenAlert = () => {
    alertHandleRef.current?.stop(); alertHandleRef.current = null; setAlertPlaying(false)
    setSounds({ alert: randomAlertSound(sfxRng()) })
  }
  const regenMovement = (cat) => {
    loopHandleRef.current?.stop(); loopHandleRef.current = null; setLoopPlaying(false)
    setSounds({ movement: randomMovementSound(sfxRng(), cat || sounds.movement?.category) })
  }
  const setCategory = (cat) => {
    loopHandleRef.current?.stop(); loopHandleRef.current = null; setLoopPlaying(false)
    setSounds({ movement: randomMovementSound(sfxRng(), cat) })
  }

  const playAlert = () => {
    alertHandleRef.current?.stop(); alertHandleRef.current = null
    const handle = monsterSfx.playAlert(sounds.alert)
    alertHandleRef.current = handle
    setAlertPlaying(true)
    setTimeout(() => { alertHandleRef.current = null; setAlertPlaying(false) },
      ((sounds.alert?.dur || 1.5) * 1000) + 300)
  }
  const stopAlert = () => {
    alertHandleRef.current?.stop(); alertHandleRef.current = null; setAlertPlaying(false)
  }

  const toggleLoop = () => {
    if (loopPlaying) {
      loopHandleRef.current?.stop(); loopHandleRef.current = null; setLoopPlaying(false)
    } else {
      const handle = monsterSfx.startMovementLoop(sounds.movement)
      loopHandleRef.current = handle; setLoopPlaying(true)
    }
  }
  const alertMood    = sounds.alert?.mood || 'aggressive'
  const movCat       = sounds.movement?.category || 'organic_walk'
  const moodColor    = MOOD_COLORS[alertMood] || C.txtAccent
  const isContinuous = sounds.movement?.continuous !== false  // fly/slide = true, walk = false
  const movBpm    = sounds.movement?.bpm

  const setAlertMood = (mood) => {
    setSounds({ alert: { ...sounds.alert, mood } })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* ── ALERT ── */}
      <div>
        <SectionLabel>ALERT — ATTIVAZIONE</SectionLabel>
        <div style={{ background:'#120600', border:`1px solid ${C.borderMed}`, padding:12, display:'flex', flexDirection:'column', gap:10 }}>

          {/* Mood selector */}
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ color:C.txtSub, fontSize:9, letterSpacing:2 }}>CARATTERE — salvato nel JSON</span>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {Object.entries(MOOD_COLORS).map(([mood, col]) => {
                const active = alertMood === mood
                return (
                  <button key={mood} onClick={() => setAlertMood(mood)}
                    style={{ background: active ? col+'33' : 'transparent',
                      border: `1px solid ${active ? col : C.border}`,
                      color: active ? col : C.txtGhost,
                      fontFamily:'monospace', fontSize:9, letterSpacing:1,
                      padding:'3px 8px', cursor:'pointer', transition:'all 0.12s',
                      fontWeight: active ? 'bold' : 'normal' }}
                    onMouseEnter={e=>{ if(!active) Object.assign(e.currentTarget.style,{borderColor:col,color:col}) }}
                    onMouseLeave={e=>{ if(!active) Object.assign(e.currentTarget.style,{borderColor:C.border,color:C.txtGhost}) }}>
                    {mood.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Params row */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:C.txtDim, fontSize:9 }}>
              {((sounds.alert?.intensity||0)*100).toFixed(0)}% INT
            </span>
            <span style={{ color:C.txtGhost, fontSize:9 }}>{(sounds.alert?.dur||0).toFixed(1)}s</span>
            {sounds.alert?.crush > 0.02 && <span style={{ color:'#aa6622', fontSize:9, border:'1px solid #442200', padding:'1px 5px' }}>CRUSH</span>}
            {sounds.alert?.room  > 0.05 && <span style={{ color:'#4466aa', fontSize:9, border:'1px solid #223355', padding:'1px 5px' }}>ROOM</span>}
          </div>

          {/* Layers */}
          <div style={{ display:'flex', flexDirection:'column', gap:2, paddingLeft:4,
            borderLeft:`2px solid ${C.border}` }}>
            {(sounds.alert?.layers||[]).map((l, i) => (
              <div key={i} style={{ fontSize:9, color:C.txtGhost, fontFamily:'monospace' }}>
                {i+1}. {layerDesc(l)}
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display:'flex', gap:7 }}>
            {alertPlaying
              ? <SfxBtn onClick={stopAlert} stop>■ STOP</SfxBtn>
              : <SfxBtn onClick={playAlert}>► ASCOLTA</SfxBtn>}
            <SfxBtn onClick={regenAlert} accent>↺ RIGENERA</SfxBtn>
          </div>
        </div>
      </div>

      {/* ── MOVIMENTO ── */}
      <div>
        <SectionLabel>MOVIMENTO</SectionLabel>
        <div style={{ background:'#120600', border:`1px solid ${C.borderMed}`, padding:12, display:'flex', flexDirection:'column', gap:10 }}>

          {/* Category */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <span style={{ color:C.txtSub, fontSize:9, letterSpacing:2 }}>TIPO — salvato nel JSON</span>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {MOVEMENT_CATEGORIES.map(({ value, label, icon }) => {
                const active = movCat === value
                return (
                  <button key={value} onClick={() => setCategory(value)}
                    style={{ background: active ? C.redGhost : 'transparent',
                      border: `1px solid ${active ? C.red : C.border}`,
                      color: active ? C.txtAccent : C.txtDim,
                      fontFamily:'monospace', fontSize:9, letterSpacing:1,
                      padding:'4px 9px', cursor:'pointer', transition:'all 0.12s',
                      fontWeight: active ? 'bold' : 'normal' }}
                    onMouseEnter={e=>{ if(!active) Object.assign(e.currentTarget.style,{borderColor:C.borderMed,color:C.txtSub}) }}
                    onMouseLeave={e=>{ if(!active) Object.assign(e.currentTarget.style,{borderColor:C.border,color:C.txtDim}) }}>
                    {icon} {label.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mode badge + BPM + rhythm info */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {isContinuous
              ? <span style={{ fontSize:9, letterSpacing:2, padding:'2px 8px',
                  background:'#002244', border:'1px solid #224488', color:'#4488cc' }}>
                  ∞ TONO CONTINUO
                </span>
              : <>
                  <span style={{ fontSize:9, letterSpacing:2, padding:'2px 8px',
                    background:'#1a0800', border:`1px solid ${C.redDim}`, color:C.txtMain }}>
                    ♩ LOOP RITMICO
                  </span>
                  {movBpm && (
                    <span style={{ fontSize:9, letterSpacing:1, padding:'2px 8px',
                      background:'#100500', border:`1px solid ${C.border}`, color:C.txtAccent, fontFamily:'monospace' }}>
                      {movBpm|0} BPM
                    </span>
                  )}
                  {sounds.movement?.rhythm?.pattern && (
                    <span style={{ color:C.txtGhost, fontSize:10, fontFamily:'monospace' }}>
                      [{(sounds.movement.rhythm.pattern).map(v=>v===0?'·':v===1?'█':'▄').join('')}]
                    </span>
                  )}
                </>
            }
          </div>

          {/* Layers */}
          <div style={{ display:'flex', flexDirection:'column', gap:2, paddingLeft:4,
            borderLeft:`2px solid ${C.border}` }}>
            {(sounds.movement?.layers||[]).map((l, i) => (
              <div key={i} style={{ fontSize:9, color:C.txtGhost, fontFamily:'monospace' }}>
                {i+1}. {layerDesc(l)}
              </div>
            ))}
          </div>

          {/* Buttons — tutti i movimenti sono loop */}
          <div style={{ display:'flex', gap:7 }}>
            <SfxBtn onClick={toggleLoop} stop={loopPlaying}>
              {loopPlaying ? '■ STOP LOOP' : '► ASCOLTA LOOP'}
            </SfxBtn>
            <SfxBtn onClick={() => regenMovement()} accent>↺ RIGENERA</SfxBtn>
          </div>
        </div>
      </div>

    </div>
  )
}

function SfxBtn({ onClick, children, accent, stop: isStop }) {
  const bg  = isStop ? '#220000' : accent ? C.redGhost : 'transparent'
  const bdr = isStop ? C.red     : accent ? C.redDim   : C.borderMed
  const col = isStop ? '#ff4444' : accent ? C.txtAccent : C.txtSub
  return (
    <button onClick={onClick}
      style={{ background:bg, border:`1px solid ${bdr}`, color:col,
        fontFamily:'monospace', fontSize:10, letterSpacing:2,
        padding:'5px 12px', cursor:'pointer', transition:'all 0.12s', flex:1 }}
      onMouseEnter={e=>Object.assign(e.currentTarget.style,{borderColor:C.red,color:C.txtAccent,background:C.redGhost})}
      onMouseLeave={e=>Object.assign(e.currentTarget.style,{borderColor:bdr,color:col,background:bg})}>
      {children}
    </button>
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
