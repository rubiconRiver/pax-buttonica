"""
v5, the slab: nothing rides on the light. The bottom half is v2's, unchanged (the same lid, the cell and the Rider
side by side, the same charge window and switch slot), and everything above the platform is new. Three designs on
that one chassis, all 72 x 80 and 32.5 mm to the deck, all with a chamfered body rather than a rounded one:

  lantern    Garett's pick (2026-10-02). A white hexagonal lantern stands 6 mm proud of a flat top, on the centre
             line, over the hex in its well; it glows from its sides as well as its face. The button is a black
             hexagonal key, stuck to the Atom's own panel with foam tape and standing a little proud: pressed flush,
             the finger (or a slapping palm) lands on the top. The top is the stop, the foam is the give. The key is
             on the centre line too; under it the Atom stands 4 mm to the left and turned 22 degrees, so its straight
             USB-C plug points into the cable corner with room to turn down (Garett: angle the Atom, no other plug).
  beacon     The same, with the light a 22 mm column: readable from across the table and from any side.
  keyplate   The whole top is the button. A plate floats inside the walls, hinged on two tongues in the back wall
             (closed slots, below the plate) and resting on the Atom through a foot on foam tape; press it anywhere.
             It stops on the Atom's own rim.
             The lantern stands on the platform and comes up through the plate, so the light never moves.

Parts, per design (stl-v5/<design>/):
  housing    lantern, beacon: walls and top in one, printed top down (the deck on the bed), no supports.
             keyplate: walls only, printed rim down.
  plate      keyplate only: the top. Prints deck down.
  platform   the flat plate on the lid's fences, with a pedestal and fence for the Atom (USB-C toward the cable
             corner) and a well for the hex: a hexagonal wall with three posts the board sits on, LEDs up, 6 mm
             clear under its sockets, and a notch in the wall for the Grove cable from the Atom. The well
             keeps the light off everything else in the box. Black: in transparent it would leak light inside.
  lid        v2's, the same file.
  lantern    the light: a hexagonal cup with a flange, resting on the well's rim and held down by the top. The
             only part in transparent filament (Garett prints black and transparent): start with the 1.4 mm
             face and three or four walls, so the layers scatter the light. Prints face down.
  key        lantern, beacon: the hexagonal key, three heights to try. Black, like the housing.

  .venv/bin/python make_shell_v5.py    ->  stl-v5/

Assembly, all right side up: lid; cell and Rider on it, plugged; platform onto the fences; Atom onto its pedestal,
Grove cable into the hex and then the hex onto its posts, the cable out through the well's notch and down the
+x side to the Atom's Grove port, under its USB-C plug; the Atom's USB cable down the corner to the Rider; lantern over the hex onto the well;
foam tape on the Atom's panel. Then lantern and beacon: key onto the tape, housing down over the lot. Keyplate:
housing down over the lot, plate in tongues first, pressed onto the tape.

Not printed yet (2026-10-01). Every design is checked, at rest and pressed, against the same bought parts as v2.
"""
import importlib.util
import math
import os
import sys
from types import SimpleNamespace

from manifold3d import CrossSection, JoinType, Manifold

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
DESIGNS = ('lantern', 'beacon', 'keyplate')

# ── from v2, unchanged: the box and its bottom half ─────────────────────────
W, D, WALL, IN, INY, CORNER_R = v2.W, v2.D, v2.WALL, v2.IN, v2.INY, v2.CORNER_R
LID_T, LID_Z, BOTTOM = v2.LID_T, v2.LID_Z, v2.BOTTOM
PLATFORM_T, PLATFORM_CLEAR, CLR = v2.PLATFORM_T, v2.PLATFORM_CLEAR, v2.CLR
PLATFORM_Z = 0.0                     # top of the platform: everything above is measured from here

# ── the body ────────────────────────────────────────────────────────────────
TOPZ = 17.6                          # the deck: the outside of the top
CORNER_C = 4.0                       # the body's corners are cut at 45 degrees, this far along each side
WAIST = (-0.8, 0.8, 0.6)             # a line round the walls at the platform's level: z, height, depth

# ── the Atom and the hex, where they stand ──────────────────────────────────
ATOM = m.ATOM
KX = 0.0                             # the key, the press mark and the lantern are on the centre line
# The Atom's straight USB-C plug is 22 mm long, and a centred, square Atom leaves 21.5 mm to the side wall. So the
# Atom is never centred: where it stands is (x, y, turn). Under a key it is 4 mm left and turned 22 degrees toward
# the cable corner (+x, -y): the plug's tip then has 6.5 mm to the wall along its own line, as much as a square Atom
# 8 mm left has, and the key's foot is 4 mm off the panel's middle, well inside its 17 mm. Turned further, the
# Atom's own corners run into the lantern's well and the front wall. Under the keyplate nobody sees it: 8 mm left,
# square.
ATOM_AT = {'key': (-4.0, -19.2, -22.0), 'plate': (-8.0, -22.0, 0.0)}
KEY_FOOT_D = 9.0                     # the key's foot on the panel: small, because it lands off the panel's middle
ATOM_FENCE_T, ATOM_FENCE_H = 1.5, 3.0
USBC_PLUG = v2.USBC_PLUG             # 22 long, 12 wide, 7 high: the Atom's plug
# The Atom's two sockets are on the SAME side, one above the other: USB-C nearer its face, the Grove port (to the hex)
# under it. (Garett, 2026-10-02; v2's drawing has the Grove port on the far side, which is wrong.) Heights are guesses.
GROVE_PLUG = (9.0, 10.0, 4.5)        # the Grove plug: length out of the Atom, width, height                    MEASURE
USBC_Z, GROVE_Z = 2.7, 0.2           # each plug's underside above the Atom's own underside                      MEASURE
FOAM = 1.0                           # the tape between the Atom's panel and what presses it, uncompressed     MEASURE
PRESS = 0.8                          # how far the key (or the plate, at the Atom) travels: the switch's 0.3 and foam
HX, HY = 0.0, 14.5                   # the hex's centre

# ── the lantern ─────────────────────────────────────────────────────────────
LANTERN_F = 35.0                     # across flats, outside: wide enough inside (32.6) for the board to stand up in it
LANTERN_WALL, LANTERN_FACE = 1.2, 1.0
FLANGE_FLARE, FLANGE_T = 2.0, 0.4    # the flange flares out at 45 degrees so the cup prints face down with no support
WELL_T, WELL_CLR = 1.6, 0.3
# The hex's cable. Its sockets are under the board (7.6 mm of them), and the Grove cable from the Atom has to reach
# them: so the board stands UNDER_SOCKETS clear of the platform, up inside the lantern, and the well has a notch in
# its +x side, open at the top: the plug in the hex's side socket stands out through it, and the hex drops in plugged. (The first drawing
# left 2.4 mm under the sockets and a slot that opened onto the Atom's corner: Garett, "how do I get power to the hex?")
UNDER_SOCKETS = 6.0                  # clear height under the hex's sockets, for the plug's wires to turn      MEASURE
NOTCH = (-6.5, 13.0)                 # in the well's +x flat, the side the Atom's plugs are on: where it starts along the
                                     # flat (from the hex's middle), and its width: the Grove plug's 10 mm and room
# The hex has two sockets, either usable (Garett): one underneath near an end, one on its side. The side one is used:
# the board is turned so that socket faces the notch, and the plug comes straight out through it.
HEX_SIDE_PLUG = (8.0, 10.0, 5.0)     # the plug in the hex's side socket: how far it stands out past the board's edge,
                                     # its width, its height; it hangs just under the board                      MEASURE
CORNER_CUT = (9.0, -8.0)             # the platform's cable corner: everything at x beyond the first and y below the second

# ── the key (lantern, beacon) ───────────────────────────────────────────────
KEY_F = 15.0                         # across flats: the Atom's panel is 17 square in a 19 opening
KEY_PROUD = PRESS                    # pressed flush, the top is the stop
KEY_RING = (22.0, 0.8, 0.4)          # a groove round it in the deck: across flats, width, depth


RIB = (3.0, 2.0)                     # ribs down the walls over the platform's edge: width, how far they stand in
RIB_GAP = 0.3                        # above the platform's top

# ── keyplate: the top as a hinged plate ─────────────────────────────────────
PLATE_CLEAR = 0.4                    # plate to walls, each side: the shadow gap
PLATE_TONGUES = (-18.0, 18.0)        # where the two tongues are, along the back edge
TONGUE = (8.0, 2.4)                  # width; how far it hangs below the plate, which is also how far it reaches out
TONGUE = (TONGUE[0], TONGUE[1], TONGUE[1])
FOOT_D = 15.0                        # the foot on the Atom's panel
STOP = (24.0, 19.8)                  # a square ring over the Atom's rim, outside the panel's opening: the stop


def dims(design):
    """Everything that differs between the designs, worked out from a few choices."""
    d = SimpleNamespace(name=design, plate=design == 'keyplate')
    d.lantern_h = 22.0 if design == 'beacon' else 6.0
    d.lantern_chamfer = 2.0 if design == 'beacon' else 1.0
    d.top_t = 2.4 if d.plate else 1.6                    # the plate is thicker: it is pressed anywhere
    d.under = TOPZ - d.top_t                             # the underside of the top (or the plate)
    d.top_chamfer = 1.2 if d.plate else 2.5              # an open rim cannot take the big chamfer
    d.ax, d.ay, d.atom_turn = ATOM_AT['plate' if d.plate else 'key']
    d.kx, d.ky = (KX, d.ay)                              # the key (or the plate's press mark): on the centre line
    d.ped_h = d.under - (1.2 if d.plate else 1.5) - ATOM[2]          # the Atom's rim ends this far under the top
    d.rim_z = d.ped_h + ATOM[2]                          # the Atom's rim
    d.panel_z = d.rim_z - m.ATOM_BUTTON_DROP             # the top of its button panel
    # the lantern rests on the well; the top holds it down, with room for the plate to move over it
    d.flange_top = d.under - (0.9 if d.plate else 0.3)
    d.flare = 1.0 if d.plate else FLANGE_FLARE          # under the plate the flange is shallower, to clear the hex's side plug
    d.lantern_rim = d.flange_top - FLANGE_T - d.flare
    d.well_top = d.lantern_rim
    d.hex_bot = m.HEX_UNDER + UNDER_SOCKETS              # the board's underside: its sockets clear the platform
    d.hex_top = d.hex_bot + m.HEX_BOARD_T                # the LEDs: above the well's rim, inside the lantern
    d.window = LANTERN_F + (1.0 if d.plate else 0.5)     # the hole the lantern comes through
    d.gap = TOPZ + d.lantern_h - LANTERN_FACE - d.hex_top           # LEDs to the lantern's face
    d.key_h = TOPZ + KEY_PROUD - (d.panel_z + FOAM)
    # keyplate: the hinge line and how far the plate turns
    d.pivot = (INY / 2, d.under)
    d.turn = math.degrees(PRESS / (INY / 2 - d.ay))
    return d


def hexagon(flat, h, z=0.0, x=0.0, y=0.0):
    """A hexagonal prism, flats facing +-x (as the board lies)."""
    return CrossSection.circle(flat / 2 / math.cos(math.radians(30)), 6).rotate(30).extrude(h).translate([x, y, z])


def hull(parts):
    return Manifold.batch_hull(list(parts))


def octagon(w, d, c):
    return CrossSection([[(w / 2 - c, -d / 2), (w / 2, -d / 2 + c), (w / 2, d / 2 - c), (w / 2 - c, d / 2),
                          (-w / 2 + c, d / 2), (-w / 2, d / 2 - c), (-w / 2, -d / 2 + c), (-w / 2 + c, -d / 2)]])


def cut_prism(w, d, c, h, z, ct=0.0, cb=0.0, inset=0.0):
    """A box with its four corners cut at 45 degrees, chamfered top and bottom. inset shrinks it all round."""
    base = octagon(w, d, c)
    if inset: base = base.offset(-inset, JoinType.Miter, 2.0)
    slabs = [base.extrude(h - ct - cb).translate([0, 0, cb])]
    if cb: slabs.append(base.offset(-cb, JoinType.Miter, 2.0).extrude(0.01))
    if ct: slabs.append(base.offset(-ct, JoinType.Miter, 2.0).extrude(0.01).translate([0, 0, h - 0.01]))
    return hull(slabs).translate([0, 0, z])


def deck_lines(d):
    """What is cut into the deck: on the keyplate, a hexagon where you press. With a key, nothing: the key is the mark."""
    if not d.plate: return []
    ring = hexagon(KEY_RING[0] + 2 * KEY_RING[1], KEY_RING[2] + 0.01, TOPZ - KEY_RING[2], d.kx, d.ky) - hexagon(KEY_RING[0], KEY_RING[2] + 1, TOPZ - KEY_RING[2] - 0.5, d.kx, d.ky)
    return [ring]


def housing(d):
    solid = cut_prism(W, D, CORNER_C, TOPZ - BOTTOM, BOTTOM, ct=d.top_chamfer, cb=0.6)
    solid -= v2.pocket_outline((TOPZ + 1 if d.plate else d.under) - LID_Z, LID_Z)          # the inside
    solid -= v2.pocket_outline(LID_T + 1, BOTTOM - 1, grow=0.5)                              # the lid's rebate
    # Ribs down the walls: the platform rests on the lid's fences and cannot lift past these. Lantern and beacon:
    # they grow from the top, which is on the bed. Keyplate: they stop under the plate and end in a 45-degree
    # wedge there, so printed rim down they grow out of the wall.
    z0 = PLATFORM_Z + RIB_GAP
    z1 = d.under - 1.6 if d.plate else d.under + 0.1

    def rib(x0, y0, sx, sy, nx, ny):
        if not d.plate: return box(x0, y0, z0, sx, sy, z1 - z0)
        full = box(x0, y0, z0, sx, sy, z1 - z0 - RIB[1])
        root = box(x0 if nx >= 0 else x0 + sx - 0.5, y0 if ny >= 0 else y0 + sy - 0.5, z1 - 0.01, 0.5 if nx else sx, 0.5 if ny else sy, 0.01)
        return hull([full, root])

    ribs = [rib(-IN / 2 - 0.5, y - RIB[0] / 2, RIB[1] + 0.5, RIB[0], 1, 0) for y in (30.0, 0.0)]            # the -x wall
    ribs.append(rib(IN / 2 - RIB[1], 12.0 - RIB[0] / 2, RIB[1] + 0.5, RIB[0], -1, 0))                       # the +x wall
    ribs.append(rib(25.0 - RIB[0] / 2, INY / 2 - RIB[1], RIB[0], RIB[1] + 0.5, 0, -1))                      # the +y wall
    ribs.append(rib(-24.0 - RIB[0] / 2, -INY / 2 - 0.5, RIB[0], RIB[1] + 0.5, 0, 1))                        # the -y wall
    solid += union(ribs)
    cuts = []
    if d.plate:
        # the slots the plate's tongues hinge in, through the back wall
        for x in PLATE_TONGUES:
            cuts.append(box(x - TONGUE[0] / 2 - 0.3, INY / 2 - 1, d.under - TONGUE[2] - 0.2, TONGUE[0] + 0.6, WALL + 2, TONGUE[2]))
    else:
        cuts.append(hexagon(d.window, d.top_t + 2, d.under - 1, HX, HY))                   # the lantern's window
        cuts.append(hexagon(KEY_F + 0.6, d.top_t + 2, d.under - 1, d.kx, d.ky))            # the key's hole
        cuts += deck_lines(d)
    # the waist: a line round the walls
    cuts.append(box(-W, -D, WAIST[0], 2 * W, 2 * D, WAIST[1]) - cut_prism(W, D, CORNER_C, WAIST[1] + 2, WAIST[0] - 1, inset=WAIST[2]))
    # the charging window and the switch slot, where v2 has them
    port_z = LID_Z + 1.6 + 1.7
    cuts.append(cbox(v2.USBC_X, D / 2, port_z - v2.PORT[1] / 2, v2.PORT[0], 2 * WALL + 4, v2.PORT[1]))
    cuts.append(box(W / 2 - WALL - 2, v2.RIDER_Y0 + v2.RIDER_SWITCH - v2.SWITCH_SLOT[0] / 2, LID_Z + 0.8, WALL + 4, v2.SWITCH_SLOT[0], v2.SWITCH_SLOT[1]))
    return solid - union(cuts)


def plate(d):
    solid = v2.rbox_prism(IN - 2 * PLATE_CLEAR, INY - 2 * PLATE_CLEAR, CORNER_R - WALL - PLATE_CLEAR, d.top_t, z=d.under, ct=0.6)
    # Tongues: a block under the plate's back edge with a wedge reaching out into the wall below the plate's level, so
    # the slot is closed above and the wall over it holds the back edge down. The wedge's top slopes at 45 degrees:
    # printed deck down, it grows out of the block with nothing in mid-air, and its flat face is the one it hinges on.
    for x in PLATE_TONGUES:
        ye = INY / 2 - PLATE_CLEAR
        block = box(x - TONGUE[0] / 2, ye - 3.0, d.under - TONGUE[2], TONGUE[0], 3.0, TONGUE[2] + 0.01)
        tip = box(x - TONGUE[0] / 2, ye - 0.01, d.under - TONGUE[2], TONGUE[0], TONGUE[2], 0.01)
        solid += hull([block, tip])
    # the foot, down to the foam on the Atom's panel; and the stop, a hair above the Atom's rim until pressed
    solid += cyl(FOOT_D, d.under - (d.panel_z + FOAM) + 0.01, d.ax, d.ay, d.panel_z + FOAM, seg=64)
    # (its front edge is further from the hinge than the Atom's middle and travels more: it is the edge that lands)
    stop_z = d.rim_z + PRESS * (INY / 2 - (d.ay - STOP[0] / 2)) / (INY / 2 - d.ay) + 0.05
    solid += cbox(d.ax, d.ay, stop_z, STOP[0], STOP[0], d.under - stop_z + 0.01) - cbox(d.ax, d.ay, stop_z - 1, STOP[1], STOP[1], d.under - stop_z + 2)
    cuts = [hexagon(d.window, d.top_t + 2, d.under - 1, HX, HY)] + deck_lines(d)
    return solid - union(cuts)


def platform(d):
    solid = v2.rbox_prism(IN - 2 * PLATFORM_CLEAR, INY - 2 * PLATFORM_CLEAR, CORNER_R - WALL - PLATFORM_CLEAR, PLATFORM_T, z=PLATFORM_Z - PLATFORM_T)
    # the cable corner: cut away so the Atom's plug hangs over it and its cable can go down to the Rider's USB-A
    solid -= box(CORNER_CUT[0], -60, -PLATFORM_T - 1, 60, 60 + CORNER_CUT[1], PLATFORM_T + 2)
    # the Atom's pedestal, and a fence round it open toward its two sockets; both turned as the Atom is
    a = ATOM[0] + 2 * CLR
    stand = cbox(0, 0, 0, a + 2 * ATOM_FENCE_T, a + 2 * ATOM_FENCE_T, d.ped_h)
    fence = cbox(0, 0, d.ped_h, a + 2 * ATOM_FENCE_T, a + 2 * ATOM_FENCE_T, ATOM_FENCE_H)
    fence -= cbox(0, 0, d.ped_h - 1, a, a, ATOM_FENCE_H + 2)
    fence -= box(0, -7, d.ped_h - 1, a / 2 + 10, 14, ATOM_FENCE_H + 2)        # open on +x only: both plugs are there
    solid += (stand + fence).rotate([0, 0, d.atom_turn]).translate([d.ax, d.ay, 0])
    # the hex's well: a hexagonal wall the lantern rests on, and three posts the board rests on, at three corners
    # (the sockets are a block in the middle of the board, so the corners are free). The posts stand above the rim.
    inner = m.HEX_FLAT + 2 * WELL_CLR
    well = hexagon(inner + 2 * WELL_T, d.well_top, 0, HX, HY) - hexagon(inner, d.well_top + 2, 0, HX, HY)
    v = inner / 2 / math.cos(math.radians(30))
    posts = []
    for deg in (90, 210, 330):
        c, sn = math.cos(math.radians(deg)), math.sin(math.radians(deg))
        posts.append(cyl(4.4, d.hex_bot, HX + (v - 1.3) * c, HY + (v - 1.3) * sn, 0, seg=32))     # small: clear of the sockets' block
    solid += well + (union(posts) ^ hexagon(inner + 0.2, d.hex_bot, 0, HX, HY))
    # the cable's notch: through the well's +x flat, floor to rim, on the side the Atom's plugs point to
    solid -= box(HX + inner / 2 - 1, HY + NOTCH[0], 0.0, WELL_T + 2, NOTCH[1], d.well_top + 1)
    return solid


def lantern(d, face=LANTERN_FACE):
    """The light: a hexagonal cup, flange at its open end, resting on the well. Prints face down."""
    z1 = TOPZ + d.lantern_h
    c = d.lantern_chamfer
    outer = hull([hexagon(LANTERN_F, z1 - c - d.lantern_rim, d.lantern_rim, HX, HY), hexagon(LANTERN_F - 2 * c, 0.01, z1 - 0.01, HX, HY)])
    flange = hull([hexagon(LANTERN_F, 0.01, d.lantern_rim, HX, HY), hexagon(LANTERN_F + 2 * d.flare, 0.01, d.flange_top - FLANGE_T, HX, HY)])
    flange += hexagon(LANTERN_F + 2 * d.flare, FLANGE_T, d.flange_top - FLANGE_T, HX, HY)
    inner = hexagon(LANTERN_F - 2 * LANTERN_WALL, z1 - face - d.lantern_rim + 1, d.lantern_rim - 1, HX, HY)
    return outer + flange - inner


def key(d, h=None):
    """The key: a small round foot on the foam on the Atom's panel, and above the Atom's rim a hexagon with a chamfered
    top that comes through the deck. h is the whole height. The hexagon starts high enough to clear the rim pressed."""
    h = d.key_h if h is None else h
    z0, c = d.panel_z + FOAM, 0.6
    body_z = d.rim_z + PRESS + 0.2
    foot = cyl(KEY_FOOT_D, body_z - z0 + 0.01, d.kx, d.ky, z0, seg=48)
    body = hull([hexagon(KEY_F, z0 + h - c - body_z, body_z, d.kx, d.ky), hexagon(KEY_F - 2 * c, 0.01, z0 + h - 0.01, d.kx, d.ky)])
    return foot + body


def bought(d):
    lower = v2.bought(False)
    parts = {k: lower[k] for k in ('cell', 'rider')}
    atom = m.bought_parts(False)['atom'].rotate([0, 0, 180])                 # USB-C toward +x
    atom += box(ATOM[0] / 2, -USBC_PLUG[1] / 2, USBC_Z, USBC_PLUG[0], USBC_PLUG[1], USBC_PLUG[2])            # the USB-C plug
    atom += box(ATOM[0] / 2, -GROVE_PLUG[1] / 2, GROVE_Z, GROVE_PLUG[0], GROVE_PLUG[1], GROVE_PLUG[2])       # the Grove plug, under it
    parts['atom'] = atom.rotate([0, 0, d.atom_turn]).translate([d.ax, d.ay, d.ped_h])
    board = hexagon(m.HEX_FLAT, m.HEX_BOARD_T, d.hex_bot, HX, HY)
    board += cbox(HX, HY, d.hex_bot - m.HEX_UNDER, m.HEX_SOCKETS[0], m.HEX_SOCKETS[1], m.HEX_UNDER)
    parts['hex'] = board
    # The Grove cable, drawn as a 4 mm run so the check finds anything in its way: out of the Grove plug under the
    # USB-C plug, sideways out from under it (the platform is cut away there), up the +x side, to the plug that
    # stands out of the hex's side socket through the well's notch.
    u = (math.cos(math.radians(d.atom_turn)), math.sin(math.radians(d.atom_turn)))
    n = (-u[1], u[0])                                                  # to the plug's left: away from the front wall
    r0 = ATOM[0] / 2 + GROVE_PLUG[0] + 2.2
    start = (d.ax + r0 * u[0], d.ay + r0 * u[1])
    out = (start[0] + 10.5 * n[0], start[1] + 10.5 * n[1])
    lane = IN / 2 - 5.5
    z0, z1 = d.ped_h + GROVE_Z + 0.2, d.ped_h + 4.0
    px = HX + m.HEX_FLAT / 2                                           # the board's +x edge, where the side socket is
    zp = d.hex_bot - 1.0 - HEX_SIDE_PLUG[2] / 2
    path = [(start[0], start[1], z0), (out[0], out[1], z0), (lane, max(out[1] + 6.0, -6.0), z1), (lane, HY, zp), (px + HEX_SIDE_PLUG[0] + 1.0, HY, zp)]
    cable = union([hull([cyl(4.0, 4.0, a[0], a[1], a[2] - 2.0, seg=16), cyl(4.0, 4.0, b[0], b[1], b[2] - 2.0, seg=16)]) for a, b in zip(path, path[1:])])
    # and its plug in the hex's side socket, out through the notch
    parts['grove'] = cable + box(px - 3.0, HY - HEX_SIDE_PLUG[1] / 2, zp - HEX_SIDE_PLUG[2] / 2, HEX_SIDE_PLUG[0] + 3.0, HEX_SIDE_PLUG[1], HEX_SIDE_PLUG[2])
    return parts


def printed_parts(d):
    parts = {'housing': housing(d), 'platform': platform(d), 'lid': v2.lid(), 'lantern': lantern(d)}
    if d.plate: parts['plate'] = plate(d)
    else: parts['key'] = key(d)
    return parts


def pressed(d, parts):
    """The same parts with the button down: the key flush, or the plate turned on its hinge."""
    out = dict(parts)
    if d.plate:
        py, pz = d.pivot
        out['plate'] = parts['plate'].translate([0, -py, -pz]).rotate([d.turn, 0, 0]).translate([0, py, pz])
    else:
        out['key'] = parts['key'].translate([0, 0, -KEY_PROUD])
    return out


FLIPPED = {'housing', 'lantern', 'plate'}        # printed with their outside face on the bed


def build(design, write=True):
    d = dims(design)
    printed = printed_parts(d)
    out = os.path.join(HERE, OUT, design)
    print(f'{design}: {W:.0f} x {D:.0f}, {TOPZ - BOTTOM:.1f} mm to the deck, {TOPZ + d.lantern_h - BOTTOM:.1f} to the top of the light '
          f'(v2 is {m.CAP_TOP - BOTTOM:.1f}). LEDs {d.gap:.1f} mm under the lantern\'s face.')
    if write:
        os.makedirs(out, exist_ok=True)
        for name, solid in printed.items():
            flat = m.for_printing(solid, name in FLIPPED)
            m.write_stl(flat, os.path.join(out, f'{name}.stl'))
            bb = flat.bounding_box()
            print(f'  {name:9s} {bb[3] - bb[0]:6.1f} x {bb[4] - bb[1]:5.1f} x {bb[5] - bb[2]:5.1f} mm  {flat.volume() / 1000:6.1f} cm3  genus {flat.genus()}')
        for t in (0.6, 1.0, 1.4):
            m.write_stl(m.for_printing(lantern(d, t), True), os.path.join(out, f'lantern-{t:.1f}.stl'))
        if not d.plate:
            for dh in (-0.5, 0.0, 0.5):
                m.write_stl(m.for_printing(key(d, d.key_h + dh), False), os.path.join(out, f'key-{d.key_h + dh:.1f}.stl'))
    clashes = 0
    for down in (False, True):
        state = {**(pressed(d, printed) if down else printed), **bought(d)}
        names = list(state)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                overlap = (state[a] ^ state[b]).volume()
                if overlap > 0.5:
                    clashes += 1
                    print(f'  CLASH {"pressed" if down else "at rest"}: {a} / {b}  {overlap:.1f} mm3')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')
    a = ATOM[0] + 2 * CLR + 2 * ATOM_FENCE_T
    under = (printed['lid'] ^ cbox(d.ax, d.ay, LID_Z + 0.5, a, a, v2.FENCE_H - 0.6)).volume() / (v2.FENCE_H - 0.6)
    print(f'  under the Atom: {under:.0f} mm2 of full-height fence carries the press to the lid')
    if d.plate:
        print(f'  the plate turns {d.turn:.2f} degrees: {PRESS:.1f} mm at the Atom, {PRESS * INY / (INY / 2 - d.ay):.1f} at the front edge, {PRESS * (INY / 2 - HY) / (INY / 2 - d.ay):.1f} at the lantern')
    else:
        u = (math.cos(math.radians(d.atom_turn)), math.sin(math.radians(d.atom_turn)))
        tip = (d.ax + 34 * u[0], d.ay + 34 * u[1])
        print(f'  the key is {d.key_h:.1f} mm tall; pressed flush is {PRESS:.1f} mm: the switch\'s 0.3 and {PRESS - 0.3:.1f} of foam')
        print(f'  the Atom: {-d.ax:.0f} mm left of centre, turned {-d.atom_turn:.0f} degrees. Its plug ends at ({tip[0]:.1f}, {tip[1]:.1f}): {(IN / 2 - tip[0]) / u[0]:.1f} mm to the side wall along its line. The key\'s foot lands {math.hypot(d.kx - d.ax, d.ky - d.ay):.1f} mm off the panel\'s middle')
    return d, printed


if __name__ == '__main__':
    for design in DESIGNS:
        build(design)
