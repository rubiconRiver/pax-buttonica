/*
 * Everything you'd change to suit your own build lives here.
 * Defaults are for an ESP32-C3 "Super Mini". On that chip avoid GPIO 2, 8 and 9
 * (boot strapping pins; 8 is also the onboard LED, 9 the BOOT button).
 */
#pragma once

// ── Buttons ─────────────────────────────────────────────────────────────────
// Each switch connects its pin to GND (internal pull-ups are used).
// Button 0 is the big one. 1 = strategy shortcut, 2 = pass shortcut.
#define BUTTON_COUNT 1
static const int BUTTON_PINS[3] = {3, 4, 5};

// ── Light ───────────────────────────────────────────────────────────────────
#define LED_PIN 10
#define LED_COUNT 8           // WS2812 pixels under the dome (8-LED ring; set 12 for a 12-LED ring)
#define MAX_BRIGHTNESS 0.55f  // of full scale; the battery and your eyes will thank you
#define DIM_LEVEL 0.14f       // what "dim" means on this hardware

// ── Sound: pick ONE ─────────────────────────────────────────────────────────
// The standard button has no speaker: every sound plays from the laptop, which
// is cheaper, simpler to build, and sounds better. The other two are there if
// you want your own button to chirp.
#define AUDIO_NONE       // silent (standard)
// #define AUDIO_I2S     // MAX98357A amp + small speaker
// #define AUDIO_PIEZO   // passive piezo straight on a pin

#define I2S_BCLK_PIN 6
#define I2S_LRC_PIN 7
#define I2S_DIN_PIN 1
#define PIEZO_PIN 1
#define VOLUME 0.35f

// ── Battery sense (optional) ────────────────────────────────────────────────
// A 1:1 resistor divider from the battery pack to this ADC pin. -1 = not fitted.
#define BATTERY_PIN -1
#define BATTERY_DIVIDER 2.0f

// ── Radio ───────────────────────────────────────────────────────────────────
#define ESPNOW_CHANNEL 1
