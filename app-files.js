// ============================================================
// DevStudio – app-files.js
// File tree, tabs, folder management, and SEARCH
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
        div.dataset.path = item.path;

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
                       <span class="name">${this.escapeHtml(name)}</span>`;

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

    // Re-apply search filter if there is an active search
    const searchInput = document.getElementById('file-search-input');
    if (searchInput && searchInput.value.trim()) {
        this.filterFileTree(searchInput.value);
    }

    this.refreshLayout();
};

app.escapeHtml = function (text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

app.createCheckpoint = function () {
    const checkpoint = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        message: `Checkpoint ${this.versions.length + 1}`,
        files: JSON.parse(JSON.stringify(this.files))
    };

    this.versions.unshift(checkpoint);

    if (this.versions.length > 30) {
        this.versions.pop();
    }

    this.saveToStorage();
    this.renderVersions();
    this.showToast('Checkpoint saved!');
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

// ============================================================
// FILE EXPLORER SEARCH
// ============================================================

app.filterFileTree = function (searchTerm) {
    const clearBtn = document.getElementById('clear-search-btn');
    const term = searchTerm.trim().toLowerCase();

    if (term === '') {
        if (clearBtn) clearBtn.style.display = 'none';
        this.clearFileSearch();
        return;
    }

    if (clearBtn) clearBtn.style.display = 'block';
    this.currentFileSearchTerm = term;

    const allItems = document.querySelectorAll('.tree-item');
    let matchCount = 0;

    allItems.forEach(item => {
        const fileName = item.querySelector('.name')?.textContent || '';
        const filePath = item.dataset.path || '';
        const matches = fileName.toLowerCase().includes(term) || filePath.toLowerCase().includes(term);

        if (matches) {
            matchCount++;
            item.style.display = 'flex';
            item.classList.add('search-highlight');
            if (matchCount === 1) {
                setTimeout(() => item.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
        } else {
            item.style.display = 'none';
            item.classList.remove('search-highlight');
        }
    });

    this.showSearchStats(matchCount, allItems.length);
};

app.clearFileSearch = function () {
    const searchInput = document.getElementById('file-search-input');
    const clearBtn = document.getElementById('clear-search-btn');

    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    const allItems = document.querySelectorAll('.tree-item');
    allItems.forEach(item => {
        item.style.display = 'flex';
        item.classList.remove('search-highlight');
    });

    const statsDiv = document.getElementById('file-search-stats');
    if (statsDiv) statsDiv.remove();

    this.currentFileSearchTerm = '';
};

app.showSearchStats = function (matches, total) {
    const oldStats = document.getElementById('file-search-stats');
    if (oldStats) oldStats.remove();

    const searchSection = document.querySelector('.search-section');
    if (searchSection && matches > 0) {
        const statsDiv = document.createElement('div');
        statsDiv.id = 'file-search-stats';
        statsDiv.className = 'search-info';
        statsDiv.innerHTML = `<i class="fas fa-list mr-1"></i>Found ${matches} of ${total} files matching "${this.currentFileSearchTerm}"`;
        searchSection.appendChild(statsDiv);
    }
};

// ============================================================
// EDITOR SEARCH (Find/Replace) - IMPROVED VERSION
// ============================================================

// Debounce timer for search
app.searchDebounceTimer = null;
app.lastSearchTerm = '';

app.handleSearchKeydown = function (e) {
    // Stop propagation to prevent editor from receiving these keys
    e.stopPropagation();

    // Handle Enter key - find next
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            this.findPrevious();
        } else {
            this.findNext();
        }
    }

    // Handle Escape - close search
    if (e.key === 'Escape') {
        e.preventDefault();
        this.closeEditorSearch();
    }

    // Handle arrow keys while in search box - don't let them affect editor
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
    }
};

app.handleSearchKeyup = function (e) {
    // Stop propagation to prevent editor from receiving these keys
    e.stopPropagation();

    // Clear previous debounce timer
    if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
    }

    const searchTerm = document.getElementById('editor-search-input')?.value || '';

    // Don't search if the term hasn't changed
    if (searchTerm === this.lastSearchTerm) {
        return;
    }

    this.lastSearchTerm = searchTerm;

    // Only search after user stops typing (500ms delay for smoother experience)
    this.searchDebounceTimer = setTimeout(() => {
        this.performEditorSearch(true); // Reset to first match on new search
    }, 500);
};

app.openEditorSearch = function () {
    const searchBar = document.getElementById('editor-search-bar');
    if (!searchBar) return;

    searchBar.style.display = 'flex';
    const searchInput = document.getElementById('editor-search-input');
    if (searchInput) {
        searchInput.focus();
        searchInput.select();

        // Store current selection to use as search term
        if (!this.useFallbackEditor && this.editor) {
            const selection = this.editor.getSelection();
            const selectedText = this.editor.getModel().getValueInRange(selection);
            if (selectedText && selectedText.trim()) {
                searchInput.value = selectedText;
                this.lastSearchTerm = selectedText;
                this.performEditorSearch(true);
            }
        }
    }
};

app.closeEditorSearch = function () {
    const searchBar = document.getElementById('editor-search-bar');
    if (searchBar) searchBar.style.display = 'none';

    // Clear any pending search
    if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
    }

    // Clear search highlights
    if (!this.useFallbackEditor && this.editor) {
        this.editor.getModel().findMatches('', false, false, false, null, true);
        // Return focus to editor
        setTimeout(() => {
            if (this.editor) this.editor.focus();
        }, 100);
    } else {
        const textarea = document.getElementById('fallback-editor');
        if (textarea) textarea.focus();
    }

    // Reset search state
    this.lastSearchTerm = '';
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    document.getElementById('search-stats').innerHTML = '';
};

app.performEditorSearch = function (resetToFirst = false) {
    if (this.useFallbackEditor) {
        this.performFallbackEditorSearch(resetToFirst);
        return;
    }

    if (!this.editor) return;

    const searchTerm = document.getElementById('editor-search-input')?.value || '';
    const isCaseSensitive = false;
    const isRegex = false;

    if (!searchTerm) {
        this.editor.getModel().findMatches('', false, false, false, null, true);
        document.getElementById('search-stats').innerHTML = '';
        this.searchMatches = [];
        this.currentMatchIndex = -1;
        return;
    }

    try {
        // Find all matches
        const matches = this.editor.getModel().findMatches(searchTerm, false, isRegex, isCaseSensitive, null, true);

        const statsDiv = document.getElementById('search-stats');
        if (statsDiv && matches.length > 0) {
            statsDiv.innerHTML = `${matches.length} match${matches.length !== 1 ? 'es' : ''}`;
        } else if (statsDiv) {
            statsDiv.innerHTML = 'No matches';
        }

        if (matches.length > 0) {
            this.searchMatches = matches;

            // Reset to first match or keep current position
            if (resetToFirst || this.currentMatchIndex === -1 || this.currentMatchIndex >= matches.length) {
                this.currentMatchIndex = 0;
            } else if (this.currentMatchIndex >= matches.length) {
                this.currentMatchIndex = 0;
            }

            // Ensure currentMatchIndex is valid
            if (this.currentMatchIndex >= 0 && this.currentMatchIndex < matches.length) {
                this.editor.setSelection(matches[this.currentMatchIndex].range);
                this.editor.revealRangeInCenter(matches[this.currentMatchIndex].range);
                this.updateSearchStats();
            }
        } else {
            this.searchMatches = [];
            this.currentMatchIndex = -1;
        }
    } catch (error) {
        console.error('Search error:', error);
    }
};

app.findNext = function () {
    if (this.useFallbackEditor) {
        this.findNextFallback();
        return;
    }

    if (!this.editor) return;

    const searchTerm = document.getElementById('editor-search-input')?.value || '';

    // If no search term, do nothing
    if (!searchTerm) {
        return;
    }

    // If we have no matches or search term changed, perform new search
    if (!this.searchMatches || this.searchMatches.length === 0 || this.lastSearchTerm !== searchTerm) {
        this.lastSearchTerm = searchTerm;
        this.performEditorSearch(true);
        return;
    }

    if (this.searchMatches.length === 0) {
        return;
    }

    // Move to next match
    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.searchMatches.length;
    const match = this.searchMatches[this.currentMatchIndex];

    if (match) {
        this.editor.setSelection(match.range);
        this.editor.revealRangeInCenter(match.range);
        this.updateSearchStats();

        // Highlight the match briefly
        this.editor.focus();
    }
};

app.findPrevious = function () {
    if (this.useFallbackEditor) {
        this.findPreviousFallback();
        return;
    }

    if (!this.editor) return;

    const searchTerm = document.getElementById('editor-search-input')?.value || '';

    // If no search term, do nothing
    if (!searchTerm) {
        return;
    }

    // If we have no matches or search term changed, perform new search
    if (!this.searchMatches || this.searchMatches.length === 0 || this.lastSearchTerm !== searchTerm) {
        this.lastSearchTerm = searchTerm;
        this.performEditorSearch(true);
        return;
    }

    if (this.searchMatches.length === 0) {
        return;
    }

    // Move to previous match
    this.currentMatchIndex = (this.currentMatchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    const match = this.searchMatches[this.currentMatchIndex];

    if (match) {
        this.editor.setSelection(match.range);
        this.editor.revealRangeInCenter(match.range);
        this.updateSearchStats();

        // Highlight the match briefly
        this.editor.focus();
    }
};

app.updateSearchStats = function () {
    const statsDiv = document.getElementById('search-stats');
    if (statsDiv && this.searchMatches && this.searchMatches.length > 0 && this.currentMatchIndex >= 0) {
        statsDiv.innerHTML = `${this.currentMatchIndex + 1} of ${this.searchMatches.length} matches`;
    } else if (statsDiv && this.searchMatches && this.searchMatches.length > 0) {
        statsDiv.innerHTML = `${this.searchMatches.length} match${this.searchMatches.length !== 1 ? 'es' : ''}`;
    }
};

// Fallback for textarea editor (improved)
app.performFallbackEditorSearch = function (resetToFirst = false) {
    const textarea = document.getElementById('fallback-editor');
    const searchTerm = document.getElementById('editor-search-input')?.value || '';

    if (!textarea || !searchTerm) {
        if (textarea) {
            // Clear selection
            textarea.setSelectionRange(0, 0);
        }
        document.getElementById('search-stats').innerHTML = '';
        return;
    }

    const content = textarea.value;
    const matches = this.findStringIndices(content, searchTerm);

    const statsDiv = document.getElementById('search-stats');
    if (statsDiv) {
        statsDiv.innerHTML = `${matches.length} match${matches.length !== 1 ? 'es' : ''}`;
    }

    this.fallbackMatches = matches;

    if (matches.length > 0) {
        if (resetToFirst || this.currentFallbackMatch === undefined || this.currentFallbackMatch < 0) {
            this.currentFallbackMatch = 0;
        } else if (this.currentFallbackMatch >= matches.length) {
            this.currentFallbackMatch = 0;
        }

        this.highlightFallbackMatch(this.currentFallbackMatch);
    } else {
        this.currentFallbackMatch = -1;
        textarea.setSelectionRange(0, 0);
    }
};

app.highlightFallbackMatch = function (matchIndex) {
    const textarea = document.getElementById('fallback-editor');
    if (!textarea || !this.fallbackMatches || this.fallbackMatches.length === 0) return;

    if (matchIndex < 0 || matchIndex >= this.fallbackMatches.length) {
        matchIndex = 0;
    }

    const start = this.fallbackMatches[matchIndex];
    const end = start + (document.getElementById('editor-search-input')?.value?.length || 0);

    textarea.focus();
    textarea.setSelectionRange(start, end);

    // Scroll to make the selection visible
    const lineHeight = 20; // Approximate
    const lines = textarea.value.substring(0, start).split('\n').length;
    const scrollPosition = (lines - 5) * lineHeight;
    textarea.scrollTop = Math.max(0, scrollPosition);

    this.updateSearchStats();
};

app.findNextFallback = function () {
    if (!this.fallbackMatches || this.fallbackMatches.length === 0) {
        this.performFallbackEditorSearch(true);
        return;
    }

    this.currentFallbackMatch = (this.currentFallbackMatch + 1) % this.fallbackMatches.length;
    this.highlightFallbackMatch(this.currentFallbackMatch);
};

app.findPreviousFallback = function () {
    if (!this.fallbackMatches || this.fallbackMatches.length === 0) {
        this.performFallbackEditorSearch(true);
        return;
    }

    this.currentFallbackMatch = (this.currentFallbackMatch - 1 + this.fallbackMatches.length) % this.fallbackMatches.length;
    this.highlightFallbackMatch(this.currentFallbackMatch);
};

app.replaceCurrent = function () {
    if (this.useFallbackEditor) {
        this.replaceCurrentFallback();
        return;
    }

    if (!this.editor || !this.searchMatches || this.searchMatches.length === 0) return;

    const replaceTerm = document.getElementById('editor-replace-input')?.value || '';
    const currentMatch = this.searchMatches[this.currentMatchIndex];

    if (currentMatch) {
        const range = currentMatch.range;
        this.editor.executeEdits('replace', [{
            range: range,
            text: replaceTerm,
            forceMoveMarkers: true
        }]);

        // Small delay to let editor update, then refresh search
        setTimeout(() => {
            this.performEditorSearch(true);
        }, 50);
    }
};

app.replaceAll = function () {
    if (this.useFallbackEditor) {
        this.replaceAllFallback();
        return;
    }

    if (!this.editor) return;

    const searchTerm = document.getElementById('editor-search-input')?.value || '';
    const replaceTerm = document.getElementById('editor-replace-input')?.value || '';

    if (!searchTerm) return;

    const content = this.editor.getValue();
    const newContent = content.split(searchTerm).join(replaceTerm);

    this.editor.setValue(newContent);
    if (this.currentFile && this.files[this.currentFile]) {
        this.files[this.currentFile].content = newContent;
        this.saveToStorage();
    }
    this.showToast(`Replaced all occurrences of "${searchTerm}"`);

    // Clear search after replace all
    this.lastSearchTerm = '';
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    document.getElementById('search-stats').innerHTML = '';
};

app.replaceCurrentFallback = function () {
    const textarea = document.getElementById('fallback-editor');
    const searchTerm = document.getElementById('editor-search-input')?.value || '';
    const replaceTerm = document.getElementById('editor-replace-input')?.value || '';

    if (!textarea || !searchTerm) return;

    const content = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (selectedText === searchTerm) {
        const newContent = content.substring(0, start) + replaceTerm + content.substring(end);
        textarea.value = newContent;

        if (this.currentFile && this.files[this.currentFile]) {
            this.files[this.currentFile].content = newContent;
            this.saveToStorage();
        }

        // Refresh search
        setTimeout(() => {
            this.performFallbackEditorSearch(true);
        }, 50);
    }
};

app.replaceAllFallback = function () {
    const textarea = document.getElementById('fallback-editor');
    const searchTerm = document.getElementById('editor-search-input')?.value || '';
    const replaceTerm = document.getElementById('editor-replace-input')?.value || '';

    if (!textarea || !searchTerm) return;

    const newContent = textarea.value.split(searchTerm).join(replaceTerm);
    textarea.value = newContent;

    if (this.currentFile && this.files[this.currentFile]) {
        this.files[this.currentFile].content = newContent;
        this.saveToStorage();
    }

    this.showToast(`Replaced all occurrences of "${searchTerm}"`);

    // Clear search after replace all
    this.lastSearchTerm = '';
    this.fallbackMatches = [];
    this.currentFallbackMatch = -1;
    document.getElementById('search-stats').innerHTML = '';
};

// Fallback for textarea editor
app.performFallbackEditorSearch = function () {
    const textarea = document.getElementById('fallback-editor');
    const searchTerm = document.getElementById('editor-search-input')?.value || '';

    if (!textarea || !searchTerm) return;

    const content = textarea.value;
    const matches = this.findStringIndices(content, searchTerm);

    const statsDiv = document.getElementById('search-stats');
    if (statsDiv) {
        statsDiv.innerHTML = `${matches.length} match${matches.length !== 1 ? 'es' : ''}`;
    }

    this.fallbackMatches = matches;
    this.currentFallbackMatch = matches.length > 0 ? 0 : -1;

    if (matches.length > 0) {
        this.highlightFallbackMatch(0);
    }
};

app.findStringIndices = function (str, search) {
    const indices = [];
    let index = -1;
    while ((index = str.indexOf(search, index + 1)) !== -1) {
        indices.push(index);
    }
    return indices;
};

app.highlightFallbackMatch = function (matchIndex) {
    const textarea = document.getElementById('fallback-editor');
    if (!textarea || !this.fallbackMatches || this.fallbackMatches.length === 0) return;

    const start = this.fallbackMatches[matchIndex];
    const end = start + (document.getElementById('editor-search-input')?.value?.length || 0);

    textarea.focus();
    textarea.setSelectionRange(start, end);

    this.updateSearchStats();
};

app.findNextFallback = function () {
    if (!this.fallbackMatches || this.fallbackMatches.length === 0) {
        this.performFallbackEditorSearch();
        return;
    }

    this.currentFallbackMatch = (this.currentFallbackMatch + 1) % this.fallbackMatches.length;
    this.highlightFallbackMatch(this.currentFallbackMatch);
};

app.findPreviousFallback = function () {
    if (!this.fallbackMatches || this.fallbackMatches.length === 0) {
        this.performFallbackEditorSearch();
        return;
    }

    this.currentFallbackMatch = (this.currentFallbackMatch - 1 + this.fallbackMatches.length) % this.fallbackMatches.length;
    this.highlightFallbackMatch(this.currentFallbackMatch);
};

app.replaceCurrentFallback = function () {
    const textarea = document.getElementById('fallback-editor');
    const searchTerm = document.getElementById('editor-search-input')?.value || '';
    const replaceTerm = document.getElementById('editor-replace-input')?.value || '';

    if (!textarea || !searchTerm) return;

    const content = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (selectedText === searchTerm) {
        const newContent = content.substring(0, start) + replaceTerm + content.substring(end);
        textarea.value = newContent;

        if (this.currentFile && this.files[this.currentFile]) {
            this.files[this.currentFile].content = newContent;
            this.saveToStorage();
        }

        this.performFallbackEditorSearch();
    }
};

app.replaceAllFallback = function () {
    const textarea = document.getElementById('fallback-editor');
    const searchTerm = document.getElementById('editor-search-input')?.value || '';
    const replaceTerm = document.getElementById('editor-replace-input')?.value || '';

    if (!textarea || !searchTerm) return;

    const newContent = textarea.value.split(searchTerm).join(replaceTerm);
    textarea.value = newContent;

    if (this.currentFile && this.files[this.currentFile]) {
        this.files[this.currentFile].content = newContent;
        this.saveToStorage();
    }

    this.showToast(`Replaced all occurrences of "${searchTerm}"`);
    this.performFallbackEditorSearch();
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