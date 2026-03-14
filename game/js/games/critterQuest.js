// ===== CRITTER QUEST =====
// Pokemon Gen-1-style top-down overworld adventure for toddlers.
// Canvas-drawn characters only — no emoji on the game canvas.
// Controls: keyboard arrows, on-screen D-pad, PS5 DualSense (Gamepad API).

class CritterQuestGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    // ---- tile / world ----
    this.TILE  = 48;           // px per tile (scales to fit screen)
    this.map   = CW_MAP;       // imported from critterWorld.js
    this.npcs  = CW_NPCS.map(n => ({ ...n })); // fresh copies each session

    // ---- hero ----
    this.hero = {
      tileX: CW_HERO_START.x,
      tileY: CW_HERO_START.y,
      px: 0, py: 0,           // pixel position (lerped during walk)
      dir: 'down',            // 'up'|'down'|'left'|'right'
      frame: 0,               // walk animation frame 0-7
      stepping: false,        // mid-step lerp active
      stepT: 0,               // lerp progress 0→1
      stepFrom: { x:0, y:0 },
      stepTo:   { x:0, y:0 },
    };

    // ---- camera (pixel offset, top-left of viewport) ----
    this.cam = { x: 0, y: 0 };

    // ---- input ----
    this.keys    = {};   // keyboard
    this.padDir  = null; // gamepad direction this frame
    this.dpadActive = null; // touch d-pad
    this.moveQueue  = [];   // queued direction from input
    this.moveCooldown = 0;  // ms between moves when key held

    // ---- dialogue / interaction ----
    this.dialogue = null;     // null or { npc, page, lines[] }
    this.interactCooldown = 0;

    // ---- game state ----
    this.critterCount = 0;
    this.running = false;
    this._raf = null;
    this._lastTs = 0;

    // ---- UI elements (overlay D-pad + dialogue) ----
    this._dpadEl    = null;
    this._dialogueEl = null;

    // ---- bind handlers ----
    this._onKeyDown  = (e) => this._handleKey(e, true);
    this._onKeyUp    = (e) => this._handleKey(e, false);
    this._onGamepad  = () => {};   // polled each frame
    this._onResize   = () => this._resize();
  }

  // ==============================
  //  PUBLIC API
  // ==============================

  start() {
    this.running = true;
    this._resize();
    this._snapHeroToPx();
    this._clampCam();

    // Reset NPC join state for this session
    this.npcs.forEach(n => n.joined = false);
    this.critterCount = 0;

    // Build overlay UI
    this._buildUI();

    // Input listeners
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
    window.addEventListener('resize',  this._onResize);

    // HUD
    App.setHUDTitle('Critter Quest');
    App.updateHUDScore(0);
    App.updateHUDHearts(3);

    // Welcome speech
    setTimeout(() => {
      Audio.speak('Welcome to Critter Quest! Use the arrows to explore and find your critter friends!', { rate: 0.9 });
    }, 600);

    this._loop(performance.now());
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    window.removeEventListener('resize',  this._onResize);
    this._removeUI();
  }

  handleVoice(cmd) {
    const dirMap = { UP:'up', DOWN:'down', LEFT:'left', RIGHT:'right' };
    if (dirMap[cmd]) this.moveQueue.push(dirMap[cmd]);
  }

  // ==============================
  //  GAME LOOP
  // ==============================

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min(ts - this._lastTs, 80); // cap at 80ms
    this._lastTs = ts;

    this._pollGamepad();
    this._update(dt);
    this._render();

    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    // Cooldowns
    if (this.moveCooldown   > 0) this.moveCooldown   -= dt;
    if (this.interactCooldown > 0) this.interactCooldown -= dt;

    // If dialogue open, only handle confirm/interact input to advance it
    if (this.dialogue) {
      const confirmPressed = this.keys[' '] || this.keys['Enter'] || this._padInteract;
      this._padInteract = false;
      if (confirmPressed && this.interactCooldown <= 0) {
        this._advanceDialogue();
        this.interactCooldown = 350;
      }
      return;
    }

    // Step lerp
    if (this.hero.stepping) {
      this.hero.stepT += dt / 160; // 160ms per step
      if (this.hero.stepT >= 1) {
        this.hero.stepT = 1;
        this.hero.stepping = false;
        this.hero.tileX = this.hero.stepTo.tileX;
        this.hero.tileY = this.hero.stepTo.tileY;
        this.hero.px    = this.hero.tileX * this.TILE;
        this.hero.py    = this.hero.tileY * this.TILE;
        // advance walk frame
        this.hero.frame = (this.hero.frame + 1) % 4;
        this.moveCooldown = 0; // allow immediate next step
      } else {
        // lerp pixel position
        this.hero.px = this._lerp(this.hero.stepFrom.px, this.hero.stepTo.tileX * this.TILE, this.hero.stepT);
        this.hero.py = this._lerp(this.hero.stepFrom.py, this.hero.stepTo.tileY * this.TILE, this.hero.stepT);
      }
      this._clampCam();
      return;
    }

    // Gather direction input
    let dir = null;
    if      (this.keys['ArrowUp']    || this.keys['w'] || this.keys['W']) dir = 'up';
    else if (this.keys['ArrowDown']  || this.keys['s'] || this.keys['S']) dir = 'down';
    else if (this.keys['ArrowLeft']  || this.keys['a'] || this.keys['A']) dir = 'left';
    else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) dir = 'right';

    // Gamepad / touch override
    if (this.padDir)     dir = this.padDir;
    if (this.dpadActive) dir = this.dpadActive;

    // Queued voice/button commands
    if (!dir && this.moveQueue.length) dir = this.moveQueue.shift();

    // Interact button (Space / Enter / controller X=0 / circle=1)
    const interactPressed = this.keys[' '] || this.keys['Enter'] || this._padInteract;
    this._padInteract = false;

    if (interactPressed && this.interactCooldown <= 0) {
      this._tryInteract();
      this.interactCooldown = 400;
    }

    if (dir && this.moveCooldown <= 0) {
      this._tryMove(dir);
    }
  }

  _tryMove(dir) {
    const { tileX, tileY } = this.hero;
    const delta = { up:[-1,0,'up'], down:[1,0,'down'], left:[0,-1,'left'], right:[0,1,'right'] };
    const [dy, dx, facing] = delta[dir];

    const nx = tileX + dx;
    const ny = tileY + dy;

    this.hero.dir = facing;

    // Bounds check
    if (nx < 0 || nx >= CW_COLS || ny < 0 || ny >= CW_ROWS) return;

    // Solid tile check
    const tile = this.map[ny][nx];
    if (CW_SOLID[tile]) return;

    // NPC collision — don't walk into them
    const npcAt = this.npcs.find(n => n.tileX === nx && n.tileY === ny);
    if (npcAt) return;

    // Start step lerp
    this.hero.stepping  = true;
    this.hero.stepT     = 0;
    this.hero.stepFrom  = { px: this.hero.px, py: this.hero.py };
    this.hero.stepTo    = { tileX: nx, tileY: ny };
    this.moveCooldown   = 120; // ms before next key-held repeat
  }

  _tryInteract() {
    const { tileX, tileY, dir } = this.hero;
    // Check the tile the hero is facing
    const faceOffsets = { up:[-1,0], down:[1,0], left:[0,-1], right:[0,1] };
    const [dy, dx] = faceOffsets[dir];
    const fx = tileX + dx;
    const fy = tileY + dy;

    const npc = this.npcs.find(n => n.tileX === fx && n.tileY === fy);
    if (!npc) {
      // Also check all 4 adjacent tiles (player might not be facing exactly)
      const adj = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [ady, adx] of adj) {
        const an = this.npcs.find(n => n.tileX === tileX + adx && n.tileY === tileY + ady);
        if (an) { this._startDialogue(an); return; }
      }
      return;
    }
    this._startDialogue(npc);
  }

  _startDialogue(npc) {
    const lines = npc.joined
      ? [`${npc.name}: I'm so happy to travel with you! 🌟`, 'Press OK to keep exploring!']
      : [
          `${npc.name}: ${npc.tagline}`,
          `Help me with a little game and I'll join your adventure!`,
          `Press OK to play!`,
        ];

    this.dialogue = { npc, page: 0, lines };
    this._showDialogue();
  }

  _showDialogue() {
    const { npc, page, lines } = this.dialogue;
    if (this._dialogueEl) {
      const textEl = this._dialogueEl.querySelector('.cq-dlg-text');
      const nameEl = this._dialogueEl.querySelector('.cq-dlg-name');
      const btn    = this._dialogueEl.querySelector('.cq-dlg-btn');
      nameEl.textContent = npc.name;
      textEl.textContent = lines[page];
      btn.textContent    = page < lines.length - 1 ? 'Next ➡️' : (npc.joined ? 'OK! 🌟' : 'Play! 🎮');
      this._dialogueEl.style.display = 'flex';
    }
  }

  _advanceDialogue() {
    if (!this.dialogue) return;
    const { npc, page, lines } = this.dialogue;

    if (page < lines.length - 1) {
      this.dialogue.page++;
      this._showDialogue();
    } else {
      // Last page — either launch game or dismiss
      if (!npc.joined) {
        this._launchCritterGame(npc);
      } else {
        this._closeDialogue();
      }
    }
  }

  _launchCritterGame(npc) {
    this._closeDialogue();
    this.stop();

    // Launch the mini-game; on complete, return to Critter Quest
    App.lastGameName = npc.game;
    App.showScreen('game');

    const canvas2 = document.getElementById('game-canvas');
    canvas2.width  = window.innerWidth;
    canvas2.height = window.innerHeight;
    const ctx2 = canvas2.getContext('2d');

    // When mini-game finishes, mark critter as joined and resume Critter Quest
    const onMiniComplete = (stars = 3) => {
      App.stars += stars;
      localStorage.setItem('kq_stars', App.stars);

      npc.joined = true;
      this.critterCount++;
      App.updateHUDScore(this.critterCount);

      // Thank you speech
      Audio.speak(`${npc.name} joins your adventure! ${this.critterCount === CW_NPCS.length ? 'You found all the critters! Amazing!' : 'Keep exploring to find more friends!'}`, { rate: 0.9 });

      // If all critters found → game complete
      if (this.critterCount >= CW_NPCS.length) {
        setTimeout(() => this.onComplete(3), 2000);
        return;
      }

      // Otherwise resume Critter Quest
      App.showScreen('game');
      const c3 = document.getElementById('game-canvas');
      c3.width  = window.innerWidth;
      c3.height = window.innerHeight;
      this.canvas = c3;
      this.ctx    = c3.getContext('2d');
      this.running = true;
      this._buildUI();
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup',   this._onKeyUp);
      window.addEventListener('resize',  this._onResize);
      App.setHUDTitle('Critter Quest');
      App.updateHUDScore(this.critterCount);
      this._loop(performance.now());
    };

    // Switch on the mini-game
    let game;
    switch (npc.game) {
      case 'gemsort':
        game = new GemSortGame(canvas2, ctx2, onMiniComplete);
        game.start();
        break;
      case 'match':
        game = new MemoryMatchGame(canvas2, ctx2, onMiniComplete);
        game.start();
        break;
      case 'spotdiff':
        game = new SpotDiffGame(canvas2, ctx2, onMiniComplete);
        game.start(0);
        break;
      default:
        onMiniComplete(3); // fallback
    }
    App.currentGame = game;
  }

  _closeDialogue() {
    this.dialogue = null;
    this.interactCooldown = 500;
    if (this._dialogueEl) this._dialogueEl.style.display = 'none';
  }

  // ==============================
  //  GAMEPAD (PS5 DualSense)
  // ==============================

  _pollGamepad() {
    this.padDir = null;
    this._padInteract = false;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;

      // D-pad: buttons 12=up, 13=down, 14=left, 15=right
      if (pad.buttons[12]?.pressed) { this.padDir = 'up';    break; }
      if (pad.buttons[13]?.pressed) { this.padDir = 'down';  break; }
      if (pad.buttons[14]?.pressed) { this.padDir = 'left';  break; }
      if (pad.buttons[15]?.pressed) { this.padDir = 'right'; break; }

      // Left analog stick (axes 0=horizontal, 1=vertical) — threshold 0.5
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if      (ay < -0.5) { this.padDir = 'up';    break; }
      else if (ay >  0.5) { this.padDir = 'down';  break; }
      else if (ax < -0.5) { this.padDir = 'left';  break; }
      else if (ax >  0.5) { this.padDir = 'right'; break; }

      // X button=0, Cross=0, Circle=1 → interact
      if (pad.buttons[0]?.pressed || pad.buttons[1]?.pressed) {
        this._padInteract = true;
      }
    }
  }

  // ==============================
  //  KEYBOARD
  // ==============================

  _handleKey(e, down) {
    this.keys[e.key] = down;
    // Prevent page scroll
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
      e.preventDefault();
    }
  }

  // ==============================
  //  RENDER
  // ==============================

  _render() {
    const { canvas, ctx, cam, TILE } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Draw tiles
    const startRow = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const endRow   = Math.min(CW_ROWS - 1, Math.ceil((cam.y + canvas.height) / TILE) + 1);
    const startCol = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const endCol   = Math.min(CW_COLS - 1, Math.ceil((cam.x + canvas.width) / TILE) + 1);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this._drawTile(ctx, c * TILE, r * TILE, this.map[r][c]);
      }
    }

    // Draw NPCs
    for (const npc of this.npcs) {
      this._drawNPC(ctx, npc.tileX * TILE, npc.tileY * TILE, npc);
    }

    // Draw hero
    this._drawHero(ctx, this.hero.px, this.hero.py);

    // Draw "!" bubble over adjacent NPC
    this._drawInteractHint(ctx);

    ctx.restore();

    // Critter party display (HUD layer, fixed coords)
    this._drawPartyHUD(ctx);
  }

  _drawTile(ctx, x, y, type) {
    const T = this.TILE;
    switch (type) {
      case CW_TILE.GRASS: {
        ctx.fillStyle = '#5aaa3a';
        ctx.fillRect(x, y, T, T);
        // subtle grass texture — small lighter patches
        ctx.fillStyle = '#6abf48';
        ctx.fillRect(x + 4, y + 4, 6, 4);
        ctx.fillRect(x + T-10, y + T-8, 7, 3);
        break;
      }
      case CW_TILE.PATH: {
        ctx.fillStyle = '#d4a96a';
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#c4956a';
        ctx.fillRect(x + 2, y + 2, T-4, T-4);
        break;
      }
      case CW_TILE.TREE: {
        ctx.fillStyle = '#2d7a1a';
        ctx.fillRect(x, y, T, T);
        // trunk
        ctx.fillStyle = '#6b3a1f';
        ctx.fillRect(x + T/2-4, y + T-12, 8, 12);
        // canopy
        ctx.fillStyle = '#3d9a28';
        ctx.beginPath();
        ctx.arc(x + T/2, y + T/2 - 2, T*0.38, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#4daa38';
        ctx.beginPath();
        ctx.arc(x + T/2 - 6, y + T/2 - 6, T*0.26, 0, Math.PI*2);
        ctx.fill();
        break;
      }
      case CW_TILE.WATER: {
        ctx.fillStyle = '#2d8bc4';
        ctx.fillRect(x, y, T, T);
        // ripple lines
        const wave = (Date.now() / 600) % (Math.PI * 2);
        ctx.strokeStyle = '#5aaadf';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x + T*0.2 + i*T*0.3, y + T/2 + Math.sin(wave + i*1.2)*3, T*0.15, 0, Math.PI);
          ctx.stroke();
        }
        break;
      }
      case CW_TILE.MOUNTAIN: {
        ctx.fillStyle = '#7a6a5a';
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#9a8a7a';
        ctx.beginPath();
        ctx.moveTo(x, y + T);
        ctx.lineTo(x + T/2, y + 4);
        ctx.lineTo(x + T, y + T);
        ctx.fill();
        // snow cap
        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.moveTo(x + T/2, y + 4);
        ctx.lineTo(x + T/2 - 8, y + 16);
        ctx.lineTo(x + T/2 + 8, y + 16);
        ctx.fill();
        break;
      }
      case CW_TILE.BUILDING: {
        ctx.fillStyle = '#c8a06a';
        ctx.fillRect(x, y, T, T);
        // roof
        ctx.fillStyle = '#a83030';
        ctx.beginPath();
        ctx.moveTo(x - 2, y + 14);
        ctx.lineTo(x + T/2, y + 2);
        ctx.lineTo(x + T + 2, y + 14);
        ctx.fill();
        // door
        ctx.fillStyle = '#6b3a1f';
        ctx.fillRect(x + T/2 - 5, y + T - 14, 10, 14);
        // window
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(x + 6, y + 18, 10, 10);
        ctx.fillRect(x + T - 16, y + 18, 10, 10);
        break;
      }
      case CW_TILE.FLOWERS: {
        ctx.fillStyle = '#5aaa3a';
        ctx.fillRect(x, y, T, T);
        const petals = [
          { fx: 0.25, fy: 0.35, c: '#ff88bb' },
          { fx: 0.65, fy: 0.55, c: '#ffdd55' },
          { fx: 0.40, fy: 0.70, c: '#ff6666' },
          { fx: 0.75, fy: 0.30, c: '#cc88ff' },
        ];
        for (const p of petals) {
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(x + T*p.fx, y + T*p.fy, 5, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = '#ffff88';
          ctx.beginPath();
          ctx.arc(x + T*p.fx, y + T*p.fy, 2, 0, Math.PI*2);
          ctx.fill();
        }
        break;
      }
      case CW_TILE.SAND: {
        ctx.fillStyle = '#e8cc80';
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#d4b870';
        ctx.fillRect(x + 3, y + 3, T-6, T-6);
        break;
      }
      default:
        ctx.fillStyle = '#5aaa3a';
        ctx.fillRect(x, y, T, T);
    }
  }

  _drawHero(ctx, px, py) {
    const T = this.TILE;
    const x = px + T/2;
    const y = py + T/2;
    const { dir, frame, stepping } = this.hero;

    // Walk bob
    const bob = stepping ? Math.sin(this.hero.stepT * Math.PI) * 3 : 0;
    const legSwing = stepping ? Math.sin(this.hero.stepT * Math.PI * 2) : 0;

    ctx.save();
    ctx.translate(x, y - bob);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, T*0.3, T*0.22, T*0.1, 0, 0, Math.PI*2);
    ctx.fill();

    // --- Body (tunic) ---
    ctx.fillStyle = '#3a6abf';
    this._roundRect(ctx, -10, -8, 20, 20, 5);
    ctx.fill();

    // --- Legs ---
    ctx.fillStyle = '#8b6914';
    const lLeg = legSwing * 5;
    const rLeg = -legSwing * 5;
    // left leg
    ctx.save();
    ctx.translate(-5, 10);
    ctx.rotate((lLeg * Math.PI) / 180);
    ctx.fillRect(-3, 0, 6, 12);
    // boot
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-4, 10, 8, 4);
    ctx.restore();
    // right leg
    ctx.save();
    ctx.fillStyle = '#8b6914';
    ctx.translate(5, 10);
    ctx.rotate((rLeg * Math.PI) / 180);
    ctx.fillRect(-3, 0, 6, 12);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-4, 10, 8, 4);
    ctx.restore();

    // --- Arms ---
    ctx.fillStyle = '#f5c89a';
    const armSwing = legSwing * 8;
    // left arm
    ctx.save();
    ctx.translate(-10, -2);
    ctx.rotate((-armSwing * Math.PI) / 180);
    ctx.fillRect(-4, 0, 8, 14);
    ctx.restore();
    // right arm
    ctx.save();
    ctx.translate(10, -2);
    ctx.rotate((armSwing * Math.PI) / 180);
    ctx.fillRect(-4, 0, 8, 14);
    ctx.restore();

    // --- Head ---
    ctx.fillStyle = '#f5c89a';
    ctx.beginPath();
    ctx.ellipse(0, -18, 12, 14, 0, 0, Math.PI*2);
    ctx.fill();

    // --- Hair (direction-dependent) ---
    ctx.fillStyle = '#5a3210';
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(-11, -29, 22, 10);
      ctx.beginPath();
      ctx.arc(0, -28, 11, Math.PI, 0);
      ctx.fill();
    } else {
      // side view — hair bun
      ctx.beginPath();
      ctx.arc(dir === 'right' ? -2 : 2, -28, 10, Math.PI, 0);
      ctx.fill();
    }

    // --- Eyes ---
    if (dir !== 'up') {
      ctx.fillStyle = '#1a1a2a';
      const eyeY = -18;
      if (dir === 'left') {
        ctx.beginPath();
        ctx.arc(-5, eyeY, 3, 0, Math.PI*2);
        ctx.fill();
      } else if (dir === 'right') {
        ctx.beginPath();
        ctx.arc(5, eyeY, 3, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(-4, eyeY, 2.5, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, eyeY, 2.5, 0, Math.PI*2);
        ctx.fill();
        // smile
        ctx.strokeStyle = '#c07050';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -14, 5, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }

    // --- Backpack (visible from back) ---
    if (dir === 'up') {
      ctx.fillStyle = '#8b3030';
      ctx.fillRect(-8, -10, 16, 18);
      ctx.fillStyle = '#aa4040';
      ctx.fillRect(-6, -8, 12, 5);
    }

    ctx.restore();
  }

  _drawNPC(ctx, px, py, npc) {
    const T = this.TILE;
    const x = px + T/2;
    const y = py + T/2;

    // Idle bob
    const bob = Math.sin(Date.now() / 600 + npc.tileX * 0.7) * 2.5;

    ctx.save();
    ctx.translate(x, y - bob);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, T*0.25, T*0.22, T*0.08, 0, 0, Math.PI*2);
    ctx.fill();

    switch (npc.id) {
      case 'bunny': this._drawBunny(ctx, npc); break;
      case 'frog':  this._drawFrog(ctx, npc);  break;
      case 'bear':  this._drawBear(ctx, npc);  break;
    }

    // Joined star badge
    if (npc.joined) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐', 0, -T*0.48);
    }

    ctx.restore();
  }

  _drawBunny(ctx, npc) {
    const { color, earColor } = npc;
    // Ears
    ctx.fillStyle = earColor;
    ctx.beginPath();
    ctx.ellipse(-8, -36, 5, 14, -0.2, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -36, 5, 14, 0.2, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ffc0cb';
    ctx.beginPath();
    ctx.ellipse(-8, -36, 2.5, 10, -0.2, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -36, 2.5, 10, 0.2, 0, Math.PI*2);
    ctx.fill();
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 17, 0, 0, Math.PI*2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(0, -18, 13, 0, Math.PI*2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-4, -19, 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, -19, 2.5, 0, Math.PI*2);
    ctx.fill();
    // Nose
    ctx.fillStyle = '#ff88aa';
    ctx.beginPath();
    ctx.arc(0, -15, 2, 0, Math.PI*2);
    ctx.fill();
    // Tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(13, 8, 6, 0, Math.PI*2);
    ctx.fill();
  }

  _drawFrog(ctx, npc) {
    const { color, earColor } = npc;
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 6, 16, 14, 0, 0, Math.PI*2);
    ctx.fill();
    // Head (wider)
    ctx.beginPath();
    ctx.ellipse(0, -12, 15, 12, 0, 0, Math.PI*2);
    ctx.fill();
    // Eye bumps
    ctx.fillStyle = earColor;
    ctx.beginPath();
    ctx.arc(-9, -20, 7, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, -20, 7, 0, Math.PI*2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-9, -21, 3.5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, -21, 3.5, 0, Math.PI*2);
    ctx.fill();
    // Mouth — big wide smile
    ctx.strokeStyle = earColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -8, 10, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // Belly
    ctx.fillStyle = '#a0e090';
    ctx.beginPath();
    ctx.ellipse(0, 8, 10, 9, 0, 0, Math.PI*2);
    ctx.fill();
    // Feet
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-14, 16, 8, 5, -0.4, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(14, 16, 8, 5, 0.4, 0, Math.PI*2);
    ctx.fill();
  }

  _drawBear(ctx, npc) {
    const { color, earColor } = npc;
    // Ears
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-11, -32, 7, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11, -32, 7, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = earColor;
    ctx.beginPath();
    ctx.arc(-11, -32, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11, -32, 4, 0, Math.PI*2);
    ctx.fill();
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 8, 16, 18, 0, 0, Math.PI*2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(0, -18, 15, 0, Math.PI*2);
    ctx.fill();
    // Snout
    ctx.fillStyle = earColor;
    ctx.beginPath();
    ctx.ellipse(0, -14, 7, 5, 0, 0, Math.PI*2);
    ctx.fill();
    // Nose
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(0, -16, 3, 2, 0, 0, Math.PI*2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-6, -22, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -22, 3, 0, Math.PI*2);
    ctx.fill();
    // Belly patch
    ctx.fillStyle = '#e8b86d';
    ctx.beginPath();
    ctx.ellipse(0, 10, 10, 12, 0, 0, Math.PI*2);
    ctx.fill();
  }

  _drawInteractHint(ctx) {
    // Show "!" bubble over adjacent NPC that hasn't joined
    const { tileX, tileY } = this.hero;
    const adj = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dy, dx] of adj) {
      const npc = this.npcs.find(n => n.tileX === tileX + dx && n.tileY === tileY + dy && !n.joined);
      if (npc) {
        const bx = npc.tileX * this.TILE + this.TILE/2;
        const by = npc.tileY * this.TILE - 4;
        // bubble
        ctx.fillStyle = '#fffde0';
        ctx.strokeStyle = '#f0a020';
        ctx.lineWidth = 2;
        this._roundRect(ctx, bx - 14, by - 28, 28, 24, 8);
        ctx.fill();
        ctx.stroke();
        // tail
        ctx.beginPath();
        ctx.moveTo(bx - 6, by - 4);
        ctx.lineTo(bx, by + 2);
        ctx.lineTo(bx + 6, by - 4);
        ctx.fill();
        // !
        ctx.fillStyle = '#e05000';
        ctx.font = 'bold 18px Fredoka One, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', bx, by - 16);
        break;
      }
    }
  }

  _drawPartyHUD(ctx) {
    if (this.critterCount === 0) return;
    const cx = this.canvas.width - 16;
    const cy = 70;
    ctx.font = 'bold 14px Fredoka One, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.shadowColor = '#0008';
    ctx.shadowBlur = 4;
    ctx.fillText(`Friends: ${this.critterCount}/${CW_NPCS.length}`, cx, cy);
    ctx.shadowBlur = 0;
  }

  // ==============================
  //  CAMERA
  // ==============================

  _clampCam() {
    const { canvas, TILE } = this;
    const worldW = CW_COLS * TILE;
    const worldH = CW_ROWS * TILE;

    // Center on hero pixel pos
    let cx = this.hero.px + TILE/2 - canvas.width/2;
    let cy = this.hero.py + TILE/2 - canvas.height/2;

    // Clamp
    cx = Math.max(0, Math.min(cx, worldW - canvas.width));
    cy = Math.max(0, Math.min(cy, worldH - canvas.height));

    this.cam.x = cx;
    this.cam.y = cy;
  }

  // ==============================
  //  UI (D-pad + Dialogue)
  // ==============================

  _buildUI() {
    this._removeUI(); // clean slate

    // ---- D-pad ----
    const dpad = document.createElement('div');
    dpad.id = 'cq-dpad';
    dpad.innerHTML = `
      <button class="cq-btn cq-up"    data-dir="up">▲</button>
      <button class="cq-btn cq-left"  data-dir="left">◀</button>
      <button class="cq-btn cq-ok"    data-dir="ok">●</button>
      <button class="cq-btn cq-right" data-dir="right">▶</button>
      <button class="cq-btn cq-down"  data-dir="down">▼</button>
    `;
    dpad.style.cssText = `
      position:fixed; bottom:24px; left:50%;
      transform:translateX(-50%);
      display:grid;
      grid-template-areas: ". up ." "left ok right" ". down .";
      grid-template-columns: 56px 56px 56px;
      grid-template-rows:    56px 56px 56px;
      gap:4px;
      z-index:9000;
      user-select:none;
    `;
    const btnBase = `
      border:none; border-radius:12px;
      background:rgba(0,0,0,0.55); color:#fff;
      font-size:22px; cursor:pointer;
      touch-action:none;
      -webkit-tap-highlight-color:transparent;
      transition:background 0.1s;
    `;
    dpad.querySelectorAll('.cq-btn').forEach(btn => {
      btn.style.cssText = btnBase;
      const area = btn.classList[1].replace('cq-','');
      btn.style.gridArea = area;
    });

    // Touch/pointer events for D-pad
    const setDir = (btn, active) => {
      const dir = btn.dataset.dir;
      if (dir === 'ok') {
        if (active) this._padInteract = true;
        return;
      }
      this.dpadActive = active ? dir : null;
      btn.style.background = active ? 'rgba(255,200,0,0.7)' : 'rgba(0,0,0,0.55)';
    };

    dpad.querySelectorAll('.cq-btn').forEach(btn => {
      btn.addEventListener('pointerdown',  (e) => { e.preventDefault(); setDir(btn, true);  });
      btn.addEventListener('pointerup',    (e) => { e.preventDefault(); setDir(btn, false); });
      btn.addEventListener('pointerleave', (e) => { e.preventDefault(); setDir(btn, false); });
    });

    document.body.appendChild(dpad);
    this._dpadEl = dpad;

    // ---- Dialogue box ----
    const dlg = document.createElement('div');
    dlg.id = 'cq-dialogue';
    dlg.style.cssText = `
      position:fixed; bottom:200px; left:50%;
      transform:translateX(-50%);
      width:min(500px, 92vw);
      background:rgba(255,253,235,0.97);
      border:3px solid #c8902a;
      border-radius:18px;
      padding:18px 22px 14px;
      display:none;
      flex-direction:column;
      gap:10px;
      z-index:9001;
      box-shadow:0 4px 24px rgba(0,0,0,0.4);
      font-family:'Fredoka One', 'Nunito', sans-serif;
    `;
    dlg.innerHTML = `
      <div class="cq-dlg-name" style="font-size:20px; color:#b06000; font-weight:bold;"></div>
      <div class="cq-dlg-text" style="font-size:17px; color:#3a2800; line-height:1.45;"></div>
      <button class="cq-dlg-btn" style="
        align-self:flex-end;
        background:#f0a020; color:#fff;
        border:none; border-radius:12px;
        padding:10px 24px; font-size:16px;
        font-family:inherit; cursor:pointer;
        font-weight:bold;
      "></button>
    `;
    dlg.querySelector('.cq-dlg-btn').addEventListener('click', () => this._advanceDialogue());
    document.body.appendChild(dlg);
    this._dialogueEl = dlg;
  }

  _removeUI() {
    document.getElementById('cq-dpad')?.remove();
    document.getElementById('cq-dialogue')?.remove();
    this._dpadEl     = null;
    this._dialogueEl = null;
  }

  // ==============================
  //  HELPERS
  // ==============================

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    // Scale tile to fit more of the screen on small devices
    this.TILE = Math.max(40, Math.min(56, Math.floor(window.innerHeight / CW_ROWS)));
    this._snapHeroToPx();
    this._clampCam();
  }

  _snapHeroToPx() {
    this.hero.px = this.hero.tileX * this.TILE;
    this.hero.py = this.hero.tileY * this.TILE;
  }

  _lerp(a, b, t) { return a + (b - a) * t; }

  _roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }
}
