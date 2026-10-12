import { defineEdit } from 'showreel/core';

/** The two-minute tour, cut from the `tour` take: a title, the round, and the sign-off. */
export default defineEdit({
  name: 'pax-buttonica-tour',
  shots: [
    { kind: 'title', ms: 4200, title: 'Pax Buttonica', subtitle: 'A turn tracker for Twilight Imperium, with a big glowing button for every player.', small: 'Two-minute tour' },
    { take: 'tour', from: 'mark:start', to: 'mark:end+1500', in: { kind: 'fade', ms: 600 } },
    { kind: 'title', ms: 5000, title: 'Pax Buttonica', subtitle: 'Try it: <b>pax-buttonica.vercel.app</b><br/>The buttons are being built. Help wanted.', small: 'Pax Magnifica, Bellum Gloriosum' },
  ],
  outputs: [{ kind: 'mp4' }],
});
