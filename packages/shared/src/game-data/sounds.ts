// Sound catalogue. Every id is a hook: the AudioManager plays
// /assets/audio/<id>.ogg when present, otherwise a procedural placeholder
// synthesised from `synth`, so the game always has audio feedback.
export type AudioBus = 'music' | 'ambience' | 'sfx' | 'voice' | 'ui';

export interface SoundDef { id: string; bus: AudioBus; volume: number; synth: string }

export const SOUNDS: SoundDef[] = [
  { id: 'amb_wind', bus: 'ambience', volume: 0.35, synth: 'wind' },
  { id: 'amb_distant_explosion', bus: 'ambience', volume: 0.4, synth: 'boom_far' },
  { id: 'music_lobby', bus: 'music', volume: 0.3, synth: 'drone' },
  { id: 'swing_light', bus: 'sfx', volume: 0.6, synth: 'whoosh' },
  { id: 'swing_heavy', bus: 'sfx', volume: 0.7, synth: 'whoosh_low' },
  { id: 'swing_hydraulic', bus: 'sfx', volume: 0.7, synth: 'hydraulic' },
  { id: 'hit_flesh', bus: 'sfx', volume: 0.8, synth: 'thud' },
  { id: 'hit_energy', bus: 'sfx', volume: 0.8, synth: 'zap_hit' },
  { id: 'block', bus: 'sfx', volume: 0.7, synth: 'clang' },
  { id: 'gun_shotgun', bus: 'sfx', volume: 0.9, synth: 'gun' },
  { id: 'crossbow_shot', bus: 'sfx', volume: 0.75, synth: 'whoosh' },
  { id: 'flare_shot', bus: 'sfx', volume: 0.8, synth: 'gun' },
  { id: 'hit_blade', bus: 'sfx', volume: 0.8, synth: 'thud' },
  { id: 'hit_blunt', bus: 'sfx', volume: 0.85, synth: 'thud' },
  { id: 'chain_whip', bus: 'sfx', volume: 0.75, synth: 'chain' },
  { id: 'electric_zap', bus: 'sfx', volume: 0.7, synth: 'zap_hit' },
  { id: 'derby_gallop', bus: 'ambience', volume: 0.5, synth: 'step' },
  { id: 'derby_crowd', bus: 'ambience', volume: 0.55, synth: 'wind' },
  { id: 'derby_fall', bus: 'sfx', volume: 0.85, synth: 'thud_heavy' },
  { id: 'ui_hover', bus: 'ui', volume: 0.2, synth: 'tick' },
  { id: 'ui_click', bus: 'ui', volume: 0.4, synth: 'click' },
  { id: 'ui_select', bus: 'ui', volume: 0.4, synth: 'blip' },
  { id: 'ui_error', bus: 'ui', volume: 0.4, synth: 'buzz' },
  { id: 'ability', bus: 'sfx', volume: 0.7, synth: 'ability' },
];
export const SOUNDS_BY_ID: Record<string, SoundDef> = Object.fromEntries(SOUNDS.map((s) => [s.id, s]));

/** Derby jockey weapons -> attack + hit sounds. */
export const DERBY_WEAPON_AUDIO: Record<string, { attack: string; hit: string }> = {
  pipe: { attack: 'swing_heavy', hit: 'hit_blunt' },
  chain: { attack: 'chain_whip', hit: 'hit_blunt' },
  shotgun: { attack: 'gun_shotgun', hit: 'hit_flesh' },
  crossbow: { attack: 'crossbow_shot', hit: 'hit_blade' },
  flare_gun: { attack: 'flare_shot', hit: 'hit_energy' },
  cattle_prod: { attack: 'electric_zap', hit: 'electric_zap' },
};
