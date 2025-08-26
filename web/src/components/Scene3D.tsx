// web/src/components/Scene3D.tsx
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import React, { useEffect, useMemo } from "react";

type Scene3DProps = {
  /** 8x3 anchor points in mm, world frame */
  anchors: number[][];
  /** 8x3 attachment points in mm, platform-local frame */
  attachments: number[][];
  /** [x, y, z, roll, pitch, yaw] -> mm / rad */
  pose: number[];
};

/** 1 scene unit ≈ 100 mm to keep the scene compact */
const mmToScene = 0.01;

/** R = Rz(yaw) * Ry(pitch) * Rx(roll) */
function rzyxMatrix(roll: number, pitch: number, yaw: number) {
  const Rx = new THREE.Matrix4().makeRotationX(roll);
  const Ry = new THREE.Matrix4().makeRotationY(pitch);
  const Rz = new THREE.Matrix4().makeRotationZ(yaw);
  return new THREE.Matrix4().multiplyMatrices(Rz, new THREE.Matrix4().multiplyMatrices(Ry, Rx));
}

/**
 * Imperatively add a THREE.Object3D to the scene (no JSX intrinsic tags needed).
 * Supports optional position/quaternion props.
 */
function AddObject({
  object,
  position,
  quaternion,
}: {
  object: THREE.Object3D;
  position?: [number, number, number];
  quaternion?: THREE.Quaternion;
}) {
  const { scene } = useThree();

  useEffect(() => {
    // set transforms if provided
    if (position) {
      object.position.set(position[0], position[1], position[2]);
    }
    if (quaternion) {
      object.quaternion.copy(quaternion);
    }

    scene.add(object);
    return () => {
      scene.remove(object);
      // If it's disposable, free GPU memory
      // @ts-ignore
      if (object.dispose) object.dispose();
      // dispose materials/geometries if Mesh
      const mesh = object as THREE.Mesh;
      // @ts-ignore
      if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose();
      // @ts-ignore
      if (mesh.material && (mesh.material as any).dispose) (mesh.material as any).dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, object, position?.[0], position?.[1], position?.[2], quaternion?.x, quaternion?.y, quaternion?.z, quaternion?.w]);

  return null;
}

function SceneContents({ anchors, attachments, pose }: Scene3DProps) {
  const [x, y, z, roll, pitch, yaw] = pose ?? [0, 0, 0, 0, 0, 0];

  // world transform
  const T = useMemo(
    () => new THREE.Vector3(x * mmToScene, y * mmToScene, z * mmToScene),
    [x, y, z]
  );
  const R = useMemo(() => rzyxMatrix(roll, pitch, yaw), [roll, pitch, yaw]);
  const Q = useMemo(() => new THREE.Quaternion().setFromRotationMatrix(R), [R]);

  // shared geometries/materials
  const anchorGeom = useMemo(() => new THREE.SphereGeometry(0.035, 16, 16), []);
  const anchorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6b7280" }), []);
  const attachGeom = useMemo(() => new THREE.SphereGeometry(0.03, 16, 16), []);
  const attachMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2563eb" }), []);
  const boxMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#3b82f6", transparent: true, opacity: 0.2 }),
    []
  );

  const worldAnchors = useMemo(
    () => anchors.map((a) => new THREE.Vector3(a[0] * mmToScene, a[1] * mmToScene, a[2] * mmToScene)),
    [anchors]
  );

  const worldAttachments = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (const b of attachments) {
      const local = new THREE.Vector3(b[0] * mmToScene, b[1] * mmToScene, b[2] * mmToScene);
      const world = local.clone().applyMatrix4(R).add(T);
      out.push(world);
    }
    return out;
  }, [attachments, R, T]);

  // proxy platform box (size from attachment extents, in local/platform frame)
  const boxGeometry = useMemo(() => {
    const xs = attachments.map((p) => p[0]);
    const ys = attachments.map((p) => p[1]);
    const zs = attachments.map((p) => p[2]);
    const sx = (Math.max(...xs) - Math.min(...xs)) * mmToScene || 0.4;
    const sy = (Math.max(...ys) - Math.min(...ys)) * mmToScene || 0.4;
    const sz = (Math.max(...zs) - Math.min(...zs)) * mmToScene || 0.2;
    return new THREE.BoxGeometry(Math.max(0.1, sx), Math.max(0.1, sy), Math.max(0.05, sz));
  }, [attachments]);

  // lights & helpers created as objects:
  const ambient = useMemo(() => new THREE.AmbientLight(0xffffff, 0.6), []);
  const dirLight = useMemo(() => {
    const d = new THREE.DirectionalLight(0xffffff, 0.7);
    d.position.set(3, 4, 5);
    return d;
  }, []);
  const grid = useMemo(() => new THREE.GridHelper(20, 20, 0xdddddd, 0xeeeeee), []);
  const axes = useMemo(() => new THREE.AxesHelper(1.0), []);

  return (
    <>
      {/* Add lights/helpers */}
      <AddObject object={ambient} />
      <AddObject object={dirLight} />
      <AddObject object={grid} />
      <AddObject object={axes} />

      {/* anchors: gray spheres */}
      {worldAnchors.map((p, i) => {
        const mesh = new THREE.Mesh(anchorGeom, anchorMat);
        return <AddObject key={`anc-${i}`} object={mesh} position={[p.x, p.y, p.z]} />;
      })}

      {/* platform box: positioned at T with quaternion Q */}
      {(() => {
        const box = new THREE.Mesh(boxGeometry, boxMat);
        return <AddObject object={box} position={[T.x, T.y, T.z]} quaternion={Q} />;
      })()}

      {/* attachments: blue spheres at transformed world positions */}
      {worldAttachments.map((p, i) => {
        const mesh = new THREE.Mesh(attachGeom, attachMat);
        return <AddObject key={`att-${i}`} object={mesh} position={[p.x, p.y, p.z]} />;
      })}

      {/* cables: black lines from each anchor to the transformed attachment */}
      {worldAnchors.map((a, i) => {
        const b = worldAttachments[i];
        const pts: [number, number, number][] = [
          [a.x, a.y, a.z],
          [b.x, b.y, b.z],
        ];
        return <Line key={`cable-${i}`} points={pts} color="#111827" lineWidth={1.5} />;
      })}

      <OrbitControls makeDefault />
    </>
  );
}

export default function Scene3D(props: Scene3DProps) {
  return (
    <div style={{ width: "100%", height: 420, border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <Canvas camera={{ position: [2, 2, 2], fov: 45 }}>
        <SceneContents {...props} />
      </Canvas>
    </div>
  );
}
