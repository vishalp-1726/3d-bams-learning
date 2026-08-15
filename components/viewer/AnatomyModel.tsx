"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useViewer, isMeshVisible, isDrag, VIEW_DIRECTIONS } from "@/lib/viewer-store";
import {
  SELECTION_COLOR,
  HOVER_COLOR,
  SELECTION_INTENSITY,
  HOVER_INTENSITY,
} from "@/lib/layers";

const SELECTION = new THREE.Color(SELECTION_COLOR);
const HOVER = new THREE.Color(HOVER_COLOR);
const BLACK = new THREE.Color(0x000000);

interface Props {
  url: string;
  /** Region id, used to fetch the canonical -> original name lookup. */
  regionId: string;
  onReady?: () => void;
}

export default function AnatomyModel({ url, regionId, onReady }: Props) {
  const { scene } = useGLTF(url, "/draco/");
  const { camera, controls } = useThree();

  const setModel = useViewer((s) => s.setModel);
  const setMeshLabels = useViewer((s) => s.setMeshLabels);
  const meshLabels = useViewer((s) => s.meshLabels);
  const select = useViewer((s) => s.select);
  const hover = useViewer((s) => s.hover);

  const framed = useRef(false);

  /**
   * Clone the GLTF once per mount. useGLTF caches by URL, so mutating the cached
   * scene (which we do — visibility, materials) would leak across navigations.
   * Geometry is shared by clone(), so this is cheap.
   */
  const root = useMemo(() => scene.clone(true), [scene]);

  /**
   * Walk the scene once: record which top-level group each mesh belongs to, and
   * build a name -> meshes index so later updates can touch only what changed
   * instead of traversing all 500+ objects.
   *
   * Materials are deliberately NOT cloned here. Cloning every mesh's material up
   * front cost ~500 allocations on every model load for no benefit — at rest,
   * nothing is highlighted or faded. Materials are cloned lazily, the first time
   * a given mesh actually needs to look different (see ensureOwnMaterial).
   */
  const { groups, meshIndex } = useMemo(() => {
    const groups: Record<string, string[]> = {};
    const meshIndex = new Map<string, THREE.Mesh[]>();

    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      // Climb to the child of the scene root — that node is the layer group.
      let node: THREE.Object3D = object;
      while (node.parent && node.parent !== root) node = node.parent;
      const group = node.name || "Ungrouped";

      (groups[group] ??= []).push(object.name);
      const existing = meshIndex.get(object.name);
      if (existing) existing.push(object);
      else meshIndex.set(object.name, [object]);

      object.userData.group = group;
    });

    for (const names of Object.values(groups)) names.sort();
    return { groups, meshIndex };
  }, [root]);

  // Publish the model's structure to the 2D UI.
  useEffect(() => {
    setModel(groups);
    onReady?.();
  }, [groups, setModel, onReady]);

  /*
   * three.js rewrites node names when it parses a GLB, so the scene carries
   * "Anterior_cruciate_ligamentr" rather than "Anterior cruciate ligament.r".
   * This lookup restores the original for display. Failure is non-fatal: the
   * viewer falls back to unmangling the canonical name.
   */
  useEffect(() => {
    let cancelled = false;
    fetch(`/mesh-labels/${regionId}.json`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((labels) => {
        if (!cancelled) setMeshLabels(labels);
      })
      .catch(() => {
        /* fall back to the canonical name */
      });
    return () => {
      cancelled = true;
    };
  }, [regionId, setMeshLabels]);

  /**
   * Give a mesh its own material instance, so changing it cannot bleed into other
   * meshes that happen to share the source material. Done on demand and only once.
   */
  const ensureOwnMaterial = useCallback((mesh: THREE.Mesh) => {
    if (mesh.userData.ownMaterial) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
    mesh.userData.ownMaterial = true;
  }, []);

  const paint = useCallback(
    (meshName: string | null, colour: THREE.Color, intensity: number) => {
      if (!meshName) return;
      for (const mesh of meshIndex.get(meshName) ?? []) {
        ensureOwnMaterial(mesh);
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          material.emissive.copy(colour);
          material.emissiveIntensity = intensity;
          // No needsUpdate: emissive and intensity are plain uniforms. Setting
          // needsUpdate would force a shader recompile check on every hover.
        }
      }
    },
    [meshIndex, ensureOwnMaterial]
  );

  /*
   * Highlight. Subscribing to just `selected` and `hovered`, and repainting only
   * the meshes that changed, keeps hover at O(1) instead of O(number of meshes).
   * The previous version walked every mesh and set material.needsUpdate on each
   * pointer move — on the 532-mesh upper limb that was thousands of shader
   * recompile checks per second.
   */
  const selected = useViewer((s) => s.selected);
  const hovered = useViewer((s) => s.hovered);
  const prev = useRef<{ selected: string | null; hovered: string | null }>({
    selected: null,
    hovered: null,
  });

  useEffect(() => {
    const last = prev.current;

    if (last.selected !== selected) {
      paint(last.selected, BLACK, 0);
      paint(selected, SELECTION, SELECTION_INTENSITY);
    }
    if (last.hovered !== hovered) {
      // Never clear a mesh that is still selected.
      if (last.hovered && last.hovered !== selected) paint(last.hovered, BLACK, 0);
      if (hovered && hovered !== selected) paint(hovered, HOVER, HOVER_INTENSITY);
    }

    prev.current = { selected, hovered };
  }, [selected, hovered, paint]);

  // Visibility. Only recomputed when a layer/region/isolate actually changes.
  const isolated = useViewer((s) => s.isolated);
  const hiddenLayers = useViewer((s) => s.hiddenLayers);
  const hiddenRegions = useViewer((s) => s.hiddenRegions);
  const hiddenMeshes = useViewer((s) => s.hiddenMeshes);
  const meshLayer = useViewer((s) => s.meshLayer);
  const meshRegion = useViewer((s) => s.meshRegion);

  useEffect(() => {
    const state = useViewer.getState();
    for (const [name, meshes] of meshIndex) {
      const visible = isMeshVisible(state, name);
      for (const mesh of meshes) mesh.visible = visible;
    }
  }, [meshIndex, isolated, hiddenLayers, hiddenRegions, hiddenMeshes, meshLayer, meshRegion]);

  // Context fade. Only runs while the slider is actually being moved.
  const contextOpacity = useViewer((s) => s.contextOpacity);
  const fadedRef = useRef(false);

  useEffect(() => {
    const faded = contextOpacity < 1;
    // Skip entirely in the common case: never faded, still not faded.
    if (!faded && !fadedRef.current) return;
    fadedRef.current = faded;

    for (const [name, meshes] of meshIndex) {
      const dim = faded && name !== selected;
      for (const mesh of meshes) {
        ensureOwnMaterial(mesh);
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (material.transparent !== dim) {
            // Toggling transparency DOES change the shader/render path, so this
            // is the one case that genuinely needs needsUpdate.
            material.transparent = dim;
            material.needsUpdate = true;
          }
          material.opacity = dim ? contextOpacity : 1;
          material.depthWrite = !dim;
        }
      }
    }
  }, [contextOpacity, selected, meshIndex, ensureOwnMaterial]);

  /*
   * Debug handle.
   *
   * Camera and control state cannot be read from outside the R3F tree, so
   * "rotation does not work" reports could previously only be investigated by
   * looking at pixels — which is indirect and, as it turned out, misleading.
   * Exposing the live objects lets a test read the actual azimuth and orbit
   * target. It is a couple of references on window; it changes no behaviour.
   */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__anat = {
      get camera() {
        return camera;
      },
      get controls() {
        return controls;
      },
      get root() {
        return root;
      },
    };
  }, [camera, controls, root]);

  /** The mirrored half, when "whole body" is switched on. */
  const mirrorRoot = useRef<THREE.Object3D | null>(null);
  /** Bounds of everything currently on screen, including the mirrored half. */
  const boundsRef = useRef(new THREE.Box3());

  /**
   * Point the orbit at the middle of whatever is currently visible, and refit the
   * camera to it. Called on load and whenever the mirror is toggled, since both
   * change where the centre of the model actually is.
   */
  const recentre = useCallback(
    (refit = true) => {
      const orbit = controls as unknown as
        | { target?: THREE.Vector3; update?: () => void; saveState?: () => void }
        | null;
      if (!orbit?.target) return;

      const box = new THREE.Box3().setFromObject(root);
      if (mirrorRoot.current) box.expandByObject(mirrorRoot.current);
      if (box.isEmpty()) return;

      const size = box.getSize(new THREE.Vector3());
      /*
       * Generous margin, on purpose.
       *
       * The clamp exists only to stop the orbit centre wandering far away from the
       * model. zoom-to-cursor works precisely BY moving the target towards the
       * pointer, so a tight box cancels it out and zooming silently reverts to
       * centre-zoom — which is what happened at 15%. A full model-width of slack
       * leaves cursor-zoom free while still catching real runaway.
       */
      boundsRef.current.copy(box).expandByVector(size.clone().multiplyScalar(1.0));

      const centre = box.getCenter(new THREE.Vector3());
      /*
       * Preserve the direction the student is currently looking from — except on
       * the very first framing, where there is no meaningful direction yet and
       * the default camera would give a flat, straight-on elevation. A slight
       * three-quarter view reads as three-dimensional immediately.
       */
      const direction = framed.current
        ? camera.position.clone().sub(orbit.target)
        : new THREE.Vector3(0.35, 0.18, 1);
      if (direction.lengthSq() === 0) direction.set(0.35, 0.18, 1);
      direction.normalize();

      let distance = camera.position.distanceTo(orbit.target);
      if (refit) {
        const perspective = camera as THREE.PerspectiveCamera;
        const vFov = ((perspective.fov ?? 45) * Math.PI) / 180;
        const aspect = perspective.aspect || 1;
        distance =
          Math.max(
            size.y / 2 / Math.tan(vFov / 2),
            size.x / 2 / (Math.tan(vFov / 2) * aspect),
            size.z / 2 / Math.tan(vFov / 2)
          ) * 1.25;
        perspective.near = Math.max(distance / 1000, 0.001);
        perspective.far = distance * 20;
        perspective.updateProjectionMatrix();
      }

      camera.position.copy(centre).addScaledVector(direction, distance);
      camera.lookAt(centre);
      orbit.target.copy(centre);
      orbit.update?.();
      orbit.saveState?.();
    },
    [camera, controls, root]
  );

  /*
   * Frame the model once on load, whatever its scale — the source files are in
   * metres and vary from a 0.2 m vertebra to a 1.8 m whole skeleton.
   *
   * This waits for OrbitControls to register itself. Running before `controls`
   * exists would leave the orbit target at the world origin, so dragging would
   * swing the model out of frame instead of turning it on the spot. Leaving
   * framed.current false means the effect simply runs again once controls arrive.
   */
  useEffect(() => {
    if (framed.current) return;
    const orbit = controls as unknown as { target?: THREE.Vector3 } | null;
    if (!orbit?.target) return;
    // Order matters: recentre() reads framed.current to decide whether to keep the
    // current viewing direction or set the initial three-quarter view.
    recentre(true);
    framed.current = true;
  }, [controls, recentre]);

  /*
   * Keep the orbit centre on the model.
   *
   * zoomToCursor makes scroll-zoom aim at the pointer, which is what students
   * want — but it does so by moving the orbit target. Zoom into a structure near
   * the edge a few times and the target ends up off the model entirely, so
   * dragging then swings the whole body around a point in empty space instead of
   * turning it. That reads as "I can't rotate it to see all sides".
   *
   * Clamping the target into the model's own bounding box keeps rotation
   * predictable without taking zoom-to-cursor away.
   */
  useEffect(() => {
    const orbit = controls as unknown as
      | { target?: THREE.Vector3; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void }
      | null;
    if (!orbit?.target || !orbit.addEventListener) return;

    const clamp = () => {
      // Uses the live bounds, so it follows the mirror being switched on and off.
      const bounds = boundsRef.current;
      if (bounds.isEmpty()) return;
      const t = orbit.target!;
      t.set(
        Math.min(Math.max(t.x, bounds.min.x), bounds.max.x),
        Math.min(Math.max(t.y, bounds.min.y), bounds.max.y),
        Math.min(Math.max(t.z, bounds.min.z), bounds.max.z)
      );
    };

    orbit.addEventListener("change", clamp);
    return () => orbit.removeEventListener?.("change", clamp);
  }, [controls, root]);

  /*
   * Jump to a standard anatomical view.
   *
   * Keeps the current orbit centre and distance and only swings the camera to a
   * new direction, so switching between front and back does not also re-zoom.
   */
  const viewRequest = useViewer((s) => s.viewRequest);
  useEffect(() => {
    if (!viewRequest) return;
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    if (!orbit?.target) return;

    const dir = VIEW_DIRECTIONS[viewRequest.view];
    const distance = camera.position.distanceTo(orbit.target) || 1;
    camera.position
      .copy(orbit.target)
      .addScaledVector(new THREE.Vector3(dir[0], dir[1], dir[2]).normalize(), distance);
    camera.lookAt(orbit.target);
    orbit.update?.();
  }, [viewRequest, camera, controls]);

  /*
   * Frame a chosen structure: put the orbit centre on it and pull the camera in.
   * Without this, examining a small structure means orbiting the whole body and
   * repeatedly losing it off-screen.
   */
  const focusRequest = useViewer((s) => s.focusRequest);
  useEffect(() => {
    if (!focusRequest) return;
    const meshes = meshIndex.get(focusRequest.meshName);
    if (!meshes?.length) return;

    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    if (!orbit?.target) return;

    const box = new THREE.Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    if (box.isEmpty()) return;

    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 0.01);
    const perspective = camera as THREE.PerspectiveCamera;
    const distance = (radius * 2.4) / Math.tan((((perspective.fov ?? 45) * Math.PI) / 180) / 2);

    // Approach along the current viewing direction so the view does not jump.
    const direction = camera.position.clone().sub(orbit.target).normalize();
    camera.position.copy(centre).addScaledVector(direction, Math.max(distance, radius * 1.5));
    orbit.target.copy(centre);
    camera.lookAt(centre);
    orbit.update?.();
  }, [focusRequest, meshIndex, camera, controls]);

  /*
   * Mirror the hemi-body model into a whole body.
   *
   * The source files contain the right side plus the midline structures and no
   * left side at all, which reads as a broken download. Reflecting the LATERAL
   * meshes across the midline plane produces the missing half.
   *
   * Only laterally-marked meshes are mirrored. Midline structures — vertebrae,
   * sacrum, sternum — sit on the mirror plane, so duplicating them would put two
   * coincident surfaces in the same place and produce z-fighting.
   *
   * Mirrored meshes are registered under the same names as their originals, so
   * selecting a structure highlights both sides and the info panel is unaffected.
   */
  const mirrored = useViewer((s) => s.mirrored);

  useEffect(() => {
    // Needs the original names to tell lateral from midline; they arrive with the
    // label lookup. Nothing to undo here — the cleanup below owns teardown.
    if (!mirrored || Object.keys(meshLabels).length === 0) return;

    const isLateral = (mesh: THREE.Mesh) => {
      const raw = meshLabels[mesh.name] ?? mesh.name;
      return /\.\s*[rl]\d*\.?$/i.test(raw.trim());
    };

    // The mirror plane is the midline: the middle of the structures that are NOT
    // side-marked. With none present, fall back to the model's own edge.
    const midlineBox = new THREE.Box3();
    let midlineCount = 0;
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && !isLateral(o)) {
        midlineBox.expandByObject(o);
        midlineCount++;
      }
    });
    const fullBox = new THREE.Box3().setFromObject(root);
    const planeX = midlineCount > 0 ? midlineBox.getCenter(new THREE.Vector3()).x : fullBox.min.x;

    /*
     * Two half-space clipping planes that meet at the midline.
     *
     * three.js keeps geometry where `normal · point + constant >= 0`.
     *   originalSidePlane keeps  x <= planeX   (the real, scanned half)
     *   mirrorSidePlane   keeps  x >= planeX   (the reflected half)
     *
     * Applying both means the two halves meet exactly at the plane and share no
     * volume at all, so there is nothing left for the depth buffer to fight over.
     */
    const originalSidePlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), planeX);
    const mirrorSidePlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -planeX);

    /*
     * Clip the LATERAL originals back to their own side — and only those.
     *
     * Midline structures (vertebrae, sacrum, sternum, skull) straddle the plane
     * by design: 36 of the skeleton's 37 unmarked meshes cross x=0. They are not
     * mirrored, so clipping them would delete their far half outright — which
     * showed up as a skull sliced in two and a spine full of gaps.
     *
     * Materials are shared between lateral and midline meshes, so each lateral
     * mesh needs its own instance before it can be clipped independently.
     */
    const clippedOriginals: THREE.Material[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (!isLateral(o)) return;
      ensureOwnMaterial(o);
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) {
        if (clippedOriginals.includes(m)) continue;
        m.clippingPlanes = [originalSidePlane];
        m.clipShadows = true;
        clippedOriginals.push(m);
      }
    });

    const clone = root.clone(true);
    const doomed: THREE.Object3D[] = [];
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh && !isLateral(o)) doomed.push(o);
    });
    for (const o of doomed) o.removeFromParent();

    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.userData.isMirror = true;

      /*
       * Mirrored materials need two things:
       *
       * 1. Negative scale reverses triangle winding, so back-face culling would
       *    turn the mirrored half inside out. Render both sides.
       * 2. A clipping plane at the midline. Seven structures reach x=0 exactly —
       *    the maxilla, nasal and palatine bones, trapezius, the rhomboids,
       *    splenius cervicis and serratus posterior inferior. Their reflections
       *    would occupy the same space as the originals, and the depth buffer
       *    then flickers between the two: the speckle across the face and neck.
       *    Clipping removes the shared geometry outright rather than biasing
       *    which copy wins, which a polygon offset alone could not do reliably.
       */
      const prepare = (m: THREE.Material) => {
        const c = m.clone();
        c.side = THREE.DoubleSide;
        c.clippingPlanes = [mirrorSidePlane];
        c.clipShadows = true;
        return c;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(prepare)
        : prepare(o.material);

      const list = meshIndex.get(o.name);
      if (list) list.push(o);
    });

    // Reflect about x = planeX:  world = 2*planeX - x
    clone.scale.x = -1;
    clone.position.x = 2 * planeX;

    root.parent?.add(clone);
    mirrorRoot.current = clone;

    /*
     * Re-centre the orbit on the NEW extent.
     *
     * Mirroring doubles the body's width and moves its centre onto the midline.
     * Leaving the orbit target at the centre of the right half — roughly a fifth
     * of the model's width off to one side — makes every drag swing the whole
     * body through an arc instead of turning it in place. That is the "I still
     * cannot rotate it" symptom, and it appears only once the mirror is on.
     */
    recentre();

    return () => {
      clone.removeFromParent();
      // Release the originals so the single-sided view is not cut in half.
      for (const m of clippedOriginals) m.clippingPlanes = null;
      // Same in reverse: going back to one side moves the centre again.
      queueMicrotask(recentre);
      for (const [name, meshes] of meshIndex) {
        meshIndex.set(
          name,
          meshes.filter((m) => !m.userData.isMirror)
        );
      }
      mirrorRoot.current = null;
    };
  }, [mirrored, meshLabels, meshIndex, root]);

  /*
   * Tell a click apart from a drag.
   *
   * R3F fires onClick whenever pointerdown and pointerup land on the same object,
   * however far the pointer travelled in between. Since rotating means pressing on
   * the model and dragging, every attempt to turn the view also re-selected
   * whatever was under the cursor — the panel kept changing and the viewer felt
   * like it was fighting the user. Anything past a few pixels is a drag.
   */
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (isDrag(event)) return;
    if (event.object instanceof THREE.Mesh) select(event.object.name);
  };

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const name = event.object instanceof THREE.Mesh ? event.object.name : null;
    // Guard against re-setting the same value: zustand would notify subscribers
    // on every pointer move otherwise.
    if (name !== useViewer.getState().hovered) hover(name);
  };

  return (
    <primitive
      object={root}
      onClick={handleClick}
      onPointerMove={handleMove}
      onPointerOut={() => hover(null)}
      onPointerMissed={(event: MouseEvent) => {
        // Dragging on empty background is a rotate, not a deselect.
        if (!isDrag(event)) select(null);
      }}
    />
  );
}
