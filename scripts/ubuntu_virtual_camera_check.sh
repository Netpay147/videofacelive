#!/usr/bin/env bash
set -euo pipefail

echo "=== VideoFaceLive Ubuntu Host Check ==="
echo "This checks host readiness for: DeepFaceLive -> OBS Virtual Camera -> Zoom"
echo

ok() { echo "[OK] $1"; }
warn() { echo "[WARN] $1"; }
info() { echo "[INFO] $1"; }

if command -v obs >/dev/null 2>&1; then
  ok "OBS Studio found: $(command -v obs)"
else
  warn "OBS Studio not found"
  info "Install with: sudo apt update && sudo apt install -y obs-studio"
fi

if command -v lsmod >/dev/null 2>&1; then
  module_loaded="$(lsmod | grep -c '^v4l2loopback' || true)"
elif [[ -f /proc/modules ]]; then
  module_loaded="$(grep -c '^v4l2loopback' /proc/modules || true)"
else
  module_loaded="0"
fi

if [[ "$module_loaded" -gt 0 ]]; then
  ok "v4l2loopback kernel module is loaded"
else
  warn "v4l2loopback module not loaded"
  info "Install with: sudo apt install -y v4l2loopback-dkms"
  info "Load with: sudo modprobe v4l2loopback devices=1 video_nr=10 card_label=OBSVirtualCam exclusive_caps=1"
fi

if ls /dev/video* >/dev/null 2>&1; then
  info "Detected video devices:"
  ls -1 /dev/video*
else
  warn "No /dev/video* devices detected"
fi

if command -v zoom >/dev/null 2>&1; then
  ok "Zoom launcher found"
else
  warn "Zoom launcher not found in PATH"
  info "Install Zoom from official package if needed"
fi

echo
echo "=== Next Steps (Host GUI) ==="
echo "1) Start DeepFaceLive and confirm swapped preview"
echo "2) Open OBS and capture DeepFaceLive window"
echo "3) Click 'Start Virtual Camera' in OBS"
echo "4) In Zoom/Meet/Teams select 'OBS Virtual Camera'"
echo
echo "Done."
