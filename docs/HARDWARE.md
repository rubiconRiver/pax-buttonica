# Building the buttons

**Status: a plan, not a proven build.** The firmware in `firmware/` compiles for the ESP32-C3 but has never been flashed onto a board. The wiring below follows the parts' datasheets, not a working prototype. Build **one hub and one button first**, prove them on the [test bench](/bench), then buy parts for the rest. Prices are rough and in CAD.

## What you're building

```
[button] ─┐
[button] ─┼─ ESP-NOW (channel 1) ─→ [hub] ─ USB ─→ laptop running the web app (Chrome/Edge)
[button] ─┘
```

- **Hub** — a bare ESP32-C3 board on a USB cable. No wiring at all.
- **Button** — ESP32-C3 + LED ring + one big switch + 4 AA cells, in a printed shell. **No speaker:** every sound, including each player's entrance and exit music, plays from the laptop.

## Parts, per button

| Part | Notes | Approx. |
|---|---|---|
| ESP32-C3 "Super Mini" | Native USB, tiny, cheap. Any ESP32-C3 board works; change pins in `config.h`. | $4–8 |
| WS2812B ring, 8 or 12 pixels (32–50 mm) | The 8-pixel ring suits the compact dome. Any count works; set `LED_COUNT`. | $3–6 |
| Microswitch (lever or plunger type) | Sits under the printed dome's plunger. | $1–2 |
| 4×AA holder with switch + leads | | $2–3 |
| 4× NiMH AA cells | **NiMH, not alkaline** — see Power. | $10–15 |
| 1N5817 Schottky diode | Reverse-polarity protection and a little voltage drop. | $0.20 |
| 1000 µF 10 V capacitor, 330 Ω resistor | LED power smoothing; data-line protection. | $0.50 |
| Optional: two tactile buttons | Strategy and pass shortcuts (`BUTTON_COUNT 3`). | $1 |
| Optional: 2× 100 kΩ resistors | Battery voltage sense (`BATTERY_PIN`). | $0.10 |

Roughly **$22–35 per button** including rechargeable cells (about **$11–20 if you already own the AAs**: the cells are the most expensive line), and **$5–8 for the hub**. Six buttons and a hub: about $140–220. Cheaper from AliExpress if you can wait; faster from Amazon.ca. For genuine Adafruit/SparkFun parts in Canada: BC Robotics, Elmwood Electronics, PiShop.ca, Universal Solder, DigiKey.ca.

## The tidy way: a custom carrier board

`hardware/pcb/` holds a 70 mm round board that every part solders onto: ESP32 at the top, an MX-style keyboard switch dead centre, diode, capacitor, a three-hole connection for the LED ring and a screw terminal for the batteries, plus a spare solder hole beside every ESP32 pin. Upload `hardware/pcb/pax-button-v0.2-gerbers.zip` to a board house; details, and two checks to make before soldering the ESP32, are in [`hardware/pcb/README.md`](../hardware/pcb/README.md). It passes KiCad's rule check; no board has been manufactured yet.

### Putting a button together on the board

The green board is the base. **Everything solders onto it, the ESP32 included**, and the copper inside the board makes the connections, so there is nothing to wire between parts. Lowest parts first, so the board lies flat while you work:

1. **Check your ESP32 first.** Look down on it with the USB port at the top. The top pin on the **right** should be labelled 5V. If it's on the left, the ESP32 goes on the back of the board instead (it says so on the board).
2. **D1, the diode.** Bend the legs, push it through, stripe toward the **K**. Solder underneath, snip the legs.
3. **The ESP32.** It comes with two loose strips of pins. Stand the strips in the board's two *inner* rows of holes, lower the ESP32 onto them with the **USB port pointing off the edge**, and solder every pin on top (to the ESP32) and underneath (to the board). Solder one corner first and check it's sitting flat before doing the rest. The outer rows of holes stay empty: they're spares for adding things later.
4. **SW1, the switch.** Push it in from the top until it clicks flat, then solder its two metal pins underneath.
5. **C1, the capacitor.** The longer leg goes in the hole by the **+**. The stripe on the can is the negative side.
6. **The battery leads** into J1: red to **+**, black to **−**. Either solder them straight into the holes or fit a screw terminal.
7. **The LED ring.** Three wires from the ring's 5V (or VCC), GND and **DI** (data *in*, not DO) pads to the holes marked 5V, G and DIN.
8. Skip R1 and leave JP1 alone: the board works as it comes.

That's about forty-five solder joints a button, all of them big through-hole ones; roughly half an hour each once you've done the first. Flash the firmware over USB with the battery switched **off**, and keep it off whenever USB is plugged in.

With the board, the wiring table below is what the copper does for you. Without it, it's what you wire by hand on perfboard (using a KW12 microswitch, which fits perfboard; keyboard switches don't).

## Wiring (defaults from `firmware/button/config.h`)

| From | To |
|---|---|
| Battery **+** → holder switch → **1N5817** (stripe away from battery) | **5 V rail** |
| Battery **−** | **GND rail** |
| 5 V rail | ESP32-C3 `5V` pin · LED ring `5V`/`VCC` |
| GND rail | ESP32-C3 `GND` · LED ring `GND` |
| 1000 µF capacitor | Across the LED ring's 5 V and GND, close to the ring (mind polarity) |
| ESP32-C3 `GPIO10` → 330 Ω → | LED ring `DIN` |
| ESP32-C3 `GPIO3` | Big switch → `GND` (no resistor; the firmware uses the internal pull-up) |
| *Optional* `GPIO4`, `GPIO5` | Strategy / pass switches → `GND` |
| *Optional* battery + → 100 kΩ → `GPIO0` → 100 kΩ → GND | Battery sense |

That's the whole circuit: three wires to the LED ring, two to the switch, two to the batteries.

**Want your own button to make noise?** It's optional and off by default. Fit a MAX98357A I2S amp (`VIN`/`GND` to the rails, `BCLK` → GPIO6, `LRC` → GPIO7, `DIN` → GPIO1) and a small 4–8 Ω speaker, or a passive piezo on GPIO1, and pick `AUDIO_I2S` or `AUDIO_PIEZO` in `config.h`. The app notices and sends that button its owner's jingles; uploaded clips still play from the laptop.

On the ESP32-C3, **don't use GPIO 2, 8 or 9** for anything: they decide how the chip boots (8 is also the onboard LED, 9 the BOOT button).

**Never plug in USB while the battery switch is on** unless your board has a diode between USB 5 V and the `5V` pin (most Super Minis do not). For development, power the button from USB alone.

## Power

- **Why NiMH:** four NiMH cells sit between about 4.4 V and 5.6 V. After the diode that suits the LEDs (happy to ~5.3 V) and the board's 3.3 V regulator. Four fresh **alkalines are 6.4 V — too much** for the LED ring. If you must use alkalines, use three.
- **How long:** this first firmware keeps the radio listening all the time — about 80–100 mA before any light. With the default brightness cap and only one button at a time breathing at full, expect very roughly **8–15 hours** from 2000 mAh cells. *That's an estimate; measure yours.* The polling scheme in the standard is what gets that to days, and is the obvious next firmware milestone.
- `MAX_BRIGHTNESS` and `DIM_LEVEL` in `config.h` are the two dials that matter most.

## Flashing

You need `arduino-cli` (or the Arduino IDE), the **esp32** board package (3.x), and two libraries: **Adafruit NeoPixel** and **ArduinoJson** (v7).

```bash
arduino-cli core install esp32:esp32
arduino-cli lib install "Adafruit NeoPixel" "ArduinoJson"
```

Find the board's port, then build and upload. `CDCOnBoot=cdc` matters: it's what makes the C3's USB port a serial port.

```bash
arduino-cli board list
arduino-cli compile -b esp32:esp32:esp32c3:CDCOnBoot=cdc -u -p /dev/cu.usbmodemXXXX firmware/hub
arduino-cli compile -b esp32:esp32:esp32c3:CDCOnBoot=cdc -u -p /dev/cu.usbmodemXXXX firmware/button
```

If an upload won't start, hold **BOOT**, tap **RESET**, release BOOT, and try again.

## Bring-up, in order

1. **Hub alone.** Flash it, open `/bench` in Chrome, click *Connect the hub*. You should see the hub's firmware version.
2. **Button on USB power, no battery.** Flash it. It blinks white once at power-up and announces itself within three seconds; it appears on the bench with its id and capabilities.
3. **Poke it.** Send each light mode and *Identify*. Press it: `tap`, `double`, `hold` should show up beside it. The white arc while holding is drawn by the button itself.
4. **Battery.** Unplug USB, switch on the pack. Same checks again.
5. **A game.** Open `/play`, connect the hub from the top bar, and start: the seat-claiming ritual binds each button to a player.

**Range check.** The bench shows each button's signal strength at the hub. Put the buttons where they'll really sit, have someone stand in the way, and look for anything weaker than about −80 dBm. If a seat is weak: raise the hub off the table on a short USB extension (away from the laptop's metal body), and inside the button keep the antenna end of the board away from the batteries and pointing up or outward.

Wire traffic is shown at the bottom of the bench page, which is the first place to look when something doesn't respond.

## The shell — a brief for whoever is modelling it

A first model is in [`hardware/shell/`](../hardware/shell/README.md): ready-to-print STLs and the script that makes them. It has not been printed yet. It follows this brief, with one change: the top is a flat cap with a 45° shoulder, not a dome, so it prints without supports and diffuses evenly. What the electronics need:

- **Size: compact.** Table space in a six-player game is scarce, so the standard button is small — think a **60–70 mm dome on an 85–90 mm base**, not a Staples Easy Button. The part that sets the floor is the battery holder: a back-to-back 2×2 AA holder is about 58 × 32 × 30 mm. If that's still too big, the honest options are a holder that stands the cells upright, 3×AAA (fine for the electronics, roughly a third of the runtime), or giving up AAs for a single rechargeable lithium cell.
- **Dome:** translucent white (natural PETG or thin white PLA, 1.2–1.6 mm wall diffuses well). It *is* the button: it should travel 3–4 mm and bottom out on a plunger over the microswitch, with a return spring or printed flexures. A satisfying press matters more than anything else here.
- **Guide the dome; don't balance it.** A 65 mm dome perched on one small switch stem will rock and bind when it's hit off-centre, which is how everyone hits it. Give the dome a skirt that slides inside a collar in the base (about 0.3 mm clearance all round), and let the switch only *sense* the press and push the dome back up.
- **A hard stop that isn't the switch.** People will slam this. The dome should bottom out on the base after about 3.5 mm, just before the switch does, so the shell takes the blow and the switch never does.
- **Hold the board up from underneath.** Put a printed pillar under the middle of the board, directly below the switch, as well as the four M3 posts, so a slap can't flex the board.
- **The ring sits above the switch, not around it.** An 8-LED ring's hole is too small to fit over the switch body, so it goes on a printed shelf about 12 mm above the board, clear of the switch and the ESP32, with the dome's plunger passing down through its hole (keep the plunger under 12 mm wide).
- **Keep the batteries away from the antenna.** Leave 10 mm or more between the underside of the board and the battery cells; metal right under the antenna costs range.
- **Light:** the LED ring faces up, at least 15–20 mm below the dome's inner surface, or you'll see twelve dots instead of a glow. A white-painted or foil-lined cavity helps a lot.
- **Base:** heavy enough (or rubber-footed) not to skate when slapped. Room for the batteries and the ESP32 board, and nothing else: no speaker, no grille. A flat four-in-a-row AA holder is about 62 × 58 × 15 mm and needs a base over 90 mm; a back-to-back 2×2 holder is about 58 × 32 × 30 mm and fits the compact base.
- **Access:** battery door, power switch reachable from outside, USB-C port reachable for reflashing.
- **Optional:** two small tactile buttons on the base rim for strategy and pass.
