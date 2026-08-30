import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchResult, SpeciesId } from '../../game/types';
import { GameApp, type MatchConfig } from '../../game/GameApp';
import { gameBus, type HudSnapshot, type ToastPayload } from '../../game/events';
import { getMap } from '../../game/data/maps';
import { CHALLENGES_BY_ID } from '../../game/data/challenges';
import { useProfile } from '../state/ProfileContext';
import { audioManager } from '../../audio/AudioManager';
import { MatchHud } from '../components/hud/MatchHud';
import { TutorialCoach } from '../components/hud/TutorialCoach';

interface Props {
  config: MatchConfig;
  onExit: () => void;
  onComplete: (result: MatchResult) => void;
}

/**
 * Hosts the Phaser canvas and the DOM HUD. React never touches the simulation
 * directly — it reads throttled snapshots off the bus and sends commands back.
 */
export function MatchScreen({ config, onExit, onComplete }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<GameApp | null>(null);
  const { finishMatch, recordSighting, completeTutorial } = useProfile();
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const [tutorialStep, setTutorialStep] = useState<string | null>(config.tutorial ? 'welcome' : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const completedRef = useRef(false);

  const map = useMemo(() => getMap(config.mapId), [config.mapId]);
  const challenge = config.challengeId ? CHALLENGES_BY_ID[config.challengeId] : undefined;

  // Mount the engine once per match configuration.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new GameApp();
    appRef.current = app;
    app.start(host, config);
    audioManager.unlock();
    return () => {
      app.destroy();
      appRef.current = null;
    };
  }, [config]);

  useEffect(() => {
    const offHud = gameBus.on('hud', setHud);

    const offToast = gameBus.on('toast', (t) => {
      setToasts((cur) => [...cur.slice(-3), t]);
      window.setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 2600);
    });

    const offTutorial = gameBus.on('tutorial', ({ step }) => setTutorialStep(step));

    const seen = new Set<SpeciesId>();
    const offCodex = gameBus.on('codexSighting', ({ species }) => {
      if (seen.has(species)) return;
      seen.add(species);
      recordSighting(species);
    });

    const offEnd = gameBus.on('matchEnd', (result) => {
      if (completedRef.current) return;
      completedRef.current = true;
      if (config.tutorial) completeTutorial();
      const enriched = finishMatch(result, map, challenge);
      onComplete(enriched);
    });

    return () => {
      offHud();
      offToast();
      offTutorial();
      offCodex();
      offEnd();
    };
  }, [config.tutorial, finishMatch, recordSighting, completeTutorial, map, challenge, onComplete]);

  const send = useCallback((cmd: Parameters<typeof gameBus.emit<'command'>>[1]) => {
    gameBus.emit('command', cmd);
  }, []);

  const quit = useCallback(() => {
    setMenuOpen(false);
    onExit();
  }, [onExit]);

  return (
    <div className="screen match">
      <div className="match__stage" ref={hostRef} />

      {hud && (
        <MatchHud
          hud={hud}
          toasts={toasts}
          onCommand={send}
          onOpenMenu={() => setMenuOpen(true)}
          menuOpen={menuOpen}
          onCloseMenu={() => setMenuOpen(false)}
          onQuit={quit}
        />
      )}

      {!hud && (
        <div className="match__loading">
          <div className="spinner" />
          <p>Establishing perimeter…</p>
        </div>
      )}

      {config.tutorial && tutorialStep && hud && (
        <TutorialCoach step={tutorialStep} onDismiss={() => setTutorialStep(null)} />
      )}
    </div>
  );
}
