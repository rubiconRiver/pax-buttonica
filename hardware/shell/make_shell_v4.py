"""
v4, the slim one: the v2 box with everything pulled in as far as the bought parts allow. 64 mm square
instead of 72 (about 20 % less table), 58 mm tall instead of 50, a 49 mm cap instead of 56.

What sets the size, with these parts:
  the cap     the NeoHEX is 36 mm across its corners; a sleeve, a collar and the cap's wall round that is 49 mm.
              Flange, springs, clearance and wall add 7.5 mm a side: 64.
  the Rider   41 mm long with a USB-A plug out of one end and its USB-C at the wall. A straight plug needs about
              20 mm more in the same line, which is more than a 59 mm pocket has. THIS BUILD NEEDS A RIGHT-ANGLE
              USB-A PLUG (about 8 mm); with straight cables, v2 is the smallest box.
  the cell    34 x 50 x 9.6, flat on the lid; the Rider lies on top of it (the stack v1 had), so the box is taller.

Same press as the mini: springs under the flange, sleeve in collar, peg on the Atom's face. The mechanics are
make_shell_mini.py's, rebuilt with a smaller cap; nothing about the guide or the travel changes.

  .venv/bin/python make_shell_v4.py    ->  stl-v4/

Inside: the Atom on the platform with its USB-C toward -y; the power cable drops through the platform just
past its plug. On the lid, the cell between two full-height fences that carry the platform; the Rider on the
cell, along y, USB-C at the +y wall (the port), the right-angle USB-A plug at its -y end, cable straight up.

NOT YET PRINTED. Three guesses to measure first: the right-angle plug, the USB-C plug's length out of the Atom
(17 mm is all the bore leaves), and everything marked MEASURE in make_shell_mini.py.
"""
import math
import os
import re
import sys
import types

from manifold3d import CrossSection, JoinType, Manifold

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = 'stl-v4'

# ── the mini's mechanics, rebuilt smaller ───────────────────────────────────
# The mini works everything out from a few numbers at the top of its file; these replace them.
SMALLER = {
    'CAP_D': '49.0',                 # was 56
    'SLEEVE_R': '19.0',              # was 20: just outside the hex's corners (17.9) and the cage's legs (18.3)
    'SLEEVE_T': '1.4',               # was 1.6
    'COLLAR_T': '1.4',               # was 1.6
    'CAGE_LEG': '(5.0, 2.2)',        # was (5.0, 3.0): thinner legs, so the cage fits inside the smaller sleeve
    'BORE_R': '29.3',                # was 33
    'COLLAR_GAPS': '((68, 112), (248, 292))',    # the Atom is turned: USB-C toward -y, Grove toward +y
    'SPRING_ANGLES': '(30, 150, 210)',           # clear of both plugs and of the cable's hole at 270
}


def load_mini():
    src = open(os.path.join(HERE, 'make_shell_mini.py')).read()
    for name, value in SMALLER.items():
        src, n = re.subn(rf'^{name} = [^#\n]*', f'{name} = {value}  ', src, count=1, flags=re.M)
        assert n == 1, name
    mod = types.ModuleType('mini_small')
    mod.__file__ = os.path.join(HERE, 'make_shell_mini.py')
    argv, sys.argv = sys.argv, ['x']
    exec(compile(src, mod.__file__, 'exec'), mod.__dict__)
    sys.argv = argv
    return mod


m = load_mini()
cyl, box, cbox, union, revolve = m.cyl, m.box, m.cbox, m.union, m.revolve

# ── the housing ─────────────────────────────────────────────────────────────
WALL = 2.2
IN = 2 * m.BORE_R + 0.6             # 59.2 inside
W = IN + 2 * WALL                   # 63.6 outside
CORNER_R = 6.0
PLATFORM_T = m.FLOOR_T
PLATFORM_CLEAR = 0.3
CLR = m.PART_CLEARANCE
COMP_H = m.CELL[2] + m.LAYER_GAP + m.RIDER[2] + CLR      # 18.9: the cell, and the Rider on it
LID_T = 2.5
TOP = m.BEZEL_TOP
PLATFORM_Z = 0.0
LID_Z = PLATFORM_Z - PLATFORM_T - COMP_H
BOTTOM = LID_Z - LID_T
C = IN / 2 - 3.6                    # the corners' centres: tabs, screws, feet
CORNERS = ((-1, 1), (-1, -1), (1, -1), (1, 1))
TAB_D, TAB_H = 8.0, 6.0
NOTCH_R = 5.0
PORT = (13.0, 8.0)
FOOT_D = 10.5
FENCE_T = 1.6
FENCE_H = COMP_H - 0.3
RIDER_FOOT = (m.RIDER[1], m.RIDER[0])                      # turned: 25 along x, 41 along y
RIDER_Z = LID_Z + m.CELL[2] + m.LAYER_GAP
RIDER_Y0 = IN / 2 - CLR - RIDER_FOOT[1]                    # its USB-C end 0.5 from the +y wall
PLUG = (14.0, 8.0, 7.0)                                    # a RIGHT-ANGLE USB-A plug out of the Rider's -y end    MEASURE
CABLE_HOLE = (-7.0, -33.0, 14.0, 9.5)                      # a SLOT open to the platform's -y edge: the cable has a plug on each end and slips in from the side


def rbox_prism(w, d, r, h, z=0.0, ct=0.0, cb=0.0):
    def slab(c, z0, t):
        rr = max(r - c, 0.2)
        return CrossSection.square([w - 2 * c - 2 * rr, d - 2 * c - 2 * rr], True).offset(rr, JoinType.Round, 2.0, 32).extrude(t).translate([0, 0, z0])
    slabs = [slab(0, cb, h - ct - cb)]
    if cb: slabs.append(slab(cb, 0, 0.01))
    if ct: slabs.append(slab(ct, h - 0.01, 0.01))
    return Manifold.batch_hull(slabs).translate([0, 0, z])


def pocket(h, z, grow=0.0):
    return rbox_prism(IN + 2 * grow, IN + 2 * grow, CORNER_R - WALL + grow, h, z=z)


def housing():
    solid = rbox_prism(W, W, CORNER_R, TOP - BOTTOM, z=BOTTOM, ct=1.5, cb=0.6)
    cone = m.BORE_R - m.BEZEL_BORE_R
    solid -= revolve([
        (0, PLATFORM_Z - 1), (m.BORE_R, PLATFORM_Z - 1), (m.BORE_R, m.SEAT_Z), (m.BEZEL_BORE_R, m.SEAT_Z + cone),
        (m.BEZEL_BORE_R, TOP - 0.6), (m.BEZEL_BORE_R + 1.6, TOP + 1), (0, TOP + 1)])
    solid -= pocket(COMP_H + PLATFORM_T + 1, BOTTOM - 1 + LID_T)
    solid -= pocket(LID_T + 1, BOTTOM - 1, grow=0.5)
    tabs = union(cyl(TAB_D, TAB_H, sx * C, sy * C, LID_Z, seg=32) for sx, sy in CORNERS)
    tabs ^= pocket(TAB_H + 2, LID_Z - 1)
    solid += tabs
    cuts = [cyl(m.TAP_D, TAB_H + 2, sx * C, sy * C, LID_Z - 1, seg=24) for sx, sy in CORNERS]
    cuts.append(cbox(0, W / 2, RIDER_Z + m.RIDER_USB_Z - PORT[1] / 2, PORT[0], 2 * WALL + 4, PORT[1]))
    return solid - union(cuts)


def platform():
    s = IN - 2 * PLATFORM_CLEAR
    solid = rbox_prism(s, s, CORNER_R - WALL - PLATFORM_CLEAR, PLATFORM_T, z=PLATFORM_Z - PLATFORM_T)
    solid += m.collar()
    fence = cbox(0, 0, 0, m.ATOM[0] + 2 * CLR + 3, m.ATOM[1] + 2 * CLR + 3, 2.5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 2 * CLR, m.ATOM[1] + 2 * CLR, 5)
    fence -= cbox(0, 0, -1, 14, m.ATOM[1] + 20, 5)             # open toward -y and +y, where the plugs are
    solid += fence
    cuts = [box(m.SPRING_R0 - 0.3, -m.SPRING_D / 2 - 0.3, -1.2, m.SPRING_W + 0.6, m.SPRING_D + 0.6, 1.21).rotate([0, 0, a]) for a in m.SPRING_ANGLES]
    x0, y0, sx, sy = CABLE_HOLE
    cuts.append(box(x0, y0, -PLATFORM_T - 1, sx, sy, PLATFORM_T + 2))
    cuts += [cyl(2 * NOTCH_R, PLATFORM_T + 2, sx * C, sy * C, -PLATFORM_T - 1, seg=32) for sx, sy in CORNERS]
    return solid - union(cuts)


def lid():
    solid = rbox_prism(IN + 1.0 - 0.4, IN + 1.0 - 0.4, CORNER_R - WALL + 0.3, LID_T, z=BOTTOM, cb=0.6)
    hx = m.CELL[0] / 2 + CLR                        # 17.5: the cell's clearance ends here
    hy = m.CELL[1] / 2 + CLR                        # 25.5
    f = [box(sx * hx if sx > 0 else -hx - FENCE_T, -hy, LID_Z, FENCE_T, 2 * hy, FENCE_H) for sx in (-1, 1)]   # full height, each side: they carry the platform
    f += [box(-hx - FENCE_T, -hy - FENCE_T, LID_Z, 9, FENCE_T, FENCE_H), box(hx + FENCE_T - 9, -hy - FENCE_T, LID_Z, 9, FENCE_T, FENCE_H)]   # returns at the -y end, clear of the plug
    f += [box(-hx - FENCE_T, hy, LID_Z, 2 * hx + 2 * FENCE_T, FENCE_T, m.CELL[2] - 0.5)]      # a low stop at the +y end, under the Rider
    solid += union(f)
    cuts = [cyl(m.M3_CLEAR_D, LID_T + 2, sx * C, sy * C, BOTTOM - 1, seg=24) for sx, sy in CORNERS]
    cuts += [cyl(m.M3_HEAD_D, 1.6, sx * C, sy * C, BOTTOM - 0.01, seg=32) for sx, sy in CORNERS]
    cuts += [cyl(FOOT_D, 0.8, sx * C, sy * C, BOTTOM - 0.01) for sx, sy in CORNERS]
    return solid - union(cuts)


def bought(pressed=False):
    parts = {k: v for k, v in m.bought_parts(pressed).items() if k in ('atom', 'hex')}
    parts['atom'] = parts['atom'].rotate([0, 0, 90])      # its USB-C plug (drawn toward -x) now points -y
    parts['cell'] = cbox(0, 0, LID_Z, *m.CELL)
    rider = box(-RIDER_FOOT[0] / 2, RIDER_Y0, RIDER_Z, RIDER_FOOT[0], RIDER_FOOT[1], m.RIDER[2])
    rider += cbox(0, RIDER_Y0 - PLUG[1] / 2, RIDER_Z + 0.5, PLUG[0], PLUG[1], PLUG[2])
    parts['rider'] = rider
    return parts


def printed_parts():
    return {'housing': housing(), 'platform': platform(), 'lid': lid(), 'cap': m.cap(), 'cage': m.cage(), 'nub': m.nub(), 'spring': m.spring(m.SPRING_FREE)}


if __name__ == '__main__':
    printed = printed_parts()
    flipped = {'housing', 'cap'}
    os.makedirs(os.path.join(HERE, OUT), exist_ok=True)
    print(f'v4 slim: {W:.1f} x {W:.1f} mm, {m.CAP_TOP - BOTTOM:.1f} mm tall to the cap, housing {TOP - BOTTOM:.1f} mm, cap {m.CAP_D:.0f} mm, port on +y')
    for name, solid in printed.items():
        out = m.for_printing(solid, name in flipped)
        m.write_stl(out, os.path.join(HERE, OUT, f'{name}.stl'))
        bb = out.bounding_box()
        print(f'  {name:9s} {bb[3] - bb[0]:6.1f} x {bb[4] - bb[1]:5.1f} x {bb[5] - bb[2]:5.1f} mm  {out.volume() / 1000:6.1f} cm3  genus {out.genus()}')
    clashes = 0
    for pressed in (False, True):
        state = {**printed, **bought(pressed)}
        del state['spring']
        state['springs'] = m.springs_in_place((m.FLANGE_BOTTOM - 1.2 if not pressed else m.WALL_TOP - 1.2) - 0.05)
        if pressed:
            for k in ('cap', 'cage', 'nub'):
                state[k] = state[k].translate([0, 0, -m.TRAVEL])
        names = list(state)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                overlap = (state[a] ^ state[b]).volume()
                if overlap > 0.5:
                    clashes += 1
                    print(f'  CLASH {"pressed" if pressed else "at rest"}: {a} / {b}  {overlap:.1f} mm3')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')
