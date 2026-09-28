#!/usr/bin/env python3
"""
Update buttons over the air through the hub, from a terminal. The same thing /flash.html does in the browser.

  hardware/shell/.venv/bin/python firmware/ota.py                 list the buttons the hub hears (listens 12 s)
  hardware/shell/.venv/bin/python firmware/ota.py all             update every button not on the published version
  hardware/shell/.venv/bin/python firmware/ota.py A1B2C3D4E5F6    update this one (any number of ids)

The image and its version come from public/firmware/button/ (run firmware/export.sh first). Needs pyserial
(it is in hardware/shell/.venv). Close any browser tab that has the hub connected first.

Protocol (docs/BUTTON_STANDARD.md, "Updating over the air"): {"size","md5"} opens the button's spare app
slot, then numbered base64 chunks of 153 bytes, each answered, a few in flight at a time, then {"end":true}
checks the MD5 and reboots. The hub is a relay and needs no change.
"""
import base64
import glob
import json
import os
import sys
import time

import serial

CHUNK = 153      # 153 raw bytes -> 204 base64 characters -> a 249-byte line, one ESP-NOW packet
WINDOW = 4       # chunks in flight; the hub keeps six per button
HERE = os.path.dirname(os.path.abspath(__file__))
IMAGE_DIR = os.path.join(HERE, '..', 'public', 'firmware', 'button')


def find_hub():
    for port in sorted(glob.glob('/dev/cu.usbmodem*')):
        try:
            s = serial.Serial(port, 115200, timeout=0.2)
        except serial.SerialException:
            continue
        s.write(b'{"t":"hub?"}\n')
        end = time.time() + 2
        while time.time() < end:
            if s.readline().strip().startswith(b'{"t":"hub"'):
                print(f'hub on {port}')
                return s
        s.close()
    sys.exit('no hub on USB (plug it in with a data cable, close the tab that has it)')


class Hub:
    def __init__(self, s):
        self.s = s
        self.buttons = {}     # dev -> fw, from hellos

    def send(self, obj):
        self.s.write((json.dumps(obj, separators=(',', ':')) + '\n').encode())

    def messages(self, timeout):
        end = time.time() + timeout
        while time.time() < end:
            line = self.s.readline()
            if not line:
                continue
            try:
                m = json.loads(line)
            except ValueError:
                continue
            if m.get('t') == 'hello':
                self.buttons[m['dev']] = m.get('fw')
            yield m

    def wait(self, pred, timeout):
        for m in self.messages(timeout):
            if pred(m):
                return m
        return None


def update(hub, dev, image, md5):
    is_mine = lambda m: m.get('t') == 'ota' and m.get('dev') == dev
    hub.send({'t': 'ota', 'dev': dev, 'size': len(image), 'md5': md5})
    m = hub.wait(lambda m: is_mine(m) and m.get('st') in ('ready', 'err'), 5)
    if not m or m['st'] == 'err':
        sys.exit(f'{dev}: could not start: {m}')
    total = (len(image) + CHUNK - 1) // CHUNK
    nxt, acked, silent, t0 = 0, -1, 0, time.time()

    def chunk(n):
        hub.send({'t': 'ota', 'dev': dev, 'n': n, 'd': base64.b64encode(image[n * CHUNK:(n + 1) * CHUNK]).decode()})

    while acked < total - 1:
        while nxt < total and nxt - acked - 1 < WINDOW:
            chunk(nxt)
            nxt += 1
        m = hub.wait(is_mine, 2)
        if m is None:
            silent += 1
            if silent > 20:
                sys.exit(f'\n{dev}: stopped answering at chunk {acked + 1} of {total}')
            nxt = acked + 1          # resend everything unanswered
            continue
        silent = 0
        if m['st'] == 'ok':
            acked = max(acked, m['n'])
            print(f'\r{dev}: {100 * (acked + 1) // total}%', end='', flush=True)
        elif m['st'] == 'seq':
            nxt, acked = m['n'], m['n'] - 1
        else:
            sys.exit(f'\n{dev}: {m}')
    hub.send({'t': 'ota', 'dev': dev, 'end': True})
    m = hub.wait(lambda m: is_mine(m) and m.get('st') in ('done', 'err'), 15)
    if not m or m['st'] != 'done':
        sys.exit(f'\n{dev}: {m}')
    print(f'\r{dev}: sent in {time.time() - t0:.0f} s, rebooting...', end='', flush=True)
    m = hub.wait(lambda m: m.get('t') == 'hello' and m.get('dev') == dev, 25)
    print(f'\r{dev}: now on firmware {m["fw"] if m else "? (no hello yet)"}      ')


def main():
    with open(os.path.join(IMAGE_DIR, 'manifest.json')) as f:
        manifest = json.load(f)
    with open(os.path.join(IMAGE_DIR, 'app.bin'), 'rb') as f:
        image = f.read()
    version, md5 = manifest['version'], manifest['md5']
    assert len(image) == manifest['size'], 'app.bin does not match its manifest: run firmware/export.sh'
    hub = Hub(find_hub())
    want = sys.argv[1:]
    print(f'published button firmware {version}; listening for buttons (they check in every 10 s)...')
    for _ in hub.messages(12):
        if want and want != ['all'] and all(d in hub.buttons for d in want):
            break
    for dev, fw in sorted(hub.buttons.items()):
        print(f'  {dev}  firmware {fw}  {"up to date" if fw == version else "-> " + version}')
    if not hub.buttons:
        print('  none heard')
    if not want:
        return
    targets = [d for d, fw in hub.buttons.items() if fw != version] if want == ['all'] else want
    if not targets:
        print('nothing to do')
    for dev in targets:
        update(hub, dev, image, md5)


if __name__ == '__main__':
    main()
