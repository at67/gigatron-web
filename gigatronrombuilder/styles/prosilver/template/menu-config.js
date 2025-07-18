// menu-config.js - Menu configuration, sorting, and positioning

var menuConfig = {
    items: [],
    cursor: { x: 2, y: 52, color: '#CCCC00' },
    backgroundColor: '#000000',
    gridCols: 1,
    gridOffsetX: 8,
    gridOffsetY: 1,
    gridMaxCols: 1
};

function createMenuConfigFromApps(apps) {
    const defaultColor = '#00CC00';

    menuConfig = {
        items: apps.map((app, i) => ({
            text: app.alias || app.filename.replace(/\.(gt1|gcl)$/i, ''),
            x: i < 8 ? 2 : 80,
            y: 32 + (i % 8) * 8,
            color: defaultColor,
            visible: true,
            app: app
        })),
        cursor: { x: 2, y: 52, color: '#CCCC00' },
        backgroundColor: '#000000',
        gridCols: 1,
        gridOffsetX: 8,
        gridOffsetY: 1,
        gridMaxCols: apps.length,
        defaultColor: '#00CC00'
    };

    menuConfig.items.sort((a, b) => a.text.localeCompare(b.text, undefined, {
        numeric: true,
        sensitivity: 'base'
    }));

    menuConfig.items.forEach((item, i) => {
        item.x = i < 8 ? 2 : 80;
        item.y = 32 + (i % 8) * 8;
    });

    return menuConfig;
}

function getMenuConfiguration() {
    return {
        items: menuConfig.items.map(item => ({
            text: item.text,
            x: item.x,
            y: item.y,
            color: item.color
        })),
        cursor: {
            x: menuConfig.cursor.x,
            y: menuConfig.cursor.y,
            color: menuConfig.cursor.color
        },
        backgroundColor: menuConfig.backgroundColor
    };
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
