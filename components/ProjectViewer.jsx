"use client"
// ProjectViewer.jsx
// Reusable interactive 3D project viewer built with React Three Fiber, Drei and GSAP.
// - Loads a GLTF model from `public/models/{model}.glb` (mock sample used below)
// - Hotspots are defined in a mock JSON at the top
// - Camera rotation allowed, zoom/pan disabled and distance locked
// - Clicking a hotspot animates the camera to focus and opens an info panel
// - Cinematic post-processing with Bloom, SSAO, DepthOfField, FXAA, ToneMapping
// - Adaptive performance monitoring with quality downgrade on low FPS
// - Parallax cursor interaction for immersive yaw/pitch
// - Hotspot pulse/scale animations on hover

import React, { useRef, useState, Suspense, useMemo, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, useGLTF, Environment, useProgress } from '@react-three/drei'
import { EffectComposer, Bloom, SSAO, DepthOfField, FXAA, SelectiveBloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import gsap from 'gsap'

// Mock project data and hotspots (replace with CMS-driven data later)
const MOCK_PROJECT = {
  id: 'sample-build',
  title: 'Sample Project — Urban Drive',
  model: '/models/Logo.glb', // place a glb at public/models/sample.glb
  cameraDistance: 4.2,
  hotspots: [
    { id: 'hp-1', title: 'Facade Detail', desc: 'High-res facade materials and aperture detail', position: [0, 0.8, 0.05] },
    { id: 'hp-2', title: 'Main Lobby', desc: 'Double-height lobby with sculptural staircase', position: [-0.6, -0.2, 0.95] },
    { id: 'hp-3', title: 'Roof Garden', desc: 'Private roof terrace and planter strategy', position: [0.2, 1.3, -0.6] }
  ]
}

function Hotspot({ id, p = [0, 0, 0], title, onHover, onClick, active, registerRef }) {
  const ref = useRef()
  const [hovered, setHovered] = useState(false)

  // Pulse animation on hover
  useFrame((state) => {
    if (!ref.current) return
    
    if (hovered) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.15 + 1
      ref.current.scale.setScalar(pulse * 1.2)
    } else if (active) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.08 + 1
      ref.current.scale.setScalar(pulse)
    } else {
      ref.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1)
    }
  })

  const handleHover = (isHovered) => {
    setHovered(isHovered)
    onHover && onHover(isHovered)
  }

  // register our mesh ref so parent can selectively highlight it
  useEffect(() => {
    if (registerRef && ref.current) registerRef(id, ref.current)
    return () => {
      if (registerRef) registerRef(id, null)
    }
  }, [id, registerRef])

  return (
    <mesh
      ref={ref}
      position={p}
      onPointerOver={(e) => { e.stopPropagation(); handleHover(true) }}
      onPointerOut={(e) => { e.stopPropagation(); handleHover(false) }}
      onClick={(e) => { e.stopPropagation(); onClick && onClick() }}
    >
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshStandardMaterial 
        color={active ? '#7aa2ff' : (hovered ? '#9fffff' : '#79ffe1')} 
        emissive={active ? '#3355ff' : (hovered ? '#00ffdd' : '#002f2a')} 
        emissiveIntensity={active ? 0.85 : (hovered ? 0.45 : 0.15)} 
        metalness={0.2} 
        roughness={0.3} 
      />

      {/* label using Html so it faces the camera and is clickable */}
      <Html distanceFactor={10} position={[0.18, 0.06, 0]} center>
        <div style={{ pointerEvents: 'none', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 400, color: active ? '#e6f0ff' : '#d8fff4', textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>{title}</div>
      </Html>
    </mesh>
  )
}

function ModelWithHotspots({ project, onSelectHotspot, activeId, registerRef, viewMode }) {
  // load GLTF model
  const gltf = useGLTF(project.model, true)

  // apply view mode to model materials (wireframe / unlit / shaded)
  useEffect(() => {
    if (!gltf || !gltf.scene) return
    gltf.scene.traverse((n) => {
      if (n.isMesh && n.material) {
        // store original props
        if (!n.userData._orig) n.userData._orig = { wireframe: n.material.wireframe, metalness: n.material.metalness, roughness: n.material.roughness, emissive: n.material.emissive ? n.material.emissive.clone() : null }
        if (viewMode === 'wireframe') {
          n.material.wireframe = true
          n.material.emissive && (n.material.emissive.setHex(0x000000))
        } else if (viewMode === 'unlit') {
          n.material.wireframe = false
          n.material.metalness !== undefined && (n.material.metalness = 0)
          n.material.roughness !== undefined && (n.material.roughness = 1)
          n.material.emissive && (n.material.emissive.setHex(0x000000))
        } else {
          // restore
          const o = n.userData._orig
          if (o) {
            n.material.wireframe = !!o.wireframe
            if (o.metalness !== undefined) n.material.metalness = o.metalness
            if (o.roughness !== undefined) n.material.roughness = o.roughness
            if (o.emissive) n.material.emissive && n.material.emissive.copy(o.emissive)
          }
        }
        n.material.needsUpdate = true
      }
    })
  }, [gltf, viewMode])

  return (
    <group>
      <primitive object={gltf.scene} />
      {project.hotspots.map((h) => (
        <Hotspot key={h.id} id={h.id} p={h.position} title={h.title} onClick={() => onSelectHotspot(h)} active={activeId === h.id} registerRef={registerRef} />
      ))}
    </group>
  )
}

// Parallax cursor effect: scene group rotates slightly with mouse
function ParallaxGroup({ children, intensity = 0.08 }) {
  const groupRef = useRef()
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useFrame(() => {
    if (!groupRef.current) return
    const targetX = mouse.current.y * intensity
    const targetY = mouse.current.x * intensity
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.05)
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.05)
  })

  return <group ref={groupRef}>{children}</group>
}

function Scene({ project, onSelectHotspot, activeId, registerHotspotRef, viewMode }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 4]} intensity={1.4} castShadow />
      {/* Rim light for depth */}
      <directionalLight position={[-3, 2, -5]} intensity={0.5} color="#4488ff" />
      <hemisphereLight args={['#ffffff', '#444488', 0.3]} />
      
      <Suspense fallback={null}>
        <ParallaxGroup>
          <ModelWithHotspots project={project} onSelectHotspot={onSelectHotspot} activeId={activeId} registerRef={registerHotspotRef} viewMode={viewMode} />
        </ParallaxGroup>
        <Environment preset="city" />
      </Suspense>
      
      {/* Subtle fog for depth */}
      <fog attach="fog" args={['#0b1020', 8, 20]} />
    </>
  )
}

function CameraController({ distance = 4.2, focus = null, onFocusChange }) {
  // Helper component to provide GSAP camera moves when `focus` changes
  const { camera } = useThree()
  const controls = useThree((s) => s.controls)

  React.useEffect(() => {
    // clamp camera at fixed distance looking at origin
    camera.position.set(0, 0, distance)
    camera.lookAt(new THREE.Vector3(0, 0, 0))
    try {
      if (controls) {
        controls.minDistance = distance
        controls.maxDistance = distance
        controls.enableZoom = false
        controls.enablePan = false
      }
    } catch (e) {}
  }, [distance, camera, controls])

  React.useEffect(() => {
    if (!focus) {
      // Reset to default view
      gsap.to(camera.position, { x: 0, y: 0, z: distance, duration: 1.0, ease: 'power3.inOut', onUpdate: () => { controls && controls.update && controls.update() } })
      if (controls) {
        gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.0, ease: 'power3.inOut' })
      }
      onFocusChange && onFocusChange(null)
      return
    }
    // focus has { position, title } - animate camera to orbit around that point
    const target = new THREE.Vector3(...focus.position)
    // compute a new camera position offset along current camera direction but nearer to the target
    const dir = camera.position.clone().sub(target).normalize()
    const to = target.clone().add(dir.multiplyScalar(distance * 0.7))

    gsap.to(camera.position, { x: to.x, y: to.y, z: to.z, duration: 1.0, ease: 'power3.inOut', onUpdate: () => { controls && controls.update && controls.update() } })
    if (controls) {
      gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: 1.0, ease: 'power3.inOut' })
    }
    onFocusChange && onFocusChange(target)
  }, [focus, camera, controls, distance, onFocusChange])

  return null
}

// Post-processing effects with adaptive performance
function Effects({ focusTarget, quality = 'high', selection = [] }) {
  const dofRef = useRef()

  useFrame(() => {
    if (dofRef.current && focusTarget) {
      // Smoothly transition focal distance when focusing on a hotspot
      const distance = focusTarget.length()
      dofRef.current.target = distance
    }
  })

  const bloomIntensity = quality === 'high' ? 0.6 : 0.3
  const ssaoSamples = quality === 'high' ? 16 : 8
  const dofEnabled = quality === 'high'

  return (
    <EffectComposer multisampling={quality === 'high' ? 4 : 0} enableNormalPass>
      {/* selective bloom for highlighting (selection is array of objects/refs) */}
      {selection && selection.length > 0 && (
        <SelectiveBloom selection={selection} selectionLayer={10} intensity={1.2} width={300} height={300} />
      )}
      <Bloom 
        intensity={bloomIntensity} 
        luminanceThreshold={0.4} 
        luminanceSmoothing={0.6} 
        mipmapBlur 
      />
      <SSAO 
        samples={ssaoSamples} 
        radius={0.1} 
        intensity={30} 
        luminanceInfluence={0.6} 
        color="black"
      />
      {dofEnabled && (
        <DepthOfField
          ref={dofRef}
          focusDistance={0}
          focalLength={0.08}
          bokehScale={3}
          height={480}
        />
      )}
      <FXAA />
    </EffectComposer>
  )
}

// Adaptive performance monitor
function PerformanceMonitor({ onQualityChange }) {
  const [samples, setSamples] = useState([])
  
  useFrame((state) => {
    const fps = 1 / state.clock.getDelta()
    setSamples((prev) => {
      const updated = [...prev, fps].slice(-60) // Keep last 60 frames
      if (updated.length >= 60) {
        const avgFps = updated.reduce((a, b) => a + b, 0) / updated.length
        // Downgrade if consistently below 45fps
        if (avgFps < 45) {
          onQualityChange('low')
        } else if (avgFps > 55) {
          onQualityChange('high')
        }
      }
      return updated
    })
  })
  
  return null
}

// Loading progress component
function LoadingScreen() {
  const { progress } = useProgress()
  
  return (
    <Html center>
      <div style={{
        background: 'rgba(11, 16, 32, 0.95)',
        padding: '24px 32px',
        borderRadius: 12,
        color: '#e6f0ff',
        textAlign: 'center',
        minWidth: 280
      }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>Loading Project</div>
        <div style={{ 
          width: '100%', 
          height: 4, 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: 2, 
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #79ffe1, #7aa2ff)',
            transition: 'width 0.3s ease',
            boxShadow: '0 0 10px rgba(121, 255, 225, 0.5)'
          }} />
        </div>
        <div style={{ fontSize: 13, marginTop: 8, color: '#a0b0c0' }}>
          {Math.round(progress)}%
        </div>
      </div>
    </Html>
  )
}

export default function ProjectViewer({ project = MOCK_PROJECT }) {
  const [activeHotspot, setActiveHotspot] = useState(null)
  const [focus, setFocus] = useState(null)
  const [focusTarget, setFocusTarget] = useState(null)
  const [quality, setQuality] = useState('high')
  const [viewMode, setViewMode] = useState('shaded') // 'shaded' | 'wireframe' | 'unlit'
  const [showDetails, setShowDetails] = useState(false)
  const [preset, setPreset] = useState(null)
  const hotspotRefs = useRef({})

  const registerHotspotRef = (id, obj) => {
    if (!id) return
    if (obj) hotspotRefs.current[id] = obj
    else delete hotspotRefs.current[id]
  }

  const handleSelectHotspot = (h) => {
    setActiveHotspot(h.id)
    setFocus(h)
  }

  const handleClose = () => {
    setActiveHotspot(null)
    setFocus(null)
  }

  const handleFocusChange = (target) => {
    setFocusTarget(target)
  }

  const handleQualityChange = (newQuality) => {
    // Only change if actually different to avoid re-renders
    setQuality((prev) => prev !== newQuality ? newQuality : prev)
  }

  // compute selected objects for SelectiveBloom
  const selectedObjects = activeHotspot && hotspotRefs.current[activeHotspot] ? [hotspotRefs.current[activeHotspot]] : []

  // small in-canvas controller to animate camera for presets
  function PresetController({ preset, onDone }) {
    const { camera } = useThree()
    const controls = useThree((s) => s.controls)

    useEffect(() => {
      if (!preset) return
      let to = { x: 0, y: 0, z: project.cameraDistance }
      let target = { x: 0, y: 0, z: 0 }
      switch (preset) {
        case 'front': to = { x: 0, y: 0, z: project.cameraDistance }; break
        case 'top': to = { x: 0, y: project.cameraDistance, z: 0 }; break
        case 'side': to = { x: project.cameraDistance, y: 0, z: 0 }; break
        case 'iso': to = { x: project.cameraDistance * 0.7, y: project.cameraDistance * 0.5, z: project.cameraDistance * 0.7 }; break
      }
      gsap.to(camera.position, { x: to.x, y: to.y, z: to.z, duration: 0.9, ease: 'power3.inOut', onUpdate: () => { controls && controls.update && controls.update() }, onComplete: () => onDone && onDone() })
      if (controls) gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: 0.9, ease: 'power3.inOut' })
    }, [preset, camera, controls])

    return null
  }

  return (
    <div className="pv-root" style={{ width: '100%', height: '100%', position: 'relative', minHeight: 520 }}>
      <style>{`
        .pv-root { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #d8fff4; }
        .pv-controls { position: absolute; top: 18px; right: 18px; z-index: 40; display: flex; gap: 8px; align-items: center; }
        .pv-panel { background: rgba(6,8,12,0.7); color: #d8fff4; padding: 8px; border-radius: 8px; display: flex; gap: 8px; align-items: center; }
        .pv-panel button { padding: 6px 8px; border-radius: 6px; background: transparent; color: inherit; border: 1px solid rgba(255,255,255,0.06); font-weight: 400; display: inline-flex; align-items: center; gap: 6px; }
        .pv-panel button[aria-pressed="true"] { background: #79ffe1; color: #04121a; }
        .pv-presets { display: flex; gap: 6px; }
        .pv-details-toggle { display: inline-flex; align-items: center; gap: 6px; }
        .pv-info { position: absolute; right: 18px; bottom: 18px; z-index: 30; max-width: 420px; }
        .pv-info .title { font-weight: 400; }
        .pv-info .details img { width: 120px; height: 80px; border-radius: 6px; object-fit: cover; }
        @media (max-width: 720px) {
          .pv-controls { top: 12px; right: 12px; left: 12px; display: flex; flex-direction: column; align-items: flex-end; }
          .pv-panel { width: 100%; justify-content: space-between; }
          .pv-presets { flex-wrap: wrap; }
          .pv-info { right: 12px; left: 12px; bottom: 12px; max-width: calc(100% - 24px); }
          .pv-info .details img { width: 96px; height: 64px; }
        }
      `}</style>
      <Canvas 
        camera={{ position: [0, 0, project.cameraDistance], fov: 50 }} 
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        gl={{ 
          antialias: true, 
          alpha: false,
          powerPreference: 'high-performance'
        }}
      >
        <color attach="background" args={[0x0b1020]} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} rotateSpeed={0.6} enableZoom={false} enablePan={false} />
        <CameraController distance={project.cameraDistance} focus={focus} onFocusChange={handleFocusChange} />
        {preset && <PresetController preset={preset} onDone={() => setPreset(null)} />}
        <Suspense fallback={<LoadingScreen />}>
          <Scene project={project} onSelectHotspot={handleSelectHotspot} activeId={activeHotspot} registerHotspotRef={registerHotspotRef} viewMode={viewMode} />
          <Effects focusTarget={focusTarget} quality={quality} selection={selectedObjects} />
        </Suspense>
        <PerformanceMonitor onQualityChange={handleQualityChange} />
      </Canvas>

      {/* Controls (top-right) */}
      <div className="pv-controls" role="toolbar" aria-label="Project viewer controls">
        <div className="pv-panel" role="group" aria-label="View mode">
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.9, marginRight: 6 }}>View</div>
          <button aria-label="Shaded view" aria-pressed={viewMode === 'shaded'} onClick={() => setViewMode('shaded')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/></svg>
            Shaded
          </button>
          <button aria-label="Wireframe view" aria-pressed={viewMode === 'wireframe'} onClick={() => setViewMode('wireframe')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h18v18H3z" stroke="currentColor" strokeWidth="1.2"/><path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.2"/></svg>
            Wire
          </button>
          <button aria-label="Unlit view" aria-pressed={viewMode === 'unlit'} onClick={() => setViewMode('unlit')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.6"/></svg>
            Unlit
          </button>
        </div>

        <div className="pv-panel pv-presets" role="group" aria-label="Camera presets">
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.9, marginRight: 6 }}>Presets</div>
          <button aria-label="Front view preset" onClick={() => setPreset('front')}>Front</button>
          <button aria-label="Top view preset" onClick={() => setPreset('top')}>Top</button>
          <button aria-label="Side view preset" onClick={() => setPreset('side')}>Side</button>
          <button aria-label="Isometric preset" onClick={() => setPreset('iso')}>Iso</button>
        </div>

        <div className="pv-panel pv-details-toggle" role="group" aria-label="Details toggle">
          <label style={{ fontSize: 12, fontWeight: 400, marginRight: 6 }}>Details</label>
          <button aria-label="Toggle details" aria-pressed={showDetails} onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v20" stroke="currentColor" strokeWidth="1.6"/><path d="M2 12h20" stroke="currentColor" strokeWidth="1.6"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Quality indicator (top-left) */}
      <div style={{ 
        position: 'absolute', 
        top: 18, 
        left: 18, 
        zIndex: 30,
        background: 'rgba(6,8,12,0.7)',
        color: quality === 'high' ? '#79ffe1' : '#ffaa44',
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
      </div>

      {/* Simple info panel */}
      <div className="pv-info" style={{ position: 'absolute', right: 18, bottom: 18, zIndex: 30, maxWidth: 420 }}>
        {activeHotspot ? (
          <div style={{ background: 'rgba(6,8,12,0.9)', color: '#fff', padding: 14, borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}>
            <div className="title" style={{ fontWeight: 400, fontSize: 16 }}>{project.hotspots.find(h => h.id === activeHotspot)?.title}</div>
            <div style={{ marginTop: 6, color: '#c7d6e6', fontSize: 13 }}>{project.hotspots.find(h => h.id === activeHotspot)?.desc}</div>
            {showDetails && (
              <div className="details" style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                <img src="/assets/hotspot-sample.jpg" alt="detail" />
                <div style={{ fontSize: 13, color: '#c7d6e6' }}>
                  <div style={{ fontWeight: 400, marginBottom: 6 }}>More details</div>
                  <div>Material samples, links and downloadable sheets live here. Use this area for richer content.</div>
                  <a href="#" style={{ color: '#79ffe1', display: 'inline-block', marginTop: 8 }}>View spec sheet</a>
                </div>
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button 
                onClick={handleClose} 
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 6, 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  background: 'rgba(255,255,255,0.05)', 
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(6,8,12,0.6)', color: '#e6f0ff', padding: 10, borderRadius: 8, fontSize: 13, backdropFilter: 'blur(8px)' }}>
            💡 Click hotspots to learn more
          </div>
        )}
      </div>
    </div>
  )
}

// Note: if you use TypeScript you can convert this file to .tsx and add types.
