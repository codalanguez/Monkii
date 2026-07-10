# 🐒 CodeMonkii

A local, private LLM studio for [Ollama](https://ollama.com) — projects, Claude-style skills, and live file knowledge. Nothing ever leaves your machine.

## Quick start

```powershell
git clone https://github.com/codalanguez/CodeMonkii.git
cd CodeMonkii
npm install        # first time only
npm start          # then open http://localhost:8113
```

On Windows you can also just double-click **`Start CodeMonkii.cmd`** — it starts Ollama if needed and opens the app.

Requires **Node.js 18+** and **Ollama** running locally (`ollama serve`, or the Ollama app) with at least one model pulled, e.g. `ollama pull llama3.2`.

## Features

### Projects (like Claude Projects)
Each project bundles:
- **Instructions** — a system prompt applied to every chat in the project
- **Knowledge** — files and folders attached from your machine
- **Skills** — always-on skills for the project
- **Chats** — as many conversations as you like, each remembering its model

Everything is stored as plain JSON under `data/projects/` — easy to back up, easy to inspect, never leaves your disk.

### Skills (Claude skill format)
Drop a folder into `skills/`, containing a `SKILL.md` with YAML frontmatter:

```
skills/
  my-skill/
    SKILL.md
```

```markdown
---
name: my-skill
description: One line describing when to use this skill.
---

Instructions the model follows when the skill is loaded…
```

Two ways to use a skill:
1. **Project toggle** — switch it on in the project panel; it loads into every message.
2. **Slash invoke** — type `/` in the composer and pick a skill; it loads for that message only (and stays in the conversation history from then on).

Existing Claude Code skills work as-is — point CodeMonkii at them:

```powershell
$env:CODEMONKII_SKILLS_DIR = "$HOME\.claude\skills"; npm start
```

### File & directory knowledge
Attach any file or folder via the built-in browser. Contents are **re-read from disk on every message**, so your latest edits are always what the model sees. Directories are walked recursively (skipping `node_modules`, `.git`, build output, binaries) with size budgets so you don't blow out the context window.

### Ollama
- Auto-detects Ollama at `http://localhost:11434` (override with `OLLAMA_HOST`; bind-style values like `0.0.0.0` are normalized automatically)
- Model picker per chat, streaming responses, stop button
- Health indicator in the sidebar
- Update check on startup (cached daily): when a newer Ollama release exists, the server logs it and the sidebar shows a download pill — disable with `CODEMONKII_UPDATE_CHECK=off`

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `8113` | Web UI port |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server address |
| `CODEMONKII_SKILLS_DIR` | `./skills` | Where to scan for skills |
| `CODEMONKII_FS_ROOTS` | *(unset — whole disk)* | Semicolon-separated list of directories the file browser and attachments are restricted to, e.g. `C:\projects;D:\writing` |
| `CODEMONKII_UPDATE_CHECK` | `on` | Set to `off` to disable the daily Ollama update check |

## Security

CodeMonkii is a single-user local app, hardened accordingly:

- **Loopback only** — the server binds `127.0.0.1`; it is never reachable from the network.
- **DNS-rebinding protection** — requests with a `Host` header other than `localhost`/`127.0.0.1` are rejected, so a malicious website that points its own domain at your loopback address gets a 403.
- **CSRF protection** — cross-origin requests (any `Origin` other than the app's own) are rejected.
- **Content Security Policy** — scripts run from the app's own origin only; no eval, no inline scripts, no third-party script sources. Plus `nosniff`, `no-referrer`, and a locked-down `Permissions-Policy`.
- **Filesystem scoping** — set `CODEMONKII_FS_ROOTS` to fence browsing *and* attachment reads into specific directories; the check runs both when attaching and again on every read.
- **Input validation** — project/skill ids are strictly validated (no path traversal), all model output is HTML-escaped before rendering, and errors return generic JSON with no stack traces.

Your chats and project data stay in `data/` on your disk; the only outbound connections are to your local Ollama, Google Fonts (UI typefaces), and one GitHub API call per day to check the latest Ollama release version (no data sent; `CODEMONKII_UPDATE_CHECK=off` disables it).

## Layout

```
server.js               entry point: middleware, routers, listen
lib/
  config.js             env + constants (ports, paths, context budgets)
  security.js           Host/Origin validation, CSP, fs allowlist
  store.js              project JSON persistence
  skills.js             SKILL.md discovery + frontmatter parsing
  attachments.js        reading knowledge from disk under byte budgets
  prompt.js             system prompt assembly
  ollama.js             Ollama HTTP client + release update check
routes/
  projects.js           projects / chats / attachments CRUD
  skills.js             skill listing endpoints
  fs.js                 file-browser directory listings
  ollama.js             health, models, update check, streaming chat
public/
  index.html            single-page UI shell
  style.css             midnight-workshop theme
  js/                   ES modules, one per feature:
    main.js             wiring + startup
    state.js            shared client state
    api.js              JSON fetch client
    util.js             DOM helpers ($, esc, toast)
    markdown.js         safe markdown renderer
    status.js           health indicator, model list, update pill
    projects.js         project lifecycle + inspector
    skills.js           skill toggles + "/" invocation
    attachments.js      knowledge panel + file browser
    chat.js             messages, streaming, stop
skills/                 your skills (3 samples included)
data/projects/          project + chat storage (JSON, gitignored)
```

Each module carries a header comment explaining its responsibility.
