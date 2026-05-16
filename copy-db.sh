#!/bin/bash
# Copy the SQLite DB to a location accessible from Windows (DBeaver, etc.)
# Usage: ./copy-db.sh [output-path]

DB_PATH="data/memory.db"
DEFAULT_OUTPUT="/tmp/memory-view.db"
OUTPUT="${1:-$DEFAULT_OUTPUT}"

if [ ! -f "$DB_PATH" ]; then
  echo "Error: $DB_PATH not found. Run the server first."
  exit 1
fi

cp "$DB_PATH" "$OUTPUT" && echo "DB copied to $OUTPUT"
echo ""
echo "Windows path: $(wslpath -w "$OUTPUT" 2>/dev/null || echo 'N/A (wslpath not available)')"
echo ""
echo "Open this in DBeaver, or use:"
echo "  curl -o memory-view.db http://localhost:3001/api/db/download"
