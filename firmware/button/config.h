/*
 * Everything you'd change to suit your own build lives here.
 *
 * Pick ONE board. The default is the no-solder build: M5Stack AtomS3 Lite with a Mechanical Key
 * Unit and a NeoHEX light board plugged into it. The ESP32-C3 SuperMini on the custom carrier
 * board is the soldered alternative.
 */
#pragma once

#define BOARD_ATOMS3_LITE     // M5Stack AtomS3 Lite + Unit Key + NeoHEX (plug-together)
// #define BOARD_SUPERMINI    // ESP32-C3 SuperMini on the carrier board in hardware/pcb

#if defined(BOARD_ATOMS3_LITE)
// ── AtomS3 Lite ─────────────────────────────────────────────────────────────
// Grove cable colours: black GND, red 5V, YELLOW = first signal, WHITE = second signal.
// On the Atom's own socket yellow is G2 and white is G1. On the PortABC base (AtomS3 sticker):
//   Port A: G 5V 38 39      Port B: G 5V 7 8      Port C: G 5V 5 6      (yellow first, then white)
//
// The Key Unit puts its switch on WHITE and its own LED on YELLOW. The NeoHEX takes data on YELLOW.
//
// Wiring that this file assumes:   NeoHEX  → Port A of the PortABC base   (G38 / G39 on an AtomS3, NOT G1 / G2)
//                                  Key Unit → Port B
// The switch is read on G8 (Port B, white) and G1 (the Atom's own socket), so either wiring works;
// an unconnected pin, pulled up, reads "not pressed".
#define BUTTON_COUNT 1
static const int BUTTON_PINS[3] = {-1, -1, -1};            // unused on this board; see BIG_BUTTON_PINS
static const int BIG_BUTTON_PINS[] = {1, 8};               // any of these low = button 0 pressed
#define LED_PIN 38            // NeoHEX data: yellow wire of the base's Port A. On the Atom's OWN socket it is 2.
#define LED_COUNT 37          // NeoHEX has 37; the Key Unit's own LED alone would be 1
#define STATUS_LED_PIN 35     // the Atom's tiny onboard pixel; mirrors the colour so a bare Atom shows something
#define MAX_BRIGHTNESS 0.55f
#define DIM_LEVEL 0.14f

#else
// ── ESP32-C3 SuperMini on the carrier board ─────────────────────────────────
// Avoid GPIO 2, 8 and 9 (boot strapping pins; 8 is also the onboard LED, 9 the BOOT button).
// Each switch connects its pin to GND (internal pull-ups are used). Button 0 is the big one.
// On the carrier board the big switch goes to the FIFTH pin on the module's 5V side: read the
// number printed beside that pin, usually 3, on some boards 1. Put it first here.
#define BUTTON_COUNT 1
static const int BUTTON_PINS[3] = {3, 5, 6};
static const int BIG_BUTTON_PINS[] = {3};
#define LED_PIN 10
#define LED_COUNT 8           // 8-LED ring; 12 for the 50 mm ring
#define STATUS_LED_PIN -1
#define MAX_BRIGHTNESS 0.55f
#define DIM_LEVEL 0.14f
#endif

// ── Sound: pick ONE ─────────────────────────────────────────────────────────
// The standard button has no speaker: every sound plays from the laptop.
#define AUDIO_NONE
// #define AUDIO_I2S     // MAX98357A amp + small speaker
// #define AUDIO_PIEZO   // passive piezo straight on a pin
#define I2S_BCLK_PIN 6
#define I2S_LRC_PIN 7
#define I2S_DIN_PIN 1
#define PIEZO_PIN 1
#define VOLUME 0.35f

// ── Battery sense (optional) ────────────────────────────────────────────────
// A 1:1 resistor divider from the battery pack to an ADC pin. -1 = not fitted (the AtomS3 build
// has none: the AA pack comes in through the USB-C plug).
#define BATTERY_PIN -1
#define BATTERY_DIVIDER 2.0f

// ── Falling asleep ──────────────────────────────────────────────────────────
// If the hub hasn't been heard from for this long, go dark and sleep. Pressing the big button
// wakes it. 0 = never. The wake pins must be RTC-capable: GPIO 0-5 on the C3, 0-21 on the S3.
#define SLEEP_AFTER_MINUTES 10

// ── Radio ───────────────────────────────────────────────────────────────────
#define ESPNOW_CHANNEL 1
