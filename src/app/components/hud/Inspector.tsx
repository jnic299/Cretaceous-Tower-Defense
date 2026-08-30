import type { GameCommand, SelectionInfo } from '../../../game/events';
import { findDefender, findFixture, findHero } from '../../../game/data/catalog';
import { TARGET_MODE_HINTS, TARGET_MODE_LABELS } from '../../../game/systems/targeting';
import { UnitEmblem } from '../../art/UnitEmblem';
import { FixtureGlyph } from '../../screens/BriefingScreen';
import { Button, Meter, Stat, Tooltip } from '../Ui';

interface Props {
  selection: SelectionInfo;
  supply: number;
  onCommand: (cmd: GameCommand) => void;
}

export function Inspector({ selection, supply, onCommand }: Props) {
  const def = findDefender(selection.defId);
  const fixture = findFixture(selection.defId);
  const hero = findHero(selection.defId);
  const art = def?.art ?? hero?.art;

  return (
    <aside className="inspector" aria-label={`${selection.name} details`}>
      <header className="inspector__head">
        <div className="inspector__art">
          {fixture ? <FixtureGlyph def={fixture} size={52} /> : art ? <UnitEmblem art={art} size={54} label={selection.name} /> : null}
        </div>
        <div className="inspector__id">
          <h4>{selection.name}</h4>
          <span>{selection.title}</span>
        </div>
        <button className="inspector__close" onClick={() => onCommand({ type: 'deselect' })} aria-label="Close">
          ✕
        </button>
      </header>

      {selection.maxLevel > 1 && (
        <div className="inspector__levels">
          {Array.from({ length: selection.maxLevel }, (_, i) => (
            <span key={i} className={i < selection.level ? 'pip pip--on' : 'pip'} />
          ))}
          <em>Level {selection.level}</em>
          {selection.buffed && <span className="inspector__buffed">Buffed</span>}
        </div>
      )}

      <div className="statgrid inspector__stats">
        <Stat label="Damage" value={selection.damage} />
        <Stat label="Range" value={selection.range} />
        {selection.fireRate > 0 && <Stat label="Rate" value={`${selection.fireRate}/s`} />}
        <Stat label="DPS" value={selection.dps} />
        <Stat label="Kills" value={selection.kills} />
        <Stat label="Damage dealt" value={selection.damageDealt.toLocaleString()} />
      </div>

      {selection.condition !== null && (
        <div className="inspector__condition">
          <span className="stat__label">Condition</span>
          <Meter value={selection.condition} tone={selection.condition > 0.35 ? 'default' : 'danger'} />
        </div>
      )}

      {selection.targetModes.length > 0 && selection.targetMode && (
        <div className="inspector__targeting">
          <span className="stat__label">Target priority</span>
          <div className="target-modes">
            {selection.targetModes.map((mode) => (
              <Tooltip key={mode} content={TARGET_MODE_HINTS[mode]}>
                <button
                  className={`target-mode ${selection.targetMode === mode ? 'is-active' : ''}`}
                  onClick={() => onCommand({ type: 'setTargetMode', mode })}
                >
                  {TARGET_MODE_LABELS[mode]}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      <div className="inspector__actions">
        {selection.upgradeCost !== null ? (
          <Button
            variant="primary"
            block
            disabled={!selection.canAffordUpgrade}
            onClick={() => onCommand({ type: 'upgrade' })}
            title={selection.upgradeNote ?? undefined}
          >
            Upgrade · {selection.upgradeCost}
          </Button>
        ) : selection.kind !== 'hero' && selection.maxLevel > 1 ? (
          <div className="inspector__maxed">Fully upgraded</div>
        ) : null}

        {selection.upgradeNote && selection.upgradeCost !== null && (
          <p className="inspector__note">{selection.upgradeNote}</p>
        )}

        {selection.kind !== 'hero' && (
          <Button variant="ghost" size="sm" block onClick={() => onCommand({ type: 'sell' })}>
            Sell · refund {selection.sellValue}
          </Button>
        )}
        {!selection.canAffordUpgrade && selection.upgradeCost !== null && (
          <p className="inspector__short">Need {selection.upgradeCost - supply} more Supply</p>
        )}
      </div>
    </aside>
  );
}
