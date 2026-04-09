import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { SoundEngine } from './sounds.js'
import PauseMenu from './PauseMenu.jsx'

// ── Canvas texture helpers ──────────────────────────────────────────────────

function makeBrickTexture() {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#6b4e32'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#4a3020'
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : 16
    for (let col = 0; col < 5; col++) {
      ctx.fillRect(col * 32 + offset - 1, row * 16 + 1, 30, 13)
    }
  }
  ctx.strokeStyle = '#3a2010'
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) { ctx.strokeRect(i * 16, 0, 15, 64) }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function makeFloorTexture() {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#3a2a1a'
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = '#2a1a0a'
  ctx.lineWidth = 1
  for (let i = 0; i <= 64; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke()
  }
  // Noise dots
  ctx.fillStyle = '#2e1e0e'
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(Math.random() * 64 | 0, Math.random() * 64 | 0, 2, 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 8)
  return tex
}

function makeCeilTexture() {
  const c = document.createElement('canvas')
  c.width = 32; c.height = 32
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, 32, 32)
  ctx.fillStyle = '#141414'
  for (let i = 0; i < 15; i++) {
    ctx.fillRect(Math.random() * 32 | 0, Math.random() * 32 | 0, 2, 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 6)
  return tex
}

// ── Level builder ───────────────────────────────────────────────────────────

function buildLevel(scene, brickTex) {
  const wallMat = new THREE.MeshLambertMaterial({ map: brickTex })
  const darkWallMat = new THREE.MeshLambertMaterial({
    map: brickTex, color: new THREE.Color(0.6, 0.5, 0.4)
  })

  const wall = (w, h, d, x, y, z, mat = wallMat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.receiveShadow = true
    scene.add(mesh)
    return mesh
  }

  const H = 3   // wall height
  const HALF_H = H / 2

  // ── Outer boundary 20×20 ────────────────────────────────────────
  wall(20, H, 0.4,   0, HALF_H, -10)   // N
  wall(20, H, 0.4,   0, HALF_H,  10)   // S
  wall(0.4, H, 20,  -10, HALF_H,  0)   // W
  wall(0.4, H, 20,   10, HALF_H,  0)   // E

  // ── Inner rooms ─────────────────────────────────────────────────
  // Central divider with gap
  wall(8, H, 0.4,  -1, HALF_H, -2, darkWallMat)   // left part
  wall(4, H, 0.4,   7, HALF_H, -2, darkWallMat)   // right part

  // Side corridor walls
  wall(0.4, H, 6,  -5, HALF_H,  4, darkWallMat)
  wall(0.4, H, 6,   5, HALF_H,  4, darkWallMat)

  // Alcove
  wall(4, H, 0.4,  7, HALF_H, 5)
  wall(0.4, H, 3, 9, HALF_H, 3.5)

  // ── Pillars ─────────────────────────────────────────────────────
  const pillar = (x, z) => wall(0.9, H, 0.9, x, HALF_H, z)
  pillar(-7, -7); pillar(7, -7)
  pillar(-7,  7); pillar(7,  7)
  pillar(-3, -6); pillar(3, -6)

  // ── Small crates (decorative) ────────────────────────────────────
  const crate = (x, z) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x5a3a18 })
    )
    m.position.set(x, 0.4, z)
    scene.add(m)
  }
  crate(-8.5, -8.5); crate(8.2, -8.5); crate(-8.5, 8.2)
  crate(3, 6); crate(-4, -4)
}

// ── Main component ──────────────────────────────────────────────────────────

export default function GameScene() {
  const navigate = useNavigate()
  const mountRef = useRef(null)
  const [shooting, setShooting] = useState(false)
  const [health] = useState(100)
  const [ammo, setAmmo] = useState(50)
  const [pos, setPos] = useState({ x: 0, z: 3 })
  const [strafeMode, setStrafeMode] = useState(false)
  const [paused, setPaused] = useState(false)

  const shootRef = useRef(false)
  const soundRef = useRef(null)
  const pausedRef = useRef(false)
  const restartRef = useRef(null)

  const triggerShoot = useCallback(() => {
    if (shootRef.current) return
    shootRef.current = true
    soundRef.current?.shoot()
    setShooting(true)
    setAmmo(a => Math.max(0, a - 1))
    setTimeout(() => {
      setShooting(false)
      shootRef.current = false
    }, 90)
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Scene ────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1008)
    scene.fog = new THREE.FogExp2(0x1a1008, 0.055)

    // ── Camera ───────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.05, 80)
    camera.rotation.order = 'YXZ'

    // ── Renderer ─────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    // ── Lights ───────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xaa8866, 3.5))

    const torch1 = new THREE.PointLight(0xff6600, 4.0, 18)
    torch1.position.set(0, 2.5, 0)
    scene.add(torch1)

    const torch2 = new THREE.PointLight(0xff5500, 3.0, 16)
    torch2.position.set(-6, 2.4, -6)
    scene.add(torch2)

    const torch3 = new THREE.PointLight(0x6688ff, 2.5, 16)
    torch3.position.set(7, 2.4, 6)
    scene.add(torch3)

    // Extra fill lights spread across the level
    const fill1 = new THREE.PointLight(0xff7733, 2.5, 14)
    fill1.position.set(6, 2.4, -6)
    scene.add(fill1)

    const fill2 = new THREE.PointLight(0xff6600, 2.5, 14)
    fill2.position.set(-7, 2.4, 5)
    scene.add(fill2)

    const fill3 = new THREE.PointLight(0xffaa44, 2.0, 14)
    fill3.position.set(0, 2.4, -7)
    scene.add(fill3)

    // ── Floor ────────────────────────────────────────────────────
    const floorTex = makeFloorTexture()
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshLambertMaterial({ map: floorTex })
    )
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.receiveShadow = true
    scene.add(floorMesh)

    // ── Ceiling ──────────────────────────────────────────────────
    const ceilTex = makeCeilTexture()
    const ceilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshLambertMaterial({ map: ceilTex })
    )
    ceilMesh.rotation.x = Math.PI / 2
    ceilMesh.position.y = 3
    scene.add(ceilMesh)

    // ── Level geometry ───────────────────────────────────────────
    const brickTex = makeBrickTexture()
    brickTex.repeat.set(2, 1)
    buildLevel(scene, brickTex)

    // ── Gun model (child of camera) ──────────────────────────────
    const gunGroup = new THREE.Group()
    // Body
    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.07, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    )
    // Barrel
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    )
    barrel.position.set(0, 0.02, -0.22)
    gunGroup.add(gunBody, barrel)
    gunGroup.position.set(0.13, -0.12, -0.3)
    camera.add(gunGroup)
    scene.add(camera)

    // Muzzle flash
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    )
    flash.position.set(0, 0.02, -0.34)
    flash.visible = false
    gunGroup.add(flash)

    // ── Player state ─────────────────────────────────────────────
    const player = {
      pos: new THREE.Vector3(0, 1.1, 3),
      yaw: 0,
      speed: 0.075,
      rot: 0.028,
    }
    camera.position.copy(player.pos)
    camera.rotation.y = player.yaw

    // Restart resets player to spawn
    restartRef.current = () => {
      player.pos.set(0, 1.1, 3)
      player.yaw = 0
      Object.keys(keys).forEach(k => { keys[k] = false })
    }

    // ── Input ────────────────────────────────────────────────────
    const keys = {}
    const onKeyDown = e => {
      // ESC toggles pause (handled here so PauseMenu can also handle it)
      if (e.code === 'Escape') {
        e.preventDefault()
        pausedRef.current = !pausedRef.current
        setPaused(p => !p)
        return
      }
      if (pausedRef.current) return
      keys[e.code] = true
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault()
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        e.preventDefault()
        setStrafeMode(true)
      }
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        e.preventDefault()
        triggerShoot()
      }
    }
    const onKeyUp = e => {
      keys[e.code] = false
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') setStrafeMode(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // ── Audio ────────────────────────────────────────────────────
    soundRef.current = new SoundEngine()

    // ── Torchflicker ─────────────────────────────────────────────
    let frame = 0
    let shootCooldown = 0
    let gunBob = 0
    let footstepFrame = 0
    let wallHitCooldown = 0

    // ── Animate ──────────────────────────────────────────────────
    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      frame++

      // Torch flicker
      torch1.intensity = 3.6 + Math.sin(frame * 0.17) * 0.5 + Math.random() * 0.2
      torch2.intensity = 2.6 + Math.sin(frame * 0.23 + 1) * 0.4

      // Shoot cooldown / flash
      shootCooldown = Math.max(0, shootCooldown - 1)
      if (shooting) {
        flash.visible = true
        shootCooldown = 12
        gunGroup.position.z = -0.27
      } else {
        flash.visible = false
        gunGroup.position.z += (-0.3 - gunGroup.position.z) * 0.3
      }

      // Skip movement/sound when paused
      if (pausedRef.current) { renderer.render(scene, camera); return }

      // Movement
      const strafe = keys['ControlLeft'] || keys['ControlRight']
      const moving = keys['ArrowUp'] || keys['ArrowDown'] ||
        (strafe && (keys['ArrowLeft'] || keys['ArrowRight']))
      const fwdX = -Math.sin(player.yaw)
      const fwdZ = -Math.cos(player.yaw)
      const rightX = Math.cos(player.yaw)
      const rightZ = -Math.sin(player.yaw)

      // Save pre-movement position to detect wall collision
      const preX = player.pos.x
      const preZ = player.pos.z

      if (keys['ArrowUp']) {
        player.pos.x += fwdX * player.speed
        player.pos.z += fwdZ * player.speed
      }
      if (keys['ArrowDown']) {
        player.pos.x -= fwdX * player.speed
        player.pos.z -= fwdZ * player.speed
      }
      if (strafe) {
        if (keys['ArrowLeft']) {
          player.pos.x -= rightX * player.speed
          player.pos.z -= rightZ * player.speed
        }
        if (keys['ArrowRight']) {
          player.pos.x += rightX * player.speed
          player.pos.z += rightZ * player.speed
        }
      } else {
        if (keys['ArrowLeft']) player.yaw += player.rot
        if (keys['ArrowRight']) player.yaw -= player.rot
      }

      // Clamp to level bounds + detect wall collision
      const clampedX = Math.max(-9.6, Math.min(9.6, player.pos.x))
      const clampedZ = Math.max(-9.6, Math.min(9.6, player.pos.z))
      const hitWall = (clampedX !== player.pos.x || clampedZ !== player.pos.z) && moving
      player.pos.x = clampedX
      player.pos.z = clampedZ

      // ── Sounds ───────────────────────────────────────────────
      wallHitCooldown = Math.max(0, wallHitCooldown - 1)
      if (hitWall && wallHitCooldown === 0) {
        soundRef.current?.wallHit()
        wallHitCooldown = 18
      }

      if (moving) {
        footstepFrame++
        if (footstepFrame % 22 === 0) soundRef.current?.footstep()
      } else {
        footstepFrame = 0
      }

      // Head bob
      if (moving) gunBob += 0.12
      const bob = moving ? Math.sin(gunBob) * 0.018 : 0
      camera.position.set(player.pos.x, 1.1 + bob * 0.5, player.pos.z)
      camera.rotation.y = player.yaw

      // Gun sway
      gunGroup.position.y = -0.12 + bob * 0.5
      gunGroup.rotation.z = bob * 0.3

      setPos({ x: player.pos.x.toFixed(1), z: player.pos.z.toFixed(1) })

      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ───────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      renderer.dispose()
      soundRef.current?.dispose()
    }
  }, [triggerShoot])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', userSelect: 'none' }}>
      {/* Three.js canvas */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Pause button */}
      <button
        onClick={() => { pausedRef.current = true; setPaused(true) }}
        style={{
          position: 'absolute', top: 10, left: 10, zIndex: 50,
          background: '#00000088', border: '1px solid #331a00',
          color: '#664422', fontFamily: 'Courier New, monospace',
          fontSize: 11, letterSpacing: 2, padding: '4px 12px',
          cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
        }}
        onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor: '#cc2200', color: '#ff4400' })}
        onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor: '#331a00', color: '#664422' })}
      >
        ⏸ MENU
      </button>

      {/* Pause overlay */}
      {paused && (
        <PauseMenu
          onResume={() => { pausedRef.current = false; setPaused(false) }}
          onRestart={() => { restartRef.current?.(); pausedRef.current = false; setPaused(false) }}
          onHome={() => navigate('/')}
        />
      )}

      {/* Muzzle flash screen flare */}
      {shooting && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 62% 82%, rgba(255,160,0,0.25) 0%, transparent 55%)',
        }} />
      )}

      {/* Crosshair */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        color: shooting ? '#ffaa00' : '#ff440099',
        fontSize: 22, pointerEvents: 'none', lineHeight: 1,
        textShadow: '0 0 6px currentColor',
        transition: 'color 0.05s',
      }}>+</div>

      {/* HUD */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '10px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        background: 'linear-gradient(transparent, #00000099)',
        pointerEvents: 'none',
        fontFamily: 'Courier New, monospace',
      }}>
        <div style={{ color: '#ff4400', textShadow: '0 0 8px #ff4400', fontSize: 18, fontWeight: 'bold' }}>
          ❤ {health}%
        </div>
        <div style={{ color: '#888', fontSize: 11 }}>
          X:{pos.x} Z:{pos.z}
        </div>
        <div style={{ color: '#ffaa00', textShadow: '0 0 8px #ffaa00', fontSize: 18, fontWeight: 'bold' }}>
          AMMO {ammo}
        </div>
      </div>

      {/* Strafe mode indicator */}
      {strafeMode && (
        <div style={{
          position: 'absolute', top: 10, right: 16,
          color: '#ffcc00', fontSize: 12, fontFamily: 'monospace',
          textShadow: '0 0 8px #ffcc00', pointerEvents: 'none', letterSpacing: 2,
        }}>
          ◄ STRAFE ►
        </div>
      )}

      {/* Controls hint */}
      <div style={{
        position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
        color: '#444', fontSize: 11, fontFamily: 'monospace', pointerEvents: 'none',
        letterSpacing: 1,
      }}>
        ↑↓ MUOVI &nbsp;|&nbsp; ←→ RUOTA &nbsp;|&nbsp; ALT SPARA &nbsp;|&nbsp; CTRL+←→ STRAFE
      </div>
    </div>
  )
}
