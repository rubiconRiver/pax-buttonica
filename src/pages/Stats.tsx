import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cardByNumber, colorById } from '../engine/data';
import { analyzeLog, clock, dayOf, spoken, timeOfDay, type GameLog, type GameStats, type PlayerStats } from '../stats/analyze';
import log from '../stats/game-V28W.json';
import '../styles/stats.css';

/**
 * One game, taken apart: where the evening went, who took how long, what the strategy cards cost in waiting, and
 * which presses did nothing. Everything here is replayed from the game's action log by the same engine that ran
 * the table, so the numbers are the game's own. Hover anything with a dotted underline for what it means.
 */

const PHASE_NAME: Record<string, string> = { strategy: 'Strategy', action: 'Action', status: 'Status', agenda: 'Agenda', finished: 'Finished' };
const SHARE_TIPS: Record<keyof GameStats['shares'], [string, string]> = {
  turns: ['Turns', "Players' turns in the action phase with the clock running: from a turn starting to it ending or a pass, with pauses taken out and the waiting below taken out too."],
  waiting: ['Waiting on secondaries', 'After a strategy card is played, the time until every other player had tapped to say they were done with the secondary. Counted against the whole table, not the player who played the card.'],
  paused: ['Paused', 'Time while the host had the clock paused: breaks that were marked as breaks.'],
  between: ['Between rounds', 'The status phase, from the last pass to the host pressing "Everyone\'s ready": rainbows, scoring one at a time, then tidying up and whatever break happened there.'],
  strategy: ['Strategy phases', 'Choosing strategy cards at the start of each round, including the setup before round one and any break taken before the first card was picked.'],
  other: ['Other', 'Moments the clock was not on anyone: the hand-overs between turns.'],
};

/** A word or number that explains itself on hover (or on a tap, on a phone). */
function Tip({ tip, children, block }: { tip: string; children: ReactNode; block?: boolean }) {
  return <span className={block ? 'tip tip--block' : 'tip'} data-tip={tip} tabIndex={0}>{children}</span>;
}

const pc = (_names: string[], seat: number, colors: string[]) => ({ '--pc': colors[seat] } as CSSProperties);

export function Stats() {
  const stats = useMemo(() => analyzeLog(log as unknown as GameLog), []);
  const colors = useMemo(() => ((log as unknown as GameLog).base.players.map((p) => colorById(p.color).led)), []);
  return (
    <div className="stats">
      <nav className="stats__nav">
        <Link to="/" className="brand" title="Back to the home page"><span className="brand__dot" />Pax <b>Buttonica</b></Link>
        <span className="eyebrow">Game stats</span>
      </nav>
      <Hero s={stats} colors={colors} />
      <Shares s={stats} />
      <Rounds s={stats} colors={colors} />
      <Players s={stats} colors={colors} />
      <Cards s={stats} colors={colors} />
      <Longest s={stats} colors={colors} />
      <Refusals s={stats} colors={colors} />
      <Breaks s={stats} />
      <Passing s={stats} colors={colors} />
      <p className="stats__foot muted">
        Replayed in this browser from the game's action log, {log.events.length} events with their times, by the same rules engine that ran the table. Times are {Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/Regina' ? 'local' : 'Saskatoon'} time.
      </p>
    </div>
  );
}

function Hero({ s, colors }: { s: GameStats; colors: string[] }) {
  return (
    <header className="stats__hero">
      <div className="eyebrow">Game {s.code} · {dayOf(s.start)}</div>
      <h1>{spoken(s.total)} at the table</h1>
      <div className="stats__facts">
        <Tip tip="From the game being set up to the last press of the evening."><b>{timeOfDay(s.start)}</b> to <b>{timeOfDay(s.end)}</b></Tip>
        <Tip tip="A round is a strategy phase, an action phase and a status phase. The game was ended during round six's status phase."><b>{s.rounds}</b> rounds</Tip>
        <Tip tip="Every turn taken in the action phases, passes included."><b>{s.turnCount}</b> turns</Tip>
        <Tip tip={s.winner != null ? 'Reached the victory points target on the scoreboard.' : 'Points were not kept on the scoreboard, so the engine never saw a winner.'}>{s.winner != null ? <><b>{s.names[s.winner]}</b> won</> : 'No winner recorded'}</Tip>
      </div>
      <div className="stats__seats">
        {s.names.map((n, i) => <span key={i} className="stats__seat" style={pc(s.names, i, colors)}>{n}</span>)}
      </div>
    </header>
  );
}

function Shares({ s }: { s: GameStats }) {
  const keys = Object.keys(s.shares) as (keyof GameStats['shares'])[];
  return (
    <section className="panel stats__card">
      <h2>Where the time went</h2>
      <div className="sharebar" role="img" aria-label="How the day split up">
        {keys.map((k) => s.shares[k] > 0 && (
          <Tip key={k} tip={`${SHARE_TIPS[k][0]}: ${clock(s.shares[k])}, ${Math.round((s.shares[k] / s.total) * 100)}% of the day`}>
            <i className={`sharebar__seg sharebar__seg--${k}`} style={{ width: `${(s.shares[k] / s.total) * 100}%` }} />
          </Tip>
        ))}
      </div>
      <ul className="legend">
        {keys.map((k) => s.shares[k] > 0 && (
          <li key={k}>
            <i className={`legend__dot sharebar__seg--${k}`} />
            <Tip tip={SHARE_TIPS[k][1]}>{SHARE_TIPS[k][0]}</Tip>
            <b className="mono-num">{clock(s.shares[k])}</b>
            <span className="muted">{Math.round((s.shares[k] / s.total) * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="muted stats__note">
        About {spoken(s.shares.turns)} of deciding and moving plastic. The rest is waiting of one kind or another: marked pauses, the stretch between rounds, and two long breaks at the start of a strategy phase that nobody paused for.
      </p>
    </section>
  );
}

function Rounds({ s, colors }: { s: GameStats; colors: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const longest = Math.max(...s.roundSummary.map((r) => r.strategy + r.action + r.status + r.agenda));
  return (
    <section className="panel stats__card">
      <h2>Round by round <Tip tip="Each bar is one round, to scale. Strategy phase, action phase, status phase. Click a round for who took how long in it. Hover a segment for when it started.">?</Tip></h2>
      <div className="rounds">
        {s.roundSummary.map((r) => {
          const total = r.strategy + r.action + r.status + r.agenda;
          const spans = s.phases.filter((p) => p.round === r.round);
          return (
            <div key={r.round} className="round" data-open={open === r.round || undefined}>
              <button type="button" className="round__row" aria-expanded={open === r.round} onClick={() => setOpen(open === r.round ? null : r.round)}>
                <span className="round__n mono-num">R{r.round}</span>
                <span className="round__bar" style={{ width: `${(total / longest) * 100}%` }}>
                  {spans.map((p, i) => (
                    <Tip key={i} tip={`${PHASE_NAME[p.phase]}${p.step ? ` (${p.step === 'fanfare' ? 'rainbows' : p.step === 'scoring' ? 'scoring in order' : 'tidy-up'})` : ''}: started ${timeOfDay(p.from)}, ${clock(p.to - p.from)}`}>
                      <i className={`round__seg round__seg--${p.phase}`} style={{ width: `${((p.to - p.from) / total) * 100}%` }} />
                    </Tip>
                  ))}
                </span>
                <span className="round__len mono-num">{clock(total)}</span>
                <span className="round__meta muted">
                  <Tip tip="Turns taken in this round's action phase, passes included.">{r.turns} turns</Tip> · <Tip tip="Average length of a turn in this round, with pauses taken out.">{clock(r.avgTurn)} avg</Tip>
                  {r.paused > 0 && <> · <Tip tip="Time the host had the clock paused during this round.">{spoken(r.paused)} paused</Tip></>}
                </span>
              </button>
              {open === r.round && (
                <div className="round__detail">
                  <table className="stats__table stats__table--tight">
                    <thead><tr><th>Player</th><th><Tip tip="Their turns in this round, with pauses taken out.">On the clock</Tip></th><th>Turns</th><th><Tip tip="Their longest single turn this round.">Longest</Tip></th></tr></thead>
                    <tbody>
                      {s.names.map((n, seat) => {
                        const mine = s.turns.filter((t) => t.round === r.round && t.seat === seat);
                        const nets = mine.map((t) => t.to - t.from - t.paused);
                        const on = nets.reduce((a, b) => a + b, 0);
                        const max = Math.max(...s.names.map((_, x) => s.turns.filter((t) => t.round === r.round && t.seat === x).reduce((a, t) => a + t.to - t.from - t.paused, 0)));
                        return (
                          <tr key={seat} style={pc(s.names, seat, colors)}>
                            <td className="stats__who">{n}</td>
                            <td><Bar value={on} max={max} label={clock(on)} /></td>
                            <td className="mono-num">{mine.length}</td>
                            <td className="mono-num">{nets.length ? clock(Math.max(...nets)) : '–'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ul className="legend legend--phases">
        <li><i className="legend__dot round__seg--strategy" />Strategy</li>
        <li><i className="legend__dot round__seg--action" />Action</li>
        <li><i className="legend__dot round__seg--status" />Status</li>
      </ul>
      <p className="muted stats__note">
        Turns got slower as the evening went on: {clock(s.roundSummary[0].avgTurn)} on average in round one, {clock(s.roundSummary[s.roundSummary.length - 2].avgTurn)} in round {s.roundSummary.length - 1}. The turn counts barely changed.
      </p>
    </section>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="bar">
      <i style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      <span className="mono-num">{label}</span>
    </span>
  );
}

type Col = { key: string; label: string; tip: string; value(p: PlayerStats): number; show(p: PlayerStats): string };
const COLS: Col[] = [
  { key: 'turns', label: 'Turns', tip: 'Turns taken in the action phases, passes included.', value: (p) => p.turns, show: (p) => String(p.turns) },
  { key: 'onClock', label: 'On the clock', tip: 'All their turns added up, with pauses taken out. This includes time spent waiting for others to answer a strategy card they played.', value: (p) => p.onClock, show: (p) => clock(p.onClock) },
  { key: 'waiting', label: 'Waiting', tip: 'Of their time on the clock, how much was waiting for everyone else to answer a strategy card they had played.', value: (p) => p.waiting, show: (p) => clock(p.waiting) },
  { key: 'median', label: 'Typical turn', tip: 'The median turn: half their turns were shorter than this, half longer. A fairer picture than the average, which one long think can skew.', value: (p) => p.median, show: (p) => clock(p.median) },
  { key: 'longest', label: 'Longest', tip: 'Their longest single turn, with pauses taken out.', value: (p) => p.longest, show: (p) => clock(p.longest) },
  { key: 'response', label: 'Answering cards', tip: "Average time to tap when somebody else's strategy card was played: how long their secondary took, or how long until they declined it.", value: (p) => p.response.avg, show: (p) => clock(p.response.avg) },
  { key: 'passedFirst', label: 'Passed first', tip: 'Rounds in which they were the first player to pass.', value: (p) => p.passedFirst, show: (p) => String(p.passedFirst) },
  { key: 'refused', label: 'Idle presses', tip: 'Presses on their button that the rules refused or that meant nothing at that moment. See the section below for what they were.', value: (p) => p.refused, show: (p) => String(p.refused) },
];

function Players({ s, colors }: { s: GameStats; colors: string[] }) {
  const [sort, setSort] = useState<string>('onClock');
  const col = COLS.find((c) => c.key === sort)!;
  const rows = [...s.players].sort((a, b) => col.value(b) - col.value(a));
  const max = Math.max(...s.players.map((p) => p.onClock));
  return (
    <section className="panel stats__card">
      <h2>Player by player <Tip tip="Click a column heading to sort by it. Hover a heading for what it measures.">?</Tip></h2>
      <div className="stats__scroll">
        <table className="stats__table">
          <thead>
            <tr>
              <th>Player</th>
              {COLS.map((c) => (
                <th key={c.key} aria-sort={sort === c.key ? 'descending' : 'none'}>
                  <button type="button" className="stats__sort" data-on={sort === c.key || undefined} onClick={() => setSort(c.key)}><Tip tip={c.tip}>{c.label}</Tip></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.seat} style={pc(s.names, p.seat, colors)}>
                <td className="stats__who">{p.name}</td>
                {COLS.map((c) => (
                  <td key={c.key} className="mono-num" data-on={sort === c.key || undefined}>
                    {c.key === 'onClock' ? <Bar value={p.onClock} max={max} label={clock(p.onClock)} /> : c.show(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted stats__note">
        {(() => {
          const byMedian = [...s.players].sort((a, b) => b.median - a.median);
          const byClock = [...s.players].sort((a, b) => b.onClock - a.onClock);
          const quick = [...s.players].sort((a, b) => a.median - b.median)[0];
          const first = [...s.players].sort((a, b) => b.passedFirst - a.passedFirst)[0];
          return `${byMedian[0].name} had the longest typical turn at ${clock(byMedian[0].median)}; ${byClock[0].name} had the most time on the clock overall. ${quick.name} was quickest by typical turn. ${first.name} passed first in ${first.passedFirst} of the ${s.rounds} rounds, which is why ${first.name} took fewer turns.`;
        })()}
      </p>
    </section>
  );
}

function Cards({ s, colors }: { s: GameStats; colors: string[] }) {
  const total = s.plays.reduce((a, p) => a + (p.secondariesMs ?? 0), 0);
  const slowest = [...s.plays].filter((p) => p.secondariesMs != null).sort((a, b) => b.secondariesMs! - a.secondariesMs!).slice(0, 3);
  const maxSec = Math.max(...s.plays.map((p) => p.secondariesMs ?? 0));
  return (
    <section className="panel stats__card">
      <h2>Strategy cards <Tip tip="Every strategy card played, in order. The bar is how long the table waited for everyone to answer the secondary. Hover a bar for who took longest.">?</Tip></h2>
      <p className="muted stats__note">
        {s.plays.length} cards played. The table waited <b>{clock(total)}</b> in all for secondaries, {clock(total / s.plays.length)} per card on average.
        {s.plays.some((p) => p.primaryMs != null && p.primaryMs > 0) && ' Early on the card\'s owner did the primary first and everyone else was called after; from round two everyone was called at once.'}
        {' '}Slowest: {slowest.map((p) => `${s.names[p.by]}'s ${cardByNumber(p.card).name} in round ${p.round} (${clock(p.secondariesMs!)})`).join(', ')}.
      </p>
      <div className="stats__scroll">
        <table className="stats__table stats__table--tight">
          <thead>
            <tr>
              <th>Round</th><th>When</th><th>Card</th><th>Played by</th>
              <th><Tip tip="Time the owner spent on the primary before everyone else was called. A dash means everyone was called at once.">Primary</Tip></th>
              <th><Tip tip="From everyone being called to the last player tapping that they were done with, or declined, the secondary.">Everyone answered in</Tip></th>
            </tr>
          </thead>
          <tbody>
            {s.plays.map((p, i) => {
              const c = cardByNumber(p.card);
              const slowestResp = [...p.responses].sort((a, b) => b.ms - a.ms)[0];
              return (
                <tr key={i} style={pc(s.names, p.by, colors)}>
                  <td className="mono-num">R{p.round}</td>
                  <td className="mono-num muted">{timeOfDay(p.at)}</td>
                  <td><span className="cardpip" style={{ '--cc': c.color } as CSSProperties}>{c.n}</span> {c.name}</td>
                  <td className="stats__who">{s.names[p.by]}</td>
                  <td className="mono-num">{p.primaryMs ? clock(p.primaryMs) : '–'}</td>
                  <td>
                    {p.secondariesMs != null ? (
                      <Tip block tip={slowestResp ? `Last to answer: ${s.names[slowestResp.seat]} after ${clock(slowestResp.ms)}` : 'Everyone answered at once'}>
                        <Bar value={p.secondariesMs} max={maxSec} label={clock(p.secondariesMs)} />
                      </Tip>
                    ) : '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Longest({ s, colors }: { s: GameStats; colors: string[] }) {
  const net = (t: GameStats['turns'][number]) => t.to - t.from - t.paused;
  const top = [...s.turns].sort((a, b) => net(b) - net(a)).slice(0, 10);
  const plain = s.turns.filter((t) => !t.card);
  const over = plain.filter((t) => net(t) > 5 * 60_000).length;
  return (
    <section className="panel stats__card">
      <h2>The ten longest turns <Tip tip="Pauses taken out. A turn with a strategy card includes the time everyone else took to answer it, so plain turns are the better measure of a long think.">?</Tip></h2>
      <ol className="longest">
        {top.map((t, i) => (
          <li key={i} style={pc(s.names, t.seat, colors)}>
            <b className="mono-num">{clock(net(t))}</b>
            <span className="stats__who">{s.names[t.seat]}</span>
            <span className="muted">round {t.round}, {timeOfDay(t.from)}</span>
            {t.card && <Tip tip={`Played ${cardByNumber(t.card).name}; the others took ${clock(t.waiting)} to answer, which is part of this turn.`}><span className="cardpip" style={{ '--cc': cardByNumber(t.card).color } as CSSProperties}>{t.card}</span></Tip>}
            {t.paused > 0 && <span className="muted">({spoken(t.paused)} paused, not counted)</span>}
          </li>
        ))}
      </ol>
      <p className="muted stats__note">{over} of the {plain.length} plain turns, with no card played, ran over five minutes. The median plain turn was {clock([...plain.map(net)].sort((a, b) => a - b)[Math.floor(plain.length / 2)])}.</p>
    </section>
  );
}

function Refusals({ s, colors }: { s: GameStats; colors: string[] }) {
  const byWhy = new Map<string, number>();
  for (const r of s.refusals) byWhy.set(r.why, (byWhy.get(r.why) ?? 0) + r.n);
  const total = s.refusals.reduce((a, r) => a + r.n, 0);
  const max = Math.max(...s.players.map((p) => p.refused));
  return (
    <section className="panel stats__card">
      <h2>Presses that did nothing <Tip tip="Every press the engine refused or ignored: wrong gesture for the moment, or nothing being asked of that player. Hover a bar for the breakdown.">?</Tip></h2>
      <p className="muted stats__note">{total} in all. The big one: tapping your own button on your own turn, which does nothing because a hold ends the turn and a double-tap plays the card. Either people expect a tap to mean "done", or they fidget. Worth a think.</p>
      <ul className="refused">
        {[...s.players].sort((a, b) => b.refused - a.refused).map((p) => {
          const mine = s.refusals.filter((r) => r.seat === p.seat).sort((a, b) => b.n - a.n);
          return (
            <li key={p.seat} style={pc(s.names, p.seat, colors)}>
              <span className="stats__who">{p.name}</span>
              <Tip block tip={mine.map((r) => `${r.n}× ${r.why}`).join('\n') || 'None'}>
                <Bar value={p.refused} max={max} label={String(p.refused)} />
              </Tip>
            </li>
          );
        })}
      </ul>
      <table className="stats__table stats__table--tight">
        <thead><tr><th>What happened</th><th>Times</th></tr></thead>
        <tbody>
          {[...byWhy.entries()].sort((a, b) => b[1] - a[1]).map(([why, n]) => <tr key={why}><td>{why}</td><td className="mono-num">{n}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}

function Breaks({ s }: { s: GameStats }) {
  return (
    <section className="panel stats__card">
      <h2>Breaks <Tip tip="Pauses are the host pressing pause. Quiet stretches are four minutes or more with nobody pressing anything and the clock not paused: a break nobody marked, or a very long think.">?</Tip></h2>
      <div className="stats__cols">
        <div>
          <h3>Paused <span className="muted mono-num">{clock(s.pauses.reduce((a, p) => a + p.to - p.from, 0))}</span></h3>
          <ul className="plain">
            {s.pauses.map((p, i) => <li key={i}><b className="mono-num">{clock(p.to - p.from)}</b> <span className="muted">{timeOfDay(p.from)}, round {p.round}{p.active != null ? `, ${s.names[p.active]}'s turn` : ''}</span></li>)}
          </ul>
        </div>
        <div>
          <h3>Quiet stretches, unpaused <span className="muted mono-num">{clock(s.gaps.reduce((a, g) => a + g.to - g.from, 0))}</span></h3>
          <ul className="plain">
            {[...s.gaps].sort((a, b) => (b.to - b.from) - (a.to - a.from)).map((g, i) => <li key={i}><b className="mono-num">{clock(g.to - g.from)}</b> <span className="muted">{timeOfDay(g.from)}, round {g.round}, {PHASE_NAME[g.phase].toLowerCase()} phase{g.active != null ? `, ${s.names[g.active]}'s turn` : ''}</span></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Passing({ s, colors }: { s: GameStats; colors: string[] }) {
  return (
    <section className="panel stats__card">
      <h2>Who passed when <Tip tip="The order players passed in each round, first to last. Passing early means fewer turns and less time on the clock.">?</Tip></h2>
      <div className="passing">
        {s.passes.map((r) => (
          <div key={r.round} className="passing__row">
            <span className="round__n mono-num">R{r.round}</span>
            {r.order.map((seat, i) => <span key={seat} className="passing__chip" style={pc(s.names, seat, colors)}><small>{i + 1}</small>{s.names[seat]}</span>)}
          </div>
        ))}
      </div>
    </section>
  );
}
