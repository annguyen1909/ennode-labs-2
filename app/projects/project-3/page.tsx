"use client"

import React from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Environment, Lightformer, ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, LUT } from '@react-three/postprocessing'
import { useControls, Leva } from 'leva'
import * as THREE from 'three'
import { applyProps } from '@react-three/fiber'
import { useMemo } from 'react'
import { LUTCubeLoader } from 'three/examples/jsm/Addons.js'

function Effects() {
    const lutResult = useLoader(LUTCubeLoader, '/models/F-6800-STD.cube')
    const { enabled, ...props } = useControls({
        enabled: true,
        temporalResolve: true,
        STRETCH_MISSED_RAYS: true,
        USE_MRT: true,
        USE_NORMALMAP: true,
        USE_ROUGHNESSMAP: true,
        ENABLE_JITTERING: true,
        ENABLE_BLUR: true,
        DITHERING: false,
        temporalResolveMix: { value: 0.9, min: 0, max: 1 },
        temporalResolveCorrectionMix: { value: 0.4, min: 0, max: 1 },
        maxSamples: { value: 0, min: 0, max: 1 },
        resolutionScale: { value: 1, min: 0, max: 1 },
        blurMix: { value: 0.2, min: 0, max: 1 },
        blurKernelSize: { value: 8, min: 0, max: 8 },
        BLUR_EXPONENT: { value: 10, min: 0, max: 20 },
        rayStep: { value: 0.5, min: 0, max: 1 },
        intensity: { value: 2.5, min: 0, max: 5 },
        maxRoughness: { value: 1, min: 0, max: 1 },
        jitter: { value: 0.3, min: 0, max: 5 },
        jitterSpread: { value: 0.25, min: 0, max: 1 },
        jitterRough: { value: 0.1, min: 0, max: 1 },
        roughnessFadeOut: { value: 1, min: 0, max: 1 },
        rayFadeOut: { value: 0, min: 0, max: 1 },
        MAX_STEPS: { value: 20, min: 0, max: 20 },
        NUM_BINARY_SEARCH_STEPS: { value: 6, min: 0, max: 10 },
        maxDepthDifference: { value: 5, min: 0, max: 10 },
        maxDepth: { value: 1, min: 0, max: 1 },
        thickness: { value: 3, min: 0, max: 10 },
        ior: { value: 1.45, min: 0, max: 2 }
    })

    return (
        enabled && (
            <EffectComposer enableNormalPass>
                <Bloom luminanceThreshold={0.2} mipmapBlur luminanceSmoothing={0} intensity={1.75} />
                <LUT lut={lutResult.texture3D} />
            </EffectComposer>
        )
    )
}

export function Lamborghini(props: any) {
    const { scene, nodes, materials } = useGLTF('/models/lambo.glb') as any
    useMemo(() => {
        try {
            Object.values(nodes).forEach((node: any) => {
                if (node.isMesh) {
                    if (node.name.startsWith('glass')) node.geometry.computeVertexNormals()
                    if (node.name === 'silver_001_BreakDiscs_0') node.material = applyProps(materials.BreakDiscs.clone(), { color: '#ddd' })
                }
            })

            if (nodes['glass_003']) nodes['glass_003'].scale.setScalar(2.7)
            if (materials.FrameBlack) applyProps(materials.FrameBlack, { metalness: 0.75, roughness: 0, color: 'black' })
            if (materials.Chrome) applyProps(materials.Chrome, { metalness: 1, roughness: 0, color: '#333' })
            if (materials.BreakDiscs) applyProps(materials.BreakDiscs, { metalness: 0.2, roughness: 0.2, color: '#555' })
            if (materials.TiresGum) applyProps(materials.TiresGum, { metalness: 0, roughness: 0.4, color: '#181818' })
            if (materials.GreyElements) applyProps(materials.GreyElements, { metalness: 0, color: '#292929' })
            if (materials.emitbrake) applyProps(materials.emitbrake, { emissiveIntensity: 3, toneMapped: false })
            if (materials.LightsFrontLed) applyProps(materials.LightsFrontLed, { emissiveIntensity: 3, toneMapped: false })
            if (nodes.yellow_WhiteCar_0) nodes.yellow_WhiteCar_0.material = new THREE.MeshPhysicalMaterial({
                roughness: 0.3,
                metalness: 0.05,
                color: '#111',
                envMapIntensity: 0.75,
                clearcoatRoughness: 0,
                clearcoat: 1
            })
        } catch (e) {
            // ignore errors during material fixes
        }
    }, [nodes, materials])
    return <primitive object={scene} {...props} />
}

export default function Project3Page() {
    return (
        <main style={{ width: '100%', height: '100vh', background: '#15151a' }}>
            <Leva hidden />
            <Canvas gl={{ logarithmicDepthBuffer: true, antialias: false }} dpr={[1, 1.5]} camera={{ position: [0, 0, 15], fov: 25 }}>
                <color attach="background" args={["#15151a"]} />
                <Lamborghini rotation={[0, Math.PI / 1.5, 0]} scale={0.015} />
                <hemisphereLight intensity={0.5} />
                <ContactShadows resolution={1024} frames={1} position={[0, -1.16, 0]} scale={15} blur={0.5} opacity={1} far={20} />
                <mesh scale={4} position={[3, -1.161, -1.5]} rotation={[-Math.PI / 2, 0, Math.PI / 2.5]}>
                    <ringGeometry args={[0.9, 1, 4, 1]} />
                    <meshStandardMaterial color="white" roughness={0.75} />
                </mesh>
                <mesh scale={4} position={[-3, -1.161, -1]} rotation={[-Math.PI / 2, 0, Math.PI / 2.5]}>
                    <ringGeometry args={[0.9, 1, 3, 1]} />
                    <meshStandardMaterial color="white" roughness={0.75} />
                </mesh>
                <Environment resolution={512}>
                    <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, -9]} scale={[10, 1, 1]} />
                    <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, -6]} scale={[10, 1, 1]} />
                    <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, -3]} scale={[10, 1, 1]} />
                    <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, 0]} scale={[10, 1, 1]} />
                    <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, 3]} scale={[10, 1, 1]} />
                    <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, 6]} scale={[10, 1, 1]} />
                    <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, 9]} scale={[10, 1, 1]} />
                    <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-50, 2, 0]} scale={[100, 2, 1]} />
                    <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[50, 2, 0]} scale={[100, 2, 1]} />
                    <Lightformer form="ring" color="red" intensity={10} scale={2} position={[10, 5, 10]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
                </Environment>
                <Effects />
                <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 2.2} maxPolarAngle={Math.PI / 2.2} />
            </Canvas>
        </main>
    )
}
