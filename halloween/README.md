# Halloween show

A kid presses a button on the step; the outdoor Hue lamps and a speaker put on a few seconds of show.
Everything runs on the laptop. Nothing here is deployed, and the buttons keep their normal game firmware.

```bash
node halloween/server.mjs
```

Then open http://localhost:8031 in Chrome.

- **Try it with nothing plugged in:** click the hexagons or the show names. The circles stand in for the lamps.
- **Buttons:** plug the hub in, "Connect the hub", switch the buttons on, give each a kind. The hub wants to be near the window closest to the buttons; the page shows each button's signal.
- **Lamps:** "Find it" (or type the bridge's IP), press the round button on the Hue bridge, "Pair". Tick the lamps that are in the show and order them along the house. The key the bridge hands out is kept in `halloween/.hue.json`, which is not committed. The page makes one group on the bridge, "Halloween show" (it does not appear in the Hue app), so all the lamps can change at once.
- **Speaker:** pair the Bluetooth speaker with the laptop as usual, then use "Test: click and flash" and the slider until the two land together.
- **Your own sounds:** drop mp3, wav or m4a files into `sounds/spooky/` and `sounds/funny/` and reload. A recording plays in place of the built-in sound, over one of that kind's light shows; longer than 15 s is faded out.
- **On the night:** laptop on its charger, lid open, this tab in front (Chrome slows a hidden tab's timers). `caffeinate -d` in a terminal keeps the Mac awake.

The shows are the `SHOWS` list in `index.html`: each has a `sound` and a `lights` timeline. A new kind of button is one more entry in `ROLES`.

Seen running so far: the page in simulation only. The hub, real buttons, the Hue bridge and a Bluetooth speaker have not been tried with it yet.
