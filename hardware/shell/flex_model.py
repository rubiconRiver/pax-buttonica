"""
How hard the cage's flexures work: a small beam model of one arm between the plate (clamped) and the disc, which
only moves straight down (three arms, so the disc can't slide or tilt, only turn). Prints the three arms'
stiffness and the peak stress per millimetre of bend, for the bars of 2026-09-30 and the spiral of 2026-10-01.

  .venv/bin/python flex_model.py

Printed PLA (Bambu PLA Basic): bending modulus about 2.75 GPa, bending strength about 75 MPa; for a part bent
every press, stay under about 15 MPa. A bar whose bend is set by a stop is stressed about 3 E t d / L^2: thicker is
worse, only length helps. The stress is the beam's own; a rounded root adds roughly half again.
"""
import math
import sys

import numpy as np

E = 2750.0
G = E / (2 * (1 + 0.36))


def _torsion(w, t):
    a, b = max(w, t), min(w, t)
    tab = [(1, .141, .208), (1.5, .196, .231), (2, .229, .246), (3, .263, .267), (4, .281, .282), (6, .299, .299), (10, .312, .312), (1e9, .333, .333)]
    for (r0, b0, a0), (r1, b1, a1) in zip(tab, tab[1:]):
        if a / b <= r1:
            f = (a / b - r0) / (r1 - r0)
            return (b0 + f * (b1 - b0)) * a * b ** 3, (a0 + f * (a1 - a0)) * a * b ** 2


def _k_local(L, A, Iy, Iz, J):
    k = np.zeros((12, 12))
    ea, gj = E * A / L, G * J / L
    entries = [(0, 0, ea), (0, 6, -ea), (6, 6, ea), (3, 3, gj), (3, 9, -gj), (9, 9, gj)]
    a = E * Iz / L ** 3
    entries += [(1, 1, 12 * a), (1, 5, 6 * L * a), (1, 7, -12 * a), (1, 11, 6 * L * a), (5, 5, 4 * L * L * a), (5, 7, -6 * L * a),
                (5, 11, 2 * L * L * a), (7, 7, 12 * a), (7, 11, -6 * L * a), (11, 11, 4 * L * L * a)]
    a = E * Iy / L ** 3
    entries += [(2, 2, 12 * a), (2, 4, -6 * L * a), (2, 8, -12 * a), (2, 10, -6 * L * a), (4, 4, 4 * L * L * a), (4, 8, 6 * L * a),
                (4, 10, 2 * L * L * a), (8, 8, 12 * a), (8, 10, 6 * L * a), (10, 10, 4 * L * L * a)]
    for i, j, v in entries:
        k[i, j] += v
    return np.triu(k) + np.triu(k, 1).T


def _rotation(p0, p1):
    x = (p1 - p0) / np.linalg.norm(p1 - p0)
    y = np.cross([0, 0, 1.0], x); y /= np.linalg.norm(y)
    R = np.array([x, y, np.cross(x, y)])
    T = np.zeros((12, 12))
    for i in range(4):
        T[3 * i:3 * i + 3, 3 * i:3 * i + 3] = R
    return T


def arm(pts, widths, t):
    """pts: the arm's centreline from the disc to the plate; widths per segment; t its thickness (vertical).
    Returns (N/mm for three arms, MPa per mm of bend)."""
    nodes = [np.zeros(3)] + [np.array([x, y, 0.0]) for x, y in pts]
    n = len(nodes)
    K = np.zeros((6 * n, 6 * n))
    els = []
    for e in range(n - 1):
        w, h = (50.0, 50.0) if e == 0 else (widths[e - 1], t)        # the first is the rigid disc
        A, Iy, Iz = w * h, w * h ** 3 / 12, h * w ** 3 / 12
        J, Wt = _torsion(w, h)
        T = _rotation(nodes[e], nodes[e + 1])
        kl = _k_local(np.linalg.norm(nodes[e + 1] - nodes[e]), A, Iy, Iz, J)
        K[6 * e:6 * e + 12, 6 * e:6 * e + 12] += T.T @ kl @ T
        els.append((e, T, kl, w, h, A, Iy, Iz, Wt))
    fixed = {0: 0.0, 1: 0.0, 2: -1.0, 3: 0.0, 4: 0.0, **{6 * (n - 1) + d: 0.0 for d in range(6)}}
    free = [i for i in range(6 * n) if i not in fixed]
    u = np.zeros(6 * n)
    for i, v in fixed.items():
        u[i] = v
    u[free] = np.linalg.solve(K[np.ix_(free, free)], -K[np.ix_(free, list(fixed))] @ u[list(fixed)])
    peak = 0.0
    for e, T, kl, w, h, A, Iy, Iz, Wt in els[1:]:
        f = kl @ (T @ u[6 * e:6 * e + 12])
        for N, Tq, My, Mz in ((f[0], f[3], f[4], f[5]), (f[6], f[9], f[10], f[11])):
            s = abs(N) / A + abs(My) * h / 2 / Iy + abs(Mz) * w / 2 / Iz
            peak = max(peak, math.hypot(s, math.sqrt(3) * abs(Tq) / Wt))
    return -3 * (K @ u)[2], peak


def bars(m, free_length):
    """Today's straight bars: they leave the disc along a tangent; free_length between where the disc and the plate
    hold them (10 to 12.5 on the drawing), the last FLEX_ROOT_L wider."""
    ys = np.linspace(2.0, 2.0 + free_length, 41)
    mids = (ys[:-1] + ys[1:]) / 2
    return [(m.SADDLE_BRIM_R, y) for y in ys], [m.FLEX_W + 2 * m.FLEX_ROOT if y > ys[-1] - m.FLEX_ROOT_L else m.FLEX_W for y in mids], m.FLEX_T


def spiral(m):
    """The material between two neighbouring slots, from where the inner one starts to where the outer one ends."""
    g, Th = m.SPIRAL_SLOT, m.SPIRAL_SWEEP
    ra, rb = m.SPIRAL_DISC_R + g / 2, m.FLEX_R - g / 2
    w = (rb - ra) * 120 / Th - g
    th = np.linspace(120, Th, 81)
    r = ra + (rb - ra) * (th - 60) / Th
    pts = [(ri * math.cos(math.radians(a)), ri * math.sin(math.radians(a))) for ri, a in zip(r, th)]
    return pts, [w] * 80, m.SPIRAL_T


if __name__ == '__main__':
    import importlib.util, os
    here = os.path.dirname(os.path.abspath(__file__))
    sys.argv = ['x']
    def load(name):
        spec = importlib.util.spec_from_file_location(name[:-3], os.path.join(here, name))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    m = load('make_shell_mini.py')
    print(f'bars, {m.FLEX_T} thick x {m.FLEX_W} wide, wide roots (2026-09-30):')
    for L in (10.0, 12.5):
        k, s = arm(*bars(m, L))
        print(f'  free length {L:4.1f} mm: {k:5.1f} N/mm, {s:5.1f} MPa per mm of bend')
    v2 = load('make_shell_v2.py')                    # the cage v2 prints: arms inside the stop ring
    pts, ws, t = spiral(v2.m)
    length = sum(math.dist(p, q) for p, q in zip(pts, pts[1:]))
    k, s = arm(pts, ws, t)
    print(f'v2 spiral, arms of {v2.m.SPIRAL_SWEEP - 120} degrees, {length:.0f} mm long, {ws[0]:.1f} wide x {t} thick:')
    print(f'  {k:5.1f} N/mm, {s:5.1f} MPa per mm of bend; a {v2.SWITCH_FORCE:.0f} N switch clicks after {v2.SWITCH_FORCE / k:.2f} mm of give')
    for bend in (0.45, 0.7):
        print(f'  bent {bend} mm: {k * bend:4.1f} N on the switch, {s * bend:4.1f} MPa (about {1.5 * s * bend:4.1f} at the roots)')
