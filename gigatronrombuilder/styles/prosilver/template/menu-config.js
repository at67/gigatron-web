// menu-config.js - Menu configuration, sorting, and positioning

// ROM free space constants (in bytes)
const ROM_FREE_SPACE = {
    'v5a': 123080,
    'v5a_6502': 121032,
    'v6': 122056,
    'v6_6502': 120008,
    'vX0': 96968
};

var menuConfig = {
    items: [],
    cursor: { x: 2, y: 52, color: '#CCCC00', backgroundColor: '#400040' },
    backgroundColor: '#000000',
    gridCols: 1,
    gridOffsetX: 8,
    gridOffsetY: 1,
    gridMaxCols: 1,
    defaultColor: '#00CC00',
    decorativeText: [],
    enableMusic: true,
    enableBeep: true,
    visualEffect: 'none',
    cursorStyle: 'selected',
    symbolTableName: 'SymbolTable.m',
    selectedFont: 'system'
};

function getUniquePrefix() {
    return window.uniquePrefix || '';
}

function createMenuConfigFromApps(apps) {
    const defaultColor = '#00CC00';

    // Only update properties that depend on the apps
    menuConfig.items = apps.map((app, i) => ({
        text: app.alias || app.filename.replace(/\.(gt1|gcl)$/i, ''),
        x: i < 8 ? 2 : 80,
        y: 32 + (i % 8) * 8,
        color: menuConfig.defaultColor,
        visible: true,
        app: app
    }));

    // Update max columns based on number of apps
    menuConfig.gridMaxCols = apps.length;

    menuConfig.items.sort((a, b) => a.text.localeCompare(b.text, undefined, {
        numeric: true,
        sensitivity: 'base'
    }));

    menuConfig.items.forEach((item, i) => {
        item.x = i < 8 ? 2 : 80;
        item.y = 32 + (i % 8) * 8;
    });

    menuConfig.symbolTableName = getUniquePrefix() + '_SymbolTable.m';

    return menuConfig;
}

function getMenuApps() {
    return window.fileBrowser.selectedFiles.filter(file => {
        const alias = file.alias;
        return alias !== 'Reset' && alias !== 'Boot' && alias !== 'Main' && alias !== 'Egg';
    });
}

function clearAllNavigationData() {
    if (window.navigationColumns) {
        window.navigationColumns.length = 0;
    }
}
