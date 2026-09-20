import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameView } from '../components/game/GameView';
import { useStore } from '../state/createStore';
import { seedDemo } from '../state/demo';
import { demoGame } from '../state/game';

export function Demo() {
  const { game } = useStore(demoGame);
  const navigate = useNavigate();

  useEffect(() => {
    if (!demoGame.get().game) seedDemo(demoGame, 'action');
  }, []);

  if (!game) return null;
  return (
    <GameView
      store={demoGame}
      game={game}
      demo
      onExit={() => {
        demoGame.clear();
        navigate('/');
      }}
    />
  );
}
