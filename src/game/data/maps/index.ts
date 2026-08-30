import type { MapDef } from '../../types';
import { RESEARCH_OUTPOST } from './researchOutpost';
import { DELTA_WETLANDS } from './deltaWetlands';
import { CALDERA_STATION } from './calderaStation';
import { FOSSIL_CANYON } from './fossilCanyon';

export const MAPS: MapDef[] = [RESEARCH_OUTPOST, DELTA_WETLANDS, CALDERA_STATION, FOSSIL_CANYON];

export const MAPS_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export function getMap(id: string): MapDef {
  const map = MAPS_BY_ID[id];
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}

export { RESEARCH_OUTPOST, DELTA_WETLANDS, CALDERA_STATION, FOSSIL_CANYON };
