#!/bin/bash
set -euo pipefail
ROOT=/workspace
V0=/tmp/auditor-v0/auditor-3d
V1=/tmp/auditor-v1/auditor-3d
UPLOADS=/home/ubuntu/.cursor/projects/workspace/uploads

cd "$ROOT"
git checkout --orphan rebuild-main 2>/dev/null || true
git rm -rf . 2>/dev/null || true
find "$ROOT" -mindepth 1 -maxdepth 1 ! -name .git ! -name scripts -exec rm -rf {} +

# --- Commit 1: v0 ---
cp -a "$V0"/. "$ROOT/"
git add -A
git commit -m "Prototipo v0: escena TransMilenio con primitivas

WebGL2, tres pasadas, auditoría CPU, simulación reutilizada del Proyecto 1."

# --- Commit 2: v1 ---
rsync -a --exclude='.git' "$V1"/ "$ROOT/"
git add -A
git commit -m "v1: modelos OBJ, lectura propia y escena detallada

Reemplaza cajas por andén, señales, bus y banca generados con generar-modelos.py.
Confusión entre figuras, deselección y marcas por contorno."
