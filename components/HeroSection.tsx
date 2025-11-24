"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from 'framer-motion'
import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion'
import gsap from 'gsap';

type HeroSectionProps = {
	hidden?: boolean;
	interactable?: boolean;
	coverProgress?: number;
	spineProgress?: number;
	scrollHeight?: number; // multiplier of viewport height (1 = 100vh)
};

export default function HeroSection({ hidden = false, interactable = true, coverProgress = 0, spineProgress = 0, scrollHeight = 2.2 }: HeroSectionProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const uiRef = useRef<HTMLDivElement | null>(null);
	const [progress, setProgress] = useState<number | null>(0);
	const controlsRef = useRef<any>(null);
	const rendererRef = useRef<any>(null);
	const coverRef = useRef<number>(coverProgress);
	const spineRef = useRef<number>(spineProgress);
	const modelSizeRef = useRef<number>(1);
	const runningRef = useRef<boolean>(false);
	const visibleRef = useRef<boolean>(true);
	const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const hoverRef = useRef<boolean>(false);
	const scrollProgressRef = useRef<number>(0);
	const smoothedPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

	// Read OS-level reduced motion preference at component level (hook must be called at top-level)
	const prefersReduced = usePrefersReducedMotion()
	const reduced = prefersReduced

	useEffect(() => {
		if (!containerRef.current) return;

		let mounted = true;
		let rafId = 0;

		// dynamic imports for example modules to avoid build-time typings issues
		Promise.all([
			import("three"),
			// @ts-ignore - examples module may not have typings in this project
			import("three/examples/jsm/loaders/GLTFLoader"),
			// @ts-ignore - examples module may not have typings in this project
			import("three/examples/jsm/controls/OrbitControls"),
			// @ts-ignore
			import("three/examples/jsm/loaders/RGBELoader"),
		])
			.then(([THREE, gltfMod, orbitMod, rgbeMod]) => {
				if (!mounted) return;

				const { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, HemisphereLight, PointLight, Box3, Vector3, Color } = THREE;

				const scene = new Scene();
				// Make background transparent so Vanta FOG shows through
				scene.background = null;

				const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10000);

				const renderer = new WebGLRenderer({ antialias: true, alpha: true });
				// Match canvas to viewport (sticky container height 100vh) to prevent vertical stretching
				renderer.domElement.style.width = '100%';
				renderer.domElement.style.height = '100%';
				renderer.domElement.style.display = 'block';
				renderer.domElement.style.position = 'absolute';
				renderer.domElement.style.left = '0';
				renderer.domElement.style.top = '0';
				// clamp DPR for mobile to reduce GPU/main-thread work
				const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent || "");
				renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 2));
				try {
					(renderer as any).toneMapping = (THREE as any).ACESFilmicToneMapping;
					(renderer as any).toneMappingExposure = 2.2; // slightly brighter
					(renderer as any).outputEncoding = (THREE as any).sRGBEncoding;
				} catch (e) { }
				// Set clear color with transparency
				try { renderer.setClearColor(0x000000, 0); } catch (e) { }

				// Append canvas
				// Append canvas and create a lightweight LQIP overlay
				const container = containerRef.current!;
				try { container.style.position = container.style.position || 'relative'; } catch (e) { }
				try { renderer.setSize(window.innerWidth, window.innerHeight); } catch (e) { renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight); }
				container.appendChild(renderer.domElement);

				// create loading overlay (LQIP-ish) that will smoothly transition away when model loads
				const ov = document.createElement('div');
				ov.style.position = 'absolute';
				ov.style.inset = '0';
				ov.style.zIndex = '5';
				ov.style.display = 'flex';
				ov.style.alignItems = 'center';
				ov.style.justifyContent = 'center';
				ov.style.background = 'linear-gradient(180deg, rgba(8,10,14,0.85), rgba(0,0,0,0.65))';
				ov.style.transition = 'opacity 700ms ease, transform 700ms ease, filter 700ms ease';
				ov.style.opacity = '1';
				ov.style.transform = 'scale(1.04)';
				ov.style.filter = 'blur(6px)';
				container.appendChild(ov);
				overlayRef.current = ov;

				// pointer + hover microinteraction handlers
				function onPointerMove(e: PointerEvent) {
					// ignore pointer moves when interacting with the UI overlay (prevents UI nudging on hover)
					try {
						if (uiRef.current && e.composedPath && e.composedPath().some((n: any) => n === uiRef.current)) return;
						if (uiRef.current && (e.target instanceof Node) && uiRef.current.contains(e.target as Node)) return;
					} catch (err) { }
					const rect = container.getBoundingClientRect();
					const clientX = e.clientX;
					const clientY = e.clientY;
					// If model + camera are available, compute pointer relative to model center projected to screen
					try {
						if (modelRef && camera) {
							const worldPos = new (THREE as any).Vector3();
							modelRef.getWorldPosition(worldPos);
							const ndc = worldPos.project(camera);
							// convert NDC (-1..1) to screen coords relative to container
							const modelScreenX = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
							const modelScreenY = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;

							// dx/dy normalized roughly -1..1 (left/right relative to model center)
							let dx = (clientX - modelScreenX) / Math.max(rect.width, 1);
							let dy = (clientY - modelScreenY) / Math.max(rect.height, 1);
							dx = Math.max(-1, Math.min(1, dx * 2));
							dy = Math.max(-1, Math.min(1, dy * 2));
							pointerRef.current.x = dx;
							pointerRef.current.y = dy;
						} else {
							pointerRef.current.x = ((clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
							pointerRef.current.y = ((clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
						}
						// immediate small nudge when direction flips to avoid feeling unresponsive
						const rawSign = Math.sign(pointerRef.current.x || 0);
						const smoothSign = Math.sign(smoothedPointerRef.current.x || 0);
						if (rawSign !== 0 && rawSign !== smoothSign) {
							smoothedPointerRef.current.x = rawSign * 0.06; // small immediate direction nudge
						}
					} catch (e) {
						// fallback: center-based relative pointer
						pointerRef.current.x = ((clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
						pointerRef.current.y = ((clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
					}
				}

				function onPointerEnter() { hoverRef.current = true; }
				function onPointerLeave() { hoverRef.current = false; pointerRef.current.x = 0; pointerRef.current.y = 0; }

				container.addEventListener('pointermove', onPointerMove);
				container.addEventListener('pointerenter', onPointerEnter);
				container.addEventListener('pointerleave', onPointerLeave);

				// reveal-on-scroll: compute a normalized progress for parallax/reveal
				function updateScrollProgress() {
					const rect = container.getBoundingClientRect();
					const winH = window.innerHeight || 1;
					// progress: 0 (offscreen below) -> 1 (centered in view)
					let prog = (winH - rect.top) / (winH + rect.height);
					prog = Math.min(Math.max(prog, 0), 1);
					scrollProgressRef.current = prog;
				}

				window.addEventListener('scroll', updateScrollProgress, { passive: true });
				updateScrollProgress();

				// Basic lighting (brighter for site-wide visibility)
				const ambient = new AmbientLight(0xffffff, 2.0);
				scene.add(ambient);
				const dir = new DirectionalLight(0xffffff, 7.0);
				dir.position.set(5, 10, 7.5);
				scene.add(dir);
				// add a subtle hemisphere for nice rim/sky fill
				try {
					const hemi = new HemisphereLight(0xffffff, 0x222222, 0.45);
					scene.add(hemi);
				} catch (e) { }
				// extra fill point light to brighten model front
				try {
					const fill2 = new PointLight(0xffffff, 1.2);
					fill2.position.set(0, 3, 5);
					scene.add(fill2);
				} catch (e) { }

				// Try to load an HDR environment to enable strong PBR reflections (PMREM)
				try {
					const pmremGenerator = new (THREE as any).PMREMGenerator(renderer);
					pmremGenerator.compileEquirectangularShader?.();
					const rgbeLoader = new (rgbeMod as any).RGBELoader();
					rgbeLoader.load(
						"/hdr/env.hdr",
						(hdrTex: any) => {
							try {
								const envMap = pmremGenerator.fromEquirectangular(hdrTex).texture;
								scene.environment = envMap;
								// do not set background to envMap here so Vanta/other backgrounds still show
								hdrTex.dispose && hdrTex.dispose();
								pmremGenerator.dispose && pmremGenerator.dispose();
							} catch (e) { }
						},
						undefined,
						() => {
							// HDR load failed - continue without env map
						}
					);
				} catch (e) { }

				// Orbit controls for inspection — disable all zoom/dolly inputs so page scroll works
				const controls = new orbitMod.OrbitControls(camera, renderer.domElement);
				controls.enableDamping = true;
				controls.enabled = interactable;
				controls.enableRotate = interactable;
				// disable zoom (wheel/pinch/dolly)
				controls.enableZoom = false;
				controls.enablePan = interactable;

				controlsRef.current = controls;
				rendererRef.current = renderer;

				// Placeholder simple geometry while loading
				const placeholder = new THREE.Mesh(
					new THREE.BoxGeometry(2, 2, 2),
					new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x002222 })
				);
				placeholder.position.set(0, 0, 0);
				scene.add(placeholder);

				let modelRef: any = null;
				let spineModelRef: any = null;
				let initialModelY = 0;
				// reduced motion preference (fallback check inside effect for legacy browsers)
				const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

				// Load GLTF model from public/models/Logo.glb
				const loader = new gltfMod.GLTFLoader();
				const modelUrl = "/models/Logo.glb";
				loader.load(
					modelUrl,
					(gltf: any) => {
						if (!mounted) return;
						// remove placeholder
						try { scene.remove(placeholder); } catch (e) { }

						const model = gltf.scene || gltf.scenes[0];
						scene.add(model);
						modelRef = model;
						initialModelY = model.position.y || 0;

						// compute bounding box and frame camera
						const box = new Box3().setFromObject(model);
						const size = box.getSize(new Vector3());
						const center = box.getCenter(new Vector3());
						const maxDim = Math.max(size.x, size.y, size.z) || 1;
						// remember model size for coordinated animations (used to float into Spine)
						modelSizeRef.current = maxDim;

						model.position.x -= center.x;
						model.position.y -= center.y;
						model.position.z -= center.z;

						camera.position.set(0, maxDim * 0.35, maxDim * 2.2); // farther for smaller on screen
						camera.lookAt(new Vector3(0, 0, 0));

						// shrink logo to avoid vertical stretch perception
						try { model.scale.multiplyScalar(0.78); } catch (e) { }

						// Lock camera distance to prevent zooming in/out beyond the framed position
						try {
							const camDist = camera.position.distanceTo(new Vector3(0, 0, 0));
							controls.minDistance = camDist;
							controls.maxDistance = camDist;
							// Ensure zoom stays disabled and pan is disabled for a constrained experience
							controls.enableZoom = false;
							controls.enablePan = false;
						} catch (e) { }

						setProgress(null); // loaded

						// After logo is loaded, also pre-load the Spine model into the same scene so
						// we can animate the logo floating down into the Spine content.
						try {
							const spineUrl = "/models/Spine.glb";
							loader.load(
								spineUrl,
								(g2: any) => {
									try {
										const spine = g2.scene || g2.scenes[0];
										// center spine model
										const spineBox = new Box3().setFromObject(spine);
										const spineSize = spineBox.getSize(new Vector3());
										const spineCenter = spineBox.getCenter(new Vector3());
										spine.position.x -= spineCenter.x;
										spine.position.y -= spineCenter.y;
										spine.position.z -= spineCenter.z;
										// place spine below the logo initially (distance proportional to model size)
										const offset = (modelSizeRef.current || 1) * 3.6;
										spine.position.y = (initialModelY || 0) - offset;
										// apply material tuning similar to Spine.tsx
										spine.traverse((obj: any) => {
											if (!obj.isMesh) return;
											const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
											mats.forEach((mat: any) => {
												if (!mat) return;
												try {
													if (mat.color) mat.color.multiplyScalar(0.2);
													if (typeof mat.metalness === 'number') mat.metalness = Math.min(1, (mat.metalness || 0) + 0.85);
													if (typeof mat.roughness === 'number') mat.roughness = Math.max(0.02, (mat.roughness || 1) * 0.12);
													if (typeof mat.envMapIntensity === 'number' || mat.envMapIntensity === undefined) mat.envMapIntensity = 1.6;
													if (mat.emissive) mat.emissive.multiplyScalar(0.0);
													mat.needsUpdate = true;
												} catch (e) { }
											});
										});
										// increase the overall spine size for a stronger presence
										try { spine.scale.multiplyScalar(1.5); } catch (e) { }
										// add spot light similar to Spine.tsx for a sharp key
										try {
											const spot = new (THREE as any).SpotLight(0xffffff, 8.0, 0, Math.PI * 0.12, 0.5);
											spot.position.set((modelSizeRef.current || 1) * 0.45 + 1.2, spineBox.max.y + (modelSizeRef.current || 1) * 0.8, (modelSizeRef.current || 1) * 0.4);
											const targetObj = new (THREE as any).Object3D();
											targetObj.position.set(0, 0, 0);
											scene.add(targetObj);
											spot.target = targetObj;
											scene.add(spot);
											// additional subtle fill light to brighten front-facing surfaces (matches Spine.tsx intent)
											try {
												const frontFill = new PointLight(0xffffff, 0.6);
												frontFill.position.set(-10, 5, 10);
												scene.add(frontFill);
											} catch (e) { }
										} catch (e) { }
										spine.visible = true;
										scene.add(spine);
										spineModelRef = spine;
									} catch (e) { console.warn('spine load postprocessing failed', e); }
								},
								undefined,
								(err: any) => {
									console.warn('Failed to load Spine model into Hero scene', err);
								}
							);
						} catch (e) { }
						// animate LQIP overlay out smoothly
						try {
							if (overlayRef.current) {
								overlayRef.current.style.opacity = '0';
								overlayRef.current.style.transform = 'scale(1)';
								overlayRef.current.style.filter = 'blur(0px)';
								setTimeout(() => { try { overlayRef.current?.remove(); } catch (e) { } }, 750);
							}
						} catch (e) { }
					},
					(xhr: any) => {
						if (!mounted) return;
						if (xhr && xhr.loaded && xhr.total) {
							const pct = Math.round((xhr.loaded / xhr.total) * 100);
							setProgress(pct);
						} else {
							setProgress(null);
						}
					},
					(err: any) => {
						console.error("Failed to load model:", err);
						setProgress(null);
					}
				);

				// handle resize
				function onResize() {
					try {
						// Keep renderer at viewport dimensions for consistent aspect
						const w = window.innerWidth;
						const h = window.innerHeight;
						camera.aspect = w / Math.max(1, h);
						camera.updateProjectionMatrix();
						renderer.setSize(w, h);
					} catch (e) {
						camera.aspect = window.innerWidth / window.innerHeight;
						camera.updateProjectionMatrix();
						renderer.setSize(window.innerWidth, window.innerHeight);
					}
				}
				window.addEventListener("resize", onResize);

				// render loop
				let lastTime = performance.now();
				const rotationSpeed = 0.6; // radians per second
				const rotationSpeedBase = reducedMotion ? 0.08 : 0.6; // slower if reduced-motion

				function startLoop() {
					if (runningRef.current) return;
					runningRef.current = true;
					lastTime = performance.now();
					rafId = requestAnimationFrame(animate);
				}

				function stopLoop() {
					try { cancelAnimationFrame(rafId); } catch (e) { }
					runningRef.current = false;
				}

				const animate = () => {
					if (!runningRef.current) return;
					const now = performance.now();
					const dt = Math.max(0.001, (now - lastTime) / 1000);
					lastTime = now;

					// enhanced model motion: autonomous spin + hover microinteraction + reveal parallax
					if (modelRef) {
						// base autonomous rotation
						modelRef.rotation.y += rotationSpeedBase * dt;

						// pointer-driven microrotation (smoothed + per-frame clamp to avoid twitch)
						const rawPx = pointerRef.current.x || 0; // -1..1
						const rawPy = pointerRef.current.y || 0; // -1..1
						const prevSmX = smoothedPointerRef.current.x;
						const prevSmY = smoothedPointerRef.current.y;
						// low-pass filter (lerp) towards raw pointer
						const lpFactor = 0.12; // feel: 0.0 (no movement) -> 1.0 (instant)
						let newSmX = THREE.MathUtils.lerp(prevSmX, rawPx, lpFactor);
						let newSmY = THREE.MathUtils.lerp(prevSmY, rawPy, lpFactor);
						// clamp per-frame delta to avoid sudden jumps when pointer teleports
						const maxDelta = 0.16; // radians-ish per frame cap for smoothing
						const dx = Math.max(Math.min(newSmX - prevSmX, maxDelta), -maxDelta);
						const dy = Math.max(Math.min(newSmY - prevSmY, maxDelta), -maxDelta);
						smoothedPointerRef.current.x = prevSmX + dx;
						smoothedPointerRef.current.y = prevSmY + dy;
						const px = smoothedPointerRef.current.x;
						const py = smoothedPointerRef.current.y;
						const isHover = hoverRef.current;

						const currentRotY = modelRef.rotation.y;
						const targetRotY = currentRotY + px * (isHover ? 0.35 : 0.18);
						modelRef.rotation.y = THREE.MathUtils.lerp(currentRotY, targetRotY, 0.06);

						const targetRotX = py * (isHover ? 0.12 : 0.06);
						modelRef.rotation.x = THREE.MathUtils.lerp(modelRef.rotation.x, targetRotX, 0.06);

						// reveal-on-scroll parallax (vertical) + cover-driven offset
						const scrollProg = scrollProgressRef.current || 0; // 0..1
						const parallax = (scrollProg - 0.5) * -1 * 0.9; // tune strength

						// Compute a target based on whether the Spine model is present in this scene.
						let spineYTarget = 0;
						if (spineModelRef) {
							// target the Y of the spine model plus a small offset so the logo appears to sit above it
							spineYTarget = spineModelRef.position.y + (modelSizeRef.current || 1) * 0.6;
						}

						// Interpolate between the original hero target and the spine target using spine progress
						const heroBase = initialModelY - (coverRef.current || 0) * 2.5 + parallax;
						const s = Math.max(0, Math.min(1, spineRef.current || 0));
						const targetY = THREE.MathUtils.lerp(heroBase, spineYTarget, s);
						modelRef.position.y = THREE.MathUtils.lerp(modelRef.position.y, targetY, 0.12);

						// Keep camera vertically centered on the logo so it stays in the middle of the viewport
						try {
							const followOffset = (modelSizeRef.current || 1) * 0.35;
							camera.position.y = THREE.MathUtils.lerp(camera.position.y, modelRef.position.y + followOffset, 0.12);
							camera.lookAt(new Vector3(0, modelRef.position.y, 0));
						} catch (e) { }

						// hover scale microinteraction
						const targetScale = isHover ? 1.045 : 1.0;
						modelRef.scale.x = THREE.MathUtils.lerp(modelRef.scale.x || 1, targetScale, 0.06);
						modelRef.scale.y = THREE.MathUtils.lerp(modelRef.scale.y || 1, targetScale, 0.06);
						modelRef.scale.z = THREE.MathUtils.lerp(modelRef.scale.z || 1, targetScale, 0.06);
					}

					// controls are present but may be disabled via interactable prop
					try { controls.update(); } catch (e) { }
					renderer.render(scene, camera);
					rafId = requestAnimationFrame(animate);
				};

				// start loop by default if container visible
				startLoop();

				// small per-frame UI parallax update
				function updateUI() {
					if (!uiRef.current) return;
					const prog = scrollProgressRef.current || 0; // 0..1
					const px = (pointerRef.current.x || 0) * 6; // subtle X parallax pixels
					const py = (prog - 0.5) * -18; // Y parallax px
					uiRef.current.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
				}

				const uiRaf = setInterval(updateUI, 1000 / 30); // 30hz light update for UI

				// cleanup
				return () => {
					mounted = false;
					cancelAnimationFrame(rafId);
					window.removeEventListener("resize", onResize);
					// remove pointer/scroll listeners
					try {
						container.removeEventListener('pointermove', onPointerMove as any);
						container.removeEventListener('pointerenter', onPointerEnter as any);
						container.removeEventListener('pointerleave', onPointerLeave as any);
						window.removeEventListener('scroll', updateScrollProgress as any);
					} catch (e) { }
					try { container.removeChild(renderer.domElement); } catch (e) { }
					// dispose renderer if available
					try { renderer.dispose(); } catch (e) { }
					try { clearInterval(uiRaf); } catch (e) { }
				};
			})
			.catch((err) => {
				console.error("three or example modules failed to load:", err);
				setProgress(null);
			});

		return () => {
			mounted = false;
		};
	}, []);

	// Toggle controls / canvas pointer-events when `interactable` changes
	useEffect(() => {
		if (controlsRef.current) {
			controlsRef.current.enabled = interactable;
			controlsRef.current.enableRotate = interactable;
			// keep zoom locked to the framed distance; only toggle rotate/pan per prop
			controlsRef.current.enablePan = interactable;
		}
		if (rendererRef.current) {
			try {
				rendererRef.current.domElement.style.pointerEvents = interactable ? 'auto' : 'none';
			} catch (e) { }
		}
	}, [interactable]);

	// keep coverRef in sync with prop
	useEffect(() => {
		coverRef.current = coverProgress;
	}, [coverProgress]);

	// keep spineRef in sync with prop so animation loop can access it
	useEffect(() => {
		spineRef.current = spineProgress;
	}, [spineProgress]);

	// Ensure the LQIP overlay doesn't block the scene once the user begins scrolling
	useEffect(() => {
		function removeOverlayImmediate() {
			if (!overlayRef.current) return;
			try {
				overlayRef.current.style.opacity = '0';
				overlayRef.current.style.pointerEvents = 'none';
				setTimeout(() => { try { overlayRef.current?.remove(); } catch (e) { } }, 700);
			} catch (e) { }
		}

		// If the cover progress or spine progress has started, remove overlay
		if ((coverProgress || 0) > 0 || (spineProgress || 0) > 0) {
			removeOverlayImmediate();
			return;
		}

		// Otherwise, remove overlay on first user scroll/touch interaction
		function onFirstInteraction() {
			removeOverlayImmediate();
			window.removeEventListener('scroll', onFirstInteraction);
			window.removeEventListener('touchstart', onFirstInteraction);
		}

		window.addEventListener('scroll', onFirstInteraction, { passive: true });
		window.addEventListener('touchstart', onFirstInteraction, { passive: true });

		return () => {
			window.removeEventListener('scroll', onFirstInteraction);
			window.removeEventListener('touchstart', onFirstInteraction);
		};
	}, [coverProgress, spineProgress]);

	return (
		<section
			className={`relative w-full h-screen bg-black overflow-hidden transition-opacity duration-700 ${hidden ? "opacity-0 pointer-events-none" : "opacity-100"}`}
			style={{ height: `${Math.max(1, scrollHeight) * 100}vh`, zIndex: 40, position: 'relative' }}
		>
			{/* Three.js Logo canvas (layered above Vanta) */}
			<div
				ref={containerRef}
				className="w-full h-full"
				style={{
					// Fill the entire section so the canvas matches section height
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					zIndex: 10,
					pointerEvents: hidden ? 'none' : 'auto'
				}}
			/>

		</section>
	);
}
