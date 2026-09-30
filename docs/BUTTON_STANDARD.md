# The Pax Buttonica button standard

**Draft v0 — nothing here is frozen.** No hardware has been built against this yet. It exists so that firmware, enclosures and the web app can be worked on in parallel and still meet in the middle. If something here is awkward to build, that's a bug in the standard: say so.

> The one-sentence version: a button is a dumb, glowing thing. It shows the colour it's told to show, and it reports when it's pressed. All the rules of the game live in the web app.

## Why "dumb" buttons

- **Change the game without reflashing anything.** New phase, house rule, expansion — it's a web deploy.
- **Anyone can build one.** If your device can light an LED and notice a press, it qualifies. Everything else is optional.
- **The simulator is the reference implementation.** The on-screen buttons in the [demo](/demo) are driven by the same light states and send the same gestures described below. If your button behaves like they do, it's correct.

## The pieces

```
[button] ─┐
[button] ─┼─ ESP-NOW ─→ [hub] ─ USB serial ─→ [web app in Chrome/Edge]
[button] ─┘
```

- **Button** — battery powered, one per player. Talks only to the hub.
- **Hub** — one ESP32 plugged into the laptop. A relay and nothing more: serial in, radio out, and back. It needs no Wi-Fi and no internet.
- **Host** — the web app, using the Web Serial API. It decides everything.

## What a button must do

| Capability | Required? | Notes |
|---|---|---|
| Button 0 — the big one | **Yes** | Reports `tap`, `double` and `hold`. |
| One RGB light | **Yes** | The whole dome shows one colour. A ring of pixels is fine; treat it as one light. |
| Sound | No | The standard button is silent: the laptop plays every sound. A builder can add a speaker and the host will use it. |
| Button 1 — strategy | No | Shortcut for double-tap: "I'm playing my strategy card". |
| Button 2 — pass | No | Shortcut: "I pass". |
| Buttons 3+ | No | Reserved. The host ignores indexes it doesn't understand, so extras are harmless. |

A device announces what it has (see `hello`), and the host adapts. A one-button device is a complete, first-class citizen — shortcuts only save a trip to the laptop.

## Gestures on the big button

The device detects gestures itself, so timing never depends on the radio.

| Gesture | Definition | Meaning |
|---|---|---|
| `tap` | Pressed and released within **350 ms** | "Done" — acknowledge a strategy card, ready up, finish voting |
| `double` | A second `tap` released within **400 ms** of the first | "I'm playing my strategy card" |
| `hold` | Held continuously for the **hold time** (default **2000 ms**, set by the host) | "End my turn" |
| *(abandoned hold)* | Released after 350 ms but before the hold time | Nothing. Report nothing. |

`tap` is sent the moment the button is released — never delayed to wait for a possible second tap, so acknowledging stays instant. A double-tap therefore arrives as `tap` then `double`; the host knows the first one was the wind-up. (It also ignores taps from a card's owner for 600 ms after the card comes out, so an over-enthusiastic triple-tap can't skip their own primary.)

While the button is held, the device should show progress on its own (fill a ring, ramp the brightness, rising tone — builder's choice) and mark completion clearly. `hold` is sent the instant the hold time elapses, not on release.

Ending a turn is deliberately slow and acknowledging is deliberately fast: one is expensive to do by accident, the other happens five at a time.

## Light modes

Six modes, chosen so that a single LED and a timer can do all of them.

| Mode | Looks like | Used for |
|---|---|---|
| `off` | Dark | Passed, or not yet involved |
| `dim` | Steady, about 20% | "I'm here, it's not my turn" |
| `solid` | Steady, 100% | Your strategy card is out and the others are doing their secondaries |
| `pulse` | Breathing, 34% ↔ 100%, 1.7 s period | **Your move** — your turn, your pick, your vote, or ready-check |
| `flash` | Slow blink: on, soft fade, dark, soft fade. **2 s** cycle by default (set by the host), fades about a tenth of the cycle each | **A strategy card needs you.** Yours: do the primary, then tap. Someone else's: do the secondary (or don't), then tap |
| `rainbow` | Hue cycle, 2.2 s period | You won |

### Extra modes (optional)

A device with more than one pixel may also understand these. They are decoration: a host must never rely on them to carry meaning, and a device that doesn't know one shows `off`. `d` on the `led` message sets the cycle in ms; each has a default.

The safe way for a game to ask for one is `l` on a `led` message whose `m` is `pulse`: the meaning stays "your move", and `l` names the look the game would like it drawn in (`ripple_in` for your turn to score). A device that knows the look draws it for as long as that light stands (`p` is then the phase of the look's cycle); one that doesn't draws `pulse` its usual way. `l` wins over the player's own `pulse` look from `cfg`.

| Mode | Looks like | Default `d` |
|---|---|---|
| `ripple` | A bright front runs from the centre to the rim and leaves a fading tail | 1400 |
| `ripple_in` | The same, rim to centre | 1400 |
| `rings` | One more ring lights each step; when all are lit it holds, then starts over | 4000 |
| `spin` | A comet runs round the outside | 1000 |
| `sparkle` | Every pixel twinkles on its own schedule | 900 |
| `wave` | The pulse, each ring a little behind the one inside it | 1700 |
| `heartbeat` | Two thumps, then a rest | 1300 |

### How a strategy card plays out

1. The active player **double-taps**. The big screen announces the card to the room; their button goes `flash` in the card's colour. Everyone else stays as they were.
2. They do the primary, then **tap**. Their button goes `solid`; every other button goes `flash`.
3. Each other player does the secondary (or declines) and **taps**; their button settles to `dim`.
4. When the last one taps, the active player's button returns to `pulse` and their **hold** works again. Until then it is refused.

Step 1–2 can be switched off in the host's settings, in which case everyone flashes the moment the card comes out. Buttons can't tell the difference: they only ever see `led` messages.

Colours arrive as 24-bit RGB hex. The host sends a new `led` message only when the colour or mode changes; the device runs the animation itself.

## Messages

Newline-delimited JSON, UTF-8, **115200 baud** between host and hub. Every message has a type `t`. Messages about a specific button carry `dev`, the button's id (its MAC address in hex is the obvious choice). The hub forwards by `dev` and does not interpret anything else. Keep messages under 250 bytes so each fits in one ESP-NOW packet.

### Button → host

```json
{"t":"hello","dev":"A1B2C3D4E5F6","fw":"0.1.0","caps":{"btn":1,"led":"rgb","audio":"tones"}}
{"t":"btn","dev":"A1B2C3D4E5F6","b":0,"e":"tap"}
{"t":"btn","dev":"A1B2C3D4E5F6","b":0,"e":"double"}
{"t":"btn","dev":"A1B2C3D4E5F6","b":0,"e":"hold"}
{"t":"btn","dev":"A1B2C3D4E5F6","b":1,"e":"tap"}
{"t":"bat","dev":"A1B2C3D4E5F6","mv":4810}
```

- `hello` — sent on power-up and whenever the hub asks. Optional: `up`, seconds since the device powered up. A host that logs it has a battery test for free: the last `up` it heard is how long the cell lasted. `caps.btn` is the number of buttons, `caps.led` is `rgb`, `ring` or `none`, `caps.audio` is `tones` or `none`.
- `btn` — `b` is the button index, `e` is `tap`, `double` or `hold`. Only button 0 sends `double` and `hold`.
- `bat` — battery millivolts, now and then. Optional.

### Hub → host

```json
{"t":"hub","v":0,"fw":"0.1.0"}
{"t":"lost","dev":"A1B2C3D4E5F6"}
{"t":"rssi","dev":"A1B2C3D4E5F6","dbm":-58}
```

`rssi` is how strongly the hub heard that button, in dBm, at most once a second. Around −50 is excellent, −70 is fine, below about −80 is getting marginal. The test bench shows it, so range can be checked at the real table.

### Pairing: the hub says who the hub is

```json
{"t":"link","dev":"A1B2C3D4E5F6","v":0,"fw":"0.2.3","id":"0A1B2C3D4E5F"}
```

The hub answers every `hello` it hears with this line, addressed to that button by name and carrying the hub's own `id`. That answer is the pairing and the heartbeat at once, and it is the only thing the hub does on its own account. A button does not reply to it (`hub`, by contrast, means "say hello"):

- A button **believes in a hub only while that hub keeps speaking to it by name**: any line carrying the button's own `dev`. It adopts the sender of such a line as its hub, and treats the hub as gone after 35 s without one (three missed answers) or eight unacknowledged sends. Nothing is remembered across power cycles.
- A button **ignores every line that does not carry its own `dev`**. This matters: a button with no hub looks for one by broadcasting its `hello`, every other button hears that, and a button that adopts "whoever spoke" as its hub will pair with another button. The reference firmware did exactly that until 0.3.7, and six buttons on one desk paired with each other.
- Not linked, a button sends `hello` to everyone every 3 s; linked, to the hub every 10 s. Presses go to the last hub it knew, or to everyone if it never knew one; the hub passes on whatever it hears.
- The reference button shows the state on its light until the host sends its first `led`: amber blinking while it looks for the hub, a steady green centre once linked. In a game the light is the host's, and an amber dot blinks in the middle of it if the hub goes away.

### Host → button

```json
{"t":"led","dev":"A1B2C3D4E5F6","c":"ff8a1f","m":"pulse","p":640}
{"t":"snd","dev":"A1B2C3D4E5F6","w":"square","n":[[72,110],[76,110],[79,110],[84,340]]}
{"t":"fx","dev":"A1B2C3D4E5F6","k":"denied"}
{"t":"cfg","dev":"A1B2C3D4E5F6","hold":900,"flash":2000,"bright":50,"dim":10,"fx":80,"pulse":"solid"}
{"t":"id","dev":"A1B2C3D4E5F6"}
```

- `led` — colour `c` and mode `m`. The only message a minimal device has to understand. For `pulse` and `flash` the host adds `p`: how many milliseconds into the cycle the light should already be. Start your animation there and the whole table breathes and blinks in step; ignore it and you'll merely be a little out of time. `p` means the phase on arrival: a hub that holds a message for a sleeping button adds the wait to it before each attempt (the reference hub does, from 0.2.5), otherwise the button that waited longest breathes behind the rest.
  `h` (optional, 0 or 1, default 1) says whether a hold means anything right now. With `h: 0` a device that draws a hold's progress should show instead that it will be refused, from the moment the hold starts, and react as `denied` when the hold time is reached; it still reports the `hold`, and the host decides. It spares the player two seconds of filling a ring for nothing.
- `snd` — a jingle as `[midiNote, milliseconds]` pairs; note `0` is a rest. `w` is the waveform (`square`, `triangle`, `sawtooth`, `sine`) — a piezo can ignore it. Every built-in jingle fits in one packet.
- `fx` — a canned reaction the device renders however it likes: `ack` (small happy blip), `denied` (red flash and a buzz), `confirm`. Optional extras a multi-pixel device may render: `ripple` (one front, centre to rim, in the current colour), `burst` (white flash that collapses outward), `sparkle` (half a second of twinkles). Unknown kinds are ignored.
- `fx` with `k:"card"` and a colour `c` (six hex digits): a strategy card has come out. The device fills from the rim inward in that colour, holds it, blinks once, and is back on its light about 1.3 s later. The host sends it round the table from the player who played the card, one button 320 ms after the last, so the table sees the card's colour go round. Your turn to score, in the status phase, is sent as `warp` (rings fall inward) whatever the player's turn effect, and the light that follows is `pulse` with `l:"ripple_in"`; everyone else is `off` until it is their turn.
- The game's **turn effects** are `fx` kinds too: a player picks one and their button is sent it the moment their turn starts (the ring is sent as `burst`). A device that knows them plays them for about a second on top of its light; one that doesn't ignores them. The names, from the app's catalogue: `rainbow` (every colour, spinning), `cop` (red one side, blue the other, swapping), `explosion` (white flash, orange front, glowing debris), `fireworks` (three bursts in three colours), `lightning` (flickers of white), `fire` (orange and yellow flicker, hottest in the middle), `siren` (two beacon wedges sweeping round in the button's colour), `laser` (one thin white wedge, three fast turns), `comet` (a bright dot round the rim with a tail), `warp` (rings fall inward, then a flash), `confetti` (every pixel flashing its own colours), `disco` (eight colours in a second), `glitch` (green, jittery, briefly pink), `neon` (stutters on, then holds, in the button's colour), `alarm` (three red strobes), `thump` (two big beats from the rim in).
- `cfg` — settings. `hold` is the hold time and `flash` the full on-off cycle of `flash` mode, both in ms. Three light levels, each 0–100 and optional, each a share of the device's full output, set by the host for the whole table: `bright` for a light shown at full (your move, a strategy card; the host's slider times the player's own), `dim` for the `dim` mode and the floor under every animated mode (waiting for your turn), and `fx` for one-shot effects and the device's own press and hold feedback, which may be brighter than the lights because they are brief. The reference button starts at 50, 10 and 80 until the host says otherwise (the app's own defaults are 60, 5 and 80): full output is too bright for a table and is what drains a battery. `pulse` (optional) is how this button should draw the `pulse` mode: `pulse` (breathe, the default), `solid` or `heartbeat`. The meaning on the wire never changes — `pulse` still says "your move" — only the look does, because a light that breathes all evening turned out to be too much for some people. The host picks a table-wide look and each player can override it for their own button from their phone.
- `id` — "blink white for a second" so a human can tell which button is which.

Unknown message types and unknown fields must be ignored, by everyone. That's what lets v1 devices survive a v2 host.

### Updating over the air (optional)

A button whose USB socket is inside its shell still needs new firmware now and then. The host can send it the image through the hub, which relays these lines like any other:

```json
{"t":"ota","dev":"A1B2C3D4E5F6","size":904784,"md5":"386e7c1a129dd2bc93233fe859c7524f"}
{"t":"ota","dev":"A1B2C3D4E5F6","n":0,"d":"6QAGAn...(base64, 150 bytes of image)"}
{"t":"ota","dev":"A1B2C3D4E5F6","end":true}
{"t":"ota","dev":"A1B2C3D4E5F6","abort":true}
```

and the button answers each one:

```json
{"t":"ota","dev":"A1B2C3D4E5F6","st":"ready","n":0}
{"t":"ota","dev":"A1B2C3D4E5F6","st":"ok","n":0}
{"t":"ota","dev":"A1B2C3D4E5F6","st":"seq","n":41}
{"t":"ota","dev":"A1B2C3D4E5F6","st":"done","n":5914}
{"t":"ota","dev":"A1B2C3D4E5F6","st":"err","n":12,"why":"..."}
```

`size` and `md5` open the update (the reference firmware writes to its spare app slot); chunks `n` = 0, 1, 2… carry 150 bytes each, base64, so a line stays under 250 bytes whatever the chunk number; `end` checks the MD5 and reboots into the new image, and the button's next `hello` carries the new `fw`. Every chunk is answered with `ok` and its number, so the host keeps a few in flight (the reference hub holds six per button) and resends from the last one answered if the answers stop; `seq` says which chunk the button wants next when one arrives out of order. A chunk that arrives twice is answered again and not written. The button gives up an update that goes quiet for 15 s. A 900 KB image takes about a minute per button; the reference button fills its light blue from the centre out as it lands. The hub relays the lines like any other, but it has to keep up with them: the reference hub from 0.2.1 has a 4 KB serial buffer for four chunks in flight, and a host talking to an older hub should send one at a time. A button that does not support this simply ignores `ota`, and the host finds out when nothing answers.

## Colours

Buttons never need to know what a colour means: every `led`, `fx` and show message carries the colour it wants. But everything that draws a light should agree on the values, so these are the canonical ones. The web app's copy in `src/engine/data.ts` is the source; phones, demo pages and any firmware effect that names a colour copy from here.

| Player | LED | | Strategy card | Colour |
|---|---|---|---|---|
| Red | `#ff3b3b` | | 1 Leadership | `#e5484d` |
| Orange | `#ff8a1f` | | 2 Diplomacy | `#f08c3a` |
| Yellow | `#ffd21f` | | 3 Politics | `#f2cc45` |
| Green | `#2fe06b` | | 4 Construction | `#46b86c` |
| Blue | `#2f8cff` | | 5 Trade | `#2ec4b0` |
| Purple | `#a24bff` | | 6 Warfare | `#3b9bf5` |
| Pink | `#ff5fc4` | | 7 Technology | `#5468f0` |
| Black | `#e9f0ff` | | 8 Imperial | `#a562f0` |

Player colours are what the LEDs are driven with (already chosen to look right on a NeoPixel, so "black" is a cool white). Card colours are used as sent, on the screen and on the buttons.

## Claiming seats

Buttons don't know where they sit, and nobody wants to label them. Instead, every game opens with a small ritual:

1. The host puts every button it can hear into `pulse`, white.
2. The big screen calls the player in seat 1. They press **any** button — that one is theirs. It turns solid in their colour and plays their entrance.
3. Seat 2, and so on round the table.

To the device this is nothing special: it shows what it's told and reports a `tap`. The host keeps the `dev → seat` table. The ritual can be re-run mid-game (dead batteries, musical chairs) without losing the game state.

## Phones are buttons too

Anyone without a physical button can use their phone: every game has a four-letter code on the big screen, the phone scans it, and from then on it is a device like any other — it gets a light to show, and sends `tap`, `double` and `hold`. It claims a seat in the same ritual — or skips it: a phone whose owner has said who they are ("I'm Sarah") goes straight to Sarah's seat. From the same screen a player can change their own name, colour, and entrance and exit sounds, mid-game if they like. The transport is the site: the host laptop keeps the site's copy of the whole game current, the phone reads it and works out its own light with the same code the host uses, and presses go back through an inbox the host reads. About a second behind, and it works on any network with internet. The device id starts with `web-`; nothing else differs, and the rules engine can't tell them apart.

## Sound

The standard button has **no speaker**. Entrance and exit music, the strategy-card alarm and every other sound play from the laptop (or whatever it's plugged into). That keeps the button cheap and easy to build, and a laptop sounds better than a 28 mm speaker ever will.

A builder who wants their own button to chirp can fit one and report `caps.audio: "tones"`. The host then sends that player's jingles to the button as `snd` note lists. Uploaded clips always play from the laptop; they never leave the browser and are never sent to a button.

## Power, honestly

The button must be able to hear the hub within about a quarter of a second, which rules out deep sleep between presses. What the reference firmware does (since 2026-09-26):

- **Listen in windows, not all the time.** The radio sleeps and opens for 30 ms in every 200. The hub is mains-powered and always awake, and it keeps resending a message every 12 ms until the button's radio acknowledges it, giving up after 600 ms (three windows); only then does the message count towards `lost`. Pressing the button sends immediately, and the button then holds its radio open for half a second so the answer comes straight back. So a light change reaches a sleeping button within about a fifth of a second, and a reaction to a press at once. The host may send `cfg` `ps: 0` to keep a button's radio always on (for measuring), `ps: 1` to let it sleep again.
- **The lit LEDs during a turn are the real hog**, not the idle ones. So `solid` is drawn as a bright rim with a softer centre (about half the current, same visibility across a room), `off` and `dim` exist so only the player who needs to act is bright, and the host's brightness setting (`cfg` `bright`) is for setting the light to the room rather than to the maximum.
- **One lithium cell** (3.7 V, protected, JST-PH 2.0) on a charger-plus-boost board, charged in place over USB-C. A button that runs low mid-game plays on from a phone charger.

## A reference build (untested, prices approximate)

| Part | Example | Approx. CAD |
|---|---|---|
| Microcontroller | ESP32-C3 "Super Mini" (native USB, tiny) | $4–8 |
| Light | 8–12 WS2812 pixels in a ring under the dome | $2–5 |
| Switch | A microswitch under a printed plunger | $1–2 |
| Power | 3.7 V lithium pouch, 1800–3700 mAh, on a Seeed Lipo Rider Plus (charges in place, switched 5 V out) | $28–35 |
| Shell | Printed base + translucent printed dome | filament |

The hub is the same ESP32-C3, alone, on a USB cable.

## Open questions

- Re-joining after a battery swap without making the whole table re-claim.
- Should the hub acknowledge every host message, or only report failures?
- Per-pixel ring effects (a hold-progress sweep is the obvious one) — a `ring` capability tier?
- Is 250 ms polling snappy enough when six buttons start flashing at once? Needs a real test.
- Encryption. ESP-NOW supports it; a board game probably doesn't need it.
