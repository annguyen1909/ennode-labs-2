"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

type SpineProps = {
  coverProgress?: number;
};

export default function Spine({ coverProgress = 0 }: SpineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState<number | null>(0);
  const coverRef = useRef<number>(coverProgress);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;
    let rafId = 0;

    Promise.all([
      import("three"),
      // @ts-ignore - Bỏ qua lỗi TypeScript cho module examples
      import("three/examples/jsm/loaders/GLTFLoader"),
      // @ts-ignore - Bỏ qua lỗi TypeScript cho module examples
      import("three/examples/jsm/loaders/RGBELoader"),
    ])
      .then(([THREE, gltfMod, rgbeMod]) => {
        if (!mounted) return;
        const { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, Box3, Vector3, Color } = THREE;

  const scene = new Scene();
  // Đặt nền trong suốt để hiển thị Vanta phía sau
  scene.background = null;

        const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10000);

        // Tạo renderer trong suốt để hiển thị nền Vanta
        const renderer = new WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        try {
          // Cải thiện tone và độ sáng
          (renderer as any).toneMapping = (THREE as any).ACESFilmicToneMapping;
          (renderer as any).toneMappingExposure = 2.0; // Tăng exposure để kết quả sáng hơn
          (renderer as any).outputEncoding = (THREE as any).sRGBEncoding;
        } catch (e) {}
        // Đảm bảo canvas lấp đầy container và được bố trí dễ dự đoán
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.top = '0';

        const container = containerRef.current!;
        // Đảm bảo container sẽ định vị canvas absolute
        try { container.style.position = container.style.position || 'relative'; } catch (e) {}
        container.appendChild(renderer.domElement);
        // Xóa trong suốt để Vanta hiển thị
        try { renderer.setClearColor(0x000000, 0); } catch (e) {}

  // Ánh sáng được điều chỉnh cho vẻ tối hơn, bóng hơn: ambient thấp, key mạnh cho điểm sáng specular
  const ambient = new AmbientLight(0xffffff, 0.35);
  scene.add(ambient);
  const dir = new DirectionalLight(0xffffff, 5.2);
  dir.position.set(5, 10, 7.5);
  scene.add(dir);
  // Ánh sáng fill/point được giữ thấp để giữ tông tối trong khi vẫn hiện chi tiết
  const fill = new THREE.PointLight(0xffffff, 0.6);
  fill.position.set(-10, 5, 10);
  scene.add(fill);

        const loader = new gltfMod.GLTFLoader();
        const modelUrl = "/models/Spine.glb";

        // Tải môi trường HDR cố định từ /hdr/env.hdr (đơn giản hóa theo yêu cầu)
        // Nếu tệp luôn tồn tại tại public/hdr/env.hdr, không cần vòng fallback nhiều URL.
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
                // scene.background = envMap; // nếu muốn nền từ HDR
                hdrTex.dispose && hdrTex.dispose();
                pmremGenerator.dispose && pmremGenerator.dispose();
              } catch (e) {}
            },
            undefined,
            () => {
              // HDR load failed; we'll just rely on lights
            }
          );
        } catch (e) {
          // HDR không khả dụng hoặc tải bị lỗi — dựa vào hệ thống đèn
        }

        // Fallback hiển thị trong khi GLTF đang tải (hoặc nếu thất bại)
        const fallbackSize = 1;
        const debugGeo = new THREE.TorusKnotGeometry(Math.max(0.5, fallbackSize), 0.2, 128, 32);
        const debugMat = new THREE.MeshStandardMaterial({ color: 0x9effff, metalness: 0.2, roughness: 0.4 });
        const debugMesh = new THREE.Mesh(debugGeo, debugMat);
        debugMesh.name = 'debug-fallback';
        debugMesh.position.set(0, 0, 0);
        scene.add(debugMesh);

        loader.load(
          modelUrl,
          (gltf: any) => {
            if (!mounted) return;
            const model = gltf.scene || gltf.scenes[0];
            scene.add(model);


            // Căn giữa và khung hình

            // Tính toán kích thước, sau đó căn giữa model để nó nằm quanh gốc tọa độ
            let box = new Box3().setFromObject(model);
            let size = box.getSize(new Vector3());
            const center = box.getCenter(new Vector3());
            model.position.x -= center.x;
            model.position.y -= center.y;
            model.position.z -= center.z;
            // Bây giờ tính lại bounding box chính xác sau khi căn giữa để min/max phản ánh vị trí local mới
            box = new Box3().setFromObject(model);
            const min = box.min;
            const max = box.max;
            size = box.getSize(new Vector3());
            const modelOrigin = new Vector3(0, 0, 0);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;

            // Tính điểm top/bottom từ bounds đã tính lại để camera bắt đầu chính xác ở đỉnh
            // Chúng ta sẽ tính top/bottom ban đầu (chưa shift), sau đó cố ý nâng model lên
            // một phần nhỏ để đỉnh model bắt đầu phía trên section khi nó xuất hiện lần đầu.
            const unshiftedTopY = max.y;
            const unshiftedBottomY = min.y;

            // Chọn khoảng cách camera gần hơn nhiều để zoom vào spine
            const cameraDistance = Math.max(0.6, maxDim * 0.6);
            // Crop chặt hơn: X bên cạnh và Z hơi lùi để model chiếm nhiều khung hình hơn
            const sideX = cameraDistance * 0.45; // Dùng X dựa trên origin (model đã được căn giữa ở 0)
            const backZ = cameraDistance * 0.12;

            // Thu hẹp FOV của camera để có vẻ zoom-in hơn
            camera.fov = 18;
            camera.updateProjectionMatrix();

            // Đặt camera hơi cao hơn đỉnh chưa shift để model không xuất hiện 'ngồi' ở đáy
            camera.position.set(sideX, unshiftedTopY + cameraDistance * 0.15, backZ);
            camera.lookAt(new Vector3(modelOrigin.x, 0, modelOrigin.z));

            // SHIFT: nâng model lên trên một phần chiều cao để đỉnh nằm phía trên section
            // Điều chỉnh phần này (0.0 .. 1.0) để kiểm soát đỉnh ban đầu bị ẩn bao nhiêu.
            const SHIFT_FRACTION = 0.25; // 25% chiều cao model; điều chỉnh nếu cần (ví dụ 0.4 cho offset mạnh hơn)
            const shiftAmount = size.y * SHIFT_FRACTION;
            model.position.y += shiftAmount;

            // Lưu trữ các giá trị này để animation
            (scene as any).userData.spineModel = model;
            // Lưu center dựa trên origin (0,0,0) để lookAt và animation nhất quán
            (scene as any).userData.spineCenter = modelOrigin;
            // Chìa khóa: giữ "start" top ở unshiftedTopY (camera ban đầu nhắm vào đây),
            // nhưng đặt bottom thành unshifted bottom cộng với shift để camera di chuyển
            // xuyên qua toàn bộ model đã shift khi progress đến 1.
            (scene as any).userData.spineTopY = unshiftedTopY;
            (scene as any).userData.spineBottomY = unshiftedBottomY + shiftAmount;
            (scene as any).userData.spineSideX = sideX;
            (scene as any).userData.spineBackZ = backZ;
            (scene as any).userData.spineCameraDistance = cameraDistance;

            // Xóa fallback nếu có
            try { if (debugMesh.parent) scene.remove(debugMesh); } catch (e) {}

            // Làm cho model tối hơn và bóng hơn: điều chỉnh materials
            try {
              model.traverse((obj: any) => {
                if (!obj.isMesh) return;
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach((mat: any) => {
                  if (!mat) return;
                  try {
                    // Ưu tiên giữ textures nhưng thiên về base tối + metalness cao + roughness thấp
                    if (mat.color) {
                      // Làm tối base color trong khi giữ texture maps
                      mat.color.multiplyScalar(0.2);
                    }
                    // Đẩy PBR về phía kim loại bóng
                    if (typeof mat.metalness === 'number') mat.metalness = Math.min(1, (mat.metalness || 0) + 0.85);
                    if (typeof mat.roughness === 'number') mat.roughness = Math.max(0.02, (mat.roughness || 1) * 0.12);
                    // Tăng cường độ phản chiếu môi trường
                    if (typeof mat.envMapIntensity === 'number' || (mat.envMapIntensity === undefined)) mat.envMapIntensity = 1.6;
                    // Tint emissive nhỏ cho chiều sâu (tùy chọn)
                    if (mat.emissive) mat.emissive.multiplyScalar(0.0);
                    mat.needsUpdate = true;
                  } catch (e) {}
                });
              });

              // Thêm ánh sáng spot key sáng để tạo điểm sáng bóng sắc nét
              try {
                const spot = new (THREE as any).SpotLight(0xffffff, 8.0, 0, Math.PI * 0.12, 0.5);
                // Đặt hơi cao và bên cạnh
                spot.position.set(sideX + 1.2, unshiftedTopY + cameraDistance * 0.8, backZ + cameraDistance * 0.4);
                // Nhắm vào origin của model
                const targetObj = new (THREE as any).Object3D();
                targetObj.position.set(0, 0, 0);
                scene.add(targetObj);
                spot.target = targetObj;
                scene.add(spot);
              } catch (e) {}
            } catch (e) {
              // Điều chỉnh material thất bại; tiếp tục một cách khéo léo
            }

            // Tính chiều cao pixel DOM để canvas vừa với model theo chiều dọc
            try {
              // Ước lượng chiều cao view (đơn vị world) tại khoảng cách camera đã chọn
              const fovRad = (camera.fov * Math.PI) / 180;
              const viewHeightWorld = 2 * cameraDistance * Math.tan(fovRad / 2);
              // Kích thước model trong đơn vị world (chiều dọc)
              const modelWorldHeight = size.y || (max.y - min.y) || 1;
              // Phần viewport mà model chiếm
              const fraction = Math.min(1, Math.max(0.1, modelWorldHeight / viewHeightWorld));
              // Tính chiều cao pixel để render model ở phần đó của viewport
              const pixelHeight = Math.max(300, Math.round(fraction * window.innerHeight * 1.15));

              // Giới hạn ở chiều cao viewport
              const finalHeight = Math.min(window.innerHeight, pixelHeight);

              // Áp dụng cho container và renderer
              try {
                container.style.height = `${finalHeight}px`;
                renderer.setSize(container.clientWidth || window.innerWidth, finalHeight);
                // Đảm bảo canvas style khớp
                renderer.domElement.style.height = `${finalHeight}px`;
              } catch (e) {}
            } catch (e) {}

            setProgress(null);
          },
          (xhr: any) => {
            if (!mounted) return;
            if (xhr && xhr.loaded && xhr.total) setProgress(Math.round((xhr.loaded / xhr.total) * 100));
            else setProgress(null);
          },
          (err: any) => {
            console.error("Không thể tải spine:", err);
            setProgress(null);
          }
        );

        

        function onResize() {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener("resize", onResize);

        const animate = () => {
          try {
            const cp = coverRef.current || 0;
            const center = (scene as any).userData.spineCenter || new Vector3(0, 0, 0);
            const topY = (scene as any).userData.spineTopY || center.y + 1;
            const bottomY = (scene as any).userData.spineBottomY || center.y - 1;
            const baseX = (scene as any).userData.spineSideX || center.x + 1;
            const baseZ = (scene as any).userData.spineBackZ || center.z + 1;
            const camDist = (scene as any).userData.spineCameraDistance || 1;

            // Target Y nội suy top->bottom dựa trên cover progress
            const targetY = THREE.MathUtils.lerp(topY, bottomY, cp);

            // Tham số Orbit: quét góc rộng HƠN NHIỀU để chuyển động rõ ràng
            const ORBIT_START = Math.PI * 0.75; // ~135deg
            const ORBIT_END = -Math.PI * 0.75; // ~-135deg (quét tổng cộng 270°)
            const baseRadius = Math.hypot(baseX, baseZ) || camDist;
            // Dolly-in mạnh hơn khi progress tăng
            const targetRadius = baseRadius * (1 - cp * 0.4);
            const targetAngle = THREE.MathUtils.lerp(ORBIT_START, ORBIT_END, cp);

            // Tính target X/Z quanh center sử dụng tọa độ cực
            const targetX = center.x + Math.cos(targetAngle) * targetRadius;
            const targetZ = center.z + Math.sin(targetAngle) * targetRadius;

            // Y theo chuyển động top->bottom nhưng được làm mượt
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.12);

            // Lerp nhanh hơn để camera phản hồi ngay lập tức hơn
            camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.12);
            camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.12);

            // Giữ nhìn vào model nhưng theo Y-progress để view di chuyển xuống spine
            camera.lookAt(new Vector3(center.x, targetY, center.z));
          } catch (e) {}
          renderer.render(scene, camera);
          rafId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
          mounted = false;
          cancelAnimationFrame(rafId);
          window.removeEventListener("resize", onResize);
          try { container.removeChild(renderer.domElement); } catch (e) {}
          try { renderer.dispose(); } catch (e) {}
        };
      })
      .catch((err) => {
        console.error("Không thể tải three/examples cho Spine:", err);
        setProgress(null);
      });

    return () => {};
  }, []);

  // Giữ coverRef đồng bộ với prop
  useEffect(() => {
    coverRef.current = coverProgress;
  }, [coverProgress]);

  return (
    // Section lấp đầy chiều cao viewport để nền Vanta bao phủ toàn bộ khu vực
    // Căn chỉnh items về đầu để canvas model neo vào đỉnh của section này
    <section className="relative w-full h-screen bg-black text-white flex items-start justify-center overflow-hidden">
      
      {/* Canvas model Spine (trong suốt, xếp lớp phía trên Vanta) */}
      <div ref={containerRef} className="w-full" style={{ position: 'relative', top: 0, zIndex: 1 }} />
      
      {progress !== null && (
        <div style={{ position: "absolute", left: 12, top: 12, color: "white", background: "rgba(0,0,0,0.5)", padding: "6px 8px", borderRadius: 6, zIndex: 10 }}>
          Đang tải spine: {progress}%
        </div>
      )}
    </section>
  );
}
