#!/usr/bin/env bash
set -euo pipefail

LLAMA_CPP_REPO="https://github.com/ggml-org/llama.cpp.git"
BACKEND="auto"
REF="master"
INSTALL_DIR="${HOME}/Apps/llama.cpp"
DRY_RUN="false"
CLEAN_BUILD="false"

usage() {
  cat <<'USAGE'
Usage: scripts/install_llama_cpp.sh [options]

Download, build, and verify llama.cpp for Llama Pack agent hosts.

Options:
  --backend BACKEND       Build backend: auto, cuda, metal, or cpu. Default: auto
  --dir PATH              llama.cpp checkout directory. Default: $HOME/Apps/llama.cpp
  --ref REF               Git tag, branch, or commit to checkout. Default: master
  --clean-build           Remove the existing build directory before building.
  --dry-run               Print the commands and config values without running them.
  -h, --help              Show this help.

Backend selection:
  auto chooses metal on Apple Silicon, cuda when nvcc is available, otherwise cpu.
  cpu explicitly disables higher-priority GPU backends at build time.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)
      BACKEND="$2"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --ref)
      REF="$2"
      shift 2
      ;;
    --clean-build)
      CLEAN_BUILD="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$BACKEND" in
  auto|cuda|metal|cpu) ;;
  *)
    echo "Unsupported backend: $BACKEND" >&2
    echo "Expected one of: auto, cuda, metal, cpu" >&2
    exit 2
    ;;
esac

have_command() {
  command -v "$1" >/dev/null 2>&1
}

detect_backend() {
  local uname_s uname_m
  uname_s="$(uname -s)"
  uname_m="$(uname -m)"
  if [[ "$uname_s" == "Darwin" && "$uname_m" == "arm64" ]]; then
    printf 'metal'
  elif have_command nvcc; then
    printf 'cuda'
  else
    printf 'cpu'
  fi
}

if [[ "$BACKEND" == "auto" ]]; then
  BACKEND="$(detect_backend)"
fi

INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"
BUILD_DIR="$INSTALL_DIR/build"
PYTHON_BIN="$INSTALL_DIR/.venv/bin/python"
LLAMA_SERVER_BIN="$BUILD_DIR/bin/llama-server"
LLAMA_QUANTIZE_BIN="$BUILD_DIR/bin/llama-quantize"
CONVERTER_PATH="$INSTALL_DIR/convert_hf_to_gguf.py"

CMAKE_ARGS=()
case "$BACKEND" in
  cuda)
    CMAKE_ARGS+=("-DGGML_CUDA=ON")
    ;;
  metal)
    CMAKE_ARGS+=("-DGGML_METAL=ON")
    ;;
  cpu)
    CMAKE_ARGS+=("-DGGML_METAL=OFF" "-DGGML_CUDA=OFF")
    ;;
esac

print_config() {
  cat <<EOF

Llama Pack config values:
  llama_server_bin: $LLAMA_SERVER_BIN
  llama_cpp_dir: $INSTALL_DIR
  python_bin: $PYTHON_BIN
EOF
}

print_dry_run() {
  cat <<EOF
Selected backend: $BACKEND
Install directory: $INSTALL_DIR
Git ref: $REF

Commands:
  mkdir -p $(dirname "$INSTALL_DIR")
  git clone $LLAMA_CPP_REPO $INSTALL_DIR
  cd $INSTALL_DIR
  git fetch --tags --prune
  git checkout $REF
  python3 -m venv .venv
  $PYTHON_BIN -m pip install --upgrade pip
  $PYTHON_BIN -m pip install -r requirements.txt
  $PYTHON_BIN -m pip install -r requirements/requirements-convert_hf_to_gguf.txt
  cmake -S . -B build -DCMAKE_BUILD_TYPE=Release ${CMAKE_ARGS[*]}
  cmake --build build --config Release
EOF
  print_config
}

if [[ "$DRY_RUN" == "true" ]]; then
  print_dry_run
  exit 0
fi

require_command() {
  if ! have_command "$1"; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_command git
require_command cmake
require_command python3

if [[ "$BACKEND" == "cuda" ]]; then
  require_command nvcc
fi

mkdir -p "$(dirname "$INSTALL_DIR")"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "Using existing llama.cpp checkout: $INSTALL_DIR"
else
  if [[ -e "$INSTALL_DIR" ]]; then
    echo "Install directory exists but is not a git checkout: $INSTALL_DIR" >&2
    exit 1
  fi
  git clone "$LLAMA_CPP_REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
git fetch --tags --prune
git checkout "$REF"

python3 -m venv .venv
"$PYTHON_BIN" -m pip install --upgrade pip
if [[ -f requirements.txt ]]; then
  "$PYTHON_BIN" -m pip install -r requirements.txt
fi
if [[ -f requirements/requirements-convert_hf_to_gguf.txt ]]; then
  "$PYTHON_BIN" -m pip install -r requirements/requirements-convert_hf_to_gguf.txt
fi

if [[ "$CLEAN_BUILD" == "true" && -d "$BUILD_DIR" ]]; then
  rm -rf "$BUILD_DIR"
fi

cmake -S . -B build -DCMAKE_BUILD_TYPE=Release "${CMAKE_ARGS[@]}"
cmake --build build --config Release

missing=()
for path in "$LLAMA_SERVER_BIN" "$LLAMA_QUANTIZE_BIN" "$CONVERTER_PATH" "$PYTHON_BIN"; do
  if [[ ! -e "$path" ]]; then
    missing+=("$path")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "llama.cpp build completed, but required files are missing:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "Selected backend: $BACKEND"
echo "llama.cpp setup complete."
print_config
