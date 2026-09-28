import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deviceTag } from '../engine/engine';
import { useStore } from '../state/createStore';
import { createProfile, ownerOfButton, profilesStore, registerButton } from '../state/profiles';
import { syncProfiles } from '../state/profileSync';
import { WHO, WhoAreYou } from './Join';
import '../styles/setup.css';
import '../styles/join.css';

/**
 * Where the tag on a real button takes a phone. Every button carries /b/<its tag> on an NFC sticker or QR code; what
 * the page does depends on what is known about the button:
 *  - nobody has registered it: ask whose it is, and remember;
 *  - its owner is in a game right now: straight into the phone app for that game as them, alongside the button;
 *  - its owner is between games: their profile.
 */

interface Info {
  id: string;
  owner: { id: string; name: string } | null;
  game: { code: string; seat: number; name: string; profileId: string | null; round: number; phase: string } | null;
}

export function ButtonLink() {
  const { id = '' } = useParams();
  const tag = deviceTag(id);
  const navigate = useNavigate();
  const profiles = useStore(profilesStore);
  const [info, setInfo] = useState<Info | 'offline' | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    setInfo(null);
    void syncProfiles();
    fetch(`/api/button?id=${tag}`)
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: Info) => live && setInfo(body))
      .catch(() => live && setInfo('offline'));
    return () => {
      live = false;
    };
  }, [tag, tries]);

  // The site's answer, corrected by what this browser knows (it may have just registered the button itself).
  const local = ownerOfButton(tag, profiles);
  const owner = local ? { id: local.id, name: local.name } : info && info !== 'offline' ? info.owner : null;
  const game = info && info !== 'offline' ? info.game : null;

  const openGame = (code: string, as: string) => {
    localStorage.setItem(WHO, as);
    navigate(`/join/${code}?as=${as}`, { replace: true });
  };
  useEffect(() => {
    if (owner && game && !claiming) openGame(game.code, owner.id);
  }, [owner?.id, game?.code, claiming]); // eslint-disable-line react-hooks/exhaustive-deps

  const claim = (profileId: string) => {
    registerButton(profileId, tag);
    localStorage.setItem(WHO, profileId);
    setClaiming(false);
    if (game) openGame(game.code, profileId);
  };

  if (!tag) return <Shell title="Not a button" text="This link is missing the button's id." />;
  if (info === null) return <Shell eyebrow={`Button ${tag}`} title="One moment" text="Looking this button up…" />;
  if (info === 'offline') {
    return (
      <Shell eyebrow={`Button ${tag}`} title="Can't reach the site" text="The button's page needs the site to know whose it is and which game it's in.">
        <button type="button" className="btn btn--sm" onClick={() => setTries((n) => n + 1)}>Try again</button>
      </Shell>
    );
  }

  if (!owner || claiming) {
    return (
      <WhoAreYou
        eyebrow={game ? `${game.name} is using this button in game ${game.code}. Whose is it?` : 'Whose button is this?'}
        profiles={profiles}
        first={[game?.profileId ?? '', localStorage.getItem(WHO) ?? '']}
        onPick={claim}
        onCreate={(name) => {
          const existing = profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
          claim((existing ?? createProfile(name)).id);
        }}
        onSkip={owner ? () => setClaiming(false) : undefined}
      />
    );
  }

  if (game) return <Shell eyebrow={`Button ${tag}`} title={`${owner.name}'s button`} text={`Opening game ${game.code}…`} />;

  return (
    <Shell eyebrow={`Button ${tag}`} title={`${owner.name}'s button`} text="Not in a game right now. When it is, this tag opens the game on your phone.">
      <Link to="/me" className="btn btn--sm btn--gold" onClick={() => localStorage.setItem(WHO, owner.id)}>Your profile</Link>
      <Link to="/join" className="btn btn--sm btn--ghost">Join a game by code</Link>
      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setClaiming(true)}>Not yours? Claim it</button>
    </Shell>
  );
}

function Shell({ eyebrow = 'Pax Buttonica', title, text, children }: { eyebrow?: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="join join--ask">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
      {children && <div className="center__actions">{children}</div>}
    </div>
  );
}
