import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import SoundToggle from './SoundToggle.jsx'

export default function PageHeader({ title }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  return (
    <div style={{
      height: 46,
      display: 'flex',
      alignItems: 'center',
      background: '#0a0805',
      borderBottom: '1px solid #1e0e00',
      padding: '0 14px',
      flexShrink: 0,
      zIndex: 10,
    }}>
      {/* Left: back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <BackBtn onClick={() => navigate('/')} />
        {title && (
          <span style={{
            color: '#885533',
            fontSize: 11,
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}>
            {title}
          </span>
        )}
      </div>

      {/* Right: sound toggle + user info */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <SoundToggle />

        {user && (
          <>
            {user.isAdmin && (
              <button onClick={() => navigate('/admin')} style={{
                background: 'transparent', border: '1px solid #665500',
                color: '#ccaa00', fontFamily: 'monospace', fontSize: 10,
                letterSpacing: 2, padding: '3px 10px', cursor: 'pointer',
                transition: 'all 0.15s', outline: 'none',
              }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor:'#ffcc00', color:'#ffdd44' })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor:'#665500', color:'#ccaa00' })}
              >⚙ ADMIN</button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.avatar && (
                <img key={user.id} src={user.avatar}
                  style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #442200' }} alt="" />
              )}
              <span style={{ color: '#cc8855', fontSize: 11 }}>{user.name}</span>
            </div>
            <button onClick={logout} style={{
              background: 'transparent', border: '1px solid #331800',
              color: '#775533', fontFamily: 'monospace', fontSize: 10,
              letterSpacing: 1, padding: '3px 8px', cursor: 'pointer',
              outline: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor:'#cc2200', color:'#ff4400' })}
            onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor:'#331800', color:'#775533' })}
            >ESCI</button>
          </>
        )}
      </div>
    </div>
  )
}

function BackBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px solid #2a1208',
        color: '#885533',
        fontFamily: 'Courier New, monospace',
        fontSize: 11,
        letterSpacing: 2,
        padding: '4px 12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        outline: 'none',
      }}
      onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor:'#cc2200', color:'#ff4400' })}
      onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor:'#2a1208', color:'#885533' })}
    >
      ← MENU
    </button>
  )
}
