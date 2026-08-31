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
  onComplete: (result: MatchResult) => void;
}

/**
 * Hosts the Phaser canvas and the DOM HUD. React never touches the simulation
 * directly — it reads throttled snapshots off the bus and sends commands back.
 */
export function MatchScreen({ config, onComplete }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<GameApp | null>(null);
  const { finishMatch, recordSighting } = useProfile();
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const [tutorialStep, setTutorialStep] = useState<string | null>(config.tutorial ? 'welcome' : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const completedRef = useRef(false);
  // Held in a ref so the bus subscription below never has to be torn down and
  // rebuilt just because a parent render produced a new callback identity.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const map = useMemo(() => getMap(config.mapId), [config.mapId]);

  const send = useCallback((cmd: Parameters<typeof gameBus.emit<'command'>>[1]) => {
    gameBus.emit('command', cmd);
  }, []);
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
      // The scene emits once per match, but guard anyway: processing a result
      // twice would pay the rewards twice.
      if (completedRef.current) return;
      completedRef.current = true;
      // Rewards, stats and tutorial completion are one profile transition.
      const enriched = finishMatch(result, map, challenge, {
        completedTutorial: config.tutorial,
      });
      onCompleteRef.current(enriched);
    });

    return () => {
      offHud();
      offToast();
      offTutorial();
      offCodex();
      offEnd();
    };
  }, [config.tutorial, finishMatch, recordSighting, map, challenge]);


  // Abandoning runs the engine's end-of-match path, so it produces exactly one
  // result, records the loss and pays the partial rewards the UI promises.
  const abandon = useCallback(() => {
    setMenuOpen(false);
    send({ type: 'setMenuOpen', open: false });
    send({ type: 'quit' });
  }, [send]);

  // The scene freezes while the menu is open and restores the player's own
  // pause state when it closes.
  const openMenu = useCallback(() => {
    setMenuOpen(true);
    send({ type: 'setMenuOpen', open: true });
  }, [send]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    send({ type: 'setMenuOpen', open: false });
  }, [send]);

  return (
    <div className="screen match">
      <div className="match__stage" ref={hostRef} />

      {hud && (
        <MatchHud
          hud={hud}
          toasts={toasts}
          onCommand={send}
          onOpenMenu={openMenu}
          menuOpen={menuOpen}
          onCloseMenu={closeMenu}
          onAbandon={abandon}
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
