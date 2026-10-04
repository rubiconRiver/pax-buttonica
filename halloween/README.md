# Halloween show

A kid presses a button on the step; the outdoor Hue lamps and a speaker put on a few seconds of show.
Everything runs on the laptop. Nothing here is deployed, and the buttons keep their normal game firmware.

Once, to make it an app:

```bash
~/TI4/halloween/install.sh
```

After that, open **Halloween Show** from `~/Applications` (drag it to the Dock). The server behind it starts by itself at login and is restarted if it stops; the app is the page in its own Chrome window, with its own Chrome profile, so the first time it will ask again for the hub and want the lamps ticked. `install.sh --remove` takes it away. Without installing, `node halloween/server.mjs` and http://localhost:8031 in Chrome still work.

It mends itself: a hub that is unplugged and plugged back in is picked up again within a few seconds, the screen is kept awake while the show runs, and a show that was running when the window closed carries on when it reopens.

- **Try it with nothing plugged in:** click the hexagons or the show names. The circles stand in for the lamps.
- **Buttons:** plug the hub in, "Connect the hub", switch the buttons on, give each a kind. The hub wants to be near the window closest to the buttons; the page shows each button's signal.
- **Lamps:** "Find it" (or type the bridge's IP), press the round button on the Hue bridge, "Pair". Tick the lamps that are in the show and order them along the house. The key the bridge hands out is kept in `halloween/.hue.json`, which is not committed. The page makes one group on the bridge, "Halloween show" (it does not appear in the Hue app), so all the lamps can change at once.
- **Speaker:** pair the Bluetooth speaker with the laptop as usual, then use "Test: click and flash" and the slider until the two land together.
- **Your own sounds:** drop mp3, wav or m4a files into `sounds/spooky/`, `sounds/funny/` and `sounds/magic/` and reload. A recording plays in place of the built-in sound, over one of that kind's light shows; longer than 15 s is faded out.
- **On the night:** laptop on its charger, lid open.
- **The lamps are a line:** the order of the ticked lamps is the order along the house, and the chases, the ping-pong rally and the xylophone all run along it. Every thirteenth press is a jackpot.

The shows are the `SHOWS` list in `index.html`: each has a `sound` and a `lights` timeline. A new kind of button is one more entry in `ROLES`.

Seen running so far: the page in simulation only. The hub, real buttons, the Hue bridge and a Bluetooth speaker have not been tried with it yet.
