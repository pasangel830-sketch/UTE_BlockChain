#!/usr/bin/env bash
# Detecta CLI Fabric (prod > full > dev) y exporta DOMAIN, ORDERER, peers.
# Uso: source "$(dirname "$0")/fabric-env.sh"
# Override: FABRIC_MODE=prod|full|dev
# En la VM: ORDERER/MSP se pueden fijar antes de source; no se pisan si ya existen.

_fabric_scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_fabric_root="$(cd "${_fabric_scripts}/../.." && pwd)"

fabric_detect_cli() {
  local names
  names="$(docker ps --format '{{.Names}}' 2>/dev/null || true)"
  if [[ -n "${FABRIC_MODE:-}" ]]; then
    case "${FABRIC_MODE}" in
      prod) CLI=ute-cli-prod; DOMAIN=ute.prod ;;
      full) CLI=ute-cli-full; DOMAIN=ute.local ;;
      dev) CLI=ute-cli-dev; DOMAIN=ute.local ;;
      *) echo "FABRIC_MODE inválido: ${FABRIC_MODE}"; return 1 ;;
    esac
    return 0
  fi
  if echo "${names}" | grep -qx 'ute-cli-prod'; then
    CLI=ute-cli-prod
    DOMAIN=ute.prod
  elif echo "${names}" | grep -qx 'ute-cli-full'; then
    CLI=ute-cli-full
    DOMAIN=ute.local
  elif echo "${names}" | grep -qx 'ute-cli-dev'; then
    CLI=ute-cli-dev
    DOMAIN=ute.local
  else
    echo "no hay CLI Fabric (make up-dev, up-full o up-prod)"
    return 1
  fi
}

fabric_env() {
  fabric_detect_cli || return 1
  ORDERER="${ORDERER:-orderer1.${DOMAIN}:7050}"
  ORDERER_OVERRIDE="${ORDERER_OVERRIDE:-orderer1.${DOMAIN}}"
  ORDERER_CA="${ORDERER_CA:-/organizations/ordererOrganizations/${DOMAIN}/orderers/orderer1.${DOMAIN}/tls/ca.crt}"
  PEER_A="${PEER_A:-peer0.empresaa.${DOMAIN}:7051}"
  PEER_B="${PEER_B:-peer0.empresab.${DOMAIN}:8051}"
  PEER_C="${PEER_C:-peer0.empresac.${DOMAIN}:11051}"
  PEER_D="${PEER_D:-peer0.empresad.${DOMAIN}:12051}"
  PEER_ADMIN="${PEER_ADMIN:-peer0.administracion.${DOMAIN}:9051}"
  DOM_A="${DOM_A:-empresaa.${DOMAIN}}"
  DOM_B="${DOM_B:-empresab.${DOMAIN}}"
  DOM_C="${DOM_C:-empresac.${DOMAIN}}"
  DOM_D="${DOM_D:-empresad.${DOMAIN}}"
  DOM_ADMIN="${DOM_ADMIN:-administracion.${DOMAIN}}"
  export CLI DOMAIN ORDERER ORDERER_OVERRIDE ORDERER_CA
  export PEER_A PEER_B PEER_C PEER_D PEER_ADMIN
  export DOM_A DOM_B DOM_C DOM_D DOM_ADMIN
}

fabric_peer_up() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

: "${_fabric_root}"
