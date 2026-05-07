// ============================================================
// DevStudio – app-editor.js
// FIXED: Proper CDN loading for Electron
// ============================================================

app.initMonaco = function () {
    return new Promise((resolve) => {
        const editorElement = document.getElementById('monaco-editor');
        const fallbackEditor = document.getElementById('fallback-editor');

        // FOR ELECTRON: Use fallback editor (Monaco CDN doesn't work well in Electron)
        if (window.isElectron) {
            console.log('Electron detected - using fallback editor for reliability');
            this.setupFallbackEditor(fallbackEditor);
            resolve(false);
            return;
        }

        // Browser version - use CDN
        try {
            // Use the correct absolute URL for Monaco
            const monacoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs';

            require.config({
                paths: { 'vs': monacoUrl },
                urlArgs: 'v=' + Date.now() // Prevent caching issues
            });

            require(['vs/editor/editor.main'], () => {
                this.setupMonacoEditor(editorElement, fallbackEditor);
                resolve(true);
            });
        } catch (error) {
            console.error('Monaco loader error:', error);
            this.setupFallbackEditor(fallbackEditor);
            resolve(false);
        }

        // Timeout fallback
        setTimeout(() => {
            if (!this.monacoLoaded && !this.useFallbackEditor) {
                console.warn('Monaco editor load timeout');
                this.useFallbackEditor = true;
                this.setupFallbackEditor(fallbackEditor);
                resolve(false);
            }
        }, 5000);
    });
};

app.setupMonacoEditor = function (editorElement, fallbackEditor) {
    try {
        if (editorElement) {
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

        setTimeout(() => { if (this.editor) this.editor.layout(); }, 100);
        setTimeout(() => { if (this.editor) this.editor.layout(); }, 500);

        let timeout;
        this.editor.onDidChangeModelContent(() => {
            if (this.currentFile && this.files[this.currentFile]) {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.files[this.currentFile].content = this.editor.getValue();
                    this.saveToStorage();
                    if (this.isPreviewable && this.isPreviewable(this.currentFile)) {
                        if (typeof this.updatePreview === 'function') this.updatePreview();
                    }
                }, 800);
            }
        });

        this.monacoLoaded = true;
        if (editorElement) editorElement.style.display = 'block';
        if (fallbackEditor) fallbackEditor.style.display = 'none';
        console.log('Monaco editor loaded successfully');

    } catch (monacoError) {
        console.error('Monaco editor creation error:', monacoError);
        this.useFallbackEditor = true;
        this.setupFallbackEditor(fallbackEditor);
    }
};

app.setupFallbackEditor = function (fallbackEditor) {
    console.log('Setting up fallback text editor');
    const editorElement = document.getElementById('monaco-editor');
    if (editorElement) editorElement.style.display = 'none';

    if (fallbackEditor) {
        fallbackEditor.style.display = 'block';
        fallbackEditor.style.width = '100%';
        fallbackEditor.style.height = '100%';
        fallbackEditor.style.background = '#1e1e1e';
        fallbackEditor.style.color = '#d4d4d4';
        fallbackEditor.style.fontFamily = 'Consolas, "Courier New", monospace';
        fallbackEditor.style.fontSize = '13px';
        fallbackEditor.style.padding = '10px';
        fallbackEditor.style.border = 'none';
        fallbackEditor.style.resize = 'none';
        fallbackEditor.style.outline = 'none';

        // Clear existing content
        if (this.currentFile && this.files[this.currentFile]) {
            fallbackEditor.value = this.files[this.currentFile].content || '';
        }

        // Remove existing listener to avoid duplicates
        if (this._fallbackHandler) {
            fallbackEditor.removeEventListener('input', this._fallbackHandler);
        }

        this._fallbackHandler = (e) => {
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

        fallbackEditor.addEventListener('input', this._fallbackHandler);
        this.showToast('Using text editor (Monaco not available in desktop app)', 3000);
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
        setTimeout(() => { if (this.editor) this.editor.layout(); }, 50);
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