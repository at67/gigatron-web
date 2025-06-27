class VirtualKeyboard
{
    constructor()
    {
        this.isVisible = false;
        this.pressedKeys = new Set();
        this.modifierStates =
        {
            shift: false,
            capsLock: false,
            leftShift: false,
            rightShift: false
        };
        this.initializeKeyboard();
        this.setupEventListeners();
    }

    initializeKeyboard()
    {
        this.createKeyboardHTML();
    }

    createKeyboardHTML()
    {
        const keyboardContainer = document.createElement('div');
        keyboardContainer.id = 'virtual-keyboard';
        keyboardContainer.className = 'virtual-keyboard hidden';

        // Function Keys Row
        const functionRow = this.createRow('function-row', [
            'Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
        ]);

        // Number Row
        const numberRow = this.createRow('number-row', [
            '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { key: 'BKS', width: 1.75 }
        ]);

        // QWERTY Row
        const qwertyRow = this.createRow('qwerty-row', [
            { key: 'Tab', width: 1.5 }, 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { key: '\\', width: 1.5 }
        ]);

        // ASDF Row
        const asdfRow = this.createRow('asdf-row', [
            { key: 'Caps', width: 1.75 }, 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { key: 'Enter', width: 2.25 }
        ]);

        // ZXCV Row
        const zxcvRow = this.createRow('zxcv-row', [
            { key: 'Shift', width: 2.25 }, 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { key: 'Shift', width: 2.75 }
        ]);

        // Bottom Row
        const bottomRow = this.createRow('bottom-row', [
            { key: 'Ctrl', width: 1.25 }, { key: 'Win', width: 1.25 }, { key: 'Alt', width: 1.25 },
            { key: 'Space', width: 6 }, { key: 'Alt', width: 1.25 }, { key: 'Win', width: 1.25 },
            { key: 'Ctrl', width: 1.25 }
        ]);

        // Main keyboard section
        const mainKeyboard = document.createElement('div');
        mainKeyboard.className = 'main-keyboard';
        mainKeyboard.appendChild(functionRow);
        mainKeyboard.appendChild(numberRow);
        mainKeyboard.appendChild(qwertyRow);
        mainKeyboard.appendChild(asdfRow);
        mainKeyboard.appendChild(zxcvRow);
        mainKeyboard.appendChild(bottomRow);

        // Arrow keys section
        const arrowKeys = this.createArrowKeys();

        // Numpad section
        const numpad = this.createNumpad();

        keyboardContainer.appendChild(mainKeyboard);
        keyboardContainer.appendChild(arrowKeys);
        keyboardContainer.appendChild(numpad);

        // Insert after controls div
        const controls = document.querySelector('.controls');
        controls.parentNode.insertBefore(keyboardContainer, controls.nextSibling);
    }

    createRow(className, keys)
    {
        const row = document.createElement('div');
        row.className = `key-row ${className}`;

        keys.forEach(keyDef =>
        {
            const key = typeof keyDef === 'string' ? { key: keyDef, width: 1 } : keyDef;
            const keyElement = this.createKey(key.key, key.width);
            row.appendChild(keyElement);
        });

        return row;
    }

    createKey(keyText, width = 1)
    {
        const key = document.createElement('button');
        key.className = 'virtual-key';
        key.textContent = keyText;
        key.style.flex = width;
        key.dataset.key = keyText;

        return key;
    }

    createArrowKeys()
    {
        const navSection = document.createElement('div');
        navSection.className = 'nav-keys';

        // Row 1: Function-level keys
        const row1 = document.createElement('div');
        row1.className = 'nav-row';
        row1.appendChild(this.createKey('Prt', 1));
        row1.appendChild(this.createKey('Scr', 1));
        row1.appendChild(this.createKey('Pause', 1));

        // Row 2: Navigation keys
        const row2 = document.createElement('div');
        row2.className = 'nav-row';
        row2.appendChild(this.createKey('Ins', 1));
        row2.appendChild(this.createKey('Home', 1));
        row2.appendChild(this.createKey('PgUp', 1));

        // Row 3: Navigation keys
        const row3 = document.createElement('div');
        row3.className = 'nav-row';
        row3.appendChild(this.createKey('Del', 1));
        row3.appendChild(this.createKey('End', 1));
        row3.appendChild(this.createKey('PgDn', 1));

        // Row 4: Extra keys
        const row4 = document.createElement('div');
        row4.className = 'nav-row';
        row4.appendChild(this.createKey('Menu', 1));
        row4.appendChild(this.createKey('App', 1));
        row4.appendChild(this.createKey('Fn', 1));

        // Row 5: Arrow Up (centered)
        const row5 = document.createElement('div');
        row5.className = 'nav-row';
        const spacer1 = document.createElement('div');
        spacer1.style.flex = '1';
        const upKey = this.createKey('↑', 1);
        const spacer2 = document.createElement('div');
        spacer2.style.flex = '1';
        row5.appendChild(spacer1);
        row5.appendChild(upKey);
        row5.appendChild(spacer2);

        // Row 6: Arrow keys
        const row6 = document.createElement('div');
        row6.className = 'nav-row';
        row6.appendChild(this.createKey('←', 1));
        row6.appendChild(this.createKey('↓', 1));
        row6.appendChild(this.createKey('→', 1));

        navSection.appendChild(row1);
        navSection.appendChild(row2);
        navSection.appendChild(row3);
        navSection.appendChild(row4);
        navSection.appendChild(row5);
        navSection.appendChild(row6);

        return navSection;
    }

    createNumpad()
    {
        const numpad = document.createElement('div');
        numpad.className = 'numpad';

        // 6 row numpad layout - no wasted space
        const numpadKeys = [
            ['NUM', '/', '*', '-'],
            ['7', '8', '9', '+'],
            ['4', '5', '6', '+'],
            ['1', '2', '3', 'Ent'],
            [{ key: '0', width: 2 }, '.', 'Ent'],
            ['00', 'Del', 'Ins']
        ];

        numpadKeys.forEach((row) =>
        {
            const rowElement = document.createElement('div');
            rowElement.className = 'numpad-row';

            row.forEach(keyDef =>
            {
                const key = typeof keyDef === 'string' ? { key: keyDef, width: 1 } : keyDef;
                const keyElement = this.createKey(key.key, key.width);
                rowElement.appendChild(keyElement);
            });

            numpad.appendChild(rowElement);
        });

        return numpad;
    }

    setupEventListeners()
    {
        // Virtual key mouse events
        document.addEventListener('mousedown', (e) =>
        {
            if(e.target.classList.contains('virtual-key'))
            {
                const key = e.target.dataset.key;
                this.handleVirtualKeyDown(key);
                e.target.classList.add('pressed');
                e.preventDefault();
            }
        });

        document.addEventListener('mouseup', (e) =>
        {
            if(e.target.classList.contains('virtual-key'))
            {
                const key = e.target.dataset.key;
                this.handleVirtualKeyUp(key);
                e.target.classList.remove('pressed');
                e.preventDefault();
            }
        });

        // Touch events
        document.addEventListener('touchstart', (e) =>
        {
            if(e.target.classList.contains('virtual-key'))
            {
                const key = e.target.dataset.key;
                this.handleVirtualKeyDown(key);
                e.target.classList.add('pressed');
                e.preventDefault();
            }
        });

        document.addEventListener('touchend', (e) =>
        {
            if(e.target.classList.contains('virtual-key'))
            {
                const key = e.target.dataset.key;
                this.handleVirtualKeyUp(key);
                e.target.classList.remove('pressed');
                e.preventDefault();
            }
        });

        // Physical keyboard events for visual feedback
        document.addEventListener('keydown', (e) =>
        {
            if(this.isVisible)
            {
                this.updateModifierState(e.code, true);

                const virtualKey = this.mapPhysicalToVirtual(e.code, e.key);
                if(virtualKey)
                {
                    this.setVirtualKeyPressed(virtualKey, true);
                }
            }
        });

        document.addEventListener('keyup', (e) =>
        {
            if(this.isVisible)
            {
                this.updateModifierState(e.code, false);

                const virtualKey = this.mapPhysicalToVirtual(e.code, e.key);
                if(virtualKey)
                {
                    this.setVirtualKeyPressed(virtualKey, false);
                }
            }
        });
    }

    handleVirtualKeyDown(key)
    {
        // Handle modifier keys first
        if(key === 'Shift')
        {
            this.modifierStates.shift = true;
            this.updateShiftVisual();
            return;
        }

        if(key === 'Caps')
        {
            this.modifierStates.capsLock = !this.modifierStates.capsLock;
            this.updateCapsLockVisual();
            return;
        }

        if(this.isVisible)
        {
            // Keyboard mode: send ASCII or button presses
            const asciiValue = this.getKeyAsciiValue(key);
            if(asciiValue !== null)
            {
                this.sendAsciiToEmulator(asciiValue);
            }
            else
            {
                const buttonIndex = this.getKeyButtonMapping(key);
                if(buttonIndex !== null && typeof buttonDown === 'function')
                {
                    if(!this.pressedKeys.has(key))
                    {
                        this.pressedKeys.add(key);
                        buttonDown(buttonIndex);
                    }
                }
            }
        }
        else
        {
            // Controller mode
            if(!this.pressedKeys.has(key))
            {
                this.pressedKeys.add(key);
                const mappedKey = this.mapVirtualKeyToEmulator(key);
                if(mappedKey && typeof handleKeyDown === 'function')
                {
                    const syntheticEvent =
                    {
                        code: mappedKey.startsWith('Key') ? mappedKey : mappedKey,
                        key: mappedKey === ' ' ? ' ' : key,
                        preventDefault: () => {}
                    };
                    handleKeyDown(syntheticEvent);
                }
            }
        }
    }

    handleVirtualKeyUp(key)
    {
        // Handle modifier keys
        if(key === 'Shift')
        {
            this.modifierStates.shift = false;
            this.updateShiftVisual();
            return;
        }

        if(key === 'Caps')
        {
            return;
        }

        if(this.isVisible)
        {
            // Keyboard mode: send 0xFF or button presses
            const asciiValue = this.getKeyAsciiValue(key);
            if(asciiValue !== null)
            {
                this.sendAsciiToEmulator(0xFF);
            }
            else
            {
                const buttonIndex = this.getKeyButtonMapping(key);
                if(buttonIndex !== null && typeof buttonDown === 'function')
                {
                    if(this.pressedKeys.has(key))
                    {
                        this.pressedKeys.delete(key);
                        buttonUp(buttonIndex);
                    }
                }
            }
        }
        else
        {
            // Controller mode
            if(this.pressedKeys.has(key))
            {
                this.pressedKeys.delete(key);
                const mappedKey = this.mapVirtualKeyToEmulator(key);
                if(mappedKey && typeof handleKeyUp === 'function')
                {
                    const syntheticEvent =
                    {
                        code: mappedKey.startsWith('Key') ? mappedKey : mappedKey,
                        key: mappedKey === ' ' ? ' ' : key,
                        preventDefault: () => {}
                    };
                    handleKeyUp(syntheticEvent);
                }
            }
        }
    }

    updateModifierState(code, pressed)
    {
        switch (code)
        {
            case 'ShiftLeft':
                this.modifierStates.leftShift = pressed;
                break;
            case 'ShiftRight':
                this.modifierStates.rightShift = pressed;
                break;
            case 'CapsLock':
                if(pressed)
            {
                    this.modifierStates.capsLock = !this.modifierStates.capsLock;
                    this.updateCapsLockVisual();
                }
                break;
        }

        this.modifierStates.shift = this.modifierStates.leftShift || this.modifierStates.rightShift;
        this.updateShiftVisual();
    }

    updateShiftVisual()
    {
        const shiftKeys = document.querySelectorAll('[data-key="Shift"]');
        shiftKeys.forEach(key =>
        {
            if(this.modifierStates.shift)
                              {
                key.classList.add('modifier-active');
            }
            else
            {
                key.classList.remove('modifier-active');
            }
        });
    }

    updateCapsLockVisual()
    {
        const capsKeys = document.querySelectorAll('[data-key="Caps"]');
        capsKeys.forEach(key =>
        {
            if(this.modifierStates.capsLock)
                             {
                key.classList.add('modifier-active');
            }
            else
            {
                key.classList.remove('modifier-active');
            }
        });
    }

    getKeyAsciiValue(key)
    {
        const baseAscii = this.getBaseAsciiValue(key);
        if(baseAscii === null) return null;

        return this.applyModifiers(baseAscii, key);
    }

    getBaseAsciiValue(key)
    {
        const asciiMap =
        {
            // Control codes
            'Tab': 9,
            'Enter': 10,
            'Esc': 27,
            'BKS': 127,
            'Space': 32,

            // Numbers
            '0': 48, '1': 49, '2': 50, '3': 51, '4': 52,
            '5': 53, '6': 54, '7': 55, '8': 56, '9': 57,

            // Letters (lowercase)
            'A': 97, 'B': 98, 'C': 99, 'D': 100, 'E': 101,
            'F': 102, 'G': 103, 'H': 104, 'I': 105, 'J': 106,
            'K': 107, 'L': 108, 'M': 109, 'N': 110, 'O': 111,
            'P': 112, 'Q': 113, 'R': 114, 'S': 115, 'T': 116,
            'U': 117, 'V': 118, 'W': 119, 'X': 120, 'Y': 121,
            'Z': 122,

            // Symbols
            '-': 45, '=': 61, '[': 91, ']': 93, '\\': 92,
            ';': 59, "'": 39, ',': 44, '.': 46, '/': 47, '`': 96,

            // Function keys
            'F1': 193, 'F2': 194, 'F3': 195, 'F4': 196, 'F5': 197, 'F6': 198,
            'F7': 199, 'F8': 200, 'F9': 201, 'F10': 202, 'F11': 203, 'F12': 204
        };

        return asciiMap.hasOwnProperty(key) ? asciiMap[key] : null;
    }

    applyModifiers(baseAscii, key)
    {
        // Letters: Caps Lock XOR Shift = uppercase
        if(baseAscii >= 97 && baseAscii <= 122)
        {
            if(this.modifierStates.capsLock !== this.modifierStates.shift)
            {
                return baseAscii - 32;
            }
            return baseAscii;
        }

        // Shift symbols
        if(this.modifierStates.shift)
        {
            const shiftMap =
            {
                49: 33, 50: 64, 51: 35, 52: 36, 53: 37, 54: 94, 55: 38, 56: 42, 57: 40, 48: 41,
                45: 95, 61: 43, 91: 123, 93: 125, 92: 124, 59: 58, 39: 34, 44: 60, 46: 62, 47: 63, 96: 126
            };
            return shiftMap[baseAscii] || baseAscii;
        }

        return baseAscii;
    }

    getKeyButtonMapping(key)
    {
        const buttonMap =
        {
            // Arrow keys
            '↑': 3, '↓': 2, '←': 1, '→': 0,
            // Navigation keys that map to game buttons
            'Del': 7, 'End': 7,    // buttonA
            'Ins': 6, 'Home': 6,   // buttonB
            'PgUp': 4,             // buttonStart
            'PgDn': 5              // buttonSelect
        };

        return buttonMap.hasOwnProperty(key) ? buttonMap[key] : null;
    }

    sendAsciiToEmulator(asciiValue)
    {
        if(emulator && typeof Module !== 'undefined')
        {
            Module.ccall('emulator_set_input', null, ['number', 'number'], [emulator, asciiValue]);
        }
    }

    mapVirtualKeyToEmulator(virtualKey)
    {
        const keyMapping =
        {
            'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight',
            'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown',
            'Z': 'KeyZ', 'X': 'KeyX', 'Space': ' ', 'Enter': 'Enter',
            'A': 'KeyA', 'B': 'KeyB', 'C': 'KeyC', 'D': 'KeyD', 'E': 'KeyE',
            'F': 'KeyF', 'G': 'KeyG', 'H': 'KeyH', 'I': 'KeyI', 'J': 'KeyJ',
            'K': 'KeyK', 'L': 'KeyL', 'M': 'KeyM', 'N': 'KeyN', 'O': 'KeyO',
            'P': 'KeyP', 'Q': 'KeyQ', 'R': 'KeyR', 'S': 'KeyS', 'T': 'KeyT',
            'U': 'KeyU', 'V': 'KeyV', 'W': 'KeyW', 'Y': 'KeyY'
        };

        return keyMapping[virtualKey] || virtualKey;
    }

    mapPhysicalToVirtual(code, key)
    {
        const physicalToVirtualMap =
        {
            'KeyA': 'A', 'KeyB': 'B', 'KeyC': 'C', 'KeyD': 'D', 'KeyE': 'E',
            'KeyF': 'F', 'KeyG': 'G', 'KeyH': 'H', 'KeyI': 'I', 'KeyJ': 'J',
            'KeyK': 'K', 'KeyL': 'L', 'KeyM': 'M', 'KeyN': 'N', 'KeyO': 'O',
            'KeyP': 'P', 'KeyQ': 'Q', 'KeyR': 'R', 'KeyS': 'S', 'KeyT': 'T',
            'KeyU': 'U', 'KeyV': 'V', 'KeyW': 'W', 'KeyX': 'X', 'KeyY': 'Y',
            'KeyZ': 'Z', 'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4',
            'Digit5': '5', 'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9',
            'Digit0': '0', 'Space': 'Space', 'Enter': 'Enter', 'Tab': 'Tab',
            'Escape': 'Esc', 'Backspace': 'BKS', 'F1': 'F1', 'F2': 'F2', 'F3': 'F3',
            'F4': 'F4', 'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8', 'F9': 'F9',
            'F10': 'F10', 'F11': 'F11', 'F12': 'F12', 'Minus': '-', 'Equal': '=',
            'BracketLeft': '[', 'BracketRight': ']', 'Backslash': '\\', 'Semicolon': ';',
            'Quote': "'", 'Comma': ',', 'Period': '.', 'Slash': '/', 'Backquote': '`',
            'Delete': 'Del', 'Insert': 'Ins'
        };

        if(physicalToVirtualMap[code])
        {
            return physicalToVirtualMap[code];
        }

        if(key.length === 1)
        {
            return key;
        }

        return null;
    }

    setVirtualKeyPressed(virtualKey, pressed)
    {
        const virtualKeyElements = document.querySelectorAll(`[data-key="${virtualKey}"]`);
        virtualKeyElements.forEach(element =>
        {
            if(pressed)
            {
                element.classList.add('pressed');
            }
            else
            {
                element.classList.remove('pressed');
            }
        });
    }

    updateInputModeDisplay()
    {
        const toggleBtn = document.getElementById('input-mode-toggle');

        if(toggleBtn)
        {
            toggleBtn.textContent = this.isVisible ? '⌨️' : '🎮';
        }
    }

    toggle()
    {
        this.isVisible = !this.isVisible;
        const keyboard = document.getElementById('virtual-keyboard');
        const controls = document.querySelector('.controls');

        if(this.isVisible)
        {
            keyboard.classList.remove('hidden');
            controls.classList.add('hidden');
        }
        else
        {
            keyboard.classList.add('hidden');
            controls.classList.remove('hidden');
        }

        this.updateInputModeDisplay();

        this.updateHelpPanel();
    }

    hide()
    {
        this.isVisible = false;
        const keyboard = document.getElementById('virtual-keyboard');
        const controls = document.querySelector('.controls');

        keyboard.classList.add('hidden');
        controls.classList.remove('hidden');

        const toggleBtn = document.getElementById('input-mode-toggle');
        const label = document.getElementById('input-mode-label');

        this.updateInputModeDisplay();

        this.updateHelpPanel();
    }

    show()
    {
        this.isVisible = true;
        const keyboard = document.getElementById('virtual-keyboard');
        const controls = document.querySelector('.controls');

        keyboard.classList.remove('hidden');
        controls.classList.add('hidden');

        this.updateInputModeDisplay();

        this.updateHelpPanel();
    }

    updateHelpPanel()
    {
        const helpPanel = document.querySelector('.keyboard-info');
        if(!helpPanel) return;

        if(this.isVisible)
        {
            helpPanel.innerHTML = `
                <strong>Keyboard Controls:</strong><br>
                Arrow Keys = D-Pad | Delete = A Button | Insert = B Button<br>
                Page Up = Start | Page Down = Select
            `;
        }
        else
        {
            helpPanel.innerHTML = `
                <strong>Keyboard Controls:</strong><br>
                Arrow Keys = D-Pad | Z = A Button | X = B Button<br>
                Space = Select | Enter = Start
            `;
        }
    }
}

// Global function
function toggleInputMode()
{
    if(window.virtualKeyboard)
    {
        window.virtualKeyboard.toggle();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () =>
{
    window.virtualKeyboard = new VirtualKeyboard();
});
