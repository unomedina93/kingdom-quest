// ===== SHADOW MATCH GAME =====
// Show a colorful kingdom item at the top.
// Four dark "shadow" cards below — tap the matching silhouette!

const SHADOW_ITEMS = [
  { emoji: '👑', name: 'Crown'     },
  { emoji: '🏰', name: 'Castle'    },
  { emoji: '🐉', name: 'Dragon'    },
  { emoji: '⚔️', name: 'Sword'     },
  { emoji: '🛡️', name: 'Shield'    },
  { emoji: '🦁', name: 'Lion'      },
  { emoji: '🌟', name: 'Star'      },
  { emoji: '🔑', name: 'Key'       },
  { emoji: '🕊️', name: 'Dove'      },
  { emoji: '🌈', name: 'Rainbow'   },
  { emoji: '💎', name: 'Gem'       },
  { emoji: '🌸', name: 'Flower'    },
  { emoji: '🐑', name: 'Sheep'     },
  { emoji: '🦋', name: 'Butterfly' },
  { emoji: '🏹', name: 'Arrow'     },
  { emoji: '🪄', name: 'Wand'      },
];

const SHADOW_ROUNDS = { easy: 3, medium: 5, hard: 7 };

class ShadowMatchGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this.running     = false;
    this.particles   = [];
    this.round       = 0;
    this.totalRounds = 3;
    this.correct     = 0;
    this.target      = null;
    this.choices     = [];   // [{emoji,name,x,y,w,h,isCorrect,state}]
    this.answered    = false;
    this.wrongTimer  = 0;

    this._onClick = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this._handleClick(
        (e.clientX - r.left) * (this.canvas.width  / r.width),
        (e.clientY - r.top)  * (this.canvas.height / r.height)
      );
    };
    this._onTouch = (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      this._handleClick(
        (t.clientX - r.left) * (this.canvas.width  / r.width),
        (t.clientY - r.top)  * (this.canvas.height / r.height)
      );
    };

    this._rafId    = null;
    this._lastTime = 0;
  }

  // =====================================================================
  //  LIFECYCLE
  // =====================================================================

  start() {
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this._layout(); });
    this.running     = true;
    this.particles   = [];
    this.round       = 0;
    this.correct     = 0;
    this.totalRounds = SHADOW_ROUNDS[App.difficulty] || 3;

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });

    App.setHUDTitle('Shadow Match 🌑');
    App.updateHUDScore(0);
    App.updateHUDHearts(this.totalRounds);

    this._nextRound();
    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('click',    this._onClick);
    this.canvas.removeEventListener('touchend', this._onTouch);
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // =====================================================================
  //  ROUND LOGIC
  // =====================================================================

  _nextRound() {
    this.answered  = false;
    this.wrongTimer = 0;

    const shuffled = [...SHADOW_ITEMS].sort(() => Math.random() - 0.5);
    this.target    = shuffled[0];
    const wrongs   = shuffled.slice(1, 4);

    this.choices = [{ ...this.target, isCorrect: true }, ...wrongs.map(w => ({ ...w, isCorrect: false }))]
      .sort(() => Math.random() - 0.5)
      .map(c => ({ ...c, x: 0, y: 0, w: 0, h: 0, state: 'normal' }));

    this._layout();
    Audio.speak(`Find the shadow of the ${this.target.name}!`, { interrupt: true });
  }

  _layout() {
    const { canvas } = this;
    const W = canvas.width, H = canvas.height;
    const hudH = 70;
    const cols = 2, pad = 16;
    const topY   = hudH + H * 0.36;
    const availW = W - pad * 2;
    const availH = H - topY - pad - 24;
    const cw = Math.floor((availW - pad) / cols);
    const ch = Math.floor((availH - pad) / 2);

    this.choices.forEach((c, i) => {
      c.x = pad + (i % cols) * (cw + pad);
      c.y = topY + Math.floor(i / cols) * (ch + pad);
      c.w = cw; c.h = ch;
    });
  }

  _handleClick(x, y) {
    if (this.answered) return;
    for (const choice of this.choices) {
      if (x >= choice.x && x <= choice.x + choice.w &&
          y >= choice.y && y <= choice.y + choice.h) {

        if (choice.isCorrect) {
          choice.state  = 'correct';
          this.answered = true;
          this.correct++;
          App.updateHUDScore(this.correct);
          Audio.playSuccess();
          this._burst(choice.x + choice.w / 2, choice.y + choice.h / 2);

          const last = (this.round + 1) >= this.totalRounds;
          Audio.speak(last
            ? `Amazing! You found all the shadows! You have great eyes!`
            : `Yes! That is the ${this.target.name}! Great job!`, {
            onEnd: () => {
              if (last) this._endGame();
              else { this.round++; this._nextRound(); }
            }
          });
        } else {
          choice.state  = 'wrong';
          this.wrongTimer = 0.5;
          Audio.playWrong();
          setTimeout(() => { choice.state = 'normal'; }, 500);
        }
        break;
      }
    }
  }

  // =====================================================================
  //  PARTICLES & END
  // =====================================================================

  _burst(cx, cy) {
    const colors = ['#ffd700','#ff9800','#4caf50','#2196f3','#e91e63'];
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.6 + Math.random() * 0.5,
        size: 6 + Math.random() * 9,
      });
    }
  }

  _endGame() {
    this.running = false;
    this.stop();
    Audio.speak('Wonderful! You are a shadow master!', { interrupt: true });
    App.showOverlay('🌑', 'Shadow Master!', 'Claim Stars! ⭐', () => {
      this.onComplete(3);
    });
  }

  // =====================================================================
  //  LOOP
  // =====================================================================

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    if (this.wrongTimer > 0) this.wrongTimer -= dt;
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 300 * dt; p.life -= dt;
    });
  }

  // =====================================================================
  //  RENDER
  // =====================================================================

  _render() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;

    // Night-sky background
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#04001a');
    grd.addColorStop(1, '#0d0030');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 28; i++) {
      ctx.beginPath();
      ctx.arc((i * 139 + 40) % W, ((i * 87 + 30) % (H * 0.36)) + 65, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Round counter
    ctx.fillStyle = '#d8b4fe';
    ctx.font = `bold ${Math.min(18, W / 22)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Round ${this.round + 1} of ${this.totalRounds}`, W / 2, 52);

    // Target item — big, colorful
    if (this.target) {
      const hudH  = 70;
      const bigSz = Math.min(H * 0.13, W * 0.20, 96);

      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${Math.min(20, W / 16)}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,215,0,0.4)'; ctx.shadowBlur = 14;
      ctx.fillText('Find this shadow! 🌑', W / 2, hudH + 26);
      ctx.shadowBlur = 0;

      ctx.font = `${bigSz}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.target.emoji, W / 2, hudH + 26 + bigSz * 0.95);
      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = 'rgba(255,220,255,0.75)';
      ctx.font = `bold ${Math.min(17, W / 18)}px Nunito, sans-serif`;
      ctx.fillText(this.target.name, W / 2, hudH + 26 + bigSz * 1.78);
    }

    // Choice cards — dark silhouette style
    this.choices.forEach(c => {
      const shk = (c.state === 'wrong' && this.wrongTimer > 0)
        ? Math.sin(this.wrongTimer * 46) * 8 : 0;

      ctx.save();

      // Card background
      const grad = ctx.createLinearGradient(c.x + shk, c.y, c.x + c.w + shk, c.y + c.h);
      if      (c.state === 'correct') { grad.addColorStop(0, '#14532d'); grad.addColorStop(1, '#166534'); }
      else if (c.state === 'wrong')   { grad.addColorStop(0, '#7f1d1d'); grad.addColorStop(1, '#991b1b'); }
      else                            { grad.addColorStop(0, '#08001e'); grad.addColorStop(1, '#120038'); }
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(c.x + shk, c.y, c.w, c.h, 14); ctx.fill();

      // Border
      ctx.strokeStyle = c.state === 'correct' ? '#4ade80'
                      : c.state === 'wrong'   ? '#f87171'
                      : 'rgba(100,60,200,0.5)';
      ctx.lineWidth = c.state === 'correct' ? 3 : 2;
      if (c.state === 'correct') { ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 22; }
      ctx.stroke(); ctx.shadowBlur = 0;

      // Draw emoji, then overlay dark mask for the "shadow" effect
      const eSz = Math.min(c.h * 0.52, c.w * 0.60, 72);
      const ecx = c.x + c.w / 2 + shk;
      const ecy = c.y + c.h * 0.44;

      ctx.font = `${eSz}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.emoji, ecx, ecy);

      // Dark overlay for silhouette effect (skip when correct)
      if (c.state !== 'correct') {
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = c.state === 'wrong' ? 'rgba(80,0,0,0.7)' : 'rgba(6,0,28,0.82)';
        ctx.beginPath(); ctx.roundRect(c.x + shk + 2, c.y + 2, c.w - 4, c.h - 4, 12); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // After correct: show name label
      if (c.state === 'correct') {
        ctx.fillStyle = '#4ade80';
        ctx.font = `bold ${Math.min(14, c.w / 5)}px Nunito, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(c.name, ecx, c.y + c.h - 10);
      }

      ctx.restore();
    });

    // Particles
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // Progress dots at bottom
    const dotR = 7, gap = 22, total = this.totalRounds;
    const dotsW = total * dotR * 2 + (total - 1) * (gap - dotR * 2);
    let dx = W / 2 - dotsW / 2 + dotR;
    for (let i = 0; i < total; i++) {
      ctx.beginPath(); ctx.arc(dx, H - 20, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < this.round ? '#ffd700' : i === this.round ? '#a855f7' : 'rgba(255,255,255,0.18)';
      ctx.fill(); dx += gap;
    }
  }
}
