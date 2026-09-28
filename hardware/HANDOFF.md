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
