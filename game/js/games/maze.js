// ===== MAZE GAME =====
// Navigate a hero through a Bible-themed maze.
// Controls: arrow keys / WASD, on-screen D-pad (tap), or camera hand-position zones.

class MazeGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx    = ctx;
    this.onComplete = onComplete;
    this.level  = 0;
    this.running = false;

    // Hero grid position
    this.heroRow = 0;
    this.heroCol = 0;

    // Smooth pixel position for animation
    this.heroPixelX  = 0;
    this.heroPixelY  = 0;
    this.moving      = false;
    this.moveProgress = 0;

    // Particles
    this.particles = [];

    // Layout (computed in _computeLayout)
    this.cellSize = 60;
    this.offsetX  = 0;
    this.offsetY  = 0;
    this._dpad    = {};   // { N, S, E, W } button rects

    // Camera motion state
    this._motionDir      = null;  // current hand-zone direction ('N'|'S'|'E'|'W'|null)
    this._lastMotionMove = 0;     // timestamp of last motion-triggered move

    // Input handlers (stored so we can remove them later)
    this._keyDown       = (e) => this._handleKey(e);
    this._motionHandler = (x, y, vel) => this._handleMotion(x, y, vel);
    this._onPress = (e) => {
      e.preventDefault();
      const r  = this.canvas.getBoundingClientRect();
      const cx = (e.clientX  ?? e.changedTouches[0].clientX)  - r.left;
      const cy = (e.clientY  ?? e.changedTouches[0].clientY)  - r.top;
      this._handleDpad(cx, cy);
    };

    this._rafId    = null;
    this._lastTime = 0;
    this.maze    = null;
    this.mazeMap = null;
  }

  start(levelIndex = 0) {
    this.level = levelIndex % MAZES.length;
    const theme = MAZES[this.level];

    // Generate a fresh random maze for this theme's size every play
    this.maze    = { ...theme, cells: generateMazeCells(theme.rows, theme.cols) };
    this.mazeMap = buildMazeLookup(this.maze);

    this.running   = true;
    this.particles = [];

    const startCell  = this.maze.cells.find(c => c.start);
    this.heroRow = startCell.r;
    this.heroCol = startCell.c;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._computeLayout();

    this.heroPixelX = this.offsetX + this.heroCol * this.cellSize + this.cellSize / 2;
    this.heroPixelY = this.offsetY + this.heroRow * this.cellSize + this.cellSize / 2;

    document.addEventListener('keydown',           this._keyDown);
    this.canvas.addEventListener('click',           this._onPress);
    this.canvas.addEventListener('touchend',        this._onPress, { passive: false });
    Motion.onMove(this._motionHandler);

    Audio.speak(`Level ${this.level + 1}! ${this.maze.heroPrompt}`, { interrupt: true });
    App.setHUDTitle(this.maze.title);

    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this._computeLayout();
  }

  // Compute maze cell size, offsets, and D-pad button positions to fit the screen.
  _computeLayout() {
    if (!this.maze) return;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Reserve the bottom 28% (min 160px) for the D-pad
    const dpadAreaH = Math.max(160, Math.floor(H * 0.28));
    const mazeAreaH = H - dpadAreaH - 55; // 55px for HUD at top

    this.cellSize = Math.min(
      Math.floor((W * 0.92) / this.maze.cols),
      Math.floor(mazeAreaH       / this.maze.rows)
    );

    const mazeW = this.cellSize * this.maze.cols;
    const mazeH = this.cellSize * this.maze.rows;
    this.offsetX = Math.floor((W - mazeW) / 2);
    this.offsetY = 55 + Math.floor((mazeAreaH - mazeH) / 2);

    // D-pad: four large buttons centred in the reserved bottom area
    const dpadTop  = this.offsetY + mazeH + 8;
    const dpadCX   = Math.floor(W / 2);
    const dpadCY   = dpadTop + Math.floor(dpadAreaH / 2);
    const btnSize  = Math.min(Math.floor(dpadAreaH * 0.38), 68);
    const gap      = Math.max(6, Math.floor(btnSize * 0.18));

    this._dpad = {
      N: { x: dpadCX - Math.floor(btnSize / 2),                      y: dpadCY - btnSize - gap,           w: btnSize, h: btnSize, dir: 'N' },
      S: { x: dpadCX - Math.floor(btnSize / 2),                      y: dpadCY + gap,                     w: btnSize, h: btnSize, dir: 'S' },
      W: { x: dpadCX - Math.floor(btnSize * 1.5) - gap,              y: dpadCY - Math.floor(btnSize / 2), w: btnSize, h: btnSize, dir: 'W' },
      E: { x: dpadCX + Math.floor(btnSize / 2)  + gap,               y: dpadCY - Math.floor(btnSize / 2), w: btnSize, h: btnSize, dir: 'E' },
    };
  }

  stop() {
    this.running = false;
    document.removeEventListener('keydown',  this._keyDown);
    this.canvas.removeEventListener('click',    this._onPress);
    this.canvas.removeEventListener('touchend', this._onPress);
    Motion.offMove(this._motionHandler);
    window.removeEventListener('resize', () => this._resize());
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();
  }

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    if (this.moving) {
      this.moveProgress = Math.min(1, this.moveProgress + dt * 10);
      const targetX = this.offsetX + this.heroCol * this.cellSize + this.cellSize / 2;
      const targetY = this.offsetY + this.heroRow * this.cellSize + this.cellSize / 2;
      this.heroPixelX = lerp(this.heroPixelX, targetX, this.moveProgress);
      this.heroPixelY = lerp(this.heroPixelY, targetY, this.moveProgress);
      if (this.moveProgress >= 1) {
        this.moving      = false;
        this.heroPixelX  = targetX;
        this.heroPixelY  = targetY;
        this._checkGoal();
      }
    }

    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    });
  }

  _tryMove(dir) {
    if (this.moving) return;
    if (!canMove(this.mazeMap, this.heroRow, this.heroCol, dir)) {
      Audio.playWrong();
      return;
    }
    if (dir === 'N') this.heroRow--;
    if (dir === 'S') this.heroRow++;
    if (dir === 'E') this.heroCol++;
    if (dir === 'W') this.heroCol--;
    this.moving      = true;
    this.moveProgress = 0;
    Audio.playStep();
  }

  // ---- Keyboard ----
  _handleKey(e) {
    const map = {
      ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E',
      w: 'N', s: 'S', a: 'W', d: 'E',
      W: 'N', S: 'S', A: 'W', D: 'E',
    };
    if (map[e.key]) { e.preventDefault(); this._tryMove(map[e.key]); }
  }

  // ---- D-pad tap ----
  _handleDpad(x, y) {
    for (const btn of Object.values(this._dpad)) {
      if (x >= btn.x && x <= btn.x + btn.w &&
          y >= btn.y && y <= btn.y + btn.h) {
        this._tryMove(btn.dir);
        return;
      }
    }
  }

  // ---- Voice command direction ----
  handleVoice(cmd) {
    const map = { UP: 'N', DOWN: 'S', LEFT: 'W', RIGHT: 'E' };
    if (map[cmd]) this._tryMove(map[cmd]);
  }

  // ---- Camera / hand-position zone control ----
  // The screen is split into directional zones around the centre.
  // Child holds their hand toward a side → hero walks that way.
  // No swiping required — steady hand position is enough.
  _handleMotion(x, y) {
    const nx = (x / window.innerWidth  - 0.5) * 2; // -1 … +1
    const ny = (y / window.innerHeight - 0.5) * 2;

    // Large dead-zone so a neutral hand position doesn't trigger movement
    const DEAD = 0.38;
    if (Math.abs(nx) < DEAD && Math.abs(ny) < DEAD) {
      this._motionDir = null;
      return;
    }

    // Whichever axis is more extreme wins
    const dir = Math.abs(nx) > Math.abs(ny)
      ? (nx > 0 ? 'E' : 'W')
      : (ny > 0 ? 'S' : 'N');

    this._motionDir = dir;

    // Move at a steady rate — not every frame
    const now = Date.now();
    if (now - this._lastMotionMove >= 330) {
      this._lastMotionMove = now;
      this._tryMove(dir);
    }
  }

  // ---- Goal check ----
  _checkGoal() {
    const cell = this.mazeMap[`${this.heroRow},${this.heroCol}`];
    if (cell && cell.goal) this._celebrate();
  }

  _celebrate() {
    this.running = false;
    Audio.playVictory();

    const goal = this.maze.cells.find(c => c.goal);
    const gx = this.offsetX + goal.c * this.cellSize + this.cellSize / 2;
    const gy = this.offsetY + goal.r * this.cellSize + this.cellSize / 2;
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: gx, y: gy,
        vx: (Math.random() - 0.5) * 400,
        vy: (Math.random() - 1.2) * 300,
        life: 1.5 + Math.random(),
        color: ['#ffd700','#ff6b6b','#6bff6b','#6b6bff','#ff6bff'][Math.floor(Math.random() * 5)],
        size: 6 + Math.random() * 8,
      });
    }

    this.running = true;
    setTimeout(() => {
      this.running = false;
      document.removeEventListener('keydown',  this._keyDown);
      Motion.offMove(this._motionHandler);
      Audio.speak(this.maze.goalText, { interrupt: true });
      App.showOverlay('🎉', this.maze.goalText, 'Claim Your Stars! ⭐', () => {
        this.onComplete();
      });
    }, 1800);
  }

  // ============================================================
  //  RENDERING
  // ============================================================

  _render() {
    const { ctx, canvas, maze, cellSize, offsetX, offsetY } = this;

    // ---- Background ----
    ctx.fillStyle = maze.bgColor || '#1a3a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ---- Floor tiles ----
    maze.cells.forEach(cell => {
      const x = offsetX + cell.c * cellSize;
      const y = offsetY + cell.r * cellSize;

      if (cell.goal) {
        // Pulsing glow under goal
        const grd = ctx.createRadialGradient(
          x + cellSize / 2, y + cellSize / 2, 0,
          x + cellSize / 2, y + cellSize / 2, cellSize * 0.9
        );
        grd.addColorStop(0, '#ffd70055');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(x, y, cellSize, cellSize);
      }

      if (cell.start) {
        ctx.fillStyle = 'rgba(120,220,120,0.18)';
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      }

      ctx.fillStyle = maze.floorColor || '#2a5a2a';
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    });

    // ---- Walls as thick stone blocks ----
    const wallThick = Math.max(4, Math.round(cellSize * 0.14));
    const half      = wallThick / 2;
    ctx.fillStyle   = maze.wallColor || '#8b5e3c';

    maze.cells.forEach(cell => {
      const x = offsetX + cell.c * cellSize;
      const y = offsetY + cell.r * cellSize;
      if (!cell.open.includes('N'))
        ctx.fillRect(x - half, y - half, cellSize + wallThick, wallThick);
      if (!cell.open.includes('S'))
        ctx.fillRect(x - half, y + cellSize - half, cellSize + wallThick, wallThick);
      if (!cell.open.includes('W'))
        ctx.fillRect(x - half, y - half, wallThick, cellSize + wallThick);
      if (!cell.open.includes('E'))
        ctx.fillRect(x + cellSize - half, y - half, wallThick, cellSize + wallThick);
    });

    // Outer border
    ctx.fillStyle = maze.wallColor || '#8b5e3c';
    const bw = wallThick;
    const mx = offsetX, my = offsetY;
    const mw = cellSize * maze.cols, mh = cellSize * maze.rows;
    ctx.fillRect(mx - bw, my - bw, mw + bw * 2, bw);      // top
    ctx.fillRect(mx - bw, my + mh, mw + bw * 2, bw);      // bottom
    ctx.fillRect(mx - bw, my - bw, bw, mh + bw * 2);      // left
    ctx.fillRect(mx + mw, my - bw, bw, mh + bw * 2);      // right

    // ---- Goal emoji ----
    const goalCell = maze.cells.find(c => c.goal);
    if (goalCell) {
      const gx = offsetX + goalCell.c * cellSize + cellSize / 2;
      const gy = offsetY + goalCell.r * cellSize + cellSize / 2;
      const pulse = 1 + Math.sin(Date.now() / 300) * 0.15;
      const gfs   = Math.max(18, cellSize * 0.52);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.scale(pulse, pulse);
      ctx.font         = `${gfs}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(maze.goalArt, 0, 0);
      ctx.restore();
    }

    // ---- Hero ----
    const fs = Math.max(18, cellSize * 0.55);
    // Shadow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(this.heroPixelX, this.heroPixelY + fs * 0.38,
                fs * 0.36, fs * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Sprite
    const bob = this.moving ? Math.sin(this.moveProgress * Math.PI) * 5 : 0;
    ctx.font         = `${fs}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(maze.startArt, this.heroPixelX, this.heroPixelY - bob);

    // ---- D-pad ----
    this._renderDpad();

    // ---- Particles ----
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  _renderDpad() {
    const { ctx } = this;
    const ARROWS  = { N: '▲', S: '▼', W: '◀', E: '▶' };

    for (const [dir, btn] of Object.entries(this._dpad)) {
      const active = this._motionDir === dir;

      // Button background
      ctx.globalAlpha = active ? 0.92 : 0.55;
      ctx.fillStyle   = active ? '#ffd700' : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, btn.w * 0.22);
      ctx.fill();

      // Border
      ctx.globalAlpha  = active ? 1 : 0.65;
      ctx.strokeStyle  = active ? '#ff8c00' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth    = active ? 3 : 2;
      ctx.stroke();

      // Arrow label
      ctx.globalAlpha  = 1;
      ctx.fillStyle    = active ? '#000' : 'rgba(255,255,255,0.85)';
      ctx.font         = `bold ${Math.floor(btn.w * 0.48)}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ARROWS[dir], btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    ctx.globalAlpha = 1;

    // Hint label below D-pad
    const anyBtn = Object.values(this._dpad)[0];
    if (anyBtn) {
      const bottomY = anyBtn.y + anyBtn.h + 14;
      ctx.fillStyle  = 'rgba(255,255,255,0.4)';
      ctx.font       = '13px Nunito, sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText(
        Motion.enabled ? 'Point your hand in a direction to move' : 'Tap arrows or use keyboard',
        this.canvas.width / 2,
        bottomY
      );
    }
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
