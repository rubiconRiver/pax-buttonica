# Industrial and premium illuminated pushbuttons as a bought slap button (catalogue, Oct 2026)

Source tags used below: **[datasheet]** = manufacturer datasheet or catalogue PDF; **[mfr page]** = manufacturer web page; **[seller]** = retailer or marketplace listing; **[distributor]** = distributor price/stock aggregator; **[search summary]** = text from a search-engine summary of the linked page that I could not open directly (treat as less certain). Prices are in the currency the source gave; no source gave CAD (see the price section).

## 1. Which large-head / mushroom and RGB or multicolour illuminated pushbuttons exist, and what are their mechanical specs?

### Takeaway
Two families exist and neither is a direct drop-in for a 56 mm slap cap. (1) Anti-vandal metal buttons with an RGB ring (APEM AV, E-Switch PV6/PV7, Onpow GQ, Bulgin MP22, Schurter MSM/MCS, Adafruit's rebadged 16/19/22 mm) top out at a 30 mm face, have 1.5 to 3 mm of travel, and are rated around 0.5 to 1.5 million mechanical cycles. (2) Modular 22 mm industrial operators (EAO Series 45, RAFIX 22 QR, Schneider Harmony XB4/XB5, IDEC HW) offer 40 mm and even 60 mm (EAO) illuminated mushroom heads and up to 10 million cycles (EAO), but they light in a single fixed colour.

### Cited Findings

**Adafruit Rugged Metal Pushbutton, RGB (16 mm #3350, 19 mm #3425, 22 mm #3423)**
- 22 mm version: 22 mm mounting hole, 1 to 7 mm panel, 2 mm operating stroke, chrome-plated brass, operating pressure 1.5 to 2.5 N, mechanical life >500,000 cycles, electrical life >50,000 cycles, contact resistance <50 mΩ, two separate SPST switches (one NO, one NC) [seller/maker spec page] — [Adafruit 3423](https://www.adafruit.com/product/3423)
- 16 mm and 19 mm RGB momentary versions and a black-finish 16 mm latching RGB version are listed — [Adafruit 3350](https://www.adafruit.com/product/3350); [Adafruit 3425](https://www.adafruit.com/product/3425); [Adafruit 4660](https://www.adafruit.com/product/4660)
- Rubber gasket included to keep water out; fits material up to 1/4 in thick [seller] — [Jameco / Adafruit listing summary](https://www.jameco.com/z/3423-Adafruit-Industries-Rugged-Metal-Pushbutton-22mm-6V-RGB-Momentary_2513503.html)

**APEM AV series (anti-vandal; APEM is an IDEC company)**
- Bushing sizes 16, 19, 22, 24 and 30 mm; sealing up to IP67/IP69K; impact up to IK10; single-colour, dual-colour or RGB LEDs; life 200,000 to 1,000,000 cycles depending on model [mfr page] — [APEM AV news page](https://www.apem.com/en-us/news/av-series-aesthetic-push-button-with-robust-performance)
- AV 30 mm NC/NO illuminated: travel 2.5 ± 0.3 mm, IK06 (1 J), IP67, mechanical life 1,000,000 cycles, -30 to +85 °C, panel 1 to 6 mm, "7 different colors and RGB illumination available" [mfr page] — [APEM AV 30](https://www.apem.com/panel-switches/pushbutton-switches/av-30-nc-no-illuminated)
- AV 19/22 NC/NO illuminated: travel 2 ± 0.3 mm, operating force 5 ± 2 N, mechanical life 1,000,000 cycles, cut-out 19.2 or 22.2 mm, IP67 optional, nickel/chrome/stainless actuators, ring LED resistor options 12/24/48 VDC [mfr page] — [APEM AV 19-22 illuminated](https://www.apem.com/panel-switches/pushbutton-switches/av-19-22-nc-no-illuminated)
- 2025 product guide: AV 19/22 NC/NO max rating 1 A 30 VDC, up to IP67, illuminated; AV 30 mm NC/NO 1 A 30 VDC, up to IP67, illuminated; AV 22 mm "mushroom head" model listed as non-illuminated, 5 A 250 VAC, IP65 [datasheet] — [APEM Product Guide 2025](https://www.apem.com/api/asset/en/EkOT3HTKDfWiKDCwx2sYK/APEM-Product_Guide_2025-bdef.pdf)
- APEM IZ (metal/plastic) and IR series are 16 mm bushing pushbuttons (IZ 4 A 48 VDC, IP67; IR 5 A 28 VDC), so they are small-head, not large-head, options [datasheet] — [APEM Product Guide 2025](https://www.apem.com/api/asset/en/EkOT3HTKDfWiKDCwx2sYK/APEM-Product_Guide_2025-bdef.pdf)
- An older AV (400/800 series, 19 mm bushing) datasheet shows a non-illuminated mushroom cap of Ø33.10 mm [datasheet, older] — [APEM AV legacy datasheet via digchip](https://www.digchip.com/datasheets/download_datasheet.php?id=5400901&part-number=AV49402ZQE6)

**Schurter (MSM, MSM LA CS, MCS, PSE)**
- Schurter's multicolour landing page lists MSM (19, 22 and 30 mm; ring or complete actuator-area illumination; seven colours; three flat plug connectors for red, green and blue; IP67/IK07), MCS (mechanical, multicolour), PSE (piezo, multicolour, 5 to 28 VDC) and CPS (capacitive) [mfr page] — [Schurter Multicolor Switches](https://www.schurter.com/en/Landing-Page/Products-and-Technologies/Multicolor-Switches)
- MSM 30: lifetime 1.5 million actuations [search summary] — [Schurter MSM 30 PDF on Mouser](https://www.mouser.com/pdfdocs/Schurtertyp_MSM_30.pdf)
- MSM LA CS: stainless steel with a ceramic actuator, **latching (ON/OFF)**, backlit across the whole surface, RGB via three flat plugs (mixes cyan, magenta, yellow, white), 19 and 22 mm, 250 VAC 12 A, 1 or 2 pole, IP64, -20 to +85 °C [search summary of Schurter news] — [Schurter MSM LA CS news](https://www.schurter.com/Info-Center/News/Archive/Timeline/MSM-LA-CS-robust-metal-pushbutton-switch-with-ceramic-actuator-surface)
- MCS 30 (Metal Switch Short Stroke, ring illuminated): momentary N.O.; actuating force 3.7 N; **actuating travel 0.4 mm**; lifetime 1 million actuations; IK05; IP65; aluminium or stainless housing; 200 mm wire leads; bounce <5 ms; variants 1241.6454 (multicolour, aluminium), 1241.6455 (RGY), 1241.6456 (multicolour, stainless) [datasheet page] — [Schurter MCS 30 datasheet](https://www.schurter.com/en/datasheet/MCS_30)

**E-Switch PV series (anti-vandal)**
- PV6: 16 mm cut-out; 2 A 48 VDC; mechanical life 1,000,000 cycles; electrical 50,000; travel 1.50 mm; actuation force 400 gf; IP65; SPST off-(on); panel 1 to 10 mm; dot or ring illumination; LED colour option "R - RGB" [datasheet] — [E-Switch PV6 datasheet (Hawk mirror)](https://www.hawkusa.com/sites/default/files/hawk_item/ESWCH/PV6/PV6spec.pdf)
- PV6 RGB is rated 1 million mechanical / 50,000 electrical cycles [search summary of trade press] — [Power Electronic Tips](https://www.powerelectronictips.com/pv6-series-anti-vandal-switch-now-offers-rgb-led-illumination/)
- PV7: 22 mm cut-out; 2 A 48 VDC; electrical life 50,000; travel 2.20 mm; actuation force 4 N; IP65; DPST-NO/NC; panel 1 to 8 mm (momentary); RGB LED option; -35 to 85 °C. The extracted datasheet text did not show a mechanical-life line [datasheet] — [E-Switch PV7 datasheet](https://configured-product-images.s3.amazonaws.com/Datasheets/PV7.pdf)
- PV4: 19 mm cut-out, RGB option, 4 N, IP65, 50,000 electrical cycles, 2 A 24 VDC; PV0: 12 mm cut-out with RGB option [search summary of Mouser and E-Switch pages] — [Mouser PV4](https://eu.mouser.com/new/e-switch/eswitch-pv4-antivandal-switches/); [E-Switch PV0](https://www.e-switch.com/product-catalog/pv0-series-ip67-illuminated-anti-vandal-switch)

**Onpow GQ / LAS1-GQ (anti-vandal)**
- GQ22 tri-colour (RGB) ring: 22 mm cut-out, Φ25 mm head, depth behind panel (L) 35.8 mm momentary / 40.5 mm latching, actuation force about 4 N, travel about 2.5 mm, mechanical life 1,000,000 cycles, electrical 50,000, IP65 (IP67 to order), IK10, stainless or black aluminium, panel 1 to 8 mm [datasheet] — [Onpow catalogue PDF](https://onpowbutton.com/uploads/cbf00c4e889cf3e37bc6068b6ddaa3c33.pdf)
- The same catalogue covers GQ25, GQ28 and GQ30 sizes (25/28/30 mm) [datasheet] — [Onpow catalogue PDF](https://onpowbutton.com/uploads/cbf00c4e889cf3e37bc6068b6ddaa3c33.pdf)
- GQ12-A with RGB is rated ≥500,000 cycles; GQ16/19/22 ≥1,000,000 [search summary of Onpow page] — [Onpow GQ series news](https://onpowbutton.com/news/gq-series-push-button-switches/)
- Sold on Amazon as "ONPOW 22mm ... Tri-Color (RGB) Momentary/Latching ... (GQ22-11E/J/RGB/A)" [seller] — [Amazon.com listing](https://www.amazon.com/ONPOW-Tri-Color-Momentary-Illuminated-Aluminium/dp/B07Z48WH7T)

**Bulgin (MP22 RGB, MPI002)**
- MP22 ring-illuminated RGB (and power-symbol RGB): LED 6/12/24 V, stainless or black aluminium, IP65 or IP67, SPDT or DPDT, latching or momentary, common anode or common cathode; part code MP22[S/D][L/M]QR[CC/AC]Q[006/012/024][S/A][5/7]; mechanical life momentary ≥1,000,000 (latching ≥500,000), electrical ≥50,000, operating force about 3 N (1NO1NC) / 4 N (2NO2NC), travel about 3 mm, IK09, 22 mm cut-out, max panel 8 mm [datasheet] — [Bulgin vandal-resistant switches catalogue](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf)
- MPI002: 22 mm, ring illumination, single or dual colour only (red/green, red/blue, green/blue, green/white), no RGB; max switch rating 50 mA 24 VDC; **operating pressure 12 N**; electrical life 35,000 operations (min); IP66 front only ("micro switch not sealed") [datasheet] — [Bulgin vandal-resistant switches catalogue](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf)

**EAO (Series 45, 84, 61)**
- Series 45 mushroom-head pushbuttons come in 30, 40 and 60 mm actuators, illuminated and non-illuminated, plastic or metal, momentary or maintained; up to six contact elements; "good tactile feedback and a long service life of up to 10 million switching cycles"; IP69K [datasheet/brochure] — [EAO Series 45 brochure](https://media.graphassets.com/ynqgxnNST6lA2dsstsbX)
- Series 45 illumination elements: 6 to 24 VAC/DC, 24 to 240 VAC/DC, 110 VAC; mounting cut-outs in the EAO range are 16, 19, 22.3 and 30.5 mm [datasheet/brochure] — [EAO Series 45 brochure](https://media.graphassets.com/ynqgxnNST6lA2dsstsbX)
- Series 84 (22.5 mm): "halo illumination" pushbuttons including "an animated illuminated bezel version, allowing for chasing LED sequences, multi-color illumination, and partial bezel illumination"; 42 V/100 mA max rating [search summary of Mouser page] — [Mouser EAO Series 84](https://www.mouser.com/new/eao/eao-series-84-modular-switches)
- Series 61 illuminated pushbuttons include 24 x 24 mm square versions [mfr page] — [EAO Series 61 product](https://www.eao.com/product/61-9671.6~10-2J12.1066~61-1100.0~61-8490.12~61-9930.0/pushbutton/en/61-24-mm-x-24-mm-1-nc-2-no-ip65-28-x-05-mm)

**RAFI (RAFIX 22 QR, 22 FS+, 30 FS+)**
- RAFIX 22 QR illuminated pushbutton (1.30.240.001/1508): 22.3 mm mounting hole, 29.8 mm collar, mounting depth 56.4 mm, installation height 9.4 mm, operating life 1,000,000 cycles (B10 1,300,000), IP65 front, max operating travel 4 mm, modular (actuator + coupling + switching element + LED element) [datasheet] — [RAFIX 22 QR datasheet (RS)](https://docs.rs-online.com/1e6a/A700000013697981.pdf)
- A RAFIX 22 QR 40 mm illuminated mushroom-head pushbutton exists [search summary] — [RAFI 22 QR general data (Mouser PDF)](https://www.mouser.com/datasheet/2/832/rafi_s_a0001003268_1-2295349.pdf)
- RAFIX 30 FS+ illuminated pushbutton with ring lighting: 30.3 mm mounting hole, 34.5 mm collar, mounting depth 15.7 mm, travel max 4 mm, 1,000,000 cycles (B10 1.3 M), IP65; ring lighting comes from LEDs in the switching element [mfr eCatalog] — [RAFI eCatalog 30 FS+](https://ecatalog.rafi-group.com/EN/US/product-finder/innovations/control-components/rafix-30-fsplus/rafix-30-fsplus-illuminated-pushbutton-ring-lighting/rafix-30-fsplus-illuminated-pushbutton-ring-lighting-round-collar/1302901212600)
- RAFIX 30 FS+ stands 3.45 mm proud of the panel; ring colours white, red, green, yellow, blue; IP65 [trade press] — [Electronic Specifier](https://www.electronicspecifier.com/products/e-mech/illuminated-pushbutton-series-for-harsh-environments)
- RAFIX 22 FS+: translucent bezel can be fully illuminated by SMT LED; installation depth 9.2 mm (PCB) or 27 mm (QC) [search summary] — [DirectIndustry RAFIX 22 FS+](https://www.directindustry.com/prod/rafi-gmbh-co-kg/product-5441-511345.html)

**Schneider Harmony XB4/XB5, IDEC, Lovato (fixed-colour 40 mm illuminated mushrooms)**
- Schneider ZB4BW613/633/663 and ZB5AW743 are 40 mm illuminated mushroom heads for 22 mm holes, but the ones listed are latching push-pull, single colour (integral LED) [mfr page] — [Schneider ZB4BW613](https://se.com/ww/en/product/ZB4BW613/white-%C3%B840-illum-mushroom-pushbutton-head-%C3%B822-latching-for-integral-led); [Schneider ZB4BW663](https://www.se.com/us/en/product/ZB4BW663/head-for-illuminated-push-button-harmony-xb4-metal-blue-mushroom-40mm-22mm-universal-led-latching-push-pull/)
- Square D ZB4BW453: XB4 metal orange 40 mm illuminated mushroom head, 22 mm, universal LED [distributor] — [Rexel ZB4BW453](https://www.rexelusa.com/p/337174/square-d/push-button-illuminated-mushroom-40mm-yellow-operator-only/785901506591/zb4bw453)
- Schneider 9001KR8P35RH25: 30 mm illuminated pushbutton, 41 mm mushroom head, red, 24 V [mfr page] — [Schneider 9001KR8P35RH25](https://www.se.com/us/en/product/9001KR8P35RH25/illuminated-pushbutton-%C3%A3-30-mushroom-head-%C3%A3-41-mm-red-3-positions-24-v/)
- IDEC 22 mm illuminated pushbuttons with 29 mm or 40 mm mushroom buttons, LED lenses in amber, green, red, blue, white or yellow (single colour) [distributor] — [Lesman IDEC TW/ALW](https://www.lesman.com/idec-tw-alw-22mm-illuminated-pushbuttons)
- Lovato LPSBL6643: illuminated 40 mm green mushroom actuator [distributor] — [Trimantec Lovato](https://trimantec.com/products/lovato-electric-illuminated-mushroom-head-pushbutton-actuator-40mm-green-lpsbl6643)

**Banner K50 Pro (50 mm, multicolour, touch rather than mechanical)**
- K50 Pro is a 50 mm programmable multicolour touch button (actuated by touch, works with gloves), IP67/IP69K, IO-Link or PICK-IQ; example K50PTAMGRY3Q runs on 12 to 30 VDC (24 V nominal) with a NO touch output [mfr/distributor] — [Banner K50 Pro](https://www.bannerengineering.com/us/en/products/lighting-and-indicators/touch-buttons/k50-pro-programmable-multicolor.html); [Hartfiel K50PTAMGRY3Q](https://shop.hartfiel.com/products/K50PTAMGRY3Q)

### Inferences
- No industrial RGB pushbutton found has a face anywhere near the current 56 mm cap. The largest RGB faces are 30 mm (APEM AV 30, Schurter MSM 30 / MCS 30, Onpow GQ30). The 40 to 60 mm illuminated mushrooms (EAO 45, RAFIX 22 QR, Schneider, IDEC, Lovato) are fixed single colour.
- For mechanical life, EAO Series 45 (up to 10 M cycles) is the clear leader. Most anti-vandal RGB parts are rated 1 M mechanical cycles. Electrical life is often quoted at only 35,000 to 50,000 cycles, but that rating is at full rated load. At logic level the mechanical figure is the one that applies (an inference; no source states it for these parts).
- At an estimated few hundred presses per game, 1 M cycles is thousands of games. Even the Adafruit part's 500 k is ample. The bigger durability questions are slap impact (IK rating) and contact reliability at microamps (section 2).
- The Schurter MSM LA CS has the full-surface RGB that would look best, but it is latching only, so it cannot report a 1 s hold.
- Depth behind the panel ranges from 15.7 mm (RAFIX 30 FS+, PCB) through about 36 mm (Onpow GQ22) to 56.4 mm (RAFIX 22 QR). A modular 22 mm operator with a 40 to 60 mm mushroom needs a much deeper enclosure than today's AtomS3-based puck.

### Gaps
- No datasheet numbers found for: Marquardt, CW Industries, Lumex, SparkFun's metal RGB pushbutton, IDEC LW/CW, or the EAO Series 45 multicolour/RGB variant (none appears in the Series 45 brochure).
- I could not open the Schurter MSM 30 RGB datasheet directly (Mouser blocked). Its 1.5 M life and gold-contact figures come from a search summary.
- The PV7 mechanical life was not legible in the extracted datasheet text.
- Discontinuation: no source confirmed any of these lines as discontinued. The Adafruit 3423 is shown out of stock, and the digchip APEM AV datasheet is an old revision.

## 2. Are the contacts suitable for an ESP32 GPIO with internal pull-up (3.3 V, microamps)? Gold / low-level ratings

### Takeaway
Explicit gold-contact or low-level options exist on E-Switch PV6 (gold option), RAFI switching elements (gold, max 35 V/100 mA), APEM AV (gold option in the legacy datasheet), Bulgin MPI002 (gold-plated contact plate) and reportedly Schurter MSM 30 (Au variant, max 30 VDC). Onpow GQ, Bulgin MP22 and Schurter MCS 30 use silver contacts, and Onpow states a 3 V / 5 mA minimum load. Schurter MCS 30 states a 4 VDC minimum switching voltage, which is above the ESP32's 3.3 V.

### Cited Findings
- E-Switch PV6 part-number configurator: contact material "NONE - Silver" or "G - Gold" [datasheet] — [E-Switch PV6 datasheet](https://www.hawkusa.com/sites/default/files/hawk_item/ESWCH/PV6/PV6spec.pdf)
- RAFIX 22 QR switching elements: "silver contacts (max. 400 V) or gold contacts (max. 35 V / 100 mA)"; terminals cage clamp, screw or plug-in [datasheet] — [RAFIX 22 QR datasheet (RS)](https://docs.rs-online.com/1e6a/A700000013697981.pdf)
- RAFIX 30 FS+ switching-element options: universal PCB (silver), universal QC (gold + silver), FS+ universal PCB (gold) [mfr eCatalog] — [RAFI eCatalog 30 FS+](https://ecatalog.rafi-group.com/EN/US/product-finder/innovations/control-components/rafix-30-fsplus/rafix-30-fsplus-illuminated-pushbutton-ring-lighting/rafix-30-fsplus-illuminated-pushbutton-ring-lighting-round-collar/1302901212600); RAFI gold contacts for max 35 V and 100 mA, silver up to 250 V 4 A [trade press] — [Electronic Specifier](https://www.electronicspecifier.com/products/e-mech/illuminated-pushbutton-series-for-harsh-environments)
- RAFI also lists a "RAFIX FS+ switching element ... PCB, gold, light guide" part [mfr eCatalog] — [RAFI eCatalog switching element](https://ecatalog.rafi-group.com/EN/US/product-finder/switching-elements/control-components/rafix-fsplus-switching-element/rafix-fsplus-switching-element-emergency-stop-pcb/rafix-fsplus-switching-element-emergency-stop-pcb-gold-light-guide/1201464049000)
- APEM AV legacy datasheet: contact material "B Gold" or "Q Coin Silver" [datasheet, older] — [APEM AV legacy datasheet](https://www.digchip.com/datasheets/download_datasheet.php?id=5400901&part-number=AV49402ZQE6)
- Schurter MSM 30: a variant "features gold (Au) contacts for applications with maximum 30 VDC switching voltage" [search summary] — [Schurter MSM 30 PDF on Mouser](https://www.mouser.com/pdfdocs/Schurtertyp_MSM_30.pdf)
- Schurter MCS 30: switching voltage min. 4 VDC, max. 48 VDC; max 125 mA; rated 1.2 W; "the contact material is silver" [datasheet page] — [Schurter MCS 30](https://www.schurter.com/en/datasheet/MCS_30)
- Onpow GQ22 (incl. tri-colour): contact "Silver Alloy"; "Minimum load: 3VAC/DC, 5mA (Reference)" [datasheet] — [Onpow catalogue PDF](https://onpowbutton.com/uploads/cbf00c4e889cf3e37bc6068b6ddaa3c33.pdf)
- Bulgin MPI002: "Contact Plate: Gold Plated", max switch rating 50 mA 24 VDC [datasheet] — [Bulgin vandal catalogue](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf)
- Bulgin MP22: switch rating Ui 250 V, Ith 5 A; the catalogue gives no contact material or low-level rating [datasheet] — [Bulgin vandal catalogue](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf)
- EAO Series 45 contact ratings are given for 24 to 500 V and 0.1 to 10 A (AC-12/AC-15/DC-12/DC-13). The brochure says keylock versions switch "from 5 to 500 V" [datasheet/brochure] — [EAO Series 45 brochure](https://media.graphassets.com/ynqgxnNST6lA2dsstsbX)
- Adafruit rugged RGB buttons: "Switch current: not rated, we recommend no more than 1A / 24VDC"; contact material not stated [seller] — [Adafruit 3423](https://www.adafruit.com/product/3423)

### Inferences
- An ESP32 internal pull-up passes well under 1 mA, far below Onpow's 5 mA reference minimum. On silver contacts that can lead to intermittent reads as surface films build up, which is the "never sticks / always registers" risk.
- Workarounds if a silver-contact part is chosen:
  - Fit an external pull-up sized for about 5 mA. At 3.3 V that is about 660 Ω, and it draws battery current only while the button is held.
  - Or pick the gold option (E-Switch PV6 "G", RAFI gold elements, Schurter MSM Au).
- The MCS 30's 4 VDC minimum means it is outside spec at 3.3 V. It would also need an LED supply of at least 5 V, which the 5 V boost already provides.
- The MPI002's gold contacts suit logic level, but its 12 N press, 35,000-operation electrical rating, unsealed microswitch and lack of RGB make it a poor fit.

### Gaps
- No datasheet found that states a minimum switching current for APEM AV (current production), E-Switch PV7 or Bulgin MP22.
- Whether EAO Series 45 offers gold-contact elements for low-level signals was not confirmed from the brochure.

## 3. Can any show arbitrary colours and animation? Is any addressable? How does an ESP32 drive them, and how bright/even is the light?

### Takeaway
Most RGB industrial buttons are a single three-die RGB LED behind a thin ring (common anode or common cathode), so with 3 x PWM they can show any single colour and whole-ring fades, pulses and flashes, but nothing that moves around the ring. The only off-the-shelf addressable (WS2812) pushbutton found is the hobby-grade ChromaTek 19 mm (AFK Tech, Amazon). The only industrial part described with chasing/animated light is the EAO Series 84 "animated illuminated bezel". RAFIX 30 FS+ is built to be lit by LEDs on your own PCB, which could host addressable LEDs.

### Cited Findings
- Adafruit RGB rugged buttons: common anode, one anode plus three cathodes (R, G, B), 6 V rated with built-in resistor (3 to 6 V on the anode), "pull their designated contacts to ground"; "You can PWM the RGB pins to make any color"; add 1 kΩ for 12/24 V for about 20 mA [seller] — [Adafruit 3423](https://www.adafruit.com/product/3423)
- E-Switch PV6/PV7: RGB option; PV7 RGB schematic shows separate red, green and blue anodes and a single common cathode. "Base voltage" (no resistor) LEDs are 1.8 V @ 20 mA for red, 2.8 V @ 20 mA for blue/green [datasheet] — [E-Switch PV7 datasheet](https://configured-product-images.s3.amazonaws.com/Datasheets/PV7.pdf); [E-Switch PV6 datasheet](https://www.hawkusa.com/sites/default/files/hawk_item/ESWCH/PV6/PV6spec.pdf)
- PV6 RGB marketed as combining R, G and B "to produce over 16 million hues" [trade press] — [Power Electronic Tips](https://www.powerelectronictips.com/pv6-series-anti-vandal-switch-now-offers-rgb-led-illumination/)
- Onpow GQ22 tri-colour: option 41 = common cathode, 42 = common anode; without resistor R 1.8 V, G 2.8 V, B 2.8 V; with internal resistor DC 6/12/24 V; rated current 5 to 15 mA; lamp and switch are independent circuits [datasheet] — [Onpow catalogue PDF](https://onpowbutton.com/uploads/cbf00c4e889cf3e37bc6068b6ddaa3c33.pdf)
- Bulgin MP22 RGB: common anode (AC) or common cathode (CC) choice; LED 6/12/24 V [datasheet] — [Bulgin vandal catalogue](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf)
- Schurter MCS 30 multicolour: supply 5 to 28 VDC; current per colour 16.5 mA @ 5 V, 8.2 mA @ 12 V, 5.2 mA @ 24 V; wiring is one wire per LED colour (supply) plus a black "common mass" wire, i.e. a common ground [datasheet page] — [Schurter MCS 30](https://www.schurter.com/en/datasheet/MCS_30)
- Schurter MSM: ring or complete-actuator-area illumination; three flat plugs control red, green, blue [mfr page] — [Schurter Multicolor Switches](https://www.schurter.com/en/Landing-Page/Products-and-Technologies/Multicolor-Switches); MSM LA CS gives "a uniform glow across the entire surface" [search summary] — [Schurter MSM LA CS news](https://www.schurter.com/Info-Center/News/Archive/Timeline/MSM-LA-CS-robust-metal-pushbutton-switch-with-ceramic-actuator-surface)
- Schurter PSE (piezo) multicolour runs at 5 to 28 VDC [mfr page] — [Schurter Multicolor Switches](https://www.schurter.com/en/Landing-Page/Products-and-Technologies/Multicolor-Switches)
- ChromaTek (AFK Tech): 19 mm stainless steel; "only pushbutton switch with an addressable RGB LED - WS2812"; 5 VDC; momentary or latching; normally open; IP65; "5 A" rating; 15 cm wire connector included; flat, high-round and power-symbol actuators, black or silver shells [seller; search summary of Amazon listings] — [Amazon.ca ChromaTek momentary](https://www.amazon.ca/ChromaTek-Full-Color-MomentaryPush-Arduino-Raspberry/dp/B0988V21SM); [Amazon.com ChromaTek momentary](https://www.amazon.com/ChromaTek-Full-Color-Momentary-Arduino-Raspberry/dp/B0989319KN)
- EAO Series 84: "an animated illuminated bezel version, allowing for chasing LED sequences, multi-color illumination, and partial bezel illumination" [search summary of Mouser page] — [Mouser EAO Series 84](https://www.mouser.com/new/eao/eao-series-84-modular-switches)
- RAFIX 30 FS+: "using short-travel adapter in the pushbutton together with short-travel pushbutton 'MICON 5' as contact element, several light functions can be displayed and indicated by LEDs via the minimal installation space on the PCB" [mfr eCatalog] — [RAFI eCatalog 30 FS+](https://ecatalog.rafi-group.com/EN/US/product-finder/innovations/control-components/rafix-30-fsplus/rafix-30-fsplus-illuminated-pushbutton-ring-lighting/rafix-30-fsplus-illuminated-pushbutton-ring-lighting-round-collar/1302901212600)
- Bulgin MPI002 luminous intensity per LED colour 900 to 2,500 mcd at 20 mA (single colours); the dual-colour green/white version is 178/450 mcd [datasheet] — [Bulgin vandal catalogue](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf)
- Banner K50 Pro: 50 mm multicolour with animations and flash patterns configurable in Banner's Pro Editor software; K50PTAMGRY3Q is 3-colour G/R/Y with two digital inputs for colour selection; 12 to 30 VDC [mfr/distributor] — [Banner K50 Pro](https://www.bannerengineering.com/us/en/products/lighting-and-indicators/touch-buttons/k50-pro-programmable-multicolor.html); [Hartfiel K50PTAMGRY3Q](https://shop.hartfiel.com/products/K50PTAMGRY3Q)

### Inferences
- **What 3 x PWM can and cannot render.** A 3-channel RGB ring can render the existing `deriveOutputs` modes `off | dim | solid | pulse | flash` in any player colour, and a time-cycled `rainbow` (whole ring changing hue). It cannot render spatial effects (spinning, chasing, burst-from-centre) that the 37-LED board does today. Several of the twenty `TURN_EFFECTS` would degrade to a colour fade.
- **ESP32 drive of a common-anode part on the 5 V rail.** Do not drive the cathodes straight from 3.3 V GPIOs. A GPIO "high" (3.3 V) leaves about 1.7 V across the LED, which may let the red die (Vf about 1.8 V) glow faintly. Use N-MOSFETs/NPNs or open-drain outputs.
- **Common-cathode parts** (PV7 RGB, Onpow 41, Bulgin CC, Schurter MCS common ground) need high-side switching from 5 V, or a 3.3 V supply if the part comes without resistors (red 1.8 V, blue/green 2.8 V at 20 mA, so 3.3 V leaves very little headroom for blue/green).
- **Simplest wiring.** The "base voltage"/no-resistor options with your own resistors and three low-side MOSFETs from the 5 V boost is the simplest robust approach. Each channel is about 5 to 20 mA, so the LED load is tiny compared with today's 37 WS2812s.
- **Brightness and coverage.** Industrial ring illumination is a thin halo around a metal face. It will be far less light, and far less area, than a 56 mm translucent cap over 37 LEDs; across a table it will read as a coloured ring, not a glowing dome. Schurter MSM full-area illumination and RAFIX 22 FS+ full-bezel illumination are the exceptions, but at 19 to 30 mm.
- **Addressable LEDs.** ChromaTek is the only bought part with an addressable LED, and it is one WS2812 (single colour at a time, but it uses the same data line and library as the current design). Getting animation in an industrial-grade part means a part lit from your own PCB, e.g. RAFIX 30 FS+ with a MICON 5 element and SK6812/WS2812s placed under the light ring. That is a design inference from RAFI's description, not a tested configuration.
- **Off the list.** Banner K50 Pro is touch, not mechanical (no slap travel), and needs 12 to 30 V, so it does not fit a 3.7 V LiPo + 5 V boost without another converter. Piezo (Schurter PSE) and capacitive (CPS) parts also give no mechanical travel.

### Gaps
- No datasheet found for how many LEDs sit in any ring, or for ring luminance/evenness (only Bulgin MPI002 per-colour mcd figures).
- The ChromaTek LED count, contact material, mechanical life and manufacturer datasheet were not found. All its specs are seller claims.
- EAO Series 84 animated bezel: the drive interface (addressable vs. segment lines), voltage and availability were not confirmed from an EAO datasheet.
- APEM AV RGB LED voltage, current and common-pin polarity were not on the pages I could open.
- Whether Schurter PSE piezo output holds for the full press (needed for a 1 s hold) was not checked. Piezo switches often give only a pulse.

## 4. Tactile feel: crisp snap or soft? Maker reviews

### Takeaway
Datasheets give short travel (0.4 to 3 mm) and light to moderate force (1.5 to 5 N; 12 N for Bulgin MPI002). Only EAO and RAFI make explicit tactile-feedback claims. I found no independent maker reviews of how any of these RGB buttons feel when slapped repeatedly.

### Cited Findings
- Travel and force by part [datasheet unless noted]:

| Part | Travel | Force | Source |
|---|---|---|---|
| Schurter MCS 30 | 0.4 mm | 3.7 N | [Schurter MCS 30](https://www.schurter.com/en/datasheet/MCS_30) |
| E-Switch PV6 | 1.5 mm | 400 gf | [PV6](https://www.hawkusa.com/sites/default/files/hawk_item/ESWCH/PV6/PV6spec.pdf) |
| E-Switch PV7 | 2.2 mm | 4 N | [PV7](https://configured-product-images.s3.amazonaws.com/Datasheets/PV7.pdf) |
| APEM AV 19/22 | 2 mm | 5 ± 2 N | [APEM](https://www.apem.com/panel-switches/pushbutton-switches/av-19-22-nc-no-illuminated) |
| APEM AV 30 | 2.5 mm | not given | [APEM](https://www.apem.com/panel-switches/pushbutton-switches/av-30-nc-no-illuminated) |
| Onpow GQ22 RGB | about 2.5 mm | about 4 N | [Onpow](https://onpowbutton.com/uploads/cbf00c4e889cf3e37bc6068b6ddaa3c33.pdf) |
| Bulgin MP22 | about 3 mm | about 3 to 4 N | [Bulgin](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf) |
| Bulgin MPI002 | not given | 12 N | [Bulgin](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf) |
| Adafruit 3423 | 2 mm | 1.5 to 2.5 N (seller) | [Adafruit](https://www.adafruit.com/product/3423) |
| RAFIX 22 QR / 30 FS+ | max 4 mm | not given (100 N max is the withstand rating) | [RS datasheet](https://docs.rs-online.com/1e6a/A700000013697981.pdf) |

- EAO Series 45 mushroom pushbuttons "provide good tactile feedback" and are easy to operate "even with gloves" [brochure] — [EAO Series 45 brochure](https://media.graphassets.com/ynqgxnNST6lA2dsstsbX)
- RAFIX 30 FS+ "delivers clear and distinct tactile feedback, even through gloves" [trade press] — [Electronic Specifier](https://www.electronicspecifier.com/products/e-mech/illuminated-pushbutton-series-for-harsh-environments); RAFIX 22 FS+ advertises "special tactile feedback" [search summary] — [DirectIndustry](https://www.directindustry.com/prod/rafi-gmbh-co-kg/product-5441-511345.html)
- Impact ratings: Onpow GQ IK10; Bulgin MP22 IK09; APEM AV up to IK10 (AV 30 IK06); Schurter MSM IK07; Schurter MCS 30 IK05 [datasheets/mfr pages] — [Onpow](https://onpowbutton.com/uploads/cbf00c4e889cf3e37bc6068b6ddaa3c33.pdf); [Bulgin](https://www.bulgin.com/products/pub/media/bulgin/data/Vandal_switches.pdf); [APEM](https://www.apem.com/en-us/news/av-series-aesthetic-push-button-with-robust-performance); [Schurter](https://www.schurter.com/en/Landing-Page/Products-and-Technologies/Multicolor-Switches)
- An escape-room supplier sells an "RGB Button sensor" whose "sturdy metal button with its LED ring withstands even the most enthusiastic players" [seller claim] — [Escape Room Supplier](https://www.escaperoomsupplier.com/product/rgb-button-sensor/)
- APEM positions the AV series as suitable for arcade machines (16 mm, IK06, IP65) [search summary] — [APEM AV news](https://www.apem.com/en-us/news/av-series-aesthetic-push-button-with-robust-performance)

### Inferences
- Anti-vandal buttons are a flat or slightly domed metal disc, 16 to 30 mm across, moving 1.5 to 3 mm. That is a small, hard target to slap with an open palm. Expect a firm "tick" rather than the big, forgiving plunge of a 56 mm cap or a 60 to 100 mm arcade dome.
- An EAO Series 45 40 mm or 60 mm mushroom is the closest industrial match to a slap target, but it lights in one fixed colour.
- IK ratings matter more than cycle counts for slaps. IK10 (Onpow GQ, some APEM AV) is the most impact-proof found; Schurter MCS 30 (IK05) is the least.

### Gaps
- No Reddit, forum or build-log reviews were found describing the feel, click or long-term reliability of APEM AV, E-Switch PV, Onpow GQ, Bulgin MP22, Schurter MSM/MCS or ChromaTek buttons under slapping. The searches returned only vendor pages.

## 5. Price in CAD (DigiKey.ca / Mouser.ca / Amazon.ca) and stock, 2026

### Takeaway
I could not get CAD prices: DigiKey.ca returned a Cloudflare challenge and Mouser returned 503. USD distributor prices found: RGB anti-vandal parts run about US$17 to $30 each, the Adafruit 22 mm about US$16.50, and Schurter's MCS 30 multicolour about US$60 to $100+. Stock is thin: many listings show zero stock, MOQs of 20, and 10-week lead times.

### Cited Findings
- Adafruit 3423 (22 mm RGB): US$16.50 (1 to 9), $14.85 (10 to 99), $13.20 (100+); **out of stock** at Adafruit when checked [seller] — [Adafruit 3423](https://www.adafruit.com/product/3423). Also listed at RS and Jameco [seller] — [RS 3423](https://us.rs-online.com/product/adafruit-industries/3423/72491691/); [Jameco 3423](https://www.jameco.com/z/3423-Adafruit-Industries-Rugged-Metal-Pushbutton-22mm-6V-RGB-Momentary_2513503.html)
- E-Switch PV7F2Y0SS-3R1 (22 mm, flat, stainless, RGB, DPST NO/NC): Newark US$28.64 at qty 20, MOQ 20, 0 in stock; other listings show MOQ 20 and a 10-week lead time [distributor] — [Findchips PV7F2Y0SS-3R](https://www.findchips.com/search/PV7H2Y0SS-3R)
- Schurter 1241.6454 (MCS 30 multicolour): TME 25 in stock at US$60.61 to $97.24; Neutron USA 47 in stock at US$218.41; Avnet US$61.04 to $73.99, Sager $68.64 to $78.04, RS $95.53 to $103.84, Newark $110.08 to $114.67, all 0 stock [distributor] — [Findchips 1241.6454](https://www.findchips.com/search/1241.6454)
- Bulgin MP22SMQRCCQ006S5 (MP22 SPDT momentary RGB ring, common cathode, 6 V, stainless, IP65): Newark US$30.26, Onlinecomponents US$17.80 to $26.09, both 0 stock [distributor] — [Findchips MP22SMQRCCQ006S5](https://www.findchips.com/search/MP22SMQRCCQ006S5)
- Bulgin MPI002/28/BL is a DigiKey catalogue part [distributor] — [DigiKey MPI002/28/BL](https://www.digikey.com/en/products/detail/bulgin/MPI002-28-BL/1626086)
- Schurter MSM 30 base product MSM30-NX is on DigiKey [distributor] — [DigiKey MSM30-NX](https://www.digikey.com/en/products/base-product/schurter-inc/486/MSM30-NX/353796); RAFIX 30 FS+ has a DigiKey.ca product-highlight page [distributor] — [DigiKey.ca RAFIX 30 FS+](https://www.digikey.ca/en/product-highlight/r/rafi/rafix-30-fs-series-control-components)
- ChromaTek WS2812 19 mm buttons are listed on Amazon.ca (e.g. ASIN B0988V21SM, silver flat momentary), but the page did not render a price [seller] — [Amazon.ca ChromaTek](https://www.amazon.ca/ChromaTek-Full-Color-MomentaryPush-Arduino-Raspberry/dp/B0988V21SM)
- Onpow GQ22 RGB is on Amazon.com as GQ22-11E/J/RGB/A; price not retrieved [seller] — [Amazon.com Onpow](https://www.amazon.com/ONPOW-Tri-Color-Momentary-Illuminated-Aluminium/dp/B07Z48WH7T)
- RAFIX 22 QR illuminated pushbutton (1.30.240.001/1508): MOQ 50 pcs, packaging unit 10 [datasheet] — [RAFIX 22 QR datasheet (RS)](https://docs.rs-online.com/1e6a/A700000013697981.pdf)
- Schurter MCS 30 packaging unit 20 [datasheet page] — [Schurter MCS 30](https://www.schurter.com/en/datasheet/MCS_30)

### Inferences
- At typical 2025 to 2026 exchange rates (roughly 1.35 to 1.40 CAD per USD; not sourced here), six RGB anti-vandal buttons would be about CAD 150 to 250 before shipping. Six Schurter MCS 30 multicolour units would be about CAD 500 to 800.
- MOQs of 20 to 50 (E-Switch PV7, RAFI 22 QR) mean buying a full pack. A 20-pack of PV7 RGB is about US$570, roughly CAD 800.
- DigiKey.ca / Mouser.ca prices must be checked by hand in a browser.

### Gaps
- No CAD prices or live DigiKey.ca / Mouser.ca stock could be retrieved (bot protection).
- No prices found for APEM AV RGB, Onpow GQ RGB (Amazon.ca), EAO Series 45 40/60 mm illuminated mushrooms, RAFIX 30 FS+, or Schurter MSM 30 RGB.
