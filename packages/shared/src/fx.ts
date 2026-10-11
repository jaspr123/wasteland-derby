// Particle effect ids understood by the client FxSystem.
export const FX_IDS = ['spark', 'metal_hit', 'blood_dust', 'energy_burst', 'muzzle_flash', 'debris', 'shockwave', 'smoke_puff', 'electric_arc', 'fire_burst', 'dust_ring', 'slash_trail'] as const;
export type FxId = (typeof FX_IDS)[number];
