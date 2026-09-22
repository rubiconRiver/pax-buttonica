import { GameView } from '../components/game/GameView';
import { useStore } from '../state/createStore';
import { liveGame } from '../state/game';
import { settingsStore } from '../state/settings';
import { restoreGame, type SavedGame } from '../state/gameSync';
import { openRoom } from '../remote/host';
import { Setup } from './Setup';

export function Play() {
  const { game } = useStore(liveGame);
  const resume = (saved: SavedGame) => {
    restoreGame(saved);
    if (saved.code) openRoom(saved.code);
  };
  if (!game) return <Setup onStart={(players, options) => liveGame.start(players, { ...options, seating: true, primaryStage: settingsStore.get().primaryStage })} onResume={resume} />;
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
