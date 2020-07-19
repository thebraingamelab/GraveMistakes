;(function(){
"use strict";
resizer.init();

const GAME_FIELD_HEIGHT = resizer.getGameHeight();
const GAME_FIELD_WIDTH = resizer.getGameWidth();
const GAME_SPEED = 20;

let clickBoxSize = 32;
let clickBox = new Rectangle(-1*clickBoxSize, -1*clickBoxSize, clickBoxSize, clickBoxSize+10);

let lastEvent = null;
let eventTime = null;
let inputDeviceSwapTime = 1000;

// Get the top bar elements
let topBar = document.getElementById("top-bar");
let pauseBox = document.getElementById("pause-box");
let helpBox = document.getElementById("help-box");

let pauseBtn = document.getElementById("pause");
let helpBtn = document.getElementById("help");

// Menu elements
let pauseMenu = document.getElementById("pause-menu");
let resumeBtn = document.getElementById("resume");
let miniHelpBtn = document.getElementById("help-mini");

let helpMenu = document.getElementById("help-menu");
let backBtn = document.getElementById("back");

let dimmer = document.getElementById("dimmer");

// Dimension value for top bar buttons
let boxSize;;
///////////////////////////////////////
// Helper functions/objects
///////////////////////////////////////

// Animates a menu to pop out and remain visible
function showMenu(menuElement) {

    // Show the menu
    menuElement.classList.remove("center-popin");
    menuElement.classList.add("center-popout");

    // Dim the background
    dimmer.classList.remove("partial-fade-out");
    dimmer.classList.add("partial-fade-in");

    // Hide the top bar
    topBar.style.display = "none";
}

// Animates a menu to pop in and stay invisible
function hideMenu(menuElement) {
    // Hide the menu
    menuElement.classList.remove("center-popout");
    menuElement.classList.add("center-popin");

    // Undim the background
    dimmer.classList.remove("partial-fade-in");
    dimmer.classList.add("partial-fade-out");

    // Show the top bar
    topBar.style.display = "";
}

// Animates the current menu to pop in and stay invisible, while the
// next menu pops out and remains visible
function switchMenu(currentMenu, nextMenu) {

    // Hide current menu
    currentMenu.classList.remove("center-popout");
    currentMenu.classList.add("center-popin");

    // After current menu's animation ends, show next menu
    currentMenu.addEventListener("animationend", function showNextMenu() {
        nextMenu.classList.remove("center-popin");
        nextMenu.classList.add("center-popout");

        currentMenu.removeEventListener("animationend", showNextMenu);
    }, false);
}

// Clamp between two values
function clamp(number, min, max) {
    return Math.min(Math.max(number, min), max);
}

// Random Integer, 0 thru max - 1
function randomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

// Removes an element by replacing it with the last element,
// and then shortens the array
function mutableRemoveIndex(array, index) {

    if (index >= array.length) {
        console.error('ERROR: mutableRemoveIndex: index is out of range');
        return;
    }

    if (array.length <= 0) {
        console.error('ERROR: mutableRemoveIndex: empty array');
        return;
    }

    array[index] = array[array.length-1];
    array[array.length-1] = undefined;

    array.length = array.length-1;
}


// Size the top bar buttons
function resizeBarButtons() {
    let barHeight, originalDisplay;

    // Store display setting
    originalDisplay = topBar.style.display;

    // In case top bar isn't visible (which means clientHeight === 0),
    // temporarily make it visible to calculate true height
    topBar.style.display = "";
    barHeight = topBar.clientHeight;
    topBar.style.display = originalDisplay;

    // Box size is slightly larger than the bar (120% of height)
    boxSize = barHeight * 1.20;

    // Set styles
    pauseBox.style.height = boxSize + "px";
    pauseBox.style.width = boxSize + "px";

    helpBox.style.height = boxSize + "px";
    helpBox.style.width = boxSize + "px";
};
// Cloneable Pool
function CloneablePool(template) {
    this.template = template;

    this.pool = [];
}

CloneablePool.prototype.take = function () {
    let obj;
    let i, len = this.pool.length;
    let poolItem = null;

    // If there is an available object, return it.
    for (i = 0; i < len; i++) {
        poolItem = this.pool[i];

        if(poolItem.available) {
            poolItem.available = false;
            poolItem.object.init();
            return poolItem.object;
        }
    }

    // Otherwise, create a new one and return it.
    obj = this.template.clone();
    obj.init();

    this.pool.push({
        available: false,
        object: obj
    });

    return obj;
};

CloneablePool.prototype.putBack = function (cloneable) {
    let poolItem;
    let i, len = this.pool.length;

    // Mark the object as available again.
    for ( i = 0; i < len; i++) {
        poolItem = this.pool[i];

        if (poolItem.object === cloneable) {
            poolItem.available = true;
            return;
        }
    }
};

// Rectangle object
function Rectangle (x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

Rectangle.prototype.left = function () {
    return this.x;
};

Rectangle.prototype.right = function () {
    return this.x + this.width;
};

Rectangle.prototype.top = function () {
    return this.y;
};

Rectangle.prototype.bottom = function () {
    return this.y + this.height;
};

Rectangle.prototype.intersects = function (r2) {
    return this.right() >= r2.left() &&
           this.left() <= r2.right() &&

           this.top() <= r2.bottom() &&
           this.bottom() >= r2.top();
};

Rectangle.prototype.contains = function (x, y) {
    return this.left() <= x && x <= this.right() &&
           this.bottom() <= y && y <= this.top();
};

Rectangle.prototype.union = function (r2) {
    let x, y, width, height;

    if( r2 === undefined ) {
        return;
    }

    x = Math.min( this.x, r2.x );
    y = Math.min( this.y, r2.y );

    width = Math.max( this.right(), r2.right() ) -
            Math.min( this.left(), r2.left() );

    height = Math.max( this.bottom(), r2.bottom() ) -
             Math.min( this.top(), r2.top() );

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    return this;
};

Rectangle.prototype.intersection = function (r2) {
    let iLeft, iRight, iTop, iBottom;

    iLeft = Math.max(this.left(), r2.left());
    iBottom = Math.min(this.bottom(), r2.bottom());

    iRight = Math.min(this.right(), r2.right());
    iTop = Math.max(this.top(), r2.top());

    //  no intersection
    if (iLeft > iRight || iBottom < iTop) {
        this.x = -1;
        this.y = -1;
        this.width = 0;
        this.height = 0;
    }
    
    // intersection!
    else {
        this.x = iLeft;
        this.y = iTop;
        this.width = iRight - iLeft;
        this.height = iBottom - iTop;
    }


    return this;
};

Rectangle.prototype.getArea = function () {
    return (this.height * this.width);
};


// Sprite Object
function Sprite(image, width, height, frames, frameRate) {
    this.width = width;
    this.height = height;
    this.frames = frames;
    this.frameRate = frameRate;
    this.timer = 0;
    this.currentFrame = 0;
    this.image = image;
    this.animationEndEvent = null;
    this.layers = [];
    this.draw = true;
    this.foreground = false;
    this.alpha = 1;
    this.fadeAmt = 0;
}

// Constructor for event-based sprites
Sprite.prototype.eventDriven = function (imgPath, width, height, frameWidth, frameHeight, frames, frameRate, row, col) {
    let spriteImage = document.createElement("img");
    let image = document.createElement("img");

    spriteImage.addEventListener("load",  function myLoadHandler() {
        let spriteCanvas = document.createElement("canvas");
        let spriteContext = spriteCanvas.getContext('2d');

        spriteCanvas.width = width*frames;
        spriteCanvas.height = height;

        spriteContext.drawImage(spriteImage,
                                col*frameWidth, row*frameHeight,
                                frameWidth*frames, frameHeight,
                                0, 0,
                                width*frames, height);

        image.src = spriteCanvas.toDataURL('image/png');

        spriteImage.removeEventListener("load", myLoadHandler);
    }, false);

    spriteImage.src = imgPath;

    this.width = width;
    this.height = height;
    this.frames = frames;
    this.frameRate = frameRate;
    this.image = image;

    return this;
};

// Constructor for a static, tiled image
Sprite.prototype.tiled = function (imgPath, width, height, frameWidth, frameHeight, row, col, xTiles, yTiles) {
    let spriteImage = document.createElement("img");
    let image = document.createElement("img");

    spriteImage.addEventListener("load",  function myLoadHandler() {
        let i, j;
        let spriteCanvas = document.createElement("canvas");
        let spriteContext = spriteCanvas.getContext('2d');
        
        spriteCanvas.width = width;
        spriteCanvas.height = height;

        for (i = 0; i < xTiles; i++) {
            for (j = 0; j < yTiles; j++) {
                spriteContext.drawImage(spriteImage,
                                        col*frameWidth, row*frameHeight,
                                        frameWidth, frameHeight,
                                        i*width/xTiles, j*height/yTiles,
                                        width/xTiles, height/yTiles);
            }
        }

        image.src = spriteCanvas.toDataURL('image/png');

        spriteImage.removeEventListener("load", myLoadHandler);
    }, false);

    spriteImage.src = imgPath;

    this.width = width;
    this.height = height;
    this.frameRate = 0;
    this.frames = 1;
    this.image = image;

    return this;
};

Sprite.prototype.resetAnimation = function () {
    this.currentFrame = 0;
};

Sprite.prototype.update = function (dt) {
    let i;

    // Fade in or out
    this.alpha = clamp(this.alpha+this.fadeAmt, 0, 1);

    // Update sprite layers
    for (i = 0; i < this.layers.length; i++) {
        this.layers[i].update(dt);
    }

    // While the sprite is animated...
    if (this.frameRate > 0) {
        this.timer += dt;
        
        // Increment the frame
        if (this.timer > 1/this.frameRate) {
            this.timer = 0;
            this.currentFrame++;

            // Run the callback after the animation finishes
            if (this.currentFrame > this.frames-1 && this.animationEndEvent !== null) {
                this.animationEndEvent();
            }
        }
    }
};

Sprite.prototype.init = function () {
    this.width = 0;
    this.height = 0;
    this.frameRate = 0;
    this.frames = 0;
    this.currentFrame = 0;
    this.timer = 0;
    this.alpha = 1;
    this.fadeAmt = 0;
    this.layers.length = 0;
    this.image = null;
    this.animationEndEvent = null;
    this.draw = true;
    this.foreground = false;
};

Sprite.prototype.clone = function () {
    return new Sprite(this.image, this.width, this.height, this.frames, this.frameRate);
};

Sprite.prototype.copyAttributes = function (otherSprite) {
    this.width = otherSprite.width;
    this.height = otherSprite.height;
    this.frameRate = otherSprite.frameRate;
    this.frames = otherSprite.frames;
    this.image = otherSprite.image;
    this.animationEndEvent = otherSprite.animationEndEvent;
    this.draw = otherSprite.draw;
    this.alpha = otherSprite.alpha;
    this.fadeAmt = otherSprite.fadeAmt;
    this.foreground = otherSprite.foreground;

    return this;
};

Sprite.prototype.addLayer = function (newSprite) {
    this.layers.push(newSprite);
};


///////////////////////////////////////
// Game entities
///////////////////////////////////////

// Entity superclass
function Entity(x, y, width, height, sprite) {
    this.x = x;
    this.y = y;

    this.xFraction = 0;
    this.yFraction = 0;

    this.time = 0;

    this.width = width;
    this.height = height;

    this.sprite = sprite;

    this.hitbox = new Rectangle(this.x - this.width/2,
                                        this.y - this.height/2,
                                        this.width,
                                        this.height);
}

Entity.prototype.init = function () {
    this.x = 0;
    this.y = 0;
    this.xFraction = 0;
    this.yFraction = 0;

    this.time = 0;
    this.sprite = null;
};

Entity.prototype.clone = function () {
    return new Entity(this.x, this.y, this.width, this.height, this.sprite);
};

// Update time step
Entity.prototype.update = function (dt) {
    let newX = this.x;
    let newY = this.y;
    let xFrac = this.xFraction;
    let yFrac= this.yFraction;

    this.time += dt;

    // Apply any fractions
    newX += xFrac;
    newY += yFrac;

    // Convert x and y to whole numbers and store leftover fractions
    xFrac = newX % 1;
    yFrac = newY % 1;

    newX -= xFrac;
    newY -= yFrac;

    // Finalize changes
    this.x = newX;
    this.y = newY;

    this.xFraction = xFrac;
    this.yFraction = yFrac;


};

// Entity rectangle collision
Entity.prototype.collisionRect = function () {
    this.hitbox.x = this.x;
    this.hitbox.y = this.y;
    this.hitbox.width = this.width;
    this.hitbox.height = this.height;

    return this.hitbox;
};

// Check collisions
Entity.prototype.isCollidingWith = function(entity2) {
    let myHitbox = this.collisionRect();
    let notMyHitbox = entity2.collisionRect();

    return myHitbox.intersects(notMyHitbox);
};

// Temporary Entity object (goes away pretty soon)
function TempEntity(x, y, width, height, sprite) {
    Entity.call(this, x, y, width, height, sprite);
}

// Temporary Entity extends Entity
TempEntity.prototype = Object.create(Entity.prototype);

TempEntity.prototype.init = function () {
    Entity.prototype.init.call(this);
};

TempEntity.prototype.clone = function () {
    return new TempEntity(this.x, this.y, this.width, this.height, this.sprite);
};

// Player object
function Player(x, y, sprite) {
    let width = 0;
    let height = 0;

    if (sprite) {
        width = sprite.width;
        height = sprite.height;
    }

    Entity.call(this, x, y, width, height, sprite);

    this.maxLife = 3;
    this.life = this.maxLife;
}

// Player extends Entity
Player.prototype = Object.create(Entity.prototype);

// Update player
Player.prototype.update = function (dt) {
    Entity.prototype.update.call(this, dt);

    game.addScore(1);
};

// Increase life amount
Player.prototype.addLife = function () {
    this.life += 1;
    
    if (this.life >= this.maxLife)
        this.life = this.maxLife;
};

// Decrease life
Player.prototype.loseLife = function () {
    this.life -= 1;
    
    if (this.life <= 0)
        game.setGameOver();
};

// Move player to new coordinates
Player.prototype.move = function (x, y) {
    this.x = x;
    this.y = y;
};

// Enemy object
function Enemy(x, y, speed, invisPointY, sprite) {
    let width = 0;
    let height = 0;

    if (sprite) {
        width = sprite.width;
        height = sprite.height;
    }

    Entity.call(this, x, y, width, height, sprite);
    
    this.invisPointY = invisPointY;
    this.speed = speed;
    this.isFake = false;
    this.lane = 1;
    this.triggeredWave = false;
    this.triggeredPause = false;
    this.clicked = false;
}

// Enemy extends Entity
Enemy.prototype = Object.create(Entity.prototype);

Enemy.prototype.init = function () {
    Entity.prototype.init.call(this);

    this.x = -100;
    this.y = -100;
    this.invisPointY = 0;
    this.speed = 0;
    this.lane = 1;
    this.isFake = false;
    this.triggeredWave = false;
    this.triggeredPause = false;
    this.clicked = false;
};

Enemy.prototype.clone = function () {
    return new Enemy(this.x, this.y, this.speed, this.invisPointY, this.sprite);
};

// Update time step
Enemy.prototype.update = function (dt) {
    Entity.prototype.update.call(this, dt);

    this.y += this.speed;
};


// Sound object
function Sound(filePath, audioContext, gainNode, loop=false) {
    let my = this;
    let testAudio;
    let xhr;
    
    // Initialize fields (constructor stuff)
    this.buffer = null;
    this.audioContext = audioContext;
    this.gainNode = gainNode;
    this.loop = loop;

    // Check for file type compatibility
    testAudio = document.createElement("audio");

    if (testAudio.canPlayType) {

        // Can we use a .mp4 file?
        if ( !!testAudio.canPlayType && testAudio.canPlayType('audio/mp4') !== "" ) {
            filePath += ".mp4";
        }

        // If we can't use .mp4, can we use a .ogg file?
        else if ( !!testAudio.canPlayType && testAudio.canPlayType('audio/ogg; codecs="vorbis"') !== "" ){
            filePath += ".ogg";
        }

        // Uh-oh! Neither are supported :(
        else {
            console.log("Error: MP4 and OGG files are unsupported on this device.");
            return;
        }
    }

    // Fetch the file
    xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI(filePath), true);
    xhr.responseType = 'arraybuffer';

    // Oopsie doopsie, couldn't fetch the file
    xhr.addEventListener("error", function() {
        console.log('Error loading from server: ' + filePath);
    }, false);

    // On successful load, decode the audio data
    xhr.addEventListener("load", function() {

        audioContext.decodeAudioData(xhr.response,

            // Success
            function(audioBuffer) {
                my.buffer = audioBuffer;
            },

            // Error
            function(e) {
                console.log("Error decoding audio data: " + e.err);
            });
    }, false);

    xhr.send();
}

// Play function, for playing the sound
Sound.prototype.play = function() {
    let thisObject = this;

    // Play the sound only if it's been decoded already
    if (this.buffer) {
        let bufferSource = this.audioContext.createBufferSource();
        bufferSource.buffer = this.buffer;
        bufferSource.connect(this.gainNode).connect(this.audioContext.destination);
        bufferSource.start(0);
        bufferSource.loop = this.loop;
    }

    // If it hasn't been decoded yet, check every 50ms to see if it's ready
    else {
        window.setTimeout(function() {
            thisObject.play();
        }, 50);
    }
};;
///////////////////////////////////////
// Resources
///////////////////////////////////////
let resources = (function () {
    // Sprites

    const SPRITE_SIZE = 128;

    let realSize = 90;


    // eventDriven(imgPath, width, height, frameWidth, frameHeight, frames, frameRate, row, col)
    // tiled(imgPath, width, height, frameWidth, frameHeight, row, col, xTiles, yTiles)
    let _spritePool = new CloneablePool(new Sprite(null, 0, 0, 0, 0));

    //let _playerWalkingUp = _spritePool.take().eventDriven("build/sprites/animals.png", 60, 60, 26, 37, 2, 6, 3, 3);
    //_playerWalkingUp.animationEndEvent = _playerWalkingUp.resetAnimation;
    let _enemySprite = _spritePool.take().eventDriven("build/sprites/ghost.png", 72, 72, SPRITE_SIZE, SPRITE_SIZE, 1, 0, 0, 0);
    //let _playerExplode = _spritePool.take().eventDriven("build/sprites/explosion.png", 51, 51, 223, 174, 21, 21, 0, 0);
    //let _pileOfLeaves = _spritePool.take().tiled("build/sprites/grassland.png", GAME_FIELD_WIDTH, 60, 128, 128, 15, 4, 6, 1);
    let _tapIcon = _spritePool.take().eventDriven("build/sprites/tap.png", realSize, realSize, 64, 64, 2, 3, 0, 0);
    _tapIcon.animationEndEvent = _tapIcon.resetAnimation;
    //let _tiledGrass = _spritePool.take().tiled("build/sprites/grassland.jpg", GAME_FIELD_WIDTH, GAME_FIELD_HEIGHT, 128, 128, 0, 0, 4, 10);
    let _tiledGrass = _spritePool.take().tiled("build/sprites/grassland-tile.jpg", GAME_FIELD_WIDTH, GAME_FIELD_HEIGHT, 414, 307, 0, 0, 1, 2);
    let _bigX = _spritePool.take().eventDriven("build/sprites/bigx.png", realSize, realSize, SPRITE_SIZE, SPRITE_SIZE, 1, 0, 0, 0);
    //let _life = _spritePool.take().eventDriven("build/sprites/life.png", SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 1, 0, 0, 0);
    let _check = _spritePool.take().eventDriven("build/sprites/check.png", realSize, realSize, SPRITE_SIZE, SPRITE_SIZE, 1, 0, 0, 0);
    let _grave = _spritePool.take().eventDriven("build/sprites/grave.png", realSize, realSize, SPRITE_SIZE, SPRITE_SIZE, 1, 0, 0, 0);
    
    let _fogSize = (GAME_FIELD_HEIGHT/2) - (GAME_FIELD_HEIGHT/4);
    let _fog = _spritePool.take().eventDriven("build/sprites/fog.png", GAME_FIELD_WIDTH, _fogSize, 438, 266, 1, 0, 0, 0);

    // Audio
    let _audioContext;

    let _musicGainNode;
    let _sfxGainNode;

    let _masterVolume, _musicVolume, _sfxVolume;

    // Context
    let AudioContext = window.AudioContext || window.webkitAudioContext;
    _audioContext = new AudioContext();
    
    // Volume control (1 = 100%)
    _masterVolume = 1;
    _musicVolume = 0.1;
    _sfxVolume = 0.15;

    // Music volume
    _musicGainNode = _audioContext.createGain();
    _musicGainNode.gain.value = _musicVolume;

    // Sound Effects volume
    _sfxGainNode = _audioContext.createGain();
    _sfxGainNode.gain.value = _sfxVolume;

    // SFX
    let _valid = new Sound("audio/ding", _audioContext, _sfxGainNode);
    let _error = new Sound("audio/error", _audioContext, _sfxGainNode);
    let _bgm = new Sound("audio/bgm", _audioContext, _musicGainNode, true);

    function _initVolume() {
        let lastVol;

        // Retrieve previous session's volume
        if (typeof(Storage) !== "undefined") {
            try {
                lastVol = JSON.parse(localStorage.getItem('nback_masterVolume'));
            }
            catch(e) {
                console.log("Previous volume data is corrupted or missing.");
            }


            // Restore volume if loaded successfully
            if (lastVol || lastVol === 0) {
                _masterVolume = lastVol;
                this.setMasterVolume(lastVol);

                return lastVol;
            }
        }

        // Failed. Return null
        return null;
    }
    
    function _setMasterVolume() {
        _masterVolume = vol;
            
        _sfxGainNode.gain.value = _sfxVolume * vol;
        _musicGainNode.gain.value = _musicVolume * vol;

        // Save the latest volume data
        if (typeof(Storage) !== "undefined") {
            try {
                localStorage.setItem('nback_masterVolume', JSON.stringify(_masterVolume));
            }
            catch (e) {
                console.log("Error: an issue occurred when saving volume data.");
            }
        }
    }

    function _putSpriteBack(spr) {
        let i;

        for (i = spr.layers.length; i >= 0; i--) {
            _spritePool.putBack(spr.layers[i]);
            //spr.layers.length--;
        }

        _spritePool.putBack(spr);
        }

    return {
        //spr_playerWalkingUp: function() { return _spritePool.take().copyAttributes(_playerWalkingUp); },
        spr_enemy: function() { return _spritePool.take().copyAttributes(_enemySprite); },
        //spr_explosion: function() { return _spritePool.take().copyAttributes(_playerExplode); },
        //spr_leafPile: function() { return _spritePool.take().copyAttributes(_pileOfLeaves); },
        spr_tapIcon: function() { return _spritePool.take().copyAttributes(_tapIcon); },
        spr_tiledGrass: function() { return _spritePool.take().copyAttributes(_tiledGrass); },
        spr_bigX: function() { return _spritePool.take().copyAttributes(_bigX); },
        //spr_life: function() { return _spritePool.take().copyAttributes(_life); },
        spr_check: function() { return _spritePool.take().copyAttributes(_check); },
        spr_grave: function() { return _spritePool.take().copyAttributes(_grave); },
        spr_fog: function() { return _spritePool.take().copyAttributes(_fog); },

        snd_valid: _valid,
        snd_error: _error,
        snd_bgm: _bgm,

        initVolume: _initVolume,
        setMasterVolume: _setMasterVolume,
        putSpriteBack: _putSpriteBack
    };
})();;
///////////////////////////////////////
// Renderer
///////////////////////////////////////

let renderer = (function () {
    const SCORE_ELEMENT = document.getElementById("bar-label");
    const START_BUTTON = document.getElementById("start-button");

    // Variables
    let _livesDiv;

    let _canvas = resizer.getCanvas();
    let _context = _canvas.getContext("2d", { alpha: false });

    let _currentHeight = GAME_FIELD_HEIGHT;
    let _currentWidth = GAME_FIELD_WIDTH;

    

    let previousLives = 0;
    let previousScore = 0;

    let _fgObjects = [];

    // Draw a sprite to the context
    function _drawSprite(sprite, x, y) {
        let layers = sprite.layers;
        let original = sprite;
        let i;

        // Draw the sprite and each layer
        for(i = 0; i <= layers.length; i++) {
            sprite = layers[i];

            if (i === layers.length) {
                sprite = original;
            }

            // If the image is static or the animation reached its end,
            // only draw the last frame (sometimes the only frame)
            if (sprite.draw &&
                (sprite.frameRate <= 0 || sprite.currentFrame >= sprite.frames)) {

                // Apply opacity
                _context.save();
                _context.globalAlpha = sprite.alpha;

                // Draw the image
                _context.drawImage(sprite.image,
                                    sprite.width*(sprite.frames-1), 0,
                                    sprite.width, sprite.height,
                                    x, y,
                                    sprite.width, sprite.height);

                // Restore to normal opacity for everything else
                _context.restore();
            }

            // Otherwise, draw the correct frame of the animated sprite
            else if (sprite.draw) {

                // Apply opacity
                _context.save();
                _context.globalAlpha = sprite.alpha;

                // Draw the image
                _context.drawImage(sprite.image,
                                    sprite.width*sprite.currentFrame, 0,
                                    sprite.width, sprite.height,
                                    x, y,
                                    sprite.width, sprite.height);

                // Restore to normal opacity for everything else
                _context.restore();
            }
        }
        
    }

    // Draw moving background
    let _drawBG = (function () {
        let y = 0;
        let movingSpeed = GAME_SPEED;
        let bgImg = resources.spr_tiledGrass();

        return function () {
            _drawSprite(bgImg, 0, y-GAME_FIELD_HEIGHT);
            _drawSprite(bgImg, 0, y);

            if (game.accelerating() && !game.gameOver()) {
                y = (y+movingSpeed) % GAME_FIELD_HEIGHT;
            }
        };
    })();

    function _updateUI (forceUpdate=false) {
            let numLives, score;
            let i;

            if (game && !game.started()) {
                // Hide lives
                //_livesDiv.style.display = "none";
                
                // Make start button disappear
                START_BUTTON.style.display = "block";
            }
            else if (game) {
                // Show lives
                //_livesDiv.style.display = "flex";

                // Make start button disappear
                START_BUTTON.style.display = "none";

                numLives = game.player().life;
                score = game.score();

                // Update score
                if (previousScore !== score || forceUpdate) {
                    previousScore = score;
                    SCORE_ELEMENT.textContent = "Score: " + score;
                    //let dpr = window.devicePixelRatio || 1;
                    //SCORE_ELEMENT.textContent = "DPR: " + dpr;
                }
                
                // Update Player Lives
                if( previousLives !== numLives || forceUpdate ) {

                    previousLives = numLives;

                    /*for (i = 0; i < _livesDiv.childNodes.length; i++) {
                        if (_livesDiv.childNodes[i] instanceof Image) {
                            _livesDiv.removeChild(_livesDiv.childNodes[i]);
                            i--;
                        }
                    }

                    // Add an image for each life
                    for (i = 0; i < numLives; i++) {
                        let img = document.createElement("img");
                        img.src = LIFE_IMAGE.image.src;
                        img.className = "life";

                        _livesDiv.appendChild(img);
                    }*/
                }
            }
        }

    // Render game elements and entities
    function _render(dt) {
        let entity;
        let entities = game.entities();
        let i, len = entities.length;

        // Fill background
        _drawBG();
        
        // Update UI
        _updateUI();

        // Draw every game entity and update their sprites
        for (i = 0; i < len; i++) {
            entity = entities[i];

            //_context.fillStyle = "#FF0000";
            //_context.fillRect(entity.x, entity.y, entity.width, entity.height);

            //_context.fillStyle = "#000000";
            //if (clickBox !== null) {
            //   _context.fillRect(clickBox.x, clickBox.y, clickBox.width, clickBox.height);
            //}

            // Only render the enemy if it actually has a sprite to render
            if (entity.sprite) {
                // Update the sprite animation if the game is not paused
                // TempEntity objects should animate even when paused
                if (game.accelerating() || entity instanceof TempEntity || entity.sprite.fadeAmt !== 0) {
                    entity.sprite.update(dt);
                }

                // Save foreground sprites for drawing after everyone else
                if (entity.sprite.foreground) {
                    _fgObjects.push(entity);
                }

                // Use different positioning for temp entities
                else if (entity instanceof TempEntity) {
                    _drawSprite(entity.sprite, entity.x + entity.width/4, entity.y);
                }

                // Otherwise draw normally
                else {
                    _drawSprite(entity.sprite, entity.x/*-(entity.width/4)*/, entity.y/*-(entity.height/2)*/);
                }
            }
        }

        for (i = 0; i < _fgObjects.length; i++) {
            entity = _fgObjects[i];
            _drawSprite(entity.sprite, entity.x, entity.y);
        }
        _fgObjects.length = 0;
    }

    return {
        render: _render,
        canvas: _canvas
    };

})();;
///////////////////////////////////////
// Game
///////////////////////////////////////

let game = (function() {
    /* jshint validthis: true */

    let _tempPool = new CloneablePool(new TempEntity(0, 0, 0, 0, null));
    let _enemyPool = new CloneablePool(new Enemy(0, 0, 0, 0, null));

    let _entities, _entitiesToRemove, _enemies, _frontRowEnemies;
    let _player;
    let _enemySpeed = GAME_SPEED;

    let _stoppingThreshold = GAME_FIELD_HEIGHT - (GAME_FIELD_HEIGHT/5);
    let _newWaveThreshold = GAME_FIELD_HEIGHT / 4;
    let _clickZone = GAME_FIELD_HEIGHT - GAME_FIELD_HEIGHT/3;

    let _lastFrameTime;
    
    let _accelerating;
    let _inputBuffered, _inputEventFired;
    let _inputEnabled;

    let _started = false;
    let _gameOver;

    let _easyAccuracy = false;

    let _updateFunc;
    let _gameOverAnimation;

    let _score;
    let _scoreFraction;
    let _highScores;
    let _multiplier = 1;

    let _lanes = (function() {
        const NUM_LANES = 6;
        //const MARGIN = 20;
        //const TOTAL_MARGIN_SPACE = MARGIN * (NUM_LANES+1);

        let laneList = [];
        let i;

        // Populate the list of lanes with the x coord of each left bound
        for (i = 0; i < NUM_LANES; i++) {
            laneList.push( GAME_FIELD_WIDTH * (i/NUM_LANES) );
        }

        // Get the lane number by x coordinate
        function getLaneByLocation(x) {
            for (i = NUM_LANES; i >= 0; i--) {
                if ( x > laneList[i] ) {
                    return i;
                }
            }

            return -1;
        }

        // Get the center of a numbered lane
        function getCenterX(laneNumber) {
            return laneList[laneNumber];// + (GAME_FIELD_WIDTH / NUM_LANES / 2);//MARGIN;
        }

        return {
            NUM_LANES: NUM_LANES,
            getLaneByLocation: getLaneByLocation,
            getCenterX: getCenterX
        };
    })();

    // Spawn a wave of enemies
    let _waves = (function() {
        let numClones;
        let invisTurningPoint; 
        let cloneList;

        let wavesPassed;
        let wavesSpawned;

        let tutorialEvents;
        let tutorialCounter;

        let fog1, fog2, fog3;

        function updateWavesPassed() {
            wavesPassed++;
        }

        function init() {
            numClones = 0;
            cloneList = [];

            wavesPassed = 0;
            wavesSpawned = 0;

            tutorialEvents = [];
            tutorialCounter = 0;

            fog1 = new Entity(-GAME_FIELD_WIDTH, -GAME_FIELD_HEIGHT, 0, 0, resources.spr_fog());
            fog2 = new Entity(-GAME_FIELD_WIDTH, -GAME_FIELD_HEIGHT, 0, 0, resources.spr_fog());
            fog3 = new Entity(-GAME_FIELD_WIDTH, -GAME_FIELD_HEIGHT, 0, 0, resources.spr_fog());

            fog1.sprite.foreground = true;
            fog2.sprite.foreground = true;
            fog3.sprite.foreground = true;

            _addEntity(fog1);
            _addEntity(fog2);
            _addEntity(fog3);

            // Initialize to something that enemies will never reach
            invisTurningPoint = GAME_FIELD_HEIGHT * 2;
        }
        
        function spawn() {
            let enemy, realEnemy, enemyLane, i;
            let isTutorialWave = false;

            // numClones === number of graves
            //console.log(wavesPassed);

            // Fog events
            switch(wavesPassed) {
                case 4:
                    fog1.x = 0;
                    fog1.y = invisTurningPoint-_newWaveThreshold+20;
                    fog1.sprite.alpha = 0;
                    fog1.sprite.fadeAmt = 0.04;
                    break;

                case 18:
                case 78:
                    fog2.x = 0;
                    fog2.y = invisTurningPoint-_newWaveThreshold+130;
                    fog2.sprite.alpha = 0;
                    fog2.sprite.fadeAmt = 0.04;
                    break;

                case 33:
                case 118:
                    fog3.x = 0;
                    fog3.y = invisTurningPoint-_newWaveThreshold+130;
                    fog3.sprite.alpha = 0;
                    fog3.sprite.fadeAmt = 0.04;
                    break;

                case 58:
                    fog2.sprite.fadeAmt = -0.04;
                    fog3.sprite.fadeAmt = -0.04;
                    break;
            }

            // Wave events
            switch(wavesSpawned) {
                case 0:
                case 1:
                case 2:
                    isTutorialWave = true;
                    break;

                case 5:
                case 6:
                case 7:
                    // Increase graves
                    numClones = 1;
                    
                    // Start disappearing
                    invisTurningPoint = GAME_FIELD_HEIGHT * (3/4);
                    isTutorialWave = true;
                    break;

                case 20:
                    invisTurningPoint = GAME_FIELD_HEIGHT / 2;
                    break;

                case 35:
                    invisTurningPoint = GAME_FIELD_HEIGHT / 3;
                    break;

                case 60:
                    numClones = 2;
                    invisTurningPoint = GAME_FIELD_HEIGHT * (3/4);
                    break;

                case 80:
                    invisTurningPoint = GAME_FIELD_HEIGHT / 2;
                    break;

                case 130:
                    invisTurningPoint = GAME_FIELD_HEIGHT / 3;
                    break;

                case 200:
                    numClones = 3;
                    invisTurningPoint = GAME_FIELD_HEIGHT * (3/4);
                    break;

                case 220:
                    invisTurningPoint = GAME_FIELD_HEIGHT / 2;
                    break;

                case 330:
                    invisTurningPoint = GAME_FIELD_HEIGHT / 3;
                    break;

                default:
                    if (wavesSpawned > 350) {
                        invisTurningPoint = GAME_FIELD_HEIGHT / 5;
                    }
            }

            // Choose which lanes to spawn the enemies in
            enemyLane = randomInt(_lanes.NUM_LANES - numClones);

            // Make the enemy and its grave(s)
            for (i = 0; i <= numClones; i++) {
                enemy = _enemyPool.take();

                enemy.lane = enemyLane+i;
                enemy.x = _lanes.getCenterX(enemyLane+i);
                enemy.y = -10;
                enemy.speed = _enemySpeed;
                enemy.invisPointY = invisTurningPoint;
                enemy.sprite = resources.spr_grave();
                enemy.width = enemy.sprite.width;
                enemy.height = enemy.sprite.width;
                enemy.isFake = true;

                cloneList[i] = enemy;
                _addEntity(enemy);
            }

            // Pick one enemy to be the real one
            realEnemy = cloneList[randomInt(cloneList.length)];
            resources.putSpriteBack(realEnemy.sprite);
            realEnemy.sprite = resources.spr_enemy();
            realEnemy.sprite.addLayer(resources.spr_grave());
            realEnemy.isFake = false;
            realEnemy.sprite.draw = true;

            // Keep track of tutorial waves
            if (isTutorialWave) {
                tutorialEvents.push({lane: realEnemy.lane, wave: wavesSpawned});
            }

            // Update number of waves spawned
            wavesSpawned++;
        }

        function showTutorial() {

            // Only show tutorial if there are lanes in the tutorial array
            if (tutorialCounter < tutorialEvents.length && tutorialEvents[tutorialCounter].wave === wavesPassed) {
                let tutorialTap;

                // Create tutorial tap icon
                tutorialTap = _tempPool.take();

                tutorialTap.x = _lanes.getCenterX( tutorialEvents[tutorialCounter++].lane );
                tutorialTap.y = _stoppingThreshold;
                tutorialTap.sprite = resources.spr_tapIcon();
                tutorialTap.width = tutorialTap.sprite.width;
                tutorialTap.height = tutorialTap.sprite.height;

                _addEntity(tutorialTap);
            }
        }

        return {
            init: init,
            updateWavesPassed: updateWavesPassed,
            showTutorial: showTutorial,
            spawn: spawn,
            wavesPassed: function() { return wavesPassed; }
        };
    })();


    // Add onto game score
    function _addScore(num) {
        _score += (num * _multiplier) + _scoreFraction;

        _scoreFraction = _score % 1;

        if (_scoreFraction > 0) {
            _score -= _scoreFraction;
        }
        //console.log(_score);
    }

    // Insert a score into list of high scores
    function _insertScore(score) {
        _highScores.push(score);
        // Sort scores, highest first
        _highScores.sort(function(a, b){return b-a;});
        // Only top 10 scores
        _highScores = _highScores.slice(0, 10);
        // Insert into local storage
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem("nback_scores", JSON.stringify(_highScores));
        }
    }

    // Toggle buffer flag
    function _toggleInputBuffer() {
        _inputBuffered = !_inputBuffered;
    }


    // Speed up wave until past player; player cannot move during this time
    function _toggleAcceleration() {
        _accelerating = !_accelerating;
    }

    function _setInputEventFired() {
        _inputEventFired = true;
    }

    // Game over
    function _setGameOver() {
        if (!_gameOver) {
            _gameOver = true;
            //_player.sprite = resources.spr_explosion();
            _insertScore(Math.round(_score));
            
            //console.log(_highScores);
        }
    }

    // Start game
    function _start() {
        if (_entities) { 
            _removeEntities(_entities);
        }
        _entities = [];
        _enemies = [];
        _frontRowEnemies = [];
        _entitiesToRemove = [];
        _gameOver = false;
        _accelerating = true;
        _inputBuffered = false;
        _inputEventFired = false;
        _inputEnabled = false;
        _score = 0;
        _scoreFraction = 0;
        _lastFrameTime = 0;
        _waves.init();

        

        // Access/store high scores in local storage
        if (typeof(Storage) !== "undefined") {
            try {
                _highScores = JSON.parse(localStorage.getItem("nback_scores"));
            }
            catch(e) {
                _highScores = [];
            }

            if (_highScores === null) {
                _highScores = [];
            }
        }

        // Spawn player and first wave
        //_addEntity(new Player(_lanes.getCenterX(1), GAME_FIELD_HEIGHT-60, resources.spr_playerWalkingUp()));
        _player = new Player(-100, -100, null);
        _addEntity(_player);
        _waves.spawn();

        // Begin game loop
        if (!_started) {
            _started = true;
            _updateFunc = this.update.bind(this);

            if (_gameOverAnimation)
                window.cancelAnimationFrame(_gameOverAnimation);

            window.requestAnimationFrame(_updateFunc);
        }
    }

    // Add an entity into the game
    function _addEntity(entity) {
        if (entity instanceof Player) {
            _player = entity;
        }

        else if (entity instanceof Enemy) {
            _enemies.push(entity);
        }

        _entities.push(entity);
    }

    // Remove entities from game
    function _removeEntities(entitiesToRemove) {
        let i, j, len = entitiesToRemove.length;

        // Don't do anything if no entities to remove
        if (len === 0) {
            return;
        }
        
        // Go through the arrays and remove those in the kill list
        // (note: because of mutableRemoveIndex, we have to count down
        //  to 0; if counting up to len, i will surpass the length of
        //  the array due to length changing as entities are removed)
        for (i = len-1; i >= 0; i--) {
            let entityToRemove = entitiesToRemove[i];
            let idxToRemove;

            // Put back the entity's sprite (and each of its layers)
            if (entityToRemove.sprite !== null) {

                // Original sprite
                resources.putSpriteBack(entityToRemove.sprite);
            }

            // General entities array
            idxToRemove = _entities.indexOf(entityToRemove);
            
            // Only remove if it's actually there
            if (idxToRemove >= 0) {
                mutableRemoveIndex(_entities, idxToRemove);
            }

            // Enemies
            idxToRemove = _enemies.indexOf(entityToRemove);

            // Only remove if it's actually there
            if (idxToRemove >= 0) {
                mutableRemoveIndex(_enemies, idxToRemove);
                // Put the object back in its pool
                _enemyPool.putBack(entityToRemove);
            }

            // Temporary Entitites
            if (entityToRemove instanceof TempEntity) {
                _tempPool.putBack(entityToRemove);
            }
        }

        // Wipe player off the face of the planet if
        // we must
        if (entitiesToRemove.includes(_player)) {
            _player = undefined;
        }
    }

    // Update game
    function _update(time) {
        let entity;
        let alertZone;
        let pauseThresholdPassed = false;
        let i, len = _entities.length;

        // Smooth FPS
        let dt = Math.min((time - _lastFrameTime) / 1000, 3/60);

        _lastFrameTime = time;

        // Stop game if game over is reached
        if (_gameOver) {
            renderer.render(dt);
            _started = false;
            _gameOverAnimation = window.requestAnimationFrame(_updateFunc);
            return;
        }

        // Update all entities
        for (i = 0; i < len; i++) {
            entity = _entities[i];
            alertZone = entity.invisPointY-_newWaveThreshold;

            if (_accelerating) {
                entity.update(dt);
            }

            // Enemy in the clickZone? Keep track in frontRow array
            if (entity instanceof Enemy && 
                entity.y >= _clickZone &&
                !entity.clicked &&
                _frontRowEnemies.indexOf(entity) < 0) {

                    _frontRowEnemies.push(entity);
            }

            // Entity offscreen? Delet
            if (entity.y > GAME_FIELD_HEIGHT) {
                _entitiesToRemove.push(entity);

                if (entity instanceof Enemy && !entity.isFake) {
                    // Increment waves passed
                    //_waves.updateWavesPassed();

                    // Lose life for missing one
                    //_player.loseLife();
                    
                    if (_inputBuffered)
                        _toggleInputBuffer();
                }
            }

            /*/ Check collisions with player
            else if (entity instanceof Enemy &&
                    !entity.isFake && 
                    entity.isCollidingWith(_player)) {
                // Add life, kill enemy, update waves passed
                _player.addLife();
                _entitiesToRemove.push(entity);
                
                _wavesPassed++;

                if (_inputBuffered)
                    _toggleInputBuffer();
            }*/

            // About to be invisible?
            else if (entity instanceof Enemy &&
                    !entity.isFake &&
                    entity.y >= alertZone &&
                    entity.y < entity.invisPointY) {
                
                // Begin transparency
                entity.sprite.alpha = 1 - ( (entity.y - alertZone) / (entity.invisPointY - alertZone) );
            }

            // Invisible?
            else if (entity instanceof Enemy &&
                    !entity.isFake &&
                    entity.y >= entity.invisPointY &&
                    !entity.clicked) {

                    entity.sprite.draw = false;
            }

            // Spawn a new wave after previous wave passed
            // a certain distance
            if (entity instanceof Enemy &&
                !entity.isFake &&
                entity.y >= _newWaveThreshold &&
                !entity.triggeredWave) {

                _waves.spawn();
                entity.triggeredWave = true;
            }

            // Pause the game when a wave is within a distance
            // of the player
            if (_accelerating && 
                !_inputBuffered &&
                entity instanceof Enemy &&
                entity.y >= _stoppingThreshold &&
                !entity.triggeredPause) {

                    pauseThresholdPassed = true;
                    entity.triggeredPause = true;
            }

            // Remove temp entities when an input event is fired
            if (_inputEventFired && entity instanceof TempEntity)
                _entitiesToRemove.push(entity);
        }

        if (pauseThresholdPassed) {
            _toggleAcceleration();
            _toggleInputBuffer();

            // Show tutorial stuff, if there is any left
            _waves.showTutorial();

            // Re-enable input
            _toggleInput();

            // Start a timer to determine any score multipliers
            _inputTimer.start();
        }

        // Toggle flag
        if (_inputEventFired) {
            _inputEventFired = false;
        }

        // Delete offscreen or absorbed enemies
        _removeEntities(_entitiesToRemove);
        _entitiesToRemove.length = 0;

        // Render frame
        renderer.render(dt);

        // Loop
        window.requestAnimationFrame(_updateFunc);
    }

    function _toggleInput() {
        _inputEnabled = !_inputEnabled;
    }

    let _inputTimer = (function() {
        const WAIT_TIME = 1500;
        let timeout;
        let timerStillRunning = false;
        let successes = 0;
        let untilMultiplierIncrease = 3;

        function start() {
            timerStillRunning = true;
            timeout = window.setTimeout(reset, WAIT_TIME);
        }

        function stop() {
            if (timerStillRunning) {
                window.clearTimeout(timeout);
                timerStillRunning = false;
                successes = (successes+1) % untilMultiplierIncrease;

                if (successes === 1) {
                    untilMultiplierIncrease += 2;
                    _multiplier += 0.5;
                    //console.log(_multiplier + "x multipler!");
                }
            }
        }

        function reset() {
            _multiplier = 1;
            successes = 0;
            untilMultiplierIncrease = 3;
            timerStillRunning = false;

            console.log("Multiplier reset to 1.");
        }

        return {
            start: start,
            stop: stop,
            reset: reset
        };
    })();
    

    return {
        start: _start,
        update: _update,
        setGameOver: _setGameOver,
        addScore: _addScore,
        toggleAcceleration: _toggleAcceleration,
        toggleInputBuffer: _toggleInputBuffer,
        setInputEventFired: _setInputEventFired,
        lanes: _lanes,
        addEntity: _addEntity,
        clickZone: _clickZone,
        updateWavesPassed: _waves.updateWavesPassed,
        toggleInput: _toggleInput,
        inputTimer: _inputTimer,
        easyAccuracy: _easyAccuracy,
        stoppingThreshold: _stoppingThreshold,
        inputEnabled: function() { return _inputEnabled; },
        accelerating: function() { return _accelerating; },
        inputBuffered: function() { return _inputBuffered; },
        //score: function() { return _score; },
        //highScores: function () { return _highScores; },
        started: function() { return _started; },
        gameOver: function() { return _gameOver; },
        entities: function () { return _entities; },
        enemies: function () { return _enemies; },
        player: function () { return _player; },
        frontRowEnemies: function () { return _frontRowEnemies; },
        score: function() { return _score; }
        
    };


})();

;
//////////////////////////////////////
// Input Handling
///////////////////////////////////////

///////////////////////////////////////
// Touch
///////////////////////////////////////
renderer.canvas.addEventListener("touchstart", function(event) {
    //event.preventDefault();

    if (lastEvent === "mousedown") {

        if ( (Date.now() - eventTime) > inputDeviceSwapTime ) {
            lastEvent = event.type;
            eventTime = Date.now();
            inputHandler(event);
        } 
    }
    else {
        lastEvent = event.type;
        eventTime = Date.now();
        inputHandler(event); 
    }
});

///////////////////////////////////////
// Mouse
///////////////////////////////////////
renderer.canvas.addEventListener("mousedown", function(event) {
    //event.preventDefault();

    if (lastEvent === "touchstart") {

        if ( (Date.now() - eventTime) > inputDeviceSwapTime ) {
            lastEvent = event.type;
            eventTime = Date.now();
            inputHandler(event);
        } 
    }
    else {
        lastEvent = event.type;
        eventTime = Date.now();
        inputHandler(event); 
    }
});


///////////////////////////////////////
// Input Helper Functions
///////////////////////////////////////

// The bulk of the handler for touch or mouse event
function inputHandler(event) {
    if (!game.started()) {
        return;
    }

    let clickLocation;
    let clickZone = game.clickZone;
    let enemy, intendedEnemy = null, enemies = game.frontRowEnemies(), player = game.player();
    let i, len = enemies.length;
    let collisionRect;
    let intersectionArea = 0, hitArea = 0;
    
    // Touch input
    if (event.type === "touchstart") {
        clickLocation = resizer.getRelativeEventCoords(event.changedTouches[0]);
    }

    // Mouse click input
    else if (event.type === "mousedown") {
        clickLocation = resizer.getRelativeEventCoords(event);
    }

    // Only register the input if the game is running, the input location was valid,
    // and the player is allowed to input
    if (!game.gameOver() && player && game.inputEnabled() &&
        clickLocation.y >= clickZone) {

        // Determine the location of the clickbox
        clickBox.x = clickLocation.x - (clickBoxSize/2);
        clickBox.y = clickLocation.y - (clickBoxSize/2);

        if (game.easyAccuracy) {
            clickBox.x = game.lanes.getCenterX(game.lanes.getLaneByLocation(clickLocation.x));
            clickBox.y = game.stoppingThreshold;
            clickBox.height = 64;
            clickBox.width = 1;
        }

        // Did the user click on an enemy?
        for (i = 0; i < len; i++) {
            enemy = enemies[i];

            collisionRect = enemy.collisionRect();
            intersectionArea = collisionRect.intersection(clickBox).getArea();

            // NOTE: intersection area > 0 if there is any actual intersection (player actually clicked on an enemy)

            // If more of the clickBox is on this enemy, then this is the intended enemy
            if (/*collisionRect.intersects(clickBox) && */intersectionArea > hitArea) {
                hitArea = intersectionArea;
                enemy.clicked = true;
                intendedEnemy = enemy;
            }
            
        }

        if (hitArea > 0) {
            // Disable input for now, so player can't click multiple enemies in one go
            game.toggleInput();

            // Put the sprite back since we are changing it anyway
            resources.putSpriteBack(intendedEnemy.sprite);

            // If the clicked enemy is fake, lose life, reset multiplier
            if (intendedEnemy.isFake) {
                intendedEnemy.sprite = resources.spr_bigX();
                player.loseLife();
                game.inputTimer.reset();
                resources.snd_error.play();
                
            }

            // It's real! Gain a life
            else {
                intendedEnemy.sprite = resources.spr_check();
                player.addLife();
                game.inputTimer.stop();
                resources.snd_valid.play();
            }

            // Toggle event flag
            game.setInputEventFired();

            // Unpause the game
            if (!game.accelerating()) {
                game.toggleAcceleration();
            }
            
            // If the game is already unpaused, buffer the input
            else if (!game.inputBuffered()) {
                game.toggleInputBuffer();
            }


            // Reset the front row for next wave
            enemies.length = 0;
            game.updateWavesPassed();
        }
    }
}

///////////////////////////////////////
// Main Logic
///////////////////////////////////////
/*
function volHandler(label, slider) {
    // Convert slider value to a number (from a string)
    let vol = slider.value;
    vol = Number(vol);

    // Since IOS doesn't allow volume control,
    // simply go between mute and unmute
    if (renderer.isIOS()) {
        if (vol <= 0) {
            vol = 1;
            slider.value = "1";
        }
        else {
            vol = 0;
            slider.value = "0";
        }
    }

    // Adjust the volume icon accordingly
    if (vol <= 0) {
        label.innerHTML = "volume_mute";
    }
    else {
        label.innerHTML = "volume_up";
    }

    // Set the volume of all sounds
    resources.setMasterVolume(vol);
}

// Configure volume
let overlaySlider = document.querySelector("#overlay-volume~.slider");
let widebarSlider = document.querySelector("#widebar-volume~.slider");
let overlayLabel = document.querySelector("#overlay-volume+label>i");
let widebarLabel = document.querySelector("#widebar-volume+label>i");

document.getElementById("overlay-volume").checked = false;
document.getElementById("widebar-volume").checked = false;

// Mouse events
overlaySlider.addEventListener("mouseup", function(e) {
    volHandler(overlayLabel, overlaySlider);
});
widebarSlider.addEventListener("mouseup", function(e) {
    volHandler(widebarLabel, widebarSlider);
});

// Touch events
if (renderer.isIOS()) {
    // Don't display the slider on IOS
    overlaySlider.style.visibility = "hidden";
    widebarSlider.style.visibility = "hidden";

    overlayLabel.addEventListener("touchend", function(e) {
        e.preventDefault();
        volHandler(overlayLabel, overlaySlider);
    });
    widebarLabel.addEventListener("touchend", function(e) {
        e.preventDefault();
        volHandler(widebarLabel, widebarSlider);
    });
}
else {
    // Else proceed normally
    overlaySlider.addEventListener("touchend", function(e) {
        e.preventDefault();
        volHandler(overlayLabel, overlaySlider);
    });
    widebarSlider.addEventListener("touchend", function(e) {
        e.preventDefault();
        volHandler(widebarLabel, widebarSlider);
    });
}*/

// Start the game when the button is clicked
document.getElementById("start-button").addEventListener("click", function() { game.start(); });

// Prevent stuff like user scrolling
// Passive: false is required for it to register
document.body.addEventListener("touchmove", function (e) {
    e.preventDefault();
}, { passive: false });


/*/ Load event for everything
window.addEventListener("load", function() {
    // Ensure volume is still what it's supposed to be
    let lastVol = resources.initVolume();

    if (lastVol === 0) {
        overlayLabel.innerHTML = "volume_mute";
        widebarLabel.innerHTML = "volume_mute";
    }
    else if (lastVol) {
        overlayLabel.innerHTML = "volume_up";
        widebarLabel.innerHTML = "volume_up";
    }
    
    document.getElementById("container").style.display = "block";
}, false);*/

//////////////////////////
// Resize events
//////////////////////////

// Every time the Resizer resizes things, do some extra
// recaculations to position the sample button in the center
resizer.addResizeEvent(resizeBarButtons);

// Manual resize to ensure that our resize functions are executed
// (could have also just called resizerBarButtons() but this will do for demonstration purposes)
resizer.resize();


//////////////////////////
// Button events
//////////////////////////

pauseBtn.addEventListener("click", function() { showMenu(pauseMenu); }, false);
resumeBtn.addEventListener("click", function() { hideMenu(pauseMenu); }, false);
miniHelpBtn.addEventListener("click", function() { switchMenu(pauseMenu, helpMenu); }, false);


helpBtn.addEventListener("click", function() { showMenu(helpMenu); }, false);
backBtn.addEventListener("click", function() { switchMenu(helpMenu, pauseMenu); }, false);
})();