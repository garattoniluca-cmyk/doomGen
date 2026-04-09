import { Router } from 'express'
import pool from '../db/connection.js'

const router = Router()

// GET /api/stats — conteggi pubblici + utenti online (last_seen entro 3 minuti)
router.get('/', async (_req, res) => {
  try {
    const [[{ users }]]    = await pool.query('SELECT COUNT(*) AS users FROM users')
    const [[{ monsters }]] = await pool.query('SELECT COUNT(*) AS monsters FROM monsters')
    const [[{ surfaces }]] = await pool.query('SELECT COUNT(*) AS surfaces FROM surfaces')
    const [[{ levels }]]   = await pool.query('SELECT COUNT(*) AS levels FROM levels')

    const [online] = await pool.query(
      `SELECT id, name, avatar_url AS avatar
       FROM users
       WHERE last_seen >= NOW() - INTERVAL 3 MINUTE
       ORDER BY last_seen DESC`
    )

    res.json({ users, monsters, surfaces, levels, online })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
