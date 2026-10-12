import { defineEdit } from 'showreel/core';

/** The pitch: one minute of the happy path at the table. */
const room = (views: { t: number; view: string }[]) => ({
  kind: 'table' as const, probe: 'seats', press: { surface: 'host', pattern: "^(.+?)'s button$|^Unclaimed button (\\d+)$" }, views,
});
const shot = (from: string, to: string, views: { t: number; view: string }[], extra: Record<string, unknown> = {}) =>
  ({ take: 'pitch', from, to, layout: 'room' as const, illustration: room(views), cursor: false, ...extra });

export default defineEdit({
  name: 'pax-buttonica-pitch',
  shots: [
    { kind: 'title', ms: 3200, title: 'Pax Buttonica', subtitle: 'A glowing button for every player.', small: 'Twilight Imperium, without the “whose turn is it?”' },
    shot('mark:turn', 'mark:card', [{ t: 0, view: 'seat:Sarah' }], { in: { kind: 'fade', ms: 500 } }),
    shot('mark:card', 'mark:secondary', [{ t: 0, view: 'wide' }, { t: 1800, view: 'screen' }]),
    shot('mark:secondary', 'mark:answers', [{ t: 0, view: 'wide' }]),
    shot('mark:answers', 'mark:go', [{ t: 0, view: 'table' }]),
    shot('mark:go', 'mark:next', [{ t: 0, view: 'seat:Sarah' }, { t: 2600, view: 'wide' }]),
    shot('mark:next', 'mark:flow', [{ t: 0, view: 'orbit' }], { speed: 1.25 }),
    shot('mark:flow', 'mark:end+1200', [{ t: 0, view: 'wide' }]),
    { kind: 'title', ms: 4500, title: 'Pax Buttonica', subtitle: 'The screen is live at <b>pax-buttonica.vercel.app</b>.<br/>The buttons are being built.', small: 'Pax Magnifica, Bellum Gloriosum' },
  ],
  outputs: [{ kind: 'mp4' }, { kind: 'webm', quality: 0.8 }],
});
