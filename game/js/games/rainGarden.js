/**
 * RainGardenGame
 * Tap clouds to make it rain and water 5 flowers across 3 rounds.
 */
class RainGardenGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this._rafId   = null;
    this._running = false;
    this._lastTs  = 0;

    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);

    this._round        = 1;
    this._totalRounds  = 3;
    this._pauseTimer   = 0;
    this._roundClearing = false;

    this._clouds    = [];
    this._raindrops = [];
    this._flowers   = [];
    this._particles = [];
  }

  start() {
    this._running = true;

    App.setHUDTitle('Rain Garden 🌧️');
    App.updateHUDScore('Bloomed: 0 / 5');

    this.canvas.addEventListener('click',      this._boundClick);
    this.canvas.addEventListener('touchstart', this._boundTouch, { passive: true });

    Audio.speak('Tap the clouds to make it rain!', { rate: 0.9 });

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

    this._raindrops    = [];
    this._particles    = [];
    this._roundClearing = false;

    // 3 clouds with puff arrays
    this._clouds = [];
    for (let i = 0; i < 3; i++) {
      const baseX = W * (0.18 + i * 0.32);
      this._clouds.push({
        x:         baseX + (Math.random() - 0.5) * 40,
        y:         H * 0.14 + Math.random() * H * 0.06,
        speed:     12 + Math.random() * 8,
        raining:   false,
        rainTimer: 0,
        puffs: [
          { dx:  0,   dy:  0,  rx: 44, ry: 28 },
          { dx: -30,  dy:  8,  rx: 28, ry: 20 },
          { dx:  30,  dy:  8,  rx: 28, ry: 20 },
          { dx: -16,  dy: -14, rx: 22, ry: 16 },
          { dx:  16,  dy: -14, rx: 22, ry: 16 },
        ],
      });
    }

    // 5 flowers along the bottom
    const flowerColors = ['#e74c3c','#e91e8c','#f39c12','#9b59b6','#e74c3c'];
    this._flowers = [];
    for (let i = 0; i < 5; i++) {
      this._flowers.push({
        x:          W * (0.12 + i * 0.19),
        y:          H - 50,
        drops:      0,
        bloomAnim:  0,
        justBloomed: false,
        color:      flowerColors[i],
      });
    }

    App.updateHUDScore('Bloomed: 0 / 5');
  }

  _loop(ts) {
    if (!this._running) return;

    const dt     = Math.min((ts - this._lastTs) / 1000, 0.1);
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
        Audio.speak('Tap the clouds to make it rain!');
      }
      return;
    }

    // Clouds
    for (const c of this._clouds) {
      c.x += c.speed * dt;
      if (c.x - 80 > W) c.x = -80;
      if (c.raining) {
        c.rainTimer -= dt;
        if (c.rainTimer <= 0) c.raining = false;
      }
    }

    // Raindrops
    const FALL_SPEED = 120;
    const GROUND_Y   = H - 40;

    for (let i = this._raindrops.length - 1; i >= 0; i--) {
      const d = this._raindrops[i];
      d.y += FALL_SPEED * dt;

      if (d.y >= GROUND_Y) {
        for (const flower of this._flowers) {
          if (flower.drops < 3 && Math.abs(d.x - flower.x) < 50) {
            flower.drops++;
            this._spawnSplash(d.x, GROUND_Y, '#5dade2');

            if (flower.drops === 3 && !flower.justBloomed) {
              flower.justBloomed = true;
              Audio.speak('A flower bloomed!', { rate: 0.9 });
              Audio.playPop();

              const bloomed = this._flowers.filter(f => f.drops === 3).length;
              App.updateHUDScore(`Bloomed: ${bloomed} / 5`);

              if (bloomed === 5 && !this._roundClearing) {
                this._roundClearing = true;
                Audio.playSuccess();
                Audio.speak('Beautiful! All the flowers grew!', { rate: 0.9 });
                this._pauseTimer = 2.5;
              }
            }
            break;
          }
        }
        this._raindrops.splice(i, 1);
      }
    }

    // Bloom animations
    for (const flower of this._flowers) {
      if (flower.drops === 3 && flower.bloomAnim < 1) {
        flower.bloomAnim = Math.min(flower.bloomAnim + dt * 1.8, 1);
      } else if (flower.drops === 2 && flower.bloomAnim < 0.55) {
        flower.bloomAnim = Math.min(flower.bloomAnim + dt * 1.4, 0.55);
      } else if (flower.drops === 1 && flower.bloomAnim < 0.25) {
        flower.bloomAnim = Math.min(flower.bloomAnim + dt * 1.2, 0.25);
      }
    }

    // Particles
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 180 * dt;
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

    for (const cloud of this._clouds) {
      if (Math.abs(x - cloud.x) < 80 && Math.abs(y - cloud.y) < 45) {
        this._triggerRain(cloud);
        return;
      }
    }
  }

  _triggerRain(cloud) {
    cloud.raining   = true;
    cloud.rainTimer = 0.6;

    const count = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      this._raindrops.push({
        x: cloud.x + (Math.random() - 0.5) * 60,
        y: cloud.y + 35,
      });
    }

    Audio.playPop();
  }

  _spawnSplash(x, y, color) {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      this._particles.push({
        x, y,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 60,
        life:  0.4 + Math.random() * 0.3,
        size:  2 + Math.random() * 3,
        color,
      });
    }
  }

  _render() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.68);
    skyGrad.addColorStop(0, '#aee4f7');
    skyGrad.addColorStop(1, '#d6f0fb');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.68);

    const grassGrad = ctx.createLinearGradient(0, H * 0.65, 0, H);
    grassGrad.addColorStop(0, '#7ec850');
    grassGrad.addColorStop(1, '#4a9e28');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, H * 0.65, W, H * 0.35);

    ctx.fillStyle = '#b5dfa0';
    ctx.fillRect(0, H * 0.63, W, H * 0.06);

    for (const cloud of this._clouds) {
      this._drawCloud(cloud);
    }

    for (const drop of this._raindrops) {
      this._drawRaindrop(drop.x, drop.y);
    }

    for (const flower of this._flowers) {
      this._drawFlower(flower);
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

    if (!this._roundClearing) {
      ctx.save();
      ctx.font        = `bold ${Math.round(W * 0.038)}px sans-serif`;
      ctx.fillStyle   = '#2471a3';
      ctx.textAlign   = 'center';
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur  = 6;
      ctx.fillText('Tap the clouds to water the flowers! 🌧️', W / 2, H * 0.56);
      ctx.restore();
    }

    if (this._pauseTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(0, 0, W, H);

      ctx.font         = `bold ${Math.round(W * 0.07)}px sans-serif`;
      ctx.fillStyle    = '#27ae60';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur   = 8;

      const msg = this._round < this._totalRounds
        ? `Round ${this._round} Clear! 🌸`
        : 'Garden is in full bloom! 🌺';
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

  _drawCloud(cloud) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cloud.x, cloud.y);

    const fillColor = cloud.raining ? '#c8dce8' : '#f0f4f8';

    for (const puff of cloud.puffs) {
      ctx.beginPath();
      ctx.ellipse(puff.dx, puff.dy, puff.rx, puff.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle   = fillColor;
      ctx.fill();
      ctx.strokeStyle = '#d0dde8';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawRaindrop(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle   = '#2e86c1';
    ctx.globalAlpha = 0.85;

    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 4, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawFlower(flower) {
    const ctx  = this.ctx;
    const anim = flower.bloomAnim;
    const x    = flower.x;
    const y    = flower.y;

    if (flower.drops === 0 && anim < 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y - 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#8d6e3e';
      ctx.fill();
      ctx.restore();
      return;
    }

    const maxStemH = 55;
    const stemH    = maxStemH * Math.min(anim * 2, 1);
    const stemTop  = y - stemH;

    ctx.save();
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth   = Math.max(2, 4 * anim);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, stemTop);
    ctx.stroke();
    ctx.restore();

    if (anim > 0.3) {
      const leafAlpha = Math.min((anim - 0.3) / 0.3, 1);
      const leafY     = y - stemH * 0.55;
      const leafW     = 14 * anim;
      const leafH     = 8  * anim;
      ctx.save();
      ctx.globalAlpha = leafAlpha;
      ctx.fillStyle   = '#2ecc71';
      ctx.beginPath();
      ctx.ellipse(x - leafW * 0.8, leafY, leafW, leafH, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + leafW * 0.8, leafY, leafW, leafH,  0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (anim > 0.45) {
      const petalAlpha = Math.min((anim - 0.45) / 0.45, 1);
      const petalR     = 10 + 14 * anim;
      const centerR    = 6  +  6 * anim;

      ctx.save();
      ctx.globalAlpha = petalAlpha;
      ctx.translate(x, stemTop);

      ctx.fillStyle = flower.color;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * petalR, Math.sin(angle) * petalR, petalR * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#f9e04b';
      ctx.beginPath();
      ctx.arc(0, 0, centerR, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
