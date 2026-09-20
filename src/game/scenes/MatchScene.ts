import Phaser from 'phaser';
import type {
  ChallengeDef,
  DefenderDef,
  FixtureDef,
  HeroDef,
  MapDef,
  MatchResult,
  PlaceableDef,
  SpeciesId,
  TargetMode,
  TierId,
} from '../types';
import type { GameSettings } from '../../persistence/schema';
import type { MatchEndReason } from '../types';
import { getMap } from '../data/maps';
import { CHALLENGES_BY_ID } from '../data/challenges';
import { findDefender, findFixture, findHero, isFixture } from '../data/catalog';
import { getSpecies } from '../data/dinosaurs';
import { getTier } from '../data/tiers';
import { variantsInWaves } from '../data/waves';
import { starsFor } from '../../progression/rewards';

import { MapGeometry } from '../systems/MapGeometry';
import { buildTerrain, type TerrainLayers } from '../systems/TerrainRenderer';
import { SpatialGrid } from '../systems/SpatialGrid';
import { EffectsSystem } from '../systems/EffectsSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { SimulationClock, simulationStepMs } from '../systems/SimulationClock';
import { evaluatePlacement, snapToGrid, type OccupiedSlot, type PlacementVerdict } from '../systems/placementRules';

import { Dino } from '../entities/Dino';
import { DefenderUnit, HeroUnit, type PlacedUnit } from '../entities/PlacedUnit';
import { FixtureUnit } from '../entities/Fixture';
import { bakeFixtureArt, fixtureTextureKey } from '../art/fixtureArt';

import { bakeDinoVariant, bakeShadow } from '../art/dinoArt';
import { bakeUnitArt, unitTopKey } from '../art/unitArt';
import { bakeFxTextures, FX } from '../art/fxArt';
import { DEPTH } from '../depth';
import { audioManager } from '../../audio/AudioManager';
import { publishTestState, clearTestState } from '../testBridge';
import { gameBus, type CardState, type GameCommand, type HeroHudState, type HudSnapshot, type MatchPhase, type SelectionInfo } from '../events';

export interface MatchConfig {
  mapId: string;
  heroId: string | null;
  challengeId?: string;
  /** Card ids the player brought into the match. */
  loadout: string[];
  settings: GameSettings;
  tutorial: boolean;
}

const HERO_CARD = '__hero__';
const HERO_MOVE = '__hero_move__';
const PREP_TIME_MS = 22000;
const INTERMISSION_MS = 12000;
const HUD_INTERVAL_MS = 66;
/** Supply awarded per second of countdown skipped. */
const EARLY_BONUS_PER_SEC = 2;

let unitSeq = 0;

export class MatchScene extends Phaser.Scene {
  static readonly KEY = 'MatchScene';

  private config!: MatchConfig;
  private map!: MapDef;
  private challenge?: ChallengeDef;
  private geometry!: MapGeometry;
  private terrain!: TerrainLayers;

  private grid!: SpatialGrid;
  private effects!: EffectsSystem;
  private projectiles!: ProjectileSystem;
  private combat!: CombatSystem;
  private waves!: WaveSystem;
  private economy!: EconomySystem;
  /** Authoritative gameplay clock. Every deadline in the match uses it. */
  private readonly clock = new SimulationClock();

  private dinos: Dino[] = [];
  private dinoPool: Dino[] = [];
  private defenders: DefenderUnit[] = [];
  private fixtures: FixtureUnit[] = [];
  private hero: HeroUnit | null = null;
  private heroDef: HeroDef | null = null;

  private phase: MatchPhase = 'preparing';
  private countdown = PREP_TIME_MS;
  private objectiveHp = 100;
  private objectiveHpMax = 100;
  private kills = 0;
  private bossesDefeated = 0;
  private elapsed = 0;
  private wavesCleared = 0;
  private unitsPlaced = 0;
  private upgradesPurchased = 0;
  private speed = 1;
  /** The player's explicit pause, toggled with Space or the HUD button. */
  private paused = false;
  /** Set while the Operation Menu is open. Independent of `paused`. */
  private menuOpen = false;
  private ended = false;
  private tornDown = false;
  private speciesSeen = new Set<SpeciesId>();
  private killsBySpecies = new Map<SpeciesId, number>();

  private activeCardId: string | null = null;
  private ghost?: Phaser.GameObjects.Image;
  private ghostRange?: Phaser.GameObjects.Graphics;
  private lastVerdict: PlacementVerdict = { ok: false, reason: 'ok', message: '' };
  private pointerWorld = new Phaser.Math.Vector2();
  private abilityArmed = false;

  private selected: DefenderUnit | FixtureUnit | HeroUnit | null = null;
  private hovered: DefenderUnit | FixtureUnit | HeroUnit | null = null;
  private selectionRing?: Phaser.GameObjects.Image;
  private selectionRange?: Phaser.GameObjects.Graphics;

  private shiftKey?: Phaser.Input.Keyboard.Key;
  private bars!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;
  private hudAccumulator = 0;
  private toastSeq = 0;
  private unsubscribe: (() => void) | null = null;
  private tutorialStep = 0;
  private cards: PlaceableDef[] = [];

  constructor() {
    super(MatchScene.KEY);
  }

  init(config: MatchConfig): void {
    this.config = config;
    this.map = getMap(config.mapId);
    this.challenge = config.challengeId ? CHALLENGES_BY_ID[config.challengeId] : undefined;
    this.heroDef = config.heroId ? (findHero(config.heroId) ?? null) : null;
    if (this.challenge?.modifiers.heroAllowed === false) this.heroDef = null;

    this.dinos = [];
    this.dinoPool = [];
    this.defenders = [];
    this.fixtures = [];
    this.hero = null;
    this.phase = 'preparing';
    this.countdown = PREP_TIME_MS;
    this.kills = 0;
    this.bossesDefeated = 0;
    this.elapsed = 0;
    this.wavesCleared = 0;
    this.unitsPlaced = 0;
    this.upgradesPurchased = 0;
    this.speed = 1;
    this.paused = false;
    this.menuOpen = false;
    this.ended = false;
    this.tornDown = false;
    this.clock.reset();
    this.activeCardId = null;
    this.selected = null;
    this.abilityArmed = false;
    this.tutorialStep = 0;
    this.speciesSeen = new Set();
    this.killsBySpecies = new Map();
  }

  /* ------------------------------------------------------------------ */
  /* Setup                                                               */
  /* ------------------------------------------------------------------ */

  create(): void {
    this.geometry = new MapGeometry(this.map);

    const hpMult = this.challenge?.modifiers.objectiveHpMultiplier ?? 1;
    this.objectiveHpMax = Math.max(10, Math.round(this.map.objective.hp * hpMult));
    this.objectiveHp = this.objectiveHpMax;

    const supplyMult = this.challenge?.modifiers.startingSupplyMultiplier ?? 1;
    this.economy = new EconomySystem(Math.round(this.map.startingSupply * supplyMult));

    this.waves = new WaveSystem(this.map.waves, this.challenge);
    this.bakeArt();

    this.terrain = buildTerrain(this, this.map, this.geometry);
    this.grid = new SpatialGrid(this.map.width, this.map.height, 96);
    this.effects = new EffectsSystem(this);
    this.effects.showDamageNumbers = this.config.settings.showDamageNumbers;
    this.effects.screenShake = this.config.settings.screenShake;

    this.combat = new CombatSystem({
      scene: this,
      geometry: this.geometry,
      grid: this.grid,
      effects: this.effects,
      audio: audioManager,
      hooks: { onKill: (dino, source) => this.handleKill(dino, source) },
    });
    this.projectiles = new ProjectileSystem(this, this.grid, this.combat);
    this.combat.attachProjectiles(this.projectiles);
    this.combat.dinos = this.dinos;
    this.combat.defenders = this.defenders;
    this.combat.fixtures = this.fixtures;

    this.bars = this.add.graphics().setDepth(DEPTH.healthBar);
    this.overlayGfx = this.add.graphics().setDepth(DEPTH.rangeIndicator);
    this.selectionRing = this.add.image(0, 0, 'ui:selection').setDepth(DEPTH.rangeIndicator).setVisible(false);
    this.selectionRange = this.add.graphics().setDepth(DEPTH.rangeIndicator);
    this.ghostRange = this.add.graphics().setDepth(DEPTH.ghost);

    this.setupInput();
    this.unsubscribe = gameBus.on('command', (cmd) => this.handleCommand(cmd));

    this.cameras.main.setBounds(0, 0, this.map.width, this.map.height);
    this.cameras.main.fadeIn(420, 0, 0, 0);

    audioManager.startMusic('battle');
    this.publishHud(true);
    gameBus.emit('ready', { mapId: this.map.id });

    if (this.config.tutorial) this.advanceTutorial('welcome');

    // Phaser emits SHUTDOWN when a scene stops, but only DESTROY when the
    // whole game is torn down — which is what React unmounting does. Listening
    // for just one of them leaks the command subscription and leaves music
    // playing after the player leaves a match.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
  }

  private bakeArt(): void {
    bakeFxTextures(this);
    bakeShadow(this);

    // Only the species/tier pairs this map actually fields get baked.
    for (const variant of variantsInWaves(this.waves.waves)) {
      bakeDinoVariant(this, variant.species, variant.tier);
    }

    this.cards = [];
    for (const id of this.config.loadout) {
      const def = findDefender(id) ?? findFixture(id);
      if (!def) continue;
      this.cards.push(def);
      if (isFixture(def)) bakeFixtureArt(this, def);
      else bakeUnitArt(this, def.id, def.art);
    }
    if (this.heroDef) bakeUnitArt(this, this.heroDef.id, this.heroDef.art, 1);
  }

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.pointerWorld.set(pointer.worldX, pointer.worldY);
      this.updateGhost();
      this.hovered = this.activeCardId ? null : this.unitAt(pointer.worldX, pointer.worldY);
    });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      audioManager.unlock();
      this.pointerWorld.set(pointer.worldX, pointer.worldY);
      if (pointer.rightButtonDown()) {
        this.cancelAction();
        return;
      }
      this.handleClick(pointer.worldX, pointer.worldY);
    });

    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-ESC', () => this.cancelAction());
    kb.on('keydown-SPACE', (e: KeyboardEvent) => {
      e.preventDefault();
      this.togglePause();
    });
    this.shiftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    kb.on('keydown-E', () => this.tryStartWaveEarly());
    kb.on('keydown-Q', () => this.armHeroAbility());
    kb.on('keydown-R', () => this.beginHeroReposition());
    kb.on('keydown-U', () => this.upgradeSelected());
    kb.on('keydown-X', () => this.sellSelected());

    // Number row: plain presses set game speed, shift picks a loadout card.
    const numberKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
    numberKeys.forEach((key, i) => {
      kb.on(`keydown-${key}`, (e: KeyboardEvent) => {
        if (e.shiftKey) {
          const card = this.cards[i];
          if (card) this.selectCard(card.id);
        } else if (i < 3) {
          this.setSpeed(i + 1);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Frame                                                               */
  /* ------------------------------------------------------------------ */

  override update(_time: number, delta: number): void {
    const dt = simulationStepMs(delta, this.speed, this.frozen || this.ended);

    if (dt > 0) {
      // Advancing the clock first means any callback that comes due this
      // frame sees the same `now` as the systems that run after it.
      this.clock.advance(dt);
      const now = this.clock.now;
      this.elapsed += dt;
      this.grid.rebuild(this.dinos);
      this.updateDinos(now, dt);
      this.combat.update(now, dt);
      this.projectiles.update(dt);
      this.updateFixtures(now, dt);
      this.updatePhase(dt);
    }

    this.drawBars();
    this.drawSelection();
    publishTestState(this.testState());

    this.hudAccumulator += delta;
    if (this.hudAccumulator >= HUD_INTERVAL_MS) {
      this.hudAccumulator = 0;
      this.publishHud();
    }
  }

  /** Snapshot for the browser-test bridge. Inert unless `?e2e=1`. */
  private testState() {
    return {
      simTimeMs: this.clock.now,
      phase: this.phase as string,
      paused: this.paused,
      menuOpen: this.menuOpen,
      speed: this.speed,
      supply: this.economy.supply,
      objectiveHp: Math.ceil(this.objectiveHp),
      kills: this.kills,
      waveIndex: Math.max(0, this.waves.index + 1),
      enemiesAlive: this.dinos.length,
      placements: this.defenders.length + this.fixtures.length + (this.hero ? 1 : 0),
      ended: this.ended,
    };
  }

  /** True when no simulation time should pass: player pause or an open menu. */
  private get frozen(): boolean {
    return this.paused || this.menuOpen;
  }

  private updateDinos(now: number, dt: number): void {
    for (let i = this.dinos.length - 1; i >= 0; i--) {
      const d = this.dinos[i];
      if (!d.alive) {
        d.hide();
        this.dinos.splice(i, 1);
        this.dinoPool.push(d);
        continue;
      }
      const arrived = d.update(now, dt);
      if (arrived) {
        this.objectiveBreached(d);
        d.hide();
        this.dinos.splice(i, 1);
        this.dinoPool.push(d);
      }
    }
  }

  private updateFixtures(now: number, dt: number): void {
    void dt;
    for (let i = this.fixtures.length - 1; i >= 0; i--) {
      const f = this.fixtures[i];
      if (f.def.supplyPerTick && now >= f.nextSupplyAt) {
        f.nextSupplyAt = now + (f.def.supplyTickMs ?? 5000);
        this.economy.add(f.def.supplyPerTick);
        this.effects.damageNumber(f.x, f.y - 12, f.def.supplyPerTick, 'kinetic');
      }
      if (!f.alive) {
        if (this.selected === f) this.clearSelection();
        this.effects.impact(f.x, f.y, 'explosive');
        f.destroy();
        this.fixtures.splice(i, 1);
        this.combat.markPlacementsChanged();
      }
    }
  }

  private updatePhase(dt: number): void {
    switch (this.phase) {
      case 'preparing':
      case 'intermission': {
        this.countdown -= dt;
        if (this.countdown <= 0) this.startWave();
        break;
      }
      case 'wave': {
        const due = this.waves.tick(dt);
        for (const spawn of due) this.spawnDino(spawn.species, spawn.tier, spawn.spawnId);
        if (this.waves.allSpawned && this.dinos.length === 0) this.completeWave();
        break;
      }
      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Waves                                                               */
  /* ------------------------------------------------------------------ */

  private startWave(): void {
    const next = this.waves.index + 1;
    const def = this.waves.waveAt(next);
    if (!def) {
      this.finish('victory');
      return;
    }
    this.waves.begin(next);
    this.phase = 'wave';
    audioManager.play('waveStart', { volume: 0.6 });
    this.effects.banner(
      this.map.width / 2,
      120,
      def.boss ? `WAVE ${def.index} — ${def.name ?? 'BOSS'}` : `WAVE ${def.index}${def.name ? ` — ${def.name}` : ''}`,
      def.boss ? '#ff8a6b' : '#ffd75e',
    );
    if (def.boss) {
      audioManager.play('bossRoar', { volume: 0.8 });
      this.effects.flashScreen(0xff5c48, 0.22, 380);
      this.effects.shake(0.004, 500);
      this.toast('Something very large is coming.', 'boss');
    }
    if (this.config.tutorial && next === 0) this.advanceTutorial('firstWave');
  }

  private completeWave(): void {
    const wave = this.waves.active;
    this.waves.endWave();
    this.wavesCleared += 1;
    if (wave) {
      this.economy.add(wave.def.reward);
      this.toast(`Wave ${wave.def.index} cleared  ·  +${wave.def.reward} Supply`, 'good');
      audioManager.play('reward', { volume: 0.4 });
    }

    if (this.waves.index >= this.waves.total - 1) {
      this.finish('victory');
      return;
    }

    this.phase = 'intermission';
    this.countdown = INTERMISSION_MS;
    if (this.config.tutorial && this.wavesCleared === 1) this.advanceTutorial('firstClear');
    if (this.config.tutorial && this.wavesCleared === 2) this.advanceTutorial('upgrade');
  }

  private tryStartWaveEarly(): void {
    if (this.phase !== 'preparing' && this.phase !== 'intermission') return;
    const bonus = this.earlyBonus();
    if (bonus > 0) {
      this.economy.add(bonus);
      this.toast(`Early start  ·  +${bonus} Supply`, 'good');
    }
    this.countdown = 0;
    this.startWave();
  }

  private earlyBonus(): number {
    if (this.phase !== 'preparing' && this.phase !== 'intermission') return 0;
    return Math.max(0, Math.floor((this.countdown / 1000) * EARLY_BONUS_PER_SEC));
  }

  private spawnDino(speciesId: SpeciesId, tierId: TierId, spawnId?: string): void {
    const species = getSpecies(speciesId);
    const tier = getTier(tierId);
    const path = this.geometry.pathForSpawn(spawnId);
    const speedMult = this.challenge?.modifiers.enemySpeedMultiplier ?? 1;

    const dino = this.dinoPool.pop() ?? new Dino(this);
    const lane = (Math.random() - 0.5) * path.def.width * 1.1;
    dino.spawn(species, tier, path, lane, speedMult * (0.94 + Math.random() * 0.12), this.clock.now);
    this.dinos.push(dino);

    if (!this.speciesSeen.has(speciesId)) {
      this.speciesSeen.add(speciesId);
      gameBus.emit('codexSighting', { species: speciesId, tier: tierId });
      if (this.config.tutorial && speciesId !== 'compsognathus') {
        this.toast(`New species sighted: ${species.name}`, 'info');
      }
    }
    if (species.traits.includes('boss')) {
      this.effects.banner(dino.x + 120, dino.y, species.name.toUpperCase(), '#ff8a6b');
    }
  }

  private handleKill(dino: Dino, source: PlacedUnit | null): void {
    void source;
    this.kills += 1;
    this.killsBySpecies.set(dino.speciesId, (this.killsBySpecies.get(dino.speciesId) ?? 0) + 1);
    this.economy.add(dino.bounty);
    if (dino.isBoss) this.bossesDefeated += 1;
    if (this.config.tutorial && this.kills === 1) this.advanceTutorial('firstKill');
    if (this.config.tutorial && this.kills === 4) this.advanceTutorial('supply');
  }

  private objectiveBreached(dino: Dino): void {
    this.objectiveHp = Math.max(0, this.objectiveHp - dino.objectiveDamage);
    this.effects.explosion(this.map.objective.x, this.map.objective.y, 70, 0xff5c48);
    this.effects.flashScreen(0xff2b2b, 0.16, 200);
    this.effects.shake(0.004, 220);
    audioManager.play('objectiveHit', { volume: 0.55 });
    this.toast(`${this.map.objective.name} hit  ·  -${dino.objectiveDamage}`, 'bad');
    if (this.objectiveHp <= 0 && !this.ended) this.finish('defeat');
  }

  /* ------------------------------------------------------------------ */
  /* Placement                                                           */
  /* ------------------------------------------------------------------ */

  private occupiedSlots(exclude?: unknown): OccupiedSlot[] {
    const slots: OccupiedSlot[] = [];
    for (const d of this.defenders) {
      if (d === exclude) continue;
      slots.push({ x: d.x, y: d.y, radius: d.def.footprint });
    }
    for (const f of this.fixtures) {
      if (f === exclude) continue;
      slots.push({ x: f.x, y: f.y, radius: f.def.footprint });
    }
    if (this.hero && this.hero !== exclude) {
      slots.push({ x: this.hero.x, y: this.hero.y, radius: this.hero.def.footprint });
    }
    return slots;
  }

  private activeDef(): PlaceableDef | HeroDef | null {
    if (!this.activeCardId) return null;
    if (this.activeCardId === HERO_CARD || this.activeCardId === HERO_MOVE) return this.heroDef;
    return this.cards.find((c) => c.id === this.activeCardId) ?? null;
  }

  private selectCard(id: string | null): void {
    if (this.activeCardId === id) {
      this.activeCardId = null;
    } else {
      this.activeCardId = id;
    }
    this.abilityArmed = false;
    this.clearSelection();
    this.refreshGhostTexture();
    this.updateGhost();
    if (id) audioManager.play('uiClick', { volume: 0.4 });
  }

  private refreshGhostTexture(): void {
    this.ghost?.destroy();
    this.ghost = undefined;
    const def = this.activeDef();
    if (!def) {
      this.terrain.noBuild.setVisible(false);
      this.terrain.waterZone?.setVisible(false);
      this.ghostRange?.clear();
      return;
    }
    const isHeroCard = this.activeCardId === HERO_CARD || this.activeCardId === HERO_MOVE;
    const texture =
      !isHeroCard && 'kind' in def && (def as FixtureDef).category === 'fixture'
        ? fixtureTextureKey(def.id)
        : unitTopKey(def.id, 0);
    this.ghost = this.add.image(0, 0, texture).setDepth(DEPTH.ghost).setAlpha(0.72);

    const wantsWater = 'terrain' in def && def.terrain === 'water';
    this.terrain.noBuild.setVisible(!wantsWater);
    this.terrain.waterZone?.setVisible(wantsWater);
  }

  private updateGhost(): void {
    if (!this.ghost) return;
    const def = this.activeDef();
    if (!def) return;

    const x = snapToGrid(this.pointerWorld.x);
    const y = snapToGrid(this.pointerWorld.y);
    const isMove = this.activeCardId === HERO_MOVE;
    const isHeroCard = this.activeCardId === HERO_CARD || isMove;
    const footprint = def.footprint;
    const cost = isMove ? 0 : isHeroCard ? (def as HeroDef).deployCost : (def as PlaceableDef).cost;
    const fixture = !isHeroCard && (def as PlaceableDef).category === 'fixture';

    this.lastVerdict = evaluatePlacement(
      this.geometry,
      {
        x,
        y,
        footprint,
        terrain: def.terrain,
        allowOnPath: fixture,
        cost,
        supply: this.economy.supply,
        permitted: isHeroCard || !this.isCardLocked(this.activeCardId),
      },
      this.occupiedSlots(isMove ? this.hero : undefined),
    );

    const ok = this.lastVerdict.ok;
    this.ghost.setPosition(x, y).setTint(ok ? 0x9dffa6 : 0xff8a8a);

    const range = isHeroCard ? (def as HeroDef).range : (def as DefenderDef).levels?.[0]?.range ?? (def as FixtureDef).radius;
    const g = this.ghostRange!;
    g.clear();
    g.fillStyle(ok ? 0x8de89a : 0xff7a6b, 0.09);
    g.fillCircle(x, y, range);
    g.lineStyle(2, ok ? 0x8de89a : 0xff7a6b, 0.75);
    g.strokeCircle(x, y, range);
    const lure = isHeroCard ? (def as HeroDef).attack.lure : undefined;
    if (lure) {
      // Placement for a lure emitter is all about where the field lands, so
      // it gets its own ring rather than the generic inner guide.
      g.lineStyle(2, 0xffbf47, 0.6);
      g.strokeCircle(x, y, lure.radius);
    } else {
      g.lineStyle(1, ok ? 0xffffff : 0xff7a6b, 0.25);
      g.strokeCircle(x, y, range * 0.66);
    }
  }

  private handleClick(worldX: number, worldY: number): void {
    if (this.abilityArmed && this.hero && this.heroDef) {
      this.fireHeroAbility(worldX, worldY);
      return;
    }
    if (this.activeCardId) {
      this.commitPlacement(worldX, worldY);
      return;
    }
    this.selectAt(worldX, worldY);
  }

  private commitPlacement(worldX: number, worldY: number): void {
    const def = this.activeDef();
    if (!def) return;
    const x = snapToGrid(worldX);
    const y = snapToGrid(worldY);

    if (!this.lastVerdict.ok) {
      audioManager.play('error', { volume: 0.4 });
      this.toast(this.lastVerdict.message, 'bad');
      return;
    }

    if (this.activeCardId === HERO_MOVE && this.hero) {
      this.hero.moveTo(x, y);
      this.hero.repositionReadyAt = this.clock.now + this.hero.def.repositionCooldownMs;
      this.activeCardId = null;
      this.refreshGhostTexture();
      this.combat.markPlacementsChanged();
      audioManager.play('place', { volume: 0.5 });
      this.spawnDeployPuff(x, y);
      return;
    }

    if (this.activeCardId === HERO_CARD && this.heroDef) {
      if (!this.economy.spend(this.heroDef.deployCost)) return;
      this.hero = new HeroUnit(this, `hero-${++unitSeq}`, this.heroDef, x, y);
      this.unitsPlaced += 1;
      this.combat.hero = this.hero;
      this.combat.markPlacementsChanged();
      this.activeCardId = null;
      this.refreshGhostTexture();
      audioManager.play('place', { volume: 0.65 });
      this.spawnDeployPuff(x, y, 1.4);
      this.effects.banner(x, y - 56, this.heroDef.name.toUpperCase(), '#9be8ff');
      if (this.config.tutorial) this.advanceTutorial('hero');
      return;
    }

    const placeable = def as PlaceableDef;
    if (!this.economy.spend(placeable.cost)) {
      audioManager.play('error', { volume: 0.4 });
      return;
    }

    this.unitsPlaced += 1;
    if (placeable.category === 'fixture') {
      const fixture = new FixtureUnit(this, `fx-${++unitSeq}`, placeable as FixtureDef, x, y, this.clock.now);
      this.fixtures.push(fixture);
    } else {
      const unit = new DefenderUnit(this, `u-${++unitSeq}`, placeable as DefenderDef, x, y);
      this.defenders.push(unit);
      if (this.config.tutorial && this.defenders.length === 1) this.advanceTutorial('firstPlacement');
      if (this.config.tutorial && this.defenders.length === 2) this.advanceTutorial('range');
    }

    this.combat.markPlacementsChanged();
    audioManager.play('place', { volume: 0.5 });
    this.spawnDeployPuff(x, y);

    // Holding shift keeps the card active for rapid placement.
    if (!this.shiftKey?.isDown) {
      this.activeCardId = null;
      this.refreshGhostTexture();
    }
  }

  private spawnDeployPuff(x: number, y: number, scale = 1): void {
    this.effects.impact(x, y, 'kinetic');
    const ring = this.add
      .image(x, y, FX.ring)
      .setDepth(DEPTH.effect)
      .setTint(0xbfe8ff)
      .setScale(0.05)
      .setAlpha(0.9);
    this.tweens.add({
      targets: ring,
      scale: 0.85 * scale,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private cancelAction(): void {
    if (this.abilityArmed) {
      this.abilityArmed = false;
      this.toast('Ability cancelled', 'info');
      return;
    }
    if (this.activeCardId) {
      this.activeCardId = null;
      this.refreshGhostTexture();
      return;
    }
    this.clearSelection();
  }

  /* ------------------------------------------------------------------ */
  /* Selection                                                           */
  /* ------------------------------------------------------------------ */

  /** Nearest placement under a world point, or null. */
  private unitAt(x: number, y: number): DefenderUnit | FixtureUnit | HeroUnit | null {
    const candidates: { unit: DefenderUnit | FixtureUnit | HeroUnit; radius: number }[] = [];
    for (const u of this.defenders) candidates.push({ unit: u, radius: u.def.footprint });
    for (const f of this.fixtures) candidates.push({ unit: f, radius: f.def.footprint });
    if (this.hero) candidates.push({ unit: this.hero, radius: this.hero.def.footprint });

    let best: DefenderUnit | FixtureUnit | HeroUnit | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(c.unit.x - x, c.unit.y - y);
      if (d <= c.radius + 10 && d < bestDist) {
        bestDist = d;
        best = c.unit;
      }
    }
    return best;
  }

  private selectAt(x: number, y: number): void {
    const best = this.unitAt(x, y);
    if (best) {
      this.selected = best;
      audioManager.play('uiClick', { volume: 0.35 });
    } else {
      this.clearSelection();
    }
  }

  private clearSelection(): void {
    this.selected = null;
    this.hovered = null;
    this.selectionRing?.setVisible(false);
    this.selectionRange?.clear();
  }

  private drawSelection(): void {
    const g = this.selectionRange!;
    g.clear();
    const sel = this.selected;
    if (!sel) {
      this.selectionRing?.setVisible(false);
      // Preview the reach of whatever the cursor is over, if enabled.
      const hov = this.hovered;
      if (hov && this.config.settings.showRangeOnHover) {
        const r = hov instanceof FixtureUnit ? hov.def.radius : hov.effectiveRange;
        g.fillStyle(0xffe9a8, 0.05);
        g.fillCircle(hov.x, hov.y, r);
        g.lineStyle(1.5, 0xffe9a8, 0.45);
        g.strokeCircle(hov.x, hov.y, r);
      }
      return;
    }

    this.selectionRing?.setVisible(true).setPosition(sel.x, sel.y);
    if (this.selectionRing) this.selectionRing.rotation += 0.004;

    const range =
      sel instanceof FixtureUnit ? sel.def.radius : (sel as DefenderUnit | HeroUnit).effectiveRange;
    g.fillStyle(0x9be8ff, 0.07);
    g.fillCircle(sel.x, sel.y, range);
    g.lineStyle(2, 0x9be8ff, 0.7);
    g.strokeCircle(sel.x, sel.y, range);

    const lureField = sel === this.hero ? this.hero.def.attack.lure : undefined;
    if (lureField) {
      g.lineStyle(2, 0xffbf47, 0.6);
      g.strokeCircle(sel.x, sel.y, lureField.radius);
    }

    // Show the firing line to the current target so blocked shots are legible.
    const target = 'target' in sel ? (sel as DefenderUnit).target : null;
    if (target && target.alive) {
      g.lineStyle(1.5, 0xffe9a8, 0.45);
      g.lineBetween(sel.x, sel.y, target.x, target.y);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Hero                                                                */
  /* ------------------------------------------------------------------ */

  private armHeroAbility(): void {
    if (!this.hero || !this.heroDef) return;
    if (this.clock.now < this.hero.abilityReadyAt) {
      audioManager.play('error', { volume: 0.35 });
      return;
    }
    if (this.heroDef.ability.kind === 'self') {
      this.fireHeroAbility(this.hero.x, this.hero.y);
      return;
    }
    this.abilityArmed = true;
    this.activeCardId = null;
    this.refreshGhostTexture();
    this.toast(`${this.heroDef.ability.name} — select a target area`, 'info');
  }

  private fireHeroAbility(x: number, y: number): void {
    const hero = this.hero;
    const def = this.heroDef;
    if (!hero || !def) return;
    if (this.clock.now < hero.abilityReadyAt) return;

    const ability = def.ability;
    hero.abilityReadyAt = this.clock.now + ability.cooldownMs;
    this.abilityArmed = false;
    audioManager.play('heroAbility', { volume: 0.75 });

    const radius = ability.radius ?? 120;
    const damage = ability.damage ?? 100;
    const type = ability.damageType ?? 'explosive';

    switch (ability.visual) {
      case 'airstrike': {
        // A rotorcraft crosses the marked area, walking shots along its track.
        const shots = ability.shots ?? 8;
        const duration = ability.durationMs ?? 2400;
        const approach = Math.random() * Math.PI * 2;
        const craft = this.add
          .image(x - Math.cos(approach) * 620, y - Math.sin(approach) * 620, 'fx:rotor')
          .setDepth(DEPTH.overlay)
          .setRotation(approach)
          .setScale(0.9);
        this.tweens.add({
          targets: craft,
          x: x + Math.cos(approach) * 620,
          y: y + Math.sin(approach) * 620,
          duration: duration + 900,
          ease: 'Sine.easeInOut',
          onComplete: () => craft.destroy(),
        });
        // Damage is scheduled on the simulation clock, so the strafing run
        // obeys pause and game speed exactly like everything else, and its
        // pending shots are dropped if the match ends first.
        for (let i = 0; i < shots; i++) {
          this.clock.schedule(450 + (i * duration) / shots, () => {
            if (this.ended) return;
            const spread = radius * 0.75;
            const px = x + (Math.random() - 0.5) * spread * 2;
            const py = y + (Math.random() - 0.5) * spread * 2;
            this.combat.detonate(px, py, radius * 0.45, damage, 0.5, type, {}, hero, this.clock.now);
          });
        }
        break;
      }
      case 'slam': {
        const crack = this.add
          .image(hero.x, hero.y, 'fx:crack')
          .setDepth(DEPTH.decor)
          .setScale(0.2)
          .setAlpha(0.9);
        this.tweens.add({
          targets: crack,
          scale: (radius / 80) * 1.05,
          alpha: 0,
          duration: 900,
          ease: 'Cubic.easeOut',
          onComplete: () => crack.destroy(),
        });
        this.combat.detonate(
          hero.x,
          hero.y,
          radius,
          damage,
          0.55,
          type,
          { stun: ability.stun, knockback: 40 },
          hero,
        );
        this.effects.shake(0.009, 400);
        this.effects.flashScreen(0xffd166, 0.18, 260);
        break;
      }
      case 'broadcast': {
        // Overdriven pylon: the full circle, every band at once.
        this.effects.broadcastArcs(hero.x, hero.y, 0, radius, Math.PI * 2, 0x9be8ff);
        this.clock.schedule(120, () => {
          if (this.ended) return;
          this.effects.broadcastArcs(hero.x, hero.y, 0, radius * 0.82, Math.PI * 2, 0xdff6ff);
        });
        this.combat.detonate(
          hero.x,
          hero.y,
          radius,
          damage,
          0.35,
          type,
          { stun: ability.stun },
          hero,
        );
        this.effects.shake(0.006, 320);
        this.effects.flashScreen(0x9be8ff, 0.16, 240);
        break;
      }
      default: {
        // Single heavy shell.
        const shell = this.add
          .image(hero.x, hero.y, FX.shell)
          .setDepth(DEPTH.projectile)
          .setScale(1.7)
          .setRotation(Math.atan2(y - hero.y, x - hero.x));
        hero.faceInstantly(x, y);
        this.effects.muzzleFlash(hero.x, hero.y, hero.facing, 2);
        this.tweens.add({
          targets: shell,
          x,
          y,
          duration: 320,
          ease: 'Quad.easeIn',
          onComplete: () => {
            shell.destroy();
            this.combat.detonate(x, y, radius, damage, 0.5, type, { stun: ability.stun, burn: ability.burn }, hero);
            this.effects.shake(0.011, 420);
            this.effects.flashScreen(0xffb347, 0.2, 260);
          },
        });
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Commands                                                            */
  /* ------------------------------------------------------------------ */

  private handleCommand(cmd: GameCommand): void {
    switch (cmd.type) {
      case 'selectCard':
        this.selectCard(cmd.id);
        break;
      case 'setSpeed':
        this.setSpeed(cmd.speed);
        break;
      case 'togglePause':
        this.togglePause();
        break;
      case 'setMenuOpen':
        this.setMenuOpen(cmd.open);
        break;
      case 'startWave':
        this.tryStartWaveEarly();
        break;
      case 'upgrade':
        this.upgradeSelected();
        break;
      case 'sell':
        this.sellSelected();
        break;
      case 'setTargetMode':
        this.setTargetMode(cmd.mode);
        break;
      case 'deselect':
        this.cancelAction();
        break;
      case 'heroAbility':
        this.armHeroAbility();
        break;
      case 'heroReposition':
        this.beginHeroReposition();
        break;
      case 'quit':
        this.finish('abandoned');
        break;
    }
  }

  private beginHeroReposition(): void {
    if (!this.hero) {
      if (this.heroDef) this.selectCard(HERO_CARD);
      return;
    }
    if (this.clock.now < this.hero.repositionReadyAt) {
      audioManager.play('error', { volume: 0.35 });
      return;
    }
    this.selectCard(HERO_MOVE);
  }

  private setSpeed(speed: number): void {
    if (this.ended) return;
    this.speed = Math.max(1, Math.min(3, speed));
    this.paused = false;
    this.syncPresentationSpeed();
  }

  private togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    this.syncPresentationSpeed();
  }

  /**
   * Opening the Operation Menu freezes the match without touching the
   * player's own pause, so closing it resumes exactly the state they left:
   * running stays running, and an explicit pause stays paused.
   */
  private setMenuOpen(open: boolean): void {
    if (this.menuOpen === open) return;
    this.menuOpen = open;
    this.syncPresentationSpeed();
  }

  /**
   * Tweens and particles are presentation only, but they should still look
   * right: match their rate to the simulation and stall them while frozen.
   */
  private syncPresentationSpeed(): void {
    this.tweens.timeScale = this.frozen ? 0.0001 : this.speed;
  }

  private upgradeSelected(): void {
    const sel = this.selected;
    if (!(sel instanceof DefenderUnit) || !sel.canUpgrade) return;
    const cost = sel.upgradeCost ?? 0;
    if (!this.economy.spend(cost)) {
      audioManager.play('error', { volume: 0.4 });
      this.toast('Not enough Supply', 'bad');
      return;
    }
    sel.applyUpgrade();
    this.upgradesPurchased += 1;
    this.combat.markPlacementsChanged();
    audioManager.play('upgrade', { volume: 0.6 });
    this.effects.damageNumber(sel.x, sel.y - 18, sel.level + 1, 'shock', true);
    const ring = this.add.image(sel.x, sel.y, FX.ring).setDepth(DEPTH.effect).setTint(0xffd75e).setScale(0.05);
    this.tweens.add({
      targets: ring,
      scale: 0.7,
      alpha: 0,
      duration: 380,
      onComplete: () => ring.destroy(),
    });
    if (this.config.tutorial) this.advanceTutorial('upgraded');
  }

  private sellSelected(): void {
    const sel = this.selected;
    if (!sel || sel instanceof HeroUnit) return;

    if (sel instanceof DefenderUnit) {
      this.economy.refund(sel.sellValue);
      this.defenders.splice(this.defenders.indexOf(sel), 1);
      sel.destroy();
    } else {
      this.economy.refund(sel.sellValue);
      this.fixtures.splice(this.fixtures.indexOf(sel), 1);
      sel.destroy();
    }
    this.clearSelection();
    this.combat.markPlacementsChanged();
    audioManager.play('sell', { volume: 0.5 });
  }

  private setTargetMode(mode: TargetMode): void {
    const sel = this.selected;
    if (sel instanceof DefenderUnit || sel instanceof HeroUnit) {
      sel.targetMode = mode;
      sel.target = null;
      audioManager.play('uiClick', { volume: 0.3 });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Health bars                                                         */
  /* ------------------------------------------------------------------ */

  private drawBars(): void {
    const g = this.bars;
    g.clear();
    const highContrast = this.config.settings.highContrastTiers;

    for (const d of this.dinos) {
      if (!d.alive) continue;
      const damaged = d.hp < d.maxHp;
      const showBar = damaged || d.isBoss || d.tier.rank >= 3 || highContrast;
      if (!showBar) continue;

      const w = d.isBoss ? 78 : Math.max(24, Math.min(58, d.worldLength * 0.55));
      const h = d.isBoss ? 7 : 4;
      const x = d.x - w / 2;
      const y = d.y - (d.worldLength * 0.36 + 12);
      const pct = Math.max(0, d.hp / d.maxHp);

      g.fillStyle(0x0b0f12, 0.72);
      g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle(0x2b3138, 1);
      g.fillRect(x, y, w, h);
      g.fillStyle(d.tier.color, 1);
      g.fillRect(x, y, w * pct, h);
      g.fillStyle(0xffffff, 0.28);
      g.fillRect(x, y, w * pct, Math.max(1, h * 0.4));

      // Tier pips: durability without relying on colour.
      if (d.tier.rank > 1) {
        for (let i = 0; i < d.tier.rank; i++) {
          g.fillStyle(0xffffff, 0.9);
          g.fillRect(x + w + 3 + i * 3, y, 2, h);
        }
      }
      // Status ticks.
      const now = this.clock.now;
      if (now < d.slowUntil) {
        g.fillStyle(0x9be8ff, 0.95);
        g.fillRect(x - 5, y, 3, h);
      }
      if (now < d.burnUntil) {
        g.fillStyle(0xff8a3c, 0.95);
        g.fillRect(x - 9, y, 3, h);
      }
      if (now < d.stunUntil) {
        g.fillStyle(0xffd75e, 0.95);
        g.fillRect(x - 13, y, 3, h);
      }
    }

    // Fixture condition bars.
    for (const f of this.fixtures) {
      const cond = f.condition(this.clock.now);
      if (cond >= 0.999) continue;
      const w = 34;
      const x = f.x - w / 2;
      const y = f.y - 26;
      g.fillStyle(0x0b0f12, 0.7);
      g.fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(0x2b3138, 1);
      g.fillRect(x, y, w, 3);
      g.fillStyle(cond > 0.35 ? 0x8de89a : 0xff7a6b, 1);
      g.fillRect(x, y, w * cond, 3);
    }

    // Objective integrity ring.
    const obj = this.map.objective;
    const pct = this.objectiveHp / this.objectiveHpMax;
    const ov = this.overlayGfx;
    const ring = obj.radius + 46;
    ov.clear();
    ov.lineStyle(7, 0x0b0f12, 0.5);
    ov.strokeCircle(obj.x, obj.y, ring);
    ov.lineStyle(5, pct > 0.5 ? 0x8de89a : pct > 0.25 ? 0xffd75e : 0xff5c48, 0.95);
    ov.beginPath();
    ov.arc(obj.x, obj.y, ring, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ov.strokePath();
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */

  private toast(text: string, kind: 'info' | 'good' | 'bad' | 'boss'): void {
    gameBus.emit('toast', { text, kind, id: ++this.toastSeq });
  }

  private advanceTutorial(step: string): void {
    if (!this.config.tutorial) return;
    this.tutorialStep += 1;
    gameBus.emit('tutorial', { step });
  }

  /** True when a challenge rule forbids deploying this card. */
  private isCardLocked(id: string | null): boolean {
    if (!id) return false;
    const def = this.cards.find((c) => c.id === id);
    if (!def) return false;
    const cats = this.challenge?.modifiers.allowedCategories;
    const ids = this.challenge?.modifiers.allowedDefenderIds;
    if (cats && !cats.includes(def.category)) return true;
    if (ids && !ids.includes(def.id)) return true;
    return false;
  }

  private buildCards(): CardState[] {
    const allowedCats = this.challenge?.modifiers.allowedCategories;
    const allowedIds = this.challenge?.modifiers.allowedDefenderIds;
    return this.cards.map((def, i) => ({
      id: def.id,
      name: def.name,
      category: def.category,
      cost: def.cost,
      affordable: this.economy.supply >= def.cost,
      locked:
        (allowedCats ? !allowedCats.includes(def.category) : false) ||
        (allowedIds ? !allowedIds.includes(def.id) : false),
      hotkey: `⇧${i + 1}`,
    }));
  }

  private buildSelection(): SelectionInfo | null {
    const sel = this.selected;
    if (!sel) return null;

    if (sel instanceof FixtureUnit) {
      return {
        unitId: sel.id,
        defId: sel.def.id,
        name: sel.def.name,
        title: sel.def.title,
        kind: 'fixture',
        level: 1,
        maxLevel: 1,
        damage: sel.def.dps ?? 0,
        range: sel.def.radius,
        fireRate: 0,
        dps: sel.def.dps ?? 0,
        kills: 0,
        damageDealt: 0,
        targetMode: null,
        targetModes: [],
        upgradeCost: null,
        upgradeNote: null,
        canAffordUpgrade: false,
        sellValue: sel.sellValue,
        buffed: false,
        condition: sel.condition(this.clock.now),
      };
    }

    if (sel instanceof HeroUnit) {
      return {
        unitId: sel.id,
        defId: sel.def.id,
        name: sel.def.name,
        title: sel.def.title,
        kind: 'hero',
        level: 1,
        maxLevel: 1,
        damage: Math.round(sel.effectiveDamage),
        range: Math.round(sel.effectiveRange),
        fireRate: sel.fireRate,
        dps: Math.round(sel.dps),
        kills: sel.kills,
        damageDealt: Math.round(sel.damageDealt),
        targetMode: sel.targetMode,
        targetModes: ['first', 'strongest', 'closest', 'last'],
        upgradeCost: null,
        upgradeNote: null,
        canAffordUpgrade: false,
        sellValue: 0,
        buffed: sel.buffs.fireRate > 1.001 || sel.buffs.damage > 1.001,
        condition: null,
      };
    }

    const unit = sel as DefenderUnit;
    const upgradeCost = unit.upgradeCost;
    return {
      unitId: unit.id,
      defId: unit.def.id,
      name: unit.def.name,
      title: unit.def.title,
      kind: unit.def.category,
      level: unit.level + 1,
      maxLevel: unit.def.levels.length,
      damage: Math.round(unit.effectiveDamage * 10) / 10,
      range: Math.round(unit.effectiveRange),
      fireRate: Math.round(unit.fireRate * unit.buffs.fireRate * 100) / 100,
      dps: Math.round(unit.dps),
      kills: unit.kills,
      damageDealt: Math.round(unit.damageDealt),
      targetMode: unit.targetMode,
      targetModes: unit.def.targetModes,
      upgradeCost,
      upgradeNote: unit.canUpgrade ? unit.def.levels[unit.level + 1].note : null,
      canAffordUpgrade: upgradeCost !== null && this.economy.supply >= upgradeCost,
      sellValue: unit.sellValue,
      buffed: unit.buffs.fireRate > 1.001 || unit.buffs.damage > 1.001,
      condition: null,
    };
  }

  private buildHeroState(): HeroHudState | null {
    if (!this.heroDef) return null;
    const now = this.clock.now;
    return {
      id: this.heroDef.id,
      name: this.heroDef.name,
      title: this.heroDef.title,
      deployed: this.hero !== null,
      deployCost: this.heroDef.deployCost,
      affordable: this.economy.supply >= this.heroDef.deployCost,
      abilityName: this.heroDef.ability.name,
      abilityDescription: this.heroDef.ability.description,
      abilityReady: this.hero ? now >= this.hero.abilityReadyAt : false,
      abilityProgress: this.hero ? this.hero.abilityProgress(now) : 0,
      abilityArmed: this.abilityArmed,
      repositionReady: this.hero ? now >= this.hero.repositionReadyAt : false,
      repositionProgress: this.hero ? this.hero.repositionProgress(now) : 0,
      repositioning: this.activeCardId === HERO_MOVE,
    };
  }

  private publishHud(force = false): void {
    void force;
    const activeWave = this.waves.active;
    const nextIndex = this.phase === 'wave' ? this.waves.index : this.waves.index + 1;
    const nextDef = this.waves.waveAt(nextIndex);
    const currentDef = activeWave?.def ?? this.waves.waveAt(this.waves.index);

    const snapshot: HudSnapshot = {
      phase: this.phase,
      mapName: this.map.name,
      objectiveName: this.map.objective.name,
      waveIndex:
        this.phase === 'wave'
          ? this.waves.index + 1
          : Math.min(this.waves.total, this.waves.index + 2),
      waveTotal: this.waves.total,
      waveName: currentDef?.name ?? '',
      waveIsBoss: currentDef?.boss ?? false,
      nextWaveName: nextDef?.name ?? '',
      nextWaveIsBoss: nextDef?.boss ?? false,
      enemiesRemaining:
        this.dinos.length + (activeWave ? activeWave.queue.length - activeWave.cursor : 0),
      enemiesInWave: activeWave?.totalEnemies ?? this.waves.plannedCount(nextIndex),
      countdownMs: Math.max(0, this.countdown),
      canStartEarly: this.phase === 'preparing' || this.phase === 'intermission',
      earlyBonus: this.earlyBonus(),
      objectiveHp: Math.ceil(this.objectiveHp),
      objectiveHpMax: this.objectiveHpMax,
      supply: this.economy.supply,
      speed: this.speed,
      paused: this.paused,
      kills: this.kills,
      elapsedMs: this.elapsed,
      cards: this.buildCards(),
      activeCardId:
        this.activeCardId === HERO_CARD || this.activeCardId === HERO_MOVE ? null : this.activeCardId,
      placementHint: this.activeCardId ? this.lastVerdict.message : null,
      placementValid: this.lastVerdict.ok,
      selection: this.buildSelection(),
      hero: this.buildHeroState(),
      challengeName: this.challenge?.name ?? null,
    };
    gameBus.emit('hud', snapshot);
  }

  /* ------------------------------------------------------------------ */
  /* End of match                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Ends the match exactly once and emits exactly one result.
   *
   * Abandoning is a loss the player chose: it is recorded like any other
   * loss, pays the same partial rewards for waves cleared and bosses
   * defeated, and never awards stars or a first clear.
   */
  private finish(endReason: MatchEndReason): void {
    if (this.ended) return;
    this.ended = true;
    const victory = endReason === 'victory';
    this.phase = victory ? 'victory' : 'defeat';
    this.paused = true;
    // Nothing scheduled before the end may land after it.
    this.clock.clear();

    audioManager.stopMusic();
    if (endReason !== 'abandoned') {
      audioManager.play(victory ? 'victory' : 'defeat', { volume: 0.8 });
    }

    const integrity = this.objectiveHp / this.objectiveHpMax;
    const result: MatchResult = {
      mapId: this.map.id,
      challengeId: this.config.challengeId,
      endReason,
      victory,
      stars: starsFor(victory, integrity),
      objectiveHpRemaining: Math.max(0, Math.ceil(this.objectiveHp)),
      objectiveHpMax: this.objectiveHpMax,
      wavesCleared: this.wavesCleared,
      wavesTotal: this.waves.total,
      kills: this.kills,
      bossesDefeated: this.bossesDefeated,
      supplyEarned: this.economy.earned,
      supplySpent: this.economy.grossSpent,
      unitsPlaced: this.unitsPlaced,
      upgradesPurchased: this.upgradesPurchased,
      amberEarned: 0,
      amberBreakdown: [],
      durationMs: this.elapsed,
      speciesSeen: [...this.speciesSeen],
      killsBySpecies: Object.fromEntries(this.killsBySpecies),
      newlyUnlockedStars: 0,
    };

    if (endReason !== 'abandoned') {
      this.effects.banner(
        this.map.width / 2,
        this.map.height / 2 - 40,
        victory ? 'PERIMETER HELD' : 'PERIMETER LOST',
        victory ? '#8de89a' : '#ff7a6b',
      );
      this.cameras.main.fade(700, 6, 10, 14, false);
      // Presentation delay only; the result is already fixed.
      this.time.delayedCall(900, () => gameBus.emit('matchEnd', result));
    } else {
      gameBus.emit('matchEnd', result);
    }
  }

  /** Safe to call more than once: both SHUTDOWN and DESTROY route here. */
  private teardown(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clock.clear();
    clearTestState();
    audioManager.stopMusic();
    this.projectiles?.destroy();
    this.effects?.destroy();
    for (const d of [...this.dinos, ...this.dinoPool]) d.destroy();
    this.dinos = [];
    this.dinoPool = [];
    for (const u of this.defenders) u.destroy();
    for (const f of this.fixtures) f.destroy();
    this.hero?.destroy();
    this.terrain?.destroy();
  }
}
