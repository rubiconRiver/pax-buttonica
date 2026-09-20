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
| Sound | No | If the device is silent, the laptop plays the sounds instead. |
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

- `hello` — sent on power-up and whenever the hub asks. `caps.btn` is the number of buttons, `caps.led` is `rgb`, `ring` or `none`, `caps.audio` is `tones` or `none`.
- `btn` — `b` is the button index, `e` is `tap`, `double` or `hold`. Only button 0 sends `double` and `hold`.
- `bat` — battery millivolts, now and then. Optional.

### Hub → host

```json
{"t":"hub","v":0,"fw":"0.1.0"}
{"t":"lost","dev":"A1B2C3D4E5F6"}
```

### Host → button

```json
{"t":"led","dev":"A1B2C3D4E5F6","c":"ff8a1f","m":"pulse"}
{"t":"snd","dev":"A1B2C3D4E5F6","w":"square","n":[[72,110],[76,110],[79,110],[84,340]]}
{"t":"fx","dev":"A1B2C3D4E5F6","k":"denied"}
{"t":"cfg","dev":"A1B2C3D4E5F6","hold":2000,"flash":2000}
{"t":"id","dev":"A1B2C3D4E5F6"}
```

- `led` — colour `c` and mode `m`. The only message a minimal device has to understand.
- `snd` — a jingle as `[midiNote, milliseconds]` pairs; note `0` is a rest. `w` is the waveform (`square`, `triangle`, `sawtooth`, `sine`) — a piezo can ignore it. Every built-in jingle fits in one packet.
- `fx` — a canned reaction the device renders however it likes: `ack` (small happy blip), `denied` (red flash and a buzz), `confirm`.
- `cfg` — settings, all in ms: `hold` is the hold time, `flash` is the full on-off cycle of `flash` mode.
- `id` — "blink white for a second" so a human can tell which button is which.

Unknown message types and unknown fields must be ignored, by everyone. That's what lets v1 devices survive a v2 host.

## Claiming seats

Buttons don't know where they sit, and nobody wants to label them. Instead, every game opens with a small ritual:

1. The host puts every button it can hear into `pulse`, white.
2. The big screen calls the player in seat 1. They press **any** button — that one is theirs. It turns solid in their colour and plays their entrance.
3. Seat 2, and so on round the table.

To the device this is nothing special: it shows what it's told and reports a `tap`. The host keeps the `dev → seat` table. The ritual can be re-run mid-game (dead batteries, musical chairs) without losing the game state.

## Phones are buttons too

Anyone without a physical button can use their phone: the host opens a room, the phone scans a QR code, and from then on it is a device like any other — it gets a light to show, and sends `tap`, `double` and `hold`. It claims a seat in the same ritual — or skips it: a phone whose owner has said who they are ("I'm Ana") goes straight to Ana's seat. From the same screen a player can change their own name, colour, and entrance and exit sounds, mid-game if they like; uploaded clips are sent to the host laptop and kept there. The transport is a WebRTC data channel rather than ESP-NOW, and the device id starts with `web-`; nothing else differs, and the rules engine can't tell them apart.

## Sound

Two tiers, and the host picks per device:

1. **Tones** (`caps.audio: "tones"`) — the button plays `snd` note lists through a piezo or a small I2S amp. Personal jingles travel with the player's profile and are sent when their turn starts and ends.
2. **Laptop audio** — uploaded clips (your favourite eight seconds of anything) play from the laptop. They never leave the browser and are never sent to a button.

## Power, honestly

The button must be able to hear the hub within about a quarter of a second, which rules out deep sleep between presses.

- **Poll, don't listen.** Wake every ~250 ms, ask the hub "anything for me?", listen ~10 ms for the reply, light-sleep again. The hub is mains-powered and always awake. Pressing the button sends immediately — only incoming changes wait for the next poll.
- **The LED is the real battery hog**, not the radio. That's why the vocabulary has `off` and `dim`: only the player who needs to act is ever at full brightness.
- **Four NiMH AAs** (~4.8 V) suit both the LEDs and a 3.3 V regulator. Three alkalines sag below regulator dropout long before they're empty.

## A reference build (untested, prices approximate)

| Part | Example | Approx. CAD |
|---|---|---|
| Microcontroller | ESP32-C3 "Super Mini" (native USB, tiny) | $4–8 |
| Light | 7–12 WS2812 pixels in a ring under the dome | $2–5 |
| Sound | MAX98357A I2S amp + 40 mm speaker, *or* a piezo | $1–12 |
| Switch | A microswitch under a printed plunger | $1–2 |
| Power | 4×AA holder with a switch | $2–3 |
| Shell | Printed base + translucent printed dome | filament |

The hub is the same ESP32-C3, alone, on a USB cable.

## Open questions

- Re-joining after a battery swap without making the whole table re-claim.
- Should the hub acknowledge every host message, or only report failures?
- Per-pixel ring effects (a hold-progress sweep is the obvious one) — a `ring` capability tier?
- Is 250 ms polling snappy enough when six buttons start flashing at once? Needs a real test.
- Encryption. ESP-NOW supports it; a board game probably doesn't need it.
