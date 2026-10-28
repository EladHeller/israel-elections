#!/bin/bash
set -euxo pipefail
exec > >(tee /var/log/election-crawler-bootstrap.log) 2>&1
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl xvfb openbox x11vnc novnc websockify fonts-noto-core unzip
curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb
apt-get install -y /tmp/chrome.deb
# Install the official Node distribution, checking its published checksum.
cd /tmp
curl -fsSLO https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-x64.tar.xz
curl -fsSL https://nodejs.org/dist/v24.22.1/SHASUMS256.txt -o SHASUMS256.txt
# Select only the downloaded distribution for verification.
grep ' node-v24.22.1-linux-x64.tar.xz$' SHASUMS256.txt | sha256sum -c -
tar -xJf node-v24.22.1-linux-x64.tar.xz -C /usr/local --strip-components=1
id crawler || useradd --create-home --shell /bin/bash crawler
install -d -o crawler -g crawler /opt/election-crawler /home/crawler/downloads /home/crawler/profile
cd /opt/election-crawler
npm init -y
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --save-exact playwright@1.62.0 csv-parse@7.0.3
chown -R crawler:crawler /opt/election-crawler
cat > /opt/election-crawler/desktop.sh <<'DESKTOP'
#!/bin/bash
set -euo pipefail
export DISPLAY=:99
Xvfb :99 -screen 0 1440x1000x24 -nolisten tcp &
trap 'kill $(jobs -pr) 2>/dev/null || true' EXIT
for attempt in $(seq 1 30); do [ -S /tmp/.X11-unix/X99 ] && break; sleep 1; done
openbox &
x11vnc -display :99 -localhost -rfbport 5900 -nopw -forever -shared &
websockify --web=/usr/share/novnc 127.0.0.1:6080 localhost:5900 &
google-chrome-stable --user-data-dir=/home/crawler/profile --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --no-first-run https://votes26.bechirot.gov.il/ &
wait -n
DESKTOP
chmod +x /opt/election-crawler/desktop.sh
cat > /etc/systemd/system/election-desktop.service <<'UNIT'
[Unit]
Description=Election crawler Chrome desktop
After=network-online.target
Wants=network-online.target
[Service]
User=crawler
Environment=HOME=/home/crawler
ExecStart=/bin/bash /opt/election-crawler/desktop.sh
Restart=on-failure
RestartSec=10
KillMode=control-group
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now election-desktop
# Bound the initial diagnostic's compute spend; restart manually for further work.
shutdown -h +120
touch /opt/election-crawler/bootstrap-ready
