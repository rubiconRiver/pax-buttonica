"""
v5, the slab: nothing moves. The bottom half is v2's, unchanged (the same lid, the cell and the Rider side by side,
the same charge window and switch slot), and everything above the platform is new: a flat top with a window over
the hex and a hole for a pad that sits on the Atom's own button.

  housing   72 x 80 (v2's footprint), 32.5 tall, the top built in. Prints top down: the outside of the top is on the
            bed, the walls grow up, no supports. A hex window, a rebate round it on the inside for the diffuser,
            a hole for the pad, and ribs down the walls that keep the platform from lifting.
  platform  the flat plate on the lid's fences, with a pedestal and fence for the Atom (its USB-C toward the cable
            corner) and a well for the hex: a hexagonal wall with four posts the board sits on, LEDs up. The well
            keeps the light off everything else in the box. Print it white if the light should be brighter.
  lid       v2's, the same file.
  diffuser  a hexagonal plate that sits in the top's rebate. White. Three thicknesses to try.
  pad       the button: a disc stuck to the Atom's face with foam tape, standing a little proud of the top.
            Pressed flush, the finger (or a slapping palm) lands on the top: the top is the stop, the foam is the give.

  .venv/bin/python make_shell_v5.py    ->  stl-v5/

Assembly, all right side up: lid; cell and Rider on it, plugged; platform onto the fences; Atom onto its pedestal,
hex into its well, Grove cable between them, the Atom's cable down the corner to the Rider; foam tape and the pad on
the Atom's face; diffuser into the housing's rebate (a dab of glue, or just a snug fit); housing down over the lot.

Not printed yet (2026-10-01). The drawing is checked against the same bought parts as v2.
"""
import importlib.util
import math
import os
import sys

from manifold3d import CrossSection, Manifold

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name, modname):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(HERE, name))
    mod = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, ['x']
    spec.loader.exec_module(mod)
    sys.argv = argv
    return mod


v2 = load('make_shell_v2.py', 'v2')
m = v2.m
cyl, box, cbox, union = m.cyl, m.box, m.cbox, m.union

OUT = 'stl-v5'

# ── from v2, unchanged: the box and its bottom half ─────────────────────────
W, D, WALL, IN, INY, CORNER_R = v2.W, v2.D, v2.WALL, v2.IN, v2.INY, v2.CORNER_R
LID_T, LID_Z, BOTTOM = v2.LID_T, v2.LID_Z, v2.BOTTOM
PLATFORM_T, PLATFORM_CLEAR, CLR = v2.PLATFORM_T, v2.PLATFORM_CLEAR, v2.CLR
PLATFORM_Z = 0.0                     # top of the platform: everything above is measured from here

# ── the upper layer ─────────────────────────────────────────────────────────
TOP_T = 1.6                          # the top's thickness
UP_H = 16.0                          # platform top to the top's underside
TOPZ = UP_H + TOP_T                  # the outside of the top

# The Atom: on a pedestal so its face is just under the top, USB-C toward +x (the cable corner is +x, -y).
ATOM = m.ATOM
AX, AY = -8.0, -22.0                 # its centre
PED_H = UP_H - 1.5 - ATOM[2]         # 5.0: the Atom's rim ends 1.5 under the top's underside
ATOM_FENCE_T, ATOM_FENCE_H = 1.5, 3.0
USBC_PLUG = v2.USBC_PLUG             # 22 long, 12 wide, 7 high: the Atom's plug

# The pad: on the Atom's panel through the hole. The panel is ATOM_BUTTON_DROP below the rim; foam tape between.
FOAM = 1.0                           # the tape's thickness, uncompressed                              MEASURE
PAD_D = 15.0                         # the panel is 17 square in a 19 opening
PAD_PROUD = 0.8                      # how far it stands above the top; pressed flush is the click plus the foam's give
PAD_HOLE = PAD_D + 0.6
PANEL_Z = PED_H + ATOM[2] - m.ATOM_BUTTON_DROP        # the top of the Atom's button panel
PAD_H = TOPZ + PAD_PROUD - (PANEL_Z + FOAM)

# The hex: in a well, LEDs up, the diffuser GAP above them.
HX, HY = -8.0, 16.0                  # its centre: in line with the Atom
GAP = 5.0                            # LEDs to the diffuser: about the LEDs' pitch, so the dots blend
DIFF_T = 1.0                         # the diffuser plate
DIFF_REBATE = 0.6                    # how far it is let into the top's underside
DIFF_Z = UP_H + DIFF_REBATE - DIFF_T          # its underside
HEX_TOP = DIFF_Z - GAP               # the LEDs
HEX_BOT = HEX_TOP - m.HEX_BOARD_T    # the board's underside, where it rests on the posts
WELL_T = 1.6
WELL_CLR = 0.3                       # round the board
WELL_TOP = DIFF_Z - 0.6              # the well's rim stops short of the thickest diffuser
WINDOW_F = m.HEX_FLAT - 1.0          # the window, across flats: the LEDs, not the board's edge
DIFF_F = WINDOW_F + 5.0              # the diffuser: 2.5 of rebate all round

# The cable corner: the platform is cut away here so the Atom's cable can go down to the Rider's USB-A.
CUT_X0, CUT_Y1 = AX + ATOM[0] / 2 + CLR + ATOM_FENCE_T + 0.5, AY + ATOM[1] / 2 + CLR + ATOM_FENCE_T + 0.5

RIB = (3.0, 2.0)                     # ribs down the walls over the platform's edge: width, how far they stand in
RIB_GAP = 0.3                        # above the platform's top


def hexagon(flat, h, z=0.0, x=0.0, y=0.0):
    """A hexagonal prism, flats facing +-x (as the board lies in v2's drawing)."""
    return CrossSection.circle(flat / 2 / math.cos(math.radians(30)), 6).rotate(30).extrude(h).translate([x, y, z])


def housing():
    solid = v2.rbox_prism(W, D, CORNER_R, TOPZ - BOTTOM, z=BOTTOM, ct=1.5, cb=0.6)
    solid -= v2.pocket_outline(UP_H - LID_Z, LID_Z)                    # the inside, lid to the top's underside
    solid -= v2.pocket_outline(LID_T + 1, BOTTOM - 1, grow=0.5)        # the lid's rebate
    # ribs down the walls: the platform rests on the lid's fences and cannot lift past these. They grow from the
    # top, which is on the bed when this prints, so nothing floats.
    ribs = []
    z0, h = PLATFORM_Z + RIB_GAP, UP_H - RIB_GAP + 0.1
    for y in (30.0, 0.0):
        ribs.append(box(-IN / 2 - 0.5, y - RIB[0] / 2, z0, RIB[1] + 0.5, RIB[0], h))                 # the -x wall
    ribs.append(box(IN / 2 - RIB[1], 12.0 - RIB[0] / 2, z0, RIB[1] + 0.5, RIB[0], h))               # the +x wall
    ribs.append(box(25.0 - RIB[0] / 2, INY / 2 - RIB[1], z0, RIB[0], RIB[1] + 0.5, h))              # the +y wall
    ribs.append(box(-30.0 + CORNER_R - RIB[0] / 2, -INY / 2 - 0.5, z0, RIB[0], RIB[1] + 0.5, h))    # the -y wall
    solid += union(ribs)
    cuts = [
        hexagon(WINDOW_F, TOP_T + 2, UP_H - 1, HX, HY),                              # the window
        hexagon(DIFF_F + 0.4, DIFF_REBATE + 0.01, UP_H - 0.01, HX, HY),             # the diffuser's rebate, inside
        cyl(PAD_HOLE, TOP_T + 2, AX, AY, UP_H - 1, seg=64),                          # the pad's hole
    ]
    # the charging window and the switch slot, where v2 has them
    port_z = LID_Z + 1.6 + 1.7
    cuts.append(cbox(v2.USBC_X, D / 2, port_z - v2.PORT[1] / 2, v2.PORT[0], 2 * WALL + 4, v2.PORT[1]))
    cuts.append(box(W / 2 - WALL - 2, v2.RIDER_Y0 + v2.RIDER_SWITCH - v2.SWITCH_SLOT[0] / 2, LID_Z + 0.8, WALL + 4, v2.SWITCH_SLOT[0], v2.SWITCH_SLOT[1]))
    return solid - union(cuts)


def platform():
    solid = v2.rbox_prism(IN - 2 * PLATFORM_CLEAR, INY - 2 * PLATFORM_CLEAR, CORNER_R - WALL - PLATFORM_CLEAR, PLATFORM_T, z=PLATFORM_Z - PLATFORM_T)
    # the Atom's pedestal, and a fence round it open toward its two sockets
    a = ATOM[0] + 2 * CLR
    solid += cbox(AX, AY, 0, a + 2 * ATOM_FENCE_T, a + 2 * ATOM_FENCE_T, PED_H)
    fence = cbox(AX, AY, PED_H, a + 2 * ATOM_FENCE_T, a + 2 * ATOM_FENCE_T, ATOM_FENCE_H)
    fence -= cbox(AX, AY, PED_H - 1, a, a, ATOM_FENCE_H + 2)
    fence -= cbox(AX, AY, PED_H - 1, a + 20, 14, ATOM_FENCE_H + 2)            # USB-C on +x, Grove on -x
    solid += fence
    # the hex's well: a hexagonal wall to just under the diffuser, and four posts the board rests on
    inner = m.HEX_FLAT + 2 * WELL_CLR
    well = hexagon(inner + 2 * WELL_T, WELL_TOP, 0, HX, HY) - hexagon(inner, WELL_TOP + 2, 0, HX, HY)
    r = inner / 2
    posts = [cbox(HX + sx * (r - 0.6), HY, 0, 2.4, 4.0, HEX_BOT) for sx in (-1, 1)]                 # at the two flats
    v = r / math.cos(math.radians(30))
    posts += [cbox(HX, HY + sy * (v - 1.6), 0, 4.0, 3.2, HEX_BOT) for sy in (-1, 1)]                # at two corners
    solid += well + (union(posts) ^ hexagon(inner + 0.2, HEX_BOT, 0, HX, HY))
    # a slot in the well for the hex's cable, toward the Atom's Grove side
    slot = box(-30, -5, 0.0, 30, 10, HEX_BOT - 1.0).rotate([0, 0, 60]).translate([HX, HY, 0])
    solid -= slot ^ (hexagon(inner + 2 * WELL_T + 2, HEX_BOT, 0, HX, HY) - hexagon(inner - 0.2, HEX_BOT + 1, -1, HX, HY))
    # the cable corner
    solid -= box(CUT_X0, -60, -PLATFORM_T - 1, 60, 60 + CUT_Y1, PLATFORM_T + 2)
    return solid


def diffuser(t=DIFF_T):
    return hexagon(DIFF_F, t, UP_H + DIFF_REBATE - t, HX, HY)


def pad(h=PAD_H):
    return cyl(PAD_D, h, AX, AY, PANEL_Z + FOAM, seg=64)


def bought(pressed=False):
    lower = v2.bought(False)
    parts = {k: lower[k] for k in ('cell', 'rider')}
    atom = m.bought_parts(False)['atom'].rotate([0, 0, 180])                 # USB-C toward +x
    atom += box(ATOM[0] / 2, -USBC_PLUG[1] / 2, 1.2, USBC_PLUG[0], USBC_PLUG[1], USBC_PLUG[2])     # the real plug
    atom += box(-ATOM[0] / 2 - 9, -5, 2.5, 9, 10, 5)                         # and the Grove plug on the other side
    parts['atom'] = atom.translate([AX, AY, PED_H])
    board = hexagon(m.HEX_FLAT, m.HEX_BOARD_T, HEX_BOT, HX, HY)
    board += cbox(HX, HY, HEX_BOT - m.HEX_UNDER, m.HEX_SOCKETS[0], m.HEX_SOCKETS[1], m.HEX_UNDER)
    parts['hex'] = board
    return parts


def printed_parts():
    return {'housing': housing(), 'platform': platform(), 'lid': v2.lid(), 'diffuser': diffuser(), 'pad': pad()}


if __name__ == '__main__':
    out = os.path.join(HERE, OUT)
    os.makedirs(out, exist_ok=True)
    printed = printed_parts()
    print(f'v5 slab: {W:.0f} x {D:.0f} mm, {TOPZ - BOTTOM:.1f} mm tall (v2 is {m.CAP_TOP - BOTTOM:.1f} to the cap). '
          f'LEDs {GAP:.0f} mm under a {DIFF_T:.1f} mm diffuser; pad {PAD_H:.1f} mm tall, {PAD_PROUD:.1f} proud, on {FOAM:.1f} mm of foam.')
    for name, solid in printed.items():
        flat = m.for_printing(solid, name == 'housing')
        m.write_stl(flat, os.path.join(out, f'{name}.stl'))
        bb = flat.bounding_box()
        print(f'  {name:9s} {bb[3] - bb[0]:6.1f} x {bb[4] - bb[1]:5.1f} x {bb[5] - bb[2]:5.1f} mm  {flat.volume() / 1000:6.1f} cm3  genus {flat.genus()}')
    for t in (0.6, 1.0, 1.4):
        m.write_stl(m.for_printing(diffuser(t), False), os.path.join(out, f'diffuser-{t:.1f}.stl'))
    for dh in (-0.5, 0.0, 0.5):
        m.write_stl(m.for_printing(pad(PAD_H + dh), False), os.path.join(out, f'pad-{PAD_H + dh:.1f}.stl'))

    clashes = 0
    for pressed in (False, True):
        state = {**printed, **bought()}
        if pressed:
            state['pad'] = state['pad'].translate([0, 0, -PAD_PROUD])          # flush with the top: the foam takes it
        names = list(state)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                overlap = (state[a] ^ state[b]).volume()
                if overlap > 0.5:
                    clashes += 1
                    print(f'  CLASH {"pressed" if pressed else "at rest"}: {a} / {b}  {overlap:.1f} mm3')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')
    # what carries a press: the lid's fences under the Atom's pedestal
    a = ATOM[0] + 2 * CLR + 2 * ATOM_FENCE_T
    under = (printed['lid'] ^ cbox(AX, AY, LID_Z + 0.5, a, a, v2.FENCE_H - 0.6)).volume() / (v2.FENCE_H - 0.6)
    print(f'  under the Atom: {under:.0f} mm2 of full-height fence carries the press to the lid')
    print(f'  pad pressed flush: {PAD_PROUD:.1f} mm of travel = the switch\'s 0.3 and {PAD_PROUD - 0.3:.1f} of foam; foam left {FOAM - (PAD_PROUD - 0.3):.1f} mm')
