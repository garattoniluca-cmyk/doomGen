import { useState } from 'react'
import { sfx } from '../utils/sfx.js'

/**
 * Small mute/unmute button — drop it anywhere in the UI.
 * Reads initial state from sfx singleton, persists to localStorage.
 */
export default function SoundToggle({ style = {} }) {
  const [muted, setMuted] = useState(sfx.muted)

  const toggle = () => {
    const nowMuted = sfx.toggle()
    setMuted(nowMuted)
  }

  return (
    <button
      onClick={toggle}
      title={muted ? 'Attiva suoni' : 'Disattiva suoni'}
      style={{
        background: 'transparent',
        border: `1px solid ${muted ? '#2a1208' : '#553300'}`,
        color:  muted ? '#331a0a' : '#997744',
        fontFamily: 'monospace',
        fontSize: 14,
        lineHeight: 1,
        padding: '3px 7px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        outline: 'none',
        flexShrink: 0,
        ...style,
      }}
      onMouseEnter={e => Object.assign(e.currentTarget.style, {
        borderColor: muted ? '#553300' : '#cc4400',
        color:       muted ? '#997744' : '#ff6622',
      })}
      onMouseLeave={e => Object.assign(e.currentTarget.style, {
        borderColor: muted ? '#2a1208' : '#553300',
        color:       muted ? '#331a0a' : '#997744',
      })}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
