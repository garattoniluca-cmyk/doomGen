import { useState } from 'react'
import PageHeader from '../PageHeader.jsx'

const BEHAVIORS = ['patrol', 'chase', 'shoot', 'ambush', 'stationary']
const BEHAVIOR_LABELS = { patrol: 'Pattuglia', chase: 'Insegue', shoot: 'Spara a distanza', ambush: 'Agguato', stationary: 'Fermo' }

const DEFAULT_FORM = {
  name: '',
  description: '',
  health: 100,
  speed: 5,
  damage: 20,
  behavior: 'patrol',
}

function StatBar({ label, value, max = 500, color = '#cc2200' }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <div className="stat-bar-bg">
        <div className="stat-bar-fill" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="stat-value">{value}</span>
    </div>
  )
}

export default function MonsterEditor() {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [monsters, setMonsters] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const generateWithAI = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/monsters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, behavior: form.behavior }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore server')
      setForm(f => ({
        ...f,
        name: data.name || f.name,
        health: data.health ?? f.health,
        speed: data.speed ?? f.speed,
        damage: data.damage ?? f.damage,
        behavior: data.behavior || f.behavior,
        _generated: data,
      }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const saveMonster = () => {
    if (!form.name.trim()) { setError('Inserisci un nome'); return }
    const monster = { ...form, id: Date.now() }
    setMonsters(m => [...m, monster])
    setSelected(monster)
    setForm(DEFAULT_FORM)
    setError('')
  }

  const deleteMonster = (id) => {
    setMonsters(m => m.filter(x => x.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const gen = form._generated

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <PageHeader title="Editor Mostri" />
    <div className="editor-layout" style={{ flex: 1, overflow: 'hidden' }}>
      {/* ── Left panel: form ── */}
      <div className="editor-panel">
        <div className="panel-section">
          <div className="panel-title">Nuovo Mostro</div>

          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Es: Demone Fiammante" />
          </div>

          <div className="field">
            <label>Descrizione per AI</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Note libere sul mostro (opzionale)..."
              rows={3}
            />
          </div>

          <button className="btn btn-ai" onClick={generateWithAI} disabled={loading}>
            {loading ? <><span className="spinner" />Generazione...</> : '⚙ Genera Casualmente'}
          </button>

          {error && <div style={{ color: '#ff4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
        </div>

        <div className="panel-section">
          <div className="panel-title">Statistiche</div>

          <div className="field">
            <label>Vita  ({form.health})</label>
            <input type="range" min={10} max={500} value={form.health} onChange={e => set('health', +e.target.value)}
              style={{ width: '100%', accentColor: '#cc2200' }} />
          </div>
          <div className="field">
            <label>Velocità  ({form.speed}/10)</label>
            <input type="range" min={1} max={10} value={form.speed} onChange={e => set('speed', +e.target.value)}
              style={{ width: '100%', accentColor: '#ff8800' }} />
          </div>
          <div className="field">
            <label>Danno  ({form.damage})</label>
            <input type="range" min={5} max={100} value={form.damage} onChange={e => set('damage', +e.target.value)}
              style={{ width: '100%', accentColor: '#ffcc00' }} />
          </div>

          <div className="field">
            <label>Comportamento</label>
            <select value={form.behavior} onChange={e => set('behavior', e.target.value)}>
              {BEHAVIORS.map(b => <option key={b} value={b}>{BEHAVIOR_LABELS[b]}</option>)}
            </select>
          </div>
        </div>

        {/* AI result preview */}
        {gen && (
          <div className="panel-section">
            <div className="panel-title">Risultato AI</div>
            <div className="result-card">
              {gen.lore && <p style={{ marginBottom: 8, fontStyle: 'italic', color: '#aaa', fontSize: 11 }}>{gen.lore}</p>}
              {gen.special_attacks?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: '#ff8800', fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>ATTACCHI SPECIALI</div>
                  {gen.special_attacks.map((a, i) => (
                    <div key={i} style={{ fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: '#ff4400' }}>{a.name}:</span> {a.description}
                    </div>
                  ))}
                </div>
              )}
              {gen.resistances?.length > 0 && (
                <div>
                  <div style={{ color: '#ff8800', fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>RESISTENZE</div>
                  <div className="chips">
                    {gen.resistances.map((r, i) => <span key={i} className={`chip ${r}`}>{r}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="panel-section">
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveMonster}>
            Salva Mostro
          </button>
        </div>
      </div>

      {/* ── Center: monster list ── */}
      <div className="editor-main" style={{ padding: 16, overflowY: 'auto' }}>
        <div className="panel-title" style={{ marginBottom: 16 }}>Mostri Creati ({monsters.length})</div>

        {monsters.length === 0 && (
          <div style={{ color: '#444', fontSize: 13, textAlign: 'center', marginTop: 60 }}>
            Nessun mostro ancora.<br />Usa il pannello a sinistra per crearne uno.
          </div>
        )}

        <div className="item-list">
          {monsters.map(m => (
            <div
              key={m.id}
              className={`list-item ${selected?.id === m.id ? 'selected' : ''}`}
              onClick={() => setSelected(m)}
            >
              <div>
                <div className="list-item-name">{m.name}</div>
                <div className="list-item-meta">{BEHAVIOR_LABELS[m.behavior]} · HP {m.health} · SPD {m.speed}</div>
              </div>
              <button className="btn btn-danger" style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={e => { e.stopPropagation(); deleteMonster(m.id) }}>
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ marginTop: 24, background: '#111', border: '1px solid #333', padding: 16 }}>
            <div style={{ color: '#ff4400', fontSize: 16, marginBottom: 12, letterSpacing: 2 }}>{selected.name}</div>
            <StatBar label="Vita" value={selected.health} max={500} color="#cc2200" />
            <StatBar label="Velocità" value={selected.speed} max={10} color="#ff8800" />
            <StatBar label="Danno" value={selected.damage} max={100} color="#ffcc00" />
            <div style={{ marginTop: 8, color: '#888', fontSize: 11 }}>
              Comportamento: <span style={{ color: '#ccc' }}>{BEHAVIOR_LABELS[selected.behavior]}</span>
            </div>
            {selected.description && (
              <div style={{ marginTop: 8, color: '#666', fontSize: 11, fontStyle: 'italic' }}>{selected.description}</div>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
