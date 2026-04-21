import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Home          from './components/Home/Home.jsx'
import GameScene     from './components/Game/GameScene.jsx'
import MonsterEditor from './components/MonsterEditor/MonsterEditor.jsx'
import SurfaceEditor from './components/SurfaceEditor/SurfaceEditor.jsx'
import LevelEditor   from './components/LevelEditor/LevelEditor.jsx'
import SupplyEditor  from './components/SupplyEditor/SupplyEditor.jsx'
import AdminPanel    from './components/Admin/AdminPanel.jsx'
import Footer        from './components/Footer/Footer.jsx'
import { sfx }       from './utils/sfx.js'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// ── Global sound event delegation ────────────────────────────────────────────
/**
 * Returns true if the element (or a close ancestor ≤4 levels up) is interactive.
 * Strategy: check computed cursor === 'pointer' — this catches every button, div
 * with onClick, select, tab, etc. without needing class names or data attributes.
 */
function isInteractive(el) {
  let node = el
  for (let i = 0; i < 5; i++) {
    if (!node || node === document.body) break
    const tag = node.tagName
    if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'A') return node
    if (tag === 'INPUT') {
      const t = node.type
      if (t === 'range' || t === 'color' || t === 'checkbox' || t === 'radio') return node
      // text inputs: click yes, hover no
      return node
    }
    if (window.getComputedStyle(node).cursor === 'pointer') return node
    node = node.parentElement
  }
  return null
}

function useSoundListeners() {
  useEffect(() => {
    const onOver = (e) => {
      const el = isInteractive(e.target)
      if (el) sfx.hover(el)
    }
    const onDown = (e) => {
      // mousedown feels more responsive than click
      const el = isInteractive(e.target)
      if (el) sfx.click()
    }
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])
}

// ── Auth guard ────────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return children
}

// ── App layout ────────────────────────────────────────────────────────────────
function Layout() {
  const { pathname } = useLocation()
  const hideFooter = pathname === '/game'

  useSoundListeners()

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/game"     element={<GameScene />} />
          <Route path="/monsters" element={<RequireAuth><MonsterEditor /></RequireAuth>} />
          <Route path="/surfaces" element={<RequireAuth><SurfaceEditor /></RequireAuth>} />
          <Route path="/levels"   element={<RequireAuth><LevelEditor /></RequireAuth>} />
          <Route path="/supplies" element={<RequireAuth><SupplyEditor /></RequireAuth>} />
          <Route path="/admin"    element={<RequireAuth><AdminPanel /></RequireAuth>} />
        </Routes>
      </div>
      {!hideFooter && <Footer />}
    </div>
  )
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
