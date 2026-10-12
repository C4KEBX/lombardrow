#!/bin/sh
# Installs whisper.cpp and its English base model for `npm run listen-back`. Free and local.
set -e
if ! command -v whisper-cli >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install whisper-cpp
  else
    echo "Install whisper.cpp (https://github.com/ggml-org/whisper.cpp) and put whisper-cli on PATH, or set WHISPER_CPP_BIN." >&2
    exit 1
  fi
fi
mkdir -p models
if [ ! -f models/ggml-base.en.bin ]; then
  curl -L --fail -o models/ggml-base.en.bin.part https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
  mv models/ggml-base.en.bin.part models/ggml-base.en.bin
fi
echo "whisper.cpp ready: $(command -v whisper-cli), models/ggml-base.en.bin"
