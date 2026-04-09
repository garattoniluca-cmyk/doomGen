import { Router } from 'express'
import pool from '../db/connection.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { generateMonster } from '../services/generator.js'

const router = Router()

// Generate (no auth required)
router.post('/generate', (req, res) => {
  const { name, behavior } = req.body ?? {}
  res.json(generateMonster({ name, behavior }))
})

// List user's monsters
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM monsters WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(rows.map(r => ({
      ...r,
      resistances:     typeof r.resistances     === 'string' ? JSON.parse(r.resistances)     : r.resistances     ?? [],
      special_attacks: typeof r.special_attacks === 'string' ? JSON.parse(r.special_attacks) : r.special_attacks ?? [],
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Save monster
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, health, speed, damage, behavior, resistances, appearance, special_attacks, lore } = req.body
    const [result] = await pool.query(
      `INSERT INTO monsters (user_id,name,health,speed,damage,behavior,resistances,appearance,special_attacks,lore)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, name, health, speed, damage, behavior,
       JSON.stringify(resistances ?? []), appearance,
       JSON.stringify(special_attacks ?? []), lore]
    )
    res.status(201).json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete (own only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM monsters WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
