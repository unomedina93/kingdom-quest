/**
 * LostSheepGame
 * Based on the Parable of the Lost Sheep (Luke 15).
 * 6 fluffy sheep wander a green meadow. Tap a sheep to send it
 * trotting happily into the wooden pen. Get all 6 home across 3 rounds.
 */
class LostSheepGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this._rafId   = null;
    this._running = false;
    this._lastTs  = 0;

    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);

    this._round       = 1;
    this._totalRounds = 3;
    this._pauseTimer  = 0;
    this._winPending  = false;

    this._sheep     = [];
    this._particles = [];
    this._clouds    = [];
    this._pen       = null;
  }

  start() {
    this._running = true;

    App.setHUDTitle('Lost Sheep 🐑');
    App.updateHUDScore('Sheep left: 6');

    this.canvas.addEventListener('click',      this._boundClick);
    this.canvas.addEventListener('touchstart', this._boundTouch, { passive: true });

    Audio.speak('Help bring the lost sheep home! Tap each sheep!', { rate: 0.9 });

    this._initRound();

    this._lastTs = performance.now();
    this._rafId  = requestAnimationFrame(ts => this._loop(ts));
  }

  stop() {
    this._running = false;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this.canvas.removeEventListener('click',      this._boundClick);
    this.canvas.removeEventListener('touchstart', this._boundTouch);
  }

  _initRound() {
    const W = this.canvas.width;
    const H = this.canvas.height;

    const penW  = Math.round(W * 0.18);
    const penH  = Math.round(H * 0.32);
    const penX  = W - penW - 16;
    const penY  = Math.round(H * 0.38);
    this._pen   = { x: penX, y: penY, w: penW, h: penH };
    this._pen.cx = penX + penW * 0.5;
    this._pen.cy = penY + penH * 0.5;

    const wanderMaxX = penX - 60;

    this._sheep = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 10;
      this._sheep.push({
        x:        40 + Math.random() * (wanderMaxX - 80),
        y:        Math.round(H * 0.25) + Math.random() * Math.round(H * 0.45),
        vx:       Math.cos(angle) * speed,
        vy:       Math.sin(angle) * speed,
        speed,
        heading:  false,
        inPen:    false,
        heart:    0,
        heartY:   0,
        size:     22 + Math.floor(Math.random() * 6),
        dirTimer: 1.5 + Math.random() * 2.5,
        color:    '#f5f5f5',
      });
    }

    this._clouds = [];
    for (let i = 0; i < 3; i++) {
      this._clouds.push({
        x:     80 + (W / 3) * i + Math.random() * 40,
        y:     H * 0.06 + Math.random() * H * 0.08,
        scale: 0.7 + Math.random() * 0.5,
      });
    }

    this._particles  = [];
    this._winPending = false;
    this._pauseTimer = 0;

    App.updateHUDScore('Sheep left: 6');
  }

  _loop(ts) {
    if (!this._running) return;

    const dt    = Math.min((ts - this._lastTs) / 1000, 0.1);
    this._lastTs = ts;

    this._update(dt);
    this._render();

    this._rafId = requestAnimationFrame(ts2 => this._loop(ts2));
  }

  _update(dt) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (this._pauseTimer > 0) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pauseTimer = 0;
        this._round++;
        if (this._round > this._totalRounds) {
          this.stop();
          this.onComplete(3);
          return;
        }
        this._initRound();
        Audio.speak('Help bring the lost sheep home! Tap each sheep!', { rate: 0.9 });
      }
      return;
    }

    const pen        = this._pen;
    const wanderMaxX = pen.x - 60;
    const MARGIN     = 30;

    for (const s of this._sheep) {
      if (s.inPen) continue;

      if (s.heading) {
        const TROT = 60;
        const dx   = pen.cx - s.x;
        const dy   = pen.cy - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 60) {
          s.inPen = true;
          this._spawnConfetti(s.x, s.y);

          const remaining = this._sheep.filter(sh => !sh.inPen).length;
          App.updateHUDScore(`Sheep left: ${remaining}`);

          if (remaining === 0 && !this._winPending) {
            this._winPending = true;
            Audio.playSuccess();
            Audio.speak('All the sheep are safe! The shepherd is so happy!', { rate: 0.9 });
            this._pauseTimer = 2.5;
          }
        } else {
          s.x += (dx / dist) * TROT * dt;
          s.y += (dy / dist) * TROT * dt;
        }
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        if (s.x < MARGIN)       { s.x  = MARGIN;       s.vx = Math.abs(s.vx); }
        if (s.y < H * 0.22)     { s.y  = H * 0.22;     s.vy = Math.abs(s.vy); }
        if (s.y > H - MARGIN)   { s.y  = H - MARGIN;   s.vy = -Math.abs(s.vy); }
        if (s.x > wanderMaxX)   { s.x  = wanderMaxX;   s.vx = -Math.abs(s.vx); }

        s.dirTimer -= dt;
        if (s.dirTimer <= 0) {
          s.dirTimer  = 1.5 + Math.random() * 2.5;
          const angle = Math.atan2(s.vy, s.vx) + (Math.random() - 0.5) * 1.2;
          const spd   = 15 + Math.random() * 10;
          s.vx = Math.cos(angle) * spd;
          s.vy = Math.sin(angle) * spd;
        }
      }

      if (s.heart > 0) {
        s.heart  -= dt;
        s.heartY -= 22 * dt;
      }
    }

    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 200 * dt;
      p.life -= dt;
      if (p.life <= 0) this._particles.splice(i, 1);
    }
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx   = this.canvas.width  / rect.width;
    const sy   = this.canvas.height / rect.height;
    this._handleTap((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  }

  _onTouch(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx   = this.canvas.width  / rect.width;
    const sy   = this.canvas.height / rect.height;
    const t    = e.changedTouches[0];
    this._handleTap((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
  }

  _handleTap(x, y) {
    if (this._pauseTimer > 0) return;

    const TAP_R = 40;
    let   best  = null;
    let   bestD = Infinity;

    for (const s of this._sheep) {
      if (s.inPen || s.heading) continue;
      const dx = x - s.x;
      const dy = y - s.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < TAP_R && d < bestD) {
        bestD = d;
        best  = s;
      }
    }

    if (best) {
      best.heading = true;
      best.heart   = 1.2;
      best.heartY  = 0;
      Audio.playBoing();
    }
  }

  _spawnConfetti(x, y) {
    const colors = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#e91e8c', '#9b59b6'];
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      this._particles.push({
        x, y,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 80,
        life:  0.5 + Math.random() * 0.4,
        size:  3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  _render() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.32);
    skyGrad.addColorStop(0, '#87ceeb');
    skyGrad.addColorStop(1, '#c8e8f5');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.32);

    const grassGrad = ctx.createLinearGradient(0, H * 0.28, 0, H);
    grassGrad.addColorStop(0, '#85d44a');
    grassGrad.addColorStop(1, '#4a9e28');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, H * 0.28, W, H * 0.72);

    ctx.fillStyle = '#a3d96c';
    ctx.fillRect(0, H * 0.27, W, H * 0.05);

    for (const c of this._clouds) {
      this._drawDecorativeCloud(c.x, c.y, c.scale);
    }

    this._drawPen();

    for (const s of this._sheep) {
      if (!s.inPen) this._drawSheep(s);
    }

    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!this._winPending) {
      ctx.save();
      ctx.font        = `bold ${Math.round(W * 0.038)}px sans-serif`;
      ctx.fillStyle   = '#2c3e50';
      ctx.textAlign   = 'center';
      ctx.shadowColor = 'rgba(255,255,255,0.85)';
      ctx.shadowBlur  = 7;
      ctx.fillText('Tap the sheep to bring them home! 🐑', W / 2, H * 0.92);
      ctx.restore();
    }

    if (this._pauseTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(0, 0, W, H);

      ctx.font         = `bold ${Math.round(W * 0.065)}px sans-serif`;
      ctx.fillStyle    = '#27ae60';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur   = 8;

      const msg = this._round < this._totalRounds
        ? `Round ${this._round} Clear! 🏠`
        : 'All sheep are home! 🎉';
      ctx.fillText(msg, W / 2, H / 2);
      ctx.restore();
    }

    ctx.save();
    ctx.font      = `${Math.round(W * 0.03)}px sans-serif`;
    ctx.fillStyle = '#555';
    ctx.textAlign = 'left';
    ctx.fillText(`Round ${this._round} / ${this._totalRounds}`, 12, 22);
    ctx.restore();
  }

  _drawDecorativeCloud(x, y, scale) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle   = 'rgba(255,255,255,0.82)';
    ctx.strokeStyle = 'rgba(200,215,230,0.5)';
    ctx.lineWidth   = 1;

    const puffs = [
      { dx:  0,  dy:  0,  rx: 32, ry: 22 },
      { dx: -26, dy:  8,  rx: 22, ry: 17 },
      { dx:  26, dy:  8,  rx: 22, ry: 17 },
      { dx: -13, dy: -11, rx: 17, ry: 13 },
      { dx:  13, dy: -11, rx: 17, ry: 13 },
    ];
    for (const p of puffs) {
      ctx.beginPath();
      ctx.ellipse(p.dx, p.dy, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPen() {
    const ctx = this.ctx;
    const p   = this._pen;

    ctx.save();
    ctx.fillStyle = '#5aaa2a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();

    const penCount = this._sheep.filter(s => s.inPen).length;

    if (penCount > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(245,245,245,0.75)';
      const cols = 2;
      for (let i = 0; i < penCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const sx  = p.x + 14 + col * 22;
        const sy  = p.y + 20 + row * 22;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const openTop    = p.y + p.h * 0.3;
    const openBottom = p.y + p.h * 0.7;
    const railColor  = '#8b5e2a';
    const postColor  = '#6b4220';
    const railW      = 5;

    ctx.save();
    ctx.strokeStyle = railColor;
    ctx.lineWidth   = railW;
    ctx.lineCap     = 'round';

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.w, p.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h * 0.5);
    ctx.lineTo(p.x + p.w, p.y + p.h * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x + p.w, p.y);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, openTop);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, openBottom);
    ctx.lineTo(p.x, p.y + p.h);
    ctx.stroke();

    ctx.strokeStyle = postColor;
    ctx.lineWidth   = 7;
    const postXs = [p.x, p.x + p.w * 0.5, p.x + p.w];
    for (const px of postXs) {
      ctx.beginPath();
      ctx.moveTo(px, p.y - 6);
      ctx.lineTo(px, p.y + p.h + 6);
      ctx.stroke();
    }

    ctx.restore();

    ctx.save();
    ctx.font      = `bold ${Math.round(p.w * 0.28)}px sans-serif`;
    ctx.fillStyle = '#5d3a1a';
    ctx.textAlign = 'center';
    ctx.fillText('Home 🏠', p.x + p.w / 2, p.y - 10);
    ctx.restore();
  }

  _drawSheep(s) {
    const ctx  = this.ctx;
    const x    = s.x;
    const y    = s.y;
    const size = s.size;
    const flip = s.vx < 0 ? -1 : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);

    const bodyW = size * 1.6;
    const bodyH = size * 1.1;

    ctx.fillStyle = s.heading ? '#fffde7' : '#f5f5f5';
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();

    const puffColor = s.heading ? '#fffbcf' : '#ececec';
    ctx.fillStyle = puffColor;
    const puffs = [
      { dx: -bodyW * 0.45, dy: -bodyH * 0.3, r: size * 0.55 },
      { dx:  0,            dy: -bodyH * 0.45, r: size * 0.5  },
      { dx:  bodyW * 0.45, dy: -bodyH * 0.3, r: size * 0.55 },
      { dx: -bodyW * 0.6,  dy:  0,           r: size * 0.4  },
      { dx:  bodyW * 0.6,  dy:  0,           r: size * 0.4  },
    ];
    for (const pf of puffs) {
      ctx.beginPath();
      ctx.arc(pf.dx, pf.dy, pf.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const headX = bodyW * 0.75;
    const headY = -bodyH * 0.25;
    const headR = size * 0.52;
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(headX + headR * 0.35, headY - headR * 0.15, size * 0.09, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#555';
    ctx.lineWidth   = Math.max(1, size * 0.07);
    ctx.beginPath();
    ctx.arc(headX + headR * 0.2, headY + headR * 0.1, headR * 0.35, 0.1, Math.PI * 0.85);
    ctx.stroke();

    ctx.fillStyle = '#e8e0d8';
    ctx.beginPath();
    ctx.ellipse(headX + headR * 0.1, headY - headR * 0.75, size * 0.12, size * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX + headR * 0.65, headY - headR * 0.55, size * 0.12, size * 0.2, 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#aaa';
    const legW = Math.max(3, size * 0.18);
    const legH = size * 0.7;
    const legY = bodyH * 0.7;
    const legXs = [-bodyW * 0.5, -bodyW * 0.18, bodyW * 0.18, bodyW * 0.5];

    for (let i = 0; i < 4; i++) {
      const swing = s.heading ? Math.sin(performance.now() * 0.008 + i * 1.2) * 4 : 0;
      ctx.fillRect(legXs[i] - legW / 2, legY + swing, legW, legH);
    }

    ctx.restore();

    if (s.heart > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.heart);
      ctx.font        = `${Math.round(size * 0.9)}px sans-serif`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#e74c3c';
      ctx.fillText('♥', x, y - size * 1.4 + s.heartY);
      ctx.restore();
    }
  }
}
