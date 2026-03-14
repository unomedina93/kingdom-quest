// ===== BALLOON POP =====
// Ten numbered balloons float up. Pop them in order 1 → 10!
// Teaches number sequence. Tap the wrong one = gentle shake, try again.

class BalloonPopGame {
  static COLORS = ['#e53935','#fb8c00','#fdd835','#43a047','#00acc1','#1e88e5','#8e24aa','#d81b60','#6d4c41','#546e7a'];

  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;
    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;
    this.balloons   = [];
    this.particles  = [];
    this.shakers    = {}; // id → shake timer
    this.next       = 1;  // next number to pop
    this.round      = 0;
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);
  }

  start(roundIndex = 0) {
    this.round    = roundIndex % 3;
    this._running = true;
    this.next     = 1;
    document.addEventListener('click',      this._boundClick);
    document.addEventListener('touchstart', this._boundTouch, { passive: false });
    App.setHUDTitle('Balloon Pop!');
    App.updateHUDScore(0);
    this._spawn();
    Audio.speak("Pop the balloons in order! Start with number one!", { rate: 0.9 });
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    document.removeEventListener('click',      this._boundClick);
    document.removeEventListener('touchstart', this._boundTouch);
  }

  _spawn() {
    const W = this.canvas.width, H = this.canvas.height;
    const count = 10 + this.round * 2; // more balloons (decoys) in later rounds, still only 1-10
    this.balloons = [];
    // Place 10 numbered balloons at random positions
    for (let n = 1; n <= 10; n++) {
      const margin = 70;
      this.balloons.push({
        id:    n,
        x:     margin + Math.random() * (W - margin * 2),
        y:     H * 0.15 + Math.random() * (H * 0.65),
        vy:    -(18 + Math.random() * 14 + this.round * 5),
        r:     32 + Math.random() * 12,
        color: BalloonPopGame.COLORS[(n - 1) % BalloonPopGame.COLORS.length],
        alive: true,
        popTimer: 0,
        popScale: 1,
        wobble: Math.random() * Math.PI * 2,
        phase:  Math.random() * Math.PI * 2,
      });
    }
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
    for (const b of this.balloons) {
      if (!b.alive) {
        if (b.popTimer > 0) { b.popTimer -= dt; b.popScale += dt * 4; }
        continue;
      }
      b.y += b.vy * dt;
      b.wobble += dt * 1.4;
      b.x += Math.sin(b.wobble + b.phase) * 0.6;
      // Wrap — float back from bottom when off top
      if (b.y < -80) b.y = H + 60;
      b.x = Math.max(b.r + 10, Math.min(W - b.r - 10, b.x));
    }
    // Shake timers
    for (const k in this.shakers) {
      this.shakers[k] -= dt;
      if (this.shakers[k] <= 0) delete this.shakers[k];
    }
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    // Sky gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#87ceeb'); bg.addColorStop(1, '#e0f4ff');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // Fluffy clouds
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let c of [{x:W*0.15,y:H*0.12},{x:W*0.55,y:H*0.07},{x:W*0.82,y:H*0.18}]) {
      ctx.beginPath(); ctx.arc(c.x, c.y, 40, 0, Math.PI*2);
      ctx.arc(c.x+35, c.y-10, 28, 0, Math.PI*2);
      ctx.arc(c.x+60, c.y+5, 32, 0, Math.PI*2); ctx.fill();
    }
    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.6);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Balloons
    for (const b of this.balloons) {
      if (!b.alive && b.popTimer <= 0) continue;
      const shake = this.shakers[b.id] ? Math.sin(Date.now() / 40) * 6 : 0;
      ctx.save();
      ctx.translate(b.x + shake, b.y);
      if (!b.alive) {
        const s = b.popScale;
        ctx.scale(s, s);
        ctx.globalAlpha = Math.max(0, b.popTimer / 0.3);
      }
      // Balloon body
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 1.2, 0, 0, Math.PI*2); ctx.fill();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(-b.r*0.3, -b.r*0.35, b.r*0.28, b.r*0.18, -0.4, 0, Math.PI*2); ctx.fill();
      // Knot
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(0, b.r*1.22, 5, 0, Math.PI*2); ctx.fill();
      // String
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, b.r*1.25); ctx.lineTo(0, b.r*1.25+28); ctx.stroke();
      // Number
      const isNext = b.id === this.next;
      ctx.fillStyle = isNext ? '#fff' : 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.floor(b.r * 0.7)}px "Fredoka One","Nunito",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (isNext) {
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12;
      }
      ctx.fillText(String(b.id), 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // Next prompt
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(W/2-80, H-52, 160, 36, 10); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 19px "Fredoka One","Nunito",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Pop number ${this.next}! ✨`, W/2, H-34);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  _hit(x, y) {
    for (const b of this.balloons) {
      if (!b.alive) continue;
      const dist = Math.hypot(b.x - x, b.y - y);
      if (dist < b.r * 1.3) return b;
    }
    return null;
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this._tryPop(e.clientX - rect.left, e.clientY - rect.top);
  }

  _onTouch(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const t = e.touches[0];
    this._tryPop(t.clientX - rect.left, t.clientY - rect.top);
  }

  _tryPop(x, y) {
    if (!this._running) return;
    const b = this._hit(x, y);
    if (!b) return;
    if (b.id !== this.next) {
      // Wrong order — shake it
      this.shakers[b.id] = 0.4;
      Audio.playWrong();
      Audio.speak(`Not yet! Find number ${this.next}!`, { rate: 1.0, interrupt: true });
      return;
    }
    // Correct!
    b.alive = false; b.popTimer = 0.3; b.popScale = 1;
    // Burst
    for (let i = 0; i < 14; i++) {
      const a = Math.random()*Math.PI*2, spd = 80+Math.random()*140;
      this.particles.push({ x:b.x, y:b.y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd-60, color:b.color, r:4+Math.random()*5, life:0.6 });
    }
    Audio.playPop();
    const nums = ['one','two','three','four','five','six','seven','eight','nine','ten'];
    Audio.speak(nums[this.next - 1] + '!', { rate: 1.1, interrupt: true });
    App.updateHUDScore(this.next);
    this.next++;
    if (this.next > 10) {
      setTimeout(() => {
        if (!this._running) return;
        Audio.speak('Amazing! You popped them all in order!', { rate: 0.9, interrupt: true });
        setTimeout(() => { this.onComplete(3); }, 2500);
      }, 600);
    }
  }
}
