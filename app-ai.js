// ============================================================
// DevStudio – app-ai.js
// AI provider logic & chat (FIXED - Direct File Modification)
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
    // Format the text for display
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

        // Parse the response for file operations
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
            } else {
                // Show operations with apply button
                this.addChatMessage(response, 'ai');
                this.showApplyButton(operations);
            }
        } else {
            // Just show the response
            this.addChatMessage(response, 'ai');
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

// Parse AI response to extract file operations
app.parseAIResponseForOperations = function (response) {
    const operations = [];

    // Look for JSON blocks
    const jsonRegex = /```json\s*({[\s\S]*?})\s*```/g;
    let match;

    while ((match = jsonRegex.exec(response)) !== null) {
        try {
            const data = JSON.parse(match[1]);
            if (data.operations && Array.isArray(data.operations)) {
                operations.push(...data.operations);
            } else if (data.action && data.path) {
                operations.push(data);
            }
        } catch (e) {
            console.log('JSON parse failed:', e);
        }
    }

    // Look for markdown code blocks that might be file content
    const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
    let codeMatch;
    let fileCounter = 0;

    while ((codeMatch = codeBlockRegex.exec(response)) !== null) {
        const language = codeMatch[1];
        const content = codeMatch[2];

        // Try to determine file path from context
        const contextBefore = response.substring(0, codeMatch.index);
        const pathMatch = contextBefore.match(/(?:file|create|update|modify)\s+['"]?([\w\/\\]+\.\w+)['"]?/i);

        if (pathMatch) {
            operations.push({
                action: 'update',
                path: pathMatch[1],
                content: content
            });
        } else if (language === 'html' || language === 'css' || language === 'javascript' || language === 'js') {
            // Suggest a filename based on language
            let suggestedPath = '';
            if (language === 'html') suggestedPath = 'newfile.html';
            else if (language === 'css') suggestedPath = 'styles.css';
            else if (language === 'javascript' || language === 'js') suggestedPath = 'script.js';
            else suggestedPath = `file_${fileCounter++}.${language}`;

            operations.push({
                action: 'create',
                path: suggestedPath,
                content: content
            });
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
    let opsList = '<div style="text-align: left; margin-bottom: 12px; font-size: 12px;"><strong>Ready to apply:</strong><br>';
    operations.forEach(op => {
        opsList += `• ${op.action}: ${op.path}<br>`;
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
        let summary = `Applied ${results.success.length} changes:\n`;
        results.success.forEach(s => summary += `• ${s}\n`);
        if (results.failed.length > 0) {
            summary += `\nFailed:\n`;
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

// Direct file modification for common requests
app.handleDirectCommands = function (message, currentFileContent, currentFilePath) {
    const operations = [];
    const lowerMsg = message.toLowerCase();

    // Handle "create a new file" requests
    const createMatch = message.match(/(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?(?:file\s+)?['"]?([\w\/\\]+\.\w+)['"]?\s*(?:with\s+)?(?:content\s*)?[:\n]*(.*)/is);
    if (createMatch) {
        const filePath = createMatch[1];
        let content = createMatch[2] || '';

        // If content looks like code, extract it
        const codeMatch = message.match(/```(\w*)\n([\s\S]*?)```/);
        if (codeMatch) {
            content = codeMatch[2];
        }

        if (filePath && content) {
            operations.push({
                action: 'create',
                path: filePath,
                content: content
            });
        }
    }

    // Handle "update current file" requests
    if ((lowerMsg.includes('update') || lowerMsg.includes('change') || lowerMsg.includes('modify') || lowerMsg.includes('fix')) &&
        currentFilePath && currentFilePath !== 'none') {

        const codeMatch = message.match(/```(\w*)\n([\s\S]*?)```/);
        if (codeMatch) {
            operations.push({
                action: 'update',
                path: currentFilePath,
                content: codeMatch[2]
            });
        } else if (lowerMsg.includes('add') && lowerMsg.includes('function')) {
            // For adding functions, preserve existing content
            const functionMatch = message.match(/function\s+(\w+)[\s\S]*?\{[\s\S]*?\}/);
            if (functionMatch) {
                const newContent = currentFileContent + '\n\n' + functionMatch[0];
                operations.push({
                    action: 'update',
                    path: currentFilePath,
                    content: newContent
                });
            }
        }
    }

    return operations;
};

// Enhanced callAI with direct instruction for JSON output
app.callAI = async function (message) {
    const { provider, apiKey, model, endpoint } = this.ai;
    const config = this.providers[provider];

    const currentCode = this.currentFile ? (this.files[this.currentFile]?.content || '') : '';
    const fileName = this.currentFile || 'none';
    const fileExt = fileName !== 'none' ? fileName.split('.').pop() : 'txt';

    // Try direct command handling first
    const directOps = this.handleDirectCommands(message, currentCode, this.currentFile);
    if (directOps.length > 0) {
        // Return a response that will trigger the operations
        return JSON.stringify({ operations: directOps });
    }

    const projectContext = this.getProjectContext();

    // STRICT JSON OUTPUT INSTRUCTION
    let context = `You are DevStudio AI. You MUST respond with ONLY a JSON object containing file operations. Do NOT add any explanatory text before or after the JSON.

The JSON must follow this EXACT format:
{
  "operations": [
    {
      "action": "update",
      "path": "${fileName}",
      "content": "THE COMPLETE FILE CONTENT HERE"
    }
  ]
}

For multiple files:
{
  "operations": [
    { "action": "create", "path": "newfile.html", "content": "<html>...</html>" },
    { "action": "update", "path": "${fileName}", "content": "updated content" },
    { "action": "delete", "path": "oldfile.txt" }
  ]
}

CRITICAL RULES:
1. When updating ${fileName}, include the COMPLETE updated file content
2. Escape double quotes inside content with backslash: \\"
3. Use \\n for newlines inside strings
4. Valid actions: "create", "update", "delete"
5. If no file changes are needed, respond with: {"operations": []}

Current project has these files:
${projectContext}

Current open file: ${fileName}
Current content:
${currentCode || '(empty)'}

User request: ${message}

Remember: Respond with ONLY the JSON object. No explanations. No markdown formatting around the JSON. Just the raw JSON.`;

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
                    temperature: 0.3,  // Lower temperature for more predictable JSON
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
        let reply = data.response || "{\"operations\":[]}";

        // Clean up special tokens
        reply = reply.replace(/<\/?s>/g, '');
        reply = reply.replace(/<\|[^>]+\|>/g, '');
        reply = reply.replace(/\[\/?INST\]/g, '');

        // Try to extract JSON if there's extra text
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            reply = jsonMatch[0];
        }

        // Validate JSON
        try {
            JSON.parse(reply);
            return reply;
        } catch (e) {
            console.error('Invalid JSON response:', reply);
            // Return a friendly error
            return JSON.stringify({
                operations: [],
                error: "AI didn't return valid JSON. Please try again with a clearer request."
            });
        }
    }

    // Cloud providers - similar strict JSON instruction
    let url, body, headers;
    const effectiveKey = apiKey || '';

    const systemPrompt = `You are DevStudio AI. You MUST respond with ONLY a JSON object containing file operations. No extra text. Format: {"operations":[{"action":"update","path":"filename","content":"content"}]}`;

    if (provider === 'openai') {
        url = config.baseUrl;
        headers = { 'Authorization': `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context }
            ],
            temperature: 0.3,
            max_tokens: 8192
        });
    } else if (provider === 'anthropic') {
        url = config.baseUrl;
        headers = { 'x-api-key': effectiveKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            max_tokens: 8192,
            temperature: 0.3,
            messages: [{ role: 'user', content: context }],
            system: systemPrompt
        });
    } else if (provider === 'google') {
        const useModel = model || config.defaultModel;
        url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${effectiveKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + '\n\n' + context }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
        });
    } else {
        url = endpoint || config.baseUrl;
        headers = { 'Authorization': `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' };
        body = JSON.stringify({
            model: model || config.defaultModel,
            messages: [{ role: 'user', content: systemPrompt + '\n\n' + context }],
            temperature: 0.3
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

    // Extract JSON
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        reply = jsonMatch[0];
    }

    try {
        JSON.parse(reply);
        return reply;
    } catch (e) {
        return JSON.stringify({ operations: [] });
    }
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