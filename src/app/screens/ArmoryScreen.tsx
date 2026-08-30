import { useMemo, useState } from 'react';
import { DEFENDERS, FIXTURES, HEROES, TURRETS } from '../../game/data/catalog';
import type { DefenderDef, FixtureDef, HeroDef } from '../../game/types';
import type { UnlockKind } from '../../progression/unlocks';
import { UnitEmblem } from '../art/UnitEmblem';
import { FixtureGlyph } from './BriefingScreen';
import { AmberBadge, Button, Chip, EmptyState, Panel, Stat } from '../components/Ui';
import { useProfile } from '../state/ProfileContext';
import { TARGET_MODE_LABELS } from '../../game/systems/targeting';

type Tab = 'defenders' | 'turrets' | 'fixtures' | 'heroes';

const TABS: { id: Tab; label: string; kind: UnlockKind }[] = [
  { id: 'defenders', label: 'Defenders', kind: 'defenders' },
  { id: 'turrets', label: 'Turrets', kind: 'turrets' },
  { id: 'fixtures', label: 'Fixtures', kind: 'fixtures' },
  { id: 'heroes', label: 'Heroes', kind: 'heroes' },
];

export function ArmoryScreen({ onBack }: { onBack: () => void }) {
  const { profile, unlock, canAfford } = useProfile();
  const [tab, setTab] = useState<Tab>('defenders');
  const kind = TABS.find((t) => t.id === tab)!.kind;

  const items = useMemo(() => {
    if (tab === 'defenders') return DEFENDERS;
    if (tab === 'turrets') return TURRETS;
    if (tab === 'fixtures') return FIXTURES;
    return HEROES;
  }, [tab]);

  return (
    <div className="screen page armory">
      <header className="page__bar">
        <Button variant="ghost" onClick={onBack}>
          ‹ Back
        </Button>
        <div className="page__titles">
          <h2>Armory</h2>
          <p>Spend Amber on permanent unlocks. Deployment still costs Supply in the field.</p>
        </div>
        <AmberBadge amount={profile.amber} />
      </header>

      <div className="armory__tabs">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="tab"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-area">
        <div className="armory__grid">
          {items.map((item) => {
            const owned = profile.unlocked[kind].includes(item.id);
            const check = canAfford(kind, item.id);
            const isHero = tab === 'heroes';
            const isFixture = tab === 'fixtures';
            const d = item as DefenderDef;
            const h = item as HeroDef;
            const f = item as FixtureDef;

            return (
              <article key={item.id} className={`unit-card ${owned ? '' : 'unit-card--locked'}`}>
                <div className="unit-card__art">
                  {isFixture ? (
                    <FixtureGlyph def={f} size={92} />
                  ) : (
                    <UnitEmblem art={isHero ? h.art : d.art} size={132} label={item.name} />
                  )}
                  {!owned && <div className="unit-card__scrim" />}
                </div>

                <div className="unit-card__head">
                  <h3>{item.name}</h3>
                  <span className="unit-card__title">{item.title}</span>
                </div>

                <div className="unit-card__tags">
                  {isHero ? <Chip tone="cyan">Hero</Chip> : <Chip>{(item as DefenderDef).role ?? 'Fixture'}</Chip>}
                  {owned ? <Chip tone="jade">Owned</Chip> : <Chip tone="amber">{item.unlockCost} Amber</Chip>}
                </div>

                <p className="unit-card__desc">{item.description}</p>

                <div className="statgrid unit-card__stats">
                  {isHero ? (
                    <>
                      <Stat label="Deploy" value={`${h.deployCost} Supply`} />
                      <Stat label="Range" value={h.range} />
                      <Stat label="Damage" value={h.damage} />
                      <Stat label="Rate" value={`${h.fireRate}/s`} />
                    </>
                  ) : isFixture ? (
                    <>
                      <Stat label="Cost" value={`${f.cost} Supply`} />
                      <Stat label="Radius" value={f.radius} />
                      <Stat label="Damage" value={f.dps ? `${f.dps}/s` : '—'} />
                      <Stat label="Lifetime" value={f.durationMs ? `${f.durationMs / 1000}s` : 'Permanent'} />
                    </>
                  ) : (
                    <>
                      <Stat label="Cost" value={`${d.cost} Supply`} />
                      <Stat label="Range" value={d.levels[0].range} />
                      <Stat label="Damage" value={d.levels[0].damage} />
                      <Stat label="Rate" value={`${d.levels[0].fireRate}/s`} />
                      <Stat label="Targeting" value={TARGET_MODE_LABELS[d.defaultTargeting]} />
                      <Stat label="Levels" value={d.levels.length} />
                    </>
                  )}
                </div>

                <div className="unit-card__pros">
                  {(isHero ? h.strengths : (item as DefenderDef | FixtureDef).strengths ?? []).map((s) => (
                    <div key={s} className="pro">
                      <i className="pro__plus">+</i>
                      {s}
                    </div>
                  ))}
                  {!isHero &&
                    ((item as DefenderDef | FixtureDef).weaknesses ?? []).map((s) => (
                      <div key={s} className="pro pro--con">
                        <i className="pro__minus">−</i>
                        {s}
                      </div>
                    ))}
                </div>

                <p className="flavor">{item.flavor}</p>

                <div className="unit-card__foot">
                  {owned ? (
                    <span className="unit-card__owned">In inventory</span>
                  ) : (
                    <Button
                      variant={check.ok ? 'primary' : 'default'}
                      disabled={!check.ok}
                      onClick={() => unlock(kind, item.id)}
                      block
                    >
                      {check.ok
                        ? `Unlock · ${item.unlockCost}`
                        : check.reason === 'amber'
                          ? `Need ${check.needed} more Amber`
                          : 'Unavailable'}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {items.length === 0 && <EmptyState title="Nothing here yet" body="More equipment is on the way." />}

        <Panel title="How unlocking works" className="armory__note">
          <p className="muted small">
            Amber comes from clearing waves, beating bosses, first clears, new stars and challenges. Unlocks are
            permanent and survive a page refresh. Deployment inside a match always costs Supply, which resets
            every operation.
          </p>
        </Panel>
      </div>
    </div>
  );
}
