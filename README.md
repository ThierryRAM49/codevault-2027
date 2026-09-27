# 🔐 CodeVaultAI 2027

**A secure, 100% offline code vault with a local AI assistant.**
No cloud, no telemetry — your code never leaves your machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

> Built by **Thierry RAMANITRA**, with the help of the AI assistant **Laetitia**.
> Dedicated to those who still believe in dreams.

---

## ✨ What it does

CodeVaultAI 2027 turns a simple snippet box into a **secure AI development assistant**:

- **Monaco editor** (the VS Code engine) with full syntax highlighting, 35+ languages.
- **Static analysis + Auto-Fix** — detects syntax errors, unused variables (`var` vs `let`),
  bad practices; fixes `==` → `===`, missing semicolons…
- **Laetitia AI** — a floating chat assistant that reviews your code and answers questions.
- **Beautifier**, **instant full-text search**, **multi-file import/export**.
- **Admin & security** — hashed password, access tokens kept **only in the desktop app**,
  local-only storage (SQLite / IndexedDB).

Two front-ends share the same engine:

| Folder | What it is |
|--------|------------|
| `CodeVaultAI_2027/` | The **Electron desktop app** (main deliverable) — SQLite, admin tokens, Monaco |
| `CodeVault-web/`    | The **browser version** (public portal + live demo, IndexedDB) |
| `riad-design/`      | The **PHP/Symfony** portal (public site + email access gate) |
| `DEVOPS/`           | Companion tool — AI platform selector |
| `My personnal Portfolio 2027/` | Personal portfolio (Next.js) |
| `securishield PRO - v.01/`     | Cybersecurity incident-response dashboard |

---

## 🚀 Quick start

### Desktop app (Electron)

```bash
cd CodeVaultAI_2027
npm install
npm run dev          # launches Electron
```

On first run, an admin token is created and shown on the login screen
(also printed in the console as `INITIAL ADMIN TOKEN CREATED: admin_…`).

### Browser version

```bash
cd CodeVault-web
python3 -m http.server 8080
# open http://127.0.0.1:8080/
```

The public page shows a live analyzer demo (Analyze / Auto-Fix / Beautify) and an
email access request form. No account needed for the demo.

---

## 🤖 AI — Nebius & NVIDIA

Laetitia's intelligence is powered by **Nebius AI Studio** (OpenAI-compatible inference),
and we lean on **NVIDIA's open-source models** hosted there:

- **Default model:** `nvidia/Llama-3.1-Nemotron-70B-Instruct` (NVIDIA Nemotron), served by
  **Nebius AI Studio** (`https://api.studio.nebius.ai/v1`).
- Any Nebius AI Studio model can be selected from the assistant's settings (⚙️),
  e.g. NVIDIA Nemotron, Qwen-Coder, DeepSeek.
- **Nebius Token Factory** was used to accelerate our workflow during development —
  fast token generation / model inference while iterating on prompts and features,
  which let us test and ship the AI features far quicker than running models locally.
- The assistant also auto-detects a **local** AI server (Ollama, LM Studio, llama.cpp…)
  so the app still works fully offline.

**Privacy by default:** the API key is stored **locally** (localStorage / Electron) and is
**never sent to our own servers**. Nebius is only called when you opt in with your own key.

```js
// Configure Nebius (or any OpenAI-compatible provider) in the assistant's ⚙️ panel:
//   Base URL : https://api.studio.nebius.ai
//   Model    : nvidia/Llama-3.1-Nemotron-70B-Instruct
//   Key      : <your Nebius API key>
```

---

## 🛠 Tech stack

- **Desktop:** Electron 28, Node.js, JavaScript/TypeScript, electron-builder
- **UI:** React 18, Tailwind CSS (bundled locally), Monaco Editor, Prism.js
- **Data:** SQLite (`codevault.db`), IndexedDB (web), MariaDB (portal)
- **AI:** Nebius AI Studio (NVIDIA Nemotron), Ollama, LM Studio, OpenAI-compatible APIs
- **Web/Back:** PHP 8.4, Symfony 8, Doctrine ORM, JWT, Vite
- **Infra:** Docker, NGINX

---

## 🔒 Security & privacy

- Local storage only (SQLite on desktop, IndexedDB on web).
- Admin token handled **only in the desktop app** (IPC); never exposed to the browser.
- Hashed admin password, no analytics, no third-party trackers.

---

## 📄 License

Released under the **MIT License** — see [LICENSE](./LICENSE).
