import { describe, expect, it } from 'vitest';
import * as engineModule from './engine';
import { createGame, currentScorer, seatOfDevice, endTurnBlocker, initiativeOrder, pendingAcks, reduce, scoreBreakdown, seatSpots, simDevice, turnOrder } from './engine';
import { cardByNumber } from './data';
import { deriveOutputs } from './outputs';
import { createGameStore } from '../state/game';
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

  it('a first speaker put right before anyone chooses chooses first; once choosing has begun the order stands', () => {
    let g = createGame(setup(6), { vpTarget: 10, speaker: 4 }, 0);
    g = reduce(g, { type: 'SET_SPEAKER', seat: 1 });
    expect(g.pickOrder).toEqual([1, 2, 3, 4, 5, 0]);
    expect(turnOrder(g)[0]).toBe(1);
    g = run(g, pick(3), { type: 'SET_SPEAKER', seat: 3 });
    expect(g.speaker).toBe(3);
    expect(g.pickOrder).toEqual([1, 2, 3, 4, 5, 0]);
    expect(g.pickIdx).toBe(1);
    // Twice round at four players.
    g = reduce(createGame(setup(4), { vpTarget: 10, speaker: 3 }, 0), { type: 'SET_SPEAKER', seat: 1 });
    expect(g.pickOrder).toEqual([1, 2, 3, 0, 1, 2, 3, 0]);
  });
});

describe('strategy card reminders', () => {
  it('Imperial scores a public and then pays out for Mecatol Rex, or a secret without it', () => {
    expect(cardByNumber(8).primary).toMatch(/public objective.*Mecatol Rex.*secret/);
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
    expect(g.statusStep).toBe('fanfare');
    expect(deriveOutputs(g).every((o) => o.mode === 'rainbow')).toBe(true);
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

  it('gives the zero token back to the Naalu every round', () => {
    const players = setup(6);
    players[2].faction = 'The Naalu Collective';
    let g = createGame(players, { vpTarget: 10, speaker: 0 }, 0);
    expect(g.zeroToken).toBe(2);
    // Gift of Prescience lends it out for a round.
    g = run(g, { type: 'SET_ZERO_TOKEN', seat: 4 }, { type: 'GOTO', phase: 'next-round', at: 0 });
    expect(g.zeroToken).toBe(2);
    expect(createGame(setup(6), { vpTarget: 10, speaker: 0 }, 0).zeroToken).toBeNull();
  });

  it('a jump to the status or agenda phase leaves no card in play and nobody choosing one', () => {
    const playing = reduce(sixInAction(true), { type: 'INPUT', seat: 5, input: 'double', at: 0 });
    expect(playing.strategyPlay).not.toBeNull();
    expect(reduce(playing, { type: 'GOTO', phase: 'status', at: 1 }).strategyPlay).toBeNull();
    expect(reduce(playing, { type: 'GOTO', phase: 'agenda', at: 1 })).toMatchObject({ strategyPlay: null, active: null });

    let g = createGame(setup(4), { vpTarget: 10, speaker: 0 }, 0);
    for (let c = 1; c <= 8; c++) g = reduce(g, pick(c));
    const choosing = reduce(g, { type: 'INPUT', seat: 0, input: 'strategy', at: 0 });
    expect(choosing.choosingCard).toBe(true);
    expect(reduce(choosing, { type: 'ADVANCE', at: 1 }).choosingCard).toBe(false);
    expect(reduce(choosing, { type: 'GOTO', phase: 'agenda', at: 1 }).choosingCard).toBe(false);
  });
});

describe('a phone alongside a real button', () => {
  const REAL = 'A1B2C3D4E5F6';
  const PHONE = 'web-abcd1234';
  const withProfiles = () => setup(3).map((p, i) => ({ ...p, profileId: `profile-${i}-00000000` }));

  it('takes a simulated seat, but joins alongside a real button instead of taking its seat', () => {
    let g = createGame(withProfiles(), { vpTarget: 10, speaker: 0 }, 0);
    g = reduce(g, { type: 'IDENTIFY', dev: PHONE, profileId: 'profile-1-00000000', at: 0 });
    expect(g.bindings[1]).toBe(PHONE);
    // Ben's real button arrives: it takes the seat back, and the phone stays his.
    g = reduce(g, { type: 'BIND', seat: 1, dev: REAL, at: 0 });
    expect(g.bindings[1]).toBe(REAL);
    expect(seatOfDevice(g, PHONE)).toBe(1);
    // Saying who you are again does not move the real button.
    g = reduce(g, { type: 'IDENTIFY', dev: PHONE, profileId: 'profile-1-00000000', at: 0 });
    expect(g.bindings[1]).toBe(REAL);
    expect(g.bindings.includes(PHONE)).toBe(false);
    expect(g.log.at(-1)?.text).toBe("P1's phone joins alongside their button.");
  });

  it('presses on the phone count for its owner\'s seat', () => {
    let g = createGame(withProfiles(), { vpTarget: 10, speaker: 0 }, 0);
    g = run(g, { type: 'BIND', seat: 0, dev: REAL, at: 0 }, { type: 'IDENTIFY', dev: PHONE, profileId: 'profile-0-00000000', at: 0 });
    for (let c = 1; c <= 6; c++) g = reduce(g, pick(c));
    expect(g.active).toBe(0);
    g = reduce(g, { type: 'DEVICE_INPUT', dev: PHONE, input: 'hold', at: 100 });
    expect(g.active).toBe(1);
    // A device nobody has identified does nothing.
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'web-stranger', input: 'hold', at: 200 });
    expect(g.active).toBe(1);
  });

  it('during seat claiming, a phone whose owner has a real button never claims a seat for someone else', () => {
    let g = createGame(withProfiles(), { vpTarget: 10, speaker: 0, seating: true }, 0);
    g = run(g, { type: 'BIND', seat: 0, dev: REAL, at: 0 }, { type: 'IDENTIFY', dev: PHONE, profileId: 'profile-0-00000000', at: 0 });
    expect(g.seating?.next).toBe(1);
    g = reduce(g, { type: 'DEVICE_INPUT', dev: PHONE, input: 'tap', at: 0 });
    expect(g.bindings[1]).toBeNull();
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'B2', input: 'tap', at: 0 });
    expect(g.bindings[1]).toBe('B2');
  });
});

describe('status and agenda', () => {
  /** The tidy-up straight away: no fanfare, everyone scores at once. */
  const toStatus = () => {
    let g = createGame(setup(6), { vpTarget: 10, speaker: 0, primaryStage: false, fanfareMs: 0, scoreInOrder: false }, 0);
    for (let i = 0; i < 6; i++) g = reduce(g, pick(6 - i));
    return reduce(g, { type: 'ADVANCE', at: 0 });
  };

  it('starts a new round once everyone is ready', () => {
    let g = toStatus();
    expect(g.statusStep).toBe('tidy');
    for (let s = 0; s < 6; s++) g = reduce(g, { type: 'INPUT', seat: s, input: 'tap', at: 0 });
    expect(g.phase).toBe('strategy');
    expect(g.round).toBe(2);
    expect(g.players.every((p) => p.cards.length === 0 && !p.passed)).toBe(true);
  });

  it('celebrates, then scores in initiative order, then tidies up', () => {
    let g = reduce(sixInAction(), { type: 'ADVANCE', at: 100 });
    expect(g.fanfareMs).toBe(4000);
    expect(g.statusStep).toBe('fanfare');
    expect(deriveOutputs(g).map((o) => o.mode)).toEqual(Array(6).fill('rainbow'));
    // Taps during the celebration do nothing.
    g = reduce(g, { type: 'INPUT', seat: 5, input: 'tap', at: 200 });
    expect(g.statusStep).toBe('fanfare');

    g = reduce(g, { type: 'FANFARE_DONE', at: 4100 });
    expect(g.statusStep).toBe('scoring');
    expect(g.scoringOrder).toEqual([5, 4, 3, 2, 1, 0]);
    expect(currentScorer(g)).toBe(5);
    expect(g.fx.at(-1)).toMatchObject({ kind: 'score', seat: 5 });
    expect(deriveOutputs(g)[5]).toMatchObject({ mode: 'pulse', color: expect.any(String) });
    expect(deriveOutputs(g)[4].mode).toBe('dim');
    expect(g.log.at(-1)?.text).toBe('Scoring, in initiative order: P5, P4, P3, P2, P1, P0.');

    // Only the scorer's tap counts.
    g = reduce(g, { type: 'INPUT', seat: 3, input: 'tap', at: 4200 });
    expect(currentScorer(g)).toBe(5);
    g = reduce(g, { type: 'INPUT', seat: 5, input: 'tap', at: 4300 });
    expect(currentScorer(g)).toBe(4);
    expect(g.fx.at(-1)).toMatchObject({ kind: 'score', seat: 4 });
    expect(deriveOutputs(g)[5].reason).toBe('Scored');
    // The host's button works too, and a hold is as good as a tap.
    g = reduce(g, { type: 'SCORED', seat: 4, at: 4400 });
    g = reduce(g, { type: 'INPUT', seat: 3, input: 'hold', at: 4500 });
    for (const seat of [2, 1, 0]) g = reduce(g, { type: 'SCORED', seat, at: 4600 });
    expect(g.statusStep).toBe('tidy');
    expect(g.phase).toBe('status');
    expect(deriveOutputs(g).every((o) => o.mode === 'pulse' && o.color === '#ffffff')).toBe(true);
    // Now the taps are "ready".
    for (let s = 0; s < 6; s++) g = reduce(g, { type: 'INPUT', seat: s, input: 'tap', at: 5000 });
    expect(g.phase).toBe('strategy');
    expect(g.round).toBe(2);
  });

  it('can skip the scoring order, and "everyone is ready" cuts through everything', () => {
    let g = run(sixInAction(), { type: 'ADVANCE', at: 0 }, { type: 'FANFARE_DONE', at: 0 }, { type: 'SKIP_SCORING', at: 0 });
    expect(g.statusStep).toBe('tidy');
    g = run(sixInAction(), { type: 'ADVANCE', at: 0 }, { type: 'READY_ALL', at: 0 });
    expect(g.phase).toBe('strategy');
    expect(g.round).toBe(2);
  });

  it('follows the table\'s taste: no fanfare goes straight to scoring; neither goes straight to the tidy-up', () => {
    let g = run(sixInAction(), { type: 'SET_STATUS_FLOW', fanfareMs: 0, scoreInOrder: true }, { type: 'ADVANCE', at: 0 });
    expect(g.statusStep).toBe('scoring');
    g = run(sixInAction(), { type: 'SET_STATUS_FLOW', fanfareMs: 0, scoreInOrder: false }, { type: 'ADVANCE', at: 0 });
    expect(g.statusStep).toBe('tidy');
    // A game saved before the status phase had steps tidies up as it always did.
    const old = { ...toStatus() } as Partial<GameState>;
    delete old.statusStep;
    delete old.scoringOrder;
    g = reduce(old as GameState, { type: 'INPUT', seat: 0, input: 'tap', at: 0 });
    expect(g.ready[0]).toBe(true);
  });

  it('knows the order of play in every phase', () => {
    let g = createGame(setup(6), { vpTarget: 10, speaker: 2 }, 0);
    expect(turnOrder(g)).toEqual([2, 3, 4, 5, 0, 1]);
    for (let i = 0; i < 6; i++) g = reduce(g, pick(6 - i));
    expect(turnOrder(g)).toEqual(initiativeOrder(g));
    g = run(g, { type: 'SET_CUSTODIANS', removed: true }, { type: 'ADVANCE', at: 0 }, { type: 'READY_ALL', at: 0 });
    expect(g.phase).toBe('agenda');
    expect(turnOrder(g)).toEqual([3, 4, 5, 0, 1, 2]);
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

  it('taking the winning point back picks the game up where it stopped', () => {
    let g = reduce(sixInAction(true), { type: 'INPUT', seat: 5, input: 'double', at: 100 });
    g = reduce(g, { type: 'ADD_EXTRA', seat: 3, label: 'Agenda', points: 10, at: 200 });
    expect(g.phase).toBe('finished');
    expect(g.players[5].timeMs).toBe(200);
    // Someone else's points, or the winner's still at the target, change nothing.
    g = run(g, { type: 'VP', seat: 1, delta: -1, at: 300 }, { type: 'ADD_EXTRA', seat: 3, label: 'Relic', points: 1, at: 300 }, { type: 'VP', seat: 3, delta: -1, at: 300 });
    expect(g.phase).toBe('finished');

    g = reduce(g, { type: 'VP', seat: 3, delta: -1, at: 900 });
    expect(g.phase).toBe('action');
    expect(g.winner).toBeNull();
    expect(g.active).toBe(5);
    expect(g.strategyPlay).toMatchObject({ card: 1, by: 5, stage: 'primary' });
    expect(g.log.at(-1)?.text).toBe('P3 is back under 10 — the game goes on.');
    expect(deriveOutputs(g)[5].mode).toBe('flash');
    // The turn clock starts again from the moment the point came off.
    g = run(g, { type: 'INPUT', seat: 5, input: 'tap', at: 1000 }, { type: 'ACK_ALL', at: 1000 }, { type: 'END_TURN', at: 1500 });
    expect(g.players[5].timeMs).toBe(200 + 600);
    expect(g.active).toBe(4);
    // And winning again still works.
    g = reduce(g, { type: 'VP', seat: 3, delta: 1, at: 2000 });
    expect(g).toMatchObject({ phase: 'finished', winner: 3 });
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

  it('lets a phone that knows its owner take the seat directly, and the ritual skips it', () => {
    let g = seated();
    g = reduce(g, { type: 'BIND', seat: 0, dev: 'web-aaaa', at: 0 });
    expect(g.seating?.next).toBe(1);
    g = reduce(g, { type: 'BIND', seat: 2, dev: 'web-bbbb', at: 0 });
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'sim-0', input: 'tap', at: 0 }); // seat 1
    expect(g.seating?.next).toBe(3); // seat 2 was already taken
    g = reduce(g, { type: 'BIND', seat: 1, dev: 'web-aaaa', at: 0 }); // same phone moves: old seat frees up
    expect(g.bindings.slice(0, 3)).toEqual([null, 'web-aaaa', 'web-bbbb']);

    g = reduce(g, { type: 'SKIP_SEATING', devices: [0, 1, 2, 3, 4, 5].map(simDevice), at: 0 });
    g = reduce(g, { type: 'START_SEATING', at: 0 });
    expect(g.bindings.filter(Boolean)).toEqual(['web-aaaa', 'web-bbbb']);
    expect(g.seating?.next).toBe(0);
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

  it('starting the claiming over mid-claim still starts the clock again at the end, and a paused game stays paused', () => {
    const everyone = [0, 1, 2, 3, 4, 5].map(simDevice);
    let g = run(sixInAction(), { type: 'START_SEATING', at: 1000 }, { type: 'START_SEATING', at: 2000 });
    expect(g.paused).toBe(true);
    g = reduce(g, { type: 'SKIP_SEATING', devices: everyone, at: 5000 });
    expect(g.paused).toBe(false);
    g = reduce(g, { type: 'END_TURN', at: 5200 });
    expect(g.players[5].timeMs).toBe(1200);

    g = run(sixInAction(), { type: 'PAUSE', at: 1000 }, { type: 'START_SEATING', at: 2000 }, { type: 'START_SEATING', at: 3000 }, { type: 'SKIP_SEATING', devices: everyone, at: 5000 });
    expect(g.paused).toBe(true);
  });
});

describe('objectives and scoring', () => {
  const reveal = (name: string, stage: 1 | 2): Action => ({ type: 'REVEAL_OBJECTIVE', stage, name, text: 'Do the thing.', points: stage });

  it('derives points from scored objectives, secrets and extras', () => {
    let g = run(sixInAction(), reveal('Expand Borders', 1), reveal('Subdue the Galaxy', 2), reveal('Expand Borders', 1));
    expect(g.objectives).toHaveLength(2); // the same card can't be revealed twice
    const [one, two] = g.objectives;
    g = run(
      g,
      { type: 'SCORE_OBJECTIVE', id: one.id, seat: 2, scored: true, at: 0 },
      { type: 'SCORE_OBJECTIVE', id: two.id, seat: 2, scored: true, at: 0 },
      { type: 'SCORE_OBJECTIVE', id: two.id, seat: 2, scored: true, at: 0 }, // twice is once
      { type: 'SCORE_SECRET', seat: 2, label: 'Cut Supply Lines', at: 0 },
      { type: 'ADD_EXTRA', seat: 2, label: 'Custodians of Mecatol Rex', points: 1, at: 0 },
      { type: 'VP', seat: 2, delta: 1, at: 0 },
    );
    expect(g.players[2].vp).toBe(6);
    expect(scoreBreakdown(g, 2)).toMatchObject({ fromPublics: 3, fromSecrets: 1, fromExtras: 2, total: 6 });

    g = run(g, { type: 'SCORE_OBJECTIVE', id: two.id, seat: 2, scored: false, at: 0 }, { type: 'VP', seat: 2, delta: -1, at: 0 });
    expect(g.players[2].vp).toBe(3);
    expect(g.players[2].extras.map((e) => e.label)).toEqual(['Custodians of Mecatol Rex']);

    g = reduce(g, { type: 'REMOVE_OBJECTIVE', id: one.id, at: 0 });
    expect(g.players[2].vp).toBe(2);
  });

  it('ends the game when an objective takes someone to the target', () => {
    let g = reduce(sixInAction(), reveal('Found a Golden Age', 2));
    g = reduce(g, { type: 'ADD_EXTRA', seat: 1, label: 'Agenda', points: 8, at: 0 });
    expect(g.phase).toBe('action');
    g = reduce(g, { type: 'SCORE_OBJECTIVE', id: g.objectives[0].id, seat: 1, scored: true, at: 0 });
    expect(g.phase).toBe('finished');
    expect(g.winner).toBe(1);
  });

  it('keeps a list of laws', () => {
    let g = run(sixInAction(), { type: 'ADD_LAW', name: 'Minister of War', note: 'P3' }, { type: 'ADD_LAW', name: ' ', note: '' });
    expect(g.laws.map((l) => l.name)).toEqual(['Minister of War']);
    g = reduce(g, { type: 'REMOVE_LAW', id: g.laws[0].id });
    expect(g.laws).toHaveLength(0);
  });
});

describe('device identities', () => {
  const setup = (profileIds: (string | undefined)[]) =>
    createGame(
      profileIds.map((profileId, i) => ({ name: `P${i}`, faction: `F${i}`, color: 'red', intro: { kind: 'none' }, outro: { kind: 'none' }, buttons: 1, profileId })),
      { vpTarget: 10, speaker: 0, seating: true, code: 'TEST' },
      0,
    );

  it('a device that names a seated player becomes their button, no ritual needed', () => {
    let g = setup(['a', 'b', 'c']);
    g = reduce(g, { type: 'IDENTIFY', dev: 'web-1', profileId: 'b', at: 1 });
    expect(g.bindings).toEqual([null, 'web-1', null]);
    expect(g.devices).toEqual({ 'web-1': 'b' });
    expect(g.seating?.next).toBe(0);
    // Claiming carries on past the seat that already has a button.
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'sim-0', input: 'tap', at: 2 });
    expect(g.seating?.next).toBe(2);
  });

  it('a device that names nobody is remembered as asked, and a stranger is remembered too', () => {
    let g = setup(['a', 'b', 'c']);
    g = reduce(g, { type: 'IDENTIFY', dev: 'web-1', profileId: null, at: 1 });
    expect(g.devices).toEqual({ 'web-1': null });
    g = reduce(g, { type: 'IDENTIFY', dev: 'web-2', profileId: 'zed', at: 1 });
    expect(g.devices['web-2']).toBe('zed');
    expect(g.bindings).toEqual([null, null, null]);
  });

  it('claiming by pressing tells the game who the device is', () => {
    let g = setup(['a', undefined, 'c']);
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'web-9', input: 'tap', at: 1 });
    expect(g.bindings[0]).toBe('web-9');
    expect(g.devices['web-9']).toBe('a');
    g = reduce(g, { type: 'DEVICE_INPUT', dev: 'web-8', input: 'tap', at: 2 });
    expect(g.devices['web-8']).toBeUndefined();
  });

  it('switching player moves the device; leaving gives the seat up', () => {
    let g = setup(['a', 'b', 'c']);
    g = reduce(g, { type: 'IDENTIFY', dev: 'web-1', profileId: 'a', at: 1 });
    g = reduce(g, { type: 'IDENTIFY', dev: 'web-1', profileId: 'c', at: 2 });
    expect(g.bindings).toEqual([null, null, 'web-1']);
    g = reduce(g, { type: 'IDENTIFY', dev: 'web-1', profileId: null, at: 3 });
    expect(g.bindings).toEqual([null, null, null]);
  });

  it('every game has a code', () => {
    const g = setup(['a']);
    expect(g.code).toBe('TEST');
    expect(createGame(setup(['a']).players, { vpTarget: 10, speaker: 0 }, 0).code).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}$/);
  });
});

describe('the action log', () => {
  const { replay, applyEvent, core: coreOf } = engineModule;
  const six = () => createGame(setup(6), { vpTarget: 10, speaker: 0, code: 'LOGS' }, 1000);

  it('replaying the log lands on the same state as playing it live', () => {
    const base = six();
    const events = [
      { at: 1001, action: { type: 'PICK_CARD', card: 3, at: 1001 } },
      { at: 1002, action: { type: 'PICK_CARD', card: 5, at: 1002 } },
      { at: 1003, action: { type: 'PICK_CARD', card: 1, at: 1003 } },
      { at: 1004, action: { type: 'PICK_CARD', card: 8, at: 1004 } },
      { at: 1005, action: { type: 'PICK_CARD', card: 2, at: 1005 } },
      { at: 1006, action: { type: 'PICK_CARD', card: 6, at: 1006 } },
      { at: 2000, action: { type: 'INPUT', seat: 2, input: 'double', at: 2000 } },
      { at: 3000, action: { type: 'INPUT', seat: 2, input: 'tap', at: 3000 } },
      { at: 3500, action: { type: 'ACK_ALL', at: 3500 } },
      { at: 4000, action: { type: 'END_TURN', at: 4000 } },
    ] as const;
    let live = base;
    events.forEach((e, i) => {
      live = applyEvent(live, e as never, i);
    });
    const again = replay(base, events as never);
    expect(coreOf(again)).toBe(coreOf(live));
    expect(again.players[2].timeMs).toBe(4000 - 1006);
    // Every log line knows which event wrote it.
    expect(again.log.find((l) => l.text.includes('plays 1'))?.event).toBe(6);
    expect(again.log.find((l) => l.text.includes('Round 1'))?.event).toBeUndefined();
  });
});

describe('undo and redo', () => {
  it('redo skips the refused presses that did nothing', () => {
    const store = createGameStore();
    store.start(setup(6), { vpTarget: 10, speaker: 0, code: 'REDO' });
    for (let i = 0; i < 6; i++) store.dispatch(pick(6 - i));
    store.dispatch({ type: 'PLAY_CARD', at: 10 });
    // Holding to end the turn before the primary is done: refused, twice.
    store.dispatch({ type: 'INPUT', seat: 5, input: 'hold', at: 20 });
    store.dispatch({ type: 'INPUT', seat: 5, input: 'hold', at: 30 });
    expect(store.get().events.slice(-2).every((e) => e.noop)).toBe(true);

    store.undo();
    expect(store.get().game?.strategyPlay).toBeNull();
    expect(store.get().future.map((e) => e.action.type)).toEqual(['PLAY_CARD']);
    store.redo();
    expect(store.get().game?.strategyPlay?.card).toBe(1);
    expect(store.get().future).toEqual([]);
  });
});

describe('referee', () => {
  const inAction = () => {
    let g = createGame(setup(6), { vpTarget: 10, speaker: 0, code: 'REFF' }, 0);
    for (const card of [3, 5, 1, 8, 2, 6]) g = reduce(g, { type: 'PICK_CARD', card, at: 1 });
    return g;
  };

  it('hands the turn to anyone, banking the clock of whoever had it', () => {
    let g = inAction();
    expect(g.active).toBe(2);
    g = reduce(g, { type: 'SET_ACTIVE', seat: 4, at: 5000 });
    expect(g.active).toBe(4);
    expect(g.players[2].timeMs).toBe(4999);
    expect(g.log[g.log.length - 1].text).toMatch(/^Referee: the turn goes to /);
    // Someone who had passed is back in when given the turn.
    g = reduce(g, { type: 'SET_PASSED', seat: 0, passed: true, at: 5001 });
    g = reduce(g, { type: 'SET_ACTIVE', seat: 0, at: 5002 });
    expect(g.players[0].passed).toBe(false);
  });

  it('un-passes someone, and passing the active player ends their turn', () => {
    let g = inAction();
    g = reduce(g, { type: 'SET_PASSED', seat: 2, passed: true, at: 100 });
    expect(g.players[2].passed).toBe(true);
    expect(g.active).toBe(4);
    g = reduce(g, { type: 'SET_PASSED', seat: 2, passed: false, at: 101 });
    expect(g.players[2].passed).toBe(false);
    expect(g.active).toBe(4);
  });

  it('cancels a card in play, and marks cards played or not', () => {
    let g = inAction();
    g = reduce(g, { type: 'INPUT', seat: 2, input: 'double', at: 10 });
    expect(g.strategyPlay?.card).toBe(1);
    g = reduce(g, { type: 'CANCEL_PLAY', at: 11 });
    expect(g.strategyPlay).toBeNull();
    expect(g.players[2].usedCards).toEqual([]);
    expect(g.actedThisTurn).toBe(false);
    g = reduce(g, { type: 'SET_CARD_USED', seat: 2, card: 1, used: true });
    expect(g.players[2].usedCards).toEqual([1]);
    g = reduce(g, { type: 'SET_CARD_USED', seat: 2, card: 7, used: true });
    expect(g.players[2].usedCards).toEqual([1]);
  });

  it('jumps phases', () => {
    let g = inAction();
    g = reduce(g, { type: 'GOTO', phase: 'status', at: 50 });
    expect(g.phase).toBe('status');
    expect(g.players[2].timeMs).toBe(49);
    g = reduce(g, { type: 'GOTO', phase: 'agenda', at: 51 });
    expect(g.phase).toBe('agenda');
    g = reduce(g, { type: 'GOTO', phase: 'next-round', at: 52 });
    expect(g.phase).toBe('strategy');
    expect(g.round).toBe(2);
  });
});
