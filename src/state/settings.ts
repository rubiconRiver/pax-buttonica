import { DEFAULT_FANFARE_MS } from '../engine/engine';
import { DEFAULT_LEVELS, type TurnEffect, type TurnLook } from '../engine/outputs';
import { createStore } from './createStore';

/** What the player whose turn it is to score gets, besides their light: the turn-start ring and their entrance music, a chime, or nothing. */
export type ScoringCue = 'turn' | 'chime' | 'quiet';
export const SCORING_CUES: { id: ScoringCue; name: string; hint: string }[] = [
  { id: 'turn', name: 'Ring in', hint: 'Like a turn: the ring, and their entrance music' },
  { id: 'chime', name: 'Chime', hint: 'A short chime' },
  { id: 'quiet', name: 'Light only', hint: 'Just their button' },
];

/** How the big screen lays the players out: in the order they act, or where they sit round the table. */
export type Layout = 'order' | 'table';
export const LAYOUTS: { id: Layout; name: string; hint: string }[] = [
  { id: 'order', name: 'Turn order', hint: 'A row, in the order they act; the table already shows where everyone sits' },
  { id: 'table', name: 'Seating', hint: 'Round a hexagonal table, where they sit' },
];

export interface Settings {
  /** How long the main button must be held to end a turn. */
  holdMs: number;
  /** Full on-off cycle of the strategy-card blink. */
  flashMs: number;
  sound: boolean;
  volume: number;
  /** Uploaded clips are cut off (with a fade) after this many seconds. */
  clipMaxSec: number;
  /** Show the little caption under each button explaining its light. */
  explainLights: boolean;
  /** Strategy cards: the owner's button blinks for the primary before everyone else is called. */
  primaryStage: boolean;
  /** Put the scoreboard up by itself whenever the status phase begins. */
  autoScoreboard: boolean;
  /** How "your move" is drawn on every button that hasn't chosen for itself. */
  turnLight: TurnLook;
  /** What a button does the moment its turn starts, unless its player chose for themselves. */
  turnFx: TurnEffect;
  /** Real buttons: how bright "your move" and every steady light is, a share of their full output, 0.1–1… */
  brightness: number;
  /** …how bright waiting (`dim`) is… */
  waitingBrightness: number;
  /** …and the one-shots: effects, the press, the hold. The screen and phones follow the last two in proportion (`screenLevels`). */
  effectsBrightness: number;
  /** Players laid out in the order they act, or where they sit. */
  layout: Layout;
  /** Status phase: how long every light celebrates the end of the round (0 = not at all)… */
  fanfareMs: number;
  /** …whether scoring goes round in initiative order, one player at a time… */
  scoreInOrder: boolean;
  /** …and what the player whose turn it is to score gets, besides their light. */
  scoringCue: ScoringCue;
}

export const DEFAULT_SETTINGS: Settings = {
  holdMs: 900,
  flashMs: 2000,
  sound: true,
  volume: 0.8,
  clipMaxSec: 6,
  explainLights: true,
  primaryStage: true,
  autoScoreboard: true,
  turnLight: 'solid',
  turnFx: 'ring',
  brightness: DEFAULT_LEVELS.turn,
  waitingBrightness: DEFAULT_LEVELS.waiting,
  effectsBrightness: DEFAULT_LEVELS.effects,
  layout: 'order',
  fanfareMs: DEFAULT_FANFARE_MS,
  scoreInOrder: true,
  scoringCue: 'turn',
};

const KEY = 'pb.settings.v2';

/**
 * Settings are saved whole the first time anything is touched, so a changed default never reached a laptop that had
 * saved them. v1 → v2 (2026-09-29): the hold went from 2 s to 0.9 s and brightness from 100 % to 50 %. Where a v1
 * still has the old default, nobody chose it: it moves to the new one. Anything set by hand stays.
 */
function migrate() {
  try {
    if (localStorage.getItem(KEY) != null) return;
    const raw = localStorage.getItem('pb.settings.v1');
    if (!raw) return;
    const old = JSON.parse(raw) as Partial<Settings>;
    if (old.holdMs === 2000) delete old.holdMs;
    if (old.brightness === 1) delete old.brightness;
    localStorage.setItem(KEY, JSON.stringify(old));
    localStorage.removeItem('pb.settings.v1');
  } catch {
    // Private mode or corrupt data: the defaults will do.
  }
}

migrate();
export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS, KEY);
