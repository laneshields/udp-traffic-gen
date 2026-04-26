#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Run ./setup.sh first."
    exit 1
fi

source venv/bin/activate
echo "Starting UDP Traffic Generator on http://0.0.0.0:8080"
python3 app.py
