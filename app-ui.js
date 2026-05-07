// ============================================================
// DevStudio – app-ui.js
// FIXED: Proper Electron module detection
// ============================================================

app.initElectronFeatures = function () {
    try {
        // Check if we're in Electron and have access to modules
        if (!window.isElectron) {
            console.log('Not in Electron, skipping Electron features');
            return;
        }

        // Try to require Electron modules safely
        let electronRequire;
        try {
            // In Electron renderer with nodeIntegration:true
            electronRequire = require;
        } catch (e) {
            console.log('require not available');
            return;
        }

        // Safely try to get Electron modules
        let ipcRenderer, dialog, fs, path;

        try {
            const electron = electronRequire('electron');
            ipcRenderer = electron.ipcRenderer;
            dialog = electron.dialog;
        } catch (e) {
            console.log('Electron module not available:', e.message);
        }

        try {
            fs = electronRequire('fs');
        } catch (e) {
            console.log('fs module not available');
        }

        try {
            path = electronRequire('path');
        } catch (e) {
            console.log('path module not available');
        }

        if (ipcRenderer) {
            this.ipcRenderer = ipcRenderer;
            console.log('IPC Renderer available');
        }

        if (fs) this.fs = fs;
        if (path) this.path = path;

        // Add "Open Folder" button to header
        const headerButtons = document.querySelector('.header .flex.items-center.gap-3:last-child');
        if (headerButtons && !document.getElementById('open-folder-btn')) {
            const openFolderBtn = document.createElement('button');
            openFolderBtn.id = 'open-folder-btn';
            openFolderBtn.onclick = () => this.openLocalFolder();
            openFolderBtn.style.cssText = 'padding: 6px 14px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px;';
            openFolderBtn.innerHTML = '<i class="fas fa-folder-open"></i>Open Folder';
            headerButtons.insertBefore(openFolderBtn, headerButtons.firstChild);
        }

        console.log('Electron features initialized');
    } catch (error) {
        console.error('Failed to initialize Electron features:', error);
    }
};

app.openLocalFolder = async function () {
    if (!this.ipcRenderer) {
        this.showToast('Folder opening only available in desktop app');
        return;
    }

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
    if (!this.fs || !this.path) {
        this.showToast('File system access not available');
        return;
    }

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

        this.showToast(`Loaded: ${folderPath.split(/[\\/]/).pop() || folderPath}`);
    } catch (error) {
        console.error('Error loading folder:', error);
        this.showToast('Error loading folder: ' + error.message);
    }
};

app.readDirectoryRecursive = async function (basePath, relativePath) {
    if (!this.fs || !this.path) return;

    const currentPath = this.path.join(basePath, relativePath);

    try {
        const items = this.fs.readdirSync(currentPath);

        for (const item of items) {
            const itemPath = this.path.join(currentPath, item);
            const itemRelativePath = relativePath ? relativePath + '/' + item : item;

            if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__' || item === '.git') {
                continue;
            }

            try {
                const stats = this.fs.statSync(itemPath);

                if (stats.isDirectory()) {
                    this.files[itemRelativePath + '/'] = { content: null, type: 'folder' };
                    await this.readDirectoryRecursive(basePath, itemRelativePath);
                } else if (stats.isFile()) {
                    if (stats.size > 1024 * 1024) {
                        this.files[itemRelativePath] = { content: `[File too large: ${(stats.size / 1024).toFixed(1)}KB]`, type: 'file' };
                        continue;
                    }

                    try {
                        const content = this.fs.readFileSync(itemPath, 'utf8');
                        this.files[itemRelativePath] = { content: content, type: 'file' };
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
    // This is handled in app-ai.js, just a placeholder
    console.log('Checking local Ollama...');
};

app.saveCurrentToDisk = function () {
    if (!this.currentProjectPath || !this.currentFile || !this.fs || !this.path) {
        this.showToast('Open a folder first to save files to disk');
        return;
    }

    if (this.files[this.currentFile] && this.files[this.currentFile].type === 'file') {
        const filePath = this.path.join(this.currentProjectPath, this.currentFile);
        this.saveFileToDisk(filePath, this.files[this.currentFile].content);
    }
};

app.saveFileToDisk = function (filePath, content) {
    if (this.ipcRenderer) {
        this.ipcRenderer.invoke('save-file', { path: filePath, content: content })
            .then(result => {
                if (result.success) {
                    this.showToast(`Saved: ${filePath.split(/[\\/]/).pop()}`);
                } else {
                    this.showToast(`Error saving: ${result.error}`);
                }
            });
    }
};