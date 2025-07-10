let emulator = null;
let running = false;

let targetFrameTime = 17.0;
let intervalId = null;

let lastTime = 0;
let accumulatedTime = 0;
const CYCLES_PER_MS = 6250; // 6.25MHz / 1000

// Button state - bits are 0 when pressed, 1 when idle
let buttonState = 0xFF;
let pressedKeys = new Set();

// Key mappings
const keyMap =
{
    'ArrowLeft': 1,   // bit 1
    'ArrowRight': 0,  // bit 0
    'ArrowDown': 2,   // bit 2
    'ArrowUp': 3,     // bit 3
    'Enter': 4,       // bit 4 - Start
    ' ': 5,           // bit 5 - Select (Space)
    'KeyX': 6,        // bit 6 - B
    'KeyZ': 7         // bit 7 - A
};

function initializeEmulator() {
    console.log("WASM module loaded!");
    emulator = Module.ccall('emulator_create', 'number', [], []);
    console.log("Emulator created:", emulator);

    // Set up keyboard listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Initialize volume display
    updateVolumeDisplay();

    // Notify UI manager that emulator is ready
    if(window.uiManager)
    {
        window.uiManager.emulatorReady = true;
        window.uiManager.onEmulatorReady();
    }
}

// Safe initialization check
if (typeof Module !== 'undefined') {
    // Check if module is already initialized
    if (Module.calledRun || (emulator && emulator !== null)) {
        // Already initialized
        initializeEmulator();
    } else {
        // Module exists but not initialized yet - safe to set callback
        Module.onRuntimeInitialized = initializeEmulator;
    }
} else {
    // Module not loaded yet - this shouldn't happen in emulator-controls.js
    // but we'll handle it gracefully
    setTimeout(() => {
        if (typeof Module !== 'undefined') {
            if (Module.calledRun || (emulator && emulator !== null)) {
                initializeEmulator();
            } else {
                Module.onRuntimeInitialized = initializeEmulator;
            }
        }
    }, 100);
}

function handleKeyDown(event)
{
    // Always prevent default for arrow keys to stop page scrolling
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
    }

    let key = event.code === 'Space' ? ' ' : (event.code.startsWith('Key') ? event.code : event.key);

    // Check if virtual keyboard is active and handle accordingly
    if(window.virtualKeyboard && window.virtualKeyboard.isVisible)
    {
        // Keyboard mode: send ASCII or button presses
        if(!pressedKeys.has(key))
        {
            pressedKeys.add(key);

            const asciiValue = getKeyAsciiValueFromPhysical(event.code, event.key);
            if(asciiValue !== null)
            {
                // Send ASCII value to emulator IN register
                if(emulator && typeof Module !== 'undefined')
                {
                    Module.ccall('emulator_set_input', null, ['number', 'number'], [emulator, asciiValue]);
                }
            }
            else
            {
                // Send button press for navigation/action keys
                const buttonIndex = getPhysicalKeyButtonMapping(event.code);
                if(buttonIndex !== null)
                {
                    buttonDown(buttonIndex);
                }
            }
            event.preventDefault();
        }
    }
    else
    {
        // Controller mode: existing game controller mapping
        if(keyMap.hasOwnProperty(key) && !pressedKeys.has(key))
        {
            pressedKeys.add(key);
            buttonDown(keyMap[key]);
            event.preventDefault();
        }
    }
}

function handleKeyUp(event)
{
    let key = event.code === 'Space' ? ' ' : (event.code.startsWith('Key') ? event.code : event.key);

    // Check if virtual keyboard is active and handle accordingly
    if(window.virtualKeyboard && window.virtualKeyboard.isVisible)
    {
        // Keyboard mode: only handle button releases for navigation/action keys
        if(pressedKeys.has(key))
        {
            pressedKeys.delete(key);

            const asciiValue = getKeyAsciiValueFromPhysical(event.code, event.key);
            if(asciiValue !== null)
            {
                // Send 0xFF IN register
                if(emulator && typeof Module !== 'undefined')
                {
                    Module.ccall('emulator_set_input', null, ['number', 'number'], [emulator, 0xFF]);
                }
            }
            else
            {
                // Send button press for navigation/action keys
                const buttonIndex = getPhysicalKeyButtonMapping(event.code);
                if(buttonIndex !== null)
                {
                    buttonUp(buttonIndex);
                }
            }

            event.preventDefault();
        }
    }
    else
    {
        // Controller mode: existing game controller mapping
        if(keyMap.hasOwnProperty(key) && pressedKeys.has(key))
        {
            pressedKeys.delete(key);
            buttonUp(keyMap[key]);
            event.preventDefault();
        }
    }
}

function getKeyAsciiValueFromPhysical(code, key)
{
    // Get base ASCII value, then apply modifiers from virtual keyboard
    const baseAscii = getBaseAsciiValueFromPhysical(code);
    if(baseAscii === null) return null;

    // Use virtual keyboard's modifier states and logic
    if(window.virtualKeyboard)
    {
        return window.virtualKeyboard.applyModifiers(baseAscii, key);
    }

    return baseAscii;
}

function getBaseAsciiValueFromPhysical(code)
{
    // Base ASCII mappings for physical keyboard (without modifiers)
    const asciiMap =
    {
        // Control codes
        'Tab': 9,
        'Enter': 10,
        'Escape': 27,
        'Backspace': 127,

        // Numbers
        'Digit0': 48, 'Digit1': 49, 'Digit2': 50, 'Digit3': 51, 'Digit4': 52,
        'Digit5': 53, 'Digit6': 54, 'Digit7': 55, 'Digit8': 56, 'Digit9': 57,

        // Letters
        'KeyA': 97, 'KeyB': 98, 'KeyC': 99, 'KeyD': 100, 'KeyE': 101,
        'KeyF': 102, 'KeyG': 103, 'KeyH': 104, 'KeyI': 105, 'KeyJ': 106,
        'KeyK': 107, 'KeyL': 108, 'KeyM': 109, 'KeyN': 110, 'KeyO': 111,
        'KeyP': 112, 'KeyQ': 113, 'KeyR': 114, 'KeyS': 115, 'KeyT': 116,
        'KeyU': 117, 'KeyV': 118, 'KeyW': 119, 'KeyX': 120, 'KeyY': 121,
        'KeyZ': 122,

        // Symbol keys
        'Space': 32,
        'Minus': 45,
        'Equal': 61,
        'BracketLeft': 91,
        'BracketRight': 93,
        'Backslash': 92,
        'Semicolon': 59,
        'Quote': 39,
        'Comma': 44,
        'Period': 46,
        'Slash': 47,
        'Backquote': 96,

        // Function keys (F1-F12 map to 193-204)
        'F1': 193, 'F2': 194, 'F3': 195, 'F4': 196, 'F5': 197, 'F6': 198,
        'F7': 199, 'F8': 200, 'F9': 201, 'F10': 202, 'F11': 203, 'F12': 204,

        // Numpad
        'Numpad0': 48, 'Numpad1': 49, 'Numpad2': 50, 'Numpad3': 51, 'Numpad4': 52,
        'Numpad5': 53, 'Numpad6': 54, 'Numpad7': 55, 'Numpad8': 56, 'Numpad9': 57,
        'NumpadDivide': 47,
        'NumpadMultiply': 42,
        'NumpadSubtract': 45,
        'NumpadAdd': 43,
        'NumpadEnter': 10,
        'NumpadDecimal': 46
    };

    return asciiMap.hasOwnProperty(code) ? asciiMap[code] : null;
}

function getPhysicalKeyButtonMapping(code)
{
    // Keys that send button presses even in keyboard mode
    const buttonMap =
    {
        // Arrow keys
        'ArrowUp': 3,
        'ArrowDown': 2,
        'ArrowLeft': 1,
        'ArrowRight': 0,

        // Navigation keys that act as game buttons
        'Delete': 7,    // buttonA
        'Insert': 6,    // buttonB
        'PageUp': 4,    // buttonStart
        'PageDown': 5   // buttonSelect
    };

    return buttonMap.hasOwnProperty(code) ? buttonMap[code] : null;
}

function buttonDown(bitIndex)
{
    // Clear bit, (pressed = 0)
    buttonState &= ~(1 << bitIndex);
    updateInput();
}

function buttonUp(bitIndex)
{
    // Set bit (released = 1)
    buttonState |= (1 << bitIndex);
    updateInput();
}

function updateInput()
{
    if(emulator)
    {
        Module.ccall('emulator_set_input', null, ['number', 'number'], [emulator, buttonState]);
    }
}

function updateLEDs()
{
    if(!emulator || typeof Module === 'undefined') return;

    try
    {
        // Get XOUT value from emulator
        let xout = Module.ccall('emulator_get_xout', 'number', ['number'], [emulator]);

        // Update each LED based on lower 4 bits of XOUT
        for (let i = 0; i < 4; i++)
        {
            let mask = 1 << i;
            let state = xout & mask;
            let ledElement = document.getElementById(`led-${i}`);

            if(ledElement)
            {
                if(state)
                {
                    ledElement.classList.add('on');
                }
                else
                {
                    ledElement.classList.remove('on');
                }
            }
        }
    }
    catch(error)
    {
        // Silently ignore errors if emulator isn't ready
    }
}

// Filter button state
let currentFilterBits = 4;
let isROMvX0 = false;

// Function to update ROM type and show/hide filter button
function updateROMTypeUI()
{
    if(!emulator || typeof Module === 'undefined') return;

    try
    {
        let romType = Module.ccall('emulator_get_rom_type', 'number', ['number'], [emulator]);
        isROMvX0 = (romType === 0x80);

        const filterBtn = document.getElementById('filter-btn');
        const volumeDots = document.querySelectorAll('.volume-dot');

        if(isROMvX0)
        {
            // Show filter button and make volume bar smaller
            filterBtn.style.display = 'flex';
            volumeDots.forEach(dot =>
            {
                dot.style.width = '1.5px';
                dot.style.height = '1.5px';
            });

            // Reset ROMvX0 filter bits to 4, (inverse bit mask)
            Module.ccall('emulator_set_ram', null, ['number', 'number', 'number'], [emulator, 8, 0x0F]);
        }
        else
        {
            // Hide filter button and restore normal volume bar
            filterBtn.style.display = 'none';
            volumeDots.forEach(dot =>
            {
                dot.style.width = '2px';
                dot.style.height = '2px';
            });
        }
    }
    catch(error)
    {
        // Silently ignore if emulator not ready
    }
}

// Function to toggle filter bits
function toggleFilter()
{
    if(!isROMvX0 || !emulator) return;

    // Cycle through 4 to 8
    currentFilterBits++;
    if(currentFilterBits > 8) currentFilterBits = 4;

    // Update button display
    document.getElementById('filter-btn').textContent = currentFilterBits;

    // Calculate inverse mask
    let inverseMask;
    switch(currentFilterBits)
    {
        case 4: inverseMask = 0x0F; break;
        case 5: inverseMask = 0x07; break;
        case 6: inverseMask = 0x03; break;
        case 7: inverseMask = 0x01; break;
        case 8: inverseMask = 0x00; break;
    }

    // Write to ROMvX0 audio bit mask
    Module.ccall('emulator_set_ram', null, ['number', 'number', 'number'], [emulator, 8, inverseMask]);
}

function startEmulator()
{
    if(!emulator || running) return;
    running = true;

    // Fill audio ring buffer to stop startup glitches
    for(let i=0; i<4; i++)
    {
        Module.ccall('emulator_run_to_vblank', null, ['number'], [emulator]);
    }

    initAudio();

    if(audioContext.state === 'suspended')
    {
        audioContext.resume();
    }

    intervalId = requestAnimationFrame(runLoop);

    console.log("Starting emulator...");
}

function stopEmulator()
{
    running = false;

    if(intervalId)
    {
        cancelAnimationFrame(intervalId);
        intervalId = null;
    }
    console.log("Emulator stopped");
}

function resetEmulator()
{
    if(!emulator) return;

    console.log("Resetting emulator...");

    // Clear file browser selection
    if(window.fileBrowser.currentFileType === 'gt1')
    {
        window.fileBrowser.selectedFile = null;
        window.fileBrowser.renderFileTree();
    }

    buttonState = 0xFF;
    pressedKeys.clear();

    // Reset filter state
    currentFilterBits = 4;
    const filterBtn = document.getElementById('filter-btn');
    if(filterBtn) filterBtn.textContent = '4';

    Module.ccall('emulator_reset', null, ['number'], [emulator]);
    resetAudio();

    // Update RAM status in new status panel
    const is64k = Module.ccall('emulator_get_64k_mode', 'number', ['number'], [emulator]);
    const ramStatus = document.getElementById('ram-status');
    ramStatus.textContent = is64k ? '64K RAM' : '32K RAM';

    // Reset GT1 status text
    document.getElementById('status-gt1-name').textContent = 'No GT1';
    document.getElementById('download-gt1').style.display = 'none';

    // Clear GT1 selection and collapse tree if we're viewing GT1 tab
    if(window.fileBrowser && window.fileBrowser.currentFileType === 'gt1')
    {
        window.fileBrowser.selectedFile = null;
        window.fileBrowser.applySearch(); // This will collapse everything since no search and no selection
    }

    console.log("Reset complete - select a ROM/GT1 file to load");
}

function runLoop(currentTime)
{
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Skip first few frames until timing settles
    if(deltaTime > 18)
    {
        resetAudio();
        console.log(`Skipping frame with large delta: ${deltaTime.toFixed(2)}ms`);
        intervalId = requestAnimationFrame(runLoop);
        return;
    }

    // Run emulation for actual elapsed time
    accumulatedTime += deltaTime;
    const cyclesToRun = Math.floor(accumulatedTime * CYCLES_PER_MS);
    Module.ccall('emulator_run', null, ['number', 'number'], [emulator, cyclesToRun]);

    // Update display
    let fbPtr = Module.ccall('emulator_get_framebuffer', 'number', ['number'], [emulator]);
    let fb = new Uint8Array(Module.HEAPU8.buffer, fbPtr, 640 * 480 * 4);
    let canvas = document.getElementById('display');
    let ctx = canvas.getContext('2d');
    let imageData = ctx.createImageData(640, 480);
    imageData.data.set(fb);
    ctx.putImageData(imageData, 0, 0);

    // Update audio on vBlank
    if(Module.ccall('emulator_get_vblank', 'number', ['number'], [emulator])) updateAudio();

    updateLEDs();

    accumulatedTime = 0;

    intervalId = requestAnimationFrame(runLoop);
}
