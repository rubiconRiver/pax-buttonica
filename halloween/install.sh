#!/bin/sh
# Makes the Halloween show an app on this Mac:
#   - the little server runs by itself from login on, and is restarted if it ever stops (a launchd agent);
#   - "Halloween Show" appears in ~/Applications: double-click it (or drag it to the Dock) and the show opens in its own
#     window, with its own Chrome profile so sound can start without a click and the window is never slowed down.
# Run it again after moving the repo. To take it all away:  halloween/install.sh --remove
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL=ca.paxbuttonica.halloween
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP="$HOME/Applications/Halloween Show.app"
PORT=8031

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "$1" = "--remove" ]; then
  rm -f "$PLIST"; rm -rf "$APP"
  echo "Removed. (The show's own Chrome profile, with its settings, is still in ~/Library/Application Support/HalloweenShow.)"
  exit 0
fi

NODE="$(command -v node)" || { echo "node is not on the PATH"; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs" "$APP/Contents/MacOS"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$DIR/server.mjs</string></array>
  <key>EnvironmentVariables</key><dict><key>PORT</key><string>$PORT</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/halloween-show.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/halloween-show.log</string>
</dict></plist>
PLIST

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Halloween Show</string>
  <key>CFBundleIdentifier</key><string>$LABEL.app</string>
  <key>CFBundleExecutable</key><string>halloween</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST

cat > "$APP/Contents/MacOS/halloween" <<SH
#!/bin/sh
# Wait for the server (it is normally already up), then open the show in its own Chrome window.
for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null "http://localhost:$PORT/api/sounds" && break; sleep 0.5; done
exec open -na "Google Chrome" --args --app="http://localhost:$PORT" \\
  --user-data-dir="\$HOME/Library/Application Support/HalloweenShow" \\
  --autoplay-policy=no-user-gesture-required \\
  --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows \\
  --no-first-run --no-default-browser-check
SH
chmod +x "$APP/Contents/MacOS/halloween"

[ -n "$DRY" ] && { echo "Dry run: files written, nothing started."; exit 0; }
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Done. The server is running and will start by itself from now on (log: ~/Library/Logs/halloween-show.log)."
echo "Open \"Halloween Show\" from ~/Applications. Opening it now."
open "$APP"
