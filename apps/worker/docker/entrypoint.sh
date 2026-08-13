#!/bin/sh
set -e

Xvfb :99 -screen 0 1440x1200x24 &

# Wait for Xvfb's socket to exist before anything tries to attach to :99 — starting it with `&`
# only backgrounds it, it doesn't guarantee it's actually ready by the next line.
for i in $(seq 1 30); do
  [ -e /tmp/.X11-unix/X99 ] && break
  sleep 0.5
done

export DISPLAY=:99

# ponytail: no VNC password (-nopw) — auth boundary is Railway private-network isolation plus
# the ticket gate added in Phase 2, not VNC's own weak auth. Add x11vnc -passwd if that
# isolation ever looks weaker than assumed. -localhost: only reachable from inside this
# container; the API proxy reaches it via Railway private networking, never the public internet.
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -localhost &

exec pnpm --filter worker start:prod
