import { Router } from 'express'
import pool from '../db/connection.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAdmin)

// ── Stats dashboard ──────────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const [[{ users }]]    = await pool.query('SELECT COUNT(*) AS users FROM users')
    const [[{ admins }]]   = await pool.query('SELECT COUNT(*) AS admins FROM admins')
    const [[{ monsters }]] = await pool.query('SELECT COUNT(*) AS monsters FROM monsters')
    const [[{ surfaces }]] = await pool.query('SELECT COUNT(*) AS surfaces FROM surfaces')
    const [[{ levels }]]   = await pool.query('SELECT COUNT(*) AS levels FROM levels')
    const [[{ online }]]   = await pool.query(
      `SELECT COUNT(*) AS online FROM users WHERE last_seen >= NOW() - INTERVAL 3 MINUTE`
    )
    res.json({ users, admins, monsters, surfaces, levels, online })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Online users (real-time) ─────────────────────────────────────────────────
router.get('/online', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, u.avatar_url AS avatar,
             u.current_page AS page,
             TIMESTAMPDIFF(SECOND, u.last_seen, NOW()) AS seconds_ago,
             s.login_at,
             TIMESTAMPDIFF(SECOND, s.login_at, NOW()) AS session_secs
      FROM users u
      JOIN user_sessions s ON s.user_id = u.id AND s.logout_at IS NULL
      WHERE u.last_seen >= NOW() - INTERVAL 3 MINUTE
      ORDER BY u.last_seen DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Session logs ─────────────────────────────────────────────────────────────
router.get('/activity', async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || 100), 500)
  const offset = parseInt(req.query.offset || 0)
  const userId = req.query.user_id ? parseInt(req.query.user_id) : null
  try {
    const where  = userId ? 'WHERE s.user_id = ?' : ''
    const params = userId ? [userId, limit, offset] : [limit, offset]
    const [rows] = await pool.query(`
      SELECT s.id, s.login_at, s.logout_at, s.duration_secs, s.logout_reason, s.ip,
             u.name AS user_name, u.email AS user_email, u.avatar_url AS avatar
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      ${where}
      ORDER BY s.login_at DESC
      LIMIT ? OFFSET ?
    `, params)
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_sessions s ${where}`,
      userId ? [userId] : []
    )
    res.json({ rows, total, limit, offset })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Users ────────────────────────────────────────────────────────────────────
router.get('/users', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.email, u.name, u.avatar_url, u.created_at,
             (a.id IS NOT NULL) AS is_admin,
             (SELECT COUNT(*) FROM monsters WHERE user_id=u.id)  AS monsters,
             (SELECT COUNT(*) FROM surfaces WHERE user_id=u.id)  AS surfaces,
             (SELECT COUNT(*) FROM levels   WHERE user_id=u.id)  AS levels
      FROM users u
      LEFT JOIN admins a ON a.user_id = u.id
      ORDER BY u.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/users/:id/promote', async (req, res) => {
  try {
    await pool.query('INSERT IGNORE INTO admins (user_id) VALUES (?)', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/users/:id/demote', async (req, res) => {
  try {
    await pool.query('DELETE FROM admins WHERE user_id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Content: monsters ────────────────────────────────────────────────────────
router.get('/monsters', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.*, u.email AS user_email, u.name AS user_name
      FROM monsters m JOIN users u ON u.id = m.user_id
      ORDER BY m.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/monsters/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM monsters WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Content: surfaces ────────────────────────────────────────────────────────
router.get('/surfaces', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, u.email AS user_email, u.name AS user_name
      FROM surfaces s JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/surfaces/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM surfaces WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Content: levels ──────────────────────────────────────────────────────────
router.get('/levels', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.id, l.name, l.description, l.created_at,
             u.email AS user_email, u.name AS user_name
      FROM levels l JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/levels/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM levels WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
