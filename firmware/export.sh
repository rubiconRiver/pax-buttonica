#!/bin/sh
# Build both sketches and put the flashable images where the site serves them (public/firmware/),
# for the one-click flasher at /flash.html. Run after changing firmware, then commit and deploy.
set -e
cd "$(dirname "$0")/.."
LIBS="--library $HOME/Documents/Arduino/libraries/Adafruit_NeoPixel --library $HOME/Documents/Arduino/libraries/ArduinoJson"
for what in hub button; do
  arduino-cli compile -b esp32:esp32:m5stack_atoms3 --export-binaries $LIBS "firmware/$what" | grep 'Sketch uses'
  b="firmware/$what/build/esp32.esp32.m5stack_atoms3"
  out="public/firmware/$what"
  mkdir -p "$out"
  cp "$b/$what.ino.bootloader.bin" "$out/bootloader.bin"
  cp "$b/$what.ino.partitions.bin" "$out/partitions.bin"
  cp "$b/boot_app0.bin" "$out/boot_app0.bin"
  cp "$b/$what.ino.bin" "$out/app.bin"
  fw=$(grep -o 'FW_VERSION "[^"]*"' "firmware/$what/$what.ino" | cut -d'"' -f2)
  md5=$(md5 -q "$out/app.bin")
  size=$(stat -f %z "$out/app.bin")
  # "size" and "md5" are ours, for updating buttons over the air; the flashing tool ignores them.
  cat > "$out/manifest.json" <<JSON
{
  "name": "Pax Buttonica $what",
  "version": "$fw",
  "size": $size,
  "md5": "$md5",
  "new_install_prompt_erase": false,
  "builds": [
    {
      "chipFamily": "ESP32-S3",
      "parts": [
        { "path": "bootloader.bin", "offset": 0 },
        { "path": "partitions.bin", "offset": 32768 },
        { "path": "boot_app0.bin", "offset": 57344 },
        { "path": "app.bin", "offset": 65536 }
      ]
    }
  ]
}
JSON
  echo "$what $fw → $out"
done
