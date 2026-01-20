
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface WaterGameProps {
  leftActive: boolean;
  rightActive: boolean;
}

// Physics Constants
const RING_COUNT = 12;
const GRAVITY = -0.005; 
const BUOYANCY = 0.0028; 
const WATER_DRAG = 0.95; 
const PUSH_FORCE = 0.015; 
const ROTATION_DRAG = 0.97;
const TANK_SIZE = 10;
const NEEDLE_RADIUS = 0.12;
const NEEDLE_HEIGHT = 5.2;
const RING_RADIUS = 0.55; 
const RING_THICKNESS = 0.14;
// Collision radius is the full diameter of the ring torus volume
const COLLISION_RADIUS = RING_RADIUS + RING_THICKNESS;

interface RingState {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  isHooked: boolean;
  hookedTo: 'left' | 'right' | null;
}

const WaterGame: React.FC<WaterGameProps> = ({ leftActive, rightActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
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

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb3e5fc);

    const aspect = 1;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    camera.position.z = 25;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientWidth);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.2);
    pointLight.position.set(5, 10, 15);
    scene.add(pointLight);

    // --- Needles & Bases ---
    const needleGeo = new THREE.CylinderGeometry(NEEDLE_RADIUS, NEEDLE_RADIUS, NEEDLE_HEIGHT, 16);
    const needleMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 120 });
    
    const baseGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.4, 24);
    const baseMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 40 });

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

    const leftNeedleGroup = createNeedleWithBase(-2.5);
    scene.add(leftNeedleGroup);

    const rightNeedleGroup = createNeedleWithBase(2.5);
    scene.add(rightNeedleGroup);

    // --- Rings ---
    const rings: RingState[] = [];
    const ringColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xffa500, 0x800080, 0xff8888, 0x88ff88, 0x8888ff, 0x333333];
    
    for (let i = 0; i < RING_COUNT; i++) {
      const ringGeo = new THREE.TorusGeometry(RING_RADIUS, RING_THICKNESS, 12, 32);
      const ringMat = new THREE.MeshPhongMaterial({ 
        color: ringColors[i % ringColors.length],
        shininess: 90,
        specular: 0x111111 
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      
      // Better initial spread
      ringMesh.position.set(
        (Math.random() - 0.5) * 8,
        -3 + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1.5
      );
      ringMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      
      scene.add(ringMesh);
      rings.push({
        mesh: ringMesh,
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.04,
          (Math.random() - 0.5) * 0.04,
          (Math.random() - 0.5) * 0.04
        ),
        isHooked: false,
        hookedTo: null
      });
    }

    // --- Bubbles ---
    const bubbles: THREE.Mesh[] = [];
    const bubbleGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });

    sceneRef.current = { scene, camera, renderer, rings, bubbles, leftActive: false, rightActive: false };

    // --- Animation Loop ---
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!sceneRef.current) return;

      const { rings, leftActive, rightActive, bubbles } = sceneRef.current;

      rings.forEach((ring, idx) => {
        if (ring.isHooked) {
          // Hooked logic
          const targetX = ring.hookedTo === 'left' ? -2.5 : 2.5;
          const baseY = -3.4; // Height of the needle base top
          
          ring.mesh.position.x += (targetX - ring.mesh.position.x) * 0.15;
          ring.mesh.position.z += (0 - ring.mesh.position.z) * 0.15;
          
          let floorY = baseY;
          rings.forEach((other, otherIdx) => {
            if (otherIdx !== idx && other.isHooked && other.hookedTo === ring.hookedTo) {
              // If other is directly below this ring
              if (other.mesh.position.y < ring.mesh.position.y + 0.01) {
                floorY = Math.max(floorY, other.mesh.position.y + (RING_THICKNESS * 2.2));
              }
            }
          });

          if (ring.mesh.position.y > floorY) {
            ring.mesh.position.y += GRAVITY * 0.8;
          } else {
            ring.mesh.position.y = floorY;
            ring.velocity.set(0, 0, 0);
          }

          // Orient flat
          ring.mesh.rotation.x += (Math.PI / 2 - ring.mesh.rotation.x) * 0.1;
          ring.mesh.rotation.y *= 0.85;
          ring.mesh.rotation.z *= 0.85;
          return;
        }

        // Apply Forces for free rings
        const force = new THREE.Vector3(0, GRAVITY + BUOYANCY, 0);

        if (leftActive || rightActive) {
          const vortex = new THREE.Vector3();
          if (leftActive) {
             vortex.set(ring.mesh.position.y * 0.4, -ring.mesh.position.x * 0.4, 0).normalize().multiplyScalar(PUSH_FORCE);
          } else {
             vortex.set(-ring.mesh.position.y * 0.4, ring.mesh.position.x * 0.4, 0).normalize().multiplyScalar(PUSH_FORCE);
          }
          force.add(vortex);

          // Turbulence
          force.x += (Math.random() - 0.5) * 0.003;
          force.y += (Math.random() - 0.5) * 0.003;

          ring.angularVelocity.x += (Math.random() - 0.5) * 0.008;
          ring.angularVelocity.y += (Math.random() - 0.5) * 0.008;
        }

        ring.velocity.add(force);
        ring.velocity.multiplyScalar(WATER_DRAG);
        ring.mesh.position.add(ring.velocity);

        ring.angularVelocity.multiplyScalar(ROTATION_DRAG);
        ring.mesh.rotation.x += ring.angularVelocity.x;
        ring.mesh.rotation.y += ring.angularVelocity.y;
        ring.mesh.rotation.z += ring.angularVelocity.z;

        // --- Improved Collision Logic ---
        for (let j = idx + 1; j < rings.length; j++) {
          const other = rings[j];
          if (other.isHooked) continue;

          const diff = new THREE.Vector3().subVectors(ring.mesh.position, other.mesh.position);
          const distance = diff.length();
          // Use a slightly larger collision bubble to prevent visual overlap
          const minDistance = COLLISION_RADIUS * 1.8;

          if (distance < minDistance) {
            // Push apart proportional to depth of overlap (spring force)
            const overlap = minDistance - distance;
            const pushDir = diff.normalize();
            const pushMagnitude = overlap * 0.2; // Strength of repulsion
            
            ring.mesh.position.addScaledVector(pushDir, pushMagnitude);
            other.mesh.position.addScaledVector(pushDir, -pushMagnitude);
            
            // Velocity transfer
            const relativeVelocity = new THREE.Vector3().subVectors(ring.velocity, other.velocity);
            const velocityDot = relativeVelocity.dot(pushDir);
            
            if (velocityDot < 0) {
               const impulse = pushDir.multiplyScalar(velocityDot * 0.5);
               ring.velocity.sub(impulse);
               other.velocity.add(impulse);
            }
          }
        }

        // --- Boundary Check ---
        const hX = TANK_SIZE / 2 - RING_RADIUS;
        const hY = TANK_SIZE / 2 - RING_RADIUS;
        const hZ = 1.3 - RING_THICKNESS;

        if (Math.abs(ring.mesh.position.x) > hX) {
          ring.mesh.position.x = Math.sign(ring.mesh.position.x) * hX;
          ring.velocity.x *= -0.3;
        }
        if (Math.abs(ring.mesh.position.y) > hY) {
          ring.mesh.position.y = Math.sign(ring.mesh.position.y) * hY;
          ring.velocity.y *= -0.3;
        }
        if (Math.abs(ring.mesh.position.z) > hZ) {
          ring.mesh.position.z = Math.sign(ring.mesh.position.z) * hZ;
          ring.velocity.z *= -0.3;
        }

        // --- Hooking Logic (Refined) ---
        [-2.5, 2.5].forEach((nx, nidx) => {
          const side = nidx === 0 ? 'left' : 'right';
          const dx = ring.mesh.position.x - nx;
          const dz = ring.mesh.position.z;
          const distToAxis = Math.sqrt(dx * dx + dz * dz);
          const needleTopY = 1.4;
          const needleBottomY = -3.8;

          // A ring is hooked if:
          // 1. Its center is close to the needle's axis
          // 2. It is vertically within the needle's reachable height
          // 3. It is relatively horizontal (allowing some slant as per request)
          const isNearAxis = distToAxis < (NEEDLE_RADIUS + 0.2); // Slightly more generous radius
          const isInYRange = ring.mesh.position.y < needleTopY && ring.mesh.position.y > needleBottomY;
          
          // Allow up to ~55 degrees of tilt (0.95 radians)
          const currentRotationX = Math.abs(ring.mesh.rotation.x % Math.PI);
          const isHorizontalEnough = Math.abs(currentRotationX - Math.PI/2) < 0.95;

          if (isNearAxis && isInYRange && isHorizontalEnough) {
            // Check probability or just snap if it's very close
            // If it's very close to axis, it should "thread"
            if (distToAxis < (NEEDLE_RADIUS + 0.1) || Math.random() < 0.15) {
              ring.isHooked = true;
              ring.hookedTo = side as 'left' | 'right';
              ring.velocity.set(0, 0, 0);
              ring.angularVelocity.set(0, 0, 0);
            }
          }
        });
      });

      // Bubbles
      if ((leftActive || rightActive) && Math.random() < 0.25) {
        const b = new THREE.Mesh(bubbleGeo, bubbleMat.clone());
        const sX = leftActive ? -4.3 : 4.3;
        b.position.set(sX, -4.8, (Math.random() - 0.5) * 2.5);
        scene.add(b);
        bubbles.push(b);
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.position.y += 0.15;
        b.position.x += (Math.random() - 0.5) * 0.05;
        if (b.position.y > 5.5) {
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
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.leftActive = leftActive;
      sceneRef.current.rightActive = rightActive;
    }
  }, [leftActive, rightActive]);

  return <div ref={containerRef} className="w-full h-full cursor-pointer" />;
};

export default WaterGame;
