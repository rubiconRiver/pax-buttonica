# Videos

Pax Buttonica's videos are shot and cut by [showreel](https://github.com/rubiconRiver/showreel) (`~/showreel`,
a sibling checkout; this folder is its own small npm package depending on it). The skill `/showreel` knows the
whole workflow.

```bash
cd video && npm install                       # once: links ../../showreel
npx showreel shoot scenes/tour.ts             # a take: out/takes/tour/{host.mp4, sarah.mp4, kyle.mp4, audio.m4a, take.json, index.txt}
npx showreel cut edits/tour.ts --preview      # a quick look, half size
npx showreel sheet out/renders/pax-buttonica-tour.preview.mp4
npx showreel cut edits/tour.ts                # the real thing: out/renders/pax-buttonica-tour.mp4
```

- `showreel.config.ts`: the dev server (port 5231, its own), the stand-in for the site (`e2e/api.ts`), the theme.
- `scenes/`: what happens. `tour.ts` is a whole round with two phones; `table.ts` the big screen alone with a probe
  of every button's light, for the room video. Scenes mark every beat and say the captions as they go.
- `edits/`: what to make of it. `tour.ts` (the two-minute tour), `hero.ts` (an eight-second loop as mp4, webm and
  gif), `table.ts` (the room: a 3D table of players with physical buttons lit from the probe, the screen on the wall).
- `out/` is not committed: takes are big. Re-shoot with the commands above.

Everything is real time: the recording runs as long as the footage. A scene that fails leaves a
`failure-<surface>.png` in its take folder.
