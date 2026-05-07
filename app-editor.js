// ============================================================
// DevStudio – app-editor.js
// Monaco editor integration and fallback
// ============================================================

// Editor initialization merged into app object
app.initMonaco = function () {
    return new Promise((resolve) => {
        const editorElement = document.getElementById('monaco-editor');
        const fallbackEditor = document.getElementById('fallback-editor');

        try {
            require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
            require(['vs/editor/editor.main'], () => {
                try {
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

                    setTimeout(() => { if (this.editor) this.editor.layout(); }, 100);
                    setTimeout(() => { if (this.editor) this.editor.layout(); }, 500);

                    let timeout;
                    this.editor.onDidChangeModelContent(() => {
                        if (this.currentFile && this.files[this.currentFile]) {
                            clearTimeout(timeout);
                            timeout = setTimeout(() => {
                                this.files[this.currentFile].content = this.editor.getValue();
                                this.saveToStorage();
                                if (this.isPreviewable(this.currentFile)) {
                                    this.updatePreview();
                                }
                            }, 800);
                        }
                    });

                    this.monacoLoaded = true;
                    if (editorElement) editorElement.style.display = 'block';
                    if (fallbackEditor) fallbackEditor.style.display = 'none';
                    console.log('Monaco editor loaded successfully');
                    resolve(true);
                } catch (monacoError) {
                    console.error('Monaco editor creation error:', monacoError);
                    this.useFallbackEditor = true;
                    this.setupFallbackEditor(fallbackEditor);
                    resolve(false);
                }
            });
        } catch (requireError) {
            console.error('Monaco loader error:', requireError);
            this.useFallbackEditor = true;
            this.setupFallbackEditor(fallbackEditor);
            resolve(false);
        }

        setTimeout(() => {
            if (!this.monacoLoaded && !this.useFallbackEditor) {
                console.warn('Monaco editor load timeout, using fallback');
                this.useFallbackEditor = true;
                this.setupFallbackEditor(fallbackEditor);
                resolve(false);
            }
        }, 5000);
    });
};

app.setupFallbackEditor = function (fallbackEditor) {
    const editorElement = document.getElementById('monaco-editor');
    if (editorElement) editorElement.style.display = 'none';
    if (fallbackEditor) fallbackEditor.style.display = 'block';

    fallbackEditor.addEventListener('input', (e) => {
        if (this.currentFile && this.files[this.currentFile]) {
            this.files[this.currentFile].content = e.target.value;
            this.saveToStorage();
            if (this.isPreviewable(this.currentFile)) {
                this.updatePreview();
            }
        }
    });

    this.showToast('Using fallback text editor (Monaco failed to load)', 5000);
};

app.getEditorContent = function () {
    if (this.useFallbackEditor) {
        return document.getElementById('fallback-editor').value;
    }
    return this.editor ? this.editor.getValue() : '';
};

app.setEditorContent = function (content) {
    if (this.useFallbackEditor) {
        document.getElementById('fallback-editor').value = content;
    } else if (this.editor) {
        const language = this.currentFile ? this.getLanguage(this.currentFile) : 'javascript';
        const model = monaco.editor.createModel(content, language);
        this.editor.setModel(model);
        setTimeout(() => { if (this.editor) this.editor.layout(); }, 50);
    }
};

app.updateEditorTheme = function () {
    this.settings.theme = document.getElementById('editor-theme').value;
    if (this.editor) {
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