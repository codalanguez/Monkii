/**
 * retrieval.js — on-device semantic retrieval over large attachments.
 *
 * A big attachment (a whole manuscript, a codebase) is chunked, embedded once
 * with a local Ollama embedding model, and the vectors are cached on disk keyed
 * by the file's path + size + mtime. At query time we embed just the question
 * and return the handful of passages most similar to it — so the prompt carries
 * the relevant parts instead of the entire file. Everything runs offline.
 *
 * Design notes:
 *  - One index file per source path; a size/mtime/model change rebuilds it, so
 *    the cache is self-invalidating and never grows an entry per edit.
 *  - Failure is never fatal: if no embed model is installed or embedding errors,
 *    the caller falls back to dumping the file as before.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  EMBED_MODEL, EMBED_MODEL_DEFAULT, EMBED_MODEL_SIZE, EMBED_DIR,
  CHUNK_CHARS, CHUNK_OVERLAP, MAX_CHUNKS, RETRIEVAL_TOPK,
} = require('./config');
const ollama = require('./ollama');
const { logError } = require('./log');

const EMBED_BATCH = 48;             // chunks per /api/embed request
const KNOWN_EMBED = ['nomic-embed-text', 'mxbai-embed', 'all-minilm', 'bge-', 'snowflake-arctic-embed', 'gte-', 'embed'];

let embedModelCache = { at: 0, name: null };

/** Auto-pick an installed embedding model (or honor MONKII_EMBED_MODEL). */
async function pickEmbedModel() {
  if (EMBED_MODEL) return EMBED_MODEL;
  if (Date.now() - embedModelCache.at < 60000) return embedModelCache.name;
  let name = null;
  try {
    const names = (await ollama.listModels()).map(m => m.name);
    name = names.find(n => KNOWN_EMBED.some(k => n.toLowerCase().includes(k))) || null;
  } catch { /* Ollama unreachable — leave null, caller dumps instead */ }
  embedModelCache = { at: Date.now(), name };
  return name;
}

/** Is an embedding model actually installed? Returns { installed, name, recommended }. */
async function embedStatus() {
  let names = [];
  try { names = (await ollama.listModels()).map(m => m.name); } catch { /* Ollama down */ }
  const norm = (n) => n.toLowerCase().replace(/:latest$/, '');
  let name = null;
  if (EMBED_MODEL) name = names.find(n => norm(n) === norm(EMBED_MODEL)) || null;
  if (!name) name = names.find(n => KNOWN_EMBED.some(k => n.toLowerCase().includes(k))) || null;
  return { installed: !!name, name, recommended: EMBED_MODEL_DEFAULT, size: EMBED_MODEL_SIZE };
}

/* nomic-style embedding models want task prefixes; harmless to skip elsewhere. */
const isNomic = (model) => /nomic/i.test(model);
const asDoc = (model, t) => (isNomic(model) ? `search_document: ${t}` : t);
const asQuery = (model, t) => (isNomic(model) ? `search_query: ${t}` : t);

/** Split text into overlapping chunks, preferring paragraph boundaries. */
function chunkText(text) {
  const chunks = [];
  const n = text.length;
  let i = 0;
  while (i < n && chunks.length < MAX_CHUNKS) {
    let end = Math.min(i + CHUNK_CHARS, n);
    if (end < n) {
      // back up to the nearest paragraph/line/sentence break for a cleaner cut
      const slice = text.slice(i, end);
      const brk = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
      if (brk > CHUNK_CHARS * 0.5) end = i + brk + 1;
    }
    const piece = text.slice(i, end).trim();
    if (piece) chunks.push({ text: piece, offset: i });
    if (end >= n) break;
    i = Math.max(end - CHUNK_OVERLAP, i + 1);
  }
  return chunks;
}

function ensureDir() {
  try { fs.mkdirSync(EMBED_DIR, { recursive: true }); } catch { /* best effort */ }
}
const indexFile = (key) => path.join(EMBED_DIR, crypto.createHash('sha1').update(key).digest('hex') + '.json');

/** Embed an array of texts in batches; returns number[][] aligned to input. */
async function embedAll(model, texts, signal) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const vs = await ollama.embed(model, batch, { signal });
    if (vs.length !== batch.length) throw new Error('embed count mismatch');
    vectors.push(...vs);
  }
  return vectors;
}

/** Return a valid cached index for `file`, or null if missing/stale. */
function tryLoadIndex(file, statSig, model) {
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (c.mtimeMs === statSig.mtimeMs && c.size === statSig.size && c.model === model
        && Array.isArray(c.vectors) && c.vectors.length === c.chunks.length) {
      return { chunks: c.chunks, vectors: c.vectors };
    }
  } catch { /* missing or stale */ }
  return null;
}

const inFlight = new Map(); // index file path -> Promise (dedup concurrent builds)

/**
 * Load a cached index for `key` (its source path), or build and persist one. The
 * index rebuilds only when the file's size/mtime or the embed model changed, and
 * concurrent requests for the same uncached file share one build (so opening a
 * chat and immediately sending don't embed the same manuscript twice).
 * Returns { chunks: [{text, offset}], vectors: number[][] }.
 */
async function loadOrBuildIndex(key, text, statSig, model, signal) {
  const file = indexFile(key);
  const cached = tryLoadIndex(file, statSig, model);
  if (cached) return cached;
  if (inFlight.has(file)) return inFlight.get(file);

  const build = (async () => {
    const chunks = chunkText(text);
    if (!chunks.length) return { chunks: [], vectors: [] };
    const vectors = await embedAll(model, chunks.map(c => asDoc(model, c.text)), signal);
    ensureDir();
    try {
      fs.writeFileSync(file, JSON.stringify({ key, model, mtimeMs: statSig.mtimeMs, size: statSig.size, chunks, vectors }));
    } catch (e) { logError('retrieval: write index', e); }
    return { chunks, vectors };
  })();

  inFlight.set(file, build);
  try { return await build; } finally { inFlight.delete(file); }
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

const readingOrder = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.chunk.offset - b.chunk.offset);

/**
 * Return the passages from `items` most relevant to `query`, greedily filling a
 * character budget. With an empty query (used by the pre-send size estimate) it
 * samples in reading order instead of ranking — the injected SIZE is the same,
 * which is all the estimate needs.
 *
 *   items: [{ path, text, statSig:{mtimeMs,size} }]
 * Returns { passages: [{ path, text }], scanned }, passages in reading order.
 * Throws only on total embed failure; callers treat a throw as "fall back to dump".
 */
async function retrieve(query, items, model, { budget, topk = RETRIEVAL_TOPK, signal } = {}) {
  const scored = [];
  let scanned = 0;
  for (const it of items) {
    const idx = await loadOrBuildIndex(it.path, it.text, it.statSig, model, signal);
    if (!idx || !idx.chunks.length) continue;
    scanned += idx.chunks.length;
    for (let i = 0; i < idx.chunks.length; i++) {
      scored.push({ path: it.path, chunk: idx.chunks[i], vec: idx.vectors[i] });
    }
  }
  if (!scored.length) return { passages: [], scanned };

  if (query && query.trim()) {
    const [qvec] = await ollama.embed(model, [asQuery(model, query)], { signal });
    if (!qvec) throw new Error('query embedding failed');
    for (const s of scored) s.score = cosine(qvec, s.vec);
    scored.sort((a, b) => b.score - a.score);
  } else {
    scored.sort(readingOrder); // no query: sample the opening passages for sizing
  }

  const chosen = [];
  let used = 0;
  for (const s of scored) {
    if (chosen.length >= topk || used >= budget) break;
    chosen.push(s);
    used += s.chunk.text.length;
  }
  chosen.sort(readingOrder); // present grouped by file, in position order
  return { passages: chosen.map(s => ({ path: s.path, text: s.chunk.text })), scanned };
}

module.exports = { pickEmbedModel, embedStatus, retrieve, chunkText };
