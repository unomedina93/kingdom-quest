// ===== ROCKET LAUNCH =====
// Count DOWN from 10 to 1, then tap LAUNCH!
// Numbers are big, colorful buttons. Teaches reverse counting.

class RocketLaunchGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;
    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;
    this.phase      = 'countdown'; // 'countdown' | 'launch' | 'celebrate'
    this.next       = 10;
    this.stars      = [];
    this.rocket     = { y: 0, vy: 0, launched: false };
    this.particles  = [];
    this.shakeTimer = 0;
    this._btns      = [];
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);
  }

  start() {
    this._running = true;
    this.phase    = 'countdown';
    this.next     = 10;
    this.rocket   = { x: 0, y: 0, vy: 0, launched: false, flame: 0 };
    this.stars    = Array.from({length:60},()=>({ x:Math.random(), y:Math.random(), r:1+Math.random()*2, twinkle:Math.random()*Math.PI*2 }));
    this._buildBtns();
    document.addEventListener('click',      this._boundClick);
    document.addEventListener('touchstart', this._boundTouch, { passive: false });
    App.setHUDTitle('Rocket Launch!');
    App.updateHUDScore(0);
    Audio.speak("Count down from ten to one, then launch the rocket!", { rate: 0.9 });
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    document.removeEventListener('click',      this._boundClick);
    document.removeEventListener('touchstart', this._boundTouch);
  }

  _buildBtns() {
    const W = this.canvas.width, H = this.canvas.height;
    const cols = 5, rows = 2;
    const btnW = (W - 40) / cols, btnH = (H * 0.55) / rows;
    const colors = ['#e53935','#e91e63','#9c27b0','#3f51b5','#2196f3','#009688','#4caf50','#ff9800','#ff5722','#607d8b'];
    this._btns = [];
    for (let n = 10; n >= 1; n--) {
      const i = 10 - n;
      this._btns.push({
        n, color: colors[i],
        x: 20 + (i % cols) * btnW + btnW/2,
        y: H*0.18 + Math.floor(i/cols)*btnH + btnH/2,
        w: btnW - 12, h: btnH - 12,
        bounce: 0, used: false,
      });
    }
    // Launch button (appears after countdown)
    this._launchBtn = {
      x: W/2, y: H*0.78, w: 200, h: 70,
      bounce: 0,
    };
    this.rocket.x = W/2;
    this.rocket.y = H - 100;
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
    const H = this.canvas.height;
    for (const b of this._btns) {
      if (b.bounce > 0) b.bounce -= dt*4;
    }
    if (this._launchBtn.bounce > 0) this._launchBtn.bounce -= dt*4;
    if (this.shakeTimer > 0) this.shakeTimer -= dt;

    // Stars twinkle
    for (const s of this.stars) s.twinkle += dt;

    // Rocket flying
    if (this.phase === 'launch') {
      this.rocket.vy -= 600 * dt;
      this.rocket.y  += this.rocket.vy * dt;
      this.rocket.flame += dt * 8;
      // Exhaust particles
      if (Math.random() < 0.5) {
        this.particles.push({
          x: this.rocket.x + (Math.random()-0.5)*20,
          y: this.rocket.y + 60,
          vx:(Math.random()-0.5)*60, vy: 80+Math.random()*120,
          color:['#ff9800','#fdd835','#ff5722'][Math.floor(Math.random()*3)],
          r:5+Math.random()*8, life:0.6,
        });
      }
      if (this.rocket.y < -200) {
        this.phase = 'celebrate';
        this._celebrate();
      }
    }

    for (let i = this.particles.length-1; i >= 0; i--) {
      const p = this.particles[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=150*dt; p.life-=dt;
      if (p.life<=0) this.particles.splice(i,1);
    }
  }

  _celebrate() {
    const W = this.canvas.width, H = this.canvas.height;
    const cols = ['#fdd835','#e53935','#1e88e5','#43a047','#8e24aa','#ff69b4'];
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        x:Math.random()*W, y:H*0.3+Math.random()*H*0.4,
        vx:(Math.random()-0.5)*200, vy:-100-Math.random()*200,
        color:cols[Math.floor(Math.random()*cols.length)],
        r:4+Math.random()*7, life:1.5+Math.random(),
      });
    }
    Audio.speak("Blast off! The rocket is flying to the stars! Amazing counting!", { rate:0.9, interrupt:true });
    setTimeout(()=>{ this.onComplete(3); }, 4000);
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const shk = this.shakeTimer > 0 ? Math.sin(Date.now()/40)*4 : 0;
    ctx.save();
    ctx.translate(shk, 0);

    // Night sky
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#0d0d2e'); bg.addColorStop(1,'#1a1a4e');
    ctx.fillStyle = bg; ctx.fillRect(-10,0,W+20,H);

    // Stars
    for (const s of this.stars) {
      const a = 0.5+Math.sin(s.twinkle)*0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Particles (exhaust + confetti)
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life/1.5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1,p.r), 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Number buttons (countdown phase)
    if (this.phase === 'countdown') {
      for (const b of this._btns) {
        if (b.used) continue;
        const isNext = b.n === this.next;
        const bob = b.bounce > 0 ? -Math.abs(Math.sin(b.bounce*Math.PI))*14 : 0;
        ctx.save();
        ctx.translate(b.x, b.y + bob);
        ctx.fillStyle = isNext ? b.color : 'rgba(255,255,255,0.15)';
        ctx.strokeStyle = isNext ? '#ffd700' : b.color;
        ctx.lineWidth = isNext ? 4 : 2;
        ctx.shadowColor = isNext ? b.color : 'transparent';
        ctx.shadowBlur  = isNext ? 20 : 0;
        ctx.beginPath(); ctx.roundRect(-b.w/2,-b.h/2,b.w,b.h,14); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = isNext ? 'white' : 'rgba(255,255,255,0.5)';
        ctx.font = `bold ${Math.floor(b.h*0.55)}px "Fredoka One","Nunito",sans-serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(String(b.n), 0, 0);
        ctx.restore();
      }

      // Launch button (only when countdown complete)
      if (this.next === 0) {
        const lb = this._launchBtn;
        const bob = lb.bounce > 0 ? -Math.abs(Math.sin(lb.bounce*Math.PI))*10 : 0;
        ctx.save();
        ctx.translate(lb.x, lb.y + bob);
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = 'white'; ctx.lineWidth = 4;
        ctx.shadowColor='#ffd700'; ctx.shadowBlur=25;
        ctx.beginPath(); ctx.roundRect(-lb.w/2,-lb.h/2,lb.w,lb.h,20); ctx.fill(); ctx.stroke();
        ctx.shadowBlur=0;
        ctx.fillStyle='#212121';
        ctx.font='bold 28px "Fredoka One","Nunito",sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🚀 LAUNCH!', 0, 0);
        ctx.restore();
      }
    }

    // Countdown prompt
    if (this.phase === 'countdown' && this.next > 0) {
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(W/2-130,H-55,260,40,10); ctx.fill();
      ctx.fillStyle='#ffd700';
      ctx.font='bold 20px "Fredoka One","Nunito",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`Tap number ${this.next}! 🚀`, W/2, H-35);
      ctx.textBaseline='alphabetic';
    }

    // Rocket (always drawn, moves during launch)
    if (this.phase !== 'celebrate') {
      const ry = this.rocket.y;
      const rx = this.rocket.x;
      ctx.save(); ctx.translate(rx, ry);
      // Flame
      if (this.phase === 'launch') {
        const flicker = 0.7 + Math.sin(this.rocket.flame)*0.3;
        ctx.fillStyle='#ff9800';
        ctx.beginPath(); ctx.ellipse(0,50,14*flicker,30*flicker,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fdd835';
        ctx.beginPath(); ctx.ellipse(0,45,8*flicker,20*flicker,0,0,Math.PI*2); ctx.fill();
      }
      // Body
      ctx.fillStyle='#e53935';
      ctx.beginPath(); ctx.roundRect(-20,-50,40,80,8); ctx.fill();
      // Nose cone
      ctx.fillStyle='#ff7043';
      ctx.beginPath(); ctx.moveTo(-20,-50); ctx.lineTo(20,-50); ctx.lineTo(0,-85); ctx.closePath(); ctx.fill();
      // Window
      ctx.fillStyle='#b3e5fc';
      ctx.beginPath(); ctx.arc(0,-25,12,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='white'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,-25,12,0,Math.PI*2); ctx.stroke();
      // Fins
      ctx.fillStyle='#ef9a9a';
      ctx.beginPath(); ctx.moveTo(-20,30); ctx.lineTo(-38,60); ctx.lineTo(-20,50); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo( 20,30); ctx.lineTo( 38,60); ctx.lineTo( 20,50); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // undo shake
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }

  _onClick(e) {
    if (!this._running) return;
    const rect = this.canvas.getBoundingClientRect();
    this._tryTap(e.clientX-rect.left, e.clientY-rect.top);
  }

  _onTouch(e) {
    if (!this._running) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this._tryTap(e.touches[0].clientX-rect.left, e.touches[0].clientY-rect.top);
  }

  _tryTap(px, py) {
    if (this.phase === 'launch' || this.phase === 'celebrate') return;

    // Launch button
    if (this.next === 0) {
      const lb = this._launchBtn;
      if (Math.abs(px-lb.x)<lb.w/2 && Math.abs(py-lb.y)<lb.h/2) {
        lb.bounce = 1;
        this.phase = 'launch';
        this.rocket.vy = 0;
        this.shakeTimer = 0.5;
        Audio.speak("Blast off!", { rate:1.0, interrupt:true });
        Audio.playVictory();
        return;
      }
    }

    // Number buttons
    for (const b of this._btns) {
      if (b.used) continue;
      if (Math.abs(px-b.x)<b.w/2 && Math.abs(py-b.y)<b.h/2) {
        if (b.n === this.next) {
          b.used = true; b.bounce = 1;
          App.updateHUDScore(11 - this.next);
          Audio.playSuccess();
          const nums=['ten','nine','eight','seven','six','five','four','three','two','one'];
          Audio.speak(nums[10-this.next], { rate:0.95, interrupt:true });
          this.next--;
          if (this.next === 0) {
            setTimeout(()=>Audio.speak("Now tap LAUNCH!", {rate:0.9}), 600);
          }
        } else {
          Audio.playWrong();
          Audio.speak(`Find number ${this.next}!`, { rate:1.0, interrupt:true });
        }
        return;
      }
    }
  }
}
