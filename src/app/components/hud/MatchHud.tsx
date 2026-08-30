import { useEffect } from 'react';
import type { GameCommand, HudSnapshot, ToastPayload } from '../../../game/events';
import { Button, Meter, Modal } from '../Ui';
import { DeployBar } from './DeployBar';
import { HeroPanel } from './HeroPanel';
import { Inspector } from './Inspector';

interface Props {
  hud: HudSnapshot;
  toasts: ToastPayload[];
  onCommand: (cmd: GameCommand) => void;
  onOpenMenu: () => void;
  menuOpen: boolean;
  onCloseMenu: () => void;
  onQuit: () => void;
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function MatchHud({ hud, toasts, onCommand, onOpenMenu, menuOpen, onCloseMenu, onQuit }: Props) {
  const integrity = hud.objectiveHpMax > 0 ? hud.objectiveHp / hud.objectiveHpMax : 0;
  const tone = integrity > 0.5 ? 'default' : integrity > 0.25 ? 'warn' : 'danger';
  const waiting = hud.phase === 'preparing' || hud.phase === 'intermission';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !menuOpen) {
        // Escape cancels in-canvas actions first; the scene handles that. The
        // menu only opens on the explicit button.
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <>
      <header className="hud-top">
        <div className="hud-top__objective">
          <div className="hud-top__label">{hud.objectiveName}</div>
          <Meter value={hud.objectiveHp} max={hud.objectiveHpMax} tone={tone} className="hud-top__meter" />
          <div className="hud-top__value">
            {hud.objectiveHp}
            <em>/{hud.objectiveHpMax}</em>
          </div>
        </div>

        <div className="hud-top__center">
          <div className={`hud-wave ${hud.waveIsBoss ? 'is-boss' : ''}`}>
            <span className="hud-wave__count">
              Wave {hud.waveIndex}
              <em>/{hud.waveTotal}</em>
            </span>
            {hud.waveName && <span className="hud-wave__name">{hud.waveName}</span>}
          </div>
          {hud.phase === 'wave' ? (
            <div className="hud-enemies">
              <span className="hud-enemies__count">{hud.enemiesRemaining}</span>
              <span className="hud-enemies__label">remaining</span>
            </div>
          ) : (
            <button
              className={`hud-next ${hud.nextWaveIsBoss ? 'is-boss' : ''}`}
              onClick={() => onCommand({ type: 'startWave' })}
              disabled={!hud.canStartEarly}
            >
              <span className="hud-next__timer">{waiting ? formatClock(hud.countdownMs) : '—'}</span>
              <span className="hud-next__label">
                {hud.nextWaveIsBoss ? 'Boss inbound' : 'Next wave'}
                {hud.earlyBonus > 0 && <em> · start now +{hud.earlyBonus}</em>}
              </span>
            </button>
          )}
        </div>

        <div className="hud-top__right">
          <div className="hud-supply" title="Supply — spent during this operation">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
              <rect x="3.5" y="7" width="17" height="12.5" rx="2" fill="#4e6b5a" stroke="#1f2b25" strokeWidth="1.4" />
              <path d="M3.5 11.5h17M12 7v12.5" stroke="#9fd6b4" strokeWidth="1.3" />
              <rect x="8.5" y="4" width="7" height="3.4" rx="1" fill="#d9a441" />
            </svg>
            <span>{hud.supply}</span>
          </div>

          <div className="hud-speed" role="group" aria-label="Game speed">
            <button
              className={`speed-btn ${hud.paused ? 'is-active' : ''}`}
              onClick={() => onCommand({ type: 'togglePause' })}
              title="Pause (Space)"
              aria-label="Pause"
            >
              {hud.paused ? '▶' : '❚❚'}
            </button>
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                className={`speed-btn ${!hud.paused && hud.speed === s ? 'is-active' : ''}`}
                onClick={() => onCommand({ type: 'setSpeed', speed: s })}
                title={`${s}× speed (${s})`}
              >
                {s}×
              </button>
            ))}
          </div>

          <button className="hud-menu-btn" onClick={onOpenMenu} title="Menu">
            ☰
          </button>
        </div>
      </header>

      {hud.challengeName && <div className="hud-challenge">{hud.challengeName}</div>}

      <div className="hud-clock">{formatClock(hud.elapsedMs)} · {hud.kills} down</div>

      {hud.selection && <Inspector selection={hud.selection} supply={hud.supply} onCommand={onCommand} />}

      <footer className="hud-bottom">
        <DeployBar
          cards={hud.cards}
          activeId={hud.activeCardId}
          hint={hud.placementHint}
          valid={hud.placementValid}
          onCommand={onCommand}
        />
        {hud.hero && <HeroPanel hero={hud.hero} onCommand={onCommand} />}
      </footer>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>

      {hud.paused && !menuOpen && (
        <div className="hud-paused" role="status">
          <span>Paused</span>
          <em>Space to resume</em>
        </div>
      )}

      {menuOpen && (
        <Modal
          title="Operation Menu"
          onClose={onCloseMenu}
          footer={
            <div className="modal__actions">
              <Button variant="ghost" onClick={onCloseMenu}>
                Resume
              </Button>
              <Button variant="danger" onClick={onQuit}>
                Abandon Operation
              </Button>
            </div>
          }
        >
          <div className="keybinds">
            <h4>Controls</h4>
            <dl>
              <div><dt>Left click</dt><dd>Place · select</dd></div>
              <div><dt>Right click / Esc</dt><dd>Cancel · deselect</dd></div>
              <div><dt>Shift + click</dt><dd>Keep placing the same unit</dd></div>
              <div><dt>Space</dt><dd>Pause / resume</dd></div>
              <div><dt>1 / 2 / 3</dt><dd>Game speed</dd></div>
              <div><dt>Shift + 1…6</dt><dd>Pick a deployment card</dd></div>
              <div><dt>E</dt><dd>Start the next wave early</dd></div>
              <div><dt>Q</dt><dd>Hero ability</dd></div>
              <div><dt>R</dt><dd>Deploy / reposition hero</dd></div>
              <div><dt>U / X</dt><dd>Upgrade / sell selection</dd></div>
            </dl>
          </div>
          <p className="muted small">
            Abandoning counts as a loss, but you keep the Amber for every wave you cleared.
          </p>
        </Modal>
      )}
    </>
  );
}
