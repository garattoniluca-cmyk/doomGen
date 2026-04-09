import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Home          from './components/Home/Home.jsx'
import GameScene     from './components/Game/GameScene.jsx'
import MonsterEditor from './components/MonsterEditor/MonsterEditor.jsx'
import SurfaceEditor from './components/SurfaceEditor/SurfaceEditor.jsx'
import LevelEditor   from './components/LevelEditor/LevelEditor.jsx'
import AdminPanel    from './components/Admin/AdminPanel.jsx'
import Footer        from './components/Footer/Footer.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return children
}

function Layout() {
  const { pathname } = useLocation()
  const hideFooter = pathname === '/game'

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/game"     element={<GameScene />} />
          <Route path="/monsters" element={<RequireAuth><MonsterEditor /></RequireAuth>} />
          <Route path="/surfaces" element={<RequireAuth><SurfaceEditor /></RequireAuth>} />
          <Route path="/levels"   element={<RequireAuth><LevelEditor /></RequireAuth>} />
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
