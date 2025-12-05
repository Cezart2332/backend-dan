#!/bin/sh
set -e

# Optional pre-start HLS encoding
# Controls:
#   RUN_HLS_ENCODER_ON_START=true  -> run encoder before API
#   HLS_ENCODER_FORCE=true         -> pass --force to encoder
#   FileStorage__BasePath=/media   -> where /media/original and /media/hls live (must be mounted)

if [ "${RUN_HLS_ENCODER_ON_START}" = "true" ]; then
  echo "[entrypoint] Running HLS encoder before start..."
  FORCE_FLAG=""
  if [ "${HLS_ENCODER_FORCE}" = "true" ]; then
    FORCE_FLAG="--force"
  fi
  node src/encode-videos.js ${FORCE_FLAG} || {
    echo "[entrypoint] Encoder failed" >&2
    exit 1
  }
fi

# Start API
exec node src/index.js
