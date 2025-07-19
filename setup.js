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
            name: 'codellama',
            description: 'Best for coding tasks and programming',
            size: '~3.8GB',
            command: 'ollama pull codellama',
            useCase: 'Perfect for: JavaScript, Python, React, debugging, code generation'
        },
        {
            name: 'llama2',
            description: 'General purpose, excellent for conversations',
            size: '~3.8GB',
            command: 'ollama pull llama2',
            useCase: 'Perfect for: Writing, analysis, general questions, explanations'
        },
        {
            name: 'mistral',
            description: 'Fast and efficient, good balance',
            size: '~4.1GB',
            command: 'ollama pull mistral',
            useCase: 'Perfect for: Quick responses, balanced performance, general tasks'
        },
        {
            name: 'phi',
            description: 'Lightweight model, fastest responses',
            size: '~1.6GB',
            command: 'ollama pull phi',
            useCase: 'Perfect for: Quick tasks, limited resources, fast iteration'
        },
        {
            name: 'deepseek-coder',
            description: 'Specialized coding model',
            size: '~3.8GB',
            command: 'ollama pull deepseek-coder',
            useCase: 'Perfect for: Advanced coding, algorithms, code optimization'
        }
    ];

    recommendedModels.forEach((model, index) => {
        console.log(`\n${index + 1}. 🤖 ${model.name} (${model.size})`);
        console.log(`   📝 ${model.description}`);
        console.log(`   🎯 ${model.useCase}`);
        console.log(`   📦 Install: ${model.command}`);
    });

    console.log('\n💡 Recommendations:');
    console.log('   🔧 For coding projects → codellama or deepseek-coder');
    console.log('   💬 For general use → llama2 or mistral');
    console.log('   ⚡ For speed/resources → phi');
}

async function selectModel(models) {
    if (models.length === 0) {
        return null;
    }

    console.log('\n📋 Currently installed models:');
    models.forEach((model, index) => {
        let description = '';
        const modelName = model.name.toLowerCase();

        if (modelName.includes('codellama')) {
            description = ' - 🔧 Best for coding';
        } else if (modelName.includes('llama2')) {
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

    const modelName = await askQuestion('\n📥 Enter the model name to install (e.g., codellama): ');

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

async function createExampleFiles() {
    console.log('\n📁 Creating example files...');

    try {
        await fs.mkdir('examples', {recursive: true});

        const exampleScript = `#!/usr/bin/env node

/**
 * Terminal LLM Agent Example
 * 
 * This example demonstrates how to use the Terminal LLM Agent programmatically.
 * It automatically detects the correct agent file (renamed or original).
 */

const fs = require('fs');
const path = require('path');

// Find the agent file (could be terminal-agent.js or model-specific)
function findAgentFile() {
  console.log('🔍 Looking for agent file...');
  
  const files = fs.readdirSync('..');
  const agentFiles = files.filter(file => file.endsWith('-agent.js'));
  
  if (agentFiles.length > 0) {
    console.log(\`✅ Found model-specific agent: \${agentFiles[0]}\`);
    return agentFiles[0];
  }
  
  if (fs.existsSync('../terminal-agent.js')) {
    console.log('✅ Found generic terminal-agent.js');
    return 'terminal-agent.js';
  }
  
  throw new Error('❌ No agent file found. Please run setup first.');
}

async function runExample() {
  console.log('🚀 Terminal LLM Agent Example');
  console.log('=============================\\n');
  
  try {
    const agentFile = findAgentFile();
    const { TerminalLLMAgent } = require(\`../\${agentFile}\`);

    // Create agent instance
    const agent = new TerminalLLMAgent({
      workingDirectory: process.cwd()
    });

    console.log('🤖 Agent initialized successfully!');
    console.log(\`📁 Working directory: \${process.cwd()}\`);
    console.log('\\n⏳ Running example tasks...\\n');
    
    // Example 1: Create a file
    console.log('📝 Task 1: Creating a hello.txt file...');
    await agent.executeCommand('Create a hello.txt file with the content "Hello from AI! This is a test file created by the Terminal LLM Agent."');
    
    // Example 2: List directory contents
    console.log('\\n📋 Task 2: Listing files in current directory...');
    await agent.executeCommand('List the files in this directory and show their details');
    
    // Example 3: Read the file we just created
    console.log('\\n📖 Task 3: Reading the hello.txt file...');
    await agent.executeCommand('Show me the contents of hello.txt');
    
    // Example 4: Create a simple script
    console.log('\\n🐍 Task 4: Creating a Python script...');
    await agent.executeCommand('Create a simple Python script called greet.py that asks for a name and prints a greeting');
    
    console.log('\\n✅ All example tasks completed successfully!');
    console.log('\\n💡 Try running the agent interactively:');
    console.log(\`   node ../\${agentFile}\`);
    console.log('   npm start');
    
  } catch (error) {
    console.error('❌ Example failed:', error.message);
    console.log('\\n🔧 Troubleshooting tips:');
    console.log('   1. Make sure Ollama is running: ollama serve');
    console.log('   2. Check if you have a model installed: ollama list');
    console.log('   3. Run setup again: npm run setup');
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\\n👋 Example interrupted by user');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\\n💥 Unexpected error:', error.message);
  process.exit(1);
});

// Run the example
runExample();
`;

        await fs.writeFile('examples/basic-example.js', exampleScript);

        // Create advanced example
        const advancedExample = `#!/usr/bin/env node

/**
 * Advanced Terminal LLM Agent Example
 * 
 * This example shows more advanced usage patterns including:
 * - Error handling
 * - Multiple commands
 * - Working with different file types
 */

const fs = require('fs');
const path = require('path');

function findAgentFile() {
  const files = fs.readdirSync('..');
  const agentFiles = files.filter(file => file.endsWith('-agent.js'));
  
  if (agentFiles.length > 0) {
    return agentFiles[0];
  }
  
  if (fs.existsSync('../terminal-agent.js')) {
    return 'terminal-agent.js';
  }
  
  throw new Error('No agent file found');
}

async function advancedExample() {
  console.log('🧪 Advanced Terminal LLM Agent Example');
  console.log('======================================\\n');
  
  try {
    const agentFile = findAgentFile();
    const { TerminalLLMAgent } = require(\`../\${agentFile}\`);

    const agent = new TerminalLLMAgent({
      workingDirectory: process.cwd()
    });

    // Project setup example
    console.log('🏗️  Setting up a sample project...');
    
    await agent.executeCommand('Create a package.json file for a new Node.js project called "my-awesome-app" with express as a dependency');
    
    await agent.executeCommand('Create an app.js file with a basic Express.js server that serves a "Hello World" message on port 3000');
    
    await agent.executeCommand('Create a README.md file explaining how to run this Express.js application');
    
    console.log('\\n📊 Analyzing what we created...');
    await agent.executeCommand('List all files we just created and show their sizes');
    
    console.log('\\n📖 Reading our README...');
    await agent.executeCommand('Show me the contents of the README.md file');
    
    console.log('\\n✅ Advanced example completed!');
    
  } catch (error) {
    console.error('❌ Advanced example failed:', error.message);
  }
}

advancedExample();
`;

        await fs.writeFile('examples/advanced-example.js', advancedExample);

        // Create project templates example
        const templatesExample = `#!/usr/bin/env node

/**
 * Project Templates Example
 * 
 * Shows how to use the agent to create different types of projects
 */

const fs = require('fs');

function findAgentFile() {
  const files = fs.readdirSync('..');
  const agentFiles = files.filter(file => file.endsWith('-agent.js'));
  return agentFiles[0] || 'terminal-agent.js';
}

async function createProjectTemplate(type) {
  const agentFile = findAgentFile();
  const { TerminalLLMAgent } = require(\`../\${agentFile}\`);
  
  const agent = new TerminalLLMAgent({
    workingDirectory: process.cwd()
  });
  
  console.log(\`🎯 Creating \${type} project template...\\n\`);
  
  switch (type) {
    case 'react':
      await agent.executeCommand('Create a basic React project structure with package.json, App.js, and index.html');
      break;
    case 'python':
      await agent.executeCommand('Create a Python project with main.py, requirements.txt, and README.md files');
      break;
    case 'express':
      await agent.executeCommand('Create an Express.js API project with proper folder structure including routes, middleware, and config files');
      break;
    default:
      console.log('Unknown template type');
  }
}

// Get template type from command line argument
const templateType = process.argv[2] || 'express';
createProjectTemplate(templateType);
`;

        await fs.writeFile('examples/project-templates.js', templatesExample);

        // Make all examples executable
        await fs.chmod('examples/basic-example.js', 0o755);
        await fs.chmod('examples/advanced-example.js', 0o755);
        await fs.chmod('examples/project-templates.js', 0o755);

        console.log('✅ Created example files:');
        console.log('   📄 examples/basic-example.js');
        console.log('   🧪 examples/advanced-example.js');
        console.log('   🎯 examples/project-templates.js');

    } catch (error) {
        console.log(`⚠️  Could not create example files: ${error.message}`);
    }
}

async function createReadme(selectedModel) {
    console.log('📝 Creating comprehensive README...');

    const baseModelName = selectedModel ? selectedModel.split(':')[0].toLowerCase() : 'terminal';
    const agentFileName = selectedModel ? `${baseModelName}-agent.js` : 'terminal-agent.js';
    const modelDisplayName = baseModelName.charAt(0).toUpperCase() + baseModelName.slice(1);

    // Helper function for model optimizations
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

    // Helper function for detailed model optimizations
    function getModelOptimizations(modelName) {
        const details = {
            codellama: `
- **Temperature**: Lower for consistent code generation
- **Context**: Optimized for programming languages and frameworks
- **Tools**: Enhanced file operations for development workflows
- **Prompting**: Structured for technical precision`,

            llama2: `
- **Temperature**: Balanced for creative and analytical tasks
- **Context**: Optimized for natural language understanding
- **Tools**: Enhanced for document creation and analysis
- **Prompting**: Conversational and helpful tone`,

            mistral: `
- **Temperature**: Optimized for quick, accurate responses
- **Context**: Efficient context handling for speed
- **Tools**: Streamlined for fast operations
- **Prompting**: Direct and efficient communication`,

            phi: `
- **Temperature**: Lightweight configuration for speed
- **Context**: Minimal context for resource efficiency
- **Tools**: Essential tools only for performance
- **Prompting**: Concise and to-the-point`,

            'deepseek-coder': `
- **Temperature**: Very low for precise code generation
- **Context**: Deep understanding of complex algorithms
- **Tools**: Advanced code analysis and optimization
- **Prompting**: Technical precision and best practices`
        };

        return details[modelName] || '- **Configuration**: Standard optimizations for general use';
    }

    const readme = `# ${modelDisplayName} Terminal Agent

An AI assistant powered by ${selectedModel || 'Ollama'} with terminal and file system access.

## 🚀 Quick Start

\`\`\`bash
# Start the agent
npm start

# Or run directly
node ${agentFileName}

# Run examples
node examples/basic-example.js
\`\`\`

## ✨ Features

- 🤖 **AI-Powered Commands**: Natural language to terminal actions
- 📁 **File Operations**: Create, read, modify files securely
- 💻 **Command Execution**: Run any terminal command safely
- 🔄 **Interactive Mode**: Conversational interface
- 📂 **Directory Management**: Smart working directory selection
- 🛡️ **Security**: Sandboxed operations, path validation
- ⚡ **Model Optimized**: Customized for ${modelDisplayName}

## 📋 Available Commands

### NPM Scripts
\`\`\`bash
npm start                 # Start the agent
npm run start:${baseModelName}    # Model-specific start
npm run setup            # Re-run setup wizard
npm run debug            # Debug Ollama/models
\`\`\`

### Direct Execution
\`\`\`bash
node ${agentFileName}                    # Interactive mode
node ${agentFileName} "create a file"    # Single command
node ${agentFileName} --help            # Show help
\`\`\`

## 🎯 Usage Examples

### Interactive Mode
\`\`\`bash
npm start

# Then try commands like:
# "Create a package.json for a React project"
# "List all JavaScript files in this directory"
# "Run npm install to install dependencies"
# "Create a Python script that calculates fibonacci numbers"
# "Show me the contents of package.json"
\`\`\`

### Single Commands
\`\`\`bash
node ${agentFileName} "create a hello.txt file with a greeting"
node ${agentFileName} "initialize a git repository and make first commit"
node ${agentFileName} "create a basic Express.js server"
\`\`\`

## 🛠️ Interactive Commands

While in interactive mode, you can use these special commands:

| Command | Description |
|---------|-------------|
| \`help\` | Show all available commands |
| \`exit\` | Quit the agent |
| \`pwd\` | Show current directory |
| \`cd\` | Change working directory |
| \`model\` | Show current model info |
| \`models\` | List all available models |
| \`switch\` | Switch to different model |
| \`history\` | Show conversation history |
| \`clear\` | Clear the screen |

## 📁 Directory Selection

On first run, the agent offers multiple ways to select your working directory:

1. **Use Current Directory** - Work in the current location
2. **Enter Custom Path** - Type any directory path
3. **Browse from Home** - Navigate from your home directory
4. **Browse from Root** - Navigate from system root

## 🔧 Model Information

- **Model**: ${selectedModel || 'Not configured'}
- **Optimized for**: ${getModelOptimization(baseModelName)}
- **Agent File**: \`${agentFileName}\`
- **Configuration**: \`agent-config.json\`

### Model-Specific Optimizations

This agent is optimized for **${modelDisplayName}**:
${getModelOptimizations(baseModelName)}

## 📚 Examples

### Basic Example
\`\`\`bash
node examples/basic-example.js
\`\`\`

### Advanced Example
\`\`\`bash
node examples/advanced-example.js
\`\`\`

### Project Templates
\`\`\`bash
node examples/project-templates.js react
node examples/project-templates.js python
node examples/project-templates.js express
\`\`\`

## 🛡️ Security Features

- **Path Validation**: Prevents directory traversal attacks
- **Sandboxed Operations**: All file operations stay within working directory
- **Command Timeouts**: Automatic timeout for long-running commands
- **Operation Logging**: All actions are logged and explained
- **Error Recovery**: Graceful handling of failed operations

## 🔧 Troubleshooting

### Common Issues

**1. Agent won't start**
\`\`\`bash
# Check Ollama is running
ollama serve

# Verify model is installed
ollama list

# Re-run setup
npm run setup
\`\`\`

**2. Model not found**
\`\`\`bash
# Install your model
ollama pull ${selectedModel || 'codellama'}

# Debug models
npm run debug
\`\`\`

**3. Permission errors**
\`\`\`bash
# Make agent executable
chmod +x ${agentFileName}

# Fix npm permissions if needed
npm config set prefix ~/.npm-global
\`\`\`

### Debug Tools

\`\`\`bash
# Run diagnostics
npm run debug

# Check configuration
cat agent-config.json

# Verify file structure
ls -la *-agent.js
\`\`\`

## 📊 Performance Tips

- **Be Specific**: Clear, detailed requests get better results
- **Context Matters**: The agent remembers previous commands in the session
- **Batch Operations**: Combine related tasks in one request
- **Use Examples**: Show the agent what you want when possible

## 📄 License

MIT License - feel free to modify and distribute!

## 🆘 Support

- 📖 Check this README for solutions
- 🔧 Run \`npm run debug\` for diagnostics
- 🔄 Run \`npm run setup\` to reconfigure
- 💬 Check the examples/ directory for usage patterns

---

**Happy coding with ${modelDisplayName}! 🤖✨**
`;

    try {
        await fs.writeFile('README.md', readme);
        console.log('✅ Comprehensive README created');
    } catch (error) {
        console.log(`⚠️  Could not create README: ${error.message}`);
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

    // Step 6: Create examples and documentation
    console.log('\n📚 Step 6: Creating examples and documentation...');
    await createExampleFiles();
    await createReadme(selectedModel);

    // Step 7: Final summary and next steps
    console.log('\n🎉 Setup Complete!');
    console.log('==================');

    if (selectedModel) {
        const baseModelName = selectedModel.split(':')[0].toLowerCase();
        const agentFileName = `${baseModelName}-agent.js`;
        const modelDisplayName = baseModelName.charAt(0).toUpperCase() + baseModelName.slice(1);

        console.log(`\n✨ Your ${modelDisplayName} agent is ready to use!`);
        console.log('\n📋 Quick Start Commands:');
        console.log(`   🚀 npm start                    # Start interactive mode`);
        console.log(`   🎯 node ${agentFileName}         # Direct execution`);
        console.log(`   📦 npm run start:${baseModelName}   # Model-specific script`);

        console.log('\n📚 Try the examples:');
        console.log('   📄 node examples/basic-example.js');
        console.log('   🧪 node examples/advanced-example.js');
        console.log('   🎯 node examples/project-templates.js react');

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
    createExampleFiles,
    createReadme,
    setup
};