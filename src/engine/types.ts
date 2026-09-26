export type Phase = 'strategy' | 'action' | 'status' | 'agenda' | 'finished';

/** The status phase in order: every light celebrates the round's end, then scoring goes round, then everyone tidies up and taps in. */
export type StatusStep = 'fanfare' | 'scoring' | 'tidy';

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
  /** The saved profile this player came from, so edits to it reach the game in progress. */
  profileId?: string;
}

/** A public objective on the table, and who has scored it. */
export interface Objective {
  id: string;
  /** 1 or 2 for the printed stages; 0 for something the table added itself. */
  stage: 0 | 1 | 2;
  name: string;
  text: string;
  points: number;
  scoredBy: number[];
  round: number;
}

export interface Law {
  id: string;
  name: string;
  /** What it does, or who/what was elected: whatever the table wants to be reminded of. */
  note: string;
}

export interface ExtraPoints {
  label: string;
  points: number;
}

export interface Player extends PlayerSetup {
  /** Always the sum of scored objectives, secrets and extras; never edited directly. */
  vp: number;
  /** Secret objectives this player has scored (their names, if the table bothered). */
  secrets: string[];
  /** Custodians, Imperial, Support for the Throne, agendas… and manual corrections. */
  extras: ExtraPoints[];
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
  /** It's this seat's turn to score. */
  | 'score'
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
  /** Which event (index in the game's action log) wrote this line, so the table can rewind to just before it. */
  event?: number;
}

export interface GameState {
  /** Four letters, read aloud across the table. The game's name on the site. */
  code: string;
  phase: Phase;
  round: number;
  vpTarget: number;
  players: Player[];
  speaker: number;
  /** Seat holding the Naalu "0" initiative token, if any. */
  zeroToken: number | null;
  custodiansRemoved: boolean;
  objectives: Objective[];
  laws: Law[];
  idSeq: number;
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

  // Status phase, in three steps: a moment's celebration, scoring one player at a time, then the tidy-up ready check.
  statusStep: StatusStep;
  /** Who scores, in initiative order, and how far along the scoring is. Empty when the table scores all at once. */
  scoringOrder: number[];
  scoringIdx: number;
  ready: boolean[];
  /** How the table likes its status phase (from the host's settings): how long everyone's lights celebrate (0 = not at all)… */
  fanfareMs: number;
  /** …and whether scoring goes round in initiative order, one player at a time. */
  scoreInOrder: boolean;

  // Agenda phase
  agenda: AgendaState | null;

  winner: number | null;

  /**
   * Which physical device sits at each seat (index = seat). Simulated buttons
   * are "sim-0", "sim-1"…; real ones use their hardware id.
   */
  bindings: (string | null)[];
  /**
   * Who each device's owner has said they are (a profile id), or null for "nobody in particular".
   * A device the game has never heard from has no entry, which is how a phone knows to ask.
   */
  devices: Record<string, string | null>;
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
  /** A device's owner says who they are. If that person is at the table, the device becomes their button. */
  | { type: 'IDENTIFY'; dev: string; profileId: string | null; at: number }
  | { type: 'DEVICE_INPUT'; dev: string; input: DeviceInput; at: number }
  | { type: 'START_SEATING'; at: number }
  | { type: 'BIND'; seat: number; dev: string; at: number }
  | { type: 'UPDATE_PLAYER'; seat: number; patch: Partial<Pick<PlayerSetup, 'name' | 'intro' | 'outro'>> }
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
  /** The host's timer: the celebration is over, on to scoring (or tidying up). */
  | { type: 'FANFARE_DONE'; at: number }
  /** The player whose turn it is to score is done. */
  | { type: 'SCORED'; seat: number; at: number }
  /** Straight to the tidy-up, whoever hasn't scored yet. */
  | { type: 'SKIP_SCORING'; at: number }
  | { type: 'SET_STATUS_FLOW'; fanfareMs: number; scoreInOrder: boolean }
  | { type: 'READY_ALL'; at: number }
  | { type: 'VOTE_DONE'; at: number }
  | { type: 'ADVANCE'; at: number }
  | { type: 'VP'; seat: number; delta: number; at: number }
  | { type: 'REVEAL_OBJECTIVE'; stage: 0 | 1 | 2; name: string; text: string; points: number }
  | { type: 'REMOVE_OBJECTIVE'; id: string; at: number }
  | { type: 'SCORE_OBJECTIVE'; id: string; seat: number; scored: boolean; at: number }
  | { type: 'SCORE_SECRET'; seat: number; label: string; at: number }
  | { type: 'UNSCORE_SECRET'; seat: number; index: number; at: number }
  | { type: 'ADD_EXTRA'; seat: number; label: string; points: number; at: number }
  | { type: 'REMOVE_EXTRA'; seat: number; index: number; at: number }
  | { type: 'ADD_LAW'; name: string; note: string }
  | { type: 'REMOVE_LAW'; id: string }
  | { type: 'SET_SPEAKER'; seat: number }
  | { type: 'SET_ZERO_TOKEN'; seat: number | null }
  | { type: 'SET_CUSTODIANS'; removed: boolean }
  | { type: 'PAUSE'; at: number }
  | { type: 'RESUME'; at: number }
  // Referee's levers: for action cards, rules disputes and mistakes. Logged like everything else.
  /** Hand the turn to someone, whatever the initiative order says. */
  | { type: 'SET_ACTIVE'; seat: number; at: number }
  | { type: 'SET_PASSED'; seat: number; passed: boolean; at: number }
  /** Put a strategy card that is in play back in its owner's hand. */
  | { type: 'CANCEL_PLAY'; at: number }
  | { type: 'SET_CARD_USED'; seat: number; card: number; used: boolean }
  | { type: 'GOTO'; phase: 'status' | 'agenda' | 'next-round'; at: number };

export interface GameOptions {
  vpTarget: number;
  speaker: number;
  /** The game's code, shown on screen; phones and other laptops find the game by it. Chosen at random if left out. */
  code?: string;
  primaryStage?: boolean;
  /** Status phase: how long every light celebrates the end of the round (0 = skip it), and whether scoring goes round in order. */
  fanfareMs?: number;
  scoreInOrder?: boolean;
  /** Begin with the seat-claiming ritual instead of pre-assigned simulated buttons. */
  seating?: boolean;
}
