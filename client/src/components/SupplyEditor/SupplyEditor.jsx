import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import PageHeader from '../PageHeader.jsx'
import SupplyViewer from './SupplyViewer.jsx'
import { monsterSfx, randomMovementSound, MOVEMENT_CATEGORIES } from '../../utils/monsterSfx.js'
import TEMPLATES from '../../data/supplyTemplates.js'

// ── Inject spinner + scrollbar styles once ────────────────────────────────────
const STYLE_ID = 'supply-editor-styles'
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    .se-num::-webkit-inner-spin-button,
    .se-num::-webkit-outer-spin-button { opacity: 1; width: 22px; height: 100%; cursor: pointer; }
    .se-num { -moz-appearance: number-input; }
    .se-scroll::-webkit-scrollbar { width: 5px; }
    .se-scroll::-webkit-scrollbar-track { background: #0a0705; }
    .se-scroll::-webkit-scrollbar-thumb { background: #2a1000; border-radius: 2px; }
    .se-scroll::-webkit-scrollbar-thumb:hover { background: #551800; }
    .se-btn-icon:hover { color: #ff4400 !important; }
    .se-part-row:hover { border-color: #441800 !important; }
    .se-card:hover .se-card-delete { opacity: 1 !important; }
    .se-card:hover .se-card-actions { opacity: 1 !important; }
  `
  document.head.appendChild(s)
}

// ── Color tokens (identici al MonsterEditor) ─────────────────────────────────
const C = {
  bg:'#060402', bgPanel:'#0a0705', bgInput:'#120800', bgInputHov:'#1a0c00',
  bgCard:'#0d0603', bgCardSel:'#1c0800', bgTabAct:'#180900', bgBtn:'#1a0500',
  border:'#261200', borderMed:'#3a1800', borderAct:'#cc2200',
  txtBright:'#ffcc88', txtMain:'#cc7744', txtSub:'#996644',
  txtDim:'#664433', txtGhost:'#3a2010', txtAccent:'#ff6633',
  red:'#cc2200', redDim:'#881500', redGhost:'#441100',
}

// ── Default geometry per nuova fornitura ──────────────────────────────────────
const DEFAULT_GEOMETRY = {
  v: 1,
  parts: [
    { id:'base', label:'Base', shape:'box', w:0.6, h:0.6, d:0.6, r:0, x:0, y:0.3, z:0, rx:0, ry:0, rz:0, color:'#6b4a28' },
  ],
}

// ── Sfx rng ───────────────────────────────────────────────────────────────────
function sfxRng() {
  let s = (Math.random() * 0xFFFFFFFF) | 0
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 0xFFFFFFFF }
}
// Proximity sound usa lo stesso schema di "movement" (loop/continuous)
const defaultProximity = () => randomMovementSound(sfxRng(), 'fly')

const DEFAULT_STATE = () => ({
  id: null, name: 'Nuova Fornitura',
  geometry: { v:1, parts: DEFAULT_GEOMETRY.parts.map(p => ({...p})) },
  lore: '',
  sounds: { proximity: defaultProximity() },
})

const uid = () => Math.random().toString(36).slice(2,8)
const newPart = () => ({ id:uid(), label:'Parte', shape:'box', w:0.5, h:0.5, d:0.5, r:0.25, x:0, y:0.25, z:0, rx:0, ry:0, rz:0, color:'#6b4a28' })
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
function mirrorChange(ch) {
  const m = { ...ch }
  if ('x'  in ch) m.x  = -ch.x
  if ('ry' in ch) m.ry = -ch.ry
  if ('rz' in ch) m.rz = -ch.rz
  return m
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SupplyEditor() {
  const { token } = useAuth()
  const [supplies, setSupplies] = useState([])
  const [editing, setEditing]   = useState(null)
  const [thumbnail, setThumbnail] = useState(null)
  const [tab, setTab] = useState('geometry')
  const [expandedPart, setExpandedPart] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedPart, setSelectedPart] = useState(null)
  const [transformMode, setTransformMode]   = useState('translate')
  const [transformSpace, setTransformSpace] = useState('world')
  const [studioMode, setStudioMode]   = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showAIPicker, setShowAIPicker] = useState(false)

  // Undo / Redo
  const undoStack = useRef([])
  const redoStack = useRef([])
  const curRef    = useRef(null)
  const [histLen, setHistLen] = useState({ u:0, r:0 })

  // Dirty tracking
  const savedRef = useRef(null)

  // Symmetry
  const symMapRef    = useRef({})
  const symActiveRef = useRef(new Set())
  const [symActive, _setSymActive] = useState(new Set())
  const setSymActive = (val) => {
    const next = typeof val === 'function' ? val(symActiveRef.current) : val
    symActiveRef.current = next
    _setSymActive(next)
  }

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
    if (curRef.current) redoStack.current = [curRef.current, ...redoStack.current.slice(0, 49)]
    const prev = undoStack.current[undoStack.current.length - 1]
    undoStack.current = undoStack.current.slice(0, -1)
    curRef.current = prev
    setEditing(prev)
    setHistLen({ u: undoStack.current.length, r: redoStack.current.length })
    _rebuildSym(prev)
  }, [])

  const redo = useCallback(() => {
    if (!redoStack.current.length) return
    if (curRef.current) undoStack.current = [...undoStack.current.slice(-49), curRef.current]
    const next = redoStack.current[0]
    redoStack.current = redoStack.current.slice(1)
    curRef.current = next
    setEditing(next)
    setHistLen({ u: undoStack.current.length, r: redoStack.current.length })
    _rebuildSym(next)
  }, [])

  useEffect(() => {
    const handler = e => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPart) { e.preventDefault(); delPart(selectedPart) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, selectedPart])

  const loadSupplies = useCallback(async () => {
    try {
      const r = await fetch('/api/supplies', { headers: { Authorization:`Bearer ${token}` } })
      if (r.ok) setSupplies(await r.json())
    } catch {}
  }, [token])

  useEffect(() => { loadSupplies() }, [loadSupplies])

  const _initSym = (parts) => {
    const map = buildSymMap(parts)
    symMapRef.current = map
    setSymActive(new Set(Object.keys(map)))
  }

  const selectSupply = (m) => {
    undoStack.current = []; redoStack.current = []; setHistLen({ u:0, r:0 })
    const s = {
      id: m.id, name: m.name,
      geometry: m.geometry || { v:1, parts:[] },
      lore: m.lore || '',
      sounds: m.sounds || { proximity: defaultProximity() },
    }
    curRef.current = s; savedRef.current = s; setEditing(s)
    _initSym(s.geometry?.parts || [])
    setThumbnail(m.thumbnail||null); setTab('geometry'); setExpandedPart(null); setSelectedPart(null)
  }

  const newSupply = () => setShowTemplatePicker(true)

  const startFromTemplate = (tpl) => {
    setShowTemplatePicker(false)
    undoStack.current = []; redoStack.current = []; setHistLen({ u:0, r:0 })
    const s = tpl
      ? {
          id: null, name: tpl.name,
          geometry: { v:1, parts: tpl.geometry.parts.map(p => ({...p, id: uid()})) },
          lore: tpl.description || '',
          sounds: { proximity: defaultProximity() },
        }
      : DEFAULT_STATE()
    curRef.current = s; savedRef.current = null; setEditing(s)
    _initSym(s.geometry.parts)
    setThumbnail(null); setTab('geometry'); setExpandedPart(null); setSelectedPart(null)
  }

  const handlePartSelect    = useCallback((partId)          => { setSelectedPart(partId); setExpandedPart(partId) }, [])
  const handlePartTransform = useCallback((partId, updates) => { setPart(partId, updates) }, [])

  const saveSupply = async () => {
    if (!editing || saving) return
    setSaving(true)
    const snapEditing = curRef.current
    const snapThumb   = thumbnail
    try {
      const url = editing.id ? `/api/supplies/${editing.id}` : '/api/supplies'
      const r = await fetch(url, {
        method: editing.id ? 'PUT' : 'POST',
        headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({
          name: editing.name, geometry: editing.geometry,
          thumbnail, lore: editing.lore, sounds: editing.sounds,
        }),
      })
      if (r.ok) {
        const data = await r.json()
        if (!editing.id && data.id) {
          const updated = { ...snapEditing, id: data.id }
          savedRef.current = updated; curRef.current = updated; setEditing(updated)
        } else {
          savedRef.current = snapEditing
        }
        _initSym(snapEditing.geometry?.parts || [])
        await loadSupplies()
      }
    } finally { setSaving(false) }
  }

  const duplicateSupply = () => { if (editing) duplicateFrom(editing) }

  const duplicateFrom = (m) => {
    undoStack.current = []; redoStack.current = []; setHistLen({ u:0, r:0 })
    const s = {
      id: null,
      name: m.name + ' (copia)',
      geometry: { v:1, parts: (m.geometry?.parts || []).map(p => ({ ...p, id: uid() })) },
      lore: m.lore || '',
      sounds: m.sounds ? JSON.parse(JSON.stringify(m.sounds)) : { proximity: defaultProximity() },
    }
    curRef.current = s; savedRef.current = null; setEditing(s)
    _initSym(s.geometry?.parts || [])
    setThumbnail(null); setTab('geometry'); setExpandedPart(null); setSelectedPart(null)
  }

  const deleteSupply = async (id) => {
    if (!confirm('Eliminare questa fornitura?')) return
    await fetch(`/api/supplies/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } })
    if (editing?.id === id) setEditing(null)
    await loadSupplies()
  }

  const set = (k, v) => { _pushUndo(); _commit({...curRef.current, [k]:v}) }
  const setSounds = (ch) => { _pushUndo(); _commit({...curRef.current, sounds:{...curRef.current.sounds, ...ch}}) }

  // Apply a part change (and optionally its mirror) to an arbitrary base state
  const _applyPartChange = (base, id, ch, mirrorId) => {
    const parts = base.geometry.parts.map(p =>
      p.id === id       ? { ...p, ...ch } :
      p.id === mirrorId ? { ...p, ...mirrorChange(ch) } : p)
    return { ...base, geometry: { ...base.geometry, parts } }
  }

  const setPart = (id, ch) => {
    _pushUndo()
    const mid = symMapRef.current[id]
    const useSym = mid && symActiveRef.current.has(id)
    const next = _applyPartChange(curRef.current, id, ch, useSym ? mid : null)
    _commit(next)
    if (mid && !useSym) {
      const m = { ...symMapRef.current }; delete m[id]; delete m[mid]; symMapRef.current = m
      setSymActive(prev => { const s = new Set(prev); s.delete(id); s.delete(mid); return s })
    }
  }

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

  const isDirty = !editing ? false
    : editing.id === null ? true
    : JSON.stringify(editing) !== JSON.stringify(savedRef.current)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'Courier New, monospace',
      backgroundImage:'url(/bg-monsters.png)', backgroundSize:'cover', backgroundPosition:'center', position:'relative' }}>

      <PageHeader title="Editor Forniture" />

      {/* ── 3-column layout ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ── LEFT: supply list ── */}
        <div style={{ width:240, background:'rgba(6,4,2,0.88)', borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'10px', borderBottom:`1px solid ${C.border}` }}>
            <button onClick={newSupply}
              style={{ width:'100%', background:C.bgBtn, border:`1px solid ${C.redDim}`, color:C.txtAccent,
                fontFamily:'monospace', fontSize:11, letterSpacing:3, padding:'9px', cursor:'pointer',
                transition:'all 0.15s' }}
              onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#2a0800',borderColor:C.red,color:'#ff8844'})}
              onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:C.bgBtn,borderColor:C.redDim,color:C.txtAccent})}>
              + NUOVA FORNITURA
            </button>
          </div>
          <div className="se-scroll" style={{ flex:1, overflowY:'auto', padding:'8px' }}>
            {supplies.length === 0 &&
              <div style={{ color:C.txtGhost, fontSize:10, textAlign:'center', marginTop:40, letterSpacing:2, lineHeight:2 }}>
                NESSUNA FORNITURA<br/>CREANE UNA
              </div>}
            {supplies.map(m =>
              <SupplyCard key={m.id} supply={m} selected={editing?.id===m.id}
                onClick={()=>selectSupply(m)} onDelete={()=>deleteSupply(m.id)}
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
              SELEZIONA UNA FORNITURA<br/>O CREANE UNA NUOVA
            </div>
          ) : (
            <>
              <SupplyViewer
                geometry={editing.geometry} onThumbnailCapture={setThumbnail}
                selectedPartId={selectedPart}
                onPartSelect={tab === 'geometry' ? handlePartSelect : null}
                onPartTransform={handlePartTransform}
                transformMode={transformMode} transformSpace={transformSpace}
                studioMode={studioMode}
              />
              {/* ── Toggle studio light ── */}
              <button
                onClick={() => setStudioMode(v => !v)}
                title={studioMode ? 'Torna alla luce infernale' : 'Luce bianca per vedere i colori reali'}
                style={{
                  position:'absolute', bottom:10, right:10,
                  background: studioMode ? 'rgba(40,40,40,0.88)' : 'rgba(6,4,2,0.72)',
                  border: `1px solid ${studioMode ? '#888888' : C.border}`,
                  color: studioMode ? '#dddddd' : C.txtGhost,
                  fontFamily:'monospace', fontSize:9, letterSpacing:2,
                  padding:'4px 10px', cursor:'pointer', transition:'all 0.15s',
                }}>
                {studioMode ? '◉ STUDIO' : '◎ STUDIO'}
              </button>
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
                    <button onClick={saveSupply} disabled={saving}
                      style={{ flex:1, background:saving?'#661100':'#aa1c00', border:'none', color:'#fff',
                        fontFamily:'monospace', fontSize:11, letterSpacing:2, padding:'7px 0',
                        cursor:saving?'default':'pointer', transition:'background 0.15s' }}>
                      {saving ? '...' : (editing.id ? '↑ AGGIORNA' : '✓ SALVA')}
                    </button>
                  )}
                  <IconBtn onClick={duplicateSupply} title="Duplica fornitura"
                    icon="⧉" label="COPIA"
                    base={{ bg:'transparent', border:C.borderMed, color:C.txtSub }}
                    hover={{ bg:'#0d1a0d', border:'#336633', color:'#88cc88' }} />
                  {editing.id && (
                    <IconBtn onClick={()=>deleteSupply(editing.id)} title="Elimina dal database"
                      icon="⊗" label="ELIMINA"
                      base={{ bg:C.redGhost, border:C.redDim, color:'#cc4422' }}
                      hover={{ bg:'#3a0000', border:C.red, color:'#ff5533' }} />
                  )}
                  <IconBtn onClick={()=>setEditing(null)} title="Chiudi"
                    icon="←" label="CHIUDI"
                    base={{ bg:'transparent', border:'#2a2a2a', color:'#555' }}
                    hover={{ bg:'#1a1a1a', border:'#666', color:'#aaa' }} />
                </div>
                {/* ── Undo / Redo ── */}
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
                {[['geometry','⬡','GEO'],['sfx','♪','SFX'],['json','{}','JSON']].map(([t,icon,l]) => {
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
              <div className="se-scroll" style={{ flex:1, overflowY:'auto', padding:'14px 12px' }}>
                {tab==='geometry' && <GeometryTab parts={editing.geometry?.parts||[]}
                  expandedPart={expandedPart} setExpandedPart={setExpandedPart}
                  selectedPart={selectedPart} setSelectedPart={setSelectedPart}
                  symMap={symMapRef.current} symActive={symActive} onSymToggle={toggleSym}
                  onAdd={addPart} onAddPair={addSymPair} onDelete={delPart} onCopy={copyPart} onUpdate={setPart} onLiveUpdate={setPartLive} />}
                {tab==='sfx'      && <SfxTab sounds={editing.sounds} setSounds={setSounds} />}
                {tab==='json'     && <JSONTab editing={editing} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Template Picker Modal ── */}
      {showTemplatePicker && !showAIPicker && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(2,1,0,0.93)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          zIndex:100, padding:'24px',
        }}>
          <div style={{ color:C.red, fontSize:11, letterSpacing:5, marginBottom:20, fontFamily:'monospace' }}>
            SCEGLI TEMPLATE DI PARTENZA
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center', maxWidth:860, marginBottom:24 }}>
            {/* Card AI — prima di tutto */}
            <div onClick={() => setShowAIPicker(true)}
              style={{ width:160, background:'#001a2e', border:`2px solid #2266aa`,
                padding:'12px 10px', cursor:'pointer', transition:'all 0.15s', textAlign:'center',
                boxShadow:'0 0 18px #1144aa44' }}
              onMouseEnter={e=>Object.assign(e.currentTarget.style,{borderColor:'#44aaff',background:'#002244',boxShadow:'0 0 24px #2266aaaa'})}
              onMouseLeave={e=>Object.assign(e.currentTarget.style,{borderColor:'#2266aa',background:'#001a2e',boxShadow:'0 0 18px #1144aa44'})}>
              <div style={{ color:'#66aaff', fontSize:22, marginBottom:6 }}>✦</div>
              <div style={{ color:'#88ccff', fontSize:10, letterSpacing:2, marginBottom:6, fontFamily:'monospace' }}>GENERA CON AI</div>
              <div style={{ color:'#4488aa', fontSize:9, letterSpacing:1, lineHeight:1.5 }}>Descrivi l'oggetto, Gemini crea la geometria</div>
            </div>
            <TemplateCard name="VUOTO" description="Schema base minimalista" onClick={() => startFromTemplate(null)} />
            {TEMPLATES.map(t => (
              <TemplateCard key={t.id} name={t.name.toUpperCase()} description={t.description}
                onClick={() => startFromTemplate(t)} />
            ))}
          </div>
          <button onClick={() => setShowTemplatePicker(false)}
            style={{ background:'transparent', border:`1px solid ${C.borderMed}`, color:C.txtDim,
              fontFamily:'monospace', fontSize:10, letterSpacing:3, padding:'7px 28px', cursor:'pointer' }}
            onMouseEnter={e=>Object.assign(e.currentTarget.style,{borderColor:C.red,color:C.txtAccent})}
            onMouseLeave={e=>Object.assign(e.currentTarget.style,{borderColor:C.borderMed,color:C.txtDim})}>
            ANNULLA
          </button>
        </div>
      )}

      {/* ── AI Generator Modal ── */}
      {showTemplatePicker && showAIPicker && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(2,1,0,0.95)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          zIndex:100, padding:'32px',
        }}>
          <AIGeneratorModal
            token={token}
            onApply={(name, geometry) => {
              setShowTemplatePicker(false); setShowAIPicker(false)
              undoStack.current = []; redoStack.current = []; setHistLen({ u:0, r:0 })
              const s = {
                id: null, name,
                geometry,
                lore: '',
                sounds: { proximity: defaultProximity() },
              }
              curRef.current = s; savedRef.current = null; setEditing(s)
              _rebuildSym(s)
              setThumbnail(null); setTab('geometry'); setExpandedPart(null); setSelectedPart(null)
            }}
            onBack={() => setShowAIPicker(false)}
            onCancel={() => { setShowTemplatePicker(false); setShowAIPicker(false) }}
          />
        </div>
      )}
    </div>
  )
}

// ── Shared micro-components ───────────────────────────────────────────────────
function TemplateCard({ name, description, onClick }) {
  return (
    <div onClick={onClick}
      style={{ width:160, background:C.bgCard, border:`1px solid ${C.border}`, padding:'12px 10px',
        cursor:'pointer', transition:'all 0.15s', textAlign:'center' }}
      onMouseEnter={e=>Object.assign(e.currentTarget.style,{borderColor:C.red,background:C.bgCardSel})}
      onMouseLeave={e=>Object.assign(e.currentTarget.style,{borderColor:C.border,background:C.bgCard})}>
      <div style={{ color:C.txtAccent, fontSize:10, letterSpacing:2, marginBottom:6, fontFamily:'monospace' }}>{name}</div>
      <div style={{ color:C.txtSub, fontSize:9, letterSpacing:1, lineHeight:1.5 }}>{description}</div>
    </div>
  )
}

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

// ── Supply card ───────────────────────────────────────────────────────────────
function SupplyCard({ supply, selected, onClick, onDelete, onDuplicate }) {
  return (
    <div className="se-card" onClick={onClick}
      style={{ border:`1px solid ${selected?C.red:C.border}`, background:selected?C.bgCardSel:C.bgCard,
        padding:'7px 8px', marginBottom:5, cursor:'pointer', display:'flex', gap:8,
        alignItems:'center', position:'relative', transition:'all 0.12s' }}
      onMouseEnter={e=>{ if(!selected) e.currentTarget.style.borderColor=C.borderMed }}
      onMouseLeave={e=>{ if(!selected) e.currentTarget.style.borderColor=C.border }}>
      <div style={{ width:56, height:42, background:'#0c0805', border:`1px solid ${C.border}`,
        flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {supply.thumbnail
          ? <img src={supply.thumbnail} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : <span style={{ color:C.txtGhost, fontSize:20 }}>□</span>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:selected?'#ff6633':C.txtMain, fontSize:11, overflow:'hidden',
          textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:1, fontWeight:'bold' }}>
          {supply.name}
        </div>
        <div style={{ color:C.txtDim, fontSize:9, marginTop:3, letterSpacing:1 }}>
          {supply.geometry?.parts?.length ?? 0} PARTI
        </div>
      </div>
      <div className="se-card-actions"
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
            setExpandedPart(next); setSelectedPart(part.id)
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
    <div className="se-part-row"
      style={{ marginBottom:3, border:`1px solid ${borderColor}`,
        background: bg, transition:'border-color 0.12s',
        boxShadow: selected ? `0 0 6px ${C.red}44` : 'none' }}>
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
        <button className="se-btn-icon"
          title={hasMirror ? 'Copia parte (click) / copia coppia (shift+click)' : 'Copia parte'}
          onClick={e=>{e.stopPropagation(); onCopy(hasMirror && e.shiftKey)}}
          style={{ background:'transparent', border:'none', color:C.txtGhost,
            cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px',
            flexShrink:0, transition:'color 0.15s' }}>⧉</button>
        <button className="se-btn-icon" onClick={e=>{e.stopPropagation();onDelete()}}
          style={{ background:'transparent', border:'none', color:C.txtGhost,
            cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px',
            flexShrink:0, transition:'color 0.15s' }}>×</button>
      </div>
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
      <input type="number" step={step} className="se-num"
        value={+(part[k]??0).toFixed(3)}
        onChange={e => onChange({ [k]: parseFloat(e.target.value) || 0 })}
        style={{ width:'100%', background:C.bgInput, border:`1px solid ${C.borderMed}`,
          color:C.txtBright, fontFamily:'monospace', fontSize:13,
          padding:'5px 6px', outline:'none', textAlign:'right',
          boxSizing:'border-box', height:34 }} />
    </label>
  )
  const Row = ({ children }) => (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${children.length||1}, 1fr)`, gap:7 }}>
      {children}
    </div>
  )
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
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
            <input type="color" value={part.color||'#6b4a28'}
              onInput={e => onLive?.({color:e.target.value})}
              onBlur={e => onChange({color:e.target.value})}
              style={{ width:44, height:34, border:`1px solid ${C.borderMed}`,
                padding:2, cursor:'pointer', background:C.bgInput, flexShrink:0 }} />
            {allColors.map(c => (
              <div key={c} title={c}
                onClick={() => onChange({color:c})}
                style={{ width:18, height:18, background:c, cursor:'pointer', flexShrink:0,
                  border: `2px solid ${c === part.color ? '#fff' : '#33000066'}`,
                  borderRadius:2, transition:'transform 0.1s' }}
                onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.25)' }}
                onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)' }} />
            ))}
          </div>
        </div>
      </div>
      <div>
        <SectionLabel>DIMENSIONI</SectionLabel>
        {part.shape==='box'      && <Row><Num label="W" k="w"/><Num label="H" k="h"/><Num label="D" k="d"/></Row>}
        {part.shape==='sphere'   && <Row><Num label="RAGGIO" k="r"/></Row>}
        {(part.shape==='cylinder'||part.shape==='cone') && <Row><Num label="R" k="r"/><Num label="H" k="h"/></Row>}
      </div>
      <div><SectionLabel>POSIZIONE</SectionLabel><Row><Num label="X" k="x"/><Num label="Y" k="y"/><Num label="Z" k="z"/></Row></div>
      <div><SectionLabel>ROTAZIONE °</SectionLabel><Row><Num label="RX" k="rx" step={1}/><Num label="RY" k="ry" step={1}/><Num label="RZ" k="rz" step={1}/></Row></div>
    </div>
  )
}

// ── JSON tab ──────────────────────────────────────────────────────────────────
function JSONTab({ editing }) {
  const json = {
    v:1,
    meta:{ name:editing.name, generated_by:'manual' },
    geometry: editing.geometry,
    sounds:   editing.sounds,
    lore:     editing.lore,
  }
  return (
    <pre style={{ color:'#997755', fontSize:10, fontFamily:'monospace', whiteSpace:'pre-wrap',
      wordBreak:'break-all', margin:0, lineHeight:1.8 }}>
      {JSON.stringify(json, null, 2)}
    </pre>
  )
}

// ── SFX tab (un solo suono: proximity) ────────────────────────────────────────
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

function SfxTab({ sounds, setSounds }) {
  const loopHandleRef = useRef(null)
  const [loopPlaying, setLoopPlaying] = useState(false)

  useEffect(() => () => { loopHandleRef.current?.stop() }, [])

  if (!sounds?.proximity) return (
    <div style={{ color:C.txtDim, fontSize:10, letterSpacing:2, textAlign:'center', padding:30 }}>
      Nessun suono definito
    </div>
  )

  const prox = sounds.proximity
  const category = prox.category || 'fly'
  const isContinuous = prox.continuous !== false
  const bpm = prox.bpm

  const regen = () => {
    loopHandleRef.current?.stop(); loopHandleRef.current = null; setLoopPlaying(false)
    setSounds({ proximity: randomMovementSound(sfxRng(), category) })
  }
  const setCategory = (cat) => {
    loopHandleRef.current?.stop(); loopHandleRef.current = null; setLoopPlaying(false)
    setSounds({ proximity: randomMovementSound(sfxRng(), cat) })
  }
  const toggleLoop = () => {
    if (loopPlaying) {
      loopHandleRef.current?.stop(); loopHandleRef.current = null; setLoopPlaying(false)
    } else {
      const handle = monsterSfx.startMovementLoop(prox)
      loopHandleRef.current = handle; setLoopPlaying(true)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <SectionLabel>SUONO DI PROSSIMITÀ</SectionLabel>
        <div style={{ background:'#120600', border:`1px solid ${C.borderMed}`, padding:12, display:'flex', flexDirection:'column', gap:10 }}>

          {/* Category */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <span style={{ color:C.txtSub, fontSize:9, letterSpacing:2 }}>TIPO — salvato nel JSON</span>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {MOVEMENT_CATEGORIES.map(({ value, label, icon }) => {
                const active = category === value
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

          {/* Mode badge + BPM */}
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
                  {bpm && (
                    <span style={{ fontSize:9, letterSpacing:1, padding:'2px 8px',
                      background:'#100500', border:`1px solid ${C.border}`, color:C.txtAccent, fontFamily:'monospace' }}>
                      {bpm|0} BPM
                    </span>
                  )}
                </>}
          </div>

          {/* Layers */}
          <div style={{ display:'flex', flexDirection:'column', gap:2, paddingLeft:4,
            borderLeft:`2px solid ${C.border}` }}>
            {(prox.layers||[]).map((l, i) => (
              <div key={i} style={{ fontSize:9, color:C.txtGhost, fontFamily:'monospace' }}>
                {i+1}. {layerDesc(l)}
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display:'flex', gap:7 }}>
            <SfxBtn onClick={toggleLoop} stop={loopPlaying}>
              {loopPlaying ? '■ STOP' : '► ASCOLTA'}
            </SfxBtn>
            <SfxBtn onClick={regen} accent>↺ RIGENERA</SfxBtn>
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

// ── AI tab ────────────────────────────────────────────────────────────────────
function ChainStep({ step }) {
  const [open, setOpen] = useState(null) // null | 'system' | 'user' | 'response'
  const toggle = (k) => setOpen(v => v === k ? null : k)
  const blockStyle = (active) => ({
    background: active ? '#0a1200' : '#080500',
    border: `1px solid ${active ? '#336622' : C.border}`,
    padding:'8px 10px', color: active ? '#99cc66' : C.txtGhost,
    fontSize:9, fontFamily:'monospace', whiteSpace:'pre-wrap',
    lineHeight:1.6, maxHeight:220, overflowY:'auto', marginTop:4,
  })
  const btnStyle = (k) => ({
    background: open === k ? '#0d1a00' : 'transparent',
    border: `1px solid ${open === k ? '#335511' : C.border}`,
    color: open === k ? '#88bb44' : C.txtGhost,
    fontFamily:'monospace', fontSize:9, letterSpacing:1,
    padding:'3px 9px', cursor:'pointer', transition:'all 0.1s',
  })
  const colorStep = step.step === 1 ? '#aa8833' : '#3388aa'
  return (
    <div style={{ border:`1px solid ${C.border}`, background:'#080502', marginBottom:8 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
        borderBottom:`1px solid ${C.border}`, background:'#0c0804' }}>
        <span style={{ background:colorStep, color:'#000', fontFamily:'monospace',
          fontSize:9, fontWeight:'bold', padding:'1px 7px', letterSpacing:1, flexShrink:0 }}>
          STEP {step.step}
        </span>
        <span style={{ color:C.txtMain, fontSize:10, letterSpacing:2, flex:1 }}>
          {step.label.toUpperCase()}
        </span>
      </div>
      {/* Toggle buttons */}
      <div style={{ display:'flex', gap:4, padding:'7px 10px', flexWrap:'wrap' }}>
        {[['system','SYSTEM PROMPT'],['user','USER PROMPT'],['response','RISPOSTA']].map(([k, label]) => (
          <button key={k} onClick={() => toggle(k)} style={btnStyle(k)}
            onMouseEnter={e=>{ if(open!==k) Object.assign(e.currentTarget.style,{borderColor:C.borderMed,color:C.txtDim}) }}
            onMouseLeave={e=>{ if(open!==k) Object.assign(e.currentTarget.style,{borderColor:C.border,color:C.txtGhost}) }}>
            {open === k ? '▲' : '▼'} {label}
          </button>
        ))}
      </div>
      {/* Content blocks */}
      {open && (
        <div style={{ padding:'0 10px 10px' }}>
          <pre className="se-scroll" style={blockStyle(true)}>
            {step[open]}
          </pre>
        </div>
      )}
    </div>
  )
}

function AIGeneratorModal({ token, onApply, onBack, onCancel }) {
  const [desc,   setDesc]   = useState('')
  const [phase,  setPhase]  = useState('idle')
  const [chain,  setChain]  = useState([])
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const generate = async () => {
    if (!desc.trim() || phase === 'step1' || phase === 'step2') return
    setPhase('step1'); setChain([]); setResult(null); setErrMsg('')
    try {
      const res = await fetch('/api/ai/generate-supply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      })
      setPhase('step2')
      const data = await res.json()
      if (data.chain) setChain(data.chain)
      if (!res.ok) { setPhase('error'); setErrMsg(data.error || 'Errore sconosciuto'); return }
      setResult({ name: data.name, geometry: data.geometry })
      setPhase('done')
    } catch (err) {
      setPhase('error'); setErrMsg(err.message)
    }
  }

  const loading = phase === 'step1' || phase === 'step2'

  return (
    <div style={{ width:'100%', maxWidth:680, display:'flex', flexDirection:'column', gap:0 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <span style={{ color:'#66aaff', fontSize:22 }}>✦</span>
        <span style={{ color:'#88ccff', fontSize:13, letterSpacing:4, fontFamily:'monospace' }}>
          GENERA CON GEMINI AI
        </span>
      </div>

      {/* Description input */}
      <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:16 }}>
        <span style={{ color:C.txtSub, fontSize:10, letterSpacing:2, fontFamily:'monospace' }}>
          DESCRIVI LA FORNITURA
        </span>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          autoFocus
          placeholder="es. una sedia da trono con schienale ornato e braccioli in osso, un altare di pietra nera con incisioni runiche e candele, un barile di metallo ossidato con cerchi arrugginiti..."
          rows={5}
          style={{ background:'#0a0700', border:`1px solid #334422`,
            color:'#ccddaa', fontFamily:'monospace', fontSize:12,
            padding:'12px 14px', outline:'none', resize:'vertical',
            width:'100%', boxSizing:'border-box', lineHeight:1.7 }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
        />
        <span style={{ color:'#334433', fontSize:9, letterSpacing:1, fontFamily:'monospace' }}>
          Ctrl+Invio per generare
        </span>
      </div>

      {/* Generate button */}
      <button onClick={generate} disabled={!desc.trim() || loading}
        style={{ background: loading ? '#0a1400' : '#1a4a00',
          border:`1px solid ${loading ? '#224422' : '#44aa00'}`,
          color: loading ? '#446644' : '#aaff44',
          fontFamily:'monospace', fontSize:12, letterSpacing:4,
          padding:'13px 0', cursor: loading ? 'default' : 'pointer',
          transition:'all 0.15s', opacity: !desc.trim() ? 0.35 : 1,
          marginBottom:20 }}
        onMouseEnter={e=>{ if(!loading&&desc.trim()) Object.assign(e.currentTarget.style,{background:'#224400',borderColor:'#88ff00',color:'#ccff66'}) }}
        onMouseLeave={e=>{ if(!loading&&desc.trim()) Object.assign(e.currentTarget.style,{background:'#1a4a00',borderColor:'#44aa00',color:'#aaff44'}) }}>
        {loading ? '...' : '✦ GENERA GEOMETRIA'}
      </button>

      {/* Progress */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
          {[['step1','ESPANSIONE DESCRIZIONE — Gemini elabora il concept 3D'],
            ['step2','GENERAZIONE JSON — Gemini costruisce la geometria']].map(([s, label], i) => {
            const active = phase === s
            const done   = phase === 'step2' && i === 0
            return (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0, transition:'all 0.3s',
                  background: active ? '#88ff44' : done ? '#336633' : '#1a1a1a',
                  boxShadow: active ? '0 0 10px #88ff44' : 'none' }} />
                <span style={{ fontSize:10, letterSpacing:2, fontFamily:'monospace',
                  color: active ? '#aaff66' : done ? '#558844' : '#333' }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Chain */}
      {chain.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ color:'#446644', fontSize:9, letterSpacing:3, fontFamily:'monospace',
            borderBottom:'1px solid #1a2a1a', paddingBottom:6, marginBottom:10 }}>
            CHAIN DI CHIAMATE
          </div>
          {chain.map(step => <ChainStep key={step.step} step={step} />)}
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div style={{ background:'#1a0000', border:`1px solid ${C.redDim}`,
          padding:'12px 14px', color:'#ff5533', fontSize:10,
          fontFamily:'monospace', lineHeight:1.6, marginBottom:16 }}>
          ERRORE: {errMsg}
        </div>
      )}

      {/* Result */}
      {phase === 'done' && result && (
        <div style={{ background:'#071200', border:`1px solid #224422`,
          padding:'12px 14px', marginBottom:16,
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color:'#88ff66', fontSize:12, letterSpacing:2, fontFamily:'monospace', marginBottom:4 }}>
              {result.name}
            </div>
            <div style={{ color:'#446633', fontSize:9, letterSpacing:2, fontFamily:'monospace' }}>
              {result.geometry?.parts?.length ?? 0} PARTI GENERATE
            </div>
          </div>
          <button onClick={() => onApply(result.name, result.geometry)}
            style={{ background:'#002244', border:`1px solid #2266aa`,
              color:'#66aaff', fontFamily:'monospace', fontSize:11,
              letterSpacing:3, padding:'10px 22px', cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e=>Object.assign(e.currentTarget.style,{background:'#003366',borderColor:'#44aaff',color:'#aaddff'})}
            onMouseLeave={e=>Object.assign(e.currentTarget.style,{background:'#002244',borderColor:'#2266aa',color:'#66aaff'})}>
            ✓ CREA
          </button>
        </div>
      )}

      {/* Nav buttons */}
      <div style={{ display:'flex', gap:10, marginTop:4 }}>
        <button onClick={onBack}
          style={{ flex:1, background:'transparent', border:`1px solid ${C.borderMed}`, color:C.txtDim,
            fontFamily:'monospace', fontSize:10, letterSpacing:3, padding:'8px 0', cursor:'pointer' }}
          onMouseEnter={e=>Object.assign(e.currentTarget.style,{borderColor:C.txtSub,color:C.txtSub})}
          onMouseLeave={e=>Object.assign(e.currentTarget.style,{borderColor:C.borderMed,color:C.txtDim})}>
          ← TEMPLATE
        </button>
        <button onClick={onCancel}
          style={{ flex:1, background:'transparent', border:`1px solid ${C.border}`, color:'#333',
            fontFamily:'monospace', fontSize:10, letterSpacing:3, padding:'8px 0', cursor:'pointer' }}
          onMouseEnter={e=>Object.assign(e.currentTarget.style,{borderColor:C.red,color:C.txtAccent})}
          onMouseLeave={e=>Object.assign(e.currentTarget.style,{borderColor:C.border,color:'#333'})}>
          ANNULLA
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ color:C.txtDim, fontSize:10, letterSpacing:2, marginBottom:7,
    borderBottom:`1px solid ${C.border}`, paddingBottom:4 }}>{children}</div>
}
