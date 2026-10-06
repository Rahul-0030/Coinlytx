"use client";

import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import * as THREE from "three";

/* =========================================================
   TYPES
========================================================= */

export type TrendingRegion =
  | "global"
  | "america"
  | "europe"
  | "asia"
  | "middle-east"
  | "africa";

type GlobeProps = {
  activeRegion: TrendingRegion;
  onRegionChange: (region: TrendingRegion) => void;
};

type RegionPoint = {
  id: Exclude<TrendingRegion, "global">;
  label: string;
  lat: number;
  lon: number;
};

type DragState = {
  dragging: boolean;
  moved: boolean;

  lastX: number;
  lastY: number;
  lastTime: number;

  pendingYaw: number;
  pendingPitch: number;

  angularYaw: number;
  angularPitch: number;
};

/* =========================================================
   SETTINGS
========================================================= */

const GLOBE_RADIUS = 2;
const GLOBE_SCALE = 0.85;

const REGIONS: RegionPoint[] = [
  {
    id: "america",
    label: "AMERICA",
    lat: 38,
    lon: -100,
  },
  {
    id: "europe",
    label: "EUROPE",
    lat: 51,
    lon: 14,
  },
  {
    id: "africa",
    label: "AFRICA",
    lat: 7,
    lon: 21,
  },
  {
    id: "middle-east",
    label: "MIDDLE EAST",
    lat: 27,
    lon: 48,
  },
  {
    id: "asia",
    label: "ASIA",
    lat: 37,
    lon: 102,
  },
];

/* =========================================================
   HELPERS
========================================================= */

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(max, Math.max(min, value));
}

function geoToVector(
  lat: number,
  lon: number,
  radius = GLOBE_RADIUS
) {
  const phi =
    (90 - lat) * (Math.PI / 180);

  const theta =
    (lon + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius *
      Math.sin(phi) *
      Math.cos(theta),

    radius * Math.cos(phi),

    radius *
      Math.sin(phi) *
      Math.sin(theta)
  );
}

/* =========================================================
   COUNTRY LINES
========================================================= */

function getCountryLines() {
  try {
    const geoJson = feature(
      worldData as any,
      (worldData as any).objects.countries
    ) as any;

    const lines: THREE.Vector3[][] = [];

    function addRing(
      coordinates: number[][]
    ) {
      const points =
        coordinates.map(
          ([lon, lat]) =>
            geoToVector(
              lat,
              lon,
              GLOBE_RADIUS + 0.022
            )
        );

      if (points.length > 1) {
        lines.push(points);
      }
    }

    geoJson.features.forEach(
      (country: any) => {
        const geometry =
          country.geometry;

        if (!geometry) return;

        if (
          geometry.type ===
          "Polygon"
        ) {
          geometry.coordinates.forEach(
            (ring: number[][]) =>
              addRing(ring)
          );
        }

        if (
          geometry.type ===
          "MultiPolygon"
        ) {
          geometry.coordinates.forEach(
            (polygon: number[][][]) => {
              polygon.forEach(
                (ring: number[][]) =>
                  addRing(ring)
              );
            }
          );
        }
      }
    );

    return lines;
  } catch (error) {
    console.error(
      "Unable to create world map:",
      error
    );

    return [];
  }
}

/* =========================================================
   WORLD MAP
========================================================= */

function RealWorldMap() {
  const lines = useMemo(
    () => getCountryLines(),
    []
  );

  return (
    <group>
      {lines.map(
        (points, index) => (
          <Line
            key={index}
            points={points}
            color="#24cfff"
            lineWidth={0.9}
            transparent
            opacity={0.88}
          />
        )
      )}
    </group>
  );
}

/* =========================================================
   GRID
========================================================= */

function GlobeGrid() {
  const latitudes =
    useMemo(() => {
      const result:
        THREE.Vector3[][] = [];

      for (
        let lat = -60;
        lat <= 60;
        lat += 30
      ) {
        const points:
          THREE.Vector3[] = [];

        for (
          let lon = -180;
          lon <= 180;
          lon += 7
        ) {
          points.push(
            geoToVector(
              lat,
              lon,
              GLOBE_RADIUS + 0.01
            )
          );
        }

        result.push(points);
      }

      return result;
    }, []);

  const longitudes =
    useMemo(() => {
      const result:
        THREE.Vector3[][] = [];

      for (
        let lon = -150;
        lon <= 180;
        lon += 30
      ) {
        const points:
          THREE.Vector3[] = [];

        for (
          let lat = -87;
          lat <= 87;
          lat += 6
        ) {
          points.push(
            geoToVector(
              lat,
              lon,
              GLOBE_RADIUS + 0.01
            )
          );
        }

        result.push(points);
      }

      return result;
    }, []);

  return (
    <group>
      {latitudes.map(
        (points, index) => (
          <Line
            key={`lat-${index}`}
            points={points}
            color="#20a8ff"
            lineWidth={0.45}
            transparent
            opacity={0.28}
          />
        )
      )}

      {longitudes.map(
        (points, index) => (
          <Line
            key={`lon-${index}`}
            points={points}
            color="#20a8ff"
            lineWidth={0.45}
            transparent
            opacity={0.24}
          />
        )
      )}
    </group>
  );
}

/* =========================================================
   DIGITAL SURFACE
========================================================= */

function DigitalSurface() {
  const positions =
    useMemo(() => {
      const count = 1000;

      const values =
        new Float32Array(
          count * 3
        );

      for (
        let i = 0;
        i < count;
        i++
      ) {
        const y =
          1 -
          (i / (count - 1)) *
            2;

        const horizontalRadius =
          Math.sqrt(
            Math.max(
              0,
              1 - y * y
            )
          );

        const theta =
          Math.PI *
          (3 - Math.sqrt(5)) *
          i;

        const radius =
          GLOBE_RADIUS + 0.035;

        values[i * 3] =
          Math.cos(theta) *
          horizontalRadius *
          radius;

        values[i * 3 + 1] =
          y * radius;

        values[i * 3 + 2] =
          Math.sin(theta) *
          horizontalRadius *
          radius;
      }

      return values;
    }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        color="#53e7ff"
        size={0.022}
        transparent
        opacity={0.58}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/* =========================================================
   CLICK REGION FROM GLOBE SURFACE

   This makes the globe itself clickable.
   User does NOT need to hit the small marker.
========================================================= */

function findNearestRegion(
  localPoint: THREE.Vector3
): Exclude<
  TrendingRegion,
  "global"
> {
  const direction =
    localPoint
      .clone()
      .normalize();

  let selected =
    REGIONS[0].id;

  let bestScore = -Infinity;

  for (const region of REGIONS) {
    const regionDirection =
      geoToVector(
        region.lat,
        region.lon,
        1
      ).normalize();

    const score =
      direction.dot(
        regionDirection
      );

    if (score > bestScore) {
      bestScore = score;
      selected = region.id;
    }
  }

  return selected;
}

/* =========================================================
   EARTH
========================================================= */

function Earth({
  globeRef,
  dragState,
  onRegionChange,
}: {
  globeRef:
    MutableRefObject<THREE.Group | null>;

  dragState:
    MutableRefObject<DragState>;

  onRegionChange:
    (region: TrendingRegion) => void;
}) {
  function handleEarthClick(
    event: ThreeEvent<MouseEvent>
  ) {
    /*
      Do not select a region when
      the user was dragging.
    */

    if (
      dragState.current.moved
    ) {
      return;
    }

    event.stopPropagation();

    if (!globeRef.current) {
      return;
    }

    /*
      Convert clicked world position
      into local globe coordinates.
    */

    const localPoint =
      globeRef.current.worldToLocal(
        event.point.clone()
      );

    const region =
      findNearestRegion(
        localPoint
      );

    onRegionChange(region);
  }

  return (
    <group>
      {/* Main clickable Earth */}

      <mesh
        onClick={
          handleEarthClick
        }
      >
        <sphereGeometry
          args={[
            GLOBE_RADIUS,
            56,
            56,
          ]}
        />

        <meshStandardMaterial
          color="#063e79"
          emissive="#031f48"
          emissiveIntensity={0.5}
          transparent
          opacity={0.68}
          roughness={0.38}
          metalness={0.18}
        />
      </mesh>

      {/* Inner dark core */}

      <mesh scale={0.982}>
        <sphereGeometry
          args={[
            GLOBE_RADIUS,
            40,
            40,
          ]}
        />

        <meshBasicMaterial
          color="#021329"
          transparent
          opacity={0.72}
        />
      </mesh>

      {/* inner cyan glass layer */}

      <mesh scale={0.991}>
        <sphereGeometry
          args={[
            GLOBE_RADIUS,
            36,
            36,
          ]}
        />

        <meshBasicMaterial
          color="#0b6aa0"
          transparent
          opacity={0.11}
          depthWrite={false}
        />
      </mesh>

      <GlobeGrid />

      <DigitalSurface />

      <RealWorldMap />
    </group>
  );
}

/* =========================================================
   ATMOSPHERE
========================================================= */

function Atmosphere() {
  const atmosphere =
    useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!atmosphere.current) {
      return;
    }

    const material =
      atmosphere.current
        .material as THREE.MeshBasicMaterial;

    material.opacity =
      0.13 +
      Math.sin(
        state.clock.elapsedTime *
          1.2
      ) *
        0.025;
  });

  return (
    <mesh
      ref={atmosphere}
      scale={1.055}
    >
      <sphereGeometry
        args={[
          GLOBE_RADIUS,
          40,
          40,
        ]}
      />

      <meshBasicMaterial
        color="#18d7ff"
        transparent
        opacity={0.14}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* =========================================================
   SCANNING RING
========================================================= */

function Scanner() {
  const scanner =
    useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!scanner.current) {
      return;
    }

    scanner.current.rotation.z +=
      delta * 0.13;
  });

  return (
    <mesh
      ref={scanner}
      rotation={[
        Math.PI / 2.65,
        0.2,
        0,
      ]}
    >
      <torusGeometry
        args={[
          2.18,
          0.009,
          5,
          90,
        ]}
      />

      <meshBasicMaterial
        color="#25dcff"
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </mesh>
  );
}

/* =========================================================
   DATA LIGHTS
========================================================= */

const DATA_POINTS = [
  [40.71, -74],
  [37.77, -122.41],
  [51.5, -0.12],
  [48.85, 2.35],
  [25.2, 55.27],
  [19.07, 72.87],
  [1.35, 103.81],
  [35.67, 139.65],
  [22.31, 114.16],
  [-33.86, 151.2],
  [-23.55, -46.63],
];

function DataLights() {
  return (
    <group>
      {DATA_POINTS.map(
        ([lat, lon], index) => {
          const position =
            geoToVector(
              lat,
              lon,
              GLOBE_RADIUS +
                0.065
            );

          return (
            <mesh
              key={index}
              position={position}
            >
              <sphereGeometry
                args={[
                  0.035,
                  8,
                  8,
                ]}
              />

              <meshBasicMaterial
                color="#8df6ff"
              />
            </mesh>
          );
        }
      )}
    </group>
  );
}

/* =========================================================
   REGION HOTSPOTS
========================================================= */

function RegionHotspot({
  region,
  active,
  onSelect,
  dragState,
}: {
  region: RegionPoint;
  active: boolean;
  onSelect: () => void;

  dragState:
    MutableRefObject<DragState>;
}) {
  const [hovered, setHovered] =
    useState(false);

  const pulse =
    useRef<THREE.Mesh>(null);

  const position =
    useMemo(
      () =>
        geoToVector(
          region.lat,
          region.lon,
          GLOBE_RADIUS + 0.11
        ),
      [
        region.lat,
        region.lon,
      ]
    );

  useFrame((state) => {
    if (!pulse.current) {
      return;
    }

    const pulseAmount =
      1 +
      Math.sin(
        state.clock.elapsedTime *
          2.5
      ) *
        0.18;

    pulse.current.scale.setScalar(
      pulseAmount
    );
  });

  return (
    <group position={position}>
      {/* main visible marker */}

      <mesh>
        <sphereGeometry
          args={[
            active
              ? 0.075
              : 0.058,
            12,
            12,
          ]}
        />

        <meshBasicMaterial
          color={
            active
              ? "#ff9f2e"
              : "#7af5ff"
          }
        />
      </mesh>

      {/* glow halo */}

      <mesh ref={pulse}>
        <sphereGeometry
          args={[
            active
              ? 0.13
              : 0.105,
            12,
            12,
          ]}
        />

        <meshBasicMaterial
          color={
            active
              ? "#ff9f2e"
              : "#1ee7ff"
          }
          transparent
          opacity={
            active
              ? 0.24
              : 0.16
          }
          depthWrite={false}
        />
      </mesh>

      {/* larger invisible target */}

      <mesh
        onPointerEnter={(
          event
        ) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => {
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();

          if (
            !dragState.current
              .moved
          ) {
            onSelect();
          }
        }}
      >
        <sphereGeometry
          args={[
            0.32,
            10,
            10,
          ]}
        />

        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {(hovered || active) && (
        <Html
          center
          position={[
            0,
            0.25,
            0,
          ]}
          distanceFactor={8}
          style={{
            pointerEvents:
              "none",
          }}
        >
          <div
            className={
              active
                ? "gt-map-tooltip gt-map-tooltip-active"
                : "gt-map-tooltip"
            }
          >
            <span />
            {region.label}
          </div>
        </Html>
      )}
    </group>
  );
}

/* =========================================================
   ROTATABLE GLOBE
========================================================= */

function RotatableGlobe({
  activeRegion,
  onRegionChange,
  dragState,
}: GlobeProps & {
  dragState:
    MutableRefObject<DragState>;
}) {
  const globe =
    useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!globe.current) {
      return;
    }

    const drag =
      dragState.current;

    /* direct drag */

    if (
      drag.pendingYaw !== 0 ||
      drag.pendingPitch !== 0
    ) {
      globe.current.rotation.y +=
        drag.pendingYaw;

      globe.current.rotation.x +=
        drag.pendingPitch;

      drag.pendingYaw = 0;
      drag.pendingPitch = 0;

      globe.current.rotation.x =
        clamp(
          globe.current.rotation.x,
          -1.05,
          1.05
        );
    }

    /* inertia */

    if (!drag.dragging) {
      const hasMomentum =
        Math.abs(
          drag.angularYaw
        ) > 0.002 ||
        Math.abs(
          drag.angularPitch
        ) > 0.002;

      if (hasMomentum) {
        globe.current.rotation.y +=
          drag.angularYaw *
          delta;

        globe.current.rotation.x +=
          drag.angularPitch *
          delta;

        globe.current.rotation.x =
          clamp(
            globe.current.rotation.x,
            -1.05,
            1.05
          );

        const friction =
          Math.exp(
            -4.1 * delta
          );

        drag.angularYaw *=
          friction;

        drag.angularPitch *=
          friction;
      } else {
        /* gentle idle rotation */

        globe.current.rotation.y +=
          delta * 0.065;

        drag.angularYaw = 0;
        drag.angularPitch = 0;
      }
    }
  });

  return (
    <group
      ref={globe}
      scale={GLOBE_SCALE}
      position={[0, 0.08, 0]}
      rotation={[
        0.1,
        -0.55,
        0,
      ]}
    >
      <Earth
        globeRef={globe}
        dragState={dragState}
        onRegionChange={
          onRegionChange
        }
      />

      <Atmosphere />

      <Scanner />

      <DataLights />

      {REGIONS.map(
        (region) => (
          <RegionHotspot
            key={region.id}
            region={region}
            active={
              activeRegion ===
              region.id
            }
            dragState={
              dragState
            }
            onSelect={() =>
              onRegionChange(
                region.id
              )
            }
          />
        )
      )}
    </group>
  );
}

/* =========================================================
   HOLOGRAPHIC BASE
========================================================= */

function HolographicBase() {
  const ring =
    useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ring.current) {
      return;
    }

    ring.current.rotation.z -=
      delta * 0.14;
  });

  return (
    <group
      position={[
        0,
        -1.85,
        0,
      ]}
      rotation={[
        Math.PI / 2,
        0,
        0,
      ]}
    >
      <mesh>
        <ringGeometry
          args={[
            1.2,
            2.25,
            64,
          ]}
        />

        <meshBasicMaterial
          color="#0a8fff"
          transparent
          opacity={0.14}
          side={
            THREE.DoubleSide
          }
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ring}>
        <torusGeometry
          args={[
            1.7,
            0.018,
            6,
            80,
          ]}
        />

        <meshBasicMaterial
          color="#3ee8ff"
          transparent
          opacity={0.68}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   SCENE
========================================================= */

function Scene({
  activeRegion,
  onRegionChange,
  dragState,
}: GlobeProps & {
  dragState:
    MutableRefObject<DragState>;
}) {
  return (
    <>
      <ambientLight
        intensity={1.25}
      />

      <directionalLight
        position={[4, 5, 6]}
        intensity={1.65}
        color="#b6f7ff"
      />

      <directionalLight
        position={[-4, 0, 3]}
        intensity={0.75}
        color="#248dff"
      />

      <RotatableGlobe
        activeRegion={
          activeRegion
        }
        onRegionChange={
          onRegionChange
        }
        dragState={dragState}
      />

      <HolographicBase />
    </>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function GlobalTrendingGlobe({
  activeRegion,
  onRegionChange,
}: GlobeProps) {
  const containerRef =
    useRef<HTMLDivElement>(
      null
    );

  const dragState =
    useRef<DragState>({
      dragging: false,
      moved: false,

      lastX: 0,
      lastY: 0,
      lastTime: 0,

      pendingYaw: 0,
      pendingPitch: 0,

      angularYaw: 0,
      angularPitch: 0,
    });

  const [
    isDragging,
    setIsDragging,
  ] = useState(false);

  const [
    isVisible,
    setIsVisible,
  ] = useState(false);

  /* =======================================================
     PERFORMANCE:
     only run Three.js when section
     is near viewport
  ======================================================= */

  useEffect(() => {
    const element =
      containerRef.current;

    if (!element) return;

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          setIsVisible(
            entry.isIntersecting
          );
        },
        {
          rootMargin:
            "250px 0px 250px 0px",

          threshold: 0.01,
        }
      );

    observer.observe(element);

    return () =>
      observer.disconnect();
  }, []);

  /* =======================================================
     DRAG START
  ======================================================= */

  function handlePointerDown(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.button !== 0) {
      return;
    }

    const drag =
      dragState.current;

    drag.dragging = true;
    drag.moved = false;

    drag.lastX =
      event.clientX;

    drag.lastY =
      event.clientY;

    drag.lastTime =
      performance.now();

    drag.pendingYaw = 0;
    drag.pendingPitch = 0;

    drag.angularYaw = 0;
    drag.angularPitch = 0;

    setIsDragging(true);

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  }

  /* =======================================================
     DRAG MOVE
  ======================================================= */

  function handlePointerMove(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    const drag =
      dragState.current;

    if (!drag.dragging) {
      return;
    }

    const now =
      performance.now();

    const deltaX =
      event.clientX -
      drag.lastX;

    const deltaY =
      event.clientY -
      drag.lastY;

    const elapsed =
      Math.max(
        8,
        now - drag.lastTime
      ) / 1000;

    if (
      Math.abs(deltaX) > 2 ||
      Math.abs(deltaY) > 2
    ) {
      drag.moved = true;
    }

    /*
      Faster direct rotation
    */

    const yaw =
      deltaX * 0.0095;

    const pitch =
      deltaY * 0.0068;

    drag.pendingYaw += yaw;
    drag.pendingPitch += pitch;

    /*
      Save velocity for flick
    */

    drag.angularYaw =
      clamp(
        yaw / elapsed,
        -4.5,
        4.5
      );

    drag.angularPitch =
      clamp(
        pitch / elapsed,
        -3,
        3
      );

    drag.lastX =
      event.clientX;

    drag.lastY =
      event.clientY;

    drag.lastTime = now;
  }

  /* =======================================================
     RELEASE / FLICK
  ======================================================= */

  function finishDrag(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    const drag =
      dragState.current;

    if (!drag.dragging) {
      return;
    }

    drag.dragging = false;

    drag.angularYaw *= 1.1;
    drag.angularPitch *= 1.05;

    setIsDragging(false);

    try {
      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        );
      }
    } catch {
      // safe fallback
    }

    window.setTimeout(() => {
      drag.moved = false;
    }, 100);
  }

  return (
    <div
      ref={containerRef}
      className={`gt-real-globe gt-geographic-globe gt-futuristic-globe ${
        isDragging
          ? "gt-globe-is-dragging"
          : ""
      }`}
      onPointerDown={
        handlePointerDown
      }
      onPointerMove={
        handlePointerMove
      }
      onPointerUp={
        finishDrag
      }
      onPointerCancel={
        finishDrag
      }
    >
      <div
        className="gt-real-globe-glow"
        aria-hidden="true"
      />

      {isVisible && (
        <Canvas
          camera={{
            position: [
              0,
              0.05,
              6.5,
            ],
            fov: 42,
          }}
          dpr={[1, 1.2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference:
              "high-performance",
          }}
        >
          <Scene
            activeRegion={
              activeRegion
            }
            onRegionChange={
              onRegionChange
            }
            dragState={
              dragState
            }
          />
        </Canvas>
      )}

      <div className="gt-globe-drag-hint">
        <span>↔</span>

        {isDragging
          ? "RELEASE TO FLICK"
          : "DRAG • CLICK REGION"}
      </div>
    </div>
  );
}