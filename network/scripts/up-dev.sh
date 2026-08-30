#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"
export PATH="${HOME}/bin:${HOME}/hyperledger/fabric-2.5.16/bin:${PATH}"
make up-dev
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
