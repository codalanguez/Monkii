---
name: summarize-files
description: Summarize attached project files into a concise brief. Use when the user asks for an overview, summary, or "what is this project/document about".
---

# Summarize Files

When this skill is invoked, produce a structured summary of the attached project knowledge:

1. **One-line gist** — what this project/document is, in a single sentence.
2. **Key points** — 3 to 7 bullets covering the most important content.
3. **Structure** — if multiple files are attached, list each file path with a one-line description.
4. **Open questions** — anything ambiguous, missing, or worth clarifying.

Rules:
- Ground every claim in the attached files; cite file paths inline like `(src/app.js)`.
- If no files are attached, say so and ask the user to attach some via the project's Knowledge panel.
- Keep the whole summary under 300 words unless the user asks for more depth.
