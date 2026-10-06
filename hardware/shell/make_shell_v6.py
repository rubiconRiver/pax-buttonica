"""
v6, the cap on a bought switch (2026-10-05). The first game showed the system works and the press is the weak
part: the cap rode on the AtomS3's own tactile dome through a printed cage, peg and flexures, and the flexures
broke. Here nothing printed bends. The cap rides on an M5 Mechanical Key Unit, a keyboard switch in a Grove case:
its spring returns the cap, its click is the click, its own end stop is the stop, and a keyboard switch takes a
slap all day. The printed parts only guide. It is the Printables "big red button" idea (a bought button under a
printed cap, electronics in a box) with our flat cap and the hex riding inside it.

  housing   v2's box, 72 x 80 with rounded corners, 9 mm deeper: the cell and the Rider lie side by side on the
            lid as before, and the Atom now hangs under the platform above the Rider. Prints upside down.
  lid       v2's lid with taller fences; they carry the platform.
  platform  a plate across the box: the Key Unit stands on it in the middle on two pegs, the collar that guides
            the cap's sleeve stands round the key (with a gap where the key's case and its cable pass), the Grove
            splitter sits at the back, and the cradle screws on underneath.
  cradle    a tray screwed under the platform that the Atom slides into, face down, both its plugs toward the
            Rider's cable end. Two M3 screws, down through the platform.
  carrier   replaces the cage: four legs that push up into the cap's sockets and hold the hex on ledges, a ring
            round the keycap, and a bar across the ring that presses the keycap's top. No disc, no peg, no arms.
  cap       the mini's cap, 3.4 mm taller inside, since the hex sits above the bar.

  .venv/bin/python make_shell_v6.py    ->  stl-v6/

The press. At rest the cap hangs on the housing's lip with the bar just touching the keycap (no preload). A
press moves the keycap: the switch clicks at about 2 mm and bottoms out at about 4 (MEASURE both), and that is
the stop, through the switch, its case, the platform, the fences and the lid. The collar catches the cap's
ceiling STOP_BELOW_LIP down as a backstop. If the switch's spring turns out too weak to lift the cap, hex and
carrier (about 30 g; a blue switch starts at about 35 g), swap the switch for a heavier one: the Key Unit takes
any MX-style switch.

Cables, all Grove: the hex's plug comes down through the carrier's ring beside the keycap, out under the cap's
sleeve through the collar's gap at the front (-y), and round the collar to the splitter at the back; the key's
cable leaves its case at the front and goes round the other side; the Atom's Grove cable comes up through a slot
in the platform at the +x, -y corner. The Atom's USB-C and the Rider's USB-A both point at the -y wall, one above
the other, and a short cable makes a U between them. Charging is the Rider's USB-C in the window, as v2.

Assembly: Atom into the cradle (plugs toward -y), cradle screwed under the platform; key on its pegs, cable round
the collar to the splitter; hex into the carrier's ledges, carrier up into the cap; cap into the housing from
below (upside down), platform in with the key up into the cap, hex cable out the front gap to the splitter;
lid as v2.

Millimetres; z = 0 at the platform's top; the Key Unit's cable leaves toward -y.
"""
import importlib.util
import math
import os
import sys

from manifold3d import Manifold

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, path))
    mod = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, ['x']
    spec.loader.exec_module(mod)
    sys.argv = argv
    return mod


v2 = _load('v2', 'make_shell_v2.py')
m = v2.m                                   # the mini: cap, collar, helpers, bought-part sizes
cyl, box, cbox, union = m.cyl, m.box, m.cbox, m.union

OUT = 'stl-v6'

# ── the switch ──────────────────────────────────────────────────────────────
KEY = m.KEY_BODY                           # (24, 40, 8): the Key Unit's case, its socket on the -y end
KEY_Y0 = -m.KEY_CAP_FROM_SOCKET            # -28: the case's -y end; the keycap is centred at the origin
KEYCAP_TOP = m.KEYCAP[1]                   # 16.3 above the platform
KEYCAP_W = m.KEYCAP[0]                     # 18 at its base
SWITCH_HOUSING = (15.6, 9.4)               # the switch's upper housing: square, and its top above the case's bottom   MEASURE
SWITCH_TRAVEL = 4.0                        # keycap top, rest to bottomed out                                        MEASURE
SWITCH_CLICK = 2.0                         # and to the click                                                         MEASURE
STOP_BELOW_LIP = SWITCH_TRAVEL + 0.3       # the collar catches the cap here if the switch has not already
PRESS_GAP = 0.1                            # bar to keycap at rest: as near zero preload as a print allows
KEY_PEG_D, KEY_PEG_H = 4.5, 2.5            # into the case's two 4.85 mm holes
KEY_PLUG = m.KEY_PLUG                      # 8: the cable's plug past the socket end

# ── the carrier (the cage without its middle) and the stack above it ────────
PAD_BOTTOM = m.PAD_BOTTOM                  # 12.5: the ring's underside, as the cage's plate was
PAD_T = m.PAD_T                            # 2.5
RING_R0 = 14.0                             # the ring's hole: the keycap (9), the switch housing (11) and a cable pass
BAR_W, BAR_T = 12.0, 2.0                   # the bar across the ring that presses the keycap
BAR_Z0 = KEYCAP_TOP + PRESS_GAP            # its underside, 16.4
PLATE_CLEAR = m.PLATE_CLEAR                # 0.2: the ring, fully pressed, stays this far above the key's case
HEX_BOTTOM = BAR_Z0 + BAR_T + 0.3 + m.HEX_UNDER      # the hex's sockets clear the bar
HEX_TOP = HEX_BOTTOM + m.HEX_BOARD_T
INNER_TOP = HEX_TOP + m.LED_GAP
CAP_TOP = INNER_TOP + m.CAP_TOP_T

# ── the box ─────────────────────────────────────────────────────────────────
ATOM = m.ATOM                              # (24, 24, 9.5), hanging face down under the platform
CRADLE_T = 1.2                             # the tray's plate against the platform's underside, and its walls
CRADLE_PLAY = 0.3                          # round the Atom
CRADLE_LIP = 0.5                           # the walls' bottom edges turn in this much: the Atom clicks past them
CRADLE_PAD = (7.0, 3.0)                    # screw pads under the plate: diameter, height
ATOM_X0, ATOM_Y0 = 8.0, -8.0               # the Atom's -x, -y corner (it sits over the Rider; plugs out of its -y face)
ATOM_Z1 = -v2.PLATFORM_T - CRADLE_T - 0.2  # its top (its base, since it is face down)
ATOM_Z0 = ATOM_Z1 - ATOM[2]
CRADLE_X = (6.5, 32.8)                     # the plate; the tray's +x side is open, the housing's wall is 1 mm away
CRADLE_Y = (-9.5, 26.0)
CRADLE_SCREWS = ((16.0, 24.0), (29.0, 24.0))
GROVE_SLOT = (14.0, -32.0, 12.0, 12.0)     # x0, y0, sx, sy: the Atom's Grove cable comes up here
SPLITTER = (24.0, 12.0, 8.0)               # Unit Hub 1-to-3, lying along x at the back                          MEASURE
SPLITTER_AT = (-6.0, 30.0)                 # its centre; sockets on its ends, so plugs stand out along x. It sits between the collar and
                                           # the back wall, on a strip of tape: there is no room for a fence of its own
COMP_H = (-ATOM_Z0 + 0.5) + m.RIDER[2] + 0.3 - v2.PLATFORM_T    # the Rider's jack under the hanging Atom: 20.0
COLLAR_GAP = (230, 310)                    # where the key's case and cable cross the collar's circle

# v2's box, deeper. Its functions read these at call time.
v2.COMP_H = COMP_H
v2.LID_Z = v2.PLATFORM_Z - v2.PLATFORM_T - COMP_H
v2.BOTTOM = v2.LID_Z - v2.LID_T
v2.FENCE_H = COMP_H - 0.3

# the mini's cap and collar, read at call time too
m.HEX_BOTTOM, m.HEX_TOP, m.INNER_TOP, m.CAP_TOP = HEX_BOTTOM, HEX_TOP, INNER_TOP, CAP_TOP
m.COLLAR_GAPS = ((0, 1),)                  # the cap's sleeve: a full ring, nothing stands up into it any more


def cap():
    return m.cap()


def _collar(h):
    m.COLLAR_H = h
    g = m.COLLAR_GAPS
    m.COLLAR_GAPS = (COLLAR_GAP,)
    c = m.collar()
    m.COLLAR_GAPS = g
    return c


def _meets(cap_solid, collar_solid):
    """How far the cap drops from the lip before its ceiling lands on the collar."""
    d = 0.0
    while d < 10 and (cap_solid.translate([0, 0, -d]) ^ collar_solid).volume() < 0.05:
        d += 0.05
    return d


def collar_height():
    """The collar catches the cap STOP_BELOW_LIP + 0.1 below the lip: a hair past the switch's own stop."""
    c = cap()
    lo, hi = 6.0, INNER_TOP
    for _ in range(14):
        mid = (lo + hi) / 2
        if _meets(c, _collar(mid)) > STOP_BELOW_LIP + 0.1:
            lo = mid
        else:
            hi = mid
    return lo


COLLAR_H = collar_height()


def platform():
    solid = v2.rbox_prism(v2.IN - 2 * v2.PLATFORM_CLEAR, v2.INY - 2 * v2.PLATFORM_CLEAR, v2.CORNER_R - v2.WALL - v2.PLATFORM_CLEAR,
                          v2.PLATFORM_T, z=-v2.PLATFORM_T)
    solid += _collar(COLLAR_H)
    for sx in (-1, 1):                                                   # the key's pegs
        solid += cyl(KEY_PEG_D, KEY_PEG_H, sx * m.KEY_HOLES[0] / 2, KEY_Y0 + m.KEY_HOLES[1], 0, seg=32)
    cuts = [box(GROVE_SLOT[0], GROVE_SLOT[1], -v2.PLATFORM_T - 1, GROVE_SLOT[2], GROVE_SLOT[3], v2.PLATFORM_T + 2)]
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


def carrier():
    w, t = m.CAGE_LEG
    top = INNER_TOP - 0.8
    parts = []
    for a in m.CAGE_ANGLES:
        leg = box(m.CAGE_R0, -w / 2, PAD_BOTTOM, t, w, top - PAD_BOTTOM)
        leg += box(m.CAGE_R0 - m.LEDGE, -w / 2, HEX_BOTTOM - 0.3 - 1.2, m.LEDGE + 0.01, w, 1.2)
        parts.append(leg.rotate([0, 0, a]))
    ring_r = m.CAGE_R0 + t
    ring = cyl(2 * ring_r, PAD_T, z=PAD_BOTTOM, seg=m.SEG) - cyl(2 * RING_R0, PAD_T + 2, z=PAD_BOTTOM - 1, seg=m.SEG)
    # the bar: across the ring on blocks, its underside PRESS_GAP above the keycap's top
    bar = cbox(0, 0, BAR_Z0, 2 * ring_r, BAR_W, BAR_T)
    blocks = cbox(0, 0, PAD_BOTTOM + PAD_T - 0.01, 2 * ring_r, BAR_W, BAR_Z0 - (PAD_BOTTOM + PAD_T) + 0.02) - cyl(2 * RING_R0, 20, z=PAD_BOTTOM, seg=m.SEG)
    bar = (bar + blocks) ^ cyl(2 * ring_r, 60, z=0, seg=m.SEG)
    return union(parts + [ring, bar])


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
    hexboard += cbox(0, 0, HEX_BOTTOM - m.HEX_UNDER + dz, m.HEX_SOCKETS[0], m.HEX_SOCKETS[1], m.HEX_UNDER)
    parts['hex'] = hexboard
    atom = box(ATOM_X0, ATOM_Y0, ATOM_Z0, *ATOM)
    atom += cbox(ATOM_X0 + ATOM[0] / 2, ATOM_Y0 - v2.USBC_PLUG[0] / 2, ATOM_Z0 + 0.3, v2.USBC_PLUG[1], v2.USBC_PLUG[0], ATOM[2] - 0.6)   # both plugs, as one block
    parts['atom'] = atom
    parts['splitter'] = cbox(*SPLITTER_AT, 0, *SPLITTER)
    return parts


def printed_parts():
    return {'housing': v2.housing(), 'platform': platform(), 'cradle': cradle(), 'lid': v2.lid(), 'carrier': carrier(), 'cap': cap()}


def check_and_write(printed, flipped, out_dir, label):
    os.makedirs(out_dir, exist_ok=True)
    for name, solid in printed.items():
        out = m.for_printing(solid, name in flipped)
        m.write_stl(out, os.path.join(out_dir, f'{name}.stl'))
        bb = out.bounding_box()
        print(f'  {name:9s} {bb[3] - bb[0]:6.1f} x {bb[4] - bb[1]:5.1f} x {bb[5] - bb[2]:5.1f} mm  {out.volume() / 1000:6.1f} cm3  genus {out.genus()}')
    clashes = 0
    moving = ('cap', 'carrier', 'hex', 'keycap')
    for pressed in (False, True):
        state = {**printed, **bought(pressed)}
        drop = SWITCH_TRAVEL if pressed else 0.0
        for k in moving:
            if k in ('cap', 'carrier'):
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
    # the stops, measured on the solids
    c = printed['cap']
    to_collar = _meets(c, _collar(COLLAR_H))
    ring_to_case = (PAD_BOTTOM - SWITCH_TRAVEL) - KEY[2]
    print(f'  press: bar {PRESS_GAP:.1f} above the keycap at rest; clicks at {SWITCH_CLICK:.1f}, the switch stops at {SWITCH_TRAVEL:.1f}, '
          f'the collar would catch the cap at {to_collar:.2f}; the ring stays {ring_to_case:.2f} above the key case at the stop')
    if to_collar < SWITCH_TRAVEL or ring_to_case < PLATE_CLEAR - 0.05:
        clashes += 1
        print('  PROBLEM: the collar or the ring catches before the switch bottoms')
    print('  clash check:', 'clean' if not clashes else f'{clashes} problem(s)')
    colours = {'housing': '#3a3a40', 'platform': '#55555c', 'cradle': '#6a4a7a', 'lid': '#2a2a2e', 'carrier': '#8a8a92', 'cap': '#ffffff',
               'hex': '#2e7d32', 'key': '#e8e8e8', 'keycap': '#c62828', 'atom': '#1a3a6e', 'cell': '#8a8a55', 'rider': '#1b5e20', 'splitter': '#d8d8d8'}
    everything = dict(printed)
    everything.update(bought())
    m.section_svg(everything, colours, os.path.join(HERE, f'section-{label}-front.svg'), 'xz')
    m.section_svg(everything, colours, os.path.join(HERE, f'section-{label}-side.svg'), 'yz')


if __name__ == '__main__':
    print(f'v6 box: {v2.W:.0f} x {v2.D:.0f} mm, {CAP_TOP - v2.BOTTOM:.1f} mm tall to the cap, housing {v2.TOP - v2.BOTTOM:.1f} mm, '
          f'cap shows {CAP_TOP - v2.TOP:.1f} above the lip ({CAP_TOP - v2.TOP - SWITCH_TRAVEL:.1f} pressed), collar {COLLAR_H:.1f} tall')
    check_and_write(printed_parts(), {'housing', 'cap', 'cradle'}, os.path.join(HERE, OUT), OUT)
