import { Router } from 'express'
import pool from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const parseJ = (val, fallback) => {
  if (val == null) return fallback
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return fallback }
}

// GET /api/monsters — list user's monsters
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, health, speed, damage, behavior, sight_range, attack_range,
              resistances, geometry, sounds, thumbnail, lore, created_at,
              move_type, rotate_speed, fov_angle, hp_regen, hp_regen_rate,
              attack_type, melee_rate, ranged_range, ranged_damage, ranged_rate
       FROM monsters WHERE user_id = ? AND active = 1 ORDER BY created_at DESC`,
      [req.user.id]
    )
    res.json(rows.map(r => ({
      ...r,
      resistances:   parseJ(r.resistances, {}),
      geometry:      parseJ(r.geometry, null),
      sounds:        parseJ(r.sounds, null),
      move_type:     r.move_type || 'walk',
      rotate_speed:  r.rotate_speed ?? 90,
      fov_angle:     r.fov_angle ?? 90,
      hp_regen:      r.hp_regen ?? 0,
      hp_regen_rate: r.hp_regen_rate ?? 0,
      attack_type:   r.attack_type || 'melee',
      melee_rate:    r.melee_rate ?? 1,
      ranged_range:  r.ranged_range ?? 15,
      ranged_damage: r.ranged_damage ?? 15,
      ranged_rate:   r.ranged_rate ?? 0.5,
      hover_height:  r.hover_height ?? 1.5,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/monsters/:id — single monster
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT * FROM monsters WHERE id = ? AND user_id = ? AND active = 1',
      [req.params.id, req.user.id]
    )
    if (!row) return res.status(404).json({ error: 'Non trovato' })
    res.json({
      ...row,
      resistances:   parseJ(row.resistances, {}),
      geometry:      parseJ(row.geometry, null),
      sounds:        parseJ(row.sounds, null),
      move_type:     row.move_type || 'walk',
      rotate_speed:  row.rotate_speed ?? 90,
      fov_angle:     row.fov_angle ?? 90,
      hp_regen:      row.hp_regen ?? 0,
      hp_regen_rate: row.hp_regen_rate ?? 0,
      attack_type:   row.attack_type || 'melee',
      melee_rate:    row.melee_rate ?? 1,
      ranged_range:  row.ranged_range ?? 15,
      ranged_damage: row.ranged_damage ?? 15,
      ranged_rate:   row.ranged_rate ?? 0.5,
      hover_height:  row.hover_height ?? 1.5,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/monsters — create
router.post('/', requireAuth, async (req, res) => {
  const { name, health, speed, damage, behavior, sight_range, attack_range,
          resistances, geometry, sounds, thumbnail, lore,
          move_type, rotate_speed, fov_angle, hp_regen, hp_regen_rate,
          attack_type, melee_rate, ranged_range, ranged_damage, ranged_rate,
          hover_height } = req.body
  try {
    const [result] = await pool.query(
      `INSERT INTO monsters
         (user_id, name, health, speed, damage, behavior, sight_range, attack_range,
          resistances, geometry, sounds, thumbnail, lore,
          move_type, rotate_speed, fov_angle, hp_regen, hp_regen_rate,
          attack_type, melee_rate, ranged_range, ranged_damage, ranged_rate,
          hover_height)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, name||'Senza nome',
       health||100, speed||5, damage||20, behavior||'patrol',
       sight_range||10, attack_range||2,
       JSON.stringify(resistances||{}),
       JSON.stringify(geometry||null),
       JSON.stringify(sounds||null),
       thumbnail||null, lore||null,
       move_type||'walk', rotate_speed??90, fov_angle??90,
       hp_regen??0, hp_regen_rate??0,
       attack_type||'melee', melee_rate??1,
       ranged_range??15, ranged_damage??15, ranged_rate??0.5,
       hover_height??1.5]
    )
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/monsters/:id — update
router.put('/:id', requireAuth, async (req, res) => {
  const { name, health, speed, damage, behavior, sight_range, attack_range,
          resistances, geometry, sounds, thumbnail, lore,
          move_type, rotate_speed, fov_angle, hp_regen, hp_regen_rate,
          attack_type, melee_rate, ranged_range, ranged_damage, ranged_rate,
          hover_height } = req.body
  try {
    const [result] = await pool.query(
      `UPDATE monsters SET
         name=?, health=?, speed=?, damage=?, behavior=?,
         sight_range=?, attack_range=?,
         resistances=?, geometry=?, sounds=?, thumbnail=?, lore=?,
         move_type=?, rotate_speed=?, fov_angle=?, hp_regen=?, hp_regen_rate=?,
         attack_type=?, melee_rate=?, ranged_range=?, ranged_damage=?, ranged_rate=?,
         hover_height=?
       WHERE id=? AND user_id=?`,
      [name||'Senza nome',
       health||100, speed||5, damage||20, behavior||'patrol',
       sight_range||10, attack_range||2,
       JSON.stringify(resistances||{}),
       JSON.stringify(geometry||null),
       JSON.stringify(sounds||null),
       thumbnail||null, lore||null,
       move_type||'walk', rotate_speed??90, fov_angle??90,
       hp_regen??0, hp_regen_rate??0,
       attack_type||'melee', melee_rate??1,
       ranged_range??15, ranged_damage??15, ranged_rate??0.5,
       hover_height??1.5,
       req.params.id, req.user.id]
    )
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/monsters/:id — soft delete (active = 0)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [r] = await pool.query(
      'UPDATE monsters SET active = 0 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Non trovato o non autorizzato' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
