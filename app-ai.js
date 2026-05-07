// ============================================================
// DevStudio – app-ai.js
// AI provider logic & chat (FIXED - Handles multiple JSON formats)
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

        // Parse the response for file operations (handles multiple formats)
        const operations = this.parseAIResponseForOperations(response);

        if (operations && operations.length > 0) {
            if (this.ai.autoApply) {
                // Apply operations directly
                const results = this.applyFileOperations(operations);
                let summary = `**Applied ${results.success.length} changes:**\n`;
                results.success.forEach(s => summary += `• ${s}\n`);
                if (results.failed.length > 0) {
                    summary += `\n**Failed:**\n`;
                    results.failed.forEach(f => summary += `• ${f}\n`);
                }
                this.addChatMessage(summary, 'system');
                this.showToast(`Applied ${results.success.length} file changes`);

                // Refresh the current file if it was changed
                const affectedFile = operations.find(op => op.path === this.currentFile);
                if (affectedFile && affectedFile.content) {
                    this.openFile(this.currentFile);
                }

                // Refresh file tree to show new files
                this.renderFileTree();
                this.updateFolderSelector();
            } else {
                // Show operations with apply button
                this.addChatMessage(response, 'ai');
                this.showApplyButton(operations);
            }
        } else {
            // Just show the response
            let cleanResponse = response;
            // Remove any JSON blocks from display
            cleanResponse = cleanResponse.replace(/```json\s*[\s\S]*?\s*```/g, '');
            cleanResponse = cleanResponse.replace(/\{\s*"(?:file|content|operations|action|path)"[\s\S]*?\}/g, '');
            if (cleanResponse.trim()) {
                this.addChatMessage(cleanResponse || "Response received (no file changes detected).", 'ai');
            } else {
                this.addChatMessage("No file changes were made. Please be more specific about what you want to create or modify.", 'ai');
            }
        }
    } catch (error) {
        console.error('AI Error:', error);
        let errorMsg = error.message;

        if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            if (this.ai.provider === 'local') {
                errorMsg = `❌ Cannot connect to Ollama.\n\nPlease ensure:\n1. Ollama is running (check system tray/terminal)\n2. Run: ollama serve\n3. Model '${this.ai.model}' is installed\n4. Run: ollama pull ${this.ai.model}\n5. Using correct endpoint: ${this.ai.endpoint}`;
            } else {
                const provider = this.providers[this.ai.provider];
                if (provider?.cors) {
                    errorMsg = `CORS Error: ${this.ai.provider} blocks browser requests. Switch to local Ollama or use a CORS extension.`;
                } else {
                    errorMsg = `Network error: ${error.message}. Check your API key and internet connection.`;
                }
            }
        }

        this.addChatMessage(errorMsg, 'ai');
    } finally {
        statusEl.innerHTML = originalStatus;
    }
};

// Parse AI response to extract file operations - Supports multiple JSON formats
app.parseAIResponseForOperations = function (response) {
    const operations = [];

    // Try to find any JSON object in the response
    const jsonMatches = response.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/g);

    if (jsonMatches) {
        for (const jsonStr of jsonMatches) {
            try {
                const data = JSON.parse(jsonStr);

                // Format 1: {"operations": [{"action": "...", "path": "...", "content": "..."}]}
                if (data.operations && Array.isArray(data.operations)) {
                    operations.push(...data.operations);
                }
                // Format 2: {"file": "path.html", "content": "..."}
                else if (data.file && data.content) {
                    operations.push({
                        action: 'create',
                        path: data.file,
                        content: data.content
                    });
                }
                // Format 3: {"path": "path.html", "content": "...", "action": "..."}
                else if (data.path && data.content) {
                    operations.push({
                        action: data.action || 'update',
                        path: data.path,
                        content: data.content
                    });
                }
                // Format 4: {"filename": "path.html", "code": "..."}
                else if (data.filename && data.code) {
                    operations.push({
                        action: 'create',
                        path: data.filename,
                        content: data.code
                    });
                }
                // Format 5: {"name": "path.html", "content": "..."}
                else if (data.name && data.content) {
                    operations.push({
                        action: 'create',
                        path: data.name,
                        content: data.content
                    });
                }
                // Format 6: Direct array of operations
                else if (Array.isArray(data)) {
                    for (const item of data) {
                        if (item.path && (item.content || item.action === 'delete')) {
                            operations.push({
                                action: item.action || 'update',
                                path: item.path,
                                content: item.content || ''
                            });
                        }
                    }
                }
            } catch (e) {
                // Not valid JSON, continue
            }
        }
    }

    // Also look for markdown code blocks as fallback
    if (operations.length === 0) {
        const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
        let match;
        let suggestedFile = null;

        // Try to find filename before the code block
        const fileMatch = response.match(/(?:file|create|update)\s+['"]?([\w\/\\]+\.\w+)['"]?/i);
        if (fileMatch) {
            suggestedFile = fileMatch[1];
        }

        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1];
            const content = match[2];

            if (suggestedFile) {
                operations.push({
                    action: 'update',
                    path: suggestedFile,
                    content: content
                });
            } else if (language === 'html') {
                operations.push({
                    action: 'create',
                    path: 'index.html',
                    content: content
                });
            } else if (language === 'css') {
                operations.push({
                    action: 'create',
                    path: 'style.css',
                    content: content
                });
            } else if (language === 'javascript' || language === 'js') {
                operations.push({
                    action: 'create',
                    path: 'script.js',
                    content: content
                });
            }
        }
    }

    return operations;
};

// Show apply button for operations
app.showApplyButton = function (operations) {
    const container = document.getElementById('chat-messages');
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'chat-bubble system';
    buttonDiv.style.padding = '12px';
    buttonDiv.style.textAlign = 'center';
    buttonDiv.style.background = '#1e293b';
    buttonDiv.style.border = '1px solid #3b82f6';

    // Show what will be applied
    let opsList = '<div style="text-align: left; margin-bottom: 12px; font-size: 12px;"><strong>📁 Ready to apply:</strong><br>';
    operations.forEach(op => {
        const actionIcon = op.action === 'delete' ? '🗑️' : (op.action === 'create' ? '✨' : '📝');
        opsList += `• ${actionIcon} ${op.action}: <code>${op.path}</code><br>`;
    });
    opsList += '</div>';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn btn-primary';
    applyBtn.style.padding = '8px 20px';
    applyBtn.style.fontSize = '13px';
    applyBtn.style.marginRight = '8px';
    applyBtn.innerHTML = '<i class="fas fa-check-circle"></i> Apply Changes';
    applyBtn.onclick = () => {
        const results = this.applyFileOperations(operations);
        let summary = `✅ Applied ${results.success.length} changes:\n`;
        results.success.forEach(s => summary += `• ${s}\n`);
        if (results.failed.length > 0) {
            summary += `\n❌ Failed:\n`;
            results.failed.forEach(f => summary += `• ${f}\n`);
        }
        this.addChatMessage(summary, 'system');
        this.showToast(`Applied ${results.success.length} file changes`);
        buttonDiv.remove();

        // Refresh current file if needed
        const affectedFile = operations.find(op => op.path === this.currentFile);
        if (affectedFile && affectedFile.content) {
            this.openFile(this.currentFile);
        }
        this.renderFileTree();
        this.updateFolderSelector();
    };

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn-secondary';
    dismissBtn.style.padding = '8px 20px';
    dismissBtn.style.fontSize = '13px';
    dismissBtn.innerHTML = '<i class="fas fa-times"></i> Dismiss';
    dismissBtn.onclick = () => buttonDiv.remove();

    buttonDiv.innerHTML = opsList;
    buttonDiv.appendChild(applyBtn);
    buttonDiv.appendChild(dismissBtn);
    container.appendChild(buttonDiv);
    container.scrollTop = container.scrollHeight;
};

// Enhanced callAI with simple instruction
app.callAI = async function (message) {
    const { provider, apiKey, model, endpoint } = this.ai;
    const config = this.providers[provider];

    const currentCode = this.currentFile ? (this.files[this.currentFile]?.content || '') : '';
    const fileName = this.currentFile || 'none';

    const projectContext = this.getProjectContext();

    // Simple, clear instruction
    const context = `You are a code editor AI. When the user asks you to create or modify a file, respond with ONLY a JSON object.

EXAMPLE RESPONSE for creating a file:
{"file": "test.html", "content": "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>"}

EXAMPLE RESPONSE for updating current file:
{"file": "${fileName}", "content": "the complete updated content"}

EXAMPLE RESPONSE for multiple files:
{"operations": [{"action": "create", "path": "index.html", "content": "..."}, {"action": "update", "path": "style.css", "content": "..."}]}

Current files in project:
${projectContext}

Current open file: ${fileName}
Current content:
${currentCode || '(empty)'}

User request: ${message}

IMPORTANT: Respond with ONLY the JSON. No extra text before or after.`;

    if (provider === 'local') {
        const ollamaUrl = (endpoint || 'http://localhost:11434').replace(/\/$/, '');
        const finalModel = model || 'gemma4:latest';

        // Check Ollama connection
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
                throw new Error(`Ollama timeout at ${ollamaUrl}\n\nMake sure Ollama is running:\n• Windows: Check system tray\n• Mac/Linux: Run 'ollama serve'\n\nThen run: ollama pull ${finalModel}`);
            }
            throw testError;
        }

        console.log(`Calling Ollama: ${ollamaUrl}/api/generate with model ${finalModel}`);

        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: finalModel,
                prompt: context,
                stream: false,
                options: {
                    temperature: 0.2,
                    num_predict: 4096,
                    top_p: 0.9
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        let reply = data.response || "{}";

        // Clean up
        reply = reply.replace(/<\/?s>/g, '');
        reply = reply.replace(/<\|[^>]+\|>/g, '');
        reply = reply.replace(/\[\/?INST\]/g, '');

        return reply;
    }

    // Cloud providers - simplified
    let url, body, headers;
    const effectiveKey = apiKey || '';

    if (provider === 'openai') {
        url = config.baseUrl;
        headers = { 'Authorization': `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            messages: [{ role: 'user', content: context }],
            temperature: 0.2,
            max_tokens: 4096
        });
    } else if (provider === 'anthropic') {
        url = config.baseUrl;
        headers = { 'x-api-key': effectiveKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            max_tokens: 4096,
            temperature: 0.2,
            messages: [{ role: 'user', content: context }]
        });
    } else if (provider === 'google') {
        const useModel = model || config.defaultModel;
        url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${effectiveKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
            contents: [{ parts: [{ text: context }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
        });
    } else {
        url = endpoint || config.baseUrl;
        headers = { 'Authorization': `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            messages: [{ role: 'user', content: context }],
            temperature: 0.2
        });
    }

    const response = await fetch(url, { method: 'POST', headers, body });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    let reply = '';

    if (provider === 'anthropic') reply = data.content[0].text;
    else if (provider === 'google') reply = data.candidates[0].content.parts[0].text;
    else reply = data.choices[0].message.content;

    return reply;
};

app.quickAction = function (action) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;

    switch (action) {
        case 'explain':
            chatInput.value = `Explain the current file (${this.currentFile || 'no file open'}) in detail`;
            break;
        case 'fix':
            chatInput.value = `Fix any bugs in the current file and show me the corrected version`;
            break;
        case 'optimize':
            chatInput.value = `Optimize the current file for better performance and readability`;
            break;
        case 'document':
            chatInput.value = `Add comprehensive documentation comments to the current file`;
            break;
        case 'test':
            chatInput.value = `Write unit tests for the current file`;
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