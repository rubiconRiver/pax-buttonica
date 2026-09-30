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
            wall for the Rider, standing up to the platform so it can't rock. No screws, no feet: the lid sits flat.
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
platform's hole into the Atom; lid on, a strip of tape.
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
# The bought parts as they really are (2026-09-30, from the parts on Garett's desk; the first drawing was from
# datasheets and wrong in four places). Distances along the Rider's port end are from its SWITCH edge.
CELL_REAL = (34.5, 52.0, 9.9)        # EEMB LP963450, as listed by its maker; the lead leaves one short end, at a corner
CELL_PLAY = 0.75                     # round the cell in its pocket: 0.5 was tight
RIDER_REAL = (25.0, 41.0, 8.0)       # across, along, tall (the USB-A jack is the tall part)
RIDER_JST = 6.5                      # battery socket, centre, from the switch edge          MEASURE
RIDER_USBC = 17.5                    # USB-C, centre, from the switch edge                   MEASURE
RIDER_USBA = 10.0                    # USB-A jack, centre, from the switch edge              MEASURE
RIDER_SWITCH = 12.0                  # the slide switch, centre, from the USB-A end          MEASURE
SETBACK = 6.5                        # the Rider stands this far off the port wall: the battery plugs in from that end
USB_A_PLUG = (16.0, 20.0, 8.0)       # a straight USB-A plug's body: across, out of the jack, tall     MEASURE
USB_A_BEND = 6.5                     # and room for the cable to turn after it
STRAIGHT_USB_A = True                # False: a right-angle USB-A plug (about 9 mm), and the box is square again

W = 72.0                            # outside, across (x)
WALL = 2.5
CORNER_R = 6.0                      # outside; the inside corners are CORNER_R - WALL
IN = W - 2 * WALL                   # 67 inside: the bore (66) needs it
# Along y the pocket has to hold, in one line: the battery plug's room, the Rider, its USB-A plug and the cable's turn.
_run = SETBACK + RIDER_REAL[1] + 1.0 + (USB_A_PLUG[1] + USB_A_BEND if STRAIGHT_USB_A else 9.0 + 4.0)
INY = max(IN, math.ceil(_run))      # 75 with a straight plug, 67 with a right-angle one
D = INY + 2 * WALL                  # 80 outside, along y
BORE_R = m.BORE_R                   # 33
PLATFORM_T = m.FLOOR_T              # 1.6
PLATFORM_CLEAR = 0.3                # platform to pocket, each side
COMP_H = CELL_REAL[2] + 0.9           # 10.8: the cell is the tallest thing on the lid
LID_T = 2.5
TOP = m.BEZEL_TOP                   # 21, the housing's top edge
PLATFORM_Z = 0.0                    # top of the platform
LID_Z = PLATFORM_Z - PLATFORM_T - COMP_H
BOTTOM = LID_Z - LID_T              # the table
C = IN / 2 - 3.5                    # 30: the corners' centres in x, tabs and feet
CY = INY / 2 - 3.5                  # and in y
# No screws (2026-09-30, Garett): the lid sits in its rebate and stays put on its own, and a strip of tape does
# the rest; the bosses floated when printed and got in the way of everything inside. SCREWS = True brings back
# two in the -x corners and one in the middle of the -y wall (not the +x corners: one has the Rider's sockets and
# the other is where its USB-A plug ends and the cable turns up to the Atom).
SCREWS = False
TABS = ((-C, CY, -1, 1), (-C, -CY, -1, -1), (6.0, -CY, 0, -1)) if SCREWS else ()   # x, y, and which walls it leans on
FEET = ()                            # no foot recesses since 2026-09-30: it sits flat fine, Garett says; four corners with SCREWS' extra were ((-C, CY), (-C, -CY), (C, CY), (C, -CY))
TAB_D, TAB_H = 8.0, 6.0
NOTCH_R = 5.0
PORT = (14.0, 8.5)                  # the charging window: a USB-C plug's body passes it, because the socket is SETBACK behind the wall
SWITCH_SLOT = (11.0, 5.0)           # in the +x wall, over the Rider's switch: along y, tall
FOOT_D = 10.5
FENCE_T = 1.6
FENCE_H = COMP_H - 0.3              # the platform rests on the fences, a hair below the housing's ledge
CLR = m.PART_CLEARANCE              # 0.5 round every bought part

# where things lie on the lid. The Rider against the +x wall, switch edge to the wall (so the switch can be reached
# through a slot), its port end toward +y. The cell along the -x wall, its lead end toward +y, beside the Rider's
# battery socket; the lead curls up out of the socket and back over the board to the cell.
RIDER_FOOT = (RIDER_REAL[0], RIDER_REAL[1])
RIDER_X1 = IN / 2 - 0.7                                                # its switch edge, 0.7 from the +x wall
RIDER_X0 = RIDER_X1 - RIDER_FOOT[0]                                    # 7.8
RIDER_Y1 = INY / 2 - SETBACK                                           # its port end
RIDER_Y0 = RIDER_Y1 - RIDER_FOOT[1]                                    # its USB-A end
USBC_X = RIDER_X1 - RIDER_USBC                                         # where the charging window is
JST_X = RIDER_X1 - RIDER_JST
USBA_X = RIDER_X1 - RIDER_USBA
CELL_ZONE = (CELL_REAL[0] + 2 * CELL_PLAY, CELL_REAL[1] + 2 * CELL_PLAY)   # 36 x 53.5
CELL_ZX0 = -IN / 2                                                     # against the -x wall
CELL_ZY1 = INY / 2 - 9.0                                               # 9 mm at the +y end for the lead and its tab
CELL_ZY0 = CELL_ZY1 - CELL_ZONE[1]
CELL_X0, CELL_Y0 = CELL_ZX0 + CELL_PLAY, CELL_ZY0 + CELL_PLAY
PLUG = USB_A_PLUG if STRAIGHT_USB_A else (16.0, 9.0, 8.0)
# The plug. A USB-C plug's body is about 20 mm long (Garett's photo, 2026-09-28: it reached the round wall with
# nowhere for the cable to turn; the first drawing assumed 12). So the Atom is turned to point its socket into a
# CORNER of the box, 47 mm from the middle instead of 33, the housing is opened into that corner at plug height,
# the cable drops through the platform there, and a hole through the corner wall lets the plug or the cable
# stick out if that is still not enough.                                                        MEASURE the real plugs
CORNER_A = -45.0                     # which corner: +x, -y, the one nearest the Rider's USB-A plug
ATOM_TURN = 135.0                    # the mini draws the Atom's USB-C toward -x (180); this points it at CORNER_A
USBC_PLUG = (22.0, 12.0, 7.0)        # length out of the Atom, width, height                         MEASURE
CORNER_W = 18.0                      # width of the platform's slot into the corner
CORNER_TOP = 10.0                    # how high the inside stays rectangular: below the cap's flange, which never comes lower than 13
WALL_HOLE = (14.0, 9.0)              # through the corner wall: wide enough for the plug itself
WALL_HOLE_OPEN = False               # closed since 2026-09-29: in the printed prototype the cable turned inside the corner with room to spare
CABLE_HOLE = (6.0, -36.0, 14.0, 14.0)      # (no longer cut: the cable goes down at the corner)                                  # x0, y0, sx, sy: a SLOT open to the platform's -y edge, just past the Rider's plug.
#   The cable has a plug on each end and neither passes a hole, so it has to slip in from the side.
# No printed springs (2026-09-28): with no bezel pressing on it, the cap resting on the Atom's own switch through
# the peg returns by itself, and Garett's test of exactly that felt better than the sprung one. The peg is taller
# to take up the 2 mm the springs used to hold the cap up by, less REST_PLAY so it can never hold the switch down.
SPRINGS = False
REST_PLAY = 0.5                      # how far the cap sits below the lip at rest, resting on the switch
PEG_H = m.NUB_H + (0.0 if SPRINGS else m.DISC_GAP - REST_PLAY)     # 3.5 without springs, 2.0 with
# The stop. Sprung, the cap travelled 2.8 mm and the cage's plate landed on the Atom's rim. Unsprung it rests on
# the switch, so a press is the switch's 0.3 mm and then the peg's flexures, which give about a millimetre and
# snap beyond it (two of three did, 2026-09-28). The collar is raised so the cap's ceiling lands on it 0.3 mm
# after the click: a slap goes cap -> collar -> platform -> fences -> lid -> table, and the flexures never bend more.
STOP_AFTER_CLICK = 0.3               # 0.5 until 2026-09-30: a flexure broke on the most-used button, so they bend less
PRESS = (m.TRAVEL - m.DISC_GAP - 0.5) + STOP_AFTER_CLICK          # 0.3 + 0.3: how far the cap moves from rest to the stop


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
    return rbox_prism(IN + 2 * grow, INY + 2 * grow, CORNER_R - WALL + grow, h, z=z)


def housing():
    solid = rbox_prism(W, D, CORNER_R, TOP - BOTTOM, z=BOTTOM, ct=1.5, cb=0.6)
    cone = BORE_R - m.BEZEL_BORE_R
    cavity = revolve([
        (0, PLATFORM_Z - 1), (BORE_R, PLATFORM_Z - 1), (BORE_R, m.SEAT_Z), (m.BEZEL_BORE_R, m.SEAT_Z + cone),
        (m.BEZEL_BORE_R, TOP - 0.6), (m.BEZEL_BORE_R + 1.6, TOP + 1), (0, TOP + 1)])
    solid -= cavity
    solid -= pocket_outline(COMP_H + PLATFORM_T + 1, BOTTOM - 1 + LID_T)          # the pocket, open to the bottom
    solid -= pocket_outline(LID_T + 1, BOTTOM - 1, grow=0.5)                        # the lid's rebate
    # Below the cap's flange the inside is the whole rectangle, not the round bore: the Atom's cable is stiff and
    # wants a loop round the collar, and a loop needs corners to lie in (2026-09-30; the first cut opened one
    # corner, and the cable still fought it). The platform is located by the lid's fences, not by a ledge here.
    solid -= pocket_outline(CORNER_TOP + 1, PLATFORM_Z - 1)
    if WALL_HOLE_OPEN:
        solid -= box(IN / 2 - 2, -WALL_HOLE[0] / 2, PLATFORM_Z + 0.5, 30, WALL_HOLE[0], WALL_HOLE[1]).rotate([0, 0, CORNER_A])
    tabs = union([cyl(TAB_D, TAB_H, x, y, LID_Z, seg=32) for x, y, sx, sy in TABS] or [Manifold()])
    # Each boss leans into the wall or corner behind it: printed upside down it grows out of the wall at about
    # 45 degrees, so nothing starts in mid-air and no supports are needed (the slicer warned of a floating cantilever).
    for x, y, sx, sy in TABS:
        ax = sx * (IN / 2 + 0.5) if sx else x
        tabs += Manifold.batch_hull([cyl(TAB_D, 0.2, x, y, LID_Z + TAB_H - 0.2, seg=32),
                                     cyl(0.8 if sx else TAB_D, 0.2, ax, sy * (INY / 2 + 0.5), PLATFORM_Z - 0.5, seg=12 if sx else 32)])
    tabs ^= pocket_outline(COMP_H + PLATFORM_T + 1, LID_Z - 1)
    solid += tabs
    cuts = [cyl(m.TAP_D, TAB_H + 2, x, y, LID_Z - 1, seg=24) for x, y, sx, sy in TABS]
    if not cuts: cuts = []
    # the charging window, on the real USB-C; and a slot over the Rider's switch
    port_z = LID_Z + 1.6 + 1.7                       # the board, then half the socket
    cuts.append(cbox(USBC_X, D / 2, port_z - PORT[1] / 2, PORT[0], 2 * WALL + 4, PORT[1]))
    cuts.append(box(W / 2 - WALL - 2, RIDER_Y0 + RIDER_SWITCH - SWITCH_SLOT[0] / 2, LID_Z + 0.8, WALL + 4, SWITCH_SLOT[0], SWITCH_SLOT[1]))
    return solid - union(cuts)


def platform():
    solid = rbox_prism(IN - 2 * PLATFORM_CLEAR, INY - 2 * PLATFORM_CLEAR, CORNER_R - WALL - PLATFORM_CLEAR, PLATFORM_T, z=PLATFORM_Z - PLATFORM_T)
    h0, g0 = m.COLLAR_H, m.COLLAR_GAPS
    m.COLLAR_H = h0 + COLLAR_RAISE          # collar() reads both
    m.COLLAR_GAPS = ((0, 1),)               # no gaps of its own: they are cut below, where the turned Atom's plugs are
    collar = m.collar()
    m.COLLAR_H, m.COLLAR_GAPS = h0, g0
    gaps = union(box(0, -(USBC_PLUG[1] / 2 + 2.5), -1, 60, USBC_PLUG[1] + 5, m.COLLAR_H + COLLAR_RAISE + 3).rotate([0, 0, a]) for a in (CORNER_A, CORNER_A + 180))
    solid += collar - gaps
    fence = cbox(0, 0, 0, m.ATOM[0] + 2 * CLR + 3, m.ATOM[1] + 2 * CLR + 3, 2.5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 2 * CLR, m.ATOM[1] + 2 * CLR, 5)
    fence -= cbox(0, 0, -1, m.ATOM[0] + 20, 14, 5)
    solid += fence.rotate([0, 0, ATOM_TURN])
    cuts = []
    for a in (SPRING_ANGLES if SPRINGS else ()):
        cuts.append(box(m.SPRING_R0 - 0.3, -m.SPRING_D / 2 - 0.3, -1.2, m.SPRING_W + 0.6, m.SPRING_D + 0.6, 1.21).rotate([0, 0, a]))
    # The cable goes down at the +x, -y corner, and it needs the whole corner: the platform there is cut back to a
    # quarter circle round the collar (2026-09-30, Garett: a slot into the corner was nowhere near enough).
    cuts.append(box(0, -60, -PLATFORM_T - 1, 60, 60, PLATFORM_T + 2) - cyl(2 * (m.COLLAR_R + 2.5), PLATFORM_T + 4, z=-PLATFORM_T - 2, seg=96))
    cuts += [Manifold.batch_hull([cyl(2 * NOTCH_R, PLATFORM_T + 2, x, y, -PLATFORM_T - 1, seg=32),
                                  cyl(2 * NOTCH_R, PLATFORM_T + 2, x + 4 * sx, y + 4 * sy, -PLATFORM_T - 1, seg=32)]) for x, y, sx, sy in TABS]
    return solid - union(cuts)


def lid():
    solid = rbox_prism(IN + 1.0 - 0.4, INY + 1.0 - 0.4, CORNER_R - WALL + 0.3, LID_T, z=BOTTOM, cb=0.6)
    z, h, low = LID_Z, FENCE_H, 5.0
    zx1 = CELL_ZX0 + CELL_ZONE[0]                   # 2.5: the cell's pocket ends, the wall between the two starts
    f = []
    # the cell: a wall between it and the Rider, a stop at each end; the -x wall of the box is its fourth side.
    # Full height: these carry the platform. The +y stop leaves the Rider's side open, for the lead.
    f.append(box(zx1, CELL_ZY0 - FENCE_T, z, FENCE_T, CELL_ZONE[1] + FENCE_T, h))
    f.append(box(-25, CELL_ZY0 - FENCE_T, z, zx1 + 25, FENCE_T, h))
    f.append(box(-25, CELL_ZY1, z, 17, FENCE_T, h))
    # the Rider: a low rail on its -x side (the +x wall of the box is the other), stops at its USB-A end beside the
    # plug, and two low posts at its port end, one each side of the two sockets, so it cannot slide to the wall
    rx0 = RIDER_X0 - 0.5
    f.append(box(rx0 - FENCE_T, RIDER_Y0 - 0.5 - FENCE_T, z, FENCE_T, RIDER_FOOT[1] + FENCE_T + 1.0, low))
    open0 = USBA_X - PLUG[0] / 2 - 1.0               # the plug's width stays open
    f.append(box(rx0 - FENCE_T, RIDER_Y0 - 0.5 - FENCE_T, z, open0 - rx0 + FENCE_T, FENCE_T, h))
    f.append(box(rx0 - FENCE_T, RIDER_Y1 + 0.5, z, FENCE_T + 0.6, SETBACK - 0.9, low))
    f.append(box(JST_X + 4.6, RIDER_Y1 + 0.5, z, IN / 2 - 1.1 - (JST_X + 4.6), SETBACK - 1.8, low))      # short of the pocket's rounded corner
    solid += union(f)
    cuts = [cyl(m.M3_CLEAR_D, LID_T + 2, x, y, BOTTOM - 1, seg=24) for x, y, sx, sy in TABS]
    cuts += [cyl(m.M3_HEAD_D, 1.6, x, y, BOTTOM - 0.01, seg=32) for x, y, sx, sy in TABS]
    cuts += [cyl(FOOT_D, 0.8, x, y, BOTTOM - 0.01) for x, y in FEET]
    return solid - union(cuts)


def bought(pressed=False):
    parts = {k: v for k, v in m.bought_parts(pressed).items() if k in ('atom', 'hex')}
    # turned to point its USB-C into the corner, and drawn with a plug of the real size in it
    plug = box(-m.ATOM[0] / 2 - USBC_PLUG[0], -USBC_PLUG[1] / 2, 1.2, USBC_PLUG[0], USBC_PLUG[1], USBC_PLUG[2])
    parts['atom'] = (parts['atom'] + plug).rotate([0, 0, ATOM_TURN])
    parts['cell'] = box(CELL_X0, CELL_Y0, LID_Z, *CELL_REAL)
    # the Rider with everything that plugs into it, so the check finds a window or a wall in the way:
    # the board and its parts; the USB-A plug out of its -y end; the battery's plug out of its port end;
    # and the charging cable's plug coming in through the window
    rider = box(RIDER_X0, RIDER_Y0, LID_Z, RIDER_FOOT[0], RIDER_FOOT[1], RIDER_REAL[2])
    rider += cbox(USBA_X, RIDER_Y0 - 1.0 - PLUG[1] / 2, LID_Z + 0.6, PLUG[0], PLUG[1], PLUG[2])
    rider += cbox(JST_X, RIDER_Y1 + 2.5, LID_Z + 1.6, 8.0, 5.0, 5.5)
    rider += cbox(USBC_X, RIDER_Y1 + (D / 2 + 6 - RIDER_Y1) / 2, LID_Z + 0.05, 12.4, D / 2 + 6 - RIDER_Y1, 6.5)
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
    print(f'v2 box: {W:.0f} x {D:.0f} mm, {m.CAP_TOP - BOTTOM:.1f} mm tall to the cap, housing {TOP - BOTTOM:.1f} mm, port on +y, {"straight" if STRAIGHT_USB_A else "right-angle"} USB-A plug')
    check_and_write(printed_parts(), {'housing', 'cap'}, os.path.join(HERE, OUT), OUT)
    if not SPRINGS:
        # pegs to choose from: the shortest that clicks cleanly without the cap rattling is the one
        for h in (3.0, 3.5, 4.0):
            m.write_stl(m.for_printing(m.nub(h), False), os.path.join(HERE, OUT, f'nub-{h:.1f}.stl'))
        stale = os.path.join(HERE, OUT, 'spring.stl')
        if os.path.exists(stale): os.remove(stale)
