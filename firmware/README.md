# Firmware

Two Arduino sketches for the ESP32-C3, written against `docs/BUTTON_STANDARD.md`.

| Sketch | What it is |
|---|---|
| `hub/` | The USB relay. Serial lines in → ESP-NOW out, and back. Never looks inside a message beyond finding `"dev"`. |
| `button/` | A button. Six light modes, tap / double / hold, note-list jingles over I2S or a piezo. All pins and options are in `button/config.h`. |

**Both compile; neither has been run on real hardware yet.** Wiring, flashing and bring-up steps are in [`docs/HARDWARE.md`](../docs/HARDWARE.md). Test with the web app's `/bench` page.

How buttons find the hub: a button broadcasts `hello` until anything answers; whoever answers is the hub, and its address is saved to flash. Everything after that is unicast. A heartbeat `hello` every 10 s lets a reloaded web app rediscover buttons. Both ends sit on Wi-Fi channel 1 and never join a network.
