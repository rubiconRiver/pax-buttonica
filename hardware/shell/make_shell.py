"""
Generates the Pax Buttonica button shell: five printable STLs and a cutaway drawing.

  python3 -m venv .venv && .venv/bin/pip install manifold3d numpy     # once
  .venv/bin/python make_shell.py

Five printed parts, none of which needs supports:

  plinth  hex base. The battery holder sits in a pocket underneath, cover and switch facing
          the table. The ONLY part that depends on which holder you buy.
  body    hex turret. Carrier board on four posts plus a pillar under the switch.
  shelf   carries the LED ring 12 mm above the board, on three of the board's screws.
  cap     the part you hit (white or translucent). Flat top, 45-degree shoulder, a skirt that
          slides in the bezel, a flange that keeps it captive, a plunger down to the switch.
  bezel   screws onto the body over the cap: guides the skirt, holds the flange in.

A slap goes cap flange -> top of the body wall -> plinth -> table. The switch only ever sees
TRAVEL + PRELOAD of movement, which is less than its own travel.

Millimetres throughout. x to the right, y toward the USB port, z up, z = 0 at the top of the
body's floor. Board coordinates are those of ../pcb/make_board.py with y flipped (KiCad's y
points down). STLs come out already turned the way they should print.

STATUS: modelled from datasheet dimensions. Nothing here has been printed or fitted yet.
"""
import math
import os
import struct

import numpy as np
from manifold3d import CrossSection, Manifold, OpType

HERE = os.path.dirname(os.path.abspath(__file__))

# ── fit: tune these with the fit_test rings ─────────────────────────────────
SLIDE_CLEARANCE = 0.30   # radial gap between the cap's skirt and the bezel's bore
BOARD_CLEARANCE = 0.80   # radial gap between the board and the body's bore
TAP_D = 2.8              # an M3 screw cuts its own thread in a hole this size
M3_CLEAR_D = 3.4
M3_HEAD_D = 6.2          # well for a socket-head or pan-head M3

# ── press feel ──────────────────────────────────────────────────────────────
TRAVEL = 2.8             # how far the cap moves before plastic meets plastic
PRELOAD = 0.2            # how far the cap holds the switch down at rest (takes up rattle)
SWITCH_TRAVEL_MIN = 3.3  # BOX Jade is 3.6 +/- 0.3; Cherry MX is 4.0

# ── carrier board v0.2 ──────────────────────────────────────────────────────
BOARD_D, BOARD_T = 70.0, 1.6
MOUNTS = [(23, 19), (-23, 19), (-23, -19), (23, -19)]   # the last is the corner beside C1
SHELF_MOUNTS = [0, 1, 2]           # the shelf stands on these; C1 is in the way at the fourth
SW_PINS = [(2.54, 5.08), (-3.81, 2.54)]                 # solder joints under the switch
SW_PEGS = [(5.08, 0), (-5.08, 0)]                       # plastic pegs of 5-pin switches
SW_STEM_TOP = 15.2       # top of an unpressed MX stem above the board
RING_H = 12.0            # LED ring's underside above the board (docs/HARDWARE.md)
RING_OD, RING_ID = 32.0, 18.0      # 8-LED ring. The shelf does not suit the 50 mm ring yet.
USB_ABOVE_BOARD = 5.1    # centre of the USB-C port above the board's top face
MODULE_ON_BACK = False   # True if your ESP32 had to go on the underside of the board

# ── body ────────────────────────────────────────────────────────────────────
TURRET_F = 84.0          # across the flats of the hexagon
FLOOR_T = 1.6
POST_H = 10.0            # board underside above the floor; keeps the antenna off the cells
WALL_TOP = 24.5          # top of the body wall = the hard stop. The pressed skirt must clear the shelf's columns
USB_W, USB_H = 14.0, 9.0

# ── cap and bezel ───────────────────────────────────────────────────────────
CAP_D = 70.0
CAP_TOP_T = 1.2          # the diffuser. 1.2 mm of white PLA glows well
CAP_WALL = 1.6
CAP_CHAMFER = 7.0
CAP_EXPOSED = 10.0       # cap top above the bezel at rest
FLANGE_W, FLANGE_LAND = 3.1, 0.8
BEZEL_H = 17.0
BEZEL_SCREW_R = 43.5     # six M3 wells, one in each corner
BEZEL_FLANGE_T = 3.0     # plastic under each screw head
PLUNGER_D = 9.0

# ── plinth: set these from the holder you actually have ─────────────────────
HOLDER = (70.0, 65.0, 20.0)   # Amazon B0DK2SYS2Y as listed. MEASURE YOURS.
HOLDER_CLEARANCE = 0.5
WIRE_RELIEF = 2.5        # extra pocket length at each end for the leads to turn
DECK_T = 4.4
PLINTH_WALL = 1.6        # thinnest wall, at the pocket's corners
FOOT_D = 10.5            # recesses for stick-on rubber feet

# ── derived ─────────────────────────────────────────────────────────────────
SEG = 128
BOARD_TOP = POST_H + BOARD_T
BORE_R = BOARD_D / 2 + BOARD_CLEARANCE
CAP_R = CAP_D / 2
BEZEL_BORE_R = CAP_R + SLIDE_CLEARANCE
FLANGE_R = CAP_R + FLANGE_W
CHAMBER_R = FLANGE_R + SLIDE_CLEARANCE
BEZEL_TOP = WALL_TOP + BEZEL_H
CAP_TOP = BEZEL_TOP + CAP_EXPOSED                    # at rest
FLANGE_BOTTOM = WALL_TOP + TRAVEL                    # at rest
SEAT_Z = FLANGE_BOTTOM + FLANGE_LAND - SLIDE_CLEARANCE   # where the bezel's cone starts
PLUNGER_TIP = BOARD_TOP + SW_STEM_TOP - PRELOAD      # at rest
POCKET = (HOLDER[0] + 2 * (HOLDER_CLEARANCE + WIRE_RELIEF), HOLDER[1] + 2 * HOLDER_CLEARANCE, HOLDER[2] + 1)
PLINTH_H = POCKET[2] + DECK_T
PLINTH_F = max(TURRET_F + 16, math.ceil((POCKET[0] * math.sqrt(3) + POCKET[1]) / 2 + 2 * PLINTH_WALL))
WIRE_SLOT = (8.0, 8.8)                               # through the body floor and the plinth deck
WIRE_SLOT_Y = -(BORE_R + 3) + WIRE_SLOT[1] / 2

assert TRAVEL + PRELOAD <= SWITCH_TRAVEL_MIN, 'the cap would bottom the switch out before the shell stops it'


# ── helpers ─────────────────────────────────────────────────────────────────
def cyl(d, h, x=0.0, y=0.0, z=0.0, d2=None, seg=48):
    return Manifold.cylinder(h, d / 2, (d if d2 is None else d2) / 2, seg).translate([x, y, z])

def box(x0, y0, z0, sx, sy, sz):
    return Manifold.cube([sx, sy, sz]).translate([x0, y0, z0])

def union(parts):
    return Manifold.batch_boolean(list(parts), OpType.Add)

def revolve(points):
    """Solid of revolution from (radius, z) points, in either winding."""
    pts = np.array(points, dtype=float)
    area = 0.5 * np.sum(pts[:, 0] * np.roll(pts[:, 1], -1) - np.roll(pts[:, 0], -1) * pts[:, 1])
    return CrossSection([pts if area > 0 else pts[::-1]]).revolve(SEG)

def hex_prism(F, h, z=0.0, ct=0.0, cb=0.0):
    """Hexagon F across the flats, corners on the x axis, optional chamfers top and bottom."""
    def slab(f, z0, t):
        return CrossSection.circle(f / 2 / math.cos(math.radians(30)), 6).extrude(t).translate([0, 0, z0])
    slabs = [slab(F, cb, h - ct - cb)]
    if cb: slabs.append(slab(F - 2 * cb, 0, 0.01))
    if ct: slabs.append(slab(F - 2 * ct, h - 0.01, 0.01))
    return Manifold.batch_hull(slabs).translate([0, 0, z])

def corners(r):
    return [(r * math.cos(math.radians(a)), r * math.sin(math.radians(a))) for a in range(0, 360, 60)]


# ── body ────────────────────────────────────────────────────────────────────
def body():
    usb_z = POST_H - USB_ABOVE_BOARD if MODULE_ON_BACK else BOARD_TOP + USB_ABOVE_BOARD
    solid = hex_prism(TURRET_F, FLOOR_T + WALL_TOP, z=-FLOOR_T, cb=0.6) - cyl(2 * BORE_R, WALL_TOP + 1, seg=SEG)
    solid += union(cyl(7.5, POST_H, x, y) for x, y in MOUNTS)
    solid += cyl(14, POST_H)                                           # pillar under the switch
    cuts = []
    # posts take a screw from each end: the board's from above, the plinth's from below
    cuts += [cyl(TAP_D, FLOOR_T + POST_H + 2, x, y, -FLOOR_T - 1, seg=24) for x, y in MOUNTS]
    # pillar: clear the switch's centre pin, its two solder joints and the optional pegs
    cuts.append(cyl(5.5, FLOOR_T + POST_H + 2, z=-FLOOR_T - 1, seg=32))
    cuts += [cyl(4.0, 4, x, y, POST_H - 3.5, seg=24) for x, y in SW_PINS]
    cuts += [cyl(3.2, 4, x, y, POST_H - 3.5, seg=24) for x, y in SW_PEGS]
    # USB-C, through the +y flat. Big enough for the plug's plastic body.
    cuts.append(box(-USB_W / 2, BORE_R - 1, usb_z - USB_H / 2, USB_W, TURRET_F / 2, USB_H))
    # battery leads: up through the floor, then up a channel in the wall past the board's edge to J1
    cuts.append(box(-3.5, -(BORE_R + 3), 0, 7, 3.01, 20))
    cuts.append(box(-WIRE_SLOT[0] / 2, WIRE_SLOT_Y - WIRE_SLOT[1] / 2, -FLOOR_T - 1, WIRE_SLOT[0], WIRE_SLOT[1], FLOOR_T + 1.01))
    # bezel screws
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


# ── cap ─────────────────────────────────────────────────────────────────────
def cap():
    k = CAP_WALL * math.sqrt(2)          # horizontal thickness of the 45-degree shoulder
    inner_r = CAP_R - CAP_WALL
    inner_top = CAP_TOP - CAP_TOP_T
    shoulder_z = CAP_TOP - CAP_CHAMFER
    inner_shoulder_z = shoulder_z - k + CAP_WALL
    shell = revolve([
        (0, CAP_TOP), (CAP_R - CAP_CHAMFER, CAP_TOP), (CAP_R, shoulder_z),
        (CAP_R, FLANGE_BOTTOM + FLANGE_LAND + FLANGE_W), (FLANGE_R, FLANGE_BOTTOM + FLANGE_LAND), (FLANGE_R, FLANGE_BOTTOM),
        (inner_r, FLANGE_BOTTOM), (inner_r, inner_shoulder_z),
        (inner_r - (inner_top - inner_shoulder_z), inner_top), (0, inner_top)])
    plunger = cyl(PLUNGER_D, inner_top - PLUNGER_TIP + 0.01, z=PLUNGER_TIP)
    root = cyl(PLUNGER_D, 3.01, z=inner_top - 3, d2=PLUNGER_D + 4)   # so a slap doesn't snap it off the diffuser
    return shell + plunger + root


# ── shelf for the LED ring (built at its real height above the floor) ───────
def shelf():
    plate_t, col_d = 2.0, 9.0
    z0 = BOARD_TOP
    plate_z = z0 + RING_H - plate_t
    rim = cyl(RING_OD + 3.2, 1.0, z=z0 + RING_H, seg=SEG) - cyl(RING_OD + 0.6, 3, z=z0 + RING_H - 1, seg=SEG)
    # the rim is in three pieces so the ring's wires have somewhere to go
    rim -= union(box(0, -3, z0 + RING_H - 1, RING_OD, 6, 3).rotate([0, 0, a]) for a in (30, 150, 270))
    parts = [cyl(RING_OD + 3.2, plate_t, z=plate_z, seg=SEG), rim]
    cuts = [cyl(RING_ID, RING_H + 4, z=z0 - 1, seg=SEG)]              # switch body and plunger pass through
    for i in SHELF_MOUNTS:
        x, y = MOUNTS[i]
        parts.append(Manifold.batch_hull([cyl(col_d, plate_t, z=plate_z), cyl(col_d, plate_t, x, y, plate_z)]))
        parts.append(cyl(col_d, RING_H, x, y, z0))
        cuts.append(cyl(M3_CLEAR_D, RING_H + 2, x, y, z0 - 1, seg=24))
        cuts.append(cyl(M3_HEAD_D, RING_H, x, y, z0 + 2.5, seg=32))  # the head sits deep, so an M3x8 reaches the post
    return union(parts) - union(cuts)


# ── plinth (built hanging under the body) ───────────────────────────────────
def plinth():
    z0 = -FLOOR_T - PLINTH_H          # the table
    roof = z0 + POCKET[2]
    cuts = [box(-POCKET[0] / 2, -POCKET[1] / 2, z0 - 1, POCKET[0], POCKET[1], POCKET[2] + 1)]
    # lead groove across the pocket's roof, from either end of the holder to the slot
    cuts.append(box(-POCKET[0] / 2, WIRE_SLOT_Y - WIRE_SLOT[1] / 2, roof - 0.01, POCKET[0], WIRE_SLOT[1], 3))
    cuts.append(box(-WIRE_SLOT[0] / 2, WIRE_SLOT_Y - WIRE_SLOT[1] / 2, roof - 0.01, WIRE_SLOT[0], WIRE_SLOT[1], DECK_T + 1))
    # screws up into the body's posts; heads sink into the roof so the holder lies flat over them
    for x, y in MOUNTS:
        cuts.append(cyl(M3_CLEAR_D, DECK_T + 2, x, y, roof - 1, seg=24))
        cuts.append(cyl(M3_HEAD_D, DECK_T - 1.6 + 0.01, x, y, roof - 0.01, seg=32))
    for sx in (-1, 1):
        for sy in (-1, 1):
            cuts.append(cyl(FOOT_D, 1.01, sx * 25, sy * (PLINTH_F / 2 - 9), z0 - 0.01))
    return hex_prism(PLINTH_F, PLINTH_H, z=z0, ct=4, cb=0.6) - union(cuts)


# ── quick fit test: a slice of the bezel's bore and a slice of the cap's skirt ─
def fit_test():
    bore = cyl(2 * BEZEL_BORE_R + 6, 6, seg=SEG) - cyl(2 * BEZEL_BORE_R, 8, z=-1, seg=SEG)
    skirt = cyl(CAP_D, 8, seg=SEG) - cyl(CAP_D - 2 * CAP_WALL, 10, z=-1, seg=SEG)
    return bore + skirt


# ── stand-ins for the bought parts: for the drawing and the clash check only ─
def bought_parts():
    return {
        'board': cyl(BOARD_D, BOARD_T, z=POST_H, seg=SEG) - cyl(4.4, 4, z=POST_H - 1),
        'switch': box(-7.8, -7.8, BOARD_TOP, 15.6, 15.6, 6) + box(-6, -6, BOARD_TOP, 12, 12, 11.6)
                  + cyl(4.0, 3.3, z=POST_H - 1.7),
        'stem': box(-2, -2, BOARD_TOP + 11.6, 4, 4, SW_STEM_TOP - 11.6 - PRELOAD),
        'esp32': box(-9, 12.1, BOARD_TOP + 2.5, 18, 22.5, 1) + box(-4.5, 27.2, BOARD_TOP + 3.5, 9, 7.3, 3.2),
        'c1': cyl(8, 17, 26.5, -12, BOARD_TOP),
        'j1': box(-5.1, -33, BOARD_TOP, 10.2, 9, 10),
        'ring': cyl(RING_OD, 3.2, z=BOARD_TOP + RING_H, seg=SEG) - cyl(RING_ID, 5, z=BOARD_TOP + RING_H - 1, seg=SEG),
        'holder': box(-HOLDER[0] / 2, -HOLDER[1] / 2, -FLOOR_T - DECK_T - HOLDER[2], *HOLDER),
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
    """Turn a part the way it prints, and sit it on the bed at the origin."""
    if flip:
        solid = solid.rotate([180, 0, 0])
    lo = solid.bounding_box()[:3]
    return solid.translate([0, 0, -lo[2]])

def section_svg(solids, colours, path, plane):
    """A cutaway through the axis: plane 'xz' looks from the front, 'yz' from the right-hand side."""
    shapes = []
    for name, solid in solids.items():
        if plane == 'yz':
            solid = solid.rotate([0, 0, -90])
        polys = solid.rotate([90, 0, 0]).slice(0).to_polygons()
        shapes.append((name, polys))
    lo_x, hi_x, lo_y, hi_y = -66, 66, -62, 34          # drawing window, mm (the slice's y is already -z, which is the way SVG draws)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{lo_x} {lo_y} {hi_x - lo_x} {hi_y - lo_y}" width="1320" height="960">',
           f'<rect x="{lo_x}" y="{lo_y}" width="{hi_x - lo_x}" height="{hi_y - lo_y}" fill="#f4f1ea"/>']
    for name, polys in shapes:
        d = ' '.join('M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in p) + ' Z' for p in polys)
        out.append(f'<path d="{d}" fill="{colours[name]}" fill-rule="evenodd" stroke="#111" stroke-width="0.12"><title>{name}</title></path>')
    label = 'front view, cut through the middle' if plane == 'xz' else 'side view, cut through the middle (USB on the right)'
    out.append(f'<text x="{lo_x + 2}" y="{lo_y + 5}" font-family="Helvetica" font-size="3.2" fill="#111">{label}</text>')
    out.append('</svg>')
    with open(path, 'w') as f:
        f.write('\n'.join(out))


if __name__ == '__main__':
    printed = {'plinth': plinth(), 'body': body(), 'shelf': shelf(), 'cap': cap(), 'bezel': bezel()}
    flipped = {'plinth', 'shelf', 'cap'}       # these print upside down: flat face on the bed
    os.makedirs(os.path.join(HERE, 'stl'), exist_ok=True)

    print(f'plinth {PLINTH_F:.0f} mm across flats, turret {TURRET_F:.0f} mm, '
          f'{FLOOR_T + PLINTH_H + CAP_TOP:.1f} mm tall, cap top {CAP_D - 2 * CAP_CHAMFER:.0f} mm')
    for name, solid in {**printed, 'fit_test': fit_test()}.items():
        out = for_printing(solid, name in flipped)
        write_stl(out, os.path.join(HERE, 'stl', f'{name}.stl'))
        bb = out.bounding_box()
        print(f'  {name:9s} {bb[3] - bb[0]:6.1f} x {bb[4] - bb[1]:5.1f} x {bb[5] - bb[2]:5.1f} mm  '
              f'{out.volume() / 1000:6.1f} cm3 solid  genus {out.genus()}')

    # clash check: nothing may overlap anything else, at rest or fully pressed
    everything = {**printed, **bought_parts()}
    clashes = 0
    for pressed in (False, True):
        state = dict(everything)
        if pressed:
            state['cap'] = state['cap'].translate([0, 0, -TRAVEL])
            state['stem'] = box(-2, -2, BOARD_TOP + 11.6, 4, 4, SW_STEM_TOP - 11.6 - PRELOAD - TRAVEL)
        names = list(state)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                overlap = (state[a] ^ state[b]).volume()
                if overlap > 0.5:
                    clashes += 1
                    print(f'  CLASH {"pressed" if pressed else "at rest"}: {a} / {b}  {overlap:.1f} mm3')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')

    colours = {'plinth': '#2a2a2e', 'body': '#3a3a40', 'bezel': '#55555c', 'shelf': '#8a8a92', 'cap': '#ffffff',
               'board': '#2e7d32', 'switch': '#777', 'stem': '#e08a1f', 'esp32': '#1a3a6e', 'c1': '#111',
               'j1': '#3c9a5f', 'ring': '#d8d8d8', 'holder': '#15151a'}
    section_svg(everything, colours, os.path.join(HERE, 'section-front.svg'), 'xz')
    section_svg(everything, colours, os.path.join(HERE, 'section-side.svg'), 'yz')
