/*
 * Pax Buttonica button — draft standard v0 (see docs/BUTTON_STANDARD.md).
 *
 * A dumb, glowing thing. It shows the colour and mode it's told to show and
 * reports tap / double / hold. (It can also play note lists, if you fit a speaker.) It knows nothing
 * about Twilight Imperium.
 *
 * Boards (pick one in config.h). Libraries: Adafruit NeoPixel, ArduinoJson (v7).
 *   M5Stack AtomS3 Lite:  arduino-cli compile -b esp32:esp32:m5stack_atoms3 firmware/button
 *   ESP32-C3 SuperMini:   arduino-cli compile -b esp32:esp32:esp32c3:CDCOnBoot=cdc firmware/button
 * Pins and options: config.h
 *
 * UNTESTED ON HARDWARE. It compiles; nobody has flashed it yet.
 *
 * Power (2026-09-26): the radio sleeps between short listening windows (the core is built with
 * power saving allowed while not connected to an access point); the hub resends until a message
 * lands in a window. CPU at 80 MHz. "solid" is a bright rim with a softer centre. See config.h.
 *
 * Over the air (2026-09-28): a new image can arrive through the hub in numbered chunks ("ota"
 * messages) and is written to the spare app slot; the button checks its MD5 and reboots into it.
 * So a button only ever needs the USB cable once. Needs the default partition table (two app slots).
 */
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Preferences.h>
#include <esp_sleep.h>
#include <driver/rtc_io.h>
#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>
#include <Update.h>
#include <mbedtls/base64.h>
#include "config.h"

#if defined(AUDIO_I2S)
#include <ESP_I2S.h>
static I2SClass i2s;
#define SAMPLE_RATE 16000
#endif

#define FW_VERSION "0.3.0"
#define MAX_LINE 250
#define TAP_MAX_MS 350
#define DOUBLE_MS 400
#define DEBOUNCE_MS 25
#define HELLO_SEARCH_MS 3000   // looking for a hub
#define HELLO_BEAT_MS 10000    // heartbeat, so a reloaded web app finds us again
#define MAX_NOTES 32

// ── State ───────────────────────────────────────────────────────────────────

enum Mode { MODE_OFF, MODE_DIM, MODE_SOLID, MODE_PULSE, MODE_FLASH, MODE_RAINBOW,
            MODE_RIPPLE_OUT, MODE_RIPPLE_IN, MODE_RINGS, MODE_SPIN, MODE_SPARKLE, MODE_WAVE, MODE_HEARTBEAT };
enum Overlay { FX_NONE, FX_ACK, FX_DENIED, FX_CONFIRM, FX_IDENTIFY, FX_RIPPLE, FX_BURST, FX_SPARKLE };
enum Wave { WAVE_SQUARE, WAVE_TRIANGLE, WAVE_SAW, WAVE_SINE };

static Adafruit_NeoPixel ring(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);
#if STATUS_LED_PIN >= 0
static Adafruit_NeoPixel statusLed(1, STATUS_LED_PIN, NEO_GRB + NEO_KHZ800);
#endif
static Preferences prefs;
static const int BIG_BUTTON_PIN_COUNT = sizeof(BIG_BUTTON_PINS) / sizeof(BIG_BUTTON_PINS[0]);

static char devId[13];
static uint8_t hubMac[6];
static bool hubKnown = false;
static volatile uint8_t sendFails = 0;
static volatile uint32_t lastContact = 0;  // last time the hub demonstrably existed
static const uint8_t EVERYONE[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

static uint8_t ledR = 255, ledG = 255, ledB = 255;
static Mode mode = MODE_OFF;
static uint32_t modeSince = 0;
static uint32_t holdMs = 2000;
static uint32_t flashMs = 2000;
static float brightScale = 1.0f;   // cfg "bright", 0..1: the host's share of MAX_BRIGHTNESS
static Mode pulseLook = MODE_PULSE; // cfg "pulse": how "your move" is drawn (pulse, solid or heartbeat)
static uint32_t periodMs = 0;      // the animated modes' cycle; 0 = each mode's own default
static bool radioSave = RADIO_SAVE; // radio sleeps between listening windows
static bool radioHeld = false;      // radio forced awake while we wait for an answer
static uint32_t radioHoldUntil = 0;
static uint32_t pressedAt = 0;     // for the press blip

static Overlay overlay = FX_NONE;
static uint32_t overlaySince = 0;

// an image arriving over the air (see handleOta)
#define OTA_IDLE_MS 15000
static bool otaActive = false;
static uint32_t otaNext = 0, otaSize = 0, otaGot = 0, otaLast = 0;

struct Button {
  bool down;
  bool raw;
  uint32_t rawSince;
  uint32_t downSince;
  uint32_t lastTap;
  bool holdSent;
};
static Button buttons[3];

struct Packet {
  uint8_t mac[6];
  uint8_t len;
  char text[MAX_LINE + 1];
};
static QueueHandle_t inbox;

// ── Radio ───────────────────────────────────────────────────────────────────

static void addPeer(const uint8_t *mac) {
  if (esp_now_is_peer_exist(mac)) return;
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, mac, 6);
  peer.channel = ESPNOW_CHANNEL;
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}

// Keep the radio awake for a moment: whatever the hub answers with should arrive at once, not at the next window.
static void holdRadio(uint32_t ms) {
  radioHoldUntil = millis() + ms;
  if (!radioHeld && radioSave) {
    radioHeld = true;
    esp_wifi_force_wakeup_acquire();
  }
}

static void releaseRadio() {
  if (!radioHeld) return;
  radioHeld = false;
  esp_wifi_force_wakeup_release();
}

// Sleepy radio on or off. The hub copes either way; off is for measuring the difference.
static void applyRadioSave() {
  releaseRadio();
  if (radioSave) {
    esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
    esp_wifi_connectionless_module_set_wake_interval(RADIO_INTERVAL_MS);
    esp_now_set_wake_window(RADIO_WINDOW_MS);
  } else {
    esp_now_set_wake_window(65535);
    esp_wifi_set_ps(WIFI_PS_NONE);
  }
}

static void sendLine(const char *line) {
  esp_now_send(hubKnown ? hubMac : EVERYONE, (const uint8_t *)line, strlen(line));
  holdRadio(RADIO_HOLD_MS);
}

static void sendHello() {
  char line[MAX_LINE];
  snprintf(line, sizeof(line),
           "{\"t\":\"hello\",\"dev\":\"%s\",\"fw\":\"%s\",\"caps\":{\"btn\":%d,\"led\":\"ring\",\"audio\":\"%s\"}}",
           devId, FW_VERSION, BUTTON_COUNT,
#if defined(AUDIO_NONE)
           "none"
#else
           "tones"
#endif
  );
  sendLine(line);
}

static void sendButton(int index, const char *gesture) {
  char line[96];
  snprintf(line, sizeof(line), "{\"t\":\"btn\",\"dev\":\"%s\",\"b\":%d,\"e\":\"%s\"}", devId, index, gesture);
  sendLine(line);
}

static void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len <= 0 || len > MAX_LINE) return;
  Packet p;
  memcpy(p.mac, info->src_addr, 6);
  p.len = (uint8_t)len;
  memcpy(p.text, data, len);
  p.text[len] = 0;
  xQueueSend(inbox, &p, 0);
}

static void onSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  (void)info;
  if (status == ESP_NOW_SEND_SUCCESS) {
    sendFails = 0;
    // A unicast is only "delivered" if the hub's radio acknowledged it; a broadcast proves nothing.
    if (hubKnown) lastContact = millis();
  } else if (sendFails < 255) {
    sendFails++;
  }
}

// ── Sound ───────────────────────────────────────────────────────────────────

static uint16_t notes[MAX_NOTES][2];
static int noteCount = 0;
static int noteIndex = -1;  // -1 = silent
static Wave wave = WAVE_SQUARE;

static float midiToHz(int midi) { return 440.0f * powf(2.0f, (midi - 69) / 12.0f); }

#if defined(AUDIO_I2S)
static float phase = 0;
static uint32_t noteSamples = 0, notePos = 0;

static void startNote() {
  noteSamples = (uint32_t)notes[noteIndex][1] * SAMPLE_RATE / 1000;
  notePos = 0;
}

static void audioService() {
  if (noteIndex < 0) return;
  static int16_t buf[256];
  const int midi = notes[noteIndex][0];
  const float step = midi > 0 ? midiToHz(midi) / SAMPLE_RATE : 0;
  for (int i = 0; i < 256; i++) {
    float s = 0;
    if (midi > 0 && notePos < noteSamples) {
      switch (wave) {
        case WAVE_SQUARE: s = phase < 0.5f ? 0.6f : -0.6f; break;
        case WAVE_SAW: s = (2.0f * phase - 1.0f) * 0.7f; break;
        case WAVE_TRIANGLE: s = 4.0f * fabsf(phase - 0.5f) - 1.0f; break;
        case WAVE_SINE: s = sinf(phase * 2.0f * PI); break;
      }
      // Short attack and a fade over the last sixth so notes don't click.
      const float attack = notePos < 64 ? notePos / 64.0f : 1.0f;
      const uint32_t tail = noteSamples / 6 + 1;
      const float release = notePos + tail > noteSamples ? (float)(noteSamples - notePos) / tail : 1.0f;
      s *= attack * release;
      phase += step;
      if (phase >= 1.0f) phase -= 1.0f;
    }
    buf[i] = (int16_t)(s * VOLUME * 32767);
    notePos++;
  }
  i2s.write((uint8_t *)buf, sizeof(buf));
  if (notePos >= noteSamples) {
    noteIndex++;
    if (noteIndex >= noteCount) {
      noteIndex = -1;
      memset(buf, 0, sizeof(buf));
      i2s.write((uint8_t *)buf, sizeof(buf));  // leave the amp on silence, not on a held sample
    } else {
      startNote();
    }
  }
}
#elif defined(AUDIO_PIEZO)
static uint32_t noteEnds = 0;

static void startNote() {
  const int midi = notes[noteIndex][0];
  if (midi > 0) tone(PIEZO_PIN, (unsigned int)midiToHz(midi));
  else noTone(PIEZO_PIN);
  noteEnds = millis() + notes[noteIndex][1];
}

static void audioService() {
  if (noteIndex < 0 || millis() < noteEnds) return;
  noteIndex++;
  if (noteIndex >= noteCount) {
    noteIndex = -1;
    noTone(PIEZO_PIN);
  } else {
    startNote();
  }
}
#else
static void startNote() {}
static void audioService() { noteIndex = -1; }
#endif

static void playNotes(const uint16_t list[][2], int count, Wave w) {
  noteCount = min(count, MAX_NOTES);
  if (noteCount == 0) return;
  for (int i = 0; i < noteCount; i++) {
    notes[i][0] = list[i][0];
    notes[i][1] = list[i][1];
  }
  wave = w;
  noteIndex = 0;
  startNote();
}

static const uint16_t SND_ACK[][2] = {{88, 60}, {95, 120}};
static const uint16_t SND_DENIED[][2] = {{45, 110}, {0, 30}, {40, 200}};
static const uint16_t SND_CONFIRM[][2] = {{60, 70}, {72, 70}, {79, 160}};

// ── Light ───────────────────────────────────────────────────────────────────

// Where each pixel sits: a ring number (0 = centre) and an angle (0..1) round the board.
// The NeoHEX is 37 pixels in rows of 4,5,6,7,6,5,4; any other board is treated as one ring.
#define RINGS 4
static uint8_t ringOf[LED_COUNT];
static float angOf[LED_COUNT];

static void mapPixels() {
#if LED_COUNT == 37
  static const uint8_t rows[7] = {4, 5, 6, 7, 6, 5, 4};
  int i = 0;
  for (int r = 0; r < 7; r++) {
    for (int k = 0; k < rows[r]; k++) {
      const int c = HEX_SERPENTINE && (r % 2) ? rows[r] - 1 - k : k;
      const float x = c - (rows[r] - 1) / 2.0f;
      const float y = (r - 3) * 0.8660254f;
      const float d = sqrtf(x * x + y * y);
      ringOf[i] = (uint8_t)min((int)(d + 0.5f), RINGS - 1);
      angOf[i] = (atan2f(y, x) / (2.0f * PI)) + 0.5f;
      i++;
    }
  }
#else
  for (int i = 0; i < LED_COUNT; i++) {
    ringOf[i] = RINGS - 1;
    angOf[i] = (float)i / LED_COUNT;
  }
#endif
}

static void setOverlay(Overlay fx) {
  overlay = fx;
  overlaySince = millis();
}

static uint32_t period(uint32_t fallback) { return periodMs ? periodMs : fallback; }
static float frac(float v) { return v - floorf(v); }
static float smooth(float p) { return 0.5f - 0.5f * cosf(p * 2.0f * PI); }   // 0..1..0 over p = 0..1

// How bright the whole button is right now, 0..1, for the uniform modes. Mirrors the simulator's CSS.
static float luminance(uint32_t now) {
  const uint32_t t = now - modeSince;
  // "pulse" means "your move"; the host says how each button should draw it
  const Mode drawn = mode == MODE_PULSE ? pulseLook : mode;
  switch (drawn) {
    case MODE_OFF: return 0;
    case MODE_DIM: return DIM_LEVEL;
    case MODE_SOLID: return 1;   // per pixel: see pixelLuminance
    case MODE_RAINBOW: return 1;
    case MODE_PULSE: {
      const uint32_t T = period(1700);
      return 0.34f + 0.66f * smooth((t % T) / (float)T);
    }
    case MODE_FLASH: {
      // on 0-38%, fade to 50%, dark to 88%, fade back up
      const float p = (t % flashMs) / (float)flashMs;
      if (p < 0.38f) return 1;
      if (p < 0.50f) return 1.0f - (p - 0.38f) / 0.12f * 0.95f;
      if (p < 0.88f) return 0.05f;
      return 0.05f + (p - 0.88f) / 0.12f * 0.95f;
    }
    case MODE_HEARTBEAT: {
      const uint32_t T = period(1300);
      const float ms = t % T;
      float b = 0;
      if (ms < 140) b = smooth(ms / 140.0f);
      else if (ms >= 220 && ms < 400) b = 0.7f * smooth((ms - 220) / 180.0f);
      return DIM_LEVEL + (1 - DIM_LEVEL) * b;
    }
    default: return 1;
  }
}

// Brightness of one pixel for the modes that move across the board.
static float pixelLuminance(int i, uint32_t now) {
  const uint32_t t = now - modeSince;
  const int r = ringOf[i];
  // "solid", whether asked for or as the look of "your move": a full rim and a softer centre.
  if (mode == MODE_SOLID || (mode == MODE_PULSE && pulseLook == MODE_SOLID)) return r == RINGS - 1 ? 1.0f : SOLID_CORE;
  switch (mode) {
    case MODE_RIPPLE_OUT:
    case MODE_RIPPLE_IN: {
      // a bright front travels through the rings and leaves a fading tail behind it
      const uint32_t T = period(1400);
      const float head = (t % T) / (float)T * RINGS;
      const int ring = mode == MODE_RIPPLE_OUT ? r : RINGS - 1 - r;
      const float behind = frac((head - ring) / RINGS);         // 0 just after the front passes, 1 just before
      const float tail = (1 - behind) * (1 - behind);
      return DIM_LEVEL + (1 - DIM_LEVEL) * tail;
    }
    case MODE_RINGS: {
      // one more ring lights up every step; when they are all lit the board holds, then starts again
      const uint32_t T = period(4000);
      const uint32_t step = T / (RINGS + 1);
      const int lit = (t % T) / step;                                  // 0..RINGS
      const float fade = min(1.0f, ((t % T) % step) / 250.0f);        // each new ring fades in over 250 ms
      if (r < lit) return 1;
      if (r == lit && lit < RINGS) return DIM_LEVEL + (1 - DIM_LEVEL) * fade;
      return DIM_LEVEL;
    }
    case MODE_SPIN: {
      // a comet runs round the board; the centre pixel stays dim
      const uint32_t T = period(1000);
      if (r == 0) return DIM_LEVEL;
      const float head = (t % T) / (float)T;
      const float d = frac(head - angOf[i]);
      const float b = max(0.0f, 1 - d * 2.5f);
      return DIM_LEVEL + (1 - DIM_LEVEL) * b * b;
    }
    case MODE_SPARKLE: {
      // every pixel twinkles on its own schedule
      const uint32_t T = period(900);
      const float phase = frac(i * 0.618034f);
      const float s = sinf((t / (float)T + phase) * 2.0f * PI);
      const float b = s > 0 ? s * s * s * s : 0;
      return 0.25f + 0.75f * b;
    }
    case MODE_WAVE: {
      // the pulse, but each ring runs a little behind the one inside it
      const uint32_t T = period(1700);
      return 0.25f + 0.75f * smooth(frac((t % T) / (float)T - r * 0.12f));
    }
    default: return luminance(now);
  }
}

// Gamma-correct the colour, then scale it. Correcting after scaling crushed "dim" to nothing.
static uint32_t scaled(uint8_t r, uint8_t g, uint8_t b, float level) {
  level = constrain(level, 0.0f, 1.0f) * MAX_BRIGHTNESS * brightScale;
  return ring.Color((uint8_t)(ring.gamma8(r) * level), (uint8_t)(ring.gamma8(g) * level), (uint8_t)(ring.gamma8(b) * level));
}

static void render() {
  const uint32_t now = millis();

  for (int i = 0; i < LED_COUNT; i++) {
    if (mode == MODE_RAINBOW) {
      const uint16_t hue = (uint16_t)((now * 30UL) + (uint32_t)(angOf[i] * 65536.0f));
      ring.setPixelColor(i, ring.gamma32(ring.ColorHSV(hue, 255, (uint8_t)(255 * MAX_BRIGHTNESS * brightScale))));
    } else {
      float lum = pixelLuminance(i, now);
      // a short brightening the instant the button goes down, so the press feels answered before the radio has spoken
      if (PRESS_BLIP_MS && pressedAt && now - pressedAt < PRESS_BLIP_MS) lum = min(1.0f, lum + 0.35f);
      ring.setPixelColor(i, scaled(ledR, ledG, ledB, lum));
    }
  }

  // A new image arriving: the rings fill blue from the centre out as it lands.
  if (otaActive && otaSize) {
    const float head = (float)otaGot / otaSize * RINGS;
    for (int i = 0; i < LED_COUNT; i++) {
      const float fill = constrain(head - ringOf[i], 0.0f, 1.0f);
      ring.setPixelColor(i, scaled(40, 200, 255, 0.12f + 0.88f * fill));
    }
  }

  // Hold-to-confirm: the rings light up white from the outside in as the hold time runs down.
  const Button &big = buttons[0];
  if (big.down && !big.holdSent && now - big.downSince > TAP_MAX_MS) {
    const float progress = constrain((float)(now - big.downSince - TAP_MAX_MS) / (holdMs - TAP_MAX_MS), 0.0f, 1.0f);
    const float head = progress * RINGS;                     // how many rings are lit, counting from the outside
    for (int i = 0; i < LED_COUNT; i++) {
      const float fill = constrain(head - (RINGS - 1 - ringOf[i]), 0.0f, 1.0f);
      if (fill > 0) ring.setPixelColor(i, scaled(255, 255, 255, fill));
    }
  }

  // One-shot reactions sit on top of everything.
  if (overlay != FX_NONE) {
    const uint32_t t = now - overlaySince;
    switch (overlay) {
      case FX_ACK:
        if (t < 160) for (int i = 0; i < LED_COUNT; i++) ring.setPixelColor(i, scaled(255, 255, 255, 0.9f));
        else overlay = FX_NONE;
        break;
      case FX_CONFIRM:
        if (t < 300) for (int i = 0; i < LED_COUNT; i++) ring.setPixelColor(i, scaled(255, 255, 255, 1.0f - t / 300.0f));
        else overlay = FX_NONE;
        break;
      case FX_DENIED:
        if (t >= 440) overlay = FX_NONE;
        else if ((t / 110) % 2 == 0) for (int i = 0; i < LED_COUNT; i++) ring.setPixelColor(i, scaled(255, 20, 40, 1));
        break;
      case FX_IDENTIFY:
        if (t >= 1000) overlay = FX_NONE;
        else if ((t / 125) % 2 == 0) for (int i = 0; i < LED_COUNT; i++) ring.setPixelColor(i, scaled(255, 255, 255, 1));
        break;
      case FX_RIPPLE: {
        // one bright front, in the button's colour, from the centre to the rim
        if (t >= 450) { overlay = FX_NONE; break; }
        const float head = t / 450.0f * (RINGS + 1);
        for (int i = 0; i < LED_COUNT; i++) {
          const float d = head - ringOf[i];
          if (d >= 0 && d < 1.6f) ring.setPixelColor(i, scaled(ledR, ledG, ledB, 1 - d / 1.6f));
        }
        break;
      }
      case FX_BURST: {
        // a white flash that collapses outward and fades
        if (t >= 520) { overlay = FX_NONE; break; }
        if (t < 70) { for (int i = 0; i < LED_COUNT; i++) ring.setPixelColor(i, scaled(255, 255, 255, 1)); break; }
        const float head = (t - 70) / 450.0f * (RINGS + 1);
        for (int i = 0; i < LED_COUNT; i++) {
          const float d = head - ringOf[i];
          if (d >= 0 && d < 2.0f) ring.setPixelColor(i, scaled(255, 255, 255, 1 - d / 2.0f));
        }
        break;
      }
      case FX_SPARKLE: {
        if (t >= 700) { overlay = FX_NONE; break; }
        const float env = 1 - t / 700.0f;
        for (int i = 0; i < LED_COUNT; i++) {
          const float s = sinf((t / 180.0f + frac(i * 0.618034f)) * 2.0f * PI);
          if (s > 0.6f) ring.setPixelColor(i, scaled(255, 255, 255, env * (s - 0.6f) / 0.4f));
        }
        break;
      }
      default: overlay = FX_NONE;
    }
  }
  ring.show();
#if STATUS_LED_PIN >= 0
  statusLed.setPixelColor(0, ring.getPixelColor(0));
  statusLed.show();
#endif
}

// ── Over the air ────────────────────────────────────────────────────────────
// The image comes through the hub as {"t":"ota","dev":..,"n":<chunk>,"d":"<base64>"} lines, one ESP-NOW
// packet each, in order, after a {"size","md5"} that opens the spare app slot; {"end":true} closes it,
// checks the MD5 and reboots. Every chunk is answered, so the host can keep a few in flight and know
// exactly where to resume. See docs/BUTTON_STANDARD.md, "Updating over the air".
static void otaReply(const char *st, uint32_t n, const char *why = nullptr) {
  char line[200];
  if (why) snprintf(line, sizeof(line), "{\"t\":\"ota\",\"dev\":\"%s\",\"st\":\"%s\",\"n\":%lu,\"why\":\"%s\"}", devId, st, (unsigned long)n, why);
  else snprintf(line, sizeof(line), "{\"t\":\"ota\",\"dev\":\"%s\",\"st\":\"%s\",\"n\":%lu}", devId, st, (unsigned long)n);
  sendLine(line);
}

static void otaStop() {
  if (Update.isRunning()) Update.abort();
  otaActive = false;
}

static void handleOta(JsonDocument &doc) {
  otaLast = millis();
  if (doc["size"].is<uint32_t>()) {
    otaStop();
    otaSize = doc["size"].as<uint32_t>();
    if (!Update.begin(otaSize, U_FLASH)) { otaReply("err", 0, Update.errorString()); return; }
    const char *md5 = doc["md5"] | "";
    if (strlen(md5) == 32) Update.setMD5(md5);
    otaActive = true;
    otaNext = otaGot = 0;
    radioSave = false;      // wide awake until the reboot; the new image starts sleepy again
    applyRadioSave();
    otaReply("ready", 0);
  } else if (doc["n"].is<uint32_t>()) {
    if (!otaActive) { otaReply("err", 0, "not started"); return; }
    const uint32_t n = doc["n"].as<uint32_t>();
    if (n + 1 == otaNext) { otaReply("ok", n); return; }        // the hub resent a chunk that had already landed
    if (n != otaNext) { otaReply("seq", otaNext); return; }     // out of order: say where we are
    const char *d = doc["d"] | "";
    uint8_t buf[200];
    size_t len = 0;
    if (mbedtls_base64_decode(buf, sizeof(buf), &len, (const uint8_t *)d, strlen(d)) != 0) { otaReply("err", n, "bad base64"); return; }
    if (Update.write(buf, len) != len) { otaReply("err", n, Update.errorString()); otaStop(); return; }
    otaNext++;
    otaGot += len;
    otaReply("ok", n);
  } else if (doc["end"].is<bool>()) {
    if (!otaActive) { otaReply("err", 0, "not started"); return; }
    if (!Update.end(true)) { otaReply("err", otaNext, Update.errorString()); otaStop(); return; }
    otaActive = false;
    otaReply("done", otaNext);
    delay(300);             // let the answer leave before the radio goes down
    ESP.restart();
  } else if (doc["abort"].is<bool>()) {
    otaStop();
    otaReply("aborted", 0);
  }
}

// ── Messages from the host ──────────────────────────────────────────────────

static Mode parseMode(const char *m) {
  if (!m) return MODE_OFF;
  if (!strcmp(m, "dim")) return MODE_DIM;
  if (!strcmp(m, "solid")) return MODE_SOLID;
  if (!strcmp(m, "pulse")) return MODE_PULSE;
  if (!strcmp(m, "flash")) return MODE_FLASH;
  if (!strcmp(m, "rainbow")) return MODE_RAINBOW;
  if (!strcmp(m, "ripple")) return MODE_RIPPLE_OUT;
  if (!strcmp(m, "ripple_in")) return MODE_RIPPLE_IN;
  if (!strcmp(m, "rings")) return MODE_RINGS;
  if (!strcmp(m, "spin")) return MODE_SPIN;
  if (!strcmp(m, "sparkle")) return MODE_SPARKLE;
  if (!strcmp(m, "wave")) return MODE_WAVE;
  if (!strcmp(m, "heartbeat")) return MODE_HEARTBEAT;
  return MODE_OFF;
}

static Wave parseWave(const char *w) {
  if (!w) return WAVE_SQUARE;
  if (!strcmp(w, "triangle")) return WAVE_TRIANGLE;
  if (!strcmp(w, "sawtooth")) return WAVE_SAW;
  if (!strcmp(w, "sine")) return WAVE_SINE;
  return WAVE_SQUARE;
}

static void handle(const Packet &p) {
  // Whoever is talking to us is the hub. Remember it across power cycles.
  if (!hubKnown || memcmp(hubMac, p.mac, 6) != 0) {
    memcpy(hubMac, p.mac, 6);
    hubKnown = true;
    addPeer(hubMac);
    prefs.putBytes("hub", hubMac, 6);
  }
  sendFails = 0;
  lastContact = millis();

  JsonDocument doc;
  if (deserializeJson(doc, p.text, p.len)) return;
  const char *type = doc["t"];
  const char *dev = doc["dev"];
  if (!type || (dev && strcmp(dev, devId) != 0)) return;  // unknown or not for us: ignore

  if (!strcmp(type, "led")) {
    const uint32_t rgb = strtoul(doc["c"] | "ffffff", nullptr, 16);
    const Mode next = parseMode(doc["m"]);
    ledR = (rgb >> 16) & 0xFF;
    ledG = (rgb >> 8) & 0xFF;
    ledB = rgb & 0xFF;
    // "p" says how far into its cycle the light should already be, so the whole table blinks as one.
    if (doc["p"].is<uint32_t>()) {
      modeSince = millis() - doc["p"].as<uint32_t>();
    } else if (next != mode) {
      modeSince = millis();
    }
    mode = next;
    periodMs = doc["d"].is<uint32_t>() ? constrain(doc["d"].as<uint32_t>(), 200UL, 30000UL) : 0;
  } else if (!strcmp(type, "snd")) {
    static uint16_t list[MAX_NOTES][2];
    int count = 0;
    for (JsonArray pair : doc["n"].as<JsonArray>()) {
      if (count >= MAX_NOTES) break;
      list[count][0] = pair[0] | 0;
      list[count][1] = pair[1] | 0;
      count++;
    }
    playNotes(list, count, parseWave(doc["w"]));
  } else if (!strcmp(type, "fx")) {
    const char *kind = doc["k"] | "";
    if (!strcmp(kind, "ack")) { setOverlay(FX_ACK); playNotes(SND_ACK, 2, WAVE_TRIANGLE); }
    else if (!strcmp(kind, "denied")) { setOverlay(FX_DENIED); playNotes(SND_DENIED, 3, WAVE_SAW); }
    else if (!strcmp(kind, "confirm")) { setOverlay(FX_CONFIRM); playNotes(SND_CONFIRM, 3, WAVE_TRIANGLE); }
    else if (!strcmp(kind, "ripple")) setOverlay(FX_RIPPLE);
    else if (!strcmp(kind, "burst")) setOverlay(FX_BURST);
    else if (!strcmp(kind, "sparkle")) setOverlay(FX_SPARKLE);
  } else if (!strcmp(type, "cfg")) {
    holdMs = constrain((uint32_t)(doc["hold"] | (int)holdMs), 300UL, 10000UL);
    flashMs = constrain((uint32_t)(doc["flash"] | (int)flashMs), 300UL, 10000UL);
    if (doc["bright"].is<int>()) brightScale = constrain((int)doc["bright"], 5, 100) / 100.0f;
    if (doc["pulse"].is<const char*>()) {
      const Mode look = parseMode(doc["pulse"]);
      pulseLook = (look == MODE_SOLID || look == MODE_HEARTBEAT) ? look : MODE_PULSE;
    }
    if (doc["ps"].is<int>()) {
      radioSave = doc["ps"].as<int>() != 0;
      applyRadioSave();
    }
  } else if (!strcmp(type, "id")) {
    setOverlay(FX_IDENTIFY);
  } else if (!strcmp(type, "hub")) {
    sendHello();
  } else if (!strcmp(type, "ota")) {
    handleOta(doc);
  }
}

// ── USB serial ──────────────────────────────────────────────────────────────

// Plugged into a laptop, the button says what it is when asked (the flashing page does this) and blinks
// so you can see which one it is. Any line of JSON with no "dev" counts as "who are you?".
static void serviceSerial() {
  static char line[96];
  static size_t n = 0;
  while (Serial.available()) {
    const char ch = (char)Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (n > 0 && line[0] == '{' && !strstr(line, "\"dev\"")) {
        Serial.printf("{\"t\":\"button\",\"dev\":\"%s\",\"fw\":\"%s\",\"hub\":%s}\n", devId, FW_VERSION, hubKnown ? "true" : "false");
        setOverlay(FX_IDENTIFY);
      }
      n = 0;
    } else if (n < sizeof(line) - 1) {
      line[n++] = ch;
    } else {
      n = 0;
    }
  }
}

// ── Buttons ─────────────────────────────────────────────────────────────────

// The big button may be wired to any of several pins (see config.h); an unconnected pin, pulled up, reads high.
static bool bigButtonDown() {
  for (int i = 0; i < BIG_BUTTON_PIN_COUNT; i++)
    if (digitalRead(BIG_BUTTON_PINS[i]) == LOW) return true;
  return false;
}

static void serviceButtons() {
  const uint32_t now = millis();
  for (int i = 0; i < BUTTON_COUNT; i++) {
    Button &b = buttons[i];
    const bool raw = i == 0 ? bigButtonDown() : digitalRead(BUTTON_PINS[i]) == LOW;
    if (raw != b.raw) {
      b.raw = raw;
      b.rawSince = now;
    }
    if (raw != b.down && now - b.rawSince >= DEBOUNCE_MS) {
      b.down = raw;
      if (raw) {
        b.downSince = now;
        b.holdSent = false;
        if (i == 0) pressedAt = now;
      } else if (!b.holdSent && now - b.downSince <= TAP_MAX_MS) {
        // Taps go out at once so acknowledging never lags; a quick second one adds "double".
        if (i == 0 && b.lastTap && now - b.lastTap <= DOUBLE_MS) {
          b.lastTap = 0;
          sendButton(i, "double");
        } else {
          b.lastTap = now;
          sendButton(i, "tap");
        }
      }
      // Released after 350 ms but before the hold time: an abandoned hold. Say nothing.
    }
    if (i == 0 && b.down && !b.holdSent && now - b.downSince >= holdMs) {
      b.holdSent = true;
      sendButton(0, "hold");
      setOverlay(FX_BURST);
      playNotes(SND_CONFIRM, 3, WAVE_TRIANGLE);
    }
  }
}

// ── Sleep ───────────────────────────────────────────────────────────────────

// Nobody is listening: stop burning batteries. A press of the big button restarts the chip.
static void sleepUntilPressed() {
  uint64_t mask = 0;
  for (int i = 0; i < BIG_BUTTON_PIN_COUNT; i++) {
    const int pin = BIG_BUTTON_PINS[i];
#if CONFIG_IDF_TARGET_ESP32C3
    if (pin >= 0 && pin <= 5) mask |= 1ULL << pin;   // only GPIO 0-5 can wake a C3 from deep sleep
#else
    if (pin >= 0 && rtc_gpio_is_valid_gpio((gpio_num_t)pin)) {
      rtc_gpio_pullup_en((gpio_num_t)pin);            // keep the pull-up alive while asleep
      rtc_gpio_pulldown_dis((gpio_num_t)pin);
      mask |= 1ULL << pin;
    }
#endif
  }
  if (!mask) return;
  ring.clear();
  ring.show();
#if STATUS_LED_PIN >= 0
  statusLed.clear();
  statusLed.show();
#endif
#if CONFIG_IDF_TARGET_ESP32C3
  esp_deep_sleep_enable_gpio_wakeup(mask, ESP_GPIO_WAKEUP_GPIO_LOW);
#else
  esp_sleep_enable_ext1_wakeup(mask, ESP_EXT1_WAKEUP_ANY_LOW);
#endif
  esp_deep_sleep_start();
}

// ── Arduino ─────────────────────────────────────────────────────────────────

void setup() {
  setCpuFrequencyMhz(CPU_MHZ);
  Serial.begin(115200);
  for (int i = 0; i < BIG_BUTTON_PIN_COUNT; i++) pinMode(BIG_BUTTON_PINS[i], INPUT_PULLUP);
  for (int i = 1; i < BUTTON_COUNT; i++) pinMode(BUTTON_PINS[i], INPUT_PULLUP);

  mapPixels();
  ring.begin();
  ring.clear();
  ring.show();
#if STATUS_LED_PIN >= 0
  statusLed.begin();
  statusLed.clear();
  statusLed.show();
#endif

#if defined(AUDIO_I2S)
  i2s.setPins(I2S_BCLK_PIN, I2S_LRC_PIN, I2S_DIN_PIN);
  i2s.begin(I2S_MODE_STD, SAMPLE_RATE, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO);
#endif

  inbox = xQueueCreate(8, sizeof(Packet));
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);

  uint8_t mac[6];
  esp_wifi_get_mac(WIFI_IF_STA, mac);
  snprintf(devId, sizeof(devId), "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

  if (esp_now_init() != ESP_OK) {
    Serial.println("esp-now init failed");
    return;
  }
  esp_now_register_recv_cb(onReceive);
  esp_now_register_send_cb(onSent);
  addPeer(EVERYONE);
  applyRadioSave();

  prefs.begin("pax", false);
  if (prefs.getBytes("hub", hubMac, 6) == 6) {
    hubKnown = true;
    addPeer(hubMac);
  }

  Serial.printf("{\"t\":\"button\",\"dev\":\"%s\",\"fw\":\"%s\",\"hub\":%s}\n", devId, FW_VERSION, hubKnown ? "true" : "false");
  setOverlay(FX_IDENTIFY);  // a blink on power-up: "I'm alive"
  sendHello();
}

void loop() {
  static uint32_t lastHello = 0, lastFrame = 0, lastBattery = 0;
  const uint32_t now = millis();

  Packet p;
  while (xQueueReceive(inbox, &p, 0) == pdTRUE) handle(p);
  if (radioHeld && (int32_t)(now - radioHoldUntil) >= 0) releaseRadio();

  // Eight failed sends in a row: the hub we knew is gone. Go back to looking for one.
  if (hubKnown && sendFails >= 8) {
    hubKnown = false;
    sendFails = 0;
  }
  if (now - lastHello >= (hubKnown ? HELLO_BEAT_MS : HELLO_SEARCH_MS)) {
    lastHello = now;
    sendHello();
  }

  if (otaActive && now - otaLast > OTA_IDLE_MS) { otaStop(); otaReply("err", otaNext, "timed out"); }

  if (SLEEP_AFTER_MINUTES > 0 && now - lastContact > (uint32_t)SLEEP_AFTER_MINUTES * 60000UL && !buttons[0].down) sleepUntilPressed();

  serviceButtons();
  serviceSerial();
  audioService();

  if (now - lastFrame >= 16) {
    lastFrame = now;
    render();
  }

  if (BATTERY_PIN >= 0 && now - lastBattery >= 60000) {
    lastBattery = now;
    char line[80];
    const int mv = (int)(analogReadMilliVolts(BATTERY_PIN) * BATTERY_DIVIDER);
    snprintf(line, sizeof(line), "{\"t\":\"bat\",\"dev\":\"%s\",\"mv\":%d}", devId, mv);
    sendLine(line);
  }
}
