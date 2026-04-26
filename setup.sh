#!/bin/bash
set -e

echo "=== UDP Traffic Generator Setup ==="
echo "Target: Ubuntu 20.04"
echo ""

# Install system packages
sudo apt-get update -q
sudo apt-get install -y python3-pip python3-venv

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo ""
echo "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Edit config.yaml with your destination IPs and ports"
echo "  2. Run ./run.sh to start the server"
echo "  3. Open http://<server-ip>:8080 in a browser"
