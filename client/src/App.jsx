import { Routes, Route, useLocation } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext.jsx'
import Home         from './components/Home/Home.jsx'
import GameScene    from './components/Game/GameScene.jsx'
import MonsterEditor from './components/MonsterEditor/MonsterEditor.jsx'
import SurfaceEditor from './components/SurfaceEditor/SurfaceEditor.jsx'
import LevelEditor  from './components/LevelEditor/LevelEditor.jsx'
import AdminPanel   from './components/Admin/AdminPanel.jsx'
import Footer       from './components/Footer/Footer.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function Layout() {
  const { pathname } = useLocation()
  const hideFooter = pathname === '/game'

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/game"     element={<GameScene />} />
          <Route path="/monsters" element={<MonsterEditor />} />
          <Route path="/surfaces" element={<SurfaceEditor />} />
          <Route path="/levels"   element={<LevelEditor />} />
          <Route path="/admin"    element={<AdminPanel />} />
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
