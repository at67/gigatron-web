// build-manager.js - Complete build process management

function buildSymbolTable() {
    // Disable file browser
    if (window.fileBrowser) {
        window.fileBrowser.setReadOnly(true);
    }

    const romVersion = document.getElementById('base-rom-select').value;
    const selectedFiles = window.fileBrowser.selectedFiles;
    if (selectedFiles.length === 0) {
        showBuildResult(false, 'Build Failed', 'Please select at least one file to build ROM');
        return;
    }

    const manifest = generateManifest(romVersion, selectedFiles);
    console.log('Generated manifest:');
    console.log(manifest);

    sendBuildRequest(romVersion, selectedFiles, manifest, true);
}

function buildROM(apps, buildResponse) {
    const romVersion = document.getElementById('base-rom-select').value;
    const selectedFiles = window.fileBrowser.selectedFiles;
    const manifest = generateManifest(romVersion, selectedFiles);

    const hasMainAlias = selectedFiles.some(file => file.alias === 'Main');

    if (hasMainAlias) {
        // Phase 2a: Build ROM directly (has Main alias)
        sendBuildRequest(romVersion, selectedFiles, manifest, false);
    } else {
        // Phase 2b: Generate mainmenu and build ROM
        const gbasSource = generateGbasSource(romVersion);
        sendMainmenuBuildRequest(romVersion, selectedFiles, manifest, gbasSource);
    }
}

function generateManifest(romVersion, selectedFiles) {
    var manifest = '[ROM' + romVersion + ']\n';
    manifest += 'apps="';

    var entries = [];
    for (var i = 0; i < selectedFiles.length; i++) {
        var file = selectedFiles[i];

        var symbolName;
        if (file.alias) {
            symbolName = file.alias;
        } else {
            symbolName = file.filename.replace(/\.(gt1|gcl)$/i, '');
        }

        var entry = symbolName + '=' + file.fullPath;
        entries.push(entry);
    }
    manifest += entries.join(',\n      ') + '"';

    return manifest;
}

function getRomScriptName(romVersion) {
    const selectElement = document.getElementById('base-rom-select');
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const displayText = selectedOption.textContent;

    // Convert display text to script filename
    if (displayText === 'ROMv5a_6502') return 'v5a_6502';
    if (displayText === 'ROMv6_6502') return 'v6_6502';

    return romVersion;
}

function sendBuildRequest(romVersion, selectedFiles, manifest, symbolsOnly = false) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/app.php/gigatronrombuilder/build', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                var response = JSON.parse(xhr.responseText);
                if (response.success) {
                    const hasMainAlias = window.fileBrowser.selectedFiles.some(file => file.alias === 'Main');

                    if (hasMainAlias) {
                        const menuApps = getMenuApps();
                        createMenuConfigFromApps(menuApps);
                        buildROM(menuApps, response);
                    } else {
                        showBuildResult(true, 'Build Successful', response.output, response);
                    }
                } else {
                    showBuildResult(false, 'Build Failed', response.output || response.error);
                }
            } else {
                showBuildResult(false, 'Build Failed', 'Server error: ' + xhr.status);
            }
        }
    };

    var data = {
        rom_version: getRomScriptName(romVersion),
        manifest: manifest,
        selected_files: selectedFiles.map(f => f.path),
        symbols_only: symbolsOnly
    };

    xhr.send(JSON.stringify(data));
}

function sendMainmenuBuildRequest(romVersion, selectedFiles, manifest, gbasSource) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/app.php/gigatronrombuilder/buildMainmenu', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                var response = JSON.parse(xhr.responseText);
                if (response.success) {
                    showBuildResult(true, 'ROM Build Complete', response.output, response);
                } else {
                    showBuildResult(false, 'Build Failed', response.output || response.error);
                }
            } else {
                showBuildResult(false, 'Build Failed', 'Server error: ' + xhr.status);
            }
        }
    };

    const customRomName = document.getElementById('rom-name')?.value || 'ROMv5a.rom';

    var data = {
        rom_version: getRomScriptName(romVersion),
        manifest: manifest,
        gbas_source: gbasSource,
        rom_name: customRomName
    };

    xhr.send(JSON.stringify(data));
}

function showBuildResult(success, title, content, buildResponse = null) {
    const modal = document.getElementById('build-result-modal');
    const titleElement = document.getElementById('modal-title');
    const contentElement = document.getElementById('modal-content');
    const buttonContainer = document.querySelector('#build-result-modal .button-container');

    titleElement.textContent = title;
    contentElement.textContent = content;

    // Reset modal structure in case it was modified by Phase 2
    const modalInner = modal.querySelector('div');
    modalInner.style.height = 'calc(100% - 20px)';
    modalInner.style.maxHeight = '';
    contentElement.parentElement.style.flex = '1';
    contentElement.parentElement.style.overflow = 'auto';
    contentElement.style.overflow = 'visible';

    // RESTORE pre formatting for logging display
    contentElement.style.whiteSpace = 'pre-wrap';
    contentElement.style.fontFamily = 'monospace';

    // Scroll to bottom of content
    setTimeout(() => {
        const scrollContainer = contentElement.parentElement;
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }, 0);

    // Create appropriate buttons
    if (success && buildResponse && title !== 'ROM Build Complete') {
        // Two buttons for Phase 2 entry
        buttonContainer.innerHTML = `
            <div style="display: flex; gap: 4%;">
                <button id="modal-back-btn" style="width: 48%; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; background: #6c757d; color: white;">Back</button>
                <button id="modal-continue-btn" style="width: 48%; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; background: #28a745; color: white;">Continue</button>
            </div>`;
        document.getElementById('modal-back-btn').addEventListener('click', hideBuildResult);
        document.getElementById('modal-continue-btn').addEventListener('click', () => showMainmenuEditor(buildResponse));
    } else if (success && buildResponse) {
        // Final ROM build complete - three buttons
        buttonContainer.innerHTML = `
            <div style="display: flex; gap: 2%;">
                <button id="modal-back-btn" style="width: 32%; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; background: #6c757d; color: white;">Back</button>
                <button id="modal-download-btn" style="width: 32%; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; background: #007bff; color: white;">Download</button>
                <button id="modal-emulate-btn" style="width: 32%; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; background: #28a745; color: white;">Emulate</button>
            </div>`;
        document.getElementById('modal-back-btn').addEventListener('click', () => showMainmenuEditor(buildResponse));
        document.getElementById('modal-download-btn').addEventListener('click', () => {
            const romFilePath = buildResponse.rom_file;
            const filename = romFilePath.split('/').pop();
            window.location.href = '/app.php/gigatronrombuilder/download/' + encodeURIComponent(filename);
        });
        document.getElementById('modal-emulate-btn').addEventListener('click', () => {
            const romFilePath = buildResponse.rom_file;
            const filename = romFilePath.split('/').pop();
            window.location.href = '/app.php/gigatronemulator?autoload_rom=' + encodeURIComponent(filename) + '&source=rombuilder';
        });
    } else {
        // Single button for errors and other cases
        buttonContainer.innerHTML = `
            <div style="display: flex;">
                <button id="modal-continue-btn" style="width: 100%; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; background: ${success ? '#28a745' : '#dc3545'}; color: white;">Continue</button>
            </div>`;
        document.getElementById('modal-continue-btn').addEventListener('click', hideBuildResult);
    }

    modal.style.display = 'block';
}

function hideBuildResult() {
    document.getElementById('build-result-modal').style.display = 'none';

    // Re-enable file browser when leaving preview
    if (window.fileBrowser) {
        window.fileBrowser.setReadOnly(false);
    }
}

function showMainmenuEditor(buildResponse) {
    const menuApps = getMenuApps();

    if (menuApps.length === 0) {
        showBuildResult(false, 'Build Failed', 'No apps selected for mainmenu. Please select at least one non-system file.');
        return;
    }

    showPhase2Modal(menuApps, buildResponse);
}

function showPhase2Modal(apps, buildResponse) {
    const modal = document.getElementById('build-result-modal');
    const titleElement = document.getElementById('modal-title');
    const contentElement = document.getElementById('modal-content');
    const romVersion = document.getElementById('base-rom-select').value;
    const buttonContainer = document.querySelector('#build-result-modal .button-container');

    // Override modal structure for Phase 2 - KEEP ORIGINAL SIZE
    const modalInner = modal.querySelector('div');
    modalInner.style.height = 'calc(100% - 20px)';
    modalInner.style.maxHeight = 'none';
    contentElement.parentElement.style.flex = '1';
    contentElement.parentElement.style.overflow = 'visible';
    contentElement.style.overflow = 'visible';

    // FIX: Remove pre tag formatting that causes spacing issues
    contentElement.style.whiteSpace = 'normal';
    contentElement.style.fontFamily = 'inherit';

    // Store original styles to restore later
    contentElement.setAttribute('data-original-whitespace', 'pre-wrap');
    contentElement.setAttribute('data-original-fontfamily', 'monospace');

    titleElement.textContent = 'Mainmenu Editor';

    // Create two-panel layout
    contentElement.innerHTML = createPhase2LayoutHTML(apps, romVersion);
    initializeMainmenuPreview();

    // Phase 2 buttons
    buttonContainer.innerHTML = `
        <div style="display: flex; gap: 4%;">
            <button id="modal-back-btn" style="width: 48%; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; background: #6c757d; color: white;">Back</button>
            <button id="modal-continue-btn" style="width: 48%; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; background: #28a745; color: white;">Build ROM</button>
        </div>`;

    // Add event listeners for module selection
    setupModuleEventListeners();

    // Event listeners for buttons
    document.getElementById('modal-back-btn').addEventListener('click', hideBuildResult);
    document.getElementById('modal-continue-btn').addEventListener('click', () => {buildROM(apps, buildResponse);});

    modal.style.display = 'block';
}
