/**
 * Texture key naming and the scale dials that go with it.
 *
 * Deliberately free of any Phaser import: entities need to name a texture,
 * but only the baking layer needs a renderer. Keeping the two apart lets the
 * simulation classes run headlessly in tests.
 */
import type { SpeciesId, TierId } from '../types';

/** Frames in the walk cycle. Four reads as motion without eating memory. */
export const DINO_FRAMES = 4;
/** Textures are baked larger than the base size so obsidian stays crisp. */
export const DINO_SUPERSAMPLE = 1.4;
/**
 * World-space multiplier on every creature. Body specs are authored in
 * relative proportions; this is the single dial that decides how large the
 * animals read against the map.
 */
export const DINO_RENDER_SCALE = 1.45;
/** World-space multiplier on every placed unit, matching the creature dial. */
export const UNIT_RENDER_SCALE = 1.3;

export function dinoTextureKey(species: SpeciesId, tier: TierId, frame: number): string {
  return `dino:${species}:${tier}:${frame}`;
}

export function dinoShadowKey(): string {
  return 'fx:shadow';
}

export function unitBaseKey(id: string, level: number): string {
  return `unit:${id}:base:${level}`;
}

export function unitTopKey(id: string, level: number): string {
  return `unit:${id}:top:${level}`;
}

export function fixtureTextureKey(id: string): string {
  return `fixture:${id}`;
}

/** Projectile and particle texture keys, shared by the FX and combat layers. */
export const FX = {
  dart: 'proj:dart',
  spike: 'proj:spike',
  bullet: 'proj:bullet',
  arc: 'proj:arc',
  grenade: 'proj:grenade',
  shell: 'proj:shell',
  slug: 'proj:slug',
  frost: 'proj:frost',
  spark: 'fx:spark',
  smoke: 'fx:smoke',
  dust: 'fx:dust',
  flame: 'fx:flame',
  ember: 'fx:ember',
  ring: 'fx:ring',
  muzzle: 'fx:muzzle',
  glow: 'fx:glow',
  star: 'fx:star',
  chunk: 'fx:chunk',
  snow: 'fx:snow',
} as const;
