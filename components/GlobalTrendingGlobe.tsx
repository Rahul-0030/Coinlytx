"use client";

import {
  Canvas,
  ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";

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

  startX: number;
  startY: number;

  lastX: number;
  lastY: number;
  lastTime: number;

  pendingYaw: number;
  pendingPitch: number;

  angularYaw: number;
  angularPitch: number;
};

type PointerPosition = {
  x: number;
  y: number;
};

/* =========================================================
   GLOBE SETTINGS

   IMPORTANT:
   Camera distance is deliberately farther back so the
   complete globe remains visible without clipping.
========================================================= */

const GLOBE_RADIUS = 2;
const GLOBE_SCALE = 0.9;

const MIN_CAMERA_Z = 5.45;
const MAX_CAMERA_Z = 8.5;
const DEFAULT_CAMERA_Z = 6.15;

const DIGITAL_POINT_COUNT = 420;

/* =========================================================
   REGIONS
========================================================= */

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
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function geoToVector(
  lat: number,
  lon: number,
  radius = GLOBE_RADIUS
) {
  const phi =
    (90 - lat) *
    (Math.PI / 180);

  const theta =
    (lon + 180) *
    (Math.PI / 180);

  return new THREE.Vector3(
    -radius *
      Math.sin(phi) *
      Math.cos(theta),

    radius *
      Math.cos(phi),

    radius *
      Math.sin(phi) *
      Math.sin(theta)
  );
}

/* =========================================================
   COUNTRY BORDERS
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
      if (
        !coordinates ||
        coordinates.length < 4
      ) {
        return;
      }

      let step = 1;

      if (coordinates.length > 240) {
        step = 5;
      } else if (
        coordinates.length > 140
      ) {
        step = 4;
      } else if (
        coordinates.length > 80
      ) {
        step = 3;
      } else if (
        coordinates.length > 40
      ) {
        step = 2;
      }

      const simplified =
        coordinates.filter(
          (_, index) =>
            index % step === 0 ||
            index ===
              coordinates.length - 1
        );

      if (simplified.length < 3) {
        return;
      }

      const points =
        simplified.map(
          ([lon, lat]) =>
            geoToVector(
              lat,
              lon,
              GLOBE_RADIUS + 0.022
            )
        );

      lines.push(points);
    }

    geoJson.features.forEach(
      (country: any) => {
        const geometry =
          country.geometry;

        if (!geometry) {
          return;
        }

        if (
          geometry.type ===
          "Polygon"
        ) {
          geometry.coordinates.forEach(
            (ring: number[][]) => {
              addRing(ring);
            }
          );
        }

        if (
          geometry.type ===
          "MultiPolygon"
        ) {
          geometry.coordinates.forEach(
            (
              polygon: number[][][]
            ) => {
              polygon.forEach(
                (
                  ring: number[][]
                ) => {
                  addRing(ring);
                }
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
   REAL WORLD MAP
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
            lineWidth={0.75}
            transparent
            opacity={0.82}
          />
        )
      )}
    </group>
  );
}

/* =========================================================
   GLOBE GRID
========================================================= */

function GlobeGrid() {
  const latitudes = useMemo(() => {
    const result:
      THREE.Vector3[][] = [];

    for (
      let lat = -60;
      lat <= 60;
      lat += 40
    ) {
      const points:
        THREE.Vector3[] = [];

      for (
        let lon = -180;
        lon <= 180;
        lon += 12
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
        lon += 45
      ) {
        const points:
          THREE.Vector3[] = [];

        for (
          let lat = -85;
          lat <= 85;
          lat += 10
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
            lineWidth={0.4}
            transparent
            opacity={0.22}
          />
        )
      )}

      {longitudes.map(
        (points, index) => (
          <Line
            key={`lon-${index}`}
            points={points}
            color="#20a8ff"
            lineWidth={0.4}
            transparent
            opacity={0.2}
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
      const count =
        DIGITAL_POINT_COUNT;

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
          (i / (count - 1)) * 2;

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
          args={[
            positions,
            3,
          ]}
        />
      </bufferGeometry>

      <pointsMaterial
        color="#53e7ff"
        size={0.025}
        transparent
        opacity={0.5}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/* =========================================================
   FIND NEAREST REGION
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

  for (
    const region of REGIONS
  ) {
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
    MutableRefObject<
      THREE.Group | null
    >;

  dragState:
    MutableRefObject<
      DragState
    >;

  onRegionChange:
    (
      region: TrendingRegion
    ) => void;
}) {
  function selectRegion(
    event:
      ThreeEvent<PointerEvent>
  ) {
    if (
      dragState.current.moved
    ) {
      return;
    }

    event.stopPropagation();

    if (!globeRef.current) {
      return;
    }

    const localPoint =
      globeRef.current
        .worldToLocal(
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

      <mesh
        onPointerUp={
          selectRegion
        }
      >
        <sphereGeometry
          args={[
            GLOBE_RADIUS,
            40,
            40,
          ]}
        />

        <meshStandardMaterial
          color="#063e79"
          emissive="#031f48"
          emissiveIntensity={
            0.45
          }
          transparent
          opacity={0.7}
          roughness={0.4}
          metalness={0.15}
        />
      </mesh>

      <mesh scale={0.98}>
        <sphereGeometry
          args={[
            GLOBE_RADIUS,
            28,
            28,
          ]}
        />

        <meshBasicMaterial
          color="#021329"
          transparent
          opacity={0.68}
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
    useRef<THREE.Mesh>(
      null
    );

  useFrame((state) => {
    if (!atmosphere.current) {
      return;
    }

    const material =
      atmosphere.current
        .material as
        THREE.MeshBasicMaterial;

    material.opacity =
      0.11 +
      Math.sin(
        state.clock
          .elapsedTime * 0.9
      ) *
        0.018;
  });

  return (
    <mesh
      ref={atmosphere}
      scale={1.045}
    >
      <sphereGeometry
        args={[
          GLOBE_RADIUS,
          28,
          28,
        ]}
      />

      <meshBasicMaterial
        color="#18d7ff"
        transparent
        opacity={0.12}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* =========================================================
   SCANNER
========================================================= */

function Scanner() {
  const scanner =
    useRef<THREE.Mesh>(
      null
    );

  useFrame(
    (_, delta) => {
      if (!scanner.current) {
        return;
      }

      scanner.current
        .rotation.z +=
        delta * 0.1;
    }
  );

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
          2.16,
          0.009,
          4,
          56,
        ]}
      />

      <meshBasicMaterial
        color="#25dcff"
        transparent
        opacity={0.48}
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
  [25.2, 55.27],
  [19.07, 72.87],
  [1.35, 103.81],
  [35.67, 139.65],
  [-23.55, -46.63],
];

function DataLights() {
  return (
    <group>
      {DATA_POINTS.map(
        (
          [lat, lon],
          index
        ) => {
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
              position={
                position
              }
            >
              <sphereGeometry
                args={[
                  0.035,
                  6,
                  6,
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
   REGION HOTSPOT
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
    MutableRefObject<
      DragState
    >;
}) {
  const [
    hovered,
    setHovered,
  ] = useState(false);

  const pulse =
    useRef<THREE.Mesh>(
      null
    );

  const position =
    useMemo(
      () =>
        geoToVector(
          region.lat,
          region.lon,
          GLOBE_RADIUS +
            0.11
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

    const amount =
      1 +
      Math.sin(
        state.clock
          .elapsedTime * 2
      ) *
        0.14;

    pulse.current
      .scale.setScalar(
        amount
      );
  });

  function handleSelect(
    event:
      ThreeEvent<PointerEvent>
  ) {
    event.stopPropagation();

    if (
      !dragState.current.moved
    ) {
      onSelect();
    }
  }

  return (
    <group
      position={position}
    >
      <mesh>
        <sphereGeometry
          args={[
            active
              ? 0.085
              : 0.065,
            8,
            8,
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

      <mesh ref={pulse}>
        <sphereGeometry
          args={[
            active
              ? 0.14
              : 0.11,
            8,
            8,
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
              ? 0.25
              : 0.15
          }
          depthWrite={false}
        />
      </mesh>

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
        onPointerUp={
          handleSelect
        }
      >
        <sphereGeometry
          args={[
            0.42,
            8,
            8,
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
            0.27,
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
    MutableRefObject<
      DragState
    >;
}) {
  const globe =
    useRef<THREE.Group>(
      null
    );

  useFrame(
    (_, delta) => {
      if (!globe.current) {
        return;
      }

      const drag =
        dragState.current;

      /* DIRECT DRAG */

      if (
        drag.pendingYaw !== 0 ||
        drag.pendingPitch !== 0
      ) {
        globe.current
          .rotation.y +=
          drag.pendingYaw;

        globe.current
          .rotation.x +=
          drag.pendingPitch;

        drag.pendingYaw = 0;
        drag.pendingPitch = 0;

        globe.current
          .rotation.x =
          clamp(
            globe.current
              .rotation.x,
            -1.05,
            1.05
          );
      }

      /* MOMENTUM */

      if (!drag.dragging) {
        const hasMomentum =
          Math.abs(
            drag.angularYaw
          ) > 0.003 ||
          Math.abs(
            drag.angularPitch
          ) > 0.003;

        if (hasMomentum) {
          globe.current
            .rotation.y +=
            drag.angularYaw *
            delta;

          globe.current
            .rotation.x +=
            drag.angularPitch *
            delta;

          globe.current
            .rotation.x =
            clamp(
              globe.current
                .rotation.x,
              -1.05,
              1.05
            );

          const friction =
            Math.exp(
              -4.4 * delta
            );

          drag.angularYaw *=
            friction;

          drag.angularPitch *=
            friction;
        } else {
          globe.current
            .rotation.y +=
            delta * 0.018;

          drag.angularYaw = 0;
          drag.angularPitch = 0;
        }
      }
    }
  );

  return (
    <group
      ref={globe}
      scale={GLOBE_SCALE}

      /* IMPORTANT:
         Perfectly centered vertically.
      */
      position={[
        0,
        0,
        0,
      ]}

      rotation={[
        0.1,
        -0.55,
        0,
      ]}
    >
      <Earth
        globeRef={globe}
        dragState={
          dragState
        }
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
    useRef<THREE.Mesh>(
      null
    );

  useFrame(
    (_, delta) => {
      if (!ring.current) {
        return;
      }

      ring.current
        .rotation.z -=
        delta * 0.08;
    }
  );

  return (
    <group
      position={[
        0,
        -1.75,
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
            1.25,
            2.1,
            40,
          ]}
        />

        <meshBasicMaterial
          color="#0a8fff"
          transparent
          opacity={0.11}
          side={
            THREE.DoubleSide
          }
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ring}>
        <torusGeometry
          args={[
            1.65,
            0.018,
            4,
            48,
          ]}
        />

        <meshBasicMaterial
          color="#3ee8ff"
          transparent
          opacity={0.58}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   CAMERA
========================================================= */

function ZoomCamera({
  zoom,
}: {
  zoom: number;
}) {
  const { camera } =
    useThree();

  useFrame(
    (_, delta) => {
      const difference =
        Math.abs(
          camera.position.z -
            zoom
        );

      if (
        difference > 0.001
      ) {
        camera.position.z =
          THREE.MathUtils.damp(
            camera.position.z,
            zoom,
            8,
            delta
          );

        /*
         * Keep the camera centered.
         * This prevents vertical offset.
         */
        camera.position.x = 0;
        camera.position.y = 0;

        camera.lookAt(0, 0, 0);

        camera.updateProjectionMatrix();
      }
    }
  );

  return null;
}

/* =========================================================
   SCENE
========================================================= */

function Scene({
  activeRegion,
  onRegionChange,
  dragState,
  zoom,
}: GlobeProps & {
  dragState:
    MutableRefObject<
      DragState
    >;

  zoom: number;
}) {
  return (
    <>
      <ZoomCamera
        zoom={zoom}
      />

      <ambientLight
        intensity={1.15}
      />

      <directionalLight
        position={[
          4,
          5,
          6,
        ]}
        intensity={1.55}
        color="#b6f7ff"
      />

      <RotatableGlobe
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

      startX: 0,
      startY: 0,

      lastX: 0,
      lastY: 0,
      lastTime: 0,

      pendingYaw: 0,
      pendingPitch: 0,

      angularYaw: 0,
      angularPitch: 0,
    });

  const activePointers =
    useRef(
      new Map<
        number,
        PointerPosition
      >()
    );

  const pinchState =
    useRef({
      active: false,
      startDistance: 0,
      startZoom:
        DEFAULT_CAMERA_Z,
    });

  const [
    isDragging,
    setIsDragging,
  ] = useState(false);

  const [
    isVisible,
    setIsVisible,
  ] = useState(false);

  const [
    zoom,
    setZoom,
  ] = useState(
    DEFAULT_CAMERA_Z
  );

  const zoomRef =
    useRef(
      DEFAULT_CAMERA_Z
    );

  function updateZoom(
    value: number
  ) {
    const next =
      clamp(
        value,
        MIN_CAMERA_Z,
        MAX_CAMERA_Z
      );

    zoomRef.current = next;
    setZoom(next);
  }

  /* =======================================================
     LOAD ONLY NEAR VIEWPORT
  ======================================================= */

  useEffect(() => {
    const element =
      containerRef.current;

    if (!element) {
      return;
    }

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          setIsVisible(
            entry.isIntersecting
          );
        },
        {
          rootMargin:
            "100px 0px 100px 0px",

          threshold: 0.01,
        }
      );

    observer.observe(
      element
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  /* =======================================================
     WHEEL ZOOM
  ======================================================= */

  useEffect(() => {
    const element =
      containerRef.current;

    if (!element) {
      return;
    }

    function handleWheel(
      event: WheelEvent
    ) {
      event.preventDefault();

      updateZoom(
        zoomRef.current +
          event.deltaY *
            0.0035
      );
    }

    element.addEventListener(
      "wheel",
      handleWheel,
      {
        passive: false,
      }
    );

    return () => {
      element.removeEventListener(
        "wheel",
        handleWheel
      );
    };
  }, []);

  /* =======================================================
     PINCH HELPER
  ======================================================= */

  function getPointerDistance() {
    const pointers =
      Array.from(
        activePointers.current
          .values()
      );

    if (pointers.length < 2) {
      return 0;
    }

    const first =
      pointers[0];

    const second =
      pointers[1];

    const dx =
      second.x - first.x;

    const dy =
      second.y - first.y;

    return Math.sqrt(
      dx * dx +
        dy * dy
    );
  }

  /* =======================================================
     POINTER DOWN
  ======================================================= */

  function handlePointerDown(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    if (
      event.pointerType ===
        "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    activePointers.current.set(
      event.pointerId,
      {
        x: event.clientX,
        y: event.clientY,
      }
    );

    const drag =
      dragState.current;

    if (
      activePointers.current
        .size >= 2
    ) {
      pinchState.current.active =
        true;

      pinchState.current
        .startDistance =
        getPointerDistance();

      pinchState.current
        .startZoom =
        zoomRef.current;

      drag.dragging = false;
      drag.moved = true;

      drag.angularYaw = 0;
      drag.angularPitch = 0;

      setIsDragging(false);

      return;
    }

    drag.dragging = true;
    drag.moved = false;

    drag.startX =
      event.clientX;

    drag.startY =
      event.clientY;

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
  }

  /* =======================================================
     POINTER MOVE
  ======================================================= */

  function handlePointerMove(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    if (
      activePointers.current.has(
        event.pointerId
      )
    ) {
      activePointers.current.set(
        event.pointerId,
        {
          x: event.clientX,
          y: event.clientY,
        }
      );
    }

    /* PINCH */

    if (
      pinchState.current
        .active &&
      activePointers.current
        .size >= 2
    ) {
      const distance =
        getPointerDistance();

      const startDistance =
        pinchState.current
          .startDistance;

      if (
        distance > 0 &&
        startDistance > 0
      ) {
        const ratio =
          startDistance /
          distance;

        updateZoom(
          pinchState.current
            .startZoom *
            ratio
        );
      }

      dragState.current.moved =
        true;

      return;
    }

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

    const totalX =
      event.clientX -
      drag.startX;

    const totalY =
      event.clientY -
      drag.startY;

    const distance =
      Math.sqrt(
        totalX * totalX +
          totalY * totalY
      );

    const elapsed =
      Math.max(
        8,
        now -
          drag.lastTime
      ) / 1000;

    if (
      !drag.moved &&
      distance > 6
    ) {
      drag.moved = true;

      try {
        if (
          !event.currentTarget
            .hasPointerCapture(
              event.pointerId
            )
        ) {
          event.currentTarget
            .setPointerCapture(
              event.pointerId
            );
        }
      } catch {
        // Safe fallback
      }
    }

    if (drag.moved) {
      /*
       * Slower and smoother dragging.
       */

      const yaw =
        deltaX * 0.0055;

      const pitch =
        deltaY * 0.004;

      drag.pendingYaw +=
        yaw;

      drag.pendingPitch +=
        pitch;

      drag.angularYaw =
        clamp(
          yaw / elapsed,
          -2.2,
          2.2
        );

      drag.angularPitch =
        clamp(
          pitch / elapsed,
          -1.6,
          1.6
        );
    }

    drag.lastX =
      event.clientX;

    drag.lastY =
      event.clientY;

    drag.lastTime = now;
  }

  /* =======================================================
     POINTER RELEASE
  ======================================================= */

  function finishPointer(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    const drag =
      dragState.current;

    activePointers.current.delete(
      event.pointerId
    );

    /* PINCH FINISHED */

    if (
      pinchState.current
        .active &&
      activePointers.current
        .size < 2
    ) {
      pinchState.current.active =
        false;

      drag.dragging = false;
      drag.moved = true;

      drag.angularYaw = 0;
      drag.angularPitch = 0;

      setIsDragging(false);

      if (
        activePointers.current
          .size === 1
      ) {
        const remaining =
          Array.from(
            activePointers.current
              .values()
          )[0];

        drag.startX =
          remaining.x;

        drag.startY =
          remaining.y;

        drag.lastX =
          remaining.x;

        drag.lastY =
          remaining.y;

        drag.lastTime =
          performance.now();
      }

      window.setTimeout(
        () => {
          if (
            activePointers.current
              .size === 0
          ) {
            drag.moved =
              false;
          }
        },
        180
      );

      return;
    }

    if (!drag.dragging) {
      if (
        activePointers.current
          .size === 0
      ) {
        window.setTimeout(
          () => {
            drag.moved =
              false;
          },
          120
        );
      }

      return;
    }

    drag.dragging = false;

    /*
     * Gentle release momentum.
     */
    if (drag.moved) {
      drag.angularYaw *=
        0.72;

      drag.angularPitch *=
        0.72;
    }

    setIsDragging(false);

    try {
      if (
        event.currentTarget
          .hasPointerCapture(
            event.pointerId
          )
      ) {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId
          );
      }
    } catch {
      // Safe fallback
    }

    window.setTimeout(
      () => {
        if (
          activePointers.current
            .size === 0
        ) {
          drag.moved =
            false;
        }
      },
      120
    );
  }

  /* =======================================================
     ZOOM BUTTONS
  ======================================================= */

  function zoomIn() {
    updateZoom(
      zoomRef.current - 0.5
    );
  }

  function zoomOut() {
    updateZoom(
      zoomRef.current + 0.5
    );
  }

  function resetZoom() {
    updateZoom(
      DEFAULT_CAMERA_Z
    );
  }

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div
      ref={containerRef}
      className={`gt-real-globe gt-futuristic-globe ${
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
        finishPointer
      }
      onPointerCancel={
        finishPointer
      }
      onDoubleClick={
        resetZoom
      }
      style={{
        touchAction: "none",
      }}
    >

      {/* BACKGROUND GLOW */}

      <div
        className="gt-real-globe-glow"
        aria-hidden="true"
      />

      {/* THREE.JS */}

      {isVisible && (
        <Canvas
          camera={{
            position: [
              0,
              0,
              DEFAULT_CAMERA_Z,
            ],
            fov: 42,
          }}
          dpr={[1, 1.25]}
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
            zoom={zoom}
          />
        </Canvas>
      )}

      {/* ZOOM CONTROLS */}

      <div
        className="gt-globe-zoom-controls"
        onPointerDown={(
          event
        ) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom globe in"
          title="Zoom in"
        >
          +
        </button>

        <button
          type="button"
          onClick={
            resetZoom
          }
          aria-label="Reset globe zoom"
          title="Reset zoom"
        >
          ◎
        </button>

        <button
          type="button"
          onClick={
            zoomOut
          }
          aria-label="Zoom globe out"
          title="Zoom out"
        >
          −
        </button>
      </div>

      {/* INSTRUCTION */}

      <div className="gt-globe-drag-hint">
        <span>↔</span>

        {isDragging
          ? "RELEASE TO FLICK"
          : "DRAG • TAP REGION • PINCH OR SCROLL TO ZOOM"}
      </div>

    </div>
  );
}