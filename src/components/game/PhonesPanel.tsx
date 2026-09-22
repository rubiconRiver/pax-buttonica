import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../engine/types';
import { syncStatus } from '../../remote/sync';
import { useStore } from '../../state/createStore';
import { profilesStore } from '../../state/profiles';
import '../../styles/game.css';

const SITE_WORDS = {
  idle: 'Saving to the site…',
  saving: 'Saving to the site…',
  saved: 'Saved to the site',
  offline: 'Not reaching the site: phones cannot join, and the game is only in this browser',
  taken: 'Picked up on another laptop: this copy no longer saves',
};

/** The game's code and QR, who has joined on a phone, and whether the site has the latest copy. */
export function PhonesPanel({ game, onClose }: { game: GameState; onClose(): void }) {
  const sync = useStore(syncStatus);
  const profiles = useStore(profilesStore);
  const ref = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const url = `${location.origin}/join/${game.code}`;

  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(url, { margin: 0, scale: 8, errorCorrectionLevel: 'M' }).then((d) => live && setQr(d));
    return () => {
      live = false;
    };
  }, [url]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement!.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const who = (dev: string, profileId: string | null) => {
    const seat = game.bindings.indexOf(dev);
    if (seat >= 0) return game.players[seat].name;
    const p = profileId ? profiles.find((x) => x.id === profileId) : undefined;
    return p ? `${p.name} (not seated)` : 'a phone, not yet anyone';
  };

  return (
    <div className="popover popover--phones panel" ref={ref}>
      <div className="eyebrow">Scan, or type the code</div>
      <div className="room__code">{game.code}</div>
      {qr && <img className="room__qr" src={qr} alt={`QR code for ${url}`} />}
      <div className="room__url">{url.replace(/^https?:\/\//, '')}</div>
      <div className="room__note">
        Any phone becomes a button: same lights, same tap, double-tap and hold, about a second behind. A phone that says who it is takes that player's seat by itself; anyone else claims one at the next seat claiming. The same code on another laptop picks the whole game up.
      </div>
      {sync.phones.length > 0 && (
        <ul className="room__phones">
          {sync.phones.map((p) => <li key={p.dev}>{who(p.dev, p.profileId)}</li>)}
        </ul>
      )}
      <div className="room__note room__site" data-state={sync.site}>{SITE_WORDS[sync.site]}</div>
    </div>
  );
}
