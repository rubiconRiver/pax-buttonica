"""
Generates the Pax Buttonica button carrier board with KiCad's Python API.

Run with KiCad's own Python (it has the `pcbnew` module):
  /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3 make_board.py

Everything is placed and routed from the coordinates in this file, in millimetres
from the centre of the board (x to the right, y DOWN, as KiCad draws it). The
board is a 70 mm disc; the keyboard switch sits dead centre; the ESP32-C3
SuperMini sits at the top with its USB-C port at the rim.
"""
import math
import os
import pcbnew
from pcbnew import FromMM, VECTOR2I

HERE = os.path.dirname(os.path.abspath(__file__))
LIBS = '/Applications/KiCad/KiCad.app/Contents/SharedSupport/footprints'
OX, OY = 100.0, 100.0          # where the board centre sits on the KiCad sheet
RADIUS = 35.0

board = pcbnew.BOARD()
P = lambda x, y: VECTOR2I(FromMM(OX + x), FromMM(OY + y))

# ── nets ────────────────────────────────────────────────────────────────────
nets = {}
def net(name):
    if name not in nets:
        n = pcbnew.NETINFO_ITEM(board, name)
        board.Add(n)
        nets[name] = n
    return nets[name]

# ── helpers ─────────────────────────────────────────────────────────────────
def place(lib, name, ref, x, y, rot=0, value='', pad_nets=None):
    fp = pcbnew.FootprintLoad(os.path.join(LIBS, lib + '.pretty'), name)
    fp.SetReference(ref)
    fp.SetValue(value or name)
    fp.SetPosition(P(x, y))
    fp.SetOrientationDegrees(rot)
    fp.Value().SetVisible(False)
    board.Add(fp)
    for number, netname in (pad_nets or {}).items():
        for pad in fp.Pads():
            if pad.GetNumber() == number:
                pad.SetNet(net(netname))
    return fp

def track(points, netname, width=0.4, layer=pcbnew.F_Cu):
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(P(x1, y1)); t.SetEnd(P(x2, y2))
        t.SetWidth(FromMM(width)); t.SetLayer(layer); t.SetNet(net(netname))
        board.Add(t)

def text(s, x, y, size=1.0, layer=pcbnew.F_SilkS, rot=0, bold=False, mirror=False):
    t = pcbnew.PCB_TEXT(board)
    t.SetText(s); t.SetPosition(P(x, y)); t.SetLayer(layer)
    t.SetTextSize(VECTOR2I(FromMM(size), FromMM(size)))
    t.SetTextThickness(FromMM(size * (0.2 if bold else 0.15)))
    t.SetTextAngleDegrees(rot)
    t.SetMirrored(mirror)
    board.Add(t)

def line(x1, y1, x2, y2, layer=pcbnew.F_SilkS, width=0.15):
    s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(P(x1, y1)); s.SetEnd(P(x2, y2)); s.SetLayer(layer); s.SetWidth(FromMM(width))
    board.Add(s)

def through_pad(fp, number, x, y, netname, dia=1.8, drill=1.2, square=False):
    pad = pcbnew.PAD(fp)
    pad.SetNumber(number)
    pad.SetAttribute(pcbnew.PAD_ATTRIB_PTH)
    pad.SetShape(pcbnew.PAD_SHAPE_RECT if square else pcbnew.PAD_SHAPE_CIRCLE)
    pad.SetSize(VECTOR2I(FromMM(dia), FromMM(dia)))
    pad.SetDrillSize(VECTOR2I(FromMM(drill), FromMM(drill)))
    pad.SetLayerSet(pcbnew.PAD.PTHMask())
    pad.SetPosition(P(x, y))
    if netname:
        pad.SetNet(net(netname))
    fp.Add(pad)
    return pad

# ── outline ─────────────────────────────────────────────────────────────────
edge = pcbnew.PCB_SHAPE(board); edge.SetShape(pcbnew.SHAPE_T_CIRCLE)
edge.SetCenter(P(0, 0)); edge.SetEnd(P(RADIUS, 0)); edge.SetLayer(pcbnew.Edge_Cuts); edge.SetWidth(FromMM(0.1))
board.Add(edge)

# ── U1: ESP32-C3 SuperMini, plus a breakout hole beside every pin ───────────
# Seen from above with USB-C at the top: the right-hand row starts 5V, GND, 3V3.
# Sources disagree on whether the five GPIOs after 3V3 run 0→4 or 4→0, so the
# board never assumes: firmware pins are set in config.h from the labels printed
# on the module. If a module turns out MIRRORED (5V on the left), solder it to
# the BOTTOM of the board: flipping it swaps the rows back.
ROW_X, PITCH, TOP_Y = 7.62, 2.54, -31.5
RIGHT = ['+5V', 'GND', '+3V3', 'VSENSE', 'SW_MAIN', 'IO_C', 'IO_D', 'IO_E']
LEFT = ['IO5', 'IO6', 'IO7', 'IO8', 'IO9', 'LED_MCU', 'UART_A', 'UART_B']
u1 = pcbnew.FOOTPRINT(board)
u1.SetReference('U1'); u1.SetValue('ESP32-C3 SuperMini'); u1.SetPosition(P(0, TOP_Y + 3.5 * PITCH))
u1.Value().SetVisible(False)
board.Add(u1)
for i in range(8):
    y = TOP_Y + i * PITCH
    through_pad(u1, f'R{i+1}', ROW_X, y, RIGHT[i], square=(i == 0))
    through_pad(u1, f'L{i+1}', -ROW_X, y, LEFT[i])
    # breakout holes, one pitch further out, joined by a short stub on both layers
    through_pad(u1, f'RB{i+1}', ROW_X + PITCH, y, RIGHT[i], dia=1.7, drill=1.0)
    through_pad(u1, f'LB{i+1}', -ROW_X - PITCH, y, LEFT[i], dia=1.7, drill=1.0)
    if RIGHT[i] != 'GND':
        track([(ROW_X, y), (ROW_X + PITCH, y)], RIGHT[i], 0.5 if RIGHT[i].startswith('+') else 0.3)
    track([(-ROW_X, y), (-ROW_X - PITCH, y)], LEFT[i], 0.3)
u1.Reference().SetPosition(P(0, TOP_Y + 8.4)); u1.Reference().SetTextSize(VECTOR2I(FromMM(0.9), FromMM(0.9)))

# module outline and labels on the silkscreen
for (a, b) in [((9, -32.4), (9, -12.1)), ((9, -12.1), (-9, -12.1)), ((-9, -12.1), (-9, -32.4))]:
    line(a[0], a[1], b[0], b[1])
text('USB this end', 0, -31.2, 0.9, bold=True)
text('antenna', 0, -14.4, 0.8)
for i, lab in enumerate(['5V', 'G', '3V3', '', '', '', '', '']):
    if lab: text(lab, ROW_X + PITCH + 2.6, TOP_Y + i * PITCH, 0.8)
for i, lab in enumerate(['5', '6', '7', '8', '9', '10', '', '']):
    if lab: text(lab, -ROW_X - PITCH - 2.2, TOP_Y + i * PITCH, 0.8)

# ── SW1: keyboard switch, dead centre (footprint origin is its pin 1) ───────
place('Button_Switch_Keyboard', 'SW_Cherry_MX_1.00u_PCB', 'SW1', 2.54, -5.08, 0, 'MX switch', {'1': 'SW_MAIN', '2': 'GND'})

# ── power: battery → D1 → 5 V rail → module, LED connector, C1 ──────────────
place('TerminalBlock_Phoenix', 'TerminalBlock_Phoenix_MKDS-1,5-2-5.08_1x02_P5.08mm_Horizontal', 'J1', -2.54, 28, 0, 'BATTERY 4xAA NiMH', {'1': 'VBAT', '2': 'GND'})
place('Diode_THT', 'D_DO-41_SOD81_P10.16mm_Horizontal', 'D1', 7.62, 18.5, 180, '1N5817', {'1': '+5V', '2': 'VBAT'})
place('Capacitor_THT', 'CP_Radial_D8.0mm_P3.50mm', 'C1', 24.75, 12, 0, '1000uF 16V', {'1': '+5V', '2': 'GND'})
place('Connector_PinHeader_2.54mm', 'PinHeader_1x03_P2.54mm_Vertical', 'J2', 28, -5.08, 0, 'LED RING', {'1': '+5V', '2': 'LED_DIN', '3': 'GND'})
place('Connector_PinHeader_2.54mm', 'PinHeader_1x03_P2.54mm_Vertical', 'J3', -28, -2.54, 0, 'GND x3', {'1': 'GND', '2': 'GND', '3': 'GND'})

track([(-2.54, 28), (-2.54, 18.5)], 'VBAT', 0.8)
track([(7.62, 18.5), (14, 18.5), (17.5, 15), (17.5, 8), (17.5, -5.08), (17.5, -25), (13.5, -29), (13.5, -30.5), (12.5, -31.5), (ROW_X + PITCH, -31.5)], '+5V', 0.8)
track([(17.5, 12), (24.75, 12)], '+5V', 0.8)
track([(17.5, -5.08), (28, -5.08)], '+5V', 0.8)

# ── main switch → module ────────────────────────────────────────────────────
track([(2.54, -5.08), (5.5, -8), (13, -8), (13, -19.8), (11.7, -21.34), (ROW_X + PITCH, -21.34)], 'SW_MAIN', 0.3)

# ── LED data: module → R1 (or the bridged jumper beside it) → connector ─────
place('Resistor_THT', 'R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal', 'R1', -13, -12, 270, '330R (optional)', {'1': 'LED_MCU', '2': 'LED_DIN'})
place('Jumper', 'SolderJumper-2_P1.3mm_Bridged_Pad1.0x1.5mm', 'JP1', -17, -8.19, 270, 'bypass R1', {'1': 'LED_MCU', '2': 'LED_DIN'})
B = pcbnew.B_Cu
track([(-ROW_X - PITCH, -18.8), (-13, -16), (-13, -12)], 'LED_MCU', 0.3, B)
track([(-13, -12), (-17, -10.2), (-17, -8.84)], 'LED_MCU', 0.3)
track([(-17, -7.54), (-17, -6.2), (-13, -4.38)], 'LED_DIN', 0.3)
track([(-13, -4.38), (-13, 9), (-9, 13), (9, 13), (13, 9), (13, -2.54), (28, -2.54)], 'LED_DIN', 0.3, B)

# ── optional battery sensing: two 100k resistors halve the battery voltage for the ADC ─────
RV = 'R_Axial_DIN0207_L6.3mm_D2.5mm_P5.08mm_Vertical'
place('Resistor_THT', RV, 'R2', 20.5, -8, 90, '100k (optional)', {'1': 'VSENSE', '2': 'VBAT'})
place('Resistor_THT', RV, 'R3', 24, -8, 90, '100k (optional)', {'1': 'VSENSE', '2': 'GND'})
track([(20.5, -8), (24, -8)], 'VSENSE', 0.3, B)
track([(20.5, -8), (15.2, -13.3), (15.2, -21), (12.4, -23.88), (ROW_X + PITCH, -23.88)], 'VSENSE', 0.3, B)
track([(-2.54, 18.5), (0, 16), (15, 16), (19, 12), (19, 6), (24, 3.2), (30.4, 3.2), (30.4, -7), (27.5, -10.5), (22.5, -10.5), (20.5, -12.5), (20.5, -13.08)], 'VBAT', 0.4, B)

# ── mounting holes ──────────────────────────────────────────────────────────
for i, (x, y) in enumerate([(23, -19), (-23, -19), (23, 19), (-23, 19)]):
    place('MountingHole', 'MountingHole_3.2mm_M3', f'H{i+1}', x, y).Reference().SetVisible(False)

# ── ground pour on both sides, kept out from under the antenna ──────────────
def disc(r, n=96):
    return [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n)) for k in range(n)]

for layer in (pcbnew.F_Cu, pcbnew.B_Cu):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer); z.SetNet(net('GND'))
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetMinThickness(FromMM(0.25)); z.SetLocalClearance(FromMM(0.4))
    z.SetThermalReliefGap(FromMM(0.4)); z.SetThermalReliefSpokeWidth(FromMM(0.6))
    o = z.Outline(); o.NewOutline()
    for x, y in disc(RADIUS + 1):
        o.Append(FromMM(OX + x), FromMM(OY + y))
    board.Add(z)

keep = pcbnew.ZONE(board)
keep.SetIsRuleArea(True)
keep.SetDoNotAllowZoneFills(True); keep.SetDoNotAllowTracks(True); keep.SetDoNotAllowVias(True)
keep.SetDoNotAllowPads(False); keep.SetDoNotAllowFootprints(False)
ls = pcbnew.LSET(); ls.AddLayer(pcbnew.F_Cu); ls.AddLayer(pcbnew.B_Cu)
keep.SetLayerSet(ls)
ko = keep.Outline(); ko.NewOutline()
for x, y in [(-5.8, -17.6), (5.8, -17.6), (5.8, -11.4), (-5.8, -11.4)]:
    ko.Append(FromMM(OX + x), FromMM(OY + y))
board.Add(keep)

# ── silkscreen: say what everything is, for people who have never seen a PCB ─
text('PAX BUTTONICA', 0, 14.9, 1.2, bold=True)
text('button v0.2', 16, 27.5, 0.8)
text('BATTERY', -15, 24.6, 0.8); text('4xAA NiMH', -15, 26.0, 0.8)
text('+', -7.2, 28, 1.5, bold=True); text('-', 7.2, 28, 1.5, bold=True)
text('LED RING', 31.4, -2.54, 0.8, rot=90)
text('R2 R3 100k:', 22.3, -16.6, 0.8); text('battery gauge', 22.3, -15.3, 0.8)
text('5V', 24.9, -5.08, 0.8); text('DIN', 24.4, -2.54, 0.8); text('G', 25.3, 0, 0.8)
text('GND', -28, 5.4, 0.8)
text('R1 330R or', -21.5, -15.6, 0.8); text('keep JP1', -21.5, -14.3, 0.8)
text('5V pin on the LEFT of your ESP32?', 0, 9.5, 0.8)
text('Then solder it to the BACK of this board.', 0, 10.9, 0.8)
text('ESP32 goes on this side if its 5V pin is on the left', 0, 9.6, 0.8, pcbnew.B_SilkS, mirror=True)
# somewhere to write which button this is
for (a, b) in [((-29, 11), (-14.5, 11)), ((-14.5, 11), (-14.5, 16.2)), ((-14.5, 16.2), (-29, 16.2)), ((-29, 16.2), (-29, 11))]:
    line(a[0], a[1], b[0], b[1], pcbnew.B_SilkS)
text('No.', -26.5, 12.4, 0.8, pcbnew.B_SilkS, mirror=True)

pcbnew.ZONE_FILLER(board).Fill(board.Zones())
out = os.path.join(HERE, 'pax-button.kicad_pcb')
pcbnew.SaveBoard(out, board)
print('wrote', out)
