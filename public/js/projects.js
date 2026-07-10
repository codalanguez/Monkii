/**
 * projects.js — project lifecycle and the inspector panel.
 *
 * Handles the sidebar project list, create/open/delete, and the inspector
 * (name, instructions, skill toggles, knowledge list). Opening a project
 * loads its full JSON, refreshes every dependent panel, and lands the user
 * in its most recent chat (or a fresh one).
 */
import { $, esc } from './util.js';
import { api } from './api.js';
import { state } from './state.js';
import { renderSkillToggles, renderSkillChips } from './skills.js';
import { renderAttachments } from './attachments.js';
import { renderChatList, openChat, newChat } from './chat.js';

export async function refreshProjects() {
  state.projects = await api('/api/projects');
  const ul = $('#project-list');
  ul.innerHTML = state.projects.map(p => `
    <li data-id="${p.id}" class="${state.project && state.project.id === p.id ? 'active' : ''}">
      <span>${esc(p.name)}</span>
      <span class="meta">${p.chatCount}</span>
    </li>`).join('');
  ul.querySelectorAll('li').forEach(li =>
    li.addEventListener('click', () => openProject(li.dataset.id)));
}

export async function createProject() {
  const p = await api('/api/projects', { method: 'POST', body: { name: 'New project' } });
  await refreshProjects();
  await openProject(p.id);
  $('#inspector').hidden = false;
  const nameField = $('#proj-name');
  nameField.focus();
  nameField.select();
}

export async function openProject(pid) {
  state.project = await api(`/api/projects/${pid}`);
  state.chatId = null;
  state.invokedSkills = [];
  renderSkillChips();
  await refreshProjects();
  $('#chat-section').hidden = false;
  renderChatList();
  renderInspector();
  if (state.project.chats.length) openChat(state.project.chats[0].id);
  else newChat();
}

export function renderInspector() {
  $('#proj-name').value = state.project.name;
  $('#proj-instructions').value = state.project.instructions;
  renderSkillToggles();
  renderAttachments();
}

export async function saveProjectMeta() {
  if (!state.project) return;
  const name = $('#proj-name').value.trim() || 'Untitled project';
  const instructions = $('#proj-instructions').value;
  if (name === state.project.name && instructions === state.project.instructions) return;
  state.project.name = name;
  state.project.instructions = instructions;
  await api(`/api/projects/${state.project.id}`, { method: 'PUT', body: { name, instructions } });
  await refreshProjects();
  $('#chat-project-name').textContent = name;
}

export async function deleteProject() {
  if (!state.project) return;
  if (!confirm(`Delete project "${state.project.name}" and all its chats? This cannot be undone.`)) return;
  await api(`/api/projects/${state.project.id}`, { method: 'DELETE' });
  state.project = null;
  state.chatId = null;
  $('#chat-view').hidden = true;
  $('#welcome').hidden = false;
  $('#chat-section').hidden = true;
  $('#inspector').hidden = true;
  await refreshProjects();
}
