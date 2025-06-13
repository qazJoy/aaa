class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false; // 禁用影像平滑處理
        
        this.coordDisplay = document.getElementById('coordDisplay'); // 顯示座標
        this.resizeCanvas(); // 設定畫布大小為視窗大小
        window.addEventListener('resize', () => this.resizeCanvas()); // 監聽視窗大小變化
        
        this.camera = { x: 0, y: 0 }; // 相機位置
        this.keys = {}; // 儲存鍵盤按鍵狀態
        this.gamepad = null; // 遊戲手柄
        this.coinCount = 0; // 硬幣數量
        this.score = 0; // 分數
        
        this.mario = new Mario(100, 200); // 初始化 Mario
        this.mario.game = this; // 傳遞遊戲參考給 Mario
        this.world = new World(); // 初始化世界
        this.world.game = this; // 傳遞遊戲參考給世界
        this.entities = []; // 遊戲中的實體
        
        this.sounds = {}; // 音效
        this.loadSounds(); // 加載音效
        
        this.loadAssets().then(() => {
            this.setupEventListeners(); // 設定事件監聽器
            this.playBackgroundMusic(); // 播放背景音樂
            this.gameLoop(); // 啟動遊戲主迴圈
        });
    }
    
    async loadAssets() {
        this.assets = {};
        
        // 加載 Mario 的圖片資產
        this.assets.marioIdle = await this.loadImage('/smb1 mario idle.webp');
        this.assets.marioWalk3 = await this.loadImage('/Mwalk3.png');
        this.assets.marioJump = await this.loadImage('/Mjump.png');
        this.assets.marioCrouch = await this.loadImage('/mariocrouch.png');
        this.assets.marioDeath = await this.loadImage('/mariodeath.png');
        
        // 加載大 Mario 的圖片資產
        this.assets.bigmarioIdle = await this.loadImage('/big mario idle.gif');
        this.assets.bigmarioJump = await this.loadImage('/bigmariojump.png');
        this.assets.bigmarioCrouch = await this.loadImage('/bigmariocrouch.png');
        
        // 加載世界的圖片資產
        this.assets.ground = await this.loadImage('/floor.png');
        this.assets.brick = await this.loadImage('/IMG_0357.png');
        this.assets.questionBlock = await this.loadImage('/questionmarkblock.bmp');
        this.assets.bush = await this.loadImage('/bush2.png');
        this.assets.pipe = await this.loadImage('/Pipe.webp');
        this.assets.cloud = await this.loadImage('/asset_cloud.png');
        
        // 加載實體的圖片資產
        this.assets.goomba = await this.loadImage('/SMB_Goomba_Sprite.gif');
        this.assets.deadGoomba = await this.loadImage('/SMB_Dead_Goomba.png');
        this.assets.coin = await this.loadImage('/Coin.gif');
        this.assets.piranha = await this.loadImage('/R (48).png');
        this.assets.mushroom = await this.loadImage('/mushroom.png');
        
        // 資產加載完成後生成實體
        this.spawnEntities();
    }
    
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img); // 圖片加載成功
            img.onerror = reject; // 圖片加載失敗
            img.src = src;
        });
    }
    
    loadSounds() {
        // 背景音樂
        this.sounds.bgm = new Audio('/SuperMarioBros.mp3');
        this.sounds.bgm.loop = true; // 循環播放
        
        // 音效
        this.sounds.coin = new Audio('/smb_coin.wav');
        this.sounds.stomp = new Audio('/smb_stomp.wav');
        this.sounds.death = new Audio('/smb_mariodie.wav');
        this.sounds.spinJump = new Audio('/smw_spin_jump.wav');
        this.sounds.powerup = new Audio('/smb_powerup.wav');
        
        // 調整音量
        this.sounds.bgm.volume = 0.5;
        this.sounds.coin.volume = 0.6;
        this.sounds.stomp.volume = 0.6;
        this.sounds.death.volume = 0.6;
        this.sounds.spinJump.volume = 0.6;
        this.sounds.powerup.volume = 0.6;
    }
    
    playBackgroundMusic() {
        // 播放背景音樂
        this.sounds.bgm.play().catch(err => console.log('音樂播放失敗:', err));
    }
    
    setupEventListeners() {
        // 鍵盤按下事件
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.code] = true;
        });
        
        // 鍵盤放開事件
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;
        });
        
        // 遊戲手柄連接事件
        window.addEventListener('gamepadconnected', (e) => {
            console.log('遊戲手柄已連接:', e.gamepad.id);
        });
    }
    
    getInput() {
        // 檢查是否有遊戲手柄
        const gamepads = navigator.getGamepads();
        if (gamepads[0]) {
            this.gamepad = gamepads[0];
        }
        
        // 收集輸入狀態
        const input = {
            left: this.keys['a'] || this.keys['arrowleft'] || (this.gamepad && this.gamepad.axes[0] < -0.3),
            right: this.keys['d'] || this.keys['arrowright'] || (this.gamepad && this.gamepad.axes[0] > 0.3),
            jump: this.keys['w'] || this.keys['arrowup'] || this.keys[' '] || (this.gamepad && this.gamepad.buttons[0].pressed),
            run: this.keys['shift'] || (this.gamepad && this.gamepad.buttons[2].pressed), // B 鍵用於奔跑
            crouch: this.keys['s'] || this.keys['arrowdown'] || (this.gamepad && (this.gamepad.buttons[1].pressed || this.gamepad.axes[1] > 0.7)),
            spinJump: this.keys['r'] || (this.gamepad && this.gamepad.buttons[5].pressed) // 右肩鍵用於旋轉跳躍
        };
        
        return input;
    }
    
    update(input, world, entities) {
        const gravity = 0.25; // Changed from 0.5 (smaller value = more floaty)
        const jumpPower = 8;
        
        // Handle crouching
        if (input.crouch && this.onGround) {
            this.crouching = true;
            this.state = 'crouching';
            this.height = this.big ? this.bigCrouchHeight : this.crouchHeight; // Use appropriate crouch height
            this.vx = 0; // Can't move while crouching
        } else if (!input.crouch && this.crouching) {
            // Check if we can stand up (no ceiling above)
            const standingHeight = this.big ? this.bigHeight : this.normalHeight;
            const ceilingCollisions = world.getCollisions(this.x, this.y - (standingHeight - this.height), 
                                                          this.width, standingHeight);
            if (ceilingCollisions.length === 0) {
                this.crouching = false;
                this.height = standingHeight;
                this.state = 'idle';
            }
        }
        
        // Horizontal movement (only if not crouching)
        if (!this.crouching) {
            const moveSpeed = input.run ? this.runSpeed : this.maxSpeed;
            
            if (input.left) {
                this.vx = -moveSpeed;
                this.facing = -1;
                this.state = this.onGround ? 'walking' : 'jumping';
                this.running = input.run;
            } else if (input.right) {
                this.vx = moveSpeed;
                this.facing = 1;
                this.state = this.onGround ? 'walking' : 'jumping';
                this.running = input.run;
            } else if (this.onGround) {
                // Apply friction when on ground and not pressing movement keys
                this.vx *= this.friction;
                if (Math.abs(this.vx) < 0.1) this.vx = 0;
                this.state = this.vx === 0 ? 'idle' : 'walking';
                this.running = false;
            } else {
                this.vx = 0;
                this.state = 'jumping';
                this.running = false;
            }
        }
        
        // Variable height jumping (modified for crouch jumps)
        if (!this.crouching && input.jump && !this.jumpPressed && this.onGround) {
            this.vy = this.minJumpVelocity;
            this.jumpPressed = true;
            this.jumpHoldTime = 0;
            this.onGround = false;
            this.state = 'jumping';
        } else if (this.crouching && input.jump && !this.jumpPressed && this.onGround) {
            // Crouch jump - lower height, no variable jump height
            this.vy = this.crouchJumpVelocity;
            this.jumpPressed = true;
            this.onGround = false;
            this.state = 'jumping';
            this.crouching = false;
            this.height = this.big ? this.bigHeight : this.normalHeight;
        }
        
        if (input.jump && this.jumpPressed && this.jumpHoldTime < this.maxJumpHoldTime && this.vy < 0) {
            this.jumpHoldTime++;
            // Gradually increase jump velocity based on hold time
            const jumpProgress = this.jumpHoldTime / this.maxJumpHoldTime;
            this.vy = this.minJumpVelocity + (this.maxJumpVelocity - this.minJumpVelocity) * jumpProgress;
        }
        
        if (!input.jump) {
            this.jumpPressed = false;
        }
        
        // Handle spin jump
        if (!this.crouching && input.spinJump && !this.jumpPressed && this.onGround) {
            this.vy = this.minJumpVelocity * 1.2; // Higher jump for spin
            this.jumpPressed = true;
            this.jumpHoldTime = 0;
            this.onGround = false;
            this.state = 'spinning';
            this.spinJumping = true;
            this.spinAngle = 0;
            if (this.game) {
                this.game.sounds.spinJump.currentTime = 0;
                this.game.sounds.spinJump.play().catch(err => {});
            }
        }

        // Reset spin state when landing
        if (this.onGround) {
            this.spinJumping = false;
            this.spinAngle = 0;
        }

        // Update spin angle
        if (this.spinJumping) {
            this.spinAngle += this.spinSpeed;
            if (this.spinAngle >= 360) {
                this.spinAngle = 0;
            }
        }
        
        // Handle ground pound (only when in air and pressing down)
        if (!this.groundPounding && !this.onGround && input.crouch && !this.crouching) {
            this.groundPounding = true;
            this.vy = this.groundPoundSpeed;
            this.vx = 0; // Stop horizontal movement during ground pound
            if (this.game) {
                this.game.sounds.spinJump.currentTime = 0;
                this.game.sounds.spinJump.play().catch(err => {});
            }
        }

        // During ground pound
        if (this.groundPounding) {
            this.vy = this.groundPoundSpeed; // Constant fall speed
            this.vx = 0; // No horizontal movement
            
            // Check for landing
            const verticalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
            for (const collision of verticalCollisions) {
                if (collision.type === 'ground' || collision.type === 'brick' || collision.type === 'slope') {
                    if (this.y < collision.y) {
                        this.y = collision.y - this.height;
                        this.vy = 0;
                        this.groundPounding = false;
                        this.onGround = true;
                        // Create ground pound effect
                        if (this.game) {
                            this.game.sounds.stomp.currentTime = 0;
                            this.game.sounds.stomp.play().catch(err => {});
                            // Kill nearby enemies
                            for (const entity of entities) {
                                if (entity instanceof Goomba && !entity.dead) {
                                    const dx = entity.x - this.x;
                                    const dy = entity.y - this.y;
                                    const distance = Math.sqrt(dx * dx + dy * dy);
                                    if (distance < 64) { // Kill enemies within 64 pixels
                                        entity.dead = true;
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        // Apply gravity
        this.vy += gravity;
        this.vy = Math.min(this.vy, 12); // Terminal velocity
        
        // Horizontal collision detection
        const oldX = this.x;
        this.x += this.vx;
        
        // Check for horizontal collisions
        const horizontalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
        for (const collision of horizontalCollisions) {
            if (collision.type === 'wall' || collision.type === 'pipe' || collision.type === 'brick' || collision.type === 'ground' || collision.type === 'question') {
                // Reset horizontal position
                this.x = oldX;
                this.vx = 0;
                break;
            }
        }
        
        // Vertical collision detection
        const oldY = this.y;
        this.y += this.vy;
        this.onGround = false;
        
        const verticalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
        
        for (const collision of verticalCollisions) {
            if (collision.type === 'wall' || collision.type === 'pipe' || collision.type === 'brick' || collision.type === 'ground' || collision.type === 'question') {
                if (this.vy > 0) {
                    // Falling down - land on top
                    this.y = collision.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                    
                    // Check if it's a question block and hit it from below
                    if (collision.type === 'question' && !collision.hit && this.y > collision.y) {
                        world.hitQuestionBlock(collision);
                    }
                } else if (this.vy < 0) {
                    // Moving up - hit from below
                    this.y = collision.y + collision.height;
                    this.vy = 0;
                    
                    // Check if it's a question block and hit it from below
                    if (collision.type === 'question' && !collision.hit) {
                        world.hitQuestionBlock(collision);
                    }
                }
                break;
            }
        }
        
        // Check entity collisions
        for (const entity of entities) {
            if (entity.checkCollision(this.x, this.y, this.width, this.height)) {
                entity.onMarioCollision(this);
            }
        }
        
        // Animation
        if (this.state === 'walking') {
            // Faster animation when running
            const animSpeed = this.running ? 6 : 8;
            this.walkTimer++;
            if (this.walkTimer > animSpeed) {
                this.walkFrame = (this.walkFrame + 1) % 2;
                this.walkTimer = 0;
            }
        }
        
        // Update coordinates display
        this.coordsDisplay.textContent = `X: ${Math.floor(this.mario.x)}`;
        
        // Check for game win condition
        if (this.mario.x >= 3000 && !this.gameWon) {
            this.gameWon = true;
            this.sounds.bgm.pause();
            alert('Congratulations! You beat the game!');
            this.mario.reset();
            this.gameWon = false;
            this.sounds.bgm.currentTime = 0;
            this.sounds.bgm.play().catch(err => {});
        }
    }
    
    render(ctx, assets) {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        
        // Apply camera transform
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw background
        this.world.render(this.ctx, this.assets, this.camera);
        
        // Draw entities
        for (const entity of this.entities) {
            entity.render(this.ctx, this.assets);
        }
        
        // Draw Mario
        this.mario.render(this.ctx, this.assets);
        
        this.ctx.restore();
    }
    
    gameLoop() {
        const input = this.getInput();
        this.mario.update(input, this.world, this.entities);
        this.world.generateAhead(this.mario.x);
        
        // Update entities and remove dead ones
        this.entities = this.entities.filter(entity => !entity.shouldRemove);
        for (const entity of this.entities) {
            entity.update(this.world);
        }
        
        // Update camera to follow Mario
        this.camera.x = this.mario.x - this.canvas.width / 2 + this.mario.width / 2;
        this.camera.y = Math.max(0, this.mario.y - this.canvas.height / 2);
        
        updateIntroBox(this.mario.x);
        this.coordDisplay.textContent = `X: ${Math.floor(this.mario.x)}`;
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    spawnEntities() {
        // Initial entities will be generated procedurally
    }
    
    collectCoin() {
        this.coinCount++;
        this.score += 100; // Add 100 points for each coin
        document.getElementById('coinCounter').textContent = `Coins: ${this.coinCount}`;
        document.getElementById('scoreCounter').textContent = `Score: ${this.score}`;
        this.sounds.coin.currentTime = 0;
        this.sounds.coin.play().catch(err => console.log('Audio playback failed:', err));
    }
}

class Mario {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 24;
        this.height = 22;
        this.normalHeight = 22;
        this.crouchHeight = 16;
        this.bigHeight = 64;
        this.bigCrouchHeight = 32;
        this.onGround = false;
        this.facing = 1;
        this.state = 'idle';
        this.walkFrame = 0;
        this.walkTimer = 0;
        this.running = false;
        this.crouching = false;
        this.maxSpeed = 1.5;
        this.runSpeed = 4;
        this.jumpPressed = false;
        this.jumpHoldTime = 0;
        this.maxJumpHoldTime = 20;
        this.minJumpVelocity = -4;
        this.maxJumpVelocity = -6.5;
        this.dead = false;
        this.deathJumpVelocity = -8;
        this.respawnX = x;
        this.respawnY = y;
        this.game = null;
        this.spinJumping = false;
        this.spinAngle = 0;
        this.spinSpeed = 15;
        this.groundPounding = false;
        this.groundPoundSpeed = 12;
        this.big = false;
        this.normalWidth = 24;
        this.normalHeight = 32;
        this.bigWidth = 24;
        this.bigHeight = 64;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.friction = 0.85; // Changed from 0.95 to 0.85 for 3x more friction
        this.crouchJumpVelocity = -6;
    }
    
    update(input, world, entities) {
        if (this.dead) {
            // Death animation
            this.vy += 0.5; // Gravity
            this.y += this.vy;
            
            // Reset game if Mario falls off screen
            if (this.y > world.blocks[0].y + 500) {
                this.reset(); // 不播音樂
            }
            return;
        }
        
        const gravity = 0.25; // Changed from 0.5 (smaller value = more floaty)
        const jumpPower = 8;
        
        // Handle crouching
        if (input.crouch && this.onGround && !this.crouching) {
            this.crouching = true;
            this.state = 'crouching';
            this.y += (this.height - (this.big ? this.bigCrouchHeight : this.crouchHeight));
            this.height = this.big ? this.bigCrouchHeight : this.crouchHeight;
            this.vx = 0;
        }else if (!input.crouch && this.crouching) {
            const standingHeight = this.big ? this.bigHeight : this.normalHeight;
            const ceilingCollisions = world.getCollisions(this.x, this.y - (standingHeight - this.height), 
                                                          this.width, standingHeight);
            if (ceilingCollisions.length === 0) {
                this.crouching = false;
                this.height = standingHeight;
                this.state = 'idle';
            }
        }
        
        // Horizontal movement (only if not crouching)
        if (!this.crouching) {
            const moveSpeed = input.run ? this.runSpeed : this.maxSpeed;
            
            if (input.left) {
                this.vx = -moveSpeed;
                this.facing = -1;
                this.state = this.onGround ? 'walking' : 'jumping';
                this.running = input.run;
            } else if (input.right) {
                this.vx = moveSpeed;
                this.facing = 1;
                this.state = this.onGround ? 'walking' : 'jumping';
                this.running = input.run;
            } else if (this.onGround) {
                // Apply friction when on ground and not pressing movement keys
                this.vx *= this.friction;
                if (Math.abs(this.vx) < 0.1) this.vx = 0;
                this.state = this.vx === 0 ? 'idle' : 'walking';
                this.running = false;
            } else {
                this.vx = 0;
                this.state = 'jumping';
                this.running = false;
            }
        }
        
        // Variable height jumping (modified for crouch jumps)
        if (!this.crouching && input.jump && !this.jumpPressed && this.onGround) {
            this.vy = this.minJumpVelocity;
            this.jumpPressed = true;
            this.jumpHoldTime = 0;
            this.onGround = false;
            this.state = 'jumping';
        } else if (this.crouching && input.jump && !this.jumpPressed && this.onGround) {
            // Crouch jump - lower height, no variable jump height
            this.vy = this.crouchJumpVelocity;
            this.jumpPressed = true;
            this.onGround = false;
            this.state = 'jumping';
            this.crouching = false;
            this.height = this.big ? this.bigHeight : this.normalHeight;
        }
        
        if (input.jump && this.jumpPressed && this.jumpHoldTime < this.maxJumpHoldTime && this.vy < 0) {
            this.jumpHoldTime++;
            // Gradually increase jump velocity based on hold time
            const jumpProgress = this.jumpHoldTime / this.maxJumpHoldTime;
            this.vy = this.minJumpVelocity + (this.maxJumpVelocity - this.minJumpVelocity) * jumpProgress;
        }
        
        if (!input.jump) {
            this.jumpPressed = false;
        }
        
        // Handle spin jump
        if (!this.crouching && input.spinJump && !this.jumpPressed && this.onGround) {
            this.vy = this.minJumpVelocity * 1.2; // Higher jump for spin
            this.jumpPressed = true;
            this.jumpHoldTime = 0;
            this.onGround = false;
            this.state = 'spinning';
            this.spinJumping = true;
            this.spinAngle = 0;
            if (this.game) {
                this.game.sounds.spinJump.currentTime = 0;
                this.game.sounds.spinJump.play().catch(err => {});
            }
        }

        // Reset spin state when landing
        if (this.onGround) {
            this.spinJumping = false;
            this.spinAngle = 0;
        }

        // Update spin angle
        if (this.spinJumping) {
            this.spinAngle += this.spinSpeed;
            if (this.spinAngle >= 360) {
                this.spinAngle = 0;
            }
        }
        
        // Handle ground pound (only when in air and pressing down)
        if (!this.groundPounding && !this.onGround && input.crouch && !this.crouching) {
            this.groundPounding = true;
            this.vy = this.groundPoundSpeed;
            this.vx = 0; // Stop horizontal movement during ground pound
            if (this.game) {
                this.game.sounds.spinJump.currentTime = 0;
                this.game.sounds.spinJump.play().catch(err => {});
            }
        }

        // During ground pound
        if (this.groundPounding) {
            this.vy = this.groundPoundSpeed; // Constant fall speed
            this.vx = 0; // No horizontal movement
            
            // Check for landing
            const verticalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
            for (const collision of verticalCollisions) {
                if (collision.type === 'ground' || collision.type === 'brick' || collision.type === 'slope') {
                    if (this.y < collision.y) {
                        this.y = collision.y - this.height;
                        this.vy = 0;
                        this.groundPounding = false;
                        this.onGround = true;
                        // Create ground pound effect
                        if (this.game) {
                            this.game.sounds.stomp.currentTime = 0;
                            this.game.sounds.stomp.play().catch(err => {});
                            // Kill nearby enemies
                            for (const entity of entities) {
                                if (entity instanceof Goomba && !entity.dead) {
                                    const dx = entity.x - this.x;
                                    const dy = entity.y - this.y;
                                    const distance = Math.sqrt(dx * dx + dy * dy);
                                    if (distance < 64) { // Kill enemies within 64 pixels
                                        entity.dead = true;
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        // Apply gravity
        this.vy += gravity;
        this.vy = Math.min(this.vy, 12); // Terminal velocity
        
        // Horizontal collision detection
        const oldX = this.x;
        this.x += this.vx;
        
        // Check for horizontal collisions
        const horizontalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
        for (const collision of horizontalCollisions) {
            if (collision.type === 'wall' || collision.type === 'pipe' || collision.type === 'brick' || collision.type === 'ground' || collision.type === 'question') {
                // Reset horizontal position
                this.x = oldX;
                this.vx = 0;
                break;
            }
        }
        
        // Vertical collision detection
        const oldY = this.y;
        this.y += this.vy;
        this.onGround = false;
        
        const verticalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
        
        for (const collision of verticalCollisions) {
            if (collision.type === 'wall' || collision.type === 'pipe' || collision.type === 'brick' || collision.type === 'ground' || collision.type === 'question') {
                if (this.vy > 0) {
                    // Falling down - land on top
                    this.y = collision.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                    
                    // Check if it's a question block and hit it from below
                    if (collision.type === 'question' && !collision.hit && this.y > collision.y) {
                        world.hitQuestionBlock(collision);
                    }
                } else if (this.vy < 0) {
                    // Moving up - hit from below
                    this.y = collision.y + collision.height;
                    this.vy = 0;
                    
                    // Check if it's a question block and hit it from below
                    if (collision.type === 'question' && !collision.hit) {
                        world.hitQuestionBlock(collision);
                    }
                }
                break;
            }
        }
        
        // Check entity collisions
        for (const entity of entities) {
            if (entity.checkCollision(this.x, this.y, this.width, this.height)) {
                entity.onMarioCollision(this);
            }
        }
        
        // Animation
        if (this.state === 'walking') {
            // Faster animation when running
            const animSpeed = this.running ? 6 : 8;
            this.walkTimer++;
            if (this.walkTimer > animSpeed) {
                this.walkFrame = (this.walkFrame + 1) % 2;
                this.walkTimer = 0;
            }
        }
        
        // Handle size transition
        if (this.invincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }
        
        // Update collision box based on size
        this.width = this.big ? this.bigWidth : this.normalWidth;
        this.height = this.big ? this.bigHeight : this.normalHeight;
    }
    
    die() {
        if (!this.dead && !this.invincible) {
            if (this.big) {
                // Shrink instead of dying
                this.big = false;
                this.invincible = true;
                this.invincibleTimer = 60; // 1 second of invincibility
                if (this.game) {
                    this.game.sounds.stomp.currentTime = 0;
                    this.game.sounds.stomp.play().catch(err => {});
                }
            } else {
                this.dead = true;
                this.vy = this.deathJumpVelocity;
                this.vx = 0;
                this.state = 'dead';
                if (this.game) {
                    this.game.sounds.bgm.pause();
                    this.game.sounds.death.currentTime = 0;
                    this.game.sounds.death.play().catch(err => {});
                }
            }
        }
    }
    
    reset() {
        this.dead = false;
        this.x = this.respawnX;
        this.y = this.respawnY;
        this.vx = 0;
        this.vy = 0;
        this.state = 'idle';
        this.facing = 1;
        this.crouching = false;
        this.height = this.normalHeight;

        // Reset game state
        if (this.game) {
            this.game.coinCount = 0;
            this.game.score = 0;
            document.getElementById('coinCounter').textContent = 'Coins: 0';
            document.getElementById('scoreCounter').textContent = 'Score: 0';
            this.game.entities = this.game.entities.filter(e => !(e instanceof Goomba || e instanceof PiranhaPlant));

            // ✅ 加這行確保背景音樂重新播放
            this.game.sounds.bgm.currentTime = 0;
            this.game.sounds.bgm.play().catch(err => {});
        }
    }

    
    render(ctx, assets) {
        ctx.save();
        
        let sprite;
        let renderHeight = this.height;
        let renderWidth = this.width;
        let yOffset = 0; // Add y-offset for adjusting sprite position
        
        if (this.spinJumping) {
            // Center the rotation
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.spinAngle * Math.PI / 180);
            ctx.translate(-(this.x + this.width/2), -(this.y + this.height/2));
        } else if (this.groundPounding) {
            // Use crouch sprite for ground pound
            sprite = this.big ? assets.bigmarioCrouch : assets.marioCrouch;
            renderHeight = this.big ? this.bigCrouchHeight : this.crouchHeight;
            yOffset = this.big ? this.bigHeight - this.bigCrouchHeight : this.height - this.crouchHeight; // Add offset for crouch
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(180 * Math.PI / 180); // Rotate 180 degrees
            ctx.translate(-(this.x + this.width/2), -(this.y + this.height/2));
        } else if (this.state === 'crouching') {
            sprite = this.big ? assets.bigmarioCrouch : assets.marioCrouch;
            renderHeight = this.big ? this.bigCrouchHeight : this.crouchHeight;
            yOffset = this.big ? this.bigHeight - this.bigCrouchHeight : this.height - this.crouchHeight; // Add offset for crouch
        } else if (this.facing === -1) {
            ctx.scale(-1, 1);
            ctx.translate(-this.x - this.width, this.y);
        } else {
            ctx.translate(this.x, this.y);
        }
        
        if (this.dead) {
            sprite = assets.marioDeath;
        } else if (this.big) {
            if (this.state === 'spinning' || this.state === 'jumping') {
                sprite = assets.bigmarioJump;
                renderWidth = this.width * 2;
            } else if (this.state === 'crouching') {
                sprite = assets.bigmarioCrouch;
                renderHeight = this.bigCrouchHeight;
            } else {
                sprite = assets.bigmarioIdle;
            }
        } else {
            if (this.state === 'spinning') {
                sprite = assets.marioJump;
            } else if (this.state === 'jumping') {
                sprite = assets.marioJump;
            } else if (this.state === 'walking') {
                sprite = assets.marioWalk3;
            } else if (this.state === 'crouching') {
                sprite = assets.marioCrouch;
                renderHeight = this.crouchHeight;
            } else {
                sprite = assets.marioIdle;
            }
        }
        
        if (sprite) {
            if (this.spinJumping || this.groundPounding) {
                ctx.drawImage(sprite, this.x, this.y, renderWidth, renderHeight);
            } else if (this.state === 'crouching') {
                // Draw crouching sprite at adjusted y position
                ctx.drawImage(sprite, this.x, this.y + yOffset, renderWidth, renderHeight);
            } else {
                ctx.drawImage(sprite, 0, 0, renderWidth, renderHeight);
            }
        }
        
        ctx.restore();
    }
}

class World {
    constructor() {
        this.blocks = [];
        this.entities = [];
        this.slopes = [];
        this.generatedX = 0;
        this.chunkSize = 32 * 2; // Generate in chunks
        this.generateInitialChunks();
    }
    
    generateInitialChunks() {
        // Generate first few chunks
        for (let i = 0; i < 5; i++) {
            this.generateChunk(i * this.chunkSize);
        }
    }
    
    generateAhead(marioX) {
        // Generate chunks ahead of Mario
        const targetX = marioX + 800; // Generate 800 pixels ahead
        while (this.generatedX < targetX) {
            this.generateChunk(this.generatedX);
            this.generatedX += this.chunkSize;
        }
        
        // Clean up blocks and entities far behind Mario
        const cleanupX = marioX - 1000;
        this.blocks = this.blocks.filter(block => block.x > cleanupX);
        if (this.game) {
            this.game.entities = this.game.entities.filter(entity => entity.x > cleanupX);
        }
    }
    
    generateChunk(startX) {
        const chunkBlocks = startX / 32;
        
        // Check if we should generate the castle
        if (startX >= 9800 && !this.castleGenerated) {
            this.castleGenerated = true;
            
            // Generate castle platform
            for (let x = 0; x < 10; x++) {
                for (let y = 11; y < 20; y++) {
                    this.blocks.push({ 
                        x: (chunkBlocks + x) * 32, 
                        y: y * 32, 
                        width: 32, 
                        height: 32, 
                        type: 'ground' 
                    });
                }
            }

            // Generate castle structure
            const castleWidth = 6;
            const castleHeight = 8;
            
            // Main castle body
            for (let x = 0; x < castleWidth; x++) {
                for (let y = 0; y < castleHeight; y++) {
                    this.blocks.push({ 
                        x: (chunkBlocks + 2 + x) * 32, 
                        y: (11 - y) * 32, 
                        width: 32, 
                        height: 32, 
                        type: 'wall' 
                    });
                }
            }
            
            // Castle battlements
            for (let x = 0; x < castleWidth; x += 2) {
                this.blocks.push({ 
                    x: (chunkBlocks + 2 + x) * 32, 
                    y: (11 - castleHeight) * 32 - 32, 
                    width: 32, 
                    height: 32, 
                    type: 'wall' 
                });
            }

            // Generate entrance
            this.blocks = this.blocks.filter(block => 
                !(block.x >= (chunkBlocks + 3) * 32 && 
                  block.x < (chunkBlocks + 5) * 32 && 
                  block.y >= (11 - 2) * 32 && 
                  block.y < 11 * 32)
            );

            return; // Skip regular chunk generation
        }

        // Create ground level
        for (let x = 0; x < 20; x++) {
            for (let y = 11; y < 20; y++) {
                this.blocks.push({ 
                    x: (chunkBlocks + x) * 32, 
                    y: y * 32, 
                    width: 32, 
                    height: 32, 
                    type: 'ground' 
                });
            }
        }
        
        // Randomly generate larger features - REDUCED COUNT AND HIGHER POSITIONS
        const features = Math.floor(Math.random() * 1) + 1; // Only 1-2 features per chunk
        
        for (let i = 0; i < features; i++) {
            const featureX = chunkBlocks + Math.floor(Math.random() * 16) + 2;
            const featureType = Math.random();
            
            if (featureType < 0.25) {
                // Larger Platform - HIGHER
                const platformWidth = Math.floor(Math.random() * 3) + 2; // 2-4 blocks wide
                const platformY = Math.floor(Math.random() * 4) + 4; // Generate between Y=4 and Y=7 (higher)
                for (let x = 0; x < platformWidth; x++) {
                    this.blocks.push({ 
                        x: (featureX + x) * 32, 
                        y: platformY * 32, 
                        width: 32, 
                        height: 32, 
                        type: 'ground' 
                    });
                }
                
                // Even less chance for second level
                if (Math.random() < 0.15) {
                    const upperWidth = Math.floor(platformWidth * 0.7);
                    const upperOffset = Math.floor((platformWidth - upperWidth) / 2);
                    for (let x = 0; x < upperWidth; x++) {
                        this.blocks.push({ 
                            x: (featureX + upperOffset + x) * 32, 
                            y: (platformY - 1) * 32, 
                            width: 32, 
                            height: 32, 
                            type: 'ground' 
                        });
                    }
                }
            } else if (featureType < 0.4) {
                // Brick Formation - HIGHER
                const brickWidth = Math.floor(Math.random() * 2) + 1; // 1-2 blocks wide
                const brickHeight = Math.floor(Math.random() * 2) + 1; // 1-2 blocks high
                for (let x = 0; x < brickWidth; x++) {
                    for (let y = 0; y < brickHeight; y++) {
                        this.blocks.push({ 
                            x: (featureX + x) * 32, 
                            y: (6 - y) * 32, // Higher position
                            width: 32, 
                            height: 32, 
                            type: 'brick' 
                        });
                    }
                }
            } else if (featureType < 0.55) {
                // Single Question block - HIGHER
                this.blocks.push({ 
                    x: featureX * 32, 
                    y: 6 * 32, // Higher position
                    width: 32, 
                    height: 32, 
                    type: 'question' 
                });
            } else if (featureType < 0.7) {
                // Pipe - REDUCED SIZE
                const pipeHeight = Math.floor(Math.random() * 2) + 2;
                const pipeWidth = 2;
                
                for (let w = 0; w < pipeWidth; w++) {
                    for (let h = 0; h < pipeHeight; h++) {
                        this.blocks.push({ 
                            x: (featureX + w) * 32, 
                            y: (11 - h) * 32,
                            width: 32, 
                            height: 32, 
                            type: 'pipe' 
                        });
                    }
                }
                
                // Less chance for piranha plant
                if (this.game && Math.random() < 0.3) {
                    this.game.entities.push(new PiranhaPlant((featureX + pipeWidth/2) * 32, (11 - pipeHeight) * 32 - 32));
                }
            } else {
                // Castle-like Structure - SMALLER AND HIGHER
                const wallWidth = Math.floor(Math.random() * 2) + 1; // 1-2 blocks wide
                const wallHeight = Math.floor(Math.random() * 2) + 2; // 2-3 blocks high
                
                for (let x = 0; x < wallWidth; x++) {
                    for (let y = 0; y < wallHeight; y++) {
                        this.blocks.push({ 
                            x: (featureX + x) * 32, 
                            y: (9 - y) * 32, // Higher position
                            width: 32, 
                            height: 32, 
                            type: 'wall' 
                        });
                    }
                }
                
                // Reduced chance for battlements
                if (Math.random() < 0.2) {
                    for (let x = 0; x < wallWidth; x += 2) {
                        this.blocks.push({ 
                            x: (featureX + x) * 32, 
                            y: (9 - wallHeight) * 32 - 32,
                            width: 32, 
                            height: 32, 
                            type: 'wall' 
                        });
                    }
                }
            }
        }
        
        // Spawn entities - REDUCED FREQUENCIES AND HIGHER POSITIONS
        if (this.game) {
            // Goombas - reduced chance
            if (Math.random() < 0.15) {
                const goombaX = (chunkBlocks + Math.floor(Math.random() * 18) + 1) * 32;
                const goomba = new Goomba(goombaX, 300);
                goomba.game = this.game;
                this.game.entities.push(goomba);
            }
            
            // Coins - higher positions
            if (Math.random() < 0.2) {
                const coinX = (chunkBlocks + Math.floor(Math.random() * 18) + 1) * 32;
                const coinY = Math.floor(Math.random() * 5) + 4; // Generate between Y=4 and Y=8
                this.game.entities.push(new Coin(coinX + 4, coinY * 32 + 4));
            }
            
            // Bushes - reduced
            if (Math.random() < 0.4) {
                const bushX = (chunkBlocks + Math.floor(Math.random() * 18) + 1) * 32;
                this.game.entities.push(new Bush(bushX, 10 * 32));
            }

            // Clouds - higher positions
            if (Math.random() < 0.5) {
                const cloudX = (chunkBlocks + Math.floor(Math.random() * 18) + 1) * 32;
                const cloudY = Math.floor(Math.random() * 3) + 1; // Generate between Y=1 and Y=3
                this.game.entities.push(new Cloud(cloudX, cloudY * 32));
            }
        }
    }
    
    getCollisions(x, y, width, height) {
        const collisions = [];
        
        // Check regular blocks
        for (const block of this.blocks) {
            if (x < block.x + block.width &&
                x + width > block.x &&
                y < block.y + block.height &&
                y + height > block.y) {
                collisions.push(block);
            }
        }
        
        return collisions;
    }

    hitQuestionBlock(block) {
        if (block.hit) return;
        
        block.hit = true;
        block.type = 'ground';
        
        // Randomly spawn either a coin or mushroom
        if (this.game) {
            if (Math.random() < 0.3) { // 30% chance for mushroom
                const mushroom = new Mushroom(block.x, block.y - 32);
                mushroom.vy = -4; // Initial upward velocity
                this.game.entities.push(mushroom);
            } else {
                const coin = new Coin(block.x + 4, block.y - 32);
                coin.vy = -8;
                coin.temporary = true;
                coin.originalY = block.y - 32;
                this.game.entities.push(coin);
            }
        }
    }
    
    render(ctx, assets, camera) {
        // Render regular blocks
        const startX = Math.floor(camera.x / 32) - 1;
        const endX = Math.ceil((camera.x + 800) / 32) + 1;
        
        for (const block of this.blocks) {
            const blockX = block.x / 32;
            if (blockX >= startX && blockX <= endX) {
                let texture;
                switch (block.type) {
                    case 'brick':
                        texture = assets.brick;
                        break;
                    case 'question':
                        texture = assets.questionBlock;
                        break;
                    case 'wall':
                        texture = assets.brick; // Use brick texture for walls
                        break;
                    case 'pipe':
                        texture = assets.pipe;
                        // For pipes, draw the texture stretched across the full pipe width
                        if (texture) {
                            // Find connected pipe blocks
                            const pipeBlocks = this.blocks.filter(b => 
                                b.type === 'pipe' && 
                                b.y === block.y && 
                                Math.abs(b.x - block.x) <= block.width
                            );
                            
                            if (pipeBlocks.length > 1) {
                                // Get the leftmost pipe block
                                const leftBlock = pipeBlocks.reduce((min, curr) => 
                                    curr.x < min.x ? curr : min
                                );
                                
                                // Only draw if this is the leftmost block
                                if (block === leftBlock) {
                                    const totalWidth = pipeBlocks.length * block.width;
                                    ctx.drawImage(texture, block.x, block.y, totalWidth, block.height);
                                }
                                continue;
                            }
                        }
                        break;
                    default:
                        texture = assets.ground;
                }
                
                if (texture && block.type !== 'pipe') {
                    ctx.drawImage(texture, block.x, block.y, block.width, block.height);
                }
            }
        }
        
        // Render slopes
        for (const slope of this.slopes) {
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            if (slope.direction === 'right') {
                ctx.moveTo(slope.x, slope.y + slope.height);
                ctx.lineTo(slope.x + slope.width, slope.y);
                ctx.lineTo(slope.x + slope.width, slope.y + slope.height);
            } else {
                ctx.moveTo(slope.x, slope.y);
                ctx.lineTo(slope.x + slope.width, slope.y + slope.height);
                ctx.lineTo(slope.x, slope.y + slope.height);
            }
            ctx.closePath();
            ctx.fill();
        }
    }
}

class Goomba {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = -1;
        this.vy = 0;
        this.width = 24;
        this.height = 32;
        this.onGround = false;
        this.dead = false;
        this.deadTimer = 0;
        this.shouldRemove = false;
        this.game = null;
    }
    
    update(world) {
        if (this.dead) {
            this.deadTimer++;
            if (this.deadTimer > 30) { // Reduced from 60 to 30 frames
                this.shouldRemove = true;
            }
            return;
        }
        
        const gravity = 0.25; // Changed from 0.5 (smaller value = more floaty)
        
        // Apply gravity
        this.vy += gravity;
        this.vy = Math.min(this.vy, 12);
        
        // Horizontal movement and wall collision
        this.x += this.vx;
        
        // Check for wall collisions
        const horizontalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
        for (const collision of horizontalCollisions) {
            if (collision.type === 'wall' || collision.type === 'pipe' || collision.type === 'brick') {
                // Hit wall, turn around
                this.vx = -this.vx;
                if (this.vx > 0) {
                    this.x = collision.x + collision.width;
                } else {
                    this.x = collision.x - this.width;
                }
            }
        }
        
        // Vertical movement
        this.y += this.vy;
        
        // Vertical collision detection
        this.onGround = false;
        const verticalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
        
        for (const collision of verticalCollisions) {
            if (this.vy > 0 && this.y < collision.y) {
                // Landing on ground
                this.y = collision.y - this.height;
                this.vy = 0;
                this.onGround = true;
            }
        }
    }
    
    checkCollision(x, y, width, height) {
        return this.x < x + width &&
               this.x + this.width > x &&
               this.y < y + height &&
               this.y + this.height > y;
    }
    
    onMarioCollision(mario) {
        if (this.dead) return;
        
        // Check if Mario is jumping on top
        if (mario.vy > 0 && mario.y < this.y) {
            this.dead = true;
            mario.vy = -5; // Bounce
            if (mario.game) {
                mario.game.score += 200; // Add 200 points for killing a Goomba
                document.getElementById('scoreCounter').textContent = `Score: ${mario.game.score}`;
                mario.game.sounds.stomp.currentTime = 0;
                mario.game.sounds.stomp.play().catch(err => {});
            }
        } else if (!mario.dead) {
            mario.die();
        }
    }
    
    render(ctx, assets) {
        const sprite = this.dead ? assets.deadGoomba : assets.goomba;
        if (sprite) {
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.dead ? '#654321' : '#8B4513';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 24;
        this.collected = false;
        this.shouldRemove = false;
        this.animFrame = 0;
        this.animTimer = 0;
        this.temporary = false; // For coins from blocks
        this.vy = 0; // For vertical movement
        this.originalY = y; // Store original position
    }
    
    update() {
        this.animTimer++;
        if (this.animTimer > 10) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }

        // For coins that pop out of blocks
        if (this.temporary) {
            this.vy += 0.5; // Apply gravity
            this.y += this.vy;
            
            // Remove after animation
            if (this.y > this.originalY + 64) {
                this.shouldRemove = true;
            }
        }
    }
    
    checkCollision(x, y, width, height) {
        return !this.collected && 
               this.x < x + width &&
               this.x + this.width > x &&
               this.y < y + height &&
               this.y + this.height > y;
    }
    
    onMarioCollision(mario) {
        if (!this.collected) {
            this.collected = true;
            this.shouldRemove = true;
            // Add coin to counter
            if (mario.game) {
                mario.game.collectCoin();
            }
        }
    }
    
    render(ctx, assets) {
        if (!this.collected && assets.coin) {
            ctx.drawImage(assets.coin, this.x, this.y, this.width, this.height);
        }
    }
}

class Bush {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 64;
        this.height = 32;
    }
    
    update() {
        // Bushes are decorative, no update needed
    }
    
    checkCollision() {
        return false; // Bushes don't collide
    }
    
    onMarioCollision() {
        // No collision
    }
    
    render(ctx, assets) {
        if (assets.bush) {
            ctx.drawImage(assets.bush, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#228B22';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class PiranhaPlant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.originalY = y;
        this.width = 24;
        this.height = 32;
        this.extending = true;
        this.timer = 0;
        this.maxTimer = 120; // 2 seconds at 60fps
        this.speed = 1;
        this.shouldRemove = false;
    }
    
    update(world) {
        this.timer++;
        
        if (this.extending) {
            this.y -= this.speed;
            if (this.y <= this.originalY - 32) {
                this.extending = false;
                this.timer = 0;
            }
        } else {
            if (this.timer > 60) { // Stay extended for 1 second
                this.y += this.speed;
                if (this.y >= this.originalY) {
                    this.y = this.originalY;
                    this.extending = true;
                    this.timer = 0;
                }
            }
        }
    }
    
    checkCollision(x, y, width, height) {
        return this.x < x + width &&
               this.x + this.width > x &&
               this.y < y + height &&
               this.y + this.height > y;
    }
    
    onMarioCollision(mario) {
        if (!mario.dead) {
            mario.die();
        }
    }
    
    render(ctx, assets) {
        if (assets.piranha) {
            ctx.drawImage(assets.piranha, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#FF4500';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Cloud {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 96; // Wider than bushes
        this.height = 48;
        this.vx = -0.2; // Slow movement to the left
    }
    
    update() {
        this.x += this.vx;
    }
    
    checkCollision() {
        return false; // Clouds don't collide
    }
    
    onMarioCollision() {
        // No collision
    }
    
    render(ctx, assets) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.x + 24, this.y + 24, 20, 0, Math.PI * 2);
        ctx.arc(this.x + 48, this.y + 24, 24, 0, Math.PI * 2);
        ctx.arc(this.x + 72, this.y + 24, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Mushroom {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 32;
        this.vx = 2;
        this.vy = 0;
        this.collected = false;
        this.shouldRemove = false;
    }
    
    update(world) {
        if (this.collected) return;
        
        const gravity = 0.25;
        
        // Apply gravity
        this.vy += gravity;
        this.vy = Math.min(this.vy, 12);
        
        // Horizontal movement
        this.x += this.vx;
        
        // Check for wall collisions
        const horizontalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
        for (const collision of horizontalCollisions) {
            if (collision.type === 'wall' || collision.type === 'pipe' || collision.type === 'brick') {
                this.vx = -this.vx;
                if (this.vx > 0) {
                    this.x = collision.x + collision.width;
                } else {
                    this.x = collision.x - this.width;
                }
            }
        }
        
        // Vertical movement
        this.y += this.vy;
        
        // Check ground collisions
        const verticalCollisions = world.getCollisions(this.x, this.y, this.width, this.height);
        for (const collision of verticalCollisions) {
            if (this.vy > 0) {
                this.y = collision.y - this.height;
                this.vy = 0;
            }
        }
    }
    
    checkCollision(x, y, width, height) {
        return !this.collected &&
               this.x < x + width &&
               this.x + this.width > x &&
               this.y < y + height &&
               this.y + this.height > y;
    }
    
    onMarioCollision(mario) {
        if (!this.collected) {
            this.collected = true;
            this.shouldRemove = true;
            mario.big = true;
            if (mario.game) {
                mario.game.sounds.powerup.currentTime = 0;
                mario.game.sounds.powerup.play().catch(err => {});
            }
        }
    }
    
    render(ctx) {
        if (!this.collected) {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            // Draw white spots
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(this.x + 10, this.y + 10, 5, 0, Math.PI * 2);
            ctx.arc(this.x + 22, this.y + 10, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 改成使用者點擊後才啟動遊戲
document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('startButton').style.display = 'none';
    new Game();
});


// === 自我介紹解鎖功能 ===
function updateIntroBox(x) {
    const infoBox = document.getElementById('infoBox');
    if (!infoBox) return;

    if (x >= 1700) {
    infoBox.innerHTML = '🌟 <a href="https://github.com/qazjoy" target="_blank" style="color: yellow;">GitHub：qazjoy</a>';
    infoBox.style.display = 'block';
    }else if (x >= 1500) {
        infoBox.textContent = '🎮 喜歡遊戲、小說漫畫';
        infoBox.style.display = 'block';
    } else if (x >= 1000) {
        infoBox.textContent = '😄 個性文靜、善良、樂於助人';
        infoBox.style.display = 'block';
    } else if (x >= 500) {
        infoBox.textContent = '🎓 鄭語喬:就讀虎尾科技大學資訊工程科';
        infoBox.style.display = 'block';
    } else {
        infoBox.style.display = 'none';
    }
}



