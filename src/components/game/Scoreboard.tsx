import { useMemo, useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/synth';
import { cardByNumber } from '../../engine/data';
import { EXTRA_POINT_SOURCES, LAW_NAMES, OBJECTIVE_CARDS } from '../../engine/objectives';
import type { Action, Objective } from '../../engine/types';
import type { TableSnapshot } from '../../remote/messages';
import { IconClose, IconGavel } from '../Icons';
import '../../styles/scoreboard.css';

interface Props {
  table: TableSnapshot;
  /** Present on the host: every chip and list becomes editable. Absent on phones: read-only. */
  dispatch?(a: Action): void;
}

const at = () => Date.now();
const STAGE = { 1: 'Stage I', 2: 'Stage II', 0: 'Other' } as const;

/**
 * The whole public state of the game on one screen: standings, every objective
 * with its requirement, who has scored what, and the laws in play. Shown big on
 * the shared display and, read-only, on every player's phone.
 */
export function Scoreboard({ table, dispatch }: Props) {
  const edit = !!dispatch;
  const leader = Math.max(...table.players.map((p) => p.vp));
  const columns: (0 | 1 | 2)[] = table.objectives.some((o) => o.stage === 0) ? [1, 2, 0] : [1, 2];

  return (
    <div className="board" data-edit={edit || undefined}>
      <header className="board__head">
        <span className="eyebrow">Round {table.round} · {table.phase} phase</span>
        {table.phase === 'status' && table.scorer != null && (
          <span className="board__scoring" style={{ '--pc': table.players[table.scorer].color } as CSSProperties}>
            Scoring: <b>{table.players[table.scorer].name}</b>
            {edit && <button type="button" className="btn btn--sm" onClick={() => { sfx.click(); dispatch!({ type: 'SCORED', seat: table.scorer!, at: at() }); }}>Done</button>}
          </span>
        )}
        {table.phase === 'status' && table.statusStep === 'tidy' && <span className="board__ready mono-num">{table.ready.filter(Boolean).length}/{table.players.length} ready</span>}
        <span className="eyebrow">First to {table.vpTarget}</span>
      </header>

      <div className="board__standings" style={{ '--n': table.players.length } as CSSProperties}>
        {table.players.map((p, seat) => {
          const publics = table.objectives.filter((o) => o.scoredBy.includes(seat)).reduce((t, o) => t + o.points, 0);
          const extras = p.extras.reduce((t, e) => t + e.points, 0);
          return (
            <div key={seat} className="stand" data-lead={(p.vp === leader && leader > 0) || undefined} data-active={table.active === seat || table.scorer === seat || undefined} style={{ '--pc': p.color } as CSSProperties}>
              <div className="stand__name">
                {p.name}
                {table.speaker === seat && <IconGavel aria-label="Speaker" />}
              </div>
              <div className="stand__vp mono-num" key={p.vp}>{p.vp}</div>
              <div className="stand__bar"><i style={{ width: `${Math.min(100, (p.vp / table.vpTarget) * 100)}%` }} /></div>
              <div className="stand__split">
                <span title="From public objectives">Public <b>{publics}</b></span>
                <span title="Secret objectives scored">Secret <b>{p.secrets.length}</b></span>
                <span title="Custodians, Imperial, agendas, Support for the Throne…">Other <b>{extras}</b></span>
              </div>
              <div className="stand__cards">
                {p.cards.map((c) => (
                  <span key={c} className="cardpip" data-used={p.used.includes(c) || undefined} style={{ '--cc': cardByNumber(c).color } as CSSProperties} title={cardByNumber(c).name}>{c}</span>
                ))}
                {p.passed && <span className="plate__passed">Passed</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="board__cols" data-cols={columns.length}>
        {columns.map((stage) => (
          <section key={stage} className="board__col" data-stage={stage}>
            <h3>{STAGE[stage]} <small>{stage === 0 ? 'added by the table' : `${stage} point${stage > 1 ? 's' : ''} each`}</small></h3>
            {table.objectives.filter((o) => o.stage === stage).map((o) => (
              <ObjectiveCard key={o.id} o={o} table={table} dispatch={dispatch} />
            ))}
            {!table.objectives.some((o) => o.stage === stage) && <p className="board__empty">Nothing revealed yet.</p>}
            {edit && stage !== 0 && <Reveal stage={stage} table={table} dispatch={dispatch!} />}
          </section>
        ))}
      </div>

      <div className="board__lower">
        <section className="board__laws">
          <h3>Laws in play</h3>
          {table.laws.length === 0 && <p className="board__empty">No laws have been passed.</p>}
          {table.laws.map((l) => (
            <div key={l.id} className="law">
              <b>{l.name}</b>
              {l.note && <span>{l.note}</span>}
              {edit && <button type="button" className="xbtn" aria-label={`Repeal ${l.name}`} onClick={() => dispatch!({ type: 'REMOVE_LAW', id: l.id })}><IconClose /></button>}
            </div>
          ))}
          {edit && <AddLaw dispatch={dispatch!} />}
        </section>

        <section className="board__others">
          <h3>Secrets and other points</h3>
          <div className="others">
            {table.players.map((p, seat) => (
              <div key={seat} className="other" style={{ '--pc': p.color } as CSSProperties}>
                <b className="other__name">{p.name}</b>
                <div className="other__items">
                  {p.secrets.map((s, i) => (
                    <span key={`s${i}`} className="tag tag--secret">
                      Secret{s ? `: ${s}` : ''} <i>+1</i>
                      {edit && <button type="button" className="xbtn" aria-label="Remove" onClick={() => dispatch!({ type: 'UNSCORE_SECRET', seat, index: i, at: at() })}><IconClose /></button>}
                    </span>
                  ))}
                  {p.extras.map((e, i) => (
                    <span key={`e${i}`} className="tag">
                      {e.label} <i>{e.points > 0 ? '+' : ''}{e.points}</i>
                      {edit && <button type="button" className="xbtn" aria-label="Remove" onClick={() => dispatch!({ type: 'REMOVE_EXTRA', seat, index: i, at: at() })}><IconClose /></button>}
                    </span>
                  ))}
                  {!p.secrets.length && !p.extras.length && !edit && <span className="board__empty">—</span>}
                  {edit && <AddPoints seat={seat} dispatch={dispatch!} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ObjectiveCard({ o, table, dispatch }: { o: Objective; table: TableSnapshot; dispatch?: Props['dispatch'] }) {
  return (
    <article className="obj" data-stage={o.stage}>
      <div className="obj__head">
        <span className="obj__pts mono-num">{o.points}</span>
        <b>{o.name}</b>
        {dispatch && <button type="button" className="xbtn" aria-label={`Remove ${o.name}`} title="Remove this objective" onClick={() => dispatch({ type: 'REMOVE_OBJECTIVE', id: o.id, at: at() })}><IconClose /></button>}
      </div>
      <p className="obj__text">{o.text}</p>
      <div className="obj__who">
        {table.players.map((p, seat) => {
          const scored = o.scoredBy.includes(seat);
          const chip = (
            <>
              <i />
              {p.name}
            </>
          );
          return dispatch ? (
            <button
              key={seat}
              type="button"
              className="who-chip"
              aria-pressed={scored}
              style={{ '--pc': p.color } as CSSProperties}
              title={scored ? `${p.name} has scored this. Click to undo.` : `Mark as scored by ${p.name}`}
              onClick={() => { (scored ? sfx.click : sfx.ack)(); dispatch({ type: 'SCORE_OBJECTIVE', id: o.id, seat, scored: !scored, at: at() }); }}
            >
              {chip}
            </button>
          ) : (
            <span key={seat} className="who-chip" aria-pressed={scored} style={{ '--pc': p.color } as CSSProperties}>{chip}</span>
          );
        })}
      </div>
    </article>
  );
}

function Reveal({ stage, table, dispatch }: { stage: 1 | 2; table: TableSnapshot; dispatch(a: Action): void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState({ name: '', text: '' });
  const options = useMemo(
    () => OBJECTIVE_CARDS.filter((c) => c.stage === stage && !table.objectives.some((o) => o.name === c.name) && (c.name + c.text).toLowerCase().includes(q.toLowerCase())),
    [stage, table.objectives, q],
  );

  if (!open) return <button type="button" className="btn btn--sm board__add" onClick={() => { sfx.click(); setOpen(true); }}>+ Reveal a {STAGE[stage]} objective</button>;
  return (
    <div className="reveal">
      <div className="reveal__top">
        <input className="input" autoFocus placeholder={`Search ${STAGE[stage]} objectives…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} />
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOpen(false)}>Done</button>
      </div>
      <div className="reveal__list scroll">
        {options.map((c) => (
          <button key={c.id} type="button" className="reveal__item" onClick={() => { sfx.pick(); dispatch({ type: 'REVEAL_OBJECTIVE', stage, name: c.name, text: c.text, points: stage }); setQ(''); setOpen(false); }}>
            <b>{c.name}</b>
            <span>{c.text}</span>
          </button>
        ))}
        {!options.length && <p className="board__empty">No match. Add it by hand below.</p>}
      </div>
      <form className="reveal__custom" onSubmit={(e) => { e.preventDefault(); if (!custom.name.trim()) return; dispatch({ type: 'REVEAL_OBJECTIVE', stage, name: custom.name, text: custom.text, points: stage }); setCustom({ name: '', text: '' }); setOpen(false); }}>
        <input className="input" placeholder="Not listed? Name" value={custom.name} maxLength={60} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
        <input className="input" placeholder="What it asks for" value={custom.text} maxLength={200} onChange={(e) => setCustom({ ...custom, text: e.target.value })} />
        <button type="submit" className="btn btn--sm" disabled={!custom.name.trim()}>Add</button>
      </form>
    </div>
  );
}

function AddPoints({ seat, dispatch }: { seat: number; dispatch(a: Action): void }) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [label, setLabel] = useState(EXTRA_POINT_SOURCES[0]);
  if (!open) return <button type="button" className="tag tag--add" onClick={() => setOpen(true)}>+ add</button>;
  return (
    <div className="addpts">
      <form onSubmit={(e) => { e.preventDefault(); sfx.ack(); dispatch({ type: 'SCORE_SECRET', seat, label: secret, at: at() }); setSecret(''); setOpen(false); }}>
        <input className="input" placeholder="Secret objective (name optional)" value={secret} maxLength={60} onChange={(e) => setSecret(e.target.value)} />
        <button type="submit" className="btn btn--sm">+1 secret</button>
      </form>
      <form onSubmit={(e) => e.preventDefault()}>
        <input className="input" list="extra-sources" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} aria-label="Where the point came from" />
        <datalist id="extra-sources">{EXTRA_POINT_SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
        <button type="button" className="btn btn--sm" onClick={() => { sfx.ack(); dispatch({ type: 'ADD_EXTRA', seat, label, points: 1, at: at() }); setOpen(false); }}>+1</button>
        <button type="button" className="btn btn--sm" onClick={() => { sfx.click(); dispatch({ type: 'ADD_EXTRA', seat, label, points: -1, at: at() }); setOpen(false); }}>−1</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOpen(false)}>Cancel</button>
      </form>
    </div>
  );
}

function AddLaw({ dispatch }: { dispatch(a: Action): void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  return (
    <form className="addlaw" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; sfx.pick(); dispatch({ type: 'ADD_LAW', name, note }); setName(''); setNote(''); }}>
      <input className="input" list="law-names" placeholder="Law" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      <datalist id="law-names">{LAW_NAMES.map((l) => <option key={l} value={l} />)}</datalist>
      <input className="input" placeholder="Who or what was elected, or what it does" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" className="btn btn--sm" disabled={!name.trim()}>Add law</button>
    </form>
  );
}
