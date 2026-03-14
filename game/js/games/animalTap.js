// ===== ANIMAL TAP =====
// Four animals are shown. Narrator says one — tap the right one!
// Teaches animal names and recognition.

class AnimalTapGame {
  static ANIMALS = [
    { id:'dog',   label:'Dog',       color:'#8d6e63', draw: (ctx,r) => AnimalTapGame._drawDog(ctx,r)   },
    { id:'cat',   label:'Cat',       color:'#ff7043', draw: (ctx,r) => AnimalTapGame._drawCat(ctx,r)   },
    { id:'cow',   label:'Cow',       color:'#f5f5f5', draw: (ctx,r) => AnimalTapGame._drawCow(ctx,r)   },
    { id:'pig',   label:'Pig',       color:'#f48fb1', draw: (ctx,r) => AnimalTapGame._drawPig(ctx,r)   },
    { id:'duck',  label:'Duck',      color:'#fdd835', draw: (ctx,r) => AnimalTapGame._drawDuck(ctx,r)  },
    { id:'frog',  label:'Frog',      color:'#66bb6a', draw: (ctx,r) => AnimalTapGame._drawFrog(ctx,r)  },
    { id:'bear',  label:'Bear',      color:'#a1887f', draw: (ctx,r) => AnimalTapGame._drawBear(ctx,r)  },
    { id:'rabbit',label:'Rabbit',    color:'#f8bbd0', draw: (ctx,r) => AnimalTapGame._drawRabbit(ctx,r)},
  ];

  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;
    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;
    this.cards      = [];
    this.target     = null;
    this.score      = 0;
    this.total      = 0;
    this.state      = 'waiting'; // 'waiting' | 'result'
    this.stateTimer = 0;
    this.feedback   = null; // {correct, x, y}
    this.particles  = [];
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);
  }

  start() {
    this._running = true;
    this.score = 0; this.total = 0;
    document.addEventListener('click',      this._boundClick);
    document.addEventListener('touchstart', this._boundTouch, { passive: false });
    App.setHUDTitle('Animal Tap!');
    App.updateHUDScore(0);
    this._nextQuestion();
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    document.removeEventListener('click',      this._boundClick);
    document.removeEventListener('touchstart', this._boundTouch);
  }

  _nextQuestion() {
    // Pick 4 unique animals
    const pool = [...AnimalTapGame.ANIMALS].sort(() => Math.random() - 0.5).slice(0, 4);
    this.target = pool[Math.floor(Math.random() * pool.length)];

    const W = this.canvas.width, H = this.canvas.height;
    const cols = 2, rows = 2;
    const cellW = W / cols, cellH = (H - 100) / rows;
    this.cards = pool.map((animal, i) => ({
      animal,
      x: (i % cols) * cellW + cellW / 2,
      y: Math.floor(i / cols) * cellH + cellH / 2 + 50,
      r: Math.min(cellW, cellH) * 0.32,
      bounce: 0,
      shake: 0,
    }));

    this.state = 'waiting';
    this.feedback = null;
    setTimeout(() => {
      if (this._running) {
        Audio.speak(`Tap the ${this.target.label}!`, { rate: 0.85 });
      }
    }, 300);
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
    if (this.state === 'result') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.total >= 10) {
          Audio.speak(`Wonderful! You know ${this.score} out of 10 animals!`, { rate: 0.9, interrupt: true });
          setTimeout(() => { this.onComplete(3); }, 2500);
        } else {
          this._nextQuestion();
        }
      }
    }
    for (const c of this.cards) {
      if (c.bounce > 0) { c.bounce -= dt * 4; }
      if (c.shake  > 0) { c.shake  -= dt * 3; }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 200*dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#e8f5e9'); bg.addColorStop(1,'#c8e6c9');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    // Prompt banner
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(W/2-160, 6, 320, 42, 10); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px "Fredoka One","Nunito",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.target ? `Tap the ${this.target.label}!` : '…', W/2, 27);
    ctx.textBaseline = 'alphabetic';

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life/0.6);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cards
    for (const c of this.cards) {
      const shk = c.shake > 0 ? Math.sin(Date.now()/40)*7 : 0;
      const bob = c.bounce > 0 ? -Math.abs(Math.sin(c.bounce * Math.PI)) * 20 : 0;
      ctx.save();
      ctx.translate(c.x + shk, c.y + bob);
      // Card background
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.roundRect(-c.r-12,-c.r-12, (c.r+12)*2, (c.r+12)*2+24, 18); ctx.fill();
      ctx.shadowBlur = 0;
      // Animal
      ctx.fillStyle = c.animal.color;
      c.animal.draw(ctx, c.r);
      // Label
      ctx.fillStyle = '#333';
      ctx.font = `bold ${Math.floor(c.r*0.38)}px "Fredoka One","Nunito",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(c.animal.label, 0, c.r + 20);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  _onClick(e) {
    if (!this._running || this.state !== 'waiting') return;
    const rect = this.canvas.getBoundingClientRect();
    this._tryTap(e.clientX - rect.left, e.clientY - rect.top);
  }

  _onTouch(e) {
    if (!this._running || this.state !== 'waiting') return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this._tryTap(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
  }

  _tryTap(px, py) {
    const hit = this.cards.find(c => Math.hypot(c.x-px, c.y-py) < c.r + 20);
    if (!hit) return;
    this.total++;
    if (hit.animal.id === this.target.id) {
      this.score++;
      hit.bounce = 1;
      App.updateHUDScore(this.score);
      for (let i=0;i<16;i++){
        const a=Math.random()*Math.PI*2,spd=80+Math.random()*150;
        this.particles.push({x:hit.x,y:hit.y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-80,color:hit.animal.color,r:4+Math.random()*5,life:0.6});
      }
      Audio.playSuccess();
      const praises = ['Yes!','Correct!','Great job!','You got it!','Amazing!'];
      Audio.speak(`${praises[Math.floor(Math.random()*praises.length)]} That's a ${this.target.label}!`, { rate: 1.0, interrupt: true });
    } else {
      hit.shake = 0.5;
      Audio.playWrong();
      Audio.speak(`Try again! Find the ${this.target.label}!`, { rate: 1.0, interrupt: true });
      return; // Don't advance — let them try again
    }
    this.state = 'result';
    this.stateTimer = 1.5;
  }

  // ---- Animal drawings (simple canvas art) ----

  static _drawDog(ctx, r) {
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath(); ctx.ellipse(0,r*0.1,r*0.55,r*0.45,0,0,Math.PI*2); ctx.fill(); // body
    ctx.beginPath(); ctx.arc(0,-r*0.35,r*0.4,0,Math.PI*2); ctx.fill(); // head
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath(); ctx.ellipse(-r*0.35,-r*0.6,r*0.14,r*0.25,-.3,0,Math.PI*2); ctx.fill(); // left ear
    ctx.beginPath(); ctx.ellipse( r*0.35,-r*0.6,r*0.14,r*0.25, .3,0,Math.PI*2); ctx.fill(); // right ear
    ctx.fillStyle = '#212121';
    ctx.beginPath(); ctx.arc(-r*0.14,-r*0.38,r*0.07,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.14,-r*0.38,r*0.07,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(0,-r*0.18,r*0.12,0,Math.PI*2); ctx.fill(); // nose
  }

  static _drawCat(ctx, r) {
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.ellipse(0,r*0.15,r*0.5,r*0.42,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-r*0.3,r*0.38,0,Math.PI*2); ctx.fill();
    // Pointy ears
    ctx.beginPath(); ctx.moveTo(-r*0.2,-r*0.6); ctx.lineTo(-r*0.42,-r); ctx.lineTo(0,-r*0.62); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo( r*0.2,-r*0.6); ctx.lineTo( r*0.42,-r); ctx.lineTo(0,-r*0.62); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#212121';
    ctx.beginPath(); ctx.arc(-r*0.13,-r*0.32,r*0.06,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.13,-r*0.32,r*0.06,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#e91e63'; ctx.beginPath(); ctx.arc(0,-r*0.18,r*0.08,0,Math.PI*2); ctx.fill();
    // Whiskers
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1.5;
    for(const [sx,sy,ex,ey] of [[-r*0.18,-r*0.16,-r*0.55,-r*0.12],[-r*0.18,-r*0.2,-r*0.55,-r*0.25],[r*0.18,-r*0.16,r*0.55,-r*0.12],[r*0.18,-r*0.2,r*0.55,-r*0.25]])
    { ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke(); }
  }

  static _drawCow(ctx, r) {
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath(); ctx.ellipse(0,r*0.15,r*0.58,r*0.46,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-r*0.3,r*0.4,0,Math.PI*2); ctx.fill();
    // Spots
    ctx.fillStyle = '#424242';
    ctx.beginPath(); ctx.ellipse(-r*0.2,r*0.05,r*0.2,r*0.14,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.25,r*0.22,r*0.14,r*0.1,-0.2,0,Math.PI*2); ctx.fill();
    // Ears
    ctx.fillStyle='#f5f5f5';
    ctx.beginPath(); ctx.ellipse(-r*0.44,-r*0.28,r*0.14,r*0.1,-.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( r*0.44,-r*0.28,r*0.14,r*0.1, .5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#212121';
    ctx.beginPath(); ctx.arc(-r*0.14,-r*0.3,r*0.06,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.14,-r*0.3,r*0.06,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ef9a9a'; ctx.beginPath(); ctx.ellipse(0,-r*0.14,r*0.14,r*0.1,0,0,Math.PI*2); ctx.fill();
  }

  static _drawPig(ctx, r) {
    ctx.fillStyle = '#f48fb1';
    ctx.beginPath(); ctx.ellipse(0,r*0.15,r*0.55,r*0.45,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-r*0.3,r*0.42,0,Math.PI*2); ctx.fill();
    // Round ears
    ctx.beginPath(); ctx.arc(-r*0.3,-r*0.65,r*0.18,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.3,-r*0.65,r*0.18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#f06292';
    ctx.beginPath(); ctx.arc(-r*0.3,-r*0.65,r*0.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.3,-r*0.65,r*0.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#212121';
    ctx.beginPath(); ctx.arc(-r*0.14,-r*0.3,r*0.06,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.14,-r*0.3,r*0.06,0,Math.PI*2); ctx.fill();
    // Snout
    ctx.fillStyle='#f06292'; ctx.beginPath(); ctx.ellipse(0,-r*0.12,r*0.18,r*0.13,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ad1457';
    ctx.beginPath(); ctx.arc(-r*0.07,-r*0.13,r*0.04,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.07,-r*0.13,r*0.04,0,Math.PI*2); ctx.fill();
  }

  static _drawDuck(ctx, r) {
    ctx.fillStyle = '#fdd835';
    ctx.beginPath(); ctx.ellipse(0,r*0.2,r*0.5,r*0.38,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-r*0.1,-r*0.32,r*0.32,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fb8c00'; // beak
    ctx.beginPath(); ctx.moveTo(-r*0.38,-r*0.3); ctx.lineTo(-r*0.62,-r*0.22); ctx.lineTo(-r*0.38,-r*0.14); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#212121'; ctx.beginPath(); ctx.arc(-r*0.2,-r*0.36,r*0.06,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(-r*0.17,-r*0.38,r*0.025,0,Math.PI*2); ctx.fill();
  }

  static _drawFrog(ctx, r) {
    ctx.fillStyle = '#66bb6a';
    ctx.beginPath(); ctx.ellipse(0,r*0.2,r*0.55,r*0.4,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0,-r*0.25,r*0.45,r*0.35,0,0,Math.PI*2); ctx.fill();
    // Big eyes
    ctx.fillStyle='white';
    ctx.beginPath(); ctx.arc(-r*0.22,-r*0.58,r*0.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.22,-r*0.58,r*0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#212121';
    ctx.beginPath(); ctx.arc(-r*0.22,-r*0.6,r*0.12,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.22,-r*0.6,r*0.12,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#388e3c'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,-r*0.06,r*0.25,0.15,Math.PI-0.15); ctx.stroke();
  }

  static _drawBear(ctx, r) {
    ctx.fillStyle = '#a1887f';
    ctx.beginPath(); ctx.ellipse(0,r*0.15,r*0.52,r*0.44,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-r*0.28,r*0.42,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-r*0.36,-r*0.6,r*0.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.36,-r*0.6,r*0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#795548';
    ctx.beginPath(); ctx.arc(-r*0.36,-r*0.6,r*0.12,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.36,-r*0.6,r*0.12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#212121';
    ctx.beginPath(); ctx.arc(-r*0.14,-r*0.3,r*0.07,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.14,-r*0.3,r*0.07,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#5d4037'; ctx.beginPath(); ctx.ellipse(0,-r*0.12,r*0.16,r*0.12,0,0,Math.PI*2); ctx.fill();
  }

  static _drawRabbit(ctx, r) {
    ctx.fillStyle = '#f8bbd0';
    ctx.beginPath(); ctx.ellipse(0,r*0.18,r*0.5,r*0.42,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-r*0.28,r*0.36,0,Math.PI*2); ctx.fill();
    // Long ears
    ctx.beginPath(); ctx.ellipse(-r*0.22,-r*0.82,r*0.13,r*0.38,-.15,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( r*0.22,-r*0.82,r*0.13,r*0.38, .15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#f48fb1';
    ctx.beginPath(); ctx.ellipse(-r*0.22,-r*0.82,r*0.07,r*0.28,-.15,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( r*0.22,-r*0.82,r*0.07,r*0.28, .15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#212121';
    ctx.beginPath(); ctx.arc(-r*0.13,-r*0.3,r*0.06,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.13,-r*0.3,r*0.06,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#e91e63'; ctx.beginPath(); ctx.arc(0,-r*0.16,r*0.07,0,Math.PI*2); ctx.fill();
  }
}
