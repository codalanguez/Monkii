/**
 * filepreview.js — read-only preview of a file on disk.
 *
 * Opened from the file browser (click a file's name) or right after "Save
 * as file…" finishes. Fetches a bounded, server-sniffed read (see
 * routes/fs.js — binary content is refused server-side and never reaches
 * this module) and renders markdown through the same renderer as chat
 * replies, everything else as escaped monospace text.
 */
import { $, esc, fmtBytes, toast, copyText } from './util.js';
import { api } from './api.js';
import { md } from './markdown.js';
import { initModal } from './modal.js';

const MARKDOWN_EXT = new Set(['.md', '.markdown']);

let modal;

export function initFilePreview() {
  modal = initModal('#preview-backdrop', '#btn-close-preview');
  $('#btn-preview-copy-path').addEventListener('click', () => {
    copyText($('#preview-path').textContent);
    toast('Path copied');
  });
}

export async function openPreview(filePath) {
  if (!modal) return; // defensive: init order
  $('#preview-title').textContent = filePath.split(/[\\/]/).pop();
  $('#preview-path').textContent = filePath;
  $('#preview-body').innerHTML = '<p class="preview-status">Loading…</p>';
  modal.open();

  let data;
  try { data = await api(`/api/fs/read?path=${encodeURIComponent(filePath)}`); }
  catch (e) { $('#preview-body').innerHTML = `<p class="preview-status">${esc(e.message)}</p>`; return; }

  if (data.isBinary) {
    $('#preview-body').innerHTML =
      `<p class="preview-status">Can't preview this file — it doesn't look like text (${esc(fmtBytes(data.size))}).</p>`;
    return;
  }

  const isMd = MARKDOWN_EXT.has(data.ext);
  $('#preview-body').innerHTML = isMd
    ? `<div class="preview-md">${md(data.content)}</div>`
    : `<pre class="preview-text">${esc(data.content)}</pre>`;
  if (data.truncated) {
    $('#preview-body').insertAdjacentHTML('beforeend',
      `<p class="preview-note">This file is larger than the preview limit — showing the beginning only. (${esc(fmtBytes(data.size))} total)</p>`);
  }
}
