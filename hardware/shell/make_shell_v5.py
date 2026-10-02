"""
v5, the slab: nothing rides on the light. The bottom half is v2's, unchanged (the same lid, the cell and the Rider
side by side, the same charge window and switch slot), and everything above the platform is new. Three designs on
that one chassis, all 72 x 80 and 32.5 mm to the deck, all with a chamfered body rather than a rounded one:

  lantern    A white hexagonal lantern stands 6 mm proud of a flat top, over the hex in its well; it glows from its
             sides as well as its face. The button is a hexagonal key in the player's colour, stuck to the Atom's own
             panel with foam tape and standing a little proud: pressed flush, the finger (or a slapping palm) lands
             on the top. The top is the stop, the foam is the give.
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
             corner) and a well for the hex: a hexagonal wall with four posts the board sits on, LEDs up. The well
             keeps the light off everything else in the box. White makes the light brighter.
  lid        v2's, the same file.
  lantern    the light: a white hexagonal cup with a flange, resting on the well's rim and held down by the top.
             Three face thicknesses to try. Prints face down.
  key        lantern, beacon: the hexagonal key, three heights to try. The player's colour.

  .venv/bin/python make_shell_v5.py    ->  stl-v5/

Assembly, all right side up: lid; cell and Rider on it, plugged; platform onto the fences; Atom onto its pedestal,
hex into its well, Grove cable between them, the Atom's cable down the corner to the Rider; lantern onto the well;
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
AY = -22.0                           # the Atom's centre along the box; across it, see dims(): USB-C toward +x
KX = 0.0                             # the key, the press mark and the lantern are on the centre line
ATOM_FENCE_T, ATOM_FENCE_H = 1.5, 3.0
USBC_PLUG = v2.USBC_PLUG             # 22 long, 12 wide, 7 high: the Atom's plug
ELBOW = (10.0, 8.0)                  # a right-angle USB-C plug: how far it stands out of the Atom, and its tail   MEASURE
FOAM = 1.0                           # the tape between the Atom's panel and what presses it, uncompressed     MEASURE
PRESS = 0.8                          # how far the key (or the plate, at the Atom) travels: the switch's 0.3 and foam
HX, HY = 0.0, 13.0                   # the hex's centre

# ── the lantern ─────────────────────────────────────────────────────────────
LANTERN_F = 33.0                     # across flats, outside
LANTERN_WALL, LANTERN_FACE = 1.2, 1.0
FLANGE_FLARE, FLANGE_T = 2.5, 0.4    # the flange flares out at 45 degrees so the cup prints face down with no support
WELL_T, WELL_CLR = 1.6, 0.3

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
    d.lantern_h = {'lantern': 6.0, 'beacon': 22.0, 'keyplate': 6.0}[design]
    d.lantern_chamfer = 2.0 if design == 'beacon' else 1.0
    d.top_t = 2.4 if d.plate else 1.6                    # the plate is thicker: it is pressed anywhere
    d.under = TOPZ - d.top_t                             # the underside of the top (or the plate)
    d.top_chamfer = 1.2 if d.plate else 2.5              # an open rim cannot take the big chamfer
    # Where the Atom stands across the box. Its straight USB-C plug is 22 mm long and the side wall is 21.5 from a
    # centred Atom, so: under the keyplate, where nobody sees it, it stands 8 mm off centre with the plug Garett has;
    # under a key, which sits on the Atom, it is centred and needs a right-angle plug.
    d.ax = -8.0 if d.plate else 0.0
    d.elbow = not d.plate
    d.ped_h = d.under - (1.2 if d.plate else 1.5) - ATOM[2]          # the Atom's rim ends this far under the top
    d.rim_z = d.ped_h + ATOM[2]                          # the Atom's rim
    d.panel_z = d.rim_z - m.ATOM_BUTTON_DROP             # the top of its button panel
    # the lantern rests on the well; the top holds it down, with room for the plate to move over it
    d.flange_top = d.under - (0.9 if d.plate else 0.3)
    d.lantern_rim = d.flange_top - FLANGE_T - FLANGE_FLARE
    d.well_top = d.lantern_rim
    d.hex_top = d.well_top - 0.8                         # the LEDs, inside the well
    d.hex_bot = d.hex_top - m.HEX_BOARD_T
    d.window = LANTERN_F + (1.0 if d.plate else 0.5)     # the hole the lantern comes through
    d.gap = TOPZ + d.lantern_h - LANTERN_FACE - d.hex_top           # LEDs to the lantern's face
    d.key_h = TOPZ + KEY_PROUD - (d.panel_z + FOAM)
    # keyplate: the hinge line and how far the plate turns
    d.pivot = (INY / 2, d.under)
    d.turn = math.degrees(PRESS / (INY / 2 - AY))
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
    """What is cut into the deck (the top, or the plate): a hexagon round where you press. Nothing else."""
    ring = hexagon(KEY_RING[0] + 2 * KEY_RING[1], KEY_RING[2] + 0.01, TOPZ - KEY_RING[2], KX, AY) - hexagon(KEY_RING[0], KEY_RING[2] + 1, TOPZ - KEY_RING[2] - 0.5, KX, AY)
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
        cuts.append(hexagon(KEY_F + 0.6, d.top_t + 2, d.under - 1, KX, AY))                # the key's hole
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
    solid += cyl(FOOT_D, d.under - (d.panel_z + FOAM) + 0.01, d.ax, AY, d.panel_z + FOAM, seg=64)
    # (its front edge is further from the hinge than the Atom's middle and travels more: it is the edge that lands)
    stop_z = d.rim_z + PRESS * (INY / 2 - (AY - STOP[0] / 2)) / (INY / 2 - AY) + 0.05
    solid += cbox(d.ax, AY, stop_z, STOP[0], STOP[0], d.under - stop_z + 0.01) - cbox(d.ax, AY, stop_z - 1, STOP[1], STOP[1], d.under - stop_z + 2)
    cuts = [hexagon(d.window, d.top_t + 2, d.under - 1, HX, HY)] + deck_lines(d)
    return solid - union(cuts)


def platform(d):
    solid = v2.rbox_prism(IN - 2 * PLATFORM_CLEAR, INY - 2 * PLATFORM_CLEAR, CORNER_R - WALL - PLATFORM_CLEAR, PLATFORM_T, z=PLATFORM_Z - PLATFORM_T)
    # the Atom's pedestal, and a fence round it open toward its two sockets
    a = ATOM[0] + 2 * CLR
    solid += cbox(d.ax, AY, 0, a + 2 * ATOM_FENCE_T, a + 2 * ATOM_FENCE_T, d.ped_h)
    fence = cbox(d.ax, AY, d.ped_h, a + 2 * ATOM_FENCE_T, a + 2 * ATOM_FENCE_T, ATOM_FENCE_H)
    fence -= cbox(d.ax, AY, d.ped_h - 1, a, a, ATOM_FENCE_H + 2)
    fence -= cbox(d.ax, AY, d.ped_h - 1, a + 20, 14, ATOM_FENCE_H + 2)        # USB-C on +x, Grove on -x
    solid += fence
    # the hex's well: a hexagonal wall the lantern rests on, and four posts the board rests on
    inner = m.HEX_FLAT + 2 * WELL_CLR
    well = hexagon(inner + 2 * WELL_T, d.well_top, 0, HX, HY) - hexagon(inner, d.well_top + 2, 0, HX, HY)
    r = inner / 2
    posts = [cbox(HX + sx * (r - 0.6), HY, 0, 2.4, 4.0, d.hex_bot) for sx in (-1, 1)]               # at the two flats
    v = r / math.cos(math.radians(30))
    posts += [cbox(HX, HY + sy * (v - 1.6), 0, 4.0, 3.2, d.hex_bot) for sy in (-1, 1)]              # at two corners
    solid += well + (union(posts) ^ hexagon(inner + 0.2, d.hex_bot, 0, HX, HY))
    # a slot in the well for the hex's cable, toward the Atom's Grove side
    slot = box(-30, -5, 0.0, 30, 10, d.hex_bot - 1.0).rotate([0, 0, 60]).translate([HX, HY, 0])
    solid -= slot ^ (hexagon(inner + 2 * WELL_T + 2, d.hex_bot, 0, HX, HY) - hexagon(inner - 0.2, d.hex_bot + 1, -1, HX, HY))
    # the cable corner: cut away so the Atom's cable can go down to the Rider's USB-A
    cut_x0 = d.ax + a / 2 + ATOM_FENCE_T + 0.5
    cut_y1 = AY + a / 2 + ATOM_FENCE_T + 0.5
    solid -= box(cut_x0, -60, -PLATFORM_T - 1, 60, 60 + cut_y1, PLATFORM_T + 2)
    return solid


def lantern(d, face=LANTERN_FACE):
    """The light: a hexagonal cup, flange at its open end, resting on the well. Prints face down."""
    z1 = TOPZ + d.lantern_h
    c = d.lantern_chamfer
    outer = hull([hexagon(LANTERN_F, z1 - c - d.lantern_rim, d.lantern_rim, HX, HY), hexagon(LANTERN_F - 2 * c, 0.01, z1 - 0.01, HX, HY)])
    flange = hull([hexagon(LANTERN_F, 0.01, d.lantern_rim, HX, HY), hexagon(LANTERN_F + 2 * FLANGE_FLARE, 0.01, d.flange_top - FLANGE_T, HX, HY)])
    flange += hexagon(LANTERN_F + 2 * FLANGE_FLARE, FLANGE_T, d.flange_top - FLANGE_T, HX, HY)
    inner = hexagon(LANTERN_F - 2 * LANTERN_WALL, z1 - face - d.lantern_rim + 1, d.lantern_rim - 1, HX, HY)
    return outer + flange - inner


def key(d, h=None):
    """The key: a hexagon with a chamfered top, on the foam on the Atom's panel."""
    h = d.key_h if h is None else h
    z0, c = d.panel_z + FOAM, 0.6
    return hull([hexagon(KEY_F, h - c, z0, KX, AY), hexagon(KEY_F - 2 * c, 0.01, z0 + h - 0.01, KX, AY)])


def bought(d):
    lower = v2.bought(False)
    parts = {k: lower[k] for k in ('cell', 'rider')}
    atom = m.bought_parts(False)['atom'].rotate([0, 0, 180])                 # USB-C toward +x
    if d.elbow:      # a right-angle plug: a short body, then the cable's root turned toward the cable corner
        atom += box(ATOM[0] / 2, -USBC_PLUG[1] / 2, 1.2, ELBOW[0], USBC_PLUG[1], USBC_PLUG[2])
        atom += box(ATOM[0] / 2 + ELBOW[0] - USBC_PLUG[2], -USBC_PLUG[1] / 2 - ELBOW[1], 1.2, USBC_PLUG[2], ELBOW[1] + 1, USBC_PLUG[2])
    else:
        atom += box(ATOM[0] / 2, -USBC_PLUG[1] / 2, 1.2, USBC_PLUG[0], USBC_PLUG[1], USBC_PLUG[2])     # the real plug
    atom += box(-ATOM[0] / 2 - 9, -5, 2.5, 9, 10, 5)                         # and the Grove plug on the other side
    parts['atom'] = atom.translate([d.ax, AY, d.ped_h])
    board = hexagon(m.HEX_FLAT, m.HEX_BOARD_T, d.hex_bot, HX, HY)
    board += cbox(HX, HY, d.hex_bot - m.HEX_UNDER, m.HEX_SOCKETS[0], m.HEX_SOCKETS[1], m.HEX_UNDER)
    parts['hex'] = board
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
    under = (printed['lid'] ^ cbox(d.ax, AY, LID_Z + 0.5, a, a, v2.FENCE_H - 0.6)).volume() / (v2.FENCE_H - 0.6)
    print(f'  under the Atom: {under:.0f} mm2 of full-height fence carries the press to the lid')
    if d.plate:
        print(f'  the plate turns {d.turn:.2f} degrees: {PRESS:.1f} mm at the Atom, {PRESS * INY / (INY / 2 - AY):.1f} at the front edge, {PRESS * (INY / 2 - HY) / (INY / 2 - AY):.1f} at the lantern')
    else:
        print(f'  the key is {d.key_h:.1f} mm tall; pressed flush is {PRESS:.1f} mm: the switch\'s 0.3 and {PRESS - 0.3:.1f} of foam')
    return d, printed


if __name__ == '__main__':
    for design in DESIGNS:
        build(design)
