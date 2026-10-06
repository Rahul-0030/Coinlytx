"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type HolographicProjectionProps = {
  positive?: boolean;
};

/* =========================================================
   PROJECTOR BASE
========================================================= */

function ProjectorBase() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (ring1.current) {
      ring1.current.rotation.z = t * 0.12;
    }

    if (ring2.current) {
      ring2.current.rotation.z = -t * 0.18;
    }
  });

  return (
    <group position={[0, -1.75, 0]}>
      {/* Physical dark platform */}

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.6, 2.75, 0.15, 64]} />

        <meshStandardMaterial
          color="#020b14"
          metalness={0.9}
          roughness={0.22}
        />
      </mesh>

      {/* Illuminated surface */}

      <mesh
        position={[0, 0.09, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[2.5, 2.5, 0.025, 64]} />

        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0284c7"
          emissiveIntensity={0.8}
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Outer hologram ring */}

      <mesh
        ref={ring1}
        position={[0, 0.13, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[2.2, 0.025, 12, 96]} />

        <meshBasicMaterial
          color="#38d9ff"
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Inner hologram ring */}

      <mesh
        ref={ring2}
        position={[0, 0.14, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[1.55, 0.015, 12, 96]} />

        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Central emitter */}

      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.62, 0.82, 0.045, 48]} />

        <meshBasicMaterial
          color="#a5f3fc"
          transparent
          opacity={0.65}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   HOLOGRAPHIC FLOOR GRID
========================================================= */

function HologramGrid() {
  const lines = useMemo(() => {
    const result: React.ReactNode[] = [];

    for (let i = -5; i <= 5; i++) {
      result.push(
        <mesh key={`vertical-${i}`} position={[i * 0.4, -1.62, 0]}>
          <boxGeometry args={[0.008, 0.008, 4]} />

          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.16}
          />
        </mesh>
      );

      result.push(
        <mesh key={`horizontal-${i}`} position={[0, -1.62, i * 0.4]}>
          <boxGeometry args={[4, 0.008, 0.008]} />

          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.16}
          />
        </mesh>
      );
    }

    return result;
  }, []);

  return <group>{lines}</group>;
}

/* =========================================================
   PROJECTED CANDLESTICKS
   Visual candles for now.
   Real OHLC comes after everything is stable.
========================================================= */

function ProjectedCandles({
  positive = true,
}: HolographicProjectionProps) {
  const group = useRef<THREE.Group>(null);

  const candles = useMemo(
    () => [
      { x: -1.7, h: 0.42, y: -1.25, up: true },
      { x: -1.42, h: 0.58, y: -1.1, up: true },
      { x: -1.14, h: 0.36, y: -0.98, up: false },
      { x: -0.86, h: 0.7, y: -0.78, up: true },
      { x: -0.58, h: 0.5, y: -0.62, up: true },
      { x: -0.3, h: 0.4, y: -0.55, up: false },
      { x: -0.02, h: 0.76, y: -0.32, up: true },
      { x: 0.26, h: 0.5, y: -0.18, up: true },
      { x: 0.54, h: 0.44, y: -0.1, up: false },
      { x: 0.82, h: 0.8, y: 0.12, up: true },
      { x: 1.1, h: 0.58, y: 0.28, up: true },
      { x: 1.38, h: 0.42, y: 0.35, up: false },
      { x: 1.66, h: 0.68, y: 0.52, up: positive },
    ],
    [positive]
  );

  useFrame((state) => {
    if (!group.current) return;

    group.current.position.y =
      Math.sin(state.clock.getElapsedTime() * 1.3) * 0.012;
  });

  return (
    <group ref={group}>
      {candles.map((candle, index) => {
        const color = candle.up ? "#2dd4bf" : "#fb7185";

        return (
          <group
            key={index}
            position={[candle.x, candle.y, 0]}
          >
            {/* Wick */}

            <mesh>
              <boxGeometry
                args={[0.016, candle.h + 0.35, 0.016]}
              />

              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.9}
              />
            </mesh>

            {/* Candle body */}

            <mesh>
              <boxGeometry args={[0.14, candle.h, 0.16]} />

              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={1.5}
                transparent
                opacity={0.78}
                roughness={0.2}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* =========================================================
   DATA TOWERS
========================================================= */

function DataTowers() {
  const towers = [
    {
      x: -1.65,
      z: -1.05,
      height: 0.65,
    },
    {
      x: -1.2,
      z: -1.25,
      height: 0.95,
    },
    {
      x: 1.2,
      z: -1.25,
      height: 0.78,
    },
    {
      x: 1.65,
      z: -1.05,
      height: 1.08,
    },
  ];

  return (
    <group>
      {towers.map((tower, index) => (
        <group
          key={index}
          position={[
            tower.x,
            -1.6 + tower.height / 2,
            tower.z,
          ]}
        >
          <mesh>
            <boxGeometry
              args={[0.25, tower.height, 0.25]}
            />

            <meshStandardMaterial
              color="#20c7ff"
              emissive="#0284c7"
              emissiveIntensity={1.2}
              transparent
              opacity={0.24}
            />
          </mesh>

          <mesh
            position={[0, tower.height / 2 + 0.012, 0]}
          >
            <boxGeometry args={[0.27, 0.02, 0.27]} />

            <meshBasicMaterial
              color="#a5f3fc"
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* =========================================================
   VERTICAL PROJECTION LIGHTS
========================================================= */

function ProjectionLights() {
  const positions = [-1.6, -0.8, 0, 0.8, 1.6];

  return (
    <group>
      {positions.map((x) => (
        <mesh key={x} position={[x, -0.35, 0.7]}>
          <cylinderGeometry
            args={[0.025, 0.11, 2.5, 12, 1, true]}
          />

          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.035}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/* =========================================================
   PARTICLES
========================================================= */

function Particles() {
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 70;

    const values = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      values[i * 3] = (Math.random() - 0.5) * 4.8;

      values[i * 3 + 1] = Math.random() * 3.2 - 1.5;

      values[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }

    return values;
  }, []);

  useFrame((state) => {
    if (!points.current) return;

    points.current.rotation.y =
      state.clock.getElapsedTime() * 0.02;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        color="#7dd3fc"
        size={0.018}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  );
}

/* =========================================================
   SCENE
========================================================= */

function Scene({
  positive,
}: HolographicProjectionProps) {
  return (
    <>
      <ambientLight intensity={0.4} />

      <pointLight
        position={[0, -0.6, 2]}
        intensity={12}
        distance={8}
        color="#00c8ff"
      />

      <pointLight
        position={[2, 2, 3]}
        intensity={3}
        distance={7}
        color="#8be9ff"
      />

      <HologramGrid />

      <ProjectionLights />

      <ProjectedCandles positive={positive} />

      <DataTowers />

      <Particles />

      <ProjectorBase />
    </>
  );
}

/* =========================================================
   EXPORT
========================================================= */

export default function HolographicProjection({
  positive = true,
}: HolographicProjectionProps) {
  return (
    <div className="holographic-projection">
      <Canvas
        dpr={[1, 1.25]}
        camera={{
          position: [0, 1.1, 6.4],
          fov: 42,
        }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <Scene positive={positive} />
      </Canvas>
    </div>
  );
}