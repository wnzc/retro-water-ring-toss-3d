
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface WaterGameProps {
  leftActive: boolean;
  rightActive: boolean;
  onWin?: () => void;
}

// 物理常量 - 经过微调以获得更好的“水感”
const RING_COUNT = 8; 
const GRAVITY = -0.0038;     // 稍强的重力
const BUOYANCY = 0.0035;    // 浮力略小于重力，使圈自然下沉
const WATER_DRAG = 0.94;    // 水阻力
const PUSH_FORCE = 0.022;   // 喷射力量
const ROTATION_DRAG = 0.95; // 旋转阻力
const TANK_SIZE = 10;
const NEEDLE_RADIUS = 0.12;
const NEEDLE_HEIGHT = 5.5;
const RING_RADIUS = 0.52; 
const RING_THICKNESS = 0.15;

// 碰撞体积：由于是圆环，碰撞球半径应包含厚度
const COLLISION_RADIUS = RING_RADIUS + RING_THICKNESS;

interface RingState {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  isHooked: boolean;
  hookedTo: 'left' | 'right' | null;
}

interface BubbleState {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

const WaterGame: React.FC<WaterGameProps> = ({ leftActive, rightActive, onWin }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const winTriggeredRef = useRef(false);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    rings: RingState[];
    bubbles: BubbleState[];
    leftActive: boolean;
    rightActive: boolean;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- 场景初始化 ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb3e5fc);

    const aspect = 1;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    camera.position.z = 25;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientWidth);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // --- 灯光 ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.8);
    pointLight.position.set(5, 10, 15);
    scene.add(pointLight);

    // --- 针和底座 ---
    const needleGeo = new THREE.CylinderGeometry(NEEDLE_RADIUS, NEEDLE_RADIUS, NEEDLE_HEIGHT, 16);
    const needleMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 200, specular: 0x444444 });
    const baseGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.5, 24);
    const baseMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 80 });

    const createNeedleWithBase = (x: number) => {
      const group = new THREE.Group();
      const needle = new THREE.Mesh(needleGeo, needleMat);
      needle.position.y = NEEDLE_HEIGHT / 2;
      group.add(needle);
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0;
      group.add(base);
      group.position.set(x, -3.8, 0);
      return group;
    };

    scene.add(createNeedleWithBase(-2.5));
    scene.add(createNeedleWithBase(2.5));

    // --- 圈圈 ---
    const rings: RingState[] = [];
    const ringColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xffa500, 0x88ffaa];
    
    for (let i = 0; i < RING_COUNT; i++) {
      const ringGeo = new THREE.TorusGeometry(RING_RADIUS, RING_THICKNESS, 16, 32);
      const ringMat = new THREE.MeshPhongMaterial({ 
        color: ringColors[i % ringColors.length], 
        shininess: 120,
        specular: 0x222222
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      
      // 初始分散位置
      ringMesh.position.set(
        (Math.random() - 0.5) * 7,
        -1 + (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 1.5
      );
      ringMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      
      scene.add(ringMesh);
      rings.push({
        mesh: ringMesh,
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.06,
          (Math.random() - 0.5) * 0.06,
          (Math.random() - 0.5) * 0.06
        ),
        isHooked: false,
        hookedTo: null
      });
    }

    // --- 气泡素材 ---
    const bubbles: BubbleState[] = [];
    const bubbleGeo = new THREE.SphereGeometry(1, 8, 8); // 基础几何体，渲染时缩放

    sceneRef.current = { scene, camera, renderer, rings, bubbles, leftActive: false, rightActive: false };

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!sceneRef.current) return;

      const { rings, leftActive, rightActive, bubbles, scene } = sceneRef.current;

      let hookedCount = 0;

      // --- 物理更新循环 ---
      rings.forEach((ring, idx) => {
        if (ring.isHooked) {
          hookedCount++;
          // 已套中的逻辑：吸附在针上，受重力堆叠
          const targetX = ring.hookedTo === 'left' ? -2.5 : 2.5;
          const baseY = -3.4; // 底座顶部高度
          
          ring.mesh.position.x += (targetX - ring.mesh.position.x) * 0.2;
          ring.mesh.position.z += (0 - ring.mesh.position.z) * 0.2;
          
          let floorY = baseY;
          rings.forEach((other, otherIdx) => {
            if (otherIdx !== idx && other.isHooked && other.hookedTo === ring.hookedTo) {
              const dist = ring.mesh.position.y - other.mesh.position.y;
              // 如果另一个圈在下方，则堆叠在其上
              if (dist > -0.01 && dist < RING_THICKNESS * 2.8) {
                floorY = Math.max(floorY, other.mesh.position.y + RING_THICKNESS * 2.2);
              }
            }
          });

          if (ring.mesh.position.y > floorY) {
            ring.mesh.position.y += GRAVITY * 0.5;
          } else {
            ring.mesh.position.y = floorY;
            ring.velocity.set(0, 0, 0);
          }

          // 保持水平旋转
          ring.mesh.rotation.x += (Math.PI / 2 - ring.mesh.rotation.x) * 0.15;
          ring.mesh.rotation.y *= 0.8;
          ring.mesh.rotation.z *= 0.8;
          return;
        }

        // --- 自由移动物理 ---
        const force = new THREE.Vector3(0, GRAVITY + BUOYANCY, 0);

        if (leftActive || rightActive) {
          // 水流涡旋力量
          const vortex = new THREE.Vector3();
          // 这里的逻辑根据按钮产生方向性水流
          if (leftActive) {
             // 顺时针水流：底部向右喷，产生环绕力
             vortex.set(ring.mesh.position.y * 0.4, -ring.mesh.position.x * 0.4, 0).normalize().multiplyScalar(PUSH_FORCE);
          } else {
             // 逆时针
             vortex.set(-ring.mesh.position.y * 0.4, ring.mesh.position.x * 0.4, 0).normalize().multiplyScalar(PUSH_FORCE);
          }
          force.add(vortex);
          
          // 增加随机扰动
          force.x += (Math.random() - 0.5) * 0.005;
          force.y += (Math.random() - 0.5) * 0.005;
          
          ring.angularVelocity.x += (Math.random() - 0.5) * 0.012;
          ring.angularVelocity.y += (Math.random() - 0.5) * 0.012;
        }

        ring.velocity.add(force);
        ring.velocity.multiplyScalar(WATER_DRAG);
        ring.mesh.position.add(ring.velocity);

        ring.angularVelocity.multiplyScalar(ROTATION_DRAG);
        ring.mesh.rotation.x += ring.angularVelocity.x;
        ring.mesh.rotation.y += ring.angularVelocity.y;
        ring.mesh.rotation.z += ring.angularVelocity.z;

        // --- 强化圈与圈碰撞 ---
        for (let j = idx + 1; j < rings.length; j++) {
          const other = rings[j];
          if (other.isHooked) continue;

          const diff = new THREE.Vector3().subVectors(ring.mesh.position, other.mesh.position);
          const distance = diff.length();
          const minDistance = COLLISION_RADIUS * 1.6; // 稍微扩大判定防止视觉重叠

          if (distance < minDistance) {
            const overlap = minDistance - distance;
            const pushDir = diff.normalize();
            const push = pushDir.clone().multiplyScalar(overlap * 0.4);
            ring.mesh.position.add(push);
            other.mesh.position.sub(push);
            
            const vRel = new THREE.Vector3().subVectors(ring.velocity, other.velocity);
            const dot = vRel.dot(pushDir);
            if (dot < 0) {
              const impulse = pushDir.multiplyScalar(dot * 0.7);
              ring.velocity.sub(impulse);
              other.velocity.add(impulse);
            }
          }
        }

        // --- 边界检查 ---
        const hX = TANK_SIZE / 2 - RING_RADIUS;
        const hY = TANK_SIZE / 2 - RING_RADIUS;
        const hZ = 1.3 - RING_THICKNESS;

        if (Math.abs(ring.mesh.position.x) > hX) {
          ring.mesh.position.x = Math.sign(ring.mesh.position.x) * hX;
          ring.velocity.x *= -0.5;
        }
        if (Math.abs(ring.mesh.position.y) > hY) {
          ring.mesh.position.y = Math.sign(ring.mesh.position.y) * hY;
          ring.velocity.y *= -0.5;
        }
        if (Math.abs(ring.mesh.position.z) > hZ) {
          ring.mesh.position.z = Math.sign(ring.mesh.position.z) * hZ;
          ring.velocity.z *= -0.5;
        }

        // --- 套中判定 ---
        [-2.5, 2.5].forEach((nx, nidx) => {
          const side = nidx === 0 ? 'left' : 'right';
          const dx = ring.mesh.position.x - nx;
          const dz = ring.mesh.position.z;
          const distToAxis = Math.sqrt(dx * dx + dz * dz);
          const needleTopY = 1.6; 
          
          // 只要中心足够接近针轴，且在针的高度范围内，且姿态接近水平
          const isNearAxis = distToAxis < (NEEDLE_RADIUS + RING_RADIUS * 0.5); 
          const isInYRange = ring.mesh.position.y < needleTopY && ring.mesh.position.y > -3.5;
          const rotX = Math.abs(ring.mesh.rotation.x % Math.PI);
          const isThreadableAngle = Math.abs(rotX - Math.PI/2) < 1.3;

          if (isNearAxis && isInYRange && isThreadableAngle) {
            // 下落过程中更容易套中
            if (ring.velocity.y < 0 || distToAxis < NEEDLE_RADIUS || Math.random() < 0.05) {
              ring.isHooked = true;
              ring.hookedTo = side as 'left' | 'right';
              ring.velocity.set(0, 0, 0);
              ring.angularVelocity.set(0, 0, 0);
            }
          }
        });
      });

      // 胜利检测
      if (hookedCount === RING_COUNT && !winTriggeredRef.current) {
        winTriggeredRef.current = true;
        onWin?.();
      }

      // --- 气泡系统更新 ---
      if (leftActive || rightActive) {
        // 每次按下按钮时喷出一簇小气泡
        const burstCount = 2;
        for (let k = 0; k < burstCount; k++) {
          const size = 0.05 + Math.random() * 0.12;
          const bMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.3 + Math.random() * 0.3 
          });
          const bMesh = new THREE.Mesh(bubbleGeo, bMat);
          bMesh.scale.set(size, size, size);
          
          const startX = leftActive ? -4.2 : 4.2;
          bMesh.position.set(startX + (Math.random() - 0.5), -4.8, (Math.random() - 0.5) * 3);
          
          scene.add(bMesh);
          bubbles.push({
            mesh: bMesh,
            velocity: new THREE.Vector3(
              (leftActive ? 1 : -1) * (0.02 + Math.random() * 0.04), 
              0.1 + Math.random() * 0.1, 
              (Math.random() - 0.5) * 0.05
            ),
            life: 1.0
          });
        }
      }

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.mesh.position.add(b.velocity);
        b.velocity.y += 0.002; // 气泡上升加速度
        b.mesh.position.x += Math.sin(Date.now() * 0.01 + i) * 0.02; // 左右晃动
        
        b.life -= 0.01;
        if (b.mesh.position.y > 6 || b.life <= 0) {
          scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          (b.mesh.material as THREE.Material).dispose();
          bubbles.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, [onWin]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.leftActive = leftActive;
      sceneRef.current.rightActive = rightActive;
    }
  }, [leftActive, rightActive]);

  return <div ref={containerRef} className="w-full h-full cursor-pointer" />;
};

export default WaterGame;
