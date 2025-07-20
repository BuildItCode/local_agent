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

PROJECT_NAME="local-agent"

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
  "name": "local-llm-agent",
  "version": "1.0.0",
  "description": "AI assistant with terminal access and beautiful UI using Ollama",
    "main": "terminal-agent.js",
    "bin": {
      "terminal-ai": "./terminal-agent.js"
    },
    "scripts": {
      "start": "node terminal-agent.js",
      "setup": "node setup.js",
      "test": "node test.js",
      "dev": "nodemon terminal-agent.js"
    },
    "keywords": [
      "llm",
      "ai",
      "terminal",
      "ollama",
      "assistant",
      "file-system",
      "automation",
      "ui",
      "colors",
      "markdown"
    ],
    "author": "Nick Psarakis",
    "license": "MIT",
    "engines": {
      "node": ">=14.0.0"
    },
    "dependencies": {
      "node-fetch": "^2.6.7",
      "glob": "^8.0.3",
      "chalk": "^4.1.2",
      "marked": "^4.3.0",
      "marked-terminal": "^5.2.0",
      "ora": "^5.4.1",
      "boxen": "^5.1.2",
      "gradient-string": "^2.0.2",
      "figlet": "^1.6.0",
      "cli-table3": "^0.6.3",
      "inquirer": "^8.2.5",
      "cli-spinners": "^2.7.0",
      "ansi-escapes": "^4.3.2",
      "terminal-link": "^2.1.1",
      "cli-highlight": "^2.1.11"
    },
    "devDependencies": {
      "nodemon": "^2.0.20"
    },
    "repository": {
      "type": "git",
      "url": "https://github.com/BuildItCode/local_agent"
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


class TerminalLLMAgent {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:11434';
        this.model = options.model || this.loadConfigModel() || null;
        this.workingDirectory = options.workingDirectory || process.cwd();
        this.rootWorkingDirectory = options.rootWorkingDirectory || this.workingDirectory;
        this.conversationHistory = [];
        this.maxHistoryLength = options.maxHistoryLength || 20;
        this.ui = new TerminalUI();
        this.systemPrompt = null;
        this.confirmationMode = options.confirmationMode || 'auto'; // 'auto', 'always', 'never'
        this.autoConfirmSafe = options.autoConfirmSafe !== false; // Auto-confirm safe operations

        this.setupTools();
    }

    generateSystemPrompt() {
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

EXAMPLES OF WHEN TO RECOMMEND (after execution):
- After installing packages, suggest creating/updating .gitignore
- After creating a project, suggest initializing git
- After running tests that fail, suggest fixes
- Before destructive operations, suggest backups
- When security issues are detected, suggest improvements

When the user asks you to:
- Run commands: IMMEDIATELY use the execute_command tool
- Create files: IMMEDIATELY use the create_file tool with filepath parameter
- Read files: IMMEDIATELY use the read_file tool with filepath parameter
- List directories: IMMEDIATELY use the list_directory tool
- Navigate directories: IMMEDIATELY use the change_directory tool
- Append to files: IMMEDIATELY use the append_file tool
- Delete files: IMMEDIATELY use the delete_item tool for files or execute_command for bulk operations

CRITICAL PATH RULES:
1. NEVER use absolute paths like "/Users/..." unless explicitly provided by the user
2. For current directory operations, use "." or omit the dirpath parameter entirely
3. For subdirectories, use relative paths like "subfolder" or "./subfolder"
4. DO NOT generate or hallucinate directory paths
5. When user says "list files" or "list directory", use {"tool": "list_directory", "parameters": {}}
6. When creating files, always include "content" parameter (use empty string "" for empty files)
7. For "delete all files", use execute_command with appropriate shell command like "rm *" or similar
8. IMPORTANT: Use "filepath" parameter for file operations, not "path"

PARAMETER NAMES:
- create_file: {"filepath": "filename.txt", "content": "file content"}
- read_file: {"filepath": "filename.txt"}
- append_file: {"filepath": "filename.txt", "content": "content to append"}
- delete_item: {"filepath": "filename.txt"}

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

CORRECT EXAMPLES:
- Create file: {"tool": "create_file", "parameters": {"filepath": "test.txt", "content": "Hello World"}}
- Create 5 files: {"actions": [
    {"tool": "create_file", "parameters": {"filepath": "text1.txt", "content": ""}},
    {"tool": "create_file", "parameters": {"filepath": "text2.txt", "content": ""}},
    {"tool": "create_file", "parameters": {"filepath": "text3.txt", "content": ""}},
    {"tool": "create_file", "parameters": {"filepath": "text4.txt", "content": ""}},
    {"tool": "create_file", "parameters": {"filepath": "text5.txt", "content": ""}}
  ]}

Available tools:
- execute_command: Run shell commands
- create_file: Create or overwrite files (always include filepath and content parameters)
- read_file: Read file contents
- list_directory: List directory contents (use {} for current directory)
- change_directory: Change working directory
- append_file: Append to existing files
- delete_item: Delete files or directories
- move_item: Move or rename items
- copy_item: Copy files or directories
- create_directory: Create directories
- replace_in_file: Find and replace in files
- search_files: Search for files by pattern
- get_info: Get file/directory information

ALWAYS use tools when requested to perform actions. Never just give instructions.
DO NOT show your thinking process or the think tags, show only the response`;
    }


    // Update system prompt method
    updateSystemPrompt() {
        this.systemPrompt = this.generateSystemPrompt();
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
        // For relative paths, resolve against working directory
        const resolvedPath = path.resolve(this.workingDirectory, safePath);

        // Get the root working directory (the original directory when agent started)
        // This should be set when the agent initializes or when directory is selected
        const rootWorkingDir = this.rootWorkingDirectory || this.workingDirectory.split('/').slice(0, -1).join('/') || '/';

        // Allow navigation within the project tree
        // The resolved path should be within or equal to the root working directory
        if (!resolvedPath.startsWith(rootWorkingDir) && resolvedPath !== rootWorkingDir) {
            throw new Error(`Access denied: Path ${safePath} would go outside the project directory`);
        }

        return resolvedPath;
    }

    /**
     * Parse and handle recommendations from LLM responses
     */
    async parseAndHandleRecommendations(response) {
        const recommendationMatch = response.match(/<recommendation>([\s\S]*?)<\/recommendation>/);

        if (!recommendationMatch) {
            return {hasRecommendations: false, cleanResponse: response};
        }

        const recommendationContent = recommendationMatch[1];
        const titleMatch = recommendationContent.match(/<title>(.*?)<\/title>/);
        const descriptionMatch = recommendationContent.match(/<description>(.*?)<\/description>/);
        const actionsMatch = recommendationContent.match(/<actions>([\s\S]*?)<\/actions>/);

        const title = titleMatch ? titleMatch[1].trim() : 'Recommendation';
        const description = descriptionMatch ? descriptionMatch[1].trim() : 'The system has a suggestion for you.';
        const actionsText = actionsMatch ? actionsMatch[1].trim() : '';

        // Parse actions into array
        const actions = actionsText
            .split('\n')
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(line => line.length > 0);

        // If no valid actions found, skip recommendations
        if (actions.length === 0) {
            console.log(this.ui.theme.muted('ℹ️  Found recommendation tags but no valid actions, skipping...'));
            const cleanResponse = response.replace(/<recommendation>[\s\S]*?<\/recommendation>/, '').trim();
            return {hasRecommendations: false, cleanResponse};
        }

        // Remove recommendation tags from response
        const cleanResponse = response.replace(/<recommendation>[\s\S]*?<\/recommendation>/, '').trim();

        // Stop any existing spinner before showing recommendation
        this.ui.stopSpinner(true, '');

        // Show recommendation to user
        this.ui.showRecommendation(title, description, actions);

        try {
            // Ask for user confirmation with better error handling
            const userChoice = await this.ui.askConfirmation(
                'Would you like me to execute these recommended actions?',
                ['yes', 'no', 'show details']
            );

            console.log(`\n✅ You selected: ${userChoice}`);

            if (userChoice === 'show details') {
                this.ui.showInfo('Recommendation Details',
                    `${description}\n\nActions:\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
                );

                const finalChoice = await this.ui.askConfirmation(
                    'Execute these actions?',
                    ['yes', 'no']
                );

                if (finalChoice === 'yes') {
                    await this.executeRecommendedActions(actions);
                } else {
                    console.log(this.ui.theme.info('ℹ️  Recommendations skipped by user choice.'));
                }
            } else if (userChoice === 'yes') {
                await this.executeRecommendedActions(actions);
            } else {
                console.log(this.ui.theme.info('ℹ️  Recommendations skipped by user choice.'));
            }
        } catch (error) {
            console.log(this.ui.theme.error(`❌ Error handling recommendation: ${error.message}`));
            console.log(this.ui.theme.info('ℹ️  Skipping recommendations due to error.'));
        }

        return {hasRecommendations: true, cleanResponse};
    }

    /**
     * Execute recommended actions based on user confirmation
     */
    async executeRecommendedActions(actions) {
        console.log(this.ui.theme.success('\n✅ Executing recommended actions...\n'));

        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            console.log(this.ui.theme.command(`[${i + 1}/${actions.length}] ${action}`));

            try {
                // Convert action description to LLM prompt for execution
                const result = await this.chat(`Please execute this action: ${action}`, {skipRecommendations: true});
                console.log(this.ui.theme.muted('   → ' + result.substring(0, 100) + (result.length > 100 ? '...' : '')));
            } catch (error) {
                console.log(this.ui.theme.error(`   ✗ Failed: ${error.message}`));
            }
        }

        console.log(this.ui.theme.success('\n✅ Recommended actions completed.\n'));
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

    isRiskyAction(toolNameOrMessage, params = null) {
        // If called with a message string (no params), check if the message indicates risky operations
        if (typeof toolNameOrMessage === 'string' && params === null) {
            const message = toolNameOrMessage.toLowerCase();
            const riskyPatterns = [
                'delete all', 'remove all', 'rm -rf', 'clear all', 'wipe', 'purge all',
                'delete everything', 'remove everything', 'clear everything',
                'format', 'sudo', 'chmod 777'
            ];

            return riskyPatterns.some(pattern => message.includes(pattern));
        }

        // Original tool-level risk detection
        const riskyOperations = {
            'execute_command': (params) => {
                const cmd = params.command?.toLowerCase() || '';
                return cmd.includes('rm ') || cmd.includes('delete') ||
                    cmd.includes('format') || cmd.includes('dd ') ||
                    cmd.includes('sudo') || cmd.includes('chmod 777') ||
                    cmd.includes('rm -rf');
            },
            'delete_item': () => true,
            'delete_folder': () => true,
            'move_item': (params) => {
                // Moving system files or directories could be risky
                const src = params.source?.toLowerCase() || '';
                return src.includes('system') || src.includes('config') || src.includes('.');
            }
        };

        const checker = riskyOperations[toolNameOrMessage];
        return checker ? checker(params) : false;
    }

// Add method to ask for confirmation before risky operations:
    async askRiskyOperationConfirmation(message) {
        this.ui.stopSpinner(true, ''); // Stop thinking spinner

        this.ui.showBox(
            '⚠️  Risky Operation Warning',
            `You are about to execute: "${message}"\n\nThis action could be irreversible and may permanently delete files/folders or make system changes.\n\nAre you sure you want to proceed?`,
            'double'
        );

        // Use a more specific confirmation for risky operations
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const askQuestion = () => {
                rl.question(this.ui.theme.recommendation('❓ Type "yes" to proceed, "no" to cancel: '), (answer) => {
                    const trimmed = answer.trim().toLowerCase();

                    if (trimmed === 'yes' || trimmed === 'y') {
                        console.log(this.ui.theme.success('\n✅ Confirmed: Proceeding with risky operation...'));
                        rl.close();
                        resolve(true);
                    } else if (trimmed === 'no' || trimmed === 'n' || trimmed === '') {
                        console.log(this.ui.theme.warning('\n⚠️  Cancelled: Operation aborted for safety.'));
                        rl.close();
                        resolve(false);
                    } else {
                        console.log(this.ui.theme.error(`\n❌ Invalid input: "${answer}". Please type "yes" or "no".`));
                        askQuestion(); // Ask again
                    }
                });
            };

            askQuestion();

            // Handle Ctrl+C gracefully
            rl.on('SIGINT', () => {
                console.log(this.ui.theme.warning('\n⚠️  Operation cancelled by user (Ctrl+C)'));
                rl.close();
                resolve(false);
            });
        });
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
                const {command, timeout = 5 * 60 * 1000} = params; // Increased timeout for long commands

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
            parameters: {
                filepath: 'string (or path)',
                content: 'string (optional, defaults to empty string)',
                encoding: 'string (optional, default utf8)'
            },
            handler: async (params) => {
                // Accept both 'filepath' and 'path' parameters for compatibility
                const filepath = params.filepath || params.path || '.';
                const {content = '', encoding = 'utf8'} = params;

                try {
                    const fullPath = this.validatePath(filepath);
                    this.ui.updateSpinner(`Creating file: ${filepath}`, 'green');

                    // Create directory if it doesn't exist
                    const dir = path.dirname(fullPath);
                    await fs.mkdir(dir, {recursive: true});

                    // Use empty string if content is undefined/null
                    const fileContent = content ?? '';
                    await fs.writeFile(fullPath, fileContent, encoding);

                    return {
                        success: true,
                        filepath: fullPath,
                        size: Buffer.byteLength(fileContent, encoding),
                        message: `File created successfully${fileContent ? '' : ' (empty file)'}`
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

                    this.updateSystemPrompt();

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

                    // ONLY check working directory deletion in delete operations
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

        this.tools.set('debug_state', {
            description: 'Debug current working directory state',
            parameters: {},
            handler: async (params) => {
                console.log('\n🔍 DEBUG STATE:');
                console.log('================');
                console.log('this.workingDirectory:', this.workingDirectory);
                console.log('process.cwd():', process.cwd());
                console.log('__dirname:', __dirname);

                // Check if there are any hardcoded paths
                const systemPaths = this.systemPrompt.match(/\/Users\/[^\s]*/g) || [];
                console.log('System prompt paths:', systemPaths);

                // Check environment
                console.log('PWD env var:', process.env.PWD);
                console.log('OLDPWD env var:', process.env.OLDPWD);

                return {
                    success: true,
                    workingDirectory: this.workingDirectory,
                    processCwd: process.cwd(),
                    systemPromptPaths: systemPaths,
                    envPwd: process.env.PWD,
                    envOldPwd: process.env.OLDPWD
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


    async chat(message, options = {}) {
        try {
            // Check for risky operations BEFORE any processing using existing function
            if (!options.skipRiskyCheck && this.isRiskyAction(message)) {
                this.ui.startSpinner('Analyzing request...');
                const confirmed = await this.askRiskyOperationConfirmation(message);

                if (!confirmed) {
                    console.log(this.ui.theme.warning('⚠️  Risky operation cancelled by user.'));
                    return this.ui.formatMessage('Operation cancelled for safety.', 'warning');
                }

                console.log(this.ui.theme.success('✅ User confirmed risky operation. Proceeding...'));
            }

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

            this.ui.updateSpinner('Processing response...', 'yellow');

            const data = await response.json();
            let assistantMessage = data.message.content;

            // Try to execute tools FIRST, before handling recommendations
            const toolResult = await this.handleMultipleToolCalls(assistantMessage);

            if (toolResult) {
                // For ANY successful operation, skip recommendations and provide simple summary
                const wasSuccessful = (toolResult.type === 'single' && toolResult.success) ||
                    (toolResult.type === 'multiple' && toolResult.results.some(r => r.success));

                if (wasSuccessful && !options.forceRecommendations) {
                    // Provide simple summary for successful operations
                    this.ui.stopSpinner(true, '');
                } else {
                    // Only generate recommendations for failed operations or when forced
                    this.ui.startSpinner('Generating summary...');

                    let followUpPrompt;
                    if (toolResult.type === 'multiple') {
                        followUpPrompt = `Multiple tool execution results:
${JSON.stringify(toolResult.results, null, 2)}

Please provide a brief, natural language summary of what was accomplished. Be concise and mention any failures. If there are logical next steps or recommendations for fixing failures, format them using the recommendation tags. Do not show your thinking process only the response`;
                    } else {
                        followUpPrompt = `Tool execution result: ${JSON.stringify(toolResult, null, 2)}

Please provide a brief, natural language summary of what was accomplished. Be concise and focus on the result. If there are logical next steps or recommendations for fixing issues, format them using the recommendation tags. Do not show your thinking process only the response`;
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
                                    content: `You are a helpful assistant. Provide a brief summary of the tool execution result(s). Be concise and helpful. Only provide recommendations if there were failures that need to be addressed. Do not show your thinking process only the response`
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

                    // Stop spinner before handling recommendations
                    this.ui.stopSpinner(true, '');

                    // Handle recommendations from the follow-up response
                    if (!options.skipRecommendations) {
                        const followUpRecommendationResult = await this.parseAndHandleRecommendations(assistantMessage);
                        if (followUpRecommendationResult.hasRecommendations) {
                            assistantMessage = followUpRecommendationResult.cleanResponse;
                        }
                    }
                }

            } else {
                // No tools were executed, check if this was an action request
                if (this.seemsLikeActionRequest(message) && !this.containsToolCall(assistantMessage)) {
                    this.ui.updateSpinner('Retrying with clearer instructions...', 'yellow');

                    const retryPrompt = `The user said: "${message}"

This requires action(s). You MUST use the appropriate tool(s) immediately.

For deleting all files, use: {"tool": "execute_command", "parameters": {"command": "find . -maxdepth 1 -type f -delete"}}
For deleting all folders, use: {"tool": "execute_command", "parameters": {"command": "rm -rf */"}}

If multiple actions are needed, use the multi-action format:
{"actions": [{"tool": "tool_name", "parameters": {...}}, ...]}

Do NOT provide recommendations before executing the action. Execute the action first.`;

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

                    if (!retryToolResult) {
                        assistantMessage = `I understand you want me to: ${message}. However, I had trouble executing the appropriate tools. Please try rephrasing your request.`;
                    }
                } else {
                    // Check for recommendations in the original response if no tools were executed
                    if (!options.skipRecommendations) {
                        this.ui.stopSpinner(true, '');

                        const recommendationResult = await this.parseAndHandleRecommendations(assistantMessage);
                        if (recommendationResult.hasRecommendations) {
                            assistantMessage = recommendationResult.cleanResponse;
                        }
                    } else {
                        this.ui.stopSpinner(true, '');
                    }
                }
            }

            // Ensure spinner is stopped
            if (this.ui.spinner) {
                this.ui.stopSpinner(true, '');
            }

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

            // Ensure system prompt is set (in case it wasn't set during directory selection)
            if (!this.systemPrompt) {
                this.updateSystemPrompt();
            }

            // Check model after setting working directory and system prompt
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

## Recommendation System
When the assistant suggests actions after completing tasks:
- **y/yes** - Execute the recommended action
- **n/no** - Skip this recommendation
- **skip/s** - Skip all remaining recommendations

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
                            // Set root directory to current directory
                            this.rootWorkingDirectory = this.workingDirectory;
                            this.updateSystemPrompt();
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
                                            // Set root directory to the selected directory
                                            this.rootWorkingDirectory = resolvedPath;
                                            process.chdir(resolvedPath);

                                            this.updateSystemPrompt();

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
                const directories = entries.filter(entry => entry.isDirectory()).slice(0, 20);

                console.log('\nDirectories:');
                console.log('0. .. (parent directory)');
                console.log('s. Select this directory');

                directories.forEach((dir, index) => {
                    console.log(`${index + 1}. ${dir.name}/`);
                });

                rl.question('\nEnter choice (number, "s" to select, or "q" to quit): ', async (choice) => {
                    if (choice.toLowerCase() === 'q') {
                        console.log('❌ Directory selection cancelled');
                        this.updateSystemPrompt();
                        rl.close();
                        resolve();
                        return;
                    }

                    if (choice.toLowerCase() === 's') {
                        this.workingDirectory = currentPath;
                        // Set root directory to the selected directory
                        this.rootWorkingDirectory = currentPath;
                        process.chdir(currentPath);

                        this.updateSystemPrompt();

                        console.log(`✅ Selected: ${currentPath}`);
                        await this.saveWorkingDirectoryToConfig();
                        rl.close();
                        resolve();
                        return;
                    }

                    const choiceNum = parseInt(choice);
                    if (choiceNum === 0) {
                        currentPath = path.dirname(currentPath);
                        await showDirectory();
                    } else if (choiceNum >= 1 && choiceNum <= directories.length) {
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
        console.log(`      📅 Last used: ${modified}`);
    });

    console.log(`\n   ${models.length + 1}. 📥 Install a new model`);
    console.log(`\n   ${models.length + 2}. ⏭️  Skip model selection`);

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
    console.clear();
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
echo "🎨 Enhanced UI Features:"
echo "   ✅ Colorful terminal output"
echo "   ✅ Markdown rendering"
echo "   ✅ Progress spinners"
echo "   ✅ Beautiful tables"
echo "   ✅ ASCII art banner"
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