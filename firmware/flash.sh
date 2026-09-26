#!/bin/sh
# Flash a sketch to whichever Atom is plugged in:   firmware/flash.sh hub   or   firmware/flash.sh button
# Finds the port itself. Needs arduino-cli with the esp32 core and the two libraries installed.
set -e
cd "$(dirname "$0")/.."
what="${1:-button}"
port=$(ls /dev/cu.usbmodem* 2>/dev/null | head -1)
if [ -z "$port" ]; then
  echo "No Atom on USB. Plug it in (with a data cable), close any browser tab that has it connected, and try again." >&2
  exit 1
fi
echo "Flashing $what to $port"
arduino-cli compile -b esp32:esp32:m5stack_atoms3 -u -p "$port" "firmware/$what"
