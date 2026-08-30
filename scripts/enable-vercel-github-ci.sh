#!/usr/bin/env bash
# One-time (repo admin + `gh` with the `workflow` scope + `vercel login`):
#   1. Install GitHub Actions workflows from ci/
#   2. Store VERCEL_TOKEN so those workflows can deploy
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-saurabh4269/bhoonaksha}"
SECRET_NAME="VERCEL_TOKEN"
TOKEN_NAME="github-actions-bhoonaksha"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI: https://cli.github.com/" >&2
  exit 1
fi

gh auth status
if ! gh api "repos/${REPO}" --jq '.permissions.admin' | grep -q true; then
  echo "Need repo admin on ${REPO} to write Actions secrets and workflow files." >&2
  echo "The owner can run this script, or: Settings → Secrets → Actions → ${SECRET_NAME}" >&2
  echo "Native alternative: owner imports ${REPO} in the Vercel dashboard (Git → Deploy)." >&2
  exit 1
fi

mkdir -p "${ROOT}/.github/workflows"
cp -f "${ROOT}/ci/deploy-vercel.yml" "${ROOT}/.github/workflows/deploy-vercel.yml"
cp -f "${ROOT}/ci/sync-upstream.yml" "${ROOT}/.github/workflows/sync-upstream.yml"

if [ -d "${ROOT}/.git" ]; then
  git -C "${ROOT}" add .github/workflows/deploy-vercel.yml .github/workflows/sync-upstream.yml
  if ! git -C "${ROOT}" diff --cached --quiet; then
    git -C "${ROOT}" commit -m "Install Vercel GitHub Actions workflows"
    git -C "${ROOT}" push -u origin HEAD
  fi
fi

if [ -f "${HOME}/.local/share/com.vercel.cli/auth.json" ]; then
  AUTH_TOKEN="$(python3 -c 'import json,os; print(json.load(open(os.path.expanduser("~/.local/share/com.vercel.cli/auth.json"))).get("token",""))')"
else
  AUTH_TOKEN=""
fi

if [ -z "${AUTH_TOKEN}" ]; then
  echo "Run: vercel login" >&2
  exit 1
fi

TOKEN_FILE="$(mktemp)"
cleanup() { rm -f "$TOKEN_FILE"; }
trap cleanup EXIT

echo "Creating Vercel token ${TOKEN_NAME}…"
python3 - "$AUTH_TOKEN" "$TOKEN_NAME" "$TOKEN_FILE" <<'PY'
import json, sys, urllib.request
auth, name, path = sys.argv[1], sys.argv[2], sys.argv[3]
req = urllib.request.Request(
    "https://api.vercel.com/v3/user/tokens",
    data=json.dumps({"name": name}).encode(),
    headers={"Authorization": f"Bearer {auth}", "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as res:
    body = json.load(res)
token = body.get("token") or (body.get("bearerToken") or "")
if not token:
    raise SystemExit("Vercel token API did not return a token: " + json.dumps(body)[:400])
open(path, "w").write(token)
PY

gh secret set "$SECRET_NAME" --repo "$REPO" < "$TOKEN_FILE"
echo "Installed workflows and set ${SECRET_NAME} on ${REPO}."
echo "Pushes to main now deploy to https://bhoonaksha-plot-card.vercel.app"
