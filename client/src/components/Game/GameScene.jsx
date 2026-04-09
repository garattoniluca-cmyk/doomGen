import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { SoundEngine } from './sounds.js'
import PauseMenu from './PauseMenu.jsx'

// ── Canvas texture helpers ──────────────────────────────────────────────────

// ── Seeded pseudo-random (reproducible textures) ─────────────────────────────
function seededRng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

// ── Hell stone wall texture ───────────────────────────────────────────────────
// Dark red volcanic stone blocks with glowing lava cracks
function makeHellWallTexture() {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')
  const rng = seededRng(42)

  // Base: very dark red-black volcanic rock
  ctx.fillStyle = '#1a0604'
  ctx.fillRect(0, 0, 128, 128)

  // Stone blocks (3 rows, alternating offset)
  const blockColors = ['#2a0c06', '#240a05', '#1e0804', '#280b06']
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : 32
    for (let col = 0; col < 5; col++) {
      const bx = col * 42 + offset - 10
      const by = row * 32 + 1
      const bw = 40
      const bh = 29
      ctx.fillStyle = blockColors[Math.floor(rng() * blockColors.length)]
      ctx.fillRect(bx, by, bw, bh)
      // Subtle surface variation (lighter top edge)
      ctx.fillStyle = 'rgba(255,60,0,0.04)'
      ctx.fillRect(bx, by, bw, 3)
      // Random surface crack marks
      if (rng() > 0.55) {
        ctx.strokeStyle = 'rgba(80,10,0,0.6)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(bx + rng() * bw, by + rng() * bh)
        ctx.lineTo(bx + rng() * bw, by + rng() * bh)
        ctx.stroke()
      }
    }
  }

  // Mortar/grout lines — near black
  ctx.fillStyle = '#090201'
  for (let row = 0; row < 4; row++) {
    ctx.fillRect(0, row * 32, 128, 2)
  }

  // Glowing lava crack running diagonally
  ctx.save()
  ctx.shadowColor = '#ff3300'
  ctx.shadowBlur = 6
  ctx.strokeStyle = '#cc1100'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(30, 0)
  ctx.lineTo(35, 28)
  ctx.lineTo(28, 55)
  ctx.lineTo(33, 88)
  ctx.lineTo(30, 128)
  ctx.stroke()
  // Second smaller crack
  ctx.strokeStyle = '#991100'
  ctx.lineWidth = 0.7
  ctx.shadowBlur = 3
  ctx.beginPath()
  ctx.moveTo(90, 0)
  ctx.lineTo(88, 40)
  ctx.lineTo(92, 75)
  ctx.lineTo(90, 128)
  ctx.stroke()
  ctx.restore()

  // Ember glow dots near cracks
  for (let i = 0; i < 8; i++) {
    const ex = 28 + rng() * 12
    const ey = rng() * 128
    ctx.save()
    ctx.shadowColor = '#ff4400'
    ctx.shadowBlur = 4
    ctx.fillStyle = '#ff2200'
    ctx.fillRect(ex | 0, ey | 0, 1, 1)
    ctx.restore()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// ── Hell floor texture ────────────────────────────────────────────────────────
// Dark volcanic flagstones with lava seams glowing orange-red
function makeHellFloorTexture() {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')
  const rng = seededRng(77)

  // Base: dark volcanic rock
  ctx.fillStyle = '#120403'
  ctx.fillRect(0, 0, 128, 128)

  // Irregular flagstone tiles
  const stoneColors = ['#1c0705', '#180604', '#200806', '#1a0604']
  const tiles = [
    [0,0,60,60], [63,0,62,60], [0,63,40,62], [42,63,44,62], [88,63,38,62],
    [65,0,30,30], [97,0,30,30], [65,32,62,28],
    [0,0,38,30], [40,0,22,30], [0,32,38,28],
  ]
  tiles.forEach(([x,y,w,h]) => {
    ctx.fillStyle = stoneColors[Math.floor(rng() * stoneColors.length)]
    ctx.fillRect(x+1, y+1, w-2, h-2)
    // Darker inner shadow at edges
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(x+1, y+1, w-2, 3)
    ctx.fillRect(x+1, y+1, 3, h-2)
  })

  // Lava seam lines between stones
  ctx.save()
  ctx.shadowColor = '#ff5500'
  ctx.shadowBlur = 5
  ctx.strokeStyle = '#dd2200'
  ctx.lineWidth = 1.5
  // Horizontal seams
  ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(128, 62); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(62, 0); ctx.lineTo(62, 60); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(41, 62); ctx.lineTo(41, 128); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(87, 62); ctx.lineTo(87, 128); ctx.stroke()
  // Smaller seam variation
  ctx.strokeStyle = '#aa1800'
  ctx.shadowBlur = 2
  ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(38, 32); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(40, 60); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(65, 32); ctx.lineTo(128, 32); ctx.stroke()
  ctx.restore()

  // Ember / ash specks
  for (let i = 0; i < 20; i++) {
    const ex = rng() * 128 | 0
    const ey = rng() * 128 | 0
    ctx.save()
    ctx.shadowColor = rng() > 0.5 ? '#ff4400' : '#ff8800'
    ctx.shadowBlur = 3
    ctx.fillStyle = rng() > 0.5 ? '#ff3300' : '#cc1100'
    ctx.fillRect(ex, ey, 1, 1)
    ctx.restore()
  }

  // Rock surface noise
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  for (let i = 0; i < 80; i++) {
    ctx.fillRect(rng() * 128 | 0, rng() * 128 | 0, rng() * 3 + 1 | 0, 1)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 6)
  return tex
}

// ── Hell ceiling texture ──────────────────────────────────────────────────────
// Dark cave rock with red-black volcanic veins
function makeHellCeilTexture() {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const ctx = c.getContext('2d')
  const rng = seededRng(99)

  // Base: near-black cave ceiling
  ctx.fillStyle = '#0e0303'
  ctx.fillRect(0, 0, 64, 64)

  // Rock texture patches (slightly different dark reds)
  const ceilColors = ['#130404', '#110303', '#150505', '#0f0302']
  for (let i = 0; i < 18; i++) {
    const x = rng() * 64 | 0
    const y = rng() * 64 | 0
    const w = (rng() * 18 + 8) | 0
    const h = (rng() * 10 + 5) | 0
    ctx.fillStyle = ceilColors[Math.floor(rng() * ceilColors.length)]
    ctx.fillRect(x, y, w, h)
  }

  // Faint dark-red mineral veins
  ctx.save()
  ctx.strokeStyle = 'rgba(120,10,0,0.35)'
  ctx.lineWidth = 0.8
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(rng() * 64, rng() * 64)
    ctx.lineTo(rng() * 64, rng() * 64)
    ctx.stroke()
  }
  ctx.restore()

  // Very faint ember glow (distant lava below reflected on ceiling)
  ctx.save()
  ctx.shadowColor = '#ff2200'
  ctx.shadowBlur = 8
  ctx.fillStyle = 'rgba(150,20,0,0.08)'
  ctx.fillRect(20, 20, 24, 24)
  ctx.restore()

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(7, 7)
  return tex
}

// ── Level builder ───────────────────────────────────────────────────────────

function buildLevel(scene, brickTex) {
  // Main walls: full hellstone color
  const wallMat = new THREE.MeshLambertMaterial({ map: brickTex })
  // Dark walls: slightly more shadowed red-black
  const darkWallMat = new THREE.MeshLambertMaterial({
    map: brickTex, color: new THREE.Color(0.55, 0.25, 0.2)
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
      new THREE.MeshLambertMaterial({ color: 0x2a0c06 })
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
    scene.background = new THREE.Color(0x0e0303)
    scene.fog = new THREE.FogExp2(0x0e0303, 0.058)

    // ── Camera ───────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.05, 80)
    camera.rotation.order = 'YXZ'

    // ── Renderer ─────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    // ── Lights — hellfire palette ────────────────────────────────
    // Dim red-orange ambient: everything tinted blood-red
    scene.add(new THREE.AmbientLight(0x661108, 4.0))

    // Central lava glow — intense orange-red
    const torch1 = new THREE.PointLight(0xff3300, 5.0, 20)
    torch1.position.set(0, 2.5, 0)
    scene.add(torch1)

    // Far corner torches — deep red
    const torch2 = new THREE.PointLight(0xdd2200, 3.5, 16)
    torch2.position.set(-6, 2.4, -6)
    scene.add(torch2)

    // Opposite corner — slightly more orange for variety
    const torch3 = new THREE.PointLight(0xff4400, 3.0, 16)
    torch3.position.set(7, 2.4, 6)
    scene.add(torch3)

    // Fill lights — warm hellfire tones, no blue
    const fill1 = new THREE.PointLight(0xff2200, 2.8, 14)
    fill1.position.set(6, 2.4, -6)
    scene.add(fill1)

    const fill2 = new THREE.PointLight(0xee3300, 2.5, 14)
    fill2.position.set(-7, 2.4, 5)
    scene.add(fill2)

    const fill3 = new THREE.PointLight(0xff5500, 2.2, 14)
    fill3.position.set(0, 2.4, -7)
    scene.add(fill3)

    // ── Floor ────────────────────────────────────────────────────
    const floorTex = makeHellFloorTexture()
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshLambertMaterial({ map: floorTex })
    )
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.receiveShadow = true
    scene.add(floorMesh)

    // ── Ceiling ──────────────────────────────────────────────────
    const ceilTex = makeHellCeilTexture()
    const ceilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshLambertMaterial({ map: ceilTex })
    )
    ceilMesh.rotation.x = Math.PI / 2
    ceilMesh.position.y = 3
    scene.add(ceilMesh)

    // ── Level geometry ───────────────────────────────────────────
    const hellWallTex = makeHellWallTexture()
    hellWallTex.repeat.set(2, 1)
    buildLevel(scene, hellWallTex)

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
