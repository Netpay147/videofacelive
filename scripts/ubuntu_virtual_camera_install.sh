#!/usr/bin/env bash
set -euo pipefail

echo "=== VideoFaceLive Ubuntu Host Install Helper ==="
echo "Installs OBS Studio + v4l2loopback prerequisites for virtual camera workflow"
echo

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "[ERROR] Run as root (or with sudo)."
  echo "Example: sudo bash scripts/ubuntu_virtual_camera_install.sh"
  exit 1
fi

if ! command -v apt >/dev/null 2>&1; then
  echo "[ERROR] apt not found. This script is intended for Ubuntu/Debian hosts."
  exit 1
fi

echo "[INFO] Updating apt package index..."
apt update

echo "[INFO] Installing OBS Studio and virtual camera kernel module package..."
DEBIAN_FRONTEND=noninteractive apt install -y \
  obs-studio \
  v4l2loopback-dkms \
  v4l-utils

echo "[INFO] Attempting to load v4l2loopback module..."
if modprobe v4l2loopback devices=1 video_nr=10 card_label=OBSVirtualCam exclusive_caps=1; then
  echo "[OK] v4l2loopback loaded"
else
  echo "[WARN] Could not load v4l2loopback automatically (may require reboot)"
fi

echo
echo "=== Complete ==="
echo "Next steps:"
echo "1) Run host check: bash scripts/ubuntu_virtual_camera_check.sh"
echo "2) Start DeepFaceLive, then OBS"
echo "3) Click Start Virtual Camera in OBS"
echo "4) Select OBS Virtual Camera in Zoom/Meet/Teams"
