// ============================================================
// DevStudio – app-ui.js
// Modal controls, Electron features
// ============================================================

app.initElectronFeatures = function () {
    try {
        const { ipcRenderer, dialog } = window.require('electron');
        const fs = window.require('fs');
        const path = window.require('path');

        this.ipcRenderer = ipcRenderer;
        this.fs = fs;
        this.path = path;

        const headerButtons = document.querySelector('.header .flex.items-center.gap-3:last-child');
        if (headerButtons) {
            const openFolderBtn = document.createElement('button');
            openFolderBtn.onclick = () => this.openLocalFolder();
            openFolderBtn.style.cssText = 'padding: 6px 14px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px;';
            openFolderBtn.innerHTML = '<i class="fas fa-folder-open"></i>Open Folder';
            headerButtons.insertBefore(openFolderBtn, headerButtons.firstChild);
        }

        this.checkLocalOllama();

        console.log('Electron features initialized');
    } catch (error) {
        console.error('Failed to initialize Electron features:', error);
    }
};

app.openLocalFolder = async function () {
    if (!this.ipcRenderer) return;

    try {
        const result = await this.ipcRenderer.invoke('open-file-dialog');
        if (!result.canceled && result.filePaths.length > 0) {
            const folderPath = result.filePaths[0];
            await this.loadLocalFolder(folderPath);
        }
    } catch (error) {
        console.error('Error opening folder:', error);
        this.showToast('Error opening folder: ' + error.message);
    }
};

app.loadLocalFolder = async function (folderPath) {
    try {
        this.currentProjectPath = folderPath;
        this.files = {};
        await this.readDirectoryRecursive(folderPath, '');
        this.currentFolder = '';
        this.saveToStorage();
        this.updateFolderSelector();
        this.renderFileTree();

        const firstHtml = Object.keys(this.files).find(f => f.endsWith('.html'));
        if (firstHtml) {
            this.openFile(firstHtml);
        } else if (Object.keys(this.files).length > 0) {
            const firstFile = Object.keys(this.files).find(f => this.files[f].type === 'file');
            if (firstFile) this.openFile(firstFile);
        }

        this.showToast(`Loaded: ${folderPath.split('/').pop() || folderPath}`);
    } catch (error) {
        console.error('Error loading folder:', error);
        this.showToast('Error loading folder: ' + error.message);
    }
};

app.readDirectoryRecursive = async function (basePath, relativePath) {
    const currentPath = this.path.join(basePath, relativePath);

    try {
        const items = this.fs.readdirSync(currentPath);

        for (const item of items) {
            const itemPath = this.path.join(currentPath, item);
            const itemRelativePath = relativePath ? relativePath + '/' + item : item;

            if (item.startsWith('.') ||
                item === 'node_modules' ||
                item === '__pycache__' ||
                item === '.git') {
                continue;
            }

            try {
                const stats = this.fs.statSync(itemPath);

                if (stats.isDirectory()) {
                    this.files[itemRelativePath + '/'] = {
                        content: null,
                        type: 'folder'
                    };
                    await this.readDirectoryRecursive(basePath, itemRelativePath);
                } else if (stats.isFile()) {
                    if (stats.size > 1024 * 1024) {
                        this.files[itemRelativePath] = {
                            content: `[File too large: ${(stats.size / 1024).toFixed(1)}KB]`,
                            type: 'file'
                        };
                        continue;
                    }

                    try {
                        const content = this.fs.readFileSync(itemPath, 'utf8');
                        this.files[itemRelativePath] = {
                            content: content,
                            type: 'file'
                        };
                    } catch (readError) {
                        console.log(`Skipping binary file: ${itemRelativePath}`);
                    }
                }
            } catch (statError) {
                console.log(`Cannot access: ${itemRelativePath}`);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${relativePath}:`, error);
    }
};

app.checkLocalOllama = async function () {
    try {
        const http = window.require('http');

        const checkOllama = () => {
            return new Promise((resolve) => {
                const req = http.get('http://localhost:11434/api/tags', (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.models && json.models.length > 0) {
                                this.localOllamaModels = json.models;

                                const gemma4 = json.models.find(m => m.name.includes('gemma4'));
                                if (gemma4 && this.ai.provider === 'local') {
                                    this.ai.model = gemma4.name;
                                }

                                this.addChatMessage(
                                    `✅ Local Ollama detected!\nAvailable models: ${json.models.map(m => m.name).join(', ')}`,
                                    'system'
                                );
                            }
                        } catch (e) {
                            console.log('Ollama response parse error');
                        }
                        resolve(true);
                    });
                });

                req.on('error', () => {
                    console.log('Ollama not running');
                    resolve(false);
                });

                req.setTimeout(2000, () => {
                    req.destroy();
                    resolve(false);
                });
            });
        };

        const isRunning = await checkOllama();
        if (!isRunning) {
            this.addChatMessage(
                '⚠️ Local Ollama not detected. Please start Ollama for local AI features.\n\n' +
                'Run in terminal: ollama serve\n' +
                'Then pull a model: ollama pull gemma4:latest',
                'system'
            );
        }
    } catch (error) {
        console.log('Error checking Ollama:', error);
    }
};

app.saveCurrentToDisk = function () {
    if (!this.currentProjectPath || !this.currentFile) {
        this.showToast('Open a folder first to save files to disk');
        return;
    }

    if (this.files[this.currentFile] && this.files[this.currentFile].type === 'file') {
        const filePath = this.path.join(this.currentProjectPath, this.currentFile);
        this.saveFileToDisk(filePath, this.files[this.currentFile].content);
    }
};

app.saveFileToDisk = function (filePath, content) {
    if (window.isElectron && this.ipcRenderer) {
        this.ipcRenderer.invoke('save-file', { path: filePath, content: content })
            .then(result => {
                if (result.success) {
                    this.showToast(`Saved: ${filePath.split('/').pop()}`);
                } else {
                    this.showToast(`Error saving: ${result.error}`);
                }
            });
    }
};