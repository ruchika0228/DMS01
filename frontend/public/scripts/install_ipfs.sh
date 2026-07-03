#!/bin/bash

set -e

echo "=========================================="
echo "        IPFS Linux Auto Setup Script      "
echo "=========================================="

ARCH=$(uname -m)

if [[ "$ARCH" == "x86_64" ]]; then
    KUBO_ARCH="amd64"
elif [[ "$ARCH" == "aarch64" ]]; then
    KUBO_ARCH="arm64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

VERSION="v0.39.0"
DOWNLOAD_URL="https://dist.ipfs.tech/kubo/${VERSION}/kubo_${VERSION}_linux-${KUBO_ARCH}.tar.gz"

echo "Downloading Kubo from $DOWNLOAD_URL"
wget -O kubo.tar.gz "$DOWNLOAD_URL"

tar -xvzf kubo.tar.gz
cd kubo

sudo bash install.sh

cd ..
rm -rf kubo kubo.tar.gz

echo "IPFS Installed Successfully"

if [ ! -d "$HOME/.ipfs" ]; then
    ipfs init
fi

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'

echo "CORS Enabled"

SERVICE_FILE="/etc/systemd/system/ipfs.service"

echo "Creating systemd service..."

sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=IPFS Daemon
After=network.target

[Service]
User=$USER
Environment=IPFS_PATH=$HOME/.ipfs
ExecStart=/usr/local/bin/ipfs daemon --enable-gc
Restart=always
LimitNOFILE=1024000

[Install]
WantedBy=multi-user.target
EOL

sudo systemctl daemon-reload
sudo systemctl enable ipfs
sudo systemctl start ipfs

echo "=========================================="
echo "   IPFS is now running as background     "
echo "   Service auto-starts on reboot         "
echo "=========================================="

sleep 3
sudo systemctl status ipfs --no-pager

echo "Setup Complete 🚀"