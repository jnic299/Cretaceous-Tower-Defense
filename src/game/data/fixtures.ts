import type { FixtureDef } from '../types';

/**
 * Fixtures reshape the battlefield instead of shooting at it. None of them
 * blocks a route outright — they only make it expensive. The two that impose
 * themselves on the animals (barricade, decoy) are consumable, and the animals
 * they hold are the only thing that wears them out. Nothing here runs on a
 * countdown: a player who deploys early should not be punished for it.
 */
export const FIXTURES: FixtureDef[] = [
  {
    id: 'barricade',
    name: 'Barricade',
    title: 'Modular Wall Section',
    category: 'fixture',
    kind: 'barricade',
    description:
      'Interlocking wall panels dropped across a lane. Everything can still get through — it just takes them a great deal longer.',
    flavor: 'Rated to stop a two-tonne animal. Rating obtained from the animal.',
    cost: 60,
    unlockCost: 150,
    terrain: 'land',
    footprint: 30,
    radius: 52,
    integrity: 900,
    slow: { factor: 0.34, durationMs: 400, chance: 1 },
    strengths: ['Massive slow inside its footprint', 'Cheap', 'Turns any corner into a killzone'],
    weaknesses: ['Grinds down as enemies push through', 'Never fully blocks a route', 'Heavies chew it apart'],
  },

  {
    id: 'shockFence',
    name: 'Shock Fence',
    title: 'Electrified Perimeter',
    category: 'fixture',
    kind: 'shockFence',
    description:
      'Live fence panel that damages and staggers anything crossing it. Constant, unspectacular, extremely reliable value.',
    flavor: 'The warning signs are in four languages and are routinely ignored by all of them.',
    cost: 85,
    unlockCost: 210,
    terrain: 'land',
    footprint: 27,
    radius: 62,
    integrity: 0,
    dps: 26,
    slow: { factor: 0.72, durationMs: 500, chance: 1 },
    strengths: ['Permanent damage over the whole footprint', 'Hits everything, no targeting needed', 'Stacks with any defender'],
    weaknesses: ['Low damage against armour', 'Only affects the strip it covers', 'No burst potential'],
  },

  {
    id: 'decoyBeacon',
    name: 'Decoy Beacon',
    title: 'Acoustic Lure',
    category: 'fixture',
    kind: 'decoy',
    description:
      'Broadcasts a call that nearby carnivores find impossible to ignore. They stop advancing and take the beacon apart instead — which is the only thing that will ever shut it up.',
    flavor: 'Reproduces a distressed juvenile. Ethically reviewed. Ethically approved. Loudly.',
    cost: 70,
    unlockCost: 240,
    terrain: 'land',
    footprint: 22,
    radius: 150,
    // The animals it holds are the only thing that wears it out: six to ten
    // seconds of holding a real group, and nothing at all while the lane is
    // quiet. See the `decoy` case in `updateFixtures`.
    integrity: 420,
    strengths: ['Freezes a whole group in place', 'Saves a collapsing lane instantly', 'Buys time for a boss'],
    weaknesses: ['Torn apart by whatever it holds', 'One good group is all it survives', 'Steadfast animals ignore it'],
  },

  {
    id: 'supplyCache',
    name: 'Supply Cache',
    title: 'Forward Depot',
    category: 'fixture',
    kind: 'supplyCache',
    description:
      'Ammunition and coolant drop. Nearby defenders fire faster, and the crate keeps trickling supply into your account.',
    flavor: 'Contents: ammunition, coolant, and one crate of expired ration bars nobody will admit to ordering.',
    cost: 100,
    unlockCost: 260,
    terrain: 'land',
    footprint: 24,
    radius: 148,
    integrity: 0,
    supplyPerTick: 5,
    supplyTickMs: 5000,
    buff: { radius: 148, fireRateMultiplier: 1.15, damageMultiplier: 1.05, rangeMultiplier: 1, targets: 'all' },
    strengths: ['Pays for itself over a long match', 'Buffs every defender in range', 'Combines with the Field Engineer'],
    weaknesses: ['Contributes nothing immediately', 'Bad buy in the final waves', 'Takes up a good firing position'],
  },
];

export const FIXTURES_BY_ID: Record<string, FixtureDef> = Object.fromEntries(
  FIXTURES.map((f) => [f.id, f]),
);
