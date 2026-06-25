// ============================================================
// DevStudio – app-ai.js
// INTELLIGENT VERSION - AI understands intent, no pattern matching
// FIXED: Settings persistence for Electron
// ADDED: Groq AI support
// ============================================================

// ============================================================
// PROVIDERS CONFIGURATION
// ============================================================
app.providers = {
    local: { 
        name: 'Ollama', 
        help: 'Runs locally on your machine - no API key needed!',
        cors: true,
        defaultModel: 'gemma4:latest'
    },
    openai: { 
        name: 'OpenAI', 
        help: 'Requires API key from platform.openai.com',
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4'
    },
    google: { 
        name: 'Google Gemini', 
        help: 'Requires API key from makersuite.google.com',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: ['gemini-pro', 'gemini-pro-vision'],
        defaultModel: 'gemini-pro'
    },
    anthropic: { 
        name: 'Anthropic Claude', 
        help: 'Requires API key from console.anthropic.com',
        baseUrl: 'https://api.anthropic.com/v1/messages',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        defaultModel: 'claude-3-sonnet'
    },
    deepseek: { 
        name: 'Deepseek', 
        help: 'Requires API key from platform.deepseek.com',
        baseUrl: 'https://api.deepseek.com/v1/chat/completions',
        models: ['deepseek-chat', 'deepseek-coder'],
        defaultModel: 'deepseek-chat'
    },
    kimi: { 
        name: 'Kimi (Moonshot)', 
        help: 'FREE credits but CORS blocked! Use proxy or switch to Ollama',
        baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        defaultModel: 'moonshot-v1-8k'
    },
    groq: { 
        name: 'Groq', 
        help: 'Get your Groq API key from https://console.groq.com',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        models: ['mixtral-8x7b-32768', 'llama3-70b-8192', 'llama3-8b-8192', 'gemma-7b-it'],
        defaultModel: 'mixtral-8x7b-32768'
    }
};

// ============================================================
// SAVE AI SETTINGS
// ============================================================
app.saveAISettings = function () {
    // Get all AI settings from the form
    const provider = document.getElementById('ai-provider').value;
    const apiKey = document.getElementById('ai-api-key').value.trim();
    
    // Get model from either select or text input
    const modelSelect = document.getElementById('ai-model-select');
    const modelText = document.getElementById('ai-model-text');
    let model = '';
    
    if (provider === 'local') {
        // For Ollama, check if dropdown is visible and get value
        if (modelSelect && modelSelect.style.display !== 'none') {
            model = modelSelect.value;
            // Skip the refresh option if selected
            if (model === '__REFRESH__') {
                model = this.ai.model || '';
            }
        } else if (modelText && modelText.style.display !== 'none') {
            model = modelText.value.trim();
        }
    } else {
        // For cloud providers
        if (modelSelect && modelSelect.style.display !== 'none') {
            model = modelSelect.value;
        } else if (modelText && modelText.style.display !== 'none') {
            model = modelText.value.trim();
        }
    }
    
    const endpoint = document.getElementById('ai-endpoint').value.trim();
    const autoApply = document.getElementById('ai-auto-apply').checked;
    
    // Save to app.ai object
    this.ai = {
        provider: provider,
        apiKey: apiKey,
        model: model,
        endpoint: endpoint,
        autoApply: autoApply
    };
    
    // Set defaults for local provider if needed
    if (this.ai.provider === 'local' && !this.ai.model) {
        this.ai.model = 'gemma4:latest';
    }
    if (this.ai.provider === 'local' && !this.ai.endpoint) {
        this.ai.endpoint = 'http://localhost:11434';
    }
    
    // Update UI badge to show active provider
    this.updateProviderUI();
    
    console.log('AI Settings saved:', {
        provider: this.ai.provider,
        model: this.ai.model,
        autoApply: this.ai.autoApply
    });
};

app.saveSettingsAndClose = function () {
    // ============================================================
    // SAVE EDITOR SETTINGS
    // ============================================================
    
    // Save font size
    const fontSize = parseInt(document.getElementById('editor-font-size').value);
    if (fontSize >= 10 && fontSize <= 24) {
        this.settings.fontSize = fontSize;
    }
    
    // Save theme
    const theme = document.getElementById('editor-theme').value;
    this.settings.theme = theme;
    
    // ============================================================
    // SAVE AI SETTINGS (saves provider, apiKey, model, endpoint, autoApply)
    // ============================================================
    this.saveAISettings();
    
    // ============================================================
    // APPLY SETTINGS TO EDITOR
    // ============================================================
    
    // Apply theme to editor
    this.updateEditorTheme();
    
    // Apply font size to editor
    if (this.editor && !this.useFallbackEditor) {
        this.editor.updateOptions({ fontSize: this.settings.fontSize });
    } else if (this.useFallbackEditor) {
        const fallbackEditor = document.getElementById('fallback-editor');
        if (fallbackEditor) {
            fallbackEditor.style.fontSize = this.settings.fontSize + 'px';
        }
    }
    
    // ============================================================
    // FORCE SAVE TO STORAGE (saves EVERYTHING)
    // ============================================================
    this.saveToStorage();
    
    // ============================================================
    // CLOSE MODAL AND SHOW CONFIRMATION
    // ============================================================
    this.closeModal('settings-modal');
    this.showToast('All settings saved successfully!');
    
    // For Electron, force reapply theme (Monaco loads differently in Electron)
    if (window.isElectron && this.editor && !this.useFallbackEditor) {
        setTimeout(() => {
            try {
                if (typeof monaco !== 'undefined' && monaco.editor) {
                    monaco.editor.setTheme(this.settings.theme);
                    console.log('Theme reapplied for Electron:', this.settings.theme);
                } else if (this.editor.updateOptions) {
                    this.editor.updateOptions({ theme: this.settings.theme });
                }
            } catch (e) {
                console.error('Failed to reapply theme:', e);
            }
        }, 100);
    }
    
    // For web version, also ensure theme is applied
    if (!window.isElectron && this.editor && !this.useFallbackEditor) {
        setTimeout(() => {
            try {
                if (typeof monaco !== 'undefined' && monaco.editor) {
                    monaco.editor.setTheme(this.settings.theme);
                }
            } catch (e) {
                console.error('Failed to reapply theme:', e);
            }
        }, 50);
    }
};

// ============================================================
// OLLAMA CONNECTION TESTS
// ============================================================
app.testOllamaConnection = async function () {
    if (this.ai.provider === 'local') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${this.ai.endpoint}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                const models = data.models?.map(m => m.name).join(', ') || 'unknown';
                this.showToast(`✅ Ollama connected! Available: ${models}`);
                this.addChatMessage(`✅ Successfully connected to Ollama at ${this.ai.endpoint}\nAvailable models: ${models}`, 'system');
            } else {
                this.showOllamaNotRunningMessage();
            }
        } catch (error) {
            console.warn('Ollama not reachable:', error);
            this.showOllamaNotRunningMessage();
        }
    }
};

app.showOllamaNotRunningMessage = function () {
    const isWindows = navigator.platform.includes('Win');
    const isMac = navigator.platform.includes('Mac');

    let instructions = '';
    if (isWindows) {
        instructions = `1. Download Ollama from https://ollama.com/download/windows\n2. Install and run Ollama\n3. Open Command Prompt and run: ollama pull gemma4:latest\n4. Restart DevStudio`;
    } else if (isMac) {
        instructions = `1. Run: brew install ollama\n2. Run: ollama serve\n3. In another terminal: ollama pull gemma4:latest\n4. Restart DevStudio`;
    } else {
        instructions = `1. Run: curl -fsSL https://ollama.com/install.sh | sh\n2. Run: ollama serve\n3. In another terminal: ollama pull gemma4:latest\n4. Restart DevStudio`;
    }

    this.addChatMessage(
        `⚠️ **Ollama is not running**\n\n` +
        `To use the AI assistant locally:\n${instructions}\n\n` +
        `Alternatively, you can:\n` +
        `• Use OpenAI/Gemini in Settings (requires API key)\n` +
        `• Check Ollama endpoint in Settings (default: http://localhost:11434)`,
        'system'
    );

    this.showToast('⚠️ Ollama not running - check chat for setup instructions', 5000);
};

// ============================================================
// GROQ CONNECTION TEST
// ============================================================
app.testGroqConnection = async function () {
    const apiKey = document.getElementById('ai-api-key')?.value;
    
    if (!apiKey) {
        this.showToast('⚠️ Please enter your Groq API key first');
        return;
    }
    
    try {
        const statusEl = document.getElementById('ai-status');
        if (statusEl) {
            statusEl.innerHTML = '⏳ Testing Groq...';
            statusEl.style.background = '#3b82f6';
        }
        
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const models = data.data.map(m => m.id).join(', ');
            this.showToast(`✅ Groq connected! Available: ${models}`);
            
            if (statusEl) {
                statusEl.innerHTML = '● Ready';
                statusEl.style.background = '#334155';
            }
            
            // Update the model dropdown with available models
            const modelSelect = document.getElementById('ai-model-select');
            if (modelSelect) {
                modelSelect.innerHTML = '';
                data.data.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.id;
                    option.textContent = m.id;
                    modelSelect.appendChild(option);
                });
                if (this.ai.model) modelSelect.value = this.ai.model;
            }
        } else {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }
    } catch (error) {
        console.error('Groq test failed:', error);
        this.showToast(`❌ Groq connection failed: ${error.message}`);
        const statusEl = document.getElementById('ai-status');
        if (statusEl) {
            statusEl.innerHTML = '⚠️ Error';
            statusEl.style.background = '#dc2626';
        }
    }
};

// ============================================================
// OLLAMA MODEL MANAGEMENT
// ============================================================
app.fetchOllamaModels = async function () {
    if (this.ai.provider !== 'local') return [];
    
    const endpoint = this.ai.endpoint || 'http://localhost:11434';
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${endpoint}/api/tags`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            const models = data.models || [];
            const modelNames = models.map(m => m.name);
            console.log('Found Ollama models:', modelNames);
            return modelNames;
        } else {
            console.warn('Failed to fetch Ollama models');
            return [];
        }
    } catch (error) {
        console.warn('Could not fetch Ollama models:', error.message);
        return [];
    }
};

app.populateOllamaModels = async function () {
    const modelSelect = document.getElementById('ai-model-select');
    const modelText = document.getElementById('ai-model-text');
    const modelContainer = document.getElementById('ai-model-container');
    const refreshBtn = document.getElementById('refresh-models-btn');
    
    if (!modelSelect || this.ai.provider !== 'local') return;
    
    // Show loading state
    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';
        refreshBtn.disabled = true;
    }
    
    const models = await this.fetchOllamaModels();
    
    if (models.length > 0) {
        // Show dropdown for Ollama with installed models
        modelSelect.style.display = 'block';
        modelText.style.display = 'none';
        
        modelSelect.innerHTML = '<option value="">Select a model...</option>';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            // Display model name with size info if available
            let displayName = model;
            option.textContent = displayName;
            if (this.ai.model === model) option.selected = true;
            modelSelect.appendChild(option);
        });
        
        // Add a refresh option at the top
        const refreshOption = document.createElement('option');
        refreshOption.value = "__REFRESH__";
        refreshOption.textContent = "⟳ Refresh model list...";
        refreshOption.disabled = true;
        modelSelect.insertBefore(refreshOption, modelSelect.firstChild);
        
        // Update help text
        const helpText = document.getElementById('model-help-text');
        if (helpText) {
            helpText.innerHTML = `✓ Found ${models.length} installed model(s). Select from dropdown or <a href="#" onclick="app.refreshOllamaModels(); return false;" style="color: #3b82f6;">click here to refresh</a>.`;
        }
        
        // If no model is selected and there are models, select the first one
        if (!this.ai.model && models.length > 0) {
            this.ai.model = models[0];
            modelSelect.value = models[0];
        }
    } else {
        // Fallback to text input if no models found
        modelSelect.style.display = 'none';
        modelText.style.display = 'block';
        modelText.placeholder = 'gemma4:latest, codellama, llama3, mistral';
        
        const helpText = document.getElementById('model-help-text');
        if (helpText) {
            helpText.innerHTML = 'No Ollama models found. Make sure Ollama is running and you have installed models. <a href="#" onclick="app.refreshOllamaModels(); return false;" style="color: #3b82f6;">Click here to refresh</a>.';
        }
    }
    
    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        refreshBtn.disabled = false;
    }
};

app.refreshOllamaModels = async function () {
    if (this.ai.provider !== 'local') {
        this.showToast('Switch to Local Ollama provider first');
        return;
    }
    
    this.showToast('Refreshing Ollama models...');
    await this.populateOllamaModels();
    this.showToast('Model list refreshed!');
};

app.addChatMessage = function (text, sender) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-bubble ${sender}`;
    let formattedText = text.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre style="background:#0f172a; padding:10px; border-radius:8px; overflow-x:auto; margin:8px 0;"><code style="font-family:monospace; font-size:12px;">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    });
    div.innerHTML = formattedText;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
};

// ============================================================
// MAIN SEND MESSAGE - Two-step AI understanding
// ============================================================
app.sendMessage = async function () {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    if (this.ai.provider !== 'local' && !this.ai.apiKey) {
        this.addChatMessage(`⚠️ Please configure your ${this.providers[this.ai.provider]?.name || this.ai.provider} API key in Settings first.`, 'ai');
        return;
    }

    this.addChatMessage(message, 'user');
    input.value = '';
    const statusEl = document.getElementById('ai-status');
    const originalStatus = statusEl.innerHTML;
    statusEl.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Thinking...';

    try {
        // STEP 1: Have the AI understand the user's intent
        const intent = await this.understandIntent(message);
        console.log('Understood intent:', intent);

        // STEP 2: Based on intent, take appropriate action
        let response = '';

        switch (intent.action) {
            case 'create_file':
                response = await this.createFile(intent);
                break;
            case 'update_file':
                response = await this.updateFile(intent);
                break;
            case 'delete_file':
                response = await this.deleteFile(intent);
                break;
            case 'explain_code':
                response = await this.explainCode(intent);
                break;
            case 'fix_bugs':
                response = await this.fixBugs(intent);
                break;
            case 'optimize_code':
                response = await this.optimizeCode(intent);
                break;
            case 'general_chat':
                response = await this.generalChat(message);
                break;
            default:
                response = await this.generalChat(message);
        }

        this.addChatMessage(response, 'ai');

    } catch (error) {
        console.error('AI Error:', error);
        this.addChatMessage(`Error: ${error.message}`, 'ai');
    } finally {
        statusEl.innerHTML = originalStatus;
    }
};

// ============================================================
// STEP 1: Understand what the user wants
// ============================================================
app.understandIntent = async function (userMessage) {
    const context = `You are an AI that analyzes user requests and determines what action to take in a code editor.

Available actions:
- "create_file": User wants to create a new file
- "update_file": User wants to modify an existing file  
- "delete_file": User wants to delete a file
- "explain_code": User wants explanation of code
- "fix_bugs": User wants bug fixes
- "optimize_code": User wants code optimization
- "general_chat": General conversation or question

Respond with ONLY a JSON object in this exact format:
{
  "action": "action_name",
  "target_file": "filename.ext" (if applicable, otherwise null),
  "description": "brief description of what user wants"
}

If user specifies a filename (e.g., "create test.html", "update style.css"), extract it.
If user says "this file" or "current file", use "${this.currentFile || 'current file'}".

User message: ${userMessage}

Current open file: ${this.currentFile || 'none'}

Respond with ONLY the JSON.`;

    const response = await this.callAIWithSystemPrompt(context, 'You are an intent analysis system. Output ONLY valid JSON.');

    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.error('Intent parsing failed:', e);
    }

    // Default fallback
    return { action: 'general_chat', target_file: null, description: userMessage };
};

// ============================================================
// STEP 2: Execute the understood intent
// ============================================================

// CREATE FILE
app.createFile = async function (intent) {
    const fileName = intent.target_file;

    if (!fileName || fileName === 'current file') {
        return "I'm not sure what file name to use. Could you specify the file name (e.g., 'Create index.html')?";
    }

    // Check if file already exists
    if (this.files[fileName] && this.files[fileName].type === 'file') {
        return `File "${fileName}" already exists. Do you want me to update it instead?`;
    }

    // Ask AI to generate the file content based on user's description
    const fileExtension = fileName.split('.').pop();
    const context = `Create a ${fileExtension} file named "${fileName}" based on this request: "${intent.description}"

Generate the complete file content. Respond with ONLY the file content in a markdown code block.

Example format:
\`\`\`${fileExtension}
[file content here]
\`\`\``;

    const contentResponse = await this.callAIWithSystemPrompt(context, 'You are a code generator. Output only the file content in a markdown code block.');

    // Extract code block
    const codeMatch = contentResponse.match(/```(?:\w+)?\n([\s\S]*?)```/);
    const fileContent = codeMatch ? codeMatch[1].trim() : contentResponse.trim();

    // Create the file
    this.files[fileName] = { content: fileContent, type: 'file' };
    this.saveToStorage();
    this.renderFileTree();
    this.updateFolderSelector();

    // Open the newly created file
    this.openFile(fileName);

    return `✅ Created "${fileName}"\n\nThe file has been created and opened in the editor. You can now edit it directly.`;
};

// UPDATE FILE
app.updateFile = async function (intent) {
    let fileName = intent.target_file;

    if (!fileName || fileName === 'current file' || fileName === 'this file') {
        fileName = this.currentFile;
    }

    if (!fileName || !this.files[fileName]) {
        return "I'm not sure which file to update. Could you specify the file name or open the file you want me to modify?";
    }

    const currentContent = this.files[fileName].content || '';
    const fileExtension = fileName.split('.').pop();

    const context = `Update the file "${fileName}" based on this request: "${intent.description}"

Current file content:
\`\`\`${fileExtension}
${currentContent}
\`\`\`

Generate the COMPLETE updated file content. Respond with ONLY the new content in a markdown code block.

\`\`\`${fileExtension}
[updated content here]
\`\`\``;

    const contentResponse = await this.callAIWithSystemPrompt(context, 'You are a code editor. Output only the updated file content in a markdown code block.');

    const codeMatch = contentResponse.match(/```(?:\w+)?\n([\s\S]*?)```/);
    const newContent = codeMatch ? codeMatch[1].trim() : contentResponse.trim();

    // Update the file
    this.files[fileName].content = newContent;
    this.saveToStorage();

    // Refresh the editor if it's the current file
    if (this.currentFile === fileName) {
        this.openFile(fileName);
    }

    return `✅ Updated "${fileName}"\n\nThe file has been modified according to your request.`;
};

// DELETE FILE
app.deleteFile = async function (intent) {
    let fileName = intent.target_file;

    if (!fileName || fileName === 'current file' || fileName === 'this file') {
        fileName = this.currentFile;
    }

    if (!fileName || !this.files[fileName]) {
        return "I'm not sure which file to delete. Could you specify the file name?";
    }

    // Ask for confirmation
    return `⚠️ Are you sure you want to delete "${fileName}"? If yes, please type "Confirm delete ${fileName}" to proceed.`;
};

// Confirm deletion (called separately)
app.confirmDeleteFile = function (fileName) {
    if (this.files[fileName]) {
        delete this.files[fileName];
        this.saveToStorage();
        this.renderFileTree();
        this.updateFolderSelector();

        if (this.currentFile === fileName) {
            const remaining = Object.keys(this.files).find(f => this.files[f].type === 'file');
            if (remaining) {
                this.openFile(remaining);
            } else {
                this.currentFile = null;
                if (this.editor) this.editor.setValue('');
            }
        }
        return `✅ Deleted "${fileName}"`;
    }
    return `❌ File "${fileName}" not found`;
};

// EXPLAIN CODE
app.explainCode = async function (intent) {
    let fileName = intent.target_file;

    if (!fileName || fileName === 'current file' || fileName === 'this file') {
        fileName = this.currentFile;
    }

    if (!fileName || !this.files[fileName]) {
        return "Please open the file you want me to explain, or specify a file name.";
    }

    const content = this.files[fileName].content || '';
    const fileExtension = fileName.split('.').pop();

    const context = `Explain the following ${fileExtension} code to the user. Be clear, educational, and helpful.

User request: "${intent.description}"

Code to explain:
\`\`\`${fileExtension}
${content}
\`\`\`

Provide a clear, well-structured explanation.`;

    return await this.callAIWithSystemPrompt(context, 'You are a helpful coding teacher. Provide clear explanations.');
};

// FIX BUGS
app.fixBugs = async function (intent) {
    let fileName = intent.target_file;

    if (!fileName || fileName === 'current file' || fileName === 'this file') {
        fileName = this.currentFile;
    }

    if (!fileName || !this.files[fileName]) {
        return "Please open the file you want me to fix, or specify a file name.";
    }

    const currentContent = this.files[fileName].content || '';
    const fileExtension = fileName.split('.').pop();

    const context = `Fix bugs in the following ${fileExtension} code. User request: "${intent.description}"

Current code:
\`\`\`${fileExtension}
${currentContent}
\`\`\`

First, explain what bugs you found. Then provide the complete fixed code in a markdown code block.

\`\`\`${fileExtension}
[fixed code here]
\`\`\``;

    const response = await this.callAIWithSystemPrompt(context, 'You are a debugging expert.');

    // Check if response contains a code block for auto-apply
    const codeMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeMatch && this.ai.autoApply) {
        const fixedContent = codeMatch[1].trim();
        this.files[fileName].content = fixedContent;
        this.saveToStorage();
        if (this.currentFile === fileName) {
            this.openFile(fileName);
        }
        return response + `\n\n✅ Changes have been automatically applied to "${fileName}".`;
    }

    return response;
};

// OPTIMIZE CODE
app.optimizeCode = async function (intent) {
    let fileName = intent.target_file;

    if (!fileName || fileName === 'current file' || fileName === 'this file') {
        fileName = this.currentFile;
    }

    if (!fileName || !this.files[fileName]) {
        return "Please open the file you want me to optimize, or specify a file name.";
    }

    const currentContent = this.files[fileName].content || '';
    const fileExtension = fileName.split('.').pop();

    const context = `Optimize the following ${fileExtension} code for better performance, readability, and maintainability. User request: "${intent.description}"

Current code:
\`\`\`${fileExtension}
${currentContent}
\`\`\`

First, explain your optimizations. Then provide the complete optimized code in a markdown code block.

\`\`\`${fileExtension}
[optimized code here]
\`\`\``;

    const response = await this.callAIWithSystemPrompt(context, 'You are a code optimization expert.');

    const codeMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeMatch && this.ai.autoApply) {
        const optimizedContent = codeMatch[1].trim();
        this.files[fileName].content = optimizedContent;
        this.saveToStorage();
        if (this.currentFile === fileName) {
            this.openFile(fileName);
        }
        return response + `\n\n✅ Optimized code has been automatically applied to "${fileName}".`;
    }

    return response;
};

// GENERAL CHAT
app.generalChat = async function (message) {
    const currentCode = this.currentFile ? (this.files[this.currentFile]?.content || '') : '';
    const fileName = this.currentFile || 'none';
    const fileExt = fileName !== 'none' ? fileName.split('.').pop() : 'txt';

    const projectFiles = Object.keys(this.files).filter(f => this.files[f].type === 'file').join(', ');

    const context = `You are DevStudio AI, a helpful coding assistant integrated into a code editor.

Current project files: ${projectFiles || 'no files yet'}
Currently open file: ${fileName}

${fileName !== 'none' ? `Current code in open file:
\`\`\`${fileExt}
${currentCode || '(empty file)'}
\`\`\`` : ''}

User message: ${message}

Respond helpfully and conversationally. You have the ability to create, modify, and delete files if the user asks. Be direct and helpful.`;

    return await this.callAIWithSystemPrompt(context, 'You are a helpful coding assistant. Be conversational and helpful.');
};

// ============================================================
// Core AI calling function - UPDATED WITH GROQ SUPPORT
// ============================================================
app.callAIWithSystemPrompt = async function (userPrompt, systemPrompt) {
    const { provider, apiKey, model, endpoint } = this.ai;
    const config = this.providers[provider];

    if (provider === 'local') {
        const ollamaUrl = (endpoint || 'http://localhost:11434').replace(/\/$/, '');
        const finalModel = model || 'gemma4:latest';

        // Check Ollama connection
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const testResponse = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            if (!testResponse.ok) throw new Error(`Ollama not responding at ${ollamaUrl}`);
        } catch (testError) {
            throw new Error(`Ollama not running. Run 'ollama serve' then 'ollama pull ${finalModel}'`);
        }

        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: finalModel,
                prompt: `${systemPrompt}\n\n${userPrompt}`,
                stream: false,
                options: { temperature: 0.7, num_predict: 8192, top_p: 0.9 }
            })
        });

        if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
        const data = await response.json();
        let reply = data.response || "No response";
        reply = reply.replace(/<\/?s>/g, '').replace(/<\|[^>]+\|>/g, '');
        return reply;
    }

    // Cloud providers
    let url, body, headers;
    const effectiveKey = apiKey || '';

    // GROQ - OpenAI-compatible API
    if (provider === 'groq') {
        url = endpoint || config.baseUrl || 'https://api.groq.com/openai/v1/chat/completions';
        headers = { 
            'Authorization': `Bearer ${effectiveKey}`, 
            'Content-Type': 'application/json' 
        };
        body = JSON.stringify({
            model: model || config.defaultModel || 'mixtral-8x7b-32768',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 4096,
            top_p: 0.95
        });
    } else if (provider === 'openai') {
        url = config.baseUrl;
        headers = { 'Authorization': `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 8192
        });
    } else if (provider === 'anthropic') {
        url = config.baseUrl;
        headers = { 'x-api-key': effectiveKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            max_tokens: 8192,
            temperature: 0.7,
            messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }]
        });
    } else if (provider === 'google') {
        const useModel = model || config.defaultModel;
        url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${effectiveKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        });
    } else {
        // Fallback for other providers (deepseek, kimi, etc.)
        url = endpoint || config.baseUrl;
        headers = { 'Authorization': `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }],
            temperature: 0.7
        });
    }

    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) throw new Error(`${provider} error: ${response.status}`);

    const data = await response.json();
    if (provider === 'anthropic') return data.content[0].text;
    if (provider === 'google') return data.candidates[0].content.parts[0].text;
    return data.choices[0].message.content;
};

// ============================================================
// UI Helper Methods
// ============================================================
app.quickAction = function (action) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;

    switch (action) {
        case 'explain':
            chatInput.value = `Explain the current file`;
            break;
        case 'fix':
            chatInput.value = `Fix bugs in the current file`;
            break;
        case 'optimize':
            chatInput.value = `Optimize the current file`;
            break;
        case 'document':
            chatInput.value = `Add documentation to the current file`;
            break;
        case 'test':
            chatInput.value = `Write tests for the current file`;
            break;
    }
    this.sendMessage();
};

app.toggleChat = function () {
    const panel = document.getElementById('chat-panel');
    const icon = document.getElementById('chat-toggle-icon');
    const messages = document.getElementById('chat-messages');
    const inputArea = document.querySelector('.chat-input-area');

    this.chatCollapsed = !this.chatCollapsed;

    if (this.chatCollapsed) {
        this.chatHeight = panel.offsetHeight;
        panel.style.height = '42px';
        if (messages) messages.style.display = 'none';
        if (inputArea) inputArea.style.display = 'none';
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
    } else {
        panel.style.height = (this.chatHeight || 280) + 'px';
        if (messages) messages.style.display = 'flex';
        if (inputArea) inputArea.style.display = 'block';
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }

    setTimeout(() => { if (this.editor) this.editor.layout(); }, 100);
};

app.toggleSettings = function () {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('hidden');
    
    const providerSelect = document.getElementById('ai-provider');
    const apiKeyInput = document.getElementById('ai-api-key');
    const endpointInput = document.getElementById('ai-endpoint');
    const themeSelect = document.getElementById('editor-theme');
    const fontSizeInput = document.getElementById('editor-font-size');
    const autoApplyCheckbox = document.getElementById('ai-auto-apply');
    const modelSelect = document.getElementById('ai-model-select');
    const modelText = document.getElementById('ai-model-text');
    
    if (providerSelect) providerSelect.value = this.ai.provider;
    if (apiKeyInput) apiKeyInput.value = this.ai.apiKey || '';
    if (endpointInput) endpointInput.value = this.ai.endpoint || '';
    if (themeSelect) themeSelect.value = this.settings.theme;
    if (fontSizeInput) fontSizeInput.value = this.settings.fontSize;
    if (autoApplyCheckbox) autoApplyCheckbox.checked = this.ai.autoApply || false;
    
    // Trigger provider change to populate models
    this.handleProviderChange();
    
    // After handleProviderChange, set the model value if it exists
    setTimeout(() => {
        if (this.ai.provider === 'local') {
            // For local, the model should be in the dropdown after populateOllamaModels
            if (modelSelect && this.ai.model) {
                modelSelect.value = this.ai.model;
            }
        } else if (modelSelect && this.ai.model) {
            // For cloud providers, set the dropdown value
            modelSelect.value = this.ai.model;
        } else if (modelText && this.ai.model) {
            // For text input, set the value
            modelText.value = this.ai.model;
        }
    }, 500);
    
    console.log('Settings modal opened - Current settings:', {
        theme: this.settings.theme,
        fontSize: this.settings.fontSize,
        aiProvider: this.ai.provider,
        aiModel: this.ai.model,
        autoApply: this.ai.autoApply
    });
    
    this.updateProviderHelp();
};

app.updateProviderHelp = function () {
    const provider = document.getElementById('ai-provider').value;
    const config = this.providers[provider];
    const helpText = document.getElementById('provider-help');
    if (helpText && config) helpText.textContent = config.help;

    const endpointContainer = document.getElementById('local-endpoint-container');
    if (endpointContainer) endpointContainer.style.display = provider === 'local' ? 'block' : 'none';
};

app.updateEditorTheme = function () {
    const themeSelect = document.getElementById('editor-theme');
    if (themeSelect) {
        this.settings.theme = themeSelect.value;
    }
    
    // Apply theme to Monaco editor
    if (this.editor && !this.useFallbackEditor) {
        try {
            if (typeof monaco !== 'undefined' && monaco.editor) {
                monaco.editor.setTheme(this.settings.theme);
                console.log('Theme changed to:', this.settings.theme);
            } else if (this.editor.updateOptions) {
                this.editor.updateOptions({ theme: this.settings.theme });
            }
        } catch (error) {
            console.error('Error changing theme:', error);
        }
    } else if (this.useFallbackEditor) {
        // Update fallback editor theme
        const fallbackEditor = document.getElementById('fallback-editor');
        if (fallbackEditor) {
            if (this.settings.theme === 'vs-dark' || this.settings.theme === 'hc-black') {
                fallbackEditor.style.background = '#1e1e1e';
                fallbackEditor.style.color = '#d4d4d4';
            } else {
                fallbackEditor.style.background = '#ffffff';
                fallbackEditor.style.color = '#000000';
            }
        }
    }
};

app.updateProviderUI = function () {
    const badge = document.getElementById('active-provider');
    const provider = this.ai.provider;
    const badgeClass = provider === 'kimi' ? 'badge-kimi' :
        provider === 'deepseek' ? 'badge-deepseek' :
            provider === 'anthropic' ? 'badge-anthropic' :
                provider === 'google' ? 'badge-google' :
                    provider === 'groq' ? 'badge-groq' :
                        provider === 'local' ? 'badge-local' : 'badge-openai';

    if (badge) {
        badge.className = `provider-badge ${badgeClass}`;
        badge.textContent = provider === 'local' ? 'Ollama' : this.providers[provider]?.name || provider;
        badge.style.display = 'inline-flex';
    }
};

app.handleProviderChange = function () {
    const provider = document.getElementById('ai-provider').value;
    const config = this.providers[provider];
    const modelContainer = document.getElementById('ai-model-container');
    const modelSelect = document.getElementById('ai-model-select');
    const modelText = document.getElementById('ai-model-text');
    const refreshBtnContainer = document.getElementById('model-refresh-container');
    const endpointContainer = document.getElementById('local-endpoint-container');

    // Show/hide Groq test button
    const testGroqBtn = document.getElementById('test-groq-btn');
    if (testGroqBtn) {
        testGroqBtn.style.display = provider === 'groq' ? 'inline-flex' : 'none';
    }

    // Handle model input type based on provider
    if (provider === 'local') {
        // For Ollama, show dropdown with refresh button
        if (modelContainer) modelContainer.style.display = 'block';
        if (refreshBtnContainer) refreshBtnContainer.style.display = 'block';
        
        // Show the dropdown, hide the text input
        if (modelSelect) {
            modelSelect.style.display = 'block';
            // Don't clear the options - populateOllamaModels will handle it
        }
        if (modelText) {
            modelText.style.display = 'none';
        }
        
        // Fetch Ollama models
        this.populateOllamaModels();
        
    } else if (config && config.models && config.models.length > 0) {
        // For cloud providers with predefined models
        if (modelContainer) modelContainer.style.display = 'block';
        if (refreshBtnContainer) refreshBtnContainer.style.display = 'none';
        
        if (modelSelect) {
            modelSelect.style.display = 'block';
            // Clear existing options
            modelSelect.innerHTML = '';
            
            // Add the models from config
            config.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                if (this.ai.model === model) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });
            
            // If no model is selected and there are models, select the first one
            if (!this.ai.model && config.models.length > 0) {
                modelSelect.value = config.models[0];
                this.ai.model = config.models[0];
            }
        }
        if (modelText) {
            modelText.style.display = 'none';
        }
    } else {
        // Fallback to text input for custom providers
        if (modelContainer) modelContainer.style.display = 'block';
        if (refreshBtnContainer) refreshBtnContainer.style.display = 'none';
        if (modelSelect) {
            modelSelect.style.display = 'none';
        }
        if (modelText) {
            modelText.style.display = 'block';
            modelText.value = this.ai.model || config?.defaultModel || '';
            modelText.placeholder = 'Enter model name...';
        }
    }

    // Handle local endpoint visibility
    if (provider === 'local' && endpointContainer) {
        endpointContainer.style.display = 'block';
    } else if (endpointContainer) {
        endpointContainer.style.display = 'none';
    }

    // Update help text
    const helpText = document.getElementById('provider-help');
    if (helpText && config) {
        helpText.textContent = config.help;
    }
    
    // Update CORS warning
    const corsWarning = document.getElementById('cors-warning');
    if (corsWarning) {
        corsWarning.style.display = (config && config.cors) ? 'block' : 'none';
    }

    // Update API key hint
    const hint = document.getElementById('api-key-hint');
    if (hint) {
        if (provider === 'groq') {
            hint.textContent = 'Get your Groq API key from https://console.groq.com (Free tier available)';
            hint.style.color = '#60a5fa';
        } else if (provider === 'kimi') {
            hint.textContent = 'Kimi: FREE credits but CORS blocked! Use proxy or switch to Ollama';
            hint.style.color = '#fbbf24';
        } else if (provider === 'deepseek') {
            hint.textContent = 'Deepseek: Requires paid credits';
            hint.style.color = '#f87171';
        } else if (provider === 'local') {
            hint.textContent = '✨ No API key needed - runs locally on your machine!';
            hint.style.color = '#10b981';
        } else {
            hint.textContent = 'Enter your API key for the selected provider';
            hint.style.color = '#64748b';
        }
    }
    
    // Update the model help text based on provider
    const modelHelpText = document.getElementById('model-help-text');
    if (modelHelpText) {
        if (provider === 'local') {
            modelHelpText.innerHTML = 'Loading Ollama models... Click refresh to update the list.';
        } else if (provider === 'groq') {
            modelHelpText.textContent = 'Groq models: mixtral-8x7b, llama3-70b, llama3-8b, gemma-7b';
        } else if (config && config.models) {
            modelHelpText.textContent = `Available models for ${config.name}: ${config.models.join(', ')}`;
        } else {
            modelHelpText.textContent = 'Enter the model name manually';
        }
    }
};

// ============================================================
// INITIALIZATION - Load AI settings on startup
// ============================================================
// Make sure AI settings are loaded when the app initializes
if (!app.ai) {
    app.ai = {
        provider: 'local',
        apiKey: '',
        model: 'gemma4:latest',
        endpoint: 'http://localhost:11434',
        autoApply: false
    };
}

// Load saved AI settings from storage
const savedAISettings = localStorage.getItem('devstudio-ai-settings');
if (savedAISettings) {
    try {
        const settings = JSON.parse(savedAISettings);
        app.ai.provider = settings.provider || 'local';
        app.ai.apiKey = settings.apiKey || '';
        app.ai.model = settings.model || 'gemma4:latest';
        app.ai.endpoint = settings.endpoint || 'http://localhost:11434';
        app.ai.autoApply = settings.autoApply || false;
        console.log('AI settings loaded:', app.ai);
    } catch (e) {
        console.warn('Failed to load AI settings:', e);
    }
}

// ============================================================
// ADD GROQ BADGE STYLES TO STYLES.CSS (ADD THIS TO YOUR CSS FILE)
// ============================================================
// .badge-groq {
//     background: #1a1a2e;
//     color: #7b61ff;
//     border: 1px solid #7b61ff;
// }
// 
// .provider-badge.badge-groq {
//     background: #1a1a2e;
//     color: #7b61ff;
//     border: 1px solid #7b61ff;
// }
