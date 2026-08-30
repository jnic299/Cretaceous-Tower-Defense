import { useState } from 'react';

import { getSpecies } from '../../game/data/dinosaurs';
import type { MapDef } from '../../game/types';
import { MapPreview } from '../art/MapPreview';
import { DinoSilhouette } from '../art/DinoSilhouette';
import { AmberBadge, Button, Chip, Modal, Stars } from '../components/Ui';
import { useProfile } from '../state/ProfileContext';
import { mapAvailability, totalStars } from '../../progression/profile';

interface Props {
  onBack: () => void;
  onSelect: (mapId: string) => void;
}

function Difficulty({ level }: { level: number }) {
  return (
    <span className="difficulty" title={`Difficulty ${level} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={i < level ? 'on' : ''} />
      ))}
    </span>
  );
}

export function MapSelectScreen({ onBack, onSelect }: Props) {
  const { profile, unlock, canAfford } = useProfile();
  const [pending, setPending] = useState<MapDef | null>(null);
  const rows = mapAvailability(profile);
  const stars = totalStars(profile);

  const buy = (map: MapDef) => {
    if (unlock('maps', map.id)) setPending(null);
  };

  return (
    <div className="screen page">
      <header className="page__bar">
        <Button variant="ghost" onClick={onBack}>
          ‹ Back
        </Button>
        <div className="page__titles">
          <h2>Select Operation</h2>
          <p>{stars} stars earned across all sites</p>
        </div>
        <AmberBadge amount={profile.amber} />
      </header>

      <div className="scroll-area">
        <div className="map-grid">
          {rows.map(({ map, unlocked, starsMet, result }) => {
            const check = canAfford('maps', map.id);
            return (
              <article key={map.id} className={`map-card ${unlocked ? '' : 'map-card--locked'}`}>
                <div className="map-card__art">
                  <MapPreview map={map} locked={!unlocked} />
                  <div className="map-card__overlay">
                    <Difficulty level={map.difficulty} />
                    {result.cleared && <Stars value={result.stars} />}
                  </div>
                  {!unlocked && (
                    <div className="map-card__lock">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
                        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
                      </svg>
                      <span>{starsMet ? `${map.unlockCost} Amber` : `Requires ${map.starsRequired} stars`}</span>
                    </div>
                  )}
                </div>

                <div className="map-card__body">
                  <div className="map-card__heading">
                    <h3>{map.name}</h3>
                    <span>{map.subtitle}</span>
                  </div>
                  <p className="map-card__desc">{map.description}</p>

                  <ul className="map-card__features">
                    {map.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>

                  <div className="map-card__species">
                    {map.expectedSpecies.slice(0, 6).map((s) => (
                      <span key={s} className="species-pip" title={getSpecies(s).name}>
                        <DinoSilhouette species={s} tier="green" height={22} unknown={!profile.codex.seen.includes(s)} />
                      </span>
                    ))}
                  </div>

                  <div className="map-card__foot">
                    <div className="map-card__meta">
                      <Chip>{map.waves.length} waves</Chip>
                      {result.cleared ? (
                        <Chip tone="jade">Cleared</Chip>
                      ) : (
                        <Chip tone="amber">{result.plays > 0 ? `Best: wave ${result.bestWave}` : 'New site'}</Chip>
                      )}
                    </div>
                    {unlocked ? (
                      <Button variant="primary" onClick={() => onSelect(map.id)}>
                        Deploy
                      </Button>
                    ) : (
                      <Button disabled={!check.ok} onClick={() => setPending(map)}>
                        {starsMet ? 'Unlock' : 'Locked'}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {pending && (
        <Modal
          title={`Unlock ${pending.name}?`}
          onClose={() => setPending(null)}
          footer={
            <div className="modal__actions">
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => buy(pending)}>
                Spend {pending.unlockCost} Amber
              </Button>
            </div>
          }
        >
          <p className="muted">{pending.description}</p>
          <p className="muted">
            You have <strong>{profile.amber.toLocaleString()}</strong> Amber. This site costs{' '}
            <strong>{pending.unlockCost}</strong>.
          </p>
        </Modal>
      )}
    </div>
  );
}
