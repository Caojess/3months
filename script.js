class LoveJourneyGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game constants
        this.TILE = 32;
        this.GRID_W = 15;
        this.GRID_H = 20;
        this.W = this.GRID_W * this.TILE;
        this.H = this.GRID_H * this.TILE;
        
        // Game state
        this.gameState = 'title'; // title, play, ending, bonus, bonusOver, homeInterior, tofuSoup
        this.gameRunning = false;
        this.lastTime = 0;
        this.hopCooldown = 0;
        
        // Ingredients system
        this.INGREDIENTS = [
            { key: 'tofu', label: 'Tofu', taken: false },
            { key: 'onion', label: 'Onion', taken: false },
            { key: 'broth', label: 'Broth', taken: false },
            { key: 'mushroom', label: 'Mushroom', taken: false },
            { key: 'scallion', label: 'Scallion', taken: false },
            { key: 'chili', label: 'Chili', taken: false }
        ];
        this.collected = new Set();
        this.ingredientPositions = [];
        
        // Camera and world
        this.cameraY = 0;
        this.targetCameraY = 0;
        this.maxPlayerProgress = 0;
        
        // Lane system
        this.lanePattern = ['grass', 'road', 'road', 'grass', 'water', 'water', 'grass', 'road', 'road', 'grass'];
        this.lanes = [];
        this.vehicles = [];
        this.logs = [];
        this.spawnTimer = 0;
        this.gameSpeed = 2;
        
        // Player
        this.player = {
            gridX: Math.floor(this.GRID_W / 2),
            worldY: 0,
            width: this.TILE * 0.8,
            height: this.TILE * 0.8,
            onLog: null,
            alive: true,
            customSprite: null
        };
        
        // Load the new default character sprite
        this.loadDefaultSprite();
        
        // Load partner character for ending
        this.loadPartnerSprite();
        
        // Load tofu soup image
        this.loadTofuSoupImage();
        
        // Home interior animation state
        this.homeInterior = {
            fadeOpacity: 0,
            playerPosX: -50, // Start off-screen left
            partnerPosX: 0,  // Start in center
            animationPhase: 'fadeIn', // fadeIn, playerWalk, approach, hearts
            animationTimer: 0,
            hearts: []
        };
        
        // Initialize audio system
        this.initAudio();
        
        // Initialize camera to show road ahead
        this.cameraY = -this.H * 0.3;
        this.targetCameraY = this.cameraY;
        
        // Goal house (only appears after all ingredients collected)
        this.house = {
            gridX: Math.floor(this.GRID_W / 2) - 2, // Center 5-tile wide house (bigger)
            worldY: null, // Will be set when ingredients are collected
            visible: false,
            entranceSpawned: false
        };
        
        // Game boundary - no content beyond this point
        this.gameWorldTop = undefined;
        
        // Bonus game state
        this.bonusTimer = 30; // 30 seconds
        this.bonusRings = [];
        this.bonusCat = { x: this.W/2, y: this.H/2 };
        this.bonusPlayer = { x: this.W/2, y: this.H/2 };
        this.ringSpawnTimer = 0;
        
        // Customization
        this.config = this.loadConfig();
        
        // Colors - realistic but cute
        this.carColors = ['#FF8A8A', '#8CFFB3', '#8AB3FF', '#FFFF8A', '#FFB38A'];
        this.logColor = '#8B4513';
        
        this.initEventListeners();
        this.updateHUD();
        this.spawnIngredients();
    }
    
    loadDefaultSprite() {
        // Load the new pixel art character as default sprite
        const img = new Image();
        img.onload = () => {
            this.player.customSprite = img;
        };
        img.src = 'character.png';
    }
    
    loadPartnerSprite() {
        // Load the partner character sprite for ending
        this.partnerSprite = new Image();
        this.partnerSprite.src = 'partner-character.png';
    }
    
    loadTofuSoupImage() {
        this.tofuSoupImage = new Image();
        this.tofuSoupImage.src = 'tofu-soup.jpg';
    }
    
    initAudio() {
        // Volume settings - easy to tweak
        this.audioSettings = {
            backgroundMusicVolume: 0.4,  // 40%
            pickupSoundVolume: 0.6,      // 60%
            carSoundsVolume: 0.3,        // 30%
            splashVolume: 0.8,           // 80%
            romanticMusicVolume: 0.5,    // 50%
            doorOpeningVolume: 0.7,      // 70%
            carHonkVolume: 0.8           // 80%
        };
        
        // Background music - starts immediately and loops
        this.backgroundMusic = new Audio('background-music.mp3');
        this.backgroundMusic.loop = true;
        this.backgroundMusic.volume = this.audioSettings.backgroundMusicVolume;
        
        // Pickup sound effect
        this.pickupSound = new Audio('pickup-sound.wav');
        this.pickupSound.volume = this.audioSettings.pickupSoundVolume;
        this.pickupSound.preload = 'auto';
        this.pickupSound.load(); // Force immediate load
        
        // Car sounds - with natural breaks
        this.carSounds = new Audio('car-sounds.wav');
        this.carSounds.loop = false; // We'll handle timing manually
        this.carSounds.volume = this.audioSettings.carSoundsVolume;
        this.carSoundsActive = false;
        this.carSoundTimer = 0;
        
        // Death sound effects - only splash for water
        this.splashSound = new Audio();
        this.splashSound.src = 'splash-sound.wav';
        this.splashSound.volume = this.audioSettings.splashVolume;
        this.splashSound.preload = 'auto';
        this.splashSound.load(); // Force immediate load
        
        // Romantic music for home interior scenes
        this.romanticMusic = new Audio('romantic-music.wav');
        this.romanticMusic.loop = true;
        this.romanticMusic.volume = this.audioSettings.romanticMusicVolume;
        
        // Door opening sound
        this.doorOpeningSound = new Audio('door-opening.wav');
        this.doorOpeningSound.volume = this.audioSettings.doorOpeningVolume;
        
        // Car honk sound for car death
        this.carHonkSound = new Audio('car-honk.wav');
        this.carHonkSound.volume = this.audioSettings.carHonkVolume;
        
        // Start background music immediately
        this.startBackgroundMusic();
    }
    
    startBackgroundMusic() {
        // Auto-play with user interaction handling
        const playMusic = () => {
            this.backgroundMusic.play().catch(e => {
                // If autoplay fails, wait for user interaction
                console.log('Background music autoplay prevented, waiting for user interaction');
                document.addEventListener('click', () => {
                    this.backgroundMusic.play().catch(e => console.log('Music play failed:', e));
                }, { once: true });
            });
        };
        playMusic();
    }
    
    startCarSounds() {
        this.carSoundsActive = true;
        this.carSoundTimer = 0;
        this.playNextCarSound();
    }
    
    stopCarSounds() {
        this.carSoundsActive = false;
        this.carSounds.pause();
        this.carSounds.currentTime = 0;
        this.carSoundTimer = 0;
    }
    
    playNextCarSound() {
        if (!this.carSoundsActive) return;
        
        this.carSounds.currentTime = 0;
        this.carSounds.play().catch(e => console.log('Car sounds play failed:', e));
        
        // Set up next car sound after current one ends + random break
        this.carSounds.onended = () => {
            if (this.carSoundsActive) {
                // Random break between 1-3 seconds (1000-3000ms)
                const breakTime = 1000 + Math.random() * 2000;
                setTimeout(() => {
                    this.playNextCarSound();
                }, breakTime);
            }
        };
    }
    
    playPickupSound() {
        console.log('Playing pickup sound'); // Debug log
        
        // Create a clone of the pickup sound to allow overlapping plays
        try {
            const pickupClone = this.pickupSound.cloneNode();
            pickupClone.volume = this.audioSettings.pickupSoundVolume;
            pickupClone.currentTime = 0;
            pickupClone.play().then(() => {
                console.log('Pickup sound played successfully');
            }).catch(e => {
                console.log('Clone failed, trying original:', e);
                // Fallback: try original sound if clone fails
                this.pickupSound.currentTime = 0;
                this.pickupSound.play().catch(e2 => console.log('Pickup sound play failed:', e2));
            });
        } catch (e) {
            console.log('Clone creation failed, using original:', e);
            // Fallback: use original method if cloning fails
            this.pickupSound.currentTime = 0;
            this.pickupSound.play().catch(e => console.log('Pickup sound play failed:', e));
        }
    }
    
    
    playSplashSound() {
        // Reset and play splash sound
        this.splashSound.currentTime = 0;
        this.splashSound.play().catch(e => console.log('Splash sound play failed:', e));
    }
    
    playCarHonkSound() {
        // Reset and play car honk sound
        this.carHonkSound.currentTime = 0;
        this.carHonkSound.play().catch(e => console.log('Car honk sound play failed:', e));
    }
    
    startRomanticMusic() {
        // Stop background music and start romantic music
        this.backgroundMusic.pause();
        this.romanticMusic.currentTime = 0;
        this.romanticMusic.play().catch(e => console.log('Romantic music play failed:', e));
    }
    
    stopRomanticMusic() {
        this.romanticMusic.pause();
        this.romanticMusic.currentTime = 0;
        // Resume background music
        this.backgroundMusic.play().catch(e => console.log('Background music resume failed:', e));
    }
    
    playDoorOpeningSound() {
        this.doorOpeningSound.currentTime = 0;
        this.doorOpeningSound.play().catch(e => console.log('Door opening sound play failed:', e));
    }
    
    loadConfig() {
        const saved = localStorage.getItem('love-journey-config-v1');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            playerName: 'You',
            boyfriendName: 'Your Love',
            playerSprite: null,
            kissImage: null,
            reasons: [
                'You make me laugh every day',
                'You\'re always there when I need you',
                'You make the best soup',
                'You give the warmest hugs',
                'You listen to me patiently',
                'You support my dreams',
                'You make ordinary moments special',
                'You have the kindest heart',
                'You make me want to be better',
                'You are my home'
            ]
        };
    }
    
    saveConfig() {
        localStorage.setItem('love-journey-config-v1', JSON.stringify(this.config));
    }
    
    initEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (this.gameState === 'title' && (e.key === ' ' || e.key === 'Enter')) {
                this.startGame();
            } else if (this.gameState === 'play' && this.gameRunning) {
                // TESTING SHORTCUT: Press 'T' to teleport to house for testing
                if (e.key.toLowerCase() === 't') {
                    this.teleportToHouseForTesting();
                // TESTING SHORTCUT: Press 'C' to complete all ingredients
                } else if (e.key.toLowerCase() === 'c') {
                    this.completeAllIngredients();
                } else {
                    this.handlePlayerInput(e.key.toLowerCase());
                }
            } else if (this.gameState === 'bonus' && this.gameRunning) {
                this.handleBonusInput(e.key.toLowerCase());
            }
        });
        
        // Button controls
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('bonusBtn').addEventListener('click', () => this.startBonus());
        document.getElementById('backToTitleBtn').addEventListener('click', () => this.backToTitle());
        
        // Canvas click handling for tofu soup button
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        
        // Customize buttons (only modal ones now)
        document.getElementById('saveCustomBtn').addEventListener('click', () => this.saveCustomization());
        document.getElementById('cancelCustomBtn').addEventListener('click', () => this.closeCustomize());
        
        // File uploads
        document.getElementById('playerImage').addEventListener('change', (e) => this.handleImageUpload(e, 'playerSprite'));
        document.getElementById('kissImageUpload').addEventListener('change', (e) => this.handleImageUpload(e, 'kissImage'));
    }
    
    handleImageUpload(event, type) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.config[type] = e.target.result;
                    if (type === 'playerSprite') {
                        this.player.customSprite = img;
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
    
    openCustomize() {
        document.getElementById('customizeModal').classList.remove('hidden');
        document.getElementById('playerName').value = this.config.playerName;
        document.getElementById('boyfriendName').value = this.config.boyfriendName;
        document.getElementById('reasonsText').value = this.config.reasons.join('\\n');
    }
    
    closeCustomize() {
        document.getElementById('customizeModal').classList.add('hidden');
    }
    
    saveCustomization() {
        this.config.playerName = document.getElementById('playerName').value || 'You';
        this.config.boyfriendName = document.getElementById('boyfriendName').value || 'Your Love';
        const reasonsText = document.getElementById('reasonsText').value;
        this.config.reasons = reasonsText.split('\\n').filter(r => r.trim()).slice(0, 10);
        
        // Pad to 10 reasons if needed
        while (this.config.reasons.length < 10) {
            this.config.reasons.push(`Reason ${this.config.reasons.length + 1}`);
        }
        
        this.saveConfig();
        this.closeCustomize();
        this.showToast('Customization saved!');
    }
    
    showToast(message, duration = 1600) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, duration);
    }
    
    teleportToHouseForTesting() {
        console.log('🧪 TESTING: Teleporting to house!');
        
        // Collect all ingredients instantly
        this.INGREDIENTS.forEach(ingredient => {
            ingredient.taken = true;
            this.collected.add(ingredient.key);
        });
        this.updateHUD();
        
        // Spawn the house
        this.spawnHouseEntrance();
        
        // Teleport player to just in front of the house
        this.player.worldY = this.house.worldY;
        this.player.gridX = this.house.gridX + 2; // Right in front of door
        
        // Update camera to show the house area
        this.targetCameraY = (this.house.worldY * this.TILE) - (this.H * 0.5);
        this.cameraY = this.targetCameraY; // Instant camera snap
        
        this.showToast('🧪 TESTING: At house door! Walk into it to test ending scene!');
    }
    
    completeAllIngredients() {
        console.log('🧪 TESTING: Completing all ingredients!');
        
        // Collect all ingredients instantly
        this.INGREDIENTS.forEach(ingredient => {
            ingredient.taken = true;
            this.collected.add(ingredient.key);
        });
        
        // Mark all ingredient positions as taken
        this.ingredientPositions.forEach(ingredient => {
            ingredient.taken = true;
        });
        
        this.updateHUD();
        this.showToast('🧪 TESTING: All ingredients collected! House spawning!');
        
        // Spawn the house entrance since all ingredients are now collected
        this.spawnHouseEntrance();
    }
    
    handleCanvasClick(event) {
        if (this.gameState === 'homeInterior' && 
            this.homeInterior.animationPhase === 'showButton' && 
            this.tofuSoupButton) {
            
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Check if click is within button bounds
            if (x >= this.tofuSoupButton.x && x <= this.tofuSoupButton.x + this.tofuSoupButton.w &&
                y >= this.tofuSoupButton.y && y <= this.tofuSoupButton.y + this.tofuSoupButton.h) {
                
                this.startTofuSoupScene();
            }
        }
    }
    
    startTofuSoupScene() {
        this.gameState = 'tofuSoup';
        this.gameRunning = true;
        
        // Hide ingredients tab
        document.getElementById('gameInfo').style.display = 'none';
        
        // Ensure romantic music is playing
        if (this.romanticMusic.paused) {
            this.startRomanticMusic();
        }
        
        // Tofu soup animation state
        this.tofuSoup = {
            fadeOpacity: 0,
            animationPhase: 'fadeIn',
            animationTimer: 0,
            steamParticles: []
        };
    }
    
    updateHUD() {
        const ingredientList = document.getElementById('ingredientList');
        ingredientList.innerHTML = '';
        
        this.INGREDIENTS.forEach(ingredient => {
            const item = document.createElement('span');
            item.className = 'ingredient-item';
            if (this.collected.has(ingredient.key)) {
                item.classList.add('collected');
                item.textContent = `✓ ${ingredient.label}`;
            } else {
                item.textContent = `○ ${ingredient.label}`;
            }
            ingredientList.appendChild(item);
        });
    }
    
    spawnIngredients() {
        this.ingredientPositions = [];
        this.continuousSpawnTimer = 0;
        
        // Initial spawn of all ingredients with better spacing
        this.spawnInitialIngredients();
    }
    
    spawnInitialIngredients() {
        // Place each ingredient on a safe tile with better distribution
        this.INGREDIENTS.forEach((ingredient, index) => {
            let placed = false;
            let attempts = 0;
            
            while (!placed && attempts < 100) {
                const gx = Math.floor(Math.random() * this.GRID_W);
                // Spread ingredients further apart: -5 to -50, with spacing
                const baseY = -(5 + (index * 8) + Math.floor(Math.random() * 6));
                const gy = baseY - Math.floor(Math.random() * 5); // Add some randomness
                
                const laneType = this.getLaneType(gy);
                if (laneType !== 'water') {
                    // Check if position is free (ensure minimum 3-tile spacing)
                    const tooClose = this.ingredientPositions.some(pos => 
                        Math.abs(pos.gx - gx) < 3 && Math.abs(pos.gy - gy) < 3
                    );
                    if (!tooClose) {
                        this.ingredientPositions.push({
                            key: ingredient.key,
                            label: ingredient.label,
                            gx: gx,
                            gy: gy,
                            taken: ingredient.taken || this.collected.has(ingredient.key)
                        });
                        placed = true;
                    }
                }
                attempts++;
            }
        });
    }
    
    respawnMissingIngredients() {
        // Only add ingredients that haven't been collected yet
        const missingIngredients = this.INGREDIENTS.filter(ing => !this.collected.has(ing.key));
        
        // Clean up taken ingredients
        this.ingredientPositions = this.ingredientPositions.filter(pos => !pos.taken);
        
        missingIngredients.forEach((ingredient) => {
            // Check if this ingredient is already placed and visible
            const alreadyPlaced = this.ingredientPositions.some(pos => 
                pos.key === ingredient.key && !pos.taken
            );
            
            if (!alreadyPlaced) {
                this.spawnIngredientAhead(ingredient);
            }
        });
    }
    
    spawnIngredientAhead(ingredient) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 100) {
            const gx = Math.floor(Math.random() * this.GRID_W);
            // Spawn ahead of player, at least 5 tiles forward, up to 25 tiles ahead
            const minAhead = this.player.worldY - 10;
            const maxAhead = this.player.worldY - 35;
            const gy = Math.floor(Math.random() * (minAhead - maxAhead + 1)) + maxAhead;
            
            const laneType = this.getLaneType(gy);
            if (laneType !== 'water') {
                // Check if position is free with spacing
                const tooClose = this.ingredientPositions.some(pos => 
                    Math.abs(pos.gx - gx) < 2 && Math.abs(pos.gy - gy) < 2
                );
                if (!tooClose) {
                    this.ingredientPositions.push({
                        key: ingredient.key,
                        label: ingredient.label,
                        gx: gx,
                        gy: gy,
                        taken: false
                    });
                    placed = true;
                }
            }
            attempts++;
        }
    }
    
    continuouslySpawnIngredients() {
        this.continuousSpawnTimer++;
        
        // Spawn missing ingredients every 2 seconds (120 frames at 60fps) - more frequent
        if (this.continuousSpawnTimer >= 120) {
            this.respawnMissingIngredients();
            this.continuousSpawnTimer = 0;
        }
    }
    
    getLaneType(worldY) {
        // Starting area (worldY >= 0) is always grass (safe)
        if (worldY >= 0) {
            return 'grass';
        }
        
        // Check if we're in house area
        if (this.house.entranceSpawned && this.houseEntrance) {
            // Area beyond house (5 lanes past house) is all grass - out of bounds
            if (worldY < this.house.worldY - 5) {
                return 'grass'; // All grass beyond house
            }
            
            // ENTIRE house area from grassFieldStart to grassFieldEnd should be grass
            if (worldY <= this.houseEntrance.grassFieldStart && worldY >= this.houseEntrance.grassFieldEnd) {
                return 'grass'; // All house area is safe grass!
            }
        }
        
        // For other negative worldY (forward progress), use dynamic pattern
        return this.getDynamicLaneType(worldY);
    }
    
    getDynamicLaneType(worldY) {
        // Simple alternating pattern: 2-3 streets, 1 grass, 2-3 rivers, 1 grass
        const absY = Math.abs(worldY);
        
        // Create 7-row repeating sections
        const sectionSize = 7;
        const sectionIndex = Math.floor(absY / sectionSize);
        const positionInSection = absY % sectionSize;
        
        // Alternate between 2 and 3 street rows based on section
        const streetRows = 2 + (sectionIndex % 2); // Alternates between 2 and 3
        
        if (positionInSection < streetRows) {
            return 'road'; // Street section (2 or 3 rows)
        } else if (positionInSection === streetRows) {
            return 'grass'; // 1 grass separator
        } else if (positionInSection < streetRows + 3) {
            return 'water'; // 2 water rows  
        } else {
            return 'grass'; // Final grass separator
        }
    }
    
    startGame() {
        document.getElementById('titleScreen').classList.add('hidden');
        // Show ingredients tab
        document.getElementById('gameInfo').style.display = 'block';
        this.gameState = 'play';
        this.gameRunning = true;
        this.resetGame();
        this.startCarSounds();
        this.gameLoop(performance.now());
    }
    
    restartGame() {
        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('endingModal').classList.add('hidden');
        // Show ingredients tab again
        document.getElementById('gameInfo').style.display = 'block';
        this.gameState = 'play';
        this.gameRunning = true;
        this.resetGame();
        this.startCarSounds();
        this.gameLoop(performance.now());
    }
    
    backToTitle() {
        document.getElementById('bonusModal').classList.add('hidden');
        document.getElementById('titleScreen').classList.remove('hidden');
        this.gameState = 'title';
        this.gameRunning = false;
        this.stopCarSounds();
        this.stopRomanticMusic();
    }
    
    resetGame() {
        this.player.gridX = Math.floor(this.GRID_W / 2);
        this.player.worldY = 0;
        this.player.onLog = null;
        this.player.alive = true;
        this.maxPlayerProgress = 0;
        this.vehicles = [];
        this.logs = [];
        this.spawnTimer = 0;
        this.continuousSpawnTimer = 0;
        this.gameSpeed = 2;
        this.cameraY = -this.H * 0.3;
        this.targetCameraY = this.cameraY;
        this.hopCooldown = 0;
        
        // Always reset house state on death (since ingredients reset)
        this.house.visible = false;
        this.house.entranceSpawned = false;
        this.house.worldY = null;
        this.houseEntrance = null;
        this.gameWorldTop = undefined;
        this.finalStretchMode = false;
        
        // Reset all ingredients when player dies
        this.collected = new Set();
        this.INGREDIENTS.forEach(ingredient => {
            ingredient.taken = false;
        });
        this.updateHUD();
        
        // Respawn all ingredients since they're all reset
        this.spawnIngredients();
    }
    
    handlePlayerInput(key) {
        if (this.hopCooldown > 0) return;
        
        const maxGridX = this.GRID_W - 1;
        
        switch(key) {
            case 'w':
            case 'arrowup':
                this.player.worldY--;
                this.player.onLog = null;
                this.hopCooldown = 120; // 120ms cooldown
                
                // Update max progress and camera target
                if (this.player.worldY < this.maxPlayerProgress) {
                    this.maxPlayerProgress = this.player.worldY;
                    this.updateCameraTarget();
                }
                break;
            case 's':
            case 'arrowdown':
                // Can move backward but only to starting position
                if (this.player.worldY < 0) {
                    this.player.worldY++;
                    this.player.onLog = null;
                    this.hopCooldown = 120;
                }
                break;
            case 'a':
            case 'arrowleft':
                if (this.player.gridX > 0) {
                    this.player.gridX--;
                    this.player.onLog = null;
                    this.hopCooldown = 120;
                }
                break;
            case 'd':
            case 'arrowright':
                if (this.player.gridX < maxGridX) {
                    this.player.gridX++;
                    this.player.onLog = null;
                    this.hopCooldown = 120;
                }
                break;
        }
        
        // Check for ingredient pickup
        this.checkIngredientPickup();
        
        // Check if at house
        this.checkHouseEntry();
    }
    
    checkIngredientPickup() {
        this.ingredientPositions.forEach(ingredient => {
            if (!ingredient.taken && 
                Math.floor(ingredient.gx) === Math.floor(this.player.gridX) && 
                ingredient.gy === this.player.worldY) {
                
                ingredient.taken = true;
                this.collected.add(ingredient.key);
                
                // Find the ingredient definition and mark it taken too
                const ingredientDef = this.INGREDIENTS.find(ing => ing.key === ingredient.key);
                if (ingredientDef) {
                    ingredientDef.taken = true;
                }
                
                // Play pickup sound
                this.playPickupSound();
                
                this.updateHUD();
                this.showToast(`Picked: ${ingredient.label} ✅`);
                
                // Check if this was the last ingredient
                if (this.collected.size === this.INGREDIENTS.length) {
                    this.showToast('All ingredients collected! The house awaits! 🏠');
                    this.spawnHouseEntrance();
                }
            }
        });
    }
    
    spawnHouseEntrance() {
        if (this.house.entranceSpawned) return;
        
        // Calculate where to place house - closer and visible
        const currentTopOfScreen = this.cameraY;
        const houseY = Math.floor(currentTopOfScreen / this.TILE) - 12; // Closer - only 12 tiles ahead
        
        this.house.worldY = houseY;
        this.house.visible = true;
        this.house.entranceSpawned = true;
        
        // Set game boundary - no more content beyond this point
        this.gameWorldTop = houseY - 5;
        
        // Create approach with easier terrain
        this.houseEntrance = {
            grassFieldStart: houseY + 5,  // Shorter approach
            grassFieldEnd: houseY - 2,    
            pathStart: houseY + 3,        // Shorter path section
            fenceLeft: this.house.gridX - 3,
            fenceRight: this.house.gridX + 8,
            gateY: houseY + 1,
            // Smaller challenge zone
            challengeZoneStart: houseY + 8,
            challengeZoneEnd: houseY + 5
        };
        
        // Increase difficulty for the final stretch
        this.finalStretchMode = true;
        
        // Don't snap camera to house immediately - let player discover it naturally
        // House will appear naturally as player moves forward
    }
    
    checkHouseEntry() {
        // Only check if house is visible and all ingredients collected
        if (!this.house.visible || this.collected.size !== this.INGREDIENTS.length) {
            return;
        }
        
        // Check if player is near the front door (more forgiving)
        if (this.player.worldY === this.house.worldY &&
            this.player.gridX >= this.house.gridX &&
            this.player.gridX <= this.house.gridX + 4) {
            
            console.log('Player entered house! Position:', this.player.gridX, this.player.worldY);
            this.enterHouse();
        }
    }
    
    enterHouse() {
        this.gameState = 'homeInterior';
        this.gameRunning = true; // Keep running for animations
        this.stopCarSounds();
        
        // Hide ingredients tab
        document.getElementById('gameInfo').style.display = 'none';
        
        // Play door opening sound effect
        this.playDoorOpeningSound();
        
        // Start romantic music for the intimate scenes (slight delay after door sound)
        setTimeout(() => {
            this.startRomanticMusic();
        }, 500);
        
        // Reset home interior animation state
        this.homeInterior = {
            fadeOpacity: 0,
            playerPosX: 50, // Start from left side of screen
            partnerPosX: this.W / 2, // Partner in center
            animationPhase: 'fadeIn',
            animationTimer: 0,
            heartsPhaseTimer: 0, // Separate timer for hearts phase
            hearts: []
        };
        
        // Debug tracking
        this.lastPhaseLog = -1;
    }
    
    winGame() {
        this.gameState = 'ending';
        this.gameRunning = false;
        this.stopCarSounds();
        this.stopRomanticMusic();
        this.showEndingModal();
    }
    
    showEndingModal() {
        const modal = document.getElementById('endingModal');
        const reasonsList = document.getElementById('reasonsList');
        const kissImage = document.getElementById('kissImage');
        const defaultKiss = document.getElementById('defaultKiss');
        
        // Set up kiss section
        if (this.config.kissImage) {
            kissImage.src = this.config.kissImage;
            kissImage.classList.remove('hidden');
            defaultKiss.classList.add('hidden');
        } else {
            kissImage.classList.add('hidden');
            defaultKiss.classList.remove('hidden');
        }
        
        // Set up reasons list
        reasonsList.innerHTML = '';
        this.config.reasons.forEach(reason => {
            const li = document.createElement('li');
            li.textContent = reason;
            reasonsList.appendChild(li);
        });
        
        modal.classList.remove('hidden');
    }
    
    startBonus() {
        document.getElementById('endingModal').classList.add('hidden');
        this.gameState = 'bonus';
        this.gameRunning = true;
        this.bonusTimer = 30;
        this.bonusRings = [];
        this.bonusPlayer = { x: this.W/2, y: this.H/2 };
        this.ringSpawnTimer = 0;
        this.gameLoop(performance.now());
    }
    
    handleBonusInput(key) {
        if (this.hopCooldown > 0) return;
        
        const moveDistance = this.TILE;
        
        switch(key) {
            case 'w':
            case 'arrowup':
                if (this.bonusPlayer.y > moveDistance) {
                    this.bonusPlayer.y -= moveDistance;
                    this.hopCooldown = 120;
                }
                break;
            case 's':
            case 'arrowdown':
                if (this.bonusPlayer.y < this.H - moveDistance) {
                    this.bonusPlayer.y += moveDistance;
                    this.hopCooldown = 120;
                }
                break;
            case 'a':
            case 'arrowleft':
                if (this.bonusPlayer.x > moveDistance) {
                    this.bonusPlayer.x -= moveDistance;
                    this.hopCooldown = 120;
                }
                break;
            case 'd':
            case 'arrowright':
                if (this.bonusPlayer.x < this.W - moveDistance) {
                    this.bonusPlayer.x += moveDistance;
                    this.hopCooldown = 120;
                }
                break;
        }
    }
    
    updateCameraTarget() {
        // Camera follows max progress, keeps player in bottom third when moving forward
        this.targetCameraY = (this.maxPlayerProgress * this.TILE) - (this.H * 0.7);
    }
    
    updateCamera() {
        // Smooth camera interpolation for less jarring movement
        const lerpSpeed = 0.1;
        this.cameraY += (this.targetCameraY - this.cameraY) * lerpSpeed;
    }
    
    spawnVehiclesAndLogs() {
        this.spawnTimer++;
        
        if (this.spawnTimer >= 60 - this.gameSpeed * 5) {
            // Check visible rows and spawn for each lane type
            const startRow = Math.floor(this.cameraY / this.TILE) - 2;
            const endRow = startRow + Math.ceil(this.H / this.TILE) + 4;
            
            for (let worldRow = startRow; worldRow <= endRow; worldRow++) {
                // Don't spawn obstacles in house area or beyond game boundary
                if (this.gameWorldTop !== undefined && worldRow < this.gameWorldTop) {
                    continue;
                }
                
                // Don't spawn in house area at all
                if (this.house.entranceSpawned && this.houseEntrance) {
                    // Don't spawn beyond house (5 lanes past house)
                    if (worldRow < this.house.worldY - 5) {
                        continue; // Skip spawning beyond house
                    }
                    
                    // Don't spawn in ENTIRE house area
                    if (worldRow <= this.houseEntrance.grassFieldStart && worldRow >= this.houseEntrance.grassFieldEnd) {
                        continue; // Skip spawning in entire house area
                    }
                }
                
                const laneType = this.getLaneType(worldRow);
                
                // Reduce spawn rates for better gameplay
                let vehicleChance = 0.2; // Reduced from 0.3 to 0.2
                let logChance = 0.2;
                
                // Check if we're in a 3-lane street section (reduce car spawns)
                if (laneType === 'road') {
                    const absY = Math.abs(worldRow);
                    const sectionIndex = Math.floor(absY / 7);
                    const streetRows = 2 + (sectionIndex % 2); // Same logic as getDynamicLaneType
                    
                    if (streetRows === 3) {
                        vehicleChance *= 0.7; // Reduce by 30% on 3-lane streets
                    }
                }
                
                if (this.finalStretchMode && this.houseEntrance && 
                    worldRow <= this.houseEntrance.challengeZoneStart && 
                    worldRow >= this.houseEntrance.challengeZoneEnd) {
                    vehicleChance = 0.1; // Even lower vehicle density
                    logChance = 0.25;     // Reduced from 0.35 to 0.25
                }
                
                if (laneType === 'road' && Math.random() < vehicleChance) {
                    this.spawnVehicle(worldRow, this.finalStretchMode);
                } else if (laneType === 'water' && Math.random() < logChance) {
                    this.spawnLog(worldRow, this.finalStretchMode);
                }
            }
            
            this.spawnTimer = 0;
        }
    }
    
    spawnVehicle(worldRow, isFinalStretch = false) {
        // Check if there are existing vehicles in this row to maintain same direction
        const existingVehicles = this.vehicles.filter(v => v.worldY === worldRow);
        let goingRight;
        
        if (existingVehicles.length > 0) {
            // Use same direction as existing vehicles in this row
            goingRight = existingVehicles[0].speed > 0;
        } else {
            // Determine direction based on row for consistency
            goingRight = worldRow % 2 === 0; // Even rows go right, odd rows go left
        }
        
        // Make vehicles much slower for better gameplay
        const baseSpeed = isFinalStretch ? (0.8 + Math.random() * 1.0) : (1.0 + Math.random() * 1.2);
        const vehicleWidth = isFinalStretch ? this.TILE * 0.8 : this.TILE * 0.9;
        
        const vehicle = {
            gridX: goingRight ? -2 : this.GRID_W + 1,
            worldY: worldRow,
            width: vehicleWidth,
            height: this.TILE * 0.7,
            speed: baseSpeed * (goingRight ? 1 : -1),
            color: this.carColors[Math.floor(Math.random() * this.carColors.length)]
        };
        
        this.vehicles.push(vehicle);
    }
    
    spawnLog(worldRow, isFinalStretch = false) {
        const goingRight = Math.random() > 0.5;
        
        // Make logs LONGER and slower in final stretch for easier gameplay
        const logLength = isFinalStretch ? 
            3 + Math.floor(Math.random() * 2) : // 3-4 grid units (longer!)
            2 + Math.floor(Math.random() * 3);  // 2-4 grid units long
        
        const baseSpeed = isFinalStretch ? (0.6 + Math.random() * 1.0) : (0.8 + Math.random() * 1.2);
        
        const log = {
            gridX: goingRight ? -logLength : this.GRID_W + 1,
            worldY: worldRow,
            width: this.TILE * logLength * 0.9,
            height: this.TILE * 0.8,
            speed: baseSpeed * (goingRight ? 1 : -1),
            length: logLength
        };
        
        this.logs.push(log);
    }
    
    updateVehiclesAndLogs() {
        // Update vehicles
        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const vehicle = this.vehicles[i];
            vehicle.gridX += vehicle.speed * 0.02;
            
            // Remove vehicles that are off screen
            if (vehicle.gridX > this.GRID_W + 3 || vehicle.gridX < -3) {
                this.vehicles.splice(i, 1);
            }
        }
        
        // Update logs
        for (let i = this.logs.length - 1; i >= 0; i--) {
            const log = this.logs[i];
            log.gridX += log.speed * 0.02;
            
            // Move player with log if they're on it
            if (this.player.onLog === log) {
                this.player.gridX += log.speed * 0.02;
                
                // Check if player fell off the log boundaries
                if (this.player.gridX < 0 || this.player.gridX >= this.GRID_W) {
                    this.gameOver('water');
                    return;
                }
            }
            
            // Remove logs that are off screen
            if (log.gridX > this.GRID_W + 4 || log.gridX < -4) {
                if (this.player.onLog === log) {
                    this.player.onLog = null;
                }
                this.logs.splice(i, 1);
            }
        }
    }
    
    checkCollisions() {
        const playerWorldY = this.player.worldY;
        const laneType = this.getLaneType(playerWorldY);
        
        // Reset log status
        this.player.onLog = null;
        
        if (laneType === 'road') {
            // Check vehicle collisions
            for (const vehicle of this.vehicles) {
                if (vehicle.worldY === playerWorldY &&
                    this.player.gridX < vehicle.gridX + (vehicle.width / this.TILE) &&
                    this.player.gridX + (this.player.width / this.TILE) > vehicle.gridX) {
                    this.gameOver('car');
                    return;
                }
            }
        } else if (laneType === 'water') {
            // Check if player is on a log - made more forgiving
            let onLog = false;
            for (const log of this.logs) {
                if (log.worldY === playerWorldY) {
                    // More forgiving collision detection with overlap buffer
                    const playerLeft = this.player.gridX - 0.3; // 0.3 tile buffer
                    const playerRight = this.player.gridX + 0.8; // Player width + buffer
                    const logLeft = log.gridX;
                    const logRight = log.gridX + log.length;
                    
                    // Check if there's any overlap between player and log
                    if (playerRight > logLeft && playerLeft < logRight) {
                        this.player.onLog = log;
                        onLog = true;
                        break;
                    }
                }
            }
            
            // If in water and not on log, game over
            if (!onLog) {
                this.gameOver('water');
                return;
            }
        }
        
        // Increase difficulty as player progresses
        if (this.player.worldY < -10 && (Math.abs(this.player.worldY) % 20) === 0) {
            this.gameSpeed = Math.min(this.gameSpeed + 0.1, 8);
        }
    }
    
    gameOver(deathCause = 'generic') {
        this.player.alive = false;
        this.gameRunning = false;
        this.stopCarSounds();
        
        // Play splash sound for water deaths
        if (deathCause === 'water') {
            this.playSplashSound();
        }
        // Play car honk sound for car deaths
        else if (deathCause === 'car') {
            this.playCarHonkSound();
        }
        
        document.getElementById('gameOver').classList.remove('hidden');
        
        // Add shake effect
        this.canvas.classList.add('shake');
        setTimeout(() => {
            this.canvas.classList.remove('shake');
        }, 500);
    }
    
    updateHomeInterior(dt) {
        this.homeInterior.animationTimer += dt;
        
        // Debug current phase every 2 seconds
        if (Math.floor(this.homeInterior.animationTimer / 2000) > this.lastPhaseLog) {
            this.lastPhaseLog = Math.floor(this.homeInterior.animationTimer / 2000);
            console.log('Current phase:', this.homeInterior.animationPhase, 'Timer:', Math.floor(this.homeInterior.animationTimer));
        }
        
        switch(this.homeInterior.animationPhase) {
            case 'fadeIn':
                // Fade in the home interior scene
                this.homeInterior.fadeOpacity = Math.min(1, this.homeInterior.fadeOpacity + dt / 1000);
                if (this.homeInterior.fadeOpacity >= 1 && this.homeInterior.animationTimer > 500) {
                    console.log('Phase: fadeIn → playerWalk');
                    this.homeInterior.animationPhase = 'playerWalk';
                    this.homeInterior.animationTimer = 0;
                }
                break;
                
            case 'playerWalk':
                // Player walks in from left side
                this.homeInterior.playerPosX += dt * 0.1; // Walk speed
                if (this.homeInterior.playerPosX >= this.W / 3) {
                    console.log('Phase: playerWalk → approach');
                    this.homeInterior.animationPhase = 'approach';
                    this.homeInterior.animationTimer = 0;
                }
                break;
                
            case 'approach':
                // Both characters move toward each other
                const approachSpeed = dt * 0.05;
                this.homeInterior.playerPosX += approachSpeed;
                this.homeInterior.partnerPosX -= approachSpeed;
                
                // When they're much closer, start hearts
                if (Math.abs(this.homeInterior.playerPosX - this.homeInterior.partnerPosX) < 30) {
                    console.log('Phase: approach → hearts');
                    this.homeInterior.animationPhase = 'hearts';
                    this.homeInterior.animationTimer = 0;
                    this.homeInterior.heartsPhaseTimer = 0; // Reset hearts phase timer
                }
                break;
                
            case 'hearts':
                // Update hearts phase timer separately
                this.homeInterior.heartsPhaseTimer += dt;
                
                // Spawn heart animations
                if (this.homeInterior.animationTimer > 500) { // Spawn heart every 500ms
                    this.spawnHeart();
                    this.homeInterior.animationTimer = 0;
                }
                
                // Update existing hearts
                for (let i = this.homeInterior.hearts.length - 1; i >= 0; i--) {
                    const heart = this.homeInterior.hearts[i];
                    heart.y -= dt * 0.05; // Float upward
                    heart.scale += dt * 0.0005; // Grow slightly
                    heart.opacity -= dt * 0.001; // Fade out
                    
                    // Remove hearts that have faded out
                    if (heart.opacity <= 0) {
                        this.homeInterior.hearts.splice(i, 1);
                    }
                }
                
                // After 1 second of hearts, show tofu soup button
                if (this.homeInterior.heartsPhaseTimer > 1000) {
                    console.log('Phase: hearts → showButton');
                    this.homeInterior.animationPhase = 'showButton';
                    this.homeInterior.animationTimer = 0;
                }
                break;
                
            case 'showButton':
                // Continue spawning hearts
                if (this.homeInterior.animationTimer > 500) { // Spawn heart every 500ms
                    this.spawnHeart();
                    this.homeInterior.animationTimer = 0;
                }
                
                // Keep hearts floating while showing button
                for (let i = this.homeInterior.hearts.length - 1; i >= 0; i--) {
                    const heart = this.homeInterior.hearts[i];
                    heart.y -= dt * 0.02; // Slower floating
                    heart.opacity -= dt * 0.0005; // Slower fade
                    
                    if (heart.opacity <= 0) {
                        this.homeInterior.hearts.splice(i, 1);
                    }
                }
                // Button stays visible until clicked
                break;
        }
    }
    
    spawnHeart() {
        // Create a heart at a random position between the characters
        const centerX = (this.homeInterior.playerPosX + this.homeInterior.partnerPosX) / 2;
        const heart = {
            x: centerX + (Math.random() - 0.5) * 60,
            y: this.H / 2 + (Math.random() - 0.5) * 40,
            scale: 0.5 + Math.random() * 0.5,
            opacity: 1.0
        };
        this.homeInterior.hearts.push(heart);
    }
    
    updateTofuSoup(dt) {
        this.tofuSoup.animationTimer += dt;
        
        switch(this.tofuSoup.animationPhase) {
            case 'fadeIn':
                // Fade in the soup scene
                this.tofuSoup.fadeOpacity = Math.min(1, this.tofuSoup.fadeOpacity + dt / 1000);
                if (this.tofuSoup.fadeOpacity >= 1 && this.tofuSoup.animationTimer > 500) {
                    this.tofuSoup.animationPhase = 'showSoup';
                    this.tofuSoup.animationTimer = 0;
                }
                break;
                
            case 'showSoup':
                // Spawn steam particles
                if (this.tofuSoup.animationTimer > 200) { // Every 200ms
                    this.spawnSteam();
                    this.tofuSoup.animationTimer = 0;
                }
                
                // Update steam particles
                for (let i = this.tofuSoup.steamParticles.length - 1; i >= 0; i--) {
                    const steam = this.tofuSoup.steamParticles[i];
                    steam.y -= dt * 0.06;
                    steam.x += (Math.random() - 0.5) * dt * 0.01;
                    steam.opacity -= dt * 0.0008;
                    steam.scale += dt * 0.001;
                    
                    if (steam.opacity <= 0) {
                        this.tofuSoup.steamParticles.splice(i, 1);
                    }
                }
                
                // After 10 seconds, go to ending
                if (this.tofuSoup.animationTimer > 10000) {
                    this.winGame();
                }
                break;
        }
    }
    
    spawnSteam() {
        // Create steam particles above the bowl
        for (let i = 0; i < 3; i++) {
            const steam = {
                x: this.W/2 + (Math.random() - 0.5) * 80,
                y: this.H/2 + 100,
                opacity: 0.8,
                scale: 0.5 + Math.random() * 0.3
            };
            this.tofuSoup.steamParticles.push(steam);
        }
    }
    
    updateBonus(dt) {
        this.bonusTimer -= dt / 1000;
        
        // Spawn rings from cat
        this.ringSpawnTimer += dt;
        if (this.ringSpawnTimer > 2000) { // Every 2 seconds
            this.bonusRings.push({
                x: this.bonusCat.x,
                y: this.bonusCat.y,
                r: 0,
                w: 15 // Ring thickness
            });
            this.ringSpawnTimer = 0;
        }
        
        // Update rings
        for (let i = this.bonusRings.length - 1; i >= 0; i--) {
            const ring = this.bonusRings[i];
            ring.r += dt * 0.2; // Expand ring
            
            // Check collision with player
            const dist = Math.sqrt(
                Math.pow(this.bonusPlayer.x - ring.x, 2) + 
                Math.pow(this.bonusPlayer.y - ring.y, 2)
            );
            
            if (Math.abs(dist - ring.r) < ring.w) {
                // Hit! Snap player back to center
                this.bonusPlayer.x = this.W / 2;
                this.bonusPlayer.y = this.H / 2;
                this.showToast('MEOW!');
            }
            
            // Remove rings that are too big
            if (ring.r > Math.max(this.W, this.H)) {
                this.bonusRings.splice(i, 1);
            }
        }
        
        // Check win condition
        if (this.bonusTimer <= 0) {
            this.gameState = 'bonusOver';
            this.gameRunning = false;
            document.getElementById('bonusModal').classList.remove('hidden');
        }
    }
    
    gameLoop(currentTime) {
        if (!this.gameRunning) return;
        
        const dt = Math.min(currentTime - this.lastTime, 40); // Cap at 40ms
        this.lastTime = currentTime;
        
        // Update hop cooldown
        if (this.hopCooldown > 0) {
            this.hopCooldown = Math.max(0, this.hopCooldown - dt);
        }
        
        if (this.gameState === 'play') {
            // Update game objects
            this.spawnVehiclesAndLogs();
            this.updateVehiclesAndLogs();
            this.updateCamera();
            this.continuouslySpawnIngredients();
            this.checkCollisions();
        } else if (this.gameState === 'bonus') {
            this.updateBonus(dt);
        } else if (this.gameState === 'homeInterior') {
            this.updateHomeInterior(dt);
        } else if (this.gameState === 'tofuSoup') {
            this.updateTofuSoup(dt);
        }
        
        // Draw everything
        this.draw();
        
        // Continue game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#90EE90';
        this.ctx.fillRect(0, 0, this.W, this.H);
        
        if (this.gameState === 'play') {
            this.drawGame();
        } else if (this.gameState === 'bonus') {
            this.drawBonus();
        } else if (this.gameState === 'homeInterior') {
            this.drawHomeInterior();
        } else if (this.gameState === 'tofuSoup') {
            this.drawTofuSoup();
        }
    }
    
    drawGame() {
        this.drawBackground();
        this.drawHouse();
        this.drawVehiclesAndLogs();
        this.drawIngredients();
        this.drawPlayer();
    }
    
    drawBackground() {
        // Draw lanes based on camera position
        const startRow = Math.floor(this.cameraY / this.TILE);
        const endRow = startRow + Math.ceil(this.H / this.TILE) + 1;
        
        for (let worldRow = startRow; worldRow <= endRow; worldRow++) {
            const screenY = (worldRow * this.TILE) - this.cameraY;
            const laneType = this.getLaneType(worldRow);
            
            switch (laneType) {
                case 'grass':
                    this.ctx.fillStyle = '#90EE90';
                    break;
                case 'road':
                    this.ctx.fillStyle = '#696969';
                    break;
                case 'water':
                    this.ctx.fillStyle = '#87CEEB';
                    break;
            }
            
            this.ctx.fillRect(0, screenY, this.W, this.TILE);
            
            // Draw road lines for roads
            if (laneType === 'road') {
                this.ctx.fillStyle = '#FFFFE0';
                const lineY = screenY + this.TILE / 2;
                for (let x = 0; x < this.W; x += 60) {
                    this.ctx.fillRect(x, lineY - 2, 30, 4);
                }
            }
            
            // Draw water waves
            if (laneType === 'water') {
                this.ctx.fillStyle = '#B0E0E6';
                for (let x = 0; x < this.W; x += 20) {
                    const waveOffset = Math.sin((x + Date.now() * 0.01) * 0.1) * 3;
                    this.ctx.fillRect(x, screenY + 10 + waveOffset, 10, 3);
                }
            }
        }
    }
    
    drawHouse() {
        // Always draw house if entrance has been spawned (house coordinates are set)
        if (!this.house.entranceSpawned || this.house.worldY === null) return;
        
        const screenX = this.house.gridX * this.TILE;
        const screenY = (this.house.worldY * this.TILE) - this.cameraY;
        
        // Only draw if on screen
        if (screenY > -this.TILE * 3 && screenY < this.H + this.TILE) {
            this.drawHouseEntrance(screenY);
            this.drawHouseStructure(screenX, screenY);
        }
    }
    
    drawHouseEntrance(houseScreenY) {
        if (!this.houseEntrance) return;
        
        // Draw beautiful grass field (no obstacles)
        this.ctx.fillStyle = '#7CB342'; // Rich grass green
        for (let y = this.houseEntrance.grassFieldStart; y >= this.houseEntrance.grassFieldEnd; y--) {
            const screenY = (y * this.TILE) - this.cameraY;
            if (screenY > -this.TILE && screenY < this.H + this.TILE) {
                this.ctx.fillRect(0, screenY, this.W, this.TILE);
            }
        }
        
        // Draw stone path leading to house (wider for bigger house)
        this.ctx.fillStyle = '#A9A9A9';
        const pathWidth = this.TILE * 2; // Wider path for bigger house
        const pathStartX = (this.house.gridX + 2) * this.TILE - this.TILE/2;
        
        for (let y = this.houseEntrance.pathStart; y >= this.house.worldY; y--) {
            const screenY = (y * this.TILE) - this.cameraY;
            if (screenY > -this.TILE && screenY < this.H + this.TILE) {
                this.ctx.fillRect(pathStartX, screenY, pathWidth, this.TILE);
                
                // Add stone texture (static, not animated)
                this.ctx.fillStyle = '#808080';
                // Use deterministic positioning based on y coordinate
                const stoneOffset = (y * 7) % 16;
                this.ctx.fillRect(pathStartX + stoneOffset, screenY + 8, 4, 4);
                this.ctx.fillRect(pathStartX + stoneOffset + 20, screenY + 16, 4, 4);
                this.ctx.fillRect(pathStartX + stoneOffset + 10, screenY + 24, 4, 4);
                this.ctx.fillStyle = '#A9A9A9';
            }
        }
        
        // Draw decorative flower patches
        this.drawFlowerPatches();
        
        // Draw elegant fence
        this.drawElegantFence();
    }
    
    drawFlowerPatches() {
        // Add some flower patches in the grass field (static positions)
        const flowerColors = ['#FF69B4', '#FFB6C1', '#DDA0DD', '#F0E68C'];
        const flowerPositions = [
            {x: 60, y: 2}, {x: 180, y: 1}, {x: 320, y: 2.5}, {x: 420, y: 1.5},
            {x: 120, y: 3}, {x: 280, y: 0.5}, {x: 380, y: 2}, {x: 240, y: 1.2}
        ];
        
        for (let i = 0; i < flowerPositions.length; i++) {
            const flower = flowerPositions[i];
            const flowerY = this.houseEntrance.grassFieldStart - flower.y;
            const screenY = (flowerY * this.TILE) - this.cameraY;
            
            if (screenY > 0 && screenY < this.H && flower.x < this.W) {
                this.ctx.fillStyle = flowerColors[i % flowerColors.length];
                this.ctx.fillRect(flower.x, screenY, 6, 6);
                this.ctx.fillRect(flower.x + 2, screenY + 2, 2, 2);
            }
        }
    }
    
    drawElegantFence() {
        // Draw white picket fence around the property
        this.ctx.fillStyle = '#F5F5F5';
        
        for (let y = this.houseEntrance.grassFieldStart; y >= this.houseEntrance.grassFieldEnd; y--) {
            const screenY = (y * this.TILE) - this.cameraY;
            
            if (screenY > -this.TILE && screenY < this.H + this.TILE) {
                // Left fence
                this.ctx.fillRect(this.houseEntrance.fenceLeft * this.TILE, screenY + 8, 8, 20);
                // Picket details
                this.ctx.fillRect(this.houseEntrance.fenceLeft * this.TILE + 2, screenY + 8, 4, 16);
                
                // Right fence  
                this.ctx.fillRect(this.houseEntrance.fenceRight * this.TILE, screenY + 8, 8, 20);
                // Picket details
                this.ctx.fillRect(this.houseEntrance.fenceRight * this.TILE + 2, screenY + 8, 4, 16);
            }
        }
        
        // Draw welcome gate with heart
        const gateScreenY = (this.houseEntrance.gateY * this.TILE) - this.cameraY;
        if (gateScreenY > -this.TILE && gateScreenY < this.H + this.TILE) {
            this.ctx.fillStyle = '#F5F5F5';
            const gateX = (this.house.gridX + 2) * this.TILE - 16;
            this.ctx.fillRect(gateX, gateScreenY - 5, 12, 25);
            this.ctx.fillRect(gateX + 20, gateScreenY - 5, 12, 25);
            
            // Heart on gate
            this.ctx.fillStyle = '#FF69B4';
            this.ctx.fillRect(gateX + 8, gateScreenY + 5, 8, 6);
            this.ctx.fillRect(gateX + 6, gateScreenY + 3, 4, 4);
            this.ctx.fillRect(gateX + 14, gateScreenY + 3, 4, 4);
        }
    }
    
    drawHouseStructure(screenX, screenY) {
        // Bigger, cooler house (5 tiles wide, 2 tiles tall)
        const houseWidth = this.TILE * 5;
        const houseHeight = this.TILE * 2;
        
        // House foundation
        this.ctx.fillStyle = '#8D6E63';
        this.ctx.fillRect(screenX, screenY + houseHeight - 8, houseWidth, 8);
        
        // House base (warm beige)
        this.ctx.fillStyle = '#D7CCC8';
        this.ctx.fillRect(screenX, screenY, houseWidth, houseHeight);
        
        // Large sloped roof
        this.ctx.fillStyle = '#8D4E85';
        this.ctx.fillRect(screenX - 10, screenY - 25, houseWidth + 20, 30);
        
        // Roof ridge
        this.ctx.fillStyle = '#7B1FA2';
        this.ctx.fillRect(screenX - 12, screenY - 28, houseWidth + 24, 8);
        
        // Chimney
        this.ctx.fillStyle = '#D32F2F';
        this.ctx.fillRect(screenX + houseWidth - 25, screenY - 40, 15, 20);
        this.ctx.fillStyle = '#B71C1C';
        this.ctx.fillRect(screenX + houseWidth - 25, screenY - 42, 15, 4);
        
        // Large front door (centered)
        const doorWidth = this.TILE + 8;
        const doorX = screenX + (houseWidth - doorWidth) / 2;
        this.ctx.fillStyle = '#6D4C41';
        this.ctx.fillRect(doorX, screenY + 12, doorWidth, houseHeight - 12);
        
        // Door frame
        this.ctx.fillStyle = '#5D4037';
        this.ctx.fillRect(doorX - 3, screenY + 12, 3, houseHeight - 12);
        this.ctx.fillRect(doorX + doorWidth, screenY + 12, 3, houseHeight - 12);
        this.ctx.fillRect(doorX - 3, screenY + 9, doorWidth + 6, 3);
        
        // Door handle
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(doorX + doorWidth - 8, screenY + 28, 4, 4);
        
        // Windows (2 on each side of door)
        this.ctx.fillStyle = '#E3F2FD';
        // Left window
        this.ctx.fillRect(screenX + 8, screenY + 16, 20, 16);
        // Right window  
        this.ctx.fillRect(screenX + houseWidth - 28, screenY + 16, 20, 16);
        
        // Window frames
        this.ctx.fillStyle = '#5D4037';
        // Left window frame
        this.ctx.fillRect(screenX + 6, screenY + 14, 24, 2);
        this.ctx.fillRect(screenX + 6, screenY + 32, 24, 2);
        this.ctx.fillRect(screenX + 6, screenY + 14, 2, 20);
        this.ctx.fillRect(screenX + 28, screenY + 14, 2, 20);
        // Right window frame
        this.ctx.fillRect(screenX + houseWidth - 30, screenY + 14, 24, 2);
        this.ctx.fillRect(screenX + houseWidth - 30, screenY + 32, 24, 2);
        this.ctx.fillRect(screenX + houseWidth - 30, screenY + 14, 2, 20);
        this.ctx.fillRect(screenX + houseWidth - 6, screenY + 14, 2, 20);
        
        // Window cross dividers
        this.ctx.fillRect(screenX + 17, screenY + 16, 2, 16);
        this.ctx.fillRect(screenX + 8, screenY + 23, 20, 2);
        this.ctx.fillRect(screenX + houseWidth - 19, screenY + 16, 2, 16);
        this.ctx.fillRect(screenX + houseWidth - 28, screenY + 23, 20, 2);
        
        // Large heart on door
        this.ctx.fillStyle = '#E91E63';
        this.ctx.fillRect(doorX + doorWidth/2 - 6, screenY + 35, 12, 8);
        this.ctx.fillRect(doorX + doorWidth/2 - 8, screenY + 33, 6, 6);
        this.ctx.fillRect(doorX + doorWidth/2 + 2, screenY + 33, 6, 6);
        
        // House number and welcome sign
        this.ctx.fillStyle = '#F5DEB3';
        this.ctx.fillRect(screenX - 15, screenY + 20, 12, 16);
        this.ctx.fillStyle = '#8D6E63';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('♥', screenX - 12, screenY + 30);
        this.ctx.font = '8px Arial';
        this.ctx.fillText('Home', screenX - 13, screenY + 40);
    }
    
    drawIngredients() {
        this.ingredientPositions.forEach((ingredient, index) => {
            if (!ingredient.taken) {
                const screenX = ingredient.gx * this.TILE;
                const screenY = (ingredient.gy * this.TILE) - this.cameraY;
                
                // Only draw if on screen
                if (screenY > -this.TILE && screenY < this.H + this.TILE) {
                    this.drawIngredient(ingredient.key, screenX + this.TILE/2, screenY + this.TILE/2, index);
                }
            }
        });
    }
    
    drawIngredient(type, centerX, centerY, index = 0) {
        const size = 16;
        
        // Add subtle animation based on time and ingredient index for variation
        const time = Date.now() * 0.001; // Slow animation
        const offset = index * 1.5; // Different phase for each ingredient
        
        // Small bounce effect (2-3 pixels max to stay within tile)
        const bounceY = Math.sin(time * 2 + offset) * 2;
        
        // Subtle rotation
        const rotation = Math.sin(time * 1.5 + offset) * 0.15; // Small rotation in radians
        
        // Apply transformations
        this.ctx.save();
        this.ctx.translate(centerX, centerY + bounceY);
        this.ctx.rotate(rotation);
        
        // Draw from center after transformation
        const x = -size/2;
        const y = -size/2;
        
        switch(type) {
            case 'tofu':
                // Off-white cube with shadow and highlight
                this.ctx.fillStyle = '#F5F5DC';
                this.ctx.fillRect(x, y, size, size);
                this.ctx.fillStyle = '#E6E6CD';
                this.ctx.fillRect(x + size - 2, y, 2, size);
                this.ctx.fillRect(x, y + size - 2, size, 2);
                this.ctx.fillStyle = '#FFFFF0';
                this.ctx.fillRect(x, y, 2, size);
                this.ctx.fillRect(x, y, size, 2);
                break;
                
            case 'onion':
                // Pink-violet orb with vertical bands and green sprout
                this.ctx.fillStyle = '#DDA0DD';
                this.ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
                this.ctx.fillStyle = '#BA55D3';
                this.ctx.fillRect(x + 6, y + 2, 2, size - 4);
                this.ctx.fillRect(x + 10, y + 2, 2, size - 4);
                this.ctx.fillStyle = '#32CD32';
                this.ctx.fillRect(x + size/2 - 1, y, 2, 4);
                break;
                
            case 'broth':
                // Amber bottle with reflection
                this.ctx.fillStyle = '#DAA520';
                this.ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
                this.ctx.fillStyle = '#B8860B';
                this.ctx.fillRect(x + 2, y + 8, size - 4, 2);
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillRect(x + 4, y + 4, 2, 8);
                this.ctx.fillStyle = '#8B7355';
                this.ctx.fillRect(x + size/2 - 2, y, 4, 4);
                break;
                
            case 'mushroom':
                // Gray-tan cap with stem
                this.ctx.fillStyle = '#D2B48C';
                this.ctx.fillRect(x + 2, y + 2, size - 4, 8);
                this.ctx.fillStyle = '#A0522D';
                this.ctx.fillRect(x + 2, y + 8, size - 4, 2);
                this.ctx.fillStyle = '#F5DEB3';
                this.ctx.fillRect(x + size/2 - 2, y + 8, 4, size - 10);
                break;
                
            case 'scallion':
                // Green stalk diagonal with lighter tip
                this.ctx.fillStyle = '#228B22';
                this.ctx.fillRect(x + 2, y + 4, size - 4, 8);
                this.ctx.fillStyle = '#32CD32';
                this.ctx.fillRect(x + 2, y + 4, size - 4, 2);
                this.ctx.fillStyle = '#90EE90';
                this.ctx.fillRect(x + 2, y + 4, 4, 8);
                break;
                
            case 'chili':
                // Red curved pepper with green stem
                this.ctx.fillStyle = '#DC143C';
                this.ctx.fillRect(x + 4, y + 2, 8, size - 4);
                this.ctx.fillRect(x + 2, y + 6, 4, 6);
                this.ctx.fillStyle = '#32CD32';
                this.ctx.fillRect(x + 6, y, 4, 4);
                break;
        }
        
        // Restore canvas transformation
        this.ctx.restore();
    }
    
    drawPlayer() {
        const screenX = this.player.gridX * this.TILE + (this.TILE - this.player.width) / 2;
        const screenY = (this.player.worldY * this.TILE) - this.cameraY + (this.TILE - this.player.height) / 2;
        
        if (this.player.customSprite) {
            this.ctx.drawImage(this.player.customSprite, screenX, screenY, this.player.width, this.player.height);
        } else {
            // Draw default player with soup bowl
            this.ctx.fillStyle = '#FDBCB4';
            this.ctx.fillRect(screenX, screenY, this.player.width, this.player.height);
            
            // Bowl at belly
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(screenX + this.player.width/2 - 8, screenY + this.player.height/2, 16, 8);
            this.ctx.fillStyle = '#DDA0DD';
            this.ctx.fillRect(screenX + this.player.width/2 - 6, screenY + this.player.height/2 + 2, 12, 4);
            
            // Simple face
            this.ctx.fillStyle = '#000';
            const faceSize = 4;
            this.ctx.fillRect(screenX + 8, screenY + 8, faceSize, faceSize);
            this.ctx.fillRect(screenX + this.player.width - 12, screenY + 8, faceSize, faceSize);
            this.ctx.fillRect(screenX + this.player.width/2 - 5, screenY + this.player.height - 12, 10, 3);
            
            // Add cute blush
            this.ctx.fillStyle = '#FFB6C1';
            this.ctx.fillRect(screenX + 4, screenY + 12, 6, 3);
            this.ctx.fillRect(screenX + this.player.width - 10, screenY + 12, 6, 3);
        }
    }
    
    drawVehiclesAndLogs() {
        // Draw vehicles
        for (const vehicle of this.vehicles) {
            const screenX = vehicle.gridX * this.TILE + (this.TILE - vehicle.width) / 2;
            const screenY = (vehicle.worldY * this.TILE) - this.cameraY + (this.TILE - vehicle.height) / 2;
            
            // Only draw if on screen
            if (screenY > -this.TILE && screenY < this.H + this.TILE) {
                // Car body
                this.ctx.fillStyle = vehicle.color;
                this.ctx.fillRect(screenX, screenY, vehicle.width, vehicle.height);
                
                // Car windows
                this.ctx.fillStyle = '#E6F3FF';
                this.ctx.fillRect(screenX + 5, screenY + 5, vehicle.width - 10, vehicle.height - 10);
                
                // Car lights
                this.ctx.fillStyle = '#FFFF99';
                if (vehicle.speed > 0) { // Going right
                    this.ctx.fillRect(screenX + vehicle.width - 8, screenY + 5, 6, 6);
                    this.ctx.fillRect(screenX + vehicle.width - 8, screenY + vehicle.height - 11, 6, 6);
                } else { // Going left
                    this.ctx.fillRect(screenX + 2, screenY + 5, 6, 6);
                    this.ctx.fillRect(screenX + 2, screenY + vehicle.height - 11, 6, 6);
                }
            }
        }
        
        // Draw logs
        for (const log of this.logs) {
            const screenX = log.gridX * this.TILE;
            const screenY = (log.worldY * this.TILE) - this.cameraY + (this.TILE - log.height) / 2;
            
            // Only draw if on screen
            if (screenY > -this.TILE && screenY < this.H + this.TILE) {
                // Log body
                this.ctx.fillStyle = this.logColor;
                this.ctx.fillRect(screenX, screenY, log.width, log.height);
                
                // Log rings
                this.ctx.fillStyle = '#654321';
                for (let i = 1; i < log.length; i++) {
                    const ringX = screenX + (i * this.TILE) - 2;
                    this.ctx.fillRect(ringX, screenY, 4, log.height);
                }
            }
        }
    }
    
    drawHomeInterior() {
        // Draw cozy home interior background
        this.drawHomeInteriorBackground();
        
        // Draw characters
        this.drawHomeInteriorCharacters();
        
        // Draw hearts
        this.drawHearts();
        
        // Draw tofu soup button if in showButton phase
        if (this.homeInterior.animationPhase === 'showButton') {
            console.log('Drawing tofu soup button');
            this.drawTofuSoupButton();
        }
        
        // Apply fade effect if needed
        if (this.homeInterior.fadeOpacity < 1) {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - this.homeInterior.fadeOpacity})`;
            this.ctx.fillRect(0, 0, this.W, this.H);
        }
    }
    
    drawHomeInteriorBackground() {
        // Simple wooden floor
        this.ctx.fillStyle = '#D2691E';
        this.ctx.fillRect(0, 0, this.W, this.H);
        
        // Add simple wood grain pattern
        this.ctx.fillStyle = '#CD853F';
        for (let y = 0; y < this.H; y += 8) {
            this.ctx.fillRect(0, y, this.W, 2);
        }
        for (let x = 0; x < this.W; x += 50) {
            this.ctx.fillRect(x, 0, 2, this.H);
        }
        
        // Simple walls - no decorations
        this.ctx.fillStyle = '#F4A460';
        this.ctx.fillRect(0, 0, this.W, this.H * 0.3);
        
        // Wooden plaque with "Happy Three Months"
        this.drawWoodenPlaque();
        
        // Subtle warm lighting effect
        const gradient = this.ctx.createRadialGradient(this.W/2, this.H/3, 0, this.W/2, this.H/3, this.W);
        gradient.addColorStop(0, 'rgba(255, 220, 177, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 220, 177, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.W, this.H);
    }
    
    drawWoodenPlaque() {
        // Position the plaque on the back wall
        const plaqueW = 280;
        const plaqueH = 80;
        const plaqueX = (this.W - plaqueW) / 2;
        const plaqueY = 40; // High on the wall
        
        // Wooden plaque background
        this.ctx.fillStyle = '#8B4513'; // Dark wood
        this.ctx.fillRect(plaqueX, plaqueY, plaqueW, plaqueH);
        
        // Wood grain on plaque
        this.ctx.fillStyle = '#A0522D';
        for (let y = plaqueY; y < plaqueY + plaqueH; y += 8) {
            this.ctx.fillRect(plaqueX + 5, y, plaqueW - 10, 2);
        }
        
        // Plaque border/frame
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(plaqueX, plaqueY, plaqueW, plaqueH);
        
        // Inner border
        this.ctx.strokeStyle = '#DEB887';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(plaqueX + 8, plaqueY + 8, plaqueW - 16, plaqueH - 16);
        
        // Text on the plaque
        this.ctx.fillStyle = '#FFD700'; // Gold text
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Happy Three Months', plaqueX + plaqueW/2, plaqueY + plaqueH/2);
        
        // Text shadow for depth
        this.ctx.fillStyle = '#B8860B'; // Darker gold for shadow
        this.ctx.fillText('Happy Three Months', plaqueX + plaqueW/2 + 2, plaqueY + plaqueH/2 + 2);
        
        // Bring main text back on top
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillText('Happy Three Months', plaqueX + plaqueW/2, plaqueY + plaqueH/2);
        
        // Small decorative hearts on the plaque
        this.ctx.fillStyle = '#FF69B4';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('', plaqueX + 30, plaqueY + plaqueH/2);
        this.ctx.fillText('', plaqueX + plaqueW - 30, plaqueY + plaqueH/2);
    }
    
    drawHomeInteriorCharacters() {
        const characterY = this.H * 0.75; // Lower on screen, less floor space
        const characterSize = this.TILE * 6; // 5x bigger (was 1.2, now 6)
        
        // Draw player character
        if (this.player.customSprite) {
            this.ctx.drawImage(
                this.player.customSprite,
                this.homeInterior.playerPosX - characterSize/2,
                characterY - characterSize,
                characterSize,
                characterSize
            );
        } else {
            // Fallback if sprite not loaded
            this.ctx.fillStyle = '#FDBCB4';
            this.ctx.fillRect(
                this.homeInterior.playerPosX - characterSize/2,
                characterY - characterSize,
                characterSize,
                characterSize
            );
        }
        
        // Draw partner character
        if (this.partnerSprite) {
            this.ctx.drawImage(
                this.partnerSprite,
                this.homeInterior.partnerPosX - characterSize/2,
                characterY - characterSize,
                characterSize,
                characterSize
            );
        } else {
            // Fallback if sprite not loaded
            this.ctx.fillStyle = '#F4C2A1';
            this.ctx.fillRect(
                this.homeInterior.partnerPosX - characterSize/2,
                characterY - characterSize,
                characterSize,
                characterSize
            );
        }
    }
    
    drawHearts() {
        // Draw floating heart animations
        this.homeInterior.hearts.forEach(heart => {
            this.ctx.save();
            this.ctx.globalAlpha = heart.opacity;
            
            const size = 24 * heart.scale; // Bigger hearts
            this.ctx.fillStyle = '#FF1493'; // Brighter pink
            
            // Draw complete pixel heart shape
            const x = heart.x - size/2;
            const y = heart.y - size/2;
            const unit = size/8; // Heart is 8x8 units
            
            // Top left bump
            this.ctx.fillRect(x + unit, y, unit*2, unit);
            this.ctx.fillRect(x, y + unit, unit, unit*2);
            this.ctx.fillRect(x + unit, y + unit, unit*2, unit*2);
            
            // Top right bump  
            this.ctx.fillRect(x + unit*5, y, unit*2, unit);
            this.ctx.fillRect(x + unit*7, y + unit, unit, unit*2);
            this.ctx.fillRect(x + unit*5, y + unit, unit*2, unit*2);
            
            // Middle section
            this.ctx.fillRect(x + unit, y + unit*3, unit*6, unit);
            this.ctx.fillRect(x + unit*2, y + unit*4, unit*4, unit);
            this.ctx.fillRect(x + unit*3, y + unit*5, unit*2, unit);
            
            // Bottom point
            this.ctx.fillRect(x + unit*3.5, y + unit*6, unit, unit);
            
            this.ctx.restore();
        });
    }
    
    drawTofuSoupButton() {
        // Add animation using time-based oscillation
        const time = Date.now() * 0.002; // Slow animation speed
        const bounceOffset = Math.sin(time) * 4; // Gentle bounce of 4 pixels
        const scaleEffect = 1 + Math.sin(time * 0.8) * 0.02; // Subtle scale pulse (2% variation)
        
        // Draw button right below the characters
        const baseButtonW = 250;
        const baseButtonH = 80;
        const buttonW = baseButtonW * scaleEffect;
        const buttonH = baseButtonH * scaleEffect;
        const buttonX = (this.W - buttonW) / 2;
        const characterY = this.H * 0.75; // Same as character position
        const buttonY = characterY + 50 + bounceOffset; // Just below characters with bounce
        
        // Store button bounds for clicking (use base dimensions for consistent hitbox)
        this.tofuSoupButton = { x: (this.W - baseButtonW) / 2, y: characterY + 50, w: baseButtonW, h: baseButtonH };
        
        // Glowing effect around button
        const glowRadius = 15 + Math.sin(time * 1.5) * 5;
        const glowGradient = this.ctx.createRadialGradient(
            buttonX + buttonW/2, buttonY + buttonH/2, buttonW/2,
            buttonX + buttonW/2, buttonY + buttonH/2, buttonW/2 + glowRadius
        );
        glowGradient.addColorStop(0, 'rgba(255, 140, 0, 0)');
        glowGradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.2)');
        glowGradient.addColorStop(1, 'rgba(255, 99, 71, 0.4)');
        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(buttonX - glowRadius, buttonY - glowRadius, 
                         buttonW + glowRadius * 2, buttonH + glowRadius * 2);
        
        // Semi-transparent background behind button for visibility
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(buttonX - 10, buttonY - 10, buttonW + 20, buttonH + 20);
        
        // Button background with gradient
        const gradient = this.ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonH);
        gradient.addColorStop(0, '#FF8C00'); // Orange top
        gradient.addColorStop(1, '#FF6347'); // Red bottom
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(buttonX, buttonY, buttonW, buttonH);
        
        // Add shimmer effect on top
        const shimmerGradient = this.ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonH/3);
        shimmerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        shimmerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = shimmerGradient;
        this.ctx.fillRect(buttonX, buttonY, buttonW, buttonH/3);
        
        // Button border with animated thickness
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 3 + Math.sin(time * 2) * 0.5;
        this.ctx.strokeRect(buttonX, buttonY, buttonW, buttonH);
        
        // Button text - BIGGER
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 22px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Enjoy Tofu Soup', buttonX + buttonW/2, buttonY + buttonH/2 + 8);
        
        // Add bowl emoji - BIGGER with rotation animation
        this.ctx.save();
        this.ctx.translate(buttonX + buttonW/2, buttonY + buttonH/2 - 18);
        this.ctx.rotate(Math.sin(time * 2) * 0.08); // Gentle wobble
        this.ctx.font = '32px Arial';
        this.ctx.fillText('', 0, 0);
        this.ctx.restore();
    }
    
    drawTofuSoup() {
        // Orange background to match image
        this.ctx.fillStyle = '#f5803d';
        this.ctx.fillRect(0, 0, this.W, this.H);
        
        // Love messages array
        const loveMessages = [
            "everything in the world is perfect when you hug me tight",
            "you make sure I eat very well",
            "you make me feel so safe and protected",
            "you are so curious and love learning",
            "you go out of your way to help me",
            "you have the dorkiest fascination with hexagons and materials",
            "anything I do with you is 100x more fun",
            "youre so handsome it makes me blush sometimes",
            "you are always down for an adventure",
            "your decision making and principles constantly inspire me",
            "you have the kindest heart",
            "you give the warmest hugs",
            "you listen to me patiently",
            "you support my dreams",
            "you are such a dependable and loyal friend"
        ];
        
        // Title - moved up with margin
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Reasons why I love you', this.W / 2, 40);
        
        // Draw love messages as plain text - moved up
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        
        const startY = 70; // Moved up from 100 to 70
        const lineHeight = 18; // Slightly tighter spacing
        
        // Draw tofu soup image if loaded - moved down
        if (this.tofuSoupImage && this.tofuSoupImage.complete) {
            const imageWidth = 250; // Slightly smaller
            const imageHeight = 250;
            const imageX = (this.W - imageWidth) / 2;
            const imageY = this.H - imageHeight - 20; // Bottom with margin
            this.ctx.drawImage(this.tofuSoupImage, imageX, imageY, imageWidth, imageHeight);
        }
        loveMessages.forEach((message, index) => {
            const y = startY + index * lineHeight;
            this.ctx.fillText(`${index + 1}. ${message}`, 50, y);
        });
        
        // Draw steam particles
        this.drawSteam();
        
        // Apply fade effect if needed
        if (this.tofuSoup.fadeOpacity < 1) {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - this.tofuSoup.fadeOpacity})`;
            this.ctx.fillRect(0, 0, this.W, this.H);
        }
    }
    
    
    drawSteam() {
        // Draw steam particles
        this.tofuSoup.steamParticles.forEach(steam => {
            this.ctx.save();
            this.ctx.globalAlpha = steam.opacity;
            
            const size = 18 * steam.scale;
            this.ctx.fillStyle = '#E6E6FA';
            
            // Draw simple steam puff
            this.ctx.fillRect(steam.x - size/2, steam.y - size/2, size, size);
            this.ctx.fillRect(steam.x - size/3, steam.y - size/3, size/1.5, size/1.5);
            
            this.ctx.restore();
        });
    }
    
    drawBonus() {
        // Clear with room background
        this.ctx.fillStyle = '#F5DEB3';
        this.ctx.fillRect(0, 0, this.W, this.H);
        
        // Draw cat
        this.ctx.fillStyle = '#FF8C00';
        this.ctx.fillRect(this.bonusCat.x - 16, this.bonusCat.y - 16, 32, 32);
        // Cat face patch
        this.ctx.fillStyle = '#FFF';
        this.ctx.fillRect(this.bonusCat.x - 8, this.bonusCat.y - 12, 16, 16);
        // Angry eyes
        this.ctx.fillStyle = '#DC143C';
        this.ctx.fillRect(this.bonusCat.x - 6, this.bonusCat.y - 8, 4, 4);
        this.ctx.fillRect(this.bonusCat.x + 2, this.bonusCat.y - 8, 4, 4);
        // Ears
        this.ctx.fillStyle = '#FF8C00';
        this.ctx.fillRect(this.bonusCat.x - 12, this.bonusCat.y - 20, 8, 8);
        this.ctx.fillRect(this.bonusCat.x + 4, this.bonusCat.y - 20, 8, 8);
        
        // Draw rings
        this.bonusRings.forEach(ring => {
            this.ctx.strokeStyle = '#F8BBD9';
            this.ctx.lineWidth = ring.w;
            this.ctx.beginPath();
            this.ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        // Draw bonus player
        this.ctx.fillStyle = '#FDBCB4';
        this.ctx.fillRect(this.bonusPlayer.x - 12, this.bonusPlayer.y - 12, 24, 24);
        
        // Timer
        this.ctx.fillStyle = '#8B4B7C';
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`Time: ${Math.ceil(this.bonusTimer)}s`, 20, 40);
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new LoveJourneyGame();
});