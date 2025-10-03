#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Stopping old containers..."
docker compose down -v >/dev/null 2>&1 || true

echo "Building and starting..."
docker compose up --build -d

echo "Waiting for backend health..."
for i in {1..50}; do
  if curl -fsS http://localhost:8000/api/health >/dev/null; then
    open_cmd() {
      if command -v xdg-open >/dev/null; then xdg-open "$1"; elif command -v open >/dev/null; then open "$1"; else printf '%s\n' "$1"; fi
    }
    open_cmd "http://localhost:5173"
    open_cmd "http://localhost:8000/api/health"
    echo "Done. Containers are running in the background."
    exit 0
  fi
  sleep 2
done

echo "Backend did not become healthy. Showing logs..."
docker compose logs -f
