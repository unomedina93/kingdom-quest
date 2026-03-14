// ===== SHAPE SORT =====
// Shapes fall from the top. Tap the matching bin at the bottom to catch them!
// Teaches shape recognition. 4 shapes: circle, square, triangle, star.

class ShapeSortGame {
  static SHAPES = ['circle','square','triangle','star'];
  static COLORS = { circle:'#e53935', square:'#1e88e5', triangle:'#43a047', star:'#fdd835' };
  static LABELS = { circle:'Circle', square:'Square', triangle:'Triangle', star:'Star' };

  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;
    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;
    this.fallers    = [];
    this.particles  = [];
    this.score      = 0;
    this.misses     = 0;
    this.round      = 0;
    this.spawnTimer = 0;
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);
    this._bins = [];
  }

  start(roundIndex = 0) {
    this.round    = roundIndex % 5;
    this._running = true;
    this.score    = 0;
    this.misses   = 0;
    this.fallers  = [];
    this.spawnTimer = 0;
    this._buildBins();
    document.addEventListener('click',      this._boundClick);
    document.addEventListener('touchstart', this._boundTouch, { passive: false });
    App.setHUDTitle('Shape Sort!');
    App.updateHUDScore(0);
    Audio.speak("Sort the shapes! Tap the right bin when a shape falls!", { rate: 0.9 });
    this._spawnFaller();
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    document.removeEventListener('click',      this._boundClick);
    document.removeEventListener('touchstart', this._boundTouch);
  }

  _buildBins() {
    const W = this.canvas.width, H = this.canvas.height;
    const binW = W / 4, binH = 80;
    this._bins = ShapeSortGame.SHAPES.map((shape, i) => ({
      shape,
      x: i * binW,
      y: H - binH,
      w: binW,
      h: binH,
      flash: 0,
      wrong: 0,
    }));
  }

  _spawnFaller() {
    const W = this.canvas.width;
    const shape = ShapeSortGame.SHAPES[Math.floor(Math.random() * 4)];
    const speed = 80 + this.round * 30;
    this.fallers.push({
      shape, x: 60 + Math.random() * (W - 120), y: -50,
      vy: speed, r: 32, wobble: 0,
      announced: false,
    });
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
    const H = this.canvas.height;
    this.spawnTimer -= dt;

    for (const f of this.fallers) {
      f.y += f.vy * dt;
      f.wobble += dt * 1.2;
      if (!f.announced && f.y > 60) {
        f.announced = true;
        Audio.speak(ShapeSortGame.LABELS[f.shape] + '!', { rate: 1.0 });
      }
      // Missed — hit bottom
      if (f.y > H + 20) {
        f.remove = true;
        this.misses++;
        Audio.playWrong();
        if (this.misses >= 8 + this.round * 2) this._nextRound();
      }
    }
    this.fallers = this.fallers.filter(f => !f.remove);

    // Bin flashes
    for (const b of this._bins) {
      if (b.flash > 0) b.flash -= dt * 3;
      if (b.wrong > 0) b.wrong -= dt * 3;
    }

    // Spawn next faller when none present
    if (this.fallers.length === 0 && this.spawnTimer <= 0) {
      this.spawnTimer = 0.3;
      this._spawnFaller();
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 180*dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Win at 15 correct
    if (this.score >= 15 + this.round * 5) this._nextRound();
  }

  _nextRound() {
    this.round++;
    if (this.round >= 5) {
      Audio.speak("Fantastic! You sorted all the shapes!", { rate: 0.9, interrupt: true });
      setTimeout(() => { this.onComplete(3); }, 2500);
    } else {
      this.score = 0; this.misses = 0; this.fallers = [];
      Audio.speak(`Round ${this.round + 1}! Faster shapes!`, { rate: 1.0, interrupt: true });
    }
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    // Background
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1a1a2e'); bg.addColorStop(1,'#16213e');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life/0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Falling shapes
    for (const f of this.fallers) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.fillStyle = ShapeSortGame.COLORS[f.shape];
      this._drawShape(ctx, f.shape, f.r);
      ctx.restore();
    }

    // Bins
    for (const b of this._bins) {
      const col = ShapeSortGame.COLORS[b.shape];
      ctx.fillStyle = b.flash > 0 ? col : b.wrong > 0 ? '#c62828' : 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.roundRect(b.x+2, b.y+2, b.w-4, b.h-4, [12,12,0,0]); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(b.x+2, b.y+2, b.w-4, b.h-4, [12,12,0,0]); ctx.stroke();
      // Shape icon in bin
      ctx.save();
      ctx.translate(b.x + b.w/2, b.y + b.h/2 - 8);
      ctx.fillStyle = b.flash > 0 ? 'white' : col;
      this._drawShape(ctx, b.shape, 16);
      ctx.restore();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 13px "Fredoka One","Nunito",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(ShapeSortGame.LABELS[b.shape], b.x + b.w/2, b.y + b.h - 6);
      ctx.textAlign = 'left';
    }

    // Score
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px "Fredoka One","Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.score}`, W/2, 44);
    ctx.textAlign = 'left';
  }

  _drawShape(ctx, shape, r) {
    switch (shape) {
      case 'circle':
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); break;
      case 'square':
        ctx.beginPath(); ctx.roundRect(-r,-r,r*2,r*2,5); ctx.fill(); break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0,-r*1.1); ctx.lineTo(r*1.0,r*0.8); ctx.lineTo(-r*1.0,r*0.8);
        ctx.closePath(); ctx.fill(); break;
      case 'star':
        ctx.beginPath();
        for (let i=0;i<10;i++) {
          const a = (i*Math.PI/5) - Math.PI/2;
          const rad = i%2===0 ? r : r*0.45;
          i===0 ? ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad) : ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
        }
        ctx.closePath(); ctx.fill(); break;
    }
  }

  _onClick(e) {
    if (!this._running) return;
    const rect = this.canvas.getBoundingClientRect();
    this._trySort(e.clientX - rect.left, e.clientY - rect.top);
  }

  _onTouch(e) {
    if (!this._running) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const t = e.touches[0];
    this._trySort(t.clientX - rect.left, t.clientY - rect.top);
  }

  _trySort(px, py) {
    // Find which bin was tapped
    const bin = this._bins.find(b => px >= b.x && px <= b.x+b.w && py >= b.y && py <= b.y+b.h);
    if (!bin || this.fallers.length === 0) return;
    const faller = this.fallers[0];
    if (bin.shape === faller.shape) {
      // Correct!
      bin.flash = 1;
      for (let i=0;i<12;i++) {
        const a=Math.random()*Math.PI*2, spd=70+Math.random()*120;
        this.particles.push({x:faller.x,y:faller.y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-50,color:ShapeSortGame.COLORS[faller.shape],r:4+Math.random()*5,life:0.5});
      }
      faller.remove = true;
      this.score++;
      App.updateHUDScore(this.score);
      Audio.playSuccess();
      if (this.score % 5 === 0) Audio.speak('Great job!', { rate: 1.0, interrupt: true });
      this.spawnTimer = 0.2;
    } else {
      bin.wrong = 1;
      Audio.playWrong();
    }
  }
}
