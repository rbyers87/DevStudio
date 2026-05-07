// ============================================================
// DevStudio – app-ai.js
// AI provider logic & chat
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
    div.innerHTML = text.replace(/\n/g, '<br>');
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
        this.addChatMessage(response, 'ai');

        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            try {
                const jsonData = JSON.parse(jsonMatch[1]);
                if (jsonData.operations && Array.isArray(jsonData.operations)) {
                    if (this.ai.autoApply) {
                        const results = this.applyFileOperations(jsonData.operations);
                        const summary = results.success.join('\n') + (results.failed.length ? '\n' + results.failed.join('\n') : '');
                        this.addChatMessage(`✅ Auto-applied file changes:\n${summary}`, 'system');
                        this.showToast(`Applied ${results.success.length} file operations`);
                    } else {
                        this.addChatMessage(`💡 AI suggested file operations. Enable "Auto-apply AI file changes" in Settings to apply automatically.\n\n\`\`\`json\n${JSON.stringify(jsonData.operations, null, 2)}\n\`\`\``, 'system');
                    }
                }
            } catch (e) {
                console.log('Failed to parse JSON operations:', e);
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

app.callAI = async function (message) {
    const { provider, apiKey, model, endpoint } = this.ai;
    const config = this.providers[provider];

    const currentCode = this.currentFile ? (this.files[this.currentFile]?.content || '') : '';
    const fileName = this.currentFile || 'none';
    const fileExt = fileName !== 'none' ? fileName.split('.').pop() : 'txt';

    const projectContext = this.getProjectContext();

    let context = `You are DevStudio AI, an expert coding assistant. You have FULL access to all files in the project and can directly modify them.`;
    context += `\n\n${projectContext}`;
    context += `\n\nCurrent open file: ${fileName} (${fileExt} extension)`;
    context += `\nCurrent code in open file:\n\`\`\`${fileExt}\n${currentCode || '(empty file)'}\n\`\`\``;
    context += `\n\nUser request: ${message}`;
    context += `\n\nIMPORTANT: When the user asks you to create, modify, or delete files, respond with a JSON block containing operations.`;
    context += `\n\nExample JSON response for a file change:\n\`\`\`json\n{\n  "operations": [\n    { "action": "update", "path": "index.html", "content": "new html content" },\n    { "action": "create", "path": "newfile.js", "content": "console.log('hello');" },\n    { "action": "delete", "path": "oldfile.txt" }\n  ]\n}\n\`\`\``;
    context += `\n\nYou can also make multiple changes in one response. Include the JSON block along with your explanation.`;
    context += `\n\nRespond with helpful code, explanations, or suggestions.`;

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
                    temperature: 0.7,
                    num_predict: 8192,
                    top_p: 0.9,
                    repeat_penalty: 1.1
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        let reply = data.response || "I couldn't generate a response. Please try again.";

        reply = reply.replace(/<\/?s>/g, '');
        reply = reply.replace(/<\|[^>]+\|>/g, '');

        return reply;
    }

    let url, body, headers;
    const effectiveKey = apiKey || '';

    if (provider === 'openai') {
        url = config.baseUrl;
        headers = { 'Authorization': `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            messages: [{ role: 'system', content: 'You are a helpful coding assistant that has full access to the project files.' }, { role: 'user', content: context }],
            temperature: 0.7,
            max_tokens: 8192
        });
    } else if (provider === 'anthropic') {
        url = config.baseUrl;
        headers = { 'x-api-key': effectiveKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            max_tokens: 8192,
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
    const actions = {
        explain: 'Explain the current file in detail, including what each part does and any potential improvements.',
        fix: 'Find and fix bugs or issues in the current file. Provide the corrected version.',
        optimize: 'Optimize the current file for better performance, readability, and maintainability.',
        document: 'Add comprehensive documentation and comments to the current file.',
        test: 'Write unit tests for the current file using appropriate testing framework.'
    };
    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.value = actions[action];
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