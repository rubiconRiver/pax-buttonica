"""
Generates the Pax Buttonica button shell for the no-solder build: printable STLs and cutaways.

  python3 -m venv .venv && .venv/bin/pip install manifold3d numpy     # once
  .venv/bin/python make_shell.py

What goes inside (all M5Stack, all plug-together):
  NeoHEX     37-LED light board, on three small ledges just above the floor, LEDs up
  Key Unit   the clicky switch, on a bridge over the hex so its keycap sits under the cap's centre
  AtomS3     the brain, lying flat against one wall with its USB-C in a window: the battery plug
             (or the laptop) plugs in from OUTSIDE, so flashing needs no disassembly
  splitter   a Grove 1-to-3 (or a hand-made Y) taped on top of the Atom, so key and hex share its socket
  AA holder  in a pocket under the plinth, cover and switch facing the table

Five printed parts, none of which needs supports:
  plinth  hex base with the battery pocket underneath. Depends only on the holder.
  body    hex turret: floor, hex ledges, Atom bay, USB window, four screw posts.
  bridge  two legs and a frame that carries the Key Unit above the hex.
  cap     the part you hit (white or translucent). Flat top, 45-degree shoulder, a skirt that
          slides in the bezel, a flange that keeps it captive, a plunger down to the keycap.
  bezel   screws onto the body over the cap: guides the skirt, holds the flange in.

A slap goes cap flange -> top of the body wall -> plinth -> table. The keycap only ever sees
TRAVEL + PRELOAD of movement, less than the switch's own travel.

Millimetres. x to the right (USB window on the +x flat), y away from you, z up, z = 0 at the top
of the body's floor. STLs come out already turned the way they print.

STATUS: modelled from M5Stack's published sizes (marked MEASURE). Nothing printed or fitted yet.
The soldered carrier-board version of this shell is make_shell_pcb.py.
"""
import math
import os
import struct

import numpy as np
from manifold3d import CrossSection, Manifold, OpType

HERE = os.path.dirname(os.path.abspath(__file__))

# ── fit: tune these with the fit_test rings ─────────────────────────────────
SLIDE_CLEARANCE = 0.30   # radial gap between the cap's skirt and the bezel's bore
PART_CLEARANCE = 0.5     # around every bought part in its pocket
TAP_D = 2.8              # an M3 screw cuts its own thread in a hole this size
M3_CLEAR_D = 3.4
M3_HEAD_D = 6.2

# ── press feel ──────────────────────────────────────────────────────────────
TRAVEL = 2.8             # how far the cap moves before plastic meets plastic
PRELOAD = 0.2            # how far the cap holds the keycap down at rest (takes up rattle)
SWITCH_TRAVEL_MIN = 3.5  # the Key Unit's blue switch: about 4.0

# ── the bought parts (MEASURE each when the box arrives) ────────────────────
HEX_ACROSS = 41.6        # NeoHEX corner to corner, ears excluded (36 across flats per M5)   MEASURE
HEX_BOARD_T = 3.1        # board plus LEDs
HEX_UNDER = 6.5          # how far its sockets hang below the board                          MEASURE
KEY_UNIT = (40.0, 24.0, 16.6)   # Key Unit body x, y, z; its socket on the +x end            MEASURE
KEYCAP = (18.0, 18.0, 6.0)      # keycap on top, assumed centred on the body                 MEASURE
KEY_TOTAL_H = 22.6              # M5: 40 x 24 x 22.6 including the keycap
ATOM = (24.0, 24.0, 9.5)        # AtomS3 Lite lying flat, USB-C on its +x edge
ATOM_USB_Z = 4.75               # USB-C centre above the floor when it lies flat            MEASURE
SPLITTER = (12.0, 24.0, 8.0)    # Unit Hub 1-to-3                                           MEASURE
HOLDER = (63.5, 57.6, 16.0)     # Adafruit 830 4xAA holder, leads out of its +x end         MEASURE

# ── body ────────────────────────────────────────────────────────────────────
TURRET_F = 90.0          # across the flats of the hexagon
BORE_R = 40.0            # round bore inside it
FLOOR_T = 1.6
WALL_TOP = 24.5          # top of the body wall = the hard stop
HEX_LEDGE_Z = 8.0        # the hex board rests here; its sockets hang in the gap below
HEX_X = -8.0             # the hex sits off-centre, away from the Atom; its flats face +/-x
BRIDGE_Z = 15.0          # underside of the bridge frame
BRIDGE_T = 3.0
BRIDGE_LEG = 8.0
BRIDGE_LEG_Y = 25.0      # legs at (0, +/-BRIDGE_LEG_Y), so the key's cable can leave along +x
ATOM_X0 = 13.0           # Atom bay from here to ATOM_X0 + 24 (its corners must stay inside the bore)
POSTS = [(33, 20), (-33, 20), (-33, -20), (33, -20)]   # screws up from the plinth
USB_WINDOW = (14.0, 9.0)
LEAD_GROOVE_W = 6.0      # the battery leads run up the outside of the +x flat in this groove

# ── cap and bezel ───────────────────────────────────────────────────────────
CAP_D = 70.0
CAP_TOP_T = 1.2          # the diffuser
CAP_WALL = 1.6
CAP_CHAMFER = 7.0
CAP_EXPOSED = 10.0       # cap top above the bezel at rest
FLANGE_W, FLANGE_LAND = 3.1, 0.8
BEZEL_H = 17.0
BEZEL_SCREW_R = 46.0
BEZEL_FLANGE_T = 3.0
PLUNGER_D = 9.0

# ── plinth ──────────────────────────────────────────────────────────────────
WIRE_RELIEF = 2.5        # extra pocket length at each end for the leads to turn
DECK_T = 4.4
FOOT_D = 10.5

# ── derived ─────────────────────────────────────────────────────────────────
SEG = 128
CAP_R = CAP_D / 2
BEZEL_BORE_R = CAP_R + SLIDE_CLEARANCE
FLANGE_R = CAP_R + FLANGE_W
CHAMBER_R = FLANGE_R + SLIDE_CLEARANCE
BEZEL_TOP = WALL_TOP + BEZEL_H
CAP_TOP = BEZEL_TOP + CAP_EXPOSED
FLANGE_BOTTOM = WALL_TOP + TRAVEL
SEAT_Z = FLANGE_BOTTOM + FLANGE_LAND - SLIDE_CLEARANCE
KEY_BOTTOM = BRIDGE_Z + BRIDGE_T
KEYCAP_TOP = KEY_BOTTOM + KEY_TOTAL_H
PLUNGER_TIP = KEYCAP_TOP - PRELOAD
HEX_R = HEX_ACROSS / 2
HEX_FLAT = HEX_R * math.cos(math.radians(30))          # centre to the middle of a flat
POCKET = (HOLDER[0] + 2 * (PART_CLEARANCE + WIRE_RELIEF), HOLDER[1] + 2 * PART_CLEARANCE, HOLDER[2] + 1)
PLINTH_H = POCKET[2] + DECK_T
PLINTH_F = TURRET_F + 16
FLAT_X = TURRET_F / 2                                # the +x flat's outer face
LEAD_SLOT_X = FLAT_X + 1.5                           # centre of the slot through the plinth deck

assert TRAVEL + PRELOAD <= SWITCH_TRAVEL_MIN, 'the cap would bottom the switch out before the shell stops it'
assert math.hypot(ATOM_X0 + ATOM[0], ATOM[1] / 2) < BORE_R, 'the Atom does not fit in the bore'
assert CAP_TOP - CAP_TOP_T > KEYCAP_TOP + 4, 'the keycap is too close to the cap top'


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
    """Hexagon F across the flats, corners on the x axis... no: flats on +/-x, so the USB window is on a flat."""
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
    # three ledges for the hex board: a post with an inward lip, at 60, 180 and 300 degrees
    for a in (60, 180, 300):
        px, py = HEX_X + (HEX_FLAT + 2.5) * math.cos(math.radians(a)), (HEX_FLAT + 2.5) * math.sin(math.radians(a))
        solid += cbox(px, py, 0, 5, 5, HEX_LEDGE_Z)
        lx, ly = HEX_X + (HEX_FLAT - 1.5) * math.cos(math.radians(a)), (HEX_FLAT - 1.5) * math.sin(math.radians(a))
        solid += Manifold.batch_hull([cbox(px, py, HEX_LEDGE_Z - 2, 5, 5, 2), cbox(lx, ly, HEX_LEDGE_Z - 2, 3, 3, 2)])
    # a low fence round the Atom, open on the inner side for its cable
    ax0, ay0 = ATOM_X0 - PART_CLEARANCE, -ATOM[1] / 2 - PART_CLEARANCE
    fence = box(ax0 - 1.5, ay0 - 1.5, 0, ATOM[0] + 2 * PART_CLEARANCE + 3, ATOM[1] + 2 * PART_CLEARANCE + 3, 2)
    fence -= box(ax0, ay0, -1, ATOM[0] + 2 * PART_CLEARANCE + 5, ATOM[1] + 2 * PART_CLEARANCE, 4)
    fence -= box(ax0 - 3, -8, -1, 4, 16, 4)
    solid += fence
    # pockets for the bridge's legs
    cuts = [cbox(0, sy * BRIDGE_LEG_Y, -1.0, BRIDGE_LEG + 0.4, BRIDGE_LEG + 0.4, 3.0) for sy in (-1, 1)]
    cuts += [cyl(TAP_D, FLOOR_T + 6 + 2, x, y, -FLOOR_T - 1, seg=24) for x, y in POSTS]
    # USB-C window through the +x flat, with a recess outside for the plug's body
    cuts.append(cbox(FLAT_X, 0, ATOM_USB_Z - USB_WINDOW[1] / 2, 2 * (FLAT_X - BORE_R + 2), USB_WINDOW[0], USB_WINDOW[1]))
    cuts.append(cbox(FLAT_X, 0, -FLOOR_T - 1, 6, USB_WINDOW[0] + 6, FLOOR_T + 1 + ATOM_USB_Z + USB_WINDOW[1] / 2 + 3))
    # the battery leads run up the outside of that flat in a groove
    cuts.append(cbox(FLAT_X, 0, -FLOOR_T - 1, 6, LEAD_GROOVE_W, FLOOR_T + 1 + ATOM_USB_Z))
    cuts += [cyl(TAP_D, 9.01, x, y, WALL_TOP - 9, seg=24) for x, y in corners(BEZEL_SCREW_R)]
    return solid - union(cuts)


# ── bridge: carries the Key Unit over the hex ───────────────────────────────
def bridge():
    fx, fy = KEY_UNIT[0] + 2 * PART_CLEARANCE + 8, KEY_UNIT[1] + 2 * PART_CLEARANCE + 8
    frame = cbox(0, 0, BRIDGE_Z, fx, fy, BRIDGE_T)
    frame -= cbox(0, 0, BRIDGE_Z - 1, KEY_UNIT[0] - 4, KEY_UNIT[1] - 4, BRIDGE_T + 2)        # light passes; the unit rests on a 2 mm rim
    frame += cbox(0, 0, BRIDGE_Z + BRIDGE_T, fx, fy, 2) - cbox(0, 0, BRIDGE_Z + BRIDGE_T - 1, KEY_UNIT[0] + 2 * PART_CLEARANCE, KEY_UNIT[1] + 2 * PART_CLEARANCE, 4)
    frame -= cbox(fx / 2, 0, BRIDGE_Z + BRIDGE_T - 1, 10, 12, 4)                              # the cable leaves along +x
    legs = union(cbox(0, sy * BRIDGE_LEG_Y, -1.0, BRIDGE_LEG, BRIDGE_LEG, 1.0 + BRIDGE_Z + 0.01) for sy in (-1, 1))
    reach = BRIDGE_LEG_Y + BRIDGE_LEG / 2 - fy / 2                                            # from the frame's edge out to the leg
    tabs = union(cbox(0, sy * (fy / 2 + reach / 2), BRIDGE_Z, BRIDGE_LEG, reach + 0.01, BRIDGE_T) for sy in (-1, 1))
    return frame + legs + tabs


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
    k = CAP_WALL * math.sqrt(2)
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
    root = cyl(PLUNGER_D, 3.01, z=inner_top - 3, d2=PLUNGER_D + 4)
    return shell + plunger + root


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
    cap_h = KEYCAP[2] - PRELOAD - (TRAVEL if pressed else 0)
    return {
        'hex': CrossSection.circle(HEX_R, 6).rotate(30).extrude(HEX_BOARD_T).translate([HEX_X, 0, HEX_LEDGE_Z])
               + cbox(HEX_X, 0, HEX_LEDGE_Z - HEX_UNDER, 24, 12, HEX_UNDER),
        'key': cbox(0, 0, KEY_BOTTOM, *KEY_UNIT),
        'keycap': cbox(0, 0, KEY_BOTTOM + KEY_UNIT[2], KEYCAP[0], KEYCAP[1], cap_h),
        'atom': box(ATOM_X0, -ATOM[1] / 2, 0, *ATOM),
        'splitter': cbox(ATOM_X0 + ATOM[0] - SPLITTER[0] / 2, 0, ATOM[2], *SPLITTER),   # taped on top of the Atom, at the wall end
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
    lo_x, hi_x, lo_y, hi_y = -60, 60, -58, 30
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
    printed = {'plinth': plinth(), 'body': body(), 'bridge': bridge(), 'cap': cap(), 'bezel': bezel()}
    flipped = {'plinth', 'cap', 'bridge'}     # flat face on the bed
    os.makedirs(os.path.join(HERE, 'stl'), exist_ok=True)

    print(f'plinth {PLINTH_F:.0f} mm across flats, turret {TURRET_F:.0f} mm, '
          f'{FLOOR_T + PLINTH_H + CAP_TOP:.1f} mm tall, cap top {CAP_D - 2 * CAP_CHAMFER:.0f} mm, '
          f'keycap top {KEYCAP_TOP:.1f} above the floor, LEDs {CAP_TOP - CAP_TOP_T - HEX_LEDGE_Z - HEX_BOARD_T:.0f} below the diffuser')
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
        names = list(state)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                overlap = (state[a] ^ state[b]).volume()
                if overlap > 0.5:
                    clashes += 1
                    print(f'  CLASH {"pressed" if pressed else "at rest"}: {a} / {b}  {overlap:.1f} mm3')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')

    colours = {'plinth': '#2a2a2e', 'body': '#3a3a40', 'bezel': '#55555c', 'bridge': '#8a8a92', 'cap': '#ffffff',
               'hex': '#2e7d32', 'key': '#e8e8e8', 'keycap': '#c62828', 'atom': '#1a3a6e', 'splitter': '#d8d8d8', 'holder': '#15151a'}
    everything = {**printed, **bought_parts()}
    section_svg(everything, colours, os.path.join(HERE, 'section-front.svg'), 'xz')
    section_svg(everything, colours, os.path.join(HERE, 'section-side.svg'), 'yz')
