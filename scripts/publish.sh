#!/usr/bin/env sh
set -eu

npm run vault:sync
npx quartz build
git diff --check
git add -- content

if git diff --cached --quiet; then
  echo "Nothing changed; the published site is already current."
  exit 0
fi

unexpected_staged="$(git diff --cached --name-only | grep -v '^content/' || true)"
if [ -n "$unexpected_staged" ]; then
  echo "Refusing to include staged files outside content/:"
  echo "$unexpected_staged"
  exit 1
fi

git commit -m "Publish Obsidian posts"
git push origin HEAD:main
