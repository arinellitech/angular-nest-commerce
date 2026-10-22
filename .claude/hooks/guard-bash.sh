#!/usr/bin/env bash
# PreToolUse guard for Bash. Blocks a short list of catastrophic commands even
# in auto / bypass mode (a PreToolUse "deny" always wins). Everything else
# passes through to the normal permission flow. Exit 2 = block, stderr = reason.
set -u

input=$(cat)
cmd=$(printf '%s' "$input" | node -e '
  let s = "";
  process.stdin.on("data", d => s += d);
  process.stdin.on("end", () => {
    try { process.stdout.write(String(JSON.parse(s).tool_input?.command ?? "")); }
    catch { process.stdout.write(""); }
  });
' 2>/dev/null)

[ -z "$cmd" ] && exit 0

deny() { echo "Blocked by .claude/hooks/guard-bash.sh: $1" >&2; exit 2; }

# Destroying the machine or the repo
printf '%s' "$cmd" | grep -Eq '(^|[;&| ])rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*[[:space:]]+)+(/|~|\$HOME|\.\.)([[:space:]]|$)' && deny "recursive rm on /, ~ or .."
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push[[:space:]].*(--force|-f)([[:space:]]|$)' && deny "force push (ask the user explicitly)"
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+clean[[:space:]].*-[a-zA-Z]*x' && deny "git clean -x would delete .env files"

# Secrets: never print or ship them
printf '%s' "$cmd" | grep -Eq '(cat|less|more|head|tail|bat)[[:space:]]+[^|;&]*\.env([[:space:]]|$)' && deny "printing .env files is not allowed; read .env.example instead"
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+add[[:space:]].*\.env([[:space:]]|$)' && deny "never stage .env"

# Production data
printf '%s' "$cmd" | grep -Eq 'drizzle-kit[[:space:]]+(push|drop)|db:reset' && deny "destructive database command (ask the user explicitly)"

exit 0
