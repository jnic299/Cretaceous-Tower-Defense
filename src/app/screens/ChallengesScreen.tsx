import { CHALLENGES } from '../../game/data/challenges';
import { getMap } from '../../game/data/maps';
import { MapPreview } from '../art/MapPreview';
import { AmberBadge, Button, Chip, Panel } from '../components/Ui';
import { useProfile } from '../state/ProfileContext';
import { totalStars } from '../../progression/profile';

interface Props {
  onBack: () => void;
  onStart: (mapId: string, challengeId: string) => void;
}

const RULE_LABELS: Record<string, string> = {
  noTurrets: 'No turrets',
  rangersOnly: 'Rangers only',
  fragileObjective: 'Fragile objective',
  swarm: 'Swarm',
  heavyweights: 'Heavyweights',
  speedRush: 'Speed rush',
  noHero: 'No hero',
  holdTheLine: 'Hold the line',
};

export function ChallengesScreen({ onBack, onStart }: Props) {
  const { profile } = useProfile();
  const stars = totalStars(profile);

  return (
    <div className="screen page challenges">
      <header className="page__bar">
        <Button variant="ghost" onClick={onBack}>
          ‹ Back
        </Button>
        <div className="page__titles">
          <h2>Challenges</h2>
          <p>Modified operations with fixed rules and a one-time Amber bounty.</p>
        </div>
        <AmberBadge amount={profile.amber} />
      </header>

      <div className="scroll-area">
        <div className="challenge-list">
          {CHALLENGES.map((c) => {
            const map = getMap(c.mapId);
            const record = profile.challengeResults[c.id];
            const mapOwned = profile.unlocked.maps.includes(c.mapId);
            const starsMet = stars >= c.starsRequired;
            const available = mapOwned && starsMet;

            return (
              <article key={c.id} className={`challenge-card ${available ? '' : 'is-locked'}`}>
                <div className="challenge-card__art">
                  <MapPreview map={map} locked={!available} />
                </div>
                <div className="challenge-card__body">
                  <div className="challenge-card__head">
                    <h3>{c.name}</h3>
                    <div className="challenge-card__tags">
                      {record?.completed && <Chip tone="jade">Complete</Chip>}
                      <Chip tone="amber">{c.amberReward} Amber</Chip>
                    </div>
                  </div>
                  <p className="challenge-card__site">{map.name}</p>
                  <p className="challenge-card__desc">{c.description}</p>
                  <div className="challenge-card__rules">
                    {c.rules.map((r) => (
                      <Chip key={r} tone="rust">
                        {RULE_LABELS[r] ?? r}
                      </Chip>
                    ))}
                  </div>
                  <p className="flavor">{c.flavor}</p>
                  <div className="challenge-card__foot">
                    {available ? (
                      <Button variant="primary" onClick={() => onStart(c.mapId, c.id)}>
                        {record?.completed ? 'Run Again' : 'Accept'}
                      </Button>
                    ) : (
                      <span className="challenge-card__lock">
                        {!mapOwned ? `Unlock ${map.name} first` : `Requires ${c.starsRequired} stars (you have ${stars})`}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <Panel title="Note" className="challenges__note">
          <p className="muted small">
            The challenge bounty pays once. Wave and boss Amber pay every time, so a challenge you enjoy is
            never a waste of a run.
          </p>
        </Panel>
      </div>
    </div>
  );
}
