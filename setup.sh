#!/bin/bash
set -e

echo "=== TravelAgent AI — Backend Setup ==="

# 1. Create virtual environment
python3 -m venv .venv
echo "✓ Virtual environment created (.venv)"

# 2. Activate and install
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r backend/requirements.txt -q
echo "✓ Dependencies installed"

# 3. Copy .env template if no .env exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ .env created from template — fill in your API keys!"
else
  echo "  .env already exists, skipping"
fi

echo ""
echo "=== Done! Next steps ==="
echo "  1. Edit .env and add your API keys"
echo "  2. source .venv/bin/activate"
echo "  3. cd backend && uvicorn main:app --reload"
