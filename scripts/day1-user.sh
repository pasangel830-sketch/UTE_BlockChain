#!/usr/bin/env bash
# Día 1 — instalación Ubuntu (idempotente).
# Parte root: scripts/day1-root.sh
# Parte usuario: este archivo.
set -euo pipefail

export NVM_DIR="${HOME}/.nvm"
FABRIC_HOME="${HOME}/hyperledger/fabric-2.5.16"
FABRIC_VER="2.5.16"
NODE_APP="24.20.0"
NODE_CC="18"

echo "==> nvm"
set +e
if [ ! -s "${NVM_DIR}/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
# shellcheck disable=SC1091
. "${NVM_DIR}/nvm.sh"
set -e

echo "==> Node ${NODE_APP} (API/UI) y ${NODE_CC} (chaincode)"
nvm install "${NODE_APP}"
nvm install "${NODE_CC}"
nvm alias default "${NODE_APP}"
nvm use default
hash -r
node -v
npm -v

echo "==> binarios Fabric ${FABRIC_VER}"
mkdir -p "${FABRIC_HOME}"
if [ ! -x "${FABRIC_HOME}/bin/peer" ]; then
  tmp="$(mktemp -d)"
  curl -fL "https://github.com/hyperledger/fabric/releases/download/v${FABRIC_VER}/hyperledger-fabric-linux-amd64-${FABRIC_VER}.tar.gz" \
    -o "${tmp}/fabric.tgz"
  tar -xzf "${tmp}/fabric.tgz" -C "${FABRIC_HOME}"
  rm -rf "${tmp}"
fi

mkdir -p "${HOME}/bin"
ln -sfn "${FABRIC_HOME}/bin/peer" "${HOME}/bin/peer"
ln -sfn "${FABRIC_HOME}/bin/orderer" "${HOME}/bin/orderer"
ln -sfn "${FABRIC_HOME}/bin/configtxgen" "${HOME}/bin/configtxgen"
ln -sfn "${FABRIC_HOME}/bin/configtxlator" "${HOME}/bin/configtxlator"
ln -sfn "${FABRIC_HOME}/bin/cryptogen" "${HOME}/bin/cryptogen"
ln -sfn "${FABRIC_HOME}/bin/osnadmin" "${HOME}/bin/osnadmin"
ln -sfn "${FABRIC_HOME}/bin/discover" "${HOME}/bin/discover"

# PATH persistente
BASHRC="${HOME}/.bashrc"
touch "${BASHRC}"
if ! grep -q 'hyperledger/fabric-2.5.16/bin' "${BASHRC}"; then
  cat >> "${BASHRC}" <<'EOF'

# TFM UTE Fabric 2.5.16
export PATH="$HOME/bin:$HOME/hyperledger/fabric-2.5.16/bin:$PATH"
export FABRIC_CFG_PATH="$HOME/hyperledger/fabric-2.5.16/config"
EOF
fi

export PATH="${HOME}/bin:${FABRIC_HOME}/bin:${PATH}"
export FABRIC_CFG_PATH="${FABRIC_HOME}/config"

echo "==> versiones Fabric"
peer version
cryptogen version
configtxgen -version

echo "==> gcloud (home, sin sudo)"
if ! command -v gcloud >/dev/null 2>&1; then
  if [ ! -x "${HOME}/google-cloud-sdk/bin/gcloud" ]; then
    tmp="$(mktemp -d)"
    curl -fL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz \
      -o "${tmp}/gcloud.tgz"
    tar -xzf "${tmp}/gcloud.tgz" -C "${HOME}"
    rm -rf "${tmp}"
    "${HOME}/google-cloud-sdk/install.sh" --quiet --usage-reporting false --command-completion true --path-update true
  fi
fi
export PATH="${HOME}/google-cloud-sdk/bin:${PATH}"
gcloud --version | head -3

echo "==> usuario listo"
echo "node $(node -v) | peer $(peer version 2>/dev/null | head -1)"
