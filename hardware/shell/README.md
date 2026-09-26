# The button's shell

Five printed parts around the plug-together electronics: an M5Stack AtomS3 Lite, a Mechanical Key Unit, a NeoHEX light board and four AAs. A hexagonal base, because Twilight Imperium is made of hexagons, and a round, flat-topped cap with a 45° shoulder. The hex rides inside the cap, so nothing sits between the LEDs and the diffuser.

![front cutaway](section-front.svg)

**Revision 0.6 (2026-09-26).** v0.5 was printed and the press felt good (the springs are optional: they don't stay in their pockets, and the button works without them). v0.6 replaces the AA plinth with a **tray for a lithium cell and a Lipo Rider**, so the base is the turret's own 90 mm hexagon instead of 106; both USB-C ports come out of the +x face, the Atom's above the Rider's; and a **card rail** on the back holds one or two strategy cards leaning back 12°. Four screws go up from under the tray into the turret's wall corners; the floor posts are gone. **Not yet printed.** Sizes for the Rider and the card are marked MEASURE. The M5Stack sizes come from M5's own dimension drawings; the few that don't are marked `MEASURE` at the top of `make_shell.py`. The script checks that no part overlaps another, at rest or fully pressed, and that is all it proves. The electronics themselves were proven on the bench on 2026-09-24.

About 90 mm across the flats (104 corner to corner, 115 with the rail), 71 mm tall, with a 70 mm cap standing 14 mm above the bezel at rest and 11 mm pressed.

This revision uses the Atom's own socket plus a **Unit Hub 1-to-3 splitter** (U006), not the PortABC base: the base with the Atom on it is 60 mm long including the plugs and doesn't lie beside a centred key unit inside the turret. The firmware pins for the splitter wiring are the Atom's own: hex data on G2, key on G1.

## The mini (make_shell_mini.py, stl-mini/)

The same shell with the Key Unit and the splitter taken out: the AtomS3 sits in the middle, the hex plugs straight into it, and the cap presses the **Atom's own face button** through the cage. 76 mm across the flats, 56 mm tall, 56 mm cap: close to half the table of v0.5. The press is built so it doesn't feel like a tactile dome: the springs give 2 mm of free travel, then the cage's disc lands on the Atom's face and the dome clicks, then the stop, and the disc hangs on three 1 mm spiral flexures that absorb up to a millimetre of overtravel so the click always comes before the stop. The Atom's USB-C is inside (the Rider's cable comes up through a floor hole): flash by lifting the cap, or over the air. **To try the feel:** print `stl-mini/` body, cap, cage, bezel and three springs (the deck can wait), drop the Atom in its fence, hex into the cage, cap on, bezel on three standoffs. Firmware 0.2.0 already reads the Atom's face as the big button.

## What's where

- **Key Unit** on the body floor, dropped onto two pegs that fit its own mounting holes, keycap on the axis. Its cable leaves toward −y.
- **Cage:** four legs with a cup at the bottom. The hex clicks into the legs from the top (LEDs up, sockets down), then the cage pushes up into four sockets on the cap's ceiling. The cup sits over the red keycap; press the cap and the whole cap-cage-hex moves together and the cup presses the key. The cup's brim keeps the press clear of the hex's sockets. The hex's cable loops down from its underside socket to the splitter.
- **AtomS3 Lite** lies flat against the +x wall with its USB-C in a **window through the wall**. The battery's USB-C plug, or the laptop's cable, plugs in from outside. The splitter is taped on top of it.
- **Cell and Rider** in the tray under the turret: the EEMB 963450 pouch flat on the tray floor at −x, the Rider above it along +x with its USB-C in a window in the tray wall. Its USB-A feeds the Atom through a short cable that loops outside between the two windows (or, if the Rider's header is fitted, a jumper inside; see HANDOFF).

## The parts

| File in `stl/` | Colour | What it does |
|---|---|---|
| `body.stl` | black | The turret: floor, key pegs, Atom bay, the USB window and lead groove, four screw posts, and a 36 mm inner collar the cap's skirt slides over (the real guide; open where the Atom and the key's cable are). |
| `cap.stl` | white / translucent | What you hit, with the hex cage hanging inside. The top is 1.2 mm thick, which is the diffuser. Print with 4 walls. |
| `cage.stl` | any | Four legs with a ledge the hex drops onto from the top, ending in a cup that sits over the keycap. Pushes up into sockets in the cap, whose bosses then hold the hex down. Nothing inside the button is loose. |
| `spring.stl` | any, PETG if you have it | **Print three.** Zigzag springs that stand under the cap's flange. Prints flat. `SPRING_B` sets the stiffness: 1.0 mm beams to start; 1.2 for firmer, 0.8 for softer. |
| `bezel.stl` | black | A 9 mm ring that screws down over the cap: a cone inside holds the cap's flange in and its bore steadies the top of the skirt. |
| `deck.stl` | black | The tray under the turret, printed open side up: cell and Rider inside, four screw columns, the Rider's USB-C window, and the card rail on the back. |
| `fit_test.stl` | any | Two thin rings, a quick print: a slice of the bezel's bore and a slice of the cap's skirt. The small ring should slide freely in the big one without rattling. If not, change `SLIDE_CLEARANCE`. |

Every STL is already turned the way it prints: cap and plinth are upside down, flat face on the bed; the cage prints cup-down, legs up; the spring prints flat. **No supports on anything.**

## How the press works

- The cap travels **2.8 mm**, then its flange lands on the top of the body's wall. Plastic takes the blow; the key's switch has about 4 mm of travel and is never bottomed out.
- Three printed springs, 1.7 mm pre-compressed at rest, push the cap up against the cone in the bezel and return it after a press. The switch only senses. If the press is too stiff or too soft, change `SPRING_B` and reprint three two-minute parts.
- Off-centre hits are carried by the skirt in the bezel's bore and the flange in the chamber below it. Hits right at the rim may drag; dry PTFE on the skirt is the first thing to try.

## Printing (Bambu X1C, 0.4 mm nozzle)

0.2 mm layers, 3 walls, 15% infill, PLA. Black for everything but the cap. **Cap:** white PLA glows evenly; translucent PETG passes more light. Print it with 4 walls. Roughly 130 g of black and 20 g of white per button; trust the slicer's number.

## Screws

Designed round a PC-case screw kit. **Bezel:** three of the brass **M3 6+6 standoffs**, threaded end down through the bezel into the body; the hex body sits in the countersink as the head and tightens by hand or with small pliers. M3 × 5 pan-heads work too (2.5 mm of bite). **Deck:** four M3 × 8 up through the tray's columns into the turret's wall corners (heads sink flush underneath). Skip anything M3.5 or M5; they'd split the posts.

## Assembly

1. **Body:** drop the Key Unit onto its pegs, socket toward −y. Atom into its bay with the USB-C in the window, splitter taped on top. Key cable → splitter → Atom.
2. **Springs:** stand the three springs in their floor pockets, outside the collar.
3. **Cage:** drop the hex onto the ledges, LEDs up. Plug its cable into an underside socket and lead it out between two legs. Push the cage's legs up into the cap's sockets until they seat (a dab of glue if loose); the sockets' bosses now hold the hex down.
4. Lower the cap over the body, cup onto the keycap, hex cable to the splitter, cables under the arches. **Bezel** over it, three standoffs.
5. **Deck:** cell flat on the tray floor at the −x side, Rider above it along +x with its USB-C in the window, both on foam tape; the cell's JST into the Rider (polarity checked first). Four screws up into the turret's corners. The Rider's USB-A cable goes out of the window and into the Atom's USB-C above it.

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
