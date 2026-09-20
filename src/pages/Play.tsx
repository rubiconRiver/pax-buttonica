import { GameView } from '../components/game/GameView';
import { useStore } from '../state/createStore';
import { liveGame } from '../state/game';
import { settingsStore } from '../state/settings';
import { Setup } from './Setup';

export function Play() {
  const { game } = useStore(liveGame);
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
