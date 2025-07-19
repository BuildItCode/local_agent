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
            parameters: {command: 'string', timeout: 'number (optional, default 30000ms)'},
            handler: async (params) => {
                const {command, timeout = 30000} = params;

                console.log(`🔧 Executing: ${command}`);

                return new Promise((resolve, reject) => {
                    const child = exec(command, {
                        cwd: this.workingDirectory,
                        timeout: timeout,
                        maxBuffer: 1024 * 1024 // 1MB buffer
                    }, (error, stdout, stderr) => {
                        if (error) {
                            resolve({
                                success: false,
                                error: error.message,
                                stdout: stdout || '',
                                stderr: stderr || '',
                                command: command
                            });
                        } else {
                            resolve({
                                success: true,
                                stdout: stdout || '',
                                stderr: stderr || '',
                                command: command
                            });
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
                // If no tool was used but the user seemed to request an action, remind about tool usage
                if (this.seemsLikeActionRequest(message) && !this.containsToolCall(assistantMessage)) {
                    console.log('\n⚠️  No tool was used. The AI should have used tools for this request.');
                    console.log('🔄 Trying again with more explicit instructions...');

                    const retryPrompt = `The user said: "${message}"

This seems like a request for action. You MUST use the appropriate tool to perform this action immediately. Do not explain how to do it - actually do it using the tools.

Respond ONLY with the appropriate tool call in JSON format.`;

                    const retryResponse = await fetch(`${this.baseUrl}/api/chat`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: this.model,
                            messages: [
                                {role: 'system', content: this.systemPrompt},
                                {role: 'user', content: retryPrompt}
                            ],
                            stream: false,
                            options: {
                                temperature: 0.05, // Even lower temperature
                            }
                        }),
                    });

                    const retryData = await retryResponse.json();
                    const retryToolResult = await this.handleToolCall(retryData.message.content);

                    if (retryToolResult) {
                        assistantMessage = `Successfully executed the requested action.`;
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
            'npm', 'git', 'pip', 'yarn', 'node'
        ];

        const lowerMessage = message.toLowerCase();
        return actionWords.some(word => lowerMessage.includes(word));
    }

    // Helper function to check if response contains a tool call
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

            if (!jsonMatch) return null;

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
            } else {
                console.log(`❌ Tool execution failed: ${result.error}`);
            }

            return result;
        } catch (e) {
            console.log(`⚠️  Error parsing tool call: ${e.message}`);
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
                            askForChoice();
                    }
                });
            };

            askForChoice();
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
                        showDirectory();
                    } else if (choiceNum >= 1 && choiceNum <= directories.length) {
                        // Go to selected directory
                        currentPath = path.join(currentPath, directories[choiceNum - 1].name);
                        showDirectory();
                    } else {
                        console.log('❌ Invalid choice. Please try again.');
                        showDirectory();
                    }
                });

            } catch (error) {
                console.log(`❌ Error reading directory: ${error.message}`);
                console.log('Returning to parent directory...');
                currentPath = path.dirname(currentPath);
                showDirectory();
            }
        };

        showDirectory();
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