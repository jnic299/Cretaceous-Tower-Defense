import type { CardState, GameCommand } from '../../../game/events';
import { findDefender, findFixture } from '../../../game/data/catalog';
import { UnitEmblem } from '../../art/UnitEmblem';
import { FixtureGlyph } from '../../screens/BriefingScreen';
import { Tooltip } from '../Ui';

interface Props {
  cards: CardState[];
  activeId: string | null;
  hint: string | null;
  valid: boolean;
  onCommand: (cmd: GameCommand) => void;
}

export function DeployBar({ cards, activeId, hint, valid, onCommand }: Props) {
  return (
    <div className="deploy">
      <div className="deploy__cards">
        {cards.map((card) => {
          const def = findDefender(card.id);
          const fixture = findFixture(card.id);
          const disabled = card.locked || card.atLimit || !card.affordable;
          const source = def ?? fixture;
          return (
            <Tooltip
              key={card.id}
              content={
                source ? (
                  <>
                    <strong>{source.name}</strong>
                    <div className="tip__role">{source.title}</div>
                    <p>{source.description}</p>
                    <div className="tip__cost">{card.cost} Supply · {card.hotkey}</div>
                    {card.maxPerMatch !== undefined && (
                      <div className="tip__role">
                        Limit {card.maxPerMatch} per operation
                      </div>
                    )}
                    {card.locked && <div className="tip__blocked">Not permitted in this operation</div>}
                    {!card.locked && card.atLimit && (
                      <div className="tip__blocked">Already deployed for this operation</div>
                    )}
                  </>
                ) : (
                  card.name
                )
              }
            >
              <button
                className={`deploy-card ${activeId === card.id ? 'is-active' : ''} ${
                  disabled ? 'is-disabled' : ''
                }`}
                onClick={() => onCommand({ type: 'selectCard', id: activeId === card.id ? null : card.id })}
                disabled={card.locked || card.atLimit}
                aria-pressed={activeId === card.id}
              >
                <span className="deploy-card__art">
                  {fixture ? (
                    <FixtureGlyph def={fixture} size={44} />
                  ) : def ? (
                    <UnitEmblem art={def.art} size={46} label={def.name} />
                  ) : null}
                </span>
                <span className="deploy-card__name">{card.name}</span>
                <span className={`deploy-card__cost ${card.affordable ? '' : 'is-short'}`}>{card.cost}</span>
                <span className="deploy-card__key">{card.hotkey}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
      {/* The hint also covers hero deployment and repositioning, which have no
          card on the bar but still need placement feedback. */}
      {hint && (
        <div className={`deploy__hint ${valid ? 'is-ok' : 'is-bad'}`}>
          {valid ? 'Click to deploy · right-click to cancel' : hint}
        </div>
      )}
    </div>
  );
}
