/**
 * routes/search.js — search across every project's names, chats, and messages.
 *
 * Single-user, local scale: rather than maintain a search index, every
 * search just loads all project files via lib/store's listProjects() — the
 * same cost the projects list page already pays — and does a plain
 * case-insensitive substring match. Simple, predictable, and correct; no
 * fuzzy-matching surprises to explain.
 */
const express = require('express');
const { listProjects } = require('../lib/store');

const router = express.Router();

const MAX_RESULTS = 60;
const SNIPPET_RADIUS = 50; // chars of context kept on each side of a match

/** A short, match-centered excerpt with … markers where it was trimmed. */
function snippet(text, at, len) {
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + len + SNIPPET_RADIUS);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
}

router.get('/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json({ results: [] }); // avoid a flood of noise on one character
  const needle = q.toLowerCase();
  const results = [];

  outer:
  for (const p of listProjects()) {
    if (p.name.toLowerCase().includes(needle)) {
      results.push({ type: 'project', projectId: p.id, projectName: p.name });
      if (results.length >= MAX_RESULTS) break outer;
    }
    for (const c of p.chats || []) {
      if (c.title.toLowerCase().includes(needle)) {
        results.push({ type: 'chat', projectId: p.id, projectName: p.name, chatId: c.id, chatTitle: c.title });
        if (results.length >= MAX_RESULTS) break outer;
      }
      for (let idx = 0; idx < c.messages.length; idx++) {
        const m = c.messages[idx];
        const lower = m.content.toLowerCase();
        const at = lower.indexOf(needle);
        if (at === -1) continue;
        results.push({
          type: 'message', projectId: p.id, projectName: p.name, chatId: c.id, chatTitle: c.title,
          messageIdx: idx, role: m.role, snippet: snippet(m.content, at, needle.length),
        });
        if (results.length >= MAX_RESULTS) break outer;
      }
    }
  }
  res.json({ results });
});

module.exports = router;
