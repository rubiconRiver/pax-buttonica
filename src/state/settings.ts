import type { TurnLook } from '../engine/outputs';
import { createStore } from './createStore';

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
  /** Real buttons only: a share of their full brightness, 0.1–1. */
  brightness: number;
}

export const DEFAULT_SETTINGS: Settings = {
  holdMs: 2000,
  flashMs: 2000,
  sound: true,
  volume: 0.8,
  clipMaxSec: 6,
  explainLights: true,
  primaryStage: true,
  autoScoreboard: true,
  turnLight: 'solid',
  brightness: 1,
};

export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS, 'pb.settings.v1');
