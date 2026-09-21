# Hardware handoff

Where the physical side stands, for whoever (or whichever session) picks it up. Updated 2026-09-21.

## Deadline

Game night is roughly the first days of October 2026. Six buttons and one hub have to work by then. Favour whatever gets working buttons on the table over elegance.

## Decided

- **Button:** ESP32-C3 SuperMini, one MX-style clicky keyboard switch (Kailh BOX Jade or similar) under a guided dome, 8-LED WS2812 ring (12-LED 50 mm ring also fits), 4 × AA NiMH in a switched holder, 1N5817 reverse-polarity diode, 1000 µF across the LED supply. No speaker.
- **Hub:** a bare ESP32-C3 on USB, relaying newline-delimited JSON at 115200 between ESP-NOW and Web Serial. Reports per-button RSSI.
- **Carrier board v0.2** (`hardware/pcb/`): 70 mm round, 2-layer, breakout hole beside every module pin, optional R2/R3 battery divider, optional R1 behind pre-bridged JP1. DRC clean. Garett is ordering it from JLCPCB (2 layers, 1.6 mm, green, HASL, no assembly, 24 h build, express DDP courier, about US$41).
- **Fallback:** perfboard plus a KW12 microswitch, parts already on the shopping list, until a carrier board is proven.
- **Shell:** 3D printed by Garett. Requirements are in `docs/HARDWARE.md`: dome skirt sliding in a collar, hard stop in the plastic before the switch bottoms out, pillar under the board centre, LED ring on a shelf about 12 mm above the board, 10 mm or more between the antenna and the cells.

## Not yet verified on real parts

1. SuperMini footprint: row spacing 15.24 mm, 5V top-right seen from above with USB up. If a module is mirrored, mount it on the back of the board.
2. GPIO order after 3V3. The switch lands on the fifth pin of the 5V side; read the number on the module and set `BUTTON_PINS` in `firmware/button/config.h`. LED data is GPIO10.
3. Firmware has only ever been compiled: gestures (25 ms debounce, tap/double/hold), LED modes and the phase-locked `p` field, hub pairing stored in NVS, deep sleep after 10 min without the hub and wake on press.
4. `src/hardware/serial.ts` (Web Serial) has never talked to a real hub. `/bench` on the site is the test page.
5. Range: the goal is reliable at 5 m with a person in the way. The link budget says fine; measure it with the RSSI readout.
6. 3.3 V data into WS2812s fed about 5 V is marginal on fresh cells. If the first LED flickers, swap D1 for a 1N4001-type diode (drops more voltage, same holes).
7. Battery life: the radio listens continuously, so expect about one game day per charge. The holder's switch is the real off.

## Open work, roughly in order

- First-power checklist for when the parts arrive: flash hub, flash one button on a breadboard, pair, run `/bench`.
- The shell: nobody has modelled it yet. A parametric model (OpenSCAD or CadQuery) would suit the scripted style of the board.
- A hub enclosure, or at least strain relief for the USB cable.
- Later: a sleep/poll scheme for battery life, clip caching on the button, a fully assembled v2 board (SMD LEDs, level shifter, LED power switch) after game night.
