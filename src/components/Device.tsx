import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import type { LedMode } from '../engine/outputs';
import type { DeviceInput } from '../engine/types';
import { sfx, startCharge, unlockAudio } from '../audio/synth';
import '../styles/device.css';

/** Presses shorter than this are taps; longer ones that let go early are abandoned holds. */
export const TAP_MAX_MS = 350;
/** A second tap landing this soon after the first is reported as `double`. */
export const DOUBLE_MS = 400;

export interface DeviceHandle {
  down(): void;
  up(): void;
}

interface Props {
  color: string;
  mode: LedMode;
  size?: number;
  holdMs?: number;
  /** 1 = just the dome. 3 = dome plus strategy and pass shortcuts. */
  buttons?: number;
  pan?: number;
  label?: string;
  hotkey?: string;
  /** A one-shot reaction, keyed so the same kind can fire twice in a row. */
  react?: { id: number; kind: 'denied' | 'ack' | 'hint' | 'burst' } | null;
  silent?: boolean;
  onInput?(input: DeviceInput): void;
}

export const Device = forwardRef<DeviceHandle, Props>(function Device(
  { color, mode, size = 140, holdMs = 2000, buttons = 1, pan = 0, label, hotkey, react, silent, onInput },
  ref,
) {
  const [pressed, setPressed] = useState(false);
  const [held, setHeld] = useState(false);
  const [shock, setShock] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);
  const t0 = useRef(0);
  const lastTap = useRef(0);
  const timers = useRef<number[]>([]);
  const stopCharge = useRef<() => void>(() => {});
  const live = useRef({ pressed: false, held: false });
  const interactive = !!onInput;

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    stopCharge.current();
    stopCharge.current = () => {};
  };

  const down = useCallback(() => {
    if (!interactive || live.current.pressed) return;
    unlockAudio();
    live.current = { pressed: true, held: false };
    t0.current = performance.now();
    setPressed(true);
    setHeld(false);
    if (!silent) sfx.down(pan);
    timers.current.push(
      window.setTimeout(() => {
        if (!silent) stopCharge.current = startCharge(holdMs - TAP_MAX_MS, pan);
      }, TAP_MAX_MS),
      window.setTimeout(() => {
        live.current.held = true;
        stopCharge.current();
        setHeld(true);
        setShock((n) => n + 1);
        if (!silent) sfx.confirm(pan);
        onInput?.('hold');
      }, holdMs),
    );
  }, [interactive, holdMs, pan, silent, onInput]);

  const up = useCallback(() => {
    if (!live.current.pressed) return;
    const wasHeld = live.current.held;
    const elapsed = performance.now() - t0.current;
    live.current = { pressed: false, held: false };
    clear();
    setPressed(false);
    setHeld(false);
    if (!silent) sfx.up(pan);
    if (wasHeld || elapsed > TAP_MAX_MS) return;
    // Taps are reported at once (so acknowledging never lags); a quick second one adds `double`.
    const now = performance.now();
    if (now - lastTap.current <= DOUBLE_MS) {
      lastTap.current = 0;
      onInput?.('double');
    } else {
      lastTap.current = now;
      onInput?.('tap');
    }
  }, [pan, silent, onInput]);

  useImperativeHandle(ref, () => ({ down, up }), [down, up]);
  useEffect(() => clear, []);

  useEffect(() => {
    if (!react) return;
    setReaction(react.kind);
    if (react.kind === 'burst') setShock((n) => n + 1);
    const t = window.setTimeout(() => setReaction(null), 520);
    return () => window.clearTimeout(t);
  }, [react?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = { '--size': `${size}px`, '--led': color, '--hold-ms': `${holdMs}ms` } as CSSProperties;

  return (
    <div
      className="dev"
      style={style}
      data-mode={mode}
      data-pressed={pressed || undefined}
      data-holding={(pressed && !held) || undefined}
      data-held={held || undefined}
      data-react={reaction ?? undefined}
      data-static={!interactive || undefined}
    >
      <div className="dev__halo" />
      <div className="dev__base">
        <div className="dev__well" />
        <svg className="dev__ring" viewBox="0 0 100 100" aria-hidden>
          <circle className="dev__ring-track" cx="50" cy="50" r="45.5" />
          <circle className="dev__ring-fill" cx="50" cy="50" r="45.5" pathLength={100} />
        </svg>
        <button
          type="button"
          className="dev__dome"
          aria-label={label ?? 'Button'}
          tabIndex={interactive ? 0 : -1}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            down();
          }}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              down();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') up();
          }}
          onBlur={up}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="dev__light" />
          <span className="dev__core" />
          <span className="dev__spec" />
          <span className="dev__deny" />
        </button>
        {hotkey && <kbd className="dev__key">{hotkey}</kbd>}
      </div>
      {shock > 0 && <span key={shock} className="dev__shock" />}
      {buttons >= 3 && interactive && (
        <div className="dev__aux">
          <button
            type="button"
            className="dev__auxbtn"
            title="Shortcut button: play my strategy card"
            onClick={() => {
              unlockAudio();
              sfx.click();
              onInput?.('strategy');
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden><rect x="6" y="3" width="12" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2 9.5 15.6l.6-2.8L8 10.9l2.8-.3z" fill="currentColor" /></svg>
          </button>
          <button
            type="button"
            className="dev__auxbtn"
            title="Shortcut button: pass"
            onClick={() => {
              unlockAudio();
              sfx.click();
              onInput?.('pass');
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12h11M12 7l5 5-5 5M20 5v14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
});
