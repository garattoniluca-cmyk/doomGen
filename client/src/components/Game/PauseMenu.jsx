import { useState, useEffect } from 'react'

const ITEMS = [
  { id: 'resume',  label: 'RIPRENDI',         disabled: false },
  { id: 'restart', label: 'RIAVVIA LIVELLO',   disabled: false },
  { id: 'options', label: 'OPZIONI',           disabled: true  },
  { id: 'home',    label: '← TORNA AL MENU',  disabled: false, accent: true },
]

export default function PauseMenu({ onResume, onRestart, onHome }) {
  const [sel, setSel] = useState(0)

  // Keyboard navigation
  useEffect(() => {
    const enabledItems = ITEMS.map((item, i) => ({ ...item, i })).filter(x => !x.disabled)

    const onKey = e => {
      if (e.code === 'Escape') { onResume(); return }

      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault()
        setSel(prev => {
          const idx = enabledItems.findIndex(x => x.i === prev)
          const next = e.code === 'ArrowUp'
            ? (idx - 1 + enabledItems.length) % enabledItems.length
            : (idx + 1) % enabledItems.length
          return enabledItems[next].i
        })
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        const item = ITEMS[sel]
        if (!item.disabled) handleAction(item.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, onResume, onRestart, onHome])

  const handleAction = id => {
    if (id === 'resume')  onResume()
    if (id === 'restart') onRestart()
    if (id === 'home')    onHome()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.94) 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Courier New, monospace',
    }}>
      {/* Panel */}
      <div style={{
        border: '1px solid #330e00',
        background: '#09060400',
        padding: '48px 72px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        minWidth: 320,
        boxShadow: '0 0 60px #cc220011',
        position: 'relative',
      }}>
        {/* Corner decorations */}
        {['tl','tr','bl','br'].map(c => (
          <div key={c} style={{
            position: 'absolute',
            top:    c.startsWith('t') ? -1 : 'auto',
            bottom: c.startsWith('b') ? -1 : 'auto',
            left:   c.endsWith('l')   ? -1 : 'auto',
            right:  c.endsWith('r')   ? -1 : 'auto',
            width: 10, height: 10,
            borderTop:    c.startsWith('t') ? '2px solid #882200' : 'none',
            borderBottom: c.startsWith('b') ? '2px solid #882200' : 'none',
            borderLeft:   c.endsWith('l')   ? '2px solid #882200' : 'none',
            borderRight:  c.endsWith('r')   ? '2px solid #882200' : 'none',
          }} />
        ))}

        {/* Title */}
        <div style={{
          color: '#cc2200',
          fontSize: 28,
          fontWeight: 'bold',
          letterSpacing: 12,
          textShadow: '0 0 16px #ff4400, 0 0 32px #aa2200',
          marginBottom: 8,
        }}>
          PAUSA
        </div>
        <div style={{ width: 80, borderTop: '1px solid #330e00', marginBottom: 36 }} />

        {/* Menu items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          {ITEMS.map((item, i) => (
            <MenuItem
              key={item.id}
              label={item.label}
              disabled={item.disabled}
              accent={item.accent}
              selected={sel === i}
              onHover={() => !item.disabled && setSel(i)}
              onClick={() => !item.disabled && handleAction(item.id)}
            />
          ))}
        </div>

        {/* Hint */}
        <div style={{ marginTop: 32, color: '#221008', fontSize: 10, letterSpacing: 2 }}>
          ESC · INVIO · ↑↓
        </div>
      </div>
    </div>
  )
}

function MenuItem({ label, disabled, accent, selected, onHover, onClick }) {
  const color = disabled
    ? '#2a1208'
    : accent
      ? (selected ? '#ff6622' : '#882200')
      : (selected ? '#ffaa44' : '#664422')

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 16px',
        cursor: disabled ? 'default' : 'pointer',
        background: selected && !disabled ? '#1a0800' : 'transparent',
        border: `1px solid ${selected && !disabled ? '#330e00' : 'transparent'}`,
        transition: 'all 0.1s',
        userSelect: 'none',
      }}
    >
      {/* Selector arrow */}
      <span style={{
        color: '#cc2200',
        fontSize: 12,
        opacity: selected && !disabled ? 1 : 0,
        transition: 'opacity 0.1s',
        width: 12,
        flexShrink: 0,
      }}>►</span>

      <span style={{
        color,
        fontSize: 13,
        letterSpacing: 3,
        transition: 'color 0.1s',
        flex: 1,
      }}>
        {label}
      </span>

      {disabled && (
        <span style={{ color: '#221208', fontSize: 9, letterSpacing: 1 }}>PRESTO</span>
      )}
    </div>
  )
}
