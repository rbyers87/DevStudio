// ============================================================
// DevStudio – app-editor.js
// Fixed for Electron with nodeIntegration: true
// ============================================================

app.initMonaco = function () {
    return new Promise((resolve) => {
        const editorElement = document.getElementById('monaco-editor');
        const fallbackEditor = document.getElementById('fallback-editor');

        // Check if we should force fallback (set this flag to test)
        if (window.forceFallbackEditor) {
            console.log('Force fallback editor enabled');
            this.setupFallbackEditor(fallbackEditor);
            resolve(false);
            return;
        }

        // For Electron with nodeIntegration, we need a different approach
        if (window.isElectron) {
            console.log('Running in Electron, loading Monaco...');

            // First, check if monaco is already loaded
            if (typeof monaco !== 'undefined' && monaco.editor) {
                console.log('Monaco already loaded globally');
                this.setupMonacoEditor(editorElement, fallbackEditor);
                resolve(true);
                return;
            }

            // Load Monaco using script tag (works better in Electron)
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.js';
            script.onload = () => {
                console.log('Monaco loader script loaded');
                try {
                    require.config({
                        paths: {
                            'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs'
                        }
                    });
                    require(['vs/editor/editor.main'], () => {
                        console.log('Monaco editor loaded');
                        this.setupMonacoEditor(editorElement, fallbackEditor);
                        resolve(true);
                    });
                } catch (err) {
                    console.error('Require config error:', err);
                    this.setupFallbackEditor(fallbackEditor);
                    resolve(false);
                }
            };
            script.onerror = (err) => {
                console.error('Failed to load Monaco loader script:', err);
                this.setupFallbackEditor(fallbackEditor);
                resolve(false);
            };
            document.head.appendChild(script);
        } else {
            // Browser version
            try {
                require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
                require(['vs/editor/editor.main'], () => {
                    this.setupMonacoEditor(editorElement, fallbackEditor);
                    resolve(true);
                });
            } catch (error) {
                console.error('Monaco loader error:', error);
                this.setupFallbackEditor(fallbackEditor);
                resolve(false);
            }
        }

        // Timeout fallback - if Monaco doesn't load within 10 seconds, use fallback
        setTimeout(() => {
            if (!this.monacoLoaded && !this.useFallbackEditor) {
                console.warn('Monaco editor load timeout after 10 seconds');
                this.useFallbackEditor = true;
                this.setupFallbackEditor(fallbackEditor);
                resolve(false);
            }
        }, 10000);
    });
};

app.setupMonacoEditor = function (editorElement, fallbackEditor) {
    try {
        // Ensure the container has dimensions
        if (editorElement && (editorElement.offsetWidth === 0 || editorElement.offsetHeight === 0)) {
            editorElement.style.width = '100%';
            editorElement.style.height = '100%';
        }

        this.editor = monaco.editor.create(editorElement, {
            value: '',
            language: 'javascript',
            theme: this.settings.theme,
            fontSize: this.settings.fontSize,
            wordWrap: this.settings.wordWrap ? 'on' : 'off',
            automaticLayout: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fixedOverflowWidgets: true,
            fontFamily: 'Consolas, "Courier New", monospace',
            lineNumbers: 'on',
            renderWhitespace: 'selection'
        });

        // Force layout after a short delay
        setTimeout(() => {
            if (this.editor) {
                this.editor.layout();
                console.log('Monaco editor layout complete');
            }
        }, 100);

        setTimeout(() => {
            if (this.editor) {
                this.editor.layout();
            }
        }, 500);

        // Handle content changes
        let timeout;
        this.editor.onDidChangeModelContent(() => {
            if (this.currentFile && this.files[this.currentFile]) {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.files[this.currentFile].content = this.editor.getValue();
                    this.saveToStorage();
                    if (this.isPreviewable && this.isPreviewable(this.currentFile)) {
                        if (typeof this.updatePreview === 'function') {
                            this.updatePreview();
                        }
                    }
                }, 800);
            }
        });

        this.monacoLoaded = true;
        if (editorElement) editorElement.style.display = 'block';
        if (fallbackEditor) fallbackEditor.style.display = 'none';
        console.log('Monaco editor setup complete');

    } catch (monacoError) {
        console.error('Monaco editor creation error:', monacoError);
        this.useFallbackEditor = true;
        this.setupFallbackEditor(fallbackEditor);
    }
};

app.setupFallbackEditor = function (fallbackEditor) {
    console.log('Setting up fallback editor');
    const editorElement = document.getElementById('monaco-editor');
    if (editorElement) editorElement.style.display = 'none';

    if (fallbackEditor) {
        fallbackEditor.style.display = 'block';
        fallbackEditor.style.width = '100%';
        fallbackEditor.style.height = '100%';
        fallbackEditor.style.background = '#1e1e1e';
        fallbackEditor.style.color = '#d4d4d4';
        fallbackEditor.style.fontFamily = 'Consolas, monospace';
        fallbackEditor.style.fontSize = '13px';
        fallbackEditor.style.padding = '10px';
        fallbackEditor.style.border = 'none';
        fallbackEditor.style.resize = 'none';

        // Remove existing listeners to avoid duplicates
        fallbackEditor.removeEventListener('input', this._fallbackInputHandler);

        // Create and store the handler
        this._fallbackInputHandler = (e) => {
            if (this.currentFile && this.files[this.currentFile]) {
                this.files[this.currentFile].content = e.target.value;
                this.saveToStorage();
                if (this.isPreviewable && this.isPreviewable(this.currentFile)) {
                    if (typeof this.updatePreview === 'function') {
                        this.updatePreview();
                    }
                }
            }
        };

        fallbackEditor.addEventListener('input', this._fallbackInputHandler);
        this.showToast('Using fallback text editor (Monaco failed to load)', 5000);
    }
    this.useFallbackEditor = true;
};

app.getEditorContent = function () {
    if (this.useFallbackEditor) {
        const fallback = document.getElementById('fallback-editor');
        return fallback ? fallback.value : '';
    }
    return this.editor ? this.editor.getValue() : '';
};

app.setEditorContent = function (content) {
    if (this.useFallbackEditor) {
        const fallback = document.getElementById('fallback-editor');
        if (fallback) fallback.value = content;
    } else if (this.editor) {
        const language = this.currentFile ? this.getLanguage(this.currentFile) : 'javascript';
        const model = monaco.editor.createModel(content, language);
        this.editor.setModel(model);
        setTimeout(() => {
            if (this.editor) this.editor.layout();
        }, 50);
    }
};

app.updateEditorTheme = function () {
    this.settings.theme = document.getElementById('editor-theme').value;
    if (this.editor && !this.useFallbackEditor) {
        monaco.editor.setTheme(this.settings.theme);
    }
    this.saveToStorage();
};

app.getLanguage = function (filename) {
    const ext = filename.split('.').pop();
    const map = {
        'js': 'javascript',
        'ts': 'typescript',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'json': 'json',
        'py': 'python',
        'md': 'markdown',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'xml': 'xml',
        'svg': 'xml',
        'txt': 'plaintext'
    };
    return map[ext] || 'plaintext';
};

// Preview methods
app.isPreviewable = function (filename) {
    return filename.endsWith('.html') || filename.endsWith('.htm');
};

app.updatePreview = function () {
    if (!this.currentFile || !this.isPreviewable(this.currentFile)) return;
    const html = this.files[this.currentFile]?.content || '';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const previewFrame = document.getElementById('preview-frame');
    if (previewFrame) {
        previewFrame.src = url;
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
};