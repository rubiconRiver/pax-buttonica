import { describe, expect, it } from 'vitest';
import { SECRET_DECK } from '../../api/_secretsDeck';
import { Refusal, apply, createDraft, deckFor, keyOf, parseKey, view, whoIs, type AdminView, type Draft, type Env, type PlayerView, type RevealView } from '../../api/_secretsDraft';

/** A fair-enough die and tokens that never repeat, the same every run. */
function testEnv(seed = 7): Env {
  let x = seed;
  let n = 0;
  const next = () => (x = (x * 1103515245 + 12345) & 0x7fffffff);
  return {
    now: 1_000,
    int: (k) => next() % k,
    token: (length) => (n++).toString(36).padStart(4, '0').repeat(8).slice(0, length),
  };
}

const SIX = ['Garett', 'Alan', 'Branson', 'Cam', 'Devon', 'Jason'];
const names = (cards: { name: string }[]) => cards.map((c) => c.name);
const everyCardName = SECRET_DECK.map((c) => c.name);
const mentionsACard = (v: unknown) => everyCardName.some((n) => JSON.stringify(v).includes(n));

function deal(env = testEnv()): Draft {
  return createDraft({ names: SIX, title: 'Game night' }, env);
}
const asPlayer = (d: Draft, seat: number) => whoIs(d, d.seats[seat].token)!;
const admin = (d: Draft) => whoIs(d, d.adminToken)!;
const puller = (d: Draft) => whoIs(d, d.revealToken)!;

describe('the deck', () => {
  it('has forty cards, each with a title and a description, no two alike', () => {
    expect(SECRET_DECK).toHaveLength(40);
    expect(new Set(everyCardName).size).toBe(40);
    for (const c of SECRET_DECK) {
      expect(c.name.length).toBeGreaterThan(3);
      expect(c.text.length).toBeGreaterThan(10);
    }
    expect(deckFor(false)).toHaveLength(20);
  });
});

describe('dealing', () => {
  it('gives everyone two cards and nobody a card somebody else has', () => {
    for (let seed = 1; seed < 40; seed++) {
      const d = deal(testEnv(seed));
      const all = d.seats.flatMap((s) => names(s.options));
      expect(all).toHaveLength(12);
      expect(new Set(all).size).toBe(12);
    }
  });
  it('deals differently with different dice', () => {
    const hands = new Set(Array.from({ length: 20 }, (_, i) => names(deal(testEnv(i + 1)).seats[0].options).join('|')));
    expect(hands.size).toBeGreaterThan(10);
  });
  it('refuses a table it cannot seat', () => {
    expect(() => createDraft({ names: ['Solo'] }, testEnv())).toThrow(/at least 2/);
    expect(() => createDraft({ names: Array.from({ length: 9 }, (_, i) => `P${i}`) }, testEnv())).toThrow(/No more than 8/);
    expect(() => createDraft({ names: ['Sam', ' sam '] }, testEnv())).toThrow(/Two players are called/);
    expect(() => createDraft({}, testEnv())).toThrow(Refusal);
  });
  it('tidies names and skips blank lines', () => {
    const d = createDraft({ names: ['  Garett ', '', 'Al   an'] }, testEnv());
    expect(d.seats.map((s) => s.name)).toEqual(['Garett', 'Al an']);
  });
});

describe('links', () => {
  it('say who is asking', () => {
    const d = deal();
    expect(parseKey(keyOf(d, d.adminToken))).toEqual({ id: d.id, token: d.adminToken });
    expect(whoIs(d, d.adminToken)).toEqual({ role: 'admin' });
    expect(whoIs(d, d.revealToken)).toEqual({ role: 'reveal' });
    expect(whoIs(d, d.seats[3].token)).toEqual({ role: 'player', seat: 3 });
    expect(whoIs(d, 'nonsense')).toBeNull();
    expect(parseKey('nope')).toBeNull();
    expect(parseKey(undefined)).toBeNull();
  });
});

describe('the dashboard', () => {
  it('never holds a card, whatever has happened', () => {
    let d = deal();
    expect(mentionsACard(view(d, admin(d), 'device-admin'))).toBe(false);
    d = apply(d, asPlayer(d, 1), { op: 'open' }, 'device-alan', testEnv());
    d = apply(d, asPlayer(d, 1), { op: 'pick', card: d.seats[1].options[0].id }, 'device-alan', testEnv());
    d = apply(d, puller(d), { op: 'reveal' }, 'device-puller', testEnv());
    d = apply(d, admin(d), { op: 'redeal', seat: 2 }, undefined, testEnv());
    const v = view(d, admin(d), 'device-admin') as AdminView;
    expect(mentionsACard(v)).toBe(false);
    expect(v.seats.map((s) => s.state)).toEqual(['sealed', 'picked', 'sealed', 'sealed', 'sealed', 'sealed']);
    expect(v.seats[2].redeals).toBe(1);
    expect(v.reveal.at).toBe(1_000);
  });
  it('cannot open, pick or reveal with its own link', () => {
    const d = deal();
    expect(() => apply(d, admin(d), { op: 'open' }, 'device-admin', testEnv())).toThrow(/player's own link/);
    expect(() => apply(d, admin(d), { op: 'pick', card: d.seats[0].options[0].id }, 'device-admin', testEnv())).toThrow(/player's own link/);
    expect(() => apply(d, admin(d), { op: 'reveal' }, 'device-admin', testEnv())).toThrow(/card puller/);
  });
});

describe("a player's link", () => {
  it('shows nothing until opened, then only to the device that opened it', () => {
    let d = deal();
    const me = asPlayer(d, 0);
    expect(view(d, me, 'device-one')).toEqual({ role: 'player', title: 'Game night', name: 'Garett', state: 'sealed' });
    d = apply(d, me, { op: 'open' }, 'device-one', testEnv());
    const mine = view(d, me, 'device-one') as PlayerView;
    expect(mine.state).toBe('choosing');
    expect(mine.options).toHaveLength(2);
    const other = view(d, me, 'device-two');
    expect(other).toEqual({ role: 'player', title: 'Game night', name: 'Garett', state: 'elsewhere' });
    expect(() => apply(d, me, { op: 'open' }, 'device-two', testEnv())).toThrow(/another device/);
    expect(() => apply(d, me, { op: 'pick', card: mine.options![0].id }, 'device-two', testEnv())).toThrow(Refusal);
  });
  it('keeps one of its two cards, once', () => {
    let d = deal();
    const me = asPlayer(d, 4);
    d = apply(d, me, { op: 'open' }, 'device-devon', testEnv());
    const [a, b] = d.seats[4].options;
    expect(() => apply(d, me, { op: 'pick', card: d.seats[0].options[0].id }, 'device-devon', testEnv())).toThrow(/not one of your two/);
    d = apply(d, me, { op: 'pick', card: b.id }, 'device-devon', testEnv());
    expect((view(d, me, 'device-devon') as PlayerView).pick).toBe(b.id);
    expect(() => apply(d, me, { op: 'pick', card: a.id }, 'device-devon', testEnv())).toThrow(/already chosen/);
    // Saying the same thing twice (a double tap, a retry) is not an error.
    expect(apply(d, me, { op: 'pick', card: b.id }, 'device-devon', testEnv()).seats[4].pick).toBe(b.id);
  });
  it('needs a device', () => {
    const d = deal();
    expect(() => apply(d, asPlayer(d, 0), { op: 'open' }, undefined, testEnv())).toThrow(/which device/);
    expect(() => apply(d, asPlayer(d, 0), { op: 'open' }, 'x', testEnv())).toThrow(/which device/);
  });
});

describe('dealing again', () => {
  it('swaps the link and both cards, for fresh ones nobody holds', () => {
    let d = deal();
    const before = d.seats[2];
    d = apply(d, asPlayer(d, 2), { op: 'open' }, 'device-peeker', testEnv());
    d = apply(d, admin(d), { op: 'redeal', seat: 2 }, undefined, testEnv(3));
    const after = d.seats[2];
    expect(after.token).not.toBe(before.token);
    expect(after.device).toBeNull();
    expect(after.pick).toBeNull();
    const fresh = names(after.options);
    expect(fresh.some((n) => names(before.options).includes(n))).toBe(false);
    const everyoneElse = d.seats.filter((_, i) => i !== 2).flatMap((s) => names(s.options));
    expect(fresh.some((n) => everyoneElse.includes(n))).toBe(false);
    // The old link knows it is dead, and whose it was; it shows no card and does nothing.
    const old = whoIs(d, before.token)!;
    expect(old).toEqual({ role: 'replaced', seat: 2 });
    expect(view(d, old, 'device-peeker')).toEqual({ role: 'player', title: 'Game night', name: 'Branson', state: 'replaced' });
    expect(() => apply(d, old, { op: 'open' }, 'device-peeker', testEnv())).toThrow(/replaced/);
  });
  it("is the dashboard's alone", () => {
    const d = deal();
    expect(() => apply(d, asPlayer(d, 0), { op: 'redeal', seat: 1 }, 'device-one', testEnv())).toThrow(/Only the dashboard/);
    expect(() => apply(d, admin(d), { op: 'redeal', seat: 9 }, undefined, testEnv())).toThrow(/No such player/);
  });
});

describe("the card puller's link", () => {
  it('shows who has picked, and the cards only once revealed, to the device that revealed', () => {
    let d = deal();
    d = apply(d, asPlayer(d, 5), { op: 'open' }, 'device-jason', testEnv());
    d = apply(d, asPlayer(d, 5), { op: 'pick', card: d.seats[5].options[1].id }, 'device-jason', testEnv());
    const gate = view(d, puller(d), 'device-puller') as RevealView;
    expect(gate.state).toBe('sealed');
    expect(mentionsACard(gate)).toBe(false);
    expect(gate.seats.filter((s) => s.state === 'picked').map((s) => s.name)).toEqual(['Jason']);

    d = apply(d, puller(d), { op: 'reveal' }, 'device-puller', { ...testEnv(), now: 5_000 });
    const open = view(d, puller(d), 'device-puller') as RevealView;
    expect(open.state).toBe('open');
    expect(open.at).toBe(5_000);
    expect(open.seats[5].card?.name).toBe(d.seats[5].options[1].name);
    // Only what was kept: not the card that went back, and nothing for those still choosing.
    expect(JSON.stringify(open)).not.toContain(d.seats[5].options[0].name);
    expect(open.seats.slice(0, 5).every((s) => !s.card)).toBe(true);

    const snoop = view(d, puller(d), 'device-admin') as RevealView;
    expect(snoop.state).toBe('elsewhere');
    expect(mentionsACard(snoop)).toBe(false);
    expect(() => apply(d, puller(d), { op: 'reveal' }, 'device-admin', testEnv())).toThrow(/already been revealed/);
    // Revealing again from the same device changes nothing, the time least of all.
    expect(apply(d, puller(d), { op: 'reveal' }, 'device-puller', { ...testEnv(), now: 9_000 }).reveal.at).toBe(5_000);
  });
  it('sees picks made after the reveal', () => {
    let d = deal();
    d = apply(d, puller(d), { op: 'reveal' }, 'device-puller', testEnv());
    d = apply(d, asPlayer(d, 0), { op: 'open' }, 'device-garett', testEnv());
    d = apply(d, asPlayer(d, 0), { op: 'pick', card: d.seats[0].options[0].id }, 'device-garett', testEnv());
    expect((view(d, puller(d), 'device-puller') as RevealView).seats[0].card?.id).toBe(d.seats[0].options[0].id);
  });
});
