import { useEffect, useMemo, useState } from 'react';
import type { MatchResult } from '../../game/types';
import { getMap } from '../../game/data/maps';
import { CHALLENGES_BY_ID } from '../../game/data/challenges';
import { STAR_THRESHOLDS } from '../../progression/rewards';
import { AmberBadge, Button, Panel, Stars, Stat } from '../components/Ui';
import { DinoSilhouette, silhouetteHeight } from '../art/DinoSilhouette';
import { audioManager } from '../../audio/AudioManager';

interface Props {
  result: MatchResult;
  onReplay: () => void;
  onArmory: () => void;
  onContinue: () => void;
}

const GRADES = ['Perimeter Lost', 'Held, Barely', 'Solid Defence', 'Textbook'] as const;

export function ResultsScreen({ result, onReplay, onArmory, onContinue }: Props) {
  const map = getMap(result.mapId);
  const challenge = result.challengeId ? CHALLENGES_BY_ID[result.challengeId] : undefined;
  const integrity = result.objectiveHpMax > 0 ? result.objectiveHpRemaining / result.objectiveHpMax : 0;
  const [revealed, setRevealed] = useState(0);

  // Stars land one at a time so the reward reads as an event.
  useEffect(() => {
    if (result.stars === 0) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setRevealed(n);
      audioManager.play('reward', { volume: 0.5 });
      if (n >= result.stars) window.clearInterval(id);
    }, 420);
    return () => window.clearInterval(id);
  }, [result.stars]);

  const nextGoal = useMemo(() => {
    if (!result.victory) return 'Hold the objective to the final wave to earn your first star.';
    if (result.stars >= 3) return 'Maximum rating. Try a Challenge for more Amber.';
    if (result.stars === 2)
      return `Finish above ${Math.round(STAR_THRESHOLDS.three * 100)}% integrity for the third star.`;
    return `Finish above ${Math.round(STAR_THRESHOLDS.two * 100)}% integrity for the second star.`;
  }, [result]);

  return (
    <div className="screen page results">
      <div className={`results__banner ${result.victory ? 'is-win' : 'is-loss'}`}>
        <h2>{result.victory ? 'Perimeter Held' : 'Perimeter Lost'}</h2>
        <p>
          {challenge ? `${challenge.name} · ` : ''}
          {map.name}
        </p>
      </div>

      <div className="scroll-area">
        <div className="results__grid">
          <Panel title="Rating" bracket className="results__rating">
            <div className="results__stars">
              <Stars value={revealed} large />
            </div>
            <div className="results__grade">{GRADES[result.stars]}</div>
            <p className="muted small">{nextGoal}</p>
            <div className="statgrid">
              <Stat label="Objective integrity" value={`${Math.round(integrity * 100)}%`} />
              <Stat label="Waves cleared" value={`${result.wavesCleared} / ${result.wavesTotal}`} />
              <Stat label="Confirmed kills" value={result.kills.toLocaleString()} />
              <Stat label="Bosses defeated" value={result.bossesDefeated} />
              <Stat label="Supply handled" value={result.supplyEarned.toLocaleString()} />
              <Stat
                label="Duration"
                value={`${Math.floor(result.durationMs / 60000)}m ${Math.floor((result.durationMs % 60000) / 1000)}s`}
              />
            </div>
          </Panel>

          <Panel title="Amber Awarded" bracket className="results__amber">
            <div className="results__amber-total">
              <AmberBadge amount={result.amberEarned} />
            </div>
            <ul className="results__breakdown">
              {result.amberBreakdown.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <em>+{row.amount}</em>
                </li>
              ))}
              {result.amberBreakdown.length === 0 && <li className="muted">No Amber earned this run.</li>}
            </ul>
            <p className="muted small">
              Amber is permanent. Spend it in the Armory on new defenders, turrets, fixtures, heroes and sites.
            </p>
          </Panel>

          <Panel title="Species Encountered" bracket className="results__species">
            <div className="results__species-grid">
              {result.speciesSeen.map((s) => (
                <div key={s} className="results__species-item">
                  <DinoSilhouette species={s} tier="green" height={silhouetteHeight(s, 56)} />
                  <span>{s}</span>
                </div>
              ))}
              {result.speciesSeen.length === 0 && <p className="muted">Nothing made it onto the field.</p>}
            </div>
          </Panel>
        </div>
      </div>

      <footer className="results__actions">
        <Button variant="ghost" onClick={onReplay}>
          Replay Operation
        </Button>
        <Button onClick={onArmory}>Open Armory</Button>
        <Button variant="primary" size="lg" onClick={onContinue}>
          Continue
        </Button>
      </footer>
    </div>
  );
}
