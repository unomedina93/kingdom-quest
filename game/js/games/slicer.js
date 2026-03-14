// ===== LETTER SLICER GAME =====
// Fruit Ninja-style: letters float up, slash the correct one!
// Works with mouse drag OR hand motion via MediaPipe

class SlicerGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx    = ctx;
    this.onComplete = onComplete;

    this.letters    = [];
    this.targetLetter = '';
    this.score      = 0;
    this.hearts     = 3;
    this.gameTime   = 180; // 3 relaxed minutes — no rush
    this.maxScore   = 10;  // End after 10 correct answers instead of by timer
    this.elapsed    = 0;
    this.running    = false;

    // Slash trail
    this.trail      = [];
    this.MAX_TRAIL  = 18;
    this.slashFlash = null; // { x1,y1,x2,y2,life }

    // Particles on slice
    this.particles  = [];

    // Letters from curriculum (current difficulty)
    this.letterPool = [];
    this.usedLetters = new Set();

    // Spawn timing — unhurried, relaxed pacing
    this.spawnTimer   = 0;
    this.spawnInterval = 3.5; // calm pace — plenty of time to think

    // Input handlers
    this._onMouseMove  = (e) => this._handlePointer(e.clientX, e.clientY);
    this._onTouchMove  = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this._handlePointer(t.clientX, t.clientY);
    };
    this._motionHandler = (x, y, vel) => this._handlePointer(x, y);

    this._rafId    = null;
    this._lastTime = 0;
  }

  start() {
    this._resize();
    window.addEventListener('resize', () => this._resize());

    const diff = App.difficulty;
    const group = CURRICULUM.difficulty[diff].letters;
    this.letterPool = CURRICULUM.letterGroups[group].slice();

    this.score   = 0;
    this.hearts  = 3;
    this.elapsed = 0;
    this.letters = [];
    this.particles = [];
    this.trail   = [];
    this.usedLetters.clear();
    this.running = true;
    this.spawnTimer = 0;

    // Hide corner PiP — camera feed will be the full game background instead
    if (Motion.enabled) {
      const pip = document.getElementById('camera-feed');
      if (pip) pip.classList.remove('visible');
    }

    this._pickTarget();

    // Input listeners
    this.canvas.addEventListener('mousemove',  this._onMouseMove);
    this.canvas.addEventListener('touchmove',  this._onTouchMove, { passive: false });
    Motion.onMove(this._motionHandler);

    App.setHUDTitle('Letter Battle ⚔️');
    App.updateHUDScore(0);
    App.updateHUDHearts(3);

    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    Motion.offMove(this._motionHandler);
    window.removeEventListener('resize', () => this._resize());
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();

    // Restore corner PiP if camera is still active
    if (Motion.enabled) {
      const pip = document.getElementById('camera-feed');
      if (pip) pip.classList.add('visible');
    }
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
    this.elapsed    += dt;
    this.spawnTimer += dt;

    // Spawn letters
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawnLetters();
    }

    // Speed stays calm — very gentle increase over time
    const speedMult = 1 + this.elapsed / 300;

    // Update letters
    this.letters.forEach(l => {
      l.x  += l.vx * dt;
      l.y  += l.vy * speedMult * dt;
      l.rot += l.rotSpeed * dt;
      l.scale = 1 + Math.sin(Date.now() / 400 + l.phase) * 0.05;

      // Bounce off walls
      if (l.x < 60 || l.x > this.canvas.width - 60) l.vx *= -1;
    });

    // Remove letters that flew past top or are sliced
    const before = this.letters.length;
    this.letters = this.letters.filter(l => {
      if (l.sliced) return false;
      if (l.y < -100) {
        // Missed target letter = lose heart
        if (l.isTarget) {
          this._loseHeart();
          // Respawn target immediately
          this._pickTarget();
        }
        return false;
      }
      return true;
    });

    // Update particles
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt;
    });

    // Fade slash flash
    if (this.slashFlash) {
      this.slashFlash.life -= dt * 4;
      if (this.slashFlash.life <= 0) this.slashFlash = null;
    }

    // Trim old trail points
    const now = Date.now();
    this.trail = this.trail.filter(p => now - p.t < 200);

    // End after 10 correct answers (not by clock — no time pressure)
    if (this.score >= this.maxScore) {
      this._endGame();
    }

    // Check hearts
    if (this.hearts <= 0) {
      this._endGame();
    }
  }

  _handlePointer(x, y) {
    const now = Date.now();
    this.trail.push({ x, y, t: now });
    if (this.trail.length > this.MAX_TRAIL) this.trail.shift();

    // Check for slash (need 2 points close in time but fast)
    if (this.trail.length >= 2) {
      const p1 = this.trail[this.trail.length - 2];
      const p2 = this.trail[this.trail.length - 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 15) {
        // Fast movement — check collision with letters
        this.letters.forEach((letter, idx) => {
          if (letter.sliced) return;
          const lx = letter.x, ly = letter.y;
          const r  = letter.size * 0.6;
          if (this._lineCircleIntersect(p1, p2, lx, ly, r)) {
            if (letter.isTarget) {
              this._hitTarget(idx, lx, ly);
            } else {
              this._hitDecoy(idx, lx, ly);
            }
          }
        });

        // Draw slash flash
        this.slashFlash = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, life: 1 };
      }
    }
  }

  _lineCircleIntersect(p1, p2, cx, cy, r) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - cx;
    const fy = p1.y - cy;
    const a  = dx * dx + dy * dy;
    const b  = 2 * (fx * dx + fy * dy);
    const c  = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    disc = Math.sqrt(disc);
    const t1 = (-b - disc) / (2 * a);
    const t2 = (-b + disc) / (2 * a);
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }

  _hitTarget(idx, x, y) {
    this.letters[idx].sliced = true;
    this.score++;
    Audio.playSuccess();
    Audio.playSlice();

    this._spawnParticles(x, y, '#ffd700', 20);
    this._spawnParticles(x, y, '#ffffff', 10);

    App.updateHUDScore(this.score);

    // Announce next target
    setTimeout(() => {
      this._pickTarget();
      this._announceTarget();
    }, 600);
  }

  _hitDecoy(idx, x, y) {
    this.letters[idx].sliced = true;
    Audio.playWrong();
    this._spawnParticles(x, y, '#ff4444', 12);
    this._loseHeart();
  }

  _loseHeart() {
    this.hearts = Math.max(0, this.hearts - 1);
    App.updateHUDHearts(this.hearts);
    if (this.hearts <= 0) {
      setTimeout(() => this._endGame(), 500);
    }
  }

  _pickTarget() {
    const pool = this.letterPool.filter(l => !this.usedLetters.has(l));
    if (pool.length === 0) { this.usedLetters.clear(); }
    const available = pool.length > 0 ? pool : this.letterPool;
    this.targetLetter = available[Math.floor(Math.random() * available.length)];
    this.usedLetters.add(this.targetLetter);

    // Update isTarget on all letters already on screen so any existing copy of
    // the new target counts, and the old target letters no longer count.
    this.letters.forEach(l => {
      l.isTarget  = l.letter === this.targetLetter;
      l.colorMain = l.isTarget ? '#ffd700' : '#4a90d9';
      l.colorBg   = l.isTarget ? '#7b3fc4' : '#1a3a6a';
    });

    this._announceTarget();
  }

  _announceTarget() {
    Audio.speak(`Slice the letter ${this.targetLetter}!`, { interrupt: true });
  }

  _spawnLetters() {
    // Spawn the target letter
    this._spawnLetter(this.targetLetter, true, '#ffd700', '#7b3fc4');

    // Spawn 1-2 decoys
    const diff = App.difficulty;
    const numDecoys = diff === 'easy' ? 1 : diff === 'medium' ? 2 : 2;
    for (let i = 0; i < numDecoys; i++) {
      const decoys = this.letterPool.filter(l => l !== this.targetLetter);
      const decoy  = decoys[Math.floor(Math.random() * decoys.length)];
      this._spawnLetter(decoy, false, '#4a90d9', '#1a3a6a');
    }
  }

  _spawnLetter(letter, isTarget, colorMain, colorBg) {
    const size  = Math.min(80, Math.max(55, this.canvas.width / 12));
    const x     = 80 + Math.random() * (this.canvas.width - 160);
    const speed = CURRICULUM.difficulty[App.difficulty].slicerSpeed;
    this.letters.push({
      letter, isTarget,
      x, y: this.canvas.height + size,
      vx: (Math.random() - 0.5) * 60,
      vy: -(speed * 120 + Math.random() * 60),
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 2,
      size,
      scale: 1,
      phase: Math.random() * Math.PI * 2,
      sliced: false,
      colorMain, colorBg
    });
  }

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        color,
        life: 0.6 + Math.random() * 0.6,
        size: 4 + Math.random() * 8
      });
    }
  }

  _endGame() {
    this.running = false;
    this.stop();

    const stars = this.hearts === 3 ? 3 : this.hearts > 0 ? 2 : 1;
    Audio.speak(`Great job! You sliced ${this.score} letters!`, { interrupt: true });
    App.showOverlay('⭐', `You got ${this.score} letters right!`, `Claim ${stars} Stars!`, () => {
      this.onComplete(stars);
    });
  }

  _render() {
    const { ctx, canvas } = this;

    // Background — camera feed when active, otherwise castle battle arena gradient
    const videoEl = document.getElementById('camera-feed');
    if (Motion.enabled && videoEl && videoEl.readyState >= 2) {
      // Draw mirrored camera feed to fill the canvas
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      // Dark overlay so letters stay readable against any background
      ctx.fillStyle = 'rgba(0, 0, 20, 0.52)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grd.addColorStop(0, '#0d0020');
      grd.addColorStop(0.6, '#1a0538');
      grd.addColorStop(1, '#2d1b0e');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Ground
    ctx.fillStyle = Motion.enabled ? 'rgba(61,42,14,0.7)' : '#3d2a0e';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    // Target display (top center)
    this._renderTargetDisplay();

    // Calm progress bar (score-based, not timer)
    const pct = this.score / this.maxScore;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, canvas.width, 8);
    ctx.fillStyle = '#7b3fc4';
    ctx.fillRect(0, 0, canvas.width * pct, 8);

    // Letters
    this.letters.forEach(l => {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.scale(l.scale, l.scale);

      const r = l.size * 0.65;

      // Background circle
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = l.colorBg;
      ctx.fill();
      ctx.strokeStyle = l.colorMain;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glow for target
      if (l.isTarget) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur  = 20;
      }

      // Letter
      ctx.fillStyle = 'white';
      ctx.font = `bold ${l.size * 0.7}px Cinzel, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.letter, 0, 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Slash trail
    if (this.trail.length > 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 4;
      ctx.lineCap   = 'round';
      ctx.lineJoin  = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      this.trail.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.restore();
    }

    // Slash flash
    if (this.slashFlash && this.slashFlash.life > 0) {
      const sf = this.slashFlash;
      ctx.save();
      ctx.globalAlpha = sf.life;
      ctx.strokeStyle = '#ffffffcc';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.moveTo(sf.x1, sf.y1);
      ctx.lineTo(sf.x2, sf.y2);
      ctx.stroke();
      ctx.restore();
    }

    // Particles
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

  _renderTargetDisplay() {
    const { ctx, canvas, targetLetter } = this;

    // Box
    const bw = 180, bh = 90;
    const bx = canvas.width / 2 - bw / 2;
    const by = 50;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 16);
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#aaa';
    ctx.font = '14px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SLICE THIS LETTER', canvas.width / 2, by + 22);

    // Big target letter
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold 52px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 16;
    ctx.fillText(targetLetter, canvas.width / 2, by + 72);
    ctx.shadowBlur = 0;

    // Letter emoji hint
    const emoji = CURRICULUM.letterEmoji[targetLetter];
    ctx.font = '22px serif';
    ctx.fillStyle = 'white';
    ctx.fillText(emoji, canvas.width / 2 + 70, by + 72);
  }
}
