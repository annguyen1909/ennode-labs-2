"use client";

import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ScrollControls, useScroll, useGLTF, Environment } from '@react-three/drei';
import { JSX, useRef, useEffect, useState } from 'react';

type ModelProps = JSX.IntrinsicElements['group'] & { scaleFactor?: number };

function SpineModel(props: ModelProps) {
  const gltf = useGLTF('/models/Spine.glb');
  // Match HeroSection spine scale (1.5)
  try { gltf.scene.scale.setScalar(3); } catch (e) { }
  // Apply material tuning similar to HeroSection
  try {
    gltf.scene.traverse((obj: any) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat: any) => {
        if (!mat) return;
        try {
          if (mat.color) mat.color.multiplyScalar(0.2);
          if (typeof mat.metalness === 'number') mat.metalness = Math.min(1, (mat.metalness || 0) + 0.85);
          if (typeof mat.roughness === 'number') mat.roughness = Math.max(0.02, (mat.roughness || 1) * 0.12);
          if (typeof mat.envMapIntensity === 'number' || mat.envMapIntensity === undefined) mat.envMapIntensity = 2.0;
          if (mat.emissive) mat.emissive.multiplyScalar(0.0);
          mat.needsUpdate = true;
        } catch (e) { }
      });
    });
  } catch (e) { }
  return <primitive object={gltf.scene} {...props} />;
}

function GlobeModel(props: ModelProps) {
  const gltf = useGLTF('/models/Logo.glb');
  // Match HeroSection logo scale (0.78)
  try { gltf.scene.scale.setScalar(0.5); } catch (e) { }
  // Mild material refinement for a crisper logo
  try {
    gltf.scene.traverse((obj: any) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat: any) => {
        if (!mat) return;
        try {
          if (typeof mat.metalness === 'number') mat.metalness = Math.min(1, (mat.metalness || 0.2) + 0.4);
          if (typeof mat.roughness === 'number') mat.roughness = Math.max(0.08, (mat.roughness || 0.8) * 0.6);
          if (typeof mat.envMapIntensity === 'number' || mat.envMapIntensity === undefined) mat.envMapIntensity = 1.8;
          mat.needsUpdate = true;
        } catch (e) { }
      });
    });
  } catch (e) { }
  return <primitive object={gltf.scene} {...props} />;
}

function SceneContent({ externalScrollRef, setPages }: { externalScrollRef?: React.RefObject<number>; setPages?: (p: number) => void }) {
  const scroll = useScroll();
  const { camera } = useThree();
  const globeRef = useRef<THREE.Group>(null);
  const spineRef = useRef<THREE.Group>(null);
  const yawOffsetRef = useRef(0);

  // Dynamic vertical range derived from spine bounding box once loaded
  const topYRef = useRef(5);
  const bottomYRef = useRef(-5);
  const initialPitchRef = useRef<number | null>(null);
  const orbitRadius = 1.4; // orbit radius ~2 units around spine (x,z)
  const revolutions = 2; // complete 4 rounds from top (offset=0) to bottom (offset=1)
  const selfRevolutions = 3; // globe spins 3 times around its own axis over the same scroll
  // Top/bottom rotation targets (radians). Adjust to taste.
  const topRotX = 0; // slight forward tilt at top
  const topRotY = 0; // small roll at top
  const bottomRotX = 0.18; // slight backward tilt at bottom
  const bottomRotY = -0.12; // small roll at bottom
  // Yaw (rotate right) at extremes: negative = turn right. Adjust degrees as needed.
  const extremeYaw = Math.PI / 2; // -30 degrees to the right at extremes
  const accelFactor = 0.25; // acceleration per second
  const damping = 0.12; // camera & globe vertical damping

  // Once both models are loaded, center them and apply HeroSection relative offset.
  useEffect(() => {
    if (!spineRef.current || !globeRef.current) return;
    try {
      // Center logo (globe) by its bounding box
      const logoBox = new THREE.Box3().setFromObject(globeRef.current);
      const logoCenter = logoBox.getCenter(new THREE.Vector3());
      globeRef.current.position.x -= logoCenter.x;
      globeRef.current.position.y -= logoCenter.y;
      globeRef.current.position.z -= logoCenter.z;

      // Compute logo size for offset
      const logoSize = logoBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(logoSize.x, logoSize.y, logoSize.z) || 1;

      // Center spine (remove previous offset so full spine spans scroll range)
      const spineBox = new THREE.Box3().setFromObject(spineRef.current);
      const spineCenter = spineBox.getCenter(new THREE.Vector3());
      spineRef.current.position.x -= spineCenter.x;
      spineRef.current.position.y -= spineCenter.y;
      spineRef.current.position.z -= spineCenter.z;

      // Initial camera framing to match HeroSection (moved further back)
      camera.position.set(0, maxDim * 0.35, maxDim * 3.5);
      // capture initial pitch angle (vertical / horizontal) so we can preserve it
      const horiz = Math.hypot(camera.position.x, camera.position.z) || 1e-6;
      initialPitchRef.current = Math.atan2(camera.position.y - 0, horiz);
      // orient camera to look at spine center initially
      camera.lookAt(0, 0, 0);

      // Derive scroll range from actual (centered) spine height so spine height == full website vertical travel
      // Expand top/bottom by the camera frustum half-height at the camera->spine distance so
      // when the camera moves to top/bottom positions the spine visually meets the viewport edges.
      try {
        const spineCenter = new THREE.Vector3();
        spineBox.getCenter(spineCenter);
        const camPos = camera.position.clone();
        const distance = camPos.distanceTo(spineCenter) || 1e-6;
        const camAny = camera as any;
        const fov = typeof camAny.fov === 'number' ? camAny.fov : 50; // fallback FOV
        const fovRad = (fov * Math.PI) / 180;
        const frustumHalf = Math.tan(fovRad / 2) * distance;
        // marginFactor can be tuned (0.9..1.2). Use 1.0 for accurate fit.
        // We constrain the globe travel inside the spine extents so the spine
        // edges visually align with the viewport. If a small gap remains at
        // the bottom, apply an extra bottomPadFactor to nudge the range lower.
        const marginFactor = 1.0;
        const bottomPadFactor = 0.5; // small extra fraction of frustumHalf to remove bottom gap
        topYRef.current = spineBox.max.y - frustumHalf * marginFactor;
        bottomYRef.current = spineBox.min.y + frustumHalf * (marginFactor + bottomPadFactor);
        // If parent provided setPages, compute an approximate pages value so
        // the native scroll spacer maps 0..1 to the full spine travel.
        try {
          if (setPages) {
            const spineHeight = Math.max(1e-6, spineBox.getSize(new THREE.Vector3()).y);
            // Estimate how many viewports are needed: if spineHeight equals 2*frustumHalf,
            // then one extra viewport (pages=2) is sufficient. Use pages = 1 + spineHeight / (2*frustumHalf)
            const extraViewports = spineHeight / (2 * frustumHalf);
            const computedPages = Math.max(1.5, 1 + extraViewports);
            setPages(computedPages);
          }
        } catch (e) { }
      } catch (e) {
        // fallback if anything goes wrong
        topYRef.current = spineBox.max.y;
        bottomYRef.current = spineBox.min.y;
      }
    } catch (e) { }
  }, [spineRef.current, globeRef.current]);

  useFrame((state, dt) => {
    // Scroll offset 0 -> 1. Prefer external (native) scroll if provided, fall back to internal ScrollControls.
    const offset = externalScrollRef?.current ?? scroll.offset;
    // update debug readout (direct DOM write to avoid React re-renders)
    try {
      const dbg = document.getElementById('spine-scroll-debug');
      if (dbg) dbg.textContent = `scroll: ${offset !== undefined ? offset.toFixed(3) : 'n/a'}`;
    } catch (e) { }

    // Target Y derived from scroll (logo floats between top and bottom of spine)
    const targetY = THREE.MathUtils.lerp(topYRef.current, bottomYRef.current, offset);

    // Camera should only change along Y with scroll; keep X/Z fixed
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 6, dt);
    // Maintain initial pitch while allowing yaw to follow spine: compute look target Y
    try {
      const pitch = initialPitchRef.current ?? 0;
      const horizDist = Math.hypot(camera.position.x, camera.position.z) || 1e-6;
      const lookY = camera.position.y - horizDist * Math.tan(pitch);
      camera.lookAt(0, lookY, 0);
    } catch (e) { }

    // Logo vertical interpolation + scroll-driven orbit
    if (globeRef.current) {
      const currentY = globeRef.current.position.y;
      globeRef.current.position.y = THREE.MathUtils.damp(currentY, targetY, 1 / damping, dt);

      // Scroll-progress-driven orbit angle (no time dependency)
      // Make orbit amplitude go to 0 at scroll extremes so the logo is
      // centered when at the highest (offset=0) and lowest (offset=1) pages.
      const angle = offset * revolutions * Math.PI * 2;
      const cx = spineRef.current ? spineRef.current.position.x : 0;
      const cz = spineRef.current ? spineRef.current.position.z : 0;
      // Parabola factor: 4*o*(1-o) -> 0 at 0 and 1, max 1 at o=0.5
      const orbitFactor = Math.max(0, 4 * offset * (1 - offset));
      const ox = Math.cos(angle) * orbitRadius * orbitFactor;
      const oz = Math.sin(angle) * orbitRadius * orbitFactor;
      // Smoothly move the logo toward the desired orbited position rather
      // than snapping immediately. This avoids twitch when scroll crosses
      // the trigger region. Use a position damping value for smooth onset.
      try {
        const desiredX = cx + ox; // when orbitFactor is 0 this equals cx
        const desiredZ = cz + oz;
        const posDamp = 6; // larger = snappier, smaller = smoother
        globeRef.current.position.x = THREE.MathUtils.damp(
          globeRef.current.position.x,
          desiredX,
          posDamp,
          dt
        );
        globeRef.current.position.z = THREE.MathUtils.damp(
          globeRef.current.position.z,
          desiredZ,
          posDamp,
          dt
        );
      } catch (e) { }

      // Scroll-progress-driven self-rotation (no time dependency)
      const selfAngle = offset * selfRevolutions * Math.PI * 2;
      // Keep Y driven by scroll-based self-rotation
      globeRef.current.rotation.y = selfAngle;

      // Smoothly interpolate X/Z rotation so the logo reaches specific
      // orientations at the top (offset=0) and bottom (offset=1).
      try {
        // target rotations interpolate linearly between top and bottom
        const targetRotX = THREE.MathUtils.lerp(topRotX, bottomRotX, offset);
        const targetRotY = THREE.MathUtils.lerp(topRotY, bottomRotY, offset);
        // damping factor for rotation smoothing (larger = snappier)
        const rotDamp = 6;
        globeRef.current.rotation.x = THREE.MathUtils.damp(
          globeRef.current.rotation.x,
          targetRotX,
          rotDamp,
          dt
        );
        globeRef.current.rotation.z = THREE.MathUtils.damp(
          globeRef.current.rotation.z,
          targetRotY,
          rotDamp,
          dt
        );
      } catch (e) { }
      // Damped yaw offset so logo turns to the right at the top/bottom only.
      // orbitFactor already computed above; use edgeFactor = 1 - orbitFactor (1 at extremes)
      try {
        const edgeFactor = 1 - Math.max(0, 4 * offset * (1 - offset));
        const desiredYawOffset = edgeFactor * extremeYaw;
        const yawDamp = 6;
        yawOffsetRef.current = THREE.MathUtils.damp(yawOffsetRef.current, desiredYawOffset, yawDamp, dt);
      } catch (e) { }
      // Apply combined yaw (self-rotation + extreme offset)
      globeRef.current.rotation.y = selfAngle + (yawOffsetRef.current || 0);
    }

    // Keep spine centered (static). If needed, adjust scale or animations here.
    // Do not forcibly reset spine position each frame (prevents snapping jitter)
  });

  return (
    <group>
      {/* Lighting */}
      <ambientLight intensity={2.0} />
      <hemisphereLight args={[0xffffff, 0x222233, 1.2]} />
      <directionalLight position={[6, 8, 4]} intensity={2.5} castShadow />
      <directionalLight position={[-6, 6, -6]} intensity={0.6} />
      <pointLight position={[0, 4, 6]} intensity={1.6} distance={24} decay={2} />
      <pointLight position={[-4, -2, -4]} intensity={0.85} distance={18} decay={2} />
      <spotLight
        position={[3, 12, 3]}
        angle={Math.PI * 0.2}
        penumbra={0.4}
        intensity={3.0}
        distance={50}
        decay={2}
        castShadow
      />

      {/* Spine stays fixed at origin */}
      <group ref={spineRef}>
        <SpineModel />
      </group>

      {/* Globe orbits spine */}
      <group ref={globeRef}>
        <GlobeModel />
      </group>
    </group>
  );
}

export default function SpineGlobeScene({ pages = 2.5, setPages }: { pages?: number; setPages?: (p: number) => void }) {
  const rootId = 'spine-globe-canvas-root';
  const externalScrollRef = useRef<number>(0);

  // Force the actual canvas DOM element to the expected full-viewport layout.
  // This helps when other global styles accidentally override the Canvas styles.
  useEffect(() => {
    try {
      const root = document.getElementById(rootId);
      if (!root) return;
      const canvas = root.querySelector('canvas');
      if (canvas) {
        Object.assign((canvas as HTMLCanvasElement).style, {
          position: 'fixed',
          inset: '0px',
          width: '100%',
          height: '100%',
          zIndex: '40',
          touchAction: 'pan-y',
          pointerEvents: 'none',
        });
      }

      // Native document scroll -> normalized 0..1 across (pages - 1) viewports
      const onScroll = () => {
        const scrollY = window.scrollY || window.pageYOffset;
        const maxScrollable = Math.max((pages - 1) * window.innerHeight, 1);
        const normalized = Math.min(1, Math.max(0, scrollY / maxScrollable));
        externalScrollRef.current = normalized;
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);

      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    } catch (e) { }
  }, [pages]);
  return (
    <div id={rootId} style={{ width: '100%', position: 'relative', touchAction: 'pan-y' }}>
      <Canvas
        shadows
        camera={{ position: [0, 3.4, 8.5], fov: 95 }}
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
      >
        {/* HDR environment for strong PBR reflections (applies to materials only) */}
        <Environment files="/hdr/env.hdr" background={false} />
        <ScrollControls pages={pages}>
          <SceneContent externalScrollRef={externalScrollRef} setPages={setPages} />
        </ScrollControls>
      </Canvas>
      <style>{`canvas { background: #000; }`}</style>

      {/* Native scroll spacer so mouse wheel/touch scrolls the page and ScrollControls syncs to it */}
      <div style={{ height: `${pages * 100}vh`, width: '1px', pointerEvents: 'auto' }} />
    </div>
  );
}

// Preload models for faster first-frame
useGLTF.preload('/models/Spine.glb');
useGLTF.preload('/models/Logo.glb');
