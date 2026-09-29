import { Component, useState, useSyncExternalStore, type ReactNode } from 'react';
import { archiveGame, exportGame } from '../state/archive';
import { lastUndoable, type GameStore } from '../state/game';

interface Props {
  /** The game this page hosts, if it hosts one: then the crash screen can take back the last action, save the log or end the game. */
  store?: GameStore;
  children: ReactNode;
}

/**
 * If anything throws while the page draws, this shows instead of a blank page. The game is saved in this browser,
 * so a state that breaks the screen breaks it again on every reload; the way out has to work without the table.
 */
export class CrashGuard extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <CrashScreen store={this.props.store} error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}

const NO_STORE = () => () => {};

function CrashScreen({ store, error, onRetry }: { store?: GameStore; error: Error; onRetry(): void }) {
  const slot = useSyncExternalStore(store?.subscribe ?? NO_STORE, () => store?.get() ?? null);
  const [oops, setOops] = useState<string | null>(null);
  const hosting = !!slot?.base;
  // Anything here may meet the same broken state that brought the page down, so each way out catches its own fall.
  const attempt = (what: string, fn: () => void) => () => {
    try {
      setOops(null);
      fn();
    } catch (e) {
      setOops(`${what} didn't work: ${(e as Error).message}`);
    }
  };
  const undo = attempt('Undo', () => {
    store!.undo();
    onRetry();
  });
  const download = attempt('Saving the log', () => {
    const { base, events, game } = store!.get();
    // The log runs from how the game began, so that is where its name and players come from.
    exportGame({ code: base!.code, base: base!, events, players: base!.players.map((p) => p.name) }, game);
  });
  const end = attempt('Ending the game', () => {
    if (!window.confirm('End this game? The table will be cleared.')) return;
    try {
      archiveGame(store!.get());
    } catch {
      // A game too broken to file away still has to be cleared; its log can be saved first with the button beside this one.
    }
    store!.clear();
    onRetry();
  });

  return (
    <div className="crash" role="alert">
      <div className="crash__card panel panel--ticks">
        <div className="eyebrow">Pax Buttonica</div>
        <h1>The screen hit a snag</h1>
        {hosting ? (
          <p>
            The game is safe in this browser. <b>Undo last action</b> rebuilds the table from the log without it (Redo puts
            it back); save the log first if you like.
          </p>
        ) : (
          <p>Nothing about the game is lost. Try again, or reload the page.</p>
        )}
        <div className="crash__actions">
          {hosting && (
            <>
              <button type="button" className="btn btn--gold" disabled={lastUndoable(slot.events) < 0} onClick={undo}>Undo last action</button>
              <button type="button" className="btn" onClick={download}>Download log</button>
            </>
          )}
          {!hosting && <button type="button" className="btn btn--gold" onClick={onRetry}>Try again</button>}
          <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
          {hosting && <button type="button" className="btn btn--ghost btn--danger" onClick={end}>End this game…</button>}
        </div>
        {oops && <p className="crash__oops">{oops}</p>}
        <code className="crash__error">{error.message}</code>
      </div>
    </div>
  );
}
