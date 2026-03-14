// ===== WHACK-A-MOLE =====
// Moles pop up from holes — tap them before they hide!
// 3x3 grid, 5 rounds. Full canvas mole drawing with rise/hide animation.

class WhackMoleGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.onComplete = onComplete;

    this._rafId = null;
    this._lastTs = 0;
    this._running = false;

    this.score = 0;
    this.round = 1;
    this.maxRounds = 5;

    this._roundDuration = 30;
    this._roundTimer = 0;
    this._betweenRounds = false;
    this._betweenTimer = 0;

    // Per-round config: [molesAtOnce, visibleDuration]
    this._roundConfig = [
      [1, 2.2],
      [1, 2.0],
      [2, 1.8],
      [2, 1.6],
      [3, 1.4],
    ];

    this._holes = [];
    this._moles = [];
    this._particles = [];
    this._whackAnims = [];

    this._bgGrad = null;
    this._holeR = 0;
    this._groundY = 0;

    this._hitMessages = ['Great!', 'Nice!', 'Whack!', 'Got it!', 'Boom!'];
    this._hitMsgIdx = 0;

    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);
  }

  start() {
    this._running = true;
    this.score = 0;
    this.round = 1;
    this._roundTimer = this._roundDuration;
    this._betweenRounds = false;

    App.setHUDTitle('Whack-a-Mole!');
    App.updateHUDScore(0);

    this.canvas.addEventListener('click', this._boundClick);
    this.canvas.addEventListener('touchstart', this._boundTouch, { passive: true });

    this._buildLayout();
    this._buildBgGradient();
    this._initMoles();

    Audio.speak('Whack the moles!', { rate: 0.9 });

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
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.6);
    grad.addColorStop(0, '#87ceeb');
    grad.addColorStop(1, '#c9eeff');
    this._bgGrad = grad;
  }

  _buildLayout() {
    const W = this.canvas.width, H = this.canvas.height;
    const groundY = H * 0.62;
    const holeR = Math.min(W, H) * 0.085;
    this._holeR = holeR;
    this._groundY = groundY;
    this._holes = [];

    const cols = 3, rows = 3;
    const padX = W * 0.12;
    const colSpacing = (W - padX * 2) / (cols - 1);
    const rowSpacing = (H * 0.32) / (rows - 1);
    const startY = groundY + H * 0.04;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this._holes.push({
          x: padX + col * colSpacing,
          y: startY + row * rowSpacing,
          r: holeR,
          idx: row * cols + col,
        });
      }
    }
  }

  _initMoles() {
    this._moles = this._holes.map((h, i) => ({
      holeIdx: i,
      state: 'hidden', // 'hidden' | 'rising' | 'up' | 'hiding'
      upTimer: 0,
      animT: 0,
      animDuration: 0.2,
      offsetY: 0,  // 0=hidden, 1=fully up
      whacked: false,
    }));
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
    if (this._betweenRounds) {
      this._betweenTimer -= dt;
      if (this._betweenTimer <= 0) {
        this._betweenRounds = false;
        this.round++;
        if (this.round > this.maxRounds) {
          this.stop();
          Audio.speak('You whacked ' + this.score + ' moles! Great job!', { rate: 0.9, interrupt: true });
          this.onComplete(3);
          return;
        }
        this._roundTimer = this._roundDuration;
        this._initMoles();
        Audio.speak('Round ' + this.round + '! Keep going!', { rate: 0.9, interrupt: true });
      }
      this._tickParticles(dt);
      this._tickWhackAnims(dt);
      return;
    }

    this._roundTimer -= dt;
    if (this._roundTimer <= 0) {
      this._roundTimer = 0;
      for (const m of this._moles) { m.state = 'hidden'; m.offsetY = 0; }
      this._betweenRounds = true;
      this._betweenTimer = 2.0;
      if (this.round < this.maxRounds) Audio.speak('Round ' + this.round + ' done!', { rate: 0.9, interrupt: true });
      this._tickParticles(dt);
      this._tickWhackAnims(dt);
      return;
    }

    const [molesAtOnce, visibleDuration] = this._roundConfig[this.round - 1];

    for (const m of this._moles) {
      if (m.state === 'rising') {
        m.animT += dt;
        m.offsetY = Math.min(m.animT / m.animDuration, 1);
        if (m.animT >= m.animDuration) { m.state = 'up'; m.animT = 0; m.upTimer = visibleDuration; }
      } else if (m.state === 'up') {
        if (!m.whacked) {
          m.upTimer -= dt;
          if (m.upTimer <= 0) { m.state = 'hiding'; m.animT = 0; Audio.playWrong(); }
        }
      } else if (m.state === 'hiding') {
        m.animT += dt;
        m.offsetY = Math.max(1 - m.animT / m.animDuration, 0);
        if (m.animT >= m.animDuration) { m.state = 'hidden'; m.offsetY = 0; m.whacked = false; m.animT = 0; }
      }
    }

    // Spawn new moles
    const upCount = this._moles.filter(m => m.state === 'rising' || m.state === 'up').length;
    if (upCount < molesAtOnce) {
      const hidden = this._moles.filter(m => m.state === 'hidden');
      const toSpawn = molesAtOnce - upCount;
      for (let i = 0; i < toSpawn && hidden.length > 0; i++) {
        const idx = Math.floor(Math.random() * hidden.length);
        const m = hidden.splice(idx, 1)[0];
        m.state = 'rising'; m.animT = 0; m.animDuration = 0.2;
        m.upDuration = visibleDuration; m.whacked = false; m.offsetY = 0;
      }
    }

    this._tickParticles(dt);
    this._tickWhackAnims(dt);
  }

  _tickParticles(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) this._particles.splice(i, 1);
    }
  }

  _tickWhackAnims(dt) {
    for (let i = this._whackAnims.length - 1; i >= 0; i--) {
      this._whackAnims[i].t += dt;
      if (this._whackAnims[i].t >= this._whackAnims[i].duration) this._whackAnims.splice(i, 1);
    }
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const groundY = this._groundY;

    // Sky
    ctx.fillStyle = this._bgGrad || '#87ceeb';
    ctx.fillRect(0, 0, W, groundY);

    // Ground
    ctx.fillStyle = '#5a9e3a';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#7abf55';
    ctx.fillRect(0, groundY, W, 12);

    for (const h of this._holes) this._drawHole(h);

    for (const m of this._moles) {
      if (m.state === 'hidden') continue;
      this._drawMole(this._holes[m.holeIdx], m);
    }

    // Whack star burst animations
    for (const a of this._whackAnims) {
      const progress = a.t / a.duration;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      for (const star of a.stars) {
        const sx = a.x + star.dx * progress * 40;
        const sy = a.y + star.dy * progress * 40 - progress * 30;
        this._drawStar(ctx, sx, sy, 10 * (1 - progress * 0.5), '#ffe066');
      }
      ctx.restore();
    }

    // Particles
    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      this._drawStar(ctx, p.x, p.y, p.size, p.color);
      ctx.restore();
    }

    // Timer bar
    const frac = this._roundTimer / this._roundDuration;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(10, H - 22, W - 20, 14);
    ctx.fillStyle = frac > 0.4 ? '#5cb85c' : frac > 0.2 ? '#f0ad4e' : '#d9534f';
    ctx.fillRect(10, H - 22, (W - 20) * Math.max(0, frac), 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(10, H - 22, W - 20, 14);
    ctx.restore();

    // Round label
    ctx.save();
    ctx.font = 'bold 16px "Fredoka One","Nunito",sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('Round ' + this.round + '/' + this.maxRounds, 12, 30);
    ctx.restore();

    if (this._betweenRounds) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 38px "Fredoka One","Nunito",sans-serif';
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (this.round >= this.maxRounds) {
        ctx.fillText('All done! 🎉', W / 2, H / 2 - 24);
        ctx.font = 'bold 26px "Fredoka One","Nunito",sans-serif';
        ctx.fillText('You whacked ' + this.score + ' moles!', W / 2, H / 2 + 24);
      } else {
        ctx.fillText('Round ' + this.round + ' done!', W / 2, H / 2 - 24);
        ctx.font = 'bold 24px "Fredoka One","Nunito",sans-serif';
        ctx.fillText('Get ready for Round ' + (this.round + 1) + '!', W / 2, H / 2 + 24);
      }
      ctx.restore();
    }

    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  _drawHole(h) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2206'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * 0.82, h.r * 0.33, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a0a00'; ctx.fill();
    ctx.restore();
  }

  _drawMole(h, m) {
    const ctx = this.ctx, holeR = h.r;
    const riseAmount = holeR * 1.1;
    const moleY = h.y - m.offsetY * riseAmount;
    const moleR = holeR * 0.78;

    // Clip so mole appears to emerge from hole
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, holeR * 1.05, holeR * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.rect(h.x - holeR * 1.1, h.y - riseAmount * 1.5, holeR * 2.2, riseAmount * 1.5 + 2);
    ctx.clip();

    // Body
    ctx.beginPath(); ctx.ellipse(h.x, moleY, moleR * 0.72, moleR, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#8B5E3C'; ctx.fill();
    // Belly
    ctx.beginPath(); ctx.ellipse(h.x, moleY + moleR * 0.15, moleR * 0.42, moleR * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c4916b'; ctx.fill();
    // Ears
    ctx.beginPath(); ctx.ellipse(h.x - moleR * 0.52, moleY - moleR * 0.75, moleR * 0.22, moleR * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#6b3f1e'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(h.x + moleR * 0.52, moleY - moleR * 0.75, moleR * 0.22, moleR * 0.3, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#6b3f1e'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(h.x - moleR * 0.52, moleY - moleR * 0.75, moleR * 0.12, moleR * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#e8a0a0'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(h.x + moleR * 0.52, moleY - moleR * 0.75, moleR * 0.12, moleR * 0.18, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#e8a0a0'; ctx.fill();
    // Eyes
    if (!m.whacked) {
      ctx.beginPath(); ctx.arc(h.x - moleR * 0.28, moleY - moleR * 0.28, moleR * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = '#1a0a00'; ctx.fill();
      ctx.beginPath(); ctx.arc(h.x + moleR * 0.28, moleY - moleR * 0.28, moleR * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = '#1a0a00'; ctx.fill();
      ctx.beginPath(); ctx.arc(h.x - moleR * 0.24, moleY - moleR * 0.32, moleR * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
      ctx.beginPath(); ctx.arc(h.x + moleR * 0.32, moleY - moleR * 0.32, moleR * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
    } else {
      // X eyes
      ctx.strokeStyle = '#fff'; ctx.lineWidth = moleR * 0.07; ctx.lineCap = 'round';
      const ex = moleR * 0.1, ey = moleR * 0.1;
      ctx.beginPath();
      ctx.moveTo(h.x - moleR * 0.28 - ex, moleY - moleR * 0.28 - ey); ctx.lineTo(h.x - moleR * 0.28 + ex, moleY - moleR * 0.28 + ey);
      ctx.moveTo(h.x - moleR * 0.28 + ex, moleY - moleR * 0.28 - ey); ctx.lineTo(h.x - moleR * 0.28 - ex, moleY - moleR * 0.28 + ey);
      ctx.moveTo(h.x + moleR * 0.28 - ex, moleY - moleR * 0.28 - ey); ctx.lineTo(h.x + moleR * 0.28 + ex, moleY - moleR * 0.28 + ey);
      ctx.moveTo(h.x + moleR * 0.28 + ex, moleY - moleR * 0.28 - ey); ctx.lineTo(h.x + moleR * 0.28 - ex, moleY - moleR * 0.28 + ey);
      ctx.stroke();
    }
    // Nose
    ctx.beginPath(); ctx.ellipse(h.x, moleY - moleR * 0.05, moleR * 0.14, moleR * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e8607a'; ctx.fill();
    // Smile
    ctx.beginPath(); ctx.arc(h.x, moleY + moleR * 0.05, moleR * 0.22, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = '#5a2d0c'; ctx.lineWidth = moleR * 0.06; ctx.lineCap = 'round'; ctx.stroke();

    ctx.restore();
  }

  _drawStar(ctx, x, y, size, color) {
    const spikes = 5, outerR = size, innerR = size * 0.45;
    ctx.save(); ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      if (i === 0) ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
      else ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width, sy = this.canvas.height / rect.height;
    this._tryWhack((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  }

  _onTouch(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width, sy = this.canvas.height / rect.height;
    const t = e.changedTouches[0];
    this._tryWhack((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
  }

  _tryWhack(x, y) {
    if (this._betweenRounds) return;
    const holeR = this._holeR;
    for (const m of this._moles) {
      if (m.state !== 'up' || m.whacked) continue;
      const h = this._holes[m.holeIdx];
      const riseAmount = holeR * 1.1;
      const moleY = h.y - m.offsetY * riseAmount;
      const moleR = holeR * 0.78;
      const dx = x - h.x, dy = y - moleY;
      if ((dx * dx) / (moleR * 0.72 * moleR * 0.72) + (dy * dy) / (moleR * moleR) <= 1.4) {
        m.whacked = true; m.state = 'hiding'; m.animT = 0;
        this.score++;
        App.updateHUDScore(this.score);
        Audio.playSuccess();
        const msg = this._hitMessages[this._hitMsgIdx++ % this._hitMessages.length];
        Audio.speak(msg, { rate: 1.1, interrupt: true });

        // Star burst
        const stars = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          stars.push({ dx: Math.cos(angle), dy: Math.sin(angle) });
        }
        this._whackAnims.push({ x: h.x, y: moleY - moleR * 0.5, t: 0, duration: 0.5, stars });

        // Particles
        for (let p = 0; p < 6; p++) {
          const angle = (p / 6) * Math.PI * 2, speed = 60 + Math.random() * 80;
          this._particles.push({
            x: h.x, y: moleY,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60,
            color: ['#ffe066','#ff9eb5','#a8e6cf','#aecbfa'][p % 4],
            size: 6 + Math.random() * 4, life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
          });
        }
        break;
      }
    }
  }
}
