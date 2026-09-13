#!/usr/bin/env bash
# Compatibilidad: canal producción (*.ute.prod).
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/create-channel.sh" prod
