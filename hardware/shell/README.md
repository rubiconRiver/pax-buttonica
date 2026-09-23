# The button's shell

Five printed parts around the plug-together electronics: an M5Stack AtomS3 Lite, a Mechanical Key Unit, a NeoHEX light board and four AAs. A hexagonal base, because Twilight Imperium is made of hexagons, and a round, flat-topped cap with a 45° shoulder.

![front cutaway](section-front.svg)

**Revision 0.2. Status: modelled, never printed.** Every M5Stack dimension is from their published sizes, not from parts in hand; each one is marked `MEASURE` at the top of `make_shell.py`. The script checks that no part overlaps another, at rest or fully pressed, and that is all it proves. Print `fit_test` and the cap today; print the body, bridge and plinth after measuring the real parts.

About 106 mm across the base's flats (122 mm corner to corner), 90 mm across the turret, 75 mm tall, with a 70 mm cap.

## What's where

- **NeoHEX** lies on three small ledges 8 mm above the body's floor, LEDs up, its sockets hanging in the gap below. The cap's diffuser is about 40 mm above it.
- **Key Unit** sits on a printed bridge over the hex, keycap centred under the cap. The bridge shadows part of the hex; the white cavity bounces that light back. Its cable leaves along +x.
- **AtomS3 Lite** lies flat against the +x wall with its USB-C in a **window through the wall**. The battery's USB-C plug, or the laptop's cable, plugs in from outside, so flashing needs no disassembly. The splitter is taped on top of it.
- **AA holder** in a pocket under the plinth, cover and switch facing the table. Its leads cross the pocket's roof, come up through a slot beside the turret and run up a groove in the outside of the +x flat to the plug.

## The parts

| File in `stl/` | Colour | What it does |
|---|---|---|
| `body.stl` | black | The turret: floor, hex ledges, a fence for the Atom, the USB window and lead groove, four screw posts. |
| `bridge.stl` | black | Two legs and a frame. The Key Unit drops into the frame; the legs push into pockets in the floor. |
| `bezel.stl` | black | Screws down over the cap. Its bore guides the cap's skirt; a cone inside holds the cap's flange in. |
| `cap.stl` | white | What you hit. The top is 1.2 mm thick, which is the diffuser. A 9 mm plunger rests on the keycap. |
| `plinth.stl` | black | The base. Battery pocket underneath. **Sized from Adafruit's listing for the 830 holder; measure yours first.** |
| `fit_test.stl` | any | Two thin rings, a quick print: a slice of the bezel's bore and a slice of the cap's skirt. The small ring should slide freely in the big one without rattling. If not, change `SLIDE_CLEARANCE`. |

Every STL is already turned the way it prints: cap, bridge and plinth are upside down, flat face on the bed. **No supports on anything.**

## How the press works

- The cap travels **2.8 mm**, then its flange lands on the top of the body's wall. Plastic takes the blow; the key's switch has about 4 mm of travel and is never bottomed out.
- The switch's spring holds the cap up against the cone in the bezel. The cap weighs about 18 g; a blue switch pushes back with 50–60 g. Fine.
- Off-centre hits are carried by the skirt in the bezel's bore and the flange in the chamber below it. Hits right at the rim may drag; dry PTFE on the skirt is the first thing to try.

## Printing (Bambu X1C, 0.4 mm nozzle)

0.2 mm layers, 3 walls, 15% infill, PLA. Black for everything but the cap. **Cap:** white PLA glows evenly; translucent PETG passes more light. Print it with 4 walls. Roughly 130 g of black and 20 g of white per button; trust the slicer's number.

## Screws

M3 × 8, socket-head or pan-head, self-tapping into the plastic: 4 up through the plinth into the body's posts, 3 to 6 for the bezel. About 10 a button.

## Assembly

1. **Body:** drop the hex board onto its ledges (sockets down, one socket toward −x). Plug a Grove cable into it. Push the bridge's legs into the floor pockets.
2. **Atom:** splitter taped on top, into the fence with the USB-C in the window. Splitter to the Atom's socket; hex and key cables into the splitter.
3. **Key Unit** into the bridge's frame, socket toward +x, cable to the splitter.
4. **Plinth:** holder in the pocket with foam tape, leads through the slot and up the groove; four screws up into the posts.
5. **Cap** on the keycap, **bezel** over it, three screws.

## Changing it

Everything is a named number at the top of `make_shell.py`. The old carrier-board version is `make_shell_pcb.py`.

```bash
python3 -m venv .venv && .venv/bin/pip install manifold3d numpy    # once
.venv/bin/python make_shell.py                                     # rewrites stl/ and the two cutaways
```

It must finish with `clash check: clean`.

## Known gaps

- Every M5 part size is unmeasured. The keycap is assumed centred on the Key Unit's body.
- The hex's ledges assume 36 mm across flats with the ears removed; if the ears stay on, widen `HEX_ACROSS`.
- The screw-terminal USB-C plug's body hangs outside the wall in a shallow recess. A proper cover for it is a later revision.
- No hub enclosure yet.
