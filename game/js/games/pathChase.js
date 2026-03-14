// ===== PATH CHASE GAME =====
// Hero chases a thief through the kingdom!
// At each fork in the road, pick the path with the correct letter.
// Narrator says "Take the path with the letter B!" — tap the right path!

class PathChaseGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx    = ctx;
    this.onComplete = onComplete;

    this.running  = false;
    this.score    = 0;
    this.hearts   = 3;
    this.round    = 0;
    this.maxRounds = 10;

    // Hero and thief positions (0 = left, 1 = right, 2 = center)
    this.heroX  = 0;  // normalized 0-1 across screen
    this.thiefX = 0;
    this.heroY  = 0.7; // normalized 0-1 down screen
    this.thiefY = 0.35;
    this.heroRunFrame   = 0;
    this.thiefRunFrame  = 0;

    this.distanceClosed = 0;  // 0-100: how close hero is to catching thief

    // Current fork
    this.targetLetter = '';
    this.paths = [];  // [{ letter, x, y, correct, state }]

    this.feedback = null;
    this.particles = [];

    // Scroll / parallax
    this.scrollOffset = 0;
    this.SCROLL_SPEED = 80; // px per second

    this._onClick = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this._handleClick(e.clientX - r.left, e.clientY - r.top);
    };
    this._onTouch = (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      this._handleClick(t.clientX - r.left, t.clientY - r.top);
    };

    this._rafId    = null;
    this._lastTime = 0;
    this._waitingForNext = false;
  }

  start() {
    this._resize();
    window.addEventListener('resize', () => this._resize());

    const diff = CURRICULUM.difficulty[App.difficulty];
    const group = diff.letters;
    this.letterPool = CURRICULUM.letterGroups[group].slice();

    this.score           = 0;
    this.hearts          = 3;
    this.round           = 0;
    this.running         = true;
    this.distanceClosed  = 0;
    this.scrollOffset    = 0;
    this.particles       = [];
    this._waitingForNext = false;

    this.heroX  = 0.5;
    this.thiefX = 0.5;

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });

    App.setHUDTitle('Chase the Thief! 🏃');
    App.updateHUDScore(0);
    App.updateHUDHearts(3);

    this._nextFork();

    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('click',    this._onClick);
    this.canvas.removeEventListener('touchend', this._onTouch);
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
    this.scrollOffset += this.SCROLL_SPEED * dt;
    this.heroRunFrame += dt * 10;
    this.thiefRunFrame += dt * 12;

    // Update feedback
    if (this.feedback) {
      this.feedback.life -= dt;
      if (this.feedback.life <= 0) this.feedback = null;
    }

    // Update particles
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 250 * dt;
      p.life -= dt;
    });
  }

  _nextFork() {
    if (this.round >= this.maxRounds) { this._endGame(true); return; }
    this.round++;
    this._waitingForNext = false;

    // Pick target letter
    this.targetLetter = this.letterPool[Math.floor(Math.random() * this.letterPool.length)];

    // Pick 2 or 3 path letters
    const count = App.difficulty === 'easy' ? 2 : 3;
    const used  = new Set([this.targetLetter]);
    const wrong = [];
    while (wrong.length < count - 1) {
      const l = this.letterPool[Math.floor(Math.random() * this.letterPool.length)];
      if (!used.has(l)) { used.add(l); wrong.push(l); }
    }
    const all = [this.targetLetter, ...wrong].sort(() => Math.random() - 0.5);

    // Layout path signs in diverging directions (left / center / right)
    const { canvas } = this;
    const W = canvas.width, H = canvas.height;
    const btnW = Math.min(130, W * 0.22);
    const btnH = btnW;

    // Positions: 2-path = left+right, 3-path = left+center+right
    const positions = count === 2
      ? [
          { cx: W * 0.22, cy: H * 0.30 }, // Left
          { cx: W * 0.78, cy: H * 0.30 }, // Right
        ]
      : [
          { cx: W * 0.14, cy: H * 0.34 }, // Far left diagonal
          { cx: W * 0.50, cy: H * 0.20 }, // Center straight ahead
          { cx: W * 0.86, cy: H * 0.34 }, // Far right diagonal
        ];

    this.paths = all.map((letter, i) => ({
      letter,
      correct: letter === this.targetLetter,
      x: positions[i].cx - btnW / 2,
      y: positions[i].cy - btnH / 2,
      w: btnW,
      h: btnH,
      cx: positions[i].cx, // Sign center — used for fork road drawing
      cy: positions[i].cy,
      state: 'idle'
    }));

    // Speak prompt
    Audio.speak(`Quick! Take the path with the letter ${this.targetLetter}!`, { interrupt: true });
  }

  _handleClick(x, y) {
    if (this._waitingForNext) return;
    this.paths.forEach(path => {
      if (x >= path.x && x <= path.x + path.w &&
          y >= path.y && y <= path.y + path.h) {
        this._choosePath(path);
      }
    });
  }

  _choosePath(path) {
    if (this._waitingForNext) return;
    this._waitingForNext = true;

    if (path.correct) {
      path.state = 'correct';
      this.score++;
      this.distanceClosed = Math.min(100, this.distanceClosed + 12);
      App.updateHUDScore(this.score);
      Audio.playSuccess();
      Audio.playSlice();

      // Particles
      const cx = path.x + path.w / 2;
      const cy = path.y + path.h / 2;
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 200;
        this.particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 100,
          color: ['#ffd700','#fff','#43a047'][Math.floor(Math.random() * 3)],
          life: 0.7 + Math.random() * 0.5,
          size: 5 + Math.random() * 7
        });
      }

      this.feedback = {
        text: `✅ ${path.letter} is right!`,
        color: '#43a047',
        x: cx, y: cy - 50,
        life: 1.2
      };

      // Wait for praise to finish before loading next fork so the interrupt
      // in _nextFork() doesn't cut off "Yes! The letter B!"
      Audio.speak(`Yes! The letter ${path.letter}!`, {
        onEnd: () => {
          if (!this.running) return;
          if (this.distanceClosed >= 100) {
            this._caught();
          } else {
            this._nextFork();
          }
        }
      });
    } else {
      path.state = 'wrong';
      this.hearts = Math.max(0, this.hearts - 1);
      App.updateHUDHearts(this.hearts);
      Audio.playWrong();

      const cx = path.x + path.w / 2;
      const cy = path.y + path.h / 2;
      this.feedback = {
        text: `❌ That's ${path.letter}!`,
        color: '#e53935',
        x: cx, y: cy - 50,
        life: 1.2
      };

      Audio.speak(`Oops! That's ${path.letter}. Find ${this.targetLetter}!`);

      setTimeout(() => {
        path.state = 'idle';
        this._waitingForNext = false;
        if (this.hearts <= 0) { this._endGame(false); }
      }, 900);
    }
  }

  _caught() {
    this.running = false;
    this.stop();
    Audio.playVictory();
    Audio.speak(`You caught the thief! Amazing hero! You got all the letters right!`, { interrupt: true });
    App.showOverlay('🦸', 'You caught the thief!\nThe kingdom is safe!', 'Claim Stars! ⭐', () => {
      this.onComplete(3);
    });
  }

  _endGame(won) {
    this.running = false;
    this.stop();
    const stars = this.hearts === 3 ? 3 : this.hearts > 0 ? 2 : 1;
    if (won) {
      Audio.speak(`Amazing! You got ${this.score} letters right!`, { interrupt: true });
    } else {
      Audio.speak(`Good try! You got ${this.score} letters right! Keep practicing!`, { interrupt: true });
    }
    App.showOverlay(
      won ? '🏆' : '⭐',
      `You identified ${this.score} letters!`,
      `Claim ${stars} Stars!`,
      () => this.onComplete(stars)
    );
  }

  _render() {
    const { ctx, canvas, paths, targetLetter } = this;

    // ---- BACKGROUND: Kingdom road scene ----
    // Sky
    const skyGrd = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.5);
    skyGrd.addColorStop(0, '#87CEEB');
    skyGrd.addColorStop(1, '#c8e6ff');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.5);

    // Clouds
    this._drawClouds();

    // Ground
    ctx.fillStyle = '#5a8a2a';
    ctx.fillRect(0, canvas.height * 0.5, canvas.width, canvas.height * 0.5);

    // Fork roads (main road + 3 diverging branches)
    this._drawForkRoads();

    // Trees on sides (only far left/right so they don't overlap forks)
    const treePositions = [0.02, 0.08, 0.92, 0.98];
    treePositions.forEach(x => {
      const ty = canvas.height * 0.48 + ((x * 1000 + this.scrollOffset * 0.5) % (canvas.height * 0.3));
      ctx.font = '40px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌲', canvas.width * x, ty);
    });

    // ---- THIEF (ahead, running away — always at top center) ----
    const thiefBob = Math.sin(this.thiefRunFrame) * 4;
    const thiefX   = canvas.width / 2;
    const thiefY   = canvas.height * (0.10 + (1 - this.distanceClosed / 100) * 0.10);
    ctx.font = `${Math.min(52, canvas.width / 12)}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🦹', thiefX, thiefY + thiefBob);

    // Distance indicator
    const distPct = this.distanceClosed / 100;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(canvas.width / 2 - 80, 10, 160, 12);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(canvas.width / 2 - 80, 10, 160 * distPct, 12);
    ctx.fillStyle = 'white';
    ctx.font = '12px Nunito, sans-serif';
    ctx.fillText('Catching up! →', canvas.width / 2, 35);

    // ---- HERO (running toward thief at bottom center) ----
    const heroBob = Math.sin(this.heroRunFrame) * 4;
    const heroY   = canvas.height * 0.72;
    ctx.font = `${Math.min(60, canvas.width / 10)}px serif`;
    ctx.fillText(App.getHeroEmoji(), canvas.width / 2, heroY + heroBob);

    // ---- PATH SIGNS (fork in road) ----
    this._renderPathSigns();

    // ---- TARGET LETTER DISPLAY ----
    this._renderTargetDisplay();

    // ---- FEEDBACK ----
    if (this.feedback) {
      ctx.globalAlpha = Math.min(1, this.feedback.life * 2);
      ctx.font = `bold ${Math.min(28, canvas.width / 22)}px Nunito, sans-serif`;
      ctx.fillStyle   = this.feedback.color;
      ctx.textAlign   = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur  = 4;
      ctx.fillText(this.feedback.text, this.feedback.x, this.feedback.y);
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }

    // ---- PARTICLES ----
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

  _drawForkRoads() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const heroX  = W / 2;
    const heroY  = H * 0.72;
    const splitY = H * 0.56; // Point where the road fans out
    const mainW  = Math.min(70, W * 0.11);
    const laneW  = Math.min(42, W * 0.07);

    // ---- Main road: bottom of screen up to split point ----
    ctx.fillStyle = '#8b6a3a';
    ctx.beginPath();
    ctx.moveTo(heroX - mainW, H * 1.02);
    ctx.lineTo(heroX + mainW, H * 1.02);
    ctx.lineTo(heroX + laneW, splitY);
    ctx.lineTo(heroX - laneW, splitY);
    ctx.closePath();
    ctx.fill();

    // Scrolling dashes on main road
    ctx.fillStyle = 'rgba(255,215,0,0.55)';
    for (let y = (this.scrollOffset % 70) - 70; y < H - splitY + 20; y += 70) {
      ctx.fillRect(heroX - 5, splitY + y, 10, 42);
    }

    // ---- Fork lane to each sign ----
    this.paths.forEach(path => {
      const tx = path.cx;
      const ty = path.cy + path.h * 0.55; // Aim at bottom half of sign

      const dx  = tx - heroX;
      const dy  = ty - splitY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      // Normal vector (perpendicular to lane direction)
      const nx = (-dy / len) * laneW * 0.95;
      const ny = ( dx / len) * laneW * 0.95;
      const sx = (-dy / len) * laneW * 0.40; // Narrower at sign end
      const sy = ( dx / len) * laneW * 0.40;

      // Lane color
      let color = '#9b7048';
      if (path.state === 'correct') color = '#3a8a3a';
      if (path.state === 'wrong')   color = '#8a3030';

      // Road surface
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(heroX + nx,  splitY + ny);
      ctx.lineTo(heroX - nx,  splitY - ny);
      ctx.lineTo(tx    - sx,  ty     - sy);
      ctx.lineTo(tx    + sx,  ty     + sy);
      ctx.closePath();
      ctx.fill();

      // Dark edge lines
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(heroX + nx, splitY + ny); ctx.lineTo(tx + sx, ty + sy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(heroX - nx, splitY - ny); ctx.lineTo(tx - sx, ty - sy);
      ctx.stroke();

      // Direction arrow pointing up each lane
      const midX  = (heroX + tx) / 2;
      const midY  = (splitY + ty) / 2;
      const angle = Math.atan2(dy, dx) - Math.PI / 2;
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(255,215,0,0.75)';
      ctx.beginPath();
      ctx.moveTo(0,  -14);
      ctx.lineTo(-9,  10);
      ctx.lineTo( 9,  10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  _renderPathSigns() {
    const { ctx } = this;
    this.paths.forEach(path => {
      let bgColor, borderColor, textColor;
      if (path.state === 'correct') {
        bgColor = 'rgba(67,160,71,0.9)'; borderColor = '#43a047'; textColor = '#fff';
      } else if (path.state === 'wrong') {
        bgColor = 'rgba(229,57,53,0.9)'; borderColor = '#e53935'; textColor = '#fff';
      } else {
        bgColor = 'rgba(50,30,10,0.85)'; borderColor = '#8b5e3c'; textColor = '#ffd700';
      }

      // Sign post
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(path.x + path.w / 2 - 6, path.y + path.h, 12, 40);

      // Sign board
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(path.x, path.y, path.w, path.h, 14);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Letter
      ctx.fillStyle = textColor;
      ctx.font = `bold ${Math.min(70, path.h * 0.65)}px Cinzel, serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = path.state === 'idle' ? '#ffd700' : 'transparent';
      ctx.shadowBlur   = path.state === 'idle' ? 12 : 0;
      ctx.fillText(path.letter, path.x + path.w / 2, path.y + path.h / 2);
      ctx.shadowBlur   = 0;

      // Small emoji hint below letter
      if (path.state === 'idle') {
        ctx.font = `${Math.min(22, path.h * 0.22)}px serif`;
        ctx.fillText(CURRICULUM.letterEmoji[path.letter], path.x + path.w / 2, path.y + path.h * 0.8);
      }
      ctx.textBaseline = 'alphabetic';
    });
  }

  _renderTargetDisplay() {
    const { ctx, canvas, targetLetter } = this;

    // Speech bubble from narrator guide
    const bx = 12, by = 100;
    const bw = Math.min(220, canvas.width * 0.32), bh = 80;

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.strokeStyle = '#7b3fc4';
    ctx.lineWidth   = 3;
    ctx.stroke();

    // Bubble tail
    ctx.beginPath();
    ctx.moveTo(bx + 20, by + bh);
    ctx.lineTo(bx + 36, by + bh + 16);
    ctx.lineTo(bx + 52, by + bh);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.strokeStyle = '#7b3fc4';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Scroll guide character
    ctx.font = '40px serif';
    ctx.textAlign = 'left';
    ctx.fillText('🧝', bx - 5, by + bh + 52);

    // Text inside bubble
    ctx.fillStyle = '#4a2f0a';
    ctx.font = `bold ${Math.min(13, canvas.width / 45)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Take the path with', bx + bw / 2, by + 26);
    ctx.fillText('this letter:', bx + bw / 2, by + 42);

    ctx.fillStyle = '#7b3fc4';
    ctx.font = `bold ${Math.min(28, canvas.width / 22)}px Cinzel, serif`;
    ctx.fillText(targetLetter, bx + bw / 2, by + 68);
  }

  _drawClouds() {
    const { ctx, canvas } = this;
    const clouds = [
      { x: 0.15, y: 0.08, s: 1 },
      { x: 0.45, y: 0.05, s: 1.3 },
      { x: 0.75, y: 0.1,  s: 0.8 },
      { x: 0.9,  y: 0.04, s: 1 }
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    clouds.forEach(c => {
      const cx = ((c.x * canvas.width - this.scrollOffset * 0.1) % (canvas.width + 100) + canvas.width + 100) % (canvas.width + 100) - 50;
      const cy = c.y * canvas.height;
      const r  = 28 * c.s;
      ctx.beginPath();
      ctx.arc(cx,       cy, r,         0, Math.PI * 2);
      ctx.arc(cx + r,   cy, r * 0.8,   0, Math.PI * 2);
      ctx.arc(cx - r,   cy, r * 0.7,   0, Math.PI * 2);
      ctx.arc(cx + r*2, cy, r * 0.65,  0, Math.PI * 2);
      ctx.fill();
    });
  }
}
