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

        // Add "New Project" button to header (replaces Open Folder)
        const headerButtons = document.querySelector('.header .flex.items-center.gap-3:last-child');
        if (headerButtons && !document.getElementById('new-project-btn')) {
            const newProjectBtn = document.createElement('button');
            newProjectBtn.id = 'new-project-btn';
            newProjectBtn.onclick = () => this.showNewProjectDialog();
            newProjectBtn.style.cssText = 'padding: 6px 14px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px;';
            newProjectBtn.innerHTML = '<i class="fas fa-plus-circle"></i>New Project';
            headerButtons.insertBefore(newProjectBtn, headerButtons.firstChild);
        }

        console.log('Electron features initialized');
    } catch (error) {
        console.error('Failed to initialize Electron features:', error);
    }
};

// Show New Project dialog
app.showNewProjectDialog = function () {
    // Create modal if it doesn't exist
    let modal = document.getElementById('new-project-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'new-project-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-box" style="max-width: 500px;">
                <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-plus-circle" style="color: #10b981;"></i>
                    Create New Project
                </h2>
                <div class="mb-4">
                    <label style="font-size: 13px; color: #94a3b8; display: block; margin-bottom: 6px;">
                        <i class="fas fa-tag mr-1"></i> Project Name
                    </label>
                    <input type="text" id="new-project-name" class="input" placeholder="my-awesome-app" autocomplete="off">
                </div>
                <div class="mb-4">
                    <label style="font-size: 13px; color: #94a3b8; display: block; margin-bottom: 6px;">
                        <i class="fas fa-align-left mr-1"></i> Description
                    </label>
                    <textarea id="new-project-desc" class="input" rows="3" placeholder="Describe what you want to build..." style="resize: vertical;"></textarea>
                </div>
                <div class="mb-4">
                    <label style="font-size: 13px; color: #94a3b8; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="new-project-github" style="width: 18px; height: 18px; cursor: pointer;">
                        <i class="fab fa-github"></i> Create GitHub repository and push
                    </label>
                    <p style="font-size: 11px; color: #64748b; margin-top: 6px; margin-left: 26px;">
                        You'll need to connect GitHub first if not already connected
                    </p>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button onclick="app.confirmNewProject()" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-rocket mr-1"></i> Create Project
                    </button>
                    <button onclick="app.closeModal('new-project-modal')" class="btn btn-secondary" style="flex: 1;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Clear previous values
    const nameInput = document.getElementById('new-project-name');
    const descInput = document.getElementById('new-project-desc');
    const githubCheckbox = document.getElementById('new-project-github');
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (githubCheckbox) githubCheckbox.checked = false;

    // Show modal
    modal.classList.remove('hidden');

    // Focus on name input
    setTimeout(() => {
        if (nameInput) nameInput.focus();
    }, 100);
};

// Confirm and create new project
app.confirmNewProject = async function () {
    const projectName = document.getElementById('new-project-name').value.trim();
    const projectDesc = document.getElementById('new-project-desc').value.trim();
    const createGithub = document.getElementById('new-project-github').checked;

    if (!projectName) {
        this.showToast('Please enter a project name');
        return;
    }

    if (!projectDesc) {
        this.showToast('Please describe your project');
        return;
    }

    // Close modal
    this.closeModal('new-project-modal');

    // Show progress in chat
    this.addChatMessage(`🚀 Starting new project: **${projectName}**`, 'system');
    this.addChatMessage(`📝 Description: ${projectDesc}`, 'system');

    if (createGithub && !this.github.token) {
        this.addChatMessage(`⚠️ You need to connect GitHub first. Please click the GitHub button to connect.`, 'ai');
        return;
    }

    if (createGithub && this.github.token) {
        // Create project and push to GitHub
        const result = await this.createAndPushToGitHub(projectDesc, projectName);
        if (result) {
            this.showToast(`✅ Project "${projectName}" created and pushed to GitHub!`);
        } else {
            this.showToast(`❌ Failed to create project`);
        }
    } else {
        // Just create the project locally
        const result = await this.initNewProject(projectDesc, projectName);
        if (result) {
            this.showToast(`✅ Project "${projectName}" created!`);
            this.addChatMessage(`✅ Project "${projectName}" has been created. You can now start coding!`, 'ai');
        } else {
            this.showToast(`❌ Failed to create project`);
        }
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