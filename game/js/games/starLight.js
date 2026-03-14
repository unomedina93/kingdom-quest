class StarLightGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.onComplete = onComplete;
    this._rafId = null;
    this._running = false;
    this._lastTs = 0;
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);

    this._round = 0;
    this._starCounts = [10, 14, 18];
    this._stars = [];
    this._particles = [];
    this._litCount = 0;
    this._celebrating = false;
    this._celebrationTimer = 0;
    this._bgStars = [];
    this._countingNames = [
      'One', 'Two', 'Three', 'Four', 'Five',
      'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
      'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen'
    ];
  }

  start() {
    this._running = true;
    App.setHUDTitle('Star Light');
    App.updateHUDScore(0);
    this.canvas.addEventListener('click', this._boundClick);
    this.canvas.addEventListener('touchstart', this._boundTouch, { passive: true });
    this._generateBgStars();
    this._startRound();
    Audio.speak('Tap the stars to light them up!', { rate: 0.85 });
    this._lastTs = performance.now();
    this._rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this.canvas.removeEventListener('click', this._boundClick);
    this.canvas.removeEventListener('touchstart', this._boundTouch);
  }

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.1);
    this._lastTs = ts;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(ts2 => this._loop(ts2));
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this._handleTap((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  }

  _onTouch(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    const t = e.changedTouches[0];
    this._handleTap((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
  }

  _generateBgStars() {
    this._bgStars = [];
    for (let i = 0; i < 80; i++) {
      this._bgStars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.1
      });
    }
  }

  _startRound() {
    this._litCount = 0;
    this._celebrating = false;
    this._celebrationTimer = 0;
    this._particles = [];
    const count = this._starCounts[this._round];
    this._stars = this._generateStars(count);
    App.updateHUDScore(0);
  }

  _generateStars(count) {
    const stars = [];
    const minDist = 65;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const marginX = 50;
    const marginTop = 90;
    const marginBottom = 60;
    let attempts = 0;

    while (stars.length < count && attempts < 3000) {
      attempts++;
      const x = marginX + Math.random() * (W - marginX * 2);
      const y = marginTop + Math.random() * (H - marginTop - marginBottom);
      let tooClose = false;
      for (const s of stars) {
        const dx = s.x - x;
        const dy = s.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) { tooClose = true; break; }
      }
      if (!tooClose) {
        stars.push({
          x, y,
          lit: false,
          scale: 1,
          scaleTimer: 0,
          twinklePhase: Math.random() * Math.PI * 2,
          glowPulse: Math.random() * Math.PI * 2
        });
      }
    }
    return stars;
  }

  _handleTap(x, y) {
    if (this._celebrating) return;

    for (const star of this._stars) {
      if (star.lit) continue;
      const dx = x - star.x;
      const dy = y - star.y;
      if (Math.sqrt(dx * dx + dy * dy) < 28) {
        star.lit = true;
        star.scale = 1.5;
        star.scaleTimer = 0.3;
        this._litCount++;
        App.updateHUDScore(this._litCount);
        Audio.playPop();
        this._spawnParticles(star.x, star.y);

        const name = this._countingNames[this._litCount - 1] || String(this._litCount);
        const totalInRound = this._starCounts[this._round];

        if (this._litCount === totalInRound) {
          this._celebrating = true;
          this._celebrationTimer = 2.2;
          Audio.playSuccess();
          setTimeout(() => {
            Audio.speak("You lit up all the stars! God made every star!", { rate: 0.9 });
          }, 400);
        } else {
          const suffix = this._litCount === 1 ? 'star!' : 'stars!';
          Audio.speak(name + ' ' + suffix, { rate: 0.9, interrupt: true });
        }
        break;
      }
    }
  }

  _spawnParticles(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 80 + Math.random() * 60;
      this._particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: 1.0,
        r: 3 + Math.random() * 3
      });
    }
  }

  _update(dt) {
    for (const star of this._stars) {
      if (star.scaleTimer > 0) {
        star.scaleTimer -= dt;
        const t = Math.max(0, star.scaleTimer / 0.3);
        star.scale = 1 + 0.5 * t;
      } else {
        star.scale = 1;
      }
      star.twinklePhase += dt * 3;
      star.glowPulse += dt * 2;
    }

    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
      p.vx *= 0.98;
      p.life -= dt * 1.2;
      if (p.life <= 0) this._particles.splice(i, 1);
    }

    if (this._celebrating) {
      this._celebrationTimer -= dt;
      if (this._celebrationTimer <= 0) {
        this._round++;
        if (this._round >= 3) {
          this.stop();
          this.onComplete(3);
          return;
        }
        this._startRound();
      }
    }
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(1, '#1a1a4e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (const bs of this._bgStars) {
      ctx.globalAlpha = bs.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.floor(bs.x), Math.floor(bs.y), Math.ceil(bs.size), Math.ceil(bs.size));
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ccccff';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#8888ff';
    ctx.shadowBlur = 8;
    ctx.fillText('Tap the stars to light them up!', W / 2, 36);
    ctx.restore();

    ctx.save();
    ctx.font = '16px Arial';
    ctx.fillStyle = '#aaaacc';
    ctx.textAlign = 'center';
    ctx.fillText('Round ' + (this._round + 1) + ' of 3', W / 2, 60);
    ctx.restore();

    const now = performance.now() / 1000;
    for (const star of this._stars) {
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.scale(star.scale, star.scale);

      if (star.lit) {
        const pulse = 0.7 + 0.3 * Math.sin(star.glowPulse);
        const celebFactor = this._celebrating
          ? 0.5 + 0.5 * Math.sin(now * 14 + star.twinklePhase)
          : 1;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = (18 + 14 * pulse) * celebFactor;
        ctx.fillStyle = '#ffd700';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#555577';
      }

      this._drawStar5(ctx, 0, 0, 18, 7);
      ctx.restore();
    }

    for (const p of this._particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this._celebrating) {
      ctx.save();
      const elapsed = 2.2 - this._celebrationTimer;
      const fadeIn = Math.min(1, elapsed / 0.5);
      ctx.globalAlpha = fadeIn;
      ctx.font = 'bold 30px Arial';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 20;
      ctx.fillText('All stars lit! ✨', W / 2, H / 2);
      ctx.restore();
    }
  }

  _drawStar5(ctx, cx, cy, outerR, innerR) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}
