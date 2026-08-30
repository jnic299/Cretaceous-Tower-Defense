import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ChallengeDef, MapDef, MatchResult, SpeciesId } from '../../game/types';
import type { GameSettings, PlayerProfile } from '../../persistence/schema';
import { SAVE_VERSION } from '../../persistence/schema';
import type { GameSaveRepository } from '../../persistence/GameSaveRepository';
import { LocalStorageGameSaveRepository } from '../../persistence/LocalStorageGameSaveRepository';
import { MemoryGameSaveRepository } from '../../persistence/GameSaveRepository';
import { migrateSave } from '../../persistence/migrations';
import { createProfile } from '../../progression/profile';
import { applyUnlock, canUnlock, type UnlockKind } from '../../progression/unlocks';
import { applyMatchResult } from '../../progression/applyResult';
import { audioManager } from '../../audio/AudioManager';

/** Swap this factory to move progression to a server without touching the UI. */
function createSaveRepository(): GameSaveRepository {
  const local = new LocalStorageGameSaveRepository();
  return local.isAvailable() ? local : new MemoryGameSaveRepository();
}

interface ProfileContextValue {
  profile: PlayerProfile;
  ready: boolean;
  storageAvailable: boolean;
  unlock: (kind: UnlockKind, id: string) => boolean;
  canAfford: (kind: UnlockKind, id: string) => ReturnType<typeof canUnlock>;
  updateSettings: (patch: Partial<GameSettings>) => void;
  selectHero: (heroId: string) => void;
  finishMatch: (result: MatchResult, map: MapDef, challenge?: ChallengeDef) => MatchResult;
  recordSighting: (species: SpeciesId) => void;
  completeTutorial: () => void;
  leaveTitle: () => void;
  resetProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  // Lazy state, not a ref: the repository is created exactly once and is safe
  // to read during render.
  const [repo] = useState<GameSaveRepository>(createSaveRepository);
  const [storageAvailable] = useState(() => repo.isAvailable());

  const [profile, setProfile] = useState<PlayerProfile>(() => createProfile());
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // Load once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await repo.load();
      if (cancelled) return;
      if (raw) setProfile(migrateSave(raw).profile);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  // Debounced autosave. Every mutation goes through setProfile, so this is the
  // only place that ever writes.
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void repo.save({ version: SAVE_VERSION, profile });
    }, 300);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [profile, ready, repo]);

  // Keep the audio buses in step with the player's settings.
  useEffect(() => {
    audioManager.setSettings({
      masterVolume: profile.settings.masterVolume,
      musicVolume: profile.settings.musicVolume,
      sfxVolume: profile.settings.sfxVolume,
      muted: profile.settings.muted,
    });
  }, [profile.settings]);

  const unlock = useCallback((kind: UnlockKind, id: string) => {
    let changed = false;
    setProfile((current) => {
      const next = applyUnlock(current, kind, id);
      changed = next !== current;
      return next;
    });
    return changed;
  }, []);

  const canAfford = useCallback(
    (kind: UnlockKind, id: string) => canUnlock(profile, kind, id),
    [profile],
  );

  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    setProfile((c) => ({ ...c, settings: { ...c.settings, ...patch }, updatedAt: Date.now() }));
  }, []);

  const selectHero = useCallback((heroId: string) => {
    setProfile((c) => (c.selectedHeroId === heroId ? c : { ...c, selectedHeroId: heroId }));
  }, []);

  const recordSighting = useCallback((species: SpeciesId) => {
    setProfile((c) =>
      c.codex.seen.includes(species)
        ? c
        : { ...c, codex: { ...c.codex, seen: [...c.codex.seen, species] } },
    );
  }, []);

  const completeTutorial = useCallback(() => {
    setProfile((c) => (c.tutorialCompleted ? c : { ...c, tutorialCompleted: true }));
  }, []);

  const leaveTitle = useCallback(() => {
    setProfile((c) => (c.firstRun ? { ...c, firstRun: false } : c));
  }, []);

  const resetProfile = useCallback(() => {
    const fresh = createProfile();
    setProfile(fresh);
    void repo.save({ version: SAVE_VERSION, profile: fresh });
  }, [repo]);

  /**
   * Applies a finished match and returns the enriched result. The reducer is
   * pure, but React may invoke updaters twice in StrictMode, so the award is
   * computed once here against the latest profile and then committed.
   */
  const finishMatch = useCallback(
    (result: MatchResult, map: MapDef, challenge?: ChallengeDef): MatchResult => {
      const outcome = applyMatchResult(profile, result, map, challenge);
      setProfile(outcome.profile);
      return outcome.result;
    },
    [profile],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      ready,
      storageAvailable,
      unlock,
      canAfford,
      updateSettings,
      selectHero,
      finishMatch,
      recordSighting,
      completeTutorial,
      leaveTitle,
      resetProfile,
    }),
    [
      profile,
      ready,
      storageAvailable,
      unlock,
      canAfford,
      updateSettings,
      selectHero,
      finishMatch,
      recordSighting,
      completeTutorial,
      leaveTitle,
      resetProfile,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
