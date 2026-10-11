// AssetManager — async GLB loading with caching, Draco + Meshopt decoding,
// and the asset manifest produced by the Blender pipeline
// (tools/blender/build_runners.py -> public/assets/manifest.json).
// Only the runners on the current race card are loaded.

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GameAction, StableId } from '@derby/shared';
import { withBase } from '../core/base';

/** One horse-and-rider model: a GLB with its own embedded clips. */
export interface ManifestRunner {
  /** GLB file (relative to /assets). */
  file: string;
  /** Root node name inside the GLB. */
  node: string;
  /** Clip map overrides (action -> clip name). */
  clips?: Partial<Record<GameAction, string>>;
}
export interface AssetManifest {
  version: number;
  /** Runner models per stable, keyed by look ('w' / 'b' = the stable's two classic riders, 'j1'..'j5' = the rest). */
  runners: Partial<Record<StableId, Record<string, ManifestRunner>>>;
  /** Ruins, wrecks and props placed around the course. */
  environment?: { file: string; props: string[] };
}

class AssetManagerImpl {
  private loader: GLTFLoader;
  private cache = new Map<string, Promise<GLTF>>();
  manifest: AssetManifest | null = null;
  private manifestPromise: Promise<AssetManifest | null> | null = null;

  constructor() {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(draco);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  loadManifest(): Promise<AssetManifest | null> {
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(withBase('/assets/manifest.json'))
        .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
        .then((m) => (this.manifest = m))
        .catch(() => null);
    }
    return this.manifestPromise;
  }

  load(url: string): Promise<GLTF> {
    let p = this.cache.get(url);
    if (!p) {
      p = this.loader.loadAsync(withBase(url));
      this.cache.set(url, p);
      p.then((g) => this.resolved.set(url, g)).catch(() => this.cache.delete(url));
    }
    return p;
  }

  /** Runner models for one race card only (each is a full horse + rider, ~0.7 MB). */
  async preloadRunners(runners: { faction: StableId; look: string }[]) {
    const m = await this.loadManifest();
    const files = new Set(runners.map((r) => m?.runners?.[r.faction]?.[r.look]?.file).filter((f): f is string => !!f));
    await Promise.allSettled([...files].map((f) => this.load(`/assets/${f}`)));
  }

  /** Synchronous access to an already-loaded GLTF (null if not loaded yet). */
  private resolved = new Map<string, GLTF>();
  peek(url: string): GLTF | null {
    if (this.resolved.has(url)) return this.resolved.get(url)!;
    const p = this.cache.get(url);
    if (p) void p.then((g) => this.resolved.set(url, g)).catch(() => {});
    return null;
  }

  /** Clone a node out of a loaded GLB, with skeleton support. */
  cloneNode(gltf: GLTF, nodeName: string): THREE.Object3D | null {
    // Fall back to the whole scene: optimisers may flatten/rename the root of single-piece files.
    const src = gltf.scene.getObjectByName(nodeName) ?? (gltf.scene.children.length ? gltf.scene : null);
    if (!src) return null;
    // Keep the root's own transform: exporters put axis conversion (e.g. FBX's
    // 90° X), unit scale and grounding offsets there.
    return SkeletonUtils.clone(src);
  }
}

export const AssetManager = new AssetManagerImpl();
