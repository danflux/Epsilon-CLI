# Epsilon-CLI 🚀

**An AI-powered command-line coding assistant built to help developers interact with their codebases using natural language.**

Epsilon-CLI is a personal project focused on exploring AI agents, tool calling, and autonomous coding workflows. The goal is to create a CLI-based coding assistant that can understand developer instructions, interact with project files, execute approved operations, and work with multiple AI model providers.

> **Project Status:** Under active development 🚧

---

## 🎯 Project Vision

The vision behind Epsilon-CLI is to build a flexible AI coding assistant that developers can use directly from their terminals.

Instead of manually performing every development task, users should eventually be able to describe what they want in natural language and let the agent plan and perform the required steps.

A major goal is to support multiple AI providers, allowing users to bring their own API keys and choose the models that work best for them.

### Planned AI Provider Support

- Google Gemini
- Anthropic Claude
- OpenAI
- Groq

The architecture will be designed to make adding additional providers easier in the future.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| JavaScript | Core programming language |
| LangChain | LLM integration and tool calling |
| LangGraph | Agent workflow orchestration |
| Groq API | Current LLM provider |
| Zod | Schema validation |
| Axios | API requests |

---

## ✨ Current Features

The following functionality has been implemented in the current development version:

- **CLI interaction:** Communicate with the AI agent directly through the terminal.
- **Groq integration:** Connect to Groq using an API key.
- **API key management:** Store and retrieve the Groq API key through a local settings file.
- **API key validation:** Validate API credentials before starting the agent.
- **LangGraph orchestration:** Manage the agent's workflow using a graph-based architecture.
- **Tool integration:** Provide the agent with tools for reading, listing, and creating/updating files.
- **Streaming responses:** Stream model responses directly to the terminal.
- **Workspace confinement:** Every file tool is limited to the workspace root — the directory the CLI is started from. Paths that escape it, including through symlinks and junctions, are refused.
- **Secret-path protection:** Settings, `.env` files, `.git` internals, `.npmrc`, SSH keys and `*.pem` files cannot be read or written by the agent.
- **Bounded reads:** Files over 256 KiB are refused, and returned content is capped, so one large file cannot exhaust the context window.
- **Write approval:** The agent asks before it creates or updates anything on disk.

*Note: Features are being developed incrementally. The complete autonomous coding workflow is not yet finished.*

---

## 📁 Project Structure

```text
Epsilon-Cli/
│
├── cli.js
├── src/
│   │
│   ├── main.js
│   │
│   ├── ai/
│   │   ├── graph/
│   │   │   ├── graph.js
│   │   │   └── node.js
│   │   │
│   │   └── tools/
│   │       ├── files.tool.js
│   │       └── policy.js
│   │
│   └── utils/
│       ├── constant.js
│       ├── file.utils.js
│       ├── readline.js
│       └── workspace.js
│
├── test/
│   ├── policy.test.js
│   └── tool-node.test.js
│
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

### Directory Overview

| File / Directory | Responsibility |
|---|---|
| `cli.js` | Executable entry shim; maps to the `epsilon` binary |
| `main.js` | Startup logic: settings, key validation, graph hand-off |
| `ai/graph/graph.js` | Defines and runs the LangGraph workflow |
| `ai/graph/node.js` | Contains LLM and tool execution nodes |
| `ai/tools/files.tool.js` | Defines file-related AI tools |
| `ai/tools/policy.js` | Workspace containment, secret-path denial, output clamping |
| `utils/constant.js` | Stores application configuration paths |
| `utils/file.utils.js` | Handles settings and API key operations |
| `utils/readline.js` | Handles terminal input |
| `utils/workspace.js` | Holds the workspace root the tools are confined to |
| `test/` | `node:test` cases for the tool loop and the file-access policy |

---

## ⚙️ Installation and Setup

### Prerequisites

- Node.js 20 or newer (developed on Node 24).
- A Groq API key.

### 1. Clone the repository

```bash
git clone https://github.com/danflux/Epsilon-CLI
```

### 2. Navigate into the project

```bash
cd Epsilon-Cli
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the application

```bash
npm start
```

`npm start` launches `cli.js`, the same entry the `epsilon` binary points at.

### 5. Configure your API key

On the first launch, Epsilon-CLI will ask for your Groq API key.

You can obtain an API key from:

https://console.groq.com/keys

The application stores its settings locally at:

```text
~/.epsilon-cli/settings.json
```

You do not need to manually add your API key to the source code.

**Important:** Never commit your API keys or settings file to GitHub.

### 6. Run the tests

```bash
npm test
```

The suite uses Node's built-in test runner (`node:test`) and covers the agent's tool loop and the file-access policy.

---

## 🗺️ Development Roadmap

The following features are tracked for upcoming development; checked items are already complete.

### Phase 1 — Core Agent Improvements

- [x] Improve LangGraph tool execution.
- [x] Handle multiple tool calls correctly.
- [x] Add robust error handling.
- [x] Introduce execution limits to prevent infinite agent loops.

### Phase 2 — Advanced File Operations

- [ ] Improve file creation and updating.
- [ ] Add file editing capabilities.
- [ ] Add file searching capabilities.
- [x] Restrict filesystem access to the selected project directory.
- [x] Handle file operation errors safely.

### Phase 3 — Terminal Command Execution

- [ ] Allow the agent to execute terminal commands.
- [ ] Implement human approval before command execution.
- [ ] Add safeguards against dangerous commands.
- [ ] Return command output to the agent.

### Phase 4 — Multi-Provider Architecture

- [ ] Design a provider-independent LLM interface.
- [ ] Integrate Google Gemini.
- [ ] Integrate Anthropic Claude.
- [ ] Integrate OpenAI.
- [ ] Improve Groq integration.
- [ ] Allow users to configure multiple providers and models.
- [ ] Store provider-specific API keys securely.

### Phase 5 — Intelligent Model Fallback

- [ ] Detect rate limits and temporary provider failures.
- [ ] Automatically switch to another configured model.
- [ ] Preserve conversation context during model switching.
- [ ] Resume interrupted agent workflows where possible.

### Phase 6 — Reliability and Optimization

- [x] Add unit tests for the tool loop and the file-access policy.
- [ ] Add integration tests.
- [ ] Improve error reporting and logging.
- [ ] Optimize large project handling.
- [ ] Explore RAG for retrieving relevant code from large codebases.
- [ ] Improve documentation and developer experience.

---

## 🔐 Security Considerations

Security is an important part of the project's development.

### In place today

- API keys live outside the repository, in `~/.epsilon-cli/settings.json`, and are never logged or printed.
- Every file tool is confined to the workspace root; paths that escape it — including through symlinks and Windows junctions — are refused with a machine-readable reason.
- Configuration and credential paths (`.epsilon-cli`, `settings.json`, `.env`, `.git`, `.npmrc`, `id_rsa`, `*.pem`) cannot be read or written, even when they sit inside the workspace.
- Reads over 256 KiB are refused and returned content is capped, so the agent cannot quietly pull a huge file into the model context.
- Tool input is validated (Zod schemas plus the path policy), and a refused call still returns a well-formed tool reply instead of crashing the loop.
- Writes ask for approval before touching disk.

### Known limitations

- **Windows file permissions:** settings are written with mode `0o600`, which has no effect on Windows, so the file is not owner-only there. Anything running as your user can read the key — protect the account, not the file mode.
- **Approval is a prompt, not a preview:** the write prompt lists target paths but does not show content, so approving a prompt-injected write is still possible. A unified diff is the next step before writes should be trusted.
- **Absolute and relative paths are both accepted:** the boundary is enforced on every path regardless of form; workspace-relative arguments arrive with the upcoming tool rework.

### Planned

- Show a unified diff of every write and require approval against that diff.
- Extend the same policy to delete, move and rename once those tools exist.
- Add safeguards around terminal command execution once that tool exists.
- Move secrets out of the local settings file into a real secret store.

---

## 🌱 Why I'm Building This

This project is an opportunity to learn and implement concepts beyond traditional application development.

Some of the areas I'm exploring include:

- AI agents and autonomous workflows.
- LLM integrations and tool calling.
- Graph-based agent orchestration.
- Multi-provider architecture.
- Context preservation and model fallback.
- Secure filesystem and terminal operations.

I'm building Epsilon-CLI incrementally and sharing the development journey as I learn.

---

## 🤝 Contributions and Feedback

Epsilon-CLI is currently a work in progress.

Suggestions, feedback, and discussions about improving the architecture and functionality are welcome.

If you find the project interesting, consider giving the repository a ⭐.

---

## 📌 Project Status

**Currently in development.**

More features, improvements, and provider integrations will be added as development progresses.

Stay tuned for updates!

---

**Built with curiosity, JavaScript, and a passion for AI-powered developer tools.** 💻