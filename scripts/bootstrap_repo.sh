#!/usr/bin/env bash
#
# bootstrap_repo.sh — initial git setup for legaltype-web-keyboard.
#
# Run this once, from inside this folder, in your WSL Ubuntu terminal:
#
#     cd "/home/legaltype/legaltype-web-keyboard/LegalType Web Keyboard"
#     bash scripts/bootstrap_repo.sh
#
# Requirements:
#   - git installed
#   - gh (GitHub CLI) installed and authenticated to the getlegaltype org
#       (run `gh auth login` first if needed)
#
set -euo pipefail

REPO_OWNER="getlegaltype"
REPO_NAME="legaltype-web-keyboard"
REMOTE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"

cd "$(dirname "$0")/.."

if [ ! -d .git ]; then
  echo "==> git init"
  git init -b main
fi

echo "==> staging files"
git add .

if git diff --cached --quiet; then
  echo "==> nothing to commit"
else
  echo "==> committing"
  git commit -m "Initial skeleton

- Static HTML/CSS/JS scaffold for the LegalType Web Keyboard.
- US QWERTY layout with a legal AltGr layer (§ ¶ © ® ™ Δ π € £ etc.)
  mirroring the desktop LegalType AutoHotkey app.
- Editor textarea with copy / cut / paste / select-all / clear actions.
- On-screen keyboard responds to physical keypresses and to clicks.
- GitHub Pages deploy workflow at .github/workflows/pages.yml."
fi

# Create the private repo on GitHub if it doesn't exist yet.
if ! gh repo view "${REPO_OWNER}/${REPO_NAME}" >/dev/null 2>&1; then
  echo "==> creating private repo ${REPO_OWNER}/${REPO_NAME}"
  gh repo create "${REPO_OWNER}/${REPO_NAME}" \
    --private \
    --description "Browser-based LegalType keyboard - type legal symbols anywhere." \
    --source . \
    --remote origin \
    --push
else
  echo "==> repo already exists; ensuring remote + pushing"
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "${REMOTE_URL}"
  fi
  git push -u origin main
fi

echo "==> done. https://github.com/${REPO_OWNER}/${REPO_NAME}"
