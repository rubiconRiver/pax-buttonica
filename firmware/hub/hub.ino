/*
 * Pax Buttonica hub — draft standard v0.
 *
 * A relay and nothing else. Lines of JSON arrive over USB serial from the web
 * app; each names a button by "dev" (its MAC address in hex) and is forwarded,
 * untouched, to that button over ESP-NOW. Anything a button sends is printed
 * back up the serial port as a line. The hub never looks inside a message
 * beyond finding "dev".
 *
 * Board: ESP32-C3 (e.g. "Super Mini"). Build with USB CDC On Boot enabled:
 *   arduino-cli compile -b esp32:esp32:esp32c3:CDCOnBoot=cdc firmware/hub
 *
 * UNTESTED ON HARDWARE. It compiles; nobody has flashed it yet.
 */
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#define FW_VERSION "0.1.0"
#define PROTOCOL_VERSION 0
#define ESPNOW_CHANNEL 1
#define MAX_LINE 250      // one ESP-NOW packet
#define QUEUE_SLOTS 16
#define LOST_AFTER_FAILS 5

struct Packet {
  uint8_t mac[6];
  int8_t rssi;  // how loudly we heard it, in dBm
  uint8_t len;
  char text[MAX_LINE + 1];
};

// Radio → serial. The receive callback runs on the Wi-Fi task, so it only queues.
static QueueHandle_t inbox;

// Delivery failures per known button, to report {"t":"lost"}.
struct Known {
  uint8_t mac[6];
  uint8_t fails;
  bool reportedLost;
  uint32_t lastRssiReport;
};
static Known known[20];
static int knownCount = 0;

static Known *lookup(const uint8_t *mac, bool create) {
  for (int i = 0; i < knownCount; i++)
    if (memcmp(known[i].mac, mac, 6) == 0) return &known[i];
  if (!create || knownCount >= 20) return nullptr;
  Known *k = &known[knownCount++];
  memcpy(k->mac, mac, 6);
  k->fails = 0;
  k->reportedLost = false;
  k->lastRssiReport = 0;
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, mac, 6);
  peer.channel = ESPNOW_CHANNEL;
  peer.encrypt = false;
  if (!esp_now_is_peer_exist(mac)) esp_now_add_peer(&peer);
  return k;
}

static void macToHex(const uint8_t *mac, char *out) {
  snprintf(out, 13, "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static bool hexToMac(const char *hex, uint8_t *mac) {
  for (int i = 0; i < 6; i++) {
    char byteText[3] = {hex[i * 2], hex[i * 2 + 1], 0};
    if (!isxdigit(byteText[0]) || !isxdigit(byteText[1])) return false;
    mac[i] = (uint8_t)strtoul(byteText, nullptr, 16);
  }
  return true;
}

static void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len <= 0 || len > MAX_LINE) return;
  Known *k = lookup(info->src_addr, true);
  if (k) {
    k->fails = 0;
    k->reportedLost = false;
  }
  Packet p;
  memcpy(p.mac, info->src_addr, 6);
  p.rssi = info->rx_ctrl ? info->rx_ctrl->rssi : 0;
  p.len = (uint8_t)len;
  memcpy(p.text, data, len);
  p.text[len] = 0;
  xQueueSend(inbox, &p, 0);
}

static void onSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  Known *k = lookup(info->des_addr, false);
  if (!k) return;
  if (status == ESP_NOW_SEND_SUCCESS) {
    k->fails = 0;
    k->reportedLost = false;
  } else if (k->fails < 255) {
    k->fails++;
  }
}

static void announce() {
  Serial.printf("{\"t\":\"hub\",\"v\":%d,\"fw\":\"%s\"}\n", PROTOCOL_VERSION, FW_VERSION);
}

// Forward one line from the web app to the button it names.
static void forward(char *line, size_t len) {
  const char *key = strstr(line, "\"dev\":\"");
  if (!key) {
    announce();  // anything without a "dev" is treated as "are you there?"
    return;
  }
  uint8_t mac[6];
  if (strlen(key + 7) < 12 || !hexToMac(key + 7, mac)) return;
  if (!lookup(mac, true)) return;
  esp_now_send(mac, (const uint8_t *)line, len);
}

void setup() {
  Serial.begin(115200);
  inbox = xQueueCreate(QUEUE_SLOTS, sizeof(Packet));

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  if (esp_now_init() != ESP_OK) {
    Serial.println("esp-now init failed");
    return;
  }
  esp_now_register_recv_cb(onReceive);
  esp_now_register_send_cb(onSent);

  // Buttons look for a hub by broadcasting; being able to answer broadcast-addressed peers isn't needed,
  // but we do need the broadcast peer registered on some cores to receive them reliably.
  static const uint8_t everyone[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, everyone, 6);
  peer.channel = ESPNOW_CHANNEL;
  esp_now_add_peer(&peer);

  announce();
}

void loop() {
  // Serial → radio
  static char line[MAX_LINE + 1];
  static size_t n = 0;
  while (Serial.available()) {
    char ch = (char)Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (n > 0) {
        line[n] = 0;
        forward(line, n);
      }
      n = 0;
    } else if (n < MAX_LINE) {
      line[n++] = ch;
    } else {
      n = 0;  // oversized line: drop it
    }
  }

  // Radio → serial
  Packet p;
  while (xQueueReceive(inbox, &p, 0) == pdTRUE) {
    Serial.write((const uint8_t *)p.text, p.len);
    Serial.write('\n');
    // The one thing the hub adds of its own: signal strength, at most once a second per button,
    // so range can be checked at the real table instead of guessed at.
    Known *k = lookup(p.mac, false);
    if (k && p.rssi != 0 && millis() - k->lastRssiReport >= 1000) {
      k->lastRssiReport = millis();
      char hex[13];
      macToHex(p.mac, hex);
      Serial.printf("{\"t\":\"rssi\",\"dev\":\"%s\",\"dbm\":%d}\n", hex, p.rssi);
    }
  }

  // Tell the app about buttons that have stopped answering.
  for (int i = 0; i < knownCount; i++) {
    if (known[i].fails >= LOST_AFTER_FAILS && !known[i].reportedLost) {
      char hex[13];
      macToHex(known[i].mac, hex);
      Serial.printf("{\"t\":\"lost\",\"dev\":\"%s\"}\n", hex);
      known[i].reportedLost = true;
    }
  }
  delay(1);
}
