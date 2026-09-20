import { describe, expect, it } from 'vitest';
import { createGame, endTurnBlocker, initiativeOrder, pendingAcks, reduce, seatSpots, simDevice } from './engine';
import { deriveOutputs } from './outputs';
import type { Action, GameState, PlayerSetup } from './types';

const setup = (n: number): PlayerSetup[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `P${i}`,
    faction: 'The Winnu',
    color: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black'][i],
    intro: { kind: 'none' },
    outro: { kind: 'none' },
    buttons: 1,
  }));

const run = (g: GameState, ...actions: Action[]) => actions.reduce(reduce, g);
const pick = (card: number): Action => ({ type: 'PICK_CARD', card, at: 0 });

/** Six players, seat i takes card 6-i, so initiative order is the reverse of seating. */
function sixInAction(primaryStage = false) {
  let g = createGame(setup(6), { vpTarget: 10, speaker: 0, primaryStage }, 0);
  for (let i = 0; i < 6; i++) g = reduce(g, pick(6 - i));
  return g;
}

describe('strategy phase', () => {
  it('picks clockwise from the speaker and moves to the action phase', () => {
    let g = createGame(setup(6), { vpTarget: 10, speaker: 2 }, 0);
    expect(g.pickOrder).toEqual([2, 3, 4, 5, 0, 1]);
    for (let c = 1; c <= 6; c++) g = reduce(g, pick(c));
    expect(g.phase).toBe('action');
    expect(g.active).toBe(2);
    expect(g.tradeGoods).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
  });

  it('gives two cards each at four players', () => {
    let g = createGame(setup(4), { vpTarget: 10, speaker: 0 }, 0);
    expect(g.pickOrder).toHaveLength(8);
    for (let c = 1; c <= 8; c++) g = reduce(g, pick(c));
    expect(g.players[0].cards).toEqual([1, 5]);
    expect(g.phase).toBe('action');
  });

  it('refuses a card that is already taken', () => {
    let g = createGame(setup(6), { vpTarget: 10, speaker: 0 }, 0);
    g = run(g, pick(3), pick(3));
    expect(g.pickIdx).toBe(1);
  });
});

describe('action phase', () => {
  it('runs in initiative order', () => {
    const g = sixInAction();
    expect(initiativeOrder(g)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(g.active).toBe(5);
    expect(reduce(g, { type: 'INPUT', seat: 5, input: 'hold', at: 1000 }).active).toBe(4);
  });

  it('ignores a hold from someone whose turn it is not', () => {
    const g = sixInAction();
    expect(reduce(g, { type: 'INPUT', seat: 2, input: 'hold', at: 1 }).active).toBe(5);
  });

  it('blocks end of turn until every other player acknowledges a strategy card', () => {
    let g = reduce(sixInAction(), { type: 'INPUT', seat: 5, input: 'strategy', at: 10 });
    expect(g.strategyPlay?.card).toBe(1);
    expect(pendingAcks(g)).toEqual([0, 1, 2, 3, 4]);

    const out = deriveOutputs(g);
    expect(out[5].mode).toBe('solid');
    expect(out[0].mode).toBe('flash');

    g = reduce(g, { type: 'INPUT', seat: 5, input: 'hold', at: 20 });
    expect(g.active).toBe(5);
    expect(g.fx.at(-1)?.kind).toBe('denied');

    for (const seat of [0, 1, 2, 3]) g = reduce(g, { type: 'INPUT', seat, input: 'tap', at: 30 });
    expect(endTurnBlocker(g)).toMatch(/P4/);
    g = reduce(g, { type: 'INPUT', seat: 4, input: 'tap', at: 40 });
    expect(endTurnBlocker(g)).toBeNull();
    expect(deriveOutputs(g)[5].mode).toBe('pulse');

    g = reduce(g, { type: 'INPUT', seat: 5, input: 'hold', at: 50 });
    expect(g.active).toBe(4);
    expect(g.players[5].timeMs).toBe(50);
  });

  it('runs a strategy card in two beats: primary, then secondaries', () => {
    let g = reduce(sixInAction(true), { type: 'INPUT', seat: 5, input: 'double', at: 1000 });
    expect(g.strategyPlay?.stage).toBe('primary');
    expect(g.fx.at(-1)?.kind).toBe('card');
    let out = deriveOutputs(g);
    expect(out[5].mode).toBe('flash');
    expect(out[0].mode).toBe('dim');

    // Other players can't acknowledge yet, and a stray third tap doesn't skip the primary.
    g = reduce(g, { type: 'INPUT', seat: 0, input: 'tap', at: 1100 });
    g = reduce(g, { type: 'INPUT', seat: 5, input: 'tap', at: 1200 });
    expect(g.strategyPlay?.stage).toBe('primary');
    expect(pendingAcks(g)).toHaveLength(5);
    expect(endTurnBlocker(g)).toMatch(/primary/);

    g = reduce(g, { type: 'INPUT', seat: 5, input: 'tap', at: 9000 });
    expect(g.strategyPlay?.stage).toBe('secondary');
    expect(g.fx.at(-1)?.kind).toBe('alert');
    out = deriveOutputs(g);
    expect(out[5].mode).toBe('solid');
    expect(out[0].mode).toBe('flash');

    g = run(g, { type: 'ACK_ALL', at: 9500 }, { type: 'INPUT', seat: 5, input: 'hold', at: 9600 });
    expect(g.active).toBe(4);
  });

  it('ignores double-taps that cannot mean "play my card"', () => {
    let g = reduce(sixInAction(true), { type: 'INPUT', seat: 2, input: 'double', at: 0 });
    expect(g.strategyPlay).toBeNull();
    g = run(g, { type: 'INPUT', seat: 5, input: 'double', at: 0 }, { type: 'INPUT', seat: 5, input: 'double', at: 100 });
    expect(g.fx.some((f) => f.kind === 'denied')).toBe(false);
    expect(g.players[5].usedCards).toEqual([1]);
  });

  it("won't let a player pass while holding an unplayed strategy card", () => {
    const g = reduce(sixInAction(), { type: 'INPUT', seat: 5, input: 'pass', at: 1 });
    expect(g.players[5].passed).toBe(false);
    expect(g.fx.at(-1)?.kind).toBe('denied');
  });

  it('skips passed players and reaches the status phase when all have passed', () => {
    let g = sixInAction();
    for (const seat of [5, 4, 3, 2, 1, 0]) {
      g = run(g, { type: 'PLAY_CARD', at: 0 }, { type: 'ACK_ALL', at: 0 }, { type: 'END_TURN', at: 0 });
      expect(g.players[seat].usedCards).toHaveLength(1);
    }
    expect(g.active).toBe(5);
    g = reduce(g, { type: 'PASS', at: 0 });
    expect(g.active).toBe(4);
    for (let i = 0; i < 5; i++) g = reduce(g, { type: 'PASS', at: 0 });
    expect(g.phase).toBe('status');
    expect(deriveOutputs(g).every((o) => o.mode === 'pulse')).toBe(true);
  });

  it('asks which card when a player holds two', () => {
    let g = createGame(setup(4), { vpTarget: 10, speaker: 0 }, 0);
    for (let c = 1; c <= 8; c++) g = reduce(g, pick(c));
    g = reduce(g, { type: 'INPUT', seat: 0, input: 'strategy', at: 0 });
    expect(g.choosingCard).toBe(true);
    g = reduce(g, { type: 'PLAY_CARD', card: 5, at: 0 });
    expect(g.strategyPlay?.card).toBe(5);
  });

  it('gives the Naalu zero token first turn', () => {
    const players = setup(6);
    players[0].faction = 'The Naalu Collective';
    let g = createGame(players, { vpTarget: 10, speaker: 0 }, 0);
    for (let i = 0; i < 6; i++) g = reduce(g, pick(6 - i));
    expect(g.active).toBe(0);
  });
});

describe('status and agenda', () => {
  const toStatus = () => reduce(sixInAction(), { type: 'ADVANCE', at: 0 });

  it('starts a new round once everyone is ready', () => {
    let g = toStatus();
    for (let s = 0; s < 6; s++) g = reduce(g, { type: 'INPUT', seat: s, input: 'tap', at: 0 });
    expect(g.phase).toBe('strategy');
    expect(g.round).toBe(2);
    expect(g.players.every((p) => p.cards.length === 0 && !p.passed)).toBe(true);
  });

  it('runs two agendas, speaker voting last, once custodians are gone', () => {
    let g = run(toStatus(), { type: 'SET_CUSTODIANS', removed: true }, { type: 'READY_ALL', at: 0 });
    expect(g.phase).toBe('agenda');
    expect(g.agenda?.order).toEqual([1, 2, 3, 4, 5, 0]);
    for (let i = 0; i < 6; i++) g = reduce(g, { type: 'VOTE_DONE', at: 0 });
    expect(g.agenda?.n).toBe(2);
    for (let i = 0; i < 6; i++) g = reduce(g, { type: 'VOTE_DONE', at: 0 });
    expect(g.phase).toBe('strategy');
  });
});

describe('scoring and clock', () => {
  it('ends the game at the target', () => {
    let g = sixInAction();
    for (let i = 0; i < 10; i++) g = reduce(g, { type: 'VP', seat: 3, delta: 1, at: 0 });
    expect(g.phase).toBe('finished');
    expect(g.winner).toBe(3);
    expect(deriveOutputs(g)[3].mode).toBe('rainbow');
  });

  it('does not count paused time', () => {
    let g = sixInAction(); // seat 5's turn started at 0
    g = run(g, { type: 'PAUSE', at: 1000 }, { type: 'RESUME', at: 9000 }, { type: 'END_TURN', at: 9500 });
    expect(g.players[5].timeMs).toBe(1500);
  });
});

describe('seat claiming', () => {
  const seated = () => createGame(setup(6), { vpTarget: 10, speaker: 0, seating: true }, 0);

  it('binds buttons to seats in the order they are pressed', () => {
    let g = seated();
    expect(g.seating?.next).toBe(0);
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'sim-4', input: 'tap', at: 0 });
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'sim-4', input: 'tap', at: 0 }); // same button twice: ignored
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'AABBCC', input: 'tap', at: 0 });
    expect(g.bindings.slice(0, 3)).toEqual(['sim-4', 'AABBCC', null]);
    expect(deriveOutputs(g)[0].mode).toBe('solid');
    expect(seatSpots(g).slice(0, 3)).toEqual([4, 0, -1]);
  });

  it('ignores game input until everyone is seated, then routes by device', () => {
    let g = seated();
    g = reduce(g, { type: 'SKIP_SEATING', devices: [0, 1, 2, 3, 4, 5].map(simDevice), at: 0 });
    expect(g.seating).toBeNull();
    for (let i = 0; i < 6; i++) g = reduce(g, pick(6 - i));
    expect(g.active).toBe(5);
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'sim-5', input: 'hold', at: 10 });
    expect(g.active).toBe(4);
  });

  it('can re-seat mid-game without losing the turn, pausing the clock meanwhile', () => {
    let g = sixInAction(); // seat 5 active since t=0
    g = reduce(g, { type: 'START_SEATING', at: 1000 });
    expect(g.bindings.every((b) => b == null)).toBe(true);
    g = reduce(g, { type: 'INPUT', seat: 5, input: 'hold', at: 1500 });
    expect(g.active).toBe(5);
    for (const spot of [2, 3, 4, 5, 0, 1]) g = reduce(g, { type: 'DEVICE_INPUT', dev: simDevice(spot), input: 'tap', at: 5000 });
    expect(g.seating).toBeNull();
    expect(seatSpots(g)).toEqual([2, 3, 4, 5, 0, 1]);
    g = reduce(g, { type: 'END_TURN', at: 5200 });
    expect(g.players[5].timeMs).toBe(1200);
  });
});
