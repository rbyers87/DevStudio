// ============================================================
// DevStudio – app-github.js
// GitHub integration
// ============================================================

app.showGitHubModal = function () {
    const modal = document.getElementById('github-modal');
    if (modal) modal.classList.remove('hidden');

    // Clear previous values from the modal
    const tokenInput = document.getElementById('github-token');
    const repoInput = document.getElementById('github-repo');

    if (tokenInput) {
        tokenInput.value = this.github.token || '';
    }
    if (repoInput) {
        repoInput.value = this.github.repo || '';
    }

    // Reset any error messages
    const errorDiv = document.getElementById('github-error');
    if (errorDiv) errorDiv.remove();
};

app.connectGitHub = async function () {
    const token = document.getElementById('github-token').value.trim();
    const repo = document.getElementById('github-repo').value.trim();

    if (!token || !repo) {
        this.showToast('Please provide both token and repository');
        return;
    }

    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });

        if (response.ok) {
            this.github = { token, repo, connected: true };
            this.saveToStorage();
            const statusSpan = document.getElementById('github-status');
            if (statusSpan) statusSpan.innerHTML = `<i class="fab fa-github"></i> ${repo}`;
            this.closeModal('github-modal');
            this.showToast(`Connected to GitHub: ${repo}`);

            // This will now clear versions and create checkpoint
            await this.loadGitHubRepo();
        } else {
            const error = await response.json();
            this.showToast(`Invalid token: ${error.message || 'Unknown error'}`);
        }
    } catch (error) {
        this.showToast('Error: ' + error.message);
    }
};

app.loadGitHubRepo = async function () {
    if (!this.github.connected) return;

    // Check if there are existing files or versions
    const hasExistingData = Object.keys(this.files).length > 0 || this.versions.length > 0;

    if (hasExistingData) {
        const confirmLoad = confirm(
            '⚠️ Loading a GitHub repo will:\n\n' +
            '• Clear ALL existing files\n' +
            '• Delete ALL version history/checkpoints\n' +
            '• Create a fresh checkpoint for the new repo\n\n' +
            'This cannot be undone. Continue?'
        );
        if (!confirmLoad) return;
    }

    this.showToast('Loading repository from GitHub...');
    const [owner, repo] = this.github.repo.split('/');

    try {
        // Clear existing files and versions
        this.files = {};
        this.versions = [];

        await this.fetchGitHubContents(owner, repo, '');
        this.currentFolder = '';
        this.saveToStorage();
        this.updateFolderSelector();
        this.renderFileTree();

        // Create first checkpoint
        this.createCheckpoint(`GitHub Import: ${this.github.repo} - ${new Date().toLocaleString()}`);

        this.showToast(`✅ Repository loaded! ${Object.keys(this.files).filter(f => this.files[f].type === 'file').length} files, checkpoint saved.`);

        const firstHtml = Object.keys(this.files).find(f => f.endsWith('.html'));
        if (firstHtml) this.openFile(firstHtml);
        else if (Object.keys(this.files).length > 0) this.openFile(Object.keys(this.files)[0]);
    } catch (error) {
        console.error('GitHub load error:', error);
        this.showToast('Error loading repository: ' + error.message);
    }
};

app.fetchGitHubContents = async function (owner, repo, path) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `token ${this.github.token}` }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }

    const data = await response.json();

    for (const item of data) {
        if (item.type === 'file') {
            const contentResponse = await fetch(item.download_url);
            const content = await contentResponse.text();
            this.files[item.path] = { content, type: 'file' };
        } else if (item.type === 'dir') {
            this.files[item.path + '/'] = { content: null, type: 'folder' };
            await this.fetchGitHubContents(owner, repo, item.path);
        }
    }
};

app.deployToGitHub = async function () {
    if (!this.github.connected) {
        this.showGitHubModal();
        return;
    }

    const [owner, repo] = this.github.repo.split('/');
    let successCount = 0;
    let failCount = 0;

    this.showToast('Syncing to GitHub...');

    for (const [filename, fileData] of Object.entries(this.files)) {
        if (fileData.type === 'folder') continue;

        try {
            const getResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}`, {
                headers: { 'Authorization': `token ${this.github.token}` }
            });

            let sha = null;
            if (getResponse.ok) {
                sha = (await getResponse.json()).sha;
            }

            const content = btoa(unescape(encodeURIComponent(fileData.content)));
            const body = {
                message: `Update ${filename} via DevStudio`,
                content: content,
                ...(sha && { sha })
            };

            const putResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.github.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (putResponse.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            console.error(`Error saving ${filename}:`, error);
            failCount++;
        }
    }

    this.showToast(`Synced ${successCount} files to GitHub${failCount > 0 ? ` (${failCount} failed)` : ''}`);
};