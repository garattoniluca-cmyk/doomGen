import { Router } from 'express'
import pool from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ── GET all surfaces for current user ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM surfaces WHERE user_id = ? AND active = 1 ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST create new surface ───────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, surface_type, primary_color, secondary_color, pattern, description } = req.body
    if (!name || !surface_type) return res.status(400).json({ error: 'name e surface_type obbligatori' })
    const [result] = await pool.query(
      `INSERT INTO surfaces (user_id, name, surface_type, primary_color, secondary_color, pattern, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, surface_type, primary_color, secondary_color, pattern ?? 'hellstone', description ?? null]
    )
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT update existing surface ───────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, surface_type, primary_color, secondary_color, pattern, description } = req.body
    const [r] = await pool.query(
      `UPDATE surfaces
       SET name=?, surface_type=?, primary_color=?, secondary_color=?, pattern=?, description=?
       WHERE id=? AND user_id=?`,
      [name, surface_type, primary_color, secondary_color, pattern, description ?? null, req.params.id, req.user.id]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE — soft delete (active = 0) ────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [r] = await pool.query(
      'UPDATE surfaces SET active = 0 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
