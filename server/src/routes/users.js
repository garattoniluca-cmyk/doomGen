import { Router } from 'express'
import pool from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/users/me/content — tutti i contenuti dell'utente loggato
router.get('/me/content', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id
    const [[monsters], [surfaces], [levels]] = await Promise.all([
      pool.query('SELECT * FROM monsters WHERE user_id = ? ORDER BY created_at DESC', [uid]),
      pool.query('SELECT * FROM surfaces WHERE user_id = ? ORDER BY created_at DESC', [uid]),
      pool.query('SELECT id, name, description, created_at FROM levels WHERE user_id = ? ORDER BY created_at DESC', [uid]),
    ])
    res.json({ monsters, surfaces, levels })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
