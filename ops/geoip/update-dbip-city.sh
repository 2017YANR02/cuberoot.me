#!/usr/bin/env bash
set -euo pipefail

db_dir=/var/lib/cuberoot-geoip
month="$(date -u +%Y-%m)"
candidate="$db_dir/dbip-city-lite.mmdb.tmp"
database="$db_dir/dbip-city-lite.mmdb"
url="https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz"

install -d -m 0755 "$db_dir"
curl --fail --location --retry 5 --retry-delay 30 "$url" | gzip --decompress --stdout > "$candidate"
mmdblookup --file "$candidate" --ip 8.8.8.8 country iso_code >/dev/null
chmod 0644 "$candidate"
mv -f "$candidate" "$database"
