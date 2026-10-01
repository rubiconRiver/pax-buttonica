# Premium arcade-button switches and addressable-RGB-ready arcade buttons

Researched 2026-10-01. Source tags used throughout:
**[DS]** manufacturer datasheet or manufacturer press release; **[Seller]** retailer listing; **[Review]** editorial review or guide; **[Anecdote]** forum or user report; **[Snippet]** seen only in a search-result summary, page not opened, so treat as unverified.

Context for the reader: the Pax Buttonica button needs a contact closure to GND on an ESP32 GPIO (internal pull-up, 3.3 V), addressable 5 V WS2812 light, a ~56 mm or larger cap that is slapped and held ~1 s, and "millions of presses, never sticks".

---

## 1. Microswitches used in arcade buttons: rated life and operating force

### Takeaway
The long-life microswitches are the full-size "basic" switches: Omron's V-series datasheet gives 50 million mechanical operations, with a 100 gf (V-10-1A4) low-force grade; Cherry/ZF's D44 light-force version (sold as "D44X", 75 cN) is rated 10 million. The small switches inside Sanwa buttons (SW-68) are rated only 1 million, and Seimitsu's around 2 million (unverified). All of these use silver-alloy contacts specified for loads far above an ESP32 pull-up's current, which matters for a long-life, low-current design.

### Cited Findings
**Cherry/ZF D4 series (the D44X is the D44 light-force version)**
- [DS] D4 datasheet: total travel 2.6 mm; mechanical life "> 2 x 10^5 to 1 x 10^7 operations" depending on model; housing PET, actuator POM; contact material D41 = AuAgPt "Crosspoint", D42 = Ag, D43–D48 = AgNi; IP40 inside the switch. — [ZF/Cherry D4 datasheet (RS Components copy)](https://docs.rs-online.com/6cb9/0900766b809e0c33.pdf)
- [DS] Switching parameters: D44 max operating force 285 cN standard, **75 cN "light"**; D45 400/100 cN; D48 150 cN light only; D41/D42/D43 170 cN standard, **45 cN light**; all have max pretravel 1.2 mm (D48 1.6), min overtravel 1.3 mm, max movement differential 0.3 mm. — [ZF/Cherry D4 datasheet](https://docs.rs-online.com/6cb9/0900766b809e0c33.pdf)
- [DS] Life table, light operating force: the 10 A grade (D44, 75 cN) is rated **10 x 10^6 mechanical operations with a POM actuator but only 2.5 x 10^5 with the PET actuator**; the 0.1 A grade (D41, gold crosspoint, 45 cN) is 10 x 10^6 (POM) / 1 x 10^6 (PET); "Lower operating forces on request" for the 0.1 A and 3 A grades. Electrical life 50,000 (EN) at rated current. — [ZF/Cherry D4 datasheet](https://docs.rs-online.com/6cb9/0900766b809e0c33.pdf)
- [Seller] Arcade retailers sell "Cherry D44X" as a 75 g button microswitch (4.8 mm or 6.3 mm terminals). — [Paradise Arcade Shop](https://paradisearcadeshop.com/products/cherry-pushbutton-microswitch); [Focus Attack](https://focusattack.com/d44x-75g-187-microswitch/); [Arcade World UK](https://www.arcadeworlduk.com/products/d44x-zf-cherry-button-microswitch-with-4-8mm-terminals.html)
- [Seller] Arcade Express lists the D44X at "75gr of actuation force", pre-travel 1.57 mm max, post-travel 1.27 mm min, and mechanical life "≥ 10,000 cycles" (this life figure contradicts the 10 million in the datasheet and looks like a typo). €1.57, 363 in stock. — [Arcade Express D44X 4.8 mm](https://www.arcadexpress.com/en/microswitches/144-cherry-d44x-48mm-button-microswitch.html)

**Omron V series (V-15-1A5, V-10-1A5, V-10-1A4)**
- [DS] Model legend, last digit: 6 = 3.92 N {400 gf}, **5 = 1.96 N {200 gf}, 4 = 0.98 N {100 gf}** max operating force (pin plunger). The 100 gf grade exists only in the 10 A family (V-10-1A4, V-10-1C24, etc.), not as V-15. — [Omron V datasheet](https://omronfs.omron.com/en_US/ecb/products/pdf/en-v.pdf)
- [DS] Pin-plunger operating characteristics: OF max 3.92 / 1.96 / 0.98 N; RF (release force) min 0.78 / 0.49 / 0.20 N; PT max 1.2 mm; OT min 1.0 mm; MD max 0.4 mm; OP 14.7 ± 0.4 mm. — [Omron V datasheet](https://omronfs.omron.com/en_US/ecb/products/pdf/en-v.pdf)
- [DS] Lever versions are lighter at the lever tip: hinge lever V-152-1A5 1.23 N, V-102-1A4 0.59 N; long hinge lever V-153-1A5 0.69 N, V-103-1A4 0.34 N (PT up to 9.0 mm). — [Omron V datasheet](https://omronfs.omron.com/en_US/ecb/products/pdf/en-v.pdf)
- [DS] Durability: **mechanical 50,000,000 operations min. (60 operations/min)**; electrical 300,000 (V-10) and 100,000 (V-15) at rated load; contact bounce: "Close or open circuit of the contact is shorter than 1 ms" (in the shock note); weight ~6.2 g. — [Omron V datasheet](https://omronfs.omron.com/en_US/ecb/products/pdf/en-v.pdf); 50 M mechanical / 100 k electrical for V-15-1A5 also stated by [Newark](https://www.newark.com/omron-electronic-components/v-15-1a5-by-omi/microswitch-pin-plunger-spdt-15a/dp/89C8186)
- [DS] Contacts are silver-alloy rivets, 1 mm gap; **"Minimum applicable load (reference value): DC5V 160mA"**. — [Omron V datasheet](https://omronfs.omron.com/en_US/ecb/products/pdf/en-v.pdf)

**Omron D2FC / D2F (subminiature "mouse" switches)**
- [DS] D2FC: OF 0.59 ± 0.15 N (F-7N) or 1.0 N (D2FC-7); mechanical/electrical durability 5 M (D2FC-7), 20 M (D2FC-F-7N(20M)), 60 M (D2FC-F-7N(60M)); silver contacts; minimum applicable load 5 VDC 1 mA; bounce 1 ms max. — [Omron D2FC datasheet (DigiKey copy)](https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/5389/D2FC_Datasheet_EN.pdf)
- [Snippet] Mouser also lists a D2FC-F-7N(100M) variant rated 100 million operations. — [Mouser](https://www.mouser.com/en/ProductDetail/Omron-Electronics/D2FC-F-7N100M?qs=iLKYxzqNS757BGMJVD2IKg%3D%3D)
- [Snippet] D2F-01: 0.74 N operating force, 1,000,000 mechanical cycles. — [datasheets.com D2F-01F](https://www.datasheets.com/omron/D2F-01F)

**Sanwa and Seimitsu internal switches**
- [Seller] Sanwa SW-68 (fits OBSF/OBSC, Qanba Metallic, JyueeAng): operating position 0.85 mm, total travel position 2.53 mm, 27 g to move from free position, **operating force 55 g**, total travel force 81 g, **lifespan 1 million under 5 VDC 10 mA**, "made by Omron"; US$1.50. — [Paradise Arcade Shop SW-68](https://paradisearcadeshop.com/products/sanwa-sw-68)
- [Review] All OBSF / OBSFS / OBSFE use the SW-68, a "non-clicking switch"; actuation ~55–60 g. — [Himura Games](https://himuragames.com/sanwa-obsf-obsfs-obsfe/)
- [Snippet] Seimitsu PS-14-GN: ~85 g actuation; stroke to operating position 2.5 ± 0.3 mm; mechanical endurance "over 2,000,000 cycles"; bounce under 10 ms. The Focus Attack page itself, when opened, did not show these numbers. — search summary attributing [Focus Attack](https://focusattack.com/seimitsu-ps-14-gn-screwbutton-green/) and [Shoryuken archive](https://archive.supercombo.gg/t/seimitsu-buttons-lets-talk/166928)

**Generic / large-button switches**
- [Seller] Pop'n-style 100 mm buttons use full-size microswitches: Sanwa sets ship with "LHS1F" or Omron **V-10-1A4** switches. — [Blue Spring Express](https://bluespringexpress.net/en-us/products/popn-music-sanwa-button-set-obsa-100umq)
- [Snippet] Generic Amazon 100 mm dome-button listings claim the microswitch is "tested to 10,000,000 cycles" in one listing and "1,000,000 lifetime cycles" in another; no maker named. — [Amazon listing](https://www.amazon.com/Button-Illuminated-Microswitch-Arcade-Machine/dp/B0B7B91NVP)
- No datasheet was found for generic "Zippy", "Highly", KW10 or KW11 switches.

### Inferences
- For "millions of presses", only full-size basic switches qualify on paper: Omron V-10-1A4 (100 gf, 50 M) is the best fit found: datasheet-rated, light, and the switch Pop'n Music-style 100 mm buttons already use. Cherry D44X (75 cN, 10 M with POM actuator) is lighter but rated five times shorter.
- Six buttons x ~100 presses a game is ~600 presses per button per game; even the 1 M Sanwa SW-68 would last ~1,700 games. A switch's rated life is unlikely to be what fails first. Sticking, wobble and contact reliability at low current are the more likely problems.
- **Low-current contact risk:** every arcade microswitch found uses silver or silver-nickel contacts with a minimum recommended load well above a GPIO pull-up (Omron V: 5 V/160 mA; D2FC: 5 V/1 mA; Sanwa's own rating is 5 V/10 mA). An ESP32 internal pull-up passes only tens of microamps (it is tens of kΩ). Silver contacts at that current can build up a film and give intermittent presses over years. Mitigations: an external 1–3.3 kΩ pull-up (1–3 mA flows only while held, so the battery cost is small), or a gold-contact switch: Cherry D41 "Crosspoint" (45 cN light grade), Cherry MX (gold crosspoint), or a Hall/optical sensor. The ESP32 pull-up value is not sourced in these notes; check the ESP32-S3/C3 datasheet.

### Gaps
- No Cherry/ZF datasheet entry for the exact "D44X" part number; the "X" suffix looks like arcade-retailer shorthand for the D44 light-force grade (inferred from the datasheet table).
- No current Omron datasheet found for gold-contact (micro-load) V-series variants; the V datasheet mentions only silver and indium versions.
- Seimitsu's switch specs are unverified (snippet only). No datasheets were found for Highly/Zippy/KW10/KW11 generic switches.
- ZF/Cherry D4 production status for October 2026 was not checked.

---

## 2. Non-contact and newer switches: Hall-effect, optical, keyboard switches (MX, Kailh, Gateron)

### Takeaway
Keyboard-switch arcade buttons (Cherry MX, Omron, Kailh) are an off-the-shelf way to get 50–100 M rated life, gold contacts and still a plain contact closure. Hall-effect "magnetic" arcade buttons exist only as parts of complete controllers or kits with their own USB controller board (Zenaim, Corsair Novablade, Akko FUNBOX). No standalone 30 mm Hall-effect arcade button with a simple switch output was found. A DIY Hall switch on an ESP32 is feasible with a digital Hall-switch chip at microamp current, at the cost of up to ~12 ms of latency (80 Hz sampling).

### Cited Findings
**Keyboard-switch pushbuttons**
- [DS] Cherry MX2A: "guarantees an industry-leading 100 million actuations*" (*"Depending on the switch variant"); "As with all MX switches, the MX2A continues to employ the unrivaled Gold Crosspoint Contact System." — [Cherry press release](https://www.cherry.de/en-us/company/news/press/article/cherry-mx2a-exceeding-expectations); also [Tom's Hardware](https://www.tomshardware.com/news/cherry-intros-mx2a-mechanical-switches-rated-for-100-million-actuations)
- [Review] Keyboard switches used in arcade buttons: Cherry MX, Kailh (standard and speed), Gateron, Logitech Romer-G (older Qanba Gravity), Kailh Low Profile (Snack Box Micro). Sanwa microswitches are rated 1 M; Cherry MX "rated up to 100 million (though a more conservative 50-70 million is about the average)". Hot-swap: Gamerfinger HBFS (plate mount, "easiest"); not hot-swap: Crown SDB-202 ("Much harder to change"), Qanba Gravity (switches "soldered onto their own PCBs"). — [Saturnforge keyboard-switch pushbutton FAQ (2022)](https://saturnforge.com/blog/2022/03/01/the-keyboard-switch-pushbutton-mechanical-switch-pushbutton-faq/)
- [Snippet] Kailh Choc V2 low profile: up to 50 M cycles; Red linear 43 ± 10 gf; pre-travel 1.3 ± 0.3 mm; total travel 3.2 ± 0.25 mm. — [Keycapsss spec page](https://keycapsss.com/switchestester/switches/125/kailh-low-profile-choc-v2-switches); [Kailh](https://www.kailh.net/products/kailh-choc-v2-low-profile-switch-set)
- [Snippet] Snack Box Micro (Junkfood) uses hot-swap Kailh Choc switches, Amber (45 g linear, 1 mm actuation) by default; Red 50 g, Red Pro 35 g, Pink 20 g, White 50 g clicky offered. These are mechanical, not magnetic. — [Junkfood Kailh Choc set](https://junkfoodarcades.com/products/kailh-low-profile-choc-switch-set); [The Arcade Stick review](https://thearcadestick.com/snack-box-micro/)

**Hall-effect ("magnetic") buttons**
- [DS] Zenaim Arcade Controller Button Module Kit: 14 × Φ24 + 1 × Φ30 buttons, 0.75 mm stroke, actuation adjustable 0.10–0.65 mm, reset 0.05–0.60 mm, **50 gf**; durability "exceeding 100 million" in testing; buttons connect by harnesses to Zenaim's controller board, which talks USB 2.0 full speed over USB-C; ¥29,700 incl. tax; Japan release 25 Sep 2025, international availability "pending future announcement". — [Zenaim announcement](https://zenaim.com/en/blogs/news/250915)
- [Review] The Zenaim kit puts a mini PCB under each button, wired to a larger controller PCB. — [PC Gamer](https://www.pcgamer.com/hardware/controllers/this-spicy-leverless-diy-kit-has-tiny-circuit-boards-under-each-button-so-you-can-create-your-own-rapid-trigger-hitbox/)
- [Review] Corsair Novablade Pro: 15 "MGX Hyperdrive" Hall-effect keys, durability "up to 150 million presses", actuation adjustable 0.1–4.0 mm (complete controller, not loose buttons). — [HotHardware](https://hothardware.com/news/corsair-novablade-hall-effect-leverless-fight-controller); [Corsair](https://www.corsair.com/us/en/explorer/gamer/leverless-controllers/corsair-novablade-pro-the-fight-controller-built-for-champions/)
- [Review] Akko FUNBOX: hot-swap for "Kailh low-profile magnetic and 3-pin mechanical switches", 50 kHz scan rate, travel adjustable 0.1–2.8 mm. — [Akko article](https://en.akkogear.com/magnetic-switch-technology-in-fighting-games-from-arcade-joysticks-to-leverless-controllers/)
- [Review] How it works: a magnet moves toward a Hall sensor, which outputs a voltage proportional to field strength, i.e. an analog position signal through the travel. — summary of [HotHardware](https://hothardware.com/news/corsair-novablade-hall-effect-leverless-fight-controller) / [Jasen's Customs Panzer HE](https://jasenscustoms.com/pages/the-panzer-hall-effect-system)
- A search for a standalone 30 mm snap-in Hall-effect arcade button with a switch output found none; only industrial Hall pushbuttons (e.g. DigiKey's "Pushbutton Switches – Hall Effect" category, OEM Controls HP1/HP2). — [DigiKey category](https://www.digikey.com/en/products/filter/pushbutton-switches-hall-effect/211); [OEM Controls HP1/HP2](https://www.oemcontrols.com/hp1-hp2-hall-effect-push-buttons/)

**Low-power Hall switch chip (how a DIY HE button could feed an ESP32 GPIO)**
- [DS] TI DRV5032 digital-switch Hall sensor: 1.65–5.5 V; open-drain or push-pull output; samples the field with an internal oscillator at **5 Hz (0.54 µA), 20 Hz (1.3 µA) or 80 Hz (5.2 µA)**; thresholds from 3.4 mT to 63 mT; SOT-23, X2SON, TO-92. — [TI DRV5032 product page](https://www.ti.com/product/DRV5032); [DRV5032 datasheet (Mouser)](https://www.mouser.com/datasheet/2/405/1/drv5032_pdf_3fts_3d1712898130560_26ref_url_3dhttps-2403047.pdf)

**Optical**
- [Anecdote/DIY] "shinsanwaswitch_slim" replaces the microswitch in Sanwa Pop'n (OBSA-100UMP), SDVX and IIDX buttons with an ITR1203 or ITR8402 optical interrupter (emitter resistor 500 Ω–1 kΩ, 10 kΩ pull-down) because "micro switches wear out through time", while the optical sensor "almost never wears out"; it uses the ZHR-5 connector of "Sanwa's native optical sensor buttons". — [GitHub shinsanwaswitch_slim](https://github.com/steelpuxnastik/shinsanwaswitch_slim)
- [Seller] Gamerfinger lists an "Optical Stick Kit" (no specs shown). — [Gamerfinger HBFS-30 page](https://www.gamerfinger.com/hbfs30.html)

### Inferences
- **Feel:** with Hall and optical sensing nothing clicks or snaps, so the feel comes entirely from the spring, the plunger guide and the bottom-out. A Hall button is not automatically crisper. The crisp snap people associate with arcade buttons comes from a microswitch's snap-action spring.
- **ESP32 on battery:** a DRV5032 (open-drain) behaves like a contact closure to GND and can wake the ESP32 from sleep on a GPIO edge. The 80 Hz version draws ~5 µA continuously and adds up to ~12.5 ms of sampling delay, invisible for a "turn done" press. A linear (analog) Hall sensor read through the ADC would need the MCU awake to sample, which is worse for battery. An optical interrupter's IR LED draws milliamps (implied by the 50–200 Ω / 0.5–1 kΩ resistors), too much to leave on for a battery button unless it is pulsed.
- A Cherry MX / MX2A switch (gold crosspoint, 50–100 M) in an MX-based arcade button is the lowest-effort way to get both long life and a contact suited to tiny currents.

### Gaps
- No standalone Hall-effect arcade button product with published per-button specs was found; current/standby draw of the Zenaim or Corsair modules is not published.
- Gateron low-profile and Gateron/Kailh magnetic switch datasheets were not retrieved.
- Specs of Sanwa's own optical-sensor buttons were not found.

---

## 3. Sanwa OBSF/OBSC/OBSFS, Seimitsu PS-14, Crown 202/205, Qanba Gravity, Gamerfinger: travel, force, feel, failures

### Takeaway
Sanwa OBSF/OBSC (55 g, 1 M-rated switch) is the light, "snappy" reference but has fragile snap-in tabs and reports of sticking and double inputs. Seimitsu PS-14 is heavier (~85 g, unverified). The keyboard-switch buttons trade a softer, linear feel for 50–70 M ratings: Qanba Gravity (Omron linear, 70 M, ~CAD $6), Crown SDB-202 (Cherry MX, plate mount) and Gamerfinger HBFS-30 (Cherry MX Red, 45 g, 50 M, hot-swap, hard to get). OBSFS is Sanwa's silent snap-in version; Sanwa's screw-in line is OBSN, not OBSFS.

### Cited Findings
**Sanwa**
- [Review] Variants: OBSF (solid), OBSC (translucent), OBSJ (metallic), OBSFE (silent), OBSN (screw-in); 30 and 24 mm; "light touch, fast response"; **"Snap-in tabs for the OBSF are notoriously fragile (especially on metallic variants)"**. — [Saturnforge pushbutton guide](https://saturnforge.com/blog/2022/05/08/the-big-arcade-stick-fightstick-pushbutton-guide/)
- [Review] OBSFS-30 = snap-in with a foam pad under the plunger ("mushy or cushioned", foam "may compress or deteriorate with heavy use"); OBSFE-30 = redesigned silent version, side clip tabs replaced by a single attachment point, no foam; OBSF "crisp bottom-out"; prices ~US$3 (OBSF), $3.30–4 (OBSFS), $3.50 (OBSFE). — [Himura Games](https://himuragames.com/sanwa-obsf-obsfs-obsfe/)
- [Seller] OBSF-30 is meant for metal panels ~2–4 mm thick. — search summary of [Sanwa OBSF-30 listings](https://paradisearcadeshop.com/products/sanwa-obsf-30-snap-in-button-red)
- [Seller] OBSC-30 clear buttons ~US$4.45–4.95 at Paradise Arcade, including "Clear White & [colour] Plunger" combinations. — [Paradise OBSC series](https://paradisearcadeshop.com/collections/sanwa-obsc-series)
- [Anecdote] Double inputs from Sanwa microswitches fixed by replacing the switch, or by cleaning the contacts with alcohol (suspected dirt or carbon). — [Shoryuken archive: Sanwa JLF double input](https://archive.supercombo.gg/t/sanwa-jlf-double-input-from-microswitch/168746)
- [Review] Sticking causes: dirt, a weak spring, a plunger rubbing the panel or housing, an over-tightened nut pinching the button. — [RetroOnly](https://retroonly.com/how-to-fix-sticky-arcade-buttons/)

**Seimitsu**
- [Seller] PS-14-GN (30 mm screw-in): "not as sensitive and are a bit harder" than OBSF-30; up to 7 mm panel; 2.8 mm terminals; €2.98. — [Arcade Express](https://www.arcadexpress.com/en/arcade-pushbuttons/671-12162-seimitsu-ps-14-gn-screw-in-japanese-arcade-push-button-30mm.html)
- [Seller] PS-14-GN US$4.25, used with thick (15 mm) cabinet panels. — [Focus Attack](https://focusattack.com/seimitsu-ps-14-gn-screwbutton-green/)
- [Review] Range: PS-14-K/KN (translucent, snap/screw, 30 mm), PS-14-G/GN (solid), PS-14-D/DN (24 mm); stiffer internal springs (PS-14-K-1.25, -1.5) available; no silent version. — [Saturnforge](https://saturnforge.com/blog/2022/05/08/the-big-arcade-stick-fightstick-pushbutton-guide/)
- [Snippet] ~85 g, 2.5 ± 0.3 mm to operating position, >2 M cycles (see section 1).

**Crown / Samducksa SDB-202**
- [Snippet] SDB-202 is an evolution of the SDB-201 using a Silver Cherry MX switch. — search summary of [Focus Attack SDB-202 24 mm](https://focusattack.com/crown-samducksa-sdb-202-mx-24mm-screwbutton-black/) (the 30 mm product page returned 404 when opened)
- [Anecdote] Users fitted Cherry MX Red/Black/Clear/Blue/Brown/Silver and Kailh Speed Bronze; Kailh BOX White "too narrow for the Samducksa plunger"; depth ~31 mm (vs OBSF 32 mm, PS-14-KN 34 mm); quieter than Seimitsu when slapped; reported "gap between button cap and rim" (wobble), inconsistent plunger tolerances, two-piece plunger "high pitched noise upon rebound" with tactile switches. — [Shoryuken archive SDB-202 thread](https://archive.supercombo.gg/t/crown-samducksa-sdb-202-buttons-let-s-talk/591930)
- [Snippet/Anecdote] Users call SDB-202 "way less mushiness and more tactile" than Sanwa. — search summary of the same thread / [Saturnforge](https://saturnforge.com/blog/2022/05/08/the-big-arcade-stick-fightstick-pushbutton-guide/)
- No data found on the Crown SDB-205.

**Qanba Gravity**
- [Seller] Gravity KS (30 mm snap-in, clear cap for artwork): "Omron Linear Switch", 0.8 mm trigger, 2.8 mm total travel, "70,000,000 cycle Life Span", silicone silencer pad; US$5.95. — [Paradise Arcade Gravity KS](https://paradisearcadeshop.com/products/qanba-gravity-ks-mechanical-shafts-silent-pushbutton-30mm-snap-in-button)
- [Seller] Gravity solid 30 mm (screw-in, 1–13 mm panels): "Custom OMRON Grey mechanical switches", 1.5 mm throw, ~50 g, 70 M pushes, silent linear; **CAD $5.99**. — [Canadian Joysticks](https://www.canadianjoysticks.com/qanba-gravity-solid-colour-30mm-mechanical-pushbutton-black/)
- [Snippet] Gravity LX: 1.5 mm pre-travel, 3.5 mm total, 50 cN. — [Qanba Gravity LX](https://qanba.vip/products/qanba-gravity-clear-30mm-mechanical-pushbutton-9)
- [Review] Conflict: a 2022 guide says Gravity buttons use Logitech Romer-G switches soldered to their own PCBs, while current listings say Omron switches. — [Saturnforge FAQ](https://saturnforge.com/blog/2022/03/01/the-keyboard-switch-pushbutton-mechanical-switch-pushbutton-faq/) vs [Paradise](https://paradisearcadeshop.com/products/qanba-gravity-ks-mechanical-shafts-silent-pushbutton-30mm-snap-in-button)

**Gamerfinger HBFS-30**
- [Seller/manufacturer] Cherry MX "Linear feel" Red keystem; operating force 45 g; operation travel 2.0 mm; total travel 2.5 mm; "50 million cycle" (at 5 V 1 mA, no load); "already have the LED holes"; snap-in, replaces like an OBSF-30; 2.8 mm terminals; listed as "Pre Order". — [Gamerfinger HBFS-30](https://www.gamerfinger.com/hbfs30.html)
- [Review] HBFS is "notoriously difficult to obtain outside of Japan". — [Saturnforge](https://saturnforge.com/blog/2022/05/08/the-big-arcade-stick-fightstick-pushbutton-guide/)
- [Seller] Separately, Amazon sells "Gamerfinger Mechanical Arcade Buttons with Mechanical MX Speed Silver Switches" (24 mm + 30 mm sets); whether these are Gamerfinger-made was not verified. — [Amazon](https://www.amazon.com/Gamerfinger-Mechanical-Arcade-Buttons-Switches/dp/B0CMLPHW5J)
- No Gamerfinger Hall-effect product was found.

### Inferences
- For a slap-and-hold table button, the reported failure modes (fragile snap tabs, cap wobble, plunger rubbing, double inputs from worn or dirty contacts) point to choosing screw-in mounting and a well-guided plunger as much as a long-life switch.
- Keyboard-switch buttons feel linear and "soft" next to a Sanwa microswitch snap. Someone who wants "crisp" may prefer a clicky or tactile MX switch in a hot-swap HBFS-style button, or a microswitch.

### Gaps
- No measured travel or force for the Sanwa button as a whole (plunger plus switch), only the SW-68 switch.
- No systematic failure-rate data, only anecdotes.
- No source for Crown SDB-205.

---

## 4. Arcade buttons with built-in ADDRESSABLE RGB, and NeoPixels under translucent plungers

### Takeaway
No mainstream arcade button found ships with a WS2812/SK6812 inside. The established path is a clear Sanwa OBSC or Seimitsu PS-14-K plus an undermount addressable LED board: Paradise Kaimana J2 (US$3.25, needs Paradise's driver), the open-source Open LED Project board (2 × WS2812B, ~US$2) or the moledcule DIY PCB. Big 60/100 mm LED buttons (Adafruit and others) come with single-colour 5–12 V LEDs; an 8-LED WS2812 ring has been retrofitted into the 60 mm one's ~45 mm cavity.

### Cited Findings
- [DS/open hardware] Open LED Project, Sanwa 30 mm RGB LED: **two WS2812B (5050)** on a PCB that "snaps onto the bottom of a clear Sanwa 30mm button"; data-in and data-out 3-pin 2.00 mm connectors (GP2040-CE/RP2040 pinout); works only with genuine clear Sanwa 30 mm (not 24 mm, not clones); suggested price "$2 USD for a single" or "$25 USD for a set of 8 boards shipped in the USA and Canada"; Gerbers for JLCPCB. — [OpenStickCommunity Hardware README](https://github.com/OpenStickCommunity/Hardware/blob/main/Miscellaneous/Open%20LED%20Project%20-%20Sanwa%2030mm%20RGB%20LED/README.md)
- [DIY] moledcule "WS2812B Programmable LED PCB For Sanwa OBSF 30mm Buttons": open-source design with Adafruit NeoPixel firmware; not sold ready-made. — [GitHub moledcule/sanwa-obsf-30](https://github.com/moledcule/sanwa-obsf-30)
- [Seller] Paradise Kaimana J2 RGB LED: "undermount indexable RGB", daisy-chained; opening 13.5 × 11.7 mm; fits Sanwa OBSC-30/24, Seimitsu PS-14-K 30 mm, PS-14-DNK 24 mm, Jyueeang 30/24; **not** Seimitsu PS-14-KN 30 mm; Samducksa SDB-202 only with tape or hot glue; US$3.25; LED chip type not stated on the page. Pairs with the Kaimana Mini or Kameleon driver PCB (8-button kit sold). — [Paradise Kaimana J2](https://paradisearcadeshop.com/products/paradise-kaimana-j2-rgb-led); [Kaimana Mini 8-button kit](https://paradisearcadeshop.com/products/paradise-kaimana-mini-led-driver-pcb-8-button-kit)
- [DIY] A 3D-printed adapter mounts Kaimana Mini J2 boards on Crown 202 30 mm buttons. — [Cults3D](https://cults3d.com/en/3d-model/game/kaimana-mini-j2-rgb-led-pcb-to-crown-202-arcade-button-adapter)
- [Snippet] Focus Attack sold an "FA 30mm Button RGB LED 8 Pak for GP2040-CE"; its product page returned 404 on 2026-10-01 (likely discontinued or moved). — [Focus Attack (404)](https://focusattack.com/fa-30mm-button-rgb-led-8-pak-for-gp-2040-ce/); [Focus Attack LED lighting category](https://focusattack.com/hardware-pcb/by-interest/led-lighting/)
- [Seller] Gamerfinger HBFS-30 has "LED holes" for adding lighting (LEDs not included). — [Gamerfinger](https://www.gamerfinger.com/hbfs30.html)
- [Seller] Adafruit 30 mm "Arcade Button with LED" (translucent): two SMD LEDs with a 200 Ω resistor, 5 V @ 10 mA; red and yellow need 5 V or more; **single colour, not addressable**. — [Adafruit 3491](https://www.adafruit.com/product/3491); [PiShop.us](https://www.pishop.us/product/arcade-button-with-led-30mm-translucent/)
- [Seller] Qanba 30 mm LED buttons: built-in 5 V blue LED (single colour). — [Qanba](https://qanba.com/products/qanba-30mm-led-arcade-buttons-illuminated-snap-in-push-button)
- [DIY] An 8-LED WS2812 5050 ring was hot-glued into the white underside cavity (~45 mm diameter, a few mm deep) of a 60 mm Large Arcade Button with LED (tall version) after removing the LED holder; three wires (5 V, GND, data); the LEDs "are quite happy with 3.3 V logic on the data line"; lesson: run the wires before assembly. 7-LED or 12-LED NeoPixel rings suggested as alternatives. — [scruss.com](https://scruss.com/blog/2022/03/13/adding-rgb-leds-to-an-illuminated-arcade-button/); same post at [Elmwood Electronics](https://elmwoodelectronics.ca/blogs/news/adding-rgb-leds-to-an-illuminated-arcade-button)
- [Seller] Adafruit 60 mm and 100 mm LED buttons: because of "the shallow depth of the button" the LED "doesn't illuminate the entire button face evenly". — [Adafruit 1192 (60 mm)](https://www.adafruit.com/product/1192); [Adafruit 1187 (100 mm)](https://www.adafruit.com/product/1187)
- [Snippet] A "WS2812B RGB Adapter (30 RGB)" is sold by A Custom Arcade (not opened). — [acustomarcade.com](https://acustomarcade.com/product/ws2812b-rgb-adapter-30-rgb/?v=0b3b97fa6688)
- [Snippet] Pimoroni "Picade" buttons and Ultimarc RGB buttons were not found to be addressable in this search; nothing on them was verified.

### Inferences
- For Pax Buttonica's 37-LED WS2812 board and 20 turn effects, a stock 30 mm RGB kit (two LEDs) would be a big downgrade in light. The better pattern is a big dome over a ring or disc of WS2812s, as already done, with the switch moved off to the side or centre.
- Sanwa OBSC "clear" bodies come in clear-with-coloured-plunger combinations; a clear-clear one is needed to show colours.

### Gaps
- No published measurement of how much light Sanwa or Seimitsu clear plungers transmit, or how diffuse they are.
- Kaimana J2 LED chip and voltage not confirmed (the page says only "indexable RGB").
- No arcade button found with factory-fitted WS2812/SK6812, beyond DIY and add-on boards. Pimoroni Picade and Ultimarc lines not verified.

---

## 5. A premium switch under a large (60–100 mm) dome, and how big buttons are made crisp

### Takeaway
Yes, this is exactly how commercial 100 mm buttons work. Sanwa's OBSA-100UMQ (Pop'n Music) and the DJ-DAO POPOLLER put a full-size Omron V-10-1A4 (100 gf, 50 M-rated) microswitch under the dome, with a separate return spring (100–400 g) setting the weight. Crispness comes from a low-force snap switch plus a spring heavy enough to keep the dome centred: below ~100 g springs the dome wobbles and can catch and stick. New Sanwa domes can stick out of the box.

### Cited Findings
- [Seller/wiki] Sanwa OBSA-100UMQ (100 mm, screw-in, illuminated): "Old Style" 200 g switch + 400 g spring; "New Style" 100 g switch + 100 g spring (or a 100 g reed-switch option); ~¥5,038–7,535 each; lamps in 5/12/24 V incandescent or LED. Samducksa CWB 401: 65 g switch + 200 g spring, US$9, "notably lighter". Generic AliExpress/eBay/Amazon 100 mm buttons have "extremely heavy springs and switches (upwards of 500-600g total)". — [rhythm-cons wiki: 100 mm dome buttons](https://rhythm-cons.wiki/parts/buttons/100-circular-dome-buttons/)
- [Seller] OBSA-100UMQ "comes with MS-O-3R micro switch and 200g spring" (one retailer's description). — [Video Games New York](https://videogamesnewyork.com/sanwa-obsa-100umq-button-1x/)
- [Seller] Blue Spring Express 9-button Pop'n set: 9 × OBSA-100UMQ, 9 × 400 g and 20 × 100 g Sanwa springs, 10 switches (LHS1F for HD cabinets or Omron **V-10-1A4** for SD cabinets/controllers); US$367.59, sold out; new buttons "can suffer from sticking when they are new from the factory", so start on 400 g springs and drop to 100 g after wear-in; reviewers note "crisp sound" and that 100 mm buttons are loud. — [Blue Spring Express](https://bluespringexpress.net/en-us/products/popn-music-sanwa-button-set-obsa-100umq)
- [Review] DJ-DAO / Gamo2 POPOLLER (US$229): "Omron V-10-1A4 100g microswitches and 200g springs", plus ten 100 g springs; "Once the spring becomes too light, the button no longer feels properly balanced inside the housing... the button can wobble as it is being pressed... can actually catch against the housing and get stuck instead of returning smoothly." Going below ~100 g is not recommended. — [Tech-Critter POPOLLER review](https://www.tech-critter.com/gamo2-popoller-popn-music-controller-review/); [DJ-DAO](https://www.dj-dao.com/en/popoller)
- [Seller] Adafruit Massive Arcade Button 100 mm: US$9.95, "a common arcade microswitch" (no rating given), 0.187" switch terminals, LED with built-in resistor up to 12 V. — [Adafruit 1187](https://www.adafruit.com/product/1187)
- [Seller] Adafruit Large Arcade Button 60 mm: US$5.95; 15.2 mm tall unpressed, 12 mm pressed (≈3.2 mm travel); 52.5 mm stem length with switch; arcade microswitch included. — [Adafruit 1192](https://www.adafruit.com/product/1192)
- [Seller] SparkFun "Big Dome Pushbutton" (100 mm), with a horizontal microswitch and a heavy "click"; microswitch life is quoted differently by different listings (10 M vs 1 M). — [SparkFun](https://www.sparkfun.com/big-dome-pushbutton-red.html) (via search summary)
- [Seller] Arcade Express sells a "Rounded Convex LED Illuminated Arcade Button 60mm". — [Arcade Express](https://arcadexpress.com/en/buttons-arcade-pushbuttons/276-549-rounded-convex-led-illuminated-arcade-button-60mm.html)
- [DS] Omron V hinge-lever versions lower the force at the actuator (e.g. V-103-1A4 long hinge lever 0.34 N max, PT up to 9 mm), so a lever can be used to place the switch off-centre under a large cap. — [Omron V datasheet](https://omronfs.omron.com/en_US/ecb/products/pdf/en-v.pdf)

### Inferences
- A 56–100 mm printed dome can use the same recipe: a screw-in style guided plunger or housing, an Omron V-10-1A4 (or V-15-1A5 for a firmer snap) pin-plunger switch at the centre, and a separate coil return spring of ~100–200 g. The spring centres and lifts the dome; the microswitch supplies the "click" and the electrical contact. The total feel is roughly spring plus switch force (e.g. 100 + 100 g).
- For "never sticks", what matters is a long, tight plunger guide (the wobble/catch failure is a guide-length versus spring-force problem), avoiding over-tightened mounting, and enough spring force. Buying a 100 mm Sanwa or Samducksa dome as the mechanism and lighting it from below is a proven option. The light path is the catch: the switch and spring sit in the centre where the LED board is today.

### Gaps
- No datasheet found for Sanwa's own "MS-O-3R" or "LHS1F" switches.
- No source quantifies dome wobble versus guide length; no Samducksa CWB 401 datasheet.
- No commercial 60–100 mm dome with addressable RGB was found.

---

## 6. Price and availability for Canada

### Takeaway
The only Canadian arcade-parts retailer confirmed is Canadian Joysticks (Qanba Gravity CAD $5.99). "Arcade Express" (arcadexpress.com) is a European store (EUR prices, Spanish phone number), not Canadian. Elmwood Electronics (Canadian, carried Adafruit's big buttons) appears to have stopped taking orders. Most parts come from US shops (Paradise Arcade, Focus Attack, Adafruit) in USD. CAD prices from DigiKey.ca and Mouser for the Omron switches were not retrieved.

### Cited Findings
- [Seller] Canadian Joysticks: Qanba Gravity solid 30 mm **CAD $5.99** each (some colours out of stock). — [Canadian Joysticks](https://www.canadianjoysticks.com/qanba-gravity-solid-colour-30mm-mechanical-pushbutton-black/)
- [Seller] Arcade Express prices in EUR (D44X €1.57; Seimitsu PS-14-GN €2.98; PS-14-DN €2.81), ships via NACEX, contact phone +34, so it is based in Spain. — [Arcade Express D44X](https://www.arcadexpress.com/en/microswitches/144-cherry-d44x-48mm-button-microswitch.html); [Arcade Express PS-14-GN](https://www.arcadexpress.com/en/arcade-pushbuttons/671-12162-seimitsu-ps-14-gn-screw-in-japanese-arcade-push-button-30mm.html)
- [Snippet] Elmwood Electronics (Canada) "has stopped accepting orders"; PiShop.ca may stock the same Adafruit buttons. — search summary of [Elmwood 60 mm button page](https://elmwoodelectronics.ca/products/large-arcade-button-with-led-60mm-white)
- [Seller] USD prices: Sanwa SW-68 $1.50; OBSC-30 $4.45–4.95; Qanba Gravity KS $5.95; Kaimana J2 $3.25 (Paradise Arcade); Seimitsu PS-14-GN $4.25 (Focus Attack); Adafruit 60 mm $5.95, 100 mm $9.95; Open LED Project boards ~$2 each, $25 for 8 shipped to US/Canada. — [Paradise SW-68](https://paradisearcadeshop.com/products/sanwa-sw-68); [Paradise OBSC](https://paradisearcadeshop.com/collections/sanwa-obsc-series); [Paradise Gravity KS](https://paradisearcadeshop.com/products/qanba-gravity-ks-mechanical-shafts-silent-pushbutton-30mm-snap-in-button); [Paradise Kaimana J2](https://paradisearcadeshop.com/products/paradise-kaimana-j2-rgb-led); [Focus Attack PS-14-GN](https://focusattack.com/seimitsu-ps-14-gn-screwbutton-green/); [Adafruit 1192](https://www.adafruit.com/product/1192); [Adafruit 1187](https://www.adafruit.com/product/1187); [Open LED Project](https://github.com/OpenStickCommunity/Hardware/blob/main/Miscellaneous/Open%20LED%20Project%20-%20Sanwa%2030mm%20RGB%20LED/README.md)
- [Seller] Big-dome reference prices: Sanwa OBSA-100UMQ ~¥5,038–7,535 each; Samducksa CWB 401 US$9; Blue Spring Express 9-set US$367.59 (sold out). — [rhythm-cons wiki](https://rhythm-cons.wiki/parts/buttons/100-circular-dome-buttons/); [Blue Spring Express](https://bluespringexpress.net/en-us/products/popn-music-sanwa-button-set-obsa-100umq)
- [DS] Zenaim HE kit ¥29,700, Japan only so far. — [Zenaim](https://zenaim.com/en/blogs/news/250915)
- [Seller] Omron V-15-1A5 and D2FC are stock DigiKey/Mouser parts. — [DigiKey V-15-1A5](https://www.digikey.com/en/products/detail/omron-electronics-inc-emc-div/V-15-1A5/1828994); [Mouser D2FC-F-7N(60M)](https://www.mouser.com/ProductDetail/Omron-Electronics/D2FC-F-7N60M?qs=17ckDYBRdemb%2FhG7xZ3N6w%3D%3D)

### Inferences
- A six-button build in any of these mechanisms costs little in parts (switches US$1.50–6 each, domes US$6–10 generic, ~US$40–55 Sanwa). The real cost is shipping and duty from US, Japanese or EU shops to Saskatoon. DigiKey.ca, which ships to Canada with CAD pricing, is the simplest source for Omron V-10-1A4 / V-15-1A5 or Cherry MX switches.

### Gaps
- CAD prices from DigiKey.ca, Amazon.ca, Arcade Shock or Focus Attack's Canadian shipping were not retrieved.
- Whether Elmwood has closed for good, and current stock at PiShop.ca, not verified.
- Canadian availability of Gamerfinger HBFS-30 and Crown SDB-202 not established.
