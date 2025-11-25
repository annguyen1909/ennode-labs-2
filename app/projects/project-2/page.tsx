"use client"

import React, { useRef, useReducer, useMemo } from 'react'
import Link from 'next/link'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, MeshTransmissionMaterial, Environment, Lightformer, Html } from '@react-three/drei'
import { CuboidCollider, BallCollider, Physics, RigidBody } from '@react-three/rapier'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { easing } from 'maath'
import * as THREE from 'three'

const accents = ['#4060ff', '#20ffa0', '#800080', '#ffcc00']
const accentNames = ['Cobalt', 'Emerald', 'Purple', 'Gold']

const shuffle = (accent = 0) => [
    { color: '#444', roughness: 0.1 },
    { color: '#444', roughness: 0.75 },
    { color: '#444', roughness: 0.75 },
    { color: 'white', roughness: 0.1 },
    { color: 'white', roughness: 0.75 },
    { color: 'white', roughness: 0.1 },
    { color: accents[accent], roughness: 0.1, accent: true },
    { color: accents[accent], roughness: 0.75, accent: true },
    { color: accents[accent], roughness: 0.1, accent: true }
]

function Connector({ position, children, vec = new THREE.Vector3(), scale, r = THREE.MathUtils.randFloatSpread, accent, ...props }: any) {
    const api = useRef<any>(null)
    const pos = useMemo(() => position || [r(10), r(10), r(10)], [position, r])
    useFrame((state, delta) => {
        delta = Math.min(0.1, delta)
        api.current?.applyImpulse(vec.copy(api.current.translation()).negate().multiplyScalar(0.2))
    })
    return (
        <RigidBody linearDamping={4} angularDamping={1} friction={0.1} position={pos} ref={api} colliders={false}>
            <CuboidCollider args={[0.38, 1.27, 0.38]} />
            <CuboidCollider args={[1.27, 0.38, 0.38]} />
            <CuboidCollider args={[0.38, 0.38, 1.27]} />
            {children ? children : <Model {...props} />}
            {accent && <pointLight intensity={4} distance={2.5} color={props.color} />}
        </RigidBody>
    )
}

function Pointer({ vec = new THREE.Vector3() }) {
    const ref = useRef<any>(null)
    useFrame(({ mouse, viewport }) => {
        ref.current?.setNextKinematicTranslation(vec.set((mouse.x * viewport.width) / 2, (mouse.y * viewport.height) / 2, 0))
    })
    return (
        <RigidBody position={[0, 0, 0]} type="kinematicPosition" colliders={false} ref={ref}>
            <BallCollider args={[1]} />
        </RigidBody>
    )
}

function Model({ children, color = 'white', roughness = 0, ...props }: any) {
    const ref = useRef<any>(null)
    const { nodes, materials } = useGLTF('/models/c-transformed.glb') as any
    useFrame((state, delta) => {
        if (ref.current?.material?.color) {
            easing.dampC(ref.current.material.color, color, 0.2, delta)
        }
    })
    return (
        <mesh ref={ref} castShadow receiveShadow scale={10} geometry={nodes.connector.geometry}>
            <meshStandardMaterial metalness={0.2} roughness={roughness} map={materials.base.map} />
            {children}
        </mesh>
    )
}

function LoadingScreen() {
    return (
        <Html center>
            <div style={{
                background: 'rgba(20, 22, 34, 0.95)',
                padding: '24px 32px',
                borderRadius: 12,
                color: '#e6f0ff',
                textAlign: 'center',
                minWidth: 280,
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>Loading Physics Demo</div>
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
                        width: '60%',
                        background: 'linear-gradient(90deg, #4060ff, #20ffa0)',
                        animation: 'loadPulse 1.5s ease-in-out infinite',
                        boxShadow: '0 0 10px rgba(64, 96, 255, 0.5)'
                    }} />
                </div>
                <style>{`
          @keyframes loadPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}</style>
            </div>
        </Html>
    )
}

function Scene({ accent, onClick }: { accent: number; onClick: () => void }) {
    const connectors = useMemo(() => shuffle(accent), [accent])
    return (
        <Canvas
            onClick={onClick}
            shadows
            dpr={[1, 1.5]}
            gl={{ antialias: false }}
            camera={{ position: [0, 0, 15], fov: 37.5, near: 1, far: 20 }}
            style={{ width: '100%', height: '100%' }}
        >
            <color attach="background" args={['#000']} />
            <ambientLight intensity={0.4} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
            <React.Suspense fallback={<LoadingScreen />}>
                <Physics gravity={[0, 0, 0]}>
                    <Pointer />
                    {connectors.map((props, i) => <Connector key={i} {...props} />)}
                    <Connector position={[10, 10, 5]}>
                        <Model>
                            <MeshTransmissionMaterial clearcoat={1} thickness={0.1} anisotropicBlur={0.1} chromaticAberration={0.1} samples={8} resolution={512} />
                        </Model>
                    </Connector>
                </Physics>
                <EffectComposer enableNormalPass={false} multisampling={8}>
                    <N8AO distanceFalloff={1} aoRadius={1} intensity={4} />
                </EffectComposer>
                <Environment resolution={256}>
                    <group rotation={[-Math.PI / 3, 0, 1]}>
                        <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
                        <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
                        <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={2} />
                        <Lightformer form="circle" intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
                    </group>
                </Environment>
            </React.Suspense>
        </Canvas>
    )
}

export default function PhysicsProjectPage() {
    const [accent, click] = useReducer((state: number) => ++state % accents.length, 0)

    return (
        <main className="w-full min-h-screen bg-[#0a0b12] flex flex-col items-center justify-center py-12 px-4">
            {/* Back Button */}
            <div className="w-full max-w-7xl mb-6">
                <Link 
                    href="/projects"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300 group"
                >
                    <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Projects
                </Link>
            </div>

            {/* Canvas Container */}
            <div className="w-full max-w-7xl h-[75vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#141622]">
                <Scene accent={accent} onClick={click} />
            </div>
        </main>
    )
}