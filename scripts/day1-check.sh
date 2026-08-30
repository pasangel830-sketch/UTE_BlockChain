#!/usr/bin/env bash
set -euo pipefail
echo "USER=$(whoami)"
echo "HOME=$HOME"
echo "PWD=$(pwd)"
echo "--- os-release ---"
head -5 /etc/os-release
echo "--- wsl.conf ---"
if [ -f /etc/wsl.conf ]; then cat /etc/wsl.conf; else echo "NO_WSL_CONF"; fi
echo "--- systemd ---"
systemctl is-system-running 2>/dev/null || true
echo "--- docker ---"
command -v docker || echo "NO_DOCKER"
docker --version 2>/dev/null || true
docker compose version 2>/dev/null || true
echo "--- groups ---"
id
echo "--- packages ---"
for p in git curl wget jq make gcc g++ python3 unzip zip openssl gnupg ca-certificates; do
  if dpkg -s "$p" >/dev/null 2>&1; then echo "OK $p"; else echo "MISSING $p"; fi
done
echo "--- gcloud ---"
command -v gcloud || echo "NO_GCLOUD"
echo "--- nvm ---"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm ls || true
  echo "NODE=$(node -v 2>/dev/null || echo none)"
else
  echo "NO_NVM"
fi
echo "--- fabric bins ---"
command -v peer || true
command -v cryptogen || true
command -v configtxgen || true
ls -1 "$HOME/fabric-samples/bin" 2>/dev/null | head || echo "NO_FABRIC_SAMPLES_BIN"
echo "--- done ---"
