import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { unlockAudio } from '../../audio/synth';
import { seatSpots, simDevice, turnElapsed } from '../../engine/engine';
import { cardByNumber, colorById } from '../../engine/data';
import { UNCLAIMED, clampBrightness, deriveOutputs } from '../../engine/outputs';
import type { Action, DeviceInput, GameState } from '../../engine/types';
import { hubStatus, setInputHandler, syncOutputs } from '../../hardware/serial';
import { snapshotOf } from '../../remote/messages';
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
import { OpenSpot, Seat } from './Seat';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import { Tour } from './Tour';
import { useGameAudio } from './useGameAudio';
import { useReactions } from './useReactions';
import '../../styles/game.css';

const PHASE_TITLES: Record<string, string> = {
  strategy: 'Strategy phase',
  action: 'Action phase',
  status: 'Status phase',
  agenda: 'Agenda phase',
};

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
  const [banner, setBanner] = useState<{ id: number; text: string; sub?: string; color?: string } | null>(null);
  const devices = useRef<(DeviceHandle | null)[]>([]);
  const dispatch = useCallback((a: Action) => store.dispatch(a), [store]);
  const outputs = useMemo(() => deriveOutputs(game), [game]);
  // How each seat likes its light: their own choice from their phone, else the table's.
  const seatPrefs = useMemo(
    () => game.players.map((p) => {
      const mine = p.profileId ? profiles.find((x) => x.id === p.profileId) : undefined;
      return { look: mine?.light ?? settings.turnLight, bright: clampBrightness(mine?.brightness) };
    }),
    [game.players, profiles, settings.turnLight],
  );
  const spots = useMemo(() => seatSpots(game), [game]);
  const now = useNow(game.clockStartedAt != null);
  const liveMs = turnElapsed(game, now);
  const n = game.players.length;

  useGameAudio(game);

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

  // Someone changed their entrance music mid-game: it applies from their next turn.
  useEffect(() => {
    game.players.forEach((p, seat) => {
      const saved = p.profileId ? profiles.find((x) => x.id === p.profileId) : undefined;
      if (!saved) return;
      const same = saved.name === p.name && JSON.stringify(saved.intro) === JSON.stringify(p.intro) && JSON.stringify(saved.outro) === JSON.stringify(p.outro);
      if (!same) dispatch({ type: 'UPDATE_PLAYER', seat, patch: { name: saved.name, intro: saved.intro, outro: saved.outro } });
    });
  }, [profiles, game.players, dispatch]);

  // Scoring happens in the status phase, so that's when the scoreboard goes up on its own…
  const phaseKey = game.seating ? 'seating' : game.phase;
  useEffect(() => {
    if (phaseKey === 'status' && settings.autoScoreboard) setBoard((b) => (b === 'closed' ? 'auto' : b));
    // …and comes down again when the round moves on, unless someone opened it by hand.
    else setBoard((b) => (b === 'auto' ? 'closed' : b));
  }, [phaseKey, settings.autoScoreboard]);

  // Number keys are the buttons: hold "3" to hold seat three's button.
  useEffect(() => {
    const seatOf = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, select, textarea')) return -1;
      const k = Number(e.key);
      return Number.isInteger(k) && k >= 1 && k <= n ? k - 1 : -1;
    };
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = e.target instanceof Element && e.target.closest('input, select, textarea');
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
  }, [n, store]);

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
      setBanner({ id: f.id, text: PHASE_TITLES[f.note] ?? f.note });
    } else return;
    const t = window.setTimeout(() => setBanner(null), f.kind === 'card' ? 2300 : 1500);
    return () => window.clearTimeout(t);
  }, [game.fxSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const reactions = useReactions(game);

  // Six players: each corner of the galaxy is somebody's home system.
  const homes = useMemo<HomeSystem[] | undefined>(() => {
    if (n !== 6) return undefined;
    return Array.from({ length: 6 }, (_, spot) => {
      const seat = spots.indexOf(spot);
      const p = seat >= 0 ? game.players[seat] : null;
      return { color: p ? colorById(p.color).led : '#5b6480', active: seat >= 0 && seat === game.active && !game.seating, passed: !!p?.passed };
    });
  }, [n, spots, game.players, game.active, game.seating]);

  const lastDenied = [...game.fx].reverse().find((f) => f.kind === 'denied' || f.kind === 'hint');
  const toast = lastDenied && lastDenied.id === game.fxSeq ? lastDenied : null;

  const input = (seat: number) => (i: DeviceInput) => dispatch({ type: 'INPUT', seat, input: i, at: Date.now() });
  const size = n <= 5 ? 132 : n <= 6 ? 122 : 104;
  const jump = (where: DemoPoint) => seedDemo(store, where);

  return (
    <div className="game" data-demo={demo || undefined} onPointerDownCapture={unlockAudio}>
      <TopBar game={game} demo={demo} canUndo={lastUndoable(events) >= 0} canRedo={future.length > 0} dispatch={dispatch} onUndo={store.undo} onRedo={store.redo} onExit={onExit} onScoreboard={() => setBoard((b) => (b === 'closed' ? 'open' : 'closed'))} />

      {board !== 'closed' && (
        <div className="boardwrap">
          <button type="button" className="btn btn--sm boardwrap__close" onClick={() => setBoard('closed')}><IconClose /> Back to the table (B)</button>
          <Scoreboard table={table} dispatch={dispatch} />
        </div>
      )}

      <main className="game__main">
        <div className="stage">
          <div className="table" data-phase={game.phase} style={{ '--n': n } as CSSProperties}>
            <HexTable homes={homes} />
            {game.players.map((_, spot) => {
              const seat = spots.indexOf(spot);
              if (seat < 0) {
                return (
                  <OpenSpot
                    key={`open-${spot}`}
                    ref={(h) => { devices.current[spot] = h; }}
                    spot={spot}
                    count={n}
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
                  count={n}
                  player={p}
                  output={outputs[seat]}
                  look={seatPrefs[seat].look}
                  size={size}
                  holdMs={settings.holdMs}
                  isSpeaker={game.speaker === seat}
                  hasZero={game.zeroToken === seat}
                  isActive={game.active === seat && !game.seating}
                  liveMs={p.timeMs + (game.active === seat ? liveMs : 0)}
                  explain={settings.explainLights}
                  react={reactions[seat]}
                  onInput={input(seat)}
                />
              );
            })}
            <CenterPanel game={game} now={now} liveMs={liveMs} holdMs={settings.holdMs} dispatch={dispatch} onUndo={store.undo} onNewGame={onExit} />
            {banner && (
              <div className="banner" key={banner.id} data-card={banner.color ? '' : undefined} style={{ '--cc': banner.color } as CSSProperties}>
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
