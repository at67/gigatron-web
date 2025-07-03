document.addEventListener('DOMContentLoaded', function() {
    // Handle back button first (no timing issues)
    handleBackButton();
});

// Handle auto-loading with original timing (separate from DOMContentLoaded)
handleAutoLoading();

function handleBackButton() {
    const urlParams = new URLSearchParams(window.location.search);
    const screenshotMode = urlParams.get('screenshot_mode');
    const referrer = document.referrer;
    const cameFromShowcase = referrer.includes('gigatronshowcase');

    if (cameFromShowcase) {
        const tabContainer = document.querySelector('.file-type-tabs');
        if (tabContainer) {
            const backTab = document.createElement('button');
            backTab.className = 'tab-btn back-tab';

            if (screenshotMode === '1') {
                backTab.textContent = '📷 Screenshot';
                backTab.addEventListener('click', captureScreenshot);
            } else {
                backTab.textContent = '← Back';
                backTab.addEventListener('click', () => {
                    window.history.back();
                });
            }

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
                    }, 2000);
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

function captureScreenshot() {
    console.log('Capturing screenshot...');

    const canvas = document.getElementById('display');
    if (!canvas) {
        alert('Error: Could not find emulator display');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const gt1Path = urlParams.get('autoload_gt1');

    if (!gt1Path) {
        alert('Error: Could not determine GT1 file path');
        return;
    }

    canvas.toBlob(function(blob) {
        if (!blob) {
            alert('Error: Failed to capture screenshot');
            return;
        }

        const formData = new FormData();
        formData.append('screenshot', blob, 'screenshot.png');
        formData.append('gt1_path', gt1Path);

        fetch('/app.php/gigatronshowcase/screenshot/save', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
            .then(data => {
                console.log('Full server response:', JSON.stringify(data, null, 2));

                if (data.success) {
                    console.log('Screenshot saved successfully:', data.filename);
                    window.location.href = document.referrer + '?refresh=' + Date.now();
                } else {
                    console.error('Server error:', data.error);
                    console.log('Debug data:', data.debug);
                    alert('Error saving screenshot: ' + data.error);
                }
            })
        .catch(error => {
            alert('Error uploading screenshot: ' + error.message);
        });

    }, 'image/png');
}
