import { useState } from 'react';
import { SPECIES, SPECIES_ORDER } from '../../game/data/dinosaurs';
import { TIERS, TIER_ORDER } from '../../game/data/tiers';
import type { SpeciesId } from '../../game/types';
import { scaledHp } from '../../game/systems/combatMath';
import { DinoSilhouette, silhouetteHeight } from '../art/DinoSilhouette';
import { Button, Chip, Panel, Stat } from '../components/Ui';
import { useProfile } from '../state/ProfileContext';

export function CodexScreen({ onBack }: { onBack: () => void }) {
  const { profile } = useProfile();
  const [selected, setSelected] = useState<SpeciesId>(SPECIES_ORDER[0]);
  const seen = new Set(profile.codex.seen);
  const def = SPECIES[selected];
  const known = seen.has(selected);

  return (
    <div className="screen page codex">
      <header className="page__bar">
        <Button variant="ghost" onClick={onBack}>
          ‹ Back
        </Button>
        <div className="page__titles">
          <h2>Field Codex</h2>
          <p>
            {seen.size} of {SPECIES_ORDER.length} species catalogued. Entries fill in once you meet them.
          </p>
        </div>
        <Chip tone="amber">{Math.round((seen.size / SPECIES_ORDER.length) * 100)}% complete</Chip>
      </header>

      <div className="codex__layout">
        <nav className="codex__list scroll-area" aria-label="Species">
          {SPECIES_ORDER.map((id) => {
            const s = SPECIES[id];
            const isKnown = seen.has(id);
            return (
              <button
                key={id}
                className={`codex__entry ${selected === id ? 'is-active' : ''} ${isKnown ? '' : 'is-unknown'}`}
                onClick={() => setSelected(id)}
              >
                <DinoSilhouette species={id} tier="green" height={silhouetteHeight(id, 42)} unknown={!isKnown} />
                <span className="codex__entry-name">{isKnown ? s.name : '— Unidentified —'}</span>
                {isKnown && (profile.codex.kills[id] ?? 0) > 0 && (
                  <span className="codex__entry-kills">{profile.codex.kills[id]}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="codex__detail scroll-area">
          <Panel bracket title={known ? def.name : 'Unidentified specimen'}>
            <div className="codex__hero">
              <DinoSilhouette species={selected} tier="green" height={150} unknown={!known} />
            </div>

            {known ? (
              <>
                <p className="codex__designation">{def.designation}</p>
                <p className="codex__blurb">{def.codex.blurb}</p>

                <div className="statgrid">
                  <Stat label="Threat" value={def.codex.threat} />
                  <Stat label="Speed" value={def.codex.speedLabel} />
                  <Stat label="Durability" value={def.codex.durabilityLabel} />
                  <Stat label="Armour" value={def.armor} />
                  <Stat label="Objective damage" value={def.objectiveDamage} />
                  <Stat label="Supply value" value={def.bounty} />
                  <Stat label="Confirmed kills" value={(profile.codex.kills[selected] ?? 0).toLocaleString()} />
                </div>

                <div className="codex__trait">
                  <strong>Behaviour</strong>
                  <p>{def.codex.trait}</p>
                </div>

                <div className="codex__tiers">
                  <strong>Durability tiers</strong>
                  <div className="tier-row">
                    {TIER_ORDER.map((t) => {
                      const tier = TIERS[t];
                      return (
                        <div key={t} className="tier-card" style={{ borderColor: tier.cssColor }}>
                          <DinoSilhouette species={selected} tier={t} height={44} />
                          <span className="tier-card__name" style={{ color: tier.cssColor }}>
                            {tier.name}
                          </span>
                          <span className="tier-card__hp">{scaledHp(def, tier).toLocaleString()} HP</span>
                          <span className="tier-card__pips">
                            {Array.from({ length: tier.rank }, (_, i) => (
                              <i key={i} />
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="codex__unknown">
                <p className="muted">
                  No confirmed sighting. Survey teams have reported tracks, noise and — in one case —
                  a strongly worded resignation letter.
                </p>
                <ul>
                  <li>Encounter this species in the field to fill in its entry.</li>
                  <li>Durability tiers, behaviour and Supply value will be recorded automatically.</li>
                </ul>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
