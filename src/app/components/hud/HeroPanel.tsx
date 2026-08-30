import type { GameCommand, HeroHudState } from '../../../game/events';
import { findHero } from '../../../game/data/catalog';
import { UnitEmblem } from '../../art/UnitEmblem';

interface Props {
  hero: HeroHudState;
  onCommand: (cmd: GameCommand) => void;
}

/** Circular cooldown sweep drawn with a stroked arc. */
function CooldownRing({ progress, ready }: { progress: number; ready: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="cooldown-ring" viewBox="0 0 60 60" aria-hidden>
      <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="5" />
      <circle
        cx="30"
        cy="30"
        r={r}
        fill="none"
        stroke={ready ? 'var(--cyan)' : 'var(--amber)'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
        transform="rotate(-90 30 30)"
      />
    </svg>
  );
}

export function HeroPanel({ hero, onCommand }: Props) {
  const def = findHero(hero.id);
  if (!def) return null;

  return (
    <div className={`hero-panel ${hero.deployed ? 'is-deployed' : ''}`}>
      <div className="hero-panel__portrait">
        <UnitEmblem art={def.art} size={58} label={def.name} />
      </div>

      <div className="hero-panel__info">
        <div className="hero-panel__name">{def.name}</div>
        <div className="hero-panel__title">{def.title}</div>
      </div>

      {!hero.deployed ? (
        <button
          className="hero-panel__deploy"
          onClick={() => onCommand({ type: 'heroReposition' })}
          disabled={!hero.affordable}
          title={hero.affordable ? 'Deploy hero (R)' : 'Not enough Supply'}
        >
          <span>Deploy</span>
          <em>{hero.deployCost}</em>
        </button>
      ) : (
        <div className="hero-panel__actions">
          <button
            className={`hero-action ${hero.abilityReady ? 'is-ready' : ''} ${hero.abilityArmed ? 'is-armed' : ''}`}
            onClick={() => onCommand({ type: 'heroAbility' })}
            disabled={!hero.abilityReady}
            title={`${hero.abilityName} — ${hero.abilityDescription} (Q)`}
          >
            <CooldownRing progress={hero.abilityProgress} ready={hero.abilityReady} />
            <span className="hero-action__glyph">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="hero-action__label">{hero.abilityArmed ? 'Pick target' : hero.abilityName}</span>
          </button>

          <button
            className={`hero-action hero-action--move ${hero.repositioning ? 'is-armed' : ''}`}
            onClick={() => onCommand({ type: 'heroReposition' })}
            disabled={!hero.repositionReady}
            title="Reposition hero (R)"
          >
            <CooldownRing progress={hero.repositionProgress} ready={hero.repositionReady} />
            <span className="hero-action__glyph">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" strokeLinecap="round" />
              </svg>
            </span>
            <span className="hero-action__label">Move</span>
          </button>
        </div>
      )}
    </div>
  );
}
