#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): formats the touched file with the project's
# own formatter. Never blocks — formatting failures are reported, not fatal.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

file=$(node -e '
  let s = "";
  process.stdin.on("data", d => s += d);
  process.stdin.on("end", () => {
    try { process.stdout.write(String(JSON.parse(s).tool_input?.file_path ?? "")); }
    catch { process.stdout.write(""); }
  });
' 2>/dev/null)

[ -z "$file" ] || [ ! -f "$file" ] && exit 0
case "$file" in */node_modules/*|*/dist/*|*/.angular/*|*/drizzle/*.sql) exit 0 ;; esac

case "$file" in
  */api/*.ts|*/api/*.mts)
    if [ -x api/node_modules/.bin/prettier ]; then
      (cd api && npx --no-install prettier --write --log-level warn "${file#*api/}") || echo "prettier failed on $file" >&2
    fi
    ;;
  */storefront/*.ts|*/storefront/*.html|*/storefront/*.css|*/storefront/*.mjs)
    if [ -x storefront/node_modules/.bin/prettier ]; then
      (cd storefront && npx --no-install prettier --write --log-level warn "${file#*storefront/}") || echo "prettier failed on $file" >&2
    fi
    case "$file" in
      *.ts|*.html)
        if [ -x storefront/node_modules/.bin/eslint ]; then
          (cd storefront && npx --no-install eslint --fix --no-warn-ignored "${file#*storefront/}" >/dev/null 2>&1) || echo "eslint --fix reported issues in $file" >&2
        fi
        ;;
    esac
    ;;
esac

exit 0
