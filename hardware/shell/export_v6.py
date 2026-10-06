"""
v6 assembled, as one JSON of indexed meshes for the site's viewer (/v6.html).

  .venv/bin/python export_v6.py    ->  ../../public/v6/v6.json
"""
import importlib.util
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('v6', os.path.join(HERE, 'make_shell_v6.py'))
v6 = importlib.util.module_from_spec(spec)
argv, sys.argv = sys.argv, ['x']
spec.loader.exec_module(v6)
sys.argv = argv

out = os.path.join(HERE, '..', '..', 'public', 'v6')
os.makedirs(out, exist_ok=True)
parts = dict(v6.printed_parts())
parts.update(v6.bought())
data = {'meta': {'bottom': v6.v2.BOTTOM, 'lip': v6.v2.TOP, 'cap_top': v6.CAP_TOP, 'inner_top': v6.INNER_TOP, 'hex_top': v6.HEX_TOP,
                 'travel': v6.SWITCH_TRAVEL, 'click': v6.SWITCH_CLICK, 'cap_d': v6.m.CAP_D, 'w': v6.v2.W, 'd': v6.v2.D},
        'parts': {}}
for name, solid in parts.items():
    mesh = solid.to_mesh()
    v = np.asarray(mesh.vert_properties, dtype=np.float64)[:, :3]
    t = np.asarray(mesh.tri_verts, dtype=np.int64)
    data['parts'][name] = {'v': [round(float(x), 2) for x in v.ravel()], 'i': [int(x) for x in t.ravel()]}
path = os.path.join(out, 'v6.json')
json.dump(data, open(path, 'w'), separators=(',', ':'))
print(f'v6: {sum(len(p["i"]) // 3 for p in data["parts"].values())} triangles, {os.path.getsize(path) // 1024} kB')
