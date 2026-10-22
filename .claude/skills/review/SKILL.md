---
name: review
description: Review the current uncommitted changes (or a given range) with the reviewer subagent and then fix the blockers. Use before every commit.
argument-hint: "[optional git range, default: working tree]"
context: fork
agent: reviewer
---
Review `$ARGUMENTS` (default: `git diff` of the working tree plus untracked files relevant to the current slice).

Use the checklist in your system prompt. Be concrete: file:line and the one-line fix. Rank blocker / should-fix / nit. End with `READY TO COMMIT` or `NEEDS CHANGES`.
