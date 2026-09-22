import { useState } from 'react';
import { Link } from 'react-router-dom';
import { saveClip } from '../audio/clips';
import { useStore } from '../state/createStore';
import { createProfile, patchProfile, profilesStore } from '../state/profiles';
import { syncStatus } from '../state/profileSync';
import { ProfileSheet, WHO, WhoAreYou } from './Join';

/** Set yourself up at home: no room, no game, just your name, colour and sounds. */
export function Me() {
  const profiles = useStore(profilesStore);
  const sync = useStore(syncStatus);
  const [id, setId] = useState(() => localStorage.getItem(WHO));
  const [oops, setOops] = useState<string | null>(null);
  const me = profiles.find((p) => p.id === id);

  const become = (next: string | null) => {
    if (next) localStorage.setItem(WHO, next);
    else localStorage.removeItem(WHO);
    setId(next);
  };

  if (!me) {
    if (sync === 'starting') return <div className="join join--ask"><p className="muted">Loading players…</p></div>;
    return (
      <WhoAreYou
        eyebrow={sync === 'offline' ? 'Offline: changes stay on this device for now' : 'Pax Buttonica'}
        profiles={profiles}
        first={id ? [id] : []}
        onPick={become}
        onCreate={(name) => {
          const existing = profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
          become((existing ?? createProfile(name)).id);
        }}
      />
    );
  }

  return (
    <div className="join join--ask">
      <div className="eyebrow">{sync === 'synced' ? 'Saved' : sync === 'offline' ? 'Offline: will save when back online' : 'Saving…'}</div>
      <h1>{me.name}</h1>
      <p className="muted">That's you sorted. Next game night, scan the code on the big screen and your phone already knows who you are.</p>
      <Link to="/" className="btn btn--sm btn--ghost">Back to the site</Link>
      <ProfileSheet
        me={me}
        oops={oops}
        onEdit={(patch) => { setOops(null); patchProfile(me.id, patch); }}
        onClip={async (slot, file) => {
          try {
            setOops(null);
            patchProfile(me.id, { [slot]: { kind: 'clip', ...(await saveClip(file)) } });
          } catch (err) {
            setOops((err as Error).message);
          }
        }}
        onSwitch={() => become(null)}
        onClose={() => history.back()}
      />
    </div>
  );
}
