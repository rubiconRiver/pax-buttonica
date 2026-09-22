import { useEffect } from 'react';
import { GameView } from '../components/game/GameView';
import { startSync, stopSync } from '../remote/sync';
import { useStore } from '../state/createStore';
import { liveGame } from '../state/game';
import { settingsStore } from '../state/settings';
import { Setup } from './Setup';

export function Play() {
  const { game } = useStore(liveGame);
  // This screen is the host: it keeps the site's copy of the game current and reads what phones send.
  useEffect(() => {
    startSync();
    return stopSync;
  }, []);
  if (!game) return <Setup onStart={(players, options) => liveGame.start(players, { ...options, seating: true, primaryStage: settingsStore.get().primaryStage })} />;
  return (
    <GameView
      store={liveGame}
      game={game}
      onExit={() => {
        if (window.confirm('End this game? The table will be cleared.')) liveGame.clear();
      }}
    />
  );
}
