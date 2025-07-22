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
            tool: chalk.magenta,
            recommendation: chalk.yellow.bold
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
            : text;

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

    /**
     * Show a recommendation box with clear action description
     */
    showRecommendation(title, description, actions) {
        const actionsText = Array.isArray(actions)
            ? actions.map((action, i) => `${i + 1}. ${action}`).join('\n')
            : actions;

        const content = `${description}\n\n${this.theme.command('Proposed Actions:')}\n${actionsText}`;

        const boxContent = boxen(content, {
            title: `💡 ${title}`,
            titleAlignment: 'center',
            padding: 1,
            margin: 1,
            borderStyle: 'double',
            borderColor: 'yellow'
        });
        console.log(boxContent);
    }

    /**
     * Prompt user for confirmation with customizable options
     */
    async askConfirmation(question, options = ['yes', 'no']) {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const optionsText = options.map((opt, i) => `${i + 1}. ${opt}`).join(', ');
            const prompt = `${this.theme.recommendation('❓')} ${question}\n   Options: ${optionsText}\n   Choice: `;

            // Ensure the prompt is displayed
            process.stdout.write(prompt);

            const handleInput = (answer) => {
                const trimmedAnswer = answer.trim();

                // Handle empty input
                if (!trimmedAnswer) {
                    console.log('\nPlease enter a valid choice.');
                    rl.close();
                    return this.askConfirmation(question, options).then(resolve);
                }

                // Handle numeric input - only accept single digits within range
                const numChoice = parseInt(trimmedAnswer);
                if (trimmedAnswer.length === 1 && numChoice >= 1 && numChoice <= options.length) {
                    rl.close();
                    console.log(`\n✅ Selected: ${options[numChoice - 1]}`);
                    resolve(options[numChoice - 1]);
                    return;
                }

                // Handle multi-digit numbers or out-of-range numbers
                if (!isNaN(numChoice) && (trimmedAnswer.length > 1 || numChoice < 1 || numChoice > options.length)) {
                    console.log(`\n❌ Invalid choice: "${trimmedAnswer}". Please enter a number between 1 and ${options.length}.`);
                    rl.close();
                    return this.askConfirmation(question, options).then(resolve);
                }

                // Handle text input (case insensitive, partial match)
                const lowerAnswer = trimmedAnswer.toLowerCase();
                const match = options.find(opt =>
                    opt.toLowerCase().startsWith(lowerAnswer) ||
                    opt.toLowerCase() === lowerAnswer
                );

                if (match) {
                    rl.close();
                    console.log(`\n✅ Selected: ${match}`);
                    resolve(match);
                } else {
                    console.log(`\n❌ Invalid choice: "${trimmedAnswer}". Please try again.`);
                    rl.close();
                    this.askConfirmation(question, options).then(resolve);
                }
            };

            // Use 'line' event instead of direct event handling for better control
            rl.on('line', handleInput);

            // Handle Ctrl+C gracefully
            rl.on('SIGINT', () => {
                console.log('\n⚠️  Operation cancelled by user');
                rl.close();
                resolve('no');
            });

            // Handle unexpected close
            rl.on('close', () => {
                // Only resolve if we haven't already resolved
                if (rl.listenerCount('line') > 0) {
                    resolve('no');
                }
            });
        });
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
            'Agent will ask for confirmation on risky actions'
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
            console.log('');
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

function generateSystemPrompt(workingDir) {
    return `You are a helpful AI assistant with access to terminal commands and file system operations. 
You MUST use the available tools to perform actions - DO NOT just explain how to do things.

CRITICAL: When a user requests an action, execute the action IMMEDIATELY using tools. Do NOT provide recommendations before executing the requested action.

RECOMMENDATION SYSTEM:
Only AFTER executing the requested actions, you may provide recommendations for follow-up actions using this format:
<recommendation>
<title>Recommendation Title</title>
<description>Brief description of why this is recommended</description>
<actions>
- action 1 description
- action 2 description
</actions>
</recommendation>

EXECUTION ORDER:
1. FIRST: Execute the user's requested action using tools
2. THEN: Optionally provide recommendations for follow-up actions

When the user asks you to:
- Run commands: IMMEDIATELY use the execute_command tool
- Create files: IMMEDIATELY use the create_file tool with filepath parameter
- Read files: IMMEDIATELY use the read_file tool with filepath parameter
- List directories: IMMEDIATELY use the list_directory tool
- Navigate directories: IMMEDIATELY use the change_directory tool with dirpath parameter
- Append to files: IMMEDIATELY use the append_file tool with filepath and content parameters
- Delete files: IMMEDIATELY use the delete_item tool with filepath parameter
- Delete folders: IMMEDIATELY use the delete_folder tool with folderpath parameter
- Create directories: IMMEDIATELY use the create_directory tool with dirpath parameter
- Move/rename items: IMMEDIATELY use the move_item tool with source and destination parameters
- Copy items: IMMEDIATELY use the copy_item tool with source and destination parameters
- Search files: IMMEDIATELY use the search_files tool with pattern parameter
- Replace in files: IMMEDIATELY use the replace_in_file tool with filepath, find, and replace parameters

CRITICAL PATH RULES:
1. NEVER use absolute paths like "/Users/..." unless explicitly provided by the user
2. For current directory operations, use "." or omit the dirpath parameter entirely
3. For subdirectories, use relative paths like "subfolder" or "./subfolder"
4. DO NOT generate or hallucinate directory paths
5. When user says "list files" or "list directory", use {"tool": "list_directory", "parameters": {}}
6. When creating files, always include "content" parameter (use empty string "" for empty files)
7. For bulk operations like "delete all files", use execute_command with appropriate shell commands
8. IMPORTANT: Use the correct parameter names for each tool

PARAMETER REFERENCE:
File Operations:
- create_file: {"filepath": "filename.txt", "content": "file content"}
- read_file: {"filepath": "filename.txt"}
- append_file: {"filepath": "filename.txt", "content": "content to append"}
- delete_item: {"filepath": "filename.txt"}
- replace_in_file: {"filepath": "filename.txt", "find": "search text", "replace": "replacement text"}
- get_info: {"filepath": "filename.txt"}

Directory Operations:
- create_directory: {"dirpath": "folder_name"}
- list_directory: {"dirpath": "folder_name"} (optional, defaults to current directory)
- change_directory: {"dirpath": "folder_name"}
- delete_folder: {"folderpath": "folder_name", "recursive": true}

Move/Copy Operations:
- move_item: {"source": "old_name", "destination": "new_name"}
- copy_item: {"source": "original", "destination": "copy"}

Search Operations:
- search_files: {"pattern": "*.txt", "directory": "search_folder"}

Command Execution:
- execute_command: {"command": "shell command here"}

IMPORTANT NOTES:
1. Always provide required parameters - tools will fail with clear error messages if parameters are missing
2. For file operations that could be destructive, the system will ask for user confirmation
3. Use relative paths whenever possible for security
4. For MULTIPLE actions in one request, respond with an array of tool calls
5. Execute actions in the logical order they should be performed

Current working directory: ${workingDir}
Operating system: ${os.platform()}

RESPONSE FORMATS:

For a SINGLE action:
{"tool": "tool_name", "parameters": {"param1": "value1", "param2": "value2"}}

For MULTIPLE actions:
{"actions": [
  {"tool": "tool_name1", "parameters": {"param1": "value1"}},
  {"tool": "tool_name2", "parameters": {"param2": "value2"}}
]}

CORRECT EXAMPLES:

Single file creation:
{"tool": "create_file", "parameters": {"filepath": "test.txt", "content": "Hello World"}}

Multiple file creation:
{"actions": [
  {"tool": "create_file", "parameters": {"filepath": "file1.txt", "content": ""}},
  {"tool": "create_file", "parameters": {"filepath": "file2.txt", "content": ""}},
  {"tool": "create_file", "parameters": {"filepath": "file3.txt", "content": ""}}
]}

Directory operations:
{"tool": "create_directory", "parameters": {"dirpath": "tests"}}
{"tool": "change_directory", "parameters": {"dirpath": "tests"}}
{"tool": "list_directory", "parameters": {}}

File manipulation:
{"tool": "read_file", "parameters": {"filepath": "config.json"}}
{"tool": "append_file", "parameters": {"filepath": "log.txt", "content": "New log entry\n"}}
{"tool": "delete_item", "parameters": {"filepath": "temp.txt"}}

Move and copy:
{"tool": "move_item", "parameters": {"source": "old_file.txt", "destination": "new_file.txt"}}
{"tool": "copy_item", "parameters": {"source": "original.txt", "destination": "backup.txt"}}

Search and replace:
{"tool": "search_files", "parameters": {"pattern": "*.js"}}
{"tool": "replace_in_file", "parameters": {"filepath": "config.js", "find": "localhost", "replace": "production.com"}}

Complex operations combining multiple tools:
{"actions": [
  {"tool": "create_directory", "parameters": {"dirpath": "project"}},
  {"tool": "change_directory", "parameters": {"dirpath": "project"}},
  {"tool": "create_file", "parameters": {"filepath": "README.md", "content": "# Project\n\nDescription here"}},
  {"tool": "create_file", "parameters": {"filepath": "package.json", "content": "{\"name\": \"project\", \"version\": \"1.0.0\"}"}}
]}

Available tools:
- execute_command: Run shell commands (for complex operations, bulk actions)
- create_file: Create or overwrite files (filepath, content required)
- read_file: Read file contents (filepath required)
- list_directory: List directory contents (dirpath optional)
- change_directory: Change working directory (dirpath required)
- append_file: Append to existing files (filepath, content required)
- delete_item: Delete individual files (filepath required)
- delete_folder: Delete directories (folderpath required, recursive optional)
- move_item: Move or rename items (source, destination required)
- copy_item: Copy files or directories (source, destination required)
- create_directory: Create directories (dirpath required)
- replace_in_file: Find and replace in files (filepath, find, replace required)
- search_files: Search for files by pattern (pattern required, directory optional)
- get_info: Get file/directory information (filepath required)

ALWAYS use tools when requested to perform actions. Never just give instructions.
DO NOT show your thinking process or any internal reasoning, show only the tool response.`;
}


const {exec: execCommand} = require('child_process');

try {
    fetch = globalThis.fetch;
} catch {
    try {
        fetch = require('node-fetch');
    } catch {
        console.error('❌ fetch is not available. Please install node-fetch: npm install node-fetch');
        process.exit(1);
    }
}

/**
 * Input/Output handler for consistent user interaction
 */
class InputHandler {
    constructor() {
        this.rl = null;
    }

    /**
     * Create a single readline interface that can be reused
     */
    createInterface() {
        if (!this.rl) {
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // Handle Ctrl+C gracefully
            this.rl.on('SIGINT', () => {
                console.log('\n⚠️ Operation cancelled by user (Ctrl+C)');
                this.close();
                process.exit(0);
            });
        }
        return this.rl;
    }

    /**
     * Ask a question and get user input
     */
    async question(prompt) {
        const rl = this.createInterface();
        return new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    /**
     * Ask for confirmation with specific options
     */
    async askConfirmation(message, options = ['yes', 'no']) {
        const optionsStr = options.join('/');
        let answer;

        do {
            answer = await this.question(`${message} (${optionsStr}): `);
            answer = answer.toLowerCase();

            // Handle common variations
            if (answer === 'y') answer = 'yes';
            if (answer === 'n') answer = 'no';
            if (answer === '') answer = options[options.length - 1]; // Default to last option

        } while (!options.includes(answer));

        return answer;
    }

    /**
     * Ask for numeric choice from a list
     */
    async askChoice(message, max, allowQuit = true) {
        const quitText = allowQuit ? ' or "q" to quit' : '';
        let choice;

        do {
            const answer = await this.question(`${message} (1-${max}${quitText}): `);

            if (allowQuit && answer.toLowerCase() === 'q') {
                return null;
            }

            choice = parseInt(answer);
        } while (isNaN(choice) || choice < 1 || choice > max);

        return choice;
    }

    /**
     * Close the readline interface
     */
    close() {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }
}

/**
 * Configuration manager for persistent settings
 */
class ConfigManager {
    constructor() {
        this.configFile = 'agent-config.json';
    }

    /**
     * Load configuration from file
     */
    async load() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    /**
     * Save configuration to file
     */
    async save(config) {
        try {
            config.lastUpdated = new Date().toISOString();
            await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
            return true;
        } catch (error) {
            console.warn(`⚠️ Could not save config: ${error.message}`);
            return false;
        }
    }

    /**
     * Update specific config values
     */
    async update(updates) {
        const config = await this.load();
        Object.assign(config, updates);
        return this.save(config);
    }
}

/**
 * Path validation and security utilities
 */
class PathValidator {
    constructor(rootDirectory) {
        this.rootDirectory = path.resolve(rootDirectory);
    }

    /**
     * Validate and resolve path within project boundaries
     */
    validatePath(filepath) {
        const safePath = filepath ?? '.';
        const resolvedPath = path.resolve(this.rootDirectory, safePath);

        if (!resolvedPath.startsWith(this.rootDirectory)) {
            throw new Error(`Access denied: Path ${safePath} would go outside the project directory`);
        }

        return resolvedPath;
    }

    /**
     * Update root directory
     */
    setRoot(newRoot) {
        this.rootDirectory = path.resolve(newRoot);
    }
}

/**
 * Risk assessment for operations
 */
class SecurityManager {
    /**
     * Check if an operation is risky
     */
    static isRiskyOperation(operation, params = null) {
        if (typeof operation === 'string') {
            const message = operation.toLowerCase();
            const riskyPatterns = [
                'delete all', 'remove all', 'rm -rf', 'clear all', 'wipe', 'purge all',
                'delete everything', 'remove everything', 'clear everything',
                'format', 'sudo', 'chmod 777'
            ];
            return riskyPatterns.some(pattern => message.includes(pattern));
        }

        const riskyOperations = {
            'execute_command': (params) => {
                const cmd = params.command?.toLowerCase() || '';
                return ['rm ', 'delete', 'format', 'dd ', 'sudo', 'chmod 777', 'rm -rf']
                    .some(dangerous => cmd.includes(dangerous));
            },
            'delete_item': () => true,
            'delete_folder': () => true,
            'move_item': (params) => {
                const src = params.source?.toLowerCase() || '';
                return src.includes('system') || src.includes('config') || src.includes('.');
            }
        };

        const checker = riskyOperations[operation];
        return checker ? checker(params) : false;
    }
}

/**
 * File system operations toolkit
 */
class FileSystemTools {
    constructor(pathValidator, ui) {
        this.pathValidator = pathValidator;
        this.ui = ui;
        this.tools = new Map();
        this.setupTools();
    }

    /**
     * Initialize all file system tools
     */
    setupTools() {
        // Execute shell command
        this.addTool('move_item', {
            description: 'Move or rename a file or directory. If destination is a directory, item is moved INTO it.',
            parameters: {
                source: 'string - Path to file/directory to move',
                destination: 'string - Target path or directory',
                overwrite: 'boolean (optional) - Allow overwriting existing files'
            },
            handler: this.moveItem.bind(this)
        });

        // File operations
        this.addTool('create_file', {
            description: 'Create or overwrite a file with content',
            parameters: {filepath: 'string', content: 'string (optional)', encoding: 'string (optional)'},
            handler: this.createFile.bind(this)
        });

        this.addTool('read_file', {
            description: 'Read contents of a file',
            parameters: {filepath: 'string', encoding: 'string (optional)'},
            handler: this.readFile.bind(this)
        });

        this.addTool('append_file', {
            description: 'Append content to an existing file',
            parameters: {filepath: 'string', content: 'string', encoding: 'string (optional)'},
            handler: this.appendFile.bind(this)
        });

        // Directory operations
        this.addTool('create_directory', {
            description: 'Create a new directory',
            parameters: {dirpath: 'string', recursive: 'boolean (optional, default true)'},
            handler: this.createDirectory.bind(this)
        });

        this.addTool('list_directory', {
            description: 'List contents of a directory',
            parameters: {dirpath: 'string (optional)'},
            handler: this.listDirectory.bind(this)
        });

        this.addTool('change_directory', {
            description: 'Change the current working directory',
            parameters: {dirpath: 'string'},
            handler: this.changeDirectory.bind(this)
        });

        // Item management
        this.addTool('delete_item', {
            description: 'Delete a file',
            parameters: {filepath: 'string'},
            handler: this.deleteItem.bind(this)
        });

        this.addTool('delete_folder', {
            description: 'Delete a folder and its contents',
            parameters: {folderpath: 'string', recursive: 'boolean (optional)'},
            handler: this.deleteFolder.bind(this)
        });

        this.addTool('move_item', {
            description: 'Move or rename a file or directory',
            parameters: {source: 'string', destination: 'string', overwrite: 'boolean (optional)'},
            handler: this.moveItem.bind(this)
        });

        this.addTool('copy_item', {
            description: 'Copy a file or directory',
            parameters: {source: 'string', destination: 'string', overwrite: 'boolean (optional)'},
            handler: this.copyItem.bind(this)
        });

        // Utility operations
        this.addTool('search_files', {
            description: 'Search for files matching a pattern',
            parameters: {pattern: 'string', directory: 'string (optional)', maxDepth: 'number (optional)'},
            handler: this.searchFiles.bind(this)
        });

        this.addTool('replace_in_file', {
            description: 'Find and replace text in a file',
            parameters: {filepath: 'string', find: 'string', replace: 'string', isRegex: 'boolean (optional)'},
            handler: this.replaceInFile.bind(this)
        });

        this.addTool('get_info', {
            description: 'Get detailed information about a file or directory',
            parameters: {filepath: 'string'},
            handler: this.getInfo.bind(this)
        });
    }

    /**
     * Add a tool with consistent error handling and UI integration
     */
    addTool(name, config) {
        const originalHandler = config.handler;
        config.handler = async (params) => {
            try {
                const result = await originalHandler(params);
                console.log(this.ui.formatToolExecution(name, params, result));

                // Special formatting for specific tools
                if (name === 'list_directory' && result.success) {
                    console.log(this.ui.formatFileList(result.items));
                }

                if (name === 'read_file' && result.success) {
                    const ext = path.extname(params.filepath || params.path || params.filename || '');
                    if (['.js', '.py', '.json', '.html', '.css', '.md', '.txt'].includes(ext)) {
                        console.log(this.ui.formatCode(result.content, ext.slice(1) || 'text'));
                    } else {
                        // For regular text files, show in a box
                        this.ui.showInfo(`Content of ${params.filepath || params.path || params.filename}`, result.content);
                    }
                }

                return result;
            } catch (error) {
                const errorResult = {
                    success: false,
                    error: error.message,
                    tool: name
                };
                console.log(this.ui.formatToolExecution(name, params, errorResult));
                return errorResult;
            }
        };
        this.tools.set(name, config);
    }

    /**
     * Get tool by name
     */
    getTool(name) {
        return this.tools.get(name);
    }

    /**
     * Get all available tools
     */
    getAllTools() {
        return this.tools;
    }

    // Tool implementations
    async executeCommand(params) {
        const {command, timeout = 5 * 60 * 1000} = params;
        this.ui.updateSpinner(`Executing: ${command}`, 'yellow');

        return new Promise((resolve) => {
            const child = execCommand(command, {
                cwd: this.pathValidator.rootDirectory,
                timeout,
                maxBuffer: 10 * 1024 * 1024,
                env: {...process.env, FORCE_COLOR: '0'}
            }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        success: false,
                        error: error.killed ? `Command timed out after ${timeout}ms` : error.message,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        command,
                        exitCode: error.code
                    });
                } else {
                    resolve({
                        success: true,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        command,
                        message: 'Command executed successfully'
                    });
                }
            });
        });
    }

    async createFile(params) {
        const filepath = this.getFilePath(params);
        const {content = '', encoding = 'utf8'} = params;

        const fullPath = this.pathValidator.validatePath(filepath);
        this.ui.updateSpinner(`Creating file: ${filepath}`, 'green');

        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, {recursive: true});
        await fs.writeFile(fullPath, content, encoding);

        return {
            success: true,
            filepath: fullPath,
            size: Buffer.byteLength(content, encoding),
            message: `File created successfully${content ? '' : ' (empty file)'}`
        };
    }

    async readFile(params) {
        const filepath = this.getFilePath(params);
        const {encoding = 'utf8'} = params;

        const fullPath = this.pathValidator.validatePath(filepath);
        this.ui.updateSpinner(`Reading file: ${filepath}`, 'blue');

        const content = await fs.readFile(fullPath, encoding);
        const stats = await fs.stat(fullPath);

        return {
            success: true,
            filepath: fullPath,
            content,
            size: stats.size,
            modified: stats.mtime
        };
    }

    async appendFile(params) {
        const filepath = this.getFilePath(params);
        const {content, encoding = 'utf8'} = params;

        if (!content) {
            throw new Error('No content provided to append');
        }

        const fullPath = this.pathValidator.validatePath(filepath);
        this.ui.updateSpinner(`Appending to file: ${filepath}`, 'green');

        await fs.appendFile(fullPath, content, encoding);
        const stats = await fs.stat(fullPath);

        return {
            success: true,
            filepath: fullPath,
            newSize: stats.size,
            message: 'Content appended successfully'
        };
    }

    async createDirectory(params) {
        const {dirpath, recursive = true} = params;

        if (!dirpath) {
            throw new Error('No directory path provided');
        }

        const fullPath = this.pathValidator.validatePath(dirpath);
        this.ui.updateSpinner(`Creating directory: ${dirpath}`, 'green');

        await fs.mkdir(fullPath, {recursive});

        return {
            success: true,
            dirpath: fullPath,
            recursive,
            message: `Directory created successfully${recursive ? ' (with parent directories)' : ''}`
        };
    }

    async listDirectory(params) {
        const {dirpath = '.'} = params;
        const fullPath = this.pathValidator.validatePath(dirpath);
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
            items
        };
    }

    async changeDirectory(params) {
        const {dirpath} = params;
        const fullPath = this.pathValidator.validatePath(dirpath);
        this.ui.updateSpinner(`Changing directory to: ${dirpath}`, 'cyan');

        await fs.access(fullPath, fs.constants.F_OK);
        const stats = await fs.stat(fullPath);

        if (!stats.isDirectory()) {
            throw new Error('Path is not a directory');
        }

        const oldDirectory = this.pathValidator.rootDirectory;
        this.pathValidator.setRoot(fullPath);
        process.chdir(fullPath);

        return {
            success: true,
            oldDirectory,
            newDirectory: fullPath,
            message: `Changed to ${fullPath}`
        };
    }

    async deleteItem(params) {
        const filepath = this.getFilePath(params);
        const fullPath = this.pathValidator.validatePath(filepath);
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
            throw new Error(`Path is a directory: ${fullPath}. Use delete_folder for directories.`);
        }

        this.ui.updateSpinner(`Deleting file: ${filepath}`, 'red');
        await fs.unlink(fullPath);

        return {
            success: true,
            filepath: fullPath,
            type: 'file',
            message: 'File deleted successfully'
        };
    }

    async deleteFolder(params) {
        const folderpath = this.getFolderPath(params);
        const {recursive = false} = params;

        const fullPath = this.pathValidator.validatePath(folderpath);
        const stats = await fs.stat(fullPath);

        if (!stats.isDirectory()) {
            throw new Error(`Path is not a directory: ${fullPath}. Use delete_item for files.`);
        }

        if (fullPath === this.pathValidator.rootDirectory) {
            throw new Error('Refusing to delete the root working directory');
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
    }

    async moveItem(params) {
        const source = this.getSourcePath(params);
        const destination = this.getDestinationPath(params);
        const {overwrite = false} = params;

        const sourcePath = this.pathValidator.validatePath(source);
        let destPath = this.pathValidator.validatePath(destination);

        this.ui.updateSpinner(`Moving: ${source} → ${destination}`, 'yellow');

        // Check if source exists
        try {
            await fs.access(sourcePath);
        } catch (error) {
            throw new Error(`Source path does not exist: ${source}`);
        }

        // Get source stats to understand what we're moving
        const sourceStats = await fs.stat(sourcePath);
        const sourceIsFile = sourceStats.isFile();
        const sourceIsDir = sourceStats.isDirectory();

        // Check if destination exists
        let destExists = false;
        let destStats = null;
        try {
            destStats = await fs.stat(destPath);
            destExists = true;
        } catch (error) {
            // Destination doesn't exist, which is fine
            destExists = false;
        }

        // Handle destination logic
        if (destExists) {
            if (destStats.isDirectory()) {
                // If destination is a directory, move source INTO that directory
                const sourceName = path.basename(sourcePath);
                destPath = path.join(destPath, sourceName);

                // Check if the final destination already exists
                try {
                    await fs.access(destPath);
                    if (!overwrite) {
                        throw new Error(`Destination already exists: ${destPath}. Set overwrite=true to replace.`);
                    }
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                    // Final destination doesn't exist, which is good
                }
            } else {
                // Destination is a file
                if (!overwrite) {
                    throw new Error(`Destination file already exists: ${destination}. Set overwrite=true to replace.`);
                }
            }
        } else {
            // Destination doesn't exist - check if parent directory exists
            const destDir = path.dirname(destPath);
            try {
                const parentStats = await fs.stat(destDir);
                if (!parentStats.isDirectory()) {
                    throw new Error(`Parent path is not a directory: ${destDir}`);
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    throw new Error(`Parent directory does not exist: ${destDir}`);
                }
                throw error;
            }
        }

        // Perform the actual move
        try {
            await fs.rename(sourcePath, destPath);
        } catch (error) {
            // Handle cross-device link error (EXDEV) by copying then deleting
            if (error.code === 'EXDEV') {
                if (sourceIsDir) {
                    await fs.cp(sourcePath, destPath, {recursive: true, force: overwrite});
                    await fs.rm(sourcePath, {recursive: true, force: true});
                } else {
                    await fs.copyFile(sourcePath, destPath);
                    await fs.unlink(sourcePath);
                }
            } else {
                throw error;
            }
        }

        return {
            success: true,
            source: sourcePath,
            destination: destPath,
            type: sourceIsDir ? 'directory' : 'file',
            message: `${sourceIsDir ? 'Directory' : 'File'} moved successfully from ${sourcePath} to ${destPath}`
        };
    }

    /**
     * Enhanced helper methods for better parameter handling
     */
    getSourcePath(params) {
        const source = params.source || params.from || params.src || params.filepath;
        if (!source) {
            throw new Error('No source path provided. Use "source", "from", "src", or "filepath" parameter.');
        }
        return source;
    }

    getDestinationPath(params) {
        const destination = params.destination || params.to || params.dest || params.target;
        if (!destination) {
            throw new Error('No destination path provided. Use "destination", "to", "dest", or "target" parameter.');
        }
        return destination;
    }


    async copyItem(params) {
        const source = this.getSourcePath(params);
        const destination = this.getDestinationPath(params);
        const {overwrite = false} = params;

        const sourcePath = this.pathValidator.validatePath(source);
        const destPath = this.pathValidator.validatePath(destination);

        this.ui.updateSpinner(`Copying: ${source} → ${destination}`, 'blue');

        // Check if destination exists
        try {
            await fs.access(destPath);
            if (!overwrite) {
                throw new Error('Destination already exists. Set overwrite=true to replace.');
            }
        } catch (error) {
            // If error is not about file existence, rethrow it
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // Destination doesn't exist, which is fine for our use case
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
    }

    async searchFiles(params) {
        const {pattern, directory = '.', maxDepth = 5, type = 'all'} = params;

        if (!pattern) {
            throw new Error('No search pattern provided');
        }

        const glob = (await import('glob')).glob;
        const searchPath = this.pathValidator.validatePath(directory);
        this.ui.updateSpinner(`Searching for: ${pattern}`, 'magenta');

        const matches = await glob(pattern, {
            cwd: searchPath,
            maxDepth,
            nodir: type === 'file',
            onlyDirectories: type === 'directory'
        });

        const results = await Promise.all(matches.map(async (match) => {
            try {
                const fullPath = path.join(searchPath, match);
                const stats = await fs.stat(fullPath);
                return {
                    path: match,
                    fullPath,
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
            pattern,
            directory: searchPath,
            count: results.length,
            matches: results
        };
    }

    async replaceInFile(params) {
        const filepath = this.getFilePath(params);
        const {find, replace, isRegex = false, flags = 'g'} = params;

        if (find === undefined || replace === undefined) {
            throw new Error('Both find and replace parameters are required');
        }

        const fullPath = this.pathValidator.validatePath(filepath);
        this.ui.updateSpinner(`Replacing in file: ${filepath}`, 'yellow');

        let content = await fs.readFile(fullPath, 'utf8');
        const originalContent = content;

        if (isRegex) {
            const regex = new RegExp(find, flags);
            content = content.replace(regex, replace);
        } else {
            const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedFind, flags);
            content = content.replace(regex, replace);
        }

        await fs.writeFile(fullPath, content, 'utf8');

        const replacements = (originalContent.match(
            new RegExp(isRegex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        ) || []).length;

        return {
            success: true,
            filepath: fullPath,
            replacements,
            message: 'Replacement completed successfully'
        };
    }

    async getInfo(params) {
        const filepath = this.getFilePath(params);
        const fullPath = this.pathValidator.validatePath(filepath);
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

        if (stats.isDirectory()) {
            try {
                const entries = await fs.readdir(fullPath);
                info.itemCount = entries.length;
            } catch (e) {
                info.itemCount = 'unknown';
            }
        }

        if (stats.isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            info.extension = ext;
            info.basename = path.basename(fullPath);

            // Classify file types
            if (['.txt', '.md', '.log', '.json', '.js', '.py', '.html', '.css'].includes(ext)) {
                info.likelyText = true;
            } else if (['.jpg', '.png', '.gif', '.bmp', '.svg'].includes(ext)) {
                info.likelyImage = true;
            } else if (['.zip', '.tar', '.gz', '.rar'].includes(ext)) {
                info.likelyArchive = true;
            }
        }

        return info;
    }

    // Helper methods for parameter extraction
    getFilePath(params) {
        const filepath = params.filepath || params.path || params.filename;
        if (!filepath) {
            throw new Error('No filepath provided');
        }
        return filepath;
    }

    getFolderPath(params) {
        const folderpath = params.folderpath || params.dirpath || params.path || params.filepath;
        if (!folderpath) {
            throw new Error('No folder path provided');
        }
        return folderpath;
    }

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

/**
 * Updated system prompt section for move operations
 */
const moveOperationInstructions = `
MOVE OPERATIONS CLARIFICATION:
When user says "move [item] to [folder]" or "move [item] in [folder]":
- If destination is an existing directory, the item will be moved INTO that directory
- If destination doesn't exist, it will be treated as the new name/path for the item
- Use relative paths when possible
- Examples:
  * "move file.txt to docs/" → moves file.txt into the docs directory as docs/file.txt
  * "move file.txt docs/newname.txt" → moves file.txt to docs/newname.txt
  * "move folder1 folder2/" → moves folder1 into folder2 as folder2/folder1
`;

/**
 * Main TerminalLLMAgent class - refactored for better maintainability
 */
class TerminalLLMAgent {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:11434';
        this.model = options.model || null;
        this.workingDirectory = options.workingDirectory || process.cwd();
        this.conversationHistory = [];
        this.maxHistoryLength = options.maxHistoryLength || 20;
        this.systemPrompt = null;

        // Initialize components
        this.input = new InputHandler();
        this.config = new ConfigManager();
        this.pathValidator = new PathValidator(this.workingDirectory);
        this.ui = new TerminalUI(); // Use your existing TerminalUI class
        this.fileSystem = new FileSystemTools(this.pathValidator, this.ui);

        // Load config and initialize
        this.initialize();
    }

    /**
     * Initialize the agent
     */
    async initialize() {
        const config = await this.config.load();

        if (!this.model && config.model) {
            this.model = config.model;
        }

        if (config.workingDirectory) {
            this.workingDirectory = config.workingDirectory;
            this.pathValidator.setRoot(this.workingDirectory);
        }

        this.updateSystemPrompt();
    }

    /**
     * Update system prompt based on current working directory
     */
    updateSystemPrompt() {
        // Use your existing generateSystemPrompt function
        this.systemPrompt = generateSystemPrompt(this.workingDirectory);
    }

    /**
     * Check connection to Ollama
     */
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
                `${error.message}\n\nMake sure Ollama is running:\n  ollama serve`);
            return false;
        }
    }

    /**
     * Check and select model if needed
     */
    async checkModel() {
        this.ui.startSpinner('Checking model availability...');

        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            const data = await response.json();
            const models = data.models || [];

            const modelExists = this.model && models.some(m => m.name === this.model);

            if (!this.model || !modelExists) {
                this.ui.stopSpinner(false, 'Model selection needed');

                if (models.length === 0) {
                    this.ui.showError('No Models Installed',
                        'Please install a model first:\n\n' +
                        '  ollama pull codellama\n' +
                        '  ollama pull llama2\n' +
                        '  ollama pull mistral');
                    return false;
                }

                const selectedModel = await this.selectModel(models);
                if (selectedModel) {
                    this.model = selectedModel;
                    await this.config.update({model: selectedModel});
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

    /**
     * Select a model from available options
     */
    async selectModel(models) {
        this.ui.showModelInfo(models);

        const choice = await this.input.askChoice(
            `Select a model`,
            models.length,
            true
        );

        if (choice === null) {
            console.log(this.ui.theme.warning('👋 Exiting...'));
            return null;
        }

        const selectedModel = models[choice - 1].name;
        console.log(this.ui.theme.success(`🎯 Selected: ${selectedModel}`));
        return selectedModel;
    }

    /**
     * Ask for confirmation before risky operations
     */
    async askRiskyOperationConfirmation(message) {
        this.ui.stopSpinner(true, '');

        this.ui.showBox(
            '⚠️  Risky Operation Warning',
            `You are about to execute: "${message}"\n\n` +
            `This action could be irreversible and may permanently delete files/folders or make system changes.\n\n` +
            `Are you sure you want to proceed?`,
            'double'
        );

        const confirmed = await this.input.askConfirmation(
            '❓ Proceed with risky operation?',
            ['yes', 'no']
        );

        if (confirmed === 'yes') {
            console.log(this.ui.theme.success('\n✅ Confirmed: Proceeding with risky operation...'));
            return true;
        } else {
            console.log(this.ui.theme.warning('\n⚠️  Cancelled: Operation aborted for safety.'));
            return false;
        }
    }

    /**
     * Main chat method
     */
    async chat(message, options = {}) {
        try {
            // Check for risky operations
            if (!options.skipRiskyCheck && SecurityManager.isRiskyOperation(message)) {
                this.ui.startSpinner('Analyzing request...');
                const confirmed = await this.askRiskyOperationConfirmation(message);

                if (!confirmed) {
                    console.log(this.ui.theme.warning('⚠️  Risky operation cancelled by user.'));
                    return this.ui.formatMessage('Operation cancelled for safety.', 'warning');
                }

                console.log(this.ui.theme.success('✅ User confirmed risky operation. Proceeding...'));
            }

            this.ui.startSpinner('Thinking...');

            const response = await this.makeApiCall(message);
            let assistantMessage = response.message.content;

            // Try to execute tools first
            const toolResult = await this.handleToolCalls(assistantMessage);

            if (toolResult) {
                // Handle tool execution results
                const wasSuccessful = this.isToolExecutionSuccessful(toolResult);

                if (wasSuccessful) {
                    this.ui.stopSpinner(true, '');
                } else {
                    // Generate summary for failed operations
                    assistantMessage = await this.generateToolSummary(toolResult);

                }
            } else {
                this.ui.stopSpinner(true, '');
            }

            // Update conversation history
            this.conversationHistory.push(
                {role: 'user', content: message},
                {role: 'assistant', content: assistantMessage}
            );

            return this.ui.formatMessage(assistantMessage, 'assistant');

        } catch (error) {
            this.ui.stopSpinner(false, 'Error occurred');
            console.error(this.ui.theme.error('Error communicating with LLM:'), error);
            throw error;
        }
    }

    /**
     * Make API call to Ollama
     */
    async makeApiCall(message) {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
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

        return response.json();
    }

    /**
     * Handle tool calls from LLM response
     */
    async handleToolCalls(response) {
        try {
            // Try multi-action format first
            const multiActionMatch = response.match(/\{[^{}]*"actions"[^{}]*\[[\s\S]*?\]\s*\}/);

            if (multiActionMatch) {
                return await this.handleMultipleActions(multiActionMatch[0]);
            }

            // Fall back to single action
            return await this.handleSingleAction(response);

        } catch (error) {
            console.log(this.ui.theme.warning(`⚠️  Error parsing tool calls: ${error.message}`));
            return null;
        }
    }

    /**
     * Handle multiple actions
     */
    async handleMultipleActions(jsonString) {
        const multiAction = JSON.parse(jsonString);

        if (!multiAction.actions || !Array.isArray(multiAction.actions)) {
            return null;
        }

        this.ui.showInfo('Multiple Actions', `Executing ${multiAction.actions.length} actions...`);

        const results = [];
        let allSuccess = true;

        for (let i = 0; i < multiAction.actions.length; i++) {
            const action = multiAction.actions[i];
            console.log(this.ui.theme.primary(`\n[${i + 1}/${multiAction.actions.length}] ${action.tool}`));

            const tool = this.fileSystem.getTool(action.tool);
            if (!tool) {
                console.log(this.ui.theme.error(`⚠️  Unknown tool: ${action.tool}`));
                results.push({
                    tool: action.tool,
                    success: false,
                    error: `Unknown tool: ${action.tool}`
                });
                allSuccess = false;
                continue;
            }

            try {
                const result = await tool.handler(action.parameters);
                results.push({tool: action.tool, ...result});

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

        this.showMultiActionSummary(results, allSuccess);

        return {
            type: 'multiple',
            success: allSuccess,
            results,
            summary: `Executed ${results.length} actions, ${results.filter(r => r.success).length} succeeded`
        };
    }

    /**
     * Handle single action
     */
    async handleSingleAction(response) {
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
        const tool = this.fileSystem.getTool(toolCall.tool);

        if (!tool) {
            return null;
        }

        const result = await tool.handler(toolCall.parameters);
        return {type: 'single', ...result};
    }

    /**
     * Check if tool execution was successful
     */
    isToolExecutionSuccessful(toolResult) {
        return (toolResult.type === 'single' && toolResult.success) ||
            (toolResult.type === 'multiple' && toolResult.results.some(r => r.success));
    }

    /**
     * Generate summary for tool execution
     */
    async generateToolSummary(toolResult) {
        this.ui.startSpinner('Generating summary...');

        const followUpPrompt = toolResult.type === 'multiple'
            ? `Multiple tool execution results:\n${JSON.stringify(toolResult.results, null, 2)}\n\nPlease provide a brief, natural language summary of what was accomplished. Be concise and mention any failures. If there are logical next steps or recommendations for fixing failures, format them using the recommendation tags. Do not show your thinking process only the response`
            : `Tool execution result: ${JSON.stringify(toolResult, null, 2)}\n\nPlease provide a brief, natural language summary of what was accomplished. Be concise and focus on the result. If there are logical next steps or recommendations for fixing issues, format them using the recommendation tags. Do not show your thinking process only the response`;

        const response = await this.makeApiCall(followUpPrompt);
        this.ui.stopSpinner(true, '');

        return response.message.content;
    }

    /**
     * Show summary for multi-action results
     */
    showMultiActionSummary(results, allSuccess) {
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
    }

    /**
     * Start interactive mode
     */
    async startInteractiveMode() {
        return new Promise(async (resolve) => {
            await this.ui.showBanner();

            // Check connection and model
            if (!(await this.checkConnection()) || !(await this.checkModel())) {
                process.exit(1);
            }

            // Ask for working directory if needed
            await this.selectWorkingDirectory();
            this.ui.showWelcome(this.model, this.workingDirectory);

            const rl = this.input.createInterface();

            // Set up command completion
            rl.completer = (line) => {
                const completions = [
                    'create', 'delete', 'list', 'read', 'run', 'help',
                    'exit', 'clear', 'cd', 'pwd', 'model', 'models', 'switch', 'history'
                ];
                const hits = completions.filter(c => c.startsWith(line));
                return [hits.length ? hits : completions, line];
            };

            const handleInput = async (input) => {
                try {
                    const message = input.trim();

                    if (message.toLowerCase() === 'exit') {
                        this.input.close();
                        resolve();
                        return;
                    }

                    await this.handleCommand(message, rl);

                } catch (error) {
                    this.ui.showError('An error occurred', error.message);
                    if (error.message.includes('connection refused')) {
                        console.error(this.ui.theme.warning('💡 Make sure Ollama is running: ollama serve'));
                    }
                }

                this.showPrompt(rl);
            };

            rl.on('line', handleInput);
            rl.on('close', resolve);

            this.showPrompt(rl);
        });
    }

    /**
     * Handle individual commands
     */
    async handleCommand(message, rl) {
        switch (message.toLowerCase()) {
            case 'clear':
                console.clear();
                await this.ui.showBanner();
                this.ui.showWelcome(this.model, this.workingDirectory);
                break;

            case 'help':
                this.showEnhancedHelp();
                break;

            case 'pwd':
                this.ui.showInfo('Current Directory', this.workingDirectory);
                break;

            case 'cd':
                await this.selectWorkingDirectory();
                break;

            case 'model':
                this.ui.showInfo('Model Information', `Current model: ${this.model}\nOllama URL: ${this.baseUrl}`);
                break;

            case 'models':
                await this.listAllModels();
                break;

            case 'switch':
                const switched = await this.switchModel();
                if (switched) this.ui.showSuccess('Model Switched', `Now using model: ${this.model}`);
                break;

            case 'history':
                this.showConversationHistory();
                break;

            default:
                if (message) {
                    console.log('\n' + this.ui.theme.info('👤 You:'));
                    console.log(this.ui.formatMessage(message, 'user'));

                    const response = await this.chat(message);

                    console.log('\n' + this.ui.theme.tool('🤖 Assistant:'));
                    console.log(response);
                }
                break;
        }
    }

    /**
     * Show command prompt
     */
    showPrompt(rl) {
        rl.setPrompt(this.ui.theme.prompt(`\n💻 [${path.basename(this.workingDirectory)}] ❯ `));
        rl.prompt();
    }

    /**
     * Select working directory
     */
    async selectWorkingDirectory() {
        console.log('\n📁 Working Directory Selection');
        console.log('===============================');
        console.log(`Current: ${this.workingDirectory}`);
        console.log('\nOptions:');
        console.log('1. Use current directory');
        console.log('2. Enter custom path');
        console.log('3. Browse from home directory');
        console.log('4. Browse from root directory');

        const choice = await this.input.askChoice('Select an option', 4, false);

        switch (choice) {
            case 1:
                console.log(`✅ Using: ${this.workingDirectory}`);
                await this.updateWorkingDirectory(this.workingDirectory);
                break;

            case 2:
                const customPath = await this.input.question('Enter directory path: ');
                await this.setCustomDirectory(customPath);
                break;

            case 3:
                await this.browseDirectory(require('os').homedir());
                break;

            case 4:
                await this.browseDirectory('/');
                break;
        }
    }

    /**
     * Set custom directory
     */
    async setCustomDirectory(customPath) {
        try {
            const resolvedPath = path.resolve(customPath);
            const fs = require('fs');

            if (fs.existsSync(resolvedPath)) {
                const stats = fs.statSync(resolvedPath);
                if (stats.isDirectory()) {
                    await this.updateWorkingDirectory(resolvedPath);
                    console.log(`✅ Changed to: ${resolvedPath}`);
                } else {
                    console.log('❌ Path is not a directory');
                    await this.selectWorkingDirectory();
                }
            } else {
                console.log('❌ Directory does not exist');
                await this.selectWorkingDirectory();
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            await this.selectWorkingDirectory();
        }
    }

    /**
     * Browse directory interactively
     */
    async browseDirectory(startPath) {
        const fs = require('fs');
        let currentPath = startPath;

        while (true) {
            try {
                console.log(`\n📁 Current: ${currentPath}`);

                const entries = fs.readdirSync(currentPath, {withFileTypes: true});
                const directories = entries.filter(entry => entry.isDirectory()).slice(0, 20);

                console.log('\nDirectories:');
                console.log('0. .. (parent directory)');
                console.log('s. Select this directory');

                directories.forEach((dir, index) => {
                    console.log(`${index + 1}. ${dir.name}/`);
                });

                const choice = await this.input.question('\nEnter choice (number, "s" to select, or "q" to quit): ');

                if (choice.toLowerCase() === 'q') {
                    console.log('❌ Directory selection cancelled');
                    break;
                }

                if (choice.toLowerCase() === 's') {
                    await this.updateWorkingDirectory(currentPath);
                    console.log(`✅ Selected: ${currentPath}`);
                    break;
                }

                const choiceNum = parseInt(choice);
                if (choiceNum === 0) {
                    currentPath = path.dirname(currentPath);
                } else if (choiceNum >= 1 && choiceNum <= directories.length) {
                    currentPath = path.join(currentPath, directories[choiceNum - 1].name);
                } else {
                    console.log('❌ Invalid choice. Please try again.');
                }

            } catch (error) {
                console.log(`❌ Error reading directory: ${error.message}`);
                console.log('Returning to parent directory...');
                currentPath = path.dirname(currentPath);
            }
        }
    }

    /**
     * Update working directory and save to config
     */
    async updateWorkingDirectory(newPath) {
        this.workingDirectory = newPath;
        this.pathValidator.setRoot(newPath);
        process.chdir(newPath);
        this.updateSystemPrompt();
        await this.config.update({workingDirectory: newPath});
    }

    /**
     * List all available models
     */
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

    /**
     * Switch to a different model
     */
    async switchModel() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            const data = await response.json();
            const models = data.models || [];

            if (models.length === 0) {
                console.log('❌ No models available to switch to');
                return false;
            }

            const selectedModel = await this.selectModel(models);
            if (selectedModel && selectedModel !== this.model) {
                this.model = selectedModel;
                await this.config.update({model: selectedModel});
                this.conversationHistory = []; // Clear history when switching
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Could not switch model:', error.message);
            return false;
        }
    }

    /**
     * Show conversation history
     */
    showConversationHistory(limit = 10) {
        const header = `📜 Conversation History (last ${limit} entries)`;
        this.ui.showInfo('History', header);

        const history = this.conversationHistory.slice(-limit);
        if (history.length === 0) {
            console.log(this.ui.formatMessage('No conversation history yet.', 'muted'));
            return;
        }

        history.forEach((msg, idx) => {
            const isUser = msg.role === 'user';
            const label = isUser
                ? this.ui.theme.prompt(`You   [${idx + 1}]:`)
                : this.ui.theme.tool(`Bot   [${idx + 1}]:`);

            const content = this.ui.formatMessage(
                msg.content,
                isUser ? 'user' : 'assistant'
            );

            console.log(`${label} ${content}`);
        });
    }

    /**
     * Show enhanced help
     */
    showEnhancedHelp() {
        const helpContent = `
# Terminal LLM Agent Commands

## Basic Commands
- **exit** - Quit the agent
- **clear** - Clear the screen  
- **help** - Show this help

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
- **history** - Show conversation history

## Examples
\`\`\`
"Create a Python script that prints hello world"
"Run npm init and install express"
"Create a README.md with project description"
\`\`\`
        `;

        console.log(this.ui.formatMessage(helpContent));
    }

    /**
     * Execute a single command and return result
     */
    async executeCommand(command) {
        try {
            return await this.chat(command);
        } catch (error) {
            throw new Error(`Failed to execute command: ${error.message}`);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.input.close();
    }
}

// CLI usage and main function remains the same but simplified
async function main() {
    const args = process.argv.slice(2);
    const options = {
        model: null,
        workingDirectory: process.cwd()
    };

    // Parse command line arguments (same as before)
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--model':
                options.model = args[++i];
                break;
            case '--dir':
                options.workingDirectory = path.resolve(args[++i]);
                break;
            case '--help':
                console.log(`
Terminal LLM Agent - AI assistant with file system access

Usage: node terminal-agent.js [options] [command]

Options:
  --model <name>   LLM model to use
  --dir <path>     Working directory
  --help           Show this help

Examples:
  node terminal-agent.js                           # Interactive mode
  node terminal-agent.js "create a hello.py file"  # Single command
                `);
                return;
        }
    }

    const agent = new TerminalLLMAgent(options);

    try {
        // Single command mode
        const command = args.find(arg => !arg.startsWith('--'));
        if (command) {
            console.log(`🤖 Using model: ${agent.model}`);
            console.log(`📍 Working directory: ${agent.workingDirectory}\n`);

            const response = await agent.executeCommand(command);
            console.log(response);
            return;
        }

        // Interactive mode
        await agent.startInteractiveMode();
    } finally {
        agent.cleanup();
    }
}

// Error handling and process management
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

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

module.exports = {TerminalLLMAgent, InputHandler, ConfigManager, PathValidator, SecurityManager, FileSystemTools};

