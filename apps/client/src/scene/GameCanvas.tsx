// GameCanvas — the one WebGL view. The racecourse is always on screen: behind
// the sign-in screen it idles with a slow orbit, on the track it plays the live
// race. Post-processing follows the graphics preset.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette, SMAA } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSettings } from '../core/settings';
import { useDerby } from '../core/derbyStore';
import { useApp } from '../core/store';
import { AssetManager } from '../game/AssetManager';
import { DerbyStage } from '../game/derby/DerbyStage';

/** Shared handle for dev tools and visual QA. */
export const StageHandle: { derby: DerbyStage | null; gl: THREE.WebGLRenderer | null; fps: number } = { derby: null, gl: null, fps: 0 };

function StageMount() {
  const { camera, scene, gl, size } = useThree();
  const shadows = useSettings((s) => s.graphics.shadows);
  const derby = useMemo(() => new DerbyStage(), []);

  useEffect(() => {
    scene.add(derby.root);
    derby.setActive(true, scene);
    StageHandle.derby = derby;
    StageHandle.gl = gl;
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__derby = { derby, gl, scene, camera, useApp, useDerby, AssetManager };
    return () => { derby.setActive(false, scene); scene.remove(derby.root); StageHandle.derby = null; };
  }, [derby, scene, gl, camera]);

  useEffect(() => { derby.setViewportHeight(size.height); }, [derby, size.height]);

  useEffect(() => {
    gl.shadowMap.enabled = shadows > 0;
    gl.shadowMap.type = shadows >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  }, [shadows, gl]);

  const fps = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    derby.update(dt, camera as THREE.PerspectiveCamera);
    const a = fps.current;
    a.t += dt; a.n++;
    if (a.t > 0.5) { StageHandle.fps = Math.round(a.n / a.t); a.t = 0; a.n = 0; }
  });
  return null;
}

function Effects() {
  const pp = useSettings((s) => s.graphics.postprocessing);
  if (pp === 0) return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={pp === 2 ? 0.9 : 0.6} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette offset={0.28} darkness={0.62} />
      {pp === 2 ? <Noise opacity={0.028} premultiply /> : <></>}
      {pp === 2 ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

export function GameCanvas() {
  const dpr = useSettings((s) => s.graphics.dpr);
  return (
    <Canvas
      className="game-canvas"
      dpr={[1, dpr]}
      shadows
      camera={{ fov: 40, near: 0.1, far: 600, position: [0, 12, 14] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ gl }) => { gl.setClearColor('#0d0b09'); }}
    >
      <StageMount />
      <Effects />
    </Canvas>
  );
}
