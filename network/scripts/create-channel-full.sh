#!/usr/bin/env bash
# Compatibilidad: delega en create-channel.sh (perfil UteFull, 5 peers).
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/create-channel.sh" full
