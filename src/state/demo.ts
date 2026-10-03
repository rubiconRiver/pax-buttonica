import type { PlayerSetup } from '../engine/types';
import type { GameStore } from './game';
import { settingsStore } from './settings';

export const DEMO_PLAYERS: PlayerSetup[] = [
  { name: 'Mike', faction: 'The Emirates of Hacan', color: 'yellow', intro: { kind: 'jingle', id: 'trade-wind' }, outro: { kind: 'jingle', id: 'over-to-you' }, buttons: 1 },
  { name: 'Sarah', faction: 'The Barony of Letnev', color: 'red', intro: { kind: 'jingle', id: 'war-drums' }, outro: { kind: 'jingle', id: 'mic-drop' }, buttons: 1 },
  { name: 'Dave', faction: 'The Universities of Jol-Nar', color: 'blue', intro: { kind: 'jingle', id: 'glitch' }, outro: { kind: 'jingle', id: 'warp-out' }, buttons: 3 },
  { name: 'Jen', faction: 'The Xxcha Kingdom', color: 'green', intro: { kind: 'jingle', id: 'council-bell' }, outro: { kind: 'jingle', id: 'sealed' }, buttons: 1 },
  { name: 'Kyle', faction: 'The Nomad', color: 'purple', intro: { kind: 'jingle', id: 'warp-in' }, outro: { kind: 'jingle', id: 'stand-down' }, buttons: 1 },
  { name: 'Steph', faction: 'The Argent Flight', color: 'orange', intro: { kind: 'jingle', id: 'herald' }, outro: { kind: 'jingle', id: 'over-to-you' }, buttons: 1 },
];

/** Picks in seat order from Mike: gives initiative order Dave, Kyle, Mike, Sarah, Steph, Jen. */
const DEMO_PICKS = [3, 5, 1, 8, 2, 6];

export type DemoPoint = 'strategy' | 'action' | 'late';

export function seedDemo(store: GameStore, point: DemoPoint = 'action') {
  const at = Date.now();
  const { primaryStage, fanfareMs, scoreInOrder, quietAgenda } = settingsStore.get();
  store.start(DEMO_PLAYERS, { vpTarget: 10, speaker: 0, primaryStage, fanfareMs, scoreInOrder, quietAgenda });
  if (point === 'strategy') return;
  for (const card of DEMO_PICKS) store.dispatch({ type: 'PICK_CARD', card, at });
  if (point === 'late') {
    for (let i = 0; i < DEMO_PLAYERS.length; i++) {
      store.dispatch({ type: 'PLAY_CARD', at });
      store.dispatch({ type: 'ACK_ALL', at });
      store.dispatch({ type: 'END_TURN', at });
    }
  }
  // A seeded game is a starting point, not something to undo back through.
  store.set((s) => ({ ...s, base: s.game && { ...s.game, fx: [] }, events: [], future: [], epoch: s.epoch + 1, game: s.game && { ...s.game, fx: [] } }));
}
