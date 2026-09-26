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
static const int BIG_BUTTON_PINS[] = {1, 8, 41};           // any of these low = button 0 pressed: the key on G1 (Atom socket) or G8 (PortABC), or the Atom's own face button on G41
// Where the hex is plugged in. The printed shell uses a Unit Hub splitter on the Atom's own socket;
// the bench rig uses the PortABC base. Pick one.
#define HEX_ON_PORT_A         // PortABC base, Port A: data on G38   (the bench rig, until the splitters arrive)
// #define HEX_ON_ATOM_SOCKET // the Atom's own socket, or a splitter on it: data on G2   (the finished shell)
#if defined(HEX_ON_ATOM_SOCKET)
#define LED_PIN 2
#else
#define LED_PIN 38
#endif
#define LED_COUNT 37          // NeoHEX has 37; the Key Unit's own LED alone would be 1
#define HEX_SERPENTINE 0      // 1 if the NeoHEX's rows run alternately left-right / right-left (test with the "rings" mode)
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
#define HEX_SERPENTINE 0
#define STATUS_LED_PIN -1
#define MAX_BRIGHTNESS 0.55f
#define DIM_LEVEL 0.14f
#endif

// ── Feel ────────────────────────────────────────────────────────────────────
// A short brightening the instant the big button goes down, before the host has answered. 0 = off.
#define PRESS_BLIP_MS 70

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

// ── Power ───────────────────────────────────────────────────────────────────
// The radio sleeps and only listens for RADIO_WINDOW_MS out of every RADIO_INTERVAL_MS; the hub keeps
// resending until a message lands in a window (about 100 mA down to about 10). After the button has
// said something it holds the radio open for RADIO_HOLD_MS so the answer comes straight back.
// RADIO_SAVE 0 keeps the radio always on (the old behaviour); cfg {"ps":0|1} switches at runtime.
#define RADIO_SAVE 1
#define RADIO_INTERVAL_MS 200
#define RADIO_WINDOW_MS 30
#define RADIO_HOLD_MS 500
// The CPU has nothing hard to do; 80 MHz halves its share. The LEDs' timing comes from a hardware
// peripheral and doesn't care.
#define CPU_MHZ 80
// "solid" lights the outer ring fully and the inside at this share: across a room you see the bright
// rim, through the diffuser it still reads as full, and it draws about half the current. 1.0 = flat.
#define SOLID_CORE 0.4f
