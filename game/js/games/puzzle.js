// ===== PICTURE PUZZLE GAME =====
// Drag-and-drop tile puzzle with Bible-themed scenes.
// Scene is drawn in tiles — scrambled from the solved state.
// Child drags each tile to the correct position.
// Very forgiving: tiles snap to the nearest slot; correct slots glow green.
// Calm, no timer, encouraging narration.

class PuzzleGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas  = canvas;
    this.ctx     = ctx;
    this.onComplete = onComplete;

    this.running      = false;
    this.gridSize     = 3; // 3x3 puzzle for easy; 4x4 for hard
    this.puzzleIndex  = 0;

    // Tile state
    this.tiles       = [];  // { id, correctCol, correctRow, currentX, currentY, placed }
    this.cellSize    = 0;
    this.boardX      = 0;
    this.boardY      = 0;
    this.dragging    = null; // tile being dragged
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // Offscreen canvas to draw the complete scene
    this.sceneCanvas = null;
    this.sceneCtx    = null;

    this.placedCount = 0;
    this.solved      = false;
    this.particles   = [];

    // Input
    this._onMouseDown = (e) => this._startDrag(e.clientX, e.clientY);
    this._onMouseMove = (e) => this._moveDrag(e.clientX, e.clientY);
    this._onMouseUp   = (e) => this._endDrag(e.clientX, e.clientY);
    this._onTouchStart= (e) => { e.preventDefault(); this._startDrag(e.touches[0].clientX, e.touches[0].clientY); };
    this._onTouchMove = (e) => { e.preventDefault(); this._moveDrag(e.touches[0].clientX, e.touches[0].clientY); };
    this._onTouchEnd  = (e) => { e.preventDefault(); this._endDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY); };

    // Camera: motion moves the dragged tile; pinch-click toggles pick-up/drop
    this._motionMoveHandler = (x, y) => {
      if (!this.dragging) return;
      const { x: cx, y: cy } = this._screenToCanvas(x, y);
      this.dragging.currentX = cx;
      this.dragging.currentY = cy;
    };
    this._motionTapHandler = (x, y) => {
      if (this.dragging) {
        // Drop the tile at current position
        this._endDrag(x, y);
      } else {
        // Pick up a tile
        this._startDrag(x, y);
      }
    };

    this._rafId    = null;
    this._lastTime = 0;
  }

  start(puzzleIndex = 0) {
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.puzzleIndex = puzzleIndex % PUZZLE_SCENES.length;
    this.solved      = false;
    this.particles   = [];
    this.running     = true;

    // Difficulty: easy = 3x3, medium/hard = 4x4
    this.gridSize = App.difficulty === 'easy' ? 3 : 4;

    this._buildPuzzle();

    this.canvas.addEventListener('mousedown',  this._onMouseDown);
    this.canvas.addEventListener('mousemove',  this._onMouseMove);
    this.canvas.addEventListener('mouseup',    this._onMouseUp);
    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    this.canvas.addEventListener('touchend',   this._onTouchEnd,   { passive: false });
    Motion.onMove(this._motionMoveHandler);
    Motion.onTap(this._motionTapHandler);

    App.setHUDTitle(`🧩 ${PUZZLE_SCENES[this.puzzleIndex].title}`);
    App.updateHUDScore('');
    App.updateHUDHearts('');

    const scene = PUZZLE_SCENES[this.puzzleIndex];
    Audio.speak(`Let's build the puzzle of ${scene.title}! Drag the pieces to where they belong!`, { rate: 0.85, interrupt: true });

    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('mousedown',  this._onMouseDown);
    this.canvas.removeEventListener('mousemove',  this._onMouseMove);
    this.canvas.removeEventListener('mouseup',    this._onMouseUp);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove',  this._onTouchMove);
    this.canvas.removeEventListener('touchend',   this._onTouchEnd);
    Motion.offMove(this._motionMoveHandler);
    Motion.offTap(this._motionTapHandler);
    window.removeEventListener('resize', () => {});
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();
  }

  _buildPuzzle() {
    const { canvas, gridSize } = this;
    const hudH = 70; // space for HUD at top

    // Board dimensions — cap at 45% of canvas height so the tray tiles
    // always have room below without going off-screen
    const boardMax   = Math.min(canvas.width * 0.88, canvas.height * 0.45);
    this.cellSize    = Math.floor(boardMax / gridSize);
    const boardW     = this.cellSize * gridSize;
    const boardH     = this.cellSize * gridSize;

    // Center board in top portion
    this.boardX = (canvas.width  - boardW) / 2;
    this.boardY = hudH + 12;

    // Tray area (bottom) where scattered tiles live
    const trayY = this.boardY + boardH + 28;
    const trayH = canvas.height - trayY - 12;

    // Build offscreen scene canvas
    this.sceneCanvas = document.createElement('canvas');
    this.sceneCanvas.width  = boardW;
    this.sceneCanvas.height = boardH;
    this.sceneCtx = this.sceneCanvas.getContext('2d');
    this._drawScene(this.sceneCtx, boardW, boardH);

    // Create tiles
    const total = gridSize * gridSize;
    this.tiles = [];
    this.placedCount = 0;

    // Scatter tiles in tray — arrange in a grid within the tray.
    // Use as many columns as fit so tray rows stay within available height.
    const trayCols = Math.min(total, Math.max(1, Math.floor(canvas.width / (this.cellSize + 12))));
    const trayRows = Math.ceil(total / trayCols);
    // If rows still overflow, shrink tile display (they still snap normally)
    const rowPitch = trayRows > 1 ? Math.min(this.cellSize + 10, Math.floor(trayH / trayRows)) : this.cellSize + 10;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const id  = row * gridSize + col;
        const tc  = id % trayCols;
        const tr  = Math.floor(id / trayCols);
        const tx  = (canvas.width - trayCols * (this.cellSize + 10)) / 2 + tc * (this.cellSize + 10) + this.cellSize / 2;
        const ty  = trayY + tr * rowPitch + this.cellSize / 2;

        this.tiles.push({
          id,
          correctRow: row,
          correctCol: col,
          currentX: tx,
          currentY: ty,
          placed: false,
          justPlaced: false
        });
      }
    }

    // Shuffle tile order (so they don't look grid-ordered in tray)
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = { ...this.tiles[i] };
      // Swap positions only
      [this.tiles[i].currentX, this.tiles[j].currentX] = [this.tiles[j].currentX, this.tiles[i].currentX];
      [this.tiles[i].currentY, this.tiles[j].currentY] = [this.tiles[j].currentY, this.tiles[i].currentY];
    }
  }

  _drawScene(targetCtx, W, H) {
    const scene = PUZZLE_SCENES[this.puzzleIndex];
    scene.draw(targetCtx, W, H);
  }

  // ---- INPUT ----

  _screenToCanvas(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this.canvas.width  / r.width),
      y: (cy - r.top)  * (this.canvas.height / r.height)
    };
  }

  _startDrag(cx, cy) {
    const { x, y } = this._screenToCanvas(cx, cy);
    // Find topmost tile under cursor (search in reverse so top tile wins)
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const t  = this.tiles[i];
      const hs = this.cellSize / 2;
      if (Math.abs(x - t.currentX) < hs && Math.abs(y - t.currentY) < hs) {
        // If tile is placed, allow re-picking
        if (t.placed) {
          t.placed = false;
          this.placedCount = Math.max(0, this.placedCount - 1);
        }
        this.dragging    = t;
        this.dragOffsetX = t.currentX - x;
        this.dragOffsetY = t.currentY - y;
        // Bring to front
        this.tiles.splice(i, 1);
        this.tiles.push(t);
        Audio.playCoin();
        break;
      }
    }
  }

  _moveDrag(cx, cy) {
    if (!this.dragging) return;
    const { x, y } = this._screenToCanvas(cx, cy);
    this.dragging.currentX = x + this.dragOffsetX;
    this.dragging.currentY = y + this.dragOffsetY;
  }

  _endDrag(cx, cy) {
    if (!this.dragging) return;
    const tile = this.dragging;
    this.dragging = null;

    // Find nearest board slot
    const { boardX, boardY, cellSize, gridSize } = this;
    const snapRadius = cellSize * 0.65;

    let bestSlot = null, bestDist = Infinity;
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Skip slots already occupied by placed tiles (other than this one)
        const occupied = this.tiles.some(
          t => t !== tile && t.placed && t.correctRow === row && t.correctCol === col
        );
        if (occupied) continue;

        const slotX = boardX + col * cellSize + cellSize / 2;
        const slotY = boardY + row * cellSize + cellSize / 2;
        const dist  = Math.hypot(tile.currentX - slotX, tile.currentY - slotY);
        if (dist < snapRadius && dist < bestDist) {
          bestDist = dist;
          bestSlot = { row, col, x: slotX, y: slotY };
        }
      }
    }

    if (bestSlot) {
      // Snap to slot
      tile.currentX = bestSlot.x;
      tile.currentY = bestSlot.y;

      const correct = bestSlot.row === tile.correctRow && bestSlot.col === tile.correctCol;
      if (correct) {
        tile.placed      = true;
        tile.justPlaced  = true;
        this.placedCount++;
        Audio.playSuccess();
        setTimeout(() => { if (tile) tile.justPlaced = false; }, 600);

        if (this.placedCount >= gridSize * gridSize) {
          this._solvePuzzle();
        }
      } else {
        // Wrong slot — gentle cue, keep tile there (parent can move it)
        tile.placed = false;
        Audio.playPop();
      }
    }
    // If not near a slot, tile just stays where dropped (in tray region)
  }

  // ---- SOLVE ----

  _solvePuzzle() {
    this.solved = true;
    Audio.playVictory();
    Audio.speak(`Wonderful! You finished the puzzle! That's ${PUZZLE_SCENES[this.puzzleIndex].title}! Amazing work, ${App.heroName}!`, { interrupt: true });

    // Particle burst
    const cx = this.boardX + (this.cellSize * this.gridSize) / 2;
    const cy = this.boardY + (this.cellSize * this.gridSize) / 2;
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 300;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        color: ['#ffd700','#fff','#7b3fc4','#4fc3f7','#a5d6a7'][Math.floor(Math.random() * 5)],
        life: 1.0 + Math.random() * 1.0,
        size: 6 + Math.random() * 10
      });
    }

    setTimeout(() => {
      App.showOverlay('🧩', 'Puzzle Complete!', 'Claim Stars! ⭐', () => {
        this.onComplete(3);
      });
    }, 2200);
  }

  // ---- GAME LOOP ----

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 250 * dt;
      p.life -= dt;
    });
  }

  // ---- RENDER ----

  _render() {
    const { ctx, canvas, tiles, gridSize, cellSize, boardX, boardY } = this;
    const boardW = cellSize * gridSize;
    const boardH = cellSize * gridSize;

    // Background
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ---- Board area (grid outline + shadow for empty slots) ----
    ctx.fillStyle = 'rgba(139,94,60,0.08)';
    ctx.beginPath();
    ctx.roundRect(boardX - 4, boardY - 4, boardW + 8, boardH + 8, 8);
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Empty slot previews — show faint version of correct tile
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const occupied = tiles.some(t => t.placed && t.correctRow === row && t.correctCol === col);
        if (!occupied) {
          const sx = boardX + col * cellSize;
          const sy = boardY + row * cellSize;
          // Faint image hint in slot
          ctx.globalAlpha = 0.18;
          ctx.drawImage(
            this.sceneCanvas,
            col * cellSize, row * cellSize, cellSize, cellSize,
            sx, sy, cellSize, cellSize
          );
          ctx.globalAlpha = 1;
          // Slot border
          ctx.strokeStyle = 'rgba(139,94,60,0.3)';
          ctx.lineWidth   = 1;
          ctx.strokeRect(sx, sy, cellSize, cellSize);
        }
      }
    }

    // ---- Tray area label ----
    ctx.fillStyle = 'rgba(139,94,60,0.5)';
    ctx.font = `bold ${Math.min(14, canvas.width / 50)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Drag pieces to the board ⬆️', canvas.width / 2, boardY + boardH + 22);

    // ---- Progress bar ----
    const total = gridSize * gridSize;
    const pct   = this.placedCount / total;
    ctx.fillStyle = 'rgba(139,94,60,0.15)';
    ctx.fillRect(boardX, boardY - 20, boardW, 8);
    ctx.fillStyle = '#7b3fc4';
    ctx.fillRect(boardX, boardY - 20, boardW * pct, 8);

    // ---- Tiles ----
    // Draw placed tiles on board first, then unplaced/dragged on top
    const placed   = tiles.filter(t => t.placed);
    const unplaced = tiles.filter(t => !t.placed);

    [...placed, ...unplaced].forEach(tile => {
      this._renderTile(tile);
    });

    // ---- Particles ----
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _renderTile(tile) {
    const { ctx, cellSize, sceneCanvas } = this;
    const hs  = cellSize / 2;
    const tx  = tile.currentX - hs;
    const ty  = tile.currentY - hs;
    const isDragging = tile === this.dragging;

    ctx.save();

    // Shadow
    ctx.shadowColor  = isDragging ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)';
    ctx.shadowBlur   = isDragging ? 18 : 6;
    ctx.shadowOffsetY = isDragging ? 8 : 3;

    // Scale up slightly when dragging
    if (isDragging) {
      ctx.translate(tile.currentX, tile.currentY);
      ctx.scale(1.08, 1.08);
      ctx.translate(-tile.currentX, -tile.currentY);
    }

    // Clip to tile rectangle
    ctx.beginPath();
    ctx.roundRect(tx, ty, cellSize, cellSize, 4);
    ctx.clip();

    // Draw the correct portion of the scene image
    ctx.drawImage(
      sceneCanvas,
      tile.correctCol * cellSize, tile.correctRow * cellSize, cellSize, cellSize,
      tx, ty, cellSize, cellSize
    );

    // Correct placement glow
    if (tile.placed) {
      ctx.fillStyle = 'rgba(67,160,71,0.25)';
      ctx.fillRect(tx, ty, cellSize, cellSize);
    }

    // Just-placed flash
    if (tile.justPlaced) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(tx, ty, cellSize, cellSize);
    }

    ctx.restore();

    // Tile border
    ctx.strokeStyle = tile.placed ? '#43a047' : (isDragging ? '#7b3fc4' : '#8b5e3c');
    ctx.lineWidth   = tile.placed ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(tx, ty, cellSize, cellSize, 4);
    ctx.stroke();
  }
}

// ===== PUZZLE SCENES =====
// draw(ctx, W, H) — draws the complete scene into a W×H canvas
// These are the same scenes as coloring but rendered with fills for better puzzle visuals

const PUZZLE_SCENES = [
  {
    id: 'noahs_ark',
    title: "Noah's Ark",
    draw(ctx, W, H) {
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      sky.addColorStop(0, '#87ceeb');
      sky.addColorStop(1, '#c8e6ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.6);

      // Rainbow
      const angles = [
        { r: W * 0.45, color: '#ef5350', lw: W * 0.025 },
        { r: W * 0.4,  color: '#ff9800', lw: W * 0.022 },
        { r: W * 0.35, color: '#ffeb3b', lw: W * 0.022 },
        { r: W * 0.3,  color: '#4caf50', lw: W * 0.022 },
        { r: W * 0.25, color: '#2196f3', lw: W * 0.022 },
      ];
      angles.forEach(arc => {
        ctx.strokeStyle = arc.color;
        ctx.lineWidth   = arc.lw;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.65, arc.r, Math.PI, 0);
        ctx.stroke();
      });

      // Sun
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(W * 0.85, H * 0.12, W * 0.08, 0, Math.PI * 2);
      ctx.fill();
      // Sun rays
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = W * 0.015;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(W * 0.85 + Math.cos(angle) * W * 0.1, H * 0.12 + Math.sin(angle) * W * 0.1);
        ctx.lineTo(W * 0.85 + Math.cos(angle) * W * 0.14, H * 0.12 + Math.sin(angle) * W * 0.14);
        ctx.stroke();
      }

      // Cloud
      ctx.fillStyle = 'white';
      [[0.2, 0.15, 0.12], [0.14, 0.18, 0.09], [0.28, 0.17, 0.09]].forEach(([cx, cy, r]) => {
        ctx.beginPath();
        ctx.arc(W * cx, H * cy, W * r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Water
      const water = ctx.createLinearGradient(0, H * 0.6, 0, H);
      water.addColorStop(0, '#42a5f5');
      water.addColorStop(1, '#1565c0');
      ctx.fillStyle = water;
      ctx.fillRect(0, H * 0.6, W, H * 0.4);
      // Wave ripples
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = W * 0.015;
      for (let wy = H * 0.65; wy < H; wy += H * 0.08) {
        ctx.beginPath();
        for (let wx = 0; wx <= W; wx += W * 0.15) {
          ctx.quadraticCurveTo(wx + W * 0.04, wy - H * 0.02, wx + W * 0.08, wy);
        }
        ctx.stroke();
      }

      // Ark hull
      ctx.fillStyle = '#8b5e3c';
      ctx.beginPath();
      ctx.moveTo(W * 0.1, H * 0.62);
      ctx.lineTo(W * 0.9, H * 0.62);
      ctx.lineTo(W * 0.88, H * 0.52);
      ctx.lineTo(W * 0.12, H * 0.52);
      ctx.closePath();
      ctx.fill();

      // Ark cabin
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(W * 0.2, H * 0.38, W * 0.6, H * 0.14);

      // Ark roof
      ctx.fillStyle = '#5d4037';
      ctx.beginPath();
      ctx.moveTo(W * 0.18, H * 0.38);
      ctx.lineTo(W * 0.5, H * 0.28);
      ctx.lineTo(W * 0.82, H * 0.38);
      ctx.closePath();
      ctx.fill();

      // Window
      ctx.fillStyle = '#ffe082';
      ctx.fillRect(W * 0.45, H * 0.42, W * 0.1, H * 0.06);

      // Giraffe peeking out
      ctx.fillStyle = '#f4a460';
      ctx.fillRect(W * 0.55, H * 0.2, W * 0.04, H * 0.18);
      ctx.beginPath();
      ctx.arc(W * 0.57, H * 0.19, W * 0.04, 0, Math.PI * 2);
      ctx.fill();

      // Dove
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.ellipse(W * 0.35, H * 0.32, W * 0.05, H * 0.03, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd700'; // beak
      ctx.beginPath();
      ctx.moveTo(W * 0.3, H * 0.32);
      ctx.lineTo(W * 0.27, H * 0.33);
      ctx.lineTo(W * 0.3, H * 0.34);
      ctx.fill();

      // Outline
      ctx.strokeStyle = '#3a2a10';
      ctx.lineWidth = W * 0.008;
      ctx.strokeRect(W * 0.1, H * 0.52, W * 0.8, H * 0.1);
      ctx.strokeRect(W * 0.2, H * 0.38, W * 0.6, H * 0.14);
    }
  },

  {
    id: 'david_goliath',
    title: 'David and the Giant',
    draw(ctx, W, H) {
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, '#87ceeb');
      sky.addColorStop(1, '#e3f2fd');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.55);

      // Sun
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(W * 0.8, H * 0.12, W * 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Hills
      ctx.fillStyle = '#81c784';
      ctx.beginPath();
      ctx.moveTo(0, H * 0.55);
      ctx.quadraticCurveTo(W * 0.25, H * 0.35, W * 0.5, H * 0.45);
      ctx.quadraticCurveTo(W * 0.75, H * 0.3, W, H * 0.42);
      ctx.lineTo(W, H * 0.55);
      ctx.closePath();
      ctx.fill();

      // Ground
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      ctx.fillStyle = '#a5896b';
      ctx.fillRect(0, H * 0.55, W, H * 0.08);

      // Stones on ground
      ctx.fillStyle = '#9e9e9e';
      [[0.15,0.6],[0.22,0.63],[0.3,0.59],[0.38,0.62]].forEach(([x,y]) => {
        ctx.beginPath();
        ctx.ellipse(W*x, H*y, W*0.025, H*0.015, 0, 0, Math.PI*2);
        ctx.fill();
      });

      // GOLIATH (big, right side)
      // Legs
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(W * 0.67, H * 0.62, W * 0.06, H * 0.3);
      ctx.fillRect(W * 0.76, H * 0.62, W * 0.06, H * 0.3);
      // Body
      ctx.fillStyle = '#78909c';  // armor
      ctx.fillRect(W * 0.63, H * 0.38, W * 0.22, H * 0.26);
      // Head
      ctx.fillStyle = '#f4a460';
      ctx.beginPath();
      ctx.arc(W * 0.74, H * 0.32, W * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // Helmet
      ctx.fillStyle = '#b0bec5';
      ctx.beginPath();
      ctx.arc(W * 0.74, H * 0.29, W * 0.075, Math.PI, 0);
      ctx.fill();
      // Sword
      ctx.strokeStyle = '#b0bec5';
      ctx.lineWidth = W * 0.025;
      ctx.beginPath();
      ctx.moveTo(W * 0.85, H * 0.38);
      ctx.lineTo(W * 0.9, H * 0.78);
      ctx.stroke();
      // Arm holding sword
      ctx.strokeStyle = '#78909c';
      ctx.lineWidth = W * 0.04;
      ctx.beginPath();
      ctx.moveTo(W * 0.83, H * 0.45);
      ctx.lineTo(W * 0.86, H * 0.52);
      ctx.stroke();

      // DAVID (small, left side)
      // Legs
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(W * 0.18, H * 0.72, W * 0.035, H * 0.2);
      ctx.fillRect(W * 0.24, H * 0.72, W * 0.035, H * 0.2);
      // Body / tunic
      ctx.fillStyle = '#ce93d8';
      ctx.fillRect(W * 0.15, H * 0.6, W * 0.14, H * 0.14);
      // Head
      ctx.fillStyle = '#f4a460';
      ctx.beginPath();
      ctx.arc(W * 0.22, H * 0.55, W * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath();
      ctx.arc(W * 0.22, H * 0.52, W * 0.042, Math.PI, 0);
      ctx.fill();
      // Sling arm
      ctx.strokeStyle = '#f4a460';
      ctx.lineWidth = W * 0.02;
      ctx.beginPath();
      ctx.moveTo(W * 0.15, H * 0.65);
      ctx.lineTo(W * 0.08, H * 0.6);
      ctx.stroke();
      // Sling string
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = W * 0.006;
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H * 0.6);
      ctx.lineTo(W * 0.04, H * 0.55);
      ctx.stroke();
      // Stone
      ctx.fillStyle = '#9e9e9e';
      ctx.beginPath();
      ctx.arc(W * 0.04, H * 0.54, W * 0.02, 0, Math.PI * 2);
      ctx.fill();

      // Stars / sparkles around David
      ctx.fillStyle = '#ffd700';
      [[0.1,0.48],[0.28,0.5],[0.12,0.56]].forEach(([x,y]) => {
        ctx.font = `${W * 0.03}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('✨', W*x, H*y);
      });
    }
  },

  {
    id: 'creation',
    title: 'God Makes the World',
    draw(ctx, W, H) {
      // Left half — night sky
      const nightGrd = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      nightGrd.addColorStop(0, '#0d1b4a');
      nightGrd.addColorStop(1, '#1a237e');
      ctx.fillStyle = nightGrd;
      ctx.fillRect(0, 0, W / 2, H * 0.5);

      // Right half — day sky
      const dayGrd = ctx.createLinearGradient(W / 2, 0, W / 2, H * 0.5);
      dayGrd.addColorStop(0, '#87ceeb');
      dayGrd.addColorStop(1, '#c8e6ff');
      ctx.fillStyle = dayGrd;
      ctx.fillRect(W / 2, 0, W / 2, H * 0.5);

      // Dividing light beam
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth   = W * 0.012;
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H * 0.5);
      ctx.stroke();

      // Moon and stars (night side)
      ctx.fillStyle = '#fff9c4';
      ctx.beginPath();
      ctx.arc(W * 0.15, H * 0.12, W * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a237e'; // bite out of moon
      ctx.beginPath();
      ctx.arc(W * 0.19, H * 0.11, W * 0.048, 0, Math.PI * 2);
      ctx.fill();
      // Stars
      ctx.fillStyle = 'white';
      [[0.05,0.08],[0.28,0.04],[0.35,0.2],[0.1,0.28],[0.38,0.3],[0.22,0.35]].forEach(([x,y]) => {
        ctx.font = `${W * 0.025}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('★', W*x, H*y);
      });

      // Sun (day side)
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.14, W * 0.09, 0, Math.PI * 2);
      ctx.fill();
      // Sun rays
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = W * 0.018;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(W*0.82 + Math.cos(a)*W*0.11, H*0.14 + Math.sin(a)*W*0.11);
        ctx.lineTo(W*0.82 + Math.cos(a)*W*0.16, H*0.14 + Math.sin(a)*W*0.16);
        ctx.stroke();
      }
      // Clouds
      ctx.fillStyle = 'white';
      [[0.62,0.1,0.07],[0.7,0.12,0.055],[0.55,0.12,0.05]].forEach(([x,y,r]) => {
        ctx.beginPath();
        ctx.arc(W*x, H*y, W*r, 0, Math.PI*2);
        ctx.fill();
      });

      // Ocean
      const sea = ctx.createLinearGradient(0, H*0.5, 0, H*0.7);
      sea.addColorStop(0, '#42a5f5');
      sea.addColorStop(1, '#1565c0');
      ctx.fillStyle = sea;
      ctx.fillRect(0, H*0.5, W, H*0.2);

      // Land
      ctx.fillStyle = '#66bb6a';
      ctx.beginPath();
      ctx.moveTo(W*0.1, H*0.5);
      ctx.lineTo(W*0.9, H*0.5);
      ctx.lineTo(W*0.9, H*0.72);
      ctx.quadraticCurveTo(W*0.5, H*0.68, W*0.1, H*0.72);
      ctx.closePath();
      ctx.fill();

      // Ground below
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(0, H*0.7, W, H*0.3);
      ctx.fillStyle = '#a5d6a7';
      ctx.fillRect(0, H*0.7, W, H*0.06);

      // Big tree
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(W*0.46, H*0.55, W*0.08, H*0.2);
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(W*0.5, H*0.52, W*0.13, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#43a047';
      ctx.beginPath();
      ctx.arc(W*0.5, H*0.47, W*0.1, 0, Math.PI*2);
      ctx.fill();
      // Fruit
      ctx.fillStyle = '#ef5350';
      [[0.56,0.5],[0.44,0.52],[0.5,0.56]].forEach(([x,y]) => {
        ctx.beginPath();
        ctx.arc(W*x, H*y, W*0.025, 0, Math.PI*2);
        ctx.fill();
      });

      // Animals
      ctx.font = `${W*0.06}px serif`;
      ctx.textAlign = 'center';
      [['🦁',0.15,0.84],['🐘',0.38,0.86],['🦒',0.72,0.82],['🐦',0.85,0.38]].forEach(([e,x,y]) => {
        ctx.fillText(e, W*x, H*y);
      });

      // Human figure (God's creation)
      ctx.fillStyle = '#f4a460';
      ctx.beginPath();
      ctx.arc(W*0.55, H*0.78, W*0.025, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ce93d8';
      ctx.fillRect(W*0.535, H*0.8, W*0.03, H*0.1);
      // Arms up in praise
      ctx.strokeStyle = '#f4a460';
      ctx.lineWidth = W*0.015;
      ctx.beginPath();
      ctx.moveTo(W*0.535, H*0.83);
      ctx.lineTo(W*0.5, H*0.78);
      ctx.moveTo(W*0.565, H*0.83);
      ctx.lineTo(W*0.6, H*0.78);
      ctx.stroke();
    }
  },

  {
    id: 'burning_bush',
    title: 'Moses & the Burning Bush',
    draw(ctx, W, H) {
      // Sky gradient — desert dusk
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, '#1a0a3a');
      sky.addColorStop(1, '#7a3a10');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.55);
      // Stars
      ctx.fillStyle = '#fffde7';
      [[0.1,0.06],[0.25,0.12],[0.55,0.05],[0.7,0.15],[0.88,0.08],[0.4,0.2]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(W*x,H*y,W*0.008,0,Math.PI*2); ctx.fill();
      });
      // Desert sand
      const sand = ctx.createLinearGradient(0,H*0.55,0,H);
      sand.addColorStop(0,'#c8903a'); sand.addColorStop(1,'#8b5e1a');
      ctx.fillStyle = sand; ctx.fillRect(0,H*0.55,W,H*0.45);
      // Sand dunes
      ctx.fillStyle = '#d4a050';
      ctx.beginPath();
      ctx.moveTo(0,H*0.65); ctx.quadraticCurveTo(W*0.2,H*0.52,W*0.4,H*0.62);
      ctx.quadraticCurveTo(W*0.6,H*0.52,W*0.8,H*0.62); ctx.quadraticCurveTo(W*0.9,H*0.57,W,H*0.6);
      ctx.lineTo(W,H*0.55); ctx.lineTo(0,H*0.55); ctx.closePath(); ctx.fill();
      // BURNING BUSH
      const bx = W*0.62, by = H*0.44;
      // Bush branches
      ctx.fillStyle = '#2a5a10';
      [[0,0,W*0.06],[W*0.08,H*0.05,W*0.05],[-W*0.07,H*0.04,W*0.05],[W*0.03,H*0.1,W*0.06],[-W*0.03,H*0.12,W*0.055]].forEach(([dx,dy,r]) => {
        ctx.beginPath(); ctx.arc(bx+dx,by+dy,r,0,Math.PI*2); ctx.fill();
      });
      // Flames
      const flames = [
        {x:0,bot:H*0.17,mid:H*0.02,col:'#ff6b00'},
        {x:W*0.06,bot:H*0.14,mid:H*0.04,col:'#ffd700'},
        {x:-W*0.06,bot:H*0.14,mid:H*0.04,col:'#ff4500'},
        {x:W*0.03,bot:H*0.11,mid:H*0.01,col:'#fff176'},
        {x:-W*0.03,bot:H*0.13,mid:H*0.03,col:'#ff8c00'},
      ];
      flames.forEach(f => {
        ctx.fillStyle = f.col;
        ctx.beginPath();
        ctx.moveTo(bx+f.x-W*0.04,by+f.bot);
        ctx.quadraticCurveTo(bx+f.x,by+f.mid,bx+f.x+W*0.04,by+f.bot);
        ctx.closePath(); ctx.fill();
      });
      // Glow
      const grd = ctx.createRadialGradient(bx,by+H*0.08,0,bx,by+H*0.08,W*0.22);
      grd.addColorStop(0,'rgba(255,180,0,0.35)'); grd.addColorStop(1,'transparent');
      ctx.fillStyle = grd; ctx.fillRect(bx-W*0.25,by-H*0.05,W*0.5,H*0.3);
      // MOSES (left side, kneeling)
      ctx.fillStyle = '#8b5e3c'; // robe
      ctx.fillRect(W*0.2,H*0.6,W*0.12,H*0.16);
      ctx.fillStyle = '#f4a460'; // head
      ctx.beginPath(); ctx.arc(W*0.26,H*0.57,W*0.045,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5a3a10'; // beard/hair
      ctx.beginPath(); ctx.arc(W*0.26,H*0.6,W*0.04,Math.PI,0); ctx.fill();
      ctx.beginPath(); ctx.arc(W*0.26,H*0.6,W*0.022,0,Math.PI); ctx.fill();
      // Staff
      ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = W*0.015;
      ctx.beginPath(); ctx.moveTo(W*0.18,H*0.56); ctx.lineTo(W*0.15,H*0.78); ctx.stroke();
      // Sandals (ground level)
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(W*0.19,H*0.76,W*0.05,W*0.02);
      ctx.fillRect(W*0.27,H*0.76,W*0.05,W*0.02);
    }
  },

  {
    id: 'loaves_fishes',
    title: 'Jesus Feeds the Crowd',
    draw(ctx, W, H) {
      // Sky
      const sky = ctx.createLinearGradient(0,0,0,H*0.5);
      sky.addColorStop(0,'#87ceeb'); sky.addColorStop(1,'#fffde7');
      ctx.fillStyle = sky; ctx.fillRect(0,0,W,H*0.5);
      // Sun
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(W*0.75,H*0.12,W*0.07,0,Math.PI*2); ctx.fill();
      // Hills
      ctx.fillStyle = '#81c784';
      ctx.beginPath(); ctx.moveTo(0,H*0.5);
      ctx.quadraticCurveTo(W*0.3,H*0.32,W*0.6,H*0.45);
      ctx.quadraticCurveTo(W*0.8,H*0.38,W,H*0.44);
      ctx.lineTo(W,H*0.5); ctx.closePath(); ctx.fill();
      // Ground
      ctx.fillStyle = '#8fbc5a'; ctx.fillRect(0,H*0.5,W,H*0.5);
      ctx.fillStyle = '#a8d46f'; ctx.fillRect(0,H*0.5,W,H*0.06);
      // Crowd of people (simple figures)
      const crowd = [[0.05,0.62],[0.12,0.65],[0.18,0.61],[0.25,0.64],[0.72,0.63],[0.79,0.62],[0.85,0.65],[0.92,0.62]];
      crowd.forEach(([x,y]) => {
        ctx.fillStyle = ['#ce93d8','#ef9a9a','#80cbc4','#a5d6a7','#ffcc80'][Math.floor(Math.random()*5)];
        ctx.beginPath(); ctx.arc(W*x,H*y,W*0.028,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f4a460';
        ctx.beginPath(); ctx.arc(W*x,H*(y-0.06),W*0.02,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#795548';
        ctx.fillRect(W*x-W*0.012,H*y,W*0.024,H*0.12);
      });
      // JESUS (center)
      ctx.fillStyle = '#ce93d8'; ctx.fillRect(W*0.44,H*0.55,W*0.12,H*0.18);
      ctx.fillStyle = '#f4a460';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.52,W*0.045,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.54,W*0.05,Math.PI,0); ctx.fill();
      // BASKET with loaves & fish
      ctx.fillStyle = '#c8903a';
      ctx.beginPath(); ctx.ellipse(W*0.5,H*0.72,W*0.08,H*0.05,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffe082';
      ctx.beginPath(); ctx.ellipse(W*0.44,H*0.7,W*0.035,H*0.025,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W*0.56,H*0.7,W*0.035,H*0.025,0,0,Math.PI*2); ctx.fill();
      // Fish
      ctx.fillStyle = '#64b5f6';
      ctx.beginPath();
      ctx.ellipse(W*0.5,H*0.68,W*0.04,H*0.018,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(W*0.54,H*0.68); ctx.lineTo(W*0.57,H*0.66); ctx.lineTo(W*0.57,H*0.70); ctx.closePath(); ctx.fill();
      // Rays of blessing
      ctx.strokeStyle = 'rgba(255,220,0,0.5)'; ctx.lineWidth = W*0.008;
      for (let i=0; i<8; i++) {
        const a = (i/8)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(W*0.5+Math.cos(a)*W*0.07, H*0.52+Math.sin(a)*H*0.07);
        ctx.lineTo(W*0.5+Math.cos(a)*W*0.14, H*0.52+Math.sin(a)*H*0.14);
        ctx.stroke();
      }
    }
  },

  {
    id: 'daniel_lions',
    title: "Daniel in the Lions' Den",
    draw(ctx, W, H) {
      // Stone cave background
      const bg = ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#1a1a2e'); bg.addColorStop(1,'#0a0a15');
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      // Cave arch
      ctx.fillStyle = '#2a2a40';
      ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(0,H*0.3);
      ctx.quadraticCurveTo(W*0.5,-H*0.1,W,H*0.3); ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
      // Stone texture
      ctx.strokeStyle = '#3a3a55'; ctx.lineWidth = 2;
      for (let i=0; i<6; i++) {
        for (let j=0; j<4; j++) {
          ctx.strokeRect(W*(0.05+i*0.16),H*(0.4+j*0.15),W*0.14,H*0.12);
        }
      }
      // Cave opening (sky visible)
      const opening = ctx.createLinearGradient(0,0,0,H*0.25);
      opening.addColorStop(0,'#0d1b4a'); opening.addColorStop(1,'#1a237e');
      ctx.fillStyle = opening;
      ctx.beginPath(); ctx.arc(W/2,0,W*0.35,0,Math.PI); ctx.fill();
      // Stars in opening
      ctx.fillStyle = 'white';
      [[0.35,0.04],[0.5,0.02],[0.65,0.05],[0.42,0.12],[0.58,0.1]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(W*x,H*y,W*0.007,0,Math.PI*2); ctx.fill();
      });
      // LIONS
      const lionColor = '#c8903a';
      // Left lion
      ctx.fillStyle = lionColor;
      ctx.beginPath(); ctx.ellipse(W*0.2,H*0.72,W*0.12,H*0.09,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(W*0.1,H*0.66,W*0.065,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8b5e10';
      ctx.beginPath(); ctx.arc(W*0.1,H*0.66,W*0.075,Math.PI*0.5,Math.PI*1.5); ctx.fill();
      // Right lion
      ctx.fillStyle = lionColor;
      ctx.beginPath(); ctx.ellipse(W*0.8,H*0.72,W*0.12,H*0.09,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(W*0.9,H*0.66,W*0.065,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8b5e10';
      ctx.beginPath(); ctx.arc(W*0.9,H*0.66,W*0.075,Math.PI*(-0.5),Math.PI*0.5); ctx.fill();
      // DANIEL (center, kneeling in prayer, glowing)
      const grd = ctx.createRadialGradient(W*0.5,H*0.6,0,W*0.5,H*0.6,W*0.18);
      grd.addColorStop(0,'rgba(255,220,100,0.4)'); grd.addColorStop(1,'transparent');
      ctx.fillStyle = grd; ctx.fillRect(W*0.32,H*0.42,W*0.36,H*0.35);
      ctx.fillStyle = '#5c8a3c'; ctx.fillRect(W*0.43,H*0.62,W*0.14,H*0.18);
      ctx.fillStyle = '#f4a460';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.59,W*0.045,0,Math.PI*2); ctx.fill();
      // Prayer hands
      ctx.fillStyle = '#f4a460';
      ctx.beginPath(); ctx.ellipse(W*0.48,H*0.66,W*0.015,H*0.03,-0.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W*0.52,H*0.66,W*0.015,H*0.03,0.3,0,Math.PI*2); ctx.fill();
      // Angel glow above
      ctx.fillStyle = 'rgba(255,240,150,0.8)';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.28,W*0.05,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,200,0.5)';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.28,W*0.09,0,Math.PI*2); ctx.fill();
    }
  },

  {
    id: 'jonah_whale',
    title: 'Jonah and the Big Fish',
    draw(ctx, W, H) {
      // Ocean scene
      const sky = ctx.createLinearGradient(0,0,0,H*0.45);
      sky.addColorStop(0,'#001a3a'); sky.addColorStop(1,'#003a6a');
      ctx.fillStyle = sky; ctx.fillRect(0,0,W,H*0.45);
      // Moon
      ctx.fillStyle = '#fffde7';
      ctx.beginPath(); ctx.arc(W*0.8,H*0.1,W*0.06,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#002a5a';
      ctx.beginPath(); ctx.arc(W*0.83,H*0.09,W*0.048,0,Math.PI*2); ctx.fill();
      // Stars
      ctx.fillStyle = 'white';
      [[0.1,0.06],[0.2,0.12],[0.35,0.05],[0.5,0.1],[0.6,0.04]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(W*x,H*y,W*0.007,0,Math.PI*2); ctx.fill();
      });
      // Deep ocean
      const ocean = ctx.createLinearGradient(0,H*0.45,0,H);
      ocean.addColorStop(0,'#0055aa'); ocean.addColorStop(1,'#001a3a');
      ctx.fillStyle = ocean; ctx.fillRect(0,H*0.45,W,H*0.55);
      // Wave tops
      ctx.strokeStyle = 'rgba(100,200,255,0.5)'; ctx.lineWidth = W*0.01;
      for (let wy=H*0.45; wy<H*0.7; wy+=H*0.08) {
        ctx.beginPath();
        for (let wx=0; wx<=W; wx+=W*0.1) {
          ctx.quadraticCurveTo(wx+W*0.03,wy-H*0.02,wx+W*0.06,wy);
        }
        ctx.stroke();
      }
      // BIG WHALE
      ctx.fillStyle = '#1565c0';
      ctx.beginPath(); ctx.ellipse(W*0.5,H*0.72,W*0.38,H*0.15,0.1,0,Math.PI*2); ctx.fill();
      // Tail
      ctx.fillStyle = '#0d47a1';
      ctx.beginPath();
      ctx.moveTo(W*0.88,H*0.72); ctx.lineTo(W*0.98,H*0.62); ctx.lineTo(W*0.98,H*0.82); ctx.closePath(); ctx.fill();
      // Belly
      ctx.fillStyle = '#90caf9';
      ctx.beginPath(); ctx.ellipse(W*0.48,H*0.74,W*0.25,H*0.09,0.1,0,Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(W*0.16,H*0.68,W*0.025,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(W*0.165,H*0.68,W*0.013,0,Math.PI*2); ctx.fill();
      // Water spout
      ctx.strokeStyle = '#90caf9'; ctx.lineWidth = W*0.015;
      ctx.beginPath(); ctx.moveTo(W*0.18,H*0.62); ctx.lineTo(W*0.16,H*0.48); ctx.stroke();
      ctx.fillStyle = '#90caf9';
      [[0.14,0.42],[0.18,0.44],[0.12,0.46]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(W*x,H*y,W*0.015,0,Math.PI*2); ctx.fill();
      });
      // JONAH inside (faint inside the whale)
      ctx.fillStyle = 'rgba(244,164,96,0.4)';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.73,W*0.03,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(92,138,60,0.4)';
      ctx.fillRect(W*0.47,H*0.74,W*0.06,H*0.06);
      // Boat on surface
      ctx.fillStyle = '#8b5e3c';
      ctx.beginPath();
      ctx.moveTo(W*0.3,H*0.47); ctx.lineTo(W*0.7,H*0.47);
      ctx.lineTo(W*0.65,H*0.52); ctx.lineTo(W*0.35,H*0.52); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = W*0.01;
      ctx.beginPath(); ctx.moveTo(W*0.5,H*0.35); ctx.lineTo(W*0.5,H*0.47); ctx.stroke();
    }
  },

  {
    id: 'nativity',
    title: 'Baby Jesus is Born',
    draw(ctx, W, H) {
      // Night sky
      const sky = ctx.createLinearGradient(0,0,0,H*0.55);
      sky.addColorStop(0,'#0a0a2e'); sky.addColorStop(1,'#1a1a4a');
      ctx.fillStyle = sky; ctx.fillRect(0,0,W,H*0.55);
      // Stars
      ctx.fillStyle = '#fffde7';
      [[0.05,0.05],[0.15,0.12],[0.28,0.04],[0.4,0.15],[0.6,0.08],[0.72,0.04],[0.85,0.12],[0.95,0.07]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(W*x,H*y,W*0.008,0,Math.PI*2); ctx.fill();
      });
      // THE STAR OF BETHLEHEM
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(W*0.5,H*0.1,W*0.04,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      // Star rays
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = W*0.006;
      for (let i=0; i<8; i++) {
        const a = (i/8)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(W*0.5+Math.cos(a)*W*0.05,H*0.1+Math.sin(a)*H*0.05);
        ctx.lineTo(W*0.5+Math.cos(a)*W*0.1,H*0.1+Math.sin(a)*H*0.1);
        ctx.stroke();
      }
      // Ground & stable
      ctx.fillStyle = '#8b6914'; ctx.fillRect(0,H*0.55,W,H*0.45);
      ctx.fillStyle = '#6d4c41'; // stable walls
      ctx.fillRect(W*0.1,H*0.38,W*0.8,H*0.22);
      ctx.fillStyle = '#4e342e'; // roof
      ctx.beginPath();
      ctx.moveTo(0,H*0.38); ctx.lineTo(W*0.5,H*0.2); ctx.lineTo(W,H*0.38); ctx.closePath(); ctx.fill();
      // Hay
      ctx.fillStyle = '#f9a825';
      ctx.beginPath(); ctx.ellipse(W*0.5,H*0.66,W*0.18,H*0.06,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#e65100'; ctx.lineWidth = 2;
      for (let i=-3; i<=3; i++) {
        ctx.beginPath();
        ctx.moveTo(W*(0.5+i*0.04),H*0.62);
        ctx.lineTo(W*(0.5+i*0.03),H*0.7); ctx.stroke();
      }
      // BABY JESUS in manger
      ctx.fillStyle = '#8b5e3c';
      ctx.fillRect(W*0.38,H*0.6,W*0.24,H*0.1);
      ctx.fillStyle = '#fffde7';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.62,W*0.04,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f4a460';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.62,W*0.03,0,Math.PI*2); ctx.fill();
      // Halo
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = W*0.006;
      ctx.beginPath(); ctx.arc(W*0.5,H*0.62,W*0.055,0,Math.PI*2); ctx.stroke();
      // Mary & Joseph
      ctx.fillStyle = '#5c6bc0'; ctx.fillRect(W*0.2,H*0.52,W*0.1,H*0.2);
      ctx.fillStyle = '#f4a460'; ctx.beginPath(); ctx.arc(W*0.25,H*0.5,W*0.035,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7b3f00'; ctx.fillRect(W*0.65,H*0.52,W*0.12,H*0.2);
      ctx.fillStyle = '#f4a460'; ctx.beginPath(); ctx.arc(W*0.71,H*0.5,W*0.038,0,Math.PI*2); ctx.fill();
      // Animals
      ctx.font = `${W*0.07}px serif`; ctx.textAlign = 'center';
      ctx.fillText('🐂',W*0.15,H*0.78); ctx.fillText('🐑',W*0.85,H*0.78);
      // Angels
      ctx.fillStyle = 'rgba(255,230,100,0.7)';
      ctx.beginPath(); ctx.arc(W*0.2,H*0.22,W*0.04,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(W*0.8,H*0.22,W*0.04,0,Math.PI*2); ctx.fill();
    }
  },

  {
    id: 'jesus_water',
    title: 'Jesus Walks on Water',
    draw(ctx, W, H) {
      // Night sea
      const sky = ctx.createLinearGradient(0,0,0,H*0.45);
      sky.addColorStop(0,'#0d1b4a'); sky.addColorStop(1,'#1a2a6a');
      ctx.fillStyle = sky; ctx.fillRect(0,0,W,H*0.45);
      // Moon reflection line
      ctx.fillStyle = '#fff9c4';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.08,W*0.06,0,Math.PI*2); ctx.fill();
      // Stars
      ctx.fillStyle = 'white';
      [[0.1,0.05],[0.25,0.1],[0.38,0.04],[0.62,0.07],[0.78,0.12],[0.92,0.05]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(W*x,H*y,W*0.007,0,Math.PI*2); ctx.fill();
      });
      // Ocean
      const ocean = ctx.createLinearGradient(0,H*0.45,0,H);
      ocean.addColorStop(0,'#1a4a8a'); ocean.addColorStop(1,'#0a1a3a');
      ctx.fillStyle = ocean; ctx.fillRect(0,H*0.45,W,H*0.55);
      // Moon reflection on water
      ctx.fillStyle = 'rgba(255,249,196,0.25)';
      ctx.beginPath(); ctx.ellipse(W*0.5,H*0.72,W*0.06,H*0.2,0,0,Math.PI*2); ctx.fill();
      // Waves
      ctx.strokeStyle = 'rgba(100,180,255,0.4)'; ctx.lineWidth = W*0.01;
      for (let wy=H*0.5; wy<H*0.9; wy+=H*0.1) {
        ctx.beginPath();
        for (let wx=0; wx<=W; wx+=W*0.12) ctx.quadraticCurveTo(wx+W*0.04,wy-H*0.025,wx+W*0.08,wy);
        ctx.stroke();
      }
      // BOAT (left side, tipping)
      ctx.save(); ctx.translate(W*0.22,H*0.62); ctx.rotate(-0.15);
      ctx.fillStyle = '#8b5e3c';
      ctx.beginPath(); ctx.moveTo(-W*0.18,0); ctx.lineTo(W*0.18,0);
      ctx.lineTo(W*0.14,H*0.12); ctx.lineTo(-W*0.14,H*0.12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5a3a10'; ctx.lineWidth=W*0.008;
      ctx.beginPath(); ctx.moveTo(0,-H*0.18); ctx.lineTo(0,0); ctx.stroke();
      // Disciples in boat
      ctx.fillStyle = '#f4a460';
      [[-0.08,0],[0,0],[0.08,0]].forEach(([dx,dy]) => {
        ctx.beginPath(); ctx.arc(W*dx,H*(dy-0.06),W*0.022,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=['#ef9a9a','#80cbc4','#ce93d8'][Math.floor(Math.random()*3)];
        ctx.fillRect(W*(dx-0.018),H*(dy-0.04),W*0.036,H*0.08);
        ctx.fillStyle = '#f4a460';
      });
      ctx.restore();
      // JESUS walking on water (right center, glowing)
      const grd = ctx.createRadialGradient(W*0.65,H*0.7,0,W*0.65,H*0.7,W*0.15);
      grd.addColorStop(0,'rgba(255,220,100,0.4)'); grd.addColorStop(1,'transparent');
      ctx.fillStyle = grd; ctx.fillRect(W*0.5,H*0.55,W*0.3,H*0.3);
      ctx.fillStyle = '#fffde7'; ctx.fillRect(W*0.61,H*0.62,W*0.08,H*0.18);
      ctx.fillStyle = '#f4a460';
      ctx.beginPath(); ctx.arc(W*0.65,H*0.6,W*0.04,0,Math.PI*2); ctx.fill();
      // Halo
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = W*0.006;
      ctx.beginPath(); ctx.arc(W*0.65,H*0.6,W*0.055,0,Math.PI*2); ctx.stroke();
      // Ripples under feet
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = W*0.007;
      ctx.beginPath(); ctx.ellipse(W*0.65,H*0.8,W*0.07,H*0.02,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(W*0.65,H*0.8,W*0.12,H*0.035,0,0,Math.PI*2); ctx.stroke();
    }
  },

  {
    id: 'peter_fishing',
    title: "Peter's Big Catch",
    draw(ctx, W, H) {
      // Morning sky
      const sky = ctx.createLinearGradient(0,0,0,H*0.5);
      sky.addColorStop(0,'#ff8a65'); sky.addColorStop(0.5,'#ffb74d'); sky.addColorStop(1,'#ffe0b2');
      ctx.fillStyle = sky; ctx.fillRect(0,0,W,H*0.5);
      // Sun rising
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(W*0.5,H*0.5,W*0.09,Math.PI,0); ctx.fill();
      // Sun reflection
      ctx.fillStyle = 'rgba(255,215,0,0.35)';
      ctx.beginPath(); ctx.ellipse(W*0.5,H*0.65,W*0.06,H*0.15,0,0,Math.PI*2); ctx.fill();
      // Water
      const sea = ctx.createLinearGradient(0,H*0.5,0,H);
      sea.addColorStop(0,'#42a5f5'); sea.addColorStop(1,'#1565c0');
      ctx.fillStyle = sea; ctx.fillRect(0,H*0.5,W,H*0.5);
      // Waves
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = W*0.008;
      for (let wy=H*0.55; wy<H; wy+=H*0.09) {
        ctx.beginPath();
        for (let wx=0; wx<=W; wx+=W*0.12) ctx.quadraticCurveTo(wx+W*0.04,wy-H*0.02,wx+W*0.08,wy);
        ctx.stroke();
      }
      // BOAT
      ctx.fillStyle = '#8b5e3c';
      ctx.beginPath();
      ctx.moveTo(W*0.12,H*0.62); ctx.lineTo(W*0.88,H*0.62);
      ctx.lineTo(W*0.82,H*0.74); ctx.lineTo(W*0.18,H*0.74); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(W*0.3,H*0.56,W*0.4,H*0.07);
      // Mast & sail
      ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = W*0.015;
      ctx.beginPath(); ctx.moveTo(W*0.5,H*0.3); ctx.lineTo(W*0.5,H*0.56); ctx.stroke();
      ctx.fillStyle = '#fffde7';
      ctx.beginPath(); ctx.moveTo(W*0.5,H*0.32); ctx.lineTo(W*0.72,H*0.46); ctx.lineTo(W*0.5,H*0.56); ctx.closePath(); ctx.fill();
      // Net full of fish
      ctx.strokeStyle = '#8b5e3c'; ctx.lineWidth = W*0.005;
      for (let i=0; i<5; i++) {
        ctx.beginPath(); ctx.moveTo(W*(0.3+i*0.06),H*0.72); ctx.lineTo(W*(0.25+i*0.06),H*0.88); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W*0.28,H*(0.74+i*0.03)); ctx.lineTo(W*0.56,H*(0.74+i*0.03)); ctx.stroke();
      }
      // Fish in net
      ['#64b5f6','#80cbc4','#ffcc80','#ef9a9a'].forEach((c,i) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(W*(0.33+i*0.06),H*(0.77+i%2*0.04),W*0.025,H*0.012,0,0,Math.PI*2); ctx.fill();
      });
      // PETER
      ctx.fillStyle = '#ce93d8'; ctx.fillRect(W*0.15,H*0.55,W*0.1,H*0.15);
      ctx.fillStyle = '#f4a460'; ctx.beginPath(); ctx.arc(W*0.2,H*0.53,W*0.038,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.arc(W*0.2,H*0.55,W*0.042,Math.PI,0); ctx.fill();
      // JESUS on shore
      ctx.fillStyle = '#5c3a8a'; ctx.fillRect(W*0.85,H*0.64,W*0.1,H*0.2);
      ctx.fillStyle = '#f4a460'; ctx.beginPath(); ctx.arc(W*0.9,H*0.62,W*0.04,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = W*0.006;
      ctx.beginPath(); ctx.arc(W*0.9,H*0.62,W*0.055,0,Math.PI*2); ctx.stroke();
      // Shore
      ctx.fillStyle = '#c8903a'; ctx.fillRect(W*0.8,H*0.78,W*0.2,H*0.22);
    }
  },
];
