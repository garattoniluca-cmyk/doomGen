import { Router } from 'express'
import pool from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const parseJ = (val, fallback) => {
  if (val == null) return fallback
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return fallback }
}

// GET /api/supplies — list user's supplies
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, geometry, sounds, thumbnail, lore, scale, description, created_at
       FROM supplies WHERE user_id = ? AND active = 1 ORDER BY created_at DESC`,
      [req.user.id]
    )
    res.json(rows.map(r => ({
      ...r,
      geometry: parseJ(r.geometry, null),
      sounds:   parseJ(r.sounds, null),
      scale:    r.scale ?? 1.0,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/supplies/:id — single supply
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT * FROM supplies WHERE id = ? AND user_id = ? AND active = 1',
      [req.params.id, req.user.id]
    )
    if (!row) return res.status(404).json({ error: 'Non trovato' })
    res.json({
      ...row,
      geometry: parseJ(row.geometry, null),
      sounds:   parseJ(row.sounds, null),
      scale:    row.scale ?? 1.0,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/supplies — create
router.post('/', requireAuth, async (req, res) => {
  const { name, geometry, sounds, thumbnail, lore, scale, description, expanded } = req.body
  try {
    const [result] = await pool.query(
      `INSERT INTO supplies (user_id, name, geometry, sounds, thumbnail, lore, scale, description, expanded)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.user.id, name||'Senza nome',
       JSON.stringify(geometry||null),
       JSON.stringify(sounds||null),
       thumbnail||null, lore||null,
       scale ?? 1.0,
       description||null, expanded||null]
    )
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/supplies/:id — update
router.put('/:id', requireAuth, async (req, res) => {
  const { name, geometry, sounds, thumbnail, lore, scale, description, expanded } = req.body
  try {
    const [result] = await pool.query(
      `UPDATE supplies SET
         name=?, geometry=?, sounds=?, thumbnail=?, lore=?, scale=?,
         description=?, expanded=?
       WHERE id=? AND user_id=?`,
      [name||'Senza nome',
       JSON.stringify(geometry||null),
       JSON.stringify(sounds||null),
       thumbnail||null, lore||null,
       scale ?? 1.0,
       description||null, expanded||null,
       req.params.id, req.user.id]
    )
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/supplies/:id — soft delete (active = 0)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [r] = await pool.query(
      'UPDATE supplies SET active = 0 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
