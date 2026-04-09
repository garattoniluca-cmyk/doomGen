import { Router } from 'express'
import pool from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { generateSurface } from '../services/generator.js'

const router = Router()

router.post('/generate', (req, res) => {
  const { type } = req.body ?? {}
  res.json(generateSurface({ type }))
})

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM surfaces WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, surface_type, primary_color, secondary_color, pattern, mood } = req.body
    const [result] = await pool.query(
      `INSERT INTO surfaces (user_id,name,surface_type,primary_color,secondary_color,pattern,mood)
       VALUES (?,?,?,?,?,?,?)`,
      [req.user.id, name, surface_type, primary_color, secondary_color, pattern, mood]
    )
    res.status(201).json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM surfaces WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
