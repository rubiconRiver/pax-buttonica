# Pax Buttonica

Big glowing turn buttons for Twilight Imperium 4 — a web app that runs the table, plus an open standard for the physical buttons. (Working title. Unofficial fan project; not affiliated with Fantasy Flight Games or Asmodee.)

**Status:** the web app is playable today — with simulated on-screen buttons, or with **phones as buttons**. Firmware for real buttons is written and compiles, but no hardware has been built yet.

## Run it

```bash
npm install
npm run dev
```

| Route | What |
|---|---|
| `/` | Landing page: the pitch, a self-playing table, how it's wired |
| `/demo` | Interactive demo with a guided tour and the **scenario lab** (jump to any situation) |
| `/play` | A real game: setup, profiles, seat claiming. Survives a page reload |
| `/me` | Set up your own profile (name, colour, entrance and exit sounds) at home, no game needed |
| `/join` | A phone becomes a button: scan the QR from the *Phones* menu (setup screen or in a game), or type the room code. Players say who they are and edit their own profile and sounds from there |
| `/button` | Concept drawings of the physical button: exploded view, size, target dimensions. Made for sharing |
| `/parts` | Interactive shopping list: pick how many buttons and what you already own, tick things off, read what each part is for |
| *(in a game)* **Scoreboard** | Objectives with their requirements, who has scored what, secrets, other points, laws. Opens by itself in the status phase; `B` toggles it. Every phone gets it read-only under "The table" |
| `/bench` | Hardware test bench: connect the USB hub and poke real buttons one at a time |
| `/standard` | The button standard, rendered from `docs/BUTTON_STANDARD.md` |

Number keys `1`–`8` are the on-screen buttons: tap a key to tap, double-press to play a strategy card, hold it to end the turn. `⌘Z` undoes.

```bash
npm test        # rules engine tests
npm run build   # typecheck + production build (deploys to Vercel as a static site)
```

## How it fits together

```
src/engine/     Pure rules. reduce(state, action) → state; deriveOutputs(state) → one light per seat.
src/hardware/   The wire protocol, and the Web Serial transport to the USB hub (untested — no hardware yet).
api/            Vercel functions: profiles and uploaded clips in Neon Postgres (DATABASE_URL). No auth yet.
src/remote/     Phones as buttons: WebRTC data channels via PeerJS's public broker. No server of ours involved.
firmware/       ESP32-C3 sketches for the hub and the buttons. See docs/HARDWARE.md.
hardware/pcb/   The button's carrier board: generator script, KiCad file, renders and the zip a board house needs.
src/audio/      WebAudio synth: interface sounds, jingles as note lists, uploaded clips (IndexedDB).
src/components/ Device.tsx is the simulated button; components/game/ is the table.
src/state/      Tiny stores: game (+undo, persisted), settings, profiles, demo seeding.
docs/           BUTTON_STANDARD.md — the spec. HARDWARE.md — parts, wiring, flashing, bring-up. SHOPPING.md — the cart.
```

The important idea: **buttons are dumb.** They show the colour and mode they're told to and report `tap` / `double` / `hold`. Every rule lives in `src/engine`, so the simulator and real hardware can't drift apart — they're fed by the same function.

## Helping out

See the "Help wanted" section on the landing page, and the open questions at the bottom of the standard.
