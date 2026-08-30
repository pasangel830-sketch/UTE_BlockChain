#!/usr/bin/env bash
# Día 1 — paquetes + Docker Engine (correr como root).
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "==> apt update + paquetes"
apt-get update -y
apt-get install -y \
  git curl wget jq make gcc g++ python3 python3-pip \
  unzip zip openssl gnupg ca-certificates \
  apt-transport-https software-properties-common \
  uidmap dbus-user-session

echo "==> Docker Engine (no Desktop)"
if ! command -v docker >/dev/null 2>&1 || ! dpkg -s docker-ce >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

usermod -aG docker engel
systemctl enable docker
systemctl start docker || service docker start

echo "==> docker ok"
docker --version
docker compose version
docker info | head -20
