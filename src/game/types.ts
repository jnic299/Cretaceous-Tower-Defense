/**
 * Core domain types for Cretaceous Tower Defense.
 *
 * Everything gameplay-facing is described by data (see `src/game/data`) and
 * consumed by systems (see `src/game/systems`). Keeping the vocabulary in one
 * place means balance passes touch data files, never scene code.
 */

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

export interface Vec2 {
  x: number;
  y: number;
}

/** Convex or concave polygon, in map pixel space. */
export type Polygon = Vec2[];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ------------------------------------------------------------------ */
/* Enemy tiers                                                         */
/* ------------------------------------------------------------------ */

export type TierId = 'green' | 'blue' | 'orange' | 'red' | 'obsidian';

/** Silhouette markings double as a non-colour durability cue. */
export type TierPattern = 'plain' | 'speckle' | 'stripe' | 'chevron' | 'crackle';

export interface TierDef {
  id: TierId;
  name: string;
  /** 1..5, drives the pip count shown above the health bar. */
  rank: number;
  hpMultiplier: number;
  speedMultiplier: number;
  bountyMultiplier: number;
  /** Flat damage reduction added on top of the species' own armour. */
  armorBonus: number;
  /** Scale bump — tougher animals read as physically bigger. */
  scaleMultiplier: number;
  /** Tint applied to the generated species texture. */
  color: number;
  /** CSS colour for HUD, codex and health bars. */
  cssColor: string;
  pattern: TierPattern;
  description: string;
}

/* ------------------------------------------------------------------ */
/* Damage                                                              */
/* ------------------------------------------------------------------ */

export type DamageType = 'kinetic' | 'piercing' | 'fire' | 'shock' | 'explosive';

export interface BurnSpec {
  dps: number;
  durationMs: number;
}

export interface SlowSpec {
  /** Multiplier applied to movement speed, e.g. 0.55 = 45% slower. */
  factor: number;
  durationMs: number;
  chance: number;
}

export interface StunSpec {
  durationMs: number;
  chance: number;
}

/**
 * A broadcast field that pulls animals off their stride and holds them at the
 * emitter. The field is duty-cycled against the unit's own firing rhythm, so
 * there is always a window in which held animals get to walk again.
 */
export interface LureSpec {
  radius: number;
  /** Fraction of each attack period the field is actually broadcasting, 0..1. */
  dutyCycle: number;
  /** How fast, in px/sec, stragglers are dragged back along their path. */
  pullSpeed: number;
  /** Most animals the emitter can hold at once. The rest walk straight past. */
  capacity: number;
}

export interface BuffSpec {
  radius: number;
  fireRateMultiplier: number;
  damageMultiplier: number;
  rangeMultiplier: number;
  /** Which placements benefit. */
  targets: 'machines' | 'all';
}

/** How an attack resolves. One shape keeps data files readable. */
export type AttackPattern =
  | 'projectile' // single travelling shot
  | 'radial' // ring of projectiles in every direction
  | 'cone' // sustained cone (flamethrower)
  | 'hitscan' // instant beam along a line
  | 'chain' // arcs between nearby enemies
  | 'lob' // arcing shell that detonates at a point
  | 'pulse' // stationary emitter that washes an arc around itself
  | 'support'; // no direct damage, applies an aura

export interface AttackSpec {
  pattern: AttackPattern;
  damageType: DamageType;
  /** px/sec for travelling shots. */
  projectileSpeed?: number;
  /** Ring size for `radial`. */
  spikes?: number;
  /** Full arc width in degrees for `cone` and `pulse`. */
  coneAngle?: number;
  /** How often a sustained cone ticks damage, in ms. */
  coneTickMs?: number;
  splashRadius?: number;
  /** Damage multiplier at the edge of a splash, 0..1. */
  splashFalloff?: number;
  chainJumps?: number;
  chainRange?: number;
  /** Extra enemies a shot passes through before expiring. */
  pierceCount?: number;
  /** 0..1 fraction of the target's armour ignored. */
  armorPierce?: number;
  /** Shots cannot be taken at closer than this range. */
  minRange?: number;
  knockback?: number;
  burn?: BurnSpec;
  slow?: SlowSpec;
  stun?: StunSpec;
  buff?: BuffSpec;
  lure?: LureSpec;
  /** Purely presentational hint used by the FX layer. */
  visual?: string;
}

/* ------------------------------------------------------------------ */
/* Defenders, turrets, heroes, fixtures                                */
/* ------------------------------------------------------------------ */

export type TargetMode = 'first' | 'last' | 'strongest' | 'weakest' | 'closest';

export type TerrainAffinity = 'land' | 'water' | 'amphibious';

export type PlacementCategory = 'defender' | 'turret' | 'fixture';

export interface DefenderLevel {
  /** Supply spent to reach this level. Level 1 is the purchase cost. */
  cost: number;
  range: number;
  damage: number;
  /** Shots per second. */
  fireRate: number;
  attack: AttackSpec;
  /** Short line shown on the upgrade button. */
  note: string;
}

/** Parameters the procedural art layer uses to build a unit's sprite. */
export interface UnitArtSpec {
  /** Primary uniform / chassis colour. */
  body: number;
  /** Accent used for gear, straps, panels. */
  accent: number;
  /** Weapon metal colour. */
  metal: number;
  /** Which weapon silhouette to build. */
  weapon:
    | 'dart'
    | 'spikeRing'
    | 'flamer'
    | 'sniper'
    | 'shock'
    | 'launcher'
    | 'wrench'
    | 'boat'
    | 'autocannon'
    | 'tesla'
    | 'rail'
    | 'mortar'
    | 'tank'
    | 'rifle'
    | 'exo'
    | 'beacon';
  /** Machines get a plated base instead of a human silhouette. */
  chassis: 'human' | 'machine' | 'vehicle';
  /** Optional headgear flourish for humans. */
  hat?: 'cap' | 'helmet' | 'hood' | 'visor' | 'none';
  scale?: number;
}

export interface DefenderDef {
  id: string;
  name: string;
  /** Occupational title shown under the name. */
  title: string;
  category: PlacementCategory;
  role: string;
  description: string;
  /** One dry line of personality. */
  flavor: string;
  /** Supply cost to deploy in a match. */
  cost: number;
  /** Amber cost to unlock permanently. 0 means available from the start. */
  unlockCost: number;
  terrain: TerrainAffinity;
  /** Footprint radius used for overlap checks. */
  footprint: number;
  defaultTargeting: TargetMode;
  targetModes: TargetMode[];
  levels: [DefenderLevel, DefenderLevel, DefenderLevel];
  art: UnitArtSpec;
  /** Bullet points for the armory card. */
  strengths: string[];
  weaknesses: string[];
}

export interface HeroAbility {
  id: string;
  name: string;
  description: string;
  cooldownMs: number;
  /** Targeted abilities ask for a map click; self abilities fire immediately. */
  kind: 'targeted' | 'self';
  radius?: number;
  damage?: number;
  damageType?: DamageType;
  durationMs?: number;
  /** Number of individual impacts for barrage-style abilities. */
  shots?: number;
  buff?: { fireRateMultiplier: number; damageMultiplier: number };
  stun?: StunSpec;
  burn?: BurnSpec;
  visual: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  description: string;
  flavor: string;
  unlockCost: number;
  /** Supply cost to deploy the hero into the match. */
  deployCost: number;
  terrain: TerrainAffinity;
  footprint: number;
  range: number;
  damage: number;
  fireRate: number;
  attack: AttackSpec;
  /** Optional always-on secondary weapon (the tank's coaxial gun). */
  secondary?: {
    range: number;
    damage: number;
    fireRate: number;
    attack: AttackSpec;
  };
  ability: HeroAbility;
  repositionCooldownMs: number;
  defaultTargeting: TargetMode;
  art: UnitArtSpec;
  strengths: string[];
}

export type FixtureKind = 'barricade' | 'shockFence' | 'decoy' | 'supplyCache';

export interface FixtureDef {
  id: string;
  name: string;
  title: string;
  category: 'fixture';
  kind: FixtureKind;
  description: string;
  flavor: string;
  cost: number;
  unlockCost: number;
  terrain: TerrainAffinity;
  footprint: number;
  /** Effect radius (aura / decoy pull / fence width). */
  radius: number;
  /** Structures wear out; 0 means it never expires from damage. */
  integrity: number;
  /** Lifetime in ms; 0 means permanent for the match. */
  durationMs: number;
  /** Damage per second dealt to anything inside the field. */
  dps?: number;
  slow?: SlowSpec;
  buff?: BuffSpec;
  /** Supply generated per tick for caches. */
  supplyPerTick?: number;
  supplyTickMs?: number;
  strengths: string[];
  weaknesses: string[];
}

export type PlaceableDef = DefenderDef | FixtureDef;

/* ------------------------------------------------------------------ */
/* Dinosaurs                                                           */
/* ------------------------------------------------------------------ */

export type SpeciesId =
  | 'compsognathus'
  | 'velociraptor'
  | 'dilophosaurus'
  | 'pachycephalosaurus'
  | 'triceratops'
  | 'ankylosaurus'
  | 'carnotaurus'
  | 'parasaurolophus'
  | 'tyrannosaurus'
  | 'spinosaurus';

export type DinoTrait =
  | 'pack' // arrives in numbers
  | 'sprint' // periodic burst of speed
  | 'armored' // shrugs off small hits
  | 'steadfast' // resists slows and stuns
  | 'amphibious' // may use water routes
  | 'herd' // buffs nearby dinosaurs of the same species
  | 'boss'
  | 'rally'; // speeds up when damaged

/** Shape parameters the procedural art layer turns into a sprite. */
export interface DinoBodySpec {
  /** Overall pixel length nose-to-tail before tier scaling. */
  length: number;
  bodyWidth: number;
  bodyLength: number;
  neckLength: number;
  neckWidth: number;
  headLength: number;
  headWidth: number;
  jaw: number;
  tailLength: number;
  tailWidth: number;
  legLength: number;
  legWidth: number;
  legPairs: number;
  stance: 'biped' | 'quadruped';
  /** Distinguishing feature drawn on top of the base silhouette. */
  crown: 'none' | 'frill' | 'crest' | 'dome' | 'sail' | 'plates' | 'horns' | 'tube';
  spines: number;
  /** Tail club / spikes. */
  tailTip: 'none' | 'club' | 'fin';
  /** Radians of body bob during the walk cycle. */
  bobAmount: number;
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  /** Codex heading, deliberately not a real binomial. */
  designation: string;
  baseHp: number;
  /** px/sec at green tier. */
  baseSpeed: number;
  /** Flat reduction applied to every incoming hit. */
  armor: number;
  /** Objective health removed on arrival. */
  objectiveDamage: number;
  /** Base supply granted on defeat, before tier multiplier. */
  bounty: number;
  traits: DinoTrait[];
  /** Extra speed multiplier while sprinting, for `sprint` carriers. */
  sprintMultiplier?: number;
  sprintDurationMs?: number;
  sprintIntervalMs?: number;
  body: DinoBodySpec;
  codex: {
    threat: string;
    speedLabel: string;
    durabilityLabel: string;
    trait: string;
    blurb: string;
  };
}

/* ------------------------------------------------------------------ */
/* Maps                                                                */
/* ------------------------------------------------------------------ */

export type TerrainKind = 'water' | 'lava' | 'rock' | 'structure';

export interface TerrainRegion {
  kind: TerrainKind;
  polygon: Polygon;
  /** Rock and structures may block firing lines. */
  blocksSight?: boolean;
  /** Purely visual elevation cue. */
  height?: number;
}

export interface PathDef {
  id: string;
  waypoints: Vec2[];
  /** Half-width of the travelled corridor, in px. */
  width: number;
  /** Dinosaurs on this route swim rather than walk. */
  aquatic?: boolean;
}

export interface SpawnPointDef {
  id: string;
  x: number;
  y: number;
  pathId: string;
  label: string;
}

export interface ObjectiveDef {
  name: string;
  kind: 'station' | 'evac' | 'comms' | 'lab' | 'settlement' | 'generator';
  x: number;
  y: number;
  radius: number;
  hp: number;
}

export type DecorKind =
  | 'tree'
  | 'palm'
  | 'fern'
  | 'boulder'
  | 'reed'
  | 'crate'
  | 'barrel'
  | 'fence'
  | 'tent'
  | 'antenna'
  | 'vent'
  | 'bone'
  | 'lamp'
  | 'deadTree';

export interface DecorItem {
  kind: DecorKind;
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
}

export interface MapPalette {
  ground: number;
  groundAlt: number;
  groundDeep: number;
  path: number;
  pathEdge: number;
  foliage: number;
  foliageDark: number;
  /** Exposed rock and cliff faces. Kept separate so each site reads distinctly. */
  rock: number;
  accent: number;
  fog: number;
}

export interface SpawnGroup {
  species: SpeciesId;
  tier: TierId;
  count: number;
  /** Gap between individuals, in ms. */
  intervalMs: number;
  /** Offset from the start of the wave, in ms. */
  delayMs: number;
  spawnId?: string;
}

export interface WaveDef {
  index: number;
  name?: string;
  boss?: boolean;
  /** Supply granted when the wave is cleared. */
  reward: number;
  groups: SpawnGroup[];
}

export interface MapDef {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  theme: 'jungle' | 'wetlands' | 'volcanic' | 'canyon';
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Amber cost to unlock. 0 means unlocked from the start. */
  unlockCost: number;
  /** Total stars needed across all maps before this one can be bought. */
  starsRequired: number;
  width: number;
  height: number;
  palette: MapPalette;
  objective: ObjectiveDef;
  paths: PathDef[];
  spawns: SpawnPointDef[];
  terrain: TerrainRegion[];
  decor: DecorItem[];
  waves: WaveDef[];
  /** Starting supply for the match. */
  startingSupply: number;
  /** Headline environmental features for the map-select card. */
  features: string[];
  expectedSpecies: SpeciesId[];
  /** Amber paid the first time the map is beaten. */
  firstClearAmber: number;
  /** Amber per star, awarded for newly earned stars. */
  amberPerStar: number;
}

/* ------------------------------------------------------------------ */
/* Challenges                                                          */
/* ------------------------------------------------------------------ */

export type ChallengeRuleId =
  | 'noTurrets'
  | 'rangersOnly'
  | 'fragileObjective'
  | 'swarm'
  | 'heavyweights'
  | 'speedRush'
  | 'noHero'
  | 'holdTheLine';

export interface ChallengeDef {
  id: string;
  name: string;
  description: string;
  flavor: string;
  mapId: string;
  rules: ChallengeRuleId[];
  /** Multipliers / overrides applied by the rules. */
  modifiers: {
    objectiveHpMultiplier?: number;
    enemySpeedMultiplier?: number;
    enemyCountMultiplier?: number;
    startingSupplyMultiplier?: number;
    allowedCategories?: PlacementCategory[];
    allowedDefenderIds?: string[];
    heroAllowed?: boolean;
    /** Only run this many waves; used by "hold for N waves". */
    waveLimit?: number;
    /** Force every enemy up at least this many tiers. */
    tierBoost?: number;
  };
  amberReward: number;
  /** Stars needed before the challenge appears. */
  starsRequired: number;
}

/* ------------------------------------------------------------------ */
/* Match results                                                       */
/* ------------------------------------------------------------------ */

/**
 * How a match ended. `abandoned` is a loss that the player chose, and is
 * distinguished from a defeat so the results screen can say so honestly —
 * the rewards are identical either way.
 */
export type MatchEndReason = 'victory' | 'defeat' | 'abandoned';

export interface MatchResult {
  mapId: string;
  challengeId?: string;
  endReason: MatchEndReason;
  /** Always `endReason === 'victory'`. Kept because reward rules read it. */
  victory: boolean;
  stars: 0 | 1 | 2 | 3;
  objectiveHpRemaining: number;
  objectiveHpMax: number;
  wavesCleared: number;
  wavesTotal: number;
  kills: number;
  bossesDefeated: number;
  supplyEarned: number;
  /** Gross Supply committed during the match; refunds do not reduce it. */
  supplySpent: number;
  /** Defenders, turrets, fixtures and the hero, counted once at deployment. */
  unitsPlaced: number;
  upgradesPurchased: number;
  amberEarned: number;
  amberBreakdown: { label: string; amount: number }[];
  durationMs: number;
  speciesSeen: SpeciesId[];
  /** Feeds the codex's lifetime tally. */
  killsBySpecies: Partial<Record<SpeciesId, number>>;
  newlyUnlockedStars: number;
}
