import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sfx } from '../../audio/synth';
import type { Action, GameState, Phase } from '../../engine/types';
import { connectHub, hubStatus, serialSupported } from '../../hardware/serial';
import { useStore } from '../../state/createStore';
import { settingsStore } from '../../state/settings';
import { IconPhone, IconGear, IconLock, IconMute, IconPause, IconPlay, IconRedo, IconSound, IconUndo, IconUsb, IconWhistle } from '../Icons';
import { RefereePanel } from './RefereePanel';
import { PhonesPanel } from './PhonesPanel';
import { syncStatus } from '../../remote/sync';
import { SettingsPanel } from './SettingsPanel';

const PHASES: { id: Phase; label: string }[] = [
  { id: 'strategy', label: 'Strategy' },
  { id: 'action', label: 'Action' },
  { id: 'status', label: 'Status' },
  { id: 'agenda', label: 'Agenda' },
];

interface Props {
  game: GameState;
  demo: boolean;
  canUndo: boolean;
  canRedo: boolean;
  dispatch(a: Action): void;
  onUndo(): void;
  onRedo(): void;
  onExit(): void;
  onScoreboard(): void;
}

export function TopBar({ game, demo, canUndo, canRedo, dispatch, onUndo, onRedo, onExit, onScoreboard }: Props) {
  const settings = useStore(settingsStore);
  const hub = useStore(hubStatus);
  const sync = useStore(syncStatus);
  const [showSettings, setShowSettings] = useState(false);
  const [showPhones, setShowPhones] = useState(false);
  const [showReferee, setShowReferee] = useState(false);

  return (
    <header className="topbar">
      <Link to="/" className="brand" title="Back to the home page">
        <span className="brand__dot" />
        <span>Pax <b>Buttonica</b></span>
      </Link>

      <div className="phases" aria-label="Round progress">
        <span className="phases__round mono-num">R{game.round}</span>
        {PHASES.map((p) => {
          const locked = p.id === 'agenda' && !game.custodiansRemoved;
          return (
            <span key={p.id} className="phases__step" data-on={game.phase === p.id || undefined} data-locked={locked || undefined} title={locked ? 'Unlocks when the custodians leave Mecatol Rex' : undefined}>
              {locked && <IconLock />}
              {p.label}
            </span>
          );
        })}
      </div>

      <div className="topbar__tools">
        {demo && <span className="chip chip--gold">Demo</span>}
        <button type="button" className="btn btn--sm btn--gold" title="Objectives, points and laws, big enough to read from across the table (B)" onClick={() => { sfx.click(); onScoreboard(); }}>
          Scoreboard
        </button>
        <button
          type="button"
          className="btn btn--sm"
          aria-pressed={game.custodiansRemoved}
          title="Toggle when someone takes Mecatol Rex"
          onClick={() => { sfx.click(); dispatch({ type: 'SET_CUSTODIANS', removed: !game.custodiansRemoved }); }}
        >
          Custodians {game.custodiansRemoved ? 'gone' : 'on Rex'}
        </button>
        <button type="button" className="btn btn--sm btn--icon" aria-pressed={game.paused} title={game.paused ? 'Resume the turn clock' : 'Pause the turn clock'} onClick={() => { sfx.click(); dispatch({ type: game.paused ? 'RESUME' : 'PAUSE', at: Date.now() }); }}>
          {game.paused ? <IconPlay /> : <IconPause />}
        </button>
        <button type="button" className="btn btn--sm" disabled={!canUndo} title="Undo (⌘Z)" onClick={() => { sfx.click(); onUndo(); }}>
          <IconUndo /> Undo
        </button>
        {canRedo && (
          <button type="button" className="btn btn--sm btn--icon" title="Redo (⇧⌘Z)" aria-label="Redo" onClick={() => { sfx.click(); onRedo(); }}>
            <IconRedo />
          </button>
        )}
        {!demo && (
          <div className="popover-anchor">
            <button type="button" className="btn btn--sm" aria-pressed={showReferee} title="Referee: hand the turn over, un-pass someone, cancel a card, jump a phase" onClick={() => { sfx.click(); setShowReferee((v) => !v); }}>
              <IconWhistle /> Referee
            </button>
            {showReferee && <RefereePanel game={game} dispatch={dispatch} onClose={() => setShowReferee(false)} />}
          </div>
        )}
        <button type="button" className="btn btn--sm btn--icon" title={settings.sound ? 'Mute' : 'Unmute'} onClick={() => settingsStore.set((s) => ({ ...s, sound: !s.sound }))}>
          {settings.sound ? <IconSound /> : <IconMute />}
        </button>
        {hub.connected && hub.devices.some((d) => d.mv != null && d.mv < 4400) && (
          <span className="chip" style={{ borderColor: 'var(--danger)', color: '#ffd9de' }} title="Under about 4.4 V the cells are nearly empty. Swap them at the next break.">
            Low battery: {hub.devices.filter((d) => d.mv != null && d.mv < 4400).map((d) => { const seat = game.bindings.indexOf(d.dev); return seat >= 0 ? game.players[seat].name : d.dev.slice(-4); }).join(', ')}
          </span>
        )}
        {serialSupported() && (
          <button type="button" className="btn btn--sm" aria-pressed={hub.connected} title="Connect the USB hub. An Atom you've allowed before connects by itself." onClick={() => void connectHub()}>
            <IconUsb /> {hub.connected ? `Hub · ${hub.devices.length}` : 'Hub'}
          </button>
        )}
        {!demo && (
          <div className="popover-anchor">
            <button type="button" className="btn btn--sm" aria-pressed={showPhones} title="The game's code. Phones join with it, and it's how another laptop picks the game up." onClick={() => { sfx.click(); setShowPhones((v) => !v); }}>
              <IconPhone /> {game.code} · {sync.phones.length}
            </button>
            {showPhones && <PhonesPanel game={game} onClose={() => setShowPhones(false)} />}
          </div>
        )}
        <div className="popover-anchor">
          <button type="button" className="btn btn--sm btn--icon" aria-pressed={showSettings} title="Settings" onClick={() => { sfx.click(); setShowSettings((v) => !v); }}>
            <IconGear />
          </button>
          {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onExit={onExit} onReseat={() => dispatch({ type: 'START_SEATING', at: Date.now() })} onPrimaryStage={(on) => dispatch({ type: 'SET_PRIMARY_STAGE', on })} demo={demo} />}
        </div>
      </div>
    </header>
  );
}
