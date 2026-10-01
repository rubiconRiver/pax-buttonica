# Hardware handoff

Where the physical side stands, for whoever (or whichever session) picks it up. Updated 2026-09-26.

## First run on real parts: 2026-09-24

One hub Atom and one button Atom + Key Unit + NeoHEX on a PortABC base, both on USB. **Everything worked on the bench:** the Mac saw the Atom with no driver, Web Serial connected to the hub first try, the button announced itself over ESP-NOW at −39 dBm, tap / double / hold all arrived, every light mode lit the hex. Found and fixed on the night: the base's Port A is G38/G39 on an AtomS3 (hex data on G38), Port B is G7/G8 (key switch on G8). Still open: `dim` renders dark (gamma applied after scaling: fix is gamma8 per channel before scaling in `scaled()`); the Atom's onboard pixel on G35 doesn't follow (the NeoPixel library drives one RMT pin at a time). Neither matters for play.

## Deadline

Game night is roughly the first days of October 2026. Six buttons and one hub have to work by then. Favour whatever gets working buttons on the table over elegance.

## Light settings (2026-09-26)

Garett found a button breathing all evening annoying, and wanted the brightness adjustable. Done across both lanes in one commit (the app checkout was clean, and he asked this session to do it): `cfg` now carries `bright` (0–100) and `pulse` (`pulse` | `solid` | `heartbeat`, how to draw "your move"); the wire's `led` still says `pulse`, so no light expectation changed. Host settings: "Your move" light (solid by default) and Button brightness. Each player has a cog on their phone ("Your light": Table's / Solid / Breathe / Heartbeat, and their own brightness), saved on their profile (`light`, `brightness`), so the host applies it per seat and it follows them to the next game. Firmware honours both; compiled, not yet flashed. **For the app session:** `src/hardware/serial.ts` gained `SeatPrefs` and `cfgFrame()`; `Device` has a `look` prop; the API's profile whitelist passes the two fields.

## The mini shell (2026-09-26): the design from here on

The Key Unit and the splitter are gone: the AtomS3 Lite sits in the middle, its own face button (G41, a square panel in a recess on its top) is the switch, and the hex plugs straight into its socket. `make_shell_mini.py` is the press mechanics (springs give 2 mm of travel, then a peg on the cage lands on the panel and the dome clicks, then the stop; the peg's disc hangs on three spiral flexures for tolerance); `make_shell_v1.py` is the seamless housing built on it: one hex from the table to the top with the cap's lip in its top edge, everything loading from the bottom, three screws under the feet, one port hole. 76 mm across the flats, 58 mm tall. The USB build (`stl-v1/`) runs off the laptop; the battery build (`stl-v1-battery/`) has the cell on the lid, the Rider above it, the Atom on a platform on three columns. Custom caps (`make_caps.py`: lithophane, planet, system tile) drop onto the same body. Parts per button: Atom, hex, one 5 cm Grove lead, Rider, cell, a short USB-A to C cable. The mini's USB build (body/cap/cage/peg/bezel/springs) was printing on 2026-09-26; v1 not yet printed. MEASURE: the Atom's panel drop, the Rider's port end and switch.

## Flasher (2026-09-26)

`/flash.html`: one-click flashing of hub or button from Chrome (ESP Web Tools), and "Ask the Atom" to identify whatever is plugged in; buttons answer `{"t":"button","dev","fw","hub"}` to any dev-less JSON line on USB and blink. Images in `public/firmware/` come from `firmware/export.sh`; run it and deploy after every firmware change. Firmware is now 0.2.0 on both.

## Low-power firmware (2026-09-26, compiled, not yet flashed)

Button: radio sleeps and listens 30 ms in every 200 (`RADIO_*` in `config.h`; the core has `CONFIG_ESP_WIFI_STA_DISCONNECTED_PM_ENABLE`), holds the radio open 500 ms after it sends anything, CPU at 80 MHz, `solid` drawn as a full rim with a 0.4 centre. `cfg` `ps: 0|1` switches the sleepy radio off/on at runtime; the effects lab has buttons for it and a brightness slider. Hub: per-button outbox of 6, resends every 12 ms until the button's radio acks, gives up on a message after 600 ms and only then counts a failure. **Both boards need flashing.** To measure: USB power meter inline, `/fx.html`, same light in both radio modes, compare mAh over ten minutes. Expected: ~160 mA idle → ~60 mA. Not done: CPU light sleep between frames (manual light sleep would fight the modem's own wake schedule; needs the core's power-management option, which Arduino's build has off).

## Power (2026-09-26)

The 4×AA plan is being replaced by a 3.7 V pouch cell and a Seeed Lipo Rider Plus (DigiKey.ca 106990290, $7.18 CAD): USB-C in to charge, JST-PH 2.0 for the cell, switched 5 V USB-A out to the Atom over a short A-to-C cable. DigiKey.ca no longer stocks Adafruit or SparkFun cells; the pouch (EEMB, 3000–5000 mAh, JST-PH 2.0, with protection) comes from Amazon.ca. Check the JST polarity with the DMM before the first plug-in. The plinth in `make_shell.py` still models the AA holder and needs redoing once the cell size is known.

## Effects lab (2026-09-24)

`/fx.html` (static, `public/fx.html`) connects to the hub and fires every mode, effect and a board of synthesised sounds at the real button, with press→sound+effect pairing. Firmware now maps the NeoHEX's 37 pixels to rings and angles and adds modes `ripple`, `ripple_in`, `rings`, `spin`, `sparkle`, `wave`, `heartbeat` (with an optional `d` period on `led`), fx `ripple`, `burst`, `sparkle`, ring-fill hold progress, a 70 ms press blip, and the dim fix. **For the app session:** these are documented as optional extras in `docs/BUTTON_STANDARD.md`; the bench could grow buttons for them, and the game could use `burst` on hold-confirm and `ripple` on tap. `HEX_SERPENTINE` in `config.h` is a guess to verify with the `rings` mode.

## The no-solder build (ordered 2026-09-22)

Garett ordered from DigiKey.ca: **7 × AtomS3 Lite** (6 buttons + hub), and for the first test unit **1 × Mechanical Key Unit, 1 × NeoHEX 37-LED board, 1 × PortABC base**. Power is his own NiMH AAs: an Adafruit 830 switched 4×AA holder, a 1N5817 in the red lead, Wago 221 clips, a USB-C plug with screw terminals into the Atom. Still to order: 5 more keys and hexes, 6 Unit Hub splitters (U006; the shell uses those, not more PortABC bases), 6 holders, Wagos and diodes, the USB-C screw plugs (Amazon), M3 screws, feet. The soldered carrier-board design is now the fallback; the JLCPCB order was not placed.

- Firmware: `config.h` has a board selector, default `BOARD_ATOMS3_LITE`. Hex on Port A / the Atom's socket (yellow = G2), key on Port B, switch on white. Until the base's pin sticker is read, every pin Port B could be is treated as the big button. Both boards compile.
- Shell v0.3 (`hardware/shell/make_shell.py`): sizes from M5's dimension drawings. The hex rides in the cap on snap legs, a printed saddle over the keycap takes the press, the key sits on pegs, the Atom's USB-C faces out through a window. Uses a Unit Hub splitter, not the PortABC base (too long to fit beside the key). Clash check clean, never printed.
- Order sheet with links: `/order.html` on the site.

## Decided

- **Button (soldered fallback):** ESP32-C3 SuperMini, one MX-style clicky keyboard switch (Kailh BOX Jade or similar) under a guided dome, 8-LED WS2812 ring (12-LED 50 mm ring also fits), 4 × AA NiMH in a switched holder, 1N5817 reverse-polarity diode, 1000 µF across the LED supply. No speaker.
- **Hub:** a bare ESP32-C3 on USB, relaying newline-delimited JSON at 115200 between ESP-NOW and Web Serial. Reports per-button RSSI.
- **Carrier board v0.2** (`hardware/pcb/`): 70 mm round, 2-layer, breakout hole beside every module pin, optional R2/R3 battery divider, optional R1 behind pre-bridged JP1. DRC clean. Garett is ordering it from JLCPCB (2 layers, 1.6 mm, green, HASL, no assembly, 24 h build, express DDP courier, about US$41).
- **Fallback:** perfboard plus a KW12 microswitch, parts already on the shopping list, until a carrier board is proven.
- **Shell v0.1** (`hardware/shell/`): hex plinth and turret, round flat-topped cap, five printed parts generated by `make_shell.py` (Python + manifold3d; the script's clash check is clean). Never printed. The plinth is sized from an Amazon listing for the switched 4×AA holder, which Garett has not bought yet. Printed by Garett on a Bambu X1C; he has only Bambu Studio, and macOS blocks the old OpenSCAD in /Applications, so don't call it.
- **Shell requirements:** Requirements are in `docs/HARDWARE.md`: dome skirt sliding in a collar, hard stop in the plastic before the switch bottoms out, pillar under the board centre, LED ring on a shelf about 12 mm above the board, 10 mm or more between the antenna and the cells.

## Not yet verified on real parts

1. SuperMini footprint: row spacing 15.24 mm, 5V top-right seen from above with USB up. If a module is mirrored, mount it on the back of the board.
2. GPIO order after 3V3. The switch lands on the fifth pin of the 5V side; read the number on the module and set `BUTTON_PINS` in `firmware/button/config.h`. LED data is GPIO10.
3. Firmware has only ever been compiled: gestures (25 ms debounce, tap/double/hold), LED modes and the phase-locked `p` field, hub pairing stored in NVS, deep sleep after 10 min without the hub and wake on press.
4. `src/hardware/serial.ts` (Web Serial) has never talked to a real hub. `/bench` on the site is the test page.
5. Range: the goal is reliable at 5 m with a person in the way. The link budget says fine; measure it with the RSSI readout.
6. 3.3 V data into WS2812s fed about 5 V is marginal on fresh cells. If the first LED flickers, swap D1 for a 1N4001-type diode (drops more voltage, same holes).
7. Battery life: the radio listens continuously, so expect about one game day per charge. The holder's switch is the real off.

## Open work, roughly in order

- First-power checklist for the DigiKey box (about 2026-09-24): flash the hub Atom, `/bench`; flash a button Atom with the key on its own socket, then the hex; read the PortABC sticker and pin `BIG_BUTTON_PINS` down; measure every M5 part and the holder, update `make_shell.py`, print one shell.
- Shell: print `fit_test` and the cap now; body, bridge and plinth after measuring.
- A hub enclosure, or at least strain relief for the USB cable.
- Later: a sleep/poll scheme for battery life, clip caching on the button, a fully assembled v2 board (SMD LEDs, level shifter, LED power switch) after game night.

## Over the air (2026-09-28)

Button firmware 0.3.0 receives a new image through the hub (`ota` messages, `docs/BUTTON_STANDARD.md`) and reboots into it; the hub is unchanged (0.2.0). `/flash.html` section 3 and `firmware/ota.py` drive it. One USB flash per button, then never again. **Seen working 2026-09-28:** Garett's button went 0.3.5 → 0.3.6 through the hub from the flash page and came back on the new version. Three bugs found on the way, all fixed: the hub's 256-byte serial buffer (now 4 KB, hub 0.2.1), chunk lines over 250 bytes past chunk 99 (150-byte chunks), and an unsigned wrap in the button's idle check that aborted every burst (0.3.5). Buttons must be on 0.3.5 or later by cable first. For the app session: the game already knows which `dev` sits in which seat, so an "update this button" entry in the play screen's settings could send the same messages over the port it already holds; the page version is enough for now.

## Turn effects in the firmware (2026-09-28, app session)

Button 0.3.6 draws every turn effect in the app's catalogue as an `fx` kind: `rainbow`, `cop`, `explosion`, `fireworks`, `lightning`, `fire`, `siren`, `laser`, `comet`, `warp`, `confetti`, `disco`, `glitch`, `neon`, `alarm`, `thump` (the ring is sent as `burst`; `ripple` and `sparkle` were already there). They live in `renderTurnFx()` in `button.ino`, one case each, with the same names and roughly the same timings as the simulator's CSS; the parser has a `TURN_FX` table. No new modes, no protocol change beyond the names, which `docs/BUTTON_STANDARD.md` now lists. Nothing for the app session to add in `src/`: it already sends these names. Source and docs only; not exported, not deployed, not flashed.

## Table-wide light shows (proposal, 2026-09-28)

`/shows.html` demos choreography across the whole table drawn on the real hex layout: carousel (one rainbow the size of the table), chase, stadium wave, ripple from a seat, fireworks, round-end sweep, turn hand-off. Proposed wire message, not yet in the standard or the firmware: `{"t":"show","dev","k","i","n","c","d","p"}` plus `o`/`to` for the ones with an origin; one message per button at the start, each button draws its own slice on its own clock (as `pulse` does with `p`). For the app session: this is an engine output (fanfare says "show k, seat i of n"), and the on-screen buttons would draw the same functions as the page. Garett picks which shows go in; then the hardware session adds them to the firmware and the standard.

## Pairing and the connection light (2026-09-28)

First time six buttons were powered at once, the hub heard three. Cause: a button adopted "whoever talks to me" as its hub and saved it, and unpaired buttons look for a hub by broadcasting, so they paired with each other. Button 0.3.7 and hub 0.2.3 fix it: the hub answers every hello by name with a `link` line carrying its own id (0.2.2 used `hub`, which buttons answer with a hello: a storm), a button believes only lines carrying its own id and only while they keep coming, nothing is saved. The light shows the state (amber blinking: looking; green: linked, waiting for the game; amber dot over the game light: hub gone), and so does the Atom's onboard pixel, now driven by the core's `rgbLedWrite` instead of a second NeoPixel object (which never lit). For the app session: the hub's announce now carries `"id"`; nothing for the app to do.

**Seen working 2026-09-28, evening:** all six Atoms on button 0.3.7, hub on 0.2.3, every button checking in every 10 s and showing green on its onboard pixel (Garett's eyes). Four were updated over the air, two of them after being rescued from a wrong pairing: old firmware adopts whoever it hears, so a burst of broadcast lines from the hub (`{"t":"hub","dev":"FFFFFFFFFFFF"}`, every 70 ms for 8 s) made them adopt the hub and check in. Ids: 441BF6F4C1C0, 441BF6F4C5A8, 441BF6F4F4EC, 441BF6F504F8, 441BF6F558F0, E072A1E52B30; hub 441BF6F4F41C. Not yet tested: pulling the hub (amber within 35 s, green again within seconds), a game with all six, hours of running.

**2026-09-28, later:** all six Atoms seen green on 0.3.7 with hub 0.2.3 (four updated over the air; two rescued from a wrong pairing by a burst of broadcast lines from the hub, which old firmware adopts). Ids: 441BF6F4C1C0, 441BF6F4C5A8, 441BF6F4F4EC, 441BF6F504F8, 441BF6F558F0, E072A1E52B30; hub 441BF6F4F41C. Two things found right after: a hub with no page reading its port stalled and the buttons went amber (hub 0.2.4 never waits on serial), and the onboard pixel stayed green all game because it showed only the link (button 0.3.8: it shows the game's light, the average of the hex, one pixel for rainbow). Garett is testing on bare Atoms until the hexes arrive, so the onboard pixel is the button's light for now. 0.3.8 and 0.2.4 are published, not yet seen on hardware.

**Played, 2026-09-28:** all six Atoms on button 0.3.8 and the hub on 0.2.4 (four buttons updated over the air, about 34 s each), then a few rounds of a real game with people at the table, on bare Atoms with the onboard pixel as the light. Garett: working as intended. Open light issue, by design rather than a fault: when a strategy card is flipped only the active player's button changes, so nothing announces the card to the table; the fix is the card announcement from `/shows.html` (engine says it, firmware draws it), not yet built. Still untested: pulling the hub mid-game, hours of running, hexes on all six (arriving).

**Breathing out of step (2026-09-28):** in the play test one button breathed behind the others. The host stamps a light's phase `p` when it sends; a sleeping button hears it up to 200 ms later, more with messages queued ahead at the hub, and nothing re-syncs it until the next light. Hub 0.2.5 adds the wait to `p` at each send attempt. Published; not yet flashed or seen. The better long-term design is a shared clock carried on the hub's `link` answers (crystals drift about 150 ms an hour uncorrected, under a millisecond corrected every 10 s); do it with the table shows. For the app session: only `pulse` and `flash` carry `p` today, so any other animated look starts when each button hears it.

## Feel (2026-09-29)

Button 0.3.9 draws more of the press itself, before the radio has carried anything: a whitened front from the centre to the rim when the switch closes, a hold fill that starts slowly and gathers speed and goes from the player's colour to white, a fill that runs back out if the hold is let go early, a small settle when a tap is released. New optional field on `led`: `h` (0 or 1, default 1). With `h: 0` the button shakes its rim red for as long as it is held and reacts as denied when the time is up; it still reports the hold. `/fx.html` has a "Feel: ending a turn" section to try it without a game, with the hold time on a slider. For the app session: nothing has to change, but sending `h: 0` on a player's light whenever the engine would refuse their hold (others still owe a response to a strategy card, say) gives them the answer at once instead of after the hold; and 2 s is too long for the default hold, Garett suggests about 0.9 s (`holdMs` in `src/state/settings.ts`).

## Three light levels (2026-09-29)

Garett: full brightness is too bright; your turn at 50 %, waiting at 10 %, effects brighter but also the admin's to set. Button 0.3.10 takes `bright`, `dim` and `fx` in `cfg` (each 0–100, a share of the button's full output) and starts at 50, 10 and 80. `dim` is the `dim` mode and the floor under every animated mode; `fx` is the one-shots, the press and the hold fill. `/fx.html` has the three sliders. **For the app session:** the game sends `bright` today (host slider times the player's own, default 100), so in a game the buttons go back to 100 % until that default is 50 %; and `dim` and `fx` want sliders beside it in the game settings, sent in the same `cfg` (`cfgFrame` in `src/hardware/serial.ts`). The on-screen buttons and phones should follow the same three numbers.

**App side (2026-09-29, app session):** the game sends `bright`, `dim` and `fx` in every `cfg`: the host's sliders under "Button brightness" in the game settings (your turn, waiting, effects; defaults 50, 10, 80), each scaled by the player's own brightness from their phone. The default hold is 0.9 s. Every light whose hold the engine would refuse or ignore carries `h: 0` (`holdCounts` in `src/engine/engine.ts`, checked against the reducer in the unit tests). When a button on 0.3.9 or later was told `h: 0`, the host no longer sends its own `denied` for that hold, so the button shakes once, not twice; older firmware still gets the `denied`. Laptops that had saved their settings move to the new hold and brightness unless they had chosen something else. The on-screen buttons and phones draw the refused hold too (a red, full, shaking ring) and follow waiting and effects in proportion to your turn. Tested against the fake hub in `e2e/hub.spec.ts`; not yet seen on real buttons.

## Battery test (2026-09-29)

`firmware/soak.py` runs a cell flat and says how long it lasted: it sets a light (a game's rhythm by default, one minute of "your turn" in six; or `--light steady`, or `--light waiting`), logs every check-in to `firmware/soak-logs/`, keeps the laptop awake, and reports once a button has been silent for five minutes. The button does nothing extra for it (Garett's rule: measure what a game does): from 0.3.11 its usual hello carries `up`, seconds since power-up, and the laptop writes that down. Nothing is written to the button's flash.

## Power parts on the desk (2026-09-30)

Riders and cells arrived. **Cells:** seven EEMB LP963450; four ran an Atom at once, one woke on the charger, two never took charge after ten attempts each (to be returned; two replacements due Sunday 2026-10-04). They ship full. Red is + and matches the Rider's marking. **Rider (Lipo Rider Plus):** USB-A out on one end; on the other end the battery socket and the USB-C side by side; slide switch on a long edge, the same edge as the battery socket; a row of level LEDs. With the switch off there is no 5 V. It charges at up to about 2 A (2.3 A seen at the input), which is above what an 1800 mAh cell wants for a full charge: charge from a weak source. Connecting a cell to an already powered Rider starts a charge cycle with a surge that dies away in seconds; connecting the cell first and power second does nothing if the cell is full. The Rider shows 4.2 V on its battery pads with no cell fitted, so that reading proves nothing about a cell. **Draw, measured at 5 V on the button with its hex:** about 52 mA at 10 %, 76 mA at 50 %, 120 mA at 100 % (live readings); floor about 46 mA. About 20 hours of a real game on one cell, by arithmetic; `firmware/soak.py` is the test. **Box:** v2 redrawn round the real parts, 72 x 80 (see `hardware/shell/README.md`); not yet printed.

## Strategy card round the table, scoring ripples inward (2026-09-30, from a real game)

Button 0.3.12 drew `fx` `card` with a colour `c`: fill from the rim inward, hold, blink once. 0.3.14 (after Garett saw it): fill, hold until `d` ms, fade back over 400 ms and start the light underneath afresh; the host sets each button's `d` so the table fades as one, then the player's flash begins on. The host (`useGameAudio`) sends it round the table from the player who played the card, 320 ms apart, so the colour goes round (the first of the `/shows.html` announcements, done with per-button `fx` rather than a `show` message; the buttons have no shared clock, and 320 ms steps hide the jitter). Your turn to score is sent as `warp` (rings fall inward), whatever the player's turn effect, then (0.3.13) the scorer's light is `pulse` with `l:"ripple_in"`, the standard's extra mode asked for by name so phones and older buttons still see "your move", and everyone else is off; the tidy-up after scoring is dark (a tap still says ready, and shows as dim). Also fixed in the engine: re-seating mid-game ignored a real button whose owner the game knew from its first claim, so "reconnect" only worked in a new game.

## Rehearsal page and light levels (2026-09-30)

`/rehearse.html` runs the six real buttons through a game's situations with no game: seat claiming, the strategy pick, a turn (with the turn effect), a strategy card (the card round, the primary, the secondaries), the status phase (rainbows, scoring in order with the inward ripple, the dark tidy-up), the agenda, the winner, and an in-sync test (all flash with a phase, all flash without). The page shows what each button should be doing and the buttons' own presses move it along the way the game does. `window.rehearse.feed(line)` feeds it a hub line for trying it without a hub. The app's light levels now default to 60 / 5 / 80 (settings v3 migrates a laptop that still had 50 / 10); the screen keeps "waiting" at no less than 12 % of "your turn" so it stays readable.

## Your move: breathe, then steady; no ring; waiting can be off; no feet (2026-09-30)

Garett, after a round with six buttons: the white ring at the start of a turn was jarring, and a table of six buttons at three brightnesses was a puzzle. Now: the turn effect defaults to none; "your move" defaults to a new look, `settle` (button 0.3.15, cfg `pulse:"settle"`): two and a half breaths from the light's start, ending on the swell, then solid; the Waiting level goes to 0 (`dim:0`), so only the active player is lit and the screen keeps who has passed. Settings v4 moves a laptop still on solid/ring. The lid has no foot recesses.

## The hub's light and watchdog (2026-09-30)

Hub 0.2.6 lights its Atom pixel: amber breathing = nobody has the port open, blue = port open but no button heard for 35 s, green = port open and every known button answering (blink per press), red = a known button lost. It also reboots itself if the loop stalls 10 s (esp_task_wdt). Cause: during the battery drain at 14:00 the hub went silent on serial with USB still enumerated; a DTR/RTS reset over the port (`s.rts = True` then False, as esptool does) brought it back. Not understood yet; a wedge in the USB-serial path after the bus reset when two Riders were plugged in to charge is the suspicion.

## Cells (2026-09-30, afternoon)

All seven EEMB cells are alive: the last two "dead" ones woke on a proper charge (Rider powered first, then the cell). Return cancelled; two more arrive 2026-10-04, so there are spares. `hardware/BATTERY_LOG.md` keeps every run-down.

## Battery benchmark (2026-09-30 evening)

A full EEMB cell ran a button at white, solid, 100 % (the firmware's cap) for **4 h 22** before the Rider cut it off, and overnight five more from full gave 4:11, 4:23, 4:25, 4:31 and 4:40 (the first cell again: 4:25, repeatable): **20–28 hours of game** at the game's rhythm, no weak cell in the set. Details in `hardware/BATTERY_LOG.md`. The white draw was estimated (≈360 mA) and never measured; the hours are measured.

## The press: spiral arms instead of bars (2026-10-01)

Garett worried the buttons won't stand up to a game's presses. First principles: when a stop decides how far a bar bends, the bar is stressed in proportion to its thickness times the bend over its length squared. So this morning's stouter bars (1.4 × 3.0) at the deeper stop (1.0 mm after the click) work at about 84–135 MPa, past what printed PLA takes (about 75), and press the Atom's switch with 40–90 N. The 1.0 × 2.2 bars that cracked on 2026-09-30 were at 26–41. Drawn properly (the disc stops at the switch while the cage goes on), the disc also rises 0.7 mm into the hex's back as drawn (`HEX_SOCKETS` is MEASURE: worth a look whether anything on the hex's back sits over the middle). The cage's middle is now three 180° spiral arms cut by 300° slots (`FLEX_STYLE`): about 6 N/mm, 16 MPa per mm of bend, the click after 0.34 mm of give, 3.5–5 N on the switch at the stop, 1.0 mm of room under the hex. `flex_model.py` has the numbers; the shell README the reasoning. **Reprint only the cage and a set of pegs** (`stl-v2/nub-2.0` to `3.5`, quarter millimetres; the stem is thinner, so old pegs don't fit). Housing, platform, lid and cap are unchanged byte for byte. (Superseded the same day: the peg-per-button choice below doesn't survive tape that creeps; see the next entry.) Rub a candle on the collar and sleeve (dry PLA can wedge if pressed near the cap's edge; waxed it can't); without the peg the cap should fall to the stop by its own weight. Modelled and clash-checked; not printed.

## The stop on the Atom (2026-10-01, afternoon)

Garett: the Atom sits on foam tape, so its height changes, and a peg chosen per button doesn't stay right. Correct. The cap rests on the Atom, but the stop (the collar) was on the platform, so the travel after the click followed the tape. Now the ring round the cage's sprung middle stands 1.2 mm below the plate and lands on the Atom's own top corners, outside its button, 0.75 mm after the cap starts to move. Rest, click and stop are all measured from the Atom; with the drawn 1.75 mm peg it works with no tape up to 1.25 mm of it. The check runs with 0 and 1.0 mm (`TAPES`) and prints where the cap rests, clicks and stops. The arms are stouter (2.2 thick inside a 14 mm ring: 9 N/mm, 0.45 mm of bend at the stop, about 4 N on the switch, 10 MPa). A slap goes through the Atom's case into the tape; the printed collar is the backup. The peg depends only on how deep the Atom's button sits (MEASURE), so it is chosen once (`nub-1.25` to `2.25`) and printed six times. Garett also suggested the hex attach to the cap directly: it already rides with the cap (ledges below, the cap's bosses above) and carries no load. Moving it would mean six new caps for no gain in the press, so it stays. Reprint the cage and the pegs only. **To check on a real Atom first:** its top corners are flat case outside the button, from about 14 to 15.5 mm out from the middle. Modelled and clash-checked; not printed. The sprung shells (mini, v1, v3, v4) are unchanged (`STOP_RING` = 0; v3 puts v2's settings back).
