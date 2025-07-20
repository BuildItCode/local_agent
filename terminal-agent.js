#!/usr/bin/env node

const {exec, spawn} = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const readline = require('readline');

// UI Enhancement imports
const chalk = require('chalk');
const marked = require('marked');
const TerminalRenderer = require('marked-terminal');
const ora = require('ora');
const boxen = require('boxen');
const gradient = require('gradient-string');
const figlet = require('figlet');
const Table = require('cli-table3');

// Configure marked to use terminal renderer
marked.setOptions({
    renderer: new TerminalRenderer({
        firstHeading: chalk.bold.underline.cyan,
        heading: chalk.bold.cyan,
        code: chalk.gray,
        blockquote: chalk.italic.gray,
        codespan: chalk.yellow,
        strong: chalk.bold,
        em: chalk.italic,
        link: chalk.blue.underline,
        href: chalk.blue.underline,
        list: (body) => body,
        listitem: (text) => `  ${chalk.green('•')} ${text}\n`,
        paragraph: (text) => text + '\n',
        table: (header, body) => {
            return chalk.gray(header + body);
        }
    })
});

// Handle fetch for older Node.js versions
let fetch;
if (typeof globalThis.fetch === 'undefined') {
    try {
        fetch = require('node-fetch');
    } catch (error) {
        console.error(chalk.red('❌ node-fetch is required for Node.js < 18. Install with: npm install node-fetch'));
        process.exit(1);
    }
} else {
    fetch = globalThis.fetch;
}

// Terminal UI Helper Class
class TerminalUI {
    constructor() {
        this.spinner = null;
        this.theme = {
            primary: chalk.cyan,
            secondary: chalk.magenta,
            success: chalk.green,
            error: chalk.red,
            warning: chalk.yellow,
            info: chalk.blue,
            muted: chalk.gray,
            highlight: chalk.bgCyan.black,
            prompt: chalk.bold.cyan,
            command: chalk.yellow,
            output: chalk.white,
            file: chalk.green,
            directory: chalk.blue.bold,
            tool: chalk.magenta
        };
    }

    async showBanner() {
        console.clear();
        const banner = figlet.textSync('LLM Agent', {
            font: 'ANSI Shadow',
            horizontalLayout: 'default',
            verticalLayout: 'default'
        });

        console.log(gradient.rainbow(banner));
        console.log(chalk.gray('─'.repeat(process.stdout.columns || 80)));
        console.log(this.theme.muted('  Powered by Ollama • Terminal AI Assistant\n'));
    }

    formatMessage(text, style = 'default') {
        // Strip think tags and collapse newlines
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        text = text.replace(/\n{3,}/g, '\n\n');

        const useMarkdown = text.includes('#') || text.includes('*') || text.includes('```');

        const formatted = useMarkdown
            ? marked.parse(text)
            : text; // Use plain text

        switch (style) {
            case 'assistant':
                return this.theme.output(formatted);
            case 'user':
                return this.theme.prompt(text);
            case 'error':
                return this.theme.error(formatted);
            case 'success':
                return this.theme.success(formatted);
            default:
                return formatted;
        }
    }


    showBox(title, content, style = 'single') {
        const boxContent = boxen(content, {
            title: title,
            titleAlignment: 'center',
            padding: 1,
            margin: 1,
            borderStyle: style,
            borderColor: 'cyan'
        });
        console.log(boxContent);
    }

    startSpinner(text) {
        if (this.spinner && this.spinner.isSpinning) {
            this.spinner.text = text;
            return;
        }

        this.spinner = ora({
            text,
            spinner: 'dots',
            discardStdin: false,
        }).start();
    }

    updateSpinner(text, color = 'cyan') {
        if (this.spinner && this.spinner.isSpinning) {
            this.spinner.color = color;
            this.spinner.text = text;
        }
    }

    stopSpinner(success = true, text = '') {
        if (!this.spinner) return;

        if (this.spinner.isSpinning) {
            if (success) {
                this.spinner.succeed(text);
            } else {
                this.spinner.fail(text);
            }
        }

        this.spinner = null;
    }

    formatFileList(items) {
        const table = new Table({
            head: ['Type', 'Name', 'Size', 'Modified'],
            style: {
                head: ['cyan'],
                border: ['gray']
            },
            colWidths: [10, 40, 15, 25]
        });

        items.forEach(item => {
            const icon = item.type === 'directory' ? '📁' : '📄';
            const name = item.type === 'directory'
                ? this.theme.directory(item.name)
                : this.theme.file(item.name);
            const size = item.type === 'directory' ? '-' : this.formatBytes(item.size);
            const modified = new Date(item.modified).toLocaleString();

            table.push([icon, name, size, modified]);
        });

        return table.toString();
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatToolExecution(toolName, params, result) {
        const lines = [];

        lines.push(this.theme.tool(`\n╭─ Tool: ${toolName}`));

        if (Object.keys(params).length > 0) {
            lines.push(this.theme.muted('├─ Parameters:'));
            Object.entries(params).forEach(([key, value]) => {
                lines.push(this.theme.muted(`│  ${key}: ${this.theme.command(value)}`));
            });
        }

        if (result.success) {
            lines.push(this.theme.success('├─ Status: ✓ Success'));
            if (result.message) {
                lines.push(this.theme.muted(`├─ ${result.message}`));
            }

            // Special formatting for command output
            if (result.stdout && result.stdout.trim()) {
                lines.push(this.theme.muted('├─ Output:'));
                result.stdout.trim().split('\n').forEach(line => {
                    lines.push(this.theme.output(`│  ${line}`));
                });
            }
        } else {
            lines.push(this.theme.error('├─ Status: ✗ Failed'));
            if (result.error) {
                lines.push(this.theme.error(`├─ Error: ${result.error}`));
            }
            if (result.stderr && result.stderr.trim()) {
                lines.push(this.theme.error('├─ Error output:'));
                result.stderr.trim().split('\n').forEach(line => {
                    lines.push(this.theme.error(`│  ${line}`));
                });
            }
        }

        lines.push(this.theme.tool('╰─────\n'));

        return lines.join('\n');
    }

    showWelcome(model, workingDir) {
        const tips = [
            'Create files and folders with natural language',
            'Run shell commands by just asking',
            'Search for files using patterns',
            'Get help anytime by typing "help"',
            'Use markdown in your prompts for better formatting'
        ];

        const welcomeBox = boxen(
            `${this.theme.primary('Model:')} ${model}\n` +
            `${this.theme.primary('Directory:')} ${workingDir}\n\n` +
            `${this.theme.secondary('Quick Tips:')}\n` +
            tips.map(tip => `  ${this.theme.success('•')} ${tip}`).join('\n'),
            {
                title: '🚀 Ready to assist!',
                titleAlignment: 'center',
                padding: 1,
                borderStyle: 'round',
                borderColor: 'cyan'
            }
        );

        console.log(welcomeBox);
    }

    formatCode(code, language = 'javascript') {
        const lines = code.split('\n');
        const formatted = lines.map((line, i) => {
            const lineNum = this.theme.muted(String(i + 1).padStart(3, ' ') + ' │ ');
            return lineNum + this.theme.command(line);
        }).join('\n');

        return boxen(formatted, {
            title: `📝 ${language}`,
            titleAlignment: 'left',
            padding: 0,
            borderStyle: 'single',
            borderColor: 'gray'
        });
    }

    showProgress(current, total, label = 'Progress') {
        const width = 30;
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round((current / total) * width);
        const empty = width - filled;

        const bar = `${this.theme.success('█'.repeat(filled))}${this.theme.muted('░'.repeat(empty))}`;
        const text = `${label}: ${bar} ${percentage}%`;

        process.stdout.write('\r' + text);

        if (current >= total) {
            console.log(''); // New line when complete
        }
    }

    showError(title, message) {
        this.showBox(
            `❌ ${title}`,
            this.theme.error(message),
            'double'
        );
    }

    showSuccess(title, message) {
        this.showBox(
            `✅ ${title}`,
            this.theme.success(message),
            'round'
        );
    }

    showInfo(title, message) {
        this.showBox(
            `ℹ️  ${title}`,
            this.theme.info(message),
            'single'
        );
    }

    showModelInfo(models) {
        const modelData = models.map((model, index) => {
            const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
            let description = '';

            if (model.name.includes('code')) {
                description = '🔧 Best for coding';
            } else if (model.name.includes('llama')) {
                description = '💬 Great for conversations';
            } else if (model.name.includes('mistral')) {
                description = '⚡ Fast and efficient';
            } else if (model.name.includes('phi')) {
                description = '🏃 Lightweight';
            } else if (model.name.includes('gemma')) {
                description = '🏢 Google\'s model';
            }

            return `${this.theme.primary(`${index + 1}.`)} ${this.theme.secondary(model.name)} (${sizeGB}GB)\n   ${description}`;
        }).join('\n\n');

        this.showBox('Available Models', modelData, 'double');
    }
}


class TerminalLLMAgent {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:11434';
        this.model = options.model || this.loadConfigModel() || null;
        this.workingDirectory = options.workingDirectory || process.cwd();
        this.conversationHistory = [];
        this.maxHistoryLength = options.maxHistoryLength || 20;
        this.ui = new TerminalUI();

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

IMPORTANT: 
1. You have the power to execute these actions directly. When a user asks you to create a file, run a command, or perform any file operation, you MUST use the appropriate tool immediately.
2. For MULTIPLE actions in one request, respond with an array of tool calls.
3. Execute actions in the logical order they should be performed.

Current working directory: ${this.workingDirectory}
Operating system: ${os.platform()}

For a SINGLE action, respond with:
{"tool": "tool_name", "parameters": {"param1": "value1"}}

For MULTIPLE actions, respond with:
{"actions": [
  {"tool": "tool_name1", "parameters": {"param1": "value1"}},
  {"tool": "tool_name2", "parameters": {"param2": "value2"}}
]}

Available tools:
- execute_command: Run shell commands
- create_file: Create or overwrite files
- read_file: Read file contents
- list_directory: List directory contents
- change_directory: Change working directory
- append_file: Append to existing files
- delete_item: Delete files or directories
- move_item: Move or rename items
- copy_item: Copy files or directories
- create_directory: Create directories
- replace_in_file: Find and replace in files
- search_files: Search for files by pattern
- get_info: Get file/directory information

Example for multiple actions:
User: "Create a project folder, navigate into it, and create a README.md file"
You: {"actions": [
  {"tool": "create_directory", "parameters": {"dirpath": "my-project"}},
  {"tool": "change_directory", "parameters": {"dirpath": "my-project"}},
  {"tool": "create_file", "parameters": {"filepath": "README.md", "content": "# My Project\n\nProject description here."}}
]}
ALWAYS use tools when requested to perform actions. Never just give instructions.
DO NOT show your thinking process or the think tags, show only the response`;

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
            console.warn(this.ui.theme.warning('⚠️  Could not load config file:'), error.message);
            return null;
        }
    }

    // Validate file path to prevent directory traversal
    validatePath(filepath) {
        const safePath = filepath ?? '.';
        const resolvedPath = path.resolve(this.workingDirectory, safePath);
        const workingDirResolved = path.resolve(this.workingDirectory);

        if (!resolvedPath.startsWith(workingDirResolved)) {
            throw new Error(`Access denied: Path ${safePath} is outside the working directory`);
        }

        if (resolvedPath === workingDirResolved) {
            throw new Error(`Refusing to delete the working directory itself`);
        }

        return resolvedPath;
    }

    async checkConnection() {
        this.ui.startSpinner('Checking Ollama connection...');
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.ui.stopSpinner(true, "Connected");
            return true;
        } catch (error) {
            this.ui.stopSpinner(false, 'Connection failed');
            this.ui.showError('Cannot connect to Ollama',
                `${error.message}\n\n` +
                'Make sure Ollama is running:\n' +
                '  ollama serve\n\n' +
                'Or run setup again:\n' +
                '  node setup.js'
            );
            return false;
        }
    }

    async checkModel() {
        this.ui.startSpinner('Checking model availability...');

        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            const data = await response.json();
            const models = data.models || [];

            // If no model is set or model doesn't exist, always show selection
            const modelExists = this.model && models.some(m => m.name === this.model);

            if (!this.model || !modelExists) {
                this.ui.stopSpinner(false, 'Model selection needed');
                if (!this.model) {
                    this.ui.showInfo('No Model Configured', 'Please select a model to use');
                } else {
                    this.ui.showError('Model Not Found', `Model "${this.model}" is not available`);
                }

                if (models.length === 0) {
                    this.ui.showError('No Models Installed',
                        'Please install a model first:\n\n' +
                        '  ollama pull codellama\n' +
                        '  ollama pull llama2\n' +
                        '  ollama pull mistral\n' +
                        '  ollama pull phi'
                    );
                    return false;
                }

                this.ui.showModelInfo(models);

                // Let user select from available models
                const selectedModel = await this.selectAvailableModel(models);
                if (selectedModel) {
                    this.model = selectedModel;
                    await this.saveModelToConfig(selectedModel);
                    this.ui.showSuccess('Model Selected', `Using model: ${this.model}`);
                    return true;
                } else {
                    return false;
                }
            }
            this.ui.stopSpinner(true, `Model ${this.model} ready!`);
            return true;
        } catch (error) {
            this.ui.stopSpinner(false, 'Model check failed');
            this.ui.showError('Could not verify model', error.message);
            return false;
        }
    }

    async selectAvailableModel(models) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        this.ui.showModelInfo(models);

        return new Promise((resolve) => {
            const askForSelection = () => {
                rl.question(`\nSelect a model (1-${models.length}) or 'q' to quit: `, (answer) => {
                    if (answer.toLowerCase() === 'q') {
                        console.log(this.ui.theme.warning('👋 Exiting...'));
                        rl.close();
                        resolve(null);
                        return;
                    }

                    const choice = parseInt(answer);
                    if (choice >= 1 && choice <= models.length) {
                        const selectedModel = models[choice - 1].name;
                        console.log(this.ui.theme.success(`🎯 Selected: ${selectedModel}`));
                        rl.close();
                        resolve(selectedModel);
                    } else {
                        console.log(this.ui.theme.error('❌ Invalid choice. Please try again.'));
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
                    console.warn(this.ui.theme.warning('⚠️  Could not read existing config, creating new one'));
                }
            }

            // Update with selected model
            config.model = modelName;
            config.ollamaUrl = this.baseUrl;
            config.workingDirectory = this.workingDirectory;
            config.lastUpdated = new Date().toISOString();

            await require('fs').promises.writeFile('agent-config.json', JSON.stringify(config, null, 2));
            console.log(this.ui.theme.success(`💾 Saved model "${modelName}" to config file`));
        } catch (error) {
            console.warn(this.ui.theme.warning('⚠️  Could not save config file:'), error.message);
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

                this.ui.updateSpinner(`Executing: ${command}`, 'yellow');

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
                    let dots = 0;
                    if (command.includes('npx') || command.includes('npm install') || command.includes('git clone')) {
                        progressTimer = setInterval(() => {
                            dots = (dots + 1) % 4;
                            this.ui.updateSpinner(`Executing: ${command}${'.'.repeat(dots)}`, 'yellow');
                        }, 500);
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
                const {filepath = '.', content, encoding = 'utf8'} = params;

                try {
                    const fullPath = this.validatePath(filepath);
                    this.ui.updateSpinner(`Creating file: ${filepath}`, 'green');

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
                const {filepath = '.', encoding = 'utf8'} = params;

                try {
                    const fullPath = this.validatePath(filepath);
                    this.ui.updateSpinner(`Reading file: ${filepath}`, 'blue');

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
                    this.ui.updateSpinner(`Listing directory: ${dirpath}`, 'magenta');

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
                    this.ui.updateSpinner(`Changing directory to: ${dirpath}`, 'cyan');

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
                    this.ui.updateSpinner(`Appending to file: ${filepath}`, 'green');

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

        /**
         * Additional tools for LLM system interaction
         * Extends the existing tool framework with file management,
         * search, and system utilities
         */

// Delete file or directory
        this.tools.set('delete_item', {
            description: 'Delete a file in the working directory. Does NOT delete directories.',
            parameters: {
                filepath: 'string — Relative or absolute path to the file to delete'
            },
            handler: async (params) => {
                const filepath = typeof params.filepath === 'string' ? params.filepath : params.item ?? null;

                if (!filepath) {
                    return {
                        success: false,
                        error: 'No filepath provided'
                    };
                }

                try {
                    const fullPath = this.validatePath(filepath);
                    const stats = await fs.stat(fullPath);

                    if (stats.isDirectory()) {
                        return {
                            success: false,
                            error: `Path is a directory: ${fullPath}`,
                        };
                    }

                    this.ui.updateSpinner(`Deleting file: ${filepath}`, 'red');

                    await fs.unlink(fullPath);

                    return {
                        success: true,
                        filepath: fullPath,
                        type: 'file',
                        message: 'File deleted successfully'
                    };
                } catch (error) {
                    return {
                        success: false,
                        filepath,
                        error: error.message
                    };
                }
            }
        });

        this.tools.set('delete_folder', {
            description: 'Delete a folder (directory) and its contents, if recursive is true.',
            parameters: {
                folderpath: 'string — Relative or absolute path to the folder to delete',
                recursive: 'boolean (optional) — Whether to delete non-empty folders (default: false)'
            },
            handler: async (params) => {
                const folderpath = typeof params.folderpath === 'string' ? params.folderpath : params.filepath ?? params.item ?? null;
                const recursive = params.recursive === true;

                if (!folderpath) {
                    return {
                        success: false,
                        error: 'No folder path provided'
                    };
                }

                try {
                    const fullPath = this.validatePath(folderpath);
                    const stats = await fs.stat(fullPath);

                    if (!stats.isDirectory()) {
                        return {
                            success: false,
                            error: `Path is not a directory: ${fullPath}`,
                        };
                    }

                    // Optional safety check
                    const workingDirResolved = path.resolve(this.workingDirectory);
                    if (fullPath === workingDirResolved) {
                        return {
                            success: false,
                            error: 'Refusing to delete the root working directory'
                        };
                    }

                    this.ui.updateSpinner(`Deleting folder: ${folderpath}`, 'red');

                    if (recursive) {
                        await fs.rm(fullPath, {recursive: true, force: true});
                    } else {
                        await fs.rmdir(fullPath);
                    }

                    return {
                        success: true,
                        folderpath: fullPath,
                        recursive,
                        message: `Folder deleted ${recursive ? 'recursively' : ''} successfully`
                    };
                } catch (error) {
                    return {
                        success: false,
                        folderpath,
                        recursive,
                        error: error.message
                    };
                }
            }
        });
        // Move or rename file/directory
        this.tools.set('move_item', {
            description: 'Move or rename a file or directory',
            parameters: {
                source: 'string',
                destination: 'string',
                overwrite: 'boolean (optional, default false)'
            },
            handler: async (params) => {
                const {source, destination, overwrite = false} = params;

                try {
                    const sourcePath = this.validatePath(source);
                    const destPath = this.validatePath(destination);

                    this.ui.updateSpinner(`Moving: ${source} → ${destination}`, 'yellow');

                    // Check if destination exists
                    try {
                        await fs.access(destPath);
                        if (!overwrite) {
                            return {
                                success: false,
                                error: 'Destination already exists. Set overwrite=true to replace.',
                                source: sourcePath,
                                destination: destPath
                            };
                        }
                    } catch (e) {
                        // Destination doesn't exist, which is fine
                    }

                    await fs.rename(sourcePath, destPath);

                    return {
                        success: true,
                        source: sourcePath,
                        destination: destPath,
                        message: 'Item moved successfully'
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        source: source,
                        destination: destination
                    };
                }
            }
        });

        // Copy file or directory
        this.tools.set('copy_item', {
            description: 'Copy a file or directory',
            parameters: {
                source: 'string',
                destination: 'string',
                overwrite: 'boolean (optional, default false)'
            },
            handler: async (params) => {
                const {source, destination, overwrite = false} = params;

                try {
                    const sourcePath = this.validatePath(source);
                    const destPath = this.validatePath(destination);

                    this.ui.updateSpinner(`Copying: ${source} → ${destination}`, 'blue');

                    // Check if destination exists
                    try {
                        await fs.access(destPath);
                        if (!overwrite) {
                            return {
                                success: false,
                                error: 'Destination already exists. Set overwrite=true to replace.',
                                source: sourcePath,
                                destination: destPath
                            };
                        }
                    } catch (e) {
                        // Destination doesn't exist, which is fine
                    }

                    const stats = await fs.stat(sourcePath);

                    if (stats.isDirectory()) {
                        await fs.cp(sourcePath, destPath, {recursive: true, force: overwrite});
                    } else {
                        await fs.copyFile(sourcePath, destPath);
                    }

                    return {
                        success: true,
                        source: sourcePath,
                        destination: destPath,
                        type: stats.isDirectory() ? 'directory' : 'file',
                        message: 'Item copied successfully'
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        source: source,
                        destination: destination
                    };
                }
            }
        });

        // Search for files by pattern
        this.tools.set('search_files', {
            description: 'Search for files matching a pattern',
            parameters: {
                pattern: 'string (glob pattern or regex)',
                directory: 'string (optional, default current directory)',
                maxDepth: 'number (optional, default 5)',
                type: 'string (optional: "file", "directory", or "all", default "all")'
            },
            handler: async (params) => {
                const {pattern, directory = '.', maxDepth = 5, type = 'all'} = params;
                const glob = (await import('glob')).glob;

                try {
                    const searchPath = this.validatePath(directory);
                    this.ui.updateSpinner(`Searching for: ${pattern}`, 'magenta');

                    const matches = await glob(pattern, {
                        cwd: searchPath,
                        maxDepth: maxDepth,
                        nodir: type === 'file',
                        onlyDirectories: type === 'directory'
                    });

                    // Get details for each match
                    const results = await Promise.all(matches.map(async (match) => {
                        try {
                            const fullPath = path.join(searchPath, match);
                            const stats = await fs.stat(fullPath);
                            return {
                                path: match,
                                fullPath: fullPath,
                                type: stats.isDirectory() ? 'directory' : 'file',
                                size: stats.size,
                                modified: stats.mtime
                            };
                        } catch (error) {
                            return {
                                path: match,
                                error: 'Could not read stats'
                            };
                        }
                    }));

                    return {
                        success: true,
                        pattern: pattern,
                        directory: searchPath,
                        count: results.length,
                        matches: results
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        pattern: pattern,
                        directory: directory
                    };
                }
            }
        });

        // Find and replace in file
        this.tools.set('replace_in_file', {
            description: 'Find and replace text in a file',
            parameters: {
                filepath: 'string',
                find: 'string (text or regex pattern)',
                replace: 'string',
                isRegex: 'boolean (optional, default false)',
                flags: 'string (optional regex flags, default "g")'
            },
            handler: async (params) => {
                const {filepath, find, replace, isRegex = false, flags = 'g'} = params;

                try {
                    const fullPath = this.validatePath(filepath);
                    this.ui.updateSpinner(`Replacing in file: ${filepath}`, 'yellow');

                    let content = await fs.readFile(fullPath, 'utf8');
                    const originalContent = content;

                    if (isRegex) {
                        const regex = new RegExp(find, flags);
                        content = content.replace(regex, replace);
                    } else {
                        // Escape special regex characters for literal replacement
                        const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(escapedFind, flags);
                        content = content.replace(regex, replace);
                    }

                    await fs.writeFile(fullPath, content, 'utf8');

                    const replacements = originalContent.length - content.length;

                    return {
                        success: true,
                        filepath: fullPath,
                        replacements: Math.abs(replacements),
                        message: `Replacement completed successfully`
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

        // Get file/directory info
        this.tools.set('get_info', {
            description: 'Get detailed information about a file or directory',
            parameters: {filepath: 'string'},
            handler: async (params) => {
                const {filepath} = params;

                try {
                    const fullPath = this.validatePath(filepath);
                    const stats = await fs.stat(fullPath);

                    this.ui.updateSpinner(`Getting info for: ${filepath}`, 'cyan');

                    const info = {
                        success: true,
                        path: fullPath,
                        exists: true,
                        type: stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other',
                        size: stats.size,
                        sizeHuman: this.formatBytes(stats.size),
                        created: stats.birthtime,
                        modified: stats.mtime,
                        accessed: stats.atime,
                        permissions: stats.mode.toString(8),
                        isReadable: true,
                        isWritable: true
                    };

                    // Additional info for directories
                    if (stats.isDirectory()) {
                        try {
                            const entries = await fs.readdir(fullPath);
                            info.itemCount = entries.length;
                        } catch (e) {
                            info.itemCount = 'unknown';
                        }
                    }

                    // Additional info for files
                    if (stats.isFile()) {
                        const ext = path.extname(fullPath).toLowerCase();
                        info.extension = ext;
                        info.basename = path.basename(fullPath);

                        // Try to detect file type
                        if (['.txt', '.md', '.log', '.json', '.js', '.py', '.html', '.css'].includes(ext)) {
                            info.likelyText = true;
                        } else if (['.jpg', '.png', '.gif', '.bmp', '.svg'].includes(ext)) {
                            info.likelyImage = true;
                        } else if (['.zip', '.tar', '.gz', '.rar'].includes(ext)) {
                            info.likelyArchive = true;
                        }
                    }

                    return info;
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        path: filepath,
                        exists: false
                    };
                }
            }
        });

        // Create directory
        this.tools.set('create_directory', {
            description: 'Create a directory (creates parent directories if needed)',
            parameters: {dirpath: 'string'},
            handler: async (params) => {
                const {dirpath} = params;

                try {
                    const fullPath = this.validatePath(dirpath);
                    this.ui.updateSpinner(`Creating directory: ${dirpath}`, 'green');

                    await fs.mkdir(fullPath, {recursive: true});

                    return {
                        success: true,
                        directory: fullPath,
                        message: 'Directory created successfully'
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

// Get environment variables
        this.tools.set('get_env', {
            description: 'Get environment variables',
            parameters: {
                name: 'string (optional, specific variable name)',
                filter: 'string (optional, filter pattern)'
            },
            handler: async (params) => {
                const {name, filter} = params;

                this.ui.updateSpinner('Getting environment variables', 'cyan');

                if (name) {
                    return {
                        success: true,
                        name: name,
                        value: process.env[name] || null,
                        exists: name in process.env
                    };
                }

                let envVars = {...process.env};

                // Apply filter if provided
                if (filter) {
                    const filtered = {};
                    const filterRegex = new RegExp(filter, 'i');
                    for (const [key, value] of Object.entries(envVars)) {
                        if (filterRegex.test(key)) {
                            filtered[key] = value;
                        }
                    }
                    envVars = filtered;
                }

                // Don't expose sensitive variables
                const sensitive = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'AUTH'];
                const sanitized = {};
                for (const [key, value] of Object.entries(envVars)) {
                    if (sensitive.some(s => key.toUpperCase().includes(s))) {
                        sanitized[key] = '***REDACTED***';
                    } else {
                        sanitized[key] = value;
                    }
                }

                return {
                    success: true,
                    count: Object.keys(sanitized).length,
                    variables: sanitized
                };
            }
        });

        // Execute code evaluation (for simple calculations/transformations)
        this.tools.set('evaluate_code', {
            description: 'Evaluate simple JavaScript code (use with caution)',
            parameters: {
                code: 'string',
                context: 'object (optional, variables to make available)'
            },
            handler: async (params) => {
                const {code, context = {}} = params;

                this.ui.updateSpinner('Evaluating code', 'yellow');

                try {
                    // Create a limited scope for evaluation
                    const AsyncFunction = Object.getPrototypeOf(async function () {
                    }).constructor;
                    const func = new AsyncFunction(...Object.keys(context), code);
                    const result = await func(...Object.values(context));

                    return {
                        success: true,
                        result: result,
                        type: typeof result,
                        message: 'Code evaluated successfully'
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        stack: error.stack
                    };
                }
            }
        });

        // Wrap all tool handlers with UI formatting
        for (const [name, tool] of this.tools.entries()) {
            const originalHandler = tool.handler;
            tool.handler = async (params) => {
                const result = await originalHandler(params);

                // Format tool output
                console.log(this.ui.formatToolExecution(name, params, result));

                // Special formatting for specific tools
                if (name === 'list_directory' && result.success) {
                    console.log(this.ui.formatFileList(result.items));
                }

                if (name === 'read_file' && result.success) {
                    const ext = path.extname(params.filepath);
                    if (['.js', '.py', '.json', '.html', '.css'].includes(ext)) {
                        console.log(this.ui.formatCode(result.content, ext.slice(1)));
                    } else {
                        // For regular text files, show in a box
                        this.ui.showInfo(`Content of ${params.filepath}`, result.content);
                    }
                }

                return result;
            };
        }

        // Utility function for formatting bytes
        this.formatBytes = (bytes, decimals = 2) => {
            if (bytes === 0) return '0 Bytes';

            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

            const i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        };
    }

// Enhanced handleToolCall to support multiple actions
    async handleMultipleToolCalls(response) {
        try {
            // First try to parse as multi-action format
            let multiActionMatch = response.match(/\{[^{}]*"actions"[^{}]*\[[\s\S]*?\]\s*\}/);

            if (multiActionMatch) {
                const multiAction = JSON.parse(multiActionMatch[0]);

                if (multiAction.actions && Array.isArray(multiAction.actions)) {
                    this.ui.showInfo('Multiple Actions', `Executing ${multiAction.actions.length} actions...`);

                    const results = [];
                    let allSuccess = true;

                    for (let i = 0; i < multiAction.actions.length; i++) {
                        const action = multiAction.actions[i];
                        console.log(this.ui.theme.primary(`\n[${i + 1}/${multiAction.actions.length}] ${action.tool}`));

                        if (!this.tools.has(action.tool)) {
                            console.log(this.ui.theme.error(`⚠️  Unknown tool: ${action.tool}`));
                            results.push({
                                tool: action.tool,
                                success: false,
                                error: `Unknown tool: ${action.tool}`
                            });
                            allSuccess = false;
                            continue;
                        }

                        const tool = this.tools.get(action.tool);

                        try {
                            const result = await tool.handler(action.parameters);
                            results.push({
                                tool: action.tool,
                                ...result
                            });

                            if (!result.success) {
                                allSuccess = false;
                            }
                        } catch (error) {
                            results.push({
                                tool: action.tool,
                                success: false,
                                error: error.message
                            });
                            allSuccess = false;
                        }
                    }

                    const successCount = results.filter(r => r.success).length;
                    if (allSuccess) {
                        this.ui.showSuccess('All Actions Completed',
                            `Successfully executed all ${results.length} actions`);
                    } else if (successCount > 0) {
                        this.ui.showInfo('Actions Partially Completed',
                            `${successCount} of ${results.length} actions succeeded`);
                    } else {
                        this.ui.showError('All Actions Failed',
                            'None of the requested actions could be completed');
                    }

                    return {
                        type: 'multiple',
                        success: allSuccess,
                        results: results,
                        summary: `Executed ${results.length} actions, ${successCount} succeeded`
                    };
                }
            }

            // Fall back to single action parsing
            return await this.handleSingleToolCall(response);

        } catch (e) {
            console.log(this.ui.theme.warning(`⚠️  Error parsing tool calls: ${e.message}`));
            return null;
        }
    }

// Rename original handleToolCall to handleSingleToolCall
    async handleSingleToolCall(response) {
        try {
            // Original single tool parsing logic
            let jsonMatch = response.match(/\{[^{}]*"tool"[^{}]*\}/);

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
                return null;
            }

            const toolCall = JSON.parse(jsonMatch[0]);

            if (!toolCall.tool || !this.tools.has(toolCall.tool)) {
                return null;
            }

            const tool = this.tools.get(toolCall.tool);

            const result = await tool.handler(toolCall.parameters);

            return {
                type: 'single',
                ...result
            };

        } catch (e) {
            return null;
        }
    }

    async chat(message) {
        try {
            this.ui.startSpinner('Thinking...');

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
                        temperature: 0.1,
                        top_p: 0.8,
                        top_k: 20,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.ui.updateSpinner('', 'yellow');

            const data = await response.json();
            let assistantMessage = data.message.content;

            // Use the new multi-action handler
            const toolResult = await this.handleMultipleToolCalls(assistantMessage);

            if (toolResult) {
                this.ui.updateSpinner('Generating summary...', 'green');

                // Generate appropriate follow-up based on result type
                let followUpPrompt;

                if (toolResult.type === 'multiple') {
                    followUpPrompt = `Multiple tool execution results:
${JSON.stringify(toolResult.results, null, 2)}

Please provide a brief, natural language summary of what was accomplished. Be concise and mention any failures. Do not show your thinking process only the response`;
                } else {
                    followUpPrompt = `Tool execution result: ${JSON.stringify(toolResult, null, 2)}

Please provide a brief, natural language summary of what was accomplished. Be concise and focus on the result. Do not show your thinking process only the response`;
                }

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
                                content: `You are a helpful assistant. Provide a brief summary of the tool execution result(s). Be concise and helpful. Do not show your thinking process only the response`
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
                // Retry logic for action requests
                if (this.seemsLikeActionRequest(message) && !this.containsToolCall(assistantMessage)) {
                    this.ui.updateSpinner('Retrying with clearer instructions...', 'yellow');

                    const retryPrompt = `The user said: "${message}"

This requires action(s). You MUST use the appropriate tool(s) immediately. 

If multiple actions are needed, use the multi-action format:
{"actions": [{"tool": "tool_name", "parameters": {...}}, ...]}

If only one action is needed, use:
{"tool": "tool_name", "parameters": {...}}`;

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
                    const retryToolResult = await this.handleMultipleToolCalls(retryData.message.content);

                    if (retryToolResult) {
                        assistantMessage = `Successfully executed the requested action(s).`;
                    } else {
                        assistantMessage = `I understand you want me to: ${message}. However, I had trouble executing the appropriate tools. Please try rephrasing your request.`;
                    }
                }
            }
            this.ui.stopSpinner(true, '');

            // Update conversation history
            this.conversationHistory.push({role: 'user', content: message});
            this.conversationHistory.push({role: 'assistant', content: assistantMessage});

            return this.ui.formatMessage(assistantMessage, 'assistant');
        } catch (error) {
            this.ui.stopSpinner(false, 'Error occurred');
            console.error(this.ui.theme.error('Error communicating with LLM:'), error);
            throw error;
        }
    }

// Update containsToolCall to check for both formats
    containsToolCall(response) {
        return (response.includes('"tool"') && response.includes('"parameters"')) ||
            (response.includes('"actions"') && response.includes('['));
    }

// Add helper to detect complex multi-action requests
    seemsLikeMultiActionRequest(message) {
        const multiActionIndicators = [
            ' and ', ' then ', ' after ', ' followed by ',
            ', then', 'first ', 'second ', 'finally ',
            'multiple ', 'several ', ' also ', ' as well'
        ];

        const lowerMessage = message.toLowerCase();
        return multiActionIndicators.some(indicator => lowerMessage.includes(indicator));
    }

// Enhanced action detection
    seemsLikeActionRequest(message) {
        const actionWords = [
            'create', 'make', 'build', 'generate', 'write',
            'run', 'execute', 'install', 'start', 'launch',
            'list', 'show', 'display', 'read', 'open',
            'delete', 'remove', 'move', 'copy', 'rename',
            'cd', 'ls', 'cat', 'touch', 'mkdir',
            'npm', 'git', 'pip', 'yarn', 'node', 'npx',
            'setup', 'initialize', 'scaffold'
        ];

        const lowerMessage = message.toLowerCase();
        return actionWords.some(word => lowerMessage.includes(word)) ||
            this.seemsLikeMultiActionRequest(message);
    }

    async startInteractiveMode() {
        // Return a promise that resolves when the rl interface is closed
        return new Promise(async (resolve) => {
            await this.ui.showBanner();

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

            this.ui.showWelcome(this.model, this.workingDirectory);

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: this.ui.theme.prompt(`\n💻 [${path.basename(this.workingDirectory)}] ❯ `),
                completer: (line) => {
                    const completions = [
                        'create', 'delete', 'list', 'read', 'run', 'help',
                        'exit', 'clear', 'cd', 'pwd', 'model', 'theme', 'models', 'switch', 'history'
                    ];
                    const hits = completions.filter(c => c.startsWith(line));
                    return [hits.length ? hits : completions, line];
                }
            });

            rl.on('line', async (input) => {
                try {
                    const message = input.trim();

                    if (message.toLowerCase() === 'exit') {
                        rl.close(); // This will trigger the 'close' event and resolve the promise.
                        return;
                    }

                    if (message.toLowerCase() === 'clear') {
                        console.clear();
                        await this.ui.showBanner();
                        this.ui.showWelcome(this.model, this.workingDirectory);
                    } else if (message.toLowerCase() === 'help') {
                        this.showEnhancedHelp();
                    } else if (message.toLowerCase() === 'pwd') {
                        this.ui.showInfo('Current Directory', this.workingDirectory);
                    } else if (message.toLowerCase() === 'cd') {
                        await this.selectWorkingDirectory();
                    } else if (message.toLowerCase() === 'model') {
                        this.ui.showInfo('Model Information', `Current model: ${this.model}\nOllama URL: ${this.baseUrl}`);
                    } else if (message.toLowerCase() === 'models') {
                        await this.listAllModels();
                    } else if (message.toLowerCase() === 'switch') {
                        const switched = await this.switchModel();
                        if (switched) this.ui.showSuccess('Model Switched', `Now using model: ${this.model}`);
                    } else if (message.toLowerCase() === 'history') {
                        this.showConversationHistory();
                    } else if (message) {
                        console.log('\n' + this.ui.theme.info('👤 You:'));
                        console.log(this.ui.formatMessage(message, 'user'));

                        const response = await this.chat(message);

                        console.log('\n' + this.ui.theme.tool('🤖 Assistant:'));
                        console.log(response);
                    }
                } catch (error) {
                    // This will catch errors from ANY command or async operation inside the handler.
                    this.ui.showError('An error occurred', error.message);
                    if (error.message.includes('connection refused')) {
                        console.error(this.ui.theme.warning('💡 Make sure Ollama is running: ollama serve'));
                    }
                }

                // This now runs safely, even if an error occurred above.
                rl.setPrompt(this.ui.theme.prompt(`\n💻 [${path.basename(this.workingDirectory)}] ❯ `));
                rl.prompt();
            });

            rl.on('close', () => {
                // Resolving the promise lets the main `await` finish.
                resolve();
            });

            // Show the initial prompt
            rl.prompt();
        });
    }


    /**
     * Display the last N messages from the conversation history.
     */
    showConversationHistory(limit = 10) {
        // Header
        const header = `📜 Conversation History (last ${limit} entries)`;
        this.ui.showInfo('History', header);

        const history = this.conversationHistory.slice(-limit);
        if (history.length === 0) {
            console.log(this.ui.formatMessage('No conversation history yet.', 'muted'));
            return;
        }

        history.forEach((msg, idx) => {
            const isUser = msg.role === 'user';
            // Prefix with a colored label
            const label = isUser
                ? this.ui.theme.prompt(`You   [${idx + 1}]:`)
                : this.ui.theme.tool(`Bot   [${idx + 1}]:`);

            // Render message content with appropriate style
            const content = this.ui.formatMessage(
                msg.content,
                isUser ? 'user' : 'assistant'
            );

            console.log(`${label} ${content}`);
        });
    }


    showEnhancedHelp() {
        const helpContent = `
# Terminal LLM Agent Commands

## Basic Commands
- **exit** - Quit the agent
- **clear** - Clear the screen  
- **help** - Show this help
- **theme** - Change color theme

## File Operations
- **"create [filename]"** - Create a new file
- **"delete [filename]"** - Delete a file
- **"read [filename]"** - Show file contents
- **"list files"** - List directory contents

## System Commands  
- **"run [command]"** - Execute shell command
- **"cd [directory]"** - Change directory
- **pwd** - Show current directory

## Model Commands
- **model** - Show current model
- **models** - List available models
- **switch** - Change model

## Examples
\`\`\`
"Create a Python script that prints hello world"
"Run npm init and install express"
"Create a README.md with project description"
\`\`\`
        `;

        console.log(this.ui.formatMessage(helpContent));
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
                                            await askForChoice();
                                            return;
                                        }
                                    } else {
                                        console.log('❌ Directory does not exist');
                                        await askForChoice();
                                        return;
                                    }
                                } catch (error) {
                                    console.log(`❌ Error: ${error.message}`);
                                    await askForChoice();
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
                    this.ui.showInfo('⚠️  Could not read existing config, creating new one');
                }
            }

            config.workingDirectory = this.workingDirectory;
            config.lastUpdated = new Date().toISOString();

            await require('fs').promises.writeFile('agent-config.json', JSON.stringify(config, null, 2));
            console.log(`💾 Saved working directory to config`);
        } catch (error) {
            this.ui.showInfo('⚠️  Could not save config file:', error.message);
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
            return await this.chat(command);
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