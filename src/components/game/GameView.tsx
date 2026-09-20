import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { unlockAudio } from '../../audio/synth';
import { seatSpots, simDevice, turnElapsed } from '../../engine/engine';
import { cardByNumber } from '../../engine/data';
import { UNCLAIMED, deriveOutputs } from '../../engine/outputs';
import type { Action, DeviceInput, GameState } from '../../engine/types';
import { setInputHandler, syncOutputs } from '../../hardware/serial';
import { resumeRoom, roomStatus, setRoomHandlers, syncRoom } from '../../remote/host';
import { useStore } from '../../state/createStore';
import { seedDemo, type DemoPoint } from '../../state/demo';
import type { GameStore } from '../../state/game';
import { settingsStore } from '../../state/settings';
import type { DeviceHandle } from '../Device';
import { CenterPanel } from './CenterPanel';
import { ScenarioLab } from './ScenarioLab';
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
  const { past } = useStore(store);
  const settings = useStore(settingsStore);
  const room = useStore(roomStatus);
  const [tour, setTour] = useState(demo);
  const [banner, setBanner] = useState<{ id: number; text: string; sub?: string; color?: string } | null>(null);
  const devices = useRef<(DeviceHandle | null)[]>([]);
  const dispatch = useCallback((a: Action) => store.dispatch(a), [store]);
  const outputs = useMemo(() => deriveOutputs(game), [game]);
  const spots = useMemo(() => seatSpots(game), [game]);
  const now = useNow(game.clockStartedAt != null);
  const liveMs = turnElapsed(game, now);
  const n = game.players.length;

  useGameAudio(game);

  // Real buttons, when a hub is plugged in, mirror the simulated ones exactly.
  useEffect(() => {
    syncOutputs(game.bindings, outputs, game.seating ? UNCLAIMED : null);
  }, [game.bindings, game.seating, outputs]);
  useEffect(() => {
    setInputHandler((dev, input) => dispatch({ type: 'DEVICE_INPUT', dev, input, at: Date.now() }));
    return () => setInputHandler(null);
  }, [dispatch]);

  // Phones are buttons too: same inputs in, same lights out.
  useEffect(() => {
    setRoomHandlers((dev, input) => dispatch({ type: 'DEVICE_INPUT', dev, input, at: Date.now() }), null);
    resumeRoom();
    return () => setRoomHandlers(null, null);
  }, [dispatch]);

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
        store.undo();
        return;
      }
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
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

  useEffect(() => {
    syncRoom((dev) => {
      const seat = game.bindings.indexOf(dev);
      const o = seat >= 0 ? outputs[seat] : game.seating ? UNCLAIMED : { color: '#ffffff', mode: 'off' as const, reason: 'Waiting for the next seat claiming' };
      return {
        t: 'state',
        name: seat >= 0 ? game.players[seat].name : null,
        color: o.color,
        mode: o.mode,
        reason: o.reason,
        calling: game.seating ? game.players[game.seating.next].name : null,
        holdMs: settings.holdMs,
        flashMs: settings.flashMs,
        react: seat >= 0 ? reactions[seat] : null,
      };
    });
  }, [game, outputs, reactions, room.phones, settings.holdMs, settings.flashMs]);

  const lastDenied = [...game.fx].reverse().find((f) => f.kind === 'denied' || f.kind === 'hint');
  const toast = lastDenied && lastDenied.id === game.fxSeq ? lastDenied : null;

  const input = (seat: number) => (i: DeviceInput) => dispatch({ type: 'INPUT', seat, input: i, at: Date.now() });
  const size = n <= 5 ? 132 : n <= 6 ? 122 : 104;
  const jump = (where: DemoPoint) => seedDemo(store, where);

  return (
    <div className="game" data-demo={demo || undefined} onPointerDownCapture={unlockAudio}>
      <TopBar game={game} demo={demo} canUndo={past.length > 0} dispatch={dispatch} onUndo={store.undo} onExit={onExit} />

      <main className="game__main">
        <div className="stage">
          <div className="table" data-phase={game.phase} style={{ '--n': n } as CSSProperties}>
            <div className="table__surface" />
            <div className="table__ring" />
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
          <SidePanel game={game} dispatch={dispatch} />
        </div>
      </main>
    </div>
  );
}
