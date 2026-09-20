export type Phase = 'strategy' | 'action' | 'status' | 'agenda' | 'finished';

/**
 * What a physical device can tell us, after the hardware layer has mapped raw
 * button indexes and gestures to meaning:
 *  - tap      main button, short press  → acknowledge / ready / done
 *  - double   main button, two quick taps → I'm playing my strategy card
 *  - hold     main button, held to full → end my turn
 *  - strategy optional aux button       → same as double
 *  - pass     optional aux button       → I pass
 */
export type DeviceInput = 'tap' | 'double' | 'hold' | 'strategy' | 'pass';

/** A sound reference: a built-in jingle or a clip the player uploaded. */
export type SoundRef =
  | { kind: 'none' }
  | { kind: 'jingle'; id: string }
  | { kind: 'clip'; id: string; name: string };

export interface PlayerSetup {
  name: string;
  faction: string;
  color: string;
  intro: SoundRef;
  outro: SoundRef;
  /** How many physical buttons this player's device has (1 or 3 today). */
  buttons: number;
}

export interface Player extends PlayerSetup {
  vp: number;
  cards: number[];
  usedCards: number[];
  passed: boolean;
  timeMs: number;
  turns: number;
}

export interface StrategyPlay {
  card: number;
  by: number;
  at: number;
  /** 'primary': only the player who played it is busy. 'secondary': everyone else responds. */
  stage: 'primary' | 'secondary';
  /** One entry per seat; the player who played it is pre-acknowledged. */
  acks: boolean[];
}

export interface AgendaState {
  n: 1 | 2;
  order: number[];
  idx: number;
}

export type FxKind =
  | 'claim'
  | 'turnStart'
  | 'turnEnd'
  | 'card'
  | 'alert'
  | 'ack'
  | 'allAcked'
  | 'denied'
  | 'hint'
  | 'pass'
  | 'pick'
  | 'ready'
  | 'phase'
  | 'win';

/** One-shot effects (sounds, shockwaves). State says what is; fx say what just happened. */
export interface Fx {
  id: number;
  kind: FxKind;
  seat?: number;
  card?: number;
  note?: string;
}

export interface LogEntry {
  id: number;
  round: number;
  text: string;
  seat?: number;
  card?: number;
  tone?: 'info' | 'good' | 'warn';
}

export interface GameState {
  phase: Phase;
  round: number;
  vpTarget: number;
  players: Player[];
  speaker: number;
  /** Seat holding the Naalu "0" initiative token, if any. */
  zeroToken: number | null;
  custodiansRemoved: boolean;
  /** Strategy cards run in two beats: the player's primary first, then everyone's secondary. */
  primaryStage: boolean;

  // Strategy phase
  pickOrder: number[];
  pickIdx: number;
  tradeGoods: number[]; // index = card number - 1

  // Action phase
  active: number | null;
  actedThisTurn: boolean;
  strategyPlay: StrategyPlay | null;
  /** Active player holds several unused cards and must say which one. */
  choosingCard: boolean;

  // Status phase
  ready: boolean[];

  // Agenda phase
  agenda: AgendaState | null;

  winner: number | null;

  /**
   * Which physical device sits at each seat (index = seat). Simulated buttons
   * are "sim-0", "sim-1"…; real ones use their hardware id.
   */
  bindings: (string | null)[];
  /** Seat claiming in progress: players press their buttons in seat order. */
  seating: { next: number; resume: boolean } | null;

  // Turn clock
  clockStartedAt: number | null;
  clockBanked: number;
  paused: boolean;

  fx: Fx[];
  fxSeq: number;
  log: LogEntry[];
  logSeq: number;
}

export type Action =
  | { type: 'INPUT'; seat: number; input: DeviceInput; at: number }
  | { type: 'DEVICE_INPUT'; dev: string; input: DeviceInput; at: number }
  | { type: 'START_SEATING'; at: number }
  | { type: 'SKIP_SEATING'; devices: string[]; at: number }
  | { type: 'PICK_CARD'; card: number; at: number }
  | { type: 'END_TURN'; at: number }
  | { type: 'PLAY_CARD'; card?: number; at: number }
  | { type: 'CANCEL_CHOICE' }
  | { type: 'PASS'; at: number }
  | { type: 'PRIMARY_DONE'; at: number }
  | { type: 'SET_PRIMARY_STAGE'; on: boolean }
  | { type: 'ACK'; seat: number; at: number }
  | { type: 'ACK_ALL'; at: number }
  | { type: 'READY'; seat: number; at: number }
  | { type: 'READY_ALL'; at: number }
  | { type: 'VOTE_DONE'; at: number }
  | { type: 'ADVANCE'; at: number }
  | { type: 'VP'; seat: number; delta: number; at: number }
  | { type: 'SET_SPEAKER'; seat: number }
  | { type: 'SET_ZERO_TOKEN'; seat: number | null }
  | { type: 'SET_CUSTODIANS'; removed: boolean }
  | { type: 'PAUSE'; at: number }
  | { type: 'RESUME'; at: number };

export interface GameOptions {
  vpTarget: number;
  speaker: number;
  primaryStage?: boolean;
  /** Begin with the seat-claiming ritual instead of pre-assigned simulated buttons. */
  seating?: boolean;
}
