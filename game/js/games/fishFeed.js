// ===== FISH FEED =====
// Tap each hungry fish to feed it! All fish fed = you win!
// Cute fish swim in a colorful tank. Fish open mouths when tapped.

class FishFeedGame {
  static FISH_COLORS = ['#e53935','#fb8c00','#fdd835','#43a047','#1e88e5','#8e24aa','#f48fb1','#00bcd4'];

  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;
    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;
    this.fish       = [];
    this.bubbles    = [];
    this.foodPellets= [];
    this.round      = 0;
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);
  }

  start(roundIndex = 0) {
    this.round    = roundIndex % 4;
    this._running = true;
    this._spawnFish();
    this._spawnBubbles();
    document.addEventListener('click',      this._boundClick);
    document.addEventListener('touchstart', this._boundTouch, { passive: false });
    App.setHUDTitle('Fish Feed!');
    App.updateHUDScore(0);
    Audio.speak("Tap each fish to feed it! Feed them all!", { rate: 0.9 });
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    document.removeEventListener('click',      this._boundClick);
    document.removeEventListener('touchstart', this._boundTouch);
  }

  _spawnFish() {
    const count = 4 + this.round;
    const W = this.canvas.width, H = this.canvas.height;
    this.fish = [];
    for (let i = 0; i < count; i++) {
      const color = FishFeedGame.FISH_COLORS[i % FishFeedGame.FISH_COLORS.length];
      this.fish.push({
        x:     80 + Math.random() * (W - 160),
        y:     100 + Math.random() * (H - 220),
        vx:    (Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 40 + this.round * 10),
        vy:    (Math.random() - 0.5) * 20,
        color, size: 28 + Math.random() * 16,
        fed:   false,
        mouthOpen: 0,  // 0-1
        mouthTimer: 0,
        wobble: Math.random() * Math.PI * 2,
        hearts: [],
      });
    }
  }

  _spawnBubbles() {
    const W = this.canvas.width, H = this.canvas.height;
    this.bubbles = Array.from({length:18}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: 3 + Math.random()*9,
      vy: -(12 + Math.random()*20),
      alpha: 0.15 + Math.random()*0.25,
    }));
  }

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs)/1000, 0.05);
    this._lastTs = ts;
    this._update(dt);
    this._render();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    const W = this.canvas.width, H = this.canvas.height;

    for (const f of this.fish) {
      if (f.fed) {
        f.wobble += dt * 2;
        f.y -= 8 * dt; // float up slightly when fed
        // Update floating hearts
        for (let i = f.hearts.length-1; i >= 0; i--) {
          const h = f.hearts[i];
          h.y -= 40*dt; h.life -= dt;
          if (h.life <= 0) f.hearts.splice(i, 1);
        }
        continue;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.wobble += dt * 2;
      f.y += Math.sin(f.wobble) * 0.4;

      // Bounce walls
      if (f.x < f.size || f.x > W - f.size) f.vx *= -1;
      if (f.y < 80 || f.y > H - 80) f.vy *= -1;
      f.x = Math.max(f.size, Math.min(W-f.size, f.x));
      f.y = Math.max(80, Math.min(H-80, f.y));

      // Mouth animation
      if (f.mouthOpen > 0) {
        f.mouthTimer -= dt;
        if (f.mouthTimer <= 0) f.mouthOpen = 0;
      }
    }

    // Bubbles
    for (const b of this.bubbles) {
      b.y += b.vy * dt;
      if (b.y < -20) { b.y = H + 10; b.x = Math.random()*W; }
    }

    // Food pellets
    for (let i = this.foodPellets.length-1; i >= 0; i--) {
      const p = this.foodPellets[i];
      p.y += p.vy*dt; p.vy += 60*dt; p.life -= dt;
      if (p.life <= 0) this.foodPellets.splice(i, 1);
    }
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;

    // Tank water gradient
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#0277bd'); bg.addColorStop(0.7,'#01579b'); bg.addColorStop(1,'#1a237e');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    // Sandy bottom
    const sand = ctx.createLinearGradient(0,H-60,0,H);
    sand.addColorStop(0,'#f9a825'); sand.addColorStop(1,'#f57f17');
    ctx.fillStyle = sand; ctx.beginPath(); ctx.ellipse(W/2,H,W*0.7,50,0,0,Math.PI); ctx.fill();

    // Seaweed
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 4;
    for (const swx of [W*0.1,W*0.3,W*0.65,W*0.85]) {
      ctx.beginPath(); ctx.moveTo(swx, H-20);
      for (let sy = H-40; sy > H*0.55; sy -= 20) {
        ctx.quadraticCurveTo(swx + Math.sin(Date.now()/800+swx)*12, sy-10, swx, sy);
      }
      ctx.stroke();
    }

    // Bubbles
    for (const b of this.bubbles) {
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Food pellets
    for (const p of this.foodPellets) {
      ctx.globalAlpha = Math.max(0, p.life/0.8);
      ctx.fillStyle = '#a5d6a7';
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Fish
    for (const f of this.fish) {
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.vx < 0) ctx.scale(-1, 1); // flip left-swimming fish

      const sc = f.size;
      // Tail
      ctx.fillStyle = f.fed ? '#ffd700' : f.color;
      ctx.beginPath();
      ctx.moveTo(-sc*0.6, 0);
      ctx.lineTo(-sc*1.2, -sc*0.55);
      ctx.lineTo(-sc*1.2,  sc*0.55);
      ctx.closePath(); ctx.fill();

      // Body
      ctx.fillStyle = f.fed ? '#ffd700' : f.color;
      ctx.beginPath(); ctx.ellipse(0, 0, sc, sc*0.6, 0, 0, Math.PI*2); ctx.fill();

      // Belly shine
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.ellipse(-sc*0.1, -sc*0.18, sc*0.45, sc*0.22, 0, 0, Math.PI*2); ctx.fill();

      // Eye
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(sc*0.45, -sc*0.15, sc*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#212121';
      ctx.beginPath(); ctx.arc(sc*0.48, -sc*0.15, sc*0.1, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(sc*0.5, -sc*0.18, sc*0.04, 0, Math.PI*2); ctx.fill();

      // Mouth (open or smile)
      ctx.strokeStyle = f.fed ? '#ffd700' : '#212121';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (f.mouthOpen > 0.3) {
        ctx.arc(sc*0.68, sc*0.1, sc*0.12, 0, Math.PI); // open O
      } else {
        ctx.arc(sc*0.68, sc*0.12, sc*0.08, 0.2, Math.PI-0.2); // smile
      }
      ctx.stroke();

      // Fed indicator
      if (f.fed) {
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${Math.floor(sc*0.5)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✓', 0, 0);
      }
      ctx.restore();

      // Floating hearts above fed fish
      for (const h of f.hearts) {
        ctx.globalAlpha = h.life;
        ctx.fillStyle = '#e91e63';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❤️', f.x, f.y + h.y);
      }
      ctx.globalAlpha = 1;
    }

    // HUD: how many fed
    const fedCount = this.fish.filter(f=>f.fed).length;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(W/2-90,8,180,38,10); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px "Fredoka One","Nunito",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Fed: ${fedCount} / ${this.fish.length}`, W/2, 27);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this._tryFeed(e.clientX-rect.left, e.clientY-rect.top);
  }

  _onTouch(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this._tryFeed(e.touches[0].clientX-rect.left, e.touches[0].clientY-rect.top);
  }

  _tryFeed(px, py) {
    if (!this._running) return;
    for (const f of this.fish) {
      if (f.fed) continue;
      if (Math.hypot(f.x-px, f.y-py) < f.size * 1.4) {
        f.fed = true;
        f.mouthOpen = 1; f.mouthTimer = 0.8;
        f.hearts = [{y:0,life:1},{y:-10,life:0.8}];
        for (let i=0;i<4;i++) this.foodPellets.push({x:px,y:py,vx:(Math.random()-0.5)*60,vy:-60-Math.random()*60,life:0.8});
        Audio.playSuccess();
        const phrases=['Yum!','Delicious!','Thank you!','More please!'];
        Audio.speak(phrases[Math.floor(Math.random()*phrases.length)], { rate:1.1, interrupt:true });
        App.updateHUDScore(this.fish.filter(f=>f.fed).length);
        this._checkWin();
        return;
      }
    }
  }

  _checkWin() {
    if (this.fish.every(f => f.fed)) {
      setTimeout(() => {
        this.round++;
        if (this.round >= 4) {
          Audio.speak("All fish are full and happy! You're a great fish feeder!", { rate:0.9, interrupt:true });
          setTimeout(() => { this.onComplete(3); }, 2500);
        } else {
          Audio.speak("All fish fed! Here come more hungry fish!", { rate:0.9, interrupt:true });
          setTimeout(() => { this._spawnFish(); App.updateHUDScore(0); }, 1500);
        }
      }, 800);
    }
  }
}
