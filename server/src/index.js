import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDB } from './db/schema.js'
import authRouter    from './routes/auth.js'
import monstersRouter from './routes/monsters.js'
import surfacesRouter from './routes/surfaces.js'
import levelsRouter  from './routes/levels.js'
import suppliesRouter from './routes/supplies.js'
import aiRouter      from './routes/ai.js'
import adminRouter   from './routes/admin.js'
import usersRouter   from './routes/users.js'
import statsRouter   from './routes/stats.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth',     authRouter)
app.use('/api/monsters', monstersRouter)
app.use('/api/surfaces', surfacesRouter)
app.use('/api/levels',   levelsRouter)
app.use('/api/supplies', suppliesRouter)
app.use('/api/ai',      aiRouter)
app.use('/api/admin',    adminRouter)
app.use('/api/users',    usersRouter)
app.use('/api/stats',    statsRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))

// Init DB then start server
initDB()
  .then(() => app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`)))
  .catch(err => { console.error('[server] Impossibile avviare:', err.message); process.exit(1) })
