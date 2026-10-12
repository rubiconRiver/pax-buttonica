import { defineEdit } from 'showreel/core';

/** The table video: how the buttons work, for people who have never seen them. Screen on the wall, six buttons. */
const room = (views: { t: number; view: string }[]) => ({
  kind: 'table' as const, probe: 'seats', press: { surface: 'host', pattern: "^(.+?)'s button$|^Unclaimed button (\\d+)$" }, views,
});
const shot = (from: string, to: string, views: { t: number; view: string }[], extra: Record<string, unknown> = {}) =>
  ({ take: 'table', from, to, layout: 'room' as const, illustration: room(views), cursor: false, ...extra });

export default defineEdit({
  name: 'pax-buttonica-table',
  shots: [
    { kind: 'title', ms: 4000, title: 'Pax Buttonica', subtitle: 'A glowing button for every player. Here is how a round goes.', small: 'The table' },
    shot('mark:start', 'mark:strategy', [{ t: 0, view: 'wide' }, { t: 3800, view: 'seat:1' }, { t: 9500, view: 'wide' }], { in: { kind: 'fade', ms: 600 } }),
    shot('mark:strategy', 'mark:turn', [{ t: 0, view: 'screen' }, { t: 8500, view: 'wide' }], { cursor: true }),
    shot('mark:turn', 'mark:card', [{ t: 0, view: 'wide' }]),
    shot('mark:card', 'mark:secondary', [{ t: 0, view: 'seat:Sarah' }, { t: 3200, view: 'screen' }]),
    shot('mark:secondary', 'mark:answers', [{ t: 0, view: 'table' }]),
    shot('mark:answers', 'mark:end-turn', [{ t: 0, view: 'table' }, { t: 6500, view: 'wide' }]),
    shot('mark:end-turn', 'mark:montage', [{ t: 0, view: 'seat:Sarah' }, { t: 3600, view: 'wide' }]),
    shot('mark:montage', 'mark:rainbow', [{ t: 0, view: 'orbit' }], { camera: 'still', speed: 4, audio: 'mute' }),
    shot('mark:rainbow', 'mark:scoring', [{ t: 0, view: 'wide' }]),
    shot('mark:scoring', 'mark:end+1500', [{ t: 0, view: 'table' }]),
    { kind: 'title', ms: 4500, title: 'Pax Buttonica', subtitle: 'The screen is live at <b>pax-buttonica.vercel.app</b>. The buttons are being built.', small: 'Pax Magnifica, Bellum Gloriosum' },
  ],
  outputs: [{ kind: 'mp4' }],
});
