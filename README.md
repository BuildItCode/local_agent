# Local Terminal LLM Agent

Give your ollama llm agentic capabilities.

## Features

- 🤖 **Natural Language Commands** - Talk to your terminal in plain English
- 📁 **File Operations** - Create, read, modify files securely  
- 💻 **Command Execution** - Run any terminal command safely
- 🔄 **Interactive Mode** - Conversational interface with memory
- 🛡️ **Sandboxed** - All operations stay within your working directory

## Quick Start

### 1. Install Ollama
```bash
# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows / macOS: Download from https://ollama.ai/download
```

### 2. Install and Run
```bash
# Install
Move install.sh script in a folder of your choosing
run chmod +x install.sh && ./install.sh  to execute it

# Setup (installs models, configures agent)
npm run setup

# Start using
npm start
```


## Example Commands

- `"Create a package.json for a new project"`
- `"Run npm install express"`  
- `"List all files in this directory"`
- `"Create a Python script that prints hello world"`
- `"Show me the contents of package.json"`

## Requirements

- Node.js 14+
- Ollama with at least one model (codellama, llama2, etc.)

## Commands

```bash
npm start        # Interactive mode
npm run setup    # Setup wizard  
```

## Models

Recommended models:
- `qwen3` - Best for coding tasks
- `llama3.2` - Good for general use

Install with: `ollama pull <model-name>`

## License

MIT
