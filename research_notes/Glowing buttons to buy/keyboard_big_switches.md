# Keyboard-style "big switches" and related bought mechanisms as a replacement for the 3D-printed slap button

Researched 2026-10-01. Provenance tags used on every finding: **[MFR]** = manufacturer spec or datasheet; **[SELLER]** = retailer or brand listing; **[REVIEW]** = enthusiast reviewer, forum or teardown blog; **[SNIPPET]** = only seen in a search-engine summary of the linked page (the page itself could not be fetched), so treat as lower confidence.

## 1. NovelKeys x Kailh "Big Switch" and any successors or competitors

### Takeaway
The NovelKeys x Kailh Big Switch (4x-scale Cherry MX clone, 55.8 mm square body, 14 mm travel, clear polycarbonate top housing with an LED slot, matching keycap included) is still the only functional giant keyboard switch found; it is currently sold out at NovelKeys with a restock promised for Q1 2027 (already slipped from Q3 2026). Kailh's own datasheet rates it at **5 million** cycles, not the "50 million" that aggregator sites repeat, and it is a 10 mA / 12 V signal switch with a 3 kgf static-load rating.

### Cited Findings
**What it is and the three versions**
- [SELLER] NovelKeys: "These switches are 4 times bigger on each side than a normal MX switch. That comes up to 64 times bigger in volume. These switches are fully functional. All switches come with a matching keycap." Price US$18.00 per switch; three versions, all "4.8mm Actuation 14mm Bottom", plate mount: Dark Yellow linear (280 g operating, 400 g bottom), Burnt Orange tactile (290 g peak, 280 g operating, 420 g bottom), Pale Blue clicky (280 g peak, 280 g operating, 360 g bottom). — [NovelKeys, The Big Switch Series](https://novelkeys.com/products/the-big-switch-series)
- [SELLER] Status on 2026-10-01: "Sold out", "RESTOCKING Q1 2027". — [NovelKeys](https://novelkeys.com/products/the-big-switch-series); a search-engine summary of the same page said it "was set to restock in Q3 2026" [SNIPPET], i.e. the restock date has already slipped at least once — [search summary of NovelKeys page](https://novelkeys.com/products/the-big-switch-series)
- [REVIEW] The switch dates from 2017 (originally "$20-25 per switch back in 2017", now $18) and had "remained perpetually in stock" for nearly six years as of the review (dated April 1, apparently 2023). — [ThereminGoat review](https://www.theremingoat.com/blog/novelkeys-x-kailh-big-dark-yellow-switch-review)

**Manufacturer datasheet (Kaihua/Kailh P/N CPG151101D228, doc KH-PS1708-12 rev A, Burnt Orange, hosted by Adafruit)** — [Kailh Big Switch product specification PDF](https://cdn-shop.adafruit.com/product-files/5306/5306_CPG151101D228_Burnt_Orange_stem.pdf)
- [MFR] Rating: "12V AC/DC max. 2V DC min.; 10mA AC/DC max. 10μA DC min". Insulation ≥100 MΩ at 500 V DC; withstand 100 V AC 1 min.
- [MFR] "Mechanical Life: 5,000,000 Cycles (Without load)". Life test: 12 V 10 mA resistive load, 1–2 operations/s, push force 300 gf, push travel 14 mm, 5,000,000 cycles; afterwards contact resistance ≤1000 mΩ, bounce ≤10 ms, operating force within ±30% of initial.
- [MFR] Contact resistance 100 mΩ max new. Bounce: on/off ≤5 ms before life test, ≤10 ms after.
- [MFR] Static strength: "A static load of 3kgf shall be applied in the direction of button operation for a period of 60 seconds" with no electrical or mechanical damage. Stem pull strength 5 kgf min. Shock: 320 g acceleration, 3 cycles in each of 6 directions.
- [MFR] Loading parameters: free position 61±0.8 mm, operating position 56.2±2.8 mm, pre-travel 4.8±2.8 mm, operating force 280±60 gf, over-travel 2.4 mm min, total travel 14±4 mm.
- [MFR] Profile drawing: body 55.8 x 55.8 mm (62.4 mm across the top view including the latch features), 61 mm tall from the base, 20 mm of body below the plate line, stem 16.2 mm tall, a ø15.4 mm centre post under the base, two PCB pins (4.4 mm long). Mounting options: "PCB (with pins)" or "Metal Frame (without pins)"; frame cutout 56 x 56.2 mm in a 6 mm frame.
- [MFR] Operating temperature −10 to +70 °C; application "computer keyboards, cash registers, industrial equipment and Man-Machine interface".
- [SELLER] DigiKey's listing for Adafruit 5306 repeats the datasheet: SPST-NO, Off-Mom, 10 mA at 12 V, "Mechanical Life 5,000,000 Cycles", "Electrical Life 5,000,000 Cycles", no illumination listed. — [DigiKey.ca 1528-5306-ND](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/5306/15794639)
- [SELLER, contradicted] Keybumps lists "Lifespan: 50 Million", "Giant 3-Pin" mount, MX stem — [Keybumps](https://keybumps.com/switches/nk-big-switch-burnt-orange.html); **contradicted by the Kailh datasheet (5,000,000 cycles)** above. The "50 million" figure appears to be copied from normal-size Kailh switches.
- [REVIEW] Geekhack teardown thread: a user notes the switches are "rated for 10mA" per the spec sheet; owners describe the reaction as "pure joy and excitement: 'That's so big!'"; another suggests it "could make for a decent nuclear launch button". — [Geekhack, Teardown - Kailh x Novelkeys BIG switches](https://geekhack.org/index.php?topic=94391.0)
- [SNIPPET] Body size without cap "62.4 x 55.8 x 55.8 mm"; a 4x MX needs a ~56 x 56 mm hole. — [search summary citing dotat.at build how-to](https://dotat.at/@/2023-12-20-big-switch.html) (page returned HTTP 503; consistent with the datasheet).

**Feel and sound (owner/reviewer reports)**
- [REVIEW] Clear polycarbonate top housing, winglatch style, "a rather narrow but seemingly functional LED slot". Surprisingly smooth with very little scratch; "stem/leaf interaction that shows up as what I would imagine is ping"; housing collisions at top-out and bottom-out are substantial; the sound is "incredible chaos", loud throughout the stroke (spring, leaves, housing). Factory lube: "GRACIOUS AMOUNT OF ... 'VASELINE JELLY-LIKE' LUBRICANT ON THE STEM LEGS"; "HOLLOW CENTER POLE, HOLLOW KEYCAP STEM MOUNT". — [ThereminGoat review](https://www.theremingoat.com/blog/novelkeys-x-kailh-big-dark-yellow-switch-review)
- [REVIEW] Durability anecdote: the reviewer's *break-in machine* failed after about 4 seconds on this switch ("LOOK AT WHAT THIS GIGANTIC SWITCH DID TO MY POOR BREAK IN MACHINE"); it was the machine that broke, not the switch. No long-term durability data. — [ThereminGoat review](https://www.theremingoat.com/blog/novelkeys-x-kailh-big-dark-yellow-switch-review)
- [REVIEW] ThereminGoat calls them "the only ones anywhere near their size to be functional." — [ThereminGoat review](https://www.theremingoat.com/blog/novelkeys-x-kailh-big-dark-yellow-switch-review)

**Accessories and successors/competitors**
- [SNIPPET] Keebio BAMFK-1 "Big Switch PCB": US$29.99, works with the NovelKeys Big Switch; 16 RGB LEDs (8 underglow + 8 upward-facing), ATmega32u4, USB-C, QMK/VIA, dual rotary encoder support, I2C pins and "an extra RGB pin". BAMFK-1 Acrylic Case and PCB Kit US$99.99. — [Keebio BAMFK-1](https://keeb.io/products/big-switch-pcb), [Keebio acrylic case kit](https://keeb.io/products/bamfk-1-acrylic-case-for-big-switch) (pages returned 403; data from search summaries). Keebio also lists a Pro Micro-based "Big Switch PCB" — [Keebio](https://keeb.io/products/big-switch-pcb-pro-micro).
- [MFR] Kailh news post: a lit keycap ("keycappie") for the Big Switch "was developed by Japanese DIY player ... which has lighting function and IC design. the keycappie was made by 3D print, so the price will be high" (sold via DMM.make). — [Kailh news, "Kailh Big Switch - God of Keycappie"](https://www.kailhswitch.com/news/kailh-big-switch-god-of-keycappie-19304444.html)
- [SELLER] Redragon K605 "Alien" giant keyboard: "200% the size of regular keyboards", 61 keys, "extra big Outemu Blue switches", RGB backlit, 23.00" x 7.95" x 2.33", 5.34 lb. Individual switch size not published; switches not sold separately. — [Micro Center](https://www.microcenter.com/product/632713/redragon-k605-giant-mechanical-gaming-keyboard-outemu-blue-switch), [Amazon](https://www.amazon.com/Redragon-Mechanical-Keyboard-Ergonomic-Anti-Ghosting/dp/B09V4HTWLT)
- [SNIPPET] 3D-printed giant MX clones exist as free models: Thingiverse "Big Mechanical Keyboard Switch by Poong" (PLA housing/stem, TPU/flexible-filament spring, keycaps scaled 400%) and MakerWorld "Super large keyboard switch" (dual spring, up to 2 cm travel). — [Thingiverse 4549299](https://www.thingiverse.com/thing:4549299), [MakerWorld 1360577](https://makerworld.com/en/models/1360577-super-large-keyboard-switch)
- [SNIPPET] Printed one-switch cases for the Kailh Big Switch with room for a hot-glued Pro Micro exist; Adafruit's "Big Key Switches Macro Pad" is the reference design. — [Adafruit Learn](https://learn.adafruit.com/big-key-switch/overview), [STLFinder](https://www.stlfinder.com/3dmodels/big-switch/)

### Inferences
- The 5-million-cycle rating is more than enough for this use: even at 200 presses per button per game and 50 games a year (10,000 presses/year, an assumption), that is centuries of rated life. "Millions of presses" is satisfied; the open question is slap abuse, not wear.
- Slap resistance is unproven. The only strength figure is a 3 kgf *static* load for 60 s; a hard palm slap can plausibly exceed that briefly, and the reviewer reports hard housing collisions at bottom-out. The 14 mm travel and 2.4 mm over-travel help absorb a slap more than a 4 mm MX switch would, but there is no impact rating.
- Electrically it suits an ESP32 GPIO with internal pull-up: ~3.3 V and tens of microamps sits inside the 2 V–12 V / 10 µA–10 mA window. Firmware debounce should allow ≥10 ms (the after-life bounce limit); a 1 s hold is a trivial momentary SPST-NO hold.
- The 55.8 mm body and stock keycap (larger still) are in the same size class as the current ~56 mm printed cap, so it is a near drop-in footprint, but taller (61 mm body free height plus keycap).
- No brand other than NovelKeys/Kailh (Max Keyboard, Glorious, Drop, etc.) was found to sell a functional giant switch; "competitors" are only printed hobby models, which inherit the durability problems of the current printed button.

### Gaps
- No RGB or translucent-keycap version of the Big Switch was found; whether the bundled keycap is translucent was not stated by any source fetched.
- The LED slot's exact size is not on the datasheet drawing; Adafruit used a 10 mm LED (see section 4), implying a slot of at least that size.
- Keebio's pages returned 403, so LED part numbers (WS2812/SK6812?), stock and shipping to Canada for BAMFK-1 are unconfirmed.
- No long-term owner reports of Big Switches failing (or surviving) under repeated slapping were found; Reddit searches surfaced nothing specific.
- Whether the Kailh-endorsed lit keycappie is still sold is unknown.

## 2. Building a big button around a standard MX-style switch, and off-the-shelf single-key products

### Takeaway
Standard MX-type switches have far higher manufacturer life ratings than the Big Switch (Kailh Box: 80 M cycles, IP56; Cherry MX2A: >100 M) and are built for south- or centre-mounted addressable SMD LEDs, but they have only ~3.6–4 mm travel and are designed for finger loads, so a 56 mm slap cap on one needs stabilizer wires or guides to stop edge presses binding. Off-the-shelf "one-key keyboards" and big USB buttons are USB HID devices, not simple contact closures, and none found combines a large translucent cap with addressable RGB.

### Cited Findings
**Switch datasheets**
- [MFR] Kailh Box set: operating force 45±10 gf (Red/Brown/White), 60±10 gf (Black); total travel 3.6±0.3 mm; pre-travel 1.8±0.4 mm (Red/Black), 2.0±0.4 mm (Brown); life "Up to 80M cycles"; "IP56 waterproof and dustproof level"; "Composite gold" contacts; SMD LED support "Yes"; US$35 per set, shown "Unavailable". — [Kailh, Box Switch Set](https://www.kailh.net/products/kailh-box-switch-set)
- [SELLER] The sealed "Box" structure "provides extra protection for the contact plate and leaf"; 18K gold contacts; ~80 million keystrokes. — [search summary of NovelKeys/Kailh/KPrepublic listings](https://novelkeys.com/products/kailh-box-switches), [KPrepublic](https://kprepublic.com/products/kailh-box-switch-chinese-style-red-grey-yellow-green-rgb-smd-dustproof-switch-for-mechanical-gaming-keyboard-ip56-waterproof-mx)
- [MFR] Cherry MX2A Red: "> 100 mil. keystrokes", 45 cN, 2.0 mm pre-travel, 4.0 mm total; the "MX RGB" version uses "CHERRY Refract technology" (a lens directing SMD LED light from the PCB into the keycap) and "a translucent lower part" with an SMD LED recess. — [Cherry MX2A Red](https://www.cherry.de/en-us/product/mx2a-red)
- [SNIPPET] Some MX2A variants (Silent Red) are rated >50 M; Red, Black, Speed Silver >100 M; debounce typically <1 ms. — [Tom's Hardware](https://www.tomshardware.com/news/cherry-intros-mx2a-mechanical-switches-rated-for-100-million-actuations), [Cherry blog](https://www.cherry.de/en-us/company/news/cherry-blog/article/cherry-mx2a)

**Per-key addressable LEDs**
- [SELLER] SK6812MINI-E: individually addressable reverse-mount RGB LED (~3.1 x 2.7 x 1.7 mm per one seller) soldered into a PCB cutout under an MX switch; "~12mA constant current drive"; footprint "MX_SK6812MINI-E" is "intended to be used with any regular MX switch footprint"; not pin-compatible with plain SK6812 Mini. — [Beekeeb](https://shop.beekeeb.com/products/sk6812mini-e), [ebastler KiCad keyboard parts](https://github.com/ebastler/kicad-keyboard-parts.pretty/blob/master/readme.md), [Keebmaker](https://keebmaker.com/products/rgb-led-sk6812-mini-e-3535)

**Large caps on small switches**
- [REVIEW] Keyboard stabilizers "flank the key switch with two non-functional switch actuators linked with a thick wire bar"; a printable parametric stabilizer for MX caps uses small disk magnets to hold the wire. — [Hackaday](https://hackaday.com/2020/08/20/print-your-way-to-keyboard-stability/), [riskable/void_switch](https://github.com/riskable/void_switch)
- [SNIPPET] Printables "Big Button" by SnailSwitch is a printed housing for a standard mechanical keyboard switch (heat-set inserts; the switch snaps into its hole). — [Printables 628940](https://www.printables.com/model/628940-big-button) (page returned 403)
- [SNIPPET] A DIY game-show buzzer builder found single-switch designs failed on edge presses and moved to multiple switches in a triangle. — [Instructables, Game Show Buzzer System](https://www.instructables.com/Game-Show-Buzzer-System/)

**Off-the-shelf single-key / big USB products**
- [SELLER] Amazon sells many 1-key USB "programmable macro keyboards" (Goshyda, Zunate with RGB, "Giant Enter Key" big Enter buttons): USB-C wired, user-defined shortcuts, typically a red MX-type switch, hot-swap. — [Goshyda](https://www.amazon.com/Goshyda-Keyboard-Programmable-Customized-Shortcut/dp/B0D9FVQ3JY), [Zunate](https://amazon.com/Zunate-Programmable-Keyboard-Mechanical-Customized/dp/B0DF39KNWP), [Giant Enter Key](https://www.amazon.com/Generic-Programmable-Keypad-Keyboard-Genericm30vdpn827/dp/B0D5JR6XGM)
- [REVIEW] Elgato Stream Deck Pedal: three USB footswitches; textured plastic top over "a solid metal plate"; "designed to be stepped on thousands of times"; feel adjustable with included springs (requires opening with a screwdriver); users report no wear after over a year of daily use. No switch rating published. — [GamesRadar review](https://www.gamesradar.com/elgato-stream-deck-pedal-review/), [Equipboard](https://equipboard.com/items/elgato-stream-deck-pedal)
- [REVIEW] Dream Cheeky 902 "Big Red Button" (USB panic button): USB HID, vendor ID 1d34 / product ID 000d; flip lid with a lever switch; open-source Linux/Python drivers exist; reviewers call the button "solid and not easily broken". — [Amazon listing](https://uedata.amazon.com/Dream-Cheeky-902-Electronic-Reference/dp/B004D18MCK), [PyDreamCheeky](https://pypi.org/project/PyDreamCheeky/), [fidian/bonkers](https://github.com/fidian/bonkers)
- [SELLER] Keychron C100 8K "Giant Custom Macro Pad" is 100 normal MX keys in a 196.65 mm grid (Apex Red, ~45 g), not one big key — not relevant. — [Digital Citizen](https://www.digitalcitizen.life/keychron-c100-packs-100-programmable-mechanical-keys-into-a-64-99-macropad/)

### Inferences
- Building on a Kailh Box switch buys a sealed, dust/splash-resistant contact rated 16x the Big Switch's life, but the ~3.6 mm stroke under a 56 mm cap will feel like a short "clack", not a deep slap; a wire stabilizer (or two, crossed) or a printed plunger guide is required, otherwise off-centre slaps rock the cap and side-load the stem. The switch is then no longer the weak point; the printed cap and guide are.
- One-key USB keyboards and the Dream Cheeky/Stream Deck products would each need their electronics bypassed (wire straight to the switch contacts) to give a GPIO contact closure; their value is as a donor housing/switch, not as a finished product. None found offers an addressable-RGB translucent cap.
- The cheapest way to test the feel question is to buy one Big Switch (when it is in stock) or one Box switch with a stabilizer before committing to six.

### Gaps
- No manufacturer impact/slap rating exists for any MX-type switch; Box "Heavy" variants' forces were not fetched.
- No Gateron datasheet was fetched; Gateron life ratings are not covered here.
- No product was found that is a single large keycap button with built-in addressable RGB *and* a bare contact-closure output.
- Stream Deck Pedal internals (switch type) unknown; no teardown found.

## 3. Novelty big buttons: Staples Easy Button, game-show buzzers, big USB buttons

### Takeaway
The Staples Easy Button is a heavy, weighted shell over a small PCB with a white rubber-dome contact; hackers routinely replace that dome with a 6 x 6 mm tactile switch. Professional quiz buzzers (e.g. UK Quiz Systems' ~93 mm "Quiz Palm Switch") are the closest bought "slap" product and are lit, but they are sold into proprietary buzzer systems and nothing found says their LEDs are addressable.

### Cited Findings
- [REVIEW] Easy Button interior: "a little chip under a black blob, a switch, and a few caps", a very thin speaker, two AAA batteries, metal rods as "counterweight to the off-centered batteries". — [Kevin Rye teardown](https://kevinrye.net/index_files/staples_easy_button.php)
- [SNIPPET] The original switch is "a white rubber button" mounted in the centre of the PCB; four prongs on the underside of the button head align with holes; makers replace it with "a 6mm x 6mm x 1mm momentary switch" in the same spot. Disassembly: pry out the four rubber feet, remove four screws, then two PCB screws. — [Instructables, DIY "Anything" Easy Button](https://www.instructables.com/Make-a-Staples-Easy-Button-Say-Whatever-You-Want-f/), [Instructables, Make an Easy Button Wireless](https://www.instructables.com/Make-an-Easy-Button-Wireless/)
- [SNIPPET] There are three built-in switches on the board, accessible by desoldering from the back. — [Electro-Tech-Online thread](https://www.electro-tech-online.com/threads/staples-easy-button-circuit-n-off-push-button.123334/)
- [REVIEW] Bob Baddeley chose it as an input because it is "heavy, easy to locate without looking for it, a great size, and it was just a single button"; he cut the traces to the chip and wired the switch to a serial port. — [Bob Baddeley, Staples Easy Button Hacking](https://www.bobbaddeley.com/2007/01/07/staples-easy-button-hacking/)
- [SELLER] Rubber-dome switches are generally rated about 5 to 10 million presses and lose their bounce over time ("mushier feel"). — [metal-domes.com blog](https://www.metal-domes.com/blog/2025/05/08/what-are-rubber-dome-key-switches/) (a dome-maker's marketing blog)
- [SELLER] Quiz Systems (UK) "Big Red Buzzer" / Quiz Palm Switch: "nearly 4" (93mm) in diameter", "multi-LED, illuminated", "extremely robust switch"; "the button's domed shape, means it's both a switch and light"; "Typically connected to and controlled by a Quiz Solo". — [Quiz Systems, Large Quiz Buzzers](https://www.quizsystems.co.uk/large-quiz-buzzer-button.html)
- [SNIPPET] Quiz Systems also sells 100 mm "Big Dome Slam Buzzers" and compact 60 mm models in 2/4/6/10-player systems. — [Quiz Systems home](https://www.quizsystems.co.uk/)
- [SNIPPET] Other quiz-buzzer vendors: QuizXpress, ESL Buzzer Game Systems, Retekess (wireless). — [QuizXpress](https://www.quizxpress.com/game-show-buzzers/), [ESL](https://esl-buzzer-game-systems.com/), [Retekess](https://www.retekess.com/collections/game-buzzer)
- [SNIPPET] DIY buzzers commonly use 3D-printed enclosures with off-the-shelf arcade buttons, wiring the microswitch's NO contact to a GPIO. — [Instructables, Game Show Buzzer System](https://www.instructables.com/Game-Show-Buzzer-System/)
- [REVIEW] Dream Cheeky Big Red Button: see section 2 (USB HID, lid lever switch, "solid and not easily broken").

### Inferences
- The Easy Button's rubber dome is a lower-grade mechanism than the current setup's needs; its value is the weighted, slap-friendly shell. Its red cap is opaque (general knowledge, not sourced), so it cannot show RGB without replacing the cap.
- Quiz palm switches are the bought product most explicitly designed to be slammed, but they are a UK system product; a single-unit purchase, its internal switch, LED type and Canadian shipping would all need to be asked of the vendor.

### Gaps
- No source states the Easy Button's rated life, the exact dome part, or its current Canadian price/availability; the product's current status at Staples Canada was not checked.
- Quiz Systems' switch mechanism, LED type, price and whether the button is sold alone were not on the fetched page (a dimensions PDF exists but was not retrieved).
- Dream Cheeky appears to be a long-discontinued product (listings are "RARE ... NOS" on eBay), but no definitive discontinuation source was found — [eBay listing](https://www.ebay.com/itm/115948387777).

## 4. How each option would host an addressable RGB light

### Takeaway
The Big Switch is the best lighting fit of the keyboard options: a clear polycarbonate top housing with an LED slot, which Adafruit lit with a single 10 mm LED and Keebio's BAMFK-1 lights with 8 upward + 8 underglow RGB LEDs; but its ø15.4 mm centre post and stem sit in the middle, so light has to come from a ring around the stem, and the stock keycap would likely need replacing with a translucent printed one. Standard MX switches only pass light from one small SMD LED, so a 56 mm glowing cap over one needs its own ring of LEDs on the PCB around the switch.

### Cited Findings
- [REVIEW] Big Switch top housing is clear polycarbonate with "a rather narrow but seemingly functional LED slot". — [ThereminGoat](https://www.theremingoat.com/blog/novelkeys-x-kailh-big-dark-yellow-switch-review)
- [SELLER] Adafruit's Big Key Switch macro pad uses "A 10mm LED to illuminate the Big Switch", press-fits the switch into a 3D-printed case, and runs a KB2040 (RP2040) that has "an on-board NeoPixel". — [Adafruit Learn, Big Key Switches Macro Pad](https://learn.adafruit.com/big-key-switch/overview)
- [SNIPPET] Keebio BAMFK-1: 16 RGB LEDs (8 underglow + 8 upward-facing) plus "an extra RGB pin" for more lights. — [Keebio BAMFK-1](https://keeb.io/products/big-switch-pcb)
- [MFR] Kailh mentions a 3D-printed Big Switch keycap "which has lighting function and IC design". — [Kailh news](https://www.kailhswitch.com/news/kailh-big-switch-god-of-keycappie-19304444.html)
- [MFR] Big Switch geometry from the datasheet: 55.8 mm square body, ø15.4 mm centre post below the base, stem 16.2 mm tall, PCB pins near the centre. — [Kailh datasheet](https://cdn-shop.adafruit.com/product-files/5306/5306_CPG151101D228_Burnt_Orange_stem.pdf)
- [MFR] Cherry MX RGB: lens ("Refract technology") guides one SMD LED's light into the keycap; translucent lower housing. — [Cherry MX2A Red](https://www.cherry.de/en-us/product/mx2a-red)
- [MFR] Kailh Box: SMD LED support. — [Kailh](https://www.kailh.net/products/kailh-box-switch-set)
- [SELLER] SK6812MINI-E is the standard per-key addressable LED under MX switches (~12 mA constant-current channels). — [Beekeeb](https://shop.beekeeb.com/products/sk6812mini-e)
- [SELLER] Quiz Palm Switch is "multi-LED, illuminated", dome acts as "both a switch and light". — [Quiz Systems](https://www.quizsystems.co.uk/large-quiz-buzzer-button.html)

### Inferences
- The current 37-LED hex board (31 mm across flats) would not sit under the Big Switch's centre (centre post and pins are there). An annular board with WS2812/SK6812s around the 15.4 mm post, inside or below the 55.8 mm clear housing, is the natural fit; the light then passes through clear polycarbonate and a translucent keycap. Expect a bright rim with a darker centre where the stem is, unless the keycap is thick, diffusing material.
- A single MX switch under a 56 mm translucent cap would look like one bright dot; even lighting needs a ring of LEDs on the carrier board around the switch plus a diffusing cap, i.e. much like today's design.
- Quiz palm switches and the Easy Button would need their lighting replaced to show the engine's colour animations (`off | dim | solid | pulse | flash | rainbow`).

### Gaps
- No photos or measurements were found of how evenly a Big Switch glows when lit from below, or of the slot dimensions.
- Whether the bundled Big Switch keycaps pass light is unconfirmed.

## 5. Price in CAD and availability for Canada

### Takeaway
As of 2026-10-01 the Big Switch is hard to buy in Canada: NovelKeys (US$18) is sold out until "Q1 2027", Adafruit has stopped stocking the linear, and DigiKey.ca lists the tactile at CA$38.96 with zero stock (one unit expected 29 Oct 2026). Standard Kailh Box switches are easy to get in Canada (Keychron.ca, Shockport), and the build-it-yourself MX route is the only one available now.

### Cited Findings
- [SELLER] NovelKeys: US$18.00, sold out, "RESTOCKING Q1 2027". — [NovelKeys](https://novelkeys.com/products/the-big-switch-series)
- [SELLER] NovelKeys free shipping: "Free domestic shipping is available for orders over $199 for all in stock items"; "Free international shipping is available for in stock orders over $299". No duty/tax handling stated. — [NovelKeys Knowledge Base](https://novelkeys-llc.helpscoutdocs.com/article/120-free-shipping)
- [SNIPPET] NovelKeys has turned on shipping to Canada (low-quality aggregator page). — [search result](https://kayschocolates.com/leech-sb66-anti/novelkeys-shipping-to-canada.html); NovelKeys support page: [novelkeys.com/pages/support](https://novelkeys.com/pages/support)
- [SELLER] DigiKey.ca, Adafruit 5306 (Burnt Orange tactile, DigiKey 1528-5306-ND): CA$38.96, "0 in stock; 1 estimated on 29-Oct-2026". — [DigiKey.ca](https://www.digikey.ca/en/products/detail/adafruit-industries-llc/5306/15794639); an earlier search-engine snapshot showed 8 in stock at CA$38.39 [SNIPPET], so stock moves.
- [SELLER] Adafruit 5305 (Dark Yellow linear): US$19.95, "No longer stocked". — [Adafruit 5305](https://www.adafruit.com/product/5305); tactile listing: [Adafruit 5306](https://www.adafruit.com/product/5306)
- [SELLER] Little Bird Electronics (Australia), Big Switch Tactile: $55.55 (AUD), SKU AF-5306. — [Little Bird](https://littlebirdelectronics.com.au/products/novelkeys-big-switch-tactile)
- [SELLER] Botland (Poland) lists Adafruit 5305 and 5306. — [Botland 5305](https://botland.store/biiiiig-buttons/20795-kailh-big-mechanical-key-switch-linear-dark-yellow-adafruit-5305-5904422378998.html), [Botland 5306](https://botland.store/biiiiig-buttons/20794-kailh-big-mechanical-key-switch-tactile-burnt-orange-adafruit-5306-5904422378981.html)
- [SELLER] Shockport, "Canada's Mechanical Keyboard Store", ships free from Canada and carries NovelKeys x Kailh, Cherry MX, Gateron, Durock. — [Shockport](https://shockport.ca/), [Shockport switches](https://shockport.com/collections/switches-1)
- [SELLER] Keychron.ca sells Kailh Box switch sets and other Kailh sets in CAD. — [Keychron.ca Kailh Box Switch Set](https://keychron.ca/products/kailh-box-switch-set), [Keychron.ca Kailh collection](https://keychron.ca/collections/kailh-switches)
- [SELLER] Kailh direct: Box switch set US$35, "Unavailable" on 2026-10-01. — [Kailh](https://www.kailh.net/products/kailh-box-switch-set)
- [SNIPPET] Keebio BAMFK-1 PCB US$29.99; acrylic case + PCB kit US$99.99. — [Keebio](https://keeb.io/products/big-switch-pcb)
- [SNIPPET] AliExpress search results exist for "big switch kailh" (sellers and authenticity not checked). — [AliExpress](https://www.aliexpress.com/w/wholesale-big-switch-kailh.html)

### Inferences
- Six Big Switches from NovelKeys would cost about US$108 before shipping, below the US$299 free-international threshold; with duties/brokerage and an exchange rate around 1.35–1.40 CAD/USD (assumption, not sourced) expect roughly CA$150–200 delivered, once stock exists. DigiKey.ca at CA$38.96 each (CA$234 for six) is simpler if it restocks, since DigiKey.ca already prices in CAD (whether duties are included was not checked).
- Because both NovelKeys and the Adafruit/DigiKey channel are out of stock now, a Big Switch plan is a 2027 plan unless an AliExpress or second-hand source is accepted.

### Gaps
- Whether Shockport, Dangkeebs, Ashkeebs or Kebo currently list the Big Switch was not confirmed (search did not surface their product pages).
- Amazon.ca listings for the Big Switch were not found.
- NovelKeys' duty handling (DDP vs DDU) for Canada and shipping cost below the free threshold are unknown.
- Keebio's shipping to Canada and the BAMFK-1's stock status are unconfirmed (403).
