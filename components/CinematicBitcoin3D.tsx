"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Text } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";


/* =========================================================
   MATERIAL COLORS
========================================================= */

const GOLD = "#f5a20b";
const GOLD_LIGHT = "#ffd45c";
const GOLD_DARK = "#8b4300";

const BLUE = "#21baff";
const CYAN = "#79e7ff";
const ORANGE = "#ff9d22";


/* =========================================================
   MAIN BITCOIN
========================================================= */

function DetailedBitcoin() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;

    const time = state.clock.elapsedTime;

    /*
      IMPORTANT:
      We do NOT continuously rotate the Bitcoin around Y.

      This keeps the Bitcoin face visible like the reference.
    */

    group.current.rotation.x =
      -0.08 + Math.sin(time * 0.55) * 0.025;

    group.current.rotation.y =
      -0.20 + Math.sin(time * 0.42) * 0.06;

    group.current.rotation.z =
      -0.08 + Math.sin(time * 0.32) * 0.015;

    group.current.position.y =
      Math.sin(time * 0.7) * 0.055;
  });

  return (
    <group
      ref={group}
      scale={1.05}
    >

      {/* =====================================================
          THICK COIN BODY

          Cylinder normally points along Y.
          Rotate X 90deg so circular face points toward camera.
      ===================================================== */}

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[
            1.48,
            1.48,
            0.30,
            96,
            1,
            false,
          ]}
        />

        <meshStandardMaterial
          color={GOLD_DARK}
          metalness={1}
          roughness={0.18}
        />
      </mesh>


      {/* =====================================================
          OUTER FRONT GOLD FACE
      ===================================================== */}

      <mesh position={[0, 0, 0.158]}>
        <circleGeometry args={[1.45, 96]} />

        <meshStandardMaterial
          color={GOLD}
          metalness={0.96}
          roughness={0.16}
        />
      </mesh>


      {/* =====================================================
          DARK INNER FACE
      ===================================================== */}

      <mesh position={[0, 0, 0.171]}>
        <circleGeometry args={[1.18, 96]} />

        <meshStandardMaterial
          color="#552400"
          metalness={0.9}
          roughness={0.28}
        />
      </mesh>


      {/* =====================================================
          GOLD INNER PLATE
      ===================================================== */}

      <mesh position={[0, 0, 0.18]}>
        <circleGeometry args={[1.08, 96]} />

        <meshStandardMaterial
          color="#c96d04"
          metalness={0.95}
          roughness={0.19}
        />
      </mesh>


      {/* =====================================================
          OUTER ENGRAVED RINGS
      ===================================================== */}

      <mesh position={[0, 0, 0.188]}>
        <ringGeometry args={[1.27, 1.37, 96]} />

        <meshStandardMaterial
          color={GOLD_LIGHT}
          metalness={1}
          roughness={0.15}
        />
      </mesh>

      <mesh position={[0, 0, 0.191]}>
        <ringGeometry args={[1.14, 1.19, 96]} />

        <meshStandardMaterial
          color="#ffca43"
          metalness={1}
          roughness={0.18}
        />
      </mesh>


      {/* =====================================================
          CIRCUIT / ENGRAVED DETAIL
      ===================================================== */}

      <CoinCircuitDetails />


      {/* =====================================================
          BITCOIN SYMBOL
      ===================================================== */}

      <Text
        position={[0, -0.02, 0.235]}
        fontSize={1.42}
        anchorX="center"
        anchorY="middle"
      >
        ₿

        <meshStandardMaterial
          color="#ffe38a"
          metalness={1}
          roughness={0.12}
          emissive="#ff9b00"
          emissiveIntensity={0.16}
        />
      </Text>


      {/* =====================================================
          FACE HIGHLIGHT
      ===================================================== */}

      <mesh
        position={[-0.40, 0.46, 0.205]}
        rotation={[0, 0, -0.55]}
      >
        <planeGeometry args={[0.17, 1.25]} />

        <meshBasicMaterial
          color="#fff2b7"
          transparent
          opacity={0.10}
          depthWrite={false}
        />
      </mesh>

    </group>
  );
}


/* =========================================================
   COIN CIRCUIT DETAILS
========================================================= */

function CoinCircuitDetails() {
  const details = useMemo(() => {
    return Array.from({ length: 26 }, (_, index) => {
      const angle =
        (index / 26) * Math.PI * 2;

      const radius =
        index % 2 === 0 ? 0.86 : 0.94;

      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,

        rotation:
          angle + Math.PI / 2,

        length:
          index % 3 === 0 ? 0.30 : 0.19,
      };
    });
  }, []);

  return (
    <group>
      {details.map((detail, index) => (
        <mesh
          key={index}
          position={[
            detail.x,
            detail.y,
            0.202,
          ]}
          rotation={[
            0,
            0,
            detail.rotation,
          ]}
        >
          <boxGeometry
            args={[
              detail.length,
              0.025,
              0.015,
            ]}
          />

          <meshStandardMaterial
            color={
              index % 2 === 0
                ? "#ffd660"
                : "#8b4200"
            }
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}


/* =========================================================
   ORBIT
========================================================= */

type OrbitProps = {
  radiusX: number;
  radiusY: number;
  color: string;
  speed: number;
  tilt: number;
  rotationZ: number;
  thickness?: number;
  opacity?: number;
};


function EnergyOrbit({
  radiusX,
  radiusY,
  color,
  speed,
  tilt,
  rotationZ,
  thickness = 0.025,
  opacity = 0.8,
}: OrbitProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;

    /*
       Subtle rotation only.
       Rings stay elegant rather than spinning wildly.
    */

    group.current.rotation.z +=
      delta * speed;
  });

  return (
    <group
      ref={group}
      rotation={[
        tilt,
        0,
        rotationZ,
      ]}
    >
      <mesh scale={[radiusX, radiusY, 1]}>
        <torusGeometry
          args={[
            1,
            thickness,
            12,
            150,
          ]}
        />

        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>

      {/* Soft second glow */}

      <mesh scale={[radiusX, radiusY, 1]}>
        <torusGeometry
          args={[
            1,
            thickness * 3.2,
            10,
            150,
          ]}
        />

        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.07}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}


/* =========================================================
   MOVING ENERGY PARTICLE
========================================================= */

function OrbitParticle({
  radiusX,
  radiusY,
  speed,
  offset,
  color,
  tilt = 0,
  rotationZ = 0,
}: {
  radiusX: number;
  radiusY: number;
  speed: number;
  offset: number;
  color: string;
  tilt?: number;
  rotationZ?: number;
}) {
  const light = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!light.current) return;

    const t =
      state.clock.elapsedTime * speed +
      offset;

    const x =
      Math.cos(t) * radiusX;

    const y =
      Math.sin(t) * radiusY;

    light.current.position.set(
      x,
      y,
      0.28
    );
  });

  return (
    <group
      rotation={[
        tilt,
        0,
        rotationZ,
      ]}
    >
      <group ref={light}>

        <mesh>
          <sphereGeometry
            args={[0.065, 18, 18]}
          />

          <meshBasicMaterial
            color={color}
          />
        </mesh>


        <mesh scale={2.6}>
          <sphereGeometry
            args={[0.065, 16, 16]}
          />

          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>

      </group>
    </group>
  );
}


/* =========================================================
   ASTEROID
========================================================= */

function Asteroid({
  position,
  scale,
  speed = 0.2,
}: {
  position: [number, number, number];
  scale: number;
  speed?: number;
}) {
  const asteroid =
    useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!asteroid.current) return;

    asteroid.current.rotation.x +=
      delta * speed;

    asteroid.current.rotation.y +=
      delta * speed * 0.72;
  });

  return (
    <Float
      speed={0.8}
      floatIntensity={0.7}
      rotationIntensity={0.2}
    >
      <mesh
        ref={asteroid}
        position={position}
        scale={scale}
      >
        <dodecahedronGeometry
          args={[1, 1]}
        />

        <meshStandardMaterial
          color="#294c65"
          roughness={0.78}
          metalness={0.22}
        />
      </mesh>
    </Float>
  );
}


/* =========================================================
   BLUE PLANET
========================================================= */

function BluePlanet() {
  const planet =
    useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!planet.current) return;

    planet.current.rotation.y +=
      delta * 0.08;
  });

  return (
    <Float
      speed={0.7}
      floatIntensity={0.6}
      rotationIntensity={0.1}
    >
      <group
        ref={planet}
        position={[
          -2.35,
          1.75,
          -1.8,
        ]}
        scale={0.45}
      >

        <mesh>
          <sphereGeometry
            args={[1, 48, 48]}
          />

          <meshStandardMaterial
            color="#147bc1"
            metalness={0.2}
            roughness={0.48}
          />
        </mesh>


        <mesh scale={1.06}>
          <sphereGeometry
            args={[1, 36, 36]}
          />

          <meshBasicMaterial
            color="#2bbcff"
            transparent
            opacity={0.10}
            side={THREE.BackSide}
          />
        </mesh>

      </group>
    </Float>
  );
}


/* =========================================================
   CENTRAL ENERGY GLOW
========================================================= */

function BackgroundGlow() {
  return (
    <>
      <mesh
        position={[
          0.4,
          -0.1,
          -2.2,
        ]}
        scale={[
          3.5,
          3.5,
          1,
        ]}
      >
        <circleGeometry args={[1, 64]} />

        <meshBasicMaterial
          color="#1aaeff"
          transparent
          opacity={0.055}
          depthWrite={false}
        />
      </mesh>


      <mesh
        position={[
          -0.3,
          -0.5,
          -1.9,
        ]}
        scale={[
          2.6,
          2.6,
          1,
        ]}
      >
        <circleGeometry args={[1, 64]} />

        <meshBasicMaterial
          color="#ff9a1d"
          transparent
          opacity={0.055}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}


/* =========================================================
   COMPLETE CINEMATIC SCENE
========================================================= */

function CinematicScene() {
  const scene =
    useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!scene.current) return;

    /*
       VERY subtle mouse parallax.
       Never enough to destroy the composition.
    */

    const targetX =
      state.pointer.y * 0.025;

    const targetY =
      state.pointer.x * 0.04;

    scene.current.rotation.x =
      THREE.MathUtils.lerp(
        scene.current.rotation.x,
        targetX,
        0.025
      );

    scene.current.rotation.y =
      THREE.MathUtils.lerp(
        scene.current.rotation.y,
        targetY,
        0.025
      );
  });

  return (
    <group ref={scene}>

      <BackgroundGlow />

      <BluePlanet />


      {/* ===================================================
          REAR ORBITS
      =================================================== */}

      <EnergyOrbit
        radiusX={2.35}
        radiusY={0.88}
        color={CYAN}
        speed={0.025}
        tilt={0.48}
        rotationZ={-0.20}
        thickness={0.018}
        opacity={0.48}
      />

      <EnergyOrbit
        radiusX={2.6}
        radiusY={0.72}
        color={ORANGE}
        speed={-0.018}
        tilt={-0.32}
        rotationZ={0.18}
        thickness={0.018}
        opacity={0.65}
      />


      {/* ===================================================
          BITCOIN
      =================================================== */}

      <DetailedBitcoin />


      {/* ===================================================
          FRONT ENERGY ORBITS
      =================================================== */}

      <EnergyOrbit
        radiusX={2.12}
        radiusY={0.58}
        color={BLUE}
        speed={-0.035}
        tilt={0.28}
        rotationZ={-0.10}
        thickness={0.026}
        opacity={0.86}
      />

      <EnergyOrbit
        radiusX={2.28}
        radiusY={0.48}
        color="#69d7ff"
        speed={0.028}
        tilt={-0.18}
        rotationZ={0.10}
        thickness={0.016}
        opacity={0.68}
      />


      {/* ===================================================
          MOVING LIGHTS
      =================================================== */}

      <OrbitParticle
        radiusX={2.12}
        radiusY={0.58}
        speed={0.55}
        offset={0}
        color="#a4efff"
        tilt={0.28}
        rotationZ={-0.10}
      />

      <OrbitParticle
        radiusX={2.6}
        radiusY={0.72}
        speed={0.34}
        offset={2.5}
        color="#ffc85c"
        tilt={-0.32}
        rotationZ={0.18}
      />

      <OrbitParticle
        radiusX={2.28}
        radiusY={0.48}
        speed={0.42}
        offset={4.2}
        color="#32c8ff"
        tilt={-0.18}
        rotationZ={0.10}
      />


      {/* ===================================================
          SMALL ASTEROIDS
      =================================================== */}

      <Asteroid
        position={[
          -2.7,
          0.65,
          -0.8,
        ]}
        scale={0.16}
      />

      <Asteroid
        position={[
          2.65,
          1.2,
          -1.2,
        ]}
        scale={0.13}
        speed={0.15}
      />

      <Asteroid
        position={[
          2.45,
          -1.35,
          -0.7,
        ]}
        scale={0.12}
        speed={0.25}
      />

      <Asteroid
        position={[
          -2.25,
          -1.45,
          -1.1,
        ]}
        scale={0.10}
      />

      <Asteroid
        position={[
          1.5,
          2.0,
          -1.6,
        ]}
        scale={0.09}
      />


      {/* ===================================================
          SPACE PARTICLES
      =================================================== */}

      <Sparkles
        count={38}
        scale={[
          6.5,
          4.4,
          3,
        ]}
        size={1.35}
        speed={0.15}
        opacity={0.48}
        color="#71dfff"
      />

    </group>
  );
}


/* =========================================================
   EXPORT
========================================================= */

export default function CinematicBitcoin3D() {
  return (
    <div className="cinematic-bitcoin-3d">
      <Canvas
        dpr={[1, 1.35]}
        camera={{
          position: [0, 0, 6.7],
          fov: 43,
        }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference:
            "high-performance",
        }}
      >
        <Suspense fallback={null}>

          {/* GENERAL LIGHT */}

          <ambientLight
            intensity={1.25}
          />


          {/* TOP WHITE LIGHT */}

          <directionalLight
            position={[3, 5, 6]}
            intensity={3.2}
            color="#ffffff"
          />


          {/* GOLD LIGHT */}

          <pointLight
            position={[
              -1.8,
              0.3,
              4,
            ]}
            intensity={18}
            distance={9}
            color="#ff9d21"
          />


          {/* BLUE LIGHT */}

          <pointLight
            position={[
              2.6,
              1.3,
              3,
            ]}
            intensity={15}
            distance={9}
            color="#25baff"
          />


          {/* LOWER WARM LIGHT */}

          <pointLight
            position={[
              0,
              -3,
              2,
            ]}
            intensity={10}
            distance={7}
            color="#ffb13b"
          />


          <CinematicScene />

        </Suspense>
      </Canvas>
    </div>
  );
}