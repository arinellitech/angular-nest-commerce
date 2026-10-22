#!/usr/bin/env bash
# SessionStart hook: prints a short environment status. Stdout is added to
# Claude's context, so keep it brief and factual.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

echo "## Workspace status ($(date '+%Y-%m-%d %H:%M'))"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "- git: $(git branch --show-current 2>/dev/null) @ $(git log -1 --pretty='%h %s' 2>/dev/null); $(git status --porcelain | wc -l | tr -d ' ') changed file(s)"
else
  echo "- git: not initialized (run: git init && git add -A && git commit -m 'chore: starter')"
fi

echo "- node: $(node -v 2>/dev/null || echo 'missing (need >= 22.22.3; 24 LTS recommended)')"
[ -d api/node_modules ] && echo "- api: node_modules installed" || echo "- api: run 'cd api && npm run setup'"
[ -f api/.env ] && echo "- api: .env present" || echo "- api: .env missing (cp api/.env.example api/.env)"
[ -d storefront/node_modules ] && echo "- storefront: node_modules installed" || echo "- storefront: run 'cd storefront && npm install'"
[ -d .claude/skills/angular-developer ] && echo "- angular skills: installed" || echo "- angular skills: not installed (PROMPT 00: npx skills add https://github.com/angular/skills)"

if command -v docker >/dev/null 2>&1; then
  running=$(docker compose ps --status running --format '{{.Service}}' 2>/dev/null | tr '\n' ' ')
  [ -n "$running" ] && echo "- docker: running [$running]" || echo "- docker: no services running (docker compose up -d)"
fi

if [ -f .claude/progress.md ]; then
  echo
  echo "## Progress (from .claude/progress.md)"
  tail -n 15 .claude/progress.md
fi

exit 0
