import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

const THUMB = { theta: 0.5, phi: 0.32, r: 7 }
const DEG = Math.PI / 180
const RAD = 180 / Math.PI

// ── Lava shader ───────────────────────────────────────────────────────────────
const LAVA_VERT = `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    #include <fog_vertex>
    gl_Position = projectionMatrix * mvPosition;
  }
`
const LAVA_FRAG = `
  #include <fog_pars_fragment>
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.52;
    for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.13+vec2(1.3,1.7); a*=0.48; }
    return v;
  }
  void main(){
    vec2 uv  = vUv * 5.0;
    float t1 = time * 0.033, t2 = time * 0.021;
    vec2 flow = uv + vec2(t1, t2);
    float n   = fbm(flow);
    float n2  = fbm(flow * 1.75 + vec2(n * 2.1, n * 0.85) + vec2(-t2, t1*0.6));

    vec3 col = mix(vec3(0.02,0.005,0.0),  vec3(0.40,0.035,0.0), smoothstep(0.06,0.30,n2));
    col = mix(col, vec3(0.90, 0.32, 0.0), smoothstep(0.30,0.55,n2));
    col = mix(col, vec3(1.0,  0.85, 0.12),smoothstep(0.58,0.76,n2));
    col = mix(col, vec3(1.0,  0.97, 0.72),smoothstep(0.78,0.92,n2));

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`

// ── Scene element builders ────────────────────────────────────────────────────
function makeLava(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog, time: { value: 0 } },
    vertexShader:   LAVA_VERT,
    fragmentShader: LAVA_FRAG,
    fog: true,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -0.52
  scene.add(mesh)
  return { mat, mesh }
}

function makeGazebo(scene) {
  const N    = 6
  const PRAD = 4.65
  const mStone    = new THREE.MeshLambertMaterial({ color: '#3a3228' })
  const mStoneMid = new THREE.MeshLambertMaterial({ color: '#4a4035' })
  const mRoof     = new THREE.MeshLambertMaterial({ color: '#252018' })

  const add = (geo, mat, x=0, y=0, z=0, rx=0, ry=0, rz=0, shadow=false) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    m.castShadow  = shadow
    m.receiveShadow = true
    scene.add(m)
    return m
  }

  // Platform + steps
  add(new THREE.CylinderGeometry(5.55, 5.85, 0.50, 8), mStone,    0, -0.25, 0)
  add(new THREE.CylinderGeometry(6.40, 6.70, 0.30, 8), mStoneMid, 0, -0.65, 0)
  add(new THREE.CylinderGeometry(7.20, 7.55, 0.30, 8), mStone,    0, -0.95, 0)

  // Floor surface (slightly lighter stone disc)
  add(new THREE.CylinderGeometry(5.50, 5.50, 0.06, 8), mStoneMid, 0, 0.03, 0)

  // Floor tile grooves (thin box rings)
  for (let r of [1.5, 3.0, 4.5]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.04, 4, 32),
      mStone
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.07
    scene.add(ring)
  }

  // Pillars
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2
    const px  = Math.sin(ang) * PRAD
    const pz  = Math.cos(ang) * PRAD

    add(new THREE.CylinderGeometry(0.35, 0.41, 0.28, 8), mStoneMid, px, 0.14, pz)
    add(new THREE.CylinderGeometry(0.21, 0.27, 3.65, 8), mStone,    px, 2.10, pz, 0,0,0, true)
    add(new THREE.CylinderGeometry(0.31, 0.22, 0.30, 8), mStoneMid, px, 4.08, pz)

    // Arch lintel
    const a2      = ((i+1) / N) * Math.PI * 2
    const midAng  = (ang + a2) / 2
    const segLen  = 2 * PRAD * Math.sin(Math.PI / N) * 0.87
    const archX   = Math.sin(midAng) * PRAD
    const archZ   = Math.cos(midAng) * PRAD
    add(new THREE.BoxGeometry(segLen, 0.24, 0.22), mStone,    archX, 3.90, archZ, 0, -midAng, 0)
    add(new THREE.BoxGeometry(0.30,   0.40, 0.24), mStoneMid, archX, 4.12, archZ, 0, -midAng, 0)

    // Side columns (thin decorative strips on pillars)
    add(new THREE.BoxGeometry(0.08, 3.65, 0.08), mStoneMid, px + Math.sin(ang+0.18)*0.24, 2.10, pz + Math.cos(ang+0.18)*0.24, 0,0,0, false)
    add(new THREE.BoxGeometry(0.08, 3.65, 0.08), mStoneMid, px + Math.sin(ang-0.18)*0.24, 2.10, pz + Math.cos(ang-0.18)*0.24, 0,0,0, false)
  }

  // Ring beam
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PRAD, 0.17, 8, N*4), mStone)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 4.22
  scene.add(ring)

  // Roof cone
  add(new THREE.ConeGeometry(5.5, 4.0, 8), mRoof, 0, 6.22, 0, 0,0,0, true)

  // Roof ribs
  for (let i = 0; i < 8; i++) {
    const a   = (i / 8) * Math.PI * 2
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.10, 4.05, 0.10), mStoneMid)
    rib.position.set(Math.sin(a)*2.6, 6.22, Math.cos(a)*2.6)
    rib.rotation.y = -a
    rib.rotation.z = Math.atan2(2.6, 2.0)
    scene.add(rib)
  }

  // Spire
  add(new THREE.ConeGeometry(0.20, 1.10, 6), mStoneMid, 0, 8.27, 0)
  add(new THREE.ConeGeometry(0.07, 0.55, 6), mStone,    0, 9.10, 0)

  // Interior lava-tinted lamp
  const lamp = new THREE.PointLight('#ff6622', 1.8, 12)
  lamp.position.set(0, 0.5, 0)
  scene.add(lamp)

  return lamp
}

function makeMountains(scene) {
  const mDark = new THREE.MeshLambertMaterial({ color: '#120e08' })
  const mMid  = new THREE.MeshLambertMaterial({ color: '#1c1610' })

  let seed = 98765
  const rng = () => { seed = ((seed * 1664525 + 1013904223) | 0) >>> 0; return seed / 0xffffffff }

  const defs = [
    [-44,-82, 21,40], [-18,-92, 14,30], [14,-88, 18,36],
    [ 40,-78, 23,42], [ 62,-72, 16,32], [-66,-68, 19,30],
    [ 30,-100,12,24], [-36,-96, 13,26], [-15,-74, 10,20],
    [ 52,-90, 15,28], [-54,-56, 11,22], [ 22,-66,  9,18],
    [  5,-110,  8,16],[  -8,-105, 7,14],
  ]

  defs.forEach(([x, z, r, h]) => {
    const mat  = rng() > 0.5 ? mDark : mMid
    const segs = 6 + Math.floor(rng() * 3)
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat)
    mesh.position.set(x, h * 0.5 - 0.8, z)
    mesh.rotation.y = rng() * Math.PI * 2
    mesh.castShadow = true
    scene.add(mesh)

    // Secondary smaller peak offset
    if (rng() > 0.45) {
      const r2 = r * 0.55, h2 = h * 0.65
      const ox = (rng()-0.5)*r*0.8, oz = (rng()-0.5)*r*0.8
      const m2 = new THREE.Mesh(new THREE.ConeGeometry(r2, h2, segs), mat)
      m2.position.set(x+ox, h2*0.5-0.8, z+oz)
      scene.add(m2)
    }

    // Lava glow at base
    const gl = new THREE.PointLight('#ff2200', 1.8 + rng()*2.2, 35)
    gl.position.set(x * 0.88, 0.5, z * 0.88)
    scene.add(gl)
  })
}

function makeParticles(scene) {
  const COUNT = 600
  const pos   = new Float32Array(COUNT * 3)
  const col   = new Float32Array(COUNT * 3)
  const spd   = new Float32Array(COUNT)

  let seed = 1337
  const rng = () => { seed = ((seed * 1664525 + 1013904223) | 0) >>> 0; return seed / 0xffffffff }

  for (let i = 0; i < COUNT; i++) {
    pos[i*3]   = (rng()-0.5)*180
    pos[i*3+1] = rng() * 22
    pos[i*3+2] = (rng()-0.5)*180
    spd[i]     = 0.014 + rng()*0.028
    const ember = rng() > 0.85
    col[i*3]   = ember ? 0.90 : 0.22 + rng()*0.15
    col[i*3+1] = ember ? 0.28 : 0.10 + rng()*0.08
    col[i*3+2] = ember ? 0.0  : 0.04 + rng()*0.04
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3))

  const mat = new THREE.PointsMaterial({
    size: 0.60, vertexColors: true,
    transparent: true, opacity: 0.32,
    sizeAttenuation: true, depthWrite: false,
  })

  const pts = new THREE.Points(geo, mat)
  pts.userData.speeds = spd
  scene.add(pts)
  return pts
}

// ── Part mesh helpers ─────────────────────────────────────────────────────────
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
  const line  = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff6600 }))
  line.scale.setScalar(1.06)
  line.userData.isOutline = true
  mesh.add(line)
}

function removeOutline(mesh) {
  const o = mesh.children.find(c => c.userData.isOutline)
  if (o) { o.geometry.dispose(); o.material.dispose(); mesh.remove(o) }
}

function extractDimsFromScale(mesh) {
  const sc = mesh.scale
  if (sc.x === 1 && sc.y === 1 && sc.z === 1) return {}
  const shape  = mesh.userData.shape
  const params = mesh.geometry.parameters
  const round  = v => Math.max(0.02, parseFloat(v.toFixed(4)))
  let dims = {}
  if (shape === 'box') {
    dims = { w: round(params.width*sc.x), h: round(params.height*sc.y), d: round(params.depth*sc.z) }
  } else if (shape === 'sphere') {
    dims = { r: round(params.radius * ((sc.x+sc.y+sc.z)/3)) }
  } else if (shape === 'cylinder') {
    dims = { r: round(params.radiusTop*((sc.x+sc.z)/2)), h: round(params.height*sc.y) }
  } else if (shape === 'cone') {
    dims = { r: round(params.radius*((sc.x+sc.z)/2)), h: round(params.height*sc.y) }
  }
  mesh.scale.set(1, 1, 1)
  return dims
}

// ── Thumbnail camera fit ──────────────────────────────────────────────────────
function fitCameraToGroup(camera, group, aspect) {
  const meshes = group.children.filter(c => c.isMesh)
  if (!meshes.length) return null

  // Ensure world matrices are current before measuring bounds
  group.updateMatrixWorld(true)

  const box = new THREE.Box3()
  meshes.forEach(m => box.expandByObject(m))
  const center = new THREE.Vector3()
  const size   = new THREE.Vector3()
  box.getCenter(center)
  box.getSize(size)

  // Use the largest half-dimension (tighter than bounding-sphere half-diagonal)
  const halfMax = Math.max(size.x, size.y, size.z) / 2

  const fovYh = (camera.fov / 2) * (Math.PI / 180)
  const fovXh = Math.atan(Math.tan(fovYh) * aspect)
  // distance so the largest extent just fills the frame, then pull back 5% for breathing room
  const dist  = (halfMax / Math.min(Math.tan(fovYh), Math.tan(fovXh))) * 1.05

  const dir = new THREE.Vector3(
    Math.sin(THUMB.theta) * Math.cos(THUMB.phi),
    Math.sin(THUMB.phi),
    Math.cos(THUMB.theta) * Math.cos(THUMB.phi),
  )
  return { pos: center.clone().addScaledVector(dir, dist), target: center }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SupplyViewer({
  geometry, onThumbnailCapture,
  selectedPartId, onPartSelect, onPartTransform,
  transformMode='translate', transformSpace='world',
  studioMode=false,
}) {
  const mountRef           = useRef(null)
  const ctx                = useRef({})
  const meshMapRef         = useRef({})
  const onPartSelectRef    = useRef(onPartSelect)
  const onPartTransformRef = useRef(onPartTransform)
  const selectedPartIdRef  = useRef(selectedPartId)
  useEffect(() => { onPartSelectRef.current    = onPartSelect    }, [onPartSelect])
  useEffect(() => { onPartTransformRef.current = onPartTransform }, [onPartTransform])
  useEffect(() => { selectedPartIdRef.current  = selectedPartId  }, [selectedPartId])

  // ── Studio mode toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const c = ctx.current
    if (!c.scene) return
    c.studioModeActive = studioMode
    if (studioMode) {
      c.ambientLight.color.set('#ffffff'); c.ambientLight.intensity = 1.5
      c.lavaGlow.intensity = 0
      c.poolLights.forEach(l => { l.intensity = 0 })
      c.keyLight.intensity = 0; c.fillLight.intensity = 0; c.rimLight.intensity = 0
      c.gazeLamp.intensity = 0
      c.studioTop.intensity = 9; c.studioFill.intensity = 3.5; c.studioRim.intensity = 2
      c.scene.background.set('#1a1a1a')
      c.scene.fog.color.set('#1a1a1a'); c.scene.fog.density = 0.001
      c.lavaMesh.visible = false
      c.particles.visible = false
    } else {
      c.ambientLight.color.set('#331200'); c.ambientLight.intensity = 2.2
      c.lavaGlow.intensity = 6
      c.poolLights.forEach(l => { l.intensity = 3.5 })
      c.keyLight.intensity = 2.5; c.fillLight.intensity = 1.2; c.rimLight.intensity = 1.2
      c.gazeLamp.intensity = 1.8
      c.studioTop.intensity = 0; c.studioFill.intensity = 0; c.studioRim.intensity = 0
      c.scene.background.set('#0d0500')
      c.scene.fog.color.set('#0d0500'); c.scene.fog.density = 0.013
      c.lavaMesh.visible = true
      c.particles.visible = true
    }
  }, [studioMode])

  // ── Main setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    const W  = el.clientWidth  || 600
    const H  = el.clientHeight || 400

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    const canvas = renderer.domElement

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d0500')
    scene.fog = new THREE.FogExp2('#0d0500', 0.013)

    const camera = new THREE.PerspectiveCamera(45, W/H, 0.01, 2000)

    // ── Lighting ──────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight('#331200', 2.2)
    scene.add(ambientLight)

    const lavaGlow = new THREE.PointLight('#ff4400', 6.0, 35)
    lavaGlow.position.set(0, -0.3, 0)
    scene.add(lavaGlow)

    const poolLights = []
    ;[[-22,0,20],[22,0,20],[-18,0,-22],[20,0,-20]].forEach(([x,y,z]) => {
      const l = new THREE.PointLight('#ff3300', 3.5, 55)
      l.position.set(x, y, z); scene.add(l); poolLights.push(l)
    })

    const keyLight = new THREE.DirectionalLight('#ff8844', 2.5)
    keyLight.position.set(8, 14, 6)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight('#cc4400', 1.2)
    fillLight.position.set(-5, 8, 8); scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight('#cc1800', 1.2)
    rimLight.position.set(-6, 8, -12); scene.add(rimLight)

    // Studio white lights (intensità 0 default, gestite dal toggle)
    const studioTop  = new THREE.PointLight('#ffffff', 0, 10)
    studioTop.position.set(0, 5, 0); scene.add(studioTop)
    const studioFill = new THREE.DirectionalLight('#ffffff', 0)
    studioFill.position.set(0, 8, 6); scene.add(studioFill)
    const studioRim  = new THREE.DirectionalLight('#ccddff', 0)
    studioRim.position.set(0, 4, -8); scene.add(studioRim)

    // ── Environment ───────────────────────────────────────────────────────────
    const { mat: lavaMat, mesh: lavaMesh } = makeLava(scene)
    const gazeLamp = makeGazebo(scene)
    makeMountains(scene)
    const particles = makeParticles(scene)

    // Supply group
    const group = new THREE.Group()
    scene.add(group)

    // ── TransformControls ─────────────────────────────────────────────────────
    const tc = new TransformControls(camera, canvas)
    tc.space = 'world'
    tc.mode  = 'translate'
    scene.add(tc)

    tc.addEventListener('dragging-changed', e => { orbit.locked = Boolean(e.value) })
    tc.addEventListener('mouseUp', () => {
      const mesh = tc.object
      if (!mesh || !onPartTransformRef.current) return
      const partId = mesh.userData.partId
      if (!partId) return
      const p = mesh.position, rot = mesh.rotation
      const round2 = v => parseFloat(v.toFixed(4))
      const update = {
        x: round2(p.x), y: round2(p.y), z: round2(p.z),
        rx: round2(rot.x*RAD), ry: round2(rot.y*RAD), rz: round2(rot.z*RAD),
        ...extractDimsFromScale(mesh),
      }
      onPartTransformRef.current(partId, update)
    })

    // ── Orbit ─────────────────────────────────────────────────────────────────
    const orbit = { theta: THUMB.theta, phi: THUMB.phi, r: THUMB.r, dragging: false, lx:0, ly:0, sx:0, sy:0, locked: false }

    const handleMouseDown = e => { orbit.dragging=true; orbit.lx=e.clientX; orbit.ly=e.clientY; orbit.sx=e.clientX; orbit.sy=e.clientY }
    const handleMouseMove = e => {
      if (!orbit.dragging || orbit.locked) return
      orbit.theta -= (e.clientX-orbit.lx)*0.008
      orbit.phi    = Math.max(0.04, Math.min(1.45, orbit.phi+(e.clientY-orbit.ly)*0.008))
      orbit.lx=e.clientX; orbit.ly=e.clientY
    }
    const handleMouseUp = e => {
      orbit.dragging = false
      if (orbit.locked || !onPartSelectRef.current) return
      const dist = Math.hypot(e.clientX-orbit.sx, e.clientY-orbit.sy)
      if (dist > 20) return
      camera.updateMatrixWorld()
      const rect  = canvas.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX-rect.left)/rect.width)*2-1,
        -((e.clientY-rect.top)/rect.height)*2+1,
      )
      const ray = new THREE.Raycaster()
      ray.setFromCamera(mouse, camera)
      const hits = ray.intersectObjects(group.children.filter(c => c.isMesh), false)
      if (hits.length > 0) {
        const partId = hits[0].object.userData.partId
        if (partId) onPartSelectRef.current(partId)
      }
    }
    const handleWheel      = e => { orbit.r = Math.max(1.2, Math.min(200, orbit.r*(1+e.deltaY*0.001))) }
    const handleMouseLeave = () => { orbit.dragging = false }

    canvas.addEventListener('mousedown',  handleMouseDown)
    canvas.addEventListener('mousemove',  handleMouseMove)
    canvas.addEventListener('mouseup',    handleMouseUp)
    canvas.addEventListener('wheel',      handleWheel, { passive: true })
    canvas.addEventListener('mouseleave', handleMouseLeave)

    // ── Render loop ───────────────────────────────────────────────────────────
    let raf
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = performance.now() / 1000

      if (lavaMesh.visible) lavaMat.uniforms.time.value = t

      const studio = ctx.current.studioModeActive
      if (!studio) {
        lavaGlow.intensity = 4.5 + Math.sin(t*4.1)*0.8 + Math.sin(t*7.3)*0.35
        gazeLamp.intensity = 1.5 + Math.sin(t*3.7)*0.5 + Math.sin(t*5.9)*0.2
      }

      const ppos = particles.geometry.attributes.position
      const spd  = particles.userData.speeds
      for (let i = 0; i < ppos.count; i++) {
        const ny = ppos.getY(i) + spd[i]
        if (ny > 24) {
          ppos.setY(i, 0)
          ppos.setX(i, (Math.random()-0.5)*180)
          ppos.setZ(i, (Math.random()-0.5)*180)
        } else {
          ppos.setY(i, ny)
        }
      }
      ppos.needsUpdate = true

      camera.position.set(
        orbit.r * Math.sin(orbit.theta) * Math.cos(orbit.phi),
        orbit.r * Math.sin(orbit.phi),
        orbit.r * Math.cos(orbit.theta) * Math.cos(orbit.phi),
      )
      camera.lookAt(0, 1.2, 0)
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

    ctx.current = {
      renderer, scene, camera, group, orbit, tc, el, lavaMat, lavaMesh, particles,
      ambientLight, lavaGlow, poolLights, keyLight, fillLight, rimLight, gazeLamp,
      studioTop, studioFill, studioRim,
    }

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
        const c = ctx.current
        const W = el.clientWidth, H = el.clientHeight
        const savedPos = camera.position.clone(), savedAspect = camera.aspect
        const selId = selectedPartIdRef.current
        const selMesh = selId ? meshMapRef.current[selId] : null
        if (selMesh) removeOutline(selMesh)

        // Always render thumbnail with studio lighting
        const wasStudio = c.studioModeActive
        if (!wasStudio) {
          c.ambientLight.color.set('#ffffff'); c.ambientLight.intensity = 1.5
          c.lavaGlow.intensity = 0
          c.poolLights.forEach(l => { l.intensity = 0 })
          c.keyLight.intensity = 0; c.fillLight.intensity = 0; c.rimLight.intensity = 0
          c.gazeLamp.intensity = 0
          c.studioTop.intensity = 9; c.studioFill.intensity = 3.5; c.studioRim.intensity = 2
          c.scene.background.set('#1a1a1a')
          c.scene.fog.color.set('#1a1a1a'); c.scene.fog.density = 0.001
          c.lavaMesh.visible = false
          c.particles.visible = false
        }

        // Fit camera to object bounding box
        const THUMB_W = 160, THUMB_H = 120, THUMB_ASP = THUMB_W / THUMB_H
        camera.aspect = THUMB_ASP; camera.updateProjectionMatrix()
        const fit = fitCameraToGroup(camera, group, THUMB_ASP)
        if (fit) {
          camera.position.copy(fit.pos)
          camera.lookAt(fit.target)
        } else {
          camera.position.set(
            THUMB.r*Math.sin(THUMB.theta)*Math.cos(THUMB.phi),
            THUMB.r*Math.sin(THUMB.phi),
            THUMB.r*Math.cos(THUMB.theta)*Math.cos(THUMB.phi),
          )
          camera.lookAt(0, 0.9, 0)
        }

        renderer.setSize(THUMB_W, THUMB_H, false)
        renderer.render(scene, camera)
        const src = renderer.domElement.toDataURL('image/jpeg', 0.85)

        // Restore lighting if we forced studio
        if (!wasStudio) {
          c.ambientLight.color.set('#331200'); c.ambientLight.intensity = 2.2
          c.lavaGlow.intensity = 6
          c.poolLights.forEach(l => { l.intensity = 3.5 })
          c.keyLight.intensity = 2.5; c.fillLight.intensity = 1.2; c.rimLight.intensity = 1.2
          c.gazeLamp.intensity = 1.8
          c.studioTop.intensity = 0; c.studioFill.intensity = 0; c.studioRim.intensity = 0
          c.scene.background.set('#0d0500')
          c.scene.fog.color.set('#0d0500'); c.scene.fog.density = 0.013
          c.lavaMesh.visible = true
          c.particles.visible = true
        }

        if (selMesh) addOutline(selMesh)
        renderer.setSize(W, H, false)
        camera.position.copy(savedPos); camera.aspect = savedAspect; camera.updateProjectionMatrix()
        onThumbnailCapture(src)
      }, 150)
    }
  }, [geometry, onThumbnailCapture])

  // ── Selection highlight + TransformControls attach ──────────────────────────
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

  return <div ref={mountRef} style={{ width:'100%', height:'100%' }} />
}
