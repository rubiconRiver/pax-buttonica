#!/usr/bin/env python3
"""
Run a button's battery flat and find out how long it lasted.

  hardware/shell/.venv/bin/python firmware/soak.py                     every button heard, a game's rhythm
  hardware/shell/.venv/bin/python firmware/soak.py --light steady      a steady light, at the "your turn" level
  hardware/shell/.venv/bin/python firmware/soak.py 441BF6F4F4EC        only this button

Charge the cell full, switch the button on, start this, walk away. It sets the light, writes a line to a log
every time a button checks in (every 10 s), and says how long each button ran once it has been silent for five
minutes. The laptop is kept awake while it runs. Close any browser tab that has the hub first.

--light game (the default) is what a button does in a six-player game: its "your turn" light for one minute
in six and the waiting light for the other five. --light steady is the worst case worth knowing: "your turn"
the whole time. --light waiting is the floor.

The button does nothing it would not do in a game: it sends its usual check-in, which from firmware 0.3.11
carries how long it has been on, and the laptop writes that down. So the answer is the last running time the
laptop heard, exact to ten seconds, even if this script was started late. The laptop has to stay on and awake
(this keeps it awake; plug it in and leave the lid open).
"""
import argparse, csv, glob, json, os, subprocess, sys, time
import serial

HERE = os.path.dirname(os.path.abspath(__file__))
SILENT_S = 300          # no check-in for this long: it has stopped
TURN_S = 60             # the game's rhythm: this long bright...
ROUND_S = 360           # ...in every this long


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
                return s
        s.close()
    sys.exit('no hub on USB (plug it in, close the tab that has it)')


def hms(seconds):
    return f'{int(seconds) // 3600}:{int(seconds) % 3600 // 60:02d}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('devs', nargs='*')
    ap.add_argument('--light', choices=('game', 'steady', 'waiting'), default='game')
    ap.add_argument('--colour', default='ff8a1f')
    ap.add_argument('--bright', type=int, default=50)
    ap.add_argument('--dim', type=int, default=10)
    a = ap.parse_args()
    hub = find_hub()
    send = lambda o: hub.write((json.dumps(o, separators=(',', ':')) + '\n').encode())
    os.makedirs(os.path.join(HERE, 'soak-logs'), exist_ok=True)
    path = os.path.join(HERE, 'soak-logs', time.strftime('soak-%Y%m%d-%H%M.csv'))
    keep_awake = subprocess.Popen(['caffeinate', '-i', '-w', str(os.getpid())])
    buttons = {}            # dev -> dict(first, last_heard, up, last, rssi, done, showing)
    print(f'listening. light: {a.light}, your turn {a.bright} %, waiting {a.dim} %. log: {path}')
    log = csv.writer(open(path, 'w', newline='', buffering=1))
    log.writerow(['time', 'dev', 'fw', 'up_s', 'rssi_dbm', 'light'])
    started = time.time()
    try:
        while True:
            line = hub.readline()
            now = time.time()
            if line:
                try:
                    m = json.loads(line)
                except ValueError:
                    m = {}
                dev = m.get('dev')
                if dev and (not a.devs or dev in a.devs):
                    b = buttons.setdefault(dev, {'first': now, 'rssi': None, 'done': False, 'showing': None, 'up': 0, 'fw': '?'})
                    b['heard'] = now
                    if m.get('t') == 'rssi': b['rssi'] = m.get('dbm')
                    if m.get('t') == 'hello':
                        new = 'up' in m and m['up'] < b['up']          # it restarted
                        b.update(fw=m.get('fw', '?'), up=m.get('up', 0))
                        if b['done'] or new: b.update(done=False, first=now, showing=None)
                        log.writerow([time.strftime('%Y-%m-%d %H:%M:%S'), dev, b['fw'], b['up'], b['rssi'], b['showing']])
            for dev, b in buttons.items():
                if b['done']: continue
                if now - b['heard'] > SILENT_S:
                    b['done'] = True
                    ran = b['up'] if b['up'] else b['heard'] - b['first']
                    print(f'\n{time.strftime("%H:%M")}  {dev} has stopped. It ran for {hms(ran)} (h:mm), last heard at {time.strftime("%H:%M", time.localtime(b["heard"]))}.')
                    continue
                turn = a.light == 'steady' or (a.light == 'game' and (now - b['first']) % ROUND_S < TURN_S)
                want = 'solid' if turn else 'dim'
                if want != b['showing'] or now - b.get('told', 0) > 120:       # and again every two minutes, in case it restarted
                    send({'t': 'cfg', 'dev': dev, 'hold': 900, 'bright': a.bright, 'dim': a.dim, 'fx': 80, 'pulse': 'solid'})
                    send({'t': 'led', 'dev': dev, 'c': a.colour, 'm': want})
                    b['showing'], b['told'] = want, now
            if buttons and int(now) % 600 == 0 and now - started > 1:
                alive = [d for d, b in buttons.items() if not b['done']]
                print(f'{time.strftime("%H:%M")}  ' + '  '.join(f'{d[-4:]} {hms(buttons[d]["up"])}' for d in alive) or 'all stopped', flush=True)
                time.sleep(1)
            if buttons and all(b['done'] for b in buttons.values()):
                break
    except KeyboardInterrupt:
        print('\nstopped by hand')
    keep_awake.terminate()
    for dev, b in buttons.items():
        print(f'  {dev}: on for {hms(b["up"])} when last heard{"" if b["done"] else " (still running)"}')


if __name__ == '__main__':
    main()
