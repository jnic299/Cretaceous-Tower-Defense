import { useState } from 'react';
import { Button, Modal, Panel, Stat } from '../components/Ui';
import { useProfile } from '../state/ProfileContext';
import { totalStars } from '../../progression/profile';
import { audioManager } from '../../audio/AudioManager';

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider__label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="slider__value">{Math.round(value * 100)}</span>
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__text">
        <strong>{label}</strong>
        {hint && <em>{hint}</em>}
      </span>
    </label>
  );
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { profile, updateSettings, resetProfile, storageAvailable } = useProfile();
  const [confirming, setConfirming] = useState(false);
  const s = profile.settings;

  return (
    <div className="screen page settings">
      <header className="page__bar">
        <Button variant="ghost" onClick={onBack}>
          ‹ Back
        </Button>
        <div className="page__titles">
          <h2>Settings</h2>
          <p>Everything saves automatically to this browser.</p>
        </div>
        <span />
      </header>

      <div className="scroll-area">
        <div className="settings__grid">
          <Panel title="Audio" bracket>
            <Toggle
              label="Mute everything"
              checked={s.muted}
              onChange={(v) => {
                updateSettings({ muted: v });
                if (!v) {
                  audioManager.unlock();
                  audioManager.play('uiClick');
                }
              }}
            />
            <Slider label="Master" value={s.masterVolume} onChange={(v) => updateSettings({ masterVolume: v })} />
            <Slider label="Music" value={s.musicVolume} onChange={(v) => updateSettings({ musicVolume: v })} />
            <Slider
              label="Effects"
              value={s.sfxVolume}
              onChange={(v) => {
                updateSettings({ sfxVolume: v });
                audioManager.play('shot', { volume: 0.5 });
              }}
            />
            <p className="muted small">
              All audio is synthesised in the browser — there are no sound files to download.
            </p>
          </Panel>

          <Panel title="Gameplay & Accessibility" bracket>
            <Toggle
              label="Floating damage numbers"
              hint="Turn off for a cleaner battlefield during heavy waves."
              checked={s.showDamageNumbers}
              onChange={(v) => updateSettings({ showDamageNumbers: v })}
            />
            <Toggle
              label="Screen shake"
              hint="Applies to explosions, boss entrances and heavy weapons."
              checked={s.screenShake}
              onChange={(v) => updateSettings({ screenShake: v })}
            />
            <Toggle
              label="Show range on hover"
              hint="Preview a defender's reach before you commit."
              checked={s.showRangeOnHover}
              onChange={(v) => updateSettings({ showRangeOnHover: v })}
            />
            <Toggle
              label="High-contrast tiers"
              hint="Always show health bars and tier pips, not only when damaged."
              checked={s.highContrastTiers}
              onChange={(v) => updateSettings({ highContrastTiers: v })}
            />
            <Toggle
              label="Confirm before selling"
              checked={s.confirmSell}
              onChange={(v) => updateSettings({ confirmSell: v })}
            />
          </Panel>

          <Panel title="Career" bracket>
            <div className="statgrid">
              <Stat label="Amber" value={profile.amber.toLocaleString()} />
              <Stat label="Stars" value={totalStars(profile)} />
              <Stat label="Operations" value={profile.stats.matches} />
              <Stat label="Won / lost" value={`${profile.stats.wins} / ${profile.stats.losses}`} />
              <Stat label="Confirmed kills" value={profile.stats.kills.toLocaleString()} />
              <Stat label="Waves cleared" value={profile.stats.waves} />
              <Stat label="Bosses defeated" value={profile.stats.bosses} />
              <Stat
                label="Time in the field"
                value={`${Math.floor(profile.stats.playTimeMs / 3600000)}h ${Math.floor(
                  (profile.stats.playTimeMs % 3600000) / 60000,
                )}m`}
              />
            </div>
            <p className="muted small">
              {storageAvailable
                ? 'Progress is stored in this browser and survives a refresh.'
                : 'Browser storage is unavailable, so progress will not survive a refresh.'}
            </p>
            <Button variant="danger" block onClick={() => setConfirming(true)}>
              Reset all progress
            </Button>
          </Panel>
        </div>
      </div>

      {confirming && (
        <Modal
          title="Reset all progress?"
          onClose={() => setConfirming(false)}
          footer={
            <div className="modal__actions">
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep my progress
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  resetProfile();
                  setConfirming(false);
                }}
              >
                Erase everything
              </Button>
            </div>
          }
        >
          <p>
            This permanently deletes your Amber, unlocks, star ratings, codex entries and lifetime statistics.
            There is no way to undo it.
          </p>
          <p className="muted small">You will start again with the Ranger, a Sentry Turret and Research Outpost.</p>
        </Modal>
      )}
    </div>
  );
}
