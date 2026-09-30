# Firmware

Two Arduino sketches, written against `docs/BUTTON_STANDARD.md`.

| Sketch | What it is |
|---|---|
| `hub/` | The USB relay. Serial lines in → ESP-NOW out, and back. Never looks inside a message beyond finding `"dev"`. |
| `button/` | A button. Six light modes and tap / double / hold. Silent by default (the laptop plays every sound). All pins and options are in `button/config.h`. |

**Both compile; neither has been run on real hardware yet.** Test with the web app's `/bench` page.

## Boards

The default build is the **no-solder button**: an M5Stack **AtomS3 Lite** with a **Mechanical Key Unit** (clicky switch) and a **NeoHEX** 37-LED board plugged into it through a PortABC base. The hub is a bare AtomS3 Lite on a USB-C cable. The ESP32-C3 SuperMini on the custom carrier board (`hardware/pcb`) is the soldered alternative; switch with the `BOARD_` line at the top of `config.h`.

```bash
# AtomS3 Lite (USB CDC is on by default for this target)
arduino-cli compile -b esp32:esp32:m5stack_atoms3 firmware/hub
arduino-cli compile -b esp32:esp32:m5stack_atoms3 \
  --library ~/Documents/Arduino/libraries/Adafruit_NeoPixel \
  --library ~/Documents/Arduino/libraries/ArduinoJson firmware/button

# ESP32-C3 SuperMini
arduino-cli compile -b esp32:esp32:esp32c3:CDCOnBoot=cdc firmware/hub
```

Add `-u -p /dev/cu.usbmodemXXXX` to upload (`arduino-cli board list` shows the port). Flash a button with only USB connected: the Atom has one USB-C socket, so the battery plug and the laptop can never be in at once.

## Wiring the AtomS3 build

Grove cables: black GND, red 5V, **yellow** first signal, **white** second signal. On the Atom's own socket yellow is G2 and white is G1; the PortABC base's Port A is that same pair, and its Port B and C are on other pins (a pin-map sticker comes in the box).

- **NeoHEX → Port A** (or the Atom's own socket). Data is on yellow = G2.
- **Key Unit → Port B.** Its switch is on white, its own LED on yellow.

Until the sticker has been read, `config.h` treats every pin Port B could be as the big button (an unconnected pin, pulled up, reads "not pressed"). Once you know the pin, keep just that one so the others are free.

The Atom's tiny onboard pixel mirrors the button's colour, so a bare Atom on a cable still shows what it has been told.

## Flashing without a terminal

`/flash.html` on the site flashes either sketch from Chrome over Web Serial, and its "Ask the Atom" button tells you what an Atom is running (a button answers with its id and blinks white; a hub answers as a hub). The images it serves live in `public/firmware/`; regenerate them with `firmware/export.sh` after changing firmware, then commit and deploy. `firmware/flash.sh hub|button` does the same from a terminal and finds the port itself.

## Over the air

Since firmware 0.3.5 a button only needs the USB cable once (seen working 2026-09-28, 0.3.5 to 0.3.6 through the hub). After that, with the hub on the laptop, section 3 of `/flash.html` ("Connect to the hub") lists every button the hub hears with its version, and **Update** sends it the published image through the hub in 153-byte chunks (`ota` messages, in `docs/BUTTON_STANDARD.md`); the button writes them to its spare app slot, checks the MD5, reboots, and its next `hello` shows the new version. About a minute per button; **Update every button that needs it** does them one after another. The light fills blue from the centre as the image lands. From a terminal, `hardware/shell/.venv/bin/python firmware/ota.py` (no arguments) lists what the hub hears, `all` updates every button that is behind, or give it ids. The game tab holds the hub, so close it first. The hub itself still takes the cable (it is on the laptop anyway). Both need the default partition table, which is what `export.sh` builds and what the flasher installs.

## Power

Since 2026-09-26 the button's radio sleeps between 30 ms listening windows every 200 ms and the hub resends until it is heard; the CPU runs at 80 MHz and `solid` is a bright rim with a softer centre. All of it is in `config.h` under Power. The hub must be flashed too, or lights will only reach a sleeping button by luck. `cfg` `ps: 0` keeps a button's radio on for comparison on a USB power meter.

## Settings from the host

`cfg` sets the hold time and blink period, and since 2026-09-26 also `bright` (0–100, a share of `MAX_BRIGHTNESS`) and `pulse` (how "your move" is drawn: `pulse`, `solid` or `heartbeat`). The host sends one per button, from its settings and the player's own choice on their phone.

## How buttons find the hub

The hub is the authority. It answers every `hello` with a `link` line addressed to that button by name, carrying its own id (hub 0.2.3). The line has its own type because a button answers `hub` with a hello, and an answer to every hello would go round for ever (0.2.2 did). A button (0.3.7) believes in a hub only while that keeps happening: it adopts whoever addresses it by name, ignores every line that does not carry its own id, remembers nothing across power cycles, and calls the hub gone after 35 s of silence or eight unacknowledged sends. Not linked it says hello to everyone every 3 s; linked, to the hub every 10 s. Both ends sit on Wi-Fi channel 1 and never join a network.

Before 0.3.7 the rule was "whoever talks to me is the hub", saved to flash. A button without a hub broadcasts, the other buttons hear it, and with six on a desk they paired with each other and the hub heard half of them (found 2026-09-28, the first time more than one was powered). 0.3.7 erases the saved hub on start-up.

**Reading a button:** until the host sends its first light, the middle of the hex blinks amber while it looks for the hub and sits green once linked; in a game an amber dot blinks over the light if the hub goes away; blue filling from the centre is an update arriving. The Atom's own small pixel shows the same state until the game speaks, then the game's light (the average of the hex), with amber blinking over it if the hub goes; it keeps a faint green when the game says off, so a powered, linked button is never fully dark. A bare Atom with no hex is a working button light. The hub (0.2.4) never waits on its serial output, so it keeps its buttons linked with no page open.

**Reading the hub** (0.2.6), its Atom's pixel: **amber breathing** means nobody is listening (no page or script has the USB port open; the buttons are still linked, the lines are just being dropped); **blue** means a page or script has the port and no button has been heard for 35 s; **green** means the port is open and every button that has been here is answering, with a blink on each press relayed; **red** means a button that was here has stopped answering (the hub has told the app `lost`). A hub that shows green while the page sees nothing is a serial problem, not a radio one. The hub also reboots itself if its loop stalls for 10 s (a task watchdog): on 2026-09-30 a hub sat with USB alive and nothing on the line until it was reset. The AtomS3 build never deep-sleeps: its face button is on a pin that cannot wake the chip; the Rider's switch is the off switch.
