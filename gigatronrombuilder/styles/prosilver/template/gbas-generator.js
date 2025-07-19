// gbas-generator.js - GBAS mainmenu code generation

function generateGbasSource(romVersion) {
    const settings = getUISettings();
    return generateMainmenuCode(romVersion, settings);
}

function getUISettings() {
    const musicEnabled = menuConfig.enableMusic;
    const beepEnabled = menuConfig.enableBeep;
    const visualFx = menuConfig.visualEffect;

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

    let code = generateBaseCode(romVersion);
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
        menuText.push(item.text === '' ? ' ' : item.text); // empty menu text becomes a space
        symbols.push(item.app || { alias: null, filename: item.text + '.gt1' });

        const gigatronColor = hexToGigatronColor(item.color);
        menuColours.push(gigatronColor);
    }

    // Generate decorative text arrays
    const decoX = [];
    const decoY = [];
    const decoText = [];
    const decoColours = [];

    if (menuConfig.decorativeText) {
        for (let i = 0; i < menuConfig.decorativeText.length; i++) {
            const item = menuConfig.decorativeText[i];
            decoX.push(item.x);
            decoY.push(item.y);
            decoText.push(item.text === '' ? ' ' : item.text); // empty deco text becomes a space

            const gigatronColor = hexToGigatronColor(item.color);
            decoColours.push(gigatronColor);
        }
    }

    return {
        menuX: 'dim menuX%(NUM_APPS-1) = ' + menuX.join(', '),
        menuY: 'dim menuY%(NUM_APPS-1) = ' + menuY.join(', '),
        menuColours: 'dim textColors%(NUM_APPS-1) = ' + menuColours.join(', '),
        menuText: menuText,
        symbols: symbols,
        decoX: decoX.length > 0 ? 'dim decoX%(NUM_DECO-1) = ' + decoX.join(', ') : '',
        decoY: decoY.length > 0 ? 'dim decoY%(NUM_DECO-1) = ' + decoY.join(', ') : '',
        decoColours: decoColours.length > 0 ? 'dim decoColors%(NUM_DECO-1) = ' + decoColours.join(', ') : '',
        decoText: decoText,
        decoLength: decoText.length
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

function generateBaseCode(romVersion) {
    const numApps = menuConfig.items.length;
    const symbols = menuConfig.items.map(item => item.app ? (item.alias || item.app.filename.replace(/\.(gt1|gcl)$/i, '')) : item.text);
    const gridCols = menuConfig.gridCols;
    const gridRows = Math.ceil(menuConfig.items.length / gridCols);

    const positions = generateMenuArrays(menuConfig);

    let code = '_runtimePath_ "../tools/runtime"\n' +
               '_runtimeStart_ &h7FFE\n' +
               '_codeRomType_ ROM' + romVersion + '\n' +
               '_enableRomCheck_ Off\n' +
               '_stringWorkArea_ &h77A0\n' +
               'module "SymbolTable.m"\n' +
               'const NUM_APPS = ' + numApps + '\n';

    if (positions.decoLength > 0) {
        code += 'const NUM_DECO = ' + positions.decoLength + '\n';
        code += 'const dim decoText$(NUM_DECO-1) = ' + positions.decoText.map(name => '"' + name + '"').join(', ') + '\n';
    }

    code += 'const dim menuText$(NUM_APPS-1) = ' + positions.menuText.map(name => '"' + name + '"').join(', ') + '\n' +
            'dim symbols(NUM_APPS-1) = ' + symbols.join(', ') + '\n' +
            'const maxX = ' + gridCols + '\n' +
            'const maxY = ' + gridRows + '\n' +
            'x = 0 : y = x\n' +
            'curIndex = -1 : newIndex = 0\n' +
            positions.menuX + '\n' +
            positions.menuY + '\n' +
            positions.menuColours + '\n';

    if (positions.decoLength > 0) {
        code += positions.decoX + '\n' +
                positions.decoY + '\n' +
                positions.decoColours + '\n';
    }

    code += 'tscroll off\n' +
            'tclip on\n' +
            'set BG_COLOUR, ' + hexToGigatronColor(menuConfig.backgroundColor) + ' : mode 2 : cls\n';

    // Draw decorative text first (underneath menu text)
    if (positions.decoLength > 0) {
        code += 'for i = 0 to NUM_DECO - 1\n' +
                '    set FG_COLOUR, decoColors(i) : at decoX(i), decoY(i) : print decoText$(i)\n' +
                'next i\n';
    }

    // Draw menu text on top
    code += 'for i = 0 to NUM_APPS - 1\n' +
             '    set FG_COLOUR, textColors(i) : at menuX(i), menuY(i) : print menuText$(i)\n' +
             'next i\n';

    return code;
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
    const cursorStyle = menuConfig.cursorStyle;

    let code = 'proc drawCursor, index, active\n' +
               '    local x, y, w\n' +
               '    if index &&= -1 then return\n' +
               '    x = menuX(index)\n' +
               '    y = menuY(index)\n' +
               '    w = peek(addr(menuText$(index)))\n' +
               '    w = (w LSL 2) + w + w\n';

    // Paste cursor implementation body directly
    code += getCursorImplementation(cursorStyle);

    code += 'endproc\n';

    return code;
}

function getCursorImplementation(cursorStyle) {
    switch (cursorStyle) {
        case 'underline':
            return '    if active\n' +
                   '        set FG_COLOUR, ' + hexToGigatronColor(menuConfig.cursor.color) + '\n' +
                   '    else\n' +
                   '        set FG_COLOUR, get("BG_COLOUR")\n' +
                   '    endif\n' +
                   '    line x, y+8, x+w-1, y+8\n';

        case 'outline':
        default:
            return '    if active\n' +
                   '        set FG_COLOUR, ' + hexToGigatronColor(menuConfig.cursor.color) + ' OR &h40\n' +
                   '    else\n' +
                   '        set FG_COLOUR, get("BG_COLOUR")\n' +
                   '    endif\n' +
                   '    line x-1, y-1, x+w, y-1\n' +
                   '    line x-1, y+8, x+w, y+8\n' +
                   '    line x-1, y-1, x-1, y+8\n' +
                   '    line x+w, y-1, x+w, y+8\n';
    }
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
