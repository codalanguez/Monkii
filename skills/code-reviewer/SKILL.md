---
name: code-reviewer
description: Review attached code for bugs, security issues, and simplification opportunities. Use when the user asks to review, audit, or improve code in the attached files.
---

# Code Reviewer

When invoked, review the code in the attached project knowledge:

1. **Correctness bugs** — logic errors, unhandled edge cases, race conditions. For each: file path, the problem, a concrete failure scenario, and a suggested fix.
2. **Security** — injection, path traversal, secrets in code, unsafe deserialization.
3. **Simplification** — duplicated logic, dead code, over-engineering.

Format each finding as:

- `path/to/file.js` — **severity (high/med/low)** — one-line summary
  - Why it's a problem and how to fix it.

Rank findings by severity. If the code looks solid, say so briefly — do not invent findings to seem useful. Only report issues you can point to in the actual attached code.
