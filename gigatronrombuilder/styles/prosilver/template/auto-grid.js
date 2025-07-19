// auto-grid.js - Auto grid positioning and slider management

var autoGridEnabled = false;
var gridAnchorIndex = 0;

function regenerateAutoGrid() {
    if (!autoGridEnabled) return;

    const cols = parseInt(document.getElementById('grid-size-x')?.value || 1);
    const gapX = parseInt(document.getElementById('grid-offset-x')?.value || 8);
    const gapY = parseInt(document.getElementById('grid-offset-y')?.value || 1);

    const anchorItem = menuConfig.items[gridAnchorIndex];
    const anchorRow = Math.floor(gridAnchorIndex / cols);
    const anchorCol = gridAnchorIndex % cols;
    const startX = anchorItem.x - (anchorCol * gapX * 6);
    const startY = anchorItem.y - (anchorRow * gapY * 8);

    for (let i = 0; i < menuConfig.items.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        menuConfig.items[i].x = startX + col * gapX * 6;
        menuConfig.items[i].y = startY + row * gapY * 8;
    }

    renderPreview();
}

function setAutoGridDefaults() {
    const numItems = menuConfig.items.length;
    const maxTextLength = Math.max(...menuConfig.items.map(item => item.text.length));

    const optimalCols = Math.floor(Math.sqrt(numItems));

    document.getElementById('grid-size-x').max = numItems;
    document.getElementById('grid-size-x').value = optimalCols;
    document.getElementById('grid-size-x-value').textContent = optimalCols;

    const gapX = maxTextLength + 1;
    document.getElementById('grid-offset-x').value = gapX;
    document.getElementById('grid-offset-x-value').textContent = gapX;

    document.getElementById('grid-offset-y').value = 1;
    document.getElementById('grid-offset-y-value').textContent = 1;

    menuConfig.gridCols = optimalCols;
    menuConfig.gridOffsetX = gapX;
    menuConfig.gridOffsetY = 1;
    menuConfig.gridMaxCols = numItems;
}

function setupAutoGridEventHandlers() {
    // Grid Size X handler (Columns)
    document.getElementById('grid-size-x').addEventListener('input', (e) => {
        const cols = parseInt(e.target.value);
        document.getElementById('grid-size-x-value').textContent = cols;
        menuConfig.gridCols = cols;
        regenerateAutoGrid();
    });

    document.getElementById('grid-offset-x').addEventListener('input', (e) => {
        document.getElementById('grid-offset-x-value').textContent = e.target.value;
        menuConfig.gridOffsetX = parseInt(e.target.value);
        regenerateAutoGrid();
    });

    document.getElementById('grid-offset-y').addEventListener('input', (e) => {
        document.getElementById('grid-offset-y-value').textContent = e.target.value;
        menuConfig.gridOffsetY = parseInt(e.target.value);
        regenerateAutoGrid();
    });
}

function calculateGridXGap() {
    if (!autoGridEnabled) return;

    const maxTextLength = Math.max(...menuConfig.items.map(item => item.text.length));
    const gapX = maxTextLength + 1;

    document.getElementById('grid-offset-x').value = gapX;
    document.getElementById('grid-offset-x-value').textContent = gapX;
    menuConfig.gridOffsetX = gapX;
}
