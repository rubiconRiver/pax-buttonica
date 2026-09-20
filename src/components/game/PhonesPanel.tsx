import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { closeRoom, openRoom, roomStatus } from '../../remote/host';
import { useStore } from '../../state/createStore';
import '../../styles/game.css';

export function PhonesPanel({ onClose }: { onClose(): void }) {
  const room = useStore(roomStatus);
  const ref = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const url = room.code ? `${location.origin}/join/${room.code}` : null;

  useEffect(() => {
    if (!url) return setQr(null);
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

  return (
    <div className="popover popover--phones panel" ref={ref}>
      {room.state === 'closed' ? (
        <>
          <p className="room__note">Open a room and any phone becomes a button: same lights, same tap, double-tap and hold. Players say who they are and can set their own entrance and exit sounds from there.</p>
          <button type="button" className="btn btn--gold" onClick={() => void openRoom()}>Open a room</button>
        </>
      ) : (
        <>
          <div className="eyebrow">{room.state === 'open' ? 'Scan, or type the code' : 'Opening…'}</div>
          <div className="room__code">{room.code}</div>
          {qr && room.state === 'open' && <img className="room__qr" src={qr} alt={`QR code for ${url}`} />}
          {url && <div className="room__url">{url.replace(/^https?:\/\//, '')}</div>}
          <div className="room__note">
            <b>{room.phones.length}</b> phone{room.phones.length === 1 ? '' : 's'} connected. A phone that says who it is takes that player's seat by itself; anyone else claims one at the next seat claiming.
            {room.error && <div style={{ color: 'var(--danger)' }}>{room.error}</div>}
          </div>
          <button type="button" className="btn btn--sm btn--danger" onClick={closeRoom}>Close the room</button>
        </>
      )}
    </div>
  );
}
