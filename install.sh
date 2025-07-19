#!/bin/bash

# Terminal LLM Agent Installation Script
echo "🚀 Terminal LLM Agent Installation"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js is installed: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    echo "Please install npm first (usually comes with Node.js)"
    exit 1
fi

echo "✅ npm is installed: $(npm --version)"
echo ""

# Get installation directory
read -p "📁 Enter installation directory (default: current directory): " INSTALL_DIR
if [ -z "$INSTALL_DIR" ]; then
    INSTALL_DIR="."
fi

# Convert to absolute path
INSTALL_DIR=$(realpath "$INSTALL_DIR")

# Get project name
read -p "📝 Enter project name (default: terminal-llm-agent): " PROJECT_NAME
if [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME="terminal-llm-agent"
fi

# Full project path
PROJECT_PATH="$INSTALL_DIR/$PROJECT_NAME"

echo ""
echo "📋 Installation Summary:"
echo "   Target Directory: $INSTALL_DIR"
echo "   Project: $PROJECT_NAME"
echo "   Full path: $PROJECT_PATH"
echo ""

# Confirm installation
read -p "Continue with installation? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "❌ Installation cancelled"
    exit 1
fi

# Create project directory
echo "📁 Creating project directory..."
if [ -d "$PROJECT_PATH" ]; then
    echo "⚠️  Directory $PROJECT_PATH already exists."
    read -p "Do you want to continue and overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Installation cancelled"
        exit 1
    fi
    rm -rf "$PROJECT_PATH"
fi

mkdir -p "$PROJECT_PATH"
cd "$PROJECT_PATH"

echo "✅ Created directory: $PROJECT_PATH"

# Create package.json
echo "📦 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "terminal-llm-agent",
  "version": "1.0.0",
  "description": "AI assistant with terminal and file system access using Ollama",
  "main": "terminal-agent.js",
  "bin": {
    "terminal-ai": "./terminal-agent.js"
  },
  "scripts": {
    "start": "node terminal-agent.js",
    "setup": "node setup.js",
    "test": "node test.js"
  },
  "keywords": [
    "llm",
    "ai",
    "terminal",
    "ollama",
    "assistant",
    "file-system",
    "automation"
  ],
  "author": "Your Name",
  "license": "MIT",
  "engines": {
    "node": ">=14.0.0"
  },
  "dependencies": {
    "node-fetch": "^2.6.7"
  },
  "devDependencies": {},
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/terminal-llm-agent.git"
  }
}
EOF

echo "✅ Package.json created"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

echo "✅ Dependencies installed"

# Create terminal-agent.js
echo "📝 Creating terminal-agent.js..."
cat > terminal-agent.js << 'AGENT_EOF'
#!/usr/bin/env node

const {exec, spawn} = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const readline = require('readline');

// Handle fetch for older Node.js versions
let fetch;
if (typeof globalThis.fetch === 'undefined') {
    try {
        fetch = require('node-fetch');
    } catch (error) {
        console.error('❌ node-fetch is required for Node.js < 18. Install with: npm install node-fetch');
        process.exit(1);
    }
} else {
    fetch = globalThis.fetch;
}

class TerminalLLMAgent {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:11434';
        this.model = options.model || this.loadConfigModel() || null; // No default model
        this.workingDirectory = options.workingDirectory || process.cwd();
        this.conversationHistory = [];
        this.maxHistoryLength = options.maxHistoryLength || 20;

        // System prompt for terminal-aware assistant
        this.systemPrompt = `You are a helpful AI assistant with access to terminal commands and file system operations.
You MUST use the available tools to perform actions - DO NOT just explain how to do things.

When the user asks you to:
- Run commands: IMMEDIATELY use the execute_command tool
- Create files: IMMEDIATELY use the create_file tool
- Read files: IMMEDIATELY use the read_file tool
- List directories: IMMEDIATELY use the list_directory tool
- Navigate directories: IMMEDIATELY use the change_directory tool
- Append to files: IMMEDIATELY use the append_file tool

IMPORTANT: You have the power to execute these actions directly. When a user asks you to create a file, run a command, or perform any file operation, you MUST use the appropriate tool immediately. Do not explain how to do it manually - actually do it using the tools.

Current working directory: ${this.workingDirectory}
Operating system: ${os.platform()}

To use a tool, respond with JSON in this exact format:
{"tool": "tool_name", "parameters": {"param1": "value1"}}

Available tools:
- execute_command: Run shell commands (use this for npm, git, etc.)
- create_file: Create or overwrite files (use this when asked to create any file)
- read_file: Read file contents (use this when asked to show/read files)
- list_directory: List directory contents (use this when asked to list files)
- change_directory: Change working directory (use this when asked to navigate)
- append_file: Append to existing files (use this when asked to add content)

Example responses:
User: "Create a hello.txt file"
You: {"tool": "create_file", "parameters": {"filepath": "hello.txt", "content": "Hello, World!"}}

User: "Run npm init"
You: {"tool": "execute_command", "parameters": {"command": "npm init -y"}}

User: "Show me the files here"
You: {"tool": "list_directory", "parameters": {"dirpath": "."}}

ALWAYS use tools when requested to perform actions. Never just give instructions.`;

        this.setupTools();
    }

    loadConfigModel() {
        try {
            const fs = require('fs');
            if (!fs.existsSync('agent-config.json')) {
                return null;
            }
            const config = JSON.parse(fs.readFileSync('agent-config.json', 'utf8'));
            return config.model;
        } catch (error) {
            console.warn('⚠️  Could not load config file:', error.message);
            return null;
        }
    }

    // Validate file path to prevent directory traversal
    validatePath(filepath) {
        const resolvedPath = path.resolve(this.workingDirectory, filepath);
        const workingDirResolved = path.resolve(this.workingDirectory);

        if (!resolvedPath.startsWith(workingDirResolved)) {
            throw new Error(`Access denied: Path ${filepath} is outside working directory`);
        }

        return resolvedPath;
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return true;
        } catch (error) {
            console.error('❌ Cannot connect to Ollama:');
            console.error(`   ${error.message}`);
            console.error('\n💡 Make sure Ollama is running:');
            console.error('   ollama serve');
            console.error('\n💡 Or run setup again:');
            console.error('   node setup.js');
            return false;
        }
    }

    async checkModel() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            const data = await response.json();
            const models = data.models || [];

            // If no model is set or model doesn't exist, always show selection
            const modelExists = this.model && models.some(m => m.name === this.model);

            if (!this.model || !modelExists) {
                if (!this.model) {
                    console.log('🤖 No model configured.');
                } else {
                    console.log(`⚠️  Model "${this.model}" not found.`);
                }

                if (models.length === 0) {
                    console.error('\n❌ No models installed.');
                    console.error('\n💡 Please install a model first:');
                    console.error('   ollama pull codellama');
                    console.error('   ollama pull llama2');
                    console.error('   ollama pull mistral');
                    console.error('   ollama pull phi');
                    return false;
                }

                // Let user select from available models
                const selectedModel = await this.selectAvailableModel(models);
                if (selectedModel) {
                    this.model = selectedModel;
                    await this.saveModelToConfig(selectedModel);
                    console.log(`✅ Using model: ${this.model}\n`);
                    return true;
                } else {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Could not verify model:', error.message);
            return false;
        }
    }

    async selectAvailableModel(models) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n📋 Available models:');
        models.forEach((model, index) => {
            const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
            let description = '';

            // Add helpful descriptions
            if (model.name.includes('codellama')) {
                description = ' - Best for coding tasks';
            } else if (model.name.includes('llama2')) {
                description = ' - Good for general conversation';
            } else if (model.name.includes('mistral')) {
                description = ' - Fast and efficient';
            } else if (model.name.includes('phi')) {
                description = ' - Lightweight and quick';
            } else if (model.name.includes('gemma')) {
                description = ' - Google\'s model';
            }

            console.log(`   ${index + 1}. ${model.name} (${sizeGB}GB)${description}`);
        });

        return new Promise((resolve) => {
            const askForSelection = () => {
                rl.question(`\nSelect a model (1-${models.length}) or 'q' to quit: `, (answer) => {
                    if (answer.toLowerCase() === 'q') {
                        console.log('👋 Exiting...');
                        rl.close();
                        resolve(null);
                        return;
                    }

                    const choice = parseInt(answer);
                    if (choice >= 1 && choice <= models.length) {
                        const selectedModel = models[choice - 1].name;
                        console.log(`🎯 Selected: ${selectedModel}`);
                        rl.close();
                        resolve(selectedModel);
                    } else {
                        console.log('❌ Invalid choice. Please try again.');
                        askForSelection();
                    }
                });
            };

            askForSelection();
        });
    }

    async saveModelToConfig(modelName) {
        try {
            const fs = require('fs');
            let config = {};

            // Load existing config if it exists
            if (fs.existsSync('agent-config.json')) {
                try {
                    config = JSON.parse(fs.readFileSync('agent-config.json', 'utf8'));
                } catch (error) {
                    console.warn('⚠️  Could not read existing config, creating new one');
                }
            }

            // Update with selected model
            config.model = modelName;
            config.ollamaUrl = this.baseUrl;
            config.workingDirectory = this.workingDirectory;
            config.lastUpdated = new Date().toISOString();

            await require('fs').promises.writeFile('agent-config.json', JSON.stringify(config, null, 2));
            console.log(`💾 Saved model "${modelName}" to config file`);
        } catch (error) {
            console.warn('⚠️  Could not save config file:', error.message);
        }
    }

    setupTools() {
        this.tools = new Map();

        // Execute shell commands
        this.tools.set('execute_command', {
            description: 'Execute shell commands in the terminal',
            parameters: {command: 'string', timeout: 'number (optional, default 60000ms)'},
            handler: async (params) => {
                const {command, timeout = 60000} = params; // Increased timeout for long commands

                console.log(`🔧 Executing: ${command}`);

                return new Promise((resolve) => {
                    const child = exec(command, {
                        cwd: this.workingDirectory,
                        timeout: timeout,
                        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
                        env: {...process.env, FORCE_COLOR: '0'} // Disable colors for cleaner output
                    }, (error, stdout, stderr) => {
                        if (error) {
                            // Check if it's a timeout error
                            if (error.killed && error.signal === 'SIGTERM') {
                                resolve({
                                    success: false,
                                    error: `Command timed out after ${timeout}ms`,
                                    stdout: stdout || '',
                                    stderr: stderr || '',
                                    command: command
                                });
                            } else {
                                resolve({
                                    success: false,
                                    error: error.message,
                                    stdout: stdout || '',
                                    stderr: stderr || '',
                                    command: command,
                                    exitCode: error.code
                                });
                            }
                        } else {
                            resolve({
                                success: true,
                                stdout: stdout || '',
                                stderr: stderr || '',
                                command: command,
                                message: 'Command executed successfully'
                            });
                        }
                    });

                    // Show progress for long-running commands
                    let progressTimer;
                    if (command.includes('npx') || command.includes('npm install') || command.includes('git clone')) {
                        progressTimer = setInterval(() => {
                            process.stdout.write('.');
                        }, 2000);
                    }

                    child.on('close', () => {
                        if (progressTimer) {
                            clearInterval(progressTimer);
                            console.log(''); // New line after progress dots
                        }
                    });
                });
            }
        });

        // Create files
        this.tools.set('create_file', {
            description: 'Create or overwrite a file with content',
            parameters: {filepath: 'string', content: 'string', encoding: 'string (optional, default utf8)'},
            handler: async (params) => {
                const {filepath, content, encoding = 'utf8'} = params;

                try {
                    const fullPath = this.validatePath(filepath);
                    console.log(`📝 Creating file: ${fullPath}`);

                    // Create directory if it doesn't exist
                    const dir = path.dirname(fullPath);
                    await fs.mkdir(dir, {recursive: true});

                    await fs.writeFile(fullPath, content, encoding);

                    return {
                        success: true,
                        filepath: fullPath,
                        size: Buffer.byteLength(content, encoding),
                        message: `File created successfully`
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        filepath: filepath
                    };
                }
            }
        });

        // Read files
        this.tools.set('read_file', {
            description: 'Read contents of a file',
            parameters: {filepath: 'string', encoding: 'string (optional, default utf8)'},
            handler: async (params) => {
                const {filepath, encoding = 'utf8'} = params;

                try {
                    const fullPath = this.validatePath(filepath);
                    console.log(`📖 Reading file: ${fullPath}`);

                    const content = await fs.readFile(fullPath, encoding);
                    const stats = await fs.stat(fullPath);

                    return {
                        success: true,
                        filepath: fullPath,
                        content: content,
                        size: stats.size,
                        modified: stats.mtime
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        filepath: filepath
                    };
                }
            }
        });

        // List directory contents
        this.tools.set('list_directory', {
            description: 'List contents of a directory',
            parameters: {dirpath: 'string (optional, default current directory)'},
            handler: async (params) => {
                const {dirpath = '.'} = params;

                try {
                    const fullPath = this.validatePath(dirpath);
                    console.log(`📁 Listing directory: ${fullPath}`);

                    const entries = await fs.readdir(fullPath, {withFileTypes: true});

                    const items = await Promise.all(entries.map(async (entry) => {
                        try {
                            const itemPath = path.join(fullPath, entry.name);
                            const stats = await fs.stat(itemPath);

                            return {
                                name: entry.name,
                                type: entry.isDirectory() ? 'directory' : 'file',
                                size: stats.size,
                                modified: stats.mtime,
                                permissions: stats.mode.toString(8)
                            };
                        } catch (error) {
                            return {
                                name: entry.name,
                                type: entry.isDirectory() ? 'directory' : 'file',
                                error: 'Could not read stats'
                            };
                        }
                    }));

                    return {
                        success: true,
                        directory: fullPath,
                        items: items
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        directory: dirpath
                    };
                }
            }
        });

        // Change directory
        this.tools.set('change_directory', {
            description: 'Change the current working directory',
            parameters: {dirpath: 'string'},
            handler: async (params) => {
                const {dirpath} = params;

                try {
                    const fullPath = this.validatePath(dirpath);
                    console.log(`📂 Changing directory to: ${fullPath}`);

                    await fs.access(fullPath, fs.constants.F_OK);
                    const stats = await fs.stat(fullPath);

                    if (!stats.isDirectory()) {
                        return {
                            success: false,
                            error: 'Path is not a directory',
                            path: fullPath
                        };
                    }

                    const oldDirectory = this.workingDirectory;
                    this.workingDirectory = fullPath;
                    process.chdir(fullPath);

                    return {
                        success: true,
                        oldDirectory: oldDirectory,
                        newDirectory: fullPath,
                        message: `Changed to ${fullPath}`
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        path: dirpath
                    };
                }
            }
        });

        // Append to file
        this.tools.set('append_file', {
            description: 'Append content to an existing file',
            parameters: {filepath: 'string', content: 'string', encoding: 'string (optional, default utf8)'},
            handler: async (params) => {
                const {filepath, content, encoding = 'utf8'} = params;

                try {
                    const fullPath = this.validatePath(filepath);
                    console.log(`➕ Appending to file: ${fullPath}`);

                    await fs.appendFile(fullPath, content, encoding);
                    const stats = await fs.stat(fullPath);

                    return {
                        success: true,
                        filepath: fullPath,
                        newSize: stats.size,
                        message: `Content appended successfully`
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        filepath: filepath
                    };
                }
            }
        });
    }

    async chat(message) {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {role: 'system', content: this.systemPrompt},
                        ...this.conversationHistory.slice(-this.maxHistoryLength),
                        {role: 'user', content: message}
                    ],
                    stream: false,
                    options: {
                        temperature: 0.1, // Very low temperature for consistent tool usage
                        top_p: 0.8,
                        top_k: 20,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            let assistantMessage = data.message.content;

            // Check if the response contains a tool call
            const toolResult = await this.handleToolCall(assistantMessage);

            if (toolResult) {
                // If tool was executed, get a follow-up response
                const followUpPrompt = `Tool execution result: ${JSON.stringify(toolResult, null, 2)}

Please provide a brief, natural language summary of what was accomplished. Be concise and focus on the result.`;

                const followUpResponse = await fetch(`${this.baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: [
                            {
                                role: 'system',
                                content: `You are a helpful assistant. Provide a brief summary of the tool execution result. Be concise and helpful.`
                            },
                            {role: 'user', content: followUpPrompt}
                        ],
                        stream: false,
                        options: {
                            temperature: 0.3,
                        }
                    }),
                });

                const followUpData = await followUpResponse.json();
                assistantMessage = followUpData.message.content;
            } else {
                // If no tool was used but message seems like an action request, try retry
                if (this.seemsLikeActionRequest(message) && !this.containsToolCall(assistantMessage)) {
                    console.log('\n⚠️  No tool was used. Trying again with explicit instructions...');

                    const retryPrompt = `The user said: "${message}"

This requires action. You MUST use the appropriate tool immediately. Do not explain - actually do it.

Respond ONLY with the tool call in JSON format like: {"tool": "tool_name", "parameters": {"param": "value"}}`;

                    const retryResponse = await fetch(`${this.baseUrl}/api/chat`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            model: this.model,
                            messages: [
                                {role: 'system', content: this.systemPrompt},
                                {role: 'user', content: retryPrompt}
                            ],
                            stream: false,
                            options: {temperature: 0.05}
                        }),
                    });

                    const retryData = await retryResponse.json();
                    const retryToolResult = await this.handleToolCall(retryData.message.content);

                    if (retryToolResult) {
                        assistantMessage = `Successfully executed the requested action.`;
                    } else {
                        assistantMessage = `I understand you want me to: ${message}. However, I had trouble executing the appropriate tool. Please try rephrasing your request.`;
                    }
                }
            }


            // Update conversation history
            this.conversationHistory.push({role: 'user', content: message});
            this.conversationHistory.push({role: 'assistant', content: assistantMessage});

            return assistantMessage;
        } catch (error) {
            console.error('Error communicating with LLM:', error);
            throw error;
        }
    }

    // Helper function to detect if a message seems like an action request
    seemsLikeActionRequest(message) {
        const actionWords = [
            'create', 'make', 'build', 'generate', 'write',
            'run', 'execute', 'install', 'start', 'launch',
            'list', 'show', 'display', 'read', 'open',
            'delete', 'remove', 'move', 'copy', 'rename',
            'cd', 'ls', 'cat', 'touch', 'mkdir',
            'npm', 'git', 'pip', 'yarn', 'node', 'npx'
        ];

        const lowerMessage = message.toLowerCase();
        return actionWords.some(word => lowerMessage.includes(word));
    }

    containsToolCall(response) {
        return response.includes('"tool"') && response.includes('"parameters"');
    }

    async handleToolCall(response) {
        try {
            // More robust JSON extraction
            let jsonMatch = response.match(/\{[^{}]*"tool"[^{}]*\}/);

            // If simple match fails, try to find nested JSON
            if (!jsonMatch) {
                const matches = response.match(/\{(?:[^{}]|\{[^{}]*\})*\}/g);
                if (matches) {
                    jsonMatch = matches.find(match => {
                        try {
                            const parsed = JSON.parse(match);
                            return parsed.tool;
                        } catch (e) {
                            return false;
                        }
                    });
                    if (jsonMatch) {
                        jsonMatch = [jsonMatch];
                    }
                }
            }

            if (!jsonMatch) {
                console.log('⚠️  No valid tool call found in response');
                return null;
            }

            const toolCall = JSON.parse(jsonMatch[0]);

            // Validate tool call structure
            if (!toolCall.tool || typeof toolCall.tool !== 'string') {
                console.log('⚠️  Invalid tool call: missing or invalid tool name');
                return null;
            }

            if (!this.tools.has(toolCall.tool)) {
                console.log(`⚠️  Unknown tool: ${toolCall.tool}`);
                return null;
            }

            if (!toolCall.parameters || typeof toolCall.parameters !== 'object') {
                console.log('⚠️  Invalid tool call: missing or invalid parameters');
                return null;
            }

            const tool = this.tools.get(toolCall.tool);
            console.log(`\n🤖 Using tool: ${toolCall.tool}`);
            console.log(`📋 Parameters:`, toolCall.parameters);

            const result = await tool.handler(toolCall.parameters);

            if (result.success) {
                console.log(`✅ Tool executed successfully`);
                // Show command output if available
                if (result.stdout) {
                    console.log(`📤 Output: ${result.stdout}`);
                }
                if (result.stderr && result.stderr.trim()) {
                    console.log(`⚠️  Warnings: ${result.stderr}`);
                }
            } else {
                console.log(`❌ Tool execution failed: ${result.error}`);
                if (result.stderr) {
                    console.log(`📤 Error output: ${result.stderr}`);
                }
            }

            return result;
        } catch (e) {
            console.log(`⚠️  Error parsing tool call: ${e.message}`);
            console.log(`📝 Raw response: ${response.substring(0, 200)}...`);
            return null;
        }
    }


    async startInteractiveMode() {
        // Check connection first
        const connectionOk = await this.checkConnection();
        if (!connectionOk) {
            process.exit(1);
        }

        // Ask for working directory
        await this.selectWorkingDirectory();

        // Check model after setting working directory
        const modelOk = await this.checkModel();
        if (!modelOk) {
            process.exit(1);
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: `\n💻 [${path.basename(this.workingDirectory)}] > `
        });

        console.log('🚀 Terminal LLM Agent started!');
        console.log(`🤖 Using model: ${this.model}`);
        console.log(`📁 Working in: ${this.workingDirectory}`);
        console.log('💡 Try commands like:');
        console.log('   - "Create a hello.txt file with some content"');
        console.log('   - "List the files in this directory"');
        console.log('   - "Run npm init to create a package.json"');
        console.log('   - "Show me the contents of package.json"');
        console.log('   - Type "exit" to quit');
        console.log('   - Type "help" for more commands\n');

        rl.prompt();

        rl.on('line', async (input) => {
            const message = input.trim();

            if (message.toLowerCase() === 'exit') {
                console.log('👋 Goodbye!');
                rl.close();
                return;
            }

            if (message.toLowerCase() === 'clear') {
                console.clear();
                rl.prompt();
                return;
            }

            if (message.toLowerCase() === 'help') {
                console.log('\n📋 Available commands:');
                console.log('   exit          - Quit the agent');
                console.log('   clear         - Clear the screen');
                console.log('   pwd           - Show current directory');
                console.log('   cd            - Change working directory');
                console.log('   help          - Show this help');
                console.log('   model         - Show current model');
                console.log('   models        - List all available models');
                console.log('   switch        - Switch to a different model');
                console.log('   history       - Show conversation history');
                console.log('\n💡 Or just type natural language commands like:');
                console.log('   "create a Python script that prints hello world"');
                console.log('   "list all .js files in this directory"');
                console.log('   "install express with npm"');
                rl.prompt();
                return;
            }

            if (message.toLowerCase() === 'pwd') {
                console.log(`📍 Current directory: ${this.workingDirectory}`);
                rl.prompt();
                return;
            }

            if (message.toLowerCase() === 'cd') {
                await this.selectWorkingDirectory();
                // Update the prompt to reflect new directory
                rl.setPrompt(`\n💻 [${path.basename(this.workingDirectory)}] > `);
                rl.prompt();
                return;
            }

            if (message.toLowerCase() === 'model') {
                console.log(`🤖 Current model: ${this.model}`);
                console.log(`🔗 Ollama URL: ${this.baseUrl}`);
                rl.prompt();
                return;
            }

            if (message.toLowerCase() === 'models') {
                await this.listAllModels();
                rl.prompt();
                return;
            }

            if (message.toLowerCase() === 'switch') {
                const switched = await this.switchModel();
                if (switched) {
                    console.log(`🔄 Switched to model: ${this.model}`);
                }
                rl.prompt();
                return;
            }

            if (message.toLowerCase() === 'history') {
                console.log('\n📜 Conversation history:');
                if (this.conversationHistory.length === 0) {
                    console.log('   No conversation history yet');
                } else {
                    this.conversationHistory.slice(-10).forEach((msg, index) => {
                        const role = msg.role === 'user' ? '👤' : '🤖';
                        console.log(`   ${role} ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
                    });
                }
                rl.prompt();
                return;
            }

            if (message) {
                try {
                    console.log('\n🤔 Thinking...');
                    const response = await this.chat(message);
                    console.log(`\n🤖 Assistant: ${response}`);
                } catch (error) {
                    console.error(`\n❌ Error: ${error.message}`);
                    if (error.message.includes('connection refused') || error.message.includes('ECONNREFUSED')) {
                        console.error('💡 Make sure Ollama is running: ollama serve');
                    }
                }
            }

            rl.prompt();
        });

        rl.on('close', () => {
            console.log('\n👋 Terminal LLM Agent stopped.');
            process.exit(0);
        });
    }

    async selectWorkingDirectory() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(async (resolve) => {
            console.log('\n📁 Working Directory Selection');
            console.log('===============================');
            console.log(`Current: ${this.workingDirectory}`);
            console.log('\nOptions:');
            console.log('1. Use current directory');
            console.log('2. Enter custom path');
            console.log('3. Browse from home directory');
            console.log('4. Browse from root directory');

            const askForChoice = async () => {
                rl.question('\nSelect an option (1-4): ', async (choice) => {
                    switch (choice) {
                        case '1':
                            console.log(`✅ Using: ${this.workingDirectory}`);
                            rl.close();
                            resolve();
                            break;

                        case '2':
                            rl.question('Enter directory path: ', async (customPath) => {
                                try {
                                    const resolvedPath = path.resolve(customPath);
                                    const fs = require('fs');

                                    if (fs.existsSync(resolvedPath)) {
                                        const stats = fs.statSync(resolvedPath);
                                        if (stats.isDirectory()) {
                                            this.workingDirectory = resolvedPath;
                                            process.chdir(resolvedPath);
                                            console.log(`✅ Changed to: ${resolvedPath}`);
                                            await this.saveWorkingDirectoryToConfig();
                                        } else {
                                            console.log('❌ Path is not a directory');
                                            askForChoice();
                                            return;
                                        }
                                    } else {
                                        console.log('❌ Directory does not exist');
                                        askForChoice();
                                        return;
                                    }
                                } catch (error) {
                                    console.log(`❌ Error: ${error.message}`);
                                    askForChoice();
                                    return;
                                }
                                rl.close();
                                resolve();
                            });
                            break;

                        case '3':
                            await this.browseDirectory(require('os').homedir(), rl, resolve);
                            break;

                        case '4':
                            await this.browseDirectory('/', rl, resolve);
                            break;

                        default:
                            console.log('❌ Invalid choice. Please try again.');
                            await askForChoice();
                    }
                });
            };

            await askForChoice();
        });
    }

    async browseDirectory(startPath, rl, resolve) {
        const fs = require('fs');
        let currentPath = startPath;

        const showDirectory = async () => {
            try {
                console.log(`\n📁 Current: ${currentPath}`);

                const entries = fs.readdirSync(currentPath, {withFileTypes: true});
                const directories = entries.filter(entry => entry.isDirectory()).slice(0, 20); // Limit to 20 for readability

                console.log('\nDirectories:');
                console.log('0. .. (parent directory)');
                console.log('s. Select this directory');

                directories.forEach((dir, index) => {
                    console.log(`${index + 1}. ${dir.name}/`);
                });

                rl.question('\nEnter choice (number, "s" to select, or "q" to quit): ', async (choice) => {
                    if (choice.toLowerCase() === 'q') {
                        console.log('❌ Directory selection cancelled');
                        rl.close();
                        resolve();
                        return;
                    }

                    if (choice.toLowerCase() === 's') {
                        this.workingDirectory = currentPath;
                        process.chdir(currentPath);
                        console.log(`✅ Selected: ${currentPath}`);
                        await this.saveWorkingDirectoryToConfig();
                        rl.close();
                        resolve();
                        return;
                    }

                    const choiceNum = parseInt(choice);
                    if (choiceNum === 0) {
                        // Go to parent directory
                        currentPath = path.dirname(currentPath);
                        await showDirectory();
                    } else if (choiceNum >= 1 && choiceNum <= directories.length) {
                        // Go to selected directory
                        currentPath = path.join(currentPath, directories[choiceNum - 1].name);
                        await showDirectory();
                    } else {
                        console.log('❌ Invalid choice. Please try again.');
                        await showDirectory();
                    }
                });

            } catch (error) {
                console.log(`❌ Error reading directory: ${error.message}`);
                console.log('Returning to parent directory...');
                currentPath = path.dirname(currentPath);
                await showDirectory();
            }
        };

        await showDirectory();
    }

    async saveWorkingDirectoryToConfig() {
        try {
            const fs = require('fs');
            let config = {};

            if (fs.existsSync('agent-config.json')) {
                try {
                    config = JSON.parse(fs.readFileSync('agent-config.json', 'utf8'));
                } catch (error) {
                    console.warn('⚠️  Could not read existing config, creating new one');
                }
            }

            config.workingDirectory = this.workingDirectory;
            config.lastUpdated = new Date().toISOString();

            await require('fs').promises.writeFile('agent-config.json', JSON.stringify(config, null, 2));
            console.log(`💾 Saved working directory to config`);
        } catch (error) {
            console.warn('⚠️  Could not save config file:', error.message);
        }
    }

    async listAllModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            const data = await response.json();
            const models = data.models || [];

            console.log('\n📋 All available models:');
            if (models.length === 0) {
                console.log('   No models installed');
            } else {
                models.forEach((model, index) => {
                    const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
                    const current = model.name === this.model ? ' (current)' : '';
                    console.log(`   ${index + 1}. ${model.name} (${sizeGB}GB)${current}`);
                });
            }
        } catch (error) {
            console.error('❌ Could not list models:', error.message);
        }
    }

    async switchModel() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            const data = await response.json();
            const models = data.models || [];

            if (models.length === 0) {
                console.log('❌ No models available to switch to');
                return false;
            }

            const selectedModel = await this.selectAvailableModel(models);
            if (selectedModel && selectedModel !== this.model) {
                this.model = selectedModel;
                await this.saveModelToConfig(selectedModel);
                // Clear conversation history when switching models
                this.conversationHistory = [];
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Could not switch model:', error.message);
            return false;
        }
    }

    // Method to execute a single command and return result
    async executeCommand(command) {
        try {
            const response = await this.chat(command);
            return response;
        } catch (error) {
            throw new Error(`Failed to execute command: ${error.message}`);
        }
    }
}

// CLI usage
async function main() {
    const args = process.argv.slice(2);

    const options = {
        model: null, // No default model - will always prompt for selection
        workingDirectory: process.cwd()
    };

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--model':
                options.model = args[++i];
                break;
            case '--dir':
                options.workingDirectory = path.resolve(args[++i]);
                break;
            case '--setup':
                console.log('🔧 Running setup...');
                require('./setup.js');
                return;
            case '--help':
                console.log(`
Terminal LLM Agent - AI assistant with file system access

Usage: node terminal-agent.js [options] [command]

Options:
  --model <name>   LLM model to use (skips model selection)
  --dir <path>     Working directory (default: current directory)
  --setup          Run the setup wizard
  --help           Show this help message

Examples:
  node terminal-agent.js                           # Interactive mode with model selection
  node terminal-agent.js "create a hello.py file"  # Single command with model selection
  node terminal-agent.js --model llama2            # Use specific model (skip selection)
  node terminal-agent.js --setup                   # Run setup wizard

First time setup:
  node setup.js                                    # Run setup wizard
        `);
                return;
        }
    }

    const agent = new TerminalLLMAgent(options);

    // Check if this is first run (no config file) or if --dir wasn't specified
    const fs = require('fs');
    const hasConfig = fs.existsSync('agent-config.json');
    const dirSpecified = args.includes('--dir');

    if (!hasConfig && !dirSpecified) {
        console.log('🔧 First time setup detected!');
        console.log('💡 Tip: Run "npm run setup" for guided setup');
        console.log('');
    }

    // Check connection and model before proceeding
    const connectionOk = await agent.checkConnection();
    if (!connectionOk) {
        return;
    }

    // If no config exists and no --dir specified, ask for working directory
    if (!hasConfig && !dirSpecified) {
        await agent.selectWorkingDirectory();
    }

    const modelOk = await agent.checkModel();
    if (!modelOk) {
        return;
    }

    // Single command mode
    const command = args.find(arg => !arg.startsWith('--') && arg !== options.model && arg !== options.workingDirectory);
    if (command) {
        try {
            console.log(`🤖 Using model: ${agent.model}`);
            console.log(`📍 Working directory: ${agent.workingDirectory}\n`);

            const response = await agent.executeCommand(command);
            console.log(response);
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            if (error.message.includes('connection refused') || error.message.includes('ECONNREFUSED')) {
                console.error('💡 Make sure Ollama is running: ollama serve');
            }
            process.exit(1);
        }
        return;
    }

    // Interactive mode
    await agent.startInteractiveMode();
}

// Handle uncaught exceptions and cleanup
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle termination signals
process.on('SIGINT', () => {
    console.log('\n👋 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = {TerminalLLMAgent};
AGENT_EOF

chmod +x terminal-agent.js
echo "✅ Created terminal-agent.js"

# Create setup.js
echo "📝 Creating setup.js..."
cat > setup.js << 'SETUP_EOF'
#!/usr/bin/env node

const {exec, spawn} = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const os = require('os');

// Handle fetch for older Node.js versions
let fetch;
if (typeof globalThis.fetch === 'undefined') {
    try {
        fetch = require('node-fetch');
    } catch (error) {
        console.error('❌ node-fetch is required for Node.js < 18. Install with: npm install node-fetch');
        process.exit(1);
    }
} else {
    fetch = globalThis.fetch;
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function checkOllama() {
    return new Promise((resolve) => {
        exec('ollama --version', (error, stdout) => {
            if (error) {
                resolve(false);
            } else {
                console.log('✅ Ollama is installed:', stdout.trim());
                resolve(true);
            }
        });
    });
}

async function installOllama() {
    const platform = os.platform();
    console.log(`\n🔧 Installing Ollama for ${platform}...`);

    return new Promise((resolve, reject) => {
        let installCommand;

        switch (platform) {
            case 'darwin':
            case 'linux':
                installCommand = 'curl -fsSL https://ollama.ai/install.sh | sh';
                break;
            case 'win32':
                console.log('📋 For Windows, please download and install from: https://ollama.ai/download');
                console.log('After installation, restart your terminal and run this setup again.');
                resolve(false);
                return;
            default:
                console.log('❌ Unsupported platform. Please visit https://ollama.ai for installation instructions.');
                resolve(false);
                return;
        }

        console.log(`Running: ${installCommand}`);
        console.log('This may take a few minutes...\n');

        const child = exec(installCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Installation failed:', error.message);
                reject(error);
            } else {
                console.log('\n✅ Ollama installed successfully!');
                console.log('📋 You may need to restart your terminal or source your shell profile.');
                resolve(true);
            }
        });

        child.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        child.stderr.on('data', (data) => {
            process.stdout.write(data);
        });
    });
}

async function startOllama() {
    console.log('\n🚀 Starting Ollama server...');

    return new Promise((resolve) => {
        const child = spawn('ollama', ['serve'], {
            detached: true,
            stdio: 'ignore'
        });

        child.unref();

        setTimeout(async () => {
            const isRunning = await checkOllamaRunning();
            if (isRunning) {
                console.log('✅ Ollama server started successfully');
                resolve(true);
            } else {
                console.log('⚠️  Ollama server may not have started properly');
                console.log('   You can manually start it with: ollama serve');
                resolve(false);
            }
        }, 3000);
    });
}

async function checkOllamaRunning() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
            console.log('✅ Ollama is running');
            return true;
        }
    } catch (error) {
        console.log('❌ Ollama is not running');
        return false;
    }
    return false;
}

async function pullModel(modelName) {
    return new Promise((resolve, reject) => {
        console.log(`📥 Pulling model: ${modelName}`);
        console.log('This may take a while...');

        const child = exec(`ollama pull ${modelName}`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                console.log(`\n✅ Model ${modelName} pulled successfully`);
                resolve(true);
            }
        });

        child.stdout.on('data', (data) => {
            process.stdout.write('.');
        });

        child.stderr.on('data', (data) => {
            process.stdout.write('.');
        });
    });
}

async function listModels() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        const models = data.models || [];

        if (models.length === 0) {
            return [];
        }

        return models.map(model => ({
            name: model.name,
            size: model.size,
            sizeGB: (model.size / 1024 / 1024 / 1024).toFixed(1),
            modified: model.modified_at
        }));
    } catch (error) {
        return [];
    }
}

async function displayAvailableModels() {
    console.log('\n🌟 Popular models you can install:');

    const recommendedModels = [
        {
            name: 'qwen3',
            description: 'Best for coding tasks and programming',
            size: '~5.2GB',
            command: 'ollama pull qwen3:8b',
            useCase: 'Perfect for: JavaScript, Python, React, debugging, code generation'
        },
        {
            name: 'llama3.2',
            description: 'General purpose, excellent for conversations',
            size: '~2.0GB',
            command: 'ollama pull llama3.3:latest',
            useCase: 'Perfect for: Writing, analysis, general questions, explanations'
        },
        {
            name: 'Gemma3n',
            description: 'General purpose, balanced',
            size: '~7.5GB',
            command: 'ollama pull gemma3n:latest',
            useCase: 'Gemini 1.5 pro like performance'
        }
    ];

    recommendedModels.forEach((model, index) => {
        console.log(`\n${index + 1}. 🤖 ${model.name} (${model.size})`);
        console.log(`   📝 ${model.description}`);
        console.log(`   🎯 ${model.useCase}`);
        console.log(`   📦 Install: ${model.command}`);
    });

    console.log('\n💡 Recommendations:');
    console.log('   🔧 For coding projects → qwen3');
    console.log('   💬 For general use → llama3.2');
}

async function selectModel(models) {
    if (models.length === 0) {
        return null;
    }

    console.log('\n📋 Currently installed models:');
    models.forEach((model, index) => {
        let description = '';
        const modelName = model.name.toLowerCase();

        if (modelName.includes('codellama') || modelName.includes('qwen3')) {
            description = ' - 🔧 Best for coding';
        } else if (modelName.includes('llama')) {
            description = ' - 💬 Great for conversations';
        } else if (modelName.includes('mistral')) {
            description = ' - ⚡ Fast and efficient';
        } else if (modelName.includes('phi')) {
            description = ' - 🏃 Lightweight and quick';
        } else if (modelName.includes('deepseek')) {
            description = ' - 🧠 Advanced coding specialist';
        } else if (modelName.includes('gemma')) {
            description = ' - 🏢 Google\'s model';
        }

        const modified = new Date(model.modified).toLocaleDateString();
        console.log(`   ${index + 1}. ${model.name} (${model.sizeGB}GB)${description}`);
        console.log(`      📅 Last used: ${modified} \n`);
    });

    console.log(`\n   ${models.length + 1}. 📥 Install a new model`);
    console.log(`   ${models.length + 2}. ⏭️  Skip model selection`);

    while (true) {
        const choice = await askQuestion(`\nSelect a model (1-${models.length + 2}): `);
        const choiceNum = parseInt(choice);

        if (choiceNum >= 1 && choiceNum <= models.length) {
            return models[choiceNum - 1].name;
        } else if (choiceNum === models.length + 1) {
            return 'install_new';
        } else if (choiceNum === models.length + 2) {
            return 'skip';
        } else {
            console.log('❌ Invalid choice. Please try again.');
        }
    }
}

async function installNewModel() {
    await displayAvailableModels();

    const modelName = await askQuestion('\n📥 Enter the model name to install (e.g., qwen3): ');

    if (!modelName.trim()) {
        console.log('❌ No model name provided');
        return null;
    }

    console.log(`\n🤔 About to install "${modelName}"`);
    console.log('⚠️  This may take several minutes and use multiple GB of storage.');
    console.log('💡 Make sure you have a stable internet connection.');

    const confirm = await askQuestion(`\nProceed with installation? (y/N): `);

    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        console.log('❌ Installation cancelled');
        return null;
    }

    try {
        await pullModel(modelName.trim());
        return modelName.trim();
    } catch (error) {
        console.log(`\n❌ Failed to install ${modelName}:`);
        console.log(`   ${error.message}`);
        console.log('\n💡 Common issues:');
        console.log('   - Check your internet connection');
        console.log('   - Verify the model name is correct');
        console.log('   - Try: ollama list (to see available models)');
        return null;
    }
}

async function renameAgentFile(modelName) {
    try {
        // Extract base model name (remove version tags like :7b, :latest)
        const baseModelName = modelName.split(':')[0].toLowerCase();
        const newFileName = `${baseModelName}-agent.js`;

        console.log(`\n🔄 Customizing agent for ${modelName}...`);

        // Check if terminal-agent.js exists
        const fs = require('fs');
        if (!fs.existsSync('terminal-agent.js')) {
            console.log('⚠️  terminal-agent.js not found, skipping rename');
            console.log('💡 Make sure you run this setup in the correct directory');
            return false;
        }

        // Check if target file already exists
        if (fs.existsSync(newFileName)) {
            const overwrite = await askQuestion(`🤔 ${newFileName} already exists. Overwrite? (y/N): `);
            if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
                console.log('❌ Skipping agent file rename');
                return false;
            }
        }

        // Rename the file
        await require('fs').promises.rename('terminal-agent.js', newFileName);
        console.log(`✅ Agent renamed to: ${newFileName}`);

        // Update package.json to reflect new filename
        await updatePackageJson(newFileName, baseModelName, modelName);

        console.log(`\n🎯 Your agent is now customized for ${modelName}!`);
        console.log(`\n📋 Available commands:`);
        console.log(`   🚀 node ${newFileName}              # Direct execution`);
        console.log(`   📦 npm start                       # Default start script`);
        console.log(`   🎯 npm run start:${baseModelName}     # Model-specific script`);
        if (baseModelName !== 'terminal') {
            console.log(`   🔗 ${baseModelName}-ai                    # Global command (if installed)`);
        }

        return true;
    } catch (error) {
        console.log(`❌ Could not rename agent file: ${error.message}`);
        return false;
    }
}

async function updatePackageJson(newFileName, baseModelName, fullModelName) {
    try {
        const fs = require('fs');

        // Read current package.json
        let packageJson;
        try {
            packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        } catch (error) {
            console.log('⚠️  Could not read package.json, creating basic structure');
            packageJson = {
                name: 'terminal-llm-agent',
                version: '1.0.0',
                scripts: {},
                dependencies: {}
            };
        }

        // Update main entry point
        packageJson.main = newFileName;

        // Update bin entries
        const binName = `${baseModelName}-ai`;
        packageJson.bin = packageJson.bin || {};
        packageJson.bin[binName] = `./${newFileName}`;
        packageJson.bin['terminal-ai'] = `./${newFileName}`; // Keep original for compatibility

        // Add/update scripts
        if (!packageJson.scripts) {
            packageJson.scripts = {};
        }
        packageJson.scripts[`start:${baseModelName}`] = `node ${newFileName}`;
        packageJson.scripts.start = `node ${newFileName}`; // Update default start
        packageJson.scripts.setup = packageJson.scripts.setup || 'node setup.js';
        packageJson.scripts.debug = packageJson.scripts.debug || 'node debug-models.js';

        // Update description to include model
        const modelDisplayName = baseModelName.charAt(0).toUpperCase() + baseModelName.slice(1);
        packageJson.description = `AI assistant powered by ${modelDisplayName} with terminal and file system access using Ollama`;

        // Add model metadata
        packageJson.llmModel = {
            name: baseModelName,
            fullName: fullModelName,
            filename: newFileName,
            setupDate: new Date().toISOString(),
            version: packageJson.version || '1.0.0'
        };

        // Ensure keywords include model-specific terms
        if (!packageJson.keywords) {
            packageJson.keywords = [];
        }
        const modelKeywords = [baseModelName, 'llm', 'ai', 'terminal', 'ollama', 'assistant'];
        modelKeywords.forEach(keyword => {
            if (!packageJson.keywords.includes(keyword)) {
                packageJson.keywords.push(keyword);
            }
        });

        // Update author if not set
        if (!packageJson.author) {
            packageJson.author = `${modelDisplayName} Agent User`;
        }

        // Set license if not set
        if (!packageJson.license) {
            packageJson.license = 'MIT';
        }

        // Write updated package.json with proper formatting
        await require('fs').promises.writeFile('package.json', JSON.stringify(packageJson, null, 2));
        console.log(`✅ Updated package.json for ${modelDisplayName}`);

        return true;
    } catch (error) {
        console.log(`⚠️  Could not update package.json: ${error.message}`);
        return false;
    }
}

async function setup() {
    console.log('🚀 Terminal LLM Agent Setup Wizard');
    console.log('==================================');
    console.log('🎯 This wizard will help you set up and customize your AI agent\n');

    // Step 1: Check Ollama installation
    console.log('📦 Step 1: Checking Ollama installation...');
    const ollamaInstalled = await checkOllama();

    if (!ollamaInstalled) {
        console.log('\n❌ Ollama is not installed.');
        console.log('💡 Ollama is required to run local AI models.');

        const shouldInstall = await askQuestion('🤔 Would you like to install Ollama now? (Y/n): ');

        if (shouldInstall.toLowerCase() === 'n' || shouldInstall.toLowerCase() === 'no') {
            console.log('\n📋 To install Ollama manually:');
            console.log('   🍎 macOS/Linux: curl -fsSL https://ollama.ai/install.sh | sh');
            console.log('   🪟 Windows: https://ollama.ai/download');
            console.log('\n🔄 After installation, run this setup again: npm run setup');
            rl.close();
            return;
        }

        try {
            const installed = await installOllama();
            if (!installed) {
                console.log('\n💡 Please install Ollama manually and run setup again.');
                rl.close();
                return;
            }
        } catch (error) {
            console.log('❌ Installation failed. Please install manually from https://ollama.ai');
            rl.close();
            return;
        }
    }

    // Step 2: Check if Ollama is running
    console.log('\n🔄 Step 2: Checking Ollama server status...');
    let ollamaRunning = await checkOllamaRunning();

    if (!ollamaRunning) {
        console.log('⚠️  Ollama server is not running.');
        const shouldStart = await askQuestion('🤔 Try to start Ollama server automatically? (Y/n): ');

        if (shouldStart.toLowerCase() !== 'n' && shouldStart.toLowerCase() !== 'no') {
            const started = await startOllama();
            if (!started) {
                console.log('\n📋 Please start Ollama manually in another terminal:');
                console.log('   ollama serve');
                console.log('\n🔄 Then run this setup again: npm run setup');
                rl.close();
                return;
            }
            ollamaRunning = true;
        } else {
            console.log('\n📋 Please start Ollama manually:');
            console.log('   ollama serve');
            console.log('\n🔄 Then run this setup again: npm run setup');
            rl.close();
            return;
        }
    }

    // Step 3: Model selection and installation
    console.log('\n🤖 Step 3: Setting up your AI model...');
    const models = await listModels();

    let selectedModel = null;

    if (models.length === 0) {
        console.log('❌ No AI models are currently installed.');
        console.log('💡 You need at least one model to use the agent.');

        await displayAvailableModels();

        const shouldInstall = await askQuestion('\n🤔 Would you like to install a model now? (Y/n): ');

        if (shouldInstall.toLowerCase() !== 'n' && shouldInstall.toLowerCase() !== 'no') {
            selectedModel = await installNewModel();
            if (!selectedModel) {
                console.log('\n⚠️  No model was installed. You can install one later with:');
                console.log('   ollama pull codellama');
                console.log('   ollama pull llama2');
            }
        } else {
            console.log('\n💡 You can install models later with: ollama pull <model-name>');
        }
    } else {
        console.log(`✅ Found ${models.length} installed model(s)`);
        const choice = await selectModel(models);

        if (choice === 'install_new') {
            selectedModel = await installNewModel();
            if (!selectedModel && models.length > 0) {
                selectedModel = models[0].name; // Fallback to first available
            }
        } else if (choice === 'skip') {
            selectedModel = models[0].name; // Use first available
        } else {
            selectedModel = choice;
        }
    }

    // Step 4: Save configuration and customize agent
    if (selectedModel) {
        console.log('\n💾 Step 4: Saving configuration...');

        const config = {
            model: selectedModel,
            ollamaUrl: 'http://localhost:11434',
            workingDirectory: process.cwd(),
            setupDate: new Date().toISOString(),
            version: '1.0.0'
        };

        try {
            await fs.writeFile('agent-config.json', JSON.stringify(config, null, 2));
            console.log(`✅ Configuration saved with model: ${selectedModel}`);

            // Step 5: Rename and customize agent file
            console.log('\n🎨 Step 5: Customizing agent for your model...');
            const renamed = await renameAgentFile(selectedModel);

            if (renamed) {
                console.log('✅ Agent customization completed successfully!');
            } else {
                console.log('⚠️  Agent customization had issues, but you can still use the generic agent');
            }

        } catch (error) {
            console.log('⚠️  Could not save configuration file:', error.message);
        }
    } else {
        console.log('\n⚠️  No model selected. You can configure one later by running setup again.');
    }

    // Step 6: Final summary and next steps
    console.log('\n🎉 Setup Complete!');
    console.log('==================');

    if (selectedModel) {
        const baseModelName = selectedModel.split(':')[0].toLowerCase();
        const agentFileName = `${baseModelName}-agent.js`;
        const modelDisplayName = baseModelName.charAt(0).toUpperCase() + baseModelName.slice(1);

        console.log(`\n✨ Your ${modelDisplayName} agent is ready to use!`);
        console.log('\n📋 Quick Start Commands:');
        console.log(`   🎯 node ${agentFileName}         # Direct execution`);
        console.log(`   📦 npm run start:${baseModelName}   # Model-specific script`);

        function getModelOptimization(modelName) {
            const optimizations = {
                codellama: 'Coding tasks, debugging, code generation, technical documentation',
                llama2: 'General conversation, writing, analysis, explanations',
                mistral: 'Balanced performance, quick responses, general tasks',
                phi: 'Fast responses, lightweight operations, resource efficiency',
                'deepseek-coder': 'Advanced coding, algorithms, code optimization',
                gemma: 'Google-optimized tasks, research, analysis'
            };

            return optimizations[modelName] || 'General purpose tasks';
        }

        console.log(`\n🔧 Your agent specializes in: ${getModelOptimization(baseModelName)}`);

    } else {
        console.log('\n📋 Next Steps:');
        console.log('   1. Install a model: ollama pull codellama');
        console.log('   2. Run setup again: npm run setup');
        console.log('   3. Start using: npm start');
    }

    console.log('\n💡 Pro Tips:');
    console.log('   • Be specific in your requests for better results');
    console.log('   • The agent remembers context within each session');
    console.log('   • Use "help" in interactive mode for available commands');
    console.log('   • Check README.md for comprehensive documentation');

    console.log('\n🆘 Need Help?');
    console.log('   • Run: npm run debug (for diagnostics)');
    console.log('   • Check: README.md (for full documentation)');
    console.log('   • Try: examples/ (for usage patterns)');

    console.log(`\n🎯 Ready to start? Run: ${selectedModel ? 'npm start' : 'npm run setup'}`);

    rl.close();
}

// Handle process interruption gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Setup interrupted by user');
    console.log('💡 You can resume setup anytime by running: npm run setup');
    rl.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n👋 Setup terminated');
    rl.close();
    process.exit(0);
});

// Handle unexpected errors
process.on('uncaughtException', (error) => {
    console.error('\n💥 Unexpected error during setup:', error.message);
    console.log('🔧 Please try running setup again: npm run setup');
    console.log('🆘 If the problem persists, check:');
    console.log('   • Internet connection');
    console.log('   • Ollama installation');
    console.log('   • File permissions');
    rl.close();
    process.exit(1);
});

// Start the setup wizard
setup().catch((error) => {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   • Make sure you have internet connection');
    console.log('   • Check if Ollama is properly installed');
    console.log('   • Verify you have write permissions in this directory');
    console.log('   • Try running: npm run debug');
    rl.close();
    process.exit(1);
});

// Export functions for potential reuse
module.exports = {
    checkOllama,
    checkOllamaRunning,
    listModels,
    installOllama,
    startOllama,
    pullModel,
    renameAgentFile,
    updatePackageJson,
    setup
};
SETUP_EOF

chmod +x setup.js
echo "✅ Created setup.js"

# Create README
echo "📝 Creating README..."
cat > README.md << 'README_EOF'
# Terminal LLM Agent

An AI assistant that can execute terminal commands and manipulate files using Ollama.

## 🚀 Quick Start

1. **First time setup:**
   ```bash
   npm run setup
   ```

2. **Start the agent:**
   ```bash
   npm start
   ```

3. **Try some commands:**
   - "Create a package.json file"
   - "List all files in this directory"
   - "Run npm install"
   - "Create a Python script that prints hello world"

## 📋 Available Commands

### NPM Scripts
```bash
npm start        # Start the interactive agent
npm run setup    # Run setup wizard
npm run debug    # Debug Ollama/models
```

### Direct Usage
```bash
node terminal-agent.js                    # Interactive mode
node terminal-agent.js "create a file"    # Single command
node terminal-agent.js --model llama2     # Use specific model
```

## 🎯 Usage Examples

### Interactive Mode
```bash
npm start

💻 [myproject] > Create a React component called Button
💻 [myproject] > List all JavaScript files
💻 [myproject] > Run npm test
```

### Single Commands
```bash
node terminal-agent.js "initialize a git repository"
node terminal-agent.js "create a basic Express.js server"
```

## 🛠️ Interactive Commands

While in interactive mode:
- `exit` - Quit the agent
- `help` - Show available commands
- `pwd` - Show current directory

## 🔧 Requirements

- Node.js 14+
- Ollama installed and running
- At least one Ollama model (codellama, llama2, etc.)

## 🚀 Installation

1. **Install Ollama:**
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.ai/install.sh | sh

   # Windows: Download from https://ollama.ai/download
   ```

2. **Start Ollama:**
   ```bash
   ollama serve
   ```

3. **Install a model:**
   ```bash
   ollama pull codellama    # For coding tasks
   ollama pull llama2       # For general use
   ```

4. **Run setup:**
   ```bash
   npm run setup
   ```

## 🔍 Troubleshooting

### Common Issues

**Agent won't start:**
```bash
# Check Ollama is running
ollama serve

# Verify models are installed
ollama list

# Re-run setup
npm run setup
```

**Model not found:**
```bash
# Install a model
ollama pull codellama

# Debug models
npm run debug
```

**Connection issues:**
```bash
# Restart Ollama
pkill ollama
ollama serve
```

## 📚 Examples

Run the basic example:
```bash
node examples/basic-example.js
```

## 🛡️ Security Features

- **Path Validation**: Prevents directory traversal attacks
- **Sandboxed Operations**: File operations stay within working directory
- **Command Timeouts**: Automatic timeout for long commands
- **Operation Logging**: All actions are logged

## 📊 Performance Tips

- Be specific in your requests for better results
- The agent remembers context within each session
- Use clear, direct language for commands

## 📄 License

MIT License - feel free to modify and distribute!

## 🆘 Support

- Run `npm run debug` for diagnostics
- Check that Ollama is running: `ollama serve`
- Verify models are installed: `ollama list`

---

**Happy coding with AI! 🤖✨**
README_EOF

echo "✅ README created"

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📁 Project created at: $PROJECT_PATH"
echo "📄 Files created:"
echo "   ✅ package.json"
echo "   ✅ terminal-agent.js (complete working agent)"
echo "   ✅ setup.js (setup wizard)"
echo "   ✅ README.md"
echo "   ✅ node_modules/ (dependencies installed)"
echo ""
echo "📋 Next steps:"
echo "   cd $PROJECT_NAME"
echo "   npm run setup     # Configure Ollama and models"
echo "   npm run terminal-agent        # Start the agent"
echo ""
echo "💡 Make sure you have:"
echo "   • Ollama installed and running (ollama serve)"
echo "   • At least one model installed (ollama pull codellama)"
echo ""
echo "🎯 Quick start:"
echo "   1. cd $PROJECT_NAME"
echo "   2. npm run setup"
echo "   3. npm run terminal-agent"
echo ""
echo "📖 Check README.md for complete usage guide"