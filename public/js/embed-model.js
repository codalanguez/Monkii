/**
 * embed-model.js — first-run bootstrap for the offline retrieval model.
 *
 * Large-attachment search needs a local embedding model. If none is installed,
 * the desktop shell offers to pull the recommended one (once), and we stream the
 * download here so the user can keep working while it lands. In plain browser
 * mode there's no native prompt — retrieval just falls back to dumping until a
 * model is pulled from the model manager.
 */
import { toast, readNdjson } from './util.js';
import { api } from './api.js';

let checked = false;

export async function checkEmbedModel() {
  if (checked) return;
  checked = true;

  let status;
  try { status = await api('/api/embed-status'); } catch { return; }
  if (status.installed) return;                    // already have one — nothing to do
  if (!window.monkii?.embedModelPrompt) return;    // browser mode: stay silent

  const choice = await window.monkii.embedModelPrompt({ recommended: status.recommended, size: status.size });
  if (choice === 'download') await pullEmbedModel(status.recommended);
}

async function pullEmbedModel(name) {
  toast(`Downloading embedding model ${name} — this runs once and continues in the background.`);
  try {
    const res = await fetch('/api/models/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    for await (const o of readNdjson(res)) {
      if (o.error) throw new Error(o.error);
    }
    toast(`${name} ready — large attachments are now searched offline instead of truncated.`);
  } catch (e) {
    toast(`Embedding model download failed: ${e.message}`, true);
  }
}
