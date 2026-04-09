import { useState, useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import PageHeader from '../PageHeader.jsx'

// ── Constants ────────────────────────────────────────────────────────────────

const GRID = 20
const CELL = { FLOOR: 0, WALL: 1, SPAWN: 2, EXIT: 3 }
const CELL_COLORS = { 0: '#1a1208', 1: '#5a3a1a', 2: '#1a4a1a', 3: '#1a1a4a' }
const CELL_LABELS = { 0: 'Pavimento', 1: 'Muro', 2: 'Spawn', 3: 'Uscita' }
const TOOLS = [
  { id: 1, label: 'Muro', color: '#8b5a2b' },
  { id: 0, label: 'Pavimento', color: '#2a1a08' },
  { id: 2, label: 'Spawn', color: '#22aa22' },
  { id: 3, label: 'Uscita', color: '#2222aa' },
]

function emptyGrid() {
  return Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c) =>
      (r === 0 || r === GRID - 1 || c === 0 || c === GRID - 1) ? CELL.WALL : CELL.FLOOR
    )
  )
}

// ── 3D Preview ───────────────────────────────────────────────────────────────

function LevelPreview({ grid }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0a)
    sceneRef.current = scene

    const w = mount.clientWidth || 400
    const h = mount.clientHeight || 300
    const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 100)
    camera.position.set(10, 20, 10)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const dir = new THREE.DirectionalLight(0xffaa44, 0.8)
    dir.position.set(5, 10, 5)
    scene.add(dir)

    let animId = requestAnimationFrame(function loop() {
      animId = requestAnimationFrame(loop)
      renderer.render(scene, camera)
    })

    return () => {
      cancelAnimationFrame(animId)
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  // Rebuild geometry when grid changes
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Remove old meshes
    scene.children
      .filter(o => o.userData.isLevel)
      .forEach(o => scene.remove(o))

    const offset = -GRID / 2 + 0.5

    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const x = c + offset
        const z = r + offset
        if (cell === CELL.WALL) {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.95, 1.5, 0.95),
            new THREE.MeshLambertMaterial({ color: 0x7a5230 })
          )
          mesh.position.set(x, 0.75, z)
          mesh.userData.isLevel = true
          scene.add(mesh)
        } else {
          const color = cell === CELL.SPAWN ? 0x226622 : cell === CELL.EXIT ? 0x224488 : 0x2a1a08
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.95, 0.95),
            new THREE.MeshLambertMaterial({ color })
          )
          mesh.rotation.x = -Math.PI / 2
          mesh.position.set(x, 0, z)
          mesh.userData.isLevel = true
          scene.add(mesh)
        }
      })
    })
  }, [grid])

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LevelEditor() {
  const [grid, setGrid] = useState(emptyGrid)
  const [tool, setTool] = useState(1)
  const [painting, setPainting] = useState(false)
  const [viewMode, setViewMode] = useState('2d')
  const [levelName, setLevelName] = useState('')
  const [description, setDescription] = useState('')
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const paintCell = useCallback((r, c) => {
    setGrid(g => {
      const next = g.map(row => [...row])
      // Don't overwrite borders with non-wall
      if (r === 0 || r === GRID - 1 || c === 0 || c === GRID - 1) {
        next[r][c] = CELL.WALL
      } else {
        next[r][c] = tool
      }
      return next
    })
  }, [tool])

  const generateRandom = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/levels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore server')
      if (data.grid) {
        setGrid(data.grid)
        setLevelName(data.name || '')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const clearLevel = () => setGrid(emptyGrid())

  const saveLevel = () => {
    if (!levelName.trim()) { setError('Inserisci un nome per il livello'); return }
    setLevels(l => [...l, { grid: grid.map(r => [...r]), name: levelName, id: Date.now() }])
    setError('')
  }

  const loadLevel = (lv) => { setGrid(lv.grid.map(r => [...r])); setLevelName(lv.name) }

  // Count cells
  const wallCount = grid.flat().filter(c => c === CELL.WALL).length
  const floorCount = grid.flat().filter(c => c === CELL.FLOOR).length

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundImage: 'url(/bg-levels.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <PageHeader title="Editor Livelli" icon="/card-livelli.png" />
      {/* ── View mode tabs ── */}
      <div className="tab-bar">
        <div className={`tab ${viewMode === '2d' ? 'active' : ''}`} onClick={() => setViewMode('2d')}>Editor 2D</div>
        <div className={`tab ${viewMode === '3d' ? 'active' : ''}`} onClick={() => setViewMode('3d')}>Preview 3D</div>
      </div>

      <div className="editor-layout" style={{ flex: 1, overflow: 'hidden' }}>
        {/* ── Left panel ── */}
        <div className="editor-panel" style={{ background: 'rgba(6,4,2,0.88)' }}>
          <div className="panel-section">
            <div className="panel-title">Livello</div>
            <div className="field">
              <label>Nome Livello</label>
              <input value={levelName} onChange={e => setLevelName(e.target.value)} placeholder="Es: Antrum Inferni" />
            </div>
            <div className="field">
              <label>Note (opzionale)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Es: Labirinto con corridoi stretti e grandi stanze centrali..."
                rows={3}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ai" style={{ flex: 1 }} onClick={generateRandom} disabled={loading}>
                {loading ? <><span className="spinner" /></> : '⚙ Genera Casuale'}
              </button>
              <button className="btn btn-secondary" onClick={clearLevel}>Reset</button>
            </div>
            {error && <div style={{ color: '#ff4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
          </div>

          <div className="panel-section">
            <div className="panel-title">Strumento Attivo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TOOLS.map(t => (
                <div key={t.id}
                  onClick={() => setTool(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', cursor: 'pointer',
                    border: `1px solid ${tool === t.id ? '#ff4400' : '#333'}`,
                    background: tool === t.id ? '#1a0a00' : 'transparent',
                  }}>
                  <div style={{ width: 14, height: 14, background: t.color, border: '1px solid #555', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: tool === t.id ? '#ff8800' : '#888' }}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-title">Statistiche</div>
            <div style={{ fontSize: 11, color: '#888', lineHeight: 2 }}>
              <div>Muri: <span style={{ color: '#ccc' }}>{wallCount}</span></div>
              <div>Pavimento: <span style={{ color: '#ccc' }}>{floorCount}</span></div>
              <div>Dimensione: <span style={{ color: '#ccc' }}>{GRID}×{GRID}</span></div>
            </div>
          </div>

          <div className="panel-section">
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveLevel}>
              Salva Livello
            </button>
          </div>

          {levels.length > 0 && (
            <div className="panel-section">
              <div className="panel-title">Livelli Salvati</div>
              <div className="item-list">
                {levels.map(lv => (
                  <div key={lv.id} className="list-item" onClick={() => loadLevel(lv)}>
                    <span className="list-item-name">{lv.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Center: grid / 3D ── */}
        <div className="editor-main" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,2,1,0.55)' }}>
          {viewMode === '2d' ? (
            <div
              style={{ display: 'inline-block', cursor: 'crosshair', userSelect: 'none' }}
              onMouseLeave={() => setPainting(false)}
            >
              {grid.map((row, r) => (
                <div key={r} style={{ display: 'flex' }}>
                  {row.map((cell, c) => (
                    <div
                      key={c}
                      style={{
                        width: 24,
                        height: 24,
                        background: CELL_COLORS[cell],
                        border: '1px solid #0d0d0d',
                        boxSizing: 'border-box',
                        transition: 'background 0.05s',
                      }}
                      onMouseDown={() => { setPainting(true); paintCell(r, c) }}
                      onMouseUp={() => setPainting(false)}
                      onMouseEnter={() => { if (painting) paintCell(r, c) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%' }}>
              <LevelPreview grid={grid} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
