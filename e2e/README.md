# Browser tests

Playwright drives the real app in Chromium. `npm run e2e` runs everything (about two and a half minutes); `npm run e2e:ui` opens Playwright's runner, where you can watch a test click through the game and step back and forth in time. `npm run test:all` runs the engine's unit tests first.

```bash
npm run e2e                         # everything
npx playwright test full-game       # one file
npx playwright test -g "reload"     # tests whose name matches
npx playwright show-report          # after a failure: screenshots, and a trace you can scrub through
```

## What is covered

| File | What it proves |
|---|---|
| `full-game.spec.ts` | A whole six-player game through the UI: setup, seat claiming, four rounds, the strategy-card lock checked on every play, undo, pause, a reload mid-round, Mecatol and the agenda phase, laws, scoring from every source, victory on the tenth point, undoing the win, starting over. |
| `four-player.spec.ts` | Two strategy cards each: two laps of choosing, the "which card?" step, no passing with a card in hand. |
| `gestures.spec.ts` | Tap, double-tap and hold, to the millisecond (1.9 s is not a hold, 2.0 s is); mouse, keyboard and the shortcut buttons; the hold-time setting. |
| `strategy-card.spec.ts` | The two-beat flow and its guards; the refusals and their wording; the one-beat setting; lights blinking in step. |
| `seating.spec.ts` | Claiming in any order, claiming twice, skipping, re-claiming mid-game without losing the game or charging anyone's clock. |
| `demo.spec.ts` | The guided tour follows what the visitor does; every Scenario Lab button; undo; the demo never touches a real game. |
| `scoreboard.spec.ts` | Revealing, searching and typing in objectives; points from publics, secrets and extras adding up and coming off; laws; the automatic status-phase scoreboard; the victory target. |
| `setup.spec.ts` | Validation, player counts, colours, options reaching the game, saved players, persistence across reloads, ending a game. |
| `hub.spec.ts` | The USB hub and real buttons, via a fake `navigator.serial`: the app's Web Serial code runs for real and the test plays the hub, speaking the wire protocol from `docs/BUTTON_STANDARD.md`. Seat claiming, a full turn, extra buttons, lost and returning buttons, low batteries, line noise, the test bench. |
| `phones.spec.ts` | Phones as buttons: a laptop tab and phone tabs, with only the WebRTC library swapped out (`fake-peerjs.ts`). Identity, seats, lights, gestures, profile edits and clip uploads from the phone, the read-only table view, the `/api/table` fallback, laptop reloads. |
| `relay.spec.ts` | Phones through the site when the direct link is dead: identity, lights, presses, clips, the table, dropping and returning, switching to the direct link when it comes up. |
| `saved-game.spec.ts` | The game copied to the site: saved after each change, offered back to a browser that lost its data, picked up on another laptop by room code (which takes the room with it and locks the old laptop out). |
| `profiles.spec.ts` | Saved players against a stand-in for the database (`api.ts`): newest edit wins, deletions travel, offline catches up later, clip uploads. |
| `pages.spec.ts` | Every page renders; navigation; the documents; the parts list arithmetic and memory; nothing scrolls sideways on a phone. |

## How the tests work

- **Time stands still.** `helpers.ts` installs Playwright's clock and pauses it, so the app's timers, `Date.now()` and `performance.now()` only move when a test says so. A two-second hold takes no time and is exactly two seconds. Use `page.clock.fastForward(ms)`; never `waitForTimeout`. Timestamps that have to be "newer than the browser's" must come from the page (`page.evaluate(() => Date.now())`), not from Node.
- **No network.** `/api` answers "offline" unless a test installs `FakeApi`; the PeerJS broker and Google Fonts are blocked. The dev server runs with `E2E_FAKE_PEER=1`, which aliases `peerjs` to `fake-peerjs.ts` (messages go over a `BroadcastChannel` between tabs).
- **A tripwire.** Any uncaught exception or `console.error` in any tab fails the test, whatever else it was checking.
- **Buttons are pressed with the number keys**, which drive the same `down()` / `up()` as a finger on the dome. Keys follow places at the table, not seat order, so helpers look the key up (`table.key('Sarah')`).
- `Table`, `Board` (helpers.ts) and `flows.ts` hold the vocabulary: `table.hold('Dave')`, `playStrategyCard(...)`, `board.score('Expand Borders', 'Priya')`. New tests should read like a description of what the players did.

## What is not covered

Sound itself (only that nothing throws), real WebRTC and the public broker, the functions in `api/` against a real Postgres, and real hardware. The firmware and the board have their own checks (`arduino-cli compile`, `kicad-cli pcb drc`).
