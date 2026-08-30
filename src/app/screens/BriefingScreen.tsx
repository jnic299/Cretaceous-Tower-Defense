import { useEffect, useMemo, useState } from 'react';
import { getMap } from '../../game/data/maps';
import { CHALLENGES_BY_ID } from '../../game/data/challenges';
import { ALL_DEFENDERS, FIXTURES, HEROES } from '../../game/data/catalog';
import type { DefenderDef, FixtureDef, HeroDef, PlaceableDef } from '../../game/types';
import { MapPreview } from '../art/MapPreview';
import { UnitEmblem } from '../art/UnitEmblem';
import { Button, Chip, Panel, Stat } from '../components/Ui';
import { useProfile } from '../state/ProfileContext';
import { TARGET_MODE_LABELS } from '../../game/systems/targeting';

const MAX_LOADOUT = 6;

interface Props {
  mapId: string;
  challengeId?: string;
  onBack: () => void;
  onDeploy: (heroId: string | null, loadout: string[]) => void;
}

function ownedPlaceables(unlocked: { defenders: string[]; turrets: string[]; fixtures: string[] }): PlaceableDef[] {
  const owned = new Set([...unlocked.defenders, ...unlocked.turrets, ...unlocked.fixtures]);
  return [...ALL_DEFENDERS, ...FIXTURES].filter((d) => owned.has(d.id));
}

export function BriefingScreen({ mapId, challengeId, onBack, onDeploy }: Props) {
  const { profile, selectHero } = useProfile();
  const map = getMap(mapId);
  const challenge = challengeId ? CHALLENGES_BY_ID[challengeId] : undefined;

  const heroAllowed = challenge?.modifiers.heroAllowed !== false;
  const ownedHeroes = HEROES.filter((h) => profile.unlocked.heroes.includes(h.id));
  const available = useMemo(() => ownedPlaceables(profile.unlocked), [profile.unlocked]);

  const allowedIds = challenge?.modifiers.allowedDefenderIds;
  const allowedCats = challenge?.modifiers.allowedCategories;
  const permitted = (d: PlaceableDef) =>
    (!allowedIds || allowedIds.includes(d.id)) && (!allowedCats || allowedCats.includes(d.category));

  const [heroId, setHeroId] = useState<string | null>(
    heroAllowed ? (ownedHeroes.find((h) => h.id === profile.selectedHeroId)?.id ?? ownedHeroes[0]?.id ?? null) : null,
  );
  const [loadout, setLoadout] = useState<string[]>(() =>
    available
      .filter(permitted)
      .slice(0, MAX_LOADOUT)
      .map((d) => d.id),
  );

  useEffect(() => {
    if (heroId) selectHero(heroId);
  }, [heroId, selectHero]);

  const toggle = (id: string) => {
    setLoadout((current) =>
      current.includes(id)
        ? current.filter((c) => c !== id)
        : current.length >= MAX_LOADOUT
          ? current
          : [...current, id],
    );
  };

  const selectedHero: HeroDef | undefined = HEROES.find((h) => h.id === heroId);
  const canDeploy = loadout.length > 0;

  return (
    <div className="screen page briefing">
      <header className="page__bar">
        <Button variant="ghost" onClick={onBack}>
          ‹ Back
        </Button>
        <div className="page__titles">
          <h2>{challenge ? challenge.name : map.name}</h2>
          <p>{challenge ? `${map.name} — ${challenge.description}` : map.subtitle}</p>
        </div>
        <Button variant="primary" size="lg" disabled={!canDeploy} onClick={() => onDeploy(heroId, loadout)}>
          Deploy
        </Button>
      </header>

      <div className="scroll-area">
        <div className="briefing__grid">
          <Panel title="Site Overview" bracket className="briefing__map">
            <div className="briefing__preview">
              <MapPreview map={map} />
            </div>
            <div className="briefing__meta">
              <Stat label="Objective" value={map.objective.name} />
              <Stat label="Waves" value={map.waves.length} />
              <Stat label="Routes" value={map.paths.length} />
              <Stat label="Starting supply" value={Math.round(map.startingSupply * (challenge?.modifiers.startingSupplyMultiplier ?? 1))} />
            </div>
            <ul className="briefing__features">
              {map.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {challenge && (
              <div className="briefing__rules">
                <h4>Operation rules</h4>
                <ul>
                  {challenge.rules.map((r) => (
                    <li key={r}>{ruleLabel(r)}</li>
                  ))}
                </ul>
                <p className="flavor">{challenge.flavor}</p>
              </div>
            )}
          </Panel>

          <Panel
            title="Hero"
            bracket
            className="briefing__hero"
            actions={<Chip tone={heroAllowed ? 'cyan' : 'rust'}>{heroAllowed ? 'One per operation' : 'Not permitted'}</Chip>}
          >
            {!heroAllowed ? (
              <p className="muted">This operation runs without hero support.</p>
            ) : (
              <>
                <div className="hero-picker">
                  {HEROES.map((h) => {
                    const owned = profile.unlocked.heroes.includes(h.id);
                    return (
                      <button
                        key={h.id}
                        className={`hero-chip ${heroId === h.id ? 'is-active' : ''} ${owned ? '' : 'is-locked'}`}
                        onClick={() => owned && setHeroId(h.id)}
                        disabled={!owned}
                        title={owned ? h.name : `Unlock in the Armory (${h.unlockCost} Amber)`}
                      >
                        <UnitEmblem art={h.art} size={62} label={h.name} />
                        <span className="hero-chip__name">{h.name}</span>
                        <span className="hero-chip__title">{owned ? h.title : 'Locked'}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedHero && (
                  <div className="hero-detail">
                    <p className="hero-detail__desc">{selectedHero.description}</p>
                    <div className="statgrid">
                      <Stat label="Deploy cost" value={`${selectedHero.deployCost} Supply`} />
                      <Stat label="Range" value={selectedHero.range} />
                      <Stat label="Damage" value={selectedHero.damage} />
                      <Stat label="Rate" value={`${selectedHero.fireRate}/s`} />
                      <Stat label="Targeting" value={TARGET_MODE_LABELS[selectedHero.defaultTargeting]} />
                      <Stat label="Reposition" value={`${selectedHero.repositionCooldownMs / 1000}s`} />
                    </div>
                    <div className="ability-card">
                      <div className="ability-card__head">
                        <strong>{selectedHero.ability.name}</strong>
                        <Chip tone="cyan">{selectedHero.ability.cooldownMs / 1000}s cooldown</Chip>
                      </div>
                      <p>{selectedHero.ability.description}</p>
                    </div>
                    <p className="flavor">{selectedHero.flavor}</p>
                  </div>
                )}
              </>
            )}
          </Panel>

          <Panel
            title="Loadout"
            bracket
            className="briefing__loadout"
            actions={
              <Chip tone={loadout.length ? 'amber' : 'rust'}>
                {loadout.length} / {MAX_LOADOUT} selected
              </Chip>
            }
          >
            <p className="muted small">
              Pick what you carry into the field. Everything here costs Supply during the match, not Amber.
            </p>
            <div className="loadout-grid">
              {available.map((def) => {
                const active = loadout.includes(def.id);
                const blocked = !permitted(def);
                const full = !active && loadout.length >= MAX_LOADOUT;
                return (
                  <button
                    key={def.id}
                    className={`loadout-card ${active ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''}`}
                    onClick={() => !blocked && toggle(def.id)}
                    disabled={blocked || full}
                    title={blocked ? 'Not permitted in this operation' : def.description}
                  >
                    <div className="loadout-card__art">
                      {def.category === 'fixture' ? (
                        <FixtureGlyph def={def as FixtureDef} />
                      ) : (
                        <UnitEmblem art={(def as DefenderDef).art} size={64} label={def.name} />
                      )}
                    </div>
                    <span className="loadout-card__name">{def.name}</span>
                    <span className="loadout-card__cost">{def.cost}</span>
                    <span className={`loadout-card__cat cat--${def.category}`}>{def.category}</span>
                  </button>
                );
              })}
            </div>
            {available.length === 0 && (
              <p className="muted">Nothing unlocked yet. Visit the Armory once you have Amber.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function FixtureGlyph({ def, size = 64 }: { def: FixtureDef; size?: number }) {
  return (
    <svg viewBox="-40 -40 80 80" width={size} height={size} role="img" aria-label={def.name}>
      <ellipse cx="2" cy="6" rx="30" ry="18" fill="rgba(0,0,0,0.32)" />
      {def.kind === 'barricade' && (
        <g stroke="#2a2e33" strokeWidth="2">
          {[-12, 0, 12].map((y) => (
            <rect key={y} x="-28" y={y - 5} width="56" height="10" rx="3" fill={y === 0 ? '#9aa3ad' : '#8d949c'} />
          ))}
          <rect x="-30" y="-22" width="7" height="44" rx="3" fill="#6b7178" />
          <rect x="23" y="-22" width="7" height="44" rx="3" fill="#6b7178" />
        </g>
      )}
      {def.kind === 'shockFence' && (
        <g>
          <rect x="-30" y="-24" width="8" height="48" rx="3" fill="#6f767d" stroke="#22262a" strokeWidth="2" />
          <rect x="22" y="-24" width="8" height="48" rx="3" fill="#6f767d" stroke="#22262a" strokeWidth="2" />
          {[-18, -8, 2, 12].map((y) => (
            <line key={y} x1="-26" y1={y} x2="26" y2={y} stroke="#9be8ff" strokeWidth="2.4" />
          ))}
          <path d="M-22 -12 L-6 4 L6 -8 L22 6" fill="none" stroke="#fff" strokeWidth="2" />
        </g>
      )}
      {def.kind === 'decoy' && (
        <g>
          <rect x="-11" y="-4" width="22" height="26" rx="5" fill="#4a5a4a" stroke="#1e261e" strokeWidth="2" />
          <path d="M-4 -4 L4 -4 L16 -26 L-16 -26 Z" fill="#9aa3ad" stroke="#2a2e33" strokeWidth="2" />
          {[12, 20, 28].map((r, i) => (
            <circle key={r} cx="0" cy="-26" r={r} fill="none" stroke="#ffe9a8" strokeWidth="2" opacity={0.42 - i * 0.11} />
          ))}
        </g>
      )}
      {def.kind === 'supplyCache' && (
        <g>
          <rect x="-28" y="-18" width="34" height="34" rx="4" fill="#8a6b40" stroke="#3f3120" strokeWidth="2.4" />
          <path d="M-28 -18 L6 16 M6 -18 L-28 16" stroke="#ad8a5a" strokeWidth="2.4" />
          <rect x="4" y="-6" width="24" height="24" rx="4" fill="#4e6b5a" stroke="#1f2b25" strokeWidth="2" />
          <circle cx="16" cy="6" r="6" fill="#d9a441" />
        </g>
      )}
    </svg>
  );
}

function ruleLabel(rule: string): string {
  const map: Record<string, string> = {
    noTurrets: 'Automated turrets are offline',
    rangersOnly: 'Rangers only — no specialists',
    fragileObjective: 'Objective integrity is reduced',
    swarm: 'Twice the number of animals',
    heavyweights: 'Every animal is one tier heavier',
    speedRush: 'Everything moves faster',
    noHero: 'No hero support',
    holdTheLine: 'Survive a fixed number of waves',
  };
  return map[rule] ?? rule;
}
