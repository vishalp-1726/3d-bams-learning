"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, AdaptiveDpr } from "@react-three/drei";
import AnatomyModel from "./AnatomyModel";
import { CANVAS_BG } from "@/lib/theme.mjs";
import { pointerPress } from "@/lib/viewer-store";

interface Props {
  url: string;
  /** Region id, forwarded so the model can fetch its name lookup. */
  regionId: string;
}

export default function AnatomyCanvas({ url, regionId }: Props) {
  return (
    <div
      className="anat-canvas h-full w-full"
      // Recorded here rather than on the model, so a drag that starts over empty
      // background is still recognised as a rotate and does not clear the
      // selection on release.
      onPointerDown={(e) => {
        pointerPress.x = e.clientX;
        pointerPress.y = e.clientY;
        pointerPress.pressed = true;
      }}
    >
      <Canvas
        // Cap device pixel ratio: most of our students are on mid-range Android,
        // and these models carry up to ~550k triangles.
        dpr={[1, 2]}
        camera={{ fov: 45, near: 0.01, far: 100 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        // Per-material clipping planes are opt-in in three.js. The whole-body
        // mirror uses them to cut each half exactly at the midline so the two
        // sides cannot overlap. See AnatomyModel's mirror effect.
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
        className="h-full w-full"
      >
        <color attach="background" args={[CANVAS_BG]} />

        {/*
          Plain lights, deliberately. drei's <Environment preset> fetches an HDR
          from an external CDN — an uptime dependency we don't control, it breaks
          offline, and because it suspends in the same boundary as the model, a
          slow fetch leaves the whole viewer blank.

          Balanced for a light background: a hemisphere fill keeps shadowed
          undersides readable instead of going muddy, which matters when the
          structure a student wants is tucked underneath another.
        */}
        <hemisphereLight args={["#ffffff", "#93a3b5", 0.55]} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 8, 5]} intensity={1.9} />
        <directionalLight position={[-6, 1, -4]} intensity={0.7} />
        <directionalLight position={[0, -6, 3]} intensity={0.35} />

        <Suspense fallback={null}>
          <AnatomyModel url={url} regionId={regionId} />
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          // Zoom towards whatever is under the pointer rather than the orbit
          // target. Without this, zooming into a specific structure means zoom,
          // pan, zoom, pan — because the camera always dollies at the centre of
          // the model instead of the thing you are looking at.
          zoomToCursor
          zoomSpeed={0.8}
          // A modest drag should turn the model a long way. At the default speed,
          // seeing the back of a model meant sweeping most of the way across the
          // canvas, which reads as "it barely rotates".
          rotateSpeed={1.6}
          // Let students get right inside a joint space.
          minDistance={0.02}
          maxDistance={20}
        />
        <AdaptiveDpr pixelated />
      </Canvas>
    </div>
  );
}
