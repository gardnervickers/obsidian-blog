#!/usr/bin/env sh
set -eu

npm run vault:sync
npx quartz build
git diff --check

if git diff --quiet && git diff --cached --quiet; then
  echo "Nothing changed; the published site is already current."
  exit 0
fi

npx quartz sync --message "Publish Obsidian posts"
