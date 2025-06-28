class UIManager
{
    constructor()
    {
        this.currentFile = null;
        this.emulatorReady = false;
        this.romLoaded = false;  // Track ROM state

        // If emulator is already created, set ready immediately
        if(emulator && typeof Module !== 'undefined')
        {
            this.emulatorReady = true;
            this.onEmulatorReady();
        }
        else
        {
            // Wait for emulator initialization
            this.waitForEmulator();
        }
    }

    waitForEmulator()
    {
        // Check if Module is available (from emulator.js)
        if(typeof Module !== 'undefined' && Module.onRuntimeInitialized)
        {
            const originalCallback = Module.onRuntimeInitialized;
            Module.onRuntimeInitialized = () =>
            {
                if(originalCallback) originalCallback();
                this.emulatorReady = true;
                this.onEmulatorReady();
            };
        }
        else
        {
            // Module not loaded yet, wait and check again
            setTimeout(() => this.waitForEmulator(), 100);
        }
    }

    onEmulatorReady()
    {
        console.log('UI Manager: Emulator ready');

        // If a file was selected before emulator was ready, load it now
        if(this.currentFile)
        {
            this.loadFileIntoEmulator(this.currentFile);
        }
    }

    onFileSelected(file)
    {
        console.log('UI Manager: File selected', file.filename);
        this.currentFile = file;
        if(this.emulatorReady)
        {
            this.loadFileIntoEmulator(file);
        }
        else
        {
            console.log('UI Manager: Emulator not ready, will load file when ready');
        }
    }

    updateStatusPanel(file, fileType)
    {
        if(fileType === 'rom')
        {
            // Update ROM status
            document.getElementById('status-rom-name').textContent = file.filename;
            document.getElementById('download-rom').style.display = 'flex';
            document.getElementById('download-rom').href = `/ext/at67/gigatronemulator/roms/${file.filename}`;
            document.getElementById('download-rom').download = file.filename;
        }
        else if(fileType === 'gt1')
        {
            // Update GT1 status
            document.getElementById('status-gt1-name').textContent = file.filename;
            document.getElementById('download-gt1').style.display = 'flex';
            document.getElementById('download-gt1').href = `/ext/at67/gigatronemulator/gt1/${file.path}`;
            document.getElementById('download-gt1').download = file.filename;
        }
    }

    updateRamStatus(is64k)
    {
        const ramStatus = document.getElementById('ram-status');
        ramStatus.textContent = is64k ? '64K RAM' : '32K RAM';
    }

    loadFileIntoEmulator(file)
    {
        if(!this.emulatorReady || !emulator)
        {
            console.log('UI Manager: Cannot load file, emulator not ready');
            return;
        }

        console.log(`UI Manager: Loading ${file.filename} into emulator`);

        // Check if trying to load GT1 without ROM
        if(file.filename.endsWith('.gt1') && !this.romLoaded)
        {
            document.getElementById('loading-status').textContent = 'Error: Load a ROM file first before loading GT1 programs';
            return;
        }

        // Stop emulator if running
        if(running)
        {
            stopEmulator();
        }

        // Check for 64K requirement in filename
        if(file.filename.toLowerCase().includes('64k'))
        {
            Module.ccall('emulator_set_64k_mode', null, ['number', 'boolean'], [emulator, true]);
        }
        else
        {
            Module.ccall('emulator_set_64k_mode', null, ['number', 'boolean'], [emulator, false]);
        }

        // Determine file path based on type
        let filePath;
        let fileType;
        if(file.filename.endsWith('.rom'))
        {
            filePath = `/ext/at67/gigatronemulator/roms/${file.filename}`;
            fileType = 'rom';
        }
        else if(file.filename.endsWith('.gt1'))
        {
            filePath = `/ext/at67/gigatronemulator/gt1/${file.path}`;
            fileType = 'gt1';
        }
        else
        {
            console.error('UI Manager: Unknown file type', file.filename);
            return;
        }

        // Load the file
        fetch(filePath)
            .then(response =>
            {
                if(!response.ok)
                {
                    throw new Error(`Failed to load ${file.filename}: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(data =>
            {
                console.log(`UI Manager: Loaded ${file.filename}, size: ${data.byteLength} bytes`);

                let dataPtr = Module._malloc(data.byteLength);
                Module.HEAPU8.set(new Uint8Array(data), dataPtr);

                // Use correct loading function based on file type
                if(fileType === 'rom')
                {
                    Module.ccall('emulator_load_rom', null, ['number', 'number'], [emulator, dataPtr]);

                    // Reset emulator state
                    resetEmulator();
                    setTimeout(() => {startEmulator();}, 100);

                    // Mark ROM as loaded
                    this.romLoaded = true;

                    // Update status panel
                    this.updateStatusPanel(file, 'rom');

                    // Update ROM type UI
                    updateROMTypeUI();

                    console.log(`UI Manager: ROM ${file.filename} loaded successfully`);
                }
                else if(fileType === 'gt1')
                {
                    Module.ccall('emulator_load_gt1', null, ['number', 'number', 'number'], [emulator, dataPtr, data.byteLength]);

                    let is64k = Module.ccall('emulator_get_64k_mode', 'number', ['number'], [emulator]);

                    // Update status panels
                    this.updateStatusPanel(file, 'gt1');
                    this.updateRamStatus(is64k);

                    // Start emulator state
                    setTimeout(() => {startEmulator();}, 100);

                    console.log(`UI Manager: GT1 ${file.filename} loaded successfully - ready to run`);
                }

                Module._free(dataPtr);
                resetAudio();

                // Update status
                document.getElementById('loading-status').textContent = `Loaded: ${file.filename}`;
            })
            .catch(error =>
            {
                console.error('UI Manager: Failed to load file:', error);
                document.getElementById('loading-status').textContent = `Error loading: ${file.filename}`;
            });
    }
}

// Initialize UI manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () =>
{
    window.uiManager = new UIManager();
});
