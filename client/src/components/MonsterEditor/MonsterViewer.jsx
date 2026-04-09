import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

function makeMesh(part) {
  let geo
  const clamp = (v, min = 0.01) => Math.max(min, v || 0)
  switch (part.shape) {
    case 'sphere':
      geo = new THREE.SphereGeometry(clamp(part.r, 0.05), 16, 12)
      break
    case 'cylinder':
      geo = new THREE.CylinderGeometry(clamp(part.r, 0.05), clamp(part.r, 0.05), clamp(part.h, 0.05), 14)
      break
    case 'cone':
      geo = new THREE.ConeGeometry(clamp(part.r, 0.05), clamp(part.h, 0.05), 14)
      break
    default: // box
      geo = new THREE.BoxGeometry(clamp(part.w, 0.05), clamp(part.h, 0.05), clamp(part.d, 0.05))
  }
  const mat = new THREE.MeshLambertMaterial({ color: part.color || '#cc2200' })
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

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#080604')
    scene.fog = new THREE.FogExp2('#080604', 0.06)

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100)

    // Lights
    scene.add(new THREE.AmbientLight('#553322', 1.4))
    const sun = new THREE.DirectionalLight('#ffddaa', 2.2)
    sun.position.set(3, 6, 4)
    sun.castShadow = true
    scene.add(sun)
    const rim = new THREE.DirectionalLight('#cc2200', 0.7)
    rim.position.set(-4, 1, -3)
    scene.add(rim)

    // Floor
    scene.add(new THREE.GridHelper(6, 16, '#1a0800', '#100400'))
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3, 32),
      new THREE.MeshLambertMaterial({ color: '#090503' })
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Monster group
    const group = new THREE.Group()
    scene.add(group)

    // Orbit
    const orbit = { theta: 0.5, phi: 0.32, r: 4.5, dragging: false, lx: 0, ly: 0 }

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

    ctx.current = { renderer, scene, camera, group, orbit }

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
    const { group, renderer, scene, camera } = ctx.current
    if (!group) return

    group.children.slice().forEach(c => { c.geometry?.dispose(); c.material?.dispose(); group.remove(c) })

    if (geometry?.parts?.length) {
      geometry.parts.forEach(part => group.add(makeMesh(part)))
    }

    if (onThumbnailCapture) {
      setTimeout(() => {
        if (!renderer) return
        renderer.render(scene, camera)
        const src = renderer.domElement.toDataURL('image/jpeg', 0.85)
        const img = new Image()
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = 160; c.height = 120
          c.getContext('2d').drawImage(img, 0, 0, 160, 120)
          onThumbnailCapture(c.toDataURL('image/jpeg', 0.8))
        }
        img.src = src
      }, 120)
    }
  }, [geometry, onThumbnailCapture])

  const onDown  = useCallback(e => { const o = ctx.current.orbit; if (o) { o.dragging = true; o.lx = e.clientX; o.ly = e.clientY } }, [])
  const onMove  = useCallback(e => {
    const o = ctx.current.orbit
    if (!o?.dragging) return
    o.theta -= (e.clientX - o.lx) * 0.008
    o.phi    = Math.max(0.04, Math.min(1.45, o.phi - (e.clientY - o.ly) * 0.008))
    o.lx = e.clientX; o.ly = e.clientY
  }, [])
  const onUp    = useCallback(() => { const o = ctx.current.orbit; if (o) o.dragging = false }, [])
  const onWheel = useCallback(e => { const o = ctx.current.orbit; if (o) o.r = Math.max(1.2, Math.min(9, o.r + e.deltaY * 0.004)) }, [])

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
