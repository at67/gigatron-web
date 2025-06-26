class FileBrowser {
    constructor() {
        this.currentFileType = 'rom';
        this.files = {
            rom: [],
            gt1: []
        };
        this.selectedFile = null;
        this.expandedFolders = new Set();

        this.initializeEventListeners();
        this.loadFiles();
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchFileType(e.target.dataset.type);
            });
        });

        // Filter changes
        document.getElementById('category-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('author-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('language-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('sort-filter').addEventListener('change', () => this.applyFilters());
    }

    switchFileType(type) {
        this.currentFileType = type;

        // Update tab appearance
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        this.renderFileTree();
        this.updateFilters();
    }

    async loadFiles() {
        try {
            // Load ROM files
            const romResponse = await fetch('/ext/at67/gigatronemulator/emulator/scan_files.php?type=rom');
            this.files.rom = await romResponse.json();

            // Load GT1 files
            const gt1Response = await fetch('/ext/at67/gigatronemulator/emulator/scan_files.php?type=gt1');
            this.files.gt1 = await gt1Response.json();

            this.renderFileTree();
            this.updateFilters();
        } catch (error) {
            console.error('Failed to load files:', error);
            this.renderError('Failed to load files. Make sure scan_files.php is available.');
        }
    }

    renderError(message) {
        const treeElement = document.getElementById('file-tree');
        treeElement.innerHTML = `<div style="color: #ff6666; padding: 20px; text-align: center;">${message}</div>`;
    }

    renderFileTree() {
        const files = this.getCurrentFiles();
        const tree = this.buildFileTree(files);
        const treeElement = document.getElementById('file-tree');

        treeElement.innerHTML = '';
        this.renderTreeNode(tree, treeElement, '');
    }

    getCurrentFiles() {
        return this.files[this.currentFileType] || [];
    }

    buildFileTree(files) {
        const tree = {};

        files.forEach(file => {
            const parts = file.path.split('/');
            let current = tree;

            // Build nested structure
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }

            // Add file to the tree
            const filename = parts[parts.length - 1];
            current[filename] = file;
        });

        return tree;
    }

    renderTreeNode(node, container, path) {
        Object.keys(node).sort().forEach(key => {
            const item = node[key];
            const currentPath = path ? `${path}/${key}` : key;

            if (item.filename) {
                // This is a file
                this.renderFile(item, container, currentPath);
            } else {
                // This is a folder
                this.renderFolder(key, item, container, currentPath);
            }
        });
    }

    renderFolder(name, contents, container, path) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'folder-header';
        headerDiv.innerHTML = `
            <span class="folder-toggle">${this.expandedFolders.has(path) ? '▼' : '▶'}</span>
            <span>${name}/</span>
        `;

        headerDiv.addEventListener('click', () => {
            this.toggleFolder(path);
        });

        folderDiv.appendChild(headerDiv);

        if (this.expandedFolders.has(path)) {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'folder-content';
            this.renderTreeNode(contents, contentDiv, path);
            folderDiv.appendChild(contentDiv);
        }

        container.appendChild(folderDiv);
    }

    renderFile(file, container, path) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        if (this.selectedFile === file) {
            fileDiv.classList.add('selected');
        }

        fileDiv.innerHTML = `
            <input type="radio" name="selected-file" class="file-radio" ${this.selectedFile === file ? 'checked' : ''}>
            <span>${file.filename}</span>
        `;

        fileDiv.addEventListener('click', () => {
            this.selectFile(file);
        });

        container.appendChild(fileDiv);
    }

    toggleFolder(path) {
        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
        } else {
            this.expandedFolders.add(path);
        }
        this.renderFileTree();
    }

    selectFile(file) {
        this.selectedFile = file;
        this.renderFileTree();
        this.updateLoadingStatus();

        // Notify UI manager about file selection
        if (window.uiManager) {
            window.uiManager.onFileSelected(file);
        }
    }

    updateLoadingStatus() {
        const statusElement = document.getElementById('loading-status');
        if (this.selectedFile) {
            statusElement.textContent = `Selected: ${this.selectedFile.filename}`;
        } else {
            statusElement.textContent = 'No file selected';
        }
    }

    updateFilters() {
        const files = this.getCurrentFiles();

        // Get unique values for filters
        const categories = [...new Set(files.map(f => f.category).filter(Boolean))];
        const authors = [...new Set(files.map(f => f.author).filter(Boolean))];
        const languages = [...new Set(files.map(f => f.language).filter(Boolean))];

        this.populateFilter('category-filter', categories);
        this.populateFilter('author-filter', authors);
        this.populateFilter('language-filter', languages);
    }

    populateFilter(selectId, options) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;

        // Clear existing options except "All"
        select.innerHTML = select.children[0].outerHTML;

        // Add new options
        options.sort().forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });

        // Restore selection if still valid
        if (options.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    applyFilters() {
        // For now, just re-render the tree
        // TODO: Implement actual filtering logic
        this.renderFileTree();
    }
}

// Initialize file browser when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fileBrowser = new FileBrowser();
});
