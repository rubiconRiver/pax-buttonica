"""
Three custom caps for the mini shell, to show that the cap is the part a player can make their own.
Everything below the cap's shoulder (skirt, flange, cage sockets) is the mini's own cap, so each of
these drops onto the same body, bezel, cage and springs and presses the same way.

  lithophane  the flat top becomes a lithophane: an image encoded as thickness (thin = bright), invisible
              until the hex lights it. Image: PIA14922, Saturn and Titan, NASA/JPL-Caltech/SSI, public domain.
  planet      a hollow low-poly planet on the skirt: press the planet, the planet glows. The sphere here is
              a generated icosphere; a CC-BY model from Printables/Thingiverse can replace it.
  tile        a TI system tile: a hexagonal slab with three planet windows and a lane groove, lit from below.

  .venv/bin/python make_caps.py [image.jpg]        writes stl-caps/*.stl and the viewer data
"""
import importlib.util
import json
import math
import os
import sys

import numpy as np
from manifold3d import Manifold, Mesh
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('mini', os.path.join(HERE, 'make_shell_mini.py'))
m = importlib.util.module_from_spec(spec)
_argv, sys.argv = sys.argv, ['x']
spec.loader.exec_module(m)
sys.argv = _argv

IMAGE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'caps', 'saturn.jpg')

# ── lithophane ──────────────────────────────────────────────────────────────
LITH_R = m.CAP_R - m.CAP_CHAMFER            # the flat top's radius: the picture fills it
LITH_MIN, LITH_MAX = 0.8, 3.0               # thickness for white and for black (the usual lithophane range in PLA)
LITH_N = 150                                # grid across the picture


def heightfield(z0, size, t):
    """A closed solid: flat underside at z0, bumpy top at z0 + t[i, j], over a size x size square centred on the axis."""
    n = t.shape[0]
    xs = np.linspace(-size / 2, size / 2, n)
    X, Y = np.meshgrid(xs, xs, indexing='ij')
    top = np.stack([X, Y, z0 + t], axis=-1).reshape(-1, 3)
    bot = np.stack([X, Y, np.full_like(X, z0)], axis=-1).reshape(-1, 3)
    verts = np.vstack([top, bot]).astype(np.float32)
    idx = lambda i, j: i * n + j
    tris = []
    for i in range(n - 1):
        for j in range(n - 1):
            a, b, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            tris += [(a, b, c), (a, c, d)]                                    # top, seen from above
            tris += [(n * n + a, n * n + c, n * n + b), (n * n + a, n * n + d, n * n + c)]   # bottom, seen from below
    N = n * n
    for k in range(n - 1):                                                    # four side walls
        for a, b in ((idx(k, 0), idx(k + 1, 0)), (idx(n - 1, k), idx(n - 1, k + 1)), (idx(k + 1, n - 1), idx(k, n - 1)), (idx(0, k + 1), idx(0, k))):
            tris += [(a, N + a, N + b), (a, N + b, b)]
    return Manifold(Mesh(vert_properties=verts, tri_verts=np.array(tris, dtype=np.uint32)))


def lithophane_cap(image_path):
    im = ImageOps.grayscale(Image.open(image_path))
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width + side) // 2, (im.height + side) // 2)).resize((LITH_N, LITH_N), Image.LANCZOS)
    lum = np.asarray(im, dtype=np.float32) / 255.0
    lum = lum.T[:, ::-1]                                  # image row/col -> x/y with y up
    t = LITH_MIN + (1.0 - lum) * (LITH_MAX - LITH_MIN)
    top = heightfield(m.INNER_TOP, 2 * LITH_R + 2, t) ^ m.cyl(2 * LITH_R + 0.6, LITH_MAX + 2, z=m.INNER_TOP - 1, seg=m.SEG)
    base = m.cap() - m.cyl(2 * LITH_R, 10, z=m.INNER_TOP - 0.01, seg=m.SEG)   # the flat top comes out
    return base + top, lum


# ── planet ──────────────────────────────────────────────────────────────────
PLANET_R = 26.0
PLANET_WALL = 1.6


def icosphere(r, levels=2):
    t = (1 + 5 ** 0.5) / 2
    v = np.array([(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)], dtype=float)
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    pts = [tuple(p / np.linalg.norm(p)) for p in v]
    for _ in range(levels):
        cache, nf = {}, []
        def mid(a, b):
            k = (min(a, b), max(a, b))
            if k not in cache:
                p = (np.array(pts[a]) + np.array(pts[b])) / 2
                pts.append(tuple(p / np.linalg.norm(p)))
                cache[k] = len(pts) - 1
            return cache[k]
        for a, b, c in f:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nf
    return Manifold.hull_points([(x * r, y * r, z * r) for x, y, z in pts])


def planet_cap():
    shoulder = m.CAP_TOP - m.CAP_CHAMFER
    cz = shoulder + math.sqrt(PLANET_R ** 2 - (m.CAP_R - 3) ** 2)         # the sphere meets the skirt a little inside its rim
    shell = icosphere(PLANET_R).translate([0, 0, cz]) - icosphere(PLANET_R - PLANET_WALL).translate([0, 0, cz])
    shell ^= m.box(-50, -50, shoulder - 1, 100, 100, 100)                    # nothing below the shoulder
    base = m.cap() ^ m.box(-50, -50, -10, 100, 100, shoulder + 10)           # the mini's cap up to its shoulder
    base -= m.cyl(2 * (m.CAP_R - m.CAP_WALL), 20, z=shoulder - 0.01, seg=m.SEG)   # open above the shoulder
    ring = m.cyl(2 * (m.CAP_R - 1), 2.0, z=shoulder - 1, seg=m.SEG) - m.cyl(2 * 20, 4, z=shoulder - 2, seg=m.SEG)   # a shelf the sphere lands on, open in the middle
    return base + ring + shell


# ── tile ────────────────────────────────────────────────────────────────────
TILE_F = 62.0            # across the flats, standing proud of the bezel
TILE_H = 10.0
TILE_TOP_T = 1.2
WINDOW_T = 0.5           # the planets: thinner still, so they glow brighter
PLANETS = [(0, 9, 5.5), (-9, -6, 4.0), (10, -7, 3.0)]


def tile_cap():
    z0 = m.BEZEL_TOP + m.TRAVEL + 1.0                                        # the slab clears the bezel when pressed
    base = m.cap() ^ m.box(-50, -50, -10, 100, 100, z0 + 10)
    base -= m.cyl(2 * (m.CAP_R - m.CAP_WALL), 30, z=z0 - 0.01, seg=m.SEG)
    slab = m.hex_prism(TILE_F, TILE_H, z=z0, ct=1.0) - m.hex_prism(TILE_F - 2 * m.CAP_WALL, TILE_H - TILE_TOP_T, z=z0 - 1)
    slab -= m.hex_prism(TILE_F - 2 * m.CAP_WALL, 2, z=z0 - 1)                # open to the skirt below
    cuts = []
    for x, y, r in PLANETS:
        cuts.append(m.cyl(2 * r, TILE_TOP_T - WINDOW_T + 1, x, y, z0 + TILE_H - TILE_TOP_T - 1, seg=48))   # from below, leaving WINDOW_T
    # the lane: a shallow groove on the top, hexagon to centre, like the map's space lanes
    for a in (30, 150, 270):
        cuts.append(m.cbox(0, 0, z0 + TILE_H - 0.4, 2.0, 40, 1).rotate([0, 0, a]))
    return base + slab - m.union(cuts)


# ── output ──────────────────────────────────────────────────────────────────
def mesh_json(solid):
    mesh = solid.to_mesh()
    v = np.asarray(mesh.vert_properties, dtype=np.float64)[:, :3]
    t = np.asarray(mesh.tri_verts, dtype=np.int64)
    return {'v': [round(float(x), 2) for x in v.ravel()], 'i': [int(x) for x in t.ravel()]}


if __name__ == '__main__':
    out = os.path.join(HERE, 'stl-caps')
    os.makedirs(out, exist_ok=True)
    lith, lum = lithophane_cap(IMAGE)
    caps = {'lithophane': lith, 'planet': planet_cap(), 'tile': tile_cap()}
    common = {'body': m.body(), 'bezel': m.bezel(), 'cage': m.cage(), 'springs': m.springs_in_place(m.FLANGE_BOTTOM - 1.25)}
    common.update({k: v for k, v in m.bought_parts().items() if k in ('atom', 'hex')})
    data = {'common': {k: mesh_json(v) for k, v in common.items()}, 'caps': {}}
    for name, solid in caps.items():
        bb = solid.bounding_box()
        print(f'{name:11s} {bb[3] - bb[0]:5.1f} x {bb[4] - bb[1]:5.1f} mm, top at {bb[5]:.1f} ({bb[5] - m.DECK_Z0 if not m.USB_POWERED else bb[5] + m.FLOOR_T:.1f} mm tall on the USB body), {solid.volume() / 1000:.1f} cm3, genus {solid.genus()}')
        m.write_stl(m.for_printing(solid, True), os.path.join(out, f'cap-{name}.stl'))
        data['caps'][name] = mesh_json(solid)
    viewer = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'stl-caps')
    with open(os.path.join(viewer, 'caps.json'), 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    Image.fromarray((lum.T[::-1] * 255).astype(np.uint8)).resize((512, 512)).save(os.path.join(viewer, 'lithophane.png'))
    print('viewer data written to', viewer)
