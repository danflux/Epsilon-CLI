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

*Note: Features are being developed incrementally. The complete autonomous coding workflow is not yet finished.*

---

## 📁 Project Structure

```text
Epsilon-Cli/
│
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
│   │       └── files.tool.js
│   │
│   └── utils/
│       ├── constant.js
│       ├── file.utils.js
│       └── readline.js
│
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

### Directory Overview

| File / Directory | Responsibility |
|---|---|
| `main.js` | Application entry point and startup logic |
| `ai/graph/graph.js` | Defines and runs the LangGraph workflow |
| `ai/graph/node.js` | Contains LLM and tool execution nodes |
| `ai/tools/files.tool.js` | Defines file-related AI tools |
| `utils/constant.js` | Stores application configuration paths |
| `utils/file.utils.js` | Handles settings and API key operations |
| `utils/readline.js` | Handles terminal input |

---

## ⚙️ Installation and Setup

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
node src/main.js
```

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

---

## 🗺️ Development Roadmap

The following features are planned for upcoming development.

### Phase 1 — Core Agent Improvements

- [ ] Improve LangGraph tool execution.
- [ ] Handle multiple tool calls correctly.
- [ ] Add robust error handling.
- [ ] Introduce execution limits to prevent infinite agent loops.

### Phase 2 — Advanced File Operations

- [ ] Improve file creation and updating.
- [ ] Add file editing capabilities.
- [ ] Add file searching capabilities.
- [ ] Restrict filesystem access to the selected project directory.
- [ ] Handle file operation errors safely.

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

- [ ] Add unit and integration tests.
- [ ] Improve error reporting and logging.
- [ ] Optimize large project handling.
- [ ] Explore RAG for retrieving relevant code from large codebases.
- [ ] Improve documentation and developer experience.

---

## 🔐 Security Considerations

Security is an important part of the project's development.

Planned security improvements include:

- Keep API keys outside the project repository.
- Avoid exposing API keys in logs or terminal output.
- Restrict file operations to the selected project directory.
- Require user approval for potentially destructive operations.
- Validate tool inputs before execution.
- Add safeguards around terminal command execution.

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