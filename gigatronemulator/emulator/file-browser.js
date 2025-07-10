class FileBrowser
{
    constructor(mode = 'emulator')
    {
        this.mode = mode;
        this.currentFileType = mode === 'rombuilder' ? 'internal' : 'rom';
        this.files =
        {
            rom: [],
            gt1: []
        };
        this.selectedFile = null;
        this.expandedFolders = new Set();
        this.searchQuery = '';

        // ROM Builder specific properties
        if (this.mode === 'rombuilder') {
            this.selectedFiles = []; // Array for multiple selection
        }

        this.initializeEventListeners();
        this.loadFiles();
    }

    initializeEventListeners()
    {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn =>
        {
            btn.addEventListener('click', (e) =>
            {
                this.switchFileType(e.target.dataset.type);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('search-input');
        if(searchInput)
        {
            searchInput.addEventListener('input', (e) =>
            {
                const newQuery = e.target.value.trim();
                this.searchQuery = newQuery;
                this.applySearch();
            });

            // Prevent emulator from capturing keystrokes when search is focused
            searchInput.addEventListener('keydown', (e) =>
            {
                e.stopPropagation();
            });

            searchInput.addEventListener('keyup', (e) =>
            {
                e.stopPropagation();
            });
        }
    }

    switchFileType(type)
    {
        this.currentFileType = type;

        // Clear search when switching file types
        this.searchQuery = '';
        const searchInput = document.getElementById('search-input');
        if(searchInput) searchInput.value = '';

        // Update tab appearance
        document.querySelectorAll('.tab-btn').forEach(btn =>
        {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Restore selection based on what's actually loaded
        this.selectedFile = null;
        if(type === 'rom')
        {
            const loadedRomName = document.getElementById('status-rom-name').textContent;
            if(loadedRomName && loadedRomName !== 'No ROM')
            {
                this.selectedFile = this.files.rom.find(f => f.filename === loadedRomName) || null;
            }
        }
        else if(type === 'gt1')
        {
            const loadedGt1Name = document.getElementById('status-gt1-name').textContent;
            if(loadedGt1Name && loadedGt1Name !== 'No GT1')
            {
                this.selectedFile = this.files.gt1.find(f => f.filename === loadedGt1Name) || null;
            }
        }

        // Apply search (this will collapse everything since search is cleared)
        this.applySearch();

        // THEN expand only the path to the selected file
        if(this.selectedFile && this.selectedFile.path.includes('/'))
        {
            const folderPath = this.selectedFile.path.substring(0, this.selectedFile.path.lastIndexOf('/'));
            this.expandPathToFile(folderPath);
            this.renderFileTree(); // Re-render with the expanded path
        }
    }

    async loadFiles()
    {
        try
        {
            if(this.mode === 'rombuilder')
            {
                // Load Apps, Core, and curated files for ROM Builder
                const romdepsResponse = await fetch('/ext/at67/gigatronemulator/emulator/scan_files.php?type=romdeps&base_path=/var/www/html/phpbb/ext/at67/gigatronrombuilder');
                const curatedResponse = await fetch('/ext/at67/gigatronemulator/emulator/scan_files.php?type=gt1');

                const romdepsFiles = await romdepsResponse.json();
                const curatedFiles = await curatedResponse.json();

                romdepsFiles.forEach(file => file.source = 'romdeps');
                curatedFiles.forEach(file => file.source = 'curated');

                this.files.internal = [...romdepsFiles, ...curatedFiles];
            }
            else
            {
                // Load ROM and GT1 files for emulator
                const romResponse = await fetch('/ext/at67/gigatronemulator/emulator/scan_files.php?type=rom');
                this.files.rom = await romResponse.json();

                const gt1Response = await fetch('/ext/at67/gigatronemulator/emulator/scan_files.php?type=gt1');
                this.files.gt1 = await gt1Response.json();
            }

            this.applySearch();
        }
        catch(error)
        {
            console.error('Failed to load files:', error);
            this.renderError('Failed to load files. Make sure scan_files.php is available.');
        }
    }

    renderError(message)
    {
        const treeElement = document.getElementById('file-tree');
        treeElement.innerHTML = `<div style="color: #ff6666; padding: 20px; text-align: center;">${message}</div>`;
    }

    applySearch()
    {
        const files = this.getCurrentFiles();
        const filteredFiles = this.searchQuery ? this.searchFiles(files, this.searchQuery) : files;
        const tree = this.buildFileTree(filteredFiles);

        if(this.searchQuery)
        {
            // Only expand for search results
            this.expandSearchResults(tree, this.searchQuery);
        }
        else
        {
            // Clear search - reset to collapsed state
            this.resetToCollapsedState();
        }

        this.renderFileTree(tree);
    }

    searchFiles(files, query)
    {
        const lowerQuery = query.toLowerCase();

        const results = files.filter(file =>
        {
            // Search in filename
            const filenameMatch = file.filename.toLowerCase().includes(lowerQuery);

            // Search in author
            const authorMatch = file.author && file.author.toLowerCase().includes(lowerQuery);

            // Search in category
            const categoryMatch = file.category && file.category.toLowerCase().includes(lowerQuery);

            // Search in full path
            const pathMatch = file.path.toLowerCase().includes(lowerQuery);

            const matches = filenameMatch || authorMatch || categoryMatch || pathMatch;

            return matches;
        });

        return results;
    }

    resetToCollapsedState()
    {
        // Clear all expanded folders to return to collapsed state
        this.expandedFolders.clear();
    }

    expandSearchResults(tree, query)
    {
        const lowerQuery = query.toLowerCase();

        this.expandTreeRecursively(tree, '', lowerQuery);
    }

    expandTreeRecursively(node, currentPath, query)
    {
        Object.keys(node).forEach(key =>
        {
            const item = node[key];
            const itemPath = currentPath ? `${currentPath}/${key}` : key;

            if(item.filename)
            {
                // This is a file - expand path to it
                this.expandPathToFile(currentPath);
            }
            else
            {
                // This is a folder
                const hasMatchingContent = this.folderHasMatchingContent(item, query);

                if(hasMatchingContent)
                {
                    this.expandedFolders.add(itemPath);

                    // Check what type of match this is
                    const keyLower = key.toLowerCase();
                    if(keyLower.includes(query))
                    {
                        // This folder name matches the search
                        const depth = itemPath.split('/').length;
                        if(depth === 1)
                        {
                            // Category level match - expand to show authors (Option C)
                            this.expandToAuthorLevel(item, itemPath);
                        }
                        else if(depth === 2)
                        {
                            // Author level match - expand to show all files
                            this.expandToFileLevel(item, itemPath);
                        }
                    }

                    // Continue recursively
                    this.expandTreeRecursively(item, itemPath, query);
                }
            }
        });
    }

    folderHasMatchingContent(folder, query)
    {
        return Object.keys(folder).some(key =>
        {
            const item = folder[key];
            if(item.filename)
            {
                // Check if this file matches
                return item.filename.toLowerCase().includes(query) ||
                       (item.author && item.author.toLowerCase().includes(query)) ||
                       (item.category && item.category.toLowerCase().includes(query));
            }
            else
            {
                // Check folder name or recurse
                return key.toLowerCase().includes(query) ||
                       this.folderHasMatchingContent(item, query);
            }
        });
    }

    expandToAuthorLevel(categoryFolder, categoryPath)
    {
        // Expand category to show authors, but keep author folders collapsed
        Object.keys(categoryFolder).forEach(authorKey =>
        {
            const authorPath = `${categoryPath}/${authorKey}`;
            // Don't auto-expand author folders for category matches
        });
    }

    expandToFileLevel(authorFolder, authorPath)
    {
        // Already expanded by adding to expandedFolders above
    }

    expandPathToFile(path)
    {
        const parts = path.split('/');
        let currentPath = '';

        for(let i = 0; i < parts.length; i++)
        {
            if(i > 0) currentPath += '/';
            currentPath += parts[i];
            this.expandedFolders.add(currentPath);
        }
    }

    renderFileTree(tree = null)
    {
        if(!tree)
        {
            const files = this.getCurrentFiles();
            const filteredFiles = this.searchQuery ? this.searchFiles(files, this.searchQuery) : files;
            tree = this.buildFileTree(filteredFiles);
        }

        const treeElement = document.getElementById('file-tree');
        treeElement.innerHTML = '';
        this.renderTreeNode(tree, treeElement, '');
    }

    getCurrentFiles()
    {
        return this.files[this.currentFileType] || [];
    }

    buildFileTree(files)
    {
        const tree = {};

        files.forEach(file =>
        {
            const parts = file.path.split('/');
            let current = tree;

            // Build nested structure
            for(let i = 0; i < parts.length - 1; i++)
            {
                const part = parts[i];
                if(!current[part])
                {
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

    renderTreeNode(node, container, path)
    {
        Object.keys(node).sort().forEach(key =>
        {
            const item = node[key];
            const currentPath = path ? `${path}/${key}` : key;

            if(item.filename)
            {
                // This is a file
                this.renderFile(item, container, currentPath);
            }
            else
            {
                // This is a folder
                this.renderFolder(key, item, container, currentPath);
            }
        });
    }

    renderFolder(name, contents, container, path)
    {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'folder-header';
        headerDiv.innerHTML = `<span class="folder-toggle">${this.expandedFolders.has(path) ? '▼' : '▶'}</span><span>${name}/</span>`;

        headerDiv.addEventListener('click', () =>
        {
            this.toggleFolder(path);
        });

        folderDiv.appendChild(headerDiv);

        if(this.expandedFolders.has(path))
        {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'folder-content';
            this.renderTreeNode(contents, contentDiv, path);
            folderDiv.appendChild(contentDiv);
        }

        container.appendChild(folderDiv);
    }

    renderFile(file, container, path)
    {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';

        if(this.mode === 'rombuilder')
        {
            const isSelected = this.selectedFiles.includes(file);
            if(isSelected)
            {
                fileDiv.classList.add('selected');
            }
            fileDiv.innerHTML = `<input type="checkbox" class="file-checkbox" ${isSelected ? 'checked' : ''}>
                                 <span>${file.filename}</span>`;
        }
        else
        {
            if(this.selectedFile === file)
            {
                fileDiv.classList.add('selected');
            }
            fileDiv.innerHTML = `<input type="radio" name="selected-file" class="file-radio" ${this.selectedFile === file ? 'checked' : ''}>
                                 <span>${file.filename}</span>`;
        }

        fileDiv.addEventListener('click', () =>
        {
            this.selectFile(file, path);
        });

        container.appendChild(fileDiv);
    }

    toggleFolder(path)
    {
        if(this.expandedFolders.has(path))
        {
            this.expandedFolders.delete(path);
        }
        else
        {
            this.expandedFolders.add(path);
        }
        this.renderFileTree();
    }

    selectFile(file, path = null)
    {
        if(this.mode === 'rombuilder')
        {
            if(path)
            {
                file.fullPath = path;
            }

            const index = this.selectedFiles.indexOf(file);
            if(index === -1)
            {
                // Initialize alias when file is first selected
                file.alias = null;
                this.selectedFiles.push(file);
            }
            else
            {
                this.selectedFiles.splice(index, 1);
            }
        }
        else
        {
            // Single selection for emulator (existing logic)
            this.selectedFile = file;

            // Notify UI manager about file selection
            if(window.uiManager)
            {
                window.uiManager.onFileSelected(file);
            }
        }

        this.renderFileTree();
        this.updateLoadingStatus();

        if(this.mode === 'rombuilder')
        {
            updateStatusDisplay();
        }
    }

    updateLoadingStatus()
    {
        const statusElement = document.getElementById('loading-status');

        if(this.mode === 'rombuilder')
        {
            if(this.selectedFiles.length > 0)
            {
                statusElement.textContent = `Selected: ${this.selectedFiles.length} files`;
            }
            else
            {
                statusElement.textContent = 'No files selected';
            }
        }
        else
        {
            if(this.selectedFile)
            {
                statusElement.textContent = `Selected: ${this.selectedFile.filename}`;
            }
            else
            {
                statusElement.textContent = 'No file selected';
            }
        }
    }
}

