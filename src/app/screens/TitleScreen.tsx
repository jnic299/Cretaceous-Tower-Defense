import { TitleBackdrop } from '../components/TitleBackdrop';
import { AmberBadge, Button } from '../components/Ui';
import { useProfile } from '../state/ProfileContext';
import { totalStars } from '../../progression/profile';

interface Props {
  onPlay: () => void;
  onArmory: () => void;
  onChallenges: () => void;
  onCodex: () => void;
  onSettings: () => void;
}

export function TitleScreen({ onPlay, onArmory, onChallenges, onCodex, onSettings }: Props) {
  const { profile } = useProfile();
  const stars = totalStars(profile);
  const fresh = profile.stats.matches === 0;

  return (
    <div className="screen title">
      <TitleBackdrop />

      <div className="title__content">
        <header className="title__brand">
          <div className="title__eyebrow">Perimeter Defence Division</div>
          <h1 className="title__logo">
            <span className="title__logo-top">Cretaceous</span>
            <span className="title__logo-bottom">Tower Defense</span>
          </h1>
          <p className="title__tagline">
            Management maintains that the perimeter remains completely secure.
          </p>
        </header>

        <nav className="title__nav">
          <Button variant="primary" size="lg" onClick={onPlay} autoFocus>
            {fresh ? 'Begin Deployment' : 'Play'}
          </Button>
          <Button size="lg" onClick={onArmory}>
            Armory
          </Button>
          <Button size="lg" onClick={onChallenges}>
            Challenges
          </Button>
          <div className="title__nav-row">
            <Button variant="ghost" onClick={onCodex}>
              Codex
            </Button>
            <Button variant="ghost" onClick={onSettings}>
              Settings
            </Button>
          </div>
        </nav>

        <footer className="title__footer">
          <AmberBadge amount={profile.amber} />
          <span className="title__stat">
            {stars} <em>stars</em>
          </span>
          <span className="title__stat">
            {profile.stats.kills.toLocaleString()} <em>confirmed</em>
          </span>
          <span className="title__version">v1.0 · Field Build</span>
        </footer>
      </div>
    </div>
  );
}
