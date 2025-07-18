// visual-effects.js - Visual effect modules for mainmenu

const VisualEffect = {
    NONE: 'none',
    STARS: 'stars',
    STARFIELD: 'starfield',
    FIREWORKS: 'fireworks',
    FOUNTAIN: 'fountain',
    FIRE: 'fire',
    SNOW: 'snow'
};

function generateStarsModule() {
    return 'const NUM_STARS = 48\n' +
           'const STARS_ORG_X = 80\n' +
           'const STARS_ORG_Y = 60 + 8\n' +
           'dim xPos(NUM_STARS-1) = 0\n' +
           'dim yPos(NUM_STARS-1) = 0\n' +
           'dim xVel(NUM_STARS-1) = 0\n' +
           'dim yVel(NUM_STARS-1) = 0\n' +
           'dim star%(NUM_STARS-1) = 0\n' +
           'dim colour%(31) = {&h00, &h00, &h00, &h00, &h00, &h00, &h00, &h00, &h95,\n' +
           '                   &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95,\n' +
           '                   &hAA, &hAA, &hAA, &hAA, &hAA, &hAA, &hAA, &hAA,\n' +
           '                   &hBF, &hBF, &hBF, &hBF, &hBF, &hBF, &hBF}\n' +
           'proc initStars\n' +
           '    local i\n' +
           '    for i=0 to NUM_STARS-1\n' +
           '        call newStar, i\n' +
           '    next i\n' +
           'endproc\n' +
           'proc newStar, i\n' +
           '    star(i) = 0\n' +
           '    xPos(i) = 0\n' +
           '    yPos(i) = 0\n' +
           '    repeat\n' +
           '        xv = (rnd(0) AND 2047) - 1024\n' +
           '        yv = (rnd(0) AND 2047) - 1024\n' +
           '    until abs(xv) > 200  OR  abs(yv) > 200\n' +
           '    xVel(i) = xv : xp = xv\n' +
           '    yVel(i) = yv : yp = yv\n' +
           'endproc\n' +
           'proc updateStars\n' +
           '    local i, ss, pxy\n' +
           '    for i=0 to NUM_STARS-1\n' +
           '        xp = xPos(i) : xv = xVel(i)\n' +
           '        yp = yPos(i) : yv = yVel(i)\n' +
           '        pxy.lo = xp.hi + STARS_ORG_X\n' +
           '        pxy.hi = yp.hi + STARS_ORG_Y\n' +
           '        if (peek(pxy) AND &h80)\n' +
           '            poke pxy, get("BG_COLOUR")\n' +
           '        endif\n' +
           '        xp = xp + xv\n' +
           '        yp = yp + yv\n' +
           '        if abs(yp) > 59*256\n' +
           '            call newStar, i\n' +
           '        endif\n' +
           '        if abs(xp) > 79*256\n' +
           '            call newStar, i\n' +
           '        endif\n' +
           '        ss = star(i)\n' +
           '        pxy.lo = xp.hi + STARS_ORG_X\n' +
           '        pxy.hi = yp.hi + STARS_ORG_Y\n' +
           '        if peek(pxy) = get("BG_COLOUR")\n' +
           '            if ss > 7 then poke pxy, colour(min(ss, 31))\n' +
           '            star(i) = ss + 1\n' +
           '        endif\n' +
           '        xPos(i) = xp : yPos(i) = yp\n' +
           '    next i\n' +
           'endproc\n';
}

function generateStarfieldModule() {
    return 'const NUM_STARS = 64\n' +
           'const STARFIELD_ORG_X = 80\n' +
           'const STARFIELD_ORG_Y = 60 + 8\n' +
           'dim xPos(NUM_STARS-1) = 0\n' +
           'dim yPos(NUM_STARS-1) = 0\n' +
           'dim speed%(NUM_STARS-1) = 0\n' +
           'dim twinkle%(NUM_STARS-1) = 0\n' +
           'proc initStarfield\n' +
           '    local i, spd, layer\n' +
           '    for i=0 to NUM_STARS-1\n' +
           '        xPos(i).hi = rnd(160) - 80\n' +
           '        yPos(i).hi = rnd(120) - 60\n' +
           '        layer = i AND 3\n' +
           '        if layer = 0\n' +
           '            spd = (rnd(0) AND 15) + 48\n' +
           '        elseif layer = 1\n' +
           '            spd = (rnd(0) AND 31) + 64\n' +
           '        elseif layer = 2\n' +
           '            spd = (rnd(0) AND 63) + 128\n' +
           '        else\n' +
           '            spd = (rnd(0) AND 63) + 192\n' +
           '        endif\n' +
           '        speed(i) = spd\n' +
           '        twinkle(i) = rnd(0) AND 63\n' +
           '    next i\n' +
           'endproc\n' +
           'proc updateStarfield\n' +
           '    local i, xp, yp, spd, twk, pxy, colour\n' +
           '    for i=0 to NUM_STARS-1\n' +
           '        xp = xPos(i) : yp = yPos(i)\n' +
           '        spd = speed(i) : twk = twinkle(i)\n' +
           '        pxy.lo = xp.hi + STARFIELD_ORG_X\n' +
           '        pxy.hi = yp.hi + STARFIELD_ORG_Y\n' +
           '        if peek(pxy) AND &h80\n' +
           '            poke pxy, get("BG_COLOUR")\n' +
           '        endif\n' +
           '        xp = xp + spd\n' +
           '        if abs(xp) > 79*256\n' +
           '            xp.hi = -79\n' +
           '            yp.hi = rnd(120) - 60\n' +
           '            yPos(i) = yp\n' +
           '        endif\n' +
           '        xPos(i) = xp\n' +
           '        inc twk.lo\n' +
           '        if twk > 63 then twk = 0\n' +
           '        twinkle(i) = twk\n' +
           '        if twk < 21\n' +
           '            colour = &h15\n' +
           '        elseif twk < 42\n' +
           '            colour = &h2A\n' +
           '        else\n' +
           '            colour = &h3F\n' +
           '        endif\n' +
           '        pxy.lo = xp.hi + STARFIELD_ORG_X\n' +
           '        pxy.hi = yp.hi + STARFIELD_ORG_Y\n' +
           '        if peek(pxy) = get("BG_COLOUR")\n' +
           '            poke pxy, colour OR &h80\n' +
           '        endif\n' +
           '    next i\n' +
           'endproc\n';
}

function generateFireworksModule() {
    return 'const NUM_FIREWORKS = 60\n' +
           'const FIREWORKS_ORG_X = 80\n' +
           'const FIREWORKS_ORG_Y = 60 + 8\n' +
           'const GRAVITY = 40\n' +
           'dim xPos(NUM_FIREWORKS-1) = 0\n' +
           'dim yPos(NUM_FIREWORKS-1) = 0\n' +
           'dim xVel(NUM_FIREWORKS-1) = 0\n' +
           'dim yVel(NUM_FIREWORKS-1) = 0\n' +
           'dim life%(NUM_FIREWORKS-1) = 0\n' +
           'dim colour%(NUM_FIREWORKS-1) = 0\n' +
           'proc initFireworks\n' +
           '    local i\n' +
           '    fireworkTimer = 0\n' +
           '    for i=0 &to NUM_FIREWORKS-1\n' +
           '        life(i) = 0\n' +
           '    next i\n' +
           'endproc\n' +
           'proc updateFireworks\n' +
           '    local i, lf, xp, yp, pxy\n' +
           '    for i=0 to NUM_FIREWORKS-1\n' +
           '        lf = life(i)\n' +
           '        if lf > 0\n' +
           '            xp = xPos(i) : xr = xp : xv = xVel(i)\n' +
           '            yp = yPos(i) : yr = yp : yv = yVel(i)\n' +
           '            yv = yv + GRAVITY\n' +
           '            xp = xp + xv\n' +
           '            yp = yp + yv\n' +
           '            if yp < -59*256\n' +
           '                if yr >= -59*256 then gosub clearParticle\n' +
           '                goto nextParticle\n' +
           '            endif\n' +
           '            if yp > 59*256\n' +
           '                lf = 0\n' +
           '                gosub clearParticle\n' +
           '                goto skipParticle\n' +
           '            endif\n' +
           '            if abs(xp) > 79*256\n' +
           '                lf = 0\n' +
           '                gosub clearParticle\n' +
           '                goto skipParticle\n' +
           '            endif\n' +
           '            gosub clearParticle\n' +
           '            pxy.lo = xp.hi + FIREWORKS_ORG_X\n' +
           '            pxy.hi = yp.hi + FIREWORKS_ORG_Y\n' +
           '            if peek(pxy) = get("BG_COLOUR")\n' +
           '                poke pxy, colour(i)\n' +
           '            endif\n' +
           'nextParticle:\n' +
           '            lf = lf - 1\n' +
           '            if lf = 0\n' +
           '                if peek(pxy) AND &h80\n' +
           '                    poke pxy, get("BG_COLOUR")\n' +
           '                endif\n' +
           '            endif\n' +
           '            xPos(i) = xp : yPos(i) = yp\n' +
           '            yVel(i) = yv\n' +
           '        endif\n' +
           'skipParticle:\n' +
           '        life(i) = lf\n' +
           '    next i\n' +
           '    inc fireworkTimer.lo\n' +
           '    if fireworkTimer > 20\n' +
           '        fireworkTimer = 0\n' +
           '        centerX = (rnd(0) AND 127) - 64\n' +
           '        centerY = (rnd(0) AND 63) - 48\n' +
           '        call createFirework, centerX, centerY\n' +
           '    endif\n' +
           'endproc\n' +
           'clearParticle:\n' +
           '    pxy.lo = xr.hi + FIREWORKS_ORG_X\n' +
           '    pxy.hi = yr.hi + FIREWORKS_ORG_Y\n' +
           '    if peek(pxy) AND &h80\n' +
           '        poke pxy, get("BG_COLOUR")\n' +
           '    endif\n' +
           'return\n' +
           'proc createFirework, centerX, centerY\n' +
           '    local i, c, count\n' +
           '    count = 0\n' +
           '    c = rnd(0) AND &h3f OR &h80\n' +
           '    for i=0 to NUM_FIREWORKS-1\n' +
           '        if life(i) = 0\n' +
           '            xv = (rnd(0) AND 1023) - 512\n' +
           '            yv = (rnd(0) AND 1023) - 768\n' +
           '            xPos(i).hi = centerX\n' +
           '            yPos(i).hi = centerY\n' +
           '            xVel(i) = xv\n' +
           '            yVel(i) = yv\n' +
           '            life(i) = 64 + (rnd(0) AND 31)\n' +
           '            colour(i) = c\n' +
           '            inc count.lo\n' +
           '            if count = 20 then return\n' +
           '        endif\n' +
           '    next i\n' +
           'endproc\n';
}

function generateFountainModule() {
    return 'const NUM_PARTICLES = 40\n' +
           'const FOUNTAIN_ORG_X = 80\n' +
           'const FOUNTAIN_ORG_Y = 60 + 8\n' +
           'const GRAVITY = 64\n' +
           'const SPAWN_Y = 59\n' +
           'dim xPos(NUM_PARTICLES-1) = 0\n' +
           'dim yPos(NUM_PARTICLES-1) = 0\n' +
           'dim xVel(NUM_PARTICLES-1) = 0\n' +
           'dim yVel(NUM_PARTICLES-1) = 0\n' +
           'dim age%(NUM_PARTICLES-1) = 0\n' +
           'dim colour%(31) = {&hB0, &hB0, &hB0, &hB0, &hB0, &hB0, &hB0, &hB0, &hB0, &hB0,\n' +
           '                   &hB5, &hB5, &hB5, &hB5, &hB5, &hB5, &hB5, &hB5, &hB5, &hB5,\n' +
           '                   &hBA, &hBA, &hBA, &hBA, &hBA, &hBA, &hBA, &hBA, &hBA, &hBA,\n' +
           '                   &hBF, &hBF}\n' +
           'proc initFountain\n' +
           '    local i\n' +
           '    pxy = 0 : xr = pxy : yr = xr\n' +
           '    for i=0 to NUM_PARTICLES-1\n' +
           '        call respawnParticle, i\n' +
           '        age(i) = 1\n' +
           '    next i\n' +
           'endproc\n' +
           'proc updateFountain\n' +
           '    local i, xp, yp, life\n' +
           '    for i=0 to NUM_PARTICLES-1\n' +
           '        life = age(i)\n' +
           '        if life > 0\n' +
           '            xp = xPos(i) : xr = xp : xv = xVel(i)\n' +
           '            yp = yPos(i) : yr = yp : yv = yVel(i)\n' +
           '            yv = yv + GRAVITY\n' +
           '            xp = xp + xv\n' +
           '            yp = yp + yv\n' +
           '            if yp < -59*256\n' +
           '                if yr >= -59*256 then gosub clearParticle\n' +
           '                goto nextParticle\n' +
           '            endif\n' +
           '            if yp > 59*256\n' +
           '                gosub clearParticle\n' +
           '                call respawnParticle, i\n' +
           '                goto skipParticle\n' +
           '            endif\n' +
           '            if abs(xp) > 79*256\n' +
           '                gosub clearParticle\n' +
           '                call respawnParticle, i\n' +
           '                goto skipParticle\n' +
           '            endif\n' +
           '            gosub clearParticle\n' +
           '            pxy.lo = xp.hi + FOUNTAIN_ORG_X\n' +
           '            pxy.hi = yp.hi + FOUNTAIN_ORG_Y\n' +
           '            if peek(pxy) = get("BG_COLOUR")\n' +
           '                poke pxy, colour(min(life, 31))\n' +
           '            endif\n' +
           'nextParticle:\n' +
           '            inc life.lo\n' +
           '            age(i) = life\n' +
           '            xPos(i) = xp : yPos(i) = yp\n' +
           '            yVel(i) = yv\n' +
           '        endif\n' +
           'skipParticle:\n' +
           '    next i\n' +
           'endproc\n' +
           'clearParticle:\n' +
           '    pxy.lo = xr.hi + FOUNTAIN_ORG_X\n' +
           '    pxy.hi = yr.hi + FOUNTAIN_ORG_Y\n' +
           '    if peek(pxy) AND &h80\n' +
           '        poke pxy, get("BG_COLOUR")\n' +
           '    endif\n' +
           'return\n' +
           'proc respawnParticle, i\n' +
           '    xPos(i).hi = 0\n' +
           '    yPos(i).hi = SPAWN_Y\n' +
           '    xVel(i) = (rnd(0) AND 1023) - 500\n' +
           '    yVel(i) = -((rnd(0) AND 1023) + 1000)\n' +
           '    age(i) = 1\n' +
           'endproc\n';
}

function generateFireModule() {
    return 'const NUM_FIRE_PARTICLES = 64\n' +
           'const FIRE_ORG_X = 80\n' +
           'const FIRE_ORG_Y = 60 + 8\n' +
           'dim xPos(NUM_FIRE_PARTICLES-1) = 0\n' +
           'dim yPos(NUM_FIRE_PARTICLES-1) = 0\n' +
           'dim xVel(NUM_FIRE_PARTICLES-1) = 0\n' +
           'dim yVel(NUM_FIRE_PARTICLES-1) = 0\n' +
           'dim life%(NUM_FIRE_PARTICLES-1) = 0\n' +
           'dim colour%(63) = {&h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95, &h95,\n' +
           '                   &h86, &h86, &h86, &h86, &h86, &h86, &h86, &h86, &h86, &h86, &h86, &h86, &h86, &h86, &h86,\n' +
           '                   &h83, &h83, &h83, &h83, &h83, &h83, &h83, &h83, &h83, &h83,\n' +
           '                   &h87, &h87, &h87, &h87, &h87, &h87, &h87, &h87, &h87, &h87,\n' +
           '                   &h8F, &h8F, &h8F, &h8F, &h8B, &h8B, &h8B, &h8B, &h8B, &h8B, &h8B, &h8B, &h8B}\n' +
           'proc initFire\n' +
           '    local i\n' +
           '    for i=0 to NUM_FIRE_PARTICLES-1\n' +
           '        call respawnFireParticle, i\n' +
           '    next i\n' +
           'endproc\n' +
           'proc respawnFireParticle, i\n' +
           '    xPos(i).hi = (rnd(0) AND 63) - 32\n' +
           '    yPos(i).hi = 59\n' +
           '    xVel(i) = (rnd(0) AND 511) - 256\n' +
           '    yVel(i) = -((rnd(0) AND 511) + 256)\n' +
           '    life(i) = (rnd(0) AND 31) + 40\n' +
           'endproc\n' +
           'proc updateFire\n' +
           '    local i, xp, yp, yv, lf, pxy\n' +
           '    for i=0 to NUM_FIRE_PARTICLES-1\n' +
           '        lf = life(i)\n' +
           '        if lf > 0\n' +
           '            xp = xPos(i)\n' +
           '            yp = yPos(i)\n' +
           '            yv = yVel(i)\n' +
           '            pxy.lo = xp.hi + FIRE_ORG_X\n' +
           '            pxy.hi = yp.hi + FIRE_ORG_Y\n' +
           '            if peek(pxy) AND &h80\n' +
           '                poke pxy, get("BG_COLOUR")\n' +
           '            endif\n' +
           '            xp = xp + xVel(i)\n' +
           '            yp = yp + yv\n' +
           '            yv = yv + 8\n' +
           '            lf = lf - 1\n' +
           '            if lf = 0\n' +
           '                call respawnFireParticle, i\n' +
           '                goto nextParticle\n' +
           '            endif\n' +
           '            if abs(yp) > 59*256\n' +
           '                call respawnFireParticle, i\n' +
           '                goto nextParticle\n' +
           '            endif\n' +
           '            if abs(xp) > 79*256\n' +
           '                call respawnFireParticle, i\n' +
           '                goto nextParticle\n' +
           '            endif\n' +
           '            pxy.lo = xp.hi + FIRE_ORG_X\n' +
           '            pxy.hi = yp.hi + FIRE_ORG_Y\n' +
           '            if peek(pxy) = get("BG_COLOUR")\n' +
           '                poke pxy, colour(lf AND 63)\n' +
           '            endif\n' +
           '            xPos(i) = xp : yPos(i) = yp\n' +
           '            yVel(i) = yv\n' +
           '            life(i) = lf\n' +
           '        endif\n' +
           'nextParticle:\n' +
           '    next i\n' +
           'endproc\n';
}

function generateSnowModule() {
   return 'const NUM_SNOW_PARTICLES = 80\n' +
          'const SNOW_ORG_X = 80\n' +
          'const SNOW_ORG_Y = 60 + 8\n' +
          'const GROUND_Y = 59\n' +
          'dim snowColour%(3) = &h95, &hAA, &hBF, &hBF\n' +
          'dim jitterOffset(7) = 0, 1, 0, -1, 0, -1, 0, 1\n' +
          'dim xPos(NUM_SNOW_PARTICLES-1) = 0\n' +
          'dim yPos(NUM_SNOW_PARTICLES-1) = 0\n' +
          'dim yVel(NUM_SNOW_PARTICLES-1) = 0\n' +
          'dim colour%(NUM_SNOW_PARTICLES-1) = 0\n' +
          'proc initSnow\n' +
          '    local i\n' +
          '    snowTimer = -1\n' +
          '    for i=0 &to NUM_SNOW_PARTICLES-1\n' +
          '        call respawnSnowParticle, i\n' +
          '    next i\n' +
          'endproc\n' +
          'proc updateSnow\n' +
          '    local i, xp, yp, yv, col, pxy\n' +
          '    for i=0 to NUM_SNOW_PARTICLES-1\n' +
          '        xp = xPos(i)\n' +
          '        yp = yPos(i)\n' +
          '        yv = yVel(i)\n' +
          '        rxy.lo = xp.hi + SNOW_ORG_X\n' +
          '        rxy.hi = yp.hi + SNOW_ORG_Y\n' +
          '        if peek(rxy) AND &h80\n' +
          '            poke rxy, get("BG_COLOUR")\n' +
          '        endif\n' +
          '        yp = yp + yv\n' +
          '        if yp > 59*256\n' +
          '            if rxy.hi < 127 then poke rxy, &h3F\n' +
          '            call respawnSnowParticle, i\n' +
          '            goto nextParticle\n' +
          '        endif\n' +
          '        pxy.hi = yp.hi + SNOW_ORG_Y\n' +
          '        if pxy.hi > rxy.hi\n' +
          '            xp.hi = xp.hi + jitterOffset(rxy.hi AND 7)\n' +
          '        endif\n' +
          '        pxy.lo = xp.hi + SNOW_ORG_X\n' +
          '        pixel = peek(pxy)\n' +
          '        if (pixel <> get("BG_COLOUR"))\n' +
          '            if (pixel AND &hC0) = 0\n' +
          '                if peek(rxy + &h0100) <> get("BG_COLOUR")\n' +
          '                    poke rxy, &h3F\n' +
          '                    call respawnSnowParticle, i\n' +
          '                    goto nextParticle\n' +
          '                else\n' +
          '                    xp.hi = xp.hi - jitterOffset(rxy.hi AND 7)\n' +
          '                    pxy.lo = xp.hi + SNOW_ORG_X\n' +
          '                endif\n' +
          '            endif\n' +
          '        endif\n' +
          '        if abs(xp) > 78*256\n' +
          '            call respawnSnowParticle, i\n' +
          '            goto nextParticle\n' +
          '        endif\n' +
          '        if (peek(pxy) AND &h40) == 0 then poke pxy, colour(i)\n' +
          '        xPos(i) = xp : yPos(i) = yp\n' +
          '        yVel(i) = yv\n' +
          'nextParticle:\n' +
          '    next i\n' +
          '    snowTimer = snowTimer + 1\n' +
          'endproc\n' +
          'proc respawnSnowParticle, i\n' +
          '    local y\n' +
          '    xPos(i).hi = rnd(144) - 72\n' +
          '    if snowTimer = -1\n' +
          '        y.hi = -rnd(20) - 39\n' +
          '    else\n' +
          '        y.hi = -59\n' +
          '    endif\n' +
          '    yPos(i) = y\n' +
          '    yVel(i) = (rnd(0) AND 127) + 128\n' +
          '    colour(i) = snowColour(rnd(0) AND 3)\n' +
          'endproc\n';
}
