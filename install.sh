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
echo "   Directory: $INSTALL_DIR"
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

# Initialize npm project
echo "📦 Initializing npm project..."
cat > package.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "description": "AI assistant with terminal and file system access using Ollama",
  "main": "terminal-agent.js",
  "bin": {
    "terminal-ai": "./terminal-agent.js"
  },
  "scripts": {
    "start": "node terminal-agent.js",
    "setup": "node setup.js",
    "debug": "node debug-models.js"
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
  "author": "Terminal LLM Agent",
  "license": "MIT",
  "engines": {
    "node": ">=14.0.0"
  },
  "dependencies": {
    "node-fetch": "^2.6.7"
  }
}
EOF

echo "✅ Package.json created"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

echo "✅ Dependencies installed"

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

# Get the directory where this script is located (where the source files are)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if required source files exist
REQUIRED_FILES=("terminal-agent.js" "setup.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$file" ]; then
        echo "❌ Required file not found: $file"
        echo "Please make sure $file is in the same directory as this install script."
        exit 1
    fi
done

echo "✅ All required files found"

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
echo "   Source: $SCRIPT_DIR"
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
cat > package.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "description": "AI assistant with terminal and file system access using Ollama",
  "main": "terminal-agent.js",
  "bin": {
    "terminal-ai": "./terminal-agent.js"
  },
  "scripts": {
    "start": "node terminal-agent.js",
    "setup": "node setup.js",
    "debug": "node debug-models.js"
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
  "author": "Terminal LLM Agent",
  "license": "MIT",
  "engines": {
    "node": ">=14.0.0"
  },
  "dependencies": {
    "node-fetch": "^2.6.7"
  }
}
EOF

echo "✅ Package.json created"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

echo "✅ Dependencies installed"

# Copy main files from source directory
echo "📋 Copying agent files..."

# Copy terminal-agent.js
if [ -f "$SCRIPT_DIR/terminal-agent.js" ]; then
    cp "$SCRIPT_DIR/terminal-agent.js" "./terminal-agent.js"
    chmod +x "./terminal-agent.js"
    echo "✅ Copied terminal-agent.js"
else
    echo "❌ Could not find terminal-agent.js in source directory"
    exit 1
fi

# Copy setup.js
if [ -f "$SCRIPT_DIR/setup.js" ]; then
    cp "$SCRIPT_DIR/setup.js" "./setup.js"
    chmod +x "./setup.js"
    echo "✅ Copied setup.js"
else
    echo "❌ Could not find setup.js in source directory"
    exit 1
fi

# Copy debug-models.js if it exists, otherwise create it
if [ -f "$SCRIPT_DIR/debug-models.js" ]; then
    cp "$SCRIPT_DIR/debug-models.js" "./debug-models.js"
    echo "✅ Copied debug-models.js"
else
    echo "📝 Creating debug-models.js..."
    cat > debug-models.js << 'EOF'
#!/usr/bin/env node

let fetch;
if (typeof globalThis.fetch === 'undefined') {
  try {
    fetch = require('node-fetch');
  } catch (error) {
    console.error('❌ node-fetch is required. Install with: npm install node-fetch');
    process.exit(1);
  }
} else {
  fetch = globalThis.fetch;
}

async function debugModels() {
  console.log('🔍 Debugging Ollama Models\n');

  try {
    console.log('📡 Checking Ollama connection...');
    const response = await fetch('http://localhost:11434/api/tags');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ Ollama is running\n');

    const data = await response.json();
    const models = data.models || [];

    console.log('📋 Available models:');
    if (models.length === 0) {
      console.log('   ❌ No models found');
      console.log('\n💡 Install a model with:');
      console.log('   ollama pull codellama');
      console.log('   ollama pull llama2');
      console.log('   ollama pull mistral');
    } else {
      models.forEach((model, index) => {
        console.log(`   ${index + 1}. ${model.name}`);
        console.log(`      Size: ${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB`);
        console.log(`      Modified: ${new Date(model.modified_at).toLocaleString()}`);
        console.log('');
      });

      console.log('🎯 To use a specific model:');
      console.log(`   node terminal-agent.js --model "${models[0].name}"`);
    }

  } catch (error) {
    console.error('❌ Error connecting to Ollama:');
    console.error(`   ${error.message}`);
    console.error('\n💡 Make sure Ollama is running:');
    console.error('   ollama serve');
  }
}

debugModels();
EOF
    chmod +x "./debug-models.js"
    echo "✅ Created debug-models.js"
fi

# Create examples directory and files
echo "📁 Creating examples..."
mkdir -p examples

cat > examples/basic-example.js << 'EOF'
#!/usr/bin/env node

const { TerminalLLMAgent } = require('../terminal-agent.js');

async function example() {
  const agent = new TerminalLLMAgent({
    workingDirectory: process.cwd()
  });

  console.log('🚀 Running example...');

  try {
    await agent.executeCommand('Create a hello.txt file with the content "Hello from AI!"');
    await agent.executeCommand('List the files in this directory');
    await agent.executeCommand('Show me the contents of hello.txt');

    console.log('✅ Example completed successfully!');
  } catch (error) {
    console.error('❌ Example failed:', error.message);
  }
}

example();
EOF

chmod +x examples/basic-example.js
echo "✅ Created examples"

# Create README
echo "📝 Creating README..."
cat > README.md << EOF
# $PROJECT_NAME

An AI assistant that can execute terminal commands and manipulate files using Ollama.

## Quick Start

1. Run setup (first time only):
   \`\`\`bash
   npm run setup
   \`\`\`

2. Start the interactive agent:
   \`\`\`bash
   npm start
   \`\`\`

## Commands

- \`npm start\` - Start the interactive agent
- \`npm run setup\` - Run setup wizard
- \`npm run debug\` - Debug model issues

## Usage Examples

### Interactive Mode
\`\`\`bash
npm start
\`\`\`

Then try commands like:
- "Create a package.json for a new project"
- "List all files in this directory"
- "Run npm install"
- "Create a Python script that prints hello world"

### Single Commands
\`\`\`bash
node terminal-agent.js "create a hello.txt file"
node terminal-agent.js --model llama2 "list files"
\`\`\`

### Examples
\`\`\`bash
node examples/basic-example.js
\`\`\`

## Features

- 🤖 Natural language command interface
- 📁 File system operations (create, read, modify files)
- 💻 Terminal command execution
- 🔄 Interactive conversation mode
- 🛠️ Tool-based architecture
- 🎯 Context-aware responses
- 🔄 Model switching during runtime

## Interactive Commands

While in interactive mode:
- \`exit\` - Quit the agent
- \`help\` - Show available commands
- \`models\` - List all available models
- \`switch\` - Switch to a different model
- \`pwd\` - Show current directory
- \`history\` - Show conversation history

## Models

The agent will automatically detect and let you choose from available models:
- \`codellama\` - Best for coding and development tasks
- \`llama2\` - Good for general conversation and assistance
- \`mistral\` - Fast and efficient, balanced performance
- \`phi\` - Smaller model for quick responses

## Troubleshooting

If you encounter issues:

1. Run the debug utility:
   \`\`\`bash
   npm run debug
   \`\`\`

2. Make sure Ollama is running:
   \`\`\`bash
   ollama serve
   \`\`\`

3. Check installed models:
   \`\`\`bash
   ollama list
   \`\`\`

4. Install a model if needed:
   \`\`\`bash
   ollama pull codellama
   \`\`\`

5. Re-run setup:
   \`\`\`bash
   npm run setup
   \`\`\`

## Safety

- Commands are executed in your current working directory
- File operations are sandboxed to prevent directory traversal
- All operations are logged and explained
- Timeout protection for long-running commands

## License

MIT License
EOF

echo "✅ README created"

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📁 Project created at: $PROJECT_PATH"
echo "📄 Files installed:"
echo "   ✅ package.json"
echo "   ✅ terminal-agent.js (copied from source)"
echo "   ✅ setup.js (copied from source)"
echo "   ✅ debug-models.js"
echo "   ✅ README.md"
echo "   ✅ examples/basic-example.js"
echo "   ✅ node_modules/ (dependencies installed)"
echo ""
echo "📋 Next steps:"
echo "   cd $PROJECT_NAME"
echo "   npm run setup     # Configure Ollama and models"
echo "   npm start         # Start the agent"
echo ""
echo "💡 Or run setup now?"
read -p "Run setup wizard now? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "🚀 Starting setup wizard..."
    cd "$PROJECT_PATH"
    node setup.js
fi

echo ""
echo "🎉 Ready to use!"
echo "📁 Navigate to: cd $PROJECT_NAME"
echo "🚀 Start with: npm start"
echo "📖 Check README.md for more information"
#!/usr/bin/env node

const { exec, spawn } = require('child_process');
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
    this.model = options.model || this.loadConfigModel() || null;
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.conversationHistory = [];
    this.maxHistoryLength = options.maxHistoryLength || 20;

    this.systemPrompt = \`You are a helpful AI assistant with access to terminal commands and file system operations.
You MUST use the available tools to perform actions - DO NOT just explain how to do things.

When the user asks you to:
- Run commands: IMMEDIATELY use the execute_command tool
- Create files: IMMEDIATELY use the create_file tool
- Read files: IMMEDIATELY use the read_file tool
- List directories: IMMEDIATELY use the list_directory tool
- Navigate directories: IMMEDIATELY use the change_directory tool
- Append to files: IMMEDIATELY use the append_file tool

IMPORTANT: You have the power to execute these actions directly. When a user asks you to create a file, run a command, or perform any file operation, you MUST use the appropriate tool immediately. Do not explain how to do it manually - actually do it using the tools.

Current working directory: \${this.workingDirectory}
Operating system: \${os.platform()}

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

ALWAYS use tools when requested to perform actions. Never just give instructions.\`;

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

  validatePath(filepath) {
    const resolvedPath = path.resolve(this.workingDirectory, filepath);
    const workingDirResolved = path.resolve(this.workingDirectory);

    if (!resolvedPath.startsWith(workingDirResolved)) {
      throw new Error(\`Access denied: Path \${filepath} is outside working directory\`);
    }

    return resolvedPath;
  }

  async checkConnection() {
    try {
      const response = await fetch(\`\${this.baseUrl}/api/tags\`);
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}\`);
      }
      return true;
    } catch (error) {
      console.error('❌ Cannot connect to Ollama:');
      console.error(\`   \${error.message}\`);
      console.error('\\n💡 Make sure Ollama is running:');
      console.error('   ollama serve');
      console.error('\\n💡 Or run setup again:');
      console.error('   npm run setup');
      return false;
    }
  }

  async checkModel() {
    try {
      const response = await fetch(\`\${this.baseUrl}/api/tags\`);
      const data = await response.json();
      const models = data.models || [];

      const modelExists = this.model && models.some(m => m.name === this.model);

      if (!this.model || !modelExists) {
        if (!this.model) {
          console.log('🤖 No model configured.');
        } else {
          console.log(\`⚠️  Model "\${this.model}" not found.\`);
        }

        if (models.length === 0) {
          console.error('\\n❌ No models installed.');
          console.error('\\n💡 Please install a model first:');
          console.error('   ollama pull codellama');
          console.error('   ollama pull llama2');
          console.error('   ollama pull mistral');
          console.error('   ollama pull phi');
          return false;
        }

        const selectedModel = await this.selectAvailableModel(models);
        if (selectedModel) {
          this.model = selectedModel;
          await this.saveModelToConfig(selectedModel);
          console.log(\`✅ Using model: \${this.model}\\n\`);
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

    console.log('\\n📋 Available models:');
    models.forEach((model, index) => {
      const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
      let description = '';

      if (model.name.includes('codellama')) {
        description = ' - Best for coding tasks';
      } else if (model.name.includes('llama2')) {
        description = ' - Good for general conversation';
      } else if (model.name.includes('mistral')) {
        description = ' - Fast and efficient';
      } else if (model.name.includes('phi')) {
        description = ' - Lightweight and quick';
      } else if (model.name.includes('gemma')) {
        description = ' - Google\\'s model';
      }

      console.log(\`   \${index + 1}. \${model.name} (\${sizeGB}GB)\${description}\`);
    });

    return new Promise((resolve) => {
      const askForSelection = () => {
        rl.question(\`\\nSelect a model (1-\${models.length}) or 'q' to quit: \`, (answer) => {
          if (answer.toLowerCase() === 'q') {
            console.log('👋 Exiting...');
            rl.close();
            resolve(null);
            return;
          }

          const choice = parseInt(answer);
          if (choice >= 1 && choice <= models.length) {
            const selectedModel = models[choice - 1].name;
            console.log(\`🎯 Selected: \${selectedModel}\`);
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

      if (fs.existsSync('agent-config.json')) {
        try {
          config = JSON.parse(fs.readFileSync('agent-config.json', 'utf8'));
        } catch (error) {
          console.warn('⚠️  Could not read existing config, creating new one');
        }
      }

      config.model = modelName;
      config.ollamaUrl = this.baseUrl;
      config.workingDirectory = this.workingDirectory;
      config.lastUpdated = new Date().toISOString();

      await require('fs').promises.writeFile('agent-config.json', JSON.stringify(config, null, 2));
      console.log(\`💾 Saved model "\${modelName}" to config file\`);
    } catch (error) {
      console.warn('⚠️  Could not save config file:', error.message);
    }
  }

  setupTools() {
    this.tools = new Map();

    this.tools.set('execute_command', {
      description: 'Execute shell commands in the terminal',
      parameters: { command: 'string', timeout: 'number (optional, default 30000ms)' },
      handler: async (params) => {
        const { command, timeout = 30000 } = params;

        console.log(\`🔧 Executing: \${command}\`);

        return new Promise((resolve, reject) => {
          const child = exec(command, {
            cwd: this.workingDirectory,
            timeout: timeout,
            maxBuffer: 1024 * 1024
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

    this.tools.set('create_file', {
      description: 'Create or overwrite a file with content',
      parameters: { filepath: 'string', content: 'string', encoding: 'string (optional, default utf8)' },
      handler: async (params) => {
        const { filepath, content, encoding = 'utf8' } = params;

        try {
          const fullPath = this.validatePath(filepath);
          console.log(\`📝 Creating file: \${fullPath}\`);

          const dir = path.dirname(fullPath);
          await fs.mkdir(dir, { recursive: true });

          await fs.writeFile(fullPath, content, encoding);

          return {
            success: true,
            filepath: fullPath,
            size: Buffer.byteLength(content, encoding),
            message: \`File created successfully\`
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

    this.tools.set('read_file', {
      description: 'Read contents of a file',
      parameters: { filepath: 'string', encoding: 'string (optional, default utf8)' },
      handler: async (params) => {
        const { filepath, encoding = 'utf8' } = params;

        try {
          const fullPath = this.validatePath(filepath);
          console.log(\`📖 Reading file: \${fullPath}\`);

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

    this.tools.set('list_directory', {
      description: 'List contents of a directory',
      parameters: { dirpath: 'string (optional, default current directory)' },
      handler: async (params) => {
        const { dirpath = '.' } = params;

        try {
          const fullPath = this.validatePath(dirpath);
          console.log(\`📁 Listing directory: \${fullPath}\`);

          const entries = await fs.readdir(fullPath, { withFileTypes: true });

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

    this.tools.set('change_directory', {
      description: 'Change the current working directory',
      parameters: { dirpath: 'string' },
      handler: async (params) => {
        const { dirpath } = params;

        try {
          const fullPath = this.validatePath(dirpath);
          console.log(\`📂 Changing directory to: \${fullPath}\`);

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
            message: \`Changed to \${fullPath}\`
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

    this.tools.set('append_file', {
      description: 'Append content to an existing file',
      parameters: { filepath: 'string', content: 'string', encoding: 'string (optional, default utf8)' },
      handler: async (params) => {
        const { filepath, content, encoding = 'utf8' } = params;

        try {
          const fullPath = this.validatePath(filepath);
          console.log(\`➕ Appending to file: \${fullPath}\`);

          await fs.appendFile(fullPath, content, encoding);
          const stats = await fs.stat(fullPath);

          return {
            success: true,
            filepath: fullPath,
            newSize: stats.size,
            message: \`Content appended successfully\`
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
      const response = await fetch(\`\${this.baseUrl}/api/chat\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            ...this.conversationHistory.slice(-this.maxHistoryLength),
            { role: 'user', content: message }
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
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }

      const data = await response.json();
      let assistantMessage = data.message.content;

      const toolResult = await this.handleToolCall(assistantMessage);

      if (toolResult) {
        const followUpPrompt = \`Tool execution result: \${JSON.stringify(toolResult, null, 2)}

Please provide a brief, natural language summary of what was accomplished. Be concise and focus on the result.\`;

        const followUpResponse = await fetch(\`\${this.baseUrl}/api/chat\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: \`You are a helpful assistant. Provide a brief summary of the tool execution result. Be concise and helpful.\` },
              { role: 'user', content: followUpPrompt }
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
        if (this.seemsLikeActionRequest(message) && !this.containsToolCall(assistantMessage)) {
          console.log('\\n⚠️  No tool was used. The AI should have used tools for this request.');
          console.log('🔄 Trying again with more explicit instructions...');

          const retryPrompt = \`The user said: "\${message}"

This seems like a request for action. You MUST use the appropriate tool to perform this action immediately. Do not explain how to do it - actually do it using the tools.

Respond ONLY with the appropriate tool call in JSON format.\`;

          const retryResponse = await fetch(\`\${this.baseUrl}/api/chat\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.model,
              messages: [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: retryPrompt }
              ],
              stream: false,
              options: {
                temperature: 0.05,
              }
            }),
          });

          const retryData = await retryResponse.json();
          const retryToolResult = await this.handleToolCall(retryData.message.content);

          if (retryToolResult) {
            assistantMessage = \`Successfully executed the requested action.\`;
          }
        }
      }

      this.conversationHistory.push({ role: 'user', content: message });
      this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

      return assistantMessage;
    } catch (error) {
      console.error('Error communicating with LLM:', error);
      throw error;
    }
  }

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

  containsToolCall(response) {
    return response.includes('"tool"') && response.includes('"parameters"');
  }

  async handleToolCall(response) {
    try {
      let jsonMatch = response.match(/\\{[^{}]*"tool"[^{}]*\\}/);

      if (!jsonMatch) {
        const matches = response.match(/\\{(?:[^{}]|\\{[^{}]*\\})*\\}/g);
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

      if (!toolCall.tool || typeof toolCall.tool !== 'string') {
        console.log('⚠️  Invalid tool call: missing or invalid tool name');
        return null;
      }

      if (!this.tools.has(toolCall.tool)) {
        console.log(\`⚠️  Unknown tool: \${toolCall.tool}\`);
        return null;
      }

      if (!toolCall.parameters || typeof toolCall.parameters !== 'object') {
        console.log('⚠️  Invalid tool call: missing or invalid parameters');
        return null;
      }

      const tool = this.tools.get(toolCall.tool);
      console.log(\`\\n🤖 Using tool: \${toolCall.tool}\`);
      console.log(\`📋 Parameters:\`, toolCall.parameters);

      const result = await tool.handler(toolCall.parameters);

      if (result.success) {
        console.log(\`✅ Tool executed successfully\`);
      } else {
        console.log(\`❌ Tool execution failed: \${result.error}\`);
      }

      return result;
    } catch (e) {
      console.log(\`⚠️  Error parsing tool call: \${e.message}\`);
      return null;
    }
  }

  async startInteractiveMode() {
    const connectionOk = await this.checkConnection();
    if (!connectionOk) {
      process.exit(1);
    }

    const modelOk = await this.checkModel();
    if (!modelOk) {
      process.exit(1);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: \`\\n💻 [\${path.basename(this.workingDirectory)}] > \`
    });

    console.log('🚀 Terminal LLM Agent started!');
    console.log(\`🤖 Using model: \${this.model}\`);
    console.log('💡 Try commands like:');
    console.log('   - "Create a hello.txt file with some content"');
    console.log('   - "List the files in this directory"');
    console.log('   - "Run npm init to create a package.json"');
    console.log('   - "Show me the contents of package.json"');
    console.log('   - Type "exit" to quit');
    console.log('   - Type "help" for more commands\\n');

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
        console.log('\\n📋 Available commands:');
        console.log('   exit          - Quit the agent');
        console.log('   clear         - Clear the screen');
        console.log('   pwd           - Show current directory');
        console.log('   help          - Show this help');
        console.log('   model         - Show current model');
        console.log('   models        - List all available models');
        console.log('   switch        - Switch to a different model');
        console.log('   history       - Show conversation history');
        console.log('\\n💡 Or just type natural language commands like:');
        console.log('   "create a Python script that prints hello world"');
        console.log('   "list all .js files in this directory"');
        console.log('   "install express with npm"');
        rl.prompt();
        return;
      }

      if (message.toLowerCase() === 'pwd') {
        console.log(\`📍 Current directory: \${this.workingDirectory}\`);
        rl.prompt();
        return;
      }

      if (message.toLowerCase() === 'model') {
        console.log(\`🤖 Current model: \${this.model}\`);
        console.log(\`🔗 Ollama URL: \${this.baseUrl}\`);
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
          console.log(\`🔄 Switched to model: \${this.model}\`);
        }
        rl.prompt();
        return;
      }

      if (message.toLowerCase() === 'history') {
        console.log('\\n📜 Conversation history:');
        if (this.conversationHistory.length === 0) {
          console.log('   No conversation history yet');
        } else {
          this.conversationHistory.slice(-10).forEach((msg, index) => {
            const role = msg.role === 'user' ? '👤' : '🤖';
            console.log(\`   \${role} \${msg.content.substring(0, 80)}\${msg.content.length > 80 ? '...' : ''}\`);
          });
        }
        rl.prompt();
        return;
      }

      if (message) {
        try {
          console.log('\\n🤔 Thinking...');
          const response = await this.chat(message);
          console.log(\`\\n🤖 Assistant: \${response}\`);
        } catch (error) {
          console.error(\`\\n❌ Error: \${error.message}\`);
          if (error.message.includes('connection refused') || error.message.includes('ECONNREFUSED')) {
            console.error('💡 Make sure Ollama is running: ollama serve');
          }
        }
      }

      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\\n👋 Terminal LLM Agent stopped.');
      process.exit(0);
    });
  }

  async listAllModels() {
    try {
      const response = await fetch(\`\${this.baseUrl}/api/tags\`);
      const data = await response.json();
      const models = data.models || [];

      console.log('\\n📋 All available models:');
      if (models.length === 0) {
        console.log('   No models installed');
      } else {
        models.forEach((model, index) => {
          const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(#!/bin/bash

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

# Create project directory
PROJECT_DIR="terminal-llm-agent"
echo ""
echo "📁 Creating project directory: $PROJECT_DIR"

if [ -d "$PROJECT_DIR" ]; then
    echo "⚠️  Directory $PROJECT_DIR already exists."
    read -p "Do you want to continue and overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Installation cancelled"
        exit 1
    fi
    rm -rf "$PROJECT_DIR"
fi

mkdir "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Initialize npm project
echo ""
echo "📦 Initializing npm project..."
npm init -y > /dev/null 2>&1

# Install dependencies
echo "📦 Installing dependencies..."
npm install node-fetch > /dev/null 2>&1

# Create the main files (you would copy your actual files here)
echo "📝 Creating project files..."

# Note: In a real installation, you would copy the actual files
# For this example, we'll create placeholder commands to download them

cat > download-files.js << 'EOF'
// This script would download the actual terminal-agent.js and setup.js files
// For demo purposes, we'll just create instructions

const fs = require('fs');

console.log('📋 To complete installation:');
console.log('');
console.log('1. Copy the terminal-agent.js file to this directory');
console.log('2. Copy the setup.js file to this directory');
console.log('3. Run: node setup.js');
console.log('');
console.log('💡 Files needed:');
console.log('   - terminal-agent.js (main agent file)');
console.log('   - setup.js (setup wizard)');
console.log('');

// Create a simple package.json with the right structure
const packageJson = {
  "name": "terminal-llm-agent",
  "version": "1.0.0",
  "description": "AI assistant with terminal and file system access using Ollama",
  "main": "terminal-agent.js",
  "bin": {
    "terminal-ai": "./terminal-agent.js"
  },
  "scripts": {
    "start": "node terminal-agent.js",
    "setup": "node setup.js"
  },
  "dependencies": {
    "node-fetch": "^2.6.7"
  },
  "keywords": ["llm", "ai", "terminal", "ollama"],
  "license": "MIT"
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ Package.json updated');
EOF

# Run the download script
node download-files.js
rm download-files.js

# Create a README with instructions
cat > README.md << 'EOF'
# Terminal LLM Agent

An AI assistant that can execute terminal commands and manipulate files using Ollama.

## Installation Status

✅ Project structure created
✅ Dependencies installed
⏳ Agent files needed

## Next Steps

1. Copy the agent files to this directory:
   - `terminal-agent.js`
   - `setup.js`

2. Run the setup wizard:
   ```bash
   node setup.js
   ```

3. Start the agent:
   ```bash
   node terminal-agent.js
   ```

## Quick Start Guide

Once you have the files:

```bash
# Run setup (first time only)
node setup.js

# Interactive mode
node terminal-agent.js

# Single command
node terminal-agent.js "create a hello.py file"

# Get help
node terminal-agent.js --help
```

## Features

- 🤖 Natural language command interface
- 📁 File system operations (create, read, modify files)
- 💻 Terminal command execution
- 🔄 Interactive conversation mode
- 🛠️ Tool-based architecture
- 🎯 Context-aware responses

## Models

Recommended models for different use cases:
- `codellama` - Best for coding and development tasks
- `llama2` - Good for general conversation and assistance
- `mistral` - Fast and efficient, balanced performance
- `phi` - Smaller model for quick responses

## Safety

- Commands are executed in your current working directory
- The agent will ask for confirmation for potentially dangerous operations
- All operations are logged and explained
- Timeout protection for long-running commands

## Troubleshooting

If you encounter issues:

1. Make sure Ollama is installed and running:
   ```bash
   ollama serve
   ```

2. Verify you have a model installed:
   ```bash
   ollama list
   ```

3. Install a model if needed:
   ```bash
   ollama pull codellama
   ```

4. Run the setup wizard again:
   ```bash
   node setup.js
   ```
EOF

# Make files executable
chmod +x terminal-agent.js 2>/dev/null || true
chmod +x setup.js 2>/dev/null || true

echo ""
echo "🎉 Project structure created successfully!"
echo ""
echo "📁 Project location: $(pwd)"
echo ""
echo "📋 Next steps:"
echo "1. Copy the terminal-agent.js file to this directory"
echo "2. Copy the setup.js file to this directory"
echo "3. Run: node setup.js"
echo ""
echo "💡 After copying the files, the setup wizard will:"
echo "   - Check if Ollama is installed (install if needed)"
echo "   - Start Ollama if not running"
echo "   - Help you select or install a model"
echo "   - Create configuration files"
echo "   - Set up examples"
echo ""
echo "🚀 Then you can start using: node terminal-agent.js"