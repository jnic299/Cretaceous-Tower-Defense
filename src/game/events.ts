import type { MatchResult, SpeciesId, TargetMode, TierId } from './types';

/* ------------------------------------------------------------------ */
/* HUD snapshot — pushed from the scene at a fixed low rate            */
/* ------------------------------------------------------------------ */

export type MatchPhase = 'preparing' | 'wave' | 'intermission' | 'victory' | 'defeat';

export interface CardState {
  id: string;
  name: string;
  category: 'defender' | 'turret' | 'fixture';
  cost: number;
  affordable: boolean;
  /** Blocked by a challenge rule. */
  locked: boolean;
  /** This unit's per-match cap is already spent. */
  atLimit: boolean;
  /** Present only for units that carry a per-match cap. */
  maxPerMatch?: number;
  hotkey: string;
}

export interface SelectionInfo {
  unitId: string;
  defId: string;
  name: string;
  title: string;
  kind: 'defender' | 'turret' | 'fixture' | 'hero';
  level: number;
  maxLevel: number;
  damage: number;
  range: number;
  fireRate: number;
  dps: number;
  kills: number;
  damageDealt: number;
  targetMode: TargetMode | null;
  targetModes: TargetMode[];
  upgradeCost: number | null;
  upgradeNote: string | null;
  canAffordUpgrade: boolean;
  sellValue: number;
  buffed: boolean;
  /** Fixtures report remaining integrity / lifetime as 0..1. */
  condition: number | null;
}

export interface HeroHudState {
  id: string;
  name: string;
  title: string;
  deployed: boolean;
  deployCost: number;
  affordable: boolean;
  abilityName: string;
  abilityDescription: string;
  abilityReady: boolean;
  abilityProgress: number;
  abilityArmed: boolean;
  repositionReady: boolean;
  repositionProgress: number;
  repositioning: boolean;
}

export interface HudSnapshot {
  phase: MatchPhase;
  mapName: string;
  objectiveName: string;
  waveIndex: number;
  waveTotal: number;
  waveName: string;
  waveIsBoss: boolean;
  nextWaveName: string;
  nextWaveIsBoss: boolean;
  enemiesRemaining: number;
  enemiesInWave: number;
  countdownMs: number;
  canStartEarly: boolean;
  earlyBonus: number;
  objectiveHp: number;
  objectiveHpMax: number;
  supply: number;
  speed: number;
  paused: boolean;
  kills: number;
  elapsedMs: number;
  cards: CardState[];
  activeCardId: string | null;
  placementHint: string | null;
  placementValid: boolean;
  selection: SelectionInfo | null;
  hero: HeroHudState | null;
  challengeName: string | null;
}

/* ------------------------------------------------------------------ */
/* Commands — sent from React into the running scene                   */
/* ------------------------------------------------------------------ */

export type GameCommand =
  | { type: 'selectCard'; id: string | null }
  | { type: 'setSpeed'; speed: number }
  | { type: 'togglePause' }
  | { type: 'setMenuOpen'; open: boolean }
  | { type: 'startWave' }
  | { type: 'upgrade' }
  | { type: 'sell' }
  | { type: 'setTargetMode'; mode: TargetMode }
  | { type: 'deselect' }
  | { type: 'heroAbility' }
  | { type: 'heroReposition' }
  | { type: 'quit' };

export interface ToastPayload {
  text: string;
  kind: 'info' | 'good' | 'bad' | 'boss';
  id: number;
}

export interface TutorialPayload {
  step: string;
}

export interface CodexPayload {
  species: SpeciesId;
  tier: TierId;
}

export interface GameEventMap {
  hud: HudSnapshot;
  matchEnd: MatchResult;
  toast: ToastPayload;
  tutorial: TutorialPayload;
  codexSighting: CodexPayload;
  command: GameCommand;
  ready: { mapId: string };
}

type Handler<T> = (payload: T) => void;

/**
 * Minimal typed event bus between the Phaser simulation and the React shell.
 * Deliberately not Phaser's emitter so the UI never imports the engine.
 */
export class GameBus {
  private handlers = new Map<keyof GameEventMap, Set<Handler<never>>>();

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => {
      set?.delete(handler as Handler<never>);
    };
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) (handler as Handler<GameEventMap[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const gameBus = new GameBus();
