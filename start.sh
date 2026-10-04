#!/usr/bin/env bash
# INFLUX - start on macOS / Linux:  ./start.sh   (or: bash start.sh)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org"; exit 1
fi
if [ ! -d backend/node_modules ]; then
  echo "Installing INFLUX for the first time. This takes a minute..."
  npm install --prefix backend || exit 1
fi
( sleep 3; (command -v open >/dev/null && open http://localhost:3000) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) ) >/dev/null 2>&1 &
npm start --prefix backend
