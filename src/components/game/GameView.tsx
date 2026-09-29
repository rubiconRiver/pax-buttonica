import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { unlockAudio } from '../../audio/synth';
import { currentScorer, isVirtualDevice, seatOfDevice, seatSpots, simDevice, turnElapsed, turnOrder, type GameEvent } from '../../engine/engine';
import { ownerOfButton } from '../../state/profiles';
import { cardByNumber, colorById } from '../../engine/data';
import { UNCLAIMED, clampBrightness, deriveOutputs, levelsOf, screenLevels } from '../../engine/outputs';
import type { Action, DeviceInput, GameState } from '../../engine/types';
import { connectHub, hubStatus, setInputHandler, syncOutputs, watchHub } from '../../hardware/serial';
import { snapshotOf } from '../../remote/messages';
import { previews } from '../../remote/sync';
import { isOnHub, sendToDevice } from '../../hardware/serial';
import { IconClose } from '../Icons';
import { Scoreboard } from './Scoreboard';
import { profilesStore } from '../../state/profiles';
import { useStore } from '../../state/createStore';
import { seedDemo, type DemoPoint } from '../../state/demo';
import { lastUndoable, type GameStore } from '../../state/game';
import { settingsStore } from '../../state/settings';
import type { DeviceHandle } from '../Device';
import { CenterPanel } from './CenterPanel';
import { ScenarioLab } from './ScenarioLab';
import { HexTable, type HomeSystem } from './HexTable';
import { rankPosition, seatPosition } from './geometry';
import { OpenSpot, Seat } from './Seat';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import { Tour } from './Tour';
import { hubEffect, useGameAudio } from './useGameAudio';
import { reactionFor, type Reaction } from './useReactions';
import { useReactions } from './useReactions';
import '../../styles/game.css';

const PHASE_TITLES: Record<string, string> = {
  strategy: 'Strategy phase',
  action: 'Action phase',
  status: 'Status phase',
  agenda: 'Agenda phase',
};

const PRESSES: Partial<Record<DeviceInput, string>> = { tap: 'tap', double: 'double-tap', hold: 'hold' };

/** What an undo took back, in words: the log line the action wrote, or else whose press it was. */
function undoneText(g: GameState, e: GameEvent, index: number): string {
  const line = g.log.find((l) => l.event === index);
  if (line) return line.text;
  const a = e.action;
  const seat = a.type === 'INPUT' ? a.seat : a.type === 'DEVICE_INPUT' ? seatOfDevice(g, a.dev) : -1;
  const press = a.type === 'INPUT' || a.type === 'DEVICE_INPUT' ? PRESSES[a.input] : undefined;
  return seat >= 0 && press ? `${g.players[seat].name}'s ${press}` : 'the last action';
}

function useNow(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);
  return now;
}

interface Props {
  store: GameStore;
  game: GameState;
  demo?: boolean;
  onExit(): void;
}

export function GameView({ store, game, demo = false, onExit }: Props) {
  const { events, future } = useStore(store);
  const settings = useStore(settingsStore);
  const profiles = useStore(profilesStore);
  const [tour, setTour] = useState(demo);
  const [board, setBoard] = useState<'closed' | 'open' | 'auto'>('closed');
  const table = useMemo(() => snapshotOf(game), [game]);
  const [banner, setBanner] = useState<{ id: number; text: string; sub?: string; color?: string; holdMs?: number } | null>(null);
  const devices = useRef<(DeviceHandle | null)[]>([]);
  const dispatch = useCallback((a: Action) => store.dispatch(a), [store]);
  // The keyboard's undo is the one that happens by accident, so it says what it took back, with a Redo, for a moment.
  const [undone, setUndone] = useState<{ id: number; text: string } | null>(null);
  const undo = useCallback((announce: boolean) => {
    const { events, game: now } = store.get();
    const i = lastUndoable(events);
    if (i < 0 || !now) return;
    const text = undoneText(now, events[i], i);
    store.undo();
    setUndone((u) => (announce ? { id: (u?.id ?? 0) + 1, text } : null));
  }, [store]);
  const redo = useCallback(() => {
    store.redo();
    setUndone(null);
  }, [store]);
  useEffect(() => {
    if (!undone) return;
    const t = window.setTimeout(() => setUndone(null), 5000);
    return () => window.clearTimeout(t);
  }, [undone]);
  const outputs = useMemo(() => deriveOutputs(game), [game]);
  // How each seat likes its light: their own choice from their phone, else the table's.
  const seatPrefs = useMemo(
    () => game.players.map((p) => {
      const mine = p.profileId ? profiles.find((x) => x.id === p.profileId) : undefined;
      return { look: mine?.light ?? settings.turnLight, bright: clampBrightness(mine?.brightness), fx: mine?.turnFx ?? settings.turnFx };
    }),
    [game.players, profiles, settings.turnLight, settings.turnFx],
  );
  const effects = useMemo(() => seatPrefs.map((p) => p.fx), [seatPrefs]);
  const spots = useMemo(() => seatSpots(game), [game]);
  // The order of play, and where each table spot is drawn: in a row by that order, or round the table by seat.
  const order = useMemo(() => turnOrder(game), [game]);
  const inRow = settings.layout === 'order';
  const posOf = (spot: number) => {
    if (!inRow) return seatPosition(spot, n);
    const seat = spots.indexOf(spot);
    const rank = seat >= 0 ? order.indexOf(seat) : -1;
    return rankPosition(rank >= 0 ? rank : spot, n);
  };
  const now = useNow(game.clockStartedAt != null);
  const liveMs = turnElapsed(game, now);
  const n = game.players.length;
  const screen = screenLevels(levelsOf(settings));
  // Whose moment it is: the active player, or whoever is scoring while the status phase goes round.
  const spotlight = game.seating ? null : game.active ?? currentScorer(game);

  useGameAudio(game, true, effects);

  // Real buttons, when a hub is plugged in, mirror the simulated ones exactly. A button that has only just
  // spoken up (switched on late, fresh batteries) is told its light straight away, not at the next change.
  const hubDevices = useSyncExternalStore(hubStatus.subscribe, () => hubStatus.get().devices);
  useEffect(() => {
    syncOutputs(game.bindings, outputs, game.seating ? UNCLAIMED : null, seatPrefs);
  }, [game.bindings, game.seating, outputs, seatPrefs, hubDevices]);
  useEffect(() => {
    setInputHandler((dev, input) => dispatch({ type: 'DEVICE_INPUT', dev, input, at: Date.now() }));
    return () => setInputHandler(null);
  }, [dispatch]);
  // A registered button (its tag saved on its owner's profile) sits down at its owner's seat by itself; only
  // unknown buttons need the press-when-your-name-is-called ritual. A real button takes over from a phone.
  useEffect(() => {
    if (demo) return;
    for (const d of hubDevices) {
      if (d.lost || game.bindings.includes(d.dev)) continue;
      const owner = ownerOfButton(d.dev, profiles);
      const seat = owner ? game.players.findIndex((p) => p.profileId === owner.id) : -1;
      if (seat < 0) continue;
      const held = game.bindings[seat];
      if (!held || isVirtualDevice(held)) dispatch({ type: 'BIND', seat, dev: d.dev, at: Date.now() });
    }
  }, [hubDevices, game.bindings, game.players, profiles, demo, dispatch]);
  // A hub this browser has been allowed before connects on its own, with no chooser: now, and whenever it's plugged back in.
  useEffect(() => {
    if (demo) return;
    void connectHub({ silent: true });
    return watchHub();
  }, [demo]);

  // Someone changed their entrance music mid-game: it applies from their next turn.
  useEffect(() => {
    game.players.forEach((p, seat) => {
      const saved = p.profileId ? profiles.find((x) => x.id === p.profileId) : undefined;
      if (!saved) return;
      const same = saved.name === p.name && JSON.stringify(saved.intro) === JSON.stringify(p.intro) && JSON.stringify(saved.outro) === JSON.stringify(p.outro);
      if (!same) dispatch({ type: 'UPDATE_PLAYER', seat, patch: { name: saved.name, intro: saved.intro, outro: saved.outro } });
    });
  }, [profiles, game.players, dispatch]);

  // The table's taste in status phases lives in the game (phones and the log see it), and follows the settings.
  useEffect(() => {
    if (game.fanfareMs !== settings.fanfareMs || game.scoreInOrder !== settings.scoreInOrder) {
      dispatch({ type: 'SET_STATUS_FLOW', fanfareMs: settings.fanfareMs, scoreInOrder: settings.scoreInOrder });
    }
  }, [game.fanfareMs, game.scoreInOrder, settings.fanfareMs, settings.scoreInOrder, dispatch]);

  // The host keeps time for the status-phase fanfare: when it's over, scoring begins.
  const fanfare = game.phase === 'status' && game.statusStep === 'fanfare';
  useEffect(() => {
    if (!fanfare) return;
    const t = window.setTimeout(() => dispatch({ type: 'FANFARE_DONE', at: Date.now() }), game.fanfareMs);
    return () => window.clearTimeout(t);
  }, [fanfare, game.fanfareMs, game.round, dispatch]);

  // Scoring happens in the status phase, so that's when the scoreboard goes up on its own (once the lights have had their moment)…
  const phaseKey = game.seating ? 'seating' : fanfare ? 'fanfare' : game.phase;
  useEffect(() => {
    if (phaseKey === 'status' && settings.autoScoreboard) setBoard((b) => (b === 'closed' ? 'auto' : b));
    // …and comes down again when the round moves on, unless someone opened it by hand.
    else if (phaseKey !== 'fanfare') setBoard((b) => (b === 'auto' ? 'closed' : b));
  }, [phaseKey, settings.autoScoreboard]);

  // Number keys are the buttons: hold "3" to hold seat three's button.
  useEffect(() => {
    const seatOf = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, select, textarea')) return -1;
      const k = Number(e.key);
      return Number.isInteger(k) && k >= 1 && k <= n ? k - 1 : -1;
    };
    const down = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest('input, select, textarea');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        // In a text box it's the box's own undo. Held down, it's one undo, not one per key repeat.
        if (typing) return;
        e.preventDefault();
        if (e.repeat) return;
        if (e.shiftKey) redo();
        else undo(true);
        return;
      }
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!typing && e.key.toLowerCase() === 'b') return setBoard((b) => (b === 'closed' ? 'open' : 'closed'));
      if (e.key === 'Escape') return setBoard('closed');
      const s = seatOf(e);
      if (s >= 0) devices.current[s]?.down();
    };
    const up = (e: KeyboardEvent) => {
      const s = seatOf(e);
      if (s >= 0) devices.current[s]?.up();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [n, undo, redo]);

  // Phase changes sweep a banner across the table.
  const lastPhaseFx = useRef(game.fxSeq);
  useEffect(() => {
    const f = [...game.fx].reverse().find((x) => (x.kind === 'phase' || x.kind === 'card') && x.id > lastPhaseFx.current);
    lastPhaseFx.current = game.fxSeq;
    if (!f) return;
    if (f.kind === 'card' && f.card != null && f.seat != null) {
      const c = cardByNumber(f.card);
      setBanner({ id: f.id, text: `${c.n} · ${c.name}`, sub: `${game.players[f.seat].name} plays their strategy card`, color: c.color });
    } else if (f.note) {
      const celebrating = f.note === 'status' && game.statusStep === 'fanfare';
      setBanner({ id: f.id, text: PHASE_TITLES[f.note] ?? f.note, sub: celebrating ? `Round ${game.round} is over` : undefined, holdMs: celebrating ? Math.max(1500, game.fanfareMs) : undefined });
    } else return;
    const celebrating = f.kind === 'phase' && f.note === 'status' && game.statusStep === 'fanfare';
    const t = window.setTimeout(() => setBanner(null), f.kind === 'card' ? 2300 : celebrating ? Math.max(1500, game.fanfareMs) : 1500);
    return () => window.clearTimeout(t);
  }, [game.fxSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const engineReactions = useReactions(game, effects);
  // A phone trying out a turn effect: drawn on that player's seat here, and sent to their real button if they have one.
  const preview = useStore(previews);
  const [tried, setTried] = useState<{ seat: number; reaction: Reaction }[]>([]);
  useEffect(() => {
    if (!preview || demo) return;
    let seat = game.bindings.indexOf(preview.dev);
    if (seat < 0) {
      const who = game.devices[preview.dev];
      seat = who ? game.players.findIndex((p) => p.profileId === who) : -1;
    }
    if (seat < 0) return;
    const kind = reactionFor(preview.fx);
    setTried((t) => [...t.filter((x) => x.seat !== seat), { seat, reaction: kind ? { id: -preview.id, kind } : null }]);
    const dev = game.bindings[seat];
    const k = hubEffect(preview.fx);
    if (dev && k && isOnHub(dev)) sendToDevice({ t: 'fx', dev, k });
  }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps
  const reactions = useMemo(() => {
    const out = [...engineReactions];
    for (const t of tried) if (t.reaction && (!out[t.seat] || t.reaction.id !== out[t.seat]!.id)) out[t.seat] = t.reaction;
    return out;
  }, [engineReactions, tried]);

  // Six players: each corner of the galaxy is somebody's home system.
  const homes = useMemo<HomeSystem[] | undefined>(() => {
    if (n !== 6) return undefined;
    return Array.from({ length: 6 }, (_, spot) => {
      const seat = spots.indexOf(spot);
      const p = seat >= 0 ? game.players[seat] : null;
      return { color: p ? colorById(p.color).led : '#5b6480', active: seat >= 0 && seat === spotlight, passed: !!p?.passed };
    });
  }, [n, spots, game.players, spotlight]);

  const lastDenied = [...game.fx].reverse().find((f) => f.kind === 'denied' || f.kind === 'hint');
  const toast = lastDenied && lastDenied.id === game.fxSeq ? lastDenied : null;

  const input = (seat: number) => (i: DeviceInput) => dispatch({ type: 'INPUT', seat, input: i, at: Date.now() });
  const size = n <= 5 ? 132 : n <= 6 ? 122 : 104;
  // In the row, seats are drawn (and read by a screen reader, and stacked on a phone) in the order of play.
  const drawOrder = inRow
    ? [...game.players.keys()].sort((a, b) => posOf(a).x - posOf(b).x)
    : [...game.players.keys()];
  const jump = (where: DemoPoint) => seedDemo(store, where);

  return (
    <div className="game" data-demo={demo || undefined} onPointerDownCapture={unlockAudio}>
      <TopBar game={game} demo={demo} canUndo={lastUndoable(events) >= 0} canRedo={future.length > 0} dispatch={dispatch} onUndo={() => undo(false)} onRedo={redo} onExit={onExit} onScoreboard={() => setBoard((b) => (b === 'closed' ? 'open' : 'closed'))} />

      {board !== 'closed' && (
        <div className="boardwrap">
          <button type="button" className="btn btn--sm boardwrap__close" onClick={() => setBoard('closed')}><IconClose /> Back to the table (B)</button>
          <Scoreboard table={table} dispatch={dispatch} />
        </div>
      )}

      <main className="game__main">
        <div className="stage">
          <div className="table" data-phase={game.phase} data-layout={settings.layout} style={{ '--n': n, '--dim-lum': screen.dim, '--fx-gain': screen.fx } as CSSProperties}>
            {!inRow && <HexTable homes={homes} />}
            {drawOrder.map((spot) => {
              const seat = spots.indexOf(spot);
              if (seat < 0) {
                return (
                  <OpenSpot
                    key={`open-${spot}`}
                    ref={(h) => { devices.current[spot] = h; }}
                    spot={spot}
                    pos={posOf(spot)}
                    size={size}
                    holdMs={settings.holdMs}
                    output={UNCLAIMED}
                    look={settings.turnLight}
                    onInput={(i) => dispatch({ type: 'DEVICE_INPUT', dev: simDevice(spot), input: i, at: Date.now() })}
                  />
                );
              }
              const p = game.players[seat];
              return (
                <Seat
                  key={`seat-${seat}`}
                  ref={(h) => { devices.current[spot] = h; }}
                  spot={spot}
                  pos={posOf(spot)}
                  rank={inRow ? order.indexOf(seat) : undefined}
                  player={p}
                  output={outputs[seat]}
                  look={seatPrefs[seat].look}
                  size={size}
                  holdMs={settings.holdMs}
                  isSpeaker={game.speaker === seat}
                  hasZero={game.zeroToken === seat}
                  isActive={spotlight === seat}
                  liveMs={p.timeMs + (game.active === seat ? liveMs : 0)}
                  explain={settings.explainLights}
                  react={reactions[seat]}
                  onInput={input(seat)}
                />
              );
            })}
            <CenterPanel game={game} now={now} liveMs={liveMs} holdMs={settings.holdMs} dispatch={dispatch} onUndo={() => undo(false)} onNewGame={onExit} />
            {banner && (
              <div className="banner" key={banner.id} data-card={banner.color ? '' : undefined} data-hold={banner.holdMs ? '' : undefined} style={{ '--cc': banner.color, '--hold-ms': banner.holdMs ? `${banner.holdMs}ms` : undefined } as CSSProperties}>
                <span>
                  {banner.text}
                  {banner.sub && <small>{banner.sub}</small>}
                </span>
              </div>
            )}
            {toast && (
              <div className="toast" key={toast.id} data-kind={toast.kind}>
                {toast.seat != null && <b>{game.players[toast.seat].name}: </b>}
                {toast.note}
              </div>
            )}
            {undone && future.length > 0 && !toast && (
              <div className="undone" key={undone.id} role="status">
                <span>Undone: {undone.text}</span>
                <button type="button" className="btn btn--sm" onClick={redo}>Redo</button>
              </div>
            )}
          </div>

          {demo && <ScenarioLab game={game} dispatch={dispatch} onReset={() => jump('action')} onJump={jump} />}
        </div>

        <div className="rail">
          {tour && <Tour game={game} holdMs={settings.holdMs} onClose={() => setTour(false)} />}
          <SidePanel game={game} dispatch={dispatch} onRewind={demo ? undefined : store.rewind} />
        </div>
      </main>
    </div>
  );
}
