# The button's shell

Five printed parts around the plug-together electronics: an M5Stack AtomS3 Lite, a Mechanical Key Unit, a NeoHEX light board and four AAs. A hexagonal base, because Twilight Imperium is made of hexagons, and a round, flat-topped cap with a 45° shoulder. The hex rides inside the cap, so nothing sits between the LEDs and the diffuser.

![front cutaway](section-front.svg)

**Revision 0.6 (2026-09-26).** v0.5 was printed and the press felt good (the springs are optional: they don't stay in their pockets, and the button works without them). v0.6 replaces the AA plinth with a **tray for a lithium cell and a Lipo Rider**, so the base is the turret's own 90 mm hexagon instead of 106; both USB-C ports come out of the +x face, the Atom's above the Rider's; and a **card rail** on the back holds one or two strategy cards leaning back 12°. Four screws go up from under the tray into the turret's wall corners; the floor posts are gone. **Not yet printed.** Sizes for the Rider and the card are marked MEASURE. The M5Stack sizes come from M5's own dimension drawings; the few that don't are marked `MEASURE` at the top of `make_shell.py`. The script checks that no part overlaps another, at rest or fully pressed, and that is all it proves. The electronics themselves were proven on the bench on 2026-09-24.

About 90 mm across the flats (104 corner to corner, 115 with the rail), 71 mm tall, with a 70 mm cap standing 14 mm above the bezel at rest and 11 mm pressed.

This revision uses the Atom's own socket plus a **Unit Hub 1-to-3 splitter** (U006), not the PortABC base: the base with the Atom on it is 60 mm long including the plugs and doesn't lie beside a centred key unit inside the turret. The firmware pins for the splitter wiring are the Atom's own: hex data on G2, key on G1.

## The mini (make_shell_mini.py, stl-mini/)

The same shell with the Key Unit and the splitter taken out: the AtomS3 sits in the middle, the hex plugs straight into it, and the cap presses the **Atom's own face button** through the cage. 76 mm across the flats, 56 mm tall, 56 mm cap: close to half the table of v0.5. The press is built so it doesn't feel like a tactile dome: the springs give 2 mm of free travel, then the cage's disc lands on the Atom's face and the dome clicks, then the stop, and the disc hangs on three 1 mm spiral flexures that absorb up to a millimetre of overtravel so the click always comes before the stop. The Atom's USB-C is inside (the Rider's cable comes up through a floor hole): flash by lifting the cap, or over the air. `USB_POWERED` at the top picks the build: True (the default, and what `stl-mini/` holds) is the demo that runs off the laptop's cable, with no deck and a notch through the bottom of the −x wall for the cable; False is the battery build with the deck and the Rider's cable up through the floor. **To build the USB one:** print body, cap, cage, the peg (`nub.stl`, prints head-down; push its stem into the hole in the cage's disc, a dab of glue if loose), bezel and three springs; Atom in its fence in the middle, USB-C facing the notch, cable out along the table; hex straight into the Atom's socket and dropped into the cage; cage up into the cap; springs in their pockets; cap on; bezel on three standoffs. Firmware 0.2.1+ reads the Atom's face as the big button and drives the hex on the Atom's own socket.

### Why an off-centre press bound, and the fix (2026-09-26)

A cap sliding in a bore is a plunger, and a plunger jams when the press lands more than about half the guide length divided by the friction coefficient off centre. The skirt only overlapped the collar by 7 mm; with PLA on PLA (about 0.35) that meant anything more than 10 mm off centre on a 28 mm cap started to bind, and 0.4 mm of clearance over 7 mm let it rock 3° first. Now a **sleeve** hangs from the cap's ceiling (inside the chamfer, outside the cage) and the platform's **collar** guides that: 12.7 mm of overlap at rest, 15.5 pressed, at 0.25 mm clearance. Print `fit_test` to check the clearance on your printer. Dry PTFE or a smear of silicone grease on the collar takes the friction to about 0.1, which by the same rule means the cap can be pressed anywhere. Glue the springs' feet into their pockets.

The click stack has three MEASURE guesses in it (the panel's drop, the Atom's height, the peg's seating), so `stl-mini/` has pegs from `nub-0.5` to `nub-2.5`: the right one is the shortest that still clicks before the stop, with the bezel seated.

## Three shells round the same cap (v1, v2, v3)

`make_shell_v1.py` is the seamless hex tower (76 across the flats, 58 tall: cell, Rider, platform, Atom, cap, all stacked). Two alternatives keep the cap, cage, peg, springs, collar and travel exactly as they are and change only what is under the Atom:

- **v2, the two-layer box** (`make_shell_v2.py`, `stl-v2/`): 72 × 72 mm with rounded corners, 50 mm tall. The cell and the Rider lie side by side on the lid inside full-height fences, and the fences hold the platform up (no columns). A square is the smallest shape that takes them side by side; a hex would need 84 mm across the flats. Three screws under the feet, four feet, the port in the +y wall. **No printed springs** since 2026-09-28: with no bezel pressing on it, the cap resting on the Atom's own switch through the peg returns by itself, and that felt better in the hand than the sprung one. The peg grew to take up the 2 mm the springs held the cap up by (3.5 mm then; since 2026-10-01 the cage's ring reaches down instead, and the peg is about 1.75, `nub-1.25` to `nub-2.25`). The stop moved with them: sprung, the cap travelled 2.8 mm and the cage's plate landed on the Atom's rim; unsprung, nothing caught the cap for 2.5 mm and the peg's three flexures took it (two of three snapped, 2026-09-28). The platform's collar is raised so the cap's ceiling lands on it 1.0 mm after the click (0.5 until 2026-10-01: with tape under the Atom and a peg a touch short for it, the collar caught the cap before the click on two buttons), and a slap goes through the collar to the table. Since 2026-10-01 the disc hangs on three long spiral arms instead of short bars, and the cage stops on the Atom's own corners instead of the collar, so the tape under the Atom no longer matters: see **The press: why the bars broke, and the stop on the Atom** below. **The plug's corner** (2026-09-28): a USB-C plug's body is about 20 mm long, not the 12 first drawn, and straight out of a centred Atom it reached the round wall with no room to turn. The Atom is turned 45° so its socket points into the +x, −y corner (47 mm from the middle, not 33), the housing is opened into that corner up to 10 mm above the platform, the platform has a slot there for the cable to drop to the Rider, The check runs with a 22 mm plug drawn in. A hole through the corner wall was the way out if that was not enough; in the printed prototype the cable turned inside the corner with room to spare, so it is closed (`WALL_HOLE_OPEN`). The three screw bosses lean into their corners so that, printed upside down, they grow out of the walls and need no supports.
  **Redrawn round the real parts, 2026-09-30.** The Rider's port end carries both the USB-C and the battery socket, side by side, so the board cannot sit against the wall: it stands 6.5 mm off it, the charging window is on the real USB-C and big enough for a plug's body, and the battery is plugged in before the Rider goes into the lid. The switch is on the Rider's long edge, which now faces the +x wall 0.7 mm away, with a slot over it. The cell (34.5 × 52 × 9.9 as its maker lists it) is turned so its lead leaves beside the battery socket, in a pocket 0.75 mm loose all round. In one line the pocket has to hold the battery plug's room, the Rider, a straight USB-A plug and the cable's turn, 75 mm, so the box is **72 × 80**; `STRAIGHT_USB_A = False` draws it for right-angle plugs and it is 72 × 72 again. No screws since 2026-09-30 (`SCREWS`): the lid sits in its rebate and stays put, and a strip of tape does the rest; the bosses floated when printed and got in the way of everything inside. No foot recesses either (2026-09-30): the flat lid sits fine. **Platform guides** (2026-09-30 evening, drawn but off: `PLATFORM_GUIDES`; the slicer flagged them as floating, and Garett was pressed for time): three short ledges on the housing's inner walls (the cell side and the −x halves of the end walls, clear of the cable corner), 0.3 mm above the platform's top, reaching 2 mm in over its edge; upside down for assembly the platform rests on them in its game position instead of wandering while the cables are plugged, and right way up it is captive between them and the lid's fences. Each has a 45° back so it prints without support. The check runs with all four plugs drawn in. Positions along the Rider's edges are read off a photo and marked MEASURE.
- **v5, the slab** (`make_shell_v5.py`, `stl-v5/<design>/`; drawn 2026-10-01, not printed yet; the site shows all three at `/slab.html`, drawn from `export_slab.py`): nothing rides on the light. v2's bottom half unchanged (the same `lid.stl`, the same window and switch slot) under a new top, 72 × 80 and 32.5 mm to the deck instead of 50, with cut corners rather than rounded ones. The hex sits LEDs-up on four posts in a hexagonal **light well** on the platform; a white **lantern** (a hexagonal cup with a flared flange, printed face down) rests on the well's rim and stands proud of the deck, so it glows from its sides too and the LEDs are 10 mm or more under its face. The Atom stands on a pedestal with its face just under the top. Foam tape between its panel and whatever presses it is the give (the job the cage's flexures did); something solid is the stop. Everything visible is on the centre line. Three designs: **lantern**, Garett's pick on 2026-10-02 (lantern 6 mm proud; a black hexagonal **key** on the Atom's panel, 0.8 mm proud, pressed flush so the deck is the stop), **beacon** (the same with a 22 mm column of light), **keyplate** (the whole top is a plate inside the walls, hinged on two tongues that hang below it into closed slots in the back wall, resting on the Atom through a foot on foam, stopping on the Atom's own rim; the lantern stands through it and does not move). The Atom's straight USB-C plug is 22 mm and a centred, square Atom leaves 21.5 mm to the wall, so the Atom is never centred (`ATOM_AT`): under a key it stands 4 mm left and turned 22° toward the cable corner, which gives the plug's tip 6.4 mm to the wall along its own line, and the key stays on the centre line with a 9 mm foot that lands 4 mm off the panel's middle; turned further, the Atom's corners run into the lantern's well and the front wall. Under the keyplate it is 8 mm left and square. No other plug is planned for (Garett: don't). **The hex's cable** (2026-10-02, Garett: "how do I get power to the hex?"): the first drawing left 2.4 mm under the hex's sockets and a slot in the well that opened onto the Atom's corner, and had the Atom's Grove port on the wrong side. The Atom's two sockets are on the **same** side, USB-C over Grove (v2's drawing has them on opposite sides, which is wrong), so both plugs point into the cable corner. The hex has two sockets, either usable: one underneath near an end, one on its side; the side one is used. The board stands on three small corner posts, up inside a slightly wider lantern (35 mm across flats), turned so its side socket faces a 13 mm notch in the well's +x flat, open at the top: plug the Grove cable into the hex, lower the hex onto its posts with the plug standing out through the notch, and run the cable down the +x side to the Atom's Grove port, under its USB-C plug. The plug and the cable's run are drawn as a part (`grove`) so the check finds anything in their way. Plug sizes and heights are marked MEASURE.
- **v3, the one-layer pod** (`make_shell_v3.py`, `stl-v3/`): 72 × 98 mm, 38 mm tall, two printed parts round the cap. Nothing under the Atom: the lid is the floor (collar, Atom fence, spring pockets, cell fences on it) and the cell lies in a low tail behind the cap with the Rider on top of it, under the same flat roof the cap's lip is in. Springs at 0, 180 and 270 degrees, none toward the tail. Four screws, four feet, the port in the tail's +x wall.

- **v4, the slim one** (`make_shell_v4.py`, `stl-v4/`): 64 × 64 mm, 58 mm tall, 49 mm cap. The v2 box with everything pulled in as far as today's parts allow, about 78 % of v2's table. The mini's mechanics are rebuilt with a smaller cap (the generator rewrites the mini's parameters and runs it), the Rider goes back on top of the cell, and the Atom is turned so its USB-C faces the cable's hole. It needs a right-angle USB-A plug: a straight one behind the Rider does not fit a 59 mm pocket. Modelled and clash-checked, not printed; measure that plug, the USB-C plug's length out of the Atom (the bore leaves 17 mm) and the Rider's port before printing. Viewer: claude.ai/artifact/6SB33uPi6w4bNoUDjz2fky.

All three are clash-checked at rest and pressed, and viewable side by side at true scale on the comparison page (claude.ai/artifact/QKLn1FnnAUmjudd9YNhDKJ). Both alternatives share `check_and_write()` and `rbox_prism()` from `make_shell_v2.py`. Both are battery builds only.

## The press: why the bars broke, and the stop on the Atom (2026-10-01)

**What the press has to do.** The cap rests on the Atom's switch through the peg. A press moves the switch about 0.3 mm (`DOME_TRAVEL`, MEASURE) and it bottoms out; the cap keeps going until something stops it. Whatever travel is left between the switch bottoming and the stop has to be bent into something, every press, for the life of the button. That something is the cage's middle: a disc carrying the peg, hung from the cage on flexures.

**Why the bars broke.** A bar whose bend is fixed by a stop is stressed about 3·E·t·d / L² (E stiffness, t thickness, d bend, L length). Making it **thicker makes it worse**; only length helps. `flex_model.py` is a small beam model of the arms (printed PLA: about 2.75 GPa stiff, about 75 MPa to break in bending; something bent every press wants to stay under about 15):

| | bend at the stop | stress | force on the Atom's switch |
|---|---|---|---|
| bars 1.0 × 2.2, stop 0.5 after the click (cracked after many presses, 2026-09-30) | 0.5 mm | 26–41 MPa | 5–9 N |
| bars 1.4 × 3.0 with wide roots, stop 1.0 after the click (the morning of 2026-10-01) | 1.0 mm | **84–135 MPa** | **42–87 N** |
| **now**: three spiral arms of 180°, 30 mm long, 2.4 × 2.2, stop on the Atom | 0.45 mm (0.7 one peg long) | 10 (15 at the roots); 15 (23) | 4; 6 |

The ranges for the bars are their free length, 10 to 12.5 mm, which the drawing doesn't pin down.

**A clash the check didn't see.** The check used to move the cage as one rigid piece. Drawn properly, the disc stops at the switch while the cage goes on down, so the disc rises inside the cage, toward the hex's back. With the bars, the disc and the peg's stem rose 1.0 mm into a 0.3 mm gap under the hex's connectors as drawn (`HEX_SOCKETS` is a MEASURE guess: if something on the hex's back sits over the middle, the bars could never bend at all). The check now draws the middle stopping at the switch. Old design for comparison: `PAX_FLEX=bars .venv/bin/python make_shell_v2.py`.

**Why the stop moved onto the Atom.** The cap rests on the Atom, but the collar that stopped it is on the platform, and the Atom sits on foam tape. Tape differs from button to button and creeps thinner under load. So the travel between the click and the collar changed with the tape: a peg chosen today could stop clicking next week (Garett, the same afternoon). Choosing pegs can't fix that; the reference has to move. Now **the ring round the cage's sprung middle stands 1.2 mm below the plate and lands on the Atom's own top corners**, outside its button, 0.75 mm after the cap starts to move. Rest, click and stop are then all measured from the Atom itself. The tape only lifts the whole cap a little, and one peg suits every button:

- **The press:** click at about 0.43 mm (0.2 to the switch's click, 0.23 of give in the arms), stop at 0.75, arms bent 0.45, about 4 N on the switch.
- **Tape:** with the drawn peg it works with anything from **no tape to 1.25 mm of foam tape** (`TAPES`; the check runs with 0 and 1.0). More than that pushes the cap up against the lip until the arms hold the switch down: use one layer.
- **A slap** goes cap → legs → ring → the Atom's case → the tape (now a cushion) → the platform. The collar on the already printed platforms stays as the backup: with no tape it catches at the same moment as the Atom, with tape later. The Atom's case takes it on about 30 mm² of its four top corners (as drawn, corners rounded 2.5 mm, MEASURE). That is what an Atom is built to be squeezed on.
- **The ring is rotation-proof:** a full circle from 14 to 19 mm lands on the Atom's corners however the cap has turned. It clears the button for any button up to about 20 mm square.
- **The arms are stouter** than the first spiral (2.2 mm thick instead of 1.8, 9 N/mm instead of 6), because they no longer have to swallow the tape's variation, only the 0.45 mm the geometry sets. Their middle sits at the bed, under the ring's top, so there are 1.3 mm free above the disc at the stop.

**Choosing the peg, once.** The one guess left is how deep the Atom's button sits below its rim (`ATOM_BUTTON_DROP`, 1.0 drawn). It is the same on every Atom, so it is found on one button and the answer printed six times. `stl-v2/nub-1.25` to `nub-2.25`, quarter millimetres, tiny prints, head down; push the stem up into the disc. Press slowly: **a click, a short springy squeeze, then the hard stop.** No click before the stop: longer. **The shortest that clicks every time, then one step longer** (the drawn guess is 1.75). Old pegs don't fit: the stem is thinner.

**What to reprint:** the cage (4.1 cm³) and pegs. Housing, platform, lid and cap are byte-for-byte what was printed.

**The hex stays where it is.** It sits on the cage's ledges and the cap's bosses hold it from above, so it already travels with the cap, and it carries none of the press or the slap: that goes through the cage's legs. Bolting it to the cap instead would mean six new caps and wouldn't make the press any stronger. The legs are the size the cap's sockets were printed for (5 × 3): in a hard slap they carry about 2 MPa each, far from buckling. The ring under them is now 3.7 mm deep and 5 mm wide, solid.

**Friction, and a cap that won't come back.** Only the Atom's own switch lifts the cap (about 24 g with the hex) after a press. Dry PLA on PLA (friction about 0.35) over this guide's 15.8 mm overlap can wedge if pressed more than about 20–26 mm off centre, and the cap's flat top reaches 22. **Rub a candle (paraffin) or a soft pencil on the outside of the collar and the inside of the cap's sleeve:** about 0.15, and nowhere on the cap can wedge it. A test needing no tools: take the peg out, and the cap should drop under its own weight, and still slide with the box tipped 45°. If it does, the switch's spring will always lift it.

**Printing the cage.** As before: ring on the bed, legs up, no supports, 0.2 mm layers. The slots are 1.0 mm; check all three came out open along their whole length (a fingernail or a knife tip). A slot bridged at the bottom by the first layer makes that arm short and stiff.

Not yet printed. The numbers are a beam model and a clash check, not a measurement. To look at on the real parts: that the Atom's top corners are flat case outside the button, at least from 14 to 15.5 mm from the middle (about 2 mm of case at each corner). Also the switch's real travel and force: a 3 N switch clicks after 0.34 of give, still well before the stop.

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
