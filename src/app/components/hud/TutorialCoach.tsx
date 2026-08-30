import { useEffect, useState } from 'react';

interface Step {
  title: string;
  body: string;
  anchor: 'bottom' | 'top' | 'center' | 'right';
}

/** Short, skippable coaching. Copy stays under two sentences per step. */
const STEPS: Record<string, Step> = {
  welcome: {
    title: 'Welcome to the perimeter',
    body: 'You have Supply to spend and one road to hold. Pick the Ranger from the bar below and click a clear patch of ground beside the road.',
    anchor: 'bottom',
  },
  firstPlacement: {
    title: 'Good. That is your firing line.',
    body: 'The circle is her reach — anything inside it gets a dart. Place a second Ranger further along the road so the two overlap.',
    anchor: 'bottom',
  },
  range: {
    title: 'Cover the corners',
    body: 'Bends keep animals inside your range for longer. Start the first wave when you are ready — starting early pays a Supply bonus.',
    anchor: 'top',
  },
  firstWave: {
    title: 'Contact',
    body: 'Your defenders acquire targets and fire on their own. Watch the health bars: the colour and the pips beside them tell you how tough something is.',
    anchor: 'top',
  },
  firstKill: {
    title: 'Every kill pays',
    body: 'Defeated animals drop Supply. Spend it during the match on more defenders, upgrades, or your hero.',
    anchor: 'bottom',
  },
  supply: {
    title: 'Build while they come',
    body: 'You do not have to wait between waves. Keep placing as the Supply comes in.',
    anchor: 'bottom',
  },
  firstClear: {
    title: 'Wave cleared',
    body: 'Clearing a wave pays a bonus. Later waves bring tougher colour tiers, so keep growing your line.',
    anchor: 'top',
  },
  upgrade: {
    title: 'Upgrade what is already working',
    body: 'Click a placed defender and press Upgrade. Two strong positions usually beat four weak ones.',
    anchor: 'right',
  },
  upgraded: {
    title: 'That is the loop',
    body: 'Place, upgrade, hold. Deploy your hero from the panel on the right when you can afford it.',
    anchor: 'bottom',
  },
  hero: {
    title: 'Hero deployed',
    body: 'Only one hero per operation. Their ability is on the panel — save it for the moment a lane collapses.',
    anchor: 'bottom',
  },
};

export function TutorialCoach({ step, onDismiss }: { step: string; onDismiss: () => void }) {
  const content = STEPS[step];
  // Visibility is derived from which step was last dismissed, so a new step
  // shows itself without an effect writing state on mount.
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDismissed(step), 11000);
    return () => window.clearTimeout(t);
  }, [step]);

  if (!content || dismissed === step) return null;

  return (
    <div className={`coach coach--${content.anchor}`} role="status">
      <div className="coach__marker" />
      <div className="coach__body">
        <strong>{content.title}</strong>
        <p>{content.body}</p>
      </div>
      <button
        className="coach__close"
        onClick={() => {
          setDismissed(step);
          onDismiss();
        }}
        aria-label="Dismiss tip"
      >
        ✕
      </button>
    </div>
  );
}
