#!/usr/bin/env bash
# Fast-forward shiwani42/bhoonaksha from this repo (triggers the Vercel Git deploy).
set -euo pipefail
gh api -X POST repos/shiwani42/bhoonaksha/merge-upstream -f branch=main
echo "Fork updated. Vercel will build https://bhoonaksha-plot-card.vercel.app"
