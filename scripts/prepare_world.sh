#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p "$ROOT/.data" "$ROOT/public/world"
PBF="$ROOT/.data/south-fed-district.osm.pbf"
CLIPPED="$ROOT/.data/rostov-center.osm.pbf"
JSON="$ROOT/public/world/center.json"
echo '=== ROSTOV DRIVE | REAL OSM IMPORT ==='
if ! command -v osmium >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then
    echo 'ERROR: Install Homebrew: https://brew.sh/'
    exit 1
  fi
  brew install osmium-tool
fi
if [ ! -x "$ROOT/.venv/bin/python" ]; then
  python3 -m venv "$ROOT/.venv"
fi
"$ROOT/.venv/bin/python" -m pip install --disable-pip-version-check osmium
if [ ! -s "$PBF" ]; then
  echo 'DOWNLOADING=REAL_OSM_300MB'
  curl --fail --location --retry 5 --retry-delay 5 --continue-at - --output "$PBF" 'https://download.geofabrik.de/russia/south-fed-district-latest.osm.pbf'
fi
if [ ! -s "$CLIPPED" ]; then
  echo 'EXTRACT=ROSTOV_CENTER'
  osmium extract --bbox 39.708,47.216,39.735,47.230 --strategy complete_ways --overwrite --output "$CLIPPED" "$PBF"
fi
echo 'CONVERTING=3D_GEOMETRY'
"$ROOT/.venv/bin/python" scripts/import_osm.py --input "$CLIPPED" --output "$JSON"
"$ROOT/.venv/bin/python" - "$JSON" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);d=json.loads(p.read_text())
assert len(d['roads'])>=8 and len(d['buildings'])>=8
print("REAL_ROSTOV=YES")
print("ROADS="+str(len(d['roads'])))
print("BUILDINGS="+str(len(d['buildings'])))
print("SIZE_BYTES="+str(p.stat().st_size))
print("DONE=YES")
PY
