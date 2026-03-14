// ===== FRUIT CATCHER =====
// Fruits fall from the sky! Move the basket left/right to catch them.
// Touch left/right halves of screen. Teaches reflexes and color/fruit names.

class FruitCatcherGame {
  static FRUITS = [
    { emoji: '🍎', name: 'apple',  color: '#e53935' },
    { emoji: '🍌', name: 'banana', color: '#fdd835' },
    { emoji: '🍊', name: 'orange', color: '#fb8c00' },
    { emoji: '🍇', name: 'grapes', color: '#8e24aa' },
    { emoji: '🍓', name: 'strawberry', color: '#e91e63' },
    { emoji: '🍉', name: 'watermelon', color: '#43a047' },
    { emoji: '🍋', name: 'lemon',  color: '#ffee58' },
    { emoji: '⭐', name: 'star',   color: '#ffd700' },
  ];

  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;
    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;

    this.score      = 0;
    this.misses     = 0;
    this.maxMisses  = 5;
    this.round      = 0;
    this.fruits     = [];
    this.particles  = [];
    this.spawnTimer = 0;
    this.basket     = { x: 0, y: 0, w: 110, h: 55, moving: 0 }; // moving: -1 left, 0 still, 1 right

    this._holdLeft  = false;
    this._holdRight = false;

    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchEnd   = this._onTouchEnd.bind(this);
    this._boundClick      = this._onClick.bind(this);
  }

  start(roundIndex = 0) {
    this.round      = roundIndex % 5;
    this._running   = true;
    this.score      = 0;
    this.misses     = 0;
    this.fruits     = [];
    this.particles  = [];
    this.spawnTimer = 1.0;
    this._holdLeft  = false;
    this._holdRight = false;

    const W = this.canvas.width, H = this.canvas.height;
    this.basket.x = W / 2;
    this.basket.y = H - 70;

    document.addEventListener('touchstart',  this._boundTouchStart, { passive: false });
    document.addEventListener('touchend',    this._boundTouchEnd,   { passive: false });
    document.addEventListener('click',       this._boundClick);

    App.setHUDTitle('Fruit Catcher!');
    App.updateHUDScore(0);
    Audio.speak('Catch the falling fruits!', { rate: 0.9 });
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    document.removeEventListener('touchstart',  this._boundTouchStart);
    document.removeEventListener('touchend',    this._boundTouchEnd);
    document.removeEventListener('click',       this._boundClick);
  }

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.05);
    this._lastTs = ts;
    this._update(dt);
    this._render();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    const W = this.canvas.width, H = this.canvas.height;
    const speed = 280 + this.round * 30;

    // Move basket
    if (this._holdLeft)  this.basket.x -= speed * dt;
    if (this._holdRight) this.basket.x += speed * dt;
    this.basket.x = Math.max(this.basket.w / 2, Math.min(W - this.basket.w / 2, this.basket.x));

    // Spawn fruits
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const interval = Math.max(0.6, 1.5 - this.round * 0.15);
      this.spawnTimer = interval + Math.random() * 0.4;
      const ft = FruitCatcherGame.FRUITS[Math.floor(Math.random() * FruitCatcherGame.FRUITS.length)];
      this.fruits.push({
        x: 40 + Math.random() * (W - 80),
        y: -40,
        vy: 120 + this.round * 25 + Math.random() * 40,
        fruit: ft,
        size: 36,
        announced: false,
      });
    }

    // Update fruits
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.y += f.vy * dt;

      if (!f.announced && f.y > 60) {
        f.announced = true;
        Audio.speak(f.fruit.name + '!', { rate: 1.0 });
      }

      // Check catch
      const bx = this.basket.x, by = this.basket.y;
      const bw = this.basket.w / 2, bh = this.basket.h / 2;
      if (Math.abs(f.x - bx) < bw + 10 && f.y > by - bh - 10 && f.y < by + bh) {
        // Caught!
        this._spawnCatchParticles(f.x, f.y, f.fruit.color);
        Audio.playSuccess();
        this.score++;
        App.updateHUDScore(this.score);
        if (this.score % 5 === 0) Audio.speak('Amazing!', { rate: 1.0, interrupt: true });
        this.fruits.splice(i, 1);

        if (this.score >= 15 + this.round * 5) this._nextRound();
        continue;
      }

      // Missed
      if (f.y > H + 60) {
        this.fruits.splice(i, 1);
        this.misses++;
        Audio.playWrong();
        if (this.misses >= this.maxMisses) this._nextRound();
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _spawnCatchParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 100;
      this.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80,
        color, r: 4 + Math.random() * 5, life: 0.5 + Math.random() * 0.3,
      });
    }
  }

  _nextRound() {
    this.round++;
    if (this.round >= 5) {
      Audio.speak("You caught so many fruits! Amazing job!", { rate: 0.9, interrupt: true });
      setTimeout(() => this.onComplete(3), 2500);
    } else {
      Audio.speak("Great catching! Here come faster fruits!", { rate: 0.9, interrupt: true });
      this.score = 0; this.misses = 0; this.fruits = [];
      App.updateHUDScore(0);
    }
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;

    // Sky gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#87ceeb'); bg.addColorStop(0.7, '#b3e5fc'); bg.addColorStop(1, '#4caf50');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Ground strip
    ctx.fillStyle = '#388e3c';
    ctx.fillRect(0, H - 30, W, 30);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const t = Date.now() / 8000;
    for (const [cx, cy, sr] of [[W*0.15+Math.sin(t)*20, H*0.12, 1.0],[W*0.55+Math.sin(t+1)*15, H*0.08, 0.8],[W*0.8+Math.sin(t+2)*18, H*0.15, 0.9]]) {
      ctx.beginPath(); ctx.arc(cx, cy, 28*sr, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+20*sr, cy-8*sr, 22*sr, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx-18*sr, cy-5*sr, 20*sr, 0, Math.PI*2); ctx.fill();
    }

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / 0.8);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Fruits
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.fruits) {
      ctx.save();
      ctx.font = `${f.size * 2}px sans-serif`;
      ctx.fillText(f.fruit.emoji, f.x, f.y);
      ctx.restore();
    }

    // Basket
    const bx = this.basket.x, by = this.basket.y;
    const bw = this.basket.w, bh = this.basket.h;
    ctx.save();
    // Basket body
    ctx.fillStyle = '#a0522d';
    ctx.beginPath();
    ctx.moveTo(bx - bw/2, by - bh/2);
    ctx.lineTo(bx + bw/2, by - bh/2);
    ctx.lineTo(bx + bw/2 - 12, by + bh/2);
    ctx.lineTo(bx - bw/2 + 12, by + bh/2);
    ctx.closePath(); ctx.fill();
    // Basket weave highlight
    ctx.strokeStyle = '#8b4513'; ctx.lineWidth = 2;
    for (let row = 1; row < 3; row++) {
      ctx.beginPath();
      ctx.moveTo(bx - bw/2 + (12 * row/3), by - bh/2 + bh * row/3);
      ctx.lineTo(bx + bw/2 - (12 * row/3), by - bh/2 + bh * row/3);
      ctx.stroke();
    }
    // Rim
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(bx - bw/2 - 4, by - bh/2 - 8, bw + 8, 12);
    ctx.restore();

    // Hearts (lives)
    ctx.save();
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const hearts = Math.max(0, this.maxMisses - this.misses);
    ctx.fillText('❤️'.repeat(hearts), 10, 48);
    ctx.restore();

    // Touch zones (subtle)
    ctx.save();
    ctx.globalAlpha = 0.08;
    if (this._holdLeft)  { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W/2, H); }
    if (this._holdRight) { ctx.fillStyle = '#fff'; ctx.fillRect(W/2, 0, W/2, H); }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Control hint
    ctx.save();
    ctx.font = 'bold 15px "Fredoka One","Nunito",sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('← Tap left or right to move basket →', W/2, H - 35);
    ctx.restore();

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  _onClick(e) {
    if (!this._running) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const W = this.canvas.width * (rect.width / this.canvas.width);
    if (x < rect.width / 2) this._nudge(-1);
    else this._nudge(1);
  }

  _nudge(dir) {
    this.basket.x += dir * 60;
    const W = this.canvas.width;
    this.basket.x = Math.max(this.basket.w / 2, Math.min(W - this.basket.w / 2, this.basket.x));
  }

  _onTouchStart(e) {
    if (!this._running) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    for (const t of e.touches) {
      const x = t.clientX - rect.left;
      if (x < rect.width / 2) this._holdLeft = true;
      else this._holdRight = true;
    }
  }

  _onTouchEnd(e) {
    if (!this._running) return;
    const rect = this.canvas.getBoundingClientRect();
    this._holdLeft = false; this._holdRight = false;
    for (const t of e.touches) {
      const x = t.clientX - rect.left;
      if (x < rect.width / 2) this._holdLeft = true;
      else this._holdRight = true;
    }
  }
}
