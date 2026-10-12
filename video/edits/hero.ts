import { defineEdit } from 'showreel/core';

/**
 * A hero loop for a landing page: eight seconds of a phone playing its strategy card, no words, every format.
 * Same take as the tour; a different edit.
 */
export default defineEdit({
  name: 'pax-buttonica-hero',
  shots: [
    { take: 'tour', from: 'mark:card-1000', to: 'mark:card+7000', captions: 'none', layout: 'table', zoom: 1.2 },
  ],
  outputs: [
    { kind: 'mp4', file: 'hero' },
    { kind: 'webm', file: 'hero', loop: true, quality: 0.8 },
    { kind: 'gif', file: 'hero', width: 960, fps: 15, loop: true },
  ],
});
