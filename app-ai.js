// ============================================================
// DevStudio – app-ai.js
// AI provider - INFERS file operations from natural responses
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
    // Preserve code blocks
    formattedText = formattedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre style="background:#0f172a; padding:10px; border-radius:8px; overflow-x:auto; margin:8px 0;"><code style="font-family:monospace; font-size:12px;">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    });
    div.innerHTML = formattedText;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
};

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
        const response = await this.callAI(message);

        // Show AI's response
        this.addChatMessage(response, 'ai');

        // INFER file operations from the response (no JSON required from AI)
        const operations = this.inferFileOperationsFromResponse(response, message);

        if (operations && operations.length > 0) {
            if (this.ai.autoApply) {
                const results = this.applyFileOperations(operations);
                let summary = `\n\n📁 **File changes applied:**\n`;
                results.success.forEach(s => summary += `• ${s}\n`);
                if (results.failed.length > 0) {
                    summary += `\n❌ **Failed:**\n`;
                    results.failed.forEach(f => summary += `• ${f}\n`);
                }
                this.addChatMessage(summary, 'system');
                this.showToast(`Applied ${results.success.length} file changes`);

                // Refresh UI
                if (operations.some(op => op.path === this.currentFile)) {
                    this.openFile(this.currentFile);
                }
                this.renderFileTree();
                this.updateFolderSelector();
            } else {
                this.showApplyButton(operations);
            }
        }
    } catch (error) {
        console.error('AI Error:', error);
        let errorMsg = error.message;
        this.addChatMessage(`Error: ${errorMsg}`, 'ai');
    } finally {
        statusEl.innerHTML = originalStatus;
    }
};

// INFER file operations from the AI's natural language response
app.inferFileOperationsFromResponse = function (response, userMessage) {
    const operations = [];

    // Check if user asked to create something
    const createPatterns = [
        /create\s+(?:a\s+)?(?:new\s+)?file\s+['"]?([\w\/\\]+\.\w+)['"]?/i,
        /make\s+(?:a\s+)?(?:new\s+)?file\s+['"]?([\w\/\\]+\.\w+)['"]?/i,
        /add\s+(?:a\s+)?(?:new\s+)?file\s+['"]?([\w\/\\]+\.\w+)['"]?/i,
        /新文件\s+['"]?([\w\/\\]+\.\w+)['"]?/i
    ];

    let targetFile = null;
    for (const pattern of createPatterns) {
        const match = userMessage.match(pattern);
        if (match) {
            targetFile = match[1];
            break;
        }
    }

    // If user specified a file name, look for code blocks in the response
    if (targetFile) {
        // Find code blocks in the AI's response
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const content = match[2];
            operations.push({
                action: 'create',
                path: targetFile,
                content: content.trim()
            });
            break; // Only take the first code block for this file
        }
    }

    // Check if user asked to update the current file
    const updatePatterns = [
        /update\s+(?:the\s+)?(?:current\s+)?file/i,
        /modify\s+(?:the\s+)?(?:current\s+)?file/i,
        /change\s+(?:the\s+)?(?:current\s+)?file/i,
        /fix\s+(?:the\s+)?(?:current\s+)?file/i,
        /add\s+to\s+(?:the\s+)?(?:current\s+)?file/i
    ];

    const wantsUpdate = updatePatterns.some(p => p.test(userMessage));
    if (wantsUpdate && this.currentFile) {
        // Look for code block to replace the file content
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const content = match[2];
            operations.push({
                action: 'update',
                path: this.currentFile,
                content: content.trim()
            });
            break;
        }
    }

    // Check if AI's response contains code blocks that look like complete files
    if (operations.length === 0) {
        const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
        let match;
        let suggestedName = null;

        // Try to infer filename from context
        const htmlMatch = response.match(/<!DOCTYPE\s+html/i);
        const cssMatch = response.match(/(?:stylesheet|style)\s+for/i);
        const jsMatch = response.match(/(?:javascript|script|function)\s+for/i);

        if (htmlMatch) suggestedName = 'index.html';
        else if (cssMatch) suggestedName = 'style.css';
        else if (jsMatch) suggestedName = 'script.js';

        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1];
            const content = match[2];

            if (suggestedName) {
                operations.push({
                    action: 'create',
                    path: suggestedName,
                    content: content.trim()
                });
            } else if (language === 'html') {
                operations.push({
                    action: 'create',
                    path: 'index.html',
                    content: content.trim()
                });
            } else if (language === 'css') {
                operations.push({
                    action: 'create',
                    path: 'style.css',
                    content: content.trim()
                });
            } else if (language === 'javascript' || language === 'js') {
                operations.push({
                    action: 'create',
                    path: 'script.js',
                    content: content.trim()
                });
            }
        }
    }

    return operations;
};

// Show apply button for manual approval
app.showApplyButton = function (operations) {
    const container = document.getElementById('chat-messages');
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'chat-bubble system';
    buttonDiv.style.padding = '12px';
    buttonDiv.style.background = '#1e293b';
    buttonDiv.style.border = '1px solid #3b82f6';
    buttonDiv.style.borderRadius = '12px';

    let opsList = '<div style="margin-bottom: 12px;"><strong>📁 Ready to apply these changes?</strong><br>';
    operations.forEach(op => {
        const icon = op.action === 'delete' ? '🗑️' : (op.action === 'create' ? '✨' : '📝');
        opsList += `&nbsp;&nbsp;${icon} ${op.action}: <code>${op.path}</code><br>`;
    });
    opsList += '</div>';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn btn-primary';
    applyBtn.style.padding = '6px 16px';
    applyBtn.style.fontSize = '12px';
    applyBtn.style.marginRight = '8px';
    applyBtn.innerHTML = '✅ Apply Changes';
    applyBtn.onclick = () => {
        const results = this.applyFileOperations(operations);
        let summary = `✅ Applied ${results.success.length} changes.`;
        if (results.failed.length > 0) {
            summary += `\n❌ Failed: ${results.failed.length}`;
        }
        this.addChatMessage(summary, 'system');
        this.showToast(`Applied ${results.success.length} file changes`);
        buttonDiv.remove();
        this.renderFileTree();
        this.updateFolderSelector();
        if (operations.some(op => op.path === this.currentFile)) {
            this.openFile(this.currentFile);
        }
    };

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn-secondary';
    dismissBtn.style.padding = '6px 16px';
    dismissBtn.style.fontSize = '12px';
    dismissBtn.innerHTML = '❌ Dismiss';
    dismissBtn.onclick = () => buttonDiv.remove();

    buttonDiv.innerHTML = opsList;
    buttonDiv.appendChild(applyBtn);
    buttonDiv.appendChild(dismissBtn);
    container.appendChild(buttonDiv);
    container.scrollTop = container.scrollHeight;
};

// Helper method to get project context
app.getProjectContext = function () {
    let context = '# Full Project Context\n\n';
    let totalSize = 0;
    const MAX_SIZE = 10240;

    for (const [path, fileData] of Object.entries(this.files)) {
        if (fileData.type === 'file') {
            const content = fileData.content || '';
            const size = content.length;
            totalSize += Math.min(size, MAX_SIZE);

            context += `## File: ${path}\n`;
            if (size > MAX_SIZE) {
                context += `[File truncated: ${(size / 1024).toFixed(1)}KB]\n`;
                context += '```\n' + content.substring(0, MAX_SIZE) + '\n```\n\n';
            } else {
                context += '```\n' + content + '\n```\n\n';
            }
        }
    }

    return context;
};

// Helper method to apply file operations
app.applyFileOperations = function (operations) {
    const results = { success: [], failed: [] };

    for (const op of operations) {
        try {
            switch (op.action) {
                case 'create':
                case 'update':
                    const pathParts = op.path.split('/');
                    if (pathParts.length > 1) {
                        let currentPath = '';
                        for (let i = 0; i < pathParts.length - 1; i++) {
                            currentPath = currentPath ? currentPath + pathParts[i] + '/' : pathParts[i] + '/';
                            if (!this.files[currentPath]) {
                                this.files[currentPath] = { content: null, type: 'folder' };
                            }
                        }
                    }
                    this.files[op.path] = { content: op.content || '', type: 'file' };
                    results.success.push(`${op.action} ${op.path}`);
                    break;

                case 'delete':
                    if (this.files[op.path]) {
                        delete this.files[op.path];
                        results.success.push(`delete ${op.path}`);
                    } else {
                        results.failed.push(`delete ${op.path} (file not found)`);
                    }
                    break;

                default:
                    results.failed.push(`unknown action: ${op.action}`);
            }
        } catch (error) {
            results.failed.push(`${op.action} ${op.path}: ${error.message}`);
        }
    }

    this.saveToStorage();
    return results;
};

app.callAI = async function (message) {
    const { provider, apiKey, model, endpoint } = this.ai;
    const config = this.providers[provider];

    const currentCode = this.currentFile ? (this.files[this.currentFile]?.content || '') : '';
    const fileName = this.currentFile || 'none';
    const fileExt = fileName !== 'none' ? fileName.split('.').pop() : 'txt';

    const projectContext = this.getProjectContext();

    const context = `You are DevStudio AI, a helpful coding assistant.

Project files:
${projectContext}

Currently open file: ${fileName}
Current content:
\`\`\`${fileExt}
${currentCode || '(empty)'}
\`\`\`

User request: ${message}

Please help the user with their request. Be helpful and provide code examples when relevant.`;

    if (provider === 'local') {
        const ollamaUrl = (endpoint || 'http://localhost:11434').replace(/\/$/, '');
        const finalModel = model || 'gemma4:latest';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const testResponse = await fetch(`${ollamaUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!testResponse.ok) {
                throw new Error(`Ollama server not responding at ${ollamaUrl}`);
            }

            const tagsData = await testResponse.json();
            const modelExists = tagsData.models?.some(m => m.name === finalModel);

            if (!modelExists) {
                const availableModels = tagsData.models?.map(m => m.name).join(', ') || 'none';
                throw new Error(`Model '${finalModel}' not found. Available: ${availableModels}\n\nRun: ollama pull ${finalModel}`);
            }
        } catch (testError) {
            if (testError.name === 'AbortError') {
                throw new Error(`Ollama timeout at ${ollamaUrl}\n\nMake sure Ollama is running:\n• Run 'ollama serve' in terminal\n• Then run: ollama pull ${finalModel}`);
            }
            throw testError;
        }

        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: finalModel,
                prompt: context,
                stream: false,
                options: {
                    temperature: 0.7,
                    num_predict: 8192,
                    top_p: 0.9
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        let reply = data.response || "I'm having trouble responding right now. Please try again.";

        reply = reply.replace(/<\/?s>/g, '');
        reply = reply.replace(/<\|[^>]+\|>/g, '');

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
            messages: [{ role: 'user', content: context }],
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
            messages: [{ role: 'user', content: context }]
        });
    } else if (provider === 'google') {
        const useModel = model || config.defaultModel;
        url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${effectiveKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
            contents: [{ parts: [{ text: context }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        });
    } else {
        url = endpoint || config.baseUrl;
        headers = { 'Authorization': `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            messages: [{ role: 'user', content: context }],
            temperature: 0.7
        });
    }

    const response = await fetch(url, { method: 'POST', headers, body });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();

    if (provider === 'anthropic') return data.content[0].text;
    if (provider === 'google') return data.candidates[0].content.parts[0].text;
    return data.choices[0].message.content;
};

app.quickAction = function (action) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;

    switch (action) {
        case 'explain':
            chatInput.value = `Can you explain how the code in ${this.currentFile || 'the current file'} works?`;
            break;
        case 'fix':
            chatInput.value = `Please help me fix bugs in ${this.currentFile || 'the current file'}.`;
            break;
        case 'optimize':
            chatInput.value = `Can you optimize ${this.currentFile || 'the current file'} for better performance?`;
            break;
        case 'document':
            chatInput.value = `Please add documentation to ${this.currentFile || 'the current file'}.`;
            break;
        case 'test':
            chatInput.value = `Can you write tests for ${this.currentFile || 'the current file'}?`;
            break;
        default:
            chatInput.value = action;
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
    if (providerSelect) providerSelect.value = this.ai.provider;
    const apiKeyInput = document.getElementById('ai-api-key');
    if (apiKeyInput) apiKeyInput.value = this.ai.apiKey;
    const modelInput = document.getElementById('ai-model');
    if (modelInput) modelInput.value = this.ai.model;
    const endpointInput = document.getElementById('ai-endpoint');
    if (endpointInput) endpointInput.value = this.ai.endpoint;
    const themeSelect = document.getElementById('editor-theme');
    if (themeSelect) themeSelect.value = this.settings.theme;
    const fontSizeInput = document.getElementById('editor-font-size');
    if (fontSizeInput) fontSizeInput.value = this.settings.fontSize;
    const autoApplyCheckbox = document.getElementById('ai-auto-apply');
    if (autoApplyCheckbox) autoApplyCheckbox.checked = this.ai.autoApply || false;
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

    const corsWarning = document.getElementById('cors-warning');
    if (corsWarning && config) corsWarning.style.display = config.cors ? 'block' : 'none';

    const hint = document.getElementById('api-key-hint');
    if (hint) {
        if (provider === 'kimi') {
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

    if (window.isElectron && window.require) {
        try {
            const Store = window.require('electron-store');
            const store = new Store();
            store.set('devstudio-data', data);
        } catch (e) {
            console.error('Electron store error:', e);
            localStorage.setItem('devstudio_data', JSON.stringify(data));
        }
    } else {
        localStorage.setItem('devstudio_data', JSON.stringify(data));
    }
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
        badge.style.display = 'inline-flex';
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

    const corsWarning = document.getElementById('cors-warning');
    if (corsWarning) {
        corsWarning.style.display = (config && config.cors) ? 'block' : 'none';
    }

    const hint = document.getElementById('api-key-hint');
    if (hint) {
        if (provider === 'kimi') {
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
};

// UI update methods needed for refresh
app.renderFileTree = function () {
    const container = document.getElementById('file-tree');
    if (!container) return;
    container.innerHTML = '';

    const items = [];
    Object.keys(this.files).forEach(path => {
        const fileData = this.files[path];
        if (fileData.type === 'folder') {
            if (this.currentFolder === '') {
                if (!path.slice(0, -1).includes('/')) {
                    items.push({ path, type: 'folder', data: fileData });
                }
            } else {
                if (path.startsWith(this.currentFolder) && path !== this.currentFolder) {
                    const remaining = path.slice(this.currentFolder.length);
                    if (remaining && !remaining.slice(0, -1).includes('/')) {
                        items.push({ path, type: 'folder', data: fileData });
                    }
                }
            }
        } else {
            if (this.currentFolder === '') {
                if (!path.includes('/')) {
                    items.push({ path, type: 'file', data: fileData });
                }
            } else {
                if (path.startsWith(this.currentFolder)) {
                    const remaining = path.slice(this.currentFolder.length);
                    if (remaining && !remaining.includes('/')) {
                        items.push({ path, type: 'file', data: fileData });
                    }
                }
            }
        }
    });

    items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.path.localeCompare(b.path);
    });

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `tree-item ${this.currentFile === item.path ? 'active' : ''}`;
        const name = item.type === 'folder'
            ? item.path.replace(/\/$/, '').split('/').pop()
            : item.path.split('/').pop();
        div.innerHTML = `<span class="chevron" style="visibility: hidden;"></span><i class="fas ${item.type === 'folder' ? 'fa-folder' : 'fa-file-code'} icon"></i><span class="name">${name}</span>`;
        if (item.type === 'folder') {
            div.onclick = () => this.changeFolder(item.path);
        } else {
            div.onclick = () => this.openFile(item.path);
        }
        container.appendChild(div);
    });
};

app.updateFolderSelector = function () {
    const select = document.getElementById('folder-select');
    if (!select) return;
    select.innerHTML = '<option value="">📁 Root</option>';
    const folders = new Set();
    Object.keys(this.files).forEach(path => {
        if (this.files[path].type === 'folder') folders.add(path);
        if (path.includes('/')) {
            const parts = path.split('/');
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                if (parts[i]) {
                    currentPath = currentPath ? currentPath + parts[i] + '/' : parts[i] + '/';
                    folders.add(currentPath);
                }
            }
        }
    });
    folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = `📁 ${folder}`;
        if (this.currentFolder === folder) option.selected = true;
        select.appendChild(option);
    });
};

app.openFile = function (filename) {
    if (this.files[filename]?.type === 'folder') return;
    this.currentFile = filename;
    const content = this.files[filename]?.content || '';
    if (this.useFallbackEditor) {
        document.getElementById('fallback-editor').value = content;
    } else if (this.editor) {
        const language = filename.split('.').pop();
        const model = monaco.editor.createModel(content, language);
        this.editor.setModel(model);
    }
    this.renderFileTree();
    if (filename.endsWith('.html') && typeof this.updatePreview === 'function') {
        this.updatePreview();
    }
};

app.changeFolder = function (folder) {
    this.currentFolder = folder;
    this.renderFileTree();
    this.updateFolderSelector();
    this.saveToStorage();
};