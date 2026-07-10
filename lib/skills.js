/**
 * skills.js — Claude-style skill discovery and loading.
 *
 * A skill is a folder inside the skills directory containing a SKILL.md with
 * YAML frontmatter (name, description) followed by markdown instructions —
 * the same format Claude Code uses, so existing skills work unmodified.
 * This module scans that directory, parses frontmatter (a deliberately tiny
 * parser: key/value pairs with folded multiline values), and returns skill
 * bodies for injection into the system prompt.
 */
const fs = require('fs');
const path = require('path');
const { SKILLS_DIR } = require('./config');

fs.mkdirSync(SKILLS_DIR, { recursive: true });

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  let curKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (kv) { curKey = kv[1]; meta[curKey] = kv[2].trim(); }
    else if (curKey && /^\s+\S/.test(line)) meta[curKey] += ' ' + line.trim(); // folded multiline
  }
  return { meta, body: m[2] };
}

function scanSkills() {
  const skills = [];
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    try {
      const raw = fs.readFileSync(skillFile, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      skills.push({
        id: entry.name,
        name: meta.name || entry.name,
        description: meta.description || '',
        size: body.length,
      });
    } catch { /* skip unreadable skill */ }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function skillBody(sid) {
  if (/[\\/]|\.\./.test(sid)) throw new Error('bad skill id');
  const raw = fs.readFileSync(path.join(SKILLS_DIR, sid, 'SKILL.md'), 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  return { meta, body };
}

module.exports = { parseFrontmatter, scanSkills, skillBody };
