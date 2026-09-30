import { describe, expect, it } from 'vitest';
import { phoneAction } from './relay';

describe('what a phone may ask the host to do', () => {
  it('passes the table\'s controls through, stamped with the host\'s time', () => {
    const a = phoneAction({ type: 'SCORE_OBJECTIVE', id: 'o1', seat: 2, scored: true, at: 5 });
    expect(a).toMatchObject({ type: 'SCORE_OBJECTIVE', id: 'o1', seat: 2, scored: true });
    expect((a as { at: number }).at).toBeGreaterThan(5);
    expect(phoneAction({ type: 'SET_SPEAKER', seat: 1 })).toEqual({ type: 'SET_SPEAKER', seat: 1 });
  });
  it('refuses presses, identities, seating and settings, and junk', () => {
    for (const type of ['INPUT', 'DEVICE_INPUT', 'IDENTIFY', 'BIND', 'START_SEATING', 'SKIP_SEATING', 'SET_STATUS_FLOW', 'SET_PRIMARY_STAGE', 'UPDATE_PLAYER', 'NOPE']) {
      expect(phoneAction({ type, seat: 0, at: 0 })).toBeNull();
    }
    expect(phoneAction(null)).toBeNull();
    expect(phoneAction('VP')).toBeNull();
    expect(phoneAction({ type: 'ADD_LAW', name: 'x'.repeat(5000), note: '' })).toBeNull();
  });
});
