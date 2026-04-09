import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

// Fixed thumbnail camera params (always the same angle)
const THUMB = { theta: 0.5, phi: 0.32, r: 4.5 }

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
  mesh.rotation.set(
    ((part.rx || 0) * Math.PI) / 180,
    ((part.ry || 0) * Math.PI) / 180,
    ((part.rz || 0) * Math.PI) / 180
  )
  mesh.castShadow = true
  return mesh
}

export default function MonsterViewer({ geometry, onThumbnailCapture }) {
  const mountRef = useRef(null)
  const ctx = useRef({})

  useEffect(() => {
    const el = mountRef.current
    const W = el.clientWidth || 600
    const H = el.clientHeight || 400

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    el.appendChild(renderer.domElement)

    // ── Scene ──
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#3a7aaa')   // azzurro
    scene.fog = new THREE.Fog('#3a7aaa', 18, 40)

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 200)

    // ── Lights ──
    scene.add(new THREE.AmbientLight('#aaccee', 1.2))
    const sun = new THREE.DirectionalLight('#ffffff', 2.0)
    sun.position.set(5, 10, 6)
    sun.castShadow = true
    scene.add(sun)
    const fill = new THREE.DirectionalLight('#ffddaa', 0.5)
    fill.position.set(-4, 3, -3)
    scene.add(fill)

    // ── Floor (verde grande) ──
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshLambertMaterial({ color: '#2d6a2d' })
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // ── Grid ──
    scene.add(new THREE.GridHelper(30, 30, '#1a4a1a', '#1a4a1a'))

    // ── Monster group ──
    const group = new THREE.Group()
    scene.add(group)

    // ── Orbit state ──
    const orbit = { theta: THUMB.theta, phi: THUMB.phi, r: THUMB.r, dragging: false, lx: 0, ly: 0 }

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

    ctx.current = { renderer, scene, camera, group, orbit, el }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      group.children.slice().forEach(c => { c.geometry?.dispose(); c.material?.dispose() })
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // Rebuild monster on geometry change
  useEffect(() => {
    const { group, renderer, scene, camera, el } = ctx.current
    if (!group) return

    group.children.slice().forEach(c => { c.geometry?.dispose(); c.material?.dispose(); group.remove(c) })
    if (geometry?.parts?.length) {
      geometry.parts.forEach(part => group.add(makeMesh(part)))
    }

    // Capture thumbnail from FIXED angle (always same position)
    if (onThumbnailCapture) {
      setTimeout(() => {
        if (!renderer || !el) return

        const W = el.clientWidth, H = el.clientHeight

        // Save current camera state
        const savedPos = camera.position.clone()
        const savedAspect = camera.aspect

        // Set fixed thumbnail camera
        camera.aspect = 160 / 120
        camera.updateProjectionMatrix()
        camera.position.set(
          THUMB.r * Math.sin(THUMB.theta) * Math.cos(THUMB.phi),
          THUMB.r * Math.sin(THUMB.phi),
          THUMB.r * Math.cos(THUMB.theta) * Math.cos(THUMB.phi)
        )
        camera.lookAt(0, 0.9, 0)

        // Render at thumbnail size
        renderer.setSize(160, 120, false)
        renderer.render(scene, camera)
        const src = renderer.domElement.toDataURL('image/jpeg', 0.85)

        // Restore main renderer
        renderer.setSize(W, H, false)
        camera.position.copy(savedPos)
        camera.aspect = savedAspect
        camera.updateProjectionMatrix()

        onThumbnailCapture(src)
      }, 150)
    }
  }, [geometry, onThumbnailCapture])

  // ── Orbit controls (vertical INVERTED) ──
  const onDown  = useCallback(e => { const o = ctx.current.orbit; if (o) { o.dragging = true; o.lx = e.clientX; o.ly = e.clientY } }, [])
  const onMove  = useCallback(e => {
    const o = ctx.current.orbit
    if (!o?.dragging) return
    o.theta -= (e.clientX - o.lx) * 0.008
    o.phi    = Math.max(0.04, Math.min(1.45, o.phi + (e.clientY - o.ly) * 0.008)) // + = inverted
    o.lx = e.clientX; o.ly = e.clientY
  }, [])
  const onUp    = useCallback(() => { const o = ctx.current.orbit; if (o) o.dragging = false }, [])
  const onWheel = useCallback(e => { const o = ctx.current.orbit; if (o) o.r = Math.max(1.2, Math.min(12, o.r + e.deltaY * 0.005)) }, [])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', cursor: 'grab' }}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onWheel={onWheel}
    />
  )
}
