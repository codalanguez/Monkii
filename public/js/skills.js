/**
 * skills.js — skill catalog and both ways of activating skills.
 *
 * Loads the skill list from the server and renders:
 *   - the always-on toggles in the project inspector (persisted per project)
 *   - the "/" slash-command popup in the composer, which invokes a skill for
 *     the next message only, shown as removable chips above the input.
 */
import { $, esc } from './util.js';
import { api } from './api.js';
import { state } from './state.js';

export async function loadSkills() {
  try {
    const { dir, skills } = await api('/api/skills');
    state.skills = skills;
    $('#skills-dir-hint').textContent = `drop SKILL.md folders into ${dir}`;
  } catch { state.skills = []; }
}

export function skillNames(ids) {
  return (ids || []).map(sid => {
    const s = state.skills.find(x => x.id === sid);
    return s ? s.name : sid;
  });
}

/* ---- project inspector toggles ---- */

export function renderSkillToggles() {
  const ul = $('#skill-list');
  if (!state.skills.length) {
    ul.innerHTML = '<li class="empty">No skills found yet — each skill is a folder containing a SKILL.md with name/description frontmatter.</li>';
    return;
  }
  const enabled = new Set(state.project.skills || []);
  ul.innerHTML = state.skills.map(s => `
    <li data-skill="${esc(s.id)}" class="${enabled.has(s.id) ? 'on' : ''}" title="Always load this skill in this project">
      <div class="tgl"></div>
      <div>
        <div class="tl-name">${esc(s.name)}</div>
        <div class="tl-desc">${esc(s.description)}</div>
      </div>
    </li>`).join('');
  ul.querySelectorAll('li[data-skill]').forEach(li => {
    li.addEventListener('click', async () => {
      const sid = li.dataset.skill;
      const set = new Set(state.project.skills || []);
      set.has(sid) ? set.delete(sid) : set.add(sid);
      state.project.skills = [...set];
      li.classList.toggle('on');
      await api(`/api/projects/${state.project.id}`, { method: 'PUT', body: { skills: state.project.skills } });
    });
  });
}

/* ---- "/" invocation popup + chips ---- */

export function updateSkillPopup() {
  const input = $('#input');
  const pop = $('#skill-popup');
  const m = input.value.match(/(?:^|\s)\/([\w-]*)$/);
  if (!m || !state.skills.length) { pop.hidden = true; return; }
  const q = m[1].toLowerCase();
  const matches = state.skills.filter(s =>
    s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { pop.hidden = true; return; }
  pop.innerHTML = matches.map((s, i) => `
    <div class="sp-item ${i === 0 ? 'selected' : ''}" data-skill="${esc(s.id)}">
      <div class="sp-name">/${esc(s.id)}</div>
      <div class="sp-desc">${esc(s.description)}</div>
    </div>`).join('');
  pop.hidden = false;
  pop.querySelectorAll('.sp-item').forEach(item => {
    item.addEventListener('mousedown', (e) => { e.preventDefault(); pickSkill(item.dataset.skill); });
  });
}

export function pickSkill(sid) {
  const input = $('#input');
  input.value = input.value.replace(/(^|\s)\/[\w-]*$/, '$1');
  if (!state.invokedSkills.includes(sid)) state.invokedSkills.push(sid);
  renderSkillChips();
  $('#skill-popup').hidden = true;
  input.focus();
}

export function renderSkillChips() {
  $('#active-skill-chips').innerHTML = state.invokedSkills.map(sid => `
    <span class="skill-chip">/${esc(sid)}
      <button data-remove="${esc(sid)}" title="Remove">×</button>
    </span>`).join('');
  document.querySelectorAll('#active-skill-chips [data-remove]').forEach(b =>
    b.addEventListener('click', () => {
      state.invokedSkills = state.invokedSkills.filter(s => s !== b.dataset.remove);
      renderSkillChips();
    }));
}
