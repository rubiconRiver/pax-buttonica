import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { JINGLES } from '../audio/jingles';
import { PLAYER_COLORS } from '../engine/data';
import type { LedMode } from '../engine/outputs';
import { connectHub, hubStatus, sendToDevice, serialSupported, setInputHandler } from '../hardware/serial';
import { useStore } from '../state/createStore';
import '../styles/bench.css';

const MODES: LedMode[] = ['off', 'dim', 'solid', 'pulse', 'flash', 'rainbow'];

/** Bring-up bench for real hardware: poke one button at a time and watch what it says back. */
export function Bench() {
  const hub = useStore(hubStatus);
  const [color, setColor] = useState(PLAYER_COLORS[4].led);
  const [jingle, setJingle] = useState(JINGLES[0].id);
  const [presses, setPresses] = useState<{ id: number; dev: string; input: string }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let n = 0;
    setInputHandler((dev, input) => setPresses((p) => [{ id: ++n, dev, input }, ...p].slice(0, 8)));
    return () => setInputHandler(null);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [hub.log.length]);

  const j = JINGLES.find((x) => x.id === jingle)!;

  return (
    <div className="bench">
      <header className="setup__head">
        <Link to="/" className="brand"><span className="brand__dot" /><span>Pax <b>Buttonica</b></span></Link>
        <Link to="/standard" className="btn btn--sm btn--ghost">Button standard</Link>
      </header>

      <div className="bench__intro">
        <div className="eyebrow">Hardware test bench</div>
        <h1>Is this thing on?</h1>
        <p className="muted">Plug in the hub, power up a button, and poke it from here before trusting it with a game. Everything on this page talks the wire protocol directly — no game rules involved.</p>
      </div>

      {!serialSupported() ? (
        <div className="panel bench__card"><p>This browser has no Web Serial. Use <b>Chrome</b> or <b>Edge</b> on a laptop, over HTTPS or localhost.</p></div>
      ) : !hub.connected ? (
        <div className="panel bench__card">
          <p>The hub is an ESP32 on a USB cable. Your browser will ask which port it's on.</p>
          <button type="button" className="btn btn--gold btn--lg" onClick={() => void connectHub()}>Connect the hub</button>
          {hub.error && <p className="bench__error">{hub.error}</p>}
        </div>
      ) : (
        <>
          <div className="panel bench__controls">
            <div className="field">
              <span>Colour to send</span>
              <div className="swatches">
                {PLAYER_COLORS.map((c) => (
                  <button key={c.id} type="button" className="swatch" aria-label={c.name} aria-checked={color === c.led} role="radio" style={{ '--sw': c.led } as CSSProperties} onClick={() => setColor(c.led)} />
                ))}
              </div>
            </div>
            <label className="field">
              <span>Jingle to send</span>
              <select className="select" value={jingle} onChange={(e) => setJingle(e.target.value)}>
                {JINGLES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <div className="bench__hub">Hub firmware <b>{hub.hubFw ?? '—'}</b> · <b>{hub.devices.length}</b> button{hub.devices.length === 1 ? '' : 's'} heard</div>
          </div>

          {hub.devices.length === 0 && <div className="panel bench__card"><p>No buttons yet. Power one up — it announces itself within three seconds and blinks white once.</p></div>}

          <div className="bench__devices">
            {hub.devices.map((d) => (
              <section key={d.dev} className="panel bench__dev" data-lost={d.lost || undefined}>
                <div className="bench__devhead">
                  <code>{d.dev}</code>
                  <span className="chip">{d.lost ? 'not answering' : `fw ${d.fw ?? '?'}`}</span>
                  {d.caps && <span className="chip">{d.caps.btn} btn · {d.caps.led} · {d.caps.audio}</span>}
                  {d.mv != null && <span className="chip">{(d.mv / 1000).toFixed(2)} V</span>}
                </div>
                <div className="bench__row">
                  {MODES.map((m) => (
                    <button key={m} type="button" className="btn btn--sm" onClick={() => sendToDevice({ t: 'led', dev: d.dev, c: color.replace('#', ''), m })}>{m}</button>
                  ))}
                </div>
                <div className="bench__row">
                  <button type="button" className="btn btn--sm" onClick={() => sendToDevice({ t: 'id', dev: d.dev })}>Identify</button>
                  <button type="button" className="btn btn--sm" onClick={() => sendToDevice({ t: 'snd', dev: d.dev, w: j.wave, n: j.notes })}>Play jingle</button>
                  {(['ack', 'denied', 'confirm'] as const).map((k) => (
                    <button key={k} type="button" className="btn btn--sm" onClick={() => sendToDevice({ t: 'fx', dev: d.dev, k })}>fx: {k}</button>
                  ))}
                </div>
                <div className="bench__presses">
                  {presses.filter((p) => p.dev === d.dev).slice(0, 4).map((p) => <span key={p.id} className="chip chip--gold">{p.input}</span>)}
                  {!presses.some((p) => p.dev === d.dev) && <span className="muted">Press it: tap, double-tap, hold.</span>}
                </div>
              </section>
            ))}
          </div>

          <section className="panel bench__log">
            <div className="panel__head"><span>Wire traffic</span><span>newest at the bottom</span></div>
            <div className="bench__lines scroll" ref={logRef}>
              {hub.log.map((l) => <div key={l.id} data-dir={l.dir}><span>{l.dir === 'in' ? '←' : '→'}</span>{l.text}</div>)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
