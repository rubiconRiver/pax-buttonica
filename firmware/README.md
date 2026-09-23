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

## How buttons find the hub

A button broadcasts `hello` until anything answers; whoever answers is the hub, and its address is saved to flash. Everything after that is unicast. A heartbeat `hello` every 10 s lets a reloaded web app rediscover buttons. Both ends sit on Wi-Fi channel 1 and never join a network. After 10 minutes without a hub the button deep-sleeps; pressing it wakes it.
