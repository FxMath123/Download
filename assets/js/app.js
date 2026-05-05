/**
 * GitHub File Downloader - Frontend Application
 * Triggers GitHub Actions workflows and displays downloaded files
 */

const CONFIG = {
    // Auto-detect repository from the current page URL
    get defaultRepo() {
        // For GitHub Pages: https://username.github.io/repo
        // For custom domains, user must provide
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return ''; // User must provide repo for local dev
        }
        
        // Extract from GitHub Pages URL: username.github.io/repo-name
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (hostname.includes('github.io') && pathParts.length > 0) {
            return `${hostname.split('.')[0]}/${pathParts[0]}`;
        }
        return '';
    },
    githubApi: 'https://api.github.com',
    workflowsPath: '/actions/workflows/download.yml'
};

const DOM = {
    form: document.getElementById('downloadForm'),
    fileUrl: document.getElementById('fileUrl'),
    customFilename: document.getElementById('customFilename'),
    repoInput: document.getElementById('repoInput'),
    submitBtn: document.getElementById('submitBtn'),
    urlError: document.getElementById('urlError'),
    statusContainer: document.getElementById('statusContainer'),
    statusTitle: document.getElementById('statusTitle'),
    statusMessage: document.getElementById('statusMessage'),
    progressFill: document.getElementById('progressFill'),
    resultContainer: document.getElementById('resultContainer'),
    workflowUrl: document.getElementById('workflowUrl'),
    runStatus: document.getElementById('runStatus'),
    filesList: document.getElementById('filesList'),
    filesEmpty: document.getElementById('filesEmpty')
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeRepoInput();
    setupFormValidation();
    loadDownloadedFiles();
    
    DOM.form.addEventListener('submit', handleFormSubmit);
    
    // Real-time URL validation
    DOM.fileUrl.addEventListener('input', () => {
        validateUrl(DOM.fileUrl.value);
    });
});

function initializeRepoInput() {
    if (CONFIG.defaultRepo) {
        DOM.repoInput.value = CONFIG.defaultRepo;
        DOM.repoInput.placeholder = CONFIG.defaultRepo;
    }
}

// ============================================================
// URL VALIDATION
// ============================================================

function validateUrl(url) {
    const errorEl = DOM.urlError;
    
    if (!url || url.trim() === '') {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
        DOM.fileUrl.classList.remove('error');
        return true;
    }
    
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Only HTTP(S) URLs are supported');
        }
        
        // Additional validation
        if (parsed.hostname === 'github.com' && parsed.pathname.includes('/blob/')) {
            // Convert GitHub blob URLs to raw URLs
            const rawUrl = parsed.href
                .replace('github.com', 'raw.githubusercontent.com')
                .replace('/blob/', '/');
            errorEl.textContent = `💡 Tip: Using raw URL: ${rawUrl}`;
            errorEl.classList.add('show');
            errorEl.style.color = 'var(--warning)';
            DOM.fileUrl.classList.remove('error');
            return true;
        }
        
        errorEl.textContent = '';
        errorEl.classList.remove('show');
        DOM.fileUrl.classList.remove('error');
        return true;
    } catch (e) {
        errorEl.textContent = e.message || 'Please enter a valid URL (e.g., https://example.com/file.zip)';
        errorEl.classList.add('show');
        errorEl.style.color = 'var(--danger)';
        DOM.fileUrl.classList.add('error');
        return false;
    }
}

// ============================================================
// FORM HANDLING
// ============================================================

function setupFormValidation() {
    // Prevent form submission on Enter if URL is invalid
    DOM.form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const urlValid = validateUrl(DOM.fileUrl.value);
            if (!urlValid) {
                e.preventDefault();
                DOM.fileUrl.focus();
            }
        }
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validate URL
    const url = DOM.fileUrl.value.trim();
    if (!validateUrl(url)) {
        DOM.fileUrl.focus();
        return;
    }
    
    const repo = DOM.repoInput.value.trim() || CONFIG.defaultRepo;
    if (!repo) {
        showToast('Please enter your GitHub repository (e.g., username/repo)', 'error');
        return;
    }
    
    const customFilename = DOM.customFilename.value.trim();
    
    // Disable form
    setFormEnabled(false);
    
    // Show status
    showStatus('Triggering workflow...', 'Connecting to GitHub Actions...');
    DOM.resultContainer.classList.add('hidden');
    
    try {
        const result = await triggerWorkflow(repo, url, customFilename);
        showResult(result, repo);
    } catch (error) {
        showError(error.message);
    } finally {
        setFormEnabled(true);
    }
}

// ============================================================
// GITHUB API
// ============================================================

async function triggerWorkflow(repo, fileUrl, customFilename) {
    // Step 1: Get the default branch
    const branch = await getDefaultBranch(repo);
    updateStatus('Fetching repository info...', `Detected branch: ${branch}`);
    updateProgress(25);
    
    // Step 2: Trigger the workflow
    updateStatus('Triggering download workflow...', 'Sending request to GitHub Actions...');
    updateProgress(50);
    
    const runId = await dispatchWorkflow(repo, branch, fileUrl, customFilename);
    
    // Step 3: Get workflow run URL
    updateStatus('Workflow triggered!', 'Tracking the workflow run...');
    updateProgress(75);
    
    const workflowUrl = `https://github.com/${repo}/actions/runs/${runId}`;
    
    // Step 4: Poll for completion (optional - let user know it's running)
    updateStatus('Download in progress...', 'File is being downloaded via GitHub Actions. This may take a moment.');
    updateProgress(90);
    
    // Start background polling for status
    pollWorkflowStatus(repo, runId);
    
    return {
        runId,
        workflowUrl,
        branch,
        filename: customFilename || 'auto-detected'
    };
}

async function getDefaultBranch(repo) {
    const url = `${CONFIG.githubApi}/repos/${repo}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Repository "${repo}" not found. Make sure it exists and you have access.`);
        }
        if (response.status === 403) {
            throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
        throw new Error(`Failed to fetch repository info (HTTP ${response.status})`);
    }
    
    const data = await response.json();
    return data.default_branch;
}

async function dispatchWorkflow(repo, branch, fileUrl, customFilename) {
    const url = `${CONFIG.githubApi}/repos/${repo}/actions/workflows/download.yml/dispatches`;
    
    const workflowInputs = {
        file_url: fileUrl
    };
    
    if (customFilename) {
        workflowInputs.custom_filename = customFilename;
    }
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: branch,
            inputs: workflowInputs
        })
    });
    
    if (!response.ok) {
        const errorData = await response.text();
        let errorMsg;
        
        if (response.status === 404) {
            errorMsg = 'Workflow file not found. Make sure the workflow file (.github/workflows/download.yml) exists in your repository.';
        } else if (response.status === 403) {
            errorMsg = 'Permission denied. Make sure your GitHub token has "workflow" scope. If using GitHub Pages, you need a Personal Access Token.';
        } else if (response.status === 422) {
            errorMsg = 'Invalid workflow configuration. Check that the workflow file is properly formatted.';
        } else {
            errorMsg = `Failed to trigger workflow (HTTP ${response.status}): ${errorData}`;
        }
        
        throw new Error(errorMsg);
    }
    
    // GitHub returns 204 No Content on success, but we need to find the run ID
    // We'll look it up from the workflow runs
    return await getLatestRunId(repo, branch);
}

async function getLatestRunId(repo, branch) {
    // Wait a moment for the run to be created
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const url = `${CONFIG.githubApi}/repos/${repo}/actions/workflows/download.yml/runs?branch=${branch}&per_page=1&status=queued`;
    
    const response = await fetch(url);
    if (!response.ok) {
        return 'unknown'; // Can't get run ID, but workflow was triggered
    }
    
    const data = await response.json();
    if (data.total_count > 0) {
        return data.workflow_runs[0].id;
    }
    
    return 'unknown';
}

async function pollWorkflowStatus(repo, runId) {
    if (runId === 'unknown') return;
    
    const url = `${CONFIG.githubApi}/repos/${repo}/actions/runs/${runId}`;
    
    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 10 minutes (10s intervals)
    
    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;
        
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            
            const data = await response.json();
            const status = data.status;
            const conclusion = data.conclusion;
            
            if (status === 'completed') {
                if (conclusion === 'success') {
                    updateStatus('✅ Download complete!', 'File has been downloaded and stored in the repository.');
                    updateProgress(100);
                    updateRunStatus('success', 'Success');
                    
                    // Check if the file has been added to the repository
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    await loadDownloadedFiles();
                } else if (conclusion === 'failure') {
                    updateStatus('❌ Download failed', 'Check the workflow logs for details.');
                    updateRunStatus('failed', 'Failed');
                    showToast('Workflow failed. Check GitHub Actions logs.', 'error');
                } else {
                    updateStatus('⚠️ Workflow completed with status: ' + conclusion, '');
                    updateRunStatus('failed', conclusion.charAt(0).toUpperCase() + conclusion.slice(1));
                }
                break;
            } else {
                const elapsed = attempts * 10;
                updateStatus('⏳ Download in progress...', `Running for ${elapsed}s. Fetching file from source URL...`);
                updateProgress(90 + (attempts / maxAttempts) * 10);
            }
        } catch (e) {
            // Network error, continue polling
            console.warn('Polling error:', e);
        }
    }
    
    if (attempts >= maxAttempts) {
        updateStatus('⏰ Still processing...', 'The workflow is taking longer than expected. Check GitHub Actions for updates.');
        updateRunStatus('pending', 'In Progress');
    }
}

// ============================================================
// UI UPDATES
// ============================================================

function setFormEnabled(enabled) {
    DOM.fileUrl.disabled = !enabled;
    DOM.customFilename.disabled = !enabled;
    DOM.repoInput.disabled = !enabled;
    DOM.submitBtn.disabled = !enabled;
    
    if (enabled) {
        DOM.submitBtn.innerHTML = '<span class="btn-icon">⬇️</span><span class="btn-text">Start Download</span>';
    } else {
        DOM.submitBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Processing...</span>';
    }
}

function showStatus(title, message) {
    DOM.statusContainer.classList.remove('hidden');
    DOM.statusTitle.textContent = title;
    DOM.statusMessage.textContent = message;
}

function updateStatus(title, message) {
    DOM.statusTitle.textContent = title;
    DOM.statusMessage.textContent = message;
}

function updateProgress(percent) {
    DOM.progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

function showResult(result, repo) {
    DOM.statusContainer.classList.add('hidden');
    DOM.resultContainer.classList.remove('hidden');
    
    DOM.workflowUrl.href = result.workflowUrl;
    DOM.workflowUrl.textContent = `Run #${result.runId}`;
    DOM.runStatus.textContent = 'Triggered';
    DOM.runStatus.className = 'status-badge pending';
    
    showToast('✅ Workflow triggered successfully!', 'success');
    
    // Refresh file list after a delay
    setTimeout(loadDownloadedFiles, 5000);
}

function showError(message) {
    DOM.statusContainer.classList.add('hidden');
    DOM.progressFill.style.width = '0%';
    
    showToast(`❌ ${message}`, 'error');
}

function updateRunStatus(type, text) {
    DOM.runStatus.textContent = text;
    DOM.runStatus.className = `status-badge ${type}`;
}

function resetForm() {
    DOM.resultContainer.classList.add('hidden');
    DOM.statusContainer.classList.add('hidden');
    DOM.progressFill.style.width = '0%';
    DOM.fileUrl.value = '';
    DOM.fileUrl.classList.remove('error');
    DOM.urlError.classList.remove('show');
    DOM.customFilename.value = '';
    DOM.submitBtn.innerHTML = '<span class="btn-icon">⬇️</span><span class="btn-text">Start Download</span>';
    DOM.fileUrl.focus();
}

// ============================================================
// FILE LISTING
// ============================================================

async function loadDownloadedFiles() {
    try {
        DOM.filesList.innerHTML = '<p class="loading-files">Loading downloaded files...</p>';
        DOM.filesEmpty.classList.add('hidden');
        
        const repo = DOM.repoInput.value.trim() || CONFIG.defaultRepo;
        if (!repo) {
            DOM.filesList.innerHTML = '<p class="empty-state">Enter a repository to see downloaded files</p>';
            return;
        }
        
        const files = await fetchDownloadedFiles(repo);
        
        if (files.length === 0) {
            DOM.filesList.innerHTML = '';
            DOM.filesEmpty.classList.remove('hidden');
            return;
        }
        
        renderFileList(files, repo);
    } catch (error) {
        console.error('Failed to load files:', error);
        DOM.filesList.innerHTML = `
            <p class="empty-state">
                Unable to load files. 
                ${error.message.includes('404') ? 'Make sure the repository exists.' : 'Check your internet connection.'}
            </p>
        `;
    }
}

async function fetchDownloadedFiles(repo) {
    // Try to get files via GitHub API
    const branch = await getDefaultBranch(repo);
    const url = `${CONFIG.githubApi}/repos/${repo}/contents/downloads?ref=${branch}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 404) {
            return []; // No downloads directory yet
        }
        throw new Error(`Failed to fetch files (HTTP ${response.status})`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
        return [];
    }
    
    // Filter and map files
    const files = data
        .filter(item => item.type === 'file' && 
               item.name !== 'download_info.json' && 
               !item.name.startsWith('.'))
        .map(item => ({
            name: item.name,
            size: item.size,
            downloadUrl: item.download_url,
            path: item.path,
            htmlUrl: `https://github.com/${repo}/blob/${branch}/${item.path}`,
            rawUrl: `https://raw.githubusercontent.com/${repo}/${branch}/${item.path}`
        }));
    
    // Sort by name (which includes timestamp) descending
    files.sort((a, b) => b.name.localeCompare(a.name));
    
    return files;
}

function renderFileList(files, repo) {
    if (files.length === 0) {
        DOM.filesList.innerHTML = '';
        DOM.filesEmpty.classList.remove('hidden');
        return;
    }
    
    const grid = document.createElement('div');
    grid.className = 'files-grid';
    
    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        
        const fileIcon = getFileIcon(file.name);
        
        item.innerHTML = `
            <div class="file-info">
                <span class="file-icon">${fileIcon}</span>
                <div>
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-size">${formatSize(file.size)}</div>
                </div>
            </div>
            <div class="file-actions">
                <a href="${file.rawUrl}" target="_blank" rel="noopener" class="file-link download-link" title="Download file">⬇️ Raw</a>
                <a href="${file.htmlUrl}" target="_blank" rel="noopener" class="file-link" title="View on GitHub">📄 View</a>
                <button class="file-link" onclick="copyToClipboard('${file.rawUrl}')" title="Copy raw URL">📋 Copy</button>
            </div>
        `;
        
        grid.appendChild(item);
    });
    
    DOM.filesList.innerHTML = '';
    DOM.filesList.appendChild(grid);
    DOM.filesEmpty.classList.add('hidden');
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap = {
        'zip': '📦',
        'tar': '📦',
        'gz': '📦',
        'rar': '📦',
        '7z': '📦',
        'pdf': '📄',
        'doc': '📝',
        'docx': '📝',
        'xls': '📊',
        'xlsx': '📊',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
        'webp': '🖼️',
        'mp4': '🎬',
        'mp3': '🎵',
        'wav': '🎵',
        'exe': '⚙️',
        'dmg': '💿',
        'iso': '💿',
        'csv': '📊',
        'json': '📋',
        'xml': '📋',
        'txt': '📃',
        'html': '🌐',
        'css': '🎨',
        'js': '⚡',
        'py': '🐍',
        'cpp': '⚙️',
        'c': '⚙️',
        'java': '☕',
        'sh': '🚀',
        'bat': '🚀'
    };
    
    return iconMap[ext] || '📁';
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
    return `${size} ${units[i]}`;
}

// ============================================================
// UTILITIES
// ============================================================

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('📋 Raw URL copied to clipboard!', 'success'))
            .catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showToast('📋 Raw URL copied to clipboard!', 'success');
    } catch (e) {
        showToast('Failed to copy. Please select and copy manually.', 'error');
    }
    
    document.body.removeChild(textarea);
}

function showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(el => el.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Expose functions globally
window.resetForm = resetForm;
window.copyToClipboard = copyToClipboard;
