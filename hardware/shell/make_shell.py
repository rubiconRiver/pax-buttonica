"""
Generates the Pax Buttonica button shell for the no-solder build: printable STLs and cutaways.

  python3 -m venv .venv && .venv/bin/pip install manifold3d numpy     # once
  .venv/bin/python make_shell.py

What goes inside (all M5Stack, all plug-together; sizes from M5's dimension drawings):
  Key Unit   on the body floor, keycap on the axis, dropped onto two pegs that fit its mounting holes
  NeoHEX     drops into a four-legged cage, LEDs up, sockets down; the cage pushes up into the cap's
             ceiling and ends in a cup that sits over the keycap. Nothing inside is loose.
  AtomS3     lying flat against the +x wall with its USB-C in a window: the battery plug (or the
             laptop) plugs in from OUTSIDE, so flashing needs no disassembly
  splitter   a Grove 1-to-3 (Unit Hub) taped on the Atom, so key and hex share its socket
  Lipo Rider Plus + a 3.7 V pouch cell   stacked in a tray under the turret (cell below, Rider above);
             the Rider's USB-C (charging) comes out of the same face as the Atom's, one above the other,
             and its USB-A feeds the Atom through a short cable that loops between the two windows

Six printed parts, none of which needs supports:
  deck    hex tray under the turret: the cell and the Rider live in it, screws go up into the body's
          corners, and a rail on the back holds one or two strategy cards leaning back.
  body    hex turret: floor, key pegs, Atom bay, USB window.
  cap     the part you hit, with the hex cage hanging from its ceiling.
  cage    four legs that clip round the hex and end in the cup over the keycap; pushes up into the cap.
  bezel   screws onto the body over the cap: guides the skirt, holds the flange in.
  spring  print three: zigzags that stand under the cap's flange and give the return force.

A slap goes cap flange -> top of the body wall -> deck -> table. The keycap only ever sees
TRAVEL + PRELOAD of movement, less than the switch's own travel.

Millimetres. x to the right (USB window on the +x flat), y away from you (the key's cable leaves
toward -y), z up, z = 0 at the top of the body's floor. STLs come out already turned the way they print.

STATUS: v0.6 (2026-09-26): the AA plinth becomes a tray for a lithium cell and a Lipo Rider, so the
base shrinks from 106 to 90 mm across the flats; a card rail on the back. v0.5 was printed and felt
good (springs optional). Not yet printed.
The soldered carrier-board version of this shell is make_shell_pcb.py.
"""
import math
import os
import struct

import numpy as np
from manifold3d import CrossSection, Manifold, OpType

HERE = os.path.dirname(os.path.abspath(__file__))

# ── fit: tune these with the fit_test rings ─────────────────────────────────
SLIDE_CLEARANCE = 0.40   # radial gap between the cap's skirt and the bezel's bore, and round the inner collar
CHAMBER_CLEARANCE = 1.6  # radial gap round the cap's flange inside the bezel (it never guides, so it can be loose; the springs live under it)
PART_CLEARANCE = 0.5     # around every bought part in its pocket
TAP_D = 2.8              # an M3 screw cuts its own thread in a hole this size
M3_CLEAR_D = 3.6              # printed holes come out a few tenths small
M3_HEAD_D = 7.0               # a pan head or the brass standoff's hex, with room for the print's shrink

# ── press feel ──────────────────────────────────────────────────────────────
TRAVEL = 2.8             # how far the cap moves before plastic meets plastic
PRELOAD = 0.2            # how far the cap holds the keycap down at rest (takes up rattle)
SWITCH_TRAVEL_MIN = 3.5  # the Key Unit's blue switch: about 4.0

# ── the bought parts (M5Stack drawings; MEASURE = not on a drawing) ──────────
KEY_BODY = (24.0, 40.0, 8.0)    # Key Unit case: x, y, z. Socket on its -y end.
KEY_CAP_FROM_SOCKET = 28.0      # keycap centre from the socket end
KEY_HOLES = (16.0, 12.0)        # two 4.85 mm holes: this far apart, this far from the socket end
KEYCAP = (18.0, 16.3)           # keycap width at its base, and height above the case (top at 24.3)
KEYCAP_TOP_W = 13.0             # the keycap's flat top (it tapers, OEM-profile style)         MEASURE
KEYCAP_H = 9.0                  # the keycap itself, base to top                              MEASURE
KEY_PLUG = 8.0                  # how far the cable's plug sticks out past the socket end  MEASURE
HEX_FLAT = 31.0                 # board across the flats; ears reach 36 tip to tip
HEX_EAR_R = 16.0                # ear hole centres from the middle (2 mm holes)
HEX_BOARD_T = 2.0               # board plus LEDs
HEX_UNDER = 7.6                 # sockets below the board (9.55 overall)
HEX_SOCKETS = (24.0, 22.0)      # the socket cluster on the back, as a box                  MEASURE
ATOM = (24.0, 24.0, 9.5)        # AtomS3 Lite lying flat, USB-C on its +x edge
ATOM_USB_Z = 4.75               # USB-C centre above the floor when it lies flat            MEASURE
SPLITTER = (12.0, 24.0, 8.0)    # Unit Hub 1-to-3                                           MEASURE
RIDER = (41.0, 25.0, 8.0)       # Seeed Lipo Rider Plus lying flat, USB-C on its +x end       MEASURE (which end; the switch)
RIDER_USB_Z = 3.5               # its USB-C centre above its underside                        MEASURE
CELL = (34.0, 50.0, 9.6)        # EEMB 963450 pouch, x, y, z, JST lead out of its +y end
CARD = (70.0, 120.0, 1.2)       # a TI4 strategy card, tarot size, sleeved                    MEASURE

# ── body ────────────────────────────────────────────────────────────────────
TURRET_F = 90.0          # across the flats of the hexagon
BORE_R = 40.0            # round bore inside it
FLOOR_T = 1.6
WALL_TOP = 25.5          # top of the body wall = the hard stop
COLLAR_H = 36.0          # an inner collar the cap's skirt slides over: the real guide, hidden inside
COLLAR_T = 2.0
COLLAR_GAPS = ((-28, 28), (250, 290))   # no collar where the Atom bay and the key's cable are
ATOM_X0 = 13.0           # Atom bay from here to ATOM_X0 + 24 (its corners must stay inside the bore)
DECK_SCREW_ANGLES = (30, 90, 270, 330)   # M3 up from under the deck into the body's corners, at BEZEL_SCREW_R; not the -x corners, the cell is there
USB_WINDOW = (14.0, 9.0)

# ── the cage in the cap, and the saddle ─────────────────────────────────────
LED_GAP = 9.0            # hex LEDs to the underside of the diffuser
CAGE_ANGLES = (60, 120, 240, 300)   # legs at these flat centres; the side sockets open at 0 and 180
CAGE_LEG = (5.0, 3.0)    # leg width (tangential) and radial thickness
CAGE_R0 = HEX_FLAT / 2 + 0.6        # inner face of the legs
LEDGE = 1.4              # a fixed ledge under the board; the cap's sockets hold it from above once the cage is in
PAD_T = 2.5              # the pusher pads at the bottom of the legs
SADDLE_WALL = 1.5
SOCKET_H = 8.6           # bosses on the cap's ceiling that the cage's leg tops push into; they reach down to hold the hex
SOCKET_FIT = 0.15        # clearance per side in those sockets: a firm push fit; a dab of glue if it isn't
SADDLE_BRIM_R = 18.0
SADDLE_T = 2.0           # brim / roof thickness

# ── printed springs: three zigzags under the cap's flange give the return force ─
SPRING_ANGLES = (60, 180, 300)
SPRING_W = 3.6           # radial width (the zigzag's amplitude)
SPRING_D = 10.0          # tangential depth (the print's Z height)
SPRING_B = 1.0           # beam thickness. Stiffer: 1.2. Softer: 0.8.
SPRING_FOLDS = 7
SPRING_FREE = 30.0       # free length; it sits 1.7 mm compressed at rest
CABLE_ARCH_ANGLES = (225, 315)   # low arches on the floor the cables run under

# ── cap and bezel ───────────────────────────────────────────────────────────
CAP_D = 70.0
CAP_TOP_T = 1.2          # the diffuser
CAP_WALL = 1.6
CAP_CHAMFER = 7.0
FLANGE_W, FLANGE_LAND = 3.1, 0.8
BEZEL_H = 9.0            # a low ring: it retains the flange and guides the top of the skirt; the collar does the rest
BEZEL_SCREW_R = 46.0
BEZEL_FLANGE_T = 2.5     # plastic under each screw head. Screws: M3 x 5, or the brass M3 6+6 standoffs used as bolts

# ── deck: the tray under the turret ─────────────────────────────────────────
DECK_WALL = 2.5
DECK_FLOOR = 1.6
LAYER_GAP = 0.8          # between the cell and the Rider above it
FOOT_D = 10.5
RAIL_W = 64.0            # the card rail across the back: a card is 70, so it overhangs a little each side
RAIL_D = 11.0            # how far the rail stands out behind the turret's back corner
RAIL_TOP = 6.0           # the rail's top, above the body floor
SLOT_W = 4.5             # the groove: one sleeved card loosely, two snugly
SLOT_DEPTH = 14.0
SLOT_LEAN = 12.0         # degrees back from vertical

# ── derived ─────────────────────────────────────────────────────────────────
SEG = 128
CAP_R = CAP_D / 2
BEZEL_BORE_R = CAP_R + SLIDE_CLEARANCE
FLANGE_R = CAP_R + FLANGE_W
CHAMBER_R = FLANGE_R + CHAMBER_CLEARANCE
BEZEL_TOP = WALL_TOP + BEZEL_H
FLANGE_BOTTOM = WALL_TOP + TRAVEL
SEAT_Z = FLANGE_BOTTOM + FLANGE_LAND - CHAMBER_CLEARANCE
KEY_Y0 = -KEY_CAP_FROM_SOCKET                        # the case's -y end; keycap centre at y = 0
KEYCAP_TOP = KEY_BODY[2] + KEYCAP[1]
SADDLE_TOP = KEYCAP_TOP + SADDLE_T                   # top of the brim, at rest
PAD_BOTTOM = SADDLE_TOP - PRELOAD                    # the cage's pads rest here
HEX_BOTTOM = PAD_BOTTOM + PAD_T + HEX_UNDER + 0.3    # underside of the hex board
HEX_TOP = HEX_BOTTOM + HEX_BOARD_T
INNER_TOP = HEX_TOP + LED_GAP                        # underside of the diffuser
CAP_TOP = INNER_TOP + CAP_TOP_T
CAP_EXPOSED = CAP_TOP - BEZEL_TOP
FLAT_X = TURRET_F / 2
DECK_POCKET_H = CELL[2] + LAYER_GAP + RIDER[2] + PART_CLEARANCE    # both layers plus a little air
DECK_H = DECK_FLOOR + DECK_POCKET_H
DECK_Z0 = -FLOOR_T - DECK_H                                      # underside of the deck: the table
DECK_TOP = -FLOOR_T                                              # the body sits here
CELL_Z = DECK_Z0 + DECK_FLOOR
RIDER_Z = CELL_Z + CELL[2] + LAYER_GAP
RIDER_X0 = FLAT_X - DECK_WALL - RIDER[0] - PART_CLEARANCE        # its USB-C end touches the wall's inside
RIDER_WINDOW = (12.0, 8.0)
RAIL_Y0 = TURRET_F / 2 / math.cos(math.radians(30))              # the turret's back corner
DECK_SCREWS = [(BEZEL_SCREW_R * math.cos(math.radians(a)), BEZEL_SCREW_R * math.sin(math.radians(a))) for a in DECK_SCREW_ANGLES]

assert TRAVEL + PRELOAD <= SWITCH_TRAVEL_MIN, 'the cap would bottom the switch out before the shell stops it'
assert math.hypot(ATOM_X0 + ATOM[0], ATOM[1] / 2) < BORE_R, 'the Atom does not fit in the bore'
_pocket_apex = (TURRET_F - 2 * DECK_WALL) / 2 / math.cos(math.radians(30))
assert RIDER_X0 > -_pocket_apex / 2, 'the Rider does not fit across the deck'
assert abs(CELL[1] / 2 + PART_CLEARANCE) < _pocket_apex - (CELL[0] / 2 + PART_CLEARANCE) * math.tan(math.radians(30)), 'the cell does not fit in the deck'
assert CAP_EXPOSED - TRAVEL >= 8, 'the cap should stand well proud of the bezel even when pressed'
COLLAR_R = CAP_R - CAP_WALL - SLIDE_CLEARANCE          # outer face of the collar
SPRING_R0 = CAP_R + 0.6                                # springs stand just outside the skirt, under the flange
assert SPRING_R0 + SPRING_W < BORE_R - 0.5, 'springs hit the wall'
assert SPRING_R0 + 1.5 < FLANGE_R, 'the flange must reach over the springs'
assert SPRING_R0 + SPRING_W < CHAMBER_R - 0.3, 'the springs must clear the bezel'
assert COLLAR_H < FLANGE_BOTTOM + 30, 'collar taller than the cap is deep'
assert CAGE_R0 + CAGE_LEG[1] < CAP_R - CAP_WALL - 1, 'the cage does not fit inside the cap'


# ── helpers ─────────────────────────────────────────────────────────────────
def cyl(d, h, x=0.0, y=0.0, z=0.0, d2=None, seg=48):
    return Manifold.cylinder(h, d / 2, (d if d2 is None else d2) / 2, seg).translate([x, y, z])

def box(x0, y0, z0, sx, sy, sz):
    return Manifold.cube([sx, sy, sz]).translate([x0, y0, z0])

def cbox(cx, cy, z0, sx, sy, sz):
    """A box centred in x and y."""
    return box(cx - sx / 2, cy - sy / 2, z0, sx, sy, sz)

def union(parts):
    return Manifold.batch_boolean(list(parts), OpType.Add)

def revolve(points):
    pts = np.array(points, dtype=float)
    area = 0.5 * np.sum(pts[:, 0] * np.roll(pts[:, 1], -1) - np.roll(pts[:, 0], -1) * pts[:, 1])
    return CrossSection([pts if area > 0 else pts[::-1]]).revolve(SEG)

def hex_prism(F, h, z=0.0, ct=0.0, cb=0.0):
    """Hexagon F across the flats, flats facing +/-x, optional chamfers top and bottom."""
    def slab(f, z0, t):
        return CrossSection.circle(f / 2 / math.cos(math.radians(30)), 6).rotate(30).extrude(t).translate([0, 0, z0])
    slabs = [slab(F, cb, h - ct - cb)]
    if cb: slabs.append(slab(F - 2 * cb, 0, 0.01))
    if ct: slabs.append(slab(F - 2 * ct, h - 0.01, 0.01))
    return Manifold.batch_hull(slabs).translate([0, 0, z])

def corners(r):
    return [(r * math.cos(math.radians(a)), r * math.sin(math.radians(a))) for a in range(30, 390, 60)]


# ── body ────────────────────────────────────────────────────────────────────
def body():
    solid = hex_prism(TURRET_F, FLOOR_T + WALL_TOP, z=-FLOOR_T, cb=0.6) - cyl(2 * BORE_R, WALL_TOP + 1, seg=SEG)
    # the inner collar: the cap's skirt slides over it, so a 70 mm cap can't rock however it's hit
    collar = cyl(2 * COLLAR_R, COLLAR_H, seg=SEG) - cyl(2 * (COLLAR_R - COLLAR_T), COLLAR_H + 2, z=-1, seg=SEG)
    for a0, a1 in COLLAR_GAPS:
        wedge = CrossSection([[(0, 0)] + [(60 * math.cos(math.radians(a)), 60 * math.sin(math.radians(a))) for a in range(a0, a1 + 1)]]).extrude(COLLAR_H + 2).translate([0, 0, -1])
        collar -= wedge
    solid += collar
    # low arches for the cables to run under, inside the collar
    for a in CABLE_ARCH_ANGLES:
        rc = COLLAR_R - COLLAR_T - 4.0
        arch = cbox(rc, 0, 0, 6, 11, 6) - cbox(rc, 0, -1, 8, 7, 5.5)
        solid += arch.rotate([0, 0, a])
    # two pegs into the Key Unit's mounting holes, plus a low rim round its case
    hy = KEY_Y0 + KEY_HOLES[1]
    solid += union(cyl(4.5, 5, sx * KEY_HOLES[0] / 2, hy, d2=4.0, seg=32) for sx in (-1, 1))
    rim = cbox(0, KEY_Y0 + KEY_BODY[1] / 2, 0, KEY_BODY[0] + 2 * PART_CLEARANCE + 3, KEY_BODY[1] + 2 * PART_CLEARANCE + 3, 2)
    rim -= cbox(0, KEY_Y0 + KEY_BODY[1] / 2, -1, KEY_BODY[0] + 2 * PART_CLEARANCE, KEY_BODY[1] + 2 * PART_CLEARANCE, 4)
    rim -= cbox(0, KEY_Y0, -1, 12, 8, 4)                                                      # the cable leaves here
    rim -= box(KEY_BODY[0] / 2 + PART_CLEARANCE, -60, -1, 20, 120, 4)                          # no rim on the Atom's side
    solid += rim
    # a low fence round the Atom, open on the inner side for its cable
    ax0, ay0 = ATOM_X0 - PART_CLEARANCE, -ATOM[1] / 2 - PART_CLEARANCE
    fence = box(ax0 - 1.5, ay0 - 1.5, 0, ATOM[0] + 2 * PART_CLEARANCE + 3, ATOM[1] + 2 * PART_CLEARANCE + 3, 2)
    fence -= box(ax0, ay0, -1, ATOM[0] + 2 * PART_CLEARANCE + 5, ATOM[1] + 2 * PART_CLEARANCE, 4)
    fence -= box(ax0 - 3, -60, -1, 3.01, 120, 4)                                              # no wall on the key's side: the Atom's cable leaves there
    solid += fence
    # the deck's screws come up into the corners of the wall from below
    cuts = [cyl(TAP_D, FLOOR_T + 8, x, y, -FLOOR_T - 1, seg=24) for x, y in DECK_SCREWS]
    # shallow pockets that locate the springs' feet
    for a in SPRING_ANGLES:
        cuts.append(box(SPRING_R0 - 0.3, -SPRING_D / 2 - 0.3, -1.2, SPRING_W + 0.6, SPRING_D + 0.6, 1.21).rotate([0, 0, a]))
    # USB-C window through the +x flat, with a recess outside for the plug's body
    cuts.append(cbox(FLAT_X, 0, ATOM_USB_Z - USB_WINDOW[1] / 2, 2 * (FLAT_X - BORE_R + 2), USB_WINDOW[0], USB_WINDOW[1]))
    cuts.append(cbox(FLAT_X, 0, -FLOOR_T - 1, 6, USB_WINDOW[0] + 6, FLOOR_T + 1 + ATOM_USB_Z + USB_WINDOW[1] / 2 + 3))
    cuts += [cyl(TAP_D, 9.01, x, y, WALL_TOP - 9, seg=24) for x, y in corners(BEZEL_SCREW_R)]
    return solid - union(cuts)


# ── bezel ───────────────────────────────────────────────────────────────────
def bezel():
    cone = CHAMBER_R - BEZEL_BORE_R
    cavity = revolve([
        (0, WALL_TOP - 1), (CHAMBER_R, WALL_TOP - 1), (CHAMBER_R, SEAT_Z),
        (BEZEL_BORE_R, SEAT_Z + cone), (BEZEL_BORE_R, BEZEL_TOP - 0.6), (BEZEL_BORE_R + 1.6, BEZEL_TOP + 1),
        (0, BEZEL_TOP + 1)])
    cuts = [cavity]
    for x, y in corners(BEZEL_SCREW_R):
        cuts.append(cyl(M3_CLEAR_D, BEZEL_H + 2, x, y, WALL_TOP - 1, seg=24))
        cuts.append(cyl(M3_HEAD_D, BEZEL_H, x, y, WALL_TOP + BEZEL_FLANGE_T, seg=32))
    return hex_prism(TURRET_F, BEZEL_H, z=WALL_TOP, ct=1.5) - union(cuts)


# ── cap, with the hex cage hanging from its ceiling ─────────────────────────
def spring(L):
    """A zigzag spring in its own frame: x radial (0..W), y along its length (0..L), z tangential (0..D)."""
    W, D, b, n = SPRING_W, SPRING_D, SPRING_B, SPRING_FOLDS
    pitch = (L - 2 * b) / n
    pts = [((b / 2) if i % 2 == 0 else (W - b / 2), b + i * pitch) for i in range(n + 1)]
    beams = [Manifold.batch_hull([box(x0 - b / 2, y0 - b / 2, 0, b, b, D), box(x1 - b / 2, y1 - b / 2, 0, b, b, D)])
             for (x0, y0), (x1, y1) in zip(pts, pts[1:])]
    feet = [box(0, 0, 0, W, b, D), box(0, L - b, 0, W, b, D)]
    return union(beams + feet)

def springs_in_place(L):
    """The three springs standing in the body, compressed to length L."""
    out = []
    for a in SPRING_ANGLES:
        sp = spring(L).rotate([90, 0, 0]).translate([SPRING_R0, SPRING_D / 2, 0])   # y -> z, stands up; centred tangentially
        out.append(sp.rotate([0, 0, a]))
    return union(out)


def cap():
    k = CAP_WALL * math.sqrt(2)
    inner_r = CAP_R - CAP_WALL
    shoulder_z = CAP_TOP - CAP_CHAMFER
    inner_shoulder_z = shoulder_z - k + CAP_WALL
    shell = revolve([
        (0, CAP_TOP), (CAP_R - CAP_CHAMFER, CAP_TOP), (CAP_R, shoulder_z),
        (CAP_R, FLANGE_BOTTOM + FLANGE_LAND + FLANGE_W), (FLANGE_R, FLANGE_BOTTOM + FLANGE_LAND), (FLANGE_R, FLANGE_BOTTOM),
        (inner_r, FLANGE_BOTTOM), (inner_r, inner_shoulder_z),
        (inner_r - (INNER_TOP - inner_shoulder_z), INNER_TOP), (0, INNER_TOP)])
    w, t = CAGE_LEG
    bosses = []
    for a in CAGE_ANGLES:
        boss = box(CAGE_R0 - 2.5, -w / 2 - 2.5, INNER_TOP - SOCKET_H, t + 5, w + 5, SOCKET_H + 0.01)
        boss -= box(CAGE_R0 - SOCKET_FIT, -w / 2 - SOCKET_FIT, INNER_TOP - SOCKET_H - 1, t + 2 * SOCKET_FIT, w + 2 * SOCKET_FIT, SOCKET_H + 0.4)   # pocket, 0.6 of ceiling left
        bosses.append(boss.rotate([0, 0, a]))
    return shell + union(bosses)


# ── cage: carries the hex under the cap and ends in the cup over the keycap ──
def cage():
    w, t = CAGE_LEG
    top = INNER_TOP - 0.8                     # leg tops sit in the cap's sockets, 0.8 below the ceiling
    depth = 6.0
    parts = []
    for a in CAGE_ANGLES:
        leg = box(CAGE_R0, -w / 2, PAD_BOTTOM, t, w, top - PAD_BOTTOM)
        # a stop above the board and a snap lip below it, so the board clicks in from above... no: drops in from the top
        # before the cage goes into the cap, and the lip keeps it from falling out
        # a fixed ledge under the board; the hex drops in from the top
        leg += box(CAGE_R0 - LEDGE, -w / 2, HEX_BOTTOM - 0.3 - 1.2, LEDGE + 0.01, w, 1.2)
        # the pad, reaching inward to the brim
        leg += box(SADDLE_BRIM_R - 3.5, -w / 2, PAD_BOTTOM, CAGE_R0 + t - (SADDLE_BRIM_R - 3.5), w, PAD_T)
        parts.append(leg.rotate([0, 0, a]))
    # the brim and the tapered cup, in one with the legs
    def sq(wd, z):
        return cbox(0, 0, z, wd, wd, 0.01)
    w_bottom = KEYCAP_TOP_W + (KEYCAP[0] - KEYCAP_TOP_W) * (depth / KEYCAP_H) + 2 * PART_CLEARANCE
    w_top = KEYCAP_TOP_W + 2 * PART_CLEARANCE
    # the brim's underside is a 45-degree cone down to the cup's base, so it prints cup-down without supports
    cup_base = KEYCAP_TOP - depth - PRELOAD
    brim = Manifold.batch_hull([cyl(2 * SADDLE_BRIM_R, PAD_T, z=PAD_BOTTOM, seg=SEG),
                                cyl(2 * SADDLE_BRIM_R - 2 * (PAD_BOTTOM - cup_base), 0.01, z=cup_base, seg=SEG)])
    cup = Manifold.batch_hull([sq(w_bottom + 2 * SADDLE_WALL, KEYCAP_TOP - depth - PRELOAD), sq(w_top + 2 * SADDLE_WALL, PAD_BOTTOM + 0.01)])
    cavity = Manifold.batch_hull([sq(w_bottom, KEYCAP_TOP - depth - PRELOAD - 1), sq(w_bottom, KEYCAP_TOP - depth - PRELOAD), sq(w_top, KEYCAP_TOP - PRELOAD)])
    parts += [brim, cup]
    return union(parts) - cavity


# ── deck: the tray under the turret, with the card rail on its back ────────
def deck_outline(h, z, ct=0.0, cb=0.0):
    """The hexagon plus the rail behind it, as one hull, so the outline stays clean."""
    rail = box(-RAIL_W / 2, RAIL_Y0 - 3, z, RAIL_W, RAIL_D + 3, h)
    return Manifold.batch_hull([hex_prism(TURRET_F, h, z=z, ct=ct, cb=cb), rail])

def deck():
    z0 = DECK_Z0
    solid = deck_outline(DECK_H, z0, cb=0.6)
    # the rail rises past the body floor; the body's hex sits inside it, so it also locates the body
    rail = box(-RAIL_W / 2, RAIL_Y0 - 3, z0, RAIL_W, RAIL_D + 3, DECK_H + FLOOR_T + RAIL_TOP)
    rail -= hex_prism(TURRET_F + 2 * PART_CLEARANCE, 40, z=DECK_TOP - 0.01)
    solid += rail
    # the pocket, and the screw columns standing in it
    pocket = hex_prism(TURRET_F - 2 * DECK_WALL, DECK_POCKET_H + 1, z=z0 + DECK_FLOOR)
    solid -= pocket
    solid += union(cyl(8.0, DECK_POCKET_H, x, y, z0 + DECK_FLOOR, seg=32) for x, y in DECK_SCREWS)
    cuts = []
    for x, y in DECK_SCREWS:
        cuts.append(cyl(M3_CLEAR_D, DECK_H + 2, x, y, z0 - 1, seg=24))
        cuts.append(cyl(M3_HEAD_D, 3.0 + 0.01, x, y, z0 - 0.01, seg=32))
    # the Rider's USB-C, through the +x wall, right under the Atom's window
    cuts.append(cbox(FLAT_X, 0, RIDER_Z + RIDER_USB_Z - RIDER_WINDOW[1] / 2, 2 * DECK_WALL + 4, RIDER_WINDOW[0], RIDER_WINDOW[1]))
    # the card slot: a groove leaning back, open at the top of the rail
    slot = cbox(0, 0, 0, CARD[0] + 4, SLOT_W, SLOT_DEPTH + 10).rotate([-SLOT_LEAN, 0, 0])   # longer than the rail: the card overhangs, and the hull's flanks must not pinch it
    cuts.append(slot.translate([0, RAIL_Y0 + RAIL_D / 2 + 0.5, RAIL_TOP - SLOT_DEPTH]))
    # feet
    for x, y in [(30, -34), (-30, -34), (30, 34), (-30, 34)]:
        cuts.append(cyl(FOOT_D, 1.01, x, y, z0 - 0.01))
    return solid - union(cuts)


def fit_test():
    bore = cyl(2 * BEZEL_BORE_R + 6, 6, seg=SEG) - cyl(2 * BEZEL_BORE_R, 8, z=-1, seg=SEG)
    skirt = cyl(CAP_D, 8, seg=SEG) - cyl(CAP_D - 2 * CAP_WALL, 10, z=-1, seg=SEG)
    return bore + skirt


# ── stand-ins for the bought parts: for the drawings and the clash check ────
def bought_parts(pressed=False):
    dz = -TRAVEL if pressed else 0
    hexboard = CrossSection.circle(HEX_FLAT / 2 / math.cos(math.radians(30)), 6).rotate(30).extrude(HEX_BOARD_T).translate([0, 0, HEX_BOTTOM + dz])
    hexboard += cbox(0, 0, HEX_BOTTOM - HEX_UNDER + dz, HEX_SOCKETS[0], HEX_SOCKETS[1], HEX_UNDER)
    return {
        'key': cbox(0, KEY_Y0 + KEY_BODY[1] / 2, 0, *KEY_BODY) + cbox(0, KEY_Y0 - KEY_PLUG / 2, 2, 8, KEY_PLUG, 4)
               - union(cyl(4.85, 10, sx * KEY_HOLES[0] / 2, KEY_Y0 + KEY_HOLES[1], -1) for sx in (-1, 1)),
        # the switch housing stays put; the keycap (a frustum) rides down by the preload, and by the travel when pressed
        'keycap': cbox(0, 0, KEY_BODY[2], 14, 14, KEYCAP_TOP - KEYCAP_H - KEY_BODY[2] - PRELOAD + dz + 0.01)
                  + Manifold.batch_hull([cbox(0, 0, KEYCAP_TOP - KEYCAP_H - PRELOAD + dz, KEYCAP[0], KEYCAP[0], 0.01),
                                         cbox(0, 0, KEYCAP_TOP - PRELOAD + dz - 0.01, KEYCAP_TOP_W, KEYCAP_TOP_W, 0.01)]),
        'hex': hexboard,
        'atom': box(ATOM_X0, -ATOM[1] / 2, 0, *ATOM),
        'splitter': cbox(ATOM_X0 + ATOM[0] - SPLITTER[0] / 2, 0, ATOM[2], *SPLITTER),
        'cell': cbox(-20, 0, CELL_Z, *CELL),
        'rider': box(RIDER_X0, -RIDER[1] / 2, RIDER_Z, *RIDER),
        'card': cbox(0, 0, 0, CARD[0], CARD[2], CARD[1]).rotate([-SLOT_LEAN, 0, 0]).translate([0, RAIL_Y0 + RAIL_D / 2 + 0.5 + 1.5 * math.sin(math.radians(SLOT_LEAN)), RAIL_TOP - SLOT_DEPTH + 1.5]),
    }


# ── output ──────────────────────────────────────────────────────────────────
def write_stl(solid, path):
    mesh = solid.to_mesh()
    v = np.asarray(mesh.vert_properties, dtype=np.float32)[:, :3]
    tris = v[np.asarray(mesh.tri_verts)]
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    rec = np.zeros(len(tris), dtype=[('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')])
    rec['n'], rec['v'] = n, tris
    with open(path, 'wb') as f:
        f.write(b'Pax Buttonica shell'.ljust(80, b' '))
        f.write(struct.pack('<I', len(tris)))
        f.write(rec.tobytes())

def for_printing(solid, flip):
    if flip:
        solid = solid.rotate([180, 0, 0])
    lo = solid.bounding_box()[:3]
    return solid.translate([0, 0, -lo[2]])

def section_svg(solids, colours, path, plane):
    """A cutaway through the axis: 'xz' looks from the front (USB on the right), 'yz' from the right-hand side."""
    shapes = []
    for name, solid in solids.items():
        if plane == 'yz':
            solid = solid.rotate([0, 0, -90])
        shapes.append((name, solid.rotate([90, 0, 0]).slice(0).to_polygons()))
    lo_x, hi_x, lo_y, hi_y = -60, 70, -62, 30
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{lo_x} {lo_y} {hi_x - lo_x} {hi_y - lo_y}" width="1320" height="968">',
           f'<rect x="{lo_x}" y="{lo_y}" width="{hi_x - lo_x}" height="{hi_y - lo_y}" fill="#f4f1ea"/>']
    for name, polys in shapes:
        d = ' '.join('M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in p) + ' Z' for p in polys)
        out.append(f'<path d="{d}" fill="{colours[name]}" fill-rule="evenodd" stroke="#111" stroke-width="0.12"><title>{name}</title></path>')
    label = 'front view, cut through the middle: USB window on the right' if plane == 'xz' else 'side view, cut through the middle'
    out.append(f'<text x="{lo_x + 2}" y="{lo_y + 5}" font-family="Helvetica" font-size="3.2" fill="#111">{label}</text>')
    out.append('</svg>')
    with open(path, 'w') as f:
        f.write('\n'.join(out))


if __name__ == '__main__':
    printed = {'deck': deck(), 'body': body(), 'cap': cap(), 'cage': cage(), 'bezel': bezel(), 'spring': spring(SPRING_FREE)}
    flipped = {'cap'}                          # flat face on the bed; the deck prints tray-up; the cage prints cup-down, legs up
    os.makedirs(os.path.join(HERE, 'stl'), exist_ok=True)

    print(f'base {TURRET_F:.0f} mm across flats plus a {RAIL_D:.0f} mm card rail behind, '
          f'{CAP_TOP - DECK_Z0:.1f} mm tall, cap top {CAP_D - 2 * CAP_CHAMFER:.0f} mm, '
          f'keycap top {KEYCAP_TOP:.1f} above the floor, hex LEDs at {HEX_TOP:.1f}, cap shows {CAP_EXPOSED:.1f} above the bezel')
    for name, solid in {**printed, 'fit_test': fit_test()}.items():
        out = for_printing(solid, name in flipped)
        write_stl(out, os.path.join(HERE, 'stl', f'{name}.stl'))
        bb = out.bounding_box()
        print(f'  {name:9s} {bb[3] - bb[0]:6.1f} x {bb[4] - bb[1]:5.1f} x {bb[5] - bb[2]:5.1f} mm  '
              f'{out.volume() / 1000:6.1f} cm3 solid  genus {out.genus()}')

    clashes = 0
    for pressed in (False, True):
        state = {**printed, **bought_parts(pressed)}
        del state['spring']
        state['springs'] = springs_in_place((FLANGE_BOTTOM - 1.2 if not pressed else WALL_TOP - 1.2) - 0.05)   # as compressed by the flange
        if pressed:
            state['cap'] = state['cap'].translate([0, 0, -TRAVEL])
            state['cage'] = state['cage'].translate([0, 0, -TRAVEL])
        names = list(state)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                overlap = (state[a] ^ state[b]).volume()
                if overlap > 0.5:
                    clashes += 1
                    print(f'  CLASH {"pressed" if pressed else "at rest"}: {a} / {b}  {overlap:.1f} mm3')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')

    colours = {'deck': '#2a2a2e', 'body': '#3a3a40', 'bezel': '#55555c', 'cage': '#8a8a92', 'cap': '#ffffff', 'springs': '#c9a227',
               'hex': '#2e7d32', 'key': '#e8e8e8', 'keycap': '#c62828', 'atom': '#1a3a6e', 'splitter': '#d8d8d8',
               'cell': '#8a8a55', 'rider': '#1b5e20', 'card': '#c8a165'}
    everything = {k: v for k, v in printed.items() if k != 'spring'}
    everything.update(bought_parts()); everything['springs'] = springs_in_place(FLANGE_BOTTOM - 1.25)
    section_svg(everything, colours, os.path.join(HERE, 'section-front.svg'), 'xz')
    section_svg(everything, colours, os.path.join(HERE, 'section-side.svg'), 'yz')
