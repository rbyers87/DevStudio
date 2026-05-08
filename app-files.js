// ============================================================
// DevStudio – app-files.js
// File tree, tabs, folder management
// ============================================================

app.updateFolderSelector = function () {
    const select = document.getElementById('folder-select');
    if (!select) return;

    select.innerHTML = '<option value="">📁 Root</option>';

    const folders = new Set();

    Object.keys(this.files).forEach(path => {
        if (this.files[path].type === 'folder') {
            folders.add(path);
        }

        if (path.includes('/')) {
            const parts = path.split('/');
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                if (parts[i]) {
                    currentPath = currentPath ? currentPath + parts[i] + '/' : parts[i] + '/';
                    folders.add(currentPath);
                }
            }
        }
    });

    folders.delete('');
    folders.delete('/');

    const sortedFolders = Array.from(folders).sort((a, b) => {
        const depthA = a.split('/').filter(p => p).length;
        const depthB = b.split('/').filter(p => p).length;
        if (depthA !== depthB) return depthA - depthB;
        return a.localeCompare(b);
    });

    sortedFolders.forEach(folder => {
        const depth = folder.split('/').filter(p => p).length;
        const indent = '  '.repeat(depth);
        const folderName = folder.split('/').filter(p => p).pop() || folder;
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = `${indent}📁 ${folderName}/`;
        if (this.currentFolder === folder) option.selected = true;
        select.appendChild(option);
    });
};

app.changeFolder = function (folder) {
    this.currentFolder = folder;
    this.saveToStorage();
    this.renderFileTree();
    this.refreshLayout();
};

app.refreshFileTree = function () {
    this.renderFileTree();
    this.updateFolderSelector();
    this.refreshLayout();
};

app.renderFileTree = function () {
    const container = document.getElementById('file-tree');
    if (!container) return;
    container.innerHTML = '';

    const items = [];

    Object.keys(this.files).forEach(path => {
        const fileData = this.files[path];
        if (fileData.type === 'folder') {
            if (this.currentFolder === '') {
                if (!path.slice(0, -1).includes('/')) {
                    items.push({ path, type: 'folder', data: fileData });
                }
            } else {
                if (path.startsWith(this.currentFolder) && path !== this.currentFolder) {
                    const remaining = path.slice(this.currentFolder.length);
                    if (remaining && !remaining.slice(0, -1).includes('/')) {
                        items.push({ path, type: 'folder', data: fileData });
                    }
                }
            }
        } else {
            if (this.currentFolder === '') {
                if (!path.includes('/')) {
                    items.push({ path, type: 'file', data: fileData });
                }
            } else {
                if (path.startsWith(this.currentFolder)) {
                    const remaining = path.slice(this.currentFolder.length);
                    if (remaining && !remaining.includes('/')) {
                        items.push({ path, type: 'file', data: fileData });
                    }
                }
            }
        }
    });

    items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.path.localeCompare(b.path);
    });

    if (this.currentFolder !== '') {
        const parentDiv = document.createElement('div');
        parentDiv.className = 'tree-item';
        parentDiv.style.opacity = '0.7';
        parentDiv.innerHTML = `<span class="chevron" style="visibility: hidden;"></span><i class="fas fa-level-up-alt icon" style="color: #94a3b8;"></i><span class="name">.. (parent directory)</span>`;
        parentDiv.onclick = () => {
            const parentPath = this.currentFolder.split('/').filter(Boolean).slice(0, -1).join('/');
            this.changeFolder(parentPath ? parentPath + '/' : '');
        };
        container.appendChild(parentDiv);
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `tree-item ${this.currentFile === item.path ? 'active' : ''}`;

        const isFolder = item.type === 'folder';
        const name = isFolder
            ? item.path.replace(/\/$/, '').split('/').pop()
            : item.path.split('/').pop();

        const fileExt = !isFolder ? name.split('.').pop() : '';
        let iconClass = 'fa-file-code';
        let iconColor = '#94a3b8';

        if (isFolder) {
            iconClass = 'fa-folder';
            iconColor = '#eab308';
        } else if (fileExt === 'html') {
            iconClass = 'fa-html5';
            iconColor = '#fb923c';
        } else if (fileExt === 'css') {
            iconClass = 'fa-css3';
            iconColor = '#60a5fa';
        } else if (fileExt === 'js') {
            iconClass = 'fa-js';
            iconColor = '#facc15';
        } else if (fileExt === 'json') {
            iconClass = 'fa-code';
            iconColor = '#a78bfa';
        } else if (fileExt === 'md') {
            iconClass = 'fa-markdown';
            iconColor = '#64748b';
        }

        div.innerHTML = `<span class="chevron" style="visibility: ${isFolder ? 'visible' : 'hidden'};"></span>
                       <i class="fas ${iconClass} icon" style="color: ${iconColor};"></i>
                       <span class="name">${name}</span>`;

        if (isFolder) {
            div.onclick = (e) => {
                e.stopPropagation();
                this.changeFolder(item.path);
            };
        } else {
            div.onclick = () => this.openFile(item.path);
        }

        container.appendChild(div);
    });

    if (items.length === 0 && this.currentFolder !== '') {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-xs text-slate-500 text-center p-4';
        emptyDiv.innerHTML = '<i class="fas fa-folder-open"></i> Empty folder';
        container.appendChild(emptyDiv);
    }

    this.refreshLayout();
};

app.renderTabs = function () {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    container.innerHTML = '';

    const openFiles = Object.keys(this.files).filter(f => this.files[f].type !== 'folder');

    openFiles.forEach(filename => {
        const tab = document.createElement('div');
        tab.className = `tab ${this.currentFile === filename ? 'active' : ''}`;

        const ext = filename.split('.').pop();
        let icon = 'fa-file-code';
        if (ext === 'html') icon = 'fa-html5';
        else if (ext === 'css') icon = 'fa-css3';
        else if (ext === 'js') icon = 'fa-js';

        const showPreview = this.isPreviewable(filename);
        const displayName = filename.split('/').pop();

        tab.innerHTML = `
            <i class="fab ${icon}" style="font-size: 12px;"></i>
            <span class="truncate" style="max-width: 120px;" title="${filename}">${displayName}</span>
            ${showPreview ? `<button class="preview-btn" onclick="event.stopPropagation(); app.previewFile('${filename}')" title="Preview HTML"><i class="fas fa-eye"></i></button>` : ''}
            <button onclick="event.stopPropagation(); app.closeFile('${filename}')" style="margin-left: 6px; background: transparent; border: none; cursor: pointer; color: inherit; opacity: 0.6;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"><i class="fas fa-times" style="font-size: 11px;"></i></button>
        `;

        tab.onclick = () => this.openFile(filename);
        container.appendChild(tab);
    });

    this.refreshLayout();
};

// FIX: Updated openFile with layout refresh
app.openFile = function (filename) {
    if (this.files[filename]?.type === 'folder') return;

    this.currentFile = filename;
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';

    const content = this.files[filename]?.content || '';
    const language = this.getLanguage(filename);

    if (this.useFallbackEditor) {
        const fallbackEditor = document.getElementById('fallback-editor');
        if (fallbackEditor) fallbackEditor.value = content;
    } else if (this.editor) {
        try {
            const model = monaco.editor.createModel(content, language);
            this.editor.setModel(model);
            setTimeout(() => {
                if (this.editor) this.editor.layout();
            }, 50);
        } catch (e) {
            console.error('Monaco error:', e);
            // Fallback to textarea if Monaco fails
            const fallbackEditor = document.getElementById('fallback-editor');
            if (fallbackEditor) {
                fallbackEditor.value = content;
                this.useFallbackEditor = true;
            }
        }
    }

    this.renderTabs();
    this.renderFileTree();
    if (this.isPreviewable(filename)) {
        this.updatePreview();
    }

    // FIX: Refresh layout to ensure chat stays visible
    setTimeout(() => {
        if (typeof this.refreshLayout === 'function') {
            this.refreshLayout();
        }
    }, 100);
};

app.closeFile = function (filename) {
    if (confirm(`Close ${filename.split('/').pop()}? Changes are auto-saved.`)) {
        delete this.files[filename];
        if (this.currentFile === filename) {
            const remaining = Object.keys(this.files).filter(f => this.files[f].type !== 'folder');
            this.currentFile = remaining[0] || null;
            if (this.currentFile) {
                this.openFile(this.currentFile);
            } else {
                if (this.useFallbackEditor) {
                    document.getElementById('fallback-editor').value = '';
                } else if (this.editor) {
                    this.editor.setValue('');
                }
                const emptyState = document.getElementById('empty-state');
                if (emptyState) emptyState.style.display = 'flex';
            }
        }
        this.saveToStorage();
        this.renderTabs();
        this.renderFileTree();
        this.updateFolderSelector();
        this.showToast(`Closed ${filename.split('/').pop()}`);
        this.refreshLayout();
    }
};

app.createFile = function () {
    const modal = document.getElementById('new-file-modal');
    if (modal) modal.classList.remove('hidden');
    const pathInput = document.getElementById('new-file-path');
    if (pathInput) pathInput.value = this.currentFolder;
    const nameInput = document.getElementById('new-file-name');
    if (nameInput) nameInput.focus();
};

app.confirmCreateFile = function () {
    const path = document.getElementById('new-file-path').value.trim();
    const name = document.getElementById('new-file-name').value.trim();
    if (!name) return;

    const fullPath = path ? (path.endsWith('/') ? path + name : path + '/' + name) : name;

    if (this.files[fullPath]) {
        this.showToast('File already exists!');
        return;
    }

    if (path) {
        const parts = path.split('/').filter(p => p);
        let currentPath = '';
        for (const part of parts) {
            currentPath = currentPath ? currentPath + part + '/' : part + '/';
            if (!this.files[currentPath]) {
                this.files[currentPath] = { content: null, type: 'folder' };
            }
            this.expandedFolders.add(currentPath);
        }
    }

    this.files[fullPath] = { content: '', type: 'file' };
    this.saveToStorage();
    this.updateFolderSelector();
    this.renderFileTree();
    this.openFile(fullPath);
    this.closeModal('new-file-modal');
    if (path) document.getElementById('new-file-path').value = '';
    if (name) document.getElementById('new-file-name').value = '';
    this.showToast(`Created ${fullPath}`);
    this.refreshLayout();
};

app.createFolder = function () {
    const name = prompt('Enter folder name (can include nested paths like "src/components"):');
    if (!name) return;

    const prefix = this.currentFolder;
    const fullPath = prefix + name + '/';

    if (this.files[fullPath]) {
        this.showToast('Folder already exists!');
        return;
    }

    const parts = name.split('/').filter(p => p);
    let currentPath = prefix;
    for (const part of parts) {
        currentPath = currentPath ? currentPath + part + '/' : part + '/';
        if (!this.files[currentPath]) {
            this.files[currentPath] = { content: null, type: 'folder' };
        }
        this.expandedFolders.add(currentPath);
    }

    this.saveToStorage();
    this.updateFolderSelector();
    this.renderFileTree();
    this.showToast(`Created folder ${name}`);
    this.refreshLayout();
};

app.isPreviewable = function (filename) {
    return filename.endsWith('.html') || filename.endsWith('.htm');
};

app.previewFile = function (filename) {
    this.currentFile = filename;
    this.openFile(filename);
    this.updatePreview();
    this.showToast(`Previewing ${filename.split('/').pop()}`);
    this.refreshLayout();
};

app.updatePreview = function () {
    if (!this.currentFile || !this.isPreviewable(this.currentFile)) return;
    const html = this.files[this.currentFile]?.content || '';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const previewFrame = document.getElementById('preview-frame');
    if (previewFrame) previewFrame.src = url;
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

app.refreshPreview = function () {
    this.updatePreview();
    this.showToast('Preview refreshed');
    this.refreshLayout();
};

app.openPreviewInNewTab = function () {
    if (this.currentFile && this.isPreviewable(this.currentFile)) {
        const blob = new Blob([this.files[this.currentFile].content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
        this.showToast('Open an HTML file first to preview');
    }
};

// Find this in app-files.js (around line 200-220)
app.createCheckpoint = function (customMessage = null) {
    const checkpoint = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        message: customMessage || `Checkpoint ${this.versions.length + 1}`,
        files: JSON.parse(JSON.stringify(this.files))
    };

    this.versions.unshift(checkpoint);

    if (this.versions.length > 30) {
        this.versions.pop();
    }

    this.saveToStorage();
    this.renderVersions();
    this.showToast(customMessage || 'Checkpoint saved!');
    this.refreshLayout();
};

app.restoreVersion = function (id) {
    const version = this.versions.find(v => v.id === id);
    if (version && confirm('Restore this version? Current state will be saved as a new checkpoint first.')) {
        this.createCheckpoint();
        this.files = JSON.parse(JSON.stringify(version.files));
        this.saveToStorage();
        this.updateFolderSelector();
        this.renderFileTree();
        if (this.currentFile && this.files[this.currentFile]) {
            this.openFile(this.currentFile);
        }
        this.showToast('Version restored!');
        this.refreshLayout();
    }
};

app.renderVersions = function () {
    const container = document.getElementById('version-list');
    if (!container) return;
    container.innerHTML = '';

    if (this.versions.length === 0) {
        container.innerHTML = '<div class="text-xs text-slate-500 text-center p-4">No checkpoints yet.<br>Click "Save Point" to create one.</div>';
        return;
    }

    this.versions.forEach((version, index) => {
        const div = document.createElement('div');
        div.className = 'version-item';
        div.onclick = () => this.restoreVersion(version.id);

        div.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center;">
                <div class="version-dot ${index === 0 ? 'active' : ''}"></div>
                ${index < this.versions.length - 1 ? '<div class="version-line"></div>' : '<div style="height: 20px;"></div>'}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div class="truncate" style="font-size: 12px; font-weight: 600; color: #e2e8f0;">${version.message}</div>
                <div style="font-size: 10px; color: #64748b;">${new Date(version.timestamp).toLocaleString()}</div>
            </div>
        `;

        container.appendChild(div);
    });
};

app.exportProject = function () {
    let content = '# DevStudio Project Export\n\n';

    for (const [name, data] of Object.entries(this.files)) {
        if (data.type === 'file') {
            content += `## File: ${name}\n\n`;
            content += '```\n';
            content += data.content;
            content += '\n```\n\n';
        }
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devstudio-export-${new Date().toISOString().slice(0, 19)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Project exported!');
};

app.clearAllData = function () {
    if (confirm('⚠️ WARNING: This will delete ALL files, versions, and settings. This action cannot be undone. Are you sure?')) {
        localStorage.removeItem('devstudio_data');
        this.showToast('Data cleared. Reloading...');
        setTimeout(() => location.reload(), 1500);
    }
};