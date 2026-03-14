// Kingdom Quest - ColorDropGame
// Toddler color-sorting game: tap falling paint drops to speed them into matching buckets.

class ColorDropGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this._rafId      = null;
    this._running    = false;
    this._lastTs     = 0;
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);

    this._score         = 0;
    this._drops         = [];
    this._particles     = [];
    this._spawnTimer    = 0;
    this._spawnInterval = 2.5;
    this._dropId        = 0;
    this._won           = false;

    this._colors = [
      { name: 'Red',    hex: '#e74c3c', rgb: [231, 76,  60 ] },
      { name: 'Blue',   hex: '#3498db', rgb: [52,  152, 219] },
      { name: 'Yellow', hex: '#f1c40f', rgb: [241, 196, 15 ] },
      { name: 'Green',  hex: '#2ecc71', rgb: [46,  204, 113] },
    ];

    this._buckets  = [];
    this._bucketH  = 90;
    this._bucketW  = 0;
    this._bucketY  = 0;
  }

  start() {
    this._running    = true;
    this._score      = 0;
    this._drops      = [];
    this._particles  = [];
    this._spawnTimer = 0;
    this._won        = false;

    this._buildBuckets();

    App.setHUDTitle('Color Drop');
    App.updateHUDScore(0);

    this.canvas.addEventListener('click',      this._boundClick);
    this.canvas.addEventListener('touchstart', this._boundTouch, { passive: true });

    Audio.speak("Tap the drops and sort the colors!", { rate: 0.9 });

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

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.1);
    this._lastTs = ts;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(ts2 => this._loop(ts2));
  }

  _update(dt) {
    if (this._won) {
      this._updateParticles(dt);
      return;
    }

    this._spawnTimer += dt;
    if (this._spawnTimer >= this._spawnInterval && this._drops.length < 2) {
      this._spawnTimer = 0;
      this._spawnDrop();
    }

    const bucketTopY = this._bucketY;
    const toRemove   = [];

    for (const drop of this._drops) {
      drop.y += drop.speed * dt;

      if (drop.whoosh > 0) {
        drop.whoosh = Math.max(0, drop.whoosh - dt * 3);
      }

      if (drop.y + drop.radius >= bucketTopY) {
        const bucket = this._nearestBucket(drop.x);
        if (bucket) {
          const match = bucket.colorIndex === drop.colorIndex;
          if (match) {
            this._score++;
            App.updateHUDScore(this._score);
            Audio.playPop();
            Audio.speak(this._colors[drop.colorIndex].name + '!', { rate: 1.0, interrupt: true });
            this._spawnSplash(drop.x, bucketTopY + 20, this._colors[drop.colorIndex].rgb, 22);
          } else {
            Audio.speak("Oops!", { rate: 1.0, interrupt: true });
            this._spawnSplash(drop.x, bucketTopY + 20, [160, 160, 160], 12);
          }
        }
        toRemove.push(drop.id);

        if (this._score >= 12) {
          this._triggerWin();
        }
      }
    }

    this._drops = this._drops.filter(d => !toRemove.includes(d.id));

    this._updateParticles(dt);
  }

  _updateParticles(dt) {
    for (const p of this._particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 400 * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
    this._particles = this._particles.filter(p => p.life > 0);
  }

  _render() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   '#a8d8f0');
    grad.addColorStop(0.7, '#d0eeff');
    grad.addColorStop(1,   '#e8f6ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this._drawClouds(ctx, W, H);
    this._drawBuckets(ctx);

    for (const drop of this._drops) {
      this._drawDrop(ctx, drop);
    }

    this._drawParticles(ctx);

    ctx.save();
    ctx.font         = 'bold 22px Arial, sans-serif';
    ctx.fillStyle    = '#2c6e8a';
    ctx.textAlign    = 'center';
    ctx.shadowColor  = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur   = 4;
    ctx.fillText('Tap the drops! Sort the colors!', W / 2, 36);
    ctx.restore();

    ctx.save();
    ctx.font         = 'bold 18px Arial, sans-serif';
    ctx.fillStyle    = '#2c6e8a';
    ctx.textAlign    = 'center';
    ctx.shadowColor  = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur   = 4;
    ctx.fillText(this._score + ' / 12', W / 2, 64);
    ctx.restore();

    if (this._won) {
      this._drawWinOverlay(ctx, W, H);
    }
  }

  _drawClouds(ctx, W, H) {
    const clouds = [
      { x: W * 0.12, y: H * 0.10, r: 34 },
      { x: W * 0.25, y: H * 0.08, r: 24 },
      { x: W * 0.60, y: H * 0.07, r: 38 },
      { x: W * 0.75, y: H * 0.12, r: 28 },
      { x: W * 0.90, y: H * 0.09, r: 22 },
    ];
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const c of clouds) {
      ctx.beginPath();
      ctx.arc(c.x,              c.y,              c.r,        0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.7,  c.y - c.r * 0.3,  c.r * 0.7,  0, Math.PI * 2);
      ctx.arc(c.x - c.r * 0.6,  c.y - c.r * 0.2,  c.r * 0.6,  0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawBuckets(ctx) {
    for (const b of this._buckets) {
      const x = b.x - this._bucketW / 2;
      const y = this._bucketY;
      const w = this._bucketW;
      const h = this._bucketH;
      const r = 14;

      ctx.save();

      ctx.shadowColor   = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur    = 10;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = b.color.hex;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x,     y + h);
      ctx.lineTo(x,     y + r);
      ctx.quadraticCurveTo(x, y,         x + r, y);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth   = 3;
      ctx.stroke();

      const shine = ctx.createLinearGradient(x, y, x + w * 0.3, y);
      shine.addColorStop(0, 'rgba(255,255,255,0.35)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w * 0.3, y);
      ctx.lineTo(x + w * 0.3, y + h);
      ctx.lineTo(x,           y + h);
      ctx.lineTo(x,           y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor      = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur       = 3;
      ctx.shadowOffsetY    = 1;
      ctx.fillStyle        = '#ffffff';
      ctx.font             = 'bold 16px Arial, sans-serif';
      ctx.textAlign        = 'center';
      ctx.textBaseline     = 'middle';
      ctx.fillText(b.color.name, b.x, y + h / 2);

      ctx.restore();
    }
  }

  _drawDrop(ctx, drop) {
    const x   = drop.x;
    const y   = drop.y;
    const r   = drop.radius;
    const col = this._colors[drop.colorIndex];

    ctx.save();

    const scale = 1 + drop.whoosh * 0.18;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-x, -y);

    ctx.shadowColor   = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur    = 12;
    ctx.shadowOffsetY = 4;

    const tipY  = y + r + r * 0.85;
    const angle = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(x - r * Math.sin(angle), y + r * Math.cos(angle));
    ctx.arc(x, y, r, Math.PI / 2 + angle, Math.PI / 2 - angle + Math.PI * 2);
    ctx.quadraticCurveTo(x + r * 0.45, y + r * 1.1, x, tipY);
    ctx.quadraticCurveTo(x - r * 0.45, y + r * 1.1, x - r * Math.sin(angle), y + r * Math.cos(angle));
    ctx.closePath();

    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.4);
    grad.addColorStop(0,   this._lighten(col.hex, 0.4));
    grad.addColorStop(0.5, col.hex);
    grad.addColorStop(1,   this._darken(col.hex, 0.25));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = this._darken(col.hex, 0.3);
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x - r * 0.28, y - r * 0.28, r * 0.22, r * 0.14, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    ctx.restore();
  }

  _drawParticles(ctx) {
    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = `rgb(${p.r},${p.g},${p.b})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.alpha + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawWinOverlay(ctx, W, H) {
    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);

    const cw = Math.min(W - 40, 400);
    const ch = 200;
    const cx = (W - cw) / 2;
    const cy = (H - ch) / 2;

    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur  = 20;
    this._roundRect(ctx, cx, cy, cw, ch, 20);
    ctx.fill();

    ctx.shadowColor  = 'transparent';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    ctx.font      = 'bold 42px Arial, sans-serif';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText('Amazing!', W / 2, cy + 65);

    ctx.font      = 'bold 20px Arial, sans-serif';
    ctx.fillStyle = '#2c6e8a';
    ctx.fillText('You sorted all the colors!', W / 2, cy + 115);

    ctx.font      = '32px Arial, sans-serif';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText('12 / 12', W / 2, cy + 162);

    ctx.restore();
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

  _handleTap(tx, ty) {
    if (this._won) return;

    for (const drop of this._drops) {
      if (drop.boosted) continue;
      const dx   = tx - drop.x;
      const dy   = ty - drop.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitR = drop.radius + 18;
      if (dist <= hitR) {
        drop.speed   = 200;
        drop.boosted = true;
        drop.whoosh  = 1;
        Audio.playPop();
        this._spawnTapSparkle(drop.x, drop.y, this._colors[drop.colorIndex].rgb);
        break;
      }
    }
  }

  _buildBuckets() {
    const W      = this.canvas.width;
    const H      = this.canvas.height;
    const margin = 18;
    const count  = this._colors.length;

    this._bucketH = 90;
    this._bucketW = Math.floor((W - margin * 2 - (count - 1) * 12) / count);
    this._bucketY = H - this._bucketH - margin;

    this._buckets = this._colors.map((col, i) => ({
      x:          margin + i * (this._bucketW + 12) + this._bucketW / 2,
      colorIndex: i,
      color:      col,
    }));
  }

  _spawnDrop() {
    const W          = this.canvas.width;
    const colorIndex = Math.floor(Math.random() * this._colors.length);
    const margin     = 60;
    const x          = margin + Math.random() * (W - margin * 2);
    const speed      = 40 + Math.random() * 20;

    this._drops.push({
      id:         this._dropId++,
      x,
      y:          -50,
      radius:     35,
      colorIndex,
      speed,
      boosted:    false,
      whoosh:     0,
    });
  }

  _nearestBucket(x) {
    let best   = null;
    let bestDx = Infinity;
    for (const b of this._buckets) {
      const dx = Math.abs(x - b.x);
      if (dx < bestDx) {
        bestDx = dx;
        best   = b;
      }
    }
    return (best && bestDx <= this._bucketW / 2) ? best : null;
  }

  _spawnSplash(x, y, rgb, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      this._particles.push({
        x, y,
        vx:      Math.cos(angle) * speed,
        vy:      Math.sin(angle) * speed - 60,
        r:       rgb[0], g: rgb[1], b: rgb[2],
        size:    3 + Math.random() * 5,
        life:    0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        alpha:   1,
      });
    }
  }

  _spawnTapSparkle(x, y, rgb) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      this._particles.push({
        x, y,
        vx:      Math.cos(angle) * speed,
        vy:      Math.sin(angle) * speed - 30,
        r:       rgb[0], g: rgb[1], b: rgb[2],
        size:    2 + Math.random() * 3,
        life:    0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        alpha:   1,
      });
    }
  }

  _triggerWin() {
    this._won = true;
    Audio.playSuccess();
    Audio.speak("Amazing! You sorted all the colors!", { rate: 0.9 });
    const W = this.canvas.width;
    const H = this.canvas.height;
    for (let i = 0; i < 80; i++) {
      const col = this._colors[Math.floor(Math.random() * this._colors.length)].rgb;
      this._particles.push({
        x:       Math.random() * W,
        y:       H / 2 + (Math.random() - 0.5) * H * 0.4,
        vx:      (Math.random() - 0.5) * 300,
        vy:      -100 - Math.random() * 250,
        r:       col[0], g: col[1], b: col[2],
        size:    4 + Math.random() * 7,
        life:    1.2 + Math.random() * 0.8,
        maxLife: 2.0,
        alpha:   1,
      });
    }
    setTimeout(() => { if (this._running) this.onComplete(3); }, 3500);
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y,         x + r, y);
    ctx.closePath();
  }

  _lighten(hex, amount) {
    const [r, g, b] = this._hexToRgb(hex);
    return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))},` +
                `${Math.min(255, Math.round(g + (255 - g) * amount))},` +
                `${Math.min(255, Math.round(b + (255 - b) * amount))})`;
  }

  _darken(hex, amount) {
    const [r, g, b] = this._hexToRgb(hex);
    return `rgb(${Math.round(r * (1 - amount))},` +
                `${Math.round(g * (1 - amount))},` +
                `${Math.round(b * (1 - amount))})`;
  }

  _hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
}
