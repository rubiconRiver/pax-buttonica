/*
 * Pax Buttonica button — draft standard v0 (see docs/BUTTON_STANDARD.md).
 *
 * A dumb, glowing thing. It shows the colour and mode it's told to show, plays
 * the notes it's handed, and reports tap / double / hold. It knows nothing
 * about Twilight Imperium.
 *
 * Board: ESP32-C3. Libraries: Adafruit NeoPixel, ArduinoJson (v7).
 *   arduino-cli compile -b esp32:esp32:esp32c3:CDCOnBoot=cdc firmware/button
 * Pins and options: config.h
 *
 * UNTESTED ON HARDWARE. It compiles; nobody has flashed it yet.
 *
 * Power: this first version keeps the radio listening all the time (~80-100 mA
 * plus LEDs), which is simple and good for a day on four AAs. The poll-and-sleep
 * scheme in the standard is the next step once the basics are proven.
 */
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Preferences.h>
#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>
#include "config.h"

#if defined(AUDIO_I2S)
#include <ESP_I2S.h>
static I2SClass i2s;
#define SAMPLE_RATE 16000
#endif

#define FW_VERSION "0.1.0"
#define MAX_LINE 250
#define TAP_MAX_MS 350
#define DOUBLE_MS 400
#define DEBOUNCE_MS 25
#define HELLO_SEARCH_MS 3000   // looking for a hub
#define HELLO_BEAT_MS 10000    // heartbeat, so a reloaded web app finds us again
#define MAX_NOTES 32

// ── State ───────────────────────────────────────────────────────────────────

enum Mode { MODE_OFF, MODE_DIM, MODE_SOLID, MODE_PULSE, MODE_FLASH, MODE_RAINBOW };
enum Overlay { FX_NONE, FX_ACK, FX_DENIED, FX_CONFIRM, FX_IDENTIFY };
enum Wave { WAVE_SQUARE, WAVE_TRIANGLE, WAVE_SAW, WAVE_SINE };

static Adafruit_NeoPixel ring(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);
static Preferences prefs;

static char devId[13];
static uint8_t hubMac[6];
static bool hubKnown = false;
static volatile uint8_t sendFails = 0;
static const uint8_t EVERYONE[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

static uint8_t ledR = 255, ledG = 255, ledB = 255;
static Mode mode = MODE_OFF;
static uint32_t modeSince = 0;
static uint32_t holdMs = 2000;
static uint32_t flashMs = 2000;

static Overlay overlay = FX_NONE;
static uint32_t overlaySince = 0;

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

static void sendLine(const char *line) {
  esp_now_send(hubKnown ? hubMac : EVERYONE, (const uint8_t *)line, strlen(line));
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
  if (status == ESP_NOW_SEND_SUCCESS) sendFails = 0;
  else if (sendFails < 255) sendFails++;
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

static void setOverlay(Overlay fx) {
  overlay = fx;
  overlaySince = millis();
}

// How bright the LED is right now, 0..1, for the current mode. Mirrors the simulator's CSS.
static float luminance(uint32_t now) {
  const uint32_t t = now - modeSince;
  switch (mode) {
    case MODE_OFF: return 0;
    case MODE_DIM: return DIM_LEVEL;
    case MODE_SOLID: return 1;
    case MODE_RAINBOW: return 1;
    case MODE_PULSE: {
      const float p = (t % 1700) / 1700.0f;
      return 0.34f + 0.66f * (0.5f - 0.5f * cosf(p * 2.0f * PI));
    }
    case MODE_FLASH: {
      // on 0-38%, fade to 50%, dark to 88%, fade back up
      const float p = (t % flashMs) / (float)flashMs;
      if (p < 0.38f) return 1;
      if (p < 0.50f) return 1.0f - (p - 0.38f) / 0.12f * 0.95f;
      if (p < 0.88f) return 0.05f;
      return 0.05f + (p - 0.88f) / 0.12f * 0.95f;
    }
  }
  return 0;
}

static uint32_t scaled(uint8_t r, uint8_t g, uint8_t b, float level) {
  level = constrain(level, 0.0f, 1.0f) * MAX_BRIGHTNESS;
  return ring.gamma32(ring.Color((uint8_t)(r * level), (uint8_t)(g * level), (uint8_t)(b * level)));
}

static void render() {
  const uint32_t now = millis();
  const float lum = luminance(now);

  for (int i = 0; i < LED_COUNT; i++) {
    if (mode == MODE_RAINBOW) {
      const uint16_t hue = (uint16_t)((now * 30UL) + (uint32_t)i * 65536UL / LED_COUNT);
      ring.setPixelColor(i, ring.gamma32(ring.ColorHSV(hue, 255, (uint8_t)(255 * MAX_BRIGHTNESS))));
    } else {
      ring.setPixelColor(i, scaled(ledR, ledG, ledB, lum));
    }
  }

  // Hold-to-confirm: a white arc sweeps round the ring, so the player sees how long is left.
  const Button &big = buttons[0];
  if (big.down && !big.holdSent && now - big.downSince > TAP_MAX_MS) {
    const float progress = (float)(now - big.downSince) / holdMs;
    const int lit = (int)(progress * LED_COUNT);
    for (int i = 0; i <= lit && i < LED_COUNT; i++) ring.setPixelColor(i, scaled(255, 255, 255, 1));
  }

  // One-shot reactions sit on top of everything.
  if (overlay != FX_NONE) {
    const uint32_t t = now - overlaySince;
    uint32_t colour = 0;
    bool show = false, done = false;
    switch (overlay) {
      case FX_ACK: show = t < 160; done = !show; colour = scaled(255, 255, 255, 0.9f); break;
      case FX_CONFIRM: show = t < 300; done = !show; colour = scaled(255, 255, 255, 1.0f - t / 300.0f); break;
      case FX_DENIED: show = (t / 110) % 2 == 0; done = t >= 440; colour = scaled(255, 20, 40, 1); break;
      case FX_IDENTIFY: show = (t / 125) % 2 == 0; done = t >= 1000; colour = scaled(255, 255, 255, 1); break;
      default: done = true;
    }
    if (done) overlay = FX_NONE;
    else if (show) for (int i = 0; i < LED_COUNT; i++) ring.setPixelColor(i, colour);
  }
  ring.show();
}

// ── Messages from the host ──────────────────────────────────────────────────

static Mode parseMode(const char *m) {
  if (!m) return MODE_OFF;
  if (!strcmp(m, "dim")) return MODE_DIM;
  if (!strcmp(m, "solid")) return MODE_SOLID;
  if (!strcmp(m, "pulse")) return MODE_PULSE;
  if (!strcmp(m, "flash")) return MODE_FLASH;
  if (!strcmp(m, "rainbow")) return MODE_RAINBOW;
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
    if (next != mode) {
      mode = next;
      modeSince = millis();
    }
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
  } else if (!strcmp(type, "cfg")) {
    holdMs = constrain((uint32_t)(doc["hold"] | (int)holdMs), 300UL, 10000UL);
    flashMs = constrain((uint32_t)(doc["flash"] | (int)flashMs), 300UL, 10000UL);
  } else if (!strcmp(type, "id")) {
    setOverlay(FX_IDENTIFY);
  } else if (!strcmp(type, "hub")) {
    sendHello();
  }
}

// ── Buttons ─────────────────────────────────────────────────────────────────

static void serviceButtons() {
  const uint32_t now = millis();
  for (int i = 0; i < BUTTON_COUNT; i++) {
    Button &b = buttons[i];
    const bool raw = digitalRead(BUTTON_PINS[i]) == LOW;
    if (raw != b.raw) {
      b.raw = raw;
      b.rawSince = now;
    }
    if (raw != b.down && now - b.rawSince >= DEBOUNCE_MS) {
      b.down = raw;
      if (raw) {
        b.downSince = now;
        b.holdSent = false;
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
      setOverlay(FX_CONFIRM);
      playNotes(SND_CONFIRM, 3, WAVE_TRIANGLE);
    }
  }
}

// ── Arduino ─────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < BUTTON_COUNT; i++) pinMode(BUTTON_PINS[i], INPUT_PULLUP);

  ring.begin();
  ring.clear();
  ring.show();

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

  prefs.begin("pax", false);
  if (prefs.getBytes("hub", hubMac, 6) == 6) {
    hubKnown = true;
    addPeer(hubMac);
  }

  Serial.printf("Pax Buttonica button %s, fw %s\n", devId, FW_VERSION);
  setOverlay(FX_IDENTIFY);  // a blink on power-up: "I'm alive"
  sendHello();
}

void loop() {
  static uint32_t lastHello = 0, lastFrame = 0, lastBattery = 0;
  const uint32_t now = millis();

  Packet p;
  while (xQueueReceive(inbox, &p, 0) == pdTRUE) handle(p);

  // Eight failed sends in a row: the hub we knew is gone. Go back to looking for one.
  if (hubKnown && sendFails >= 8) {
    hubKnown = false;
    sendFails = 0;
  }
  if (now - lastHello >= (hubKnown ? HELLO_BEAT_MS : HELLO_SEARCH_MS)) {
    lastHello = now;
    sendHello();
  }

  serviceButtons();
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
