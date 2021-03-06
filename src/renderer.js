///////////////////////////////////////
// Renderer
///////////////////////////////////////

let renderer = (function () {
    const SCORE_TEXT = document.getElementById("bar-label");
    const LIVES_DIV = document.getElementById("lives");

    // Variables
    let _canvas = resizer.getCanvas();
    let _context = _canvas.getContext("2d", { alpha: false });

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
            let numLives, score, svg, use;
            let i;

            if (game && !game.started()) {
                
                // Make start button appear
                //startBtn.style.display = "block";
            }
            else if (game) {

                // Make start button disappear
                //startBtn.style.display = "none";

                numLives = game.player().life;
                score = game.score();

                // Update score
                if (previousScore !== score || forceUpdate) {
                    previousScore = score;
                    SCORE_TEXT.textContent = "Score: " + score;
                }
                
                // Update Player Lives
                if( previousLives !== numLives || forceUpdate ) {

                    previousLives = numLives;

                    for (i = 0; i < LIVES_DIV.childNodes.length; i++) {
                        LIVES_DIV.removeChild(LIVES_DIV.childNodes[i]);
                        i--;
                    }

                    // Add an image for each life
                    for (i = 0; i < numLives; i++) {
                        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                        use = document.createElementNS("http://www.w3.org/2000/svg", "use");

                        use.setAttribute("href", "#heart");

                        svg.appendChild(use);
                        LIVES_DIV.appendChild(svg);
                    }
                }
            }
        }

    // Render game elements and entities
    function _render(dt) {
        let entity;
        let entities = game.entities();
        let i, len;

        // Fill background
        _drawBG();


        if (entities) {
            len = entities.length;

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
    }


    return {
        render: _render,
        canvas: _canvas
    };

})();