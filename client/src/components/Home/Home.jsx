import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../context/AuthContext.jsx'

const EDITORS = [
  { label: 'MOSTRI',     desc: 'Crea e configura i nemici del gioco',       path: '/monsters', icon: '☠' },
  { label: 'SUPERFICI',  desc: 'Texture per muri, pavimenti e soffitti',     path: '/surfaces', icon: '▦' },
  { label: 'LIVELLI',    desc: 'Disegna e genera le mappe di gioco',          path: '/levels',   icon: '⊞' },
]

export default function Home() {
  const navigate = useNavigate()
  const { user, loading, loginWithGoogle, logout } = useAuth()
  const [online, setOnline] = useState([])

  useEffect(() => {
    const load = () =>
      fetch('/api/stats')
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setOnline(d.online || []))
        .catch(() => {})
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      await loginWithGoogle(credentialResponse.credential)
    } catch (e) {
      alert('Login fallito: ' + e.message)
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#060402',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Courier New, monospace',
      overflow: 'hidden', userSelect: 'none',
      position: 'relative',
    }}>
      {/* ── Top right: user info / admin ── */}
      <div style={{ position: 'absolute', top: 14, right: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
        {!loading && user && (
          <>
            {user.isAdmin && (
              <button onClick={() => navigate('/admin')} style={{
                background: 'transparent', border: '1px solid #554400',
                color: '#aa8800', fontFamily: 'monospace', fontSize: 10,
                letterSpacing: 2, padding: '4px 10px', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor:'#ffcc00', color:'#ffcc00' })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor:'#554400', color:'#aa8800' })}
              >⚙ ADMIN</button>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {user.avatar && <img key={user.id} src={user.avatar} style={{ width:26,height:26,borderRadius:'50%',border:'1px solid #331a00' }} alt="" />}
              <span style={{ color:'#664422', fontSize:11 }}>{user.name}</span>
            </div>
            <button onClick={logout} style={{
              background:'transparent', border:'1px solid #221208',
              color:'#442211', fontFamily:'monospace', fontSize:10,
              letterSpacing:1, padding:'4px 8px', cursor:'pointer',
            }}>ESCI</button>
          </>
        )}
      </div>

      {/* ── Logo ── */}
      <div style={{
        fontSize: 54, fontWeight: 'bold', letterSpacing: 14, color: '#cc2200',
        textShadow: '0 0 18px #ff4400, 0 0 40px #cc2200, 0 0 80px #880000',
        marginBottom: 6,
      }}>DOOMGEN</div>
      <div style={{ color: '#3a2010', fontSize: 11, letterSpacing: 7, marginBottom: 52 }}>
        GENERATORE DI INFERI
      </div>

      {/* ── GIOCA button ── */}
      <PlayButton onClick={() => navigate('/game')} />

      {/* ── Google login (solo se non loggato) ── */}
      {!loading && !user && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ color: '#2a1208', fontSize: 10, letterSpacing: 3, marginBottom: 4 }}>ACCEDI PER SALVARE I TUOI CONTENUTI</div>
          <div style={{ filter: 'invert(1) hue-rotate(180deg) brightness(0.4) sepia(1) hue-rotate(330deg)' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => alert('Errore Google Login')}
              theme="filled_black"
              shape="square"
              text="signin_with"
              locale="it"
            />
          </div>
        </div>
      )}

      {!loading && user && (
        <div style={{ marginTop: 16, color: '#2a1208', fontSize: 10, letterSpacing: 2 }}>
          I tuoi contenuti vengono salvati automaticamente
        </div>
      )}

      {/* ── Separator + Editor cards + Online users (solo se loggato) ── */}
      {!loading && user && (
        <>
          <div style={{ width: 360, borderTop: '1px solid #1a0a00', margin: '44px 0 36px', position: 'relative' }}>
            <span style={{
              position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
              background: '#060402', padding: '0 12px',
              color: '#1e0c04', fontSize: 11, letterSpacing: 4,
            }}>EDITOR</span>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            {EDITORS.map(card => (
              <EditorCard key={card.path} {...card} onClick={() => navigate(card.path)} />
            ))}
          </div>

          {online.length > 0 && (
            <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ color: '#1e0c04', fontSize: 10, letterSpacing: 4 }}>
                CONNESSI ORA — {online.length}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {online.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {u.avatar
                      ? <img src={u.avatar} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #2a1000', opacity: 0.7 }} alt="" />
                      : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a0800', border: '1px solid #2a1000' }} />
                    }
                    <span style={{ color: '#3a1a08', fontSize: 10, letterSpacing: 1 }}>{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PlayButton({ onClick }) {
  return (
    <button style={{
      background: 'transparent', border: '2px solid #aa1c00', color: '#ff4400',
      fontSize: 20, letterSpacing: 10, padding: '20px 72px', cursor: 'pointer',
      fontFamily: 'Courier New, monospace', fontWeight: 'bold',
      textShadow: '0 0 10px #ff4400',
      boxShadow: '0 0 24px #aa220033, inset 0 0 24px #aa220011',
      transition: 'all 0.18s', outline: 'none',
    }}
    onClick={onClick}
    onMouseEnter={e => Object.assign(e.currentTarget.style, {
      background: '#aa1c00', color: '#ffffff', textShadow: 'none',
      boxShadow: '0 0 36px #ff4400aa, inset 0 0 20px #ff440022',
    })}
    onMouseLeave={e => Object.assign(e.currentTarget.style, {
      background: 'transparent', color: '#ff4400',
      textShadow: '0 0 10px #ff4400',
      boxShadow: '0 0 24px #aa220033, inset 0 0 24px #aa220011',
    })}
    >► &nbsp;GIOCA</button>
  )
}

function EditorCard({ icon, label, desc, onClick }) {
  return (
    <div style={{ width: 170, background: '#0b0806', border: '1px solid #221208', padding: '22px 16px 20px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s' }}
      onClick={onClick}
      onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor:'#cc2200', background:'#160a00', boxShadow:'0 0 16px #cc220022' })}
      onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor:'#221208', background:'#0b0806', boxShadow:'none' })}
    >
      <div style={{ fontSize: 28, marginBottom: 10, color: '#cc4400' }}>{icon}</div>
      <div style={{ color: '#cc2200', fontSize: 12, letterSpacing: 3, marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#3a2010', fontSize: 10, lineHeight: 1.7 }}>{desc}</div>
    </div>
  )
}
