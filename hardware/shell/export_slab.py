"""
The three v5 designs, assembled, as one JSON each of indexed meshes for the site's viewer (/slab.html).

  .venv/bin/python export_slab.py    ->  ../../public/slab/<design>.json
"""
import importlib.util
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('v5', os.path.join(HERE, 'make_shell_v5.py'))
v5 = importlib.util.module_from_spec(spec)
argv, sys.argv = sys.argv, ['x']
spec.loader.exec_module(v5)
sys.argv = argv

out = os.path.join(HERE, '..', '..', 'public', 'slab')
os.makedirs(out, exist_ok=True)
for design in v5.DESIGNS:
    d = v5.dims(design)
    parts = dict(v5.printed_parts(d))
    parts.update(v5.bought(d))
    data = {'meta': {'bottom': v5.BOTTOM, 'topz': v5.TOPZ, 'lantern_h': d.lantern_h, 'hex_top': d.hex_top, 'press': v5.PRESS,
                     'hx': v5.HX, 'hy': v5.HY, 'ax': d.ax, 'ay': v5.AY, 'pivot': list(d.pivot), 'turn': d.turn, 'plate': d.plate},
            'parts': {}}
    for name, solid in parts.items():
        mesh = solid.to_mesh()
        v = np.asarray(mesh.vert_properties, dtype=np.float64)[:, :3]
        t = np.asarray(mesh.tri_verts, dtype=np.int64)
        data['parts'][name] = {'v': [round(float(x), 2) for x in v.ravel()], 'i': [int(x) for x in t.ravel()]}
    path = os.path.join(out, f'{design}.json')
    json.dump(data, open(path, 'w'), separators=(',', ':'))
    print(f'{design}: {sum(len(p["i"]) // 3 for p in data["parts"].values())} triangles, {os.path.getsize(path) // 1024} kB')
