#!/bin/bash
# Start Vite development server for VibeCodeEditor Demo
# Lifetime: 3 hours (10800 seconds)
PORT=1420
PIDFILE="/tmp/vibecodeeditor-preview.pid"

if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Preview server already running with PID $OLD_PID"
    exit 0
  fi
fi

# Run vite with 3-hour timeout
(
  python3 -c "
import subprocess, time, sys, os
proc = subprocess.Popen(['./node_modules/.bin/vite', '--port', '1420', '--host', '0.0.0.0'])
time.sleep(10800)
proc.terminate()
"
) > /tmp/vibecodeeditor-preview.log 2>&1 &

NEW_PID=$!
echo $NEW_PID > "$PIDFILE"
echo "Preview server started with PID $NEW_PID (Timeout: 10800s / 3 hours)"
