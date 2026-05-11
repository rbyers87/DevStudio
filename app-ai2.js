// ============================================================
// DevStudio – app-ai.js
// INTELLIGENT VERSION - AI understands intent, no pattern matching
// ============================================================

app.saveAISettings = function () {
    const provider = document.getElementById('ai-provider').value;
    this.ai = {
        provider: provider,
        apiKey: document.getElementById('ai-api-key').value.trim(),
        model: document.getElementById('ai-model').value.trim(),
        endpoint: document.getElementById('ai-endpoint').value.trim(),
        autoApply: document.getElementById('ai-auto-apply').checked
    };

    if (this.ai.provider === 'local' && !this.ai.model) {
        this.ai.model = 'gemma4:latest';
    }
    if (this.ai.provider === 'local' && !this.ai.endpoint) {
        this.ai.endpoint = 'http://localhost:11434';
    }

    this.saveToStorage();
    this.updateProviderUI();
};

app.saveSettingsAndClose = function () {
    const fontSize = parseInt(document.getElementById('editor-font-size').value);
    if (fontSize >= 10 && fontSize <= 24) {
        this.settings.fontSize = fontSize;
    }
    this.settings.theme = document.getElementById('editor-theme').value;
    this.saveAISettings();
    this.updateEditorTheme();
    if (this.editor) {
        this.editor.updateOptions({ fontSize: this.settings.fontSize });
    }
    this.closeModal('settings-modal');
    this.showToast('Settings saved successfully!');
};

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
// Core AI calling function
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

    if (provider === 'openai') {
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
    document.getElementById('ai-provider').value = this.ai.provider;
    document.getElementById('ai-api-key').value = this.ai.apiKey;
    document.getElementById('ai-model').value = this.ai.model;
    document.getElementById('ai-endpoint').value = this.ai.endpoint;
    document.getElementById('editor-theme').value = this.settings.theme;
    document.getElementById('editor-font-size').value = this.settings.fontSize;
    document.getElementById('ai-auto-apply').checked = this.ai.autoApply || false;
    this.updateProviderHelp();
    this.handleProviderChange();
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
    this.settings.theme = document.getElementById('editor-theme').value;
    if (this.editor) {
        monaco.editor.setTheme(this.settings.theme);
    }
    this.saveToStorage();
};

app.saveToStorage = function () {
    const data = {
        files: this.files,
        versions: this.versions,
        github: this.github,
        ai: this.ai,
        settings: this.settings,
        expandedFolders: Array.from(this.expandedFolders),
        currentFolder: this.currentFolder,
        currentFile: this.currentFile
    };
    localStorage.setItem('devstudio_data', JSON.stringify(data));
};

app.showToast = function (message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-info-circle mr-2"></i>${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

app.closeModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
};

app.updateProviderUI = function () {
    const badge = document.getElementById('active-provider');
    const provider = this.ai.provider;
    const badgeClass = provider === 'kimi' ? 'badge-kimi' :
        provider === 'deepseek' ? 'badge-deepseek' :
            provider === 'anthropic' ? 'badge-anthropic' :
                provider === 'google' ? 'badge-google' :
                    provider === 'local' ? 'badge-local' : 'badge-openai';

    if (badge) {
        badge.className = `provider-badge ${badgeClass}`;
        badge.textContent = provider === 'local' ? 'Ollama' : this.providers[provider]?.name || provider;
    }
};

app.handleProviderChange = function () {
    const provider = document.getElementById('ai-provider').value;
    const config = this.providers[provider];
    const modelInput = document.getElementById('ai-model');
    const endpointContainer = document.getElementById('local-endpoint-container');

    if (provider === 'local' && endpointContainer) {
        endpointContainer.style.display = 'block';
        if (modelInput) modelInput.placeholder = 'gemma4:latest, codellama, llama3, mistral';
    } else if (endpointContainer) {
        endpointContainer.style.display = 'none';
        if (modelInput && config) modelInput.placeholder = config.models[0];
    }

    const helpText = document.getElementById('provider-help');
    if (helpText && config) helpText.textContent = config.help;
};

// UI methods needed for refresh
app.renderFileTree = function () {
    const container = document.getElementById('file-tree');
    if (!container) return;
    container.innerHTML = '';

    const files = Object.keys(this.files).filter(path => this.files[path].type !== 'folder');
    files.sort();

    files.forEach(path => {
        const div = document.createElement('div');
        div.className = `tree-item ${this.currentFile === path ? 'active' : ''}`;
        const fileName = path.split('/').pop();

        const ext = fileName.split('.').pop();
        let iconClass = 'fa-file-code';
        if (ext === 'html') iconClass = 'fa-html5';
        else if (ext === 'css') iconClass = 'fa-css3';
        else if (ext === 'js') iconClass = 'fa-js';

        div.innerHTML = `<i class="fab ${iconClass} icon" style="width: 18px;"></i><span class="name" style="flex:1;">${fileName}</span>`;
        div.onclick = () => this.openFile(path);
        container.appendChild(div);
    });

    if (files.length === 0) {
        container.innerHTML = '<div class="text-xs text-slate-500 text-center p-4">No files yet.<br>Create one with the + button.</div>';
    }
};

app.updateFolderSelector = function () {
    const select = document.getElementById('folder-select');
    if (!select) return;
    select.innerHTML = '<option value="">📁 Root</option>';
};

app.openFile = function (filename) {
    if (this.files[filename]?.type === 'folder') return;
    this.currentFile = filename;
    const content = this.files[filename]?.content || '';
    if (this.editor) {
        const ext = filename.split('.').pop();
        let language = 'plaintext';
        if (ext === 'js') language = 'javascript';
        else if (ext === 'html') language = 'html';
        else if (ext === 'css') language = 'css';
        else if (ext === 'json') language = 'json';
        else if (ext === 'py') language = 'python';

        const model = monaco.editor.createModel(content, language);
        this.editor.setModel(model);
        setTimeout(() => { if (this.editor) this.editor.layout(); }, 50);
    }
    this.renderFileTree();
    if (filename.endsWith('.html') && typeof this.updatePreview === 'function') {
        this.updatePreview();
    }
};
