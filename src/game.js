///////////////////////////////////////
// Game
///////////////////////////////////////

let game = (function() {
    /* jshint validthis: true */
    const MAX_INFINITE_WAVES = 1000;

    let _tempPool = new CloneablePool(new TempEntity(0, 0, 0, 0, null));
    let _enemyPool = new CloneablePool(new Enemy(0, 0, 0, 0, null));

    let _entities, _entitiesToRemove, _enemies, _frontRowEnemies;
    let _player;
    let _enemySpeed = GAME_SPEED;
    
    let _enemyStart = -resources.STANDARD_SIZE;

    // DEFAULT:
    // Basically just takes the (HEIGHT/10) and rounds it to nearest factor of enemy speed
    // (also accounting for the offset of _enemyStart)
    const _defaultNewWaveThreshold = Math.round(GAME_FIELD_HEIGHT/10/GAME_SPEED + 1)*GAME_SPEED - (_enemyStart%GAME_SPEED + GAME_SPEED);
    let _newWaveThresholds;

    let _stoppingThreshold = GAME_FIELD_HEIGHT - (GAME_FIELD_HEIGHT/5);
    _stoppingThreshold = _stoppingThreshold - _stoppingThreshold%_enemySpeed;
    let _clickZone = GAME_FIELD_HEIGHT - GAME_FIELD_HEIGHT/3;

    let _lastFrameTime;
    
    let _accelerating;
    let _inputBuffered, _inputEventFired;
    let _inputEnabled;

    let _started = false;
    let _gameOver;

    let _updateFunc;
    let _gameOverAnimation;

    let _score;
    let _scoreFraction;
    //let _highScores;
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
        let spawn;

        let tutorialEvents;
        let tutorialCounter;

        const FOG_FADE_SPEED = 0.04;
        let fogs;
        let fogPool;

        let waveMap;
        let graveShapes;

        function updateWavesPassed() {
            wavesPassed++;
        }

        function init(levelData) {
            levelData = levelData || {};

            // If passed an array of levels
            if (levelData.map) {
                waveMap = levelData.map;

                fogLevels = levelData.fogLevels;

                spawn = spawnNextWave;
            }

            // If no levels are passed in
            else {
                spawn = spawnRandomWave;
            }

            graveShapes = levelData.graveShapes;

            numClones = 0;
            cloneList = [];

            wavesPassed = 0;
            wavesSpawned = 0;

            tutorialEvents = [];
            tutorialCounter = 0;

            fogPool = new CloneablePool(new Entity(0,0,0,0,null));
            fogs = [];

            // Initialize to something that enemies will never reach
            invisTurningPoint = GAME_FIELD_HEIGHT * 2;
        }

        function setFogLevel(wavesObscured) {
            let theFog, waveDistance;
            let i, j;

            // Remove fogs, if needed
            while (fogs.length > wavesObscured) {
                theFog = fogs.pop();

                theFog.sprite.fadeAmt = -FOG_FADE_SPEED;

                fogPool.putBack(theFog);
                _removeEntities([theFog]);
            }

            // Add in fogs, if needed
            i = fogs.length;
            while (fogs.length < wavesObscured) {

                theFog = fogPool.take();

                theFog.sprite = resources.spr_fog();
                theFog.sprite.alpha = 0;
                theFog.sprite.fadeAmt = FOG_FADE_SPEED;
                theFog.sprite.foreground = true;
                theFog.x = 0;

                theFog.y = _stoppingThreshold;
                for (j = 0; j <= i; j++) {
                    waveDistance = _newWaveThresholds[wavesPassed+i] - _enemyStart;
                    theFog.y -= waveDistance;// - (waveDistance*i);// - (_enemies[0].height/2);
                }
                theFog.y -= resources.STANDARD_SIZE/2;
                //invisTurningPoint = theFog.y + (_enemies[0].height/2);

                fogs.push(theFog);
                _addEntity(theFog);


                //////////////////
                // SUS BEGINS HERE, FIX LATER
                ///////////////////
                // if (fogs.length >= 2) {
                //     let midFog = fogPool.take();

                //     midFog.sprite = resources.spr_fog();
                //     midFog.sprite.alpha = 0;
                //     midFog.sprite.fadeAmt = FOG_FADE_SPEED;
                //     midFog.sprite.foreground = true;
                //     midFog.x = 0;

                //     midFog.y = theFog.y + theFog.sprite.height - resources.STANDARD_SIZE;
                //     _addEntity(midFog);
                // }
                ///////////////
                // END SUS
                ///////////////
                i++;
            }
        }

        function spawnNextWave() {
            let newFogLevel, nextWave, i;
            let graveShape;

            // If there are still waves left...
            if ( waveMap.length && waveMap.length > 0 ) {

                // Get the next wave
                nextWave = waveMap.pop();

                // Fog events
                newFogLevel = fogLevels[wavesPassed];
                if (newFogLevel) {
                    setFogLevel(newFogLevel);
                }

                // need to account for the number of graves that
                // spawned before the fog level was set - these graves do
                // not have the correct invisTurningPoint
                
                // Choose which lanes to spawn the enemies in
                enemyLane = randomInt(_lanes.NUM_LANES - numClones);

                // Make the enemy and its grave(s)
                for (i = 0; i < nextWave.length; i++) {
                    enemy = _enemyPool.take();

                    // Is this one the real one?
                    enemy.isFake = !!nextWave[i];

                    if (graveShapes && graveShapes[wavesSpawned]) {
                        graveShape = graveShapes[wavesSpawned][i];
                    }

                    if (enemy.isFake) {
                        enemy.sprite = resources.spr_grave(graveShape);
                    }
                    else {
                        enemy.sprite = resources.spr_enemy();
                        enemy.sprite.addLayer(resources.spr_grave());
                        enemy.draw = true;
                    }

                    enemy.lane = enemyLane+i;
                    enemy.x = _lanes.getCenterX(i);
                    enemy.y = -10;
                    enemy.speed = _enemySpeed;
                    enemy.invisPointY = invisTurningPoint;
                    enemy.width = enemy.sprite.width;
                    enemy.height = enemy.sprite.width;
                    enemy.column = i;

                    _addEntity(enemy);
                }

                // Update number of waves spawned
                wavesSpawned++;
            }

            // No more waves left
            else {
                console.log("No more waves!");
            }
        }
        
        function spawnRandomWave() {
            let enemy, realEnemy, enemyLane, i;
            let isTutorialWave = false;

            // numClones === number of graves
            //console.log(wavesPassed);

            // Fog events
            switch(wavesPassed) {
                case 4:
                    setFogLevel(1);
                    break;

                case 18:
                case 78:
                    setFogLevel(2);
                    break;

                case 33:
                case 118:
                    setFogLevel(3);
                    break;

                case 58:
                    setFogLevel(1);
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
                    //invisTurningPoint = GAME_FIELD_HEIGHT * (3/4);
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart);
                    isTutorialWave = true;
                    break;

                case 20:
                    //invisTurningPoint = GAME_FIELD_HEIGHT / 2;
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart)*2;
                    break;

                case 35:
                    //invisTurningPoint = GAME_FIELD_HEIGHT / 3;
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart)*3;
                    break;

                case 60:
                    numClones = 2;
                    //invisTurningPoint = GAME_FIELD_HEIGHT * (3/4);
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart);
                    break;

                case 80:
                    //invisTurningPoint = GAME_FIELD_HEIGHT / 2;
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart)*2;
                    break;

                case 130:
                    //invisTurningPoint = GAME_FIELD_HEIGHT / 3;
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart)*3;
                    break;

                case 200:
                    numClones = 3;
                    //invisTurningPoint = GAME_FIELD_HEIGHT * (3/4);
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart);
                    break;

                case 220:
                    //invisTurningPoint = GAME_FIELD_HEIGHT / 2;
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart)*2;
                    break;

                case 330:
                    //invisTurningPoint = GAME_FIELD_HEIGHT / 3;
                    invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart)*3;
                    break;

                default:
                    if (wavesSpawned > 350) {
                        //invisTurningPoint = GAME_FIELD_HEIGHT / 5;
                        invisTurningPoint = _stoppingThreshold - (_newWaveThresholds[wavesSpawned] - _enemyStart)*4;
                    }
            }

            // Choose which lanes to spawn the enemies in
            enemyLane = randomInt(_lanes.NUM_LANES - numClones);

            // Make the enemy and its grave(s)
            for (i = 0; i <= numClones; i++) {
                enemy = _enemyPool.take();
                
                enemy.lane = enemyLane+i;
                enemy.x = _lanes.getCenterX(enemyLane+i);
                enemy.y = _enemyStart;
                enemy.speed = _enemySpeed;
                enemy.invisPointY = invisTurningPoint;
                enemy.sprite = resources.spr_grave();
                enemy.width = enemy.sprite.width;
                enemy.height = enemy.sprite.width;
                enemy.isFake = true;
                enemy.column = i;

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
                tutorialTap.sprite.foreground = true;
                tutorialTap.width = tutorialTap.sprite.width;
                tutorialTap.height = tutorialTap.sprite.height;

                _addEntity(tutorialTap);
            }
        }

        return {
            init: init,
            updateWavesPassed: updateWavesPassed,
            showTutorial: showTutorial,
            spawn: function() { spawn(); },
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

    /*/ Insert a score into list of high scores
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
    }*/

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
            //_insertScore(Math.round(_score));
            
            
            tapToStart.textContent = "TAP TO TRY AGAIN!";
            displayTapToStart();
            //console.log(_highScores);

            console.log(performanceData);
        }
    }

    // Start game
    function _start(levelData) {
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

        performanceData = {
            selections: [],
            inputType: "none",
            timeToPick: []
        };

        let i, numWaves, waveSpacing;

        if (levelData) {

            if (levelData.map && !levelData.numWaves) {
                numWaves = levelData.map.length;
            }
            else {
                numWaves = levelData.numWaves || MAX_INFINITE_WAVES;
            }

            if (Array.isArray(levelData.waveSpacing)) {
                _newWaveThresholds = levelData.waveSpacing;
            }
            else {
                _newWaveThresholds = [];
                
                if ( Array.isArray(levelData.waveSpacing) ) {
                    _numWaveThresholds = levelData.waveSpacing;
                    numWaves = -1;
                }
                else if (levelData.waveSpacing) {
                    waveSpacing = levelData.waveSpacing;
                }
                else {
                    waveSpacing = _defaultNewWaveThreshold;
                }

                for (i = 0; i < numWaves; i++) {
                    _newWaveThresholds.push(waveSpacing);
                }
            }
        }
        else {
            _newWaveThresholds = [];
            for (i = 0; i < MAX_INFINITE_WAVES; i++) {
                _newWaveThresholds.push(_defaultNewWaveThreshold);
            }
        }

        _waves.init(levelData);
        

        /*/ Access/store high scores in local storage
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
        }*/

        // Spawn player and first wave
        //_addEntity(new Player(_lanes.getCenterX(1), GAME_FIELD_HEIGHT-60, resources.spr_playerWalkingUp()));
        _player = new Player(-100, -100, null);
        _addEntity(_player);
        _waves.spawn();

        // Begin game loop
        if (!_started) {
            _started = true;
            _updateFunc = this.update.bind(this);

            if (_gameOverAnimation) {
                window.cancelAnimationFrame(_gameOverAnimation);
            }

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
            alertZone = entity.invisPointY-(GAME_FIELD_HEIGHT/3);//_newWaveThreshold;

            if (_accelerating) {
                entity.update(dt);
            }

            // Entity offscreen? Delet
            if (entity.y >= GAME_FIELD_HEIGHT) {
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
            
            // Enemy in the clickZone? Keep track in frontRow array
            else if (entity instanceof Enemy && 
                     entity.y >= _clickZone &&
                     !entity.clicked &&
                     _frontRowEnemies.indexOf(entity) < 0) {

                _frontRowEnemies.push(entity);
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
                entity.y >= _newWaveThresholds[_waves.wavesPassed()] &&
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
        let inputStartTime;

        function start() {
            timerStillRunning = true;
            timeout = window.setTimeout(reset, WAIT_TIME);
            inputStartTime = Date.now();
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

            performanceData.timeToPick.push(Date.now() - inputStartTime);
        }

        function reset(recordTime=false) {
            _multiplier = 1;
            successes = 0;
            untilMultiplierIncrease = 3;
            timerStillRunning = false;

            if (recordTime) {
                performanceData.timeToPick.push(Date.now() - inputStartTime);
            }
            //console.log("Multiplier reset to 1.");
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

