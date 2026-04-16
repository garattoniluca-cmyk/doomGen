# DoomGen — Context for Claude

## REGOLA ASSOLUTA
**Non creare, modificare o eliminare MAI file al di fuori del task esplicitamente richiesto — inclusi settings, hook, config — senza prima chiedere conferma all'utente.**
Non fare mai `git commit` o `git push` senza richiesta esplicita.

---

Doom 1 clone generativo. Stack: **React + Vite (port 5174)** / **Node/Express (port 3001)** / **MySQL**.
Repo: `C:\doomGen` — branch `main`, push automatico attivo.

---

## Come avviare

```bash
# Backend
cd C:/doomGen/server && node src/index.js &

# Frontend (già configurato in .claude/launch.json)
# preview_start "doomgen-client"
```

## Login dev (senza Google)

```js
// Nel preview eval — userId 3 = Dev Admin (isAdmin: true)
const res = await fetch('/api/auth/dev-login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 3 })
})
const { token } = await res.json()
localStorage.setItem('token', token)
window.location.href = '/admin'
```

> **Importante**: fare `reload()` dopo il set token, non navigare direttamente —
> altrimenti AuthContext non ha tempo di leggere il token prima del mount.

---

## Architettura

```
client/src/
  App.jsx                  → router, useSoundListeners (global hover/click sfx)
  context/AuthContext.jsx  → token in localStorage('token'), heartbeat 30s, idle 15min
  utils/sfx.js             → SoundManager singleton, Web Audio API, no file audio
  utils/api.js             → apiGet/apiPost/apiDelete con Bearer token auto
  components/
    Home/Home.jsx          → hero image + gradient overlay, Metal Mania font
    PageHeader.jsx         → icon prop (img 32x32), SoundToggle a destra
    SoundToggle.jsx        → 🔊/🔇, localStorage('dg_sfx_muted')
    MonsterEditor/
      MonsterEditor.jsx    → lista sx, 3D center, inspector dx; selectedPart bidirezionale
      MonsterViewer.jsx    → Three.js, raycasting click→select, EdgesGeometry outline
    SurfaceEditor/
      SurfaceEditor.jsx    → 7 pattern hell (hellstone/redstone/lava/bone/flesh/metal/solid)
    LevelEditor/
      LevelEditor.jsx      → griglia 2D 20x20 + preview 3D isometrica
    Admin/AdminPanel.jsx   → tabs: Dashboard/Online/Utenti/Mostri/Superfici/Livelli/Attività
    Game/GameScene.jsx     → hell textures procedurali (seededRng), luci rosse, no blu

server/src/
  routes/auth.js           → /google, /me, /heartbeat, /logout, /dev-login (solo dev)
  routes/monsters.js       → CRUD /api/monsters
  routes/surfaces.js       → CRUD /api/surfaces (pattern VARCHAR(50))
  routes/levels.js         → CRUD /api/levels + /generate
  routes/admin.js          → /stats, /online, /users, /monsters, /surfaces, /levels, /activity
  db/schema.js             → auto-create tabelle al boot
  middleware/auth.js       → requireAuth, requireAdmin (JWT)
```

---

## Immagini pubbliche

| File | Dove usato |
|---|---|
| `/hero.png` | Home background |
| `/card-mostri.png` | Home editor card + PageHeader MonsterEditor |
| `/card-superfici.png` | Home editor card + PageHeader SurfaceEditor |
| `/card-livelli.png` | Home editor card + PageHeader LevelEditor |
| `/btn-gioca.png` | Sfondo pulsante GIOCA |
| `/bg-monsters.png` | Background full MonsterEditor (lab teal) |
| `/bg-surfaces.png` | Background full SurfaceEditor (forgia lava) |
| `/bg-levels.png` | Background full LevelEditor (corridoio industriale) |

Sorgenti originali: `C:/Users/rama/Desktop/Gendoom/`

---

## Token CSS (MonsterEditor)

```js
C.bg / C.bgPanel / C.bgInput / C.bgCard / C.bgCardSel
C.txtBright('#ffcc88') / C.txtMain('#cc7744') / C.txtSub('#996644')
C.txtDim('#664433') / C.txtGhost('#3a2010') / C.txtAccent('#ff6633')
C.red('#cc2200') / C.redDim('#881500') / C.redGhost('#441100')
C.border('#261200') / C.borderMed('#3a1800') / C.borderAct('#cc2200')
```

---

## Utenti DB

| id | email | note |
|---|---|---|
| 1 | (Google) | utente reale |
| 2 | (Google) | utente reale |
| 3 | dev@doomgen.local | **Dev Admin** — usa per test |

---

## Regole di stile del progetto

- Tema: **rosso/nero infernale**, font `Courier New` monospace ovunque
- Titolo home: `Metal Mania` (Google Fonts)
- Pannelli semi-trasparenti su sfondi: `rgba(6,4,2,0.88)` sinistra, `rgba(10,7,5,0.90)` destra
- **No emoji** nel codice salvo richiesta esplicita
- Textures procedurali: sempre seededRng `(s * 1664525 + 1013904223) | 0`
- Suoni: Web Audio API puro, zero file audio

---

## Cose da fare / roadmap

- [ ] Integrazione Gemini AI per generazione procedural (mostri, livelli)
- [ ] LevelEditor: persistenza DB (attualmente solo locale)
- [ ] In-game: usare mostri/superfici/livelli dal DB
- [ ] Gizmos di trasformazione nella scena 3D MonsterEditor
- [ ] Admin: tab Attività più dettagliata

---

## Note tecniche importanti

- **Race condition login**: dopo `localStorage.setItem('token', ...)` fare sempre `reload()`,
  non navigare con `href` direttamente — AuthContext legge il token solo al mount.
- **Home top-right bar**: deve avere `zIndex: 10` altrimenti il content panel (zIndex:1) copre i pulsanti.
- **MonsterViewer outline**: usa `EdgesGeometry` scalata a 1.06 con `LineBasicMaterial` arancione.
  Il raycasting esclude le LineSegments (filtra solo `mesh.isMesh`).
- **SurfaceEditor pattern**: `drawPattern()` usa seededRng — non usare `Math.random()` o
  ogni render produce texture diverse.
- **dev-login**: disponibile solo se `NODE_ENV !== 'production'`.
