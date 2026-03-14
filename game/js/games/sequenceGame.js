// ===== SEQUENCE GAME =====
// Three pictures shown in scrambled order.
// Tap them in the right story order: 1st, 2nd, 3rd!

const SEQUENCES = [
  {
    title: 'Growing Up',
    story: 'What happens first when a plant grows?',
    steps: [
      { emoji: '🌱', label: 'Sprout' },
      { emoji: '🌿', label: 'Grows'  },
      { emoji: '🌳', label: 'Tree'   },
    ],
    completeText: 'A tiny seed grows into a mighty tree! God helps things grow!',
  },
  {
    title: 'Day and Night',
    story: 'What comes first in the day?',
    steps: [
      { emoji: '🌅', label: 'Sunrise' },
      { emoji: '☀️', label: 'Daytime' },
      { emoji: '🌙', label: 'Night'   },
    ],
    completeText: 'God made the morning, the daytime, and the night! Beautiful!',
  },
  {
    title: 'A Baby Chick',
    story: 'How does a chick come into the world?',
    steps: [
      { emoji: '🥚', label: 'Egg'   },
      { emoji: '🐣', label: 'Hatch' },
      { emoji: '🐥', label: 'Chick' },
    ],
    completeText: 'From an egg to a chick! God made so many wonderful animals!',
  },
  {
    title: 'Rainbow After Rain',
    story: 'What happens when it rains?',
    steps: [
      { emoji: '🌧️', label: 'Rain'    },
      { emoji: '🌤️', label: 'Sun Out' },
      { emoji: '🌈', label: 'Rainbow' },
    ],
    completeText: 'A rainbow! God promised Noah He would always love us!',
  },
  {
    title: 'A Butterfly',
    story: 'How does a butterfly begin?',
    steps: [
      { emoji: '🐛', label: 'Caterpillar' },
      { emoji: '🫘', label: 'Cocoon'      },
      { emoji: '🦋', label: 'Butterfly'   },
    ],
    completeText: 'A caterpillar becomes a beautiful butterfly! God loves making things new!',
  },
  {
    title: 'Planting Seeds',
    story: 'What do you do to grow a flower?',
    steps: [
      { emoji: '🌱', label: 'Plant Seed' },
      { emoji: '💧', label: 'Water It'   },
      { emoji: '🌸', label: 'Flower!'    },
    ],
    completeText: 'You planted a flower! Jesus said faith can grow like a mustard seed!',
  },
  {
    title: 'Baking Bread',
    story: 'How is bread made?',
    steps: [
      { emoji: '🌾', label: 'Wheat'  },
      { emoji: '🥣', label: 'Dough'  },
      { emoji: '🍞', label: 'Bread!' },
    ],
    completeText: 'Bread! Jesus is the Bread of Life! He feeds our hearts!',
  },
  {
    title: 'The Kingdom Hero',
    story: 'What does a hero do?',
    steps: [
      { emoji: '😴', label: 'Sleep'  },
      { emoji: '⚔️', label: 'Train'  },
      { emoji: '🏆', label: 'Win!'   },
    ],
    completeText: 'Rest, train, and win! Be strong and courageous, just like Joshua!',
  },
];

const SEQ_ROUNDS = { easy: 3, medium: 5, hard: 7 };

class SequenceGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this.running     = false;
    this.particles   = [];

    this.round       = 0;
    this.totalRounds = 3;
    this.correct     = 0;

    this.sequence    = null;  // current SEQUENCES entry
    this.cards       = [];    // [{emoji,label,correctPos,displayPos,x,y,w,h,state,tapOrder}]
    this.nextTap     = 1;     // expecting tap of this position (1, 2, or 3)
    this.done        = false;
    this.wrongTimer  = 0;
    this.wrongCard   = null;

    this._usedIndices = [];

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
    this.running      = true;
    this.particles    = [];
    this.round        = 0;
    this.correct      = 0;
    this.totalRounds  = SEQ_ROUNDS[App.difficulty] || 3;
    this._usedIndices = [];

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });

    App.setHUDTitle('Story Order! 📖');
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
    this.done       = false;
    this.nextTap    = 1;
    this.wrongTimer = 0;
    this.wrongCard  = null;

    // Pick a sequence not used recently
    let available = SEQUENCES
      .map((_, i) => i)
      .filter(i => !this._usedIndices.includes(i));
    if (available.length === 0) {
      this._usedIndices = [];
      available = SEQUENCES.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this._usedIndices.push(idx);
    this.sequence = SEQUENCES[idx];

    // Shuffle display order
    const shuffled = [0, 1, 2].sort(() => Math.random() - 0.5);

    this.cards = shuffled.map((correctPos, displaySlot) => ({
      emoji:       this.sequence.steps[correctPos].emoji,
      label:       this.sequence.steps[correctPos].label,
      correctPos:  correctPos + 1,  // 1-indexed correct position
      displaySlot,
      x: 0, y: 0, w: 0, h: 0,
      state:    'normal',   // 'normal' | 'numbered' | 'correct' | 'wrong'
      tapOrder: 0,          // which number was tapped (1, 2, or 3)
    }));

    this._layout();
    App.setHUDTitle(`${this.sequence.title} 📖`);
    Audio.speak(`${this.sequence.story} Tap them in order! First, second, third!`, { interrupt: true });
  }

  _layout() {
    const { canvas } = this;
    const W = canvas.width, H = canvas.height;
    const hudH   = 70;
    const cols   = 3;
    const padX   = 16, padTop = hudH + 80, padBot = 40;
    const availW = W - padX * 2;
    const availH = H - padTop - padBot;
    const cw     = Math.floor((availW - padX * (cols - 1)) / cols);
    const ch     = Math.min(Math.floor(availH), cw * 1.3, 240);
    const totalH = ch;
    const startY = padTop + (availH - totalH) / 2;

    this.cards.forEach((c, i) => {
      c.x = padX + i * (cw + padX);
      c.y = startY;
      c.w = cw;
      c.h = ch;
    });
  }

  _handleClick(x, y) {
    if (this.done) return;
    for (const card of this.cards) {
      if (card.state === 'numbered' || card.state === 'correct') continue;
      if (x >= card.x && x <= card.x + card.w &&
          y >= card.y && y <= card.y + card.h) {

        if (card.correctPos === this.nextTap) {
          // Correct tap!
          card.state    = 'numbered';
          card.tapOrder = this.nextTap;
          this.nextTap++;
          Audio.playCoin();
          this._burst(card.x + card.w / 2, card.y + card.h / 2);

          if (this.nextTap > 3) {
            // All 3 tapped in order — celebrate!
            this.done = true;
            this.cards.forEach(c => { c.state = 'correct'; });
            this.correct++;
            App.updateHUDScore(this.correct);
            Audio.playSuccess();

            const last = (this.round + 1) >= this.totalRounds;
            Audio.speak(last
              ? `Perfect! ${this.sequence.completeText}`
              : this.sequence.completeText, {
              interrupt: true,
              onEnd: () => {
                if (last) this._endGame();
                else { this.round++; this._nextRound(); }
              },
            });
          } else {
            Audio.speak(this.nextTap === 2 ? 'Good! What comes next?' : 'Almost there! Last one!');
          }
        } else {
          // Wrong order
          card.state      = 'wrong';
          this.wrongTimer = 0.5;
          this.wrongCard  = card;
          Audio.playWrong();
          Audio.speak(`Not yet! Find number ${this.nextTap} first!`);
          setTimeout(() => {
            if (card.state === 'wrong') card.state = 'normal';
          }, 600);
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
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 160;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 130,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.6 + Math.random() * 0.5,
        size: 6 + Math.random() * 8,
      });
    }
  }

  _endGame() {
    this.running = false;
    this.stop();
    Audio.speak('You know the right order! You are so smart!', { interrupt: true });
    App.showOverlay('📖', 'Story Expert!', 'Claim Stars! ⭐', () => {
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

    // Warm parchment background
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#fffde7'); grd.addColorStop(1, '#f5e0b0');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(139,94,60,0.07)'; ctx.lineWidth = 1;
    for (let y = 64; y < H; y += 30) {
      ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(W - 16, y); ctx.stroke();
    }

    // Round counter
    ctx.fillStyle = '#6a3a10';
    ctx.font = `bold ${Math.min(17, W / 22)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Round ${this.round + 1} of ${this.totalRounds}`, W / 2, 52);

    // Story question
    if (this.sequence) {
      const hudH = 70;
      ctx.fillStyle = '#5b21b6';
      ctx.font = `bold ${Math.min(20, W / 18)}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(91,33,182,0.3)'; ctx.shadowBlur = 10;
      ctx.fillText(this.sequence.story, W / 2, hudH + 44);
      ctx.shadowBlur = 0;

      // "Tap 1st, 2nd, 3rd" hint
      if (!this.done) {
        ctx.fillStyle = '#8b5e3c';
        ctx.font = `${Math.min(14, W / 24)}px Nunito, sans-serif`;
        ctx.fillText(`Tap 1st → 2nd → 3rd`, W / 2, hudH + 68);
      }
    }

    // Cards
    this.cards.forEach(c => {
      const shk = (c.state === 'wrong' && this.wrongTimer > 0)
        ? Math.sin(this.wrongTimer * 46) * 8 : 0;

      ctx.save();

      // Card background
      let bgFrom = '#fffbe6', bgTo = '#fff3c0';
      if (c.state === 'numbered' || c.state === 'correct') { bgFrom = '#d1fae5'; bgTo = '#a7f3d0'; }
      if (c.state === 'wrong')                              { bgFrom = '#fee2e2'; bgTo = '#fecaca'; }

      const grad = ctx.createLinearGradient(c.x + shk, c.y, c.x + c.w + shk, c.y + c.h);
      grad.addColorStop(0, bgFrom); grad.addColorStop(1, bgTo);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(c.x + shk, c.y, c.w, c.h, 18); ctx.fill();

      // Border
      ctx.strokeStyle = c.state === 'numbered' || c.state === 'correct' ? '#16a34a'
                      : c.state === 'wrong' ? '#dc2626'
                      : 'rgba(139,94,60,0.35)';
      ctx.lineWidth = c.state === 'numbered' || c.state === 'correct' ? 3 : 2;
      if (c.state === 'correct') { ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 16; }
      ctx.stroke(); ctx.shadowBlur = 0;

      // Emoji
      const eSz = Math.min(c.h * 0.48, c.w * 0.62, 86);
      ctx.font = `${eSz}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.emoji, c.x + c.w / 2 + shk, c.y + c.h * 0.42);

      // Label
      ctx.fillStyle = '#5a3a10';
      ctx.font = `bold ${Math.min(14, c.w / 5, c.h / 6)}px Nunito, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(c.label, c.x + c.w / 2 + shk, c.y + c.h - 12);

      // Number badge (1st, 2nd, 3rd) when tapped correctly
      if ((c.state === 'numbered' || c.state === 'correct') && c.tapOrder > 0) {
        const bR  = Math.min(22, c.w * 0.18);
        const bx  = c.x + shk + bR + 6;
        const by  = c.y + bR + 6;
        const num = ['1st', '2nd', '3rd'][c.tapOrder - 1];
        ctx.fillStyle = '#16a34a';
        ctx.beginPath(); ctx.arc(bx, by, bR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.min(13, bR * 0.9)}px Nunito, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(num, bx, by);
        ctx.textBaseline = 'alphabetic';
      }

      // Highlight indicator on un-tapped cards: which number should be tapped next?
      if (!this.done && c.state === 'normal' && c.correctPos === this.nextTap) {
        const pulse = 1 + Math.sin(Date.now() / 300) * 0.18;
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth   = 3.5 * pulse;
        ctx.setLineDash([8, 5]);
        ctx.beginPath(); ctx.roundRect(c.x + shk + 3, c.y + 3, c.w - 6, c.h - 6, 16); ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    });

    // Arrow row between cards (only before done)
    if (!this.done && this.cards.length === 3) {
      ctx.fillStyle = 'rgba(139,94,60,0.4)';
      ctx.font      = `${Math.min(24, W / 18)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 2; i++) {
        const ax = (this.cards[i].x + this.cards[i].w + this.cards[i + 1].x) / 2;
        const ay = this.cards[i].y + this.cards[i].h / 2;
        ctx.fillText('→', ax, ay);
      }
    }

    // Particles
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // Progress dots
    const dotR = 7, gap = 22, total = this.totalRounds;
    const dotsW = total * dotR * 2 + (total - 1) * (gap - dotR * 2);
    let dx = W / 2 - dotsW / 2 + dotR;
    for (let i = 0; i < total; i++) {
      ctx.beginPath(); ctx.arc(dx, H - 20, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < this.round ? '#ffd700' : i === this.round ? '#7c3aed' : 'rgba(139,94,60,0.25)';
      ctx.fill(); dx += gap;
    }
  }
}
