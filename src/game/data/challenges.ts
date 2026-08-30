import type { ChallengeDef } from '../types';

/**
 * Challenges are pure data: a map, a list of rule ids (for display) and a set
 * of modifiers the match applies. Adding a new one is a single object.
 */
export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'outpost-rangers-only',
    name: 'Dart Discipline',
    description: 'Research Outpost with Rangers and nothing else. No turrets, no specialists, no hero.',
    flavor: 'Procurement has been suspended pending an investigation into procurement.',
    mapId: 'researchOutpost',
    rules: ['rangersOnly', 'noTurrets', 'noHero'],
    modifiers: {
      allowedDefenderIds: ['ranger'],
      allowedCategories: ['defender'],
      heroAllowed: false,
      startingSupplyMultiplier: 1.5,
    },
    amberReward: 220,
    starsRequired: 1,
  },
  {
    id: 'outpost-swarm',
    name: 'Swarm Protocol',
    description: 'Twice as many animals, all of them small, all of them fast.',
    flavor: 'The motion sensors have stopped counting and started estimating.',
    mapId: 'researchOutpost',
    rules: ['swarm', 'speedRush'],
    modifiers: {
      enemyCountMultiplier: 2,
      enemySpeedMultiplier: 1.25,
      startingSupplyMultiplier: 1.35,
    },
    amberReward: 260,
    starsRequired: 2,
  },
  {
    id: 'wetlands-no-turrets',
    name: 'Manual Override',
    description: 'Delta Wetlands with every automated system offline. People only.',
    flavor: 'The turret firmware update is going extremely well, thank you for asking.',
    mapId: 'deltaWetlands',
    rules: ['noTurrets'],
    modifiers: {
      allowedCategories: ['defender', 'fixture'],
      startingSupplyMultiplier: 1.25,
    },
    amberReward: 300,
    starsRequired: 4,
  },
  {
    id: 'wetlands-fragile',
    name: 'Thin Margins',
    description: 'The evacuation pad has 25% structural integrity. Nothing gets through. Nothing.',
    flavor: 'Contingency plan: do not require a contingency plan.',
    mapId: 'deltaWetlands',
    rules: ['fragileObjective'],
    modifiers: {
      objectiveHpMultiplier: 0.25,
      startingSupplyMultiplier: 1.4,
    },
    amberReward: 340,
    starsRequired: 6,
  },
  {
    id: 'caldera-heavyweights',
    name: 'Heavyweights',
    description: 'Caldera Station, one tier heavier across the board. Bring something that pierces.',
    flavor: 'Every specimen on the approach is an adult. Every single one.',
    mapId: 'calderaStation',
    rules: ['heavyweights'],
    modifiers: {
      tierBoost: 1,
      startingSupplyMultiplier: 1.5,
    },
    amberReward: 420,
    starsRequired: 8,
  },
  {
    id: 'canyon-hold',
    name: 'Hold For Twelve',
    description: 'Fossil Canyon, twelve waves, faster animals, and a mast at half integrity.',
    flavor: 'Extraction is twelve waves out. Extraction has been twelve waves out for some time.',
    mapId: 'fossilCanyon',
    rules: ['holdTheLine', 'speedRush', 'fragileObjective'],
    modifiers: {
      waveLimit: 12,
      enemySpeedMultiplier: 1.2,
      objectiveHpMultiplier: 0.5,
      startingSupplyMultiplier: 1.3,
    },
    amberReward: 520,
    starsRequired: 10,
  },
];

export const CHALLENGES_BY_ID: Record<string, ChallengeDef> = Object.fromEntries(
  CHALLENGES.map((c) => [c.id, c]),
);
