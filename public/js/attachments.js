/**
 * attachments.js — project knowledge panel and the file-browser modal.
 *
 * Renders the list of attached files/folders in the inspector, handles
 * attach/detach calls, and drives the modal directory browser (navigate,
 * drill into folders, attach a file or the whole current folder).
 */
import { $, esc, toast } from './util.js';
import { api } from './api.js';
import { state } from './state.js';

export function renderAttachments() {
  const ul = $('#attachment-list');
  const atts = state.project.attachments;
  if (!atts.length) {
    ul.innerHTML = '<li class="empty">Nothing attached. Knowledge is re-read from disk on every message, so edits show up automatically.</li>';
    return;
  }
  ul.innerHTML = atts.map(a => `
    <li>
      <span class="att-icon">${a.type === 'dir' ? '▣' : '▤'}</span>
      <span class="att-path" title="${esc(a.path)}">${esc(a.path)}</span>
      <button data-att="${a.id}" title="Detach">×</button>
    </li>`).join('');
  ul.querySelectorAll('[data-att]').forEach(b =>
    b.addEventListener('click', async () => {
      state.project = await api(`/api/projects/${state.project.id}/attachments/${b.dataset.att}`, { method: 'DELETE' });
      renderAttachments();
    }));
}

export async function attachPath(p) {
  try {
    state.project = await api(`/api/projects/${state.project.id}/attachments`, { method: 'POST', body: { path: p } });
    renderAttachments();
    toast(`Attached: ${p}`);
  } catch (e) { toast(e.message, true); }
}

/* ---- file browser modal ---- */

export async function openBrowser(dir) {
  $('#modal-backdrop').hidden = false;
  await browseTo(dir || state.fbDir || undefined);
}

export async function browseTo(dir) {
  try {
    const data = await api('/api/fs' + (dir ? `?dir=${encodeURIComponent(dir)}` : ''));
    state.fbDir = data.dir;
    $('#fb-path').textContent = data.dir === '__drives__' ? 'This PC' : data.dir;
    $('#btn-attach-dir').style.visibility = data.dir === '__drives__' ? 'hidden' : 'visible';
    const up = data.dir !== '__drives__' && data.parent !== data.dir
      ? `<li data-dir="${esc(data.parent)}"><span class="fb-icon">↰</span><span>..</span></li>` : '';
    $('#fb-entries').innerHTML = up + data.entries.map(e => e.isDir
      ? `<li data-dir="${esc(e.path)}"><span class="fb-icon">▣</span><span>${esc(e.name)}</span><button class="fb-attach" data-attach="${esc(e.path)}">attach</button></li>`
      : `<li class="fb-file" data-file="${esc(e.path)}"><span class="fb-icon">▤</span><span>${esc(e.name)}</span><button class="fb-attach" data-attach="${esc(e.path)}">attach</button></li>`
    ).join('');
    $('#fb-entries').querySelectorAll('li[data-dir]').forEach(li =>
      li.addEventListener('click', (e) => { if (!e.target.dataset.attach) browseTo(li.dataset.dir); }));
    $('#fb-entries').querySelectorAll('li[data-file]').forEach(li =>
      li.addEventListener('click', (e) => { if (!e.target.dataset.attach) { attachPath(li.dataset.file); closeBrowser(); } }));
    $('#fb-entries').querySelectorAll('[data-attach]').forEach(b =>
      b.addEventListener('click', () => { attachPath(b.dataset.attach); closeBrowser(); }));
  } catch (e) { toast(e.message, true); }
}

export function closeBrowser() { $('#modal-backdrop').hidden = true; }
