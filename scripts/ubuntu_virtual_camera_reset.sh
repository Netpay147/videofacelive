#!/usr/bin/env bash
set -euo pipefail

echo "=== VideoFaceLive Ubuntu Host Reset Helper ==="
echo "This removes virtual camera setup packages and unloads v4l2loopback when possible"
echo

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "[ERROR] Run as root (or with sudo)."
  echo "Example: sudo bash scripts/ubuntu_virtual_camera_reset.sh"
  exit 1
fi

if ! command -v apt >/dev/null 2>&1; then
  echo "[ERROR] apt not found. This script is intended for Ubuntu/Debian hosts."
  exit 1
fi

if lsmod | grep -q '^v4l2loopback'; then
  echo "[INFO] Unloading v4l2loopback..."
  modprobe -r v4l2loopback || true
else
  echo "[INFO] v4l2loopback not currently loaded"
fi

echo "[INFO] Removing packages..."
DEBIAN_FRONTEND=noninteractive apt remove -y \
  v4l2loopback-dkms \
  v4l-utils \
  obs-studio || true

echo "[INFO] Removing no-longer-needed dependencies..."
DEBIAN_FRONTEND=noninteractive apt autoremove -y || true

echo
echo "=== Complete ==="
echo "You can re-install later with:"
echo "sudo bash scripts/ubuntu_virtual_camera_install.sh"
