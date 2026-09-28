"""
v2, the two-layer box: the same cap, cage, peg, springs and collar as v1, in a 72 mm square housing with rounded
corners, 8 mm lower than the hex, because the cell and the Rider lie side by side on the lid instead of one on
top of the other. The Atom still sits on a platform above them, under the cap.

  housing   72 x 72, rounded corners. Its top edge is the cap's retaining lip; inside, the round bore above the
            platform and a square pocket below it. One window in the +y wall for the Rider's USB-C. Three screw
            tabs at the bottom corners (not the port corner). Prints upside down.
  platform  a square plate the size of the pocket: the Atom's fence, the collar, the spring pockets, a hole for
            the power cable near the -y edge, notches round the three tabs. It rests on the lid's fences.
  lid       flat plate with fences the full height of the compartment: a U round the cell, a stop and a side
            wall for the Rider, standing up to the platform so it can't rock. Three countersunk screws, four feet.
  cap, cage   as make_shell_mini.py, unchanged. No springs: the cap rests on the Atom's switch through the peg.
  nub       the peg, 3.5 mm head (nub-3.0 and nub-4.0 to choose from): taller than the mini's, to take up the 2 mm
            the springs used to hold the cap up by.

  .venv/bin/python make_shell_v2.py    ->  stl-v2/

Inside, on the lid: the cell along the -x wall (34 x 50, its lead out of the +y end); the Rider beside it
along y, USB-C at the +y wall (the port), USB-A at its -y end with the plug pointing -y; the cable turns up
through the platform's hole just past the plug and into the Atom's USB-C, which faces +x (the Atom is turned
round from the mini, and the springs are mirrored to suit, so no spring stands beside the plug).

Assembly (housing upside down): cage with hex and peg into the cap; cap into the housing, flange up;
Atom into the platform's fence, hex cable in; platform in, notches over the tabs, the cable in its slot; lid: cell in its U, Rider between its walls with the USB-C at the window, cable up through the
platform's hole into the Atom; lid on, three screws, four feet.
"""
import importlib.util
import math
import os
import sys

from manifold3d import CrossSection, JoinType, Manifold

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('mini', os.path.join(HERE, 'make_shell_mini.py'))
m = importlib.util.module_from_spec(spec)
_argv, sys.argv = sys.argv, ['x']
spec.loader.exec_module(m)
sys.argv = _argv

OUT = 'stl-v2'

# ── the housing ─────────────────────────────────────────────────────────────
W = 72.0                            # outside, square
WALL = 2.5
CORNER_R = 6.0                      # outside; the inside corners are CORNER_R - WALL
IN = W - 2 * WALL                   # 67 inside: the bore (66) needs it
BORE_R = m.BORE_R                   # 33
PLATFORM_T = m.FLOOR_T              # 1.6
PLATFORM_CLEAR = 0.3                # platform to pocket, each side
COMP_H = m.CELL[2] + m.PART_CLEARANCE + 0.4   # 10.5: the cell is the tallest thing on the lid
LID_T = 2.5
TOP = m.BEZEL_TOP                   # 21, the housing's top edge
PLATFORM_Z = 0.0                    # top of the platform
LID_Z = PLATFORM_Z - PLATFORM_T - COMP_H
BOTTOM = LID_Z - LID_T              # the table
C = IN / 2 - 3.5                    # 30: the corners' centres, tabs and feet
TAB_CORNERS = ((-1, 1), (-1, -1), (1, -1))    # not (+1, +1): the Rider's USB-C is there
ALL_CORNERS = ((-1, 1), (-1, -1), (1, -1), (1, 1))
TAB_D, TAB_H = 8.0, 6.0
NOTCH_R = 5.0
PORT = (13.0, 8.0)
FOOT_D = 10.5
FENCE_T = 1.6
FENCE_H = COMP_H - 0.3              # the platform rests on the fences, a hair below the housing's ledge
CLR = m.PART_CLEARANCE              # 0.5 round every bought part

# where things lie on the lid (x, y of their low corner)
CELL_X0, CELL_Y0 = -IN / 2 + CLR, -m.CELL[1] / 2                       # -33, -25: along the -x wall
RIDER_FOOT = (m.RIDER[1], m.RIDER[0])                                  # turned: 25 along x, 41 along y
RIDER_X0 = CELL_X0 + m.CELL[0] + CLR + FENCE_T + CLR                   # 4.1: past the cell and the fence
RIDER_Y0 = IN / 2 - CLR - RIDER_FOOT[1]                                # -8: its USB-C end 0.5 from the +y wall
RIDER_CX = RIDER_X0 + RIDER_FOOT[0] / 2                                # 16.6, where the port is
PLUG = (12.0, 15.0, 7.0)                                               # the USB-A plug body out of the Rider's -y end
CABLE_HOLE = (6.0, -36.0, 14.0, 14.0)                                  # x0, y0, sx, sy: a SLOT open to the platform's -y edge, just past the Rider's plug.
#   The cable has a plug on each end and neither passes a hole, so it has to slip in from the side.
# No printed springs (2026-09-28): with no bezel pressing on it, the cap resting on the Atom's own switch through
# the peg returns by itself, and Garett's test of exactly that felt better than the sprung one. The peg is taller
# to take up the 2 mm the springs used to hold the cap up by, less REST_PLAY so it can never hold the switch down.
SPRINGS = False
REST_PLAY = 0.5                      # how far the cap sits below the lip at rest, resting on the switch
PEG_H = m.NUB_H + (0.0 if SPRINGS else m.DISC_GAP - REST_PLAY)     # 3.5 without springs, 2.0 with
# The stop. Sprung, the cap travelled 2.8 mm and the cage's plate landed on the Atom's rim. Unsprung it rests on
# the switch, so a press is the switch's 0.3 mm and then the peg's flexures, which give about a millimetre and
# snap beyond it (two of three did, 2026-09-28). The collar is raised so the cap's ceiling lands on it 0.5 mm
# after the click: a slap goes cap -> collar -> platform -> fences -> lid -> table, and the flexures never bend more.
STOP_AFTER_CLICK = 0.5
PRESS = (m.TRAVEL - m.DISC_GAP - 0.5) + STOP_AFTER_CLICK          # 0.3 + 0.5: how far the cap moves from rest to the stop


def _cap_meets_collar():
    """How far the cap drops from the lip before its ceiling lands on the mini's collar, measured on the solids
    (the mini's formula leaves more room than it says: 4.5 mm, not 3.3)."""
    cap, collar, d = m.cap(), m.collar(), 0.0
    while d < 8 and (cap.translate([0, 0, -d]) ^ collar).volume() < 0.05:
        d += 0.05
    return d


COLLAR_RAISE = 0.0 if SPRINGS else _cap_meets_collar() - (REST_PLAY + PRESS) - 0.1      # a hair short, so the stop is just past the drawn press
SPRING_ANGLES = (0, 120, 240)                                          # mirrored from the mini: the Atom is turned round, USB-C toward +x
m.SPRING_ANGLES = SPRING_ANGLES                                        # springs_in_place() reads it
cyl, box, cbox, union, revolve = m.cyl, m.box, m.cbox, m.union, m.revolve


def rbox_prism(w, d, r, h, z=0.0, ct=0.0, cb=0.0, cx=0.0, cy=0.0):
    """A rounded-corner box, optional chamfers top and bottom (like hex_prism)."""
    def slab(c, z0, t):
        rr = max(r - c, 0.2)
        cs = CrossSection.square([w - 2 * c - 2 * rr, d - 2 * c - 2 * rr], True).offset(rr, JoinType.Round, 2.0, 32)
        return cs.extrude(t).translate([cx, cy, z0])
    slabs = [slab(0, cb, h - ct - cb)]
    if cb: slabs.append(slab(cb, 0, 0.01))
    if ct: slabs.append(slab(ct, h - 0.01, 0.01))
    return Manifold.batch_hull(slabs).translate([0, 0, z])


def pocket_outline(h, z, grow=0.0):
    return rbox_prism(IN + 2 * grow, IN + 2 * grow, CORNER_R - WALL + grow, h, z=z)


def housing():
    solid = rbox_prism(W, W, CORNER_R, TOP - BOTTOM, z=BOTTOM, ct=1.5, cb=0.6)
    cone = BORE_R - m.BEZEL_BORE_R
    cavity = revolve([
        (0, PLATFORM_Z - 1), (BORE_R, PLATFORM_Z - 1), (BORE_R, m.SEAT_Z), (m.BEZEL_BORE_R, m.SEAT_Z + cone),
        (m.BEZEL_BORE_R, TOP - 0.6), (m.BEZEL_BORE_R + 1.6, TOP + 1), (0, TOP + 1)])
    solid -= cavity
    solid -= pocket_outline(COMP_H + PLATFORM_T + 1, BOTTOM - 1 + LID_T)          # the pocket, open to the bottom
    solid -= pocket_outline(LID_T + 1, BOTTOM - 1, grow=0.5)                        # the lid's rebate
    tabs = union(cyl(TAB_D, TAB_H, sx * C, sy * C, LID_Z, seg=32) for sx, sy in TAB_CORNERS)
    tabs ^= pocket_outline(TAB_H + 2, LID_Z - 1)
    solid += tabs
    cuts = [cyl(m.TAP_D, TAB_H + 2, sx * C, sy * C, LID_Z - 1, seg=24) for sx, sy in TAB_CORNERS]
    port_z = LID_Z + m.RIDER_USB_Z
    cuts.append(cbox(RIDER_CX, W / 2, port_z - PORT[1] / 2, PORT[0], 2 * WALL + 4, PORT[1]))
    return solid - union(cuts)


def platform():
    s = IN - 2 * PLATFORM_CLEAR
    solid = rbox_prism(s, s, CORNER_R - WALL - PLATFORM_CLEAR, PLATFORM_T, z=PLATFORM_Z - PLATFORM_T)
    h0 = m.COLLAR_H
    m.COLLAR_H = h0 + COLLAR_RAISE          # collar() reads it
    solid += m.collar()
    m.COLLAR_H = h0
    fence = cbox(0, 0, 0, m.ATOM[0] + 2 * CLR + 3, m.ATOM[1] + 2 * CLR + 3, 2.5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 2 * CLR, m.ATOM[1] + 2 * CLR, 5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 20, 14, 5)
    solid += fence
    cuts = []
    for a in (SPRING_ANGLES if SPRINGS else ()):
        cuts.append(box(m.SPRING_R0 - 0.3, -m.SPRING_D / 2 - 0.3, -1.2, m.SPRING_W + 0.6, m.SPRING_D + 0.6, 1.21).rotate([0, 0, a]))
    x0, y0, sx, sy = CABLE_HOLE
    cuts.append(box(x0, y0, -PLATFORM_T - 1, sx, sy, PLATFORM_T + 2))
    cuts += [cyl(2 * NOTCH_R, PLATFORM_T + 2, sx * C, sy * C, -PLATFORM_T - 1, seg=32) for sx, sy in TAB_CORNERS]
    return solid - union(cuts)


def lid():
    solid = rbox_prism(IN + 1.0 - 0.4, IN + 1.0 - 0.4, CORNER_R - WALL + 0.3, LID_T, z=BOTTOM, cb=0.6)
    z, h = LID_Z, FENCE_H
    cx1 = CELL_X0 + m.CELL[0] + CLR                # 1.5: the cell's clearance ends, the fence starts
    ylo, yhi = CELL_Y0 - CLR, CELL_Y0 + m.CELL[1] + CLR     # -25.5, 25.5
    f = []
    f.append(box(-25, yhi, z, cx1 + 25, FENCE_T, h))                                       # +y side of the cell (stops short of the tab)
    f.append(box(-25, ylo - FENCE_T, z, cx1 + 25, FENCE_T, h))                            # -y side
    f.append(box(cx1, ylo - FENCE_T, z, FENCE_T, yhi - ylo + 2 * FENCE_T, h))              # between the cell and the Rider
    rx0, rx1 = RIDER_X0 - CLR, RIDER_X0 + RIDER_FOOT[0] + CLR                              # 3.6, 29.6
    ry0 = RIDER_Y0 - CLR                                                                    # -8.5
    px0, px1 = RIDER_CX - PLUG[0] / 2 - 1, RIDER_CX + PLUG[0] / 2 + 1                      # leave the plug's width open
    f.append(box(rx0, ry0 - FENCE_T, z, px0 - rx0, FENCE_T, h))                            # the Rider's -y stop, either side of the plug
    f.append(box(px1, ry0 - FENCE_T, z, rx1 - px1, FENCE_T, h))
    f.append(box(rx1, ry0 - FENCE_T, z, FENCE_T, IN / 2 - ry0 + FENCE_T - 0.3, h))         # its +x side
    solid += union(f)
    cuts = [cyl(m.M3_CLEAR_D, LID_T + 2, sx * C, sy * C, BOTTOM - 1, seg=24) for sx, sy in TAB_CORNERS]
    cuts += [cyl(m.M3_HEAD_D, 1.6, sx * C, sy * C, BOTTOM - 0.01, seg=32) for sx, sy in TAB_CORNERS]
    cuts += [cyl(FOOT_D, 0.8, sx * C, sy * C, BOTTOM - 0.01) for sx, sy in ALL_CORNERS]
    return solid - union(cuts)


def bought(pressed=False):
    parts = {k: v for k, v in m.bought_parts(pressed).items() if k in ('atom', 'hex')}
    parts['atom'] = parts['atom'].rotate([0, 0, 180])      # turned round: USB-C toward +x, the hex's Grove toward -x
    parts['cell'] = box(CELL_X0, CELL_Y0, LID_Z, *m.CELL)
    rider = box(RIDER_X0, RIDER_Y0, LID_Z, RIDER_FOOT[0], RIDER_FOOT[1], m.RIDER[2])
    rider += cbox(RIDER_CX, RIDER_Y0 - PLUG[1] / 2, LID_Z + 1, PLUG[0], PLUG[1], PLUG[2])   # the USB-A plug out of its -y end
    parts['rider'] = rider
    return parts


def printed_parts():
    parts = {'housing': housing(), 'platform': platform(), 'lid': lid(), 'cap': m.cap(), 'cage': m.cage(), 'nub': m.nub(PEG_H)}
    if SPRINGS:
        parts['spring'] = m.spring(m.SPRING_FREE)
    return parts


def check_and_write(printed, flipped, out_dir, label):
    os.makedirs(out_dir, exist_ok=True)
    for name, solid in printed.items():
        out = m.for_printing(solid, name in flipped)
        m.write_stl(out, os.path.join(out_dir, f'{name}.stl'))
        bb = out.bounding_box()
        print(f'  {name:9s} {bb[3] - bb[0]:6.1f} x {bb[4] - bb[1]:5.1f} x {bb[5] - bb[2]:5.1f} mm  {out.volume() / 1000:6.1f} cm3  genus {out.genus()}')
    clashes = 0
    sprung = 'spring' in printed
    for pressed in (False, True):
        state = {**printed, **bought(pressed)}
        if sprung:
            del state['spring']
            state['springs'] = m.springs_in_place((m.FLANGE_BOTTOM - 1.2 if not pressed else m.WALL_TOP - 1.2) - 0.05)
            drop = m.TRAVEL if pressed else 0.0
        else:
            # resting on the switch, a little below the lip; pressed, the switch's own travel and what the flexures give
            drop = REST_PLAY + (PRESS if pressed else 0.0)
            state['hex'] = bought(False)['hex']          # the hex rides in the cap: it moves as the cap does, below
        if drop:
            for k in ('cap', 'cage', 'nub') + (() if sprung else ('hex',)):
                state[k] = state[k].translate([0, 0, -drop])
        names = list(state)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                overlap = (state[a] ^ state[b]).volume()
                if overlap > 0.5:
                    clashes += 1
                    print(f'  CLASH {"pressed" if pressed else "at rest"}: {a} / {b}  {overlap:.1f} mm3')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')
    colours = {'housing': '#3a3a40', 'platform': '#55555c', 'lid': '#2a2a2e', 'cage': '#8a8a92', 'nub': '#e07b39', 'cap': '#ffffff', 'springs': '#c9a227',
               'hex': '#2e7d32', 'atom': '#1a3a6e', 'cell': '#8a8a55', 'rider': '#1b5e20'}
    everything = {k: v for k, v in printed.items() if k != 'spring'}
    everything.update(bought())
    if sprung: everything['springs'] = m.springs_in_place(m.FLANGE_BOTTOM - 1.25)
    m.section_svg(everything, colours, os.path.join(HERE, f'section-{label}-front.svg'), 'xz')
    m.section_svg(everything, colours, os.path.join(HERE, f'section-{label}-side.svg'), 'yz')


if __name__ == '__main__':
    print(f'v2 box: {W:.0f} x {W:.0f} mm, {m.CAP_TOP - BOTTOM:.1f} mm tall to the cap, housing {TOP - BOTTOM:.1f} mm, port on +y')
    check_and_write(printed_parts(), {'housing', 'cap'}, os.path.join(HERE, OUT), OUT)
    if not SPRINGS:
        # pegs to choose from: the shortest that clicks cleanly without the cap rattling is the one
        for h in (3.0, 3.5, 4.0):
            m.write_stl(m.for_printing(m.nub(h), False), os.path.join(HERE, OUT, f'nub-{h:.1f}.stl'))
        stale = os.path.join(HERE, OUT, 'spring.stl')
        if os.path.exists(stale): os.remove(stale)
