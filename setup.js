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