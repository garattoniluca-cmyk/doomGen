import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const AuthContext = createContext(null)

const HEARTBEAT_INTERVAL = 30_000   // 30s
const IDLE_TIMEOUT       = 15 * 60_000  // 15 minuti

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  const heartbeatRef  = useRef(null)
  const idleTimerRef  = useRef(null)

  // Verify token on mount only
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    if (!savedToken) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUser(data.user))
      .catch(() => { localStorage.removeItem('token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [])

  // Heartbeat + idle timeout when logged in
  useEffect(() => {
    if (!token || !user) {
      clearInterval(heartbeatRef.current)
      clearTimeout(idleTimerRef.current)
      return
    }

    const getPage = () => {
      const p = window.location.pathname
      if (p === '/game')     return 'game'
      if (p === '/monsters') return 'monsters'
      if (p === '/surfaces') return 'surfaces'
      if (p === '/levels')   return 'levels'
      if (p === '/admin')    return 'admin'
      return 'home'
    }

    const beat = () =>
      fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: getPage() }),
      }).catch(() => {})

    beat() // subito al login
    heartbeatRef.current = setInterval(beat, HEARTBEAT_INTERVAL)

    const resetIdle = () => {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        logoutFn(token, 'timeout')
      }, IDLE_TIMEOUT)
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle()

    return () => {
      clearInterval(heartbeatRef.current)
      clearTimeout(idleTimerRef.current)
      events.forEach(e => window.removeEventListener(e, resetIdle))
    }
  }, [token, user]) // eslint-disable-line

  const logoutFn = useCallback((t, reason = 'manual') => {
    const tok = t || localStorage.getItem('token')
    if (tok) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }).catch(() => {})
    }
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login fallito')
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => logoutFn(), [logoutFn])

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
