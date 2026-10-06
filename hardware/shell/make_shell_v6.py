"""
v6, the cap on a bought switch (2026-10-05). The first game showed the system works and the press is the weak
part: the cap rode on the AtomS3's own tactile dome through a printed cage, peg and flexures, and the flexures
broke. Here nothing printed bends and nothing hangs inside the cap. The cap rides on an M5 Mechanical Key Unit, a
keyboard switch in a Grove case: its spring returns the cap, its click is the click, its own end stop is the stop,
and a keyboard switch takes a slap all day. The printed parts only guide. It is the Printables "big red button"
(a bought button under a printed top that is closed by a floor with three legs, electronics in a box) with our flat
cap and the hex riding inside it.

  housing   v2's box, 72 x 80 with rounded corners, 9 mm deeper: the cell and the Rider lie side by side on the
            lid as before, and the Atom now hangs under the platform above the Rider. Prints upside down.
  lid       v2's lid with taller fences; they carry the platform.
  platform  a plate across the box: the Key Unit stands on it in the middle on two pegs; three hollow bosses round
            the key take the floor's legs; the Grove splitter sits at the back; the cradle screws on underneath.
  cradle    a tray screwed under the platform that the Atom slides into, face down, both its plugs toward the
            Rider's cable end. Two M3 screws, down through the platform.
  floor     closes the cap from below, as the Printables dome's floor does: a disc that pushes up into the cap's
            skirt against a step (a dab of glue), three legs down into the platform's bosses (the guide), and its
            middle resting on the keycap (the pusher). Prints legs up.
  stand     a three-armed spider that drops into a recess on the floor's top (a dab of glue), with a post at the end
            of each arm that the hex stands on, a peg into each of its ear holes. Prints posts up. (One part with
            the floor would have had towers on both faces and no face for the bed.)
  cap       the mini's cap profile with no sleeve and no cage sockets: just the shell, four short blocks on the
            ceiling that keep the hex on its posts, and the step inside the skirt the floor pushes up against.

  .venv/bin/python make_shell_v6.py    ->  stl-v6/

The press. At rest the cap hangs on the housing's lip with the floor just touching the keycap (no preload). A
press moves the keycap: the switch clicks at about 2 mm and bottoms out at about 4 (MEASURE both), and that is
the stop, through the switch, its case, the platform, the fences and the lid. The floor lands on the bosses
STOP_BELOW_LIP down as a backstop. If the switch's spring turns out too weak to lift the cap, hex and floor
(about 35 g; a blue switch starts at about 35 g), swap the switch for a heavier one: the Key Unit takes any
MX-style switch.

The guide. Three legs in three holes, like the dome's: a plunger binds when it is pressed more than half its
guide length over the friction coefficient off centre, so the legs are long: 12 mm bosses above the platform,
the platform, and 6 mm below it (two of them, over the cell, which is far down in this deeper box), 19.6 mm at rest. Dry PTFE
on the legs if a corner press ever sticks, as on v2's collar.

Cables, all Grove: the hex's plug comes down through a slot in the floor, out under the cap's skirt, and round to
the splitter at the back; the key's cable leaves its case at the front and goes round the other side; the Atom's
Grove cable comes up through a slot in the platform at the +x, -y corner. The Atom's USB-C and the Rider's USB-A
both point at the -y wall, one above the other, and a short cable makes a U between them. Charging is the
Rider's USB-C in the window, as v2.

Assembly: Atom into the cradle (plugs toward -y), cradle screwed under the platform; key on its pegs, cable round
to the splitter; hex onto the floor's posts with its plug through the slot, floor up into the cap (glue); cap into
the housing from below (upside down), its legs into the bosses; platform in; hex cable out to the splitter; lid.

Millimetres; z = 0 at the platform's top; the Key Unit's cable leaves toward -y.
"""
import importlib.util
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, path))
    mod = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, ['x']
    spec.loader.exec_module(mod)
    sys.argv = argv
    return mod


v2 = _load('v2', 'make_shell_v2.py')
m = v2.m                                   # the mini: helpers and bought-part sizes
cyl, box, cbox, union, revolve = m.cyl, m.box, m.cbox, m.union, m.revolve

OUT = 'stl-v6'

# ── the switch ──────────────────────────────────────────────────────────────
KEY = m.KEY_BODY                           # (24, 40, 8): the Key Unit's case, its socket on the -y end
KEY_Y0 = -m.KEY_CAP_FROM_SOCKET            # -28: the case's -y end; the keycap is centred at the origin
KEYCAP_TOP = m.KEYCAP[1]                   # 16.3 above the platform
KEYCAP_W = m.KEYCAP[0]                     # 18 at its base
SWITCH_HOUSING = (15.6, 9.4)               # the switch's upper housing: square, and its top above the case's bottom   MEASURE
SWITCH_TRAVEL = 4.0                        # keycap top, rest to bottomed out                                        MEASURE
SWITCH_CLICK = 2.0                         # and to the click                                                         MEASURE
STOP_BELOW_LIP = SWITCH_TRAVEL + 0.4       # the floor lands on the bosses here if the switch has not already stopped it
PRESS_GAP = 0.1                            # floor to keycap at rest: as near zero preload as a print allows
KEY_PEG_D, KEY_PEG_H = 4.5, 2.5            # into the case's two 4.85 mm holes
KEY_PLUG = m.KEY_PLUG                      # 8: the cable's plug past the socket end

# ── the floor, and the stack above it ───────────────────────────────────────
FLOOR_T = 2.5
FLOOR_Z0 = KEYCAP_TOP + PRESS_GAP          # its underside, 16.4: the pusher
FLOOR_Z1 = FLOOR_Z0 + FLOOR_T
FLOOR_FIT = 0.1                            # radial, floor to the skirt's wider bore below the step
STEP = 0.6                                 # the skirt is this much thinner below the step
POST_D, PEG_D, PEG_H = 3.6, 1.8, 1.5       # three posts under the hex's ear holes (2 mm), pegs into them; thin, beside the sockets' block
STAND_T, STAND_ARM_W, STAND_RECESS, STAND_FIT = 2.0, 6.0, 0.6, 0.15   # the spider: thickness, arm width, how deep it sits in the floor, play
POST_ANGLES = (90, 210, 330)               # the hex's corners
HEX_BOTTOM = FLOOR_Z1 + STAND_T - STAND_RECESS + 0.3 + m.HEX_UNDER   # the hex's sockets clear the stand's arms
HEX_TOP = HEX_BOTTOM + m.HEX_BOARD_T
INNER_TOP = HEX_TOP + m.LED_GAP
CAP_TOP = INNER_TOP + m.CAP_TOP_T
HOLD_H = INNER_TOP - (HEX_TOP + 0.3)       # the ceiling blocks reach down to just above the board
CABLE_SLOT = (14.0, 8.0, 0.0, -11.0)       # sx, sy, cx, cy: through the floor, for the hex's plug, between two arms of the stand; turn the hex to suit
LEG_D, LEG_R, LEG_ANGLES = 5.5, 21.0, (96, 216, 336)      # turned 6 degrees so the back leg clears the cell's fence
LEG_HOLE_D = 6.0
LEG_BOTTOM = {96: -6.0, 216: -6.0, 336: 1.5}    # below the platform: two reach down over the cell; the third stops inside its
                                           # boss, since the Atom's plugs are under the platform there
BOSS_D, BOSS_H = 9.5, 12.0                 # hollow bosses on the platform; the floor lands on them as the backstop

# ── the box ─────────────────────────────────────────────────────────────────
ATOM = m.ATOM                              # (24, 24, 9.5), hanging face down under the platform
CRADLE_T = 1.2                             # the tray's plate against the platform's underside, and its walls
CRADLE_PLAY = 0.3                          # round the Atom
CRADLE_LIP = 0.5                           # the -x wall's bottom edge turns in this much: the Atom clicks past it
CRADLE_PAD = (7.0, 3.0)                    # screw pads under the plate: diameter, height
ATOM_X0, ATOM_Y0 = 8.0, -4.0               # the Atom's -x, -y corner (it sits over the Rider; plugs out of its -y face)
ATOM_Z1 = -v2.PLATFORM_T - CRADLE_T - 0.2  # its top (its base, since it is face down)
ATOM_Z0 = ATOM_Z1 - ATOM[2]
CRADLE_X = (6.5, 32.8)                     # the plate; the tray's +x side is open, the housing's wall is 1 mm away
CRADLE_Y = (-5.5, 30.0)
CRADLE_SCREWS = ((16.0, 28.0), (29.0, 28.0))
GROVE_SLOT = (14.0, -32.0, 12.0, 12.0)     # x0, y0, sx, sy: the Atom's Grove cable comes up here
SPLITTER = (24.0, 12.0, 8.0)               # Unit Hub 1-to-3, lying along x at the back                          MEASURE
SPLITTER_AT = (-18.0, 30.0)                # its centre, on a strip of tape; sockets on its ends, so plugs stand out along x
COMP_H = (-ATOM_Z0 + 0.5) + m.RIDER[2] + 0.3 - v2.PLATFORM_T    # the Rider's jack under the hanging Atom: 20.0

# v2's box, deeper. Its functions read these at call time.
v2.COMP_H = COMP_H
v2.LID_Z = v2.PLATFORM_Z - v2.PLATFORM_T - COMP_H
v2.BOTTOM = v2.LID_Z - v2.LID_T
v2.FENCE_H = COMP_H - 0.3

assert BOSS_H < FLOOR_Z0 - SWITCH_TRAVEL, 'the floor must clear the bosses until the switch has bottomed'
assert LEG_R + LEG_D / 2 < m.CAP_R - m.CAP_WALL - STEP - 1, 'the legs must stand inside the floor'


def cap():
    """The mini's cap profile: flat top, 45-degree shoulder, skirt, flange. No sleeve. Inside: a step the floor pushes up
    against, and four blocks on the ceiling that keep the hex down on its posts."""
    k = m.CAP_WALL * math.sqrt(2)
    inner_r = m.CAP_R - m.CAP_WALL
    shoulder_z = CAP_TOP - m.CAP_CHAMFER
    inner_shoulder_z = shoulder_z - k + m.CAP_WALL
    fb, fl, fw = m.FLANGE_BOTTOM, m.FLANGE_LAND, m.FLANGE_W
    shell = revolve([
        (0, CAP_TOP), (m.CAP_R - m.CAP_CHAMFER, CAP_TOP), (m.CAP_R, shoulder_z),
        (m.CAP_R, fb + fl + fw), (m.FLANGE_R, fb + fl), (m.FLANGE_R, fb),
        (inner_r + STEP, fb), (inner_r + STEP, FLOOR_Z1), (inner_r, FLOOR_Z1), (inner_r, inner_shoulder_z),
        (inner_r - (INNER_TOP - inner_shoulder_z), INNER_TOP), (0, INNER_TOP)])
    w, t = m.CAGE_LEG
    blocks = union(box(m.CAGE_R0 - 2.5, -w / 2 - 1, INNER_TOP - HOLD_H, t + 2.5, w + 2, HOLD_H + 0.01).rotate([0, 0, a]) for a in m.CAGE_ANGLES)
    return shell + (blocks ^ cyl(2 * (inner_r - 0.3), 60, z=0, seg=m.SEG))


def _spider(grow, z0, h):
    arms = [box(0, -STAND_ARM_W / 2 - grow, z0, m.HEX_EAR_R + POST_D / 2 + grow, STAND_ARM_W + 2 * grow, h).rotate([0, 0, a]) for a in POST_ANGLES]
    return union(arms + [cyl(STAND_ARM_W + 2 * grow + 2, h, z=z0, seg=48)])


def stand():
    z0 = FLOOR_Z1 - STAND_RECESS
    solid = _spider(0.0, z0, STAND_T)
    for a in POST_ANGLES:
        x, y = m.HEX_EAR_R * math.cos(math.radians(a)), m.HEX_EAR_R * math.sin(math.radians(a))
        solid += cyl(POST_D, HEX_BOTTOM - z0 - STAND_T + 0.01, x, y, z0 + STAND_T - 0.01, seg=32)
        solid += cyl(PEG_D, HEX_BOTTOM - z0 - STAND_T + PEG_H, x, y, z0 + STAND_T - 0.01, seg=24)
    return solid


def floor():
    r = m.CAP_R - m.CAP_WALL + STEP - FLOOR_FIT
    disc = cyl(2 * r, FLOOR_T, z=FLOOR_Z0, seg=m.SEG) - _spider(STAND_FIT, FLOOR_Z1 - STAND_RECESS, STAND_RECESS + 1)
    parts = [disc]
    for a in LEG_ANGLES:
        x, y = LEG_R * math.cos(math.radians(a)), LEG_R * math.sin(math.radians(a))
        zb = LEG_BOTTOM[a]
        parts.append(cyl(LEG_D, FLOOR_Z0 + 0.01 - zb - 1.0, x, y, zb + 1.0, seg=48))
        parts.append(cyl(LEG_D - 1.6, 1.0, x, y, zb, d2=LEG_D, seg=48))                  # a chamfered tip finds its hole
    sx, sy, cx, cy = CABLE_SLOT
    return union(parts) - cbox(cx, cy, FLOOR_Z0 - 1, sx, sy, FLOOR_T + 2)


def platform():
    solid = v2.rbox_prism(v2.IN - 2 * v2.PLATFORM_CLEAR, v2.INY - 2 * v2.PLATFORM_CLEAR, v2.CORNER_R - v2.WALL - v2.PLATFORM_CLEAR,
                          v2.PLATFORM_T, z=-v2.PLATFORM_T)
    for sx in (-1, 1):                                                   # the key's pegs
        solid += cyl(KEY_PEG_D, KEY_PEG_H, sx * m.KEY_HOLES[0] / 2, KEY_Y0 + m.KEY_HOLES[1], 0, seg=32)
    cuts = []
    for a in LEG_ANGLES:                                                 # the bosses, and the holes through them and the plate
        x, y = LEG_R * math.cos(math.radians(a)), LEG_R * math.sin(math.radians(a))
        solid += cyl(BOSS_D, BOSS_H, x, y, 0, seg=48) + cyl(BOSS_D + 1.5, 0.8, x, y, 0, d2=BOSS_D, seg=48)   # a small fillet; the key is close
        cuts.append(cyl(LEG_HOLE_D, BOSS_H + v2.PLATFORM_T + 2, x, y, -v2.PLATFORM_T - 1, seg=48))
    cuts.append(box(GROVE_SLOT[0], GROVE_SLOT[1], -v2.PLATFORM_T - 1, GROVE_SLOT[2], GROVE_SLOT[3], v2.PLATFORM_T + 2))
    cuts += [cyl(m.M3_CLEAR_D, v2.PLATFORM_T + 2, x, y, -v2.PLATFORM_T - 1, seg=24) for x, y in CRADLE_SCREWS]
    return solid - union(cuts)


def cradle():
    """Drawn in place, hanging under the platform; prints walls-up."""
    x0, x1 = CRADLE_X
    y0, y1 = CRADLE_Y
    z1 = -v2.PLATFORM_T
    plate = box(x0, y0, z1 - CRADLE_T, x1 - x0, y1 - y0, CRADLE_T)
    ax0, ay0 = ATOM_X0 - CRADLE_PLAY, ATOM_Y0 - CRADLE_PLAY
    aw, ad = ATOM[0] + 2 * CRADLE_PLAY, ATOM[1] + 2 * CRADLE_PLAY
    wall_h = ATOM[2] + 0.4 + CRADLE_T
    # two sides: the -x wall (with a lip along its bottom edge the Atom clicks past) and the +y wall. Open toward -y for the
    # plugs, and toward +x, where the housing's wall is a millimetre away and does the holding.
    walls = box(ax0 - CRADLE_T, ay0, ATOM_Z0 - 0.4, aw + CRADLE_T, ad + CRADLE_T, wall_h)
    walls -= box(ax0, ay0 - 1, ATOM_Z0 - 0.4 - 1, aw + 1, ad + 1, wall_h + 2)
    lips = box(ax0 - 0.01, ay0 + 2, ATOM_Z0 - 0.4, CRADLE_LIP + 0.01, ad - 4, 0.4)
    pads = union(cyl(CRADLE_PAD[0], CRADLE_PAD[1], x, y, z1 - CRADLE_T - CRADLE_PAD[1], seg=32) for x, y in CRADLE_SCREWS)
    cuts = union(cyl(m.TAP_D, CRADLE_T + CRADLE_PAD[1] + 2, x, y, z1 - CRADLE_T - CRADLE_PAD[1] - 1, seg=24) for x, y in CRADLE_SCREWS)
    return plate + walls + lips + pads - cuts


def bought(pressed=False):
    dz = -SWITCH_TRAVEL if pressed else 0.0
    parts = {k: v for k, v in v2.bought().items() if k in ('cell', 'rider')}
    case = cbox(0, KEY_Y0 + KEY[1] / 2, 0, KEY[0], KEY[1], KEY[2])
    case += cbox(0, 0, KEY[2] - 0.01, SWITCH_HOUSING[0], SWITCH_HOUSING[0], SWITCH_HOUSING[1] - KEY[2] + 0.01)
    case += cbox(0, KEY_Y0 - KEY_PLUG / 2, 1.0, 10.0, KEY_PLUG, 6.0)                   # the cable's plug
    case -= union(cyl(4.85, 4, sx * m.KEY_HOLES[0] / 2, KEY_Y0 + m.KEY_HOLES[1], -1, seg=24) for sx in (-1, 1))
    parts['key'] = case
    parts['keycap'] = cbox(0, 0, KEYCAP_TOP - m.KEYCAP_H + dz, KEYCAP_W, KEYCAP_W, m.KEYCAP_H - (KEYCAP_W - m.KEYCAP_TOP_W) / 2) \
        + cbox(0, 0, KEYCAP_TOP - (KEYCAP_W - m.KEYCAP_TOP_W) / 2 + dz, m.KEYCAP_TOP_W, m.KEYCAP_TOP_W, (KEYCAP_W - m.KEYCAP_TOP_W) / 2)
    hexboard = m.CrossSection.circle(m.HEX_FLAT / 2 / math.cos(math.radians(30)), 6).rotate(30).extrude(m.HEX_BOARD_T).translate([0, 0, HEX_BOTTOM + dz])
    hexboard -= union(cyl(2.0, 4, m.HEX_EAR_R * math.cos(math.radians(a)), m.HEX_EAR_R * math.sin(math.radians(a)), HEX_BOTTOM - 1 + dz, seg=16) for a in POST_ANGLES)
    hexboard += cbox(0, 0, HEX_BOTTOM - m.HEX_UNDER + dz, m.HEX_SOCKETS[0], m.HEX_SOCKETS[1], m.HEX_UNDER)
    parts['hex'] = hexboard
    atom = box(ATOM_X0, ATOM_Y0, ATOM_Z0, *ATOM)
    atom += cbox(ATOM_X0 + ATOM[0] / 2, ATOM_Y0 - v2.USBC_PLUG[0] / 2, ATOM_Z0 + 0.3, v2.USBC_PLUG[1], v2.USBC_PLUG[0], ATOM[2] - 0.6)   # both plugs, as one block
    parts['atom'] = atom
    parts['splitter'] = cbox(*SPLITTER_AT, 0, *SPLITTER)
    return parts


def printed_parts():
    return {'housing': v2.housing(), 'platform': platform(), 'cradle': cradle(), 'lid': v2.lid(), 'floor': floor(), 'stand': stand(), 'cap': cap()}


def _meets(a, b):
    """How far a drops before it lands on b."""
    d = 0.0
    while d < 12 and (a.translate([0, 0, -d]) ^ b).volume() < 0.05:
        d += 0.05
    return d


def check_and_write(printed, flipped, out_dir, label):
    os.makedirs(out_dir, exist_ok=True)
    for name, solid in printed.items():
        out = m.for_printing(solid, name in flipped)
        m.write_stl(out, os.path.join(out_dir, f'{name}.stl'))
        bb = out.bounding_box()
        print(f'  {name:9s} {bb[3] - bb[0]:6.1f} x {bb[4] - bb[1]:5.1f} x {bb[5] - bb[2]:5.1f} mm  {out.volume() / 1000:6.1f} cm3  genus {out.genus()}')
    clashes = 0
    for pressed in (False, True):
        state = {**printed, **bought(pressed)}
        drop = SWITCH_TRAVEL if pressed else 0.0
        for k in ('cap', 'floor', 'stand'):
            state[k] = state[k].translate([0, 0, -drop])
        names = list(state)
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                if {a, b} == {'key', 'keycap'}:
                    continue                             # the keycap's skirt sits round the switch's housing
                overlap = (state[a] ^ state[b]).volume()
                if overlap > 0.5:
                    clashes += 1
                    print(f'  CLASH {"pressed" if pressed else "at rest"}: {a} / {b}  {overlap:.1f} mm3')
    to_boss = _meets(printed['floor'], printed['platform'])
    print(f'  press: floor {PRESS_GAP:.1f} above the keycap at rest; clicks at {SWITCH_CLICK:.1f}, the switch stops at {SWITCH_TRAVEL:.1f}, '
          f'the floor would land on the bosses at {to_boss:.2f}; legs in their holes {BOSS_H + v2.PLATFORM_T - min(LEG_BOTTOM.values()):.1f} at rest')
    if to_boss < SWITCH_TRAVEL + 0.1:
        clashes += 1
        print('  PROBLEM: the bosses catch the floor before the switch bottoms')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')
    colours = {'housing': '#3a3a40', 'platform': '#55555c', 'cradle': '#6a4a7a', 'lid': '#2a2a2e', 'floor': '#8a8a92', 'stand': '#b0b0b8', 'cap': '#ffffff',
               'hex': '#2e7d32', 'key': '#e8e8e8', 'keycap': '#c62828', 'atom': '#1a3a6e', 'cell': '#8a8a55', 'rider': '#1b5e20', 'splitter': '#d8d8d8'}
    everything = dict(printed)
    everything.update(bought())
    m.section_svg(everything, colours, os.path.join(HERE, f'section-{label}-front.svg'), 'xz')
    m.section_svg(everything, colours, os.path.join(HERE, f'section-{label}-side.svg'), 'yz')


if __name__ == '__main__':
    print(f'v6 box: {v2.W:.0f} x {v2.D:.0f} mm, {CAP_TOP - v2.BOTTOM:.1f} mm tall to the cap, housing {v2.TOP - v2.BOTTOM:.1f} mm, '
          f'cap shows {CAP_TOP - v2.TOP:.1f} above the lip ({CAP_TOP - v2.TOP - SWITCH_TRAVEL:.1f} pressed)')
    check_and_write(printed_parts(), {'housing', 'cap', 'cradle'}, os.path.join(HERE, OUT), OUT)   # the floor prints legs up as drawn; the stand posts up
