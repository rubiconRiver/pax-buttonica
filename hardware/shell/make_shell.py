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
  AA holder  in a pocket under the plinth, cover and switch facing the table

Five printed parts, none of which needs supports:
  plinth  hex base with the battery pocket underneath. Depends only on the holder.
  body    hex turret: floor, key pegs, Atom bay, USB window, four screw posts.
  cap     the part you hit, with the hex cage hanging from its ceiling.
  cage    four legs that clip round the hex and end in the cup over the keycap; pushes up into the cap.
  bezel   screws onto the body over the cap: guides the skirt, holds the flange in.

A slap goes cap flange -> top of the body wall -> plinth -> table. The keycap only ever sees
TRAVEL + PRELOAD of movement, less than the switch's own travel.

Millimetres. x to the right (USB window on the +x flat), y away from you (the key's cable leaves
toward -y), z up, z = 0 at the top of the body's floor. STLs come out already turned the way they print.

STATUS: v0.4. v0.3 was printed 2026-09-24 and lit up; v0.4 lowers the bezel to a 9 mm ring, adds an
inner collar as the cap's guide, drops 4 mm of height, and takes M3 x 5 screws or brass standoffs.
The soldered carrier-board version of this shell is make_shell_pcb.py.
"""
import math
import os
import struct

import numpy as np
from manifold3d import CrossSection, Manifold, OpType

HERE = os.path.dirname(os.path.abspath(__file__))

# ── fit: tune these with the fit_test rings ─────────────────────────────────
SLIDE_CLEARANCE = 0.30   # radial gap between the cap's skirt and the bezel's bore, and round the inner collar
CHAMBER_CLEARANCE = 0.5  # radial gap round the cap's flange inside the bezel (it never guides, so it can be loose)
PART_CLEARANCE = 0.5     # around every bought part in its pocket
TAP_D = 2.8              # an M3 screw cuts its own thread in a hole this size
M3_CLEAR_D = 3.4
M3_HEAD_D = 6.2

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
HOLDER = (63.5, 57.6, 16.0)     # Adafruit 830 4xAA holder, leads out of its +x end         MEASURE

# ── body ────────────────────────────────────────────────────────────────────
TURRET_F = 90.0          # across the flats of the hexagon
BORE_R = 40.0            # round bore inside it
FLOOR_T = 1.6
WALL_TOP = 25.5          # top of the body wall = the hard stop
COLLAR_H = 36.0          # an inner collar the cap's skirt slides over: the real guide, hidden inside
COLLAR_T = 2.0
COLLAR_GAPS = ((-28, 28), (250, 290))   # no collar where the Atom bay and the key's cable are
ATOM_X0 = 13.0           # Atom bay from here to ATOM_X0 + 24 (its corners must stay inside the bore)
POSTS = [(33, 20), (-33, 20), (-33, -20), (33, -20)]   # screws up from the plinth
USB_WINDOW = (14.0, 9.0)
LEAD_GROOVE_W = 6.0      # the battery leads run up the outside of the +x flat in this groove

# ── the cage in the cap, and the saddle ─────────────────────────────────────
LED_GAP = 9.0            # hex LEDs to the underside of the diffuser
CAGE_ANGLES = (60, 120, 240, 300)   # legs at these flat centres; the side sockets open at 0 and 180
CAGE_LEG = (5.0, 2.5)    # leg width (tangential) and radial thickness: thin enough to flex for the snap lips
CAGE_R0 = HEX_FLAT / 2 + 0.6        # inner face of the legs
LIP = 0.7                # snap lips above and below the board
PAD_T = 2.5              # the pusher pads at the bottom of the legs
SADDLE_WALL = 1.5
SOCKET_H = 6.0           # bosses on the cap's ceiling that the cage's leg tops push into
SOCKET_FIT = 0.15        # clearance per side in those sockets: a firm push fit; a dab of glue if it isn't
SADDLE_BRIM_R = 18.0
SADDLE_T = 2.0           # brim / roof thickness

# ── cap and bezel ───────────────────────────────────────────────────────────
CAP_D = 70.0
CAP_TOP_T = 1.2          # the diffuser
CAP_WALL = 1.6
CAP_CHAMFER = 7.0
FLANGE_W, FLANGE_LAND = 3.1, 0.8
BEZEL_H = 9.0            # a low ring: it retains the flange and guides the top of the skirt; the collar does the rest
BEZEL_SCREW_R = 46.0
BEZEL_FLANGE_T = 2.5     # plastic under each screw head. Screws: M3 x 5, or the brass M3 6+6 standoffs used as bolts

# ── plinth ──────────────────────────────────────────────────────────────────
WIRE_RELIEF = 2.5        # extra pocket length at each end for the leads to turn
DECK_T = 4.4
FOOT_D = 10.5

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
POCKET = (HOLDER[0] + 2 * (PART_CLEARANCE + WIRE_RELIEF), HOLDER[1] + 2 * PART_CLEARANCE, HOLDER[2] + 1)
PLINTH_H = POCKET[2] + DECK_T
PLINTH_F = TURRET_F + 16
FLAT_X = TURRET_F / 2
LEAD_SLOT_X = FLAT_X + 1.5

assert TRAVEL + PRELOAD <= SWITCH_TRAVEL_MIN, 'the cap would bottom the switch out before the shell stops it'
assert math.hypot(ATOM_X0 + ATOM[0], ATOM[1] / 2) < BORE_R, 'the Atom does not fit in the bore'
assert CAP_EXPOSED - TRAVEL >= 8, 'the cap should stand well proud of the bezel even when pressed'
COLLAR_R = CAP_R - CAP_WALL - SLIDE_CLEARANCE          # outer face of the collar
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
    solid += union(cyl(7.5, 6, x, y) for x, y in POSTS)
    # the inner collar: the cap's skirt slides over it, so a 70 mm cap can't rock however it's hit
    collar = cyl(2 * COLLAR_R, COLLAR_H, seg=SEG) - cyl(2 * (COLLAR_R - COLLAR_T), COLLAR_H + 2, z=-1, seg=SEG)
    for a0, a1 in COLLAR_GAPS:
        wedge = CrossSection([[(0, 0)] + [(60 * math.cos(math.radians(a)), 60 * math.sin(math.radians(a))) for a in range(a0, a1 + 1)]]).extrude(COLLAR_H + 2).translate([0, 0, -1])
        collar -= wedge
    solid += collar
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
    cuts = [cyl(TAP_D, FLOOR_T + 6 + 2, x, y, -FLOOR_T - 1, seg=24) for x, y in POSTS]
    # USB-C window through the +x flat, with a recess outside for the plug's body
    cuts.append(cbox(FLAT_X, 0, ATOM_USB_Z - USB_WINDOW[1] / 2, 2 * (FLAT_X - BORE_R + 2), USB_WINDOW[0], USB_WINDOW[1]))
    cuts.append(cbox(FLAT_X, 0, -FLOOR_T - 1, 6, USB_WINDOW[0] + 6, FLOOR_T + 1 + ATOM_USB_Z + USB_WINDOW[1] / 2 + 3))
    # the battery leads run up the outside of that flat in a groove
    cuts.append(cbox(FLAT_X, 0, -FLOOR_T - 1, 6, LEAD_GROOVE_W, FLOOR_T + 1 + ATOM_USB_Z))
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
        # snap lips above and below the board: it clicks in from the top with the legs flexing, and can't fall out
        leg += Manifold.batch_hull([box(CAGE_R0 - LIP, -w / 2, HEX_BOTTOM - 0.3 - LIP, LIP + 0.01, w, 0.01),
                                    box(CAGE_R0 - 0.01, -w / 2, HEX_BOTTOM - 0.3 - LIP * 2.2, 0.02, w, LIP * 2.2 + 0.01)])
        leg += Manifold.batch_hull([box(CAGE_R0 - LIP, -w / 2, HEX_TOP + 0.3, LIP + 0.01, w, 0.01),
                                    box(CAGE_R0 - 0.01, -w / 2, HEX_TOP + 0.3 - 0.01, 0.02, w, LIP * 2.2 + 0.01)])
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


# ── plinth (built hanging under the body) ───────────────────────────────────
def plinth():
    z0 = -FLOOR_T - PLINTH_H
    roof = z0 + POCKET[2]
    cuts = [cbox(0, 0, z0 - 1, POCKET[0], POCKET[1], POCKET[2] + 1)]
    # the leads leave the holder's +x end, cross the roof in a groove and go up through a slot beside the turret
    cuts.append(box(POCKET[0] / 2 - 4, -4, roof - 0.01, LEAD_SLOT_X + 3 - (POCKET[0] / 2 - 4), 8, 3))
    cuts.append(cbox(LEAD_SLOT_X, 0, roof - 0.01, 6, 8, DECK_T + 1))
    for x, y in POSTS:
        cuts.append(cyl(M3_CLEAR_D, DECK_T + 2, x, y, roof - 1, seg=24))
        cuts.append(cyl(M3_HEAD_D, DECK_T - 1.6 + 0.01, x, y, roof - 0.01, seg=32))
    for sx in (-1, 1):
        for sy in (-1, 1):
            cuts.append(cyl(FOOT_D, 1.01, sx * 30, sy * (PLINTH_F / 2 - 9), z0 - 0.01))
    return hex_prism(PLINTH_F, PLINTH_H, z=z0, ct=4, cb=0.6) - union(cuts)


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
        'holder': cbox(0, 0, -FLOOR_T - DECK_T - HOLDER[2], *HOLDER),
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
    lo_x, hi_x, lo_y, hi_y = -60, 60, -62, 30
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
    printed = {'plinth': plinth(), 'body': body(), 'cap': cap(), 'cage': cage(), 'bezel': bezel()}
    flipped = {'plinth', 'cap'}               # flat face on the bed; the cage prints cup-down, legs up
    os.makedirs(os.path.join(HERE, 'stl'), exist_ok=True)

    print(f'plinth {PLINTH_F:.0f} mm across flats, turret {TURRET_F:.0f} mm, '
          f'{FLOOR_T + PLINTH_H + CAP_TOP:.1f} mm tall, cap top {CAP_D - 2 * CAP_CHAMFER:.0f} mm, '
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

    colours = {'plinth': '#2a2a2e', 'body': '#3a3a40', 'bezel': '#55555c', 'cage': '#8a8a92', 'cap': '#ffffff',
               'hex': '#2e7d32', 'key': '#e8e8e8', 'keycap': '#c62828', 'atom': '#1a3a6e', 'splitter': '#d8d8d8', 'holder': '#15151a'}
    everything = {**printed, **bought_parts()}
    section_svg(everything, colours, os.path.join(HERE, 'section-front.svg'), 'xz')
    section_svg(everything, colours, os.path.join(HERE, 'section-side.svg'), 'yz')
