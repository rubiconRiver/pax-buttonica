# Battery log

Every cell run down and charged, so a weak one is found before game night. Raw check-ins are in `firmware/soak-logs/`
(ignored by git, one CSV per run of `firmware/soak.py`); this is the summary. Buttons are named by the last four of
their id.

The drain: `soak.py --light steady --colour ffffff --bright 100`, white at the firmware's cap, about 360 mA at 5 V, the
fastest the button can go. A good 1800 mAh cell should last about 5 hours this way; under 4 says weak. A game
averages about 55 mA, so game hours ≈ 6.5 × white hours.

## Cells

EEMB LP963450, seven bought 2026-09-25 (two more on order, due 2026-10-04: nine in all). Three arrived locked out
(0 V at the plug, protection tripped); one woke on the Rider at once, and the other two woke on a proper charge on
2026-09-30, so all seven are alive and the return was cancelled. None arrived full. The way to wake one: power the
Rider from USB-C first, then plug the cell in.

## Run 1 — 2026-09-30, white drain, log `soak-20260930-1338.csv`

Started 13:38. Cells were part charged unless noted, so these times rank the cells against each other; only 58F0's
is a capacity.

| Button | Cell state at start | White from | Went silent | White hours |
|---|---|---|---|---|
| C1C0 | part (on battery since 13:31) | 13:38 | ~13:47 | 0.15 — was nearly empty; on the charger now |
| 2B30 | — | — | — | switched off 13:42: Garett's own button, runs from a wall charger, no cell |
| 04F8 | part (on battery since 12:17, low draw) | 13:38 | 15:36 | 1.95 — about 700 mAh at white, after 1.3 h of dim/idle |
| F4EC | part; the cell in use since ~08:30 at the game's low draw | 13:38 | 14:56 | 1.3 — about 470 mAh at white, after ~5 h of dim/idle before it |
| C5A8 | part (on battery since 12:30, low draw) | 13:38 | 15:38 | 1.98 — about 700 mAh at white, after 1.1 h of dim/idle |
| 58F0 | **full** (charged 2026-09-30) | 13:45 | 18:07 | **4.37 — the benchmark.** Two bars at 2 h 10, one bar at 3 h 48 |

**The benchmark: a full cell gives 4 h 22 at the button's brightest.** A game averages about a sixth of that draw,
so a full cell is 20–25 hours of game. (4.37 h × the 360 mA estimated for white would be 1570 mAh before the
Rider's losses, more than the label; the white draw was never put on the meter, so it is a little under 360. The
hours are the measurement.)

14:00: the hub went quiet with USB still up (every button stopped being heard the same second; a USB reset over the
port brought it back at 14:11). The buttons kept their own count, so the times above are unaffected; check-ins
from 14:11 are in `soak-20260930-1411.csv`. Hub 0.2.6 has a watchdog and a status light for this.

Still to run: the two cells now charging (C1C0's and one of the revived ones), from full.
