// Access build functions
window.buildROM = window.buildROM || buildROM;

function setupMainmenuPreview() {
    const canvas = document.getElementById('preview-canvas');
    const ctx = canvas.getContext('2d');
    let selectedItemIndex = -1;
    let selectedType = 'menu'; // 'menu' or 'decorative'
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let columnColors = ['#00ff00', '#ffff00', '#ffa500', '#00ffff', '#ff69b4', '#ff0000', '#0000ff', '#800080', '#ffc0cb', '#90ee90'];
    let maxColumns = 10;

    // Expose to global scope
    window.navigationMode = window.navigationMode || 'grid';
    window.navigationColumns = [];

    // Setup canvas
    ctx.imageSmoothingEnabled = false;

    // Event listeners
    setupControlEvents();
    setupCanvasEvents();

    // Initial render
    renderPreview();

    function addToNewColumn(itemIndex) {
        if (window.navigationColumns.length >= maxColumns) {
            return; // Max columns reached
        }

        // Remove item from any existing column first
        removeFromColumn(itemIndex);

        // Create new column with this item
        window.navigationColumns.push([itemIndex]);
    }

    function addToExistingColumn(itemIndex) {
        if (window.navigationColumns.length === 0) {
            // No columns exist, create first one
            addToNewColumn(itemIndex);
            return;
        }

        // Remove item from any existing column first
        removeFromColumn(itemIndex);

        // Add to the last column
        const lastColumnIndex = window.navigationColumns.length - 1;
        window.navigationColumns[lastColumnIndex].push(itemIndex);
    }

    function removeFromColumn(itemIndex) {
        for (let colIndex = 0; colIndex < window.navigationColumns.length; colIndex++) {
            const itemPosition = window.navigationColumns[colIndex].indexOf(itemIndex);
            if (itemPosition !== -1) {
                window.navigationColumns[colIndex].splice(itemPosition, 1);

                // Remove empty columns
                if (window.navigationColumns[colIndex].length === 0) {
                    window.navigationColumns.splice(colIndex, 1);
                }
                break;
            }
        }
    }

    function getItemColumnInfo(itemIndex) {
        for (let colIndex = 0; colIndex < window.navigationColumns.length; colIndex++) {
            const itemPosition = window.navigationColumns[colIndex].indexOf(itemIndex);
            if (itemPosition !== -1) {
                return { columnIndex: colIndex, position: itemPosition };
            }
        }
        return null;
    }

    function setupControlEvents() {
        // Default color - applies to ALL items
        document.getElementById('default-color').addEventListener('change', (e) => {
            const originalColor = e.target.value;
            const gigatronColor = hexToGigatronColor(originalColor);
            const roundedColor = gigatronColorToHex(gigatronColor);
            e.target.value = roundedColor;
            menuConfig.defaultColor = roundedColor;

            // Apply to all existing items
            menuConfig.items.forEach(item => {
                item.color = roundedColor;
            });

            // Update selected item color picker if item is selected
            if (selectedItemIndex >= 0) {
                document.getElementById('selected-color').value = roundedColor;
            }

            renderPreview();
        });

        // Color controls
        document.getElementById('selected-color').addEventListener('change', (e) => {
            if (selectedItemIndex >= 0) {
                const originalColor = e.target.value;
                const gigatronColor = hexToGigatronColor(originalColor);
                const roundedColor = gigatronColorToHex(gigatronColor);
                e.target.value = roundedColor;

                if (selectedType === 'menu') {
                    menuConfig.items[selectedItemIndex].color = roundedColor;
                } else {
                    menuConfig.decorativeText[selectedItemIndex].color = roundedColor;
                }
                renderPreview();
            }
        });

        document.getElementById('bg-color').addEventListener('change', (e) => {
            const originalColor = e.target.value;
            const gigatronColor = hexToGigatronColor(originalColor);
            const roundedColor = gigatronColorToHex(gigatronColor);
            e.target.value = roundedColor;
            menuConfig.backgroundColor = roundedColor;
            renderPreview();
        });

        document.getElementById('cursor-color').addEventListener('change', (e) => {
            const originalColor = e.target.value;
            const gigatronColor = hexToGigatronColor(originalColor);
            const roundedColor = gigatronColorToHex(gigatronColor);
            e.target.value = roundedColor;
            menuConfig.cursor.color = roundedColor;
            renderPreview();
        });

        document.getElementById('cursor-bg-color').addEventListener('change', (e) => {
            const originalColor = e.target.value;
            const gigatronColor = hexToGigatronColor(originalColor);
            const roundedColor = gigatronColorToHex(gigatronColor);
            e.target.value = roundedColor;
            menuConfig.cursor.backgroundColor = roundedColor;
            renderPreview();
        });

        // Add decorative text
        document.getElementById('add-text-btn').addEventListener('click', () => {
            const defaultColor = document.getElementById('default-color').value;

            menuConfig.decorativeText.push({
                text: 'New Text',
                x: 80,
                y: 60,
                color: defaultColor,
                visible: true
            });

            renderPreview();
        });

        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            reset();
        });

        // Auto Grid checkbox
        document.getElementById('auto-grid').addEventListener('change', (e) => {
            const enabled = e.target.checked;
            autoGridEnabled = enabled;
            document.getElementById('grid-size-x').disabled = !enabled;
            document.getElementById('grid-offset-x').disabled = !enabled;
            document.getElementById('grid-offset-y').disabled = !enabled;

            // Show/hide sliders based on state
            const display = enabled ? 'block' : 'none';
            document.getElementById('grid-size-x').style.display = display;
            document.getElementById('grid-size-x-value').style.display = display;
            document.getElementById('grid-offset-x').style.display = display;
            document.getElementById('grid-offset-x-value').style.display = display;
            document.getElementById('grid-offset-y').style.display = display;
            document.getElementById('grid-offset-y-value').style.display = display;

            if (enabled) {
              // Restore saved values for grid size and Y offset
              document.getElementById('grid-size-x').value = menuConfig.gridCols;
              document.getElementById('grid-size-x-value').textContent = menuConfig.gridCols;
              document.getElementById('grid-offset-y').value = menuConfig.gridOffsetY;
              document.getElementById('grid-offset-y-value').textContent = menuConfig.gridOffsetY;
              document.getElementById('grid-size-x').max = menuConfig.gridMaxCols;

              // Always calculate grid X gap
              calculateGridXGap();
              regenerateAutoGrid();
            }
        });

        // Properties panel
        document.getElementById('selected-text').addEventListener('input', (e) => {
            if (selectedItemIndex >= 0) {
                if (selectedType === 'menu') {
                    menuConfig.items[selectedItemIndex].text = e.target.value;

                    // Re-sort after text change (but not if any text is empty)
                    if (!menuConfig.items.some(item => item.text === '')) {
                      menuConfig.items.sort((a, b) => a.text.localeCompare(b.text, undefined, {
                          numeric: true,
                          sensitivity: 'base'
                      }));
                    }

                    // Recalculate grid offset X if auto grid enabled
                    if (autoGridEnabled) {
                      calculateGridXGap();
                      regenerateAutoGrid();
                    }
                } else {
                    menuConfig.decorativeText[selectedItemIndex].text = e.target.value;
                }

                renderPreview();
            }
        });

        document.getElementById('selected-x').addEventListener('input', (e) => {
            if (selectedItemIndex >= 0) {
                if (selectedType === 'menu') {
                    menuConfig.items[selectedItemIndex].x = parseInt(e.target.value);
                } else {
                    menuConfig.decorativeText[selectedItemIndex].x = parseInt(e.target.value);
                }
                renderPreview();
            }
        });

        document.getElementById('selected-y').addEventListener('input', (e) => {
            if (selectedItemIndex >= 0) {
                if (selectedType === 'menu') {
                    menuConfig.items[selectedItemIndex].y = parseInt(e.target.value);
                } else {
                    menuConfig.decorativeText[selectedItemIndex].y = parseInt(e.target.value);
                }
                renderPreview();
            }
        });

        document.getElementById('delete-item-btn').addEventListener('click', () => {
            if (selectedItemIndex >= 0) {
                if (selectedType === 'menu') {
                    menuConfig.items.splice(selectedItemIndex, 1);

                    // Re-sort after deletion
                    menuConfig.items.sort((a, b) => a.text.localeCompare(b.text, undefined, {
                        numeric: true,
                        sensitivity: 'base'
                    }));
                } else {
                    menuConfig.decorativeText.splice(selectedItemIndex, 1);
                }

                selectedItemIndex = -1;
                hidePropertiesPanel();
                renderPreview();
            }
        });

        // Set initial slider visibility based on current autoGridEnabled state
        const display = autoGridEnabled ? 'block' : 'none';
        document.getElementById('grid-size-x').style.display = display;
        document.getElementById('grid-size-x-value').style.display = display;
        document.getElementById('grid-offset-x').style.display = display;
        document.getElementById('grid-offset-x-value').style.display = display;
        document.getElementById('grid-offset-y').style.display = display;
        document.getElementById('grid-offset-y-value').style.display = display;

        setupAutoGridEventHandlers();
    }

    function setupCanvasEvents() {
        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / 3);
            const y = Math.floor((e.clientY - rect.top) / 3);
            const clickedIndex = findItemAtPosition(x, y);

            if (window.navigationMode === 'column' && clickedIndex >= 0) {
                if (e.ctrlKey && e.button === 0) {
                    // CTRL + LEFT CLICK - start new column
                    addToNewColumn(clickedIndex);
                    renderPreview();
                    return;
                }
                if (e.shiftKey && e.button === 0) {
                    // SHIFT + LEFT CLICK - add to existing column
                    addToExistingColumn(clickedIndex);
                    renderPreview();
                    return;
                }
                if (e.button === 2) {
                    // RIGHT CLICK - remove from columns
                    removeFromColumn(clickedIndex);
                    renderPreview();
                    return;
                }
            }

            // Text selection and dragging
            selectedItemIndex = findItemAtPosition(x, y);
            if (selectedItemIndex >= 0) {
                isDragging = true;
                const item = selectedType === 'menu' ? menuConfig.items[selectedItemIndex] : menuConfig.decorativeText[selectedItemIndex];
                dragOffset.x = x - item.x;
                dragOffset.y = y - item.y;
                showPropertiesPanel(selectedItemIndex);
            } else {
                hidePropertiesPanel();
            }
            renderPreview();
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging && selectedItemIndex >= 0) {
                const rect = canvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / 3);
                const y = Math.floor((e.clientY - rect.top) / 3);

                let newX = Math.max(0, Math.min(154, x - dragOffset.x));
                let newY = Math.max(0, Math.min(112, y - dragOffset.y));

                const gridSizeX = 6;
                const gridSizeY = 8;
                const gridOffsX = 2;
                const gridOffsY = 0;
                newX = Math.round((newX - gridOffsX) / gridSizeX) * gridSizeX + gridOffsX;
                newY = Math.round((newY - gridOffsY) / gridSizeY) * gridSizeY + gridOffsY;

                if (selectedType === 'menu') {
                    if (autoGridEnabled && window.navigationMode === 'grid') {
                        // Auto grid mode: move anchor and regenerate entire grid
                        gridAnchorIndex = selectedItemIndex;
                        menuConfig.items[selectedItemIndex].x = newX;
                        menuConfig.items[selectedItemIndex].y = newY;
                        regenerateAutoGrid();
                    } else {
                        // Normal mode: move just this item
                        menuConfig.items[selectedItemIndex].x = newX;
                        menuConfig.items[selectedItemIndex].y = newY;
                    }
                } else {
                    // Decorative text: always move just this item (ignore auto-grid)
                    menuConfig.decorativeText[selectedItemIndex].x = newX;
                    menuConfig.decorativeText[selectedItemIndex].y = newY;
                }

                updatePropertiesPanel();
                renderPreview();
            }
        });

        canvas.addEventListener('dblclick', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / 3);
            const y = Math.floor((e.clientY - rect.top) / 3);
            const clickedIndex = findItemAtPosition(x, y);

            if (clickedIndex >= 0) {
                selectedItemIndex = clickedIndex;
                showPropertiesPanel(selectedItemIndex);

                // Focus and select all text in the name field
                const textField = document.getElementById('selected-text');
                if (textField) {
                    textField.focus();
                    textField.select();
                }

                renderPreview();
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Prevent context menu
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    function findItemAtPosition(x, y) {
        // Check decorative text first (they're drawn on top)
        if (menuConfig.decorativeText) {
            for (let i = menuConfig.decorativeText.length - 1; i >= 0; i--) {
                const item = menuConfig.decorativeText[i];
                if (item.visible &&
                    x >= item.x && x < item.x + Math.max(1, item.text.length) * 6 &&
                    y >= item.y && y < item.y + 8) {
                    selectedType = 'decorative';
                    return i;
                }
            }
        }

        // Check menu items
        for (let i = menuConfig.items.length - 1; i >= 0; i--) {
            const item = menuConfig.items[i];
            if (item.visible &&
                x >= item.x && x < item.x + Math.max(1, item.text.length) * 6 &&
                y >= item.y && y < item.y + 8) {
                selectedType = 'menu';
                return i;
            }
        }
        return -1;
    }

    function showPropertiesPanel(index) {
        const panel = document.getElementById('properties-panel');
        const item = selectedType === 'menu' ? menuConfig.items[index] : menuConfig.decorativeText[index];

        document.getElementById('selected-text').value = item.text;
        document.getElementById('selected-x').value = item.x;
        document.getElementById('selected-y').value = item.y;
        document.getElementById('selected-color').value = item.color;

        panel.style.display = 'block';
    }

    function hidePropertiesPanel() {
        document.getElementById('properties-panel').style.display = 'none';
        selectedItemIndex = -1;
    }

    function updatePropertiesPanel() {
        if (selectedItemIndex >= 0) {
            const item = selectedType === 'menu' ? menuConfig.items[selectedItemIndex] : menuConfig.decorativeText[selectedItemIndex];
            document.getElementById('selected-x').value = item.x;
            document.getElementById('selected-y').value = item.y;
        }
    }

    function reset() {
        // Reset all menuConfig properties to defaults
        menuConfig.backgroundColor = '#000000';
        menuConfig.defaultColor = '#00CC00';
        menuConfig.cursor.x = 2;
        menuConfig.cursor.y = 52;
        menuConfig.cursor.color = '#CCCC00';
        menuConfig.cursor.backgroundColor = '#000000';
        menuConfig.gridCols = 1;
        menuConfig.gridOffsetY = 1;
        menuConfig.enableMusic = true;
        menuConfig.enableBeep = true;
        menuConfig.visualEffect = 'none';
        menuConfig.cursorStyle = 'outline';
        menuConfig.decorativeText = [];

        // Reset item colors and text to original filenames
        menuConfig.items.forEach(item => {
            item.color = menuConfig.defaultColor;
            if (item.app && item.app.filename) {
                item.text = item.app.alias || item.app.filename.replace(/\.(gt1|gcl)$/i, '');
            }
        });

        // Update UI elements
        document.getElementById('default-color').value = menuConfig.defaultColor;
        document.getElementById('bg-color').value = menuConfig.backgroundColor;
        document.getElementById('cursor-color').value = menuConfig.cursor.color;
        document.getElementById('cursor-bg-color').value = menuConfig.cursor.backgroundColor;
        document.getElementById('enable-music').checked = menuConfig.enableMusic;
        document.getElementById('enable-beep').checked = menuConfig.enableBeep;
        document.getElementById('visual-effects').value = menuConfig.visualEffect;
        document.getElementById('cursor-style').value = menuConfig.cursorStyle;

        hidePropertiesPanel();
        clearAllNavigationData();

        if (window.navigationMode === 'grid') {
            // Set auto grid defaults and regenerate if enabled
            if (autoGridEnabled) {
                setAutoGridDefaults();
                calculateGridXGap();
                regenerateAutoGrid();
            } else {
                // Reset to original 2-column layout
                menuConfig.items.forEach((item, i) => {
                    item.x = i < 8 ? 2 : 80;
                    item.y = 32 + (i % 8) * 8;
                });
            }
        } else if (window.navigationMode === 'column') {
            // Column mode - just clear columns
            window.navigationColumns.length = 0;
        }

        renderPreview();
    }

    function renderPreview() {
        // Clear canvas (480x360)
        const gigatronBgColor = hexToGigatronColor(menuConfig.backgroundColor);
        ctx.fillStyle = gigatronColorToHex(gigatronBgColor);
        ctx.fillRect(0, 0, 480, 360);

        // Draw menu items with 24px font, scaled coordinates
        ctx.font = '24px monospace';
        ctx.textBaseline = 'top';

        menuConfig.items.forEach((item, index) => {
            if (item.visible) {
                // Highlight selected item (scale coordinates by 3)
                if (selectedType === 'menu' && index === selectedItemIndex) {
                    ctx.fillStyle = '#333333';
                    const selectionWidth = Math.max(1, item.text.length) * 6 * 3; // Each char is 6 logical pixels = 18 screen pixels
                    ctx.fillRect((item.x - 1) * 3, (item.y - 1) * 3, selectionWidth + 6, 30);
                }

                // Draw text (scale coordinates by 3)
                const gigatronColor = hexToGigatronColor(item.color);
                ctx.fillStyle = gigatronColorToHex(gigatronColor);
                for (let i = 0; i < item.text.length; i++) {
                    ctx.fillText(item.text[i], (item.x + i * 6) * 3, item.y * 3);
                }
            }
        });

        // Draw decorative text items
        if (menuConfig.decorativeText) {
            menuConfig.decorativeText.forEach((item, index) => {
                if (item.visible) {
                    // Highlight selected decorative text (scale coordinates by 3)
                    if (selectedType === 'decorative' && index === selectedItemIndex) {
                        ctx.fillStyle = '#333333';
                        const selectionWidth = Math.max(1, item.text.length) * 6 * 3;
                        ctx.fillRect((item.x - 1) * 3, (item.y - 1) * 3, selectionWidth + 6, 30);
                    }

                    // Draw decorative text (scale coordinates by 3)
                    const gigatronColor = hexToGigatronColor(item.color);
                    ctx.fillStyle = gigatronColorToHex(gigatronColor);
                    for (let i = 0; i < item.text.length; i++) {
                        ctx.fillText(item.text[i], (item.x + i * 6) * 3, item.y * 3);
                    }
                }
            });
        }

        drawGrid();

        if (window.navigationMode === 'column') {
            drawColumnVisuals();
        }

        updateModeVisibility();
    }

    function drawGrid() {
        const gridSizeX = 6;
        const gridSizeY = 8;
        const gridOffsX = 2;
        const gridOffsY = 0;

        const pixelSizeX = gridSizeX * 3;
        const pixelSizeY = gridSizeY * 3;

        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;

        for (let x = gridOffsX*3 - pixelSizeX; x >= 0; x -= pixelSizeX) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 360);
            ctx.stroke();
        }

        for (let x = gridOffsX*3; x < 480; x += pixelSizeX) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 360);
            ctx.stroke();
        }

        for (let y = gridOffsY*3 - pixelSizeY; y >= 0; y -= pixelSizeY) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(480, y);
            ctx.stroke();
        }

        for (let y = gridOffsY*3; y < 360; y += pixelSizeY) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(480, y);
            ctx.stroke();
        }
    }

    function drawColumnVisuals() {
        const ctx = canvas.getContext('2d');

        // Draw column connections and highlights
        for (let colIndex = 0; colIndex < window.navigationColumns.length; colIndex++) {
            const column = window.navigationColumns[colIndex];
            const color = columnColors[colIndex % columnColors.length];

            // Highlight all items in this column
            ctx.fillStyle = color + '40'; // Add transparency
            for (let itemIndex of column) {
                const item = menuConfig.items[itemIndex];
                ctx.fillRect((item.x - 1) * 3, (item.y - 1) * 3, (item.text.length * 6 + 2) * 3, 10 * 3);
            }

            // Draw connections within column
            ctx.strokeStyle = color;
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 2;

            for (let i = 0; i < column.length - 1; i++) {
                const fromItem = menuConfig.items[column[i]];
                const toItem = menuConfig.items[column[i + 1]];

                // Center-to-center connections
                const fromX = (fromItem.x + (fromItem.text.length * 6) / 2) * 3;
                const fromY = (fromItem.y + 4) * 3;
                const toX = (toItem.x + (toItem.text.length * 6) / 2) * 3;
                const toY = (toItem.y + 4) * 3;

                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();
            }
        }

        ctx.setLineDash([]); // Reset line dash
        ctx.lineWidth = 1;
    }

    function updateModeVisibility() {
        const isColumnMode = window.navigationMode === 'column';

        // Hide auto grid checkbox
        document.getElementById('auto-grid').parentElement.style.display = isColumnMode ? 'none' : 'flex';

        // Hide all 4 individual slider containers
        document.getElementById('grid-size-x').parentElement.style.display = isColumnMode ? 'none' : 'flex';
        document.getElementById('grid-offset-x').parentElement.style.display = isColumnMode ? 'none' : 'flex';
        document.getElementById('grid-offset-y').parentElement.style.display = isColumnMode ? 'none' : 'flex';
    }

    // Expose to global scope
    window.renderPreviewFunction = renderPreview;
}

// Global render function
function renderPreview() {
    if (window.renderPreviewFunction) {
        window.renderPreviewFunction();
    }
}

function createMainmenuPreviewHTML(apps) {
    // Only initialize if menuConfig is empty or doesn't match app count
    if (!menuConfig.items || menuConfig.items.length !== apps.length) {
        // Initialize menu config with app data (160x120 coordinates)
        const defaultColor = document.getElementById('default-color')?.value || '#00CC00';
        createMenuConfigFromApps(apps);

        // Reset cursor to original position
        menuConfig.cursor.x = 2;
        menuConfig.cursor.y = 52;
    }

    return `
        <div style="width: 480px; height: 360px; background: #000; border: 2px solid #444; margin: 0 auto; position: relative;">
            <!-- Main Canvas -->
            <canvas id="preview-canvas" width="480" height="360"
                    style="width: 480px; height: 360px; image-rendering: pixelated; cursor: crosshair;"></canvas>

            <!-- Top Properties Panel - positioned in title bar -->
            <div id="properties-panel" style="position: absolute; top: -52px; right: 15px; background: transparent; border: none; padding: 0; display: none;">
                <div style="color: #e0e0e0; font-size: 12px; display: flex; align-items: center; gap: 10px;">
                    <input type="text" id="selected-text" placeholder="Text" style="background: #1a1a1a; color: #e0e0e0; border: 1px solid #444; padding: 2px; width: 160px;">
                    <label>
                        <input type="color" id="selected-color" value="#00cc00" style="width: 30px; height: 20px;">
                    </label>
                    <label>
                        X: <input type="number" id="selected-x" min="0" max="154" style="width: 40px; background: #1a1a1a; color: #e0e0e0; border: 1px solid #444;">
                    </label>
                    <label>
                        Y: <input type="number" id="selected-y" min="0" max="112" style="width: 40px; background: #1a1a1a; color: #e0e0e0; border: 1px solid #444;">
                    </label>
                    <button id="delete-item-btn" style="background: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">
                        Delete
                    </button>
                </div>
            </div>

            <!-- Bottom Controls Panel -->
            <div style="position: absolute; top: 365px; left: 0; right: 0; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; padding: 8px;">
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap; color: #e0e0e0; font-size: 14px;">
                    <label>
                        Text: <input type="color" id="default-color" value="${menuConfig.defaultColor}" style="width: 30px; height: 20px;">
                    </label>
                    <label>
                        Background: <input type="color" id="bg-color" value="${menuConfig.backgroundColor}" style="width: 30px; height: 20px;">
                    </label>
                    <label>
                        Cursor: <input type="color" id="cursor-color" value="${menuConfig.cursor.color}" style="width: 30px; height: 20px;">
                        <input type="color" id="cursor-bg-color" value="${menuConfig.cursor.backgroundColor}" style="width: 30px; height: 20px; display: none;">
                    </label>
                    <button id="add-text-btn" style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin-left: auto;">
                        Add
                    </button>
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="checkbox" id="auto-grid" ${autoGridEnabled ? 'checked' : ''} style="margin: 0;"> Auto Grid
                    </label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="range" id="grid-size-x" min="1" max="${menuConfig.gridMaxCols || 1}" value="${menuConfig.gridCols || 1}" style="width: 50px; height: 12px; background: #333; outline: none; appearance: none; border-radius: 2px; border: 1px solid #666;">
                        <span id="grid-size-x-value" style="font-size: 12px; width: 15px;">${menuConfig.gridCols || 1}</span>
                        <input type="range" id="grid-offset-x" min="1" max="20" value="${menuConfig.gridOffsetX || 8}" style="width: 50px; height: 12px; background: #333; outline: none; appearance: none; border-radius: 2px; border: 1px solid #666;">
                        <span id="grid-offset-x-value" style="font-size: 12px; width: 15px;">${menuConfig.gridOffsetX || 8}</span>
                        <input type="range" id="grid-offset-y" min="1" max="5" value="${menuConfig.gridOffsetY || 1}" style="width: 50px; height: 12px; background: #333; outline: none; appearance: none; border-radius: 2px; border: 1px solid #666;">
                        <span id="grid-offset-y-value" style="font-size: 12px; width: 15px;">${menuConfig.gridOffsetY || 1}</span>
                    </div>
                    <button id="reset-btn" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin-left: auto; padding-right: 6px;">
                        Reset
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createPhase2LayoutHTML(apps, romVersion) {
    return `
        <div style="display: flex; gap: 10px; width: 100%; height: 360px;">
            <!-- Left Panel: Module Selection -->
            <div style="width: 280px; height: 446px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; display: flex; flex-direction: column;">
                <div style="padding: 8px 10px; border-bottom: 1px solid #444; color: #e0e0e0; font-weight: bold; flex-shrink: 0;">
                    Effects & Modules
                </div>
                <div id="module-selection-content" style="padding: 10px; flex: 1; overflow-y: auto; display: flex; flex-direction: column;">

                    <!-- ROM Name -->
                    <div style="margin-bottom: 10px;">
                        <h4 style="margin: 0 0 4px 0; color: #e0e0e0; font-size: 14px;">ROM Name:</h4>
                        <input type="text" id="rom-name" value="ROM` + romVersion + `.rom" style="width: 96%; padding: 2px; background: #1a1a1a; color: #e0e0e0; border: 1px solid #444; border-radius: 2px; font-size: 12px;">
                    </div>

                    <!-- Navigation Setup -->
                    <div style="margin-bottom: 10px;">
                        <h4 style="margin: 0 0 4px 0; color: #e0e0e0; font-size: 14px;">Navigation Setup:</h4>
                        <label style="display: block; margin-bottom: 5px; color: #e0e0e0; cursor: pointer;">
                            <input type="radio" name="navigation" value="grid" checked style="margin-right: 8px;"> Grid
                        </label>
                        <label style="display: block; margin-bottom: 5px; color: #e0e0e0; cursor: pointer;">
                            <input type="radio" name="navigation" value="column" style="margin-right: 8px;"> Sequence
                        </label>
                    </div>

                    <!-- Audio Effects -->
                    <div style="margin-bottom: 10px;">
                        <h4 style="margin: 0 0 4px 0; color: #e0e0e0; font-size: 14px;">Audio:</h4>
                        <label style="display: block; margin-bottom: 5px; color: #e0e0e0; cursor: pointer;">
                            <input type="checkbox" id="enable-music" ${menuConfig.enableMusic ? 'checked' : ''} style="margin-right: 8px;"> Music
                        </label>
                        <label style="display: block; margin-bottom: 5px; color: #e0e0e0; cursor: pointer;">
                            <input type="checkbox" id="enable-beep" ${menuConfig.enableBeep ? 'checked' : ''} style="margin-right: 8px;"> Beeps
                        </label>
                    </div>

                    <!-- Visual Effects -->
                    <div style="margin-bottom: 8px;">
                        <h4 style="margin: 0 0 8px 0; color: #e0e0e0; font-size: 14px;">Visual Effects:</h4>
                        <select id="visual-effects" style="width: 96%; padding: 2px; background: #1a1a1a; color: #e0e0e0; border: 1px solid #444; border-radius: 2px; font-size: 12px;">
                            <option value="none" ${menuConfig.visualEffect === 'none' ? 'selected' : ''}>None</option>
                            <option value="stars" ${menuConfig.visualEffect === 'stars' ? 'selected' : ''}>Stars</option>
                            <option value="fireworks" ${menuConfig.visualEffect === 'fireworks' ? 'selected' : ''}>Fireworks</option>
                            <option value="starfield" ${menuConfig.visualEffect === 'starfield' ? 'selected' : ''}>Starfield</option>
                            <option value="fountain" ${menuConfig.visualEffect === 'fountain' ? 'selected' : ''}>Fountain</option>
                            <option value="fire" ${menuConfig.visualEffect === 'fire' ? 'selected' : ''}>Fire</option>
                            <option value="snow" ${menuConfig.visualEffect === 'snow' ? 'selected' : ''}>Snow</option>
                        </select>
                    </div>

                    <!-- Cursor Style -->
                    <div style="margin-bottom: 10px;">
                        <h4 style="margin: 0 0 4px 0; color: #e0e0e0; font-size: 14px;">Cursor Style:</h4>
                        <select id="cursor-style" style="width: 96%; padding: 2px; background: #1a1a1a; color: #e0e0e0; border: 1px solid #444; border-radius: 2px; font-size: 12px;">
                            <option value="outline" ${menuConfig.cursorStyle === 'outline' ? 'selected' : ''}>Outline</option>
                            <option value="underline" ${menuConfig.cursorStyle === 'underline' ? 'selected' : ''}>Underline</option>
                            <option value="simple" ${menuConfig.cursorStyle === 'simple' ? 'selected' : ''}>Simple</option>
                            <option value="inverse" ${menuConfig.cursorStyle === 'inverse' ? 'selected' : ''}>Inverse</option>
                            <option value="selected" ${menuConfig.cursorStyle === 'selected' ? 'selected' : ''}>Selected</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Right Panel: Gigatron Preview -->
            <div style="flex: 1;">
                ${createMainmenuPreviewHTML(apps)}
            </div>
        </div>
    `;
}

// Call this when Phase 2 modal is shown
function initializeMainmenuPreview() {
    // Wait for DOM to be ready
    setTimeout(() => {
        if (document.getElementById('preview-canvas')) {
            setupMainmenuPreview();
        }
    }, 100);
}

function setupModuleEventListeners() {
    // Navigation mode handling
    const navigationRadios = document.querySelectorAll('input[name="navigation"]');
    navigationRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            // Set global navigation mode first
            window.navigationMode = this.value; // 'grid', 'column'

            // Trigger preview refresh
            if (typeof renderPreview === 'function') {
                renderPreview();
            }
        });
    });

    // Cursor style handling
    const cursorStyleSelect = document.getElementById('cursor-style');
    const cursorBgColorPicker = document.getElementById('cursor-bg-color');

    cursorStyleSelect.addEventListener('change', function() {
        menuConfig.cursorStyle = this.value;
        if (this.value === 'selected') {
            cursorBgColorPicker.style.display = 'inline-block';
        } else {
            cursorBgColorPicker.style.display = 'none';
        }
    });

    // Music checkbox handling
    const musicCheckbox = document.getElementById('enable-music');
    musicCheckbox.addEventListener('change', function() {
        menuConfig.enableMusic = this.checked;
    });

    // Beep checkbox handling
    const beepCheckbox = document.getElementById('enable-beep');
    beepCheckbox.addEventListener('change', function() {
        menuConfig.enableBeep = this.checked;
    });

    // Visual effects dropdown handling
    const visualEffectsSelect = document.getElementById('visual-effects');
    visualEffectsSelect.addEventListener('change', function() {
        menuConfig.visualEffect = this.value;
    });

    // Set initial cursor background color picker visibility
    if (menuConfig.cursorStyle === 'selected') {
        cursorBgColorPicker.style.display = 'inline-block';
    } else {
        cursorBgColorPicker.style.display = 'none';
    }
}
