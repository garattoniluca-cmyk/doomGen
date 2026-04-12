import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

const THUMB = { theta: 0.5, phi: 0.32, r: 4.5 }
const DEG = Math.PI / 180
const RAD = 180 / Math.PI

function makeMesh(part) {
  const c = (v, min = 0.02) => Math.max(min, v || 0)
  let geo
  switch (part.shape) {
    case 'sphere':   geo = new THREE.SphereGeometry(c(part.r, 0.05), 16, 12); break
    case 'cylinder': geo = new THREE.CylinderGeometry(c(part.r, 0.05), c(part.r, 0.05), c(part.h, 0.05), 14); break
    case 'cone':     geo = new THREE.ConeGeometry(c(part.r, 0.05), c(part.h, 0.05), 14); break
    default:         geo = new THREE.BoxGeometry(c(part.w, 0.05), c(part.h, 0.05), c(part.d, 0.05))
  }
  const mat  = new THREE.MeshLambertMaterial({ color: part.color || '#cc2200' })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(part.x || 0, part.y || 0, part.z || 0)
  mesh.rotation.set((part.rx||0)*DEG, (part.ry||0)*DEG, (part.rz||0)*DEG)
  mesh.castShadow = true
  mesh.userData.partId = part.id
  mesh.userData.shape  = part.shape || 'box'
  return mesh
}

function addOutline(mesh) {
  const edges = new THREE.EdgesGeometry(mesh.geometry)
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff6600 }))
  line.scale.setScalar(1.06)
  line.userData.isOutline = true
  mesh.add(line)
}

function removeOutline(mesh) {
  const o = mesh.children.find(c => c.userData.isOutline)
  if (o) { o.geometry.dispose(); o.material.dispose(); mesh.remove(o) }
}

// Legge le dimensioni finali dalla mesh dopo un'operazione di scale
function extractDimsFromScale(mesh) {
  const sc = mesh.scale
  if (sc.x === 1 && sc.y === 1 && sc.z === 1) return {}
  const shape  = mesh.userData.shape
  const params = mesh.geometry.parameters
  const round  = v => Math.max(0.02, parseFloat(v.toFixed(4)))
  let dims = {}
  if (shape === 'box') {
    dims = { w: round(params.width * sc.x), h: round(params.height * sc.y), d: round(params.depth * sc.z) }
  } else if (shape === 'sphere') {
    dims = { r: round(params.radius * ((sc.x + sc.y + sc.z) / 3)) }
  } else if (shape === 'cylinder') {
    dims = { r: round(params.radiusTop * ((sc.x + sc.z) / 2)), h: round(params.height * sc.y) }
  } else if (shape === 'cone') {
    dims = { r: round(params.radius * ((sc.x + sc.z) / 2)), h: round(params.height * sc.y) }
  }
  mesh.scale.set(1, 1, 1)
  return dims
}

// ── Overlay builders ──────────────────────────────────────────────────────────
function makeCircleLine(radius, color, y = 0.05, segments = 64) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius))
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false })
  )
}

function makeFovSector(radius, fovDeg, color, y = 0.05) {
  const half = (fovDeg / 2) * DEG
  const segs = Math.max(8, Math.round(fovDeg / 2))
  const pts  = [new THREE.Vector3(0, y, 0)]
  for (let i = 0; i <= segs; i++) {
    const a = -half + (i / segs) * fovDeg * DEG
    pts.push(new THREE.Vector3(Math.sin(a) * radius, y, -Math.cos(a) * radius))
  }
  pts.push(new THREE.Vector3(0, y, 0))
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false })
  )
}

function buildOverlays(stats) {
  const group = new THREE.Group()
  if (!stats) return group
  const { sight_range = 10, fov_angle = 90, attack_range = 2,
          attack_type = 'melee', ranged_range = 15 } = stats

  // FOV / sight range (blue)
  if (fov_angle >= 359) {
    group.add(makeCircleLine(sight_range, 0x4499ff))
  } else {
    group.add(makeFovSector(sight_range, fov_angle, 0x4499ff))
  }

  // Melee range (orange)
  group.add(makeCircleLine(attack_range, 0xff8800, 0.06))

  // Ranged range (cyan, only when mixed and larger)
  if (attack_type === 'mixed' && ranged_range > attack_range) {
    group.add(makeCircleLine(ranged_range, 0x44aadd, 0.07))
  }

  return group
}

export default function MonsterViewer({
  geometry, onThumbnailCapture,
  selectedPartId, onPartSelect, onPartTransform,
  transformMode = 'translate', transformSpace = 'world',
  stats = null,
}) {
  const mountRef          = useRef(null)
  const ctx               = useRef({})
  const meshMapRef        = useRef({})
  const onPartSelectRef    = useRef(onPartSelect)
  const onPartTransformRef = useRef(onPartTransform)
  const selectedPartIdRef  = useRef(selectedPartId)
  useEffect(() => { onPartSelectRef.current   = onPartSelect   }, [onPartSelect])
  useEffect(() => { onPartTransformRef.current = onPartTransform }, [onPartTransform])
  useEffect(() => { selectedPartIdRef.current  = selectedPartId  }, [selectedPartId])

  // ── Main setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    const W  = el.clientWidth  || 600
    const H  = el.clientHeight || 400

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    el.appendChild(renderer.domElement)
    const canvas = renderer.domElement

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#3a7aaa')
    scene.fog = new THREE.Fog('#3a7aaa', 18, 40)
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 200)

    scene.add(new THREE.AmbientLight('#aaccee', 1.2))
    const sun = new THREE.DirectionalLight('#ffffff', 2.0)
    sun.position.set(5, 10, 6); sun.castShadow = true; scene.add(sun)
    const fill = new THREE.DirectionalLight('#ffddaa', 0.5)
    fill.position.set(-4, 3, -3); scene.add(fill)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: '#2d6a2d' }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
    scene.add(new THREE.GridHelper(30, 30, '#1a4a1a', '#1a4a1a'))

    const group = new THREE.Group()
    scene.add(group)

    const overlayGroup = new THREE.Group()
    scene.add(overlayGroup)

    // ── TransformControls ───────────────────────────────────────────────────
    const tc = new TransformControls(camera, canvas)
    tc.space = 'world'
    tc.mode  = 'translate'
    scene.add(tc)

    // Orbit lock mentre si usa il gizmo
    tc.addEventListener('dragging-changed', e => { orbit.locked = Boolean(e.value) })

    // Commit transform al rilascio del gizmo
    tc.addEventListener('mouseUp', () => {
      const mesh = tc.object
      if (!mesh || !onPartTransformRef.current) return
      const partId = mesh.userData.partId
      if (!partId) return
      const p = mesh.position, rot = mesh.rotation
      const round2 = v => parseFloat(v.toFixed(4))
      const update = {
        x: round2(p.x), y: round2(p.y), z: round2(p.z),
        rx: round2(rot.x * RAD), ry: round2(rot.y * RAD), rz: round2(rot.z * RAD),
        ...extractDimsFromScale(mesh),
      }
      onPartTransformRef.current(partId, update)
    })

    // ── Orbit ───────────────────────────────────────────────────────────────
    const orbit = { theta: THUMB.theta, phi: THUMB.phi, r: THUMB.r, dragging: false, lx: 0, ly: 0, sx: 0, sy: 0, locked: false }

    const handleMouseDown = e => {
      orbit.dragging = true
      orbit.lx = e.clientX; orbit.ly = e.clientY
      orbit.sx = e.clientX; orbit.sy = e.clientY
    }
    const handleMouseMove = e => {
      if (!orbit.dragging || orbit.locked) return
      orbit.theta -= (e.clientX - orbit.lx) * 0.008
      orbit.phi    = Math.max(0.04, Math.min(1.45, orbit.phi + (e.clientY - orbit.ly) * 0.008))
      orbit.lx = e.clientX; orbit.ly = e.clientY
    }
    const handleMouseUp = e => {
      const wasDragging = orbit.dragging
      orbit.dragging = false
      if (orbit.locked) return  // il gizmo stava gestendo questo evento
      if (!onPartSelectRef.current) return
      const dist = Math.hypot(e.clientX - orbit.sx, e.clientY - orbit.sy)
      if (dist > 20) return

      camera.updateMatrixWorld()
      const rect = canvas.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        -((e.clientY - rect.top) / rect.height) *  2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const meshes = group.children.filter(c => c.isMesh)
      const hits = raycaster.intersectObjects(meshes, false)
      if (hits.length > 0) {
        const partId = hits[0].object.userData.partId
        if (partId) onPartSelectRef.current(partId)
      }
    }
    const handleWheel      = e => { orbit.r = Math.max(1.2, Math.min(12, orbit.r + e.deltaY * 0.005)) }
    const handleMouseLeave = () => { orbit.dragging = false }

    canvas.addEventListener('mousedown',  handleMouseDown)
    canvas.addEventListener('mousemove',  handleMouseMove)
    canvas.addEventListener('mouseup',    handleMouseUp)
    canvas.addEventListener('wheel',      handleWheel,      { passive: true })
    canvas.addEventListener('mouseleave', handleMouseLeave)

    // ── Render loop ──────────────────────────────────────────────────────────
    let raf
    const animate = () => {
      raf = requestAnimationFrame(animate)
      camera.position.set(
        orbit.r * Math.sin(orbit.theta) * Math.cos(orbit.phi),
        orbit.r * Math.sin(orbit.phi),
        orbit.r * Math.cos(orbit.theta) * Math.cos(orbit.phi)
      )
      camera.lookAt(0, 0.9, 0)
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!el) return
      const w = el.clientWidth, h = el.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    requestAnimationFrame(onResize)

    ctx.current = { renderer, scene, camera, group, overlayGroup, orbit, tc, el }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('mousedown',  handleMouseDown)
      canvas.removeEventListener('mousemove',  handleMouseMove)
      canvas.removeEventListener('mouseup',    handleMouseUp)
      canvas.removeEventListener('wheel',      handleWheel)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      tc.detach(); tc.dispose(); scene.remove(tc)
      group.children.slice().forEach(c => { c.geometry?.dispose(); c.material?.dispose() })
      overlayGroup.children.slice().forEach(c => { c.geometry?.dispose(); c.material?.dispose() })
      renderer.dispose()
      if (el.contains(canvas)) el.removeChild(canvas)
    }
  }, [])

  // ── Sync transformMode / transformSpace ─────────────────────────────────────
  useEffect(() => {
    const { tc } = ctx.current
    if (!tc) return
    tc.mode  = transformMode
    tc.space = transformSpace
  }, [transformMode, transformSpace])

  // ── Rebuild meshes ──────────────────────────────────────────────────────────
  useEffect(() => {
    const { group, renderer, scene, camera, el } = ctx.current
    if (!group) return

    group.children.slice().forEach(c => { c.geometry?.dispose(); c.material?.dispose(); group.remove(c) })
    meshMapRef.current = {}

    if (geometry?.parts?.length) {
      geometry.parts.forEach(part => {
        const mesh = makeMesh(part)
        group.add(mesh)
        meshMapRef.current[part.id] = mesh
      })
    }

    if (onThumbnailCapture) {
      setTimeout(() => {
        if (!renderer || !el) return
        const W = el.clientWidth, H = el.clientHeight
        const savedPos = camera.position.clone(), savedAspect = camera.aspect
        // Temporarily remove outline for clean thumbnail
        const selId = selectedPartIdRef.current
        const selMesh = selId ? meshMapRef.current[selId] : null
        if (selMesh) removeOutline(selMesh)
        camera.aspect = 160 / 120; camera.updateProjectionMatrix()
        camera.position.set(
          THUMB.r * Math.sin(THUMB.theta) * Math.cos(THUMB.phi),
          THUMB.r * Math.sin(THUMB.phi),
          THUMB.r * Math.cos(THUMB.theta) * Math.cos(THUMB.phi)
        )
        camera.lookAt(0, 0.9, 0)
        renderer.setSize(160, 120, false)
        renderer.render(scene, camera)
        const src = renderer.domElement.toDataURL('image/jpeg', 0.85)
        // Restore outline and viewport
        if (selMesh) addOutline(selMesh)
        renderer.setSize(W, H, false)
        camera.position.copy(savedPos); camera.aspect = savedAspect; camera.updateProjectionMatrix()
        onThumbnailCapture(src)
      }, 150)
    }
  }, [geometry, onThumbnailCapture])

  // ── Rebuild stat overlays (FOV cone, melee/ranged range circles) ───────────
  useEffect(() => {
    const { overlayGroup } = ctx.current
    if (!overlayGroup) return
    overlayGroup.children.slice().forEach(c => { c.geometry?.dispose(); c.material?.dispose(); overlayGroup.remove(c) })
    const built = buildOverlays(stats)
    built.children.slice().forEach(c => { overlayGroup.add(c) })
  }, [stats])

  // ── Selezione highlight + attach TransformControls ──────────────────────────
  useEffect(() => {
    const { tc } = ctx.current
    const map = meshMapRef.current
    Object.values(map).forEach(mesh => removeOutline(mesh))

    if (selectedPartId && map[selectedPartId]) {
      addOutline(map[selectedPartId])
      if (tc) tc.attach(map[selectedPartId])
    } else {
      if (tc) tc.detach()
    }
  }, [selectedPartId, geometry])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
