"""
The seamless mini, v1: one plain hexagonal housing from the table to the top, nothing on the outside but the
cap and one port hole. Everything loads from the bottom and a lid closes it; the lid's three screws hide
under the rubber feet.

  housing   hex, 76 mm across the flats. Its top edge is the cap's retaining lip (the old bezel); inside,
            a round bore above the platform and a wider hex pocket below it. One window in the +x wall for
            the Rider's USB-C (or the laptop's cable on the USB build). Prints upside down: the top face is
            the bed's finish, the lip's cone widens upward, the pocket steps outward.
  platform  the old body's floor as a loose disc: the Atom's fence, the collar the cap slides on, the spring
            pockets, a hole for the power cable. Three notches at the corners pass the housing's screw tabs
            and stop it turning. It rests on the lid's three columns, so a slap goes cap -> platform ->
            columns -> lid -> feet -> table, and never through a screw.
  lid       flat hex plate: three columns up to the platform, low fences for the cell and the Rider, three
            countersunk screw holes at the other corners, feet over them.
  cap, cage, nub, spring   as make_shell_mini.py; the cap goes in from below, flange up, before the platform.

  .venv/bin/python make_shell_v1.py                 the USB build (no cell or Rider), stl-v1/
  PAX_BATTERY=1 .venv/bin/python make_shell_v1.py   the battery build, stl-v1-battery/

Assembly (housing upside down on the bench): cage with hex and peg into the cap; cap into the housing,
flange up; three springs standing on the flange in the platform's pockets; Atom into the platform's fence
with the hex cable plugged in; platform down onto the springs, notches over the tabs; Rider and cell onto
the lid's fences, the Rider's cable up through the platform's hole into the Atom; lid on, three screws,
three feet. Turn it over.
"""
import importlib.util
import math
import os
import sys

from manifold3d import CrossSection, Manifold

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('mini', os.path.join(HERE, 'make_shell_mini.py'))
m = importlib.util.module_from_spec(spec)
_argv, sys.argv = sys.argv, ['x']
spec.loader.exec_module(m)
sys.argv = _argv

BATTERY = os.environ.get('PAX_BATTERY', '0') == '1'
OUT = 'stl-v1-battery' if BATTERY else 'stl-v1'

# ── the housing ─────────────────────────────────────────────────────────────
F = m.TURRET_F                      # 76 across the flats
BORE_R = m.BORE_R                   # 33: the round bore the cap and springs live in, above the platform
POCKET_F = F - 2 * m.DECK_WALL      # 71 across the flats: the pocket below the platform
POCKET_APEX = POCKET_F / 2 / math.cos(math.radians(30))
PLATFORM_T = m.FLOOR_T              # 1.6
PLATFORM_R = BORE_R + 0.5           # a hair wider than the bore, so it can't rise into it; it passes the pocket
COMP_H = m.DECK_POCKET_H            # the compartment under the platform: cell, Rider, air
LID_T = 2.5
TOP = m.BEZEL_TOP                   # the housing's top edge, where the old bezel's top was
PLATFORM_Z = 0.0                    # top of the platform, the old floor level
LID_Z = PLATFORM_Z - PLATFORM_T - COMP_H      # top of the lid
BOTTOM = LID_Z - LID_T                        # the table
COLUMN_ANGLES = (30, 150, 270)      # the lid's columns
TAB_ANGLES = (90, 210, 330)         # the housing's screw tabs
CORNER_R = 36.0                     # both sit here, inside the pocket's corners
COLUMN_D = 8.0
TAB_D = 8.0
TAB_H = 6.0
NOTCH_R = 5.0                       # the platform's corner notches, round the tabs with room
PORT = (13.0, 8.0)                  # the window for a USB-C plug body
FOOT_D = 10.5
cyl, box, cbox, union, revolve, hex_prism, corners = m.cyl, m.box, m.cbox, m.union, m.revolve, m.hex_prism, m.corners


def at(r, a):
    return (r * math.cos(math.radians(a)), r * math.sin(math.radians(a)))


def housing():
    solid = hex_prism(F, TOP - BOTTOM, z=BOTTOM, ct=1.5, cb=0.6)
    # the cap's cavity: the old bezel's profile, on a bore as wide as the chamber
    cone = BORE_R - m.BEZEL_BORE_R
    cavity = revolve([
        (0, PLATFORM_Z - 1), (BORE_R, PLATFORM_Z - 1), (BORE_R, m.SEAT_Z), (m.BEZEL_BORE_R, m.SEAT_Z + cone),
        (m.BEZEL_BORE_R, TOP - 0.6), (m.BEZEL_BORE_R + 1.6, TOP + 1), (0, TOP + 1)])
    solid -= cavity
    # the pocket below the platform, open to the bottom
    solid -= hex_prism(POCKET_F, COMP_H + PLATFORM_T + 1, z=BOTTOM - 1 + LID_T)
    # the lid sits in a rebate so the outside is one surface
    solid -= hex_prism(POCKET_F + 1.0, LID_T + 1, z=BOTTOM - 1)
    # screw tabs at three corners, just above the lid, tapped from below
    tabs = union(cyl(TAB_D, TAB_H, *at(CORNER_R, a), LID_Z, seg=32) for a in TAB_ANGLES)
    tabs ^= hex_prism(POCKET_F, TAB_H + 2, z=LID_Z - 1)
    solid += tabs
    cuts = [cyl(m.TAP_D, TAB_H + 2, *at(CORNER_R, a), LID_Z - 1, seg=24) for a in TAB_ANGLES]
    # the port: a window through the +x wall at the Rider's USB-C, which is also where the laptop cable comes in
    port_z = m.RIDER_Z - m.DECK_Z0 + LID_Z + m.RIDER_USB_Z          # the Rider sits on the lid as it sat on the deck
    cuts.append(cbox(F / 2, 0, port_z - PORT[1] / 2, 2 * (F / 2 - POCKET_F / 2) + 4, PORT[0], PORT[1]))
    return solid - union(cuts)


def platform():
    solid = cyl(2 * PLATFORM_R, PLATFORM_T, z=PLATFORM_Z - PLATFORM_T, seg=m.SEG)
    collar = cyl(2 * m.COLLAR_R, m.COLLAR_H, seg=m.SEG) - cyl(2 * (m.COLLAR_R - m.COLLAR_T), m.COLLAR_H + 2, z=-1, seg=m.SEG)
    for a0, a1 in m.COLLAR_GAPS:
        wedge = CrossSection([[(0, 0)] + [(60 * math.cos(math.radians(a)), 60 * math.sin(math.radians(a))) for a in range(a0, a1 + 1)]]).extrude(m.COLLAR_H + 2).translate([0, 0, -1])
        collar -= wedge
    solid += collar
    fence = cbox(0, 0, 0, m.ATOM[0] + 2 * m.PART_CLEARANCE + 3, m.ATOM[1] + 2 * m.PART_CLEARANCE + 3, 2.5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 2 * m.PART_CLEARANCE, m.ATOM[1] + 2 * m.PART_CLEARANCE, 5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 20, 14, 5)
    solid += fence
    cuts = []
    for a in m.SPRING_ANGLES:
        cuts.append(box(m.SPRING_R0 - 0.3, -m.SPRING_D / 2 - 0.3, -1.2, m.SPRING_W + 0.6, m.SPRING_D + 0.6, 1.21).rotate([0, 0, a]))
    # the power cable comes up beside the Atom's USB-C
    cuts.append(cbox(-m.ATOM[0] / 2 - 15, 0, -PLATFORM_T - 1, 8, 10, PLATFORM_T + 2))
    # notches round the housing's screw tabs
    cuts += [cyl(2 * NOTCH_R, PLATFORM_T + 2, *at(CORNER_R, a), -PLATFORM_T - 1, seg=32) for a in TAB_ANGLES]
    return solid - union(cuts)


def lid():
    solid = hex_prism(POCKET_F + 1.0 - 0.4, LID_T, z=BOTTOM, cb=0.6)
    col_h = LID_Z - BOTTOM + COMP_H  # from the lid's underside level up to the platform's underside
    solid += union(cyl(COLUMN_D, COMP_H, *at(CORNER_R, a), LID_Z, seg=32) for a in COLUMN_ANGLES)
    if BATTERY:
        # low fences that keep the cell and the Rider where the port expects them
        cx, cy = 0, 0
        for (x0, y0, sx, sy) in [(cx - m.CELL[0] / 2 - m.PART_CLEARANCE, cy - m.CELL[1] / 2 - m.PART_CLEARANCE, m.CELL[0] + 2 * m.PART_CLEARANCE, m.CELL[1] + 2 * m.PART_CLEARANCE)]:
            solid += box(x0 - 1.5, y0 - 1.5, LID_Z, sx + 3, sy + 3, 2.0) - box(x0, y0, LID_Z - 1, sx, sy, 4)
    cuts = [cyl(m.M3_CLEAR_D, LID_T + 2, *at(CORNER_R, a), BOTTOM - 1, seg=24) for a in TAB_ANGLES]
    cuts += [cyl(m.M3_HEAD_D, 1.6, *at(CORNER_R, a), BOTTOM - 0.01, seg=32) for a in TAB_ANGLES]
    cuts += [cyl(FOOT_D, 0.8, *at(CORNER_R, a), BOTTOM - 0.01) for a in TAB_ANGLES + COLUMN_ANGLES]
    return solid - union(cuts)


def bought(pressed=False):
    parts = {k: v for k, v in m.bought_parts(pressed).items() if k in ('atom', 'hex')}
    if BATTERY:
        dz = LID_Z - m.DECK_Z0 - m.DECK_FLOOR      # the deck's floor level becomes the lid's top
        parts['cell'] = m.cbox(0, 0, LID_Z, *m.CELL)
        parts['rider'] = m.box(m.RIDER_X0, -m.RIDER[1] / 2, m.RIDER_Z + dz, *m.RIDER)
    return parts


if __name__ == '__main__':
    printed = {'housing': housing(), 'platform': platform(), 'lid': lid(), 'cap': m.cap(), 'cage': m.cage(), 'nub': m.nub(), 'spring': m.spring(m.SPRING_FREE)}
    flipped = {'housing', 'cap'}
    os.makedirs(os.path.join(HERE, OUT), exist_ok=True)
    print(f'{"battery" if BATTERY else "USB"} build: {F:.0f} mm across the flats, {m.CAP_TOP - BOTTOM:.1f} mm tall to the cap, housing {TOP - BOTTOM:.1f} mm, one port on +x')
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
    colours = {'housing': '#3a3a40', 'platform': '#55555c', 'lid': '#2a2a2e', 'cage': '#8a8a92', 'nub': '#e07b39', 'cap': '#ffffff', 'springs': '#c9a227',
               'hex': '#2e7d32', 'atom': '#1a3a6e', 'cell': '#8a8a55', 'rider': '#1b5e20'}
    everything = {k: v for k, v in printed.items() if k != 'spring'}
    everything.update(bought()); everything['springs'] = m.springs_in_place(m.FLANGE_BOTTOM - 1.25)
    m.section_svg(everything, colours, os.path.join(HERE, f'section-{OUT}-front.svg'), 'xz')
    m.section_svg(everything, colours, os.path.join(HERE, f'section-{OUT}-side.svg'), 'yz')
