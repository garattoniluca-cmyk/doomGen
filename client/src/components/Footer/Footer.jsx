import { useState, useEffect } from 'react'

const POLL_INTERVAL = 60_000

const STAT_LABELS = [
  { key: 'users',    label: 'UTENTI',     icon: '◈' },
  { key: 'monsters', label: 'MOSTRI',     icon: '☠' },
  { key: 'surfaces', label: 'SUPERFICI',  icon: '▦' },
  { key: 'levels',   label: 'LIVELLI',    icon: '⊞' },
]

export default function Footer() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/stats')
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setStats(d))
        .catch(() => {})

    load()
    const id = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      height: 38,
      background: '#060402',
      borderTop: '1px solid #1a0a00',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 40,
      flexShrink: 0,
      fontFamily: 'Courier New, monospace',
    }}>
      {STAT_LABELS.map(({ key, label, icon }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: '#331500', fontSize: 12 }}>{icon}</span>
          <span style={{ color: '#2a1000', fontSize: 10, letterSpacing: 2 }}>{label}</span>
          <span style={{ color: '#664422', fontSize: 11, letterSpacing: 1, minWidth: 24, textAlign: 'right' }}>
            {stats ? stats[key] : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
