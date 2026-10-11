// RunnerFactory — builds the 3D visual for one Derby runner: the stable's
// horse-and-rider GLB when it has loaded, otherwise a simple stand-in horse in
// the runner's silks (fresh clones without the licensed model packs).

import * as THREE from 'three';
import { SYNTY_CLIP_MAP, type StableId } from '@derby/shared';
import { AssetManager } from './AssetManager';
import { TransformVisual, type PieceVisual } from './pieces/PieceVisual';
import { SkinnedVisual } from './pieces/SkinnedVisual';

export function createRunnerVisual(stable: StableId, look: string, silks: string): PieceVisual {
  const d = AssetManager.manifest?.runners?.[stable]?.[look] ?? AssetManager.manifest?.runners?.[stable]?.w;
  const gltf = d ? AssetManager.peek(`/assets/${d.file}`) : null;
  const model = d && gltf ? AssetManager.cloneNode(gltf, d.node) : null;
  if (!d || !gltf || !model) return standIn(silks);
  const holder = new THREE.Group();
  holder.add(model);
  return new SkinnedVisual({ model: holder, clips: gltf.animations, clipMap: { ...SYNTY_CLIP_MAP, ...d.clips }, base: null, baseEmissive: [], mechanical: false });
}

/** Box-and-capsule horse with a rider, facing +Z, ~1.5 units tall. */
function standIn(silks: string): PieceVisual {
  const coat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.75 });
  const cloth = new THREE.MeshStandardMaterial({ color: silks, roughness: 0.8, name: 'MAT_silks' });
  const dark = new THREE.MeshStandardMaterial({ color: '#1c1612', roughness: 0.8 });
  const body = new THREE.Group();
  const box = (w: number, h: number, l: number, m: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m);
    mesh.position.set(x, y, z); mesh.rotation.x = rx; mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  };
  box(0.32, 0.34, 0.95, coat, 0, 0.78, 0);              // barrel
  box(0.16, 0.42, 0.18, coat, 0, 1.05, 0.48, -0.5);     // neck
  box(0.14, 0.16, 0.34, coat, 0, 1.22, 0.62);           // head
  for (const [x, z] of [[-0.11, 0.36], [0.11, 0.36], [-0.11, -0.36], [0.11, -0.36]]) box(0.08, 0.62, 0.08, coat, x, 0.31, z);
  box(0.34, 0.03, 0.36, cloth, 0, 0.97, -0.02);         // saddle cloth
  box(0.2, 0.34, 0.16, cloth, 0, 1.2, -0.05);           // rider torso
  box(0.13, 0.13, 0.13, dark, 0, 1.43, -0.04);          // rider head
  const object = new THREE.Group();
  object.add(body);
  return new TransformVisual(object, body, null, 1.5);
}
