// gbas-generator.js - GBAS mainmenu code generation

function generateGbasSource(romVersion) {
    const settings = getUISettings();
    return generateMainmenuCode(romVersion, settings);
}

function getUISettings() {
    const musicEnabled = document.getElementById('enable-music')?.checked || false;
    const beepEnabled = document.getElementById('enable-beep')?.checked || false;
    const visualFx = document.getElementById('visual-effects')?.value || 'none';

    return {
        enableMusic: musicEnabled,
        enableBeep: beepEnabled,
        visualEffect: visualFx
    };
}

function generateMainmenuCode(romVersion, options = {}) {
    const {
        enableMusic = false,
        enableBeep = false,
        visualEffect = VisualEffect.NONE,
    } = options;

    const numApps = menuConfig.items.length;
    const symbols = menuConfig.items.map(item => item.app ? (item.alias || item.app.filename.replace(/\.(gt1|gcl)$/i, '')) : item.text);

    const gridCols = parseInt(document.getElementById('grid-size-x')?.value || 1);
    const gridRows = Math.ceil(menuConfig.items.length / gridCols);
    let code = generateBaseCode(numApps, symbols, romVersion, getMenuConfiguration(), gridCols, gridRows);
    code += generateMainLoop(enableMusic, visualEffect);

    // Give branching optimisation in gtBASIC best chance of succeeding
    switch (visualEffect) {
        case VisualEffect.STARS:     code += generateStarsModule();     break;
        case VisualEffect.STARFIELD: code += generateStarfieldModule(); break;
        case VisualEffect.FIREWORKS: code += generateFireworksModule(); break;
        case VisualEffect.FOUNTAIN:  code += generateFountainModule();  break;
        case VisualEffect.FIRE:      code += generateFireModule();      break;
        case VisualEffect.SNOW:      code += generateSnowModule();      break;
        default: break;
    }

    code += generateEventHandlers(enableBeep);
    code += generateCursorFunctions();

    if (enableMusic) code += generateMusicModule();
    if (enableBeep) code += generateBeepModule();

    return code;
}

function generateMenuArrays(menuConfig) {
    const menuX = [];
    const menuY = [];
    const menuText = [];
    const symbols = [];
    const menuColours = [];

    for (let i = 0; i < menuConfig.items.length; i++) {
        const item = menuConfig.items[i];
        menuX.push(item.x);
        menuY.push(item.y);
        menuText.push(item.text);
        symbols.push(item.app || { alias: null, filename: item.text + '.gt1' });

        const gigatronColor = hexToGigatronColor(item.color);
        menuColours.push(gigatronColor);
    }

    return {
        menuX: 'dim menuX%(NUM_APPS-1) = ' + menuX.join(', '),
        menuY: 'dim menuY%(NUM_APPS-1) = ' + menuY.join(', '),
        menuColours: 'dim textColors%(NUM_APPS-1) = ' + menuColours.join(', '),
        menuText: menuText,
        symbols: symbols
    };
}

function hexToGigatronColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const r2 = r >> 6;
    const g2 = g >> 6;
    const b2 = b >> 6;

    const gigatronColor = (b2 << 4) | (g2 << 2) | r2;

    return '&h' + gigatronColor.toString(16).padStart(2, '0').toUpperCase();
}

function gigatronColorToHex(gigatronColor) {
    // Parse the Gigatron color (format: &hXX or 0xXX)
    let colorValue;
    if (typeof gigatronColor === 'string') {
        if (gigatronColor.startsWith('&h')) {
            colorValue = parseInt(gigatronColor.substring(2), 16);
        } else if (gigatronColor.startsWith('0x')) {
            colorValue = parseInt(gigatronColor.substring(2), 16);
        } else {
            colorValue = parseInt(gigatronColor, 16);
        }
    } else {
        colorValue = gigatronColor;
    }

    // Extract 2-bit RGB components from XXBBGGRR format
    const r2 = colorValue & 0x03;        // Bottom 2 bits (RR)
    const g2 = (colorValue >> 2) & 0x03; // Next 2 bits (GG)
    const b2 = (colorValue >> 4) & 0x03; // Next 2 bits (BB)

    // Convert 2-bit values back to 8-bit by shifting
    const r8 = r2 << 6;
    const g8 = g2 << 6;
    const b8 = b2 << 6;

    // Convert to hex string
    const rHex = r8.toString(16).padStart(2, '0');
    const gHex = g8.toString(16).padStart(2, '0');
    const bHex = b8.toString(16).padStart(2, '0');

    return '#' + rHex + gHex + bHex;
}

function getCursorStyle() {
    return document.getElementById('cursor-style')?.value || 'outline';
}

function generateBaseCode(numApps, symbols, romVersion, menuConfig, gridCols, gridRows) {
    const positions = generateMenuArrays(menuConfig);

    return '_runtimePath_ "../tools/runtime"\n' +
           '_runtimeStart_ &h7FFE\n' +
           '_codeRomType_ ROM' + romVersion + '\n' +
           '_enableRomCheck_ Off\n' +
           '_stringWorkArea_ &h77A0\n' +
           'module "SymbolTable.m"\n' +
           'const NUM_APPS = ' + numApps + '\n' +
           'const dim menuText$(NUM_APPS-1) = ' + positions.menuText.map(name => '"' + name + '"').join(', ') + '\n' +
           'dim symbols(NUM_APPS-1) = ' + symbols.join(', ') + '\n' +
           'const maxX = ' + gridCols + '\n' +
           'const maxY = ' + gridRows + '\n' +
           'x = 0 : y = x\n' +
           'curIndex = -1 : newIndex = 0\n' +
           positions.menuX + '\n' +
           positions.menuY + '\n' +
           positions.menuColours + '\n' +
           'tscroll off\n' +
           'tclip on\n' +
           'set BG_COLOUR, ' + hexToGigatronColor(menuConfig.backgroundColor) + ' : mode 2 : cls\n' +
           'for i = 0 to NUM_APPS - 1\n' +
           '    set FG_COLOUR, textColors(i) : at menuX(i), menuY(i) : print menuText$(i)\n' +
           'next i\n';
}

function generateMainLoop(enableMusic, visualEffect) {
    let loop = '';

    if (enableMusic) {
        loop += 'play music, &h75a0, 3\n' +
                'gosub resetAudio\n';
    }

    switch (visualEffect) {
        case VisualEffect.STARS:     loop += 'call initStars\n';     break;
        case VisualEffect.STARFIELD: loop += 'call initStarfield\n'; break;
        case VisualEffect.FIREWORKS: loop += 'call initFireworks\n'; break;
        case VisualEffect.FOUNTAIN:  loop += 'call initFountain\n';  break;
        case VisualEffect.FIRE:      loop += 'call initFire\n';      break;
        case VisualEffect.SNOW:      loop += 'call initSnow\n';      break;
        default: break;
    }

    loop += 'repeat\n' +
            '   gosub get("BUTTON_STATE")\n' +
            '   if newIndex <> curIndex\n' +
            '      call drawCursor, curIndex, 0\n' +
            '      call drawCursor, newIndex, 1\n' +
            '      curIndex = newIndex\n' +
            '   endif\n';

    switch (visualEffect) {
        case VisualEffect.STARS:     loop += 'call updateStars\n';     break;
        case VisualEffect.STARFIELD: loop += 'call updateStarfield\n'; break;
        case VisualEffect.FIREWORKS: loop += 'call updateFireworks\n'; break;
        case VisualEffect.FOUNTAIN:  loop += 'call updateFountain\n';  break;
        case VisualEffect.FIRE:      loop += 'call updateFire\n';      break;
        case VisualEffect.SNOW:      loop += 'call updateSnow\n';      break;
        default: break;
    }

    loop += 'forever\n';
    return loop;
}

function generateEventHandlers(enableBeep) {
    const beepCall = enableBeep ? 'gosub beep' : 'set BUTTON_STATE, &hEF';

    return 'execApp:\n' +
           '    cls\n' +
           '    exec symbols(curIndex.lo), &h0200\n' +
           'return\n' +
           "'button A\n" +
           '127:    ' + beepCall + '\n' +
           '        gosub execApp\n' +
           '        return\n' +
           "'right\n" +
           '254:    inc x.lo\n' +
           '        if x = maxX then x = 0\n' +
           '        ' + beepCall + '\n' +
           '        return\n' +
           "'left\n" +
           '253:    x = x - 1\n' +
           '        if x < 0 then x = maxX - 1\n' +
           '        ' + beepCall + '\n' +
           '        return\n' +
           "'down\n" +
           '251:    inc y.lo\n' +
           '        if y = maxY then y = 0\n' +
           '        ' + beepCall + '\n' +
           '        return\n' +
           "'up\n" +
           '247:    y = y - 1\n' +
           '        if y < 0 then y = maxY - 1\n' +
           '        ' + beepCall + '\n' +
           '        return\n';
}

function generateCursorFunctions() {
    return 'proc drawCursor, index, active\n' +
           '    local x, y, w\n' +
           '    if index &&= -1 then return\n' +
           '    x = menuX(index)\n' +
           '    y = menuY(index)\n' +
           '    w = peek(addr(menuText$(index)))\n' +
           '    w = (w LSL 2) + w + w\n' +
           '    if active\n' +
           '        set FG_COLOUR, ' + hexToGigatronColor(menuConfig.cursor.color) + ' OR &h40\n' +
           '    else\n' +
           '        set FG_COLOUR, ' + hexToGigatronColor(menuConfig.backgroundColor) + '\n' +
           '    endif\n' +
           '    line x-1, y-1, x+w, y-1\n' +
           '    line x-1, y+8, x+w, y+8\n' +
           '    line x-1, y-1, x-1, y+8\n' +
           '    line x+w, y-1, x+w, y+8\n' +
           'endproc\n';
}

function generateMusicModule() {
    return 'def byte(&h75a0) = &h90, &h3c, &h91, &h40, &h92, &h43, &h93, &h48, &h0c, &h80, &h81, &h82, &h83, &h01, &h90, &h3c,\n' +
           'def byte         = &h91, &h40, &h92, &h43, &h93, &h48, &h24, &h80, &h81, &h82, &h83, &hd0, &h00, &h00\n' +
           'resetAudio:\n' +
           '    asm\n' +
           '        LDI     2\n' +
           '        ST      waveType + 1\n' +
           '        CALLI   resetAudio\n' +
           '    endasm\n' +
           'return\n';
}

function generateBeepModule() {
    return 'beep:\n' +
           '    newIndex = y * maxX + x\n' +
           '    if newIndex >= NUM_APPS then newIndex = NUM_APPS-1\n' +
           '    sound on, 1, 8200\n' +
           '    set SOUND_TIMER, 2\n' +
           '    set BUTTON_STATE, &hEF\n' +
           'return\n';
}
