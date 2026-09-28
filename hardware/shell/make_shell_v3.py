"""
v3, the one-layer pod: nothing under the Atom. The cap sits at one end of a low 72 x 98 housing and the cell
and the Rider lie in a tail behind it, under the same flat roof the cap's lip is in, so the whole thing is
20 mm lower than v1. Two printed parts round the same cap, cage, peg and springs: the housing and the lid,
which is also the floor everything stands on (the Atom's fence, the collar, the spring pockets, the cell's
fences), so a press goes Atom -> lid -> table with nothing in between.

  housing   72 wide (x), 98 long (y), rounded corners, 23.5 mm tall. The cap's bore at the -y end, the tail
            pocket behind it, one window in the +x wall for the Rider's USB-C. Four screw tabs. Prints upside down.
  lid       the floor: collar, Atom fence, three spring pockets (0, 180, 270 degrees: the tail is where the
            third one used to be), fences round the cell. Four countersunk screws, four feet.
  cap, cage, nub, spring   as make_shell_mini.py, unchanged.

  .venv/bin/python make_shell_v3.py    ->  stl-v3/

In the tail: the cell across it (50 along x), its lead out of the +y end; the Rider on top of the cell along x,
USB-C at the +x wall (the port), USB-A at its -x end. The Atom's USB-C faces -x as before; the cable runs +y
along the channel beside the cell, rises, and enters the Rider's USB-A from the -x side.

Assembly (housing upside down): cage with hex and peg into the cap; cap into the housing, flange up; three
springs on the flange; lid: Atom in its fence with the hex cable in, cell into its fences, Rider on the cell
with its USB-C at the window, cable from its USB-A round to the Atom; lid on, four screws, four feet.
"""
import importlib.util
import math
import os
import sys

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
cyl, box, cbox, union, revolve, rbox_prism = m.cyl, m.box, m.cbox, m.union, m.revolve, v2.rbox_prism

OUT = 'stl-v3'
SPRING_ANGLES = (0, 180, 270)       # none toward the tail
m.SPRING_ANGLES = SPRING_ANGLES     # springs_in_place() reads it

# ── the housing ─────────────────────────────────────────────────────────────
W = 72.0                            # across, x
WALL = 2.5
CORNER_R = 6.0
IN_X = W - 2 * WALL                 # 67
BORE_R = m.BORE_R                   # 33
LID_T = 2.5
TOP = m.BEZEL_TOP                   # 21
FLOOR_Z = 0.0                       # top of the lid, where the Atom stands
BOTTOM = FLOOR_Z - LID_T
CLR = m.PART_CLEARANCE
FENCE_T = 1.6
CELL_X0 = -m.CELL[1] / 2                                   # the cell turned: 50 along x, 34 along y
CELL_Y0 = m.COLLAR_R + 1.0                                 # 24.5: past the collar
CELL_FOOT = (m.CELL[1], m.CELL[0])
IN_Y1 = CELL_Y0 + CELL_FOOT[1] + CLR                       # 59: the inside of the +y wall
D = IN_Y1 + WALL + (BORE_R + CLR + WALL)                   # 97.5 long
CY = (IN_Y1 - (BORE_R + CLR)) / 2                          # the housing's centre in y
IN_Y = IN_Y1 + BORE_R + CLR                                # inside length
RIDER_Z = FLOOR_Z + m.CELL[2] + m.LAYER_GAP                # on the cell
RIDER_X0 = IN_X / 2 - CLR - m.RIDER[0]                     # -8: USB-C end 0.5 from the +x wall
RIDER_Y0 = max(CELL_Y0 + (CELL_FOOT[1] - m.RIDER[1]) / 2, m.FLANGE_R + CLR + 0.4)   # on the cell, but clear of the cap's flange
RIDER_CY = RIDER_Y0 + m.RIDER[1] / 2
TAIL_H = RIDER_Z + m.RIDER[2] + CLR                        # 18.9: the tail pocket's ceiling; 2.1 of roof under the lip
PLUG = (15.0, 12.0, 7.0)                                   # the USB-A plug body out of the Rider's -x end
TABS = ((-30.0, -30.0), (30.0, -30.0), (-30.0, IN_Y1 - 3.5), (30.0, IN_Y1 - 3.5))
TAB_D, TAB_H = 8.0, 6.0
PORT = (13.0, 8.0)
FOOT_D = 10.5


def pocket_outline(h, z, grow=0.0):
    return rbox_prism(IN_X + 2 * grow, IN_Y + 2 * grow, CORNER_R - WALL + grow, h, z=z, cy=CY)


def housing():
    solid = rbox_prism(W, D, CORNER_R, TOP - BOTTOM, z=BOTTOM, ct=1.5, cb=0.6, cy=CY)
    cone = BORE_R - m.BEZEL_BORE_R
    cavity = revolve([
        (0, FLOOR_Z - 1), (BORE_R, FLOOR_Z - 1), (BORE_R, m.SEAT_Z), (m.BEZEL_BORE_R, m.SEAT_Z + cone),
        (m.BEZEL_BORE_R, TOP - 0.6), (m.BEZEL_BORE_R + 1.6, TOP + 1), (0, TOP + 1)])
    solid -= cavity
    # the tail pocket, joined to the bore, under a flat roof
    tail = rbox_prism(IN_X, IN_Y1 - 20, CORNER_R - WALL, TAIL_H + 1, z=FLOOR_Z - 1, cy=(IN_Y1 + 20) / 2)
    solid -= tail
    solid -= pocket_outline(LID_T + 1, BOTTOM - 1, grow=0.5)       # the lid's rebate
    tabs = union(cyl(TAB_D, TAB_H, x, y, FLOOR_Z, seg=32) for x, y in TABS)
    tabs ^= pocket_outline(TAB_H + 2, FLOOR_Z - 1)
    solid += tabs
    cuts = [cyl(m.TAP_D, TAB_H + 2, x, y, FLOOR_Z - 1, seg=24) for x, y in TABS]
    port_z = RIDER_Z + m.RIDER_USB_Z
    cuts.append(cbox(W / 2, RIDER_CY, port_z - PORT[1] / 2, 2 * WALL + 4, PORT[0], PORT[1]))
    return solid - union(cuts)


def lid():
    solid = rbox_prism(IN_X + 1.0 - 0.4, IN_Y + 1.0 - 0.4, CORNER_R - WALL + 0.3, LID_T, z=BOTTOM, cb=0.6, cy=CY)
    solid += m.collar()
    fence = cbox(0, 0, 0, m.ATOM[0] + 2 * CLR + 3, m.ATOM[1] + 2 * CLR + 3, 2.5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 2 * CLR, m.ATOM[1] + 2 * CLR, 5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 20, 14, 5)
    solid += fence
    # the cell's fences: two stubs on its -y side (clear of the collar), a wall each side; the +y wall is the housing
    h = 6.0
    x0, x1 = CELL_X0 - CLR, CELL_X0 + CELL_FOOT[0] + CLR              # -25.5, 25.5
    y0 = CELL_Y0 - CLR                                                 # 24
    f = [box(x0, y0 - FENCE_T, 0, 11, FENCE_T, h), box(x1 - 11, y0 - FENCE_T, 0, 11, FENCE_T, h),
         box(x0 - FENCE_T, y0 - FENCE_T, 0, FENCE_T, TABS[2][1] - 4.5 - y0 + FENCE_T, h), box(x1, y0 - FENCE_T, 0, FENCE_T, TABS[2][1] - 4.5 - y0 + FENCE_T, h)]   # the side walls stop short of the tabs
    solid += union(f)
    cuts = []
    for a in SPRING_ANGLES:
        cuts.append(box(m.SPRING_R0 - 0.3, -m.SPRING_D / 2 - 0.3, -1.2, m.SPRING_W + 0.6, m.SPRING_D + 0.6, 1.21).rotate([0, 0, a]))
    cuts += [cyl(m.M3_CLEAR_D, LID_T + 2, x, y, BOTTOM - 1, seg=24) for x, y in TABS]
    cuts += [cyl(m.M3_HEAD_D, 1.6, x, y, BOTTOM - 0.01, seg=32) for x, y in TABS]
    cuts += [cyl(FOOT_D, 0.8, x, y, BOTTOM - 0.01) for x, y in TABS]
    return solid - union(cuts)


def bought(pressed=False):
    parts = {k: v for k, v in m.bought_parts(pressed).items() if k in ('atom', 'hex')}
    parts['cell'] = box(CELL_X0, CELL_Y0, FLOOR_Z, CELL_FOOT[0], CELL_FOOT[1], m.CELL[2])
    rider = box(RIDER_X0, RIDER_Y0, RIDER_Z, *m.RIDER)
    rider += cbox(RIDER_X0 - PLUG[0] / 2, RIDER_CY, RIDER_Z + 1, PLUG[0], PLUG[1], PLUG[2])
    parts['rider'] = rider
    return parts


v2.bought = bought      # check_and_write() uses the module's bought()


def printed_parts():
    return {'housing': housing(), 'lid': lid(), 'cap': m.cap(), 'cage': m.cage(), 'nub': m.nub(), 'spring': m.spring(m.SPRING_FREE)}


if __name__ == '__main__':
    print(f'v3 pod: {W:.0f} x {D:.1f} mm, {m.CAP_TOP - BOTTOM:.1f} mm tall to the cap, housing {TOP - BOTTOM:.1f} mm, port on +x')
    v2.check_and_write(printed_parts(), {'housing', 'cap'}, os.path.join(HERE, OUT), OUT)
