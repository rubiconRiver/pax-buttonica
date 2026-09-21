# The demo video

`npm run video` plays a scripted tour of the app in a headless browser, records it, and writes `video/out/pax-buttonica-tour.mp4` (1080p, about two minutes, with the app's own sound). Needs `ffmpeg` on the path.

- `stage.html` is the set: the big screen and two phones as iframes, a caption bar, title cards and a drawn cursor. All three frames run the real app and talk to each other through the same stand-in for PeerJS that the browser tests use.
- `tour.ts` is the script: who clicks what, when, and what the caption says. Edit the captions and beats there.
- `inject.ts` runs inside every frame: separate identities for the phones, cursor reporting, and a recorder on the big screen's audio.
- `cut.mjs` lines sound up with picture (a flash and a beep are recorded at the start of both, then cut off), trims the set-up, and encodes. Re-run it alone with `node video/cut.mjs` to re-encode the last recording.

The recording runs in real time, so it takes as long as the video does.
