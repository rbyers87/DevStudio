// ============================================================
// DevStudio – app-ai.js
// AI provider logic - Natural responses + automatic file operations
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

        // Show AI's natural response first
        let cleanResponse = response;

        // Extract and apply any file operations
        const operations = this.extractFileOperations(response);

        if (operations && operations.length > 0) {
            // Remove the JSON/operation parts from displayed response
            cleanResponse = this.removeOperationBlocks(cleanResponse);

            if (cleanResponse.trim()) {
                this.addChatMessage(cleanResponse, 'ai');
            }

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
        } else {
            // No operations, just show the natural response
            this.addChatMessage(cleanResponse || "I've processed your request.", 'ai');
        }
    } catch (error) {
        console.error('AI Error:', error);
        let errorMsg = error.message;

        if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            if (this.ai.provider === 'local') {
                errorMsg = `❌ Cannot connect to Ollama.\n\nPlease ensure:\n1. Ollama is running (check system tray/terminal)\n2. Run: ollama serve\n3. Model '${this.ai.model}' is installed\n4. Run: ollama pull ${this.ai.model}`;
            } else {
                errorMsg = `Network error: ${error.message}. Check your API key and internet connection.`;
            }
        }

        this.addChatMessage(errorMsg, 'ai');
    } finally {
        statusEl.innerHTML = originalStatus;
    }
};

// Extract file operations from AI's natural response
app.extractFileOperations = function (response) {
    const operations = [];

    // Look for JSON blocks
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/g;
    let match;

    while ((match = jsonRegex.exec(response)) !== null) {
        try {
            const data = JSON.parse(match[1]);
            if (data.operations && Array.isArray(data.operations)) {
                operations.push(...data.operations);
            } else if (data.file && data.content) {
                operations.push({ action: data.action || 'create', path: data.file, content: data.content });
            } else if (data.path && data.content) {
                operations.push({ action: data.action || 'update', path: data.path, content: data.content });
            }
        } catch (e) { }
    }

    // Look for code blocks with file indicators
    const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
    let filePath = null;

    // Try to find a file path mentioned before the code block
    const pathMatches = response.match(/(?:file|create|update|modify)\s+['"]?([\w\/\\]+\.\w+)['"]?/gi);

    let blockIndex = 0;
    while ((match = codeBlockRegex.exec(response)) !== null) {
        const language = match[1];
        const content = match[2];

        // Get the file path from context if available
        if (pathMatches && pathMatches[blockIndex]) {
            const extractedPath = pathMatches[blockIndex].match(/['"]?([\w\/\\]+\.\w+)['"]?/);
            if (extractedPath) {
                filePath = extractedPath[1];
            }
        }

        if (filePath) {
            operations.push({
                action: 'update',
                path: filePath,
                content: content
            });
            filePath = null;
        } else if (content.includes('<!DOCTYPE html') || content.includes('<html')) {
            operations.push({ action: 'create', path: 'index.html', content: content });
        } else if (language === 'css') {
            operations.push({ action: 'create', path: 'style.css', content: content });
        } else if (language === 'javascript' || language === 'js') {
            operations.push({ action: 'create', path: 'script.js', content: content });
        }

        blockIndex++;
    }

    return operations;
};

// Remove operation blocks from displayed text
app.removeOperationBlocks = function (text) {
    // Remove JSON blocks
    text = text.replace(/```json\s*[\s\S]*?\s*```/g, '');
    // Remove any stray JSON objects that might be visible
    text = text.replace(/\{\s*"operations"\s*:\s*\[[\s\S]*?\]\s*\}/g, '');
    text = text.replace(/\{\s*"file"\s*:\s*"[^"]*"\s*,\s*"content"\s*:\s*"[^"]*"\s*\}/g, '');
    // Clean up extra whitespace
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    return text.trim();
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
        this.addChatMessage(summary, 'system');
        this.showToast(`Applied ${results.success.length} file changes`);
        buttonDiv.remove();
        this.renderFileTree();
        this.updateFolderSelector();
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

app.callAI = async function (message) {
    const { provider, apiKey, model, endpoint } = this.ai;
    const config = this.providers[provider];

    const currentCode = this.currentFile ? (this.files[this.currentFile]?.content || '') : '';
    const fileName = this.currentFile || 'none';
    const fileExt = fileName !== 'none' ? fileName.split('.').pop() : 'txt';

    const projectContext = this.getProjectContext();

    // Natural, unrestricted prompt that lets AI think
    const context = `You are DevStudio AI, a helpful and intelligent coding assistant integrated into a code editor. You have full access to read and modify all files in the user's project.

Project files:
${projectContext}

Currently open file: ${fileName}
Current content:
\`\`\`${fileExt}
${currentCode || '(empty)'}
\`\`\`

The user is asking for help with their code. You can:
- Explain code and answer questions
- Suggest improvements
- Create new files
- Modify existing files
- Delete files when requested

When you need to CREATE, UPDATE, or DELETE files, include a JSON block in your response like this:

\`\`\`json
{"file": "path/to/file.html", "content": "the complete file content here"}
\`\`\`

For multiple files:
\`\`\`json
{"operations": [
  {"action": "create", "path": "index.html", "content": "..."},
  {"action": "update", "path": "style.css", "content": "..."}
]}
\`\`\`

Be helpful, think step by step, and provide natural responses. Don't be too rigid - just be a good assistant.

User request: ${message}`;

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

        // Clean up special tokens
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
            messages: [{ role: 'system', content: 'You are a helpful coding assistant.' }, { role: 'user', content: context }],
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
            chatInput.value = `Can you explain how the code in ${this.currentFile || 'the current file'} works and suggest any improvements?`;
            break;
        case 'fix':
            chatInput.value = `Please review ${this.currentFile || 'the current file'} for bugs and help me fix them.`;
            break;
        case 'optimize':
            chatInput.value = `Can you optimize ${this.currentFile || 'the current file'} for better performance and cleaner code?`;
            break;
        case 'document':
            chatInput.value = `Please add detailed documentation and comments to ${this.currentFile || 'the current file'}.`;
            break;
        case 'test':
            chatInput.value = `Can you write unit tests for ${this.currentFile || 'the current file'}?`;
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