import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AdminView, Card, PlayerView, RevealView, View } from '../../api/_secretsDraft';
import '../styles/secrets.css';

/**
 * Secret objectives, dealt ahead of game night. A tool of its own: it starts no game and knows nothing of one.
 *
 *   /secrets          set a deal up: who is playing
 *   /secrets/<link>   what that link is for: the dashboard, one player's two cards, or the card puller's list
 *
 * Whoever sets the deal up sees who has picked and never what. The cards are dealt and kept on the site
 * (api/secrets.ts); a player's link, and the puller's, show nothing until asked and then lock to that device.
 */

const DEV = 'pb.secrets.dev';
const MINE = 'pb.secrets.mine';
const MIN = 2;
const MAX = 8;

/** This browser, as the site knows it: links lock to the first one that opens them. */
function deviceId(): string {
  let d = localStorage.getItem(DEV);
  if (!d) {
    d = crypto.randomUUID();
    localStorage.setItem(DEV, d);
  }
  return d;
}

interface Mine {
  key: string;
  title: string;
  names: string[];
  at: number;
}
function myDeals(): Mine[] {
  try {
    const list = JSON.parse(localStorage.getItem(MINE) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

class Unreachable extends Error {}
async function ask<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  } catch {
    throw new Unreachable("Can't reach the site.");
  }
  if (!(res.headers.get('content-type') ?? '').includes('json')) throw new Unreachable("Can't reach the site.");
  const json = await res.json();
  if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'That did not work.');
  return json as T;
}

const when = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const linkTo = (key: string) => `${location.origin}/secrets/${key}`;

export function Secrets() {
  const { key } = useParams();
  return key ? <Opened key={key} k={key} /> : <NewDeal />;
}

function Page({ eyebrow, title, children, wide }: { eyebrow: string; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="secrets" data-wide={wide || undefined}>
      <header className="secrets__head">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </header>
      {children}
    </div>
  );
}

// ── Setting a deal up ───────────────────────────────────────────────────────

function NewDeal() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [pok, setPok] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = text.split('\n').map((n) => n.trim()).filter(Boolean);
  const mine = myDeals();

  const deal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { key } = await ask<{ key: string }>('/api/secrets', { op: 'create', names, title, pok });
      localStorage.setItem(MINE, JSON.stringify([{ key, title: title.trim(), names, at: Date.now() }, ...mine].slice(0, 12)));
      navigate(`/secrets/${key}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Page eyebrow="Twilight Imperium · Thunder's Edge" title="Secret objectives, dealt early">
      <p className="secrets__lead">
        Everyone gets a private link with two secret objectives and keeps one, before game night. You see who has picked. You never see what:
        somebody who isn't playing pulls the cards from the deck.
      </p>
      <form className="panel secrets__form" onSubmit={deal}>
        <label className="secrets__field">
          <span>Players, one on each line</span>
          <textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Garett\nAlan\nBranson'} autoFocus spellCheck={false} />
        </label>
        <label className="secrets__field">
          <span>What to call it (optional)</span>
          <input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Game night, 28 November" />
        </label>
        <label className="secrets__check">
          <input type="checkbox" checked={pok} onChange={(e) => setPok(e.target.checked)} />
          <span>Prophecy of Kings secrets are in the deck ({pok ? 40 : 20} cards)</span>
        </label>
        <div className="secrets__go">
          <button type="submit" className="btn btn--gold btn--lg" disabled={busy || names.length < MIN || names.length > MAX}>
            {busy ? 'Dealing…' : 'Deal the secrets'}
          </button>
          <span className="muted" data-testid="count">
            {names.length === 0 ? `${MIN} to ${MAX} players` : names.length > MAX ? `${names.length} players: ${MAX} at most` : `${names.length} ${names.length === 1 ? 'player' : 'players'}`}
          </span>
        </div>
        {error && <p className="secrets__error" role="alert">{error}</p>}
      </form>
      {mine.length > 0 && (
        <section className="secrets__mine">
          <h2>Deals made on this device</h2>
          <ul>
            {mine.map((m) => (
              <li key={m.key}>
                <Link to={`/secrets/${m.key}`}>{m.title || 'Secret objectives'}</Link>
                <span className="muted">{m.names.join(', ')} · {when(m.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

// ── A link, opened ──────────────────────────────────────────────────────────

/** What a link shows, kept fresh, and a way to do things with it. */
function useLinkView(k: string, everyMs: (v: View | null) => number | null) {
  const [view, setView] = useState<View | null>(null);
  const [problem, setProblem] = useState<{ text: string; gone: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const dev = useRef(deviceId()).current;

  const refresh = useCallback(async () => {
    try {
      setView(await ask<View>(`/api/secrets?k=${encodeURIComponent(k)}&dev=${dev}`));
      setProblem(null);
    } catch (e) {
      // A dashboard that misses one poll keeps what it has; only a first load has nothing to show.
      setProblem({ text: (e as Error).message, gone: !(e instanceof Unreachable) });
    }
  }, [k, dev]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const ms = everyMs(view);
  useEffect(() => {
    if (!ms) return;
    const id = setInterval(() => void refresh(), ms);
    return () => clearInterval(id);
  }, [ms, refresh]);

  const act = useCallback(
    async (op: Record<string, unknown>) => {
      setBusy(true);
      setRefusal(null);
      try {
        setView(await ask<View>('/api/secrets', { ...op, k, dev }));
        return true;
      } catch (e) {
        setRefusal((e as Error).message);
        void refresh();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [k, dev, refresh],
  );
  return { view, problem, busy, refusal, act, refresh };
}

function Opened({ k }: { k: string }) {
  const link = useLinkView(k, (v) => (v?.role === 'admin' ? 5000 : v?.role === 'reveal' && v.state === 'open' ? 8000 : null));
  const { view, problem } = link;
  if (!view) {
    if (!problem) return <Page eyebrow="Secret objectives" title="One moment">{null}</Page>;
    return (
      <Page eyebrow="Secret objectives" title={problem.gone ? 'No such link' : "Can't reach the site"}>
        <p className="secrets__lead">{problem.gone ? 'This link is not one the site knows. Check that all of it was copied.' : 'Check your connection and try again.'}</p>
        {!problem.gone && <button type="button" className="btn" onClick={() => void link.refresh()}>Try again</button>}
      </Page>
    );
  }
  if (view.role === 'admin') return <Dashboard view={view} link={link} />;
  if (view.role === 'reveal') return <Puller k={k} view={view} link={link} />;
  return <Player view={view} link={link} />;
}

type LinkState = ReturnType<typeof useLinkView>;

// ── The dashboard: who has picked, never what ───────────────────────────────

const SEAT_STATE = { sealed: 'Not opened', choosing: 'Choosing', picked: 'Picked' } as const;

function Dashboard({ view, link }: { view: AdminView; link: LinkState }) {
  const picked = view.seats.filter((s) => s.state === 'picked').length;
  const [again, setAgain] = useState<number | null>(null);
  return (
    <Page eyebrow="Dashboard · this page is yours alone" title={view.title || 'Secret objectives'} wide>
      <p className="secrets__lead">
        Send each player their own link, privately. You can see who has picked, not what: the cards never reach this page. A link locks to the
        first device that opens it, so nobody can look at somebody else's without them finding out.
      </p>
      <div className="secrets__progress" data-done={picked === view.seats.length || undefined}>
        <b>{picked}</b> of {view.seats.length} have picked
        <span className="secrets__bar"><i style={{ width: `${(picked / view.seats.length) * 100}%` }} /></span>
      </div>
      <ul className="secrets__seats">
        {view.seats.map((s, i) => (
          <li key={s.key} className="panel secrets__seat" data-state={s.state} data-link={linkTo(s.key)}>
            <div className="secrets__who">
              <b>{s.name}</b>
              <span className="secrets__state">{SEAT_STATE[s.state]}</span>
              <span className="muted secrets__when">
                {s.pickedAt ? `picked ${when(s.pickedAt)}` : s.openedAt ? `opened ${when(s.openedAt)}` : 'link not opened yet'}
                {s.redeals > 0 && ` · dealt again ${s.redeals}×`}
              </span>
            </div>
            {again === i ? (
              <div className="secrets__acts">
                <span className="secrets__ask">New cards and a new link for {s.name}? The old link stops working.</span>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  disabled={link.busy}
                  onClick={async () => {
                    await link.act({ op: 'redeal', seat: i });
                    setAgain(null);
                  }}
                >
                  Deal again
                </button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setAgain(null)}>Keep it</button>
              </div>
            ) : (
              <div className="secrets__acts">
                <Copy text={linkTo(s.key)} label={`Copy ${s.name}'s link`} />
                <Share url={linkTo(s.key)} text={`${s.name}, pick your secret objective${view.title ? ` for ${view.title}` : ''}. Open this on your own phone:`} />
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setAgain(i)} title="For a lost phone, or a link opened by the wrong person">Deal again…</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {link.refusal && <p className="secrets__error" role="alert">{link.refusal}</p>}

      <section className="panel panel--ticks secrets__puller">
        <h2>The card puller</h2>
        <p>
          Somebody who isn't playing opens this link, sees every pick, and pulls those cards from the deck for each player. It locks to the device
          that reveals, and this page says when that happened.
        </p>
        <p className="secrets__revealed" data-revealed={view.reveal.at ? '' : undefined}>
          {view.reveal.at ? `Revealed ${when(view.reveal.at)}` : 'Not revealed yet'}
        </p>
        <div className="secrets__acts">
          <Copy text={linkTo(view.reveal.key)} label="Copy the puller's link" gold />
          <Share url={linkTo(view.reveal.key)} text={`You're pulling the secret objectives${view.title ? ` for ${view.title}` : ''}. Open this when everyone has picked:`} />
          <Link to={`/secrets/${view.reveal.key}`} className="btn btn--sm btn--ghost">Hand this device to the puller</Link>
        </div>
      </section>
      <p className="muted secrets__foot">
        {view.deck} cards in the deck. Bookmark this page: it is the only way back to this deal, apart from the list at <Link to="/secrets">/secrets</Link> on this device.
      </p>
    </Page>
  );
}

function Copy({ text, label, gold }: { text: string; label: string; gold?: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'show'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      setTimeout(() => setState('idle'), 1600);
    } catch {
      setState('show'); // no clipboard here: show it to be copied by hand
    }
  };
  if (state === 'show') return <input className="input secrets__url" readOnly value={text} onFocus={(e) => e.target.select()} autoFocus aria-label={label} />;
  return (
    <button type="button" className={`btn btn--sm${gold ? ' btn--gold' : ''}`} onClick={() => void copy()}>
      {state === 'copied' ? 'Copied' : label}
    </button>
  );
}

function Share({ url, text }: { url: string; text: string }) {
  if (typeof navigator.share !== 'function') return null;
  return (
    <button type="button" className="btn btn--sm btn--ghost" onClick={() => void navigator.share({ text, url }).catch(() => {})}>
      Send…
    </button>
  );
}

// ── A player: two cards, keep one ───────────────────────────────────────────

const PHASE: Record<string, string> = { Action: 'Scored in the action phase', Status: 'Scored in the status phase', Agenda: 'Scored in the agenda phase' };

function SecretCard({ card, chosen, onChoose, dim }: { card: Card; chosen?: boolean; onChoose?: () => void; dim?: boolean }) {
  const body = (
    <>
      <span className="secret__kind">Secret objective</span>
      <span className="secret__name">{card.name}</span>
      <span className="secret__text">{card.text}</span>
      {card.phase && <span className="secret__phase">{PHASE[card.phase] ?? card.phase}</span>}
    </>
  );
  if (!onChoose) return <div className="panel secret" data-dim={dim || undefined} data-kept={chosen || undefined}>{body}</div>;
  return (
    <button type="button" className="panel secret" aria-pressed={!!chosen} onClick={onChoose}>
      {body}
    </button>
  );
}

function Player({ view, link }: { view: PlayerView; link: LinkState }) {
  const [choice, setChoice] = useState<string | null>(null);
  const eyebrow = view.title ? `${view.title} · secret objectives` : 'Secret objectives';

  if (view.state === 'replaced') {
    return (
      <Page eyebrow={eyebrow} title="This link was replaced">
        <p className="secrets__lead">{view.name}, you were dealt again and given a new link. Ask whoever is organising for it.</p>
      </Page>
    );
  }
  if (view.state === 'elsewhere') {
    return (
      <Page eyebrow={eyebrow} title="Already opened somewhere else">
        <p className="secrets__lead">
          {view.name}'s link locks to the first phone or computer that opens it, and that wasn't this one. Go back to the device and browser you
          first used.
        </p>
        <p className="muted">If that wasn't you, tell whoever is organising: they can deal you two new cards and a new link.</p>
      </Page>
    );
  }
  if (view.state === 'sealed') {
    return (
      <Page eyebrow={eyebrow} title={`${view.name}, your secrets are ready`}>
        <p className="secrets__lead">You'll see two secret objectives and keep one. Nobody else sees them, not even whoever set this up.</p>
        <p className="muted">Open them on your own phone, somewhere private. This link locks to the first device that opens it.</p>
        <button type="button" className="btn btn--gold btn--lg" disabled={link.busy} onClick={() => void link.act({ op: 'open' })}>
          Show me my two
        </button>
        {link.refusal && <p className="secrets__error" role="alert">{link.refusal}</p>}
      </Page>
    );
  }
  const options = view.options ?? [];
  if (view.state === 'picked') {
    const kept = options.find((c) => c.id === view.pick)!;
    const back = options.find((c) => c.id !== view.pick);
    return (
      <Page eyebrow={eyebrow} title={`${view.name}, you kept`}>
        <SecretCard card={kept} chosen />
        <p className="secrets__lead">Done. The card will be waiting with your things on game night. Keep it to yourself.</p>
        {back && <p className="muted" data-testid="back">Back in the deck: {back.name}.</p>}
      </Page>
    );
  }
  const chosen = options.find((c) => c.id === choice);
  return (
    <Page eyebrow={eyebrow} title={`${view.name}, keep one`}>
      <p className="secrets__lead">Tap the one you want. The other goes back in the deck.</p>
      <div className="secrets__pair">
        {options.map((c) => <SecretCard key={c.id} card={c} chosen={choice === c.id} onChoose={() => setChoice(c.id)} />)}
      </div>
      <button type="button" className="btn btn--gold btn--lg" disabled={!chosen || link.busy} onClick={() => chosen && void link.act({ op: 'pick', card: chosen.id })}>
        {chosen ? `Confirm: keep ${chosen.name}` : 'Choose a card'}
      </button>
      <p className="muted">Once confirmed it can't be changed.</p>
      {link.refusal && <p className="secrets__error" role="alert">{link.refusal}</p>}
    </Page>
  );
}

// ── The card puller: every pick, to pull from the deck ──────────────────────

function Puller({ k, view, link }: { k: string; view: RevealView; link: LinkState }) {
  const store = `pb.secrets.pulled.${k}`;
  const [pulled, setPulled] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(store) ?? '[]');
    } catch {
      return [];
    }
  });
  const toggle = (id: string) => {
    const next = pulled.includes(id) ? pulled.filter((p) => p !== id) : [...pulled, id];
    setPulled(next);
    localStorage.setItem(store, JSON.stringify(next));
  };
  const eyebrow = view.title ? `${view.title} · for the card puller` : 'For the card puller';
  const picked = view.seats.filter((s) => s.state === 'picked');
  const waiting = view.seats.filter((s) => s.state !== 'picked');

  if (view.state === 'elsewhere') {
    return (
      <Page eyebrow={eyebrow} title="Already revealed somewhere else">
        <p className="secrets__lead">
          The picks were revealed {view.at ? `on ${when(view.at)}` : ''} on another device, and stay with it. If that wasn't the card puller, somebody has
          looked who shouldn't have.
        </p>
      </Page>
    );
  }
  if (view.state === 'sealed') {
    return (
      <Page eyebrow={eyebrow} title="Everyone's picks">
        <p className="secrets__lead">
          Revealing shows you every player's secret objective, so you can pull those cards from the deck. Only do it if that is your job and you
          aren't playing.
        </p>
        <p className="secrets__tally">
          <b>{picked.length}</b> of {view.seats.length} have picked.
          {waiting.length > 0 && <> Still to pick: {waiting.map((s) => s.name).join(', ')}. You can reveal now and come back for the rest.</>}
        </p>
        <button type="button" className="btn btn--gold btn--lg" disabled={link.busy} onClick={() => void link.act({ op: 'reveal' })}>
          Reveal the picks
        </button>
        <p className="muted">This locks to this device, and the organiser's page will show that the picks were revealed.</p>
        {link.refusal && <p className="secrets__error" role="alert">{link.refusal}</p>}
      </Page>
    );
  }
  const done = view.seats.filter((s) => s.card && pulled.includes(`${s.name}:${s.card.id}`)).length;
  return (
    <Page eyebrow={eyebrow} title="Pull these cards" wide>
      <p className="secrets__lead">
        Find each card in the secret objective deck and put it face down with that player's things. Tick them off as you go, then shuffle the
        deck. Tell nobody.
      </p>
      <p className="secrets__tally"><b>{done}</b> of {view.seats.length} pulled{waiting.length > 0 && <> · waiting on {waiting.map((s) => s.name).join(', ')}</>}</p>
      <ul className="secrets__pulls">
        {view.seats.map((s) => {
          const id = s.card ? `${s.name}:${s.card.id}` : '';
          return (
            <li key={s.name} className="panel secrets__pull" data-pulled={(s.card && pulled.includes(id)) || undefined} data-waiting={!s.card || undefined}>
              <div className="secrets__pullwho">{s.name}</div>
              {s.card ? (
                <label className="secrets__pullcard">
                  <input type="checkbox" checked={pulled.includes(id)} onChange={() => toggle(id)} aria-label={`Pulled ${s.card.name} for ${s.name}`} />
                  <span>
                    <b>{s.card.name}</b>
                    <small>{s.card.text}</small>
                  </span>
                </label>
              ) : (
                <div className="muted">{s.state === 'choosing' ? 'Still choosing' : "Hasn't opened the link yet"}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
