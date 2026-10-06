import { describe, expect, it } from 'vitest';
import { analyzeLog, clock, spoken, type GameLog } from './analyze';
import log from './game-V28W.json';

describe('taking a game log apart', () => {
  const s = analyzeLog(log as unknown as GameLog);
  it('reads the game as it was', () => {
    expect(s.code).toBe('V28W');
    expect(s.names).toEqual(['Branson', 'Jason', 'Garett', 'Devon', 'Cam', 'Alan']);
    expect(s.rounds).toBe(6);
    expect(s.turnCount).toBe(226);
    expect(s.winner).toBeNull();
    expect(clock(s.total)).toBe('12:48:44');
  });
  it('splits the day up without losing any of it', () => {
    const parts = Object.values(s.shares).reduce((a, b) => a + b, 0);
    expect(Math.abs(parts - s.total)).toBeLessThan(1000);
    expect(s.pauses).toHaveLength(6);
    expect(clock(s.shares.paused)).toBe('1:39:13');
    expect(s.plays).toHaveLength(36);
  });
  it('knows who did what', () => {
    const alan = s.players.find((p) => p.name === 'Alan')!;
    expect(alan.turns).toBe(25);
    expect(alan.passedFirst).toBe(3);
    const garett = s.players.find((p) => p.name === 'Garett')!;
    expect(garett.longest).toBeLessThan(5 * 60_000);
    expect(s.refusals.reduce((a, r) => a + r.n, 0)).toBe(157);
    // Grouped by reason across everyone, the biggest is tapping on your own turn.
    const byWhy = new Map<string, number>();
    for (const r of s.refusals) byWhy.set(r.why, (byWhy.get(r.why) ?? 0) + r.n);
    expect([...byWhy.entries()].sort((a, b) => b[1] - a[1])[0][0]).toContain('own turn');
  });
  it('speaks time plainly', () => {
    expect(spoken(46_140_000)).toBe('12 h 49 m');
    expect(spoken(23 * 60_000)).toBe('23 min');
    expect(clock(0)).toBe('0:00');
  });
});
