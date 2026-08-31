import { useCallback, useState } from 'react';
import type { MatchResult } from '../game/types';
import type { MatchConfig } from '../game/GameApp';
import { ProfileProvider, useProfile } from './state/ProfileContext';
import { TitleScreen } from './screens/TitleScreen';
import { MapSelectScreen } from './screens/MapSelectScreen';
import { BriefingScreen } from './screens/BriefingScreen';
import { MatchScreen } from './screens/MatchScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { ArmoryScreen } from './screens/ArmoryScreen';
import { ChallengesScreen } from './screens/ChallengesScreen';
import { CodexScreen } from './screens/CodexScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { audioManager } from '../audio/AudioManager';

type Route =
  | { name: 'title' }
  | { name: 'maps' }
  | { name: 'briefing'; mapId: string; challengeId?: string }
  | { name: 'match'; config: MatchConfig }
  | { name: 'results'; result: MatchResult }
  | { name: 'armory' }
  | { name: 'challenges' }
  | { name: 'codex' }
  | { name: 'settings' };

function Router() {
  const { profile, ready, leaveTitle } = useProfile();
  const [route, setRoute] = useState<Route>({ name: 'title' });
  const [lastBriefing, setLastBriefing] = useState<{ mapId: string; challengeId?: string } | null>(null);
  // Bumped for every match so replaying a level always mounts a fresh screen.
  const [matchSeq, setMatchSeq] = useState(0);

  const go = useCallback(
    (next: Route) => {
      audioManager.unlock();
      if (next.name !== 'title') leaveTitle();
      setRoute(next);
    },
    [leaveTitle],
  );

  const startMatch = useCallback(
    (mapId: string, challengeId: string | undefined, heroId: string | null, loadout: string[]) => {
      setLastBriefing({ mapId, challengeId });
      setMatchSeq((n) => n + 1);
      const config: MatchConfig = {
        mapId,
        heroId,
        challengeId,
        loadout,
        settings: profile.settings,
        // The guided run happens once, on the starter map, for a fresh profile.
        tutorial: !profile.tutorialCompleted && mapId === 'researchOutpost' && !challengeId,
      };
      go({ name: 'match', config });
    },
    [go, profile.settings, profile.tutorialCompleted],
  );

  if (!ready) {
    return (
      <div className="screen boot">
        <div className="spinner" />
        <p>Loading personnel file…</p>
      </div>
    );
  }

  switch (route.name) {
    case 'title':
      return (
        <TitleScreen
          onPlay={() => go({ name: 'maps' })}
          onArmory={() => go({ name: 'armory' })}
          onChallenges={() => go({ name: 'challenges' })}
          onCodex={() => go({ name: 'codex' })}
          onSettings={() => go({ name: 'settings' })}
        />
      );

    case 'maps':
      return (
        <MapSelectScreen
          onBack={() => go({ name: 'title' })}
          onSelect={(mapId) => go({ name: 'briefing', mapId })}
        />
      );

    case 'briefing':
      return (
        <BriefingScreen
          mapId={route.mapId}
          challengeId={route.challengeId}
          onBack={() => go(route.challengeId ? { name: 'challenges' } : { name: 'maps' })}
          onDeploy={(heroId, loadout) => startMatch(route.mapId, route.challengeId, heroId, loadout)}
        />
      );

    case 'match':
      return (
        <MatchScreen
          key={`${route.config.mapId}:${route.config.challengeId ?? ''}:${matchSeq}`}
          config={route.config}
          onComplete={(result) => go({ name: 'results', result })}
        />
      );

    case 'results':
      return (
        <ResultsScreen
          result={route.result}
          onReplay={() =>
            lastBriefing
              ? go({ name: 'briefing', mapId: lastBriefing.mapId, challengeId: lastBriefing.challengeId })
              : go({ name: 'maps' })
          }
          onArmory={() => go({ name: 'armory' })}
          onContinue={() => go({ name: 'maps' })}
        />
      );

    case 'armory':
      return <ArmoryScreen onBack={() => go({ name: 'title' })} />;

    case 'challenges':
      return (
        <ChallengesScreen
          onBack={() => go({ name: 'title' })}
          onStart={(mapId, challengeId) => go({ name: 'briefing', mapId, challengeId })}
        />
      );

    case 'codex':
      return <CodexScreen onBack={() => go({ name: 'title' })} />;

    case 'settings':
      return <SettingsScreen onBack={() => go({ name: 'title' })} />;
  }
}

export function App() {
  return (
    <ProfileProvider>
      <div className="app">
        <Router />
      </div>
    </ProfileProvider>
  );
}
