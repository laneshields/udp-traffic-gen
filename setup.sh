#!/bin/bash
set -e

echo "=== UDP Traffic Generator Setup ==="

# Detect OS family from /etc/os-release
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID,,}"
    OS_ID_LIKE="${ID_LIKE,,}"
else
    echo "ERROR: Cannot detect OS — /etc/os-release not found." >&2
    exit 1
fi

is_rhel_family() {
    case "$OS_ID" in
        rhel|centos|almalinux|rocky|ol|fedora) return 0 ;;
    esac
    case "$OS_ID_LIKE" in
        *rhel*|*centos*|*fedora*) return 0 ;;
    esac
    return 1
}

is_debian_family() {
    case "$OS_ID" in
        ubuntu|debian) return 0 ;;
    esac
    case "$OS_ID_LIKE" in
        *debian*|*ubuntu*) return 0 ;;
    esac
    return 1
}

echo "Detected OS: ${PRETTY_NAME:-$OS_ID}"
echo ""

if is_rhel_family; then
    PKG_MGR="dnf"
    command -v dnf &>/dev/null || PKG_MGR="yum"
    echo "Using $PKG_MGR (RHEL/AlmaLinux/Oracle Linux family)"
    sudo "$PKG_MGR" install -y python3 python3-pip
elif is_debian_family; then
    echo "Using apt-get (Debian/Ubuntu family)"
    sudo apt-get update -q
    sudo apt-get install -y python3-pip python3-venv
else
    echo "ERROR: Unsupported OS '${PRETTY_NAME:-$OS_ID}'. Expected RHEL/AlmaLinux/Oracle or Ubuntu/Debian." >&2
    exit 1
fi

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
