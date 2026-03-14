// ===== GEM SORT GAME =====
// Gems float down one at a time — tap the matching treasure chest!
// Teaches color recognition and simple sorting.

const GEM_TYPES = [
  { emoji: '🔴', name: 'Red',    bucket: 0, color: '#ef4444' },
  { emoji: '💛', name: 'Yellow', bucket: 1, color: '#facc15' },
  { emoji: '💙', name: 'Blue',   bucket: 2, color: '#3b82f6' },
];

const GEM_HARD_TYPES = [
  { emoji: '🔴', name: 'Red',    bucket: 0, color: '#ef4444' },
  { emoji: '💛', name: 'Yellow', bucket: 1, color: '#facc15' },
  { emoji: '💙', name: 'Blue',   bucket: 2, color: '#3b82f6' },
  { emoji: '💚', name: 'Green',  bucket: 3, color: '#22c55e' },
];

const GEM_ROUNDS = { easy: 8, medium: 12, hard: 16 };
const GEM_SPEED  = { easy: 0.08, medium: 0.12, hard: 0.16 }; // fraction of screen/sec

class GemSortGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this.running    = false;
    this.particles  = [];

    this.gemTypes   = GEM_TYPES;
    this.buckets    = [];   // [{emoji, color, label, x, y, w, h, flash, flashTimer}]
    this.gem        = null; // {emoji, name, bucket, color, x, y, size, speed}
    this.score      = 0;
    this.totalGems  = 8;
    this.gemCount   = 0;
    this.locked     = false;

    this._onClick = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this._handleClick(
        (e.clientX - r.left) * (this.canvas.width  / r.width),
        (e.clientY - r.top)  * (this.canvas.height / r.height)
      );
    };
    this._onTouch = (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      this._handleClick(
        (t.clientX - r.left) * (this.canvas.width  / r.width),
        (t.clientY - r.top)  * (this.canvas.height / r.height)
      );
    };

    this._rafId    = null;
    this._lastTime = 0;
  }

  // =====================================================================
  //  LIFECYCLE
  // =====================================================================

  start() {
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this._buildBuckets(); });
    this.running   = true;
    this.particles = [];
    this.score     = 0;
    this.gemCount  = 0;
    this.locked    = false;
    this.totalGems = GEM_ROUNDS[App.difficulty] || 8;
    this.gemTypes  = App.difficulty === 'hard' ? GEM_HARD_TYPES : GEM_TYPES;

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });

    App.setHUDTitle('Gem Sort 💎');
    App.updateHUDScore(0);
    App.updateHUDHearts('');

    this._buildBuckets();
    this._nextGem();

    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('click',    this._onClick);
    this.canvas.removeEventListener('touchend', this._onTouch);
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.buckets.length) this._buildBuckets();
  }

  // =====================================================================
  //  SETUP
  // =====================================================================

  _buildBuckets() {
    const { canvas } = this;
    const W = canvas.width, H = canvas.height;
    const count  = this.gemTypes.length;
    const bW     = Math.min(Math.floor((W - 20) / count) - 12, 140);
    const bH     = Math.min(bW * 1.2, 160);
    const totalW = count * bW + (count - 1) * 14;
    const startX = (W - totalW) / 2;
    const bY     = H - bH - 20;

    this.buckets = this.gemTypes.map((gt, i) => ({
      emoji: gt.emoji, color: gt.color, label: gt.name,
      x: startX + i * (bW + 14),
      y: bY, w: bW, h: bH,
      index: gt.bucket,
      flash: false, flashTimer: 0, wrongFlash: false,
    }));
  }

  _nextGem() {
    if (this.gemCount >= this.totalGems) return;
    const type = this.gemTypes[Math.floor(Math.random() * this.gemTypes.length)];
    const sz   = Math.min(this.canvas.width * 0.14, 90);

    this.gem = {
      ...type,
      x: this.canvas.width / 2,
      y: 90 + sz / 2,
      size: sz,
      settling: false,  // true while waiting for player to tap
    };
    this.locked = false;

    Audio.speak(`${type.name} gem! Put it in the ${type.name} chest!`, { interrupt: true });
  }

  // =====================================================================
  //  CLICK HANDLING
  // =====================================================================

  _handleClick(x, y) {
    if (!this.gem || this.locked) return;

    for (const bucket of this.buckets) {
      if (x >= bucket.x && x <= bucket.x + bucket.w &&
          y >= bucket.y && y <= bucket.y + bucket.h) {

        if (bucket.index === this.gem.bucket) {
          // Correct!
          this.locked = true;
          bucket.flash = true; bucket.flashTimer = 0.4;
          this.score++;
          this.gemCount++;
          App.updateHUDScore(this.score);
          Audio.playSuccess();
          this._burst(bucket.x + bucket.w / 2, bucket.y + bucket.h / 2, bucket.color);

          const last = this.gemCount >= this.totalGems;
          if (last) {
            Audio.speak('You sorted all the gems! Amazing!', {
              interrupt: true, onEnd: () => this._endGame(),
            });
          } else {
            Audio.speak(`${this.gem.name}! Perfect!`, {
              onEnd: () => {
                this.gem = null;
                setTimeout(() => this._nextGem(), 200);
              },
            });
          }
        } else {
          // Wrong bucket
          bucket.wrongFlash = true; bucket.flashTimer = 0.4;
          Audio.playWrong();
          setTimeout(() => { bucket.wrongFlash = false; }, 500);
          Audio.speak(`Try again! Put it in the ${this.gem.name} chest!`);
        }
        break;
      }
    }
  }

  // =====================================================================
  //  PARTICLES & END
  // =====================================================================

  _burst(cx, cy, color) {
    const colors = [color, '#ffd700', '#ffffff', color];
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 160,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.6 + Math.random() * 0.6,
        size: 6 + Math.random() * 10,
      });
    }
  }

  _endGame() {
    this.running = false;
    this.stop();
    App.showOverlay('💎', 'Gem Sorter!', 'Claim Stars! ⭐', () => {
      this.onComplete(3);
    });
  }

  // =====================================================================
  //  LOOP
  // =====================================================================

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    // Update bucket flash timers
    this.buckets.forEach(b => {
      if (b.flashTimer > 0) {
        b.flashTimer -= dt;
        if (b.flashTimer <= 0) { b.flash = false; b.wrongFlash = false; }
      }
    });

    // Particles
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 320 * dt; p.life -= dt;
    });
  }

  // =====================================================================
  //  RENDER
  // =====================================================================

  _render() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;

    // Background — cave/treasure room feel
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#1a0a00');
    grd.addColorStop(0.6, '#2d1a00');
    grd.addColorStop(1, '#1a0500');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Stone texture lines
    ctx.strokeStyle = 'rgba(255,200,100,0.06)';
    ctx.lineWidth = 1;
    for (let y = 80; y < H - 180; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Instruction
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${Math.min(20, W / 18)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Tap the matching treasure chest! 💎', W / 2, 52);

    // Gem counter
    ctx.fillStyle = 'rgba(255,220,150,0.6)';
    ctx.font = `${Math.min(15, W / 24)}px Nunito, sans-serif`;
    ctx.fillText(`${this.gemCount} / ${this.totalGems} gems sorted`, W / 2, H - 195);

    // Current gem (floating in upper area)
    if (this.gem) {
      const g = this.gem;
      const pulse = 1 + Math.sin(Date.now() / 300) * 0.06;

      // Glow ring
      ctx.save();
      ctx.shadowColor = g.color;
      ctx.shadowBlur  = 30 * pulse;
      ctx.fillStyle   = g.color + '30';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.size * 0.72 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Gem emoji
      ctx.font = `${g.size}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.emoji, g.x, g.y);
      ctx.textBaseline = 'alphabetic';

      // Arrow pointing down
      const bob = Math.sin(Date.now() / 280) * 6;
      ctx.font = `${Math.min(32, W / 14)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('👇', g.x, g.y + g.size * 0.72 + bob);
      ctx.textBaseline = 'alphabetic';
    }

    // Treasure chests / buckets
    this.buckets.forEach(b => {
      ctx.save();

      const isFlash  = b.flash      && b.flashTimer > 0;
      const isWrong  = b.wrongFlash && b.flashTimer > 0;
      const pulse    = isFlash ? 1 + Math.sin(b.flashTimer * 20) * 0.06 : 1;

      // Chest background
      const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      if (isFlash) {
        grad.addColorStop(0, b.color + 'cc');
        grad.addColorStop(1, b.color + '88');
      } else if (isWrong) {
        grad.addColorStop(0, '#7f1d1d'); grad.addColorStop(1, '#991b1b');
      } else {
        grad.addColorStop(0, '#1c0a00'); grad.addColorStop(1, '#2d1400');
      }
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w * pulse, b.h * pulse, 14); ctx.fill();

      // Chest border
      ctx.strokeStyle = isFlash ? b.color
                      : isWrong ? '#f87171'
                      : b.color + '66';
      ctx.lineWidth = isFlash ? 3.5 : 2;
      if (isFlash) { ctx.shadowColor = b.color; ctx.shadowBlur = 20; }
      ctx.stroke(); ctx.shadowBlur = 0;

      // Gem emoji icon
      const iconSz = Math.min(b.w * 0.50, b.h * 0.44, 52);
      ctx.font = `${iconSz}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.emoji, b.x + b.w / 2, b.y + b.h * 0.38);

      // Color label
      ctx.fillStyle = isFlash ? '#ffffff' : b.color;
      ctx.font = `bold ${Math.min(13, b.w / 5)}px Nunito, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h - 10);

      ctx.restore();
    });

    // Particles
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
}
