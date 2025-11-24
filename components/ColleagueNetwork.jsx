"use client"
// ColleagueNetwork.jsx
// Interactive 3D network graph of colleagues using React Three Fiber, Drei, and GSAP
// Works as-is in a Vite + React setup (single component export)

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

/* ==========================
   Mock JSON dataset
   Each item: { name: string, connections: string[] }
   ========================== */
const MOCK_COLLEAGUES = [
  { name: 'Alice', major: 'IT', ability: 'Frontend Developer', connections: ['Bob', 'Carol', 'David'] },
  { name: 'Bob', major: 'IT', ability: 'Backend Developer', connections: ['Alice', 'Eve', 'Frank'] },
  { name: 'Carol', major: 'Design', ability: '3D Designer', connections: ['Alice', 'Eve'] },
  { name: 'David', major: 'Data', ability: 'Data Scientist', connections: ['Alice', 'Eve', 'Grace'] },
  { name: 'Eve', major: 'IT', ability: 'Full-Stack Developer', connections: ['Bob', 'Carol', 'David', 'Heidi'] },
  { name: 'Frank', major: 'QA', ability: 'SDET', connections: ['Bob', 'Ivan'] },
  { name: 'Grace', major: 'Creative', ability: '3D Animator', connections: ['David', 'Judy'] },
  { name: 'Heidi', major: 'Support', ability: 'IT Support', connections: ['Eve'] },
  { name: 'Ivan', major: 'Infra', ability: 'DevOps Engineer', connections: ['Frank'] },
  { name: 'Judy', major: 'Product', ability: 'Product Manager', connections: ['Grace'] }
]

/* ==========================
   Utility: Build unique edges and adjacency map
   - Returns { nodes, edges, adjacency }
   - nodes: [{ name, position: [x,y,z], color }]
   - edges: [{ a, b }] where a/b are node indices
   ========================== */
function buildGraph(data) {
  const nameToIndex = new Map()
  data.forEach((d, i) => nameToIndex.set(d.name, i))

  // Unique edges: store key in sorted order to avoid duplicates
  const edgeSet = new Set()
  const edges = []
  const adjacency = new Map()

  data.forEach((d) => {
    adjacency.set(d.name, new Set())
  })

  data.forEach((d) => {
    for (const target of d.connections || []) {
      if (!nameToIndex.has(target)) continue
      const i = nameToIndex.get(d.name)
      const j = nameToIndex.get(target)
      const [a, b] = i < j ? [i, j] : [j, i]
      const key = `${a}-${b}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push({ a, b })
        adjacency.get(data[a].name).add(data[b].name)
        adjacency.get(data[b].name).add(data[a].name)
      }
    }
  })

  // Simple visually spaced layout: Fibonacci sphere distribution
  const radius = Math.max(6, data.length * 0.8)
  const nodes = fibonacciSphere(data, radius)

  return { nodes, edges, adjacency }
}

/* ==========================
   Layout: Fibonacci sphere for nicely spaced positions
   ========================== */
function fibonacciSphere(data, radius = 8) {
  const points = []
  const phi = Math.PI * (3 - Math.sqrt(5)) // golden angle
  const n = data.length
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2 // y from 1 to -1
    const r = Math.sqrt(1 - y * y)
    const theta = phi * i
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    points.push([x * radius, y * radius, z * radius])
  }

  const color = new THREE.Color()
  const nodes = data.map((d, i) => ({
    name: d.name,
    position: points[i],
    color: `#${color.setHSL(i / Math.max(1, n), 0.5, 0.6).getHexString()}`
  }))

  return nodes
}

/* ==========================
   Node (Sphere + Text label) with hover/select animations
   ========================== */
function Node({ name, position, color, onSelect, selected, dimmed, controlsRef, showLabels }) {
  const meshRef = useRef()
  const textRef = useRef()
  const spriteRef = useRef()
  const { camera } = useThree()

  // Hover handlers with GSAP scale/color animations
  const onPointerOver = (e) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
    if (meshRef.current) {
      gsap.to(meshRef.current.scale, { x: 1.35, y: 1.35, z: 1.35, duration: 0.25, ease: 'power2.out' })
      // make a subtle emissive glow on hover
      gsap.to(meshRef.current.material, { emissiveIntensity: 0.8, duration: 0.3 })
    }
    if (textRef.current) {
      gsap.to(textRef.current, { opacity: 1, duration: 0.2, ease: 'power2.out' })
    }
  }

  const onPointerOut = (e) => {
    e.stopPropagation()
    document.body.style.cursor = 'auto'
    if (meshRef.current) {
      gsap.to(meshRef.current.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: 'power2.out' })
      gsap.to(meshRef.current.material, { emissiveIntensity: selected ? 0.6 : 0, duration: 0.4 })
    }
    if (textRef.current) {
      gsap.to(textRef.current, { opacity: selected ? 1 : 0.8, duration: 0.2, ease: 'power2.out' })
    }
  }

  // Click -> select and smoothly move camera using GSAP
  const onClick = (e) => {
    e.stopPropagation()
    onSelect(name, position)
    const target = new THREE.Vector3(...position)
    const from = camera.position.clone()
    const offset = target.clone().sub(from).normalize().multiplyScalar(-4)
    const to = target.clone().add(offset)

    gsap.to(camera.position, {
      x: to.x, y: to.y, z: to.z, duration: 1.2, ease: 'power3.inOut', onUpdate: () => {
        controlsRef.current && controlsRef.current.update()
      }
    })
    if (controlsRef.current) {
      gsap.to(controlsRef.current.target, { x: target.x, y: target.y, z: target.z, duration: 1.2, ease: 'power3.inOut' })
    }
  }
  // subtle per-node floating animation
  useEffect(() => {
    let tl
    try {
      tl = gsap.timeline({ repeat: -1, yoyo: true })
      tl.to(meshRef.current.position, { y: '+=0.08', duration: 2.2, ease: 'sine.inOut' }, 0)
      tl.to(meshRef.current.rotation, { z: '+=0.02', duration: 3.6, ease: 'sine.inOut' }, 0)
    } catch (e) { }
    return () => { try { tl && tl.kill() } catch (e) { } }
  }, [])

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
        scale={selected ? 1.25 : 1}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.36, 48, 48]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          metalness={0.25}
          roughness={0.2}
          color={selected ? '#7aa2ff' : color}
          emissive={selected ? '#3355ff' : '#000000'}
          emissiveIntensity={selected ? 0.6 : 0}
          reflectivity={0.5}
        />
      </mesh>

      {/* soft label — only show when requested */}
      {showLabels && (
        <Text
          ref={textRef}
          position={[0.7, 0.02, 0]}
          fontSize={0.34}
          color={dimmed ? '#8892a8' : '#e9f3ff'}
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.002}
          outlineColor="#000000"
          fillOpacity={selected ? 1 : 0.85}
        >
          {name}
        </Text>
      )}
    </group>
  )
}

/* ==========================
   Graph content: builds nodes/edges and renders them
   ========================== */
function Graph({ query: propQuery = '', showLabels: propShowLabels = true, autoRotate: propAutoRotate = true, setAutoRotate, selected: propSelected = null, onSelect }) {
  const { camera } = useThree()
  const controlsRef = useRef()
  const { nodes, edges, adjacency } = useMemo(() => buildGraph(MOCK_COLLEAGUES), [])
  const isNeighbor = useCallback(
    (n) => propSelected && (n === propSelected || adjacency.get(propSelected)?.has(n)),
    [propSelected, adjacency]
  )
  const dimOpacity = 0.38

  // local alias so existing code can use `selected` variable
  const selected = propSelected

  const handleSelect = useCallback((name) => {
    try { onSelect && onSelect(name) } catch (e) { }
  }, [onSelect])

  const query = propQuery
  const showLabels = propShowLabels
  const autoRotate = propAutoRotate

  // Auto-rotate camera slowly when no selection
  useEffect(() => {
    let raf = null
    let t = 0
    function rotate() {
      if (!autoRotate || selected) { raf = requestAnimationFrame(rotate); return }
      t += 0.002
      try {
        camera.position.x = Math.cos(t) * 18
        camera.position.z = Math.sin(t) * 18
        camera.lookAt(0, 0, 0)
      } catch (e) { }
      raf = requestAnimationFrame(rotate)
    }
    raf = requestAnimationFrame(rotate)
    return () => cancelAnimationFrame(raf)
  }, [autoRotate, camera, selected])

  return (
    <>
      {/* Sci‑fi lighting */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 10, 5]} intensity={0.9} castShadow />
      <pointLight position={[0, 6, 8]} intensity={0.6} distance={30} />
      <hemisphereLight skyColor={0x88aaff} groundColor={0x101020} intensity={0.15} />

      {/* starfield background */}
      <group position={[0, 0, -30]}>
        <points>
          <bufferGeometry attach="geometry" />
        </points>
      </group>

      {/* Edges (connections) */}
      {edges.filter(e => {
        // if search query present, hide edges that don't touch queried nodes
        if (!query) return true
        const aName = nodes[e.a].name.toLowerCase()
        const bName = nodes[e.b].name.toLowerCase()
        return aName.includes(query.toLowerCase()) || bName.includes(query.toLowerCase())
      }).map((e, idx) => {
        const a = nodes[e.a]
        const b = nodes[e.b]
        const active = selected && (a.name === selected || b.name === selected || adjacency.get(selected)?.has(a.name) || adjacency.get(selected)?.has(b.name))
        return (
          <Line
            key={`edge-${idx}`}
            points={[a.position, b.position]}
            color={active ? '#79ffe1' : '#6b7280'}
            lineWidth={active ? 2.5 : 1}
            transparent
            opacity={active ? 1 : 0.45}
          />
        )
      })}

      {/* Nodes */}
      {nodes.filter(n => {
        if (!query) return true
        return n.name.toLowerCase().includes(query.toLowerCase())
      }).map((n) => (
        <Node
          key={n.name}
          name={n.name}
          position={n.position}
          color={n.color}
          selected={selected === n.name}
          dimmed={selected ? !isNeighbor(n.name) : false}
          showLabels={showLabels}
          onSelect={handleSelect}
          controlsRef={controlsRef}
        />
      ))}

      {/* Controls - zoom and pan disabled and distance clamped to initial camera distance */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        enableZoom={false}
        enablePan={false}
        minDistance={12}
        maxDistance={36}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />
    </>
  )
}

/* ==========================
   Top-level export: mounts a ready-to-use <Canvas> scene
   ========================== */
export default function ColleagueNetwork() {
  // Local UI state for toolbar
  const [search, setSearch] = useState('')
  const [labels, setLabels] = useState(true)
  const [autoRotate, setAutoRotate] = useState(true)
  const [selected, setSelected] = useState(null)

  // clear selection with Escape key
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 520, background: '#060718', position: 'relative', color: '#e6f3ff', fontFamily: 'Inter, system-ui, Arial' }}>
      <style>{`\n        .cn-toolbar { position: absolute; top: 16px; left: 16px; z-index: 50; display:flex; gap:8px; align-items:center; }\n        .cn-card { background: rgba(255,255,255,0.04); padding:8px 10px; border-radius:10px; backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.04); }\n        .cn-input { background: transparent; border: none; outline: none; color: #e6f3ff; min-width: 140px; }\n        .cn-toggle { cursor: pointer; padding:6px 8px; border-radius:8px; border: 1px solid rgba(255,255,255,0.06); background: transparent; color: #e6f3ff }\n        .cn-bottom { position: absolute; right: 16px; bottom: 16px; z-index: 40; display:flex; gap:8px; }\n      `}</style>

      <div className="cn-toolbar">
        <div className="cn-card">
          <input className="cn-input" placeholder="Search colleagues" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="cn-card">
          <button className="cn-toggle" onClick={() => setLabels(v => !v)}>{labels ? 'Hide Labels' : 'Show Labels'}</button>
          <button className="cn-toggle" onClick={() => setAutoRotate(r => !r)} style={{ marginLeft: 8 }}>{autoRotate ? 'Pause Rotate' : 'Rotate'}</button>
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, 18], fov: 50 }} gl={{ antialias: true }}>
        <color attach="background" args={["#060718"]} />
        <Graph query={search} showLabels={labels} autoRotate={autoRotate} setAutoRotate={(v) => setAutoRotate(v)} selected={selected} onSelect={(n) => setSelected(n)} />
      </Canvas>
      {/* Selection overlay */}
      {/* compute selected person once for overlays */}
      {(() => { })()}

      {/* centered front-facing name overlay */}
      {(() => {
        const personCenter = selected ? MOCK_COLLEAGUES.find(p => p.name === selected) : null
        return (
          <div style={{ position: 'fixed', left: '50%', top: '50%', zIndex: 95, pointerEvents: selected ? 'auto' : 'none' }}>
            <div style={{ transform: selected ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.98)', transition: 'opacity 260ms ease, transform 260ms ease', opacity: selected ? 1 : 0 }}>
              <div style={{ minWidth: 320, maxWidth: 560, padding: 20, borderRadius: 14, textAlign: 'center', background: 'linear-gradient(180deg, rgba(10,14,22,0.9), rgba(6,10,18,0.85))', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 18px 60px rgba(2,6,23,0.85)' }} aria-hidden={!selected}>
                <div style={{ fontSize: 36, lineHeight: 1, fontWeight: 800, color: '#eaf6ff', letterSpacing: '-0.02em' }}>{personCenter ? personCenter.name : (selected || '')}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#b8c7dd' }}>{personCenter ? `${personCenter.connections.length} connections` : ''}</div>
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => setSelected(null)} style={{ padding: '8px 12px', borderRadius: 8, background: '#0b1220', color: '#e6f3ff', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div style={{ position: 'fixed', right: 20, top: 80, zIndex: 80 }}>
        <div style={{
          transition: 'transform 300ms ease, opacity 300ms ease',
          transform: selected ? 'translateX(0)' : 'translateX(12px)',
          opacity: selected ? 1 : 0.0,
          pointerEvents: selected ? 'auto' : 'none'
        }}>
          <div style={{ width: 320, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', padding: 18, borderRadius: 12, boxShadow: '0 8px 30px rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}>
            {selected ? (
              (() => {
                const person = MOCK_COLLEAGUES.find(p => p.name === selected)
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{person?.name || selected}</div>
                      <button aria-label="Close" onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#dbeeff', cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ fontSize: 13, color: '#b8c7dd', marginBottom: 8 }}>{person ? person.major : ''}</div>
                    <div style={{ fontSize: 14, color: '#eaf6ff', fontWeight: 600, marginBottom: 12 }}>{person ? person.ability : ''}</div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                      <button onClick={() => setSelected(null)} style={{ padding: '8px 12px', borderRadius: 8, background: '#0b1220', color: '#e6f3ff', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>Close</button>
                      <button onClick={() => { /* placeholder for more actions */ }} style={{ padding: '8px 12px', borderRadius: 8, background: '#1b2740', color: '#9fe7d9', border: '1px solid rgba(159,231,217,0.08)', cursor: 'pointer' }}>Contact</button>
                    </div>
                  </div>
                )
              })()
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==========================
   Usage (Vite + React)
   ---------------------
   1) Install deps:
      npm i three @react-three/fiber @react-three/drei gsap

   2) Import and use:
      import ColleagueNetwork from './ColleagueNetwork.jsx'
      export default function App() { return <ColleagueNetwork /> }

   Notes:
   - The layout uses a Fibonacci sphere for even spacing.
   - Hover a node to scale it; click to smoothly focus the camera.
   - Lines and labels highlight around the selected node.
   ========================== */
