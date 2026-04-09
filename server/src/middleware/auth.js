import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'doomgen_secret'

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Non autenticato' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token non valido o scaduto' })
  }
}

export function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    try { req.user = jwt.verify(token, SECRET) } catch {}
  }
  next()
}

export function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Non autenticato' })
  try {
    const user = jwt.verify(token, SECRET)
    if (!user.isAdmin) return res.status(403).json({ error: 'Accesso negato: richiesto admin' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Token non valido' })
  }
}

export function signToken(user, sessionId) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar: user.avatar_url, isAdmin: !!user.isAdmin, sessionId },
    SECRET,
    { expiresIn: '7d' }
  )
}
