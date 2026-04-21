import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../context/AuthContext.jsx'
import SoundToggle from '../SoundToggle.jsx'

const EDITORS = [
  { label: 'MOSTRI',    desc: 'Crea e configura i nemici del gioco',        path: '/monsters', img: '/card-mostri.png' },
  { label: 'SUPERFICI', desc: 'Texture per muri, pavimenti e soffitti',     path: '/surfaces', img: '/card-superfici.png' },
  { label: 'LIVELLI',   desc: 'Disegna e genera le mappe di gioco',         path: '/levels',   img: '/card-livelli.png' },
  { label: 'FORNITURE', desc: 'Oggetti e prop per popolare i livelli',       path: '/supplies', img: null },
  { label: 'SKYBOXES',  desc: 'Ambienti, cieli e fondali atmosferici',      path: null,        img: null },
  { label: 'FX / MUSIC',desc: 'Effetti sonori e musica procedurale',        path: null,        img: null },
]

const AI_LAB = { label: 'MONSTERS AI LAB', desc: 'Generazione procedurale AI dei mostri', path: null, img: null }

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

  const handleGoogleSuccess = async (cred) => {
    try { await loginWithGoogle(cred.credential) }
    catch (e) { alert('Login fallito: ' + e.message) }
  }

  return (
    <div style={{
      width: '100%', minHeight: '100%',
      background: '#060402',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      fontFamily: 'Courier New, monospace',
      overflow: 'hidden', userSelect: 'none', zIndex: 1,
      position: 'relative',
    }}>

      {/* ── Hero image — fixed so it never rescales with content height ── */}
      <img src="/hero.png" alt="" style={{
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100vh',
        objectFit: 'cover', objectPosition: 'center top',
        opacity: 0.55, pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Dark gradient overlay — also fixed ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 30%, rgba(4,2,1,0.70) 55%, rgba(4,2,1,0.82) 100%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Top-right bar: sound + user ── */}
      <div style={{
        position: 'absolute', top: 12, right: 16,
        zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(120,40,0,0.4)',
        padding: '5px 10px',
        backdropFilter: 'blur(4px)',
      }}>
        <SoundToggle />
        {!loading && user && (
          <>
            {user.isAdmin && (
              <button onClick={() => navigate('/admin')} style={{
                background: 'transparent', border: '1px solid #665500',
                color: '#ccaa00', fontFamily: 'monospace', fontSize: 10,
                letterSpacing: 2, padding: '3px 9px', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor:'#ffcc00', color:'#ffee55' })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor:'#665500', color:'#ccaa00' })}
              >⚙ ADMIN</button>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              {user.avatar && (
                <img key={user.id} src={user.avatar}
                  style={{ width:24, height:24, borderRadius:'50%', border:'1px solid #552200' }} alt="" />
              )}
              <span style={{ color:'#ffbb88', fontSize:11, letterSpacing:1 }}>{user.name}</span>
            </div>
            <button onClick={logout} style={{
              background:'transparent', border:'1px solid #441800',
              color:'#cc6633', fontFamily:'monospace', fontSize:10,
              letterSpacing:1, padding:'3px 8px', cursor:'pointer', transition:'all 0.15s',
            }}
            onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor:'#cc2200', color:'#ff5500' })}
            onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor:'#441800', color:'#cc6633' })}
            >ESCI</button>
          </>
        )}
      </div>

      {/* ── Content panel ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 0,
        paddingTop: '7%', paddingBottom: 40, width: '100%',
      }}>

        {/* DoomGen title */}
        <div style={{
          fontSize: 72, fontWeight: 'normal', letterSpacing: 6,
          color: '#ff2200',
          textShadow: '0 0 22px #ff4400, 0 0 55px #cc110088, 0 3px 6px #000, 2px 2px 0 #550000',
          lineHeight: 1, marginBottom: 12,
          fontFamily: '"Metal Mania", cursive',
        }}>DoomGen</div>

        {/* Subtitle line 1 */}
        <div style={{
          color: '#ffaa77', fontSize: 11, letterSpacing: 8,
          textShadow: '0 0 10px #cc4400, 0 2px 6px #000',
          marginBottom: 6,
        }}>
          GENERATORE DI INFERI
        </div>

        {/* Subtitle line 2 */}
        <div style={{
          color: '#cc7744', fontSize: 10, letterSpacing: 4,
          textShadow: '0 1px 6px #000',
          marginBottom: 32,
        }}>
          Procedural · AI assisted · Multiuser Hell
        </div>

        {/* GIOCA */}
        <PlayButton onClick={() => navigate('/game')} />

        {/* Google login */}
        {!loading && !user && (
          <div style={{ marginTop: 22, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ color:'#ff9966', fontSize:10, letterSpacing:3,
              textShadow:'0 1px 6px #000' }}>
              ACCEDI PER SALVARE I TUOI CONTENUTI
            </div>
            <div style={{ filter:'invert(1) hue-rotate(180deg) brightness(0.4) sepia(1) hue-rotate(330deg)' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => alert('Errore Google Login')}
                theme="filled_black" shape="square" text="signin_with" locale="it"
              />
            </div>
          </div>
        )}

        {!loading && user && (
          <div style={{ marginTop:12, color:'#cc8855', fontSize:10, letterSpacing:2,
            textShadow:'0 1px 6px #000' }}>
            I tuoi contenuti vengono salvati automaticamente
          </div>
        )}

        {/* Editor section */}
        {!loading && user && (
          <>
            {/* Separator */}
            <div style={{ width:420, borderTop:'1px solid rgba(180,60,0,0.4)',
              margin:'28px 0 24px', position:'relative' }}>
              <span style={{
                position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)',
                background:'rgba(4,2,1,0.9)', padding:'0 16px',
                color:'#ff9966', fontSize:10, letterSpacing:6,
                textShadow:'0 0 10px #cc4400',
              }}>EDITOR</span>
            </div>

            {/* Cards — 3×2 grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 152px)', gap:14 }}>
              {EDITORS.map(card => (
                <EditorCard key={card.label} {...card}
                  onClick={card.path ? () => navigate(card.path) : null} />
              ))}
            </div>

            {/* AI Lab separator + card */}
            <div style={{ width:480, borderTop:'1px solid rgba(180,60,0,0.25)',
              margin:'22px 0 18px', position:'relative' }}>
              <span style={{
                position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)',
                background:'rgba(4,2,1,0.9)', padding:'0 14px',
                color:'#cc5500', fontSize:9, letterSpacing:6,
                textShadow:'0 0 8px #882200',
              }}>AI TOOLS</span>
            </div>
            <EditorCard {...AI_LAB} onClick={null} wide />

            {/* Online users */}
            {online.length > 0 && (
              <div style={{ marginTop:24, display:'flex', flexDirection:'column',
                alignItems:'center', gap:10 }}>
                <div style={{ color:'#cc8855', fontSize:9, letterSpacing:5,
                  textShadow:'0 1px 4px #000' }}>
                  CONNESSI ORA — {online.length}
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
                  {online.map(u => (
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      {u.avatar
                        ? <img src={u.avatar} style={{ width:20, height:20, borderRadius:'50%',
                            border:'1px solid #552200' }} alt="" />
                        : <div style={{ width:20, height:20, borderRadius:'50%',
                            background:'#1a0800', border:'1px solid #441a00' }} />
                      }
                      <span style={{ color:'#ffbb88', fontSize:10, letterSpacing:1,
                        textShadow:'0 1px 4px #000' }}>{u.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Play button ───────────────────────────────────────────────────────────────
function PlayButton({ onClick }) {
  return (
    <button style={{
      position: 'relative',
      backgroundImage: 'url(/btn-gioca.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      border: '2px solid #8a3000',
      color: '#ffffff',
      fontSize: 22, letterSpacing: 14,
      padding: '22px 90px', cursor: 'pointer',
      fontFamily: 'Courier New, monospace', fontWeight: 'bold',
      textShadow: '0 0 16px #ff4400, 0 2px 4px #000',
      boxShadow: '0 0 28px #cc220055, 0 4px 24px rgba(0,0,0,0.8)',
      transition: 'all 0.18s', outline: 'none',
    }}
    onClick={onClick}
    onMouseEnter={e => Object.assign(e.currentTarget.style, {
      borderColor: '#ff4400',
      boxShadow: '0 0 44px #ff440088, 0 4px 24px rgba(0,0,0,0.9)',
      filter: 'brightness(1.25)',
    })}
    onMouseLeave={e => Object.assign(e.currentTarget.style, {
      borderColor: '#8a3000',
      boxShadow: '0 0 28px #cc220055, 0 4px 24px rgba(0,0,0,0.8)',
      filter: 'brightness(1)',
    })}
    >► &nbsp;GIOCA</button>
  )
}

// ── Editor card ───────────────────────────────────────────────────────────────
function EditorCard({ img, label, desc, onClick, wide }) {
  const locked = !onClick
  return (
    <div onClick={locked ? undefined : onClick}
      style={{
        width: wide ? 480 : '100%',
        background: locked ? 'rgba(4,3,2,0.82)' : 'rgba(6,4,2,0.88)',
        border: `1px solid ${locked ? 'rgba(80,40,0,0.35)' : 'rgba(180,50,0,0.5)'}`,
        cursor: locked ? 'default' : 'pointer', textAlign: 'center',
        transition: 'all 0.18s', backdropFilter: 'blur(6px)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.7)',
        overflow: 'hidden', opacity: 1,
        display: wide ? 'flex' : 'block', alignItems: wide ? 'center' : undefined,
      }}
      onMouseEnter={e => { if (!locked) Object.assign(e.currentTarget.style, {
        borderColor: '#cc2200',
        boxShadow: '0 0 28px #cc220066, 0 4px 18px rgba(0,0,0,0.8)',
        transform: 'translateY(-3px)', opacity:'1',
      })}}
      onMouseLeave={e => { if (!locked) Object.assign(e.currentTarget.style, {
        borderColor: 'rgba(180,50,0,0.5)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.7)',
        transform: 'translateY(0)', opacity:'1',
      })}}
    >
      {/* Card image (only if available) */}
      {img && (
        <div style={{ width: wide ? 80 : '100%', flexShrink:0,
          aspectRatio: wide ? undefined : '1/1', height: wide ? 60 : undefined,
          overflow:'hidden', position:'relative' }}>
          <img src={img} alt={label} style={{
            width:'100%', height:'100%', objectFit:'cover',
            display:'block', transition:'transform 0.3s',
          }} />
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:'40%',
            background:'linear-gradient(to bottom, transparent, rgba(6,4,2,0.9))',
          }} />
        </div>
      )}
      {/* Placeholder when no image */}
      {!img && !wide && (
        <div style={{ width:'100%', aspectRatio:'1/1', background:'#0a0603',
          display:'flex', alignItems:'center', justifyContent:'center',
          borderBottom:'1px solid rgba(80,40,0,0.3)' }}>
          <span style={{ color:'#331a00', fontSize:28 }}>□</span>
        </div>
      )}
      {/* Label + desc */}
      <div style={{ padding: wide ? '12px 20px' : '10px 12px 14px', flex: wide ? 1 : undefined }}>
        <div style={{ color: locked ? '#885533' : '#ff8855', fontSize:11, letterSpacing:3,
          marginBottom:5, textShadow: locked ? 'none' : '0 0 8px #cc2200' }}>{label}</div>
        <div style={{ color: locked ? '#553322' : '#cc8866', fontSize:10, lineHeight:1.8 }}>{desc}</div>
        {locked && (
          <div style={{ marginTop:6, color:'#553300', fontSize:8, letterSpacing:3 }}>PROSSIMAMENTE</div>
        )}
      </div>
    </div>
  )
}
