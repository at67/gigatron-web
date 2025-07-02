document.addEventListener('DOMContentLoaded', function() {
    // Handle back button first (no timing issues)
    handleBackButton();
});

// Handle auto-loading with original timing (separate from DOMContentLoaded)
handleAutoLoading();

function handleBackButton() {
    const referrer = document.referrer;
    const cameFromShowcase = referrer.includes('gigatronshowcase');

    if (cameFromShowcase) {
        const tabContainer = document.querySelector('.file-type-tabs');
        if (tabContainer) {
            const backTab = document.createElement('button');
            backTab.textContent = '← Back';
            backTab.className = 'tab-btn back-tab';

            backTab.addEventListener('click', () => {
                window.history.back();
            });

            tabContainer.appendChild(backTab);
        }
    }
}

function handleAutoLoading() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const autoloadRom = urlParams.get('autoload_rom');
    const autoloadGt1 = urlParams.get('autoload_gt1');

    if (autoloadRom || autoloadGt1) {
        console.log('Auto-loading files from URL parameters');

        function waitForManagers() {
            if (window.uiManager && window.uiManager.emulatorReady &&
                window.fileBrowser && window.fileBrowser.files) {
                autoLoadFiles();
            } else {
                setTimeout(waitForManagers, 100);
            }
        }

        function autoLoadFiles() {
            if (autoloadRom) {
                console.log('Auto-loading ROM:', autoloadRom);
                const romFile = window.fileBrowser.files.rom.find(f => f.filename === autoloadRom);
                if (romFile) {
                    window.fileBrowser.switchFileType('rom');
                    window.fileBrowser.selectFile(romFile);
                }

                if (autoloadGt1) {
                    setTimeout(() => {
                        console.log('Auto-loading GT1:', autoloadGt1);
                        const gt1File = window.fileBrowser.files.gt1.find(f => f.path === autoloadGt1);
                        if (gt1File) {
                            window.uiManager.onFileSelected(gt1File);
                        }
                    }, 1000);
                }
            } else if (autoloadGt1) {
                console.log('Auto-loading GT1:', autoloadGt1);
                const gt1File = window.fileBrowser.files.gt1.find(f => f.path === autoloadGt1);
                if (gt1File) {
                    window.uiManager.onFileSelected(gt1File);
                }
            }
        }

        waitForManagers();
    }
}
