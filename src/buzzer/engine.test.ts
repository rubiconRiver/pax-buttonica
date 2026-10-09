import { describe, expect, it } from 'vitest';
import { EARLY_LOCK_MS, HOST_COLOR, fromSaved, initialState, outputs, reduce, toSaved, winnerOf, type Action, type BuzzerState } from './engine';

const H = 'host';
const A = 'aaa';
const B = 'bbb';
const C = 'ccc';

const run = (actions: Action[], from = initialState()) => actions.reduce(reduce, from);
/** Everyone claimed, floor closed. */
const table = () => run([{ type: 'PRESS', dev: H, at: 0 }, { type: 'PRESS', dev: A, at: 1 }, { type: 'PRESS', dev: B, at: 2 }, { type: 'PRESS', dev: C, at: 3 }]);
const light = (s: BuzzerState, dev: string, now = 0) => outputs(s, [H, A, B, C], now).get(dev);

describe('claiming', () => {
  it('the first button pressed is the host, the next ones are players in colour order', () => {
    const s = table();
    expect(s.host).toBe(H);
    expect(s.players.map((p) => [p.dev, p.name])).toEqual([[A, 'Red'], [B, 'Orange'], [C, 'Yellow']]);
    expect(s.event).toEqual({ kind: 'claimed', dev: C, role: 'player' });
  });
  it('nobody joins mid-question, and a claimed button is not claimed twice', () => {
    let s = run([{ type: 'OPEN', at: 10 }], table());
    s = reduce(s, { type: 'PRESS', dev: 'new', at: 11 });
    expect(s.players).toHaveLength(3);
    expect(s.phase).toBe('open');
    s = reduce(s, { type: 'ADD_PLAYER', dev: A });
    expect(s.players).toHaveLength(3);
  });
  it('the host can be moved, and a player made host leaves the players', () => {
    const s = reduce(table(), { type: 'SET_HOST', dev: A });
    expect(s.host).toBe(A);
    expect(s.players.map((p) => p.dev)).toEqual([B, C]);
  });
  it('a button nobody has claimed breathes white while the floor is closed, and is dark during a question', () => {
    const s = reduce(initialState(), { type: 'PRESS', dev: H, at: 0 });
    expect(light(s, A)).toEqual({ color: '#ffffff', mode: 'pulse' });
    expect(light(reduce(s, { type: 'OPEN', at: 1 }), A)).toEqual({ color: '#000000', mode: 'off' });
  });
});

describe('a question', () => {
  it('the first press after the floor opens wins; later ones are late and keep their order', () => {
    let s = run([{ type: 'OPEN', at: 1000 }], table());
    expect(s.event).toEqual({ kind: 'opened' });
    s = reduce(s, { type: 'PRESS', dev: B, at: 1212 });
    expect(s.phase).toBe('won');
    expect(winnerOf(s)?.dev).toBe(B);
    expect(s.event).toEqual({ kind: 'buzz', dev: B, after: 212 });
    s = reduce(s, { type: 'PRESS', dev: A, at: 1218 });
    expect(s.event).toEqual({ kind: 'late', dev: A, after: 218 });
    s = reduce(s, { type: 'PRESS', dev: B, at: 1300 });
    expect(s.presses, 'a second press from the same button counts for nothing').toEqual([{ dev: B, after: 212 }, { dev: A, after: 218 }]);
  });
  it('a press before the floor opens is early: locked out for a second, even once the floor opens', () => {
    let s = reduce(table(), { type: 'PRESS', dev: A, at: 500 });
    expect(s.event).toEqual({ kind: 'early', dev: A });
    expect(light(s, A, 600)).toEqual({ color: s.players[0].color, mode: 'off' });
    expect(light(s, A, 500 + EARLY_LOCK_MS)).toEqual({ color: s.players[0].color, mode: 'dim' });
    s = reduce(s, { type: 'OPEN', at: 900 });
    s = reduce(s, { type: 'PRESS', dev: A, at: 1100 });
    expect(s.phase).toBe('open');
    s = reduce(s, { type: 'PRESS', dev: A, at: 1600 });
    expect(winnerOf(s)?.dev).toBe(A);
  });
  it('right: the winner scores the value and the floor closes', () => {
    let s = run([{ type: 'SET_VALUE', value: 400 }, { type: 'OPEN', at: 0 }, { type: 'PRESS', dev: C, at: 50 }], table());
    s = reduce(s, { type: 'CORRECT' });
    expect(s.phase).toBe('closed');
    expect(s.players.map((p) => p.score)).toEqual([0, 0, 400]);
    expect(s.question).toBe(1);
    expect(s.event).toEqual({ kind: 'correct', dev: C, value: 400 });
  });
  it('wrong: the winner loses the value, sits the question out, and the floor reopens for the rest', () => {
    let s = run([{ type: 'OPEN', at: 0 }, { type: 'PRESS', dev: C, at: 50 }], table());
    s = reduce(s, { type: 'WRONG', at: 3000 });
    expect(s.phase).toBe('open');
    expect(s.openedAt).toBe(3000);
    expect(s.players[2].score).toBe(-200);
    expect(s.out).toEqual([C]);
    expect(s.event).toEqual({ kind: 'wrong', dev: C, value: 200, reopened: true });
    expect(light(s, C)).toEqual({ color: s.players[2].color, mode: 'off' });
    // C's button is dead for this question; A takes it.
    s = reduce(s, { type: 'PRESS', dev: C, at: 3100 });
    expect(s.phase).toBe('open');
    s = reduce(s, { type: 'PRESS', dev: A, at: 3200 });
    expect(winnerOf(s)?.dev).toBe(A);
    s = reduce(s, { type: 'CORRECT' });
    expect(s.out).toEqual([]);
    expect(s.players.map((p) => p.score)).toEqual([200, 0, -200]);
  });
  it('when everyone has been wrong the question is over', () => {
    let s = run([{ type: 'OPEN', at: 0 }, { type: 'PRESS', dev: A, at: 1 }, { type: 'WRONG', at: 2 }, { type: 'PRESS', dev: B, at: 3 }, { type: 'WRONG', at: 4 }, { type: 'PRESS', dev: C, at: 5 }], table());
    s = reduce(s, { type: 'WRONG', at: 6 });
    expect(s.phase).toBe('closed');
    expect(s.out).toEqual([]);
    expect(s.question).toBe(1);
    expect(s.event).toMatchObject({ kind: 'wrong', dev: C, reopened: false });
  });
  it('next question: closed, lockouts cleared, the question counted if it was won', () => {
    let s = run([{ type: 'PRESS', dev: A, at: 0 }, { type: 'OPEN', at: 1 }, { type: 'PRESS', dev: B, at: 2 }, { type: 'WRONG', at: 3 }, { type: 'PRESS', dev: C, at: 4 }], table());
    s = reduce(s, { type: 'NEXT' });
    expect(s).toMatchObject({ phase: 'closed', out: [], early: {}, presses: [], question: 1 });
    expect(reduce(s, { type: 'NEXT' }).question).toBe(1);
  });
  it("the host's button: tap opens, tap again closes, and a tap while someone has the floor does nothing", () => {
    let s = reduce(table(), { type: 'PRESS', dev: H, at: 0 });
    expect(s.phase).toBe('open');
    s = reduce(s, { type: 'PRESS', dev: H, at: 1 });
    expect(s.phase).toBe('closed');
    expect(s.event).toEqual({ kind: 'closed' });
    s = run([{ type: 'HOST_TAP', at: 2 }, { type: 'PRESS', dev: A, at: 3 }, { type: 'HOST_TAP', at: 4 }], s);
    expect(s.phase).toBe('won');
  });
});

describe('lights', () => {
  it('closed: players dim, host dim white; open: players breathing, host solid white; won: the winner solid, the rest dim, the host in the winner colour', () => {
    let s = table();
    expect(light(s, A)).toEqual({ color: s.players[0].color, mode: 'dim' });
    expect(light(s, H)).toEqual({ color: HOST_COLOR, mode: 'dim' });
    s = reduce(s, { type: 'OPEN', at: 0 });
    expect(light(s, A)).toEqual({ color: s.players[0].color, mode: 'pulse' });
    expect(light(s, H)).toEqual({ color: HOST_COLOR, mode: 'solid' });
    s = reduce(s, { type: 'PRESS', dev: B, at: 1 });
    expect(light(s, B)).toEqual({ color: s.players[1].color, mode: 'solid' });
    expect(light(s, A)).toEqual({ color: s.players[0].color, mode: 'dim' });
    expect(light(s, H)).toEqual({ color: s.players[1].color, mode: 'solid' });
  });
});

describe('scores and saving', () => {
  it('manual scoring, renaming, resetting', () => {
    let s = run([{ type: 'SCORE', dev: A, delta: 100 }, { type: 'SCORE', dev: A, delta: -300 }, { type: 'RENAME', dev: B, name: 'Ben' }], table());
    expect(s.players[0].score).toBe(-200);
    expect(s.players[1].name).toBe('Ben');
    s = reduce(s, { type: 'RESET_SCORES' });
    expect(s.players.every((p) => p.score === 0)).toBe(true);
  });
  it('what is saved comes back, and rubbish does not', () => {
    const s = run([{ type: 'SET_VALUE', value: 500 }, { type: 'SCORE', dev: A, delta: 500 }], table());
    const back = fromSaved(JSON.parse(JSON.stringify(toSaved(s))));
    expect(back.players).toEqual(s.players);
    expect(back.host).toBe(H);
    expect(back.value).toBe(500);
    expect(back.phase).toBe('closed');
    expect(fromSaved({ players: [{ dev: 1 }, null, { dev: 'x', score: 'lots' }] as never, value: 7 as never })).toMatchObject({ players: [{ dev: 'x', score: 0 }], value: 200 });
    expect(fromSaved(null)).toEqual(initialState());
  });
});
