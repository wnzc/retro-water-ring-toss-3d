
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface WaterGameProps {
  leftActive: boolean;
  rightActive: boolean;
  onWin?: () => void;
}

// Physics Constants
const RING_COUNT = 8; // 稍微减少数量提升可玩性，避免过度拥挤
const GRAVITY = -0.0035; 
const BUOYANCY = 0.0032; 
const WATER_DRAG = 0.94; 
const PUSH_FORCE = 0.016; 
const ROTATION_DRAG = 0.96;
const TANK_SIZE = 10;
const NEEDLE_RADIUS = 0.12;
const NEEDLE_HEIGHT = 5.5;
const RING_RADIUS = 0.52; 
const RING_THICKNESS = 0.15;
const COLLISION_RADIUS = (RING_RADIUS + RING_THICKNESS) * 1.1;

interface RingState {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  isHooked: boolean;
  hookedTo: 'left' | 'right' | null;
}

const WaterGame: React.FC<WaterGameProps> = ({ leftActive, rightActive, onWin }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const winTriggeredRef = useRef(false);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    rings: RingState[];
    bubbles: THREE.Mesh[];
    leftActive: boolean;
    rightActive: boolean;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb3e5fc);

    const aspect = 1;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    camera.position.z = 25;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientWidth);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5);
    pointLight.position.set(5, 10, 15);
    scene.add(pointLight);

    const needleGeo = new THREE.CylinderGeometry(NEEDLE_RADIUS, NEEDLE_RADIUS, NEEDLE_HEIGHT, 16);
    const needleMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 150 });
    const baseGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.5, 24);
    const baseMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 60 });

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

    const rings: RingState[] = [];
    const ringColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xffa500, 0x800080];
    
    for (let i = 0; i < RING_COUNT; i++) {
      const ringGeo = new THREE.TorusGeometry(RING_RADIUS, RING_THICKNESS, 16, 32);
      const ringMat = new THREE.MeshPhongMaterial({ color: ringColors[i % ringColors.length], shininess: 100 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      
      ringMesh.position.set(
        (Math.random() - 0.5) * 8,
        -2 + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1.5
      );
      ringMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      
      scene.add(ringMesh);
      rings.push({
        mesh: ringMesh,
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05
        ),
        isHooked: false,
        hookedTo: null
      });
    }

    const bubbles: THREE.Mesh[] = [];
    const bubbleGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });

    sceneRef.current = { scene, camera, renderer, rings, bubbles, leftActive: false, rightActive: false };

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!sceneRef.current) return;

      const { rings, leftActive, rightActive, bubbles } = sceneRef.current;

      let hookedCount = 0;

      rings.forEach((ring, idx) => {
        if (ring.isHooked) {
          hookedCount++;
          const targetX = ring.hookedTo === 'left' ? -2.5 : 2.5;
          const baseY = -3.4; 
          
          ring.mesh.position.x += (targetX - ring.mesh.position.x) * 0.15;
          ring.mesh.position.z += (0 - ring.mesh.position.z) * 0.15;
          
          let floorY = baseY;
          rings.forEach((other, otherIdx) => {
            if (otherIdx !== idx && other.isHooked && other.hookedTo === ring.hookedTo) {
              const dist = ring.mesh.position.y - other.mesh.position.y;
              if (dist > -0.1 && dist < RING_THICKNESS * 2.5) {
                floorY = Math.max(floorY, other.mesh.position.y + RING_THICKNESS * 2.1);
              }
            }
          });

          if (ring.mesh.position.y > floorY) {
            ring.mesh.position.y += GRAVITY * 0.8;
          } else {
            ring.mesh.position.y = floorY;
            ring.velocity.set(0, 0, 0);
          }

          ring.mesh.rotation.x += (Math.PI / 2 - ring.mesh.rotation.x) * 0.12;
          ring.mesh.rotation.y *= 0.8;
          ring.mesh.rotation.z *= 0.8;
          return;
        }

        const force = new THREE.Vector3(0, GRAVITY + BUOYANCY, 0);

        if (leftActive || rightActive) {
          const vortex = new THREE.Vector3();
          if (leftActive) {
             vortex.set(ring.mesh.position.y * 0.35, -ring.mesh.position.x * 0.35, 0).normalize().multiplyScalar(PUSH_FORCE);
          } else {
             vortex.set(-ring.mesh.position.y * 0.35, ring.mesh.position.x * 0.35, 0).normalize().multiplyScalar(PUSH_FORCE);
          }
          force.add(vortex);
          force.x += (Math.random() - 0.5) * 0.004;
          force.y += (Math.random() - 0.5) * 0.004;
          ring.angularVelocity.x += (Math.random() - 0.5) * 0.01;
          ring.angularVelocity.y += (Math.random() - 0.5) * 0.01;
        }

        ring.velocity.add(force);
        ring.velocity.multiplyScalar(WATER_DRAG);
        ring.mesh.position.add(ring.velocity);

        ring.angularVelocity.multiplyScalar(ROTATION_DRAG);
        ring.mesh.rotation.x += ring.angularVelocity.x;
        ring.mesh.rotation.y += ring.angularVelocity.y;
        ring.mesh.rotation.z += ring.angularVelocity.z;

        // --- Ring Collision ---
        for (let j = idx + 1; j < rings.length; j++) {
          const other = rings[j];
          if (other.isHooked) continue;

          const diff = new THREE.Vector3().subVectors(ring.mesh.position, other.mesh.position);
          const distance = diff.length();
          const minDistance = COLLISION_RADIUS * 1.5;

          if (distance < minDistance) {
            const overlap = minDistance - distance;
            const pushDir = diff.normalize();
            const push = pushDir.clone().multiplyScalar(overlap * 0.3);
            ring.mesh.position.add(push);
            other.mesh.position.sub(push);
            
            const vRel = new THREE.Vector3().subVectors(ring.velocity, other.velocity);
            const dot = vRel.dot(pushDir);
            if (dot < 0) {
              const impulse = pushDir.multiplyScalar(dot * 0.6);
              ring.velocity.sub(impulse);
              other.velocity.add(impulse);
            }
          }
        }

        // --- Boundary Check ---
        const hX = TANK_SIZE / 2 - RING_RADIUS;
        const hY = TANK_SIZE / 2 - RING_RADIUS;
        const hZ = 1.4 - RING_THICKNESS;

        if (Math.abs(ring.mesh.position.x) > hX) {
          ring.mesh.position.x = Math.sign(ring.mesh.position.x) * hX;
          ring.velocity.x *= -0.4;
        }
        if (Math.abs(ring.mesh.position.y) > hY) {
          ring.mesh.position.y = Math.sign(ring.mesh.position.y) * hY;
          ring.velocity.y *= -0.4;
        }
        if (Math.abs(ring.mesh.position.z) > hZ) {
          ring.mesh.position.z = Math.sign(ring.mesh.position.z) * hZ;
          ring.velocity.z *= -0.4;
        }

        // --- Hooking Logic ---
        [-2.5, 2.5].forEach((nx, nidx) => {
          const side = nidx === 0 ? 'left' : 'right';
          const dx = ring.mesh.position.x - nx;
          const dz = ring.mesh.position.z;
          const distToAxis = Math.sqrt(dx * dx + dz * dz);
          const needleTopY = 1.7; 
          const needleBottomY = -3.8;

          const isNearAxis = distToAxis < (NEEDLE_RADIUS + RING_RADIUS * 0.45); 
          const isInYRange = ring.mesh.position.y < needleTopY && ring.mesh.position.y > needleBottomY;
          const rotX = Math.abs(ring.mesh.rotation.x % Math.PI);
          const isThreadableAngle = Math.abs(rotX - Math.PI/2) < 1.35;

          if (isNearAxis && isInYRange && isThreadableAngle) {
            const isFalling = ring.velocity.y < 0;
            if (isFalling || distToAxis < NEEDLE_RADIUS || Math.random() < 0.1) {
              ring.isHooked = true;
              ring.hookedTo = side as 'left' | 'right';
              ring.velocity.set(0, 0, 0);
              ring.angularVelocity.set(0, 0, 0);
            }
          }
        });
      });

      // Win Condition Check
      if (hookedCount === RING_COUNT && !winTriggeredRef.current) {
        winTriggeredRef.current = true;
        onWin?.();
      }

      if ((leftActive || rightActive) && Math.random() < 0.3) {
        const b = new THREE.Mesh(bubbleGeo, bubbleMat.clone());
        const sX = leftActive ? -4.5 : 4.5;
        b.position.set(sX, -4.8, (Math.random() - 0.5) * 3);
        scene.add(b);
        bubbles.push(b);
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.position.y += 0.16;
        b.position.x += (Math.random() - 0.5) * 0.06;
        if (b.position.y > 6) {
          scene.remove(b);
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
