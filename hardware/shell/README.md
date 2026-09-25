# The button's shell

Five printed parts around the plug-together electronics: an M5Stack AtomS3 Lite, a Mechanical Key Unit, a NeoHEX light board and four AAs. A hexagonal base, because Twilight Imperium is made of hexagons, and a round, flat-topped cap with a 45° shoulder. The hex rides inside the cap, so nothing sits between the LEDs and the diffuser.

![front cutaway](section-front.svg)

**Revision 0.3. Status: modelled, never printed.** The M5Stack sizes come from M5's own dimension drawings; the few that don't are marked `MEASURE` at the top of `make_shell.py`. The script checks that no part overlaps another, at rest or fully pressed, and that is all it proves. The electronics themselves were proven on the bench on 2026-09-24.

About 106 mm across the base's flats (122 mm corner to corner), 90 mm across the turret, 75 mm tall, with a 70 mm cap.

This revision uses the Atom's own socket plus a **Unit Hub 1-to-3 splitter** (U006), not the PortABC base: the base with the Atom on it is 60 mm long including the plugs and doesn't lie beside a centred key unit inside the turret. The firmware pins for the splitter wiring are the Atom's own: hex data on G2, key on G1.

## What's where

- **Key Unit** on the body floor, dropped onto two pegs that fit its own mounting holes, keycap on the axis. Its cable leaves toward −y.
- **Saddle:** a printed cup that sits over the red keycap, with a 36 mm brim. It's what the cap presses, because the hex's sockets fill the middle of the board and a central plunger has nowhere to land.
- **NeoHEX** clips into a four-legged cage hanging from the cap's ceiling, LEDs up, 12 mm under the diffuser, sockets down. Push it up from below until the legs' lips click over its edge. The legs continue below the board and end in pads that rest on the saddle's brim. Press the cap: cap, hex and pads move together and press the saddle onto the keycap. The hex's cable loops down from its underside socket to the splitter.
- **AtomS3 Lite** lies flat against the +x wall with its USB-C in a **window through the wall**. The battery's USB-C plug, or the laptop's cable, plugs in from outside. The splitter is taped on top of it.
- **AA holder** in a pocket under the plinth, cover and switch facing the table. Its leads cross the pocket's roof, come up through a slot beside the turret and run up a groove in the outside of the +x flat to the plug.

## The parts

| File in `stl/` | Colour | What it does |
|---|---|---|
| `body.stl` | black | The turret: floor, key pegs, Atom bay, the USB window and lead groove, four screw posts. |
| `cap.stl` | white / translucent | What you hit, with the hex cage hanging inside. The top is 1.2 mm thick, which is the diffuser. Print with 4 walls. |
| `saddle.stl` | any | The cup over the keycap. |
| `bezel.stl` | black | Screws down over the cap. Its bore guides the cap's skirt; a cone inside holds the cap's flange in. |
| `plinth.stl` | black | The base. Battery pocket underneath. **Sized from Adafruit's listing for the 830 holder; measure yours first.** |
| `fit_test.stl` | any | Two thin rings, a quick print: a slice of the bezel's bore and a slice of the cap's skirt. The small ring should slide freely in the big one without rattling. If not, change `SLIDE_CLEARANCE`. |

Every STL is already turned the way it prints: cap, saddle and plinth are upside down, flat face on the bed. **No supports on anything.** The cap's cage legs print as four short towers on its underside.

## How the press works

- The cap travels **2.8 mm**, then its flange lands on the top of the body's wall. Plastic takes the blow; the key's switch has about 4 mm of travel and is never bottomed out. The cage legs only ever carry the switch's spring force.
- The switch's spring holds the cap, hex and saddle up against the cone in the bezel. That stack weighs about 30 g; a blue switch pushes back with 50–60 g. Fine, but not lavish: if the cap doesn't return crisply, a thinner `CAP_WALL` is the first lever.
- Off-centre hits are carried by the skirt in the bezel's bore and the flange in the chamber below it. Hits right at the rim may drag; dry PTFE on the skirt is the first thing to try.

## Printing (Bambu X1C, 0.4 mm nozzle)

0.2 mm layers, 3 walls, 15% infill, PLA. Black for everything but the cap. **Cap:** white PLA glows evenly; translucent PETG passes more light. Print it with 4 walls. Roughly 130 g of black and 20 g of white per button; trust the slicer's number.

## Screws

M3 × 8, socket-head or pan-head, self-tapping into the plastic: 4 up through the plinth into the body's posts, 3 to 6 for the bezel. About 10 a button.

## Assembly

1. **Body:** drop the Key Unit onto its pegs, socket toward −y. Atom into its bay with the USB-C in the window, splitter taped on top. Key cable → splitter → Atom.
2. **Saddle** over the keycap.
3. **Cap:** push the hex up into the cage from below until it clicks, LEDs toward the diffuser. Plug its cable into an underside socket and lead it out past a leg.
4. Lower the cap over the body, hex cable to the splitter, pads onto the saddle's brim. **Bezel** over it, three screws.
5. **Plinth:** holder in the pocket with foam tape, leads through the slot and up the groove; four screws up into the posts.

## Changing it

Everything is a named number at the top of `make_shell.py`. The old carrier-board version is `make_shell_pcb.py`. The cutaways are cut through the axis, so the cage legs (at 60° off the axes) don't appear in them.

```bash
python3 -m venv .venv && .venv/bin/pip install manifold3d numpy    # once
.venv/bin/python make_shell.py                                     # rewrites stl/ and the two cutaways
```

It must finish with `clash check: clean`.

## Known gaps

- The snap lips (0.9 mm) and the socket-cluster size on the hex's back are estimates. If the hex won't click in, shave `LIP`; if a pad lands on a socket, rotate `CAGE_ANGLES`.
- The screw-terminal USB-C plug's body hangs outside the wall in a shallow recess. A proper cover for it is a later revision.
- No hub enclosure yet.
