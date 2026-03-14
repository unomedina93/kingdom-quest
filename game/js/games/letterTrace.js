// ===== LETTER TRACE GAME =====
// Trace the glowing letter outline on a scroll/parchment!
// Works with mouse, touch, or motion

class LetterTraceGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx    = ctx;
    this.onComplete = onComplete;

    this.running    = false;
    this.score      = 0;  // Letters traced
    this.targetCount = 8; // How many letters to trace

    // Current letter being traced
    this.currentLetter = '';
    this.letterIndex   = 0;
    this.letters       = [];

    // Tracing state
    this.isDrawing      = false;
    this.userStrokes    = [];    // Array of strokes; each stroke = array of {x,y} points
    this._currentStroke = null;  // The stroke currently being drawn
    this.coverPct       = 0;     // 0-100: how much of the letter is covered
    this.targetPct      = 75;    // % of unique letter cells to cover before completing

    // Grid-based coverage tracking (prevents "just touch once to win")
    this._gridCols   = 50;       // Resolution of coverage grid
    this._gridRows   = 50;
    this._letterCells  = null;   // Set of grid cell keys that are part of the letter
    this._visitedCells = null;   // Set of letter cells the user has drawn through

    // Anti-scribble: track what fraction of drawn points were actually near the letter
    this._totalDrawnPoints = 0;
    this._onLetterPoints   = 0;

    // Off-screen canvas for guide letter
    this.guideCanvas = null;
    this.guideCtx    = null;

    // Sparkle trail as user draws
    this.sparkles = [];

    // Input
    this._onMouseDown  = (e) => {
      this.isDrawing = true;
      this._startStroke();
    };
    this._onMouseUp    = (e) => {
      this.isDrawing = false;
      this._endStroke();
    };
    this._onMouseMove  = (e) => {
      if (!this.isDrawing) return;
      const r = this.canvas.getBoundingClientRect();
      this._draw(e.clientX - r.left, e.clientY - r.top);
    };
    this._onTouchStart = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      this._startStroke();
    };
    this._onTouchEnd   = (e) => {
      this.isDrawing = false;
      this._endStroke();
    };
    this._onTouchMove  = (e) => {
      e.preventDefault();
      if (!this.isDrawing) return;
      const r = this.canvas.getBoundingClientRect();
      const t = e.touches[0];
      this._draw(t.clientX - r.left, t.clientY - r.top);
    };
    this._motionHandler = (x, y, vel) => {
      const r = this.canvas.getBoundingClientRect();
      if (vel > 15) {
        // Auto-start a new stroke if the hand just started moving
        if (!this._currentStroke) this._startStroke();
        this._draw(x - r.left, y - r.top);
      } else {
        // Hand stopped — end the current stroke so the next movement
        // starts fresh and doesn't draw a line across the gap
        if (this._currentStroke) this._endStroke();
      }
    };

    this._rafId    = null;
    this._lastTime = 0;
  }

  start() {
    this._resize();
    window.addEventListener('resize', () => this._resize());

    const diff = CURRICULUM.difficulty[App.difficulty];
    const group = diff.letters;
    this.letters = [...CURRICULUM.letterGroups[group]];
    // Shuffle
    for (let i = this.letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.letters[i], this.letters[j]] = [this.letters[j], this.letters[i]];
    }
    this.letters = this.letters.slice(0, this.targetCount);
    this.letterIndex = 0;

    this.score   = 0;
    this.running = true;
    this.sparkles = [];

    // Create guide canvas for measuring coverage
    this.guideCanvas = document.createElement('canvas');
    this.guideCtx    = this.guideCanvas.getContext('2d');

    // Input
    this.canvas.addEventListener('mousedown',  this._onMouseDown);
    this.canvas.addEventListener('mouseup',    this._onMouseUp);
    this.canvas.addEventListener('mousemove',  this._onMouseMove);
    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.canvas.addEventListener('touchend',   this._onTouchEnd,   { passive: false });
    this.canvas.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    Motion.onMove(this._motionHandler);

    App.setHUDTitle('Scroll Writer 📜');
    App.updateHUDScore(0);
    App.updateHUDHearts(this.targetCount);

    this._loadLetter();

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
    this.canvas.removeEventListener('mouseup',    this._onMouseUp);
    this.canvas.removeEventListener('mousemove',  this._onMouseMove);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchend',   this._onTouchEnd);
    this.canvas.removeEventListener('touchmove',  this._onTouchMove);
    Motion.offMove(this._motionHandler);
    window.removeEventListener('resize', () => this._resize());
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();
  }

  _loadLetter() {
    this.currentLetter  = this.letters[this.letterIndex];
    this.userStrokes    = [];
    this._currentStroke = null;
    this.coverPct       = 0;
    this.isDrawing      = false;

    // Setup guide canvas
    const size = Math.min(this.canvas.width, this.canvas.height) * 0.55;
    const cx   = this.canvas.width  / 2;
    const cy   = this.canvas.height / 2 + 20;

    this.letterX = cx;
    this.letterY = cy;
    this.letterSize = size;

    this.guideCanvas.width  = this.canvas.width;
    this.guideCanvas.height = this.canvas.height;

    // Detection canvas: solid (no dashes), slightly wider stroke so letter cells
    // are contiguous. Random scribbles far from the letter won't hit these cells.
    this.guideCtx.save();
    this.guideCtx.font         = `bold ${size}px Cinzel, serif`;
    this.guideCtx.textAlign    = 'center';
    this.guideCtx.textBaseline = 'middle';
    this.guideCtx.strokeStyle  = 'rgba(0,0,0,1)';
    this.guideCtx.lineWidth    = Math.max(10, size / 12); // wider than visual guide
    this.guideCtx.strokeText(this.currentLetter, cx, cy);
    this.guideCtx.restore();

    // Reset anti-scribble counters
    this._totalDrawnPoints = 0;
    this._onLetterPoints   = 0;

    // Reset grid-based coverage tracking for this letter
    this._visitedCells = new Set();
    this._computeLetterGrid();

    // Announce
    Audio.speak(`Trace the letter ${this.currentLetter}! Follow the dotted outline!`, { interrupt: true });
  }

  _startStroke() {
    this._currentStroke = [];
    this.userStrokes.push(this._currentStroke);
  }

  _endStroke() {
    this._currentStroke = null;
  }

  _draw(x, y) {
    if (!this._currentStroke) return;
    this._currentStroke.push({ x, y });
    this._totalDrawnPoints++;

    // Cap each stroke length to keep memory bounded
    if (this._currentStroke.length > 300) this._currentStroke.shift();

    // Spawn sparkle
    this.sparkles.push({
      x, y,
      vx: (Math.random() - 0.5) * 80,
      vy: -80 - Math.random() * 80,
      life: 0.5 + Math.random() * 0.3,
      size: 4 + Math.random() * 6,
      color: ['#ffd700','#fff','#c77dff','#7bc8ff'][Math.floor(Math.random() * 4)]
    });

    // Update coverage based on where the user drew
    this._measureCoverage(x, y);
  }

  // Scan the guide canvas and build a set of grid cells that contain letter pixels.
  // Called once each time a new letter loads. Each cell is only counted once no
  // matter how many times the user draws through it — so looping in one spot
  // can never by itself finish the letter.
  _computeLetterGrid() {
    const COLS = this._gridCols;
    const ROWS = this._gridRows;
    const cw   = this.guideCanvas.width;
    const ch   = this.guideCanvas.height;
    if (!cw || !ch) return;

    const imageData = this.guideCtx.getImageData(0, 0, cw, ch);
    const pixels    = imageData.data;
    const cellW     = cw / COLS;
    const cellH     = ch / ROWS;

    this._letterCells = new Set();

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Sample four sub-points per cell so we don't miss thin strokes
        let isLetter = false;
        for (let sy = 0; sy < 2 && !isLetter; sy++) {
          for (let sx = 0; sx < 2 && !isLetter; sx++) {
            const px  = Math.min(cw - 1, Math.round((col + 0.25 + sx * 0.5) * cellW));
            const py  = Math.min(ch - 1, Math.round((row + 0.25 + sy * 0.5) * cellH));
            const idx = (py * cw + px) * 4;
            if (pixels[idx + 3] > 50) isLetter = true;
          }
        }
        if (isLetter) this._letterCells.add(`${row},${col}`);
      }
    }
  }

  _measureCoverage(x, y) {
    if (!this._letterCells || !this._letterCells.size) return;

    const cellW = this.guideCanvas.width  / this._gridCols;
    const cellH = this.guideCanvas.height / this._gridRows;
    const col0  = Math.floor(x / cellW);
    const row0  = Math.floor(y / cellH);

    // Mark a small 3×3 neighbourhood of cells around the touch point as visited.
    // This accounts for finger width and avoids requiring pixel-perfect precision.
    let changed   = false;
    let hitLetter = false; // was this drawn point near the letter at all?
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const col = col0 + dc;
        const row = row0 + dr;
        if (col < 0 || row < 0 || col >= this._gridCols || row >= this._gridRows) continue;
        const key = `${row},${col}`;
        if (this._letterCells.has(key)) {
          hitLetter = true;
          if (!this._visitedCells.has(key)) {
            this._visitedCells.add(key);
            changed = true;
          }
        }
      }
    }

    if (hitLetter) this._onLetterPoints++;

    if (changed) {
      this.coverPct = (this._visitedCells.size / this._letterCells.size) * 100;

      // Anti-scribble: at least 25% of drawn points must be near the letter.
      // A genuine tracer stays close to the letter (~70-90% efficiency).
      // A random scribbler only crosses it occasionally (<15% efficiency).
      const efficiency = this._totalDrawnPoints > 15
        ? this._onLetterPoints / this._totalDrawnPoints
        : 1; // not enough data yet — give benefit of the doubt

      if (this.coverPct >= this.targetPct && efficiency >= 0.25 && !this._completing) {
        this._completeTrace();
      }
    }
  }

  _completeTrace() {
    if (this._completing) return;
    this._completing = true;

    this.score++;
    App.updateHUDScore(this.score);
    Audio.playVictory();

    // Big sparkle burst
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 300;
      this.sparkles.push({
        x: this.letterX, y: this.letterY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        life: 0.8 + Math.random() * 0.8,
        size: 8 + Math.random() * 10,
        color: ['#ffd700','#fff','#c77dff','#ff6b6b','#43a047'][Math.floor(Math.random() * 5)]
      });
    }

    // Wait for the praise to finish before loading the next letter,
    // so the new instruction never cuts off "Amazing!"
    Audio.speak(`Amazing! You wrote the letter ${this.currentLetter}!`, {
      onEnd: () => {
        this._completing = false;
        this.letterIndex++;
        if (this.letterIndex >= this.letters.length) {
          this._endGame();
        } else {
          this._loadLetter();
        }
      }
    });
  }

  _endGame() {
    this.running = false;
    this.stop();

    Audio.speak(`Wonderful writing! You traced ${this.score} letters!`, { interrupt: true });
    App.showOverlay('📜', `You wrote ${this.score} letters like a true scribe!`, 'Claim Stars! ⭐', () => {
      this.onComplete(3);
    });
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
    // Update sparkles
    this.sparkles = this.sparkles.filter(s => s.life > 0);
    this.sparkles.forEach(s => {
      s.x    += s.vx * dt;
      s.y    += s.vy * dt;
      s.vy   += 200 * dt;
      s.life -= dt * 1.5;
    });
  }

  _render() {
    const { ctx, canvas, currentLetter } = this;

    // Parchment background
    const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grd.addColorStop(0, '#fffbe6');
    grd.addColorStop(0.5, '#f5e6c8');
    grd.addColorStop(1, '#e8d5a3');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parchment texture lines
    ctx.strokeStyle = 'rgba(139,94,60,0.1)';
    ctx.lineWidth = 1;
    for (let y = 60; y < canvas.height; y += 36) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.stroke();
    }

    // Letter progress bar
    const pct = this.letterIndex / this.letters.length;
    ctx.fillStyle = 'rgba(139,94,60,0.15)';
    ctx.fillRect(40, 14, canvas.width - 80, 10);
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(40, 14, (canvas.width - 80) * pct, 10);

    // Emoji hint only — the big guide letter below IS the letter, no need to repeat it
    const emoji = CURRICULUM.letterEmoji[currentLetter];
    ctx.font = `${Math.min(36, canvas.width / 16)}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(emoji, canvas.width / 2, 62);

    // Coverage bar
    const barW = Math.min(300, canvas.width * 0.5);
    const barX = canvas.width / 2 - barW / 2;
    const barY = canvas.height - 50;
    ctx.fillStyle = 'rgba(139,94,60,0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 18, 9);
    ctx.fill();
    const covFill = (this.coverPct / 100) * barW;
    ctx.fillStyle = '#7b3fc4';
    ctx.beginPath();
    ctx.roundRect(barX, barY, covFill, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#4a2f0a';
    ctx.font = '13px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Trace the letter!', canvas.width / 2, barY + 36);

    // Guide letter (dotted outline)
    const size = this.letterSize;
    const cx   = this.letterX;
    const cy   = this.letterY;
    this._drawGuide(ctx, size, cx, cy);

    // User's drawn strokes — each press/drag/release is a separate path
    // so lifting and re-pressing never draws a connecting line across the gap
    if (this.userStrokes.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#7b3fc4';
      ctx.lineWidth   = Math.max(6, size / 20); // matches guide width
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = 0.8;
      this.userStrokes.forEach(stroke => {
        if (stroke.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.stroke();
      });
      ctx.restore();
    }

    // Sparkles
    ctx.save();
    this.sparkles.forEach(s => {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle   = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _drawGuide(targetCtx, size, cx, cy) {
    // Draw the letter as a solid semi-transparent fill — ONE clear letter shape.
    // Using fillText avoids the "double letter" illusion that thick strokeText creates
    // (a wide dashed stroke renders both inside and outside the letter path, looking doubled).
    targetCtx.save();
    targetCtx.font         = `bold ${size}px Cinzel, serif`;
    targetCtx.textAlign    = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.fillStyle    = 'rgba(160,110,50,0.28)';
    targetCtx.fillText(this.currentLetter, cx, cy);
    targetCtx.restore();
  }
}
