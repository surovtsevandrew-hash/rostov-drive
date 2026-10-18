#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p "$ROOT/.data" "$ROOT/public/world"
PBF="$ROOT/.data/south-fed-district.osm.pbf"
CLIPPED="$ROOT/.data/rostov-expanded-v2.osm.pbf"
JSON="$ROOT/public/world/center.json"
echo '=== ROSTOV DRIVE | EXPANDED CITY + DON ==='
if ! command -v osmium >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then
    echo 'ERROR=HOMEBREW_REQUIRED'
    exit 1
  fi
  brew install osmium-tool
fi
if [ ! -x "$ROOT/.venv/bin/python" ]; then
  python3 -m venv "$ROOT/.venv"
fi
"$ROOT/.venv/bin/python" -m pip install --disable-pip-version-check osmium Pillow
if [ ! -s "$PBF" ]; then
  echo 'DOWNLOADING=GEOfABRIK_PBF'
  curl --fail --location --retry 5 --retry-delay 5 --continue-at - --output "$PBF" 'https://download.geofabrik.de/russia/south-fed-district-latest.osm.pbf'
else
  echo 'USING_CACHED_PBF=YES'
fi
if [ ! -s "$CLIPPED" ]; then
  echo 'EXTRACT=ROSTOV_TRIPLE_AREA'
  osmium extract --bbox 39.699,47.207,39.746,47.231 --strategy complete_ways --overwrite --output "$CLIPPED" "$PBF"
fi
echo 'PREPARING=REAL_TERRARIUM_ELEVATION'
"$ROOT/.venv/bin/python" scripts/prepare_terrain.py --cache "$ROOT/.data/terrarium" --output "$ROOT/public/world/terrain.json"
echo 'CONVERTING=ROADS_BUILDINGS_RIVER_FRONT_PARKS'
"$ROOT/.venv/bin/python" scripts/import_osm.py --input "$CLIPPED" --output "$JSON"
"$ROOT/.venv/bin/python" - "$JSON" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1])
d=json.loads(p.read_text())
assert len(d['roads'])>250, "ROADS_EXPANSION_NOT_VERIFIED"
assert len(d['buildings'])>420, "BUILDING_EXPANSION_NOT_VERIFIED"
assert len(d['area_bounds'])==4
print("AREA_BOUNDS="+str(d['area_bounds']))
print("REAL_ROSTOV=YES")
print("DONE=YES")
PY
