/**
 * markdown.js — minimal, safe markdown renderer for model replies.
 *
 * Supports fenced code blocks, headings, bold/italic, inline code, http(s)
 * links, lists, and blockquotes. All input is HTML-escaped FIRST, so model
 * output can never inject markup; code fences are lifted out before the
 * inline passes (using a private-use sentinel char) and restored at the end.
 */
import { esc } from './util.js';

const SENTINEL = ''; // private-use char: cannot appear in escaped text

export function md(src) {
  const fences = [];
  src = src.replace(/```(\w*)\n?([\s\S]*?)(```|$)/g, (_, lang, code) => {
    fences.push(`<pre><code class="lang-${esc(lang)}">${esc(code.replace(/\n$/, ''))}</code></pre>`);
    return `${SENTINEL}${fences.length - 1}${SENTINEL}`;
  });
  let html = esc(src);
  html = html
    .replace(/^###### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^##### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/^&gt; ?(.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // lists
  html = html.replace(/(^|\n)((?:[-*] .*\n?)+)/g, (_, pre, block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*] /, '')}</li>`).join('');
    return `${pre}<ul>${items}</ul>`;
  });
  html = html.replace(/(^|\n)((?:\d+\. .*\n?)+)/g, (_, pre, block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `${pre}<ol>${items}</ol>`;
  });

  // paragraphs
  html = html.split(/\n{2,}/).map(chunk => {
    if (/^\s*<(h\d|ul|ol|blockquote|pre)/.test(chunk)) return chunk;
    return `<p>${chunk.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  html = html.replace(/(<blockquote>.*<\/blockquote>)(<br>)?/g, '$1');
  html = html.replace(new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'), (_, i) => fences[+i]);
  return html;
}
