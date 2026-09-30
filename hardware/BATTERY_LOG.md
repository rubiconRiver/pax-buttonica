# Battery log

Every cell run down and charged, so a weak one is found before game night. Raw check-ins are in `firmware/soak-logs/`
(ignored by git, one CSV per run of `firmware/soak.py`); this is the summary. Buttons are named by the last four of
their id.

The drain: `soak.py --light steady --colour ffffff --bright 100`, white at the firmware's cap, about 360 mA at 5 V, the
fastest the button can go. A good 1800 mAh cell should last about 5 hours this way; under 4 says weak. A game
averages about 55 mA, so game hours ≈ 6.5 × white hours.

## Cells

EEMB LP963450, seven bought 2026-09-25 (two replacements on order, due 2026-10-04). Three arrived locked out
(0 V at the plug, protection tripped); one woke on the Rider at once, two more woke on a proper charge on
2026-09-30. None arrived full.

## Run 1 — 2026-09-30, white drain, log `soak-20260930-1338.csv`

Started 13:38. Cells were part charged unless noted, so these times rank the cells against each other; only 58F0's
is a capacity.

| Button | Cell state at start | White from | Went silent | White hours |
|---|---|---|---|---|
| C1C0 | part (on battery since 13:31) | 13:38 | ~13:47 | 0.15 — was nearly empty; on the charger now |
| 2B30 | — | — | — | switched off 13:42: Garett's own button, runs from a wall charger, no cell |
| 04F8 | part (on battery since 12:17) | 13:38 | | |
| F4EC | part (on battery since 12:19) | 13:38 | | |
| C5A8 | part (on battery since 12:30) | 13:38 | | |
| 58F0 | **full** (charged 2026-09-30) | 13:45 | | |

Still to run: the two cells now charging (C1C0's and one of the revived ones), from full.
