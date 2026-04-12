import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import pool from '../db/connection.js'
import { signToken, requireAuth } from '../middleware/auth.js'

const router = Router()
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

const VALID_PAGES = new Set(['home','game','monsters','surfaces','levels','admin'])
const sanitizePage = (p) => (p && VALID_PAGES.has(p)) ? p : 'home'
const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 45)

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential } = req.body
  if (!credential) return res.status(400).json({ error: 'credential mancante' })

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId || clientId === 'your_google_client_id_here') {
    return res.status(503).json({ error: 'Google OAuth non configurato' })
  }

  try {
    const client = new OAuth2Client(clientId)
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId })
    const payload = ticket.getPayload()

    const googleId  = payload.sub
    const email     = payload.email
    const name      = payload.name
    const avatarUrl = payload.picture

    const [existing] = await pool.query('SELECT * FROM users WHERE google_id = ?', [googleId])
    let user

    if (existing.length > 0) {
      user = existing[0]
      await pool.query('UPDATE users SET name=?, avatar_url=? WHERE id=?', [name, avatarUrl, user.id])
      user.name = name
      user.avatar_url = avatarUrl
    } else {
      const [result] = await pool.query(
        'INSERT INTO users (google_id, email, name, avatar_url) VALUES (?,?,?,?)',
        [googleId, email, name, avatarUrl]
      )
      user = { id: result.insertId, google_id: googleId, email, name, avatar_url: avatarUrl }
    }

    const [adminRow] = await pool.query('SELECT id FROM admins WHERE user_id = ?', [user.id])
    let isAdmin = adminRow.length > 0

    if (!isAdmin && ADMIN_EMAILS.includes(email.toLowerCase())) {
      await pool.query('INSERT IGNORE INTO admins (user_id) VALUES (?)', [user.id])
      isAdmin = true
    }

    // Close any dangling open sessions (browser crash, expired token still in localStorage)
    await pool.query(
      `UPDATE user_sessions
       SET logout_at = NOW(),
           duration_secs = TIMESTAMPDIFF(SECOND, login_at, NOW()),
           logout_reason = 'system'
       WHERE user_id = ? AND logout_at IS NULL`,
      [user.id]
    )

    // Open new session
    const ip = clientIp(req)
    const [sessionResult] = await pool.query(
      'INSERT INTO user_sessions (user_id, ip) VALUES (?, ?)',
      [user.id, ip]
    )
    const sessionId = sessionResult.insertId

    // Mark user as online
    await pool.query(
      'UPDATE users SET last_seen = NOW(), current_page = ? WHERE id = ?',
      ['home', user.id]
    )

    user.isAdmin = isAdmin
    const token = signToken(user, sessionId)
    res.json({ token, user: { id: user.id, email, name, avatar: avatarUrl, isAdmin } })
  } catch (err) {
    console.error('[auth/google]', err.message)
    res.status(500).json({ error: 'Autenticazione fallita: ' + err.message })
  }
})

// POST /api/auth/dev-login — solo in sviluppo, login diretto per ID utente
router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Non disponibile in produzione' })
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId mancante' })
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId])
    if (!rows.length) return res.status(404).json({ error: 'Utente non trovato' })
    const user = rows[0]
    const [adminRow] = await pool.query('SELECT id FROM admins WHERE user_id = ?', [user.id])
    const isAdmin = adminRow.length > 0
    // Close any dangling open sessions
    await pool.query(
      `UPDATE user_sessions SET logout_at = NOW(),
        duration_secs = TIMESTAMPDIFF(SECOND, login_at, NOW()), logout_reason = 'system'
       WHERE user_id = ? AND logout_at IS NULL`,
      [user.id]
    )
    const ip = clientIp(req)
    const [sessionResult] = await pool.query('INSERT INTO user_sessions (user_id, ip) VALUES (?, ?)', [user.id, ip])
    const sessionId = sessionResult.insertId
    await pool.query('UPDATE users SET last_seen = NOW(), current_page = ? WHERE id = ?', ['home', user.id])
    user.isAdmin = isAdmin
    const token = signToken(user, sessionId)
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar_url, isAdmin } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Non autenticato' })
  try {
    const { default: jwt } = await import('jsonwebtoken')
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'doomgen_secret')
    res.json({ user: decoded })
  } catch {
    res.status(401).json({ error: 'Token non valido' })
  }
})

// POST /api/auth/heartbeat — body: { page }
router.post('/heartbeat', requireAuth, async (req, res) => {
  const page = sanitizePage(req.body?.page)
  try {
    await pool.query(
      'UPDATE users SET last_seen = NOW(), current_page = ? WHERE id = ?',
      [page, req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/logout — body: { reason: 'manual'|'timeout' }
router.post('/logout', requireAuth, async (req, res) => {
  const reason    = req.body?.reason === 'timeout' ? 'timeout' : 'manual'
  const sessionId = req.user.sessionId
  try {
    if (sessionId) {
      await pool.query(
        `UPDATE user_sessions
         SET logout_at = NOW(),
             duration_secs = TIMESTAMPDIFF(SECOND, login_at, NOW()),
             logout_reason = ?
         WHERE id = ? AND user_id = ? AND logout_at IS NULL`,
        [reason, sessionId, req.user.id]
      )
    }
    await pool.query(
      'UPDATE users SET last_seen = NULL, current_page = NULL WHERE id = ?',
      [req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
