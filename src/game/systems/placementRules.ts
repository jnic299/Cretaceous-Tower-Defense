import type { TerrainAffinity } from '../types';
import type { MapGeometry } from './MapGeometry';

export type PlacementReason =
  | 'ok'
  | 'outOfBounds'
  | 'onPath'
  | 'inWater'
  | 'needsWater'
  | 'inLava'
  | 'blocked'
  | 'occupied'
  | 'objective'
  | 'supply'
  | 'restricted';

export interface OccupiedSlot {
  x: number;
  y: number;
  radius: number;
}

export interface PlacementQuery {
  x: number;
  y: number;
  footprint: number;
  terrain: TerrainAffinity;
  /** Fixtures are meant to sit on the route; defenders are not. */
  allowOnPath: boolean;
  cost: number;
  supply: number;
  /** False when a challenge rule forbids this unit entirely. */
  permitted?: boolean;
}

export interface PlacementVerdict {
  ok: boolean;
  reason: PlacementReason;
  message: string;
}

const VERDICTS: Record<PlacementReason, string> = {
  ok: 'Deploy',
  outOfBounds: 'Outside the operating area',
  onPath: 'Cannot deploy on the route',
  inWater: 'Cannot deploy in water',
  needsWater: 'Must be deployed on open water',
  inLava: 'Cannot deploy in lava',
  blocked: 'Terrain is impassable here',
  occupied: 'Too close to another placement',
  objective: 'Too close to the objective',
  supply: 'Not enough Supply',
  restricted: 'Not permitted in this operation',
};

function verdict(reason: PlacementReason): PlacementVerdict {
  return { ok: reason === 'ok', reason, message: VERDICTS[reason] };
}

/**
 * The single source of truth for "can this go here". Pure, so the ghost
 * preview, the click handler and the tests all agree by construction.
 *
 * Order matters: the most informative failure wins, so a player hovering lava
 * is told about the lava rather than about their Supply balance.
 */
export function evaluatePlacement(
  geometry: MapGeometry,
  query: PlacementQuery,
  occupied: readonly OccupiedSlot[],
): PlacementVerdict {
  const { x, y, footprint, terrain } = query;

  if (query.permitted === false) return verdict('restricted');
  if (!geometry.inBounds(x, y, footprint + 2)) return verdict('outOfBounds');

  const needsWater = terrain === 'water';

  if (needsWater) {
    if (!geometry.isDeepWater(x, y, footprint * 0.75)) return verdict('needsWater');
  } else {
    if (geometry.isInWater(x, y, footprint * 0.45)) return verdict('inWater');
  }

  // Lava is absolute for everything.
  if (geometry.isInLava(x, y, footprint * 0.5)) return verdict('inLava');

  if (geometry.isSolid(x, y, footprint * 0.55)) return verdict('blocked');

  // Water units are exempt from the swimming lane; everything else must stay
  // clear of every route unless it is a fixture built to sit on one.
  if (!query.allowOnPath && geometry.isOnPath(x, y, footprint * 0.35, needsWater ? 'land' : 'all')) {
    return verdict('onPath');
  }

  const obj = geometry.def.objective;
  if (Math.hypot(x - obj.x, y - obj.y) < obj.radius + footprint * 0.5) return verdict('objective');

  for (const slot of occupied) {
    const minGap = slot.radius + footprint;
    if (Math.hypot(x - slot.x, y - slot.y) < minGap) return verdict('occupied');
  }

  if (query.supply < query.cost) return verdict('supply');

  return verdict('ok');
}

/** Snaps a cursor position onto the placement grid. */
export function snapToGrid(value: number, grid = 8): number {
  return Math.round(value / grid) * grid;
}
