// ===== BUBBLE POP =====
// Translucent pastel bubbles float upward — tap to pop them all!
// 5 rounds with increasing bubble count.

class BubblePopGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.onComplete = onComplete;

    this._rafId = null;
    this._lastTs = 0;
    this._running = false;

    this.round = 1;
    this.maxRounds = 5;
    this.popCount = 0;
    this.totalPops = 0;

    this._bubblesPerRound = [6, 8, 10, 12, 15];

    this.bubbles = [];
    this.particles = [];
    this.popAnimations = [];

    this._roundClearing = false;
    this._roundClearTimer = 0;

    this._colors = [
      '#ff9eb5', '#ffcf77', '#a8e6cf', '#aecbfa',
      '#d7aefb', '#f4a261', '#b5ead7', '#ffd6e0',
    ];

    this._bgGrad = null;
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);
  }

  start() {
    this._running = true;
    this.round = 1;
    this.popCount = 0;
    this.totalPops = 0;
    this._roundClearing = false;

    App.setHUDTitle('Bubble Pop!');
    App.updateHUDScore(0);

    this.canvas.addEventListener('click', this._boundClick);
    this.canvas.addEventListener('touchstart', this._boundTouch, { passive: true });

    this._buildBgGradient();
    this._spawnRound();

    Audio.speak('Pop the bubbles!', { rate: 0.9 });

    this._lastTs = performance.now();
    this._rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this.canvas.removeEventListener('click', this._boundClick);
    this.canvas.removeEventListener('touchstart', this._boundTouch);
  }

  _buildBgGradient() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, '#87ceeb');
    grad.addColorStop(1, '#b0e0ff');
    this._bgGrad = grad;
  }

  _spawnRound() {
    this.bubbles = [];
    this.particles = [];
    this.popAnimations = [];
    this._roundClearing = false;
    const count = this._bubblesPerRound[this.round - 1];
    for (let i = 0; i < count; i++) this._spawnBubble(true);
  }

  _spawnBubble(initialPlacement) {
    const r = 25 + Math.random() * 20;
    const color = this._colors[Math.floor(Math.random() * this._colors.length)];
    const x = r + Math.random() * (this.canvas.width - r * 2);
    const y = initialPlacement
      ? this.canvas.height * 0.3 + Math.random() * this.canvas.height * 0.7
      : this.canvas.height + r + Math.random() * 80;
    this.bubbles.push({
      x, y, r, color,
      speedY: 30 + Math.random() * 40,
      driftFreq: 0.5 + Math.random() * 1.5,
      driftAmp: 15 + Math.random() * 25,
      driftOffset: Math.random() * Math.PI * 2,
      age: 0, popped: false,
    });
  }

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.1);
    this._lastTs = ts;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(ts2 => this._loop(ts2));
  }

  _update(dt) {
    if (this._roundClearing) {
      this._roundClearTimer -= dt;
      if (this._roundClearTimer <= 0) {
        this._roundClearing = false;
        this.round++;
        if (this.round > this.maxRounds) {
          this.stop();
          this.onComplete(3);
          return;
        }
        this._spawnRound();
        Audio.speak('Round ' + this.round + '! Amazing!', { rate: 0.9 });
      }
      this._tickParticles(dt);
      this._tickPopAnims(dt);
      return;
    }

    for (const b of this.bubbles) {
      if (b.popped) continue;
      b.age += dt;
      b.y -= b.speedY * dt;
      b.x += Math.sin(b.age * b.driftFreq + b.driftOffset) * b.driftAmp * dt;
      if (b.y + b.r < 0) {
        // Wrap back to bottom
        b.y = this.canvas.height + b.r + Math.random() * 80;
        b.x = b.r + Math.random() * (this.canvas.width - b.r * 2);
      }
    }

    this._tickParticles(dt);
    this._tickPopAnims(dt);

    const alive = this.bubbles.filter(b => !b.popped).length;
    if (alive === 0 && this.bubbles.length > 0 && !this._roundClearing) {
      this._roundClearing = true;
      this._roundClearTimer = 2.0;
      Audio.playSuccess();
      if (this.round < this.maxRounds) {
        Audio.speak('Round clear! Amazing!', { rate: 0.9 });
      } else {
        Audio.speak('You popped them all! Amazing job!', { rate: 0.9, interrupt: true });
      }
    }
  }

  _tickParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 120 * dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _tickPopAnims(dt) {
    for (let i = this.popAnimations.length - 1; i >= 0; i--) {
      this.popAnimations[i].t += dt;
      if (this.popAnimations[i].t >= this.popAnimations[i].duration) this.popAnimations.splice(i, 1);
    }
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;

    ctx.fillStyle = this._bgGrad || '#87ceeb';
    ctx.fillRect(0, 0, W, H);

    // Round label
    ctx.save();
    ctx.font = 'bold 16px "Fredoka One","Nunito",sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText('Round ' + this.round + ' / ' + this.maxRounds, 12, 36);
    ctx.restore();

    // Prompt
    ctx.save();
    ctx.font = 'bold 18px "Fredoka One","Nunito",sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('Tap the bubbles! 🫧', W / 2, 36);
    ctx.restore();

    if (this._roundClearing) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 42px "Fredoka One","Nunito",sans-serif';
      ctx.fillStyle = '#5b3a8a';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (this.round >= this.maxRounds) {
        ctx.fillText('Amazing! All done!', W / 2, H / 2);
      } else {
        ctx.fillText('Round Clear! 🎉', W / 2, H / 2 - 24);
        ctx.font = 'bold 28px "Fredoka One","Nunito",sans-serif';
        ctx.fillText('Get ready for Round ' + (this.round + 1) + '!', W / 2, H / 2 + 28);
      }
      ctx.restore();
    }

    for (const b of this.bubbles) {
      if (!b.popped) this._drawBubble(b);
    }

    // Pop ring animations
    for (const a of this.popAnimations) {
      const progress = a.t / a.duration;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * (1 + progress * 2), 0, Math.PI * 2);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  _drawBubble(b) {
    const ctx = this.ctx, { x, y, r, color } = b;
    ctx.save();
    // Fill
    ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
    ctx.fillStyle = this._hexToRgba(color, 0.30);
    ctx.fill();
    // Stroke
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    // Shine
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x - r * 0.1, y - r * 0.5, r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
    ctx.restore();
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this._tryPop((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  }

  _onTouch(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    const t = e.changedTouches[0];
    this._tryPop((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
  }

  _tryPop(x, y) {
    if (this._roundClearing) return;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (b.popped) continue;
      const dx = x - b.x, dy = y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) {
        b.popped = true;
        this.totalPops++;
        App.updateHUDScore(this.totalPops);
        this.popAnimations.push({ x: b.x, y: b.y, r: b.r, color: b.color, t: 0, duration: 0.3 });
        for (let p = 0; p < 8; p++) {
          const angle = (p / 8) * Math.PI * 2;
          const speed = 80 + Math.random() * 80;
          this.particles.push({
            x: b.x, y: b.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40,
            color: b.color, size: 4 + Math.random() * 4,
            life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
          });
        }
        Audio.playPop();
        Audio.speak('Pop!', { rate: 1.1, interrupt: true });
        break;
      }
    }
  }
}
