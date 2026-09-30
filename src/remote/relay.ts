import type { Action } from '../engine/types';

/**
 * A phone can run the table as well as press its button: scoring, objectives, laws, the referee's levers, moving a
 * phase on, undo and rewind. It asks through the inbox; the host does the doing. What it may ask for is listed here
 * by name. Not on the list: presses (they have their own message), who a device is, seat claiming, and the table's
 * settings.
 */
export const PHONE_ACTIONS = new Set<Action['type']>([
  'PICK_CARD', 'END_TURN', 'PLAY_CARD', 'CANCEL_CHOICE', 'PASS', 'PRIMARY_DONE', 'ACK', 'ACK_ALL', 'READY', 'READY_ALL',
  'VOTE_DONE', 'ADVANCE', 'VP', 'REVEAL_OBJECTIVE', 'REMOVE_OBJECTIVE', 'SCORE_OBJECTIVE', 'SCORE_SECRET', 'UNSCORE_SECRET',
  'ADD_EXTRA', 'REMOVE_EXTRA', 'ADD_LAW', 'REMOVE_LAW', 'SET_SPEAKER', 'SET_ZERO_TOKEN', 'SET_CUSTODIANS', 'PAUSE', 'RESUME',
  'SET_ACTIVE', 'SET_PASSED', 'CANCEL_PLAY', 'SET_CARD_USED', 'GOTO', 'SCORED', 'SKIP_SCORING', 'FANFARE_DONE',
]);

export type PhoneRequest = { type: 'action'; action: Action } | { type: 'undo' } | { type: 'redo' } | { type: 'rewind'; index: number };

/** An action as a phone sent it, or null if it isn't one a phone may send. Its time is the host's, not the phone's. */
export function phoneAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.type !== 'string' || !PHONE_ACTIONS.has(a.type as Action['type'])) return null;
  if (JSON.stringify(raw).length > 2000) return null;
  return ('at' in a ? { ...a, at: Date.now() } : a) as Action;
}
