# Shopping list — six buttons, one hub, spares

> The interactive version, with quantities that follow the number of buttons and an explanation of every part, is on the site at `/parts`.

Checked on Amazon.ca on **2026-09-20**; prices and stock move, so treat them as a snapshot. Everything listed showed "In Stock" with delivery within a week. This is the speakerless standard build from [HARDWARE.md](HARDWARE.md).

| # | Item | Qty | Price (CAD) | Link |
|---|---|---|---|---|
| 1 | ESP32-C3 SuperMini, 4-pack (ships from Amazon) | 2 packs → 8 boards (6 buttons, hub, spare) | $28.49 ea | https://www.amazon.ca/dp/B0GQM4SRS3 |
| 2 | WS2812B 8-LED ring, 2-pack (Stemedu) | 3 packs → 6 rings (a 4th pack for spares is wise) | $14.49 ea | https://www.amazon.ca/dp/B0BY8ZP214 |
| 3 | 4×AA holder with on/off switch and cover, 4-pack, 70×65×20 mm | 2 packs → 8 holders | $12.99 ea | https://www.amazon.ca/dp/B0DK2SYS2Y |
| 4 | KW12 microswitch, straight lever, 15-pack | 1 | $13.97 | https://www.amazon.ca/dp/B0H49N65GQ |
| 5 | 1N5817 Schottky diodes, 20 pcs | 1 | $7.99 | https://www.amazon.ca/dp/B07RJYXVMQ |
| 6 | 1000 µF 16 V electrolytic capacitors, 10 pcs | 1 | $5.99 | https://www.amazon.ca/dp/B07FYSD8TD |
| 7 | Amazon Basics AA NiMH 2400 mAh, 24-pack | 1 | $39.70 | https://www.amazon.ca/dp/B07NWWHK1J |
| 8 | 8-bay NiMH charger (EBL) — skip if you own one | 1 | $19.99 | https://www.amazon.ca/dp/B082NZ8PP6 |
| 9 | 24 AWG silicone wire kit, 10 colours — skip if you have wire | 1 | $14.15 | https://www.amazon.ca/dp/B09X4HVFJX |
| 10 | Transparent PETG 1 kg, for the domes — skip if you have translucent/white filament | 1 | $16.99 | https://www.amazon.ca/dp/B0D91G9ZW3 |

| 11 | Double-sided perfboard assortment (ELEGOO, 32 pcs) — the tidy way to mount the ESP32 and microswitch | 1 | $17.99 | https://www.amazon.ca/dp/B072Z7Y19F |
| 12 | Heat-shrink tubing assortment (Ginsco, 580 pcs) | 1 | $13.99 | https://www.amazon.ca/dp/B01MFA3OFA |

About **$277** before tax for all of it; about **$226** without the charger, wire and filament.

## Alternatives

- **Microswitches, if the 15-pack is gone:** DEVMO KW12-3 (roller lever; snip the roller off), 10 pcs, $19.99 — https://www.amazon.ca/dp/B07TKGPMVV
- **LED rings, cheaper and Canadian:** Universal Solder 12-LED 50 mm ring, $2.99 each (10% off at 3+) — https://www.universal-solder.ca/product/12-led-ring-ws2812b-rgb-addressable-50mm/ . Twelve pixels draw a smoother hold arc and 50 mm suits the dome. Shipping time unverified.
- **Avoid for this build:** Universal Solder's ESP32-C3 "Super Mini Plus V2" ships with the *external* antenna jack enabled; using the on-board antenna means moving a solder jumper on every board.
- **Smaller base:** the open 57×62×16 mm holder (2-pack $8.87, https://www.amazon.ca/dp/B07T7MTRZX) fits a ~92 mm base but needs your own power switch and battery door. The switched, covered holder in the main list needs a ~105 mm base and saves designing both.
- **330 Ω resistor** on the LED data line is optional with short wires. If wanted: https://www.amazon.ca/dp/B0BTP88DZN (check it includes 330 Ω; 220–470 Ω all work).

## Firmware settings to match

- 8-LED rings: `LED_COUNT 8` in `firmware/button/config.h` (the default). 12-LED rings: `LED_COUNT 12`.
- No speaker: `AUDIO_NONE` (the default).

## Assumed on hand

Soldering iron and solder, flush cutters, a USB-C **data** cable, hot glue or M3 screws, stick-on rubber feet.
