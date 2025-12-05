#!/bin/sh
set -e

# Optional HLS encoding. Default: best-effort async so startup is not blocked.
# Controls:
#   RUN_HLS_ENCODER_ON_START=true   -> launch encoder in background
#   HLS_ENCODER_FORCE=true          -> pass --force to encoder
#   HLS_ENCODER_BLOCKING=true       -> wait for encoder to finish (may delay startup)
#   FileStorage__BasePath=/media    -> where /media/original and /media/hls live (must be mounted)

if [ "${RUN_HLS_ENCODER_ON_START}" = "true" ]; then
  echo "[entrypoint] Running HLS encoder (async unless HLS_ENCODER_BLOCKING=true)..."
  FORCE_FLAG=""
  [ "${HLS_ENCODER_FORCE}" = "true" ] && FORCE_FLAG="--force"

  if [ "${HLS_ENCODER_BLOCKING}" = "true" ]; then
    node src/encode-videos.js ${FORCE_FLAG} || echo "[entrypoint] Encoder failed (continuing)" >&2
  else
    node src/encode-videos.js ${FORCE_FLAG} >/tmp/encode.log 2>&1 &
    echo "[entrypoint] Encoder started in background (logs: /tmp/encode.log)"
  fi
fi

# Start API
exec node src/index.js
