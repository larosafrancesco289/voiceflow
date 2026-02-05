#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DESKTOP_DIR="$PROJECT_ROOT/apps/desktop"
TARGET_DIR="$DESKTOP_DIR/src-tauri/target"
E2E_DIR="$PROJECT_ROOT/.e2e"
E2E_LOG="$E2E_DIR/shortcut-events.log"
APP_OUTPUT_LOG="$E2E_DIR/voiceflow-app.log"

mkdir -p "$E2E_DIR"
rm -f "$E2E_LOG" "$APP_OUTPUT_LOG"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "Building debug app bundle..."
  (
    cd "$DESKTOP_DIR"
    bun run tauri build --debug --bundles app >/tmp/voiceflow-e2e-build.log
  )
fi

DEBUG_BIN="$TARGET_DIR/debug/bundle/macos/VoiceFlow.app/Contents/MacOS/voiceflow"
RELEASE_BIN="$TARGET_DIR/release/bundle/macos/VoiceFlow.app/Contents/MacOS/voiceflow"
if [[ -x "$DEBUG_BIN" ]]; then
  APP_BIN="$DEBUG_BIN"
elif [[ -x "$RELEASE_BIN" ]]; then
  APP_BIN="$RELEASE_BIN"
else
  echo "Could not locate packaged VoiceFlow binary under $TARGET_DIR"
  exit 1
fi

wait_for_event() {
  local event="$1"
  local timeout="${2:-15}"
  local deadline=$((SECONDS + timeout))

  while (( SECONDS < deadline )); do
    if [[ -f "$E2E_LOG" ]] && grep -q " ${event}$" "$E2E_LOG"; then
      return 0
    fi
    sleep 0.2
  done

  return 1
}

echo "Launching packaged app: $APP_BIN"
VOICEFLOW_E2E_LOG="$E2E_LOG" "$APP_BIN" >"$APP_OUTPUT_LOG" 2>&1 &
APP_PID=$!

cleanup() {
  if kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    wait "$APP_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if ! wait_for_event "app-started" 20; then
  echo "Timed out waiting for app startup marker."
  echo "App logs:"
  tail -n 100 "$APP_OUTPUT_LOG" || true
  exit 1
fi

if ! swift - <<'SWIFT'
import ApplicationServices
exit(AXIsProcessTrusted() ? 0 : 2)
SWIFT
then
  echo "Accessibility permission is required for synthetic key events."
  echo "Grant access to your terminal process in:"
  echo "System Settings -> Privacy & Security -> Accessibility"
  exit 1
fi

echo "Activating TextEdit to prove shortcut works globally..."
osascript -e 'tell application "TextEdit" to activate'
sleep 1

echo "Sending Option+Space (press/release) via CGEvent..."
swift - <<'SWIFT'
import Foundation
import ApplicationServices

guard let src = CGEventSource(stateID: .hidSystemState) else {
    fputs("Failed to create CGEventSource\n", stderr)
    exit(1)
}

func postKey(_ keyCode: CGKeyCode, keyDown: Bool, flags: CGEventFlags = []) {
    guard let event = CGEvent(keyboardEventSource: src, virtualKey: keyCode, keyDown: keyDown) else {
        return
    }
    event.flags = flags
    event.post(tap: .cghidEventTap)
}

let optionKey: CGKeyCode = 58
let spaceKey: CGKeyCode = 49

postKey(optionKey, keyDown: true)
usleep(50_000)
postKey(spaceKey, keyDown: true, flags: .maskAlternate)
usleep(250_000)
postKey(spaceKey, keyDown: false, flags: .maskAlternate)
usleep(50_000)
postKey(optionKey, keyDown: false)
SWIFT

if ! wait_for_event "shortcut-pressed" 10; then
  echo "Did not observe shortcut-pressed in e2e log."
  cat "$E2E_LOG" || true
  echo "If accessibility permissions were recently granted, rerun the script."
  exit 1
fi

if ! wait_for_event "shortcut-released" 10; then
  echo "Did not observe shortcut-released in e2e log."
  cat "$E2E_LOG" || true
  exit 1
fi

if ! wait_for_event "bubble-shown" 10; then
  echo "Did not observe bubble-shown in e2e log."
  cat "$E2E_LOG" || true
  exit 1
fi

echo "E2E shortcut path verified."
echo "Recorded events:"
cat "$E2E_LOG"
