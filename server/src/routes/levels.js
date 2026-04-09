import { Router } from 'express'
import pool from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { generateLevel } from '../services/generator.js'

const router = Router()

router.post('/generate', (_req, res) => {
  res.json(generateLevel())
})

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id,name,description,created_at FROM levels WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM levels WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Non trovato' })
    const l = rows[0]
    l.grid = typeof l.grid === 'string' ? JSON.parse(l.grid) : l.grid
    res.json(l)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, grid } = req.body
    const [result] = await pool.query(
      'INSERT INTO levels (user_id,name,description,grid) VALUES (?,?,?,?)',
      [req.user.id, name, description, JSON.stringify(grid)]
    )
    res.status(201).json({ id: result.insertId, name, description })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM levels WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
