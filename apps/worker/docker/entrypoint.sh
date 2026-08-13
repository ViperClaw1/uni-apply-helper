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

# No -localhost: Railway's private networking is service-to-service over IPv6 — traffic from
# the API arrives on this container's real interface, not as loopback, so -localhost (which
# also seems to trigger x11vnc's IPv6 bind failing with "Address already in use") would block
# it entirely. Reachability now depends on nothing ever generating a public domain for this
# service's port 5900 — see the plan's risk #3. Do NOT do that in Railway's settings.
#
# ponytail: no VNC password (-nopw) either — auth boundary is that private-network-only
# reachability plus the single-use ticket gate in the API (Phase 2), not VNC's own weak auth.
# Add x11vnc -passwd if the "never public" assumption ever looks weaker than expected.
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 &

exec pnpm --filter worker start:prod
