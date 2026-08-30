#!/usr/bin/env bash
# Compatibilidad: delega en create-channel.sh (perfil UteFull, peers diarios).
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/create-channel.sh" dev
