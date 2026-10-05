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
- **Lamps:** "Find it" (or type the bridge's IP), press the round button on the Hue bridge, "Pair". Tick the lamps that are in the show and order them along the house. Pairing is once: the key the bridge hands out never expires, and if the bridge's address changes the server finds it again by itself. The page makes one group on the bridge, "Halloween show" (it does not appear in the Hue app), so all the lamps can change at once.
- **Speaker:** pair the Bluetooth speaker with the laptop as usual, then use "Test: click and flash" and the slider until the two land together.
- **Your own sounds:** drop mp3, wav or m4a files into `sounds/spooky/`, `sounds/funny/` and `sounds/magic/` and reload. A recording plays in place of the built-in sound, over one of that kind's light shows; longer than 15 s is faded out.
- **On the night:** laptop on its charger, lid open.
- **The lamps are a line:** the order of the ticked lamps is the order along the house, and the chases, the ping-pong rally and the xylophone all run along it. Every thirteenth press is a jackpot.

The shows are the `SHOWS` list in `index.html`: each has a `sound` and a `lights` timeline. A new kind of button is one more entry in `ROLES`.

Seen running so far: the page in simulation only. The hub, real buttons, the Hue bridge and a Bluetooth speaker have not been tried with it yet.

## Porch glow

The same server has a second page, http://localhost:8031/glow (linked from the top of the show's page): ambient scenes for the lamps on any night, no buttons needed. Northern lights, a campfire, a tide rolling along the house, fireflies, and a calendar set (jack-o'-lantern, Christmas lights, Canada Day…); "Tonight" picks one from the date. Every card plays its scene in miniature.

- The scene is played by the server, not the page, so the window can be closed; it carries on after a restart. It can come on by itself at sunset (worked out for Saskatoon; `where` in `.glow.json`) or a set time, and go off at a set time. The Mac has to be awake.
- Choose its lamps under Lamps, or borrow the Halloween show's line. Starting the Halloween show stops a running scene.
- A scene is one function in `scenes.mjs`: `at(x, t, k, n)` answers the colour for the lamp at position `x` along the house at time `t`. Each lamp is nudged every `step` seconds and glides there, so scenes are slow by nature. Add one to the list and it appears on the page.
- After changing `server.mjs`, `glow.mjs` or `scenes.mjs`, restart the server: `launchctl kickstart -k gui/$(id -u)/ca.paxbuttonica.halloween`.

Seen running so far: the scenes on screen, and the engine against a pretend bridge. Not yet on the real lamps.

## What is remembered, and where

Everything is kept by the server in `~/Library/Application Support/PaxHalloween/`: the bridge's key (`hue.json`), the line of lamps and Porch glow's choices (`glow.json`), and the Halloween page's settings, button kinds and press count (`show.json`). So it is the same in the app, in a Chrome tab, and after the code is updated; nothing has to be set up twice. Both pages share the one line of lamps. A second argument to `server.mjs` names a different folder (tests use one, so they cannot touch the real lamps).
