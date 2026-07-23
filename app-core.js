// ============================================================
// DevStudio – app-core.js
// Core application state, storage, initialization
// FIXED: GitHub repo creation with better error handling and auto-load
// ============================================================

const app = {
    // Core state
    editor: null,
    currentFile: null,
    files: {},
    versions: [],
    github: { token: null, repo: null, connected: false },
    ai: { provider: 'local', apiKey: '', model: 'gemma4:latest', endpoint: 'http://localhost:11434', autoApply: false },
    settings: { theme: 'vs-dark', fontSize: 13, wordWrap: true },
    chatCollapsed: false,
    chatHeight: 280,
    expandedFolders: new Set(['']),
    currentFolder: '',
    autoSaveTimer: null,
    monacoLoaded: false,
    useFallbackEditor: false,
    currentProjectPath: null,
    ipcRenderer: null,
    fs: null,
    path: null,
    localOllamaModels: null,

    // Provider configurations
    providers: {
        openai: {
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1/chat/completions',
            models: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
            defaultModel: 'gpt-4',
            help: 'Get API key from platform.openai.com',
            needsKey: true
        },
        anthropic: {
            name: 'Anthropic',
            baseUrl: 'https://api.anthropic.com/v1/messages',
            models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
            defaultModel: 'claude-3-opus-20240229',
            help: 'Get API key from console.anthropic.com',
            needsKey: true
        },
        google: {
            name: 'Google Gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            models: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
            defaultModel: 'gemini-2.0-flash-exp',
            help: 'Get API key from aistudio.google.com',
            needsKey: true
        },
        deepseek: {
            name: 'Deepseek',
            baseUrl: 'https://api.deepseek.com/chat/completions',
            models: ['deepseek-chat', 'deepseek-coder'],
            defaultModel: 'deepseek-chat',
            help: 'Paid API - get key from platform.deepseek.com',
            needsKey: true,
            cors: true
        },
        kimi: {
            name: 'Kimi',
            baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
            models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
            defaultModel: 'moonshot-v1-8k',
            help: 'FREE tier but may have CORS issues',
            needsKey: true,
            cors: true
        },
        local: {
            name: 'Local Ollama',
            baseUrl: 'http://localhost:11434/api/generate',
            models: [], // Empty array means use text input for custom models
            defaultModel: 'gemma4:latest',
            help: 'Run `ollama serve` first, then pull model with `ollama pull gemma4:latest`',
            needsKey: false
        }
    },

    // ============================================================
    // INITIALIZATION
    // ============================================================

    async init() {
        console.log('=== INIT START ===');

        // FORCE FALLBACK EDITOR FOR ELECTRON DESKTOP
        if (window.isElectron) {
            console.log('Electron detected - using fallback editor');
            this.useFallbackEditor = true;
            // Don't try to load Monaco in Electron
            this.monacoLoaded = false;
        }

        this.loadFromStorage();
        this.setupEventListeners();

        // Only try to load Monaco if not in Electron
        if (!window.isElectron) {
            await this.initMonaco();
        } else {
            // Setup fallback editor directly
            const fallbackEditor = document.getElementById('fallback-editor');
            if (fallbackEditor) {
                this.setupFallbackEditor(fallbackEditor);
            }
        }

        this.renderFileTree();
        this.renderVersions();
        this.updateFolderSelector();
        this.setupColumnResizers();
        this.setupChatResize();
        this.updateProviderUI();
        this.handleProviderChange();
        this.setupAutoSave();

        if (window.isElectron && window.require) {
            this.initElectronFeatures();
        }

        this.chatCollapsed = false;
        const chatPanel = document.getElementById('chat-panel');
        if (chatPanel) chatPanel.style.height = '280px';

        const chatMessages = document.querySelector('.chat-messages');
        const chatInputArea = document.querySelector('.chat-input-area');
        if (chatMessages) chatMessages.style.display = 'flex';
        if (chatInputArea) chatInputArea.style.display = 'block';

        if (this.currentFile && this.files[this.currentFile]) {
            this.openFile(this.currentFile);
        } else {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.style.display = 'flex';
        }

        this.showToast('DevStudio Ready!');
        setTimeout(() => this.testOllamaConnection(), 500);

        // Fix chat input focus
        setTimeout(() => {
            if (typeof this.fixChatInput === 'function') {
                this.fixChatInput();
            }
        }, 100);
    },

    setupEventListeners() {
        window.addEventListener('beforeunload', () => {
            if (this.currentFile) {
                this.saveToStorage();
            }
        });

        window.addEventListener('keydown', (e) => {
            // Save shortcut (Ctrl+S / Cmd+S)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (window.isElectron && this.currentProjectPath) {
                    this.saveCurrentToDisk();
                } else {
                    this.saveToStorage();
                    this.showToast('Project saved to local storage');
                }
            }

            // ============================================================
            // SEARCH KEYBOARD SHORTCUTS
            // ============================================================

            // Ctrl+F / Cmd+F - Open search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (typeof this.openEditorSearch === 'function') {
                    this.openEditorSearch();
                }
            }

            // Ctrl+H / Cmd+H - Replace mode
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                if (typeof this.openEditorSearch === 'function') {
                    this.openEditorSearch();
                    if (typeof this.toggleReplaceMode === 'function') {
                        this.toggleReplaceMode();
                    }
                }
            }

            // F3 - Find next
            if (e.key === 'F3') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (typeof this.findPrevious === 'function') this.findPrevious();
                } else {
                    if (typeof this.findNext === 'function') this.findNext();
                }
            }

            // Escape - Close search
            if (e.key === 'Escape') {
                const searchBar = document.getElementById('editor-search-bar');
                if (searchBar && searchBar.style.display === 'flex') {
                    e.preventDefault();
                    if (typeof this.closeEditorSearch === 'function') this.closeEditorSearch();
                }
            }
        });

        window.addEventListener('resize', () => {
            if (this.editor) {
                setTimeout(() => this.editor.layout(), 50);
            }
            this.refreshLayout();
        });

        const observer = new ResizeObserver(() => {
            if (this.editor) {
                setTimeout(() => this.editor.layout(), 50);
            }
            this.refreshLayout();
        });

        const editorSection = document.querySelector('.editor-section');
        const sidebarContainer = document.querySelector('.sidebar-container');
        const previewContainer = document.querySelector('.preview-container');

        if (editorSection) observer.observe(editorSection);
        if (sidebarContainer) observer.observe(sidebarContainer);
        if (previewContainer) observer.observe(previewContainer);
    },

    // FIX: Layout refresh method to keep chat visible
    refreshLayout() {
        // Force Monaco editor to recalculate its layout
        if (this.editor && !this.useFallbackEditor) {
            setTimeout(() => {
                try {
                    this.editor.layout();
                } catch (e) {
                    console.log('Editor layout error:', e);
                }
            }, 50);
        }

        // Ensure chat panel is visible and properly positioned
        const chatPanel = document.getElementById('chat-panel');
        if (chatPanel && this.chatCollapsed === false) {
            const currentHeight = parseInt(chatPanel.style.height);
            if (currentHeight < 120) {
                chatPanel.style.height = (this.chatHeight || 280) + 'px';
            }
        }

        // Fix editor container height
        const editorContainer = document.querySelector('.editor-container');
        const editorSection = document.querySelector('.editor-section');
        if (editorContainer && editorSection) {
            const chatHeight = chatPanel ? chatPanel.offsetHeight : 280;
            const tabsHeight = 38;
            const availableHeight = editorSection.clientHeight - tabsHeight - chatHeight;
            if (availableHeight > 100) {
                editorContainer.style.flex = `${availableHeight}px 1 auto`;
            }
        }
    },

    setupColumnResizers() {
        const sidebarResizer = document.getElementById('sidebar-resizer');
        const previewResizer = document.getElementById('preview-resizer');
        const appGrid = document.getElementById('app');
        let isResizingSidebar = false;
        let isResizingPreview = false;
        let startX, startSidebarWidth, startPreviewWidth;

        if (sidebarResizer) {
            sidebarResizer.addEventListener('mousedown', (e) => {
                isResizingSidebar = true;
                startX = e.clientX;
                startSidebarWidth = document.getElementById('sidebar-container').offsetWidth;
                document.body.classList.add('resizing');
                e.preventDefault();
            });
        }

        if (previewResizer) {
            previewResizer.addEventListener('mousedown', (e) => {
                isResizingPreview = true;
                startX = e.clientX;
                startPreviewWidth = document.getElementById('preview-section').offsetWidth;
                document.body.classList.add('resizing');
                e.preventDefault();
            });
        }

        document.addEventListener('mousemove', (e) => {
            if (isResizingSidebar) {
                const delta = e.clientX - startX;
                const newWidth = Math.max(200, Math.min(450, startSidebarWidth + delta));
                if (appGrid) {
                    appGrid.style.gridTemplateColumns = `${newWidth}px 1fr ${document.getElementById('preview-section').offsetWidth}px`;
                }
                setTimeout(() => {
                    if (this.editor) this.editor.layout();
                    this.refreshLayout();
                }, 10);
            }
            if (isResizingPreview) {
                const delta = startX - e.clientX;
                const newWidth = Math.max(250, Math.min(700, startPreviewWidth + delta));
                if (appGrid) {
                    appGrid.style.gridTemplateColumns = `${document.getElementById('sidebar-container').offsetWidth}px 1fr ${newWidth}px`;
                }
                setTimeout(() => {
                    if (this.editor) this.editor.layout();
                    this.refreshLayout();
                }, 10);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizingSidebar || isResizingPreview) {
                isResizingSidebar = false;
                isResizingPreview = false;
                document.body.classList.remove('resizing');
                setTimeout(() => {
                    if (this.editor) this.editor.layout();
                    this.refreshLayout();
                }, 10);
            }
        });
    },

    setupChatResize() {
        const resizer = document.getElementById('chat-resizer');
        const panel = document.getElementById('chat-panel');
        let isResizing = false;
        let startY, startHeight;

        if (resizer && panel) {
            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                startHeight = panel.offsetHeight;
                document.body.style.cursor = 'ns-resize';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const delta = startY - e.clientY;
                const newHeight = Math.min(500, Math.max(120, startHeight + delta));
                panel.style.height = newHeight + 'px';
                this.chatHeight = newHeight;
                setTimeout(() => {
                    if (this.editor) this.editor.layout();
                    this.refreshLayout();
                }, 10);
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.body.style.cursor = '';
                this.refreshLayout();
            });
        }
    },

    setupAutoSave() {
        setInterval(() => {
            if (this.currentFile && this.files[this.currentFile]) {
                this.saveToStorage();
            }
        }, 30000);
    },

    // ============================================================
    // STORAGE
    // ============================================================

    saveToStorage() {
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
    },

    loadFromStorage() {
        let data = null;

        if (window.isElectron && window.require) {
            try {
                const Store = window.require('electron-store');
                const store = new Store();
                const storedData = store.get('devstudio-data');
                if (storedData) {
                    data = storedData;
                }
            } catch (e) {
                console.error('Electron store error:', e);
                const raw = localStorage.getItem('devstudio_data');
                data = raw ? JSON.parse(raw) : null;
            }
        } else {
            const raw = localStorage.getItem('devstudio_data');
            data = raw ? JSON.parse(raw) : null;
        }

        if (data) {
            this.files = data.files || {};
            this.versions = data.versions || [];
            this.github = data.github || { token: null, repo: null, connected: false };
            this.ai = data.ai || { provider: 'local', apiKey: '', model: 'gemma4:latest', endpoint: 'http://localhost:11434', autoApply: false };
            this.settings = data.settings || { theme: 'vs-dark', fontSize: 13, wordWrap: true };
            this.expandedFolders = new Set(data.expandedFolders || ['']);
            this.currentFolder = data.currentFolder || '';
            this.currentFile = data.currentFile || null;
        } else {
            this.initDemoFiles();
        }

        if (this.github.connected && this.github.repo) {
            const statusSpan = document.getElementById('github-status');
            if (statusSpan) {
                statusSpan.innerHTML = `<i class="fab fa-github"></i> ${this.github.repo}`;
            }
        }
    },

    // ============================================================
    // NEW PROJECT FROM CHAT & GITHUB REPO CREATION
    // ============================================================

    initNewProject: async function (projectDescription, projectName) {
        this.showToast(`Creating project: ${projectName}...`);

        const systemPrompt = `You are a full-stack developer. Create a complete web application project based on the user's description.

Project name: ${projectName}
Description: ${projectDescription}

Generate a complete project structure with appropriate files (HTML, CSS, JS, etc.).
Return a JSON object in this exact format:
{
  "files": {
    "path/to/file1.html": "file content",
    "path/to/file2.css": "file content",
    "path/to/file3.js": "file content"
  }
}

Make sure the project is functional, well-structured, and includes an index.html as the entry point.
Respond with ONLY the JSON object.`;

        try {
            const response = await this.callAIWithSystemPrompt(systemPrompt, 'You are a project generator. Output only valid JSON.');

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('Invalid AI response format');

            const projectData = JSON.parse(jsonMatch[0]);

            this.files = {};

            for (const [filePath, content] of Object.entries(projectData.files)) {
                const parts = filePath.split('/');
                if (parts.length > 1) {
                    let currentPath = '';
                    for (let i = 0; i < parts.length - 1; i++) {
                        currentPath = currentPath ? currentPath + parts[i] + '/' : parts[i] + '/';
                        if (!this.files[currentPath]) {
                            this.files[currentPath] = { content: null, type: 'folder' };
                        }
                    }
                }
                this.files[filePath] = { content: content, type: 'file' };
            }

            this.saveToStorage();
            this.updateFolderSelector();
            this.renderFileTree();
            this.createCheckpoint(`Initial project: ${projectName}`);

            const indexPath = Object.keys(projectData.files).find(f => f.toLowerCase().includes('index.html'));
            if (indexPath) {
                this.openFile(indexPath);
            }

            this.showToast(`✅ Project "${projectName}" created with ${Object.keys(projectData.files).length} files!`);
            return true;

        } catch (error) {
            console.error('Project creation error:', error);
            this.showToast(`Error creating project: ${error.message}`);
            return false;
        }
    },

    createGitHubRepo: async function (repoName, description = '', isPrivate = false) {
        if (!this.github.token) {
            this.showToast('Please connect to GitHub first');
            return null;
        }

        try {
            const response = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.github.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: repoName,
                    description: description,
                    private: isPrivate,
                    auto_init: false
                })
            });

            if (!response.ok) {
                const error = await response.json();
                let message = error.message || 'Unknown error';
                if (response.status === 422) {
                    message = 'Repository name already exists or is invalid.';
                } else if (response.status === 401) {
                    message = 'Invalid token. Please generate a new one with repo scope.';
                } else if (response.status === 403) {
                    message = 'Token lacks repo scope or you have reached your repo limit.';
                }
                throw new Error(message);
            }

            const repo = await response.json();
            this.github.repo = `${repo.owner.login}/${repo.name}`;
            this.github.connected = true;
            this.saveToStorage();

            const statusSpan = document.getElementById('github-status');
            if (statusSpan) statusSpan.innerHTML = `<i class="fab fa-github"></i> ${this.github.repo}`;

            this.showToast(`✅ Repository created: ${this.github.repo}`);
            return repo;

        } catch (error) {
            console.error('Repo creation error:', error);
            this.showToast(`❌ Error creating repo: ${error.message}`);
            return null;
        }
    },

    createAndPushToGitHub: async function (projectDescription, projectName, repoDescription = '') {
        // Step 1: Create the project locally
        const projectCreated = await this.initNewProject(projectDescription, projectName);
        if (!projectCreated) {
            this.showToast('❌ Failed to create project locally.');
            return false;
        }

        // Step 2: Check GitHub connection
        if (!this.github.token) {
            const shouldConnect = confirm('Project created! Would you like to connect to GitHub to push this project?');
            if (shouldConnect) {
                this.showGitHubModal();
            }
            return false;
        }

        // Step 3: Create GitHub repo
        this.showToast('Creating GitHub repository...');
        const repo = await this.createGitHubRepo(projectName, repoDescription || projectDescription, false);
        if (!repo) {
            this.showToast('❌ Failed to create GitHub repository. Check your token permissions.');
            return false;
        }

        // Step 4: Push files to GitHub
        this.showToast('Pushing files to GitHub...');
        const deployResult = await this.deployToGitHub();
        if (deployResult && deployResult.failCount > 0) {
            this.showToast(`⚠️ ${deployResult.successCount} files pushed, ${deployResult.failCount} failed.`);
        } else {
            this.showToast(`✅ All files pushed to ${this.github.repo}`);
        }

        // Step 5: Auto-load the repo (optional but nice)
        this.showToast('Loading repository from GitHub...');
        try {
            const [owner, repoName] = this.github.repo.split('/');
            // Clear current files and versions (they already have the same content, but we want to load from GitHub)
            this.files = {};
            this.versions = [];
            await this.fetchGitHubContents(owner, repoName, '');
            this.currentFolder = '';
            this.saveToStorage();
            this.updateFolderSelector();
            this.renderFileTree();
            this.createCheckpoint(`GitHub Import: ${this.github.repo} - ${new Date().toLocaleString()}`);
            const firstHtml = Object.keys(this.files).find(f => f.endsWith('.html'));
            if (firstHtml) this.openFile(firstHtml);
            this.showToast(`✅ Repository loaded! ${Object.keys(this.files).filter(f => this.files[f].type === 'file').length} files ready.`);
        } catch (loadError) {
            console.error('Error loading repo:', loadError);
            this.showToast('⚠️ Repo created but could not auto-load. Click GitHub button to load manually.');
        }

        // Optional chat message
        if (typeof this.addChatMessage === 'function') {
            this.addChatMessage(`✅ **Project Complete!**\n\nCreated "${projectName}" with ${Object.keys(this.files).filter(f => this.files[f].type === 'file').length} files and pushed to GitHub.\n\n🔗 Repository: https://github.com/${this.github.repo}`, 'ai');
        }
        return true;
    },

    initDemoFiles() {
        this.files = {
            'index.html': {
                content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevStudio Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .card {
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            text-align: center;
        }
        h1 { color: #333; margin-bottom: 16px; }
        p { color: #666; line-height: 1.6; margin-bottom: 24px; }
        button {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        button:hover { transform: translateY(-2px); }
        .feature-list { text-align: left; margin: 24px 0; }
        .feature-list li { margin: 8px 0; color: #555; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🚀 Welcome to DevStudio</h1>
        <p>Your local AI-powered code editor with Ollama + Gemma 4 integration</p>
        <div class="feature-list">
            <ul>
                <li>✅ Full file tree with folder support</li>
                <li>✅ Monaco Editor with syntax highlighting</li>
                <li>✅ AI Assistant (Ollama/Gemma 4)</li>
                <li>✅ Version history & checkpoints</li>
                <li>✅ GitHub integration</li>
                <li>✅ Live HTML preview</li>
            </ul>
        </div>
        <button onclick="alert('DevStudio is ready! Ask the AI assistant for help.')">Get Started →</button>
    </div>
</body>
</html>`,
                type: 'file'
            },
            'styles.css': {
                content: `/* Main Styles */
body {
    margin: 0;
    padding: 0;
    font-family: 'Inter', sans-serif;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.btn-primary {
    background: #3b82f6;
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
}

.btn-primary:hover {
    background: #2563eb;
}`,
                type: 'file'
            },
            'app.js': {
                content: `// Main Application Logic
console.log('DevStudio initialized!');

// Example function
function greetUser(name) {
    return \`Hello, \${name}! Welcome to DevStudio.\`;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
});`,
                type: 'file'
            },
            'src/': { content: null, type: 'folder' },
            'src/components/': { content: null, type: 'folder' },
            'src/components/Header.js': {
                content: `// Header Component
export function Header() {
    return '<header><h1>DevStudio</h1></header>';
}`,
                type: 'file'
            }
        };

        this.expandedFolders = new Set(['', 'src/', 'src/components/']);
        this.currentFolder = '';
        this.createCheckpoint();
    },

    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fas fa-info-circle mr-2"></i>${message}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('hidden');
    },

    updateProviderUI() {
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
    },

    handleProviderChange() {
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
    },

    getProjectContext() {
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
                    context += `[File truncated: ${(size / 1024).toFixed(1)}KB, showing first ${(MAX_SIZE / 1024).toFixed(0)}KB]\n`;
                    context += '```\n' + content.substring(0, MAX_SIZE) + '\n```\n\n';
                } else {
                    context += '```\n' + content + '\n```\n\n';
                }
            }
        }

        context += `\nTotal project size: ${(totalSize / 1024).toFixed(1)}KB\n`;
        context += `Total files: ${Object.keys(this.files).filter(f => this.files[f].type === 'file').length}\n`;

        return context;
    },

    applyFileOperations(operations) {
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
                        results.success.push(`✅ ${op.action} ${op.path}`);
                        break;

                    case 'delete':
                        if (this.files[op.path]) {
                            delete this.files[op.path];
                            results.success.push(`✅ delete ${op.path}`);
                        } else {
                            results.failed.push(`❌ delete ${op.path} (file not found)`);
                        }
                        break;

                    default:
                        results.failed.push(`❌ unknown action: ${op.action}`);
                }
            } catch (error) {
                results.failed.push(`❌ ${op.action} ${op.path}: ${error.message}`);
            }
        }

        this.saveToStorage();
        this.updateFolderSelector();
        this.renderFileTree();

        if (this.currentFile && !this.files[this.currentFile]) {
            const remaining = Object.keys(this.files).filter(f => this.files[f].type !== 'folder');
            if (remaining.length > 0) {
                this.openFile(remaining[0]);
            } else {
                this.currentFile = null;
                if (this.useFallbackEditor) {
                    document.getElementById('fallback-editor').value = '';
                } else if (this.editor) {
                    this.editor.setValue('');
                }
                const emptyState = document.getElementById('empty-state');
                if (emptyState) emptyState.style.display = 'flex';
            }
        }

        this.refreshLayout();
        return results;
    }
};
