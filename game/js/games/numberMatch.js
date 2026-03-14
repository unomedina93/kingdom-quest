// ===== NUMBER MATCH GAME =====
// A number is shown; pick the group with that many items!
// Works with mouse click or tap

class NumberMatchGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx    = ctx;
    this.onComplete = onComplete;

    this.running   = false;
    this.score     = 0;
    this.hearts    = 3;
    this.round     = 0;
    this.maxRounds = 10;

    this.targetNumber = 0;
    this.choices = []; // [{count, item, x, y, w, h, correct, state}]

    this.feedback = null; // {text, color, x, y, life}
    this.particles = [];

    this._onClick = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width  / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this._handleClick(
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top)  * scaleY
      );
    };
    this._onTouch = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const scaleX = this.canvas.width  / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this._handleClick(
        (t.clientX - rect.left) * scaleX,
        (t.clientY - rect.top)  * scaleY
      );
    };
    this._motionHandler = (x, y, vel) => {
      if (vel > 200) this._handleClick(x, y);
    };

    this._rafId    = null;
    this._lastTime = 0;
    this._waitingForNext = false;
  }

  start() {
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.score   = 0;
    this.hearts  = 3;
    this.round   = 0;
    this.running = true;
    this.particles = [];

    this.canvas.addEventListener('click',     this._onClick);
    this.canvas.addEventListener('touchend',  this._onTouch, { passive: false });
    Motion.onMove(this._motionHandler);

    App.setHUDTitle('Treasure Count 💰');
    App.updateHUDScore(0);
    App.updateHUDHearts(3);

    this._nextRound();

    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('click',    this._onClick);
    this.canvas.removeEventListener('touchend', this._onTouch);
    Motion.offMove(this._motionHandler);
    window.removeEventListener('resize', () => this._resize());
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();
  }

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    // Feedback float-up animation
    if (this.feedback) {
      this.feedback.y -= 60 * dt;
      this.feedback.life -= dt;
      if (this.feedback.life <= 0) this.feedback = null;
    }

    // Particles
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    });
  }

  _nextRound() {
    if (this.round >= this.maxRounds) { this._endGame(); return; }
    this.round++;
    this._waitingForNext = false;

    const diff = CURRICULUM.difficulty[App.difficulty];
    const maxN = diff.maxNumber;

    // Pick target number
    this.targetNumber = 1 + Math.floor(Math.random() * maxN);

    // Pick 3-4 choices
    const count = App.difficulty === 'easy' ? 3 : 4;
    const used  = new Set([this.targetNumber]);
    const wrong = [];
    while (wrong.length < count - 1) {
      let n = 1 + Math.floor(Math.random() * maxN);
      if (!used.has(n)) { used.add(n); wrong.push(n); }
    }
    const allCounts = [this.targetNumber, ...wrong].sort(() => Math.random() - 0.5);

    // Pick a random item type
    const item = CURRICULUM.countItems[Math.floor(Math.random() * CURRICULUM.countItems.length)];

    // Layout choices
    this.choices = this._layoutChoices(allCounts, item);
    this.choices.forEach(c => {
      c.correct = (c.count === this.targetNumber);
      c.state   = 'idle'; // idle | correct | wrong
    });

    // Speak the prompt
    const word = CURRICULUM.numberWords[this.targetNumber];
    const itemName = item.name;
    Audio.speak(`Find ${this.targetNumber}! Can you find ${word} ${itemName}?`, { interrupt: true });
  }

  _layoutChoices(counts, item) {
    const { canvas } = this;
    const n = counts.length;
    const pad = 20;
    const topY = canvas.height * 0.42;
    const bottomY = canvas.height - 80;
    const availH = bottomY - topY - pad;
    const availW = canvas.width - pad * 2;

    if (n <= 2) {
      const w = (availW - pad) / 2;
      const h = availH;
      return counts.map((count, i) => ({
        count, item,
        x: pad + i * (w + pad), y: topY,
        w, h
      }));
    } else if (n === 3) {
      const w = (availW - pad * 2) / 3;
      const h = availH;
      return counts.map((count, i) => ({
        count, item,
        x: pad + i * (w + pad), y: topY,
        w, h
      }));
    } else {
      // 4 choices: 2x2 grid
      const w = (availW - pad) / 2;
      const h = (availH - pad) / 2;
      return counts.map((count, i) => ({
        count, item,
        x: pad + (i % 2) * (w + pad),
        y: topY + Math.floor(i / 2) * (h + pad),
        w, h
      }));
    }
  }

  _handleClick(x, y) {
    if (this._waitingForNext) return;

    this.choices.forEach(choice => {
      if (x >= choice.x && x <= choice.x + choice.w &&
          y >= choice.y && y <= choice.y + choice.h) {
        this._selectChoice(choice);
      }
    });
  }

  _selectChoice(choice) {
    if (this._waitingForNext) return;
    this._waitingForNext = true;

    if (choice.correct) {
      choice.state = 'correct';
      this.score++;
      App.updateHUDScore(this.score);
      Audio.playSuccess();
      Audio.playCoin();

      // Particles from the choice
      const cx = choice.x + choice.w / 2;
      const cy = choice.y + choice.h / 2;
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 250;
        this.particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 150,
          color: ['#ffd700','#fff','#7b3fc4','#43a047'][Math.floor(Math.random() * 4)],
          life: 0.8 + Math.random() * 0.5,
          size: 6 + Math.random() * 8
        });
      }

      this.feedback = { text: '✅ Correct!', color: '#43a047', x: cx, y: cy - 40, life: 1.2 };
      // onEnd ensures the next-round interrupt never cuts off the praise
      Audio.speak(`Yes! ${this.targetNumber}! ${CURRICULUM.numberWords[this.targetNumber]}!`, {
        onEnd: () => this._nextRound()
      });
    } else {
      choice.state = 'wrong';
      this.hearts = Math.max(0, this.hearts - 1);
      App.updateHUDHearts(this.hearts);
      Audio.playWrong();

      const cx = choice.x + choice.w / 2;
      const cy = choice.y + choice.h / 2;
      this.feedback = { text: '❌ Try again!', color: '#e53935', x: cx, y: cy - 40, life: 1.2 };
      Audio.speak(`Not quite! Find ${this.targetNumber}!`);

      // Reset after brief delay (without going to next round)
      setTimeout(() => {
        choice.state = 'idle';
        this._waitingForNext = false;
        if (this.hearts <= 0) this._endGame();
      }, 1000);
    }
  }

  _endGame() {
    this.running = false;
    this.stop();

    const stars = this.hearts === 3 ? 3 : this.hearts > 0 ? 2 : 1;
    Audio.speak(`Great counting! You got ${this.score} right!`, { interrupt: true });
    App.showOverlay('💰', `You counted ${this.score} treasures!`, `Claim ${stars} Stars!`, () => {
      this.onComplete(stars);
    });
  }

  _render() {
    const { ctx, canvas, targetNumber, choices } = this;

    // Background — treasure cave
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, '#1a1000');
    grd.addColorStop(0.5, '#2d1f00');
    grd.addColorStop(1, '#0d0800');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Torches on sides
    ctx.font = '40px serif';
    ctx.fillText('🔦', 20, 80);
    ctx.fillText('🔦', canvas.width - 60, 80);

    // Target number display (top half)
    this._renderTarget(targetNumber);

    // Divider
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, canvas.height * 0.4);
    ctx.lineTo(canvas.width - 40, canvas.height * 0.4);
    ctx.stroke();

    // Prompt text
    ctx.fillStyle = '#ffe082';
    ctx.font = `bold ${Math.min(22, canvas.width / 28)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Which group has this many? Tap to choose!', canvas.width / 2, canvas.height * 0.41 + 18);

    // Choices
    choices.forEach(c => this._renderChoice(c));

    // Feedback popup
    if (this.feedback) {
      ctx.globalAlpha = Math.min(1, this.feedback.life * 2);
      ctx.font = `bold ${Math.min(32, canvas.width / 20)}px Nunito, sans-serif`;
      ctx.fillStyle = this.feedback.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.feedback.text, this.feedback.x, this.feedback.y);
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    }

    // Particles
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Round progress
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px Nunito, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Round ${this.round} / ${this.maxRounds}`, 16, canvas.height - 16);
  }

  _renderTarget(num) {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.2;

    // Label
    ctx.fillStyle = '#ffe082';
    ctx.font = `${Math.min(20, canvas.width / 36)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('FIND THIS MANY ➡️', cx, cy - 60);

    // Giant number
    const numSize = Math.min(130, canvas.width / 5);
    ctx.font = `${numSize}px Fredoka One, cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 30;
    ctx.fillText(num, cx, cy + numSize * 0.4);
    ctx.shadowBlur  = 0;

    // Word form
    ctx.fillStyle = '#ffe082';
    ctx.font = `bold ${Math.min(24, canvas.width / 30)}px Nunito, sans-serif`;
    ctx.fillText(`( ${CURRICULUM.numberWords[num]} )`, cx, cy + numSize * 0.55 + 28);
  }

  _renderChoice(c) {
    const { ctx } = this;

    // Background
    let bg, border;
    if (c.state === 'correct') {
      bg = 'rgba(67,160,71,0.5)'; border = '#43a047';
    } else if (c.state === 'wrong') {
      bg = 'rgba(229,57,53,0.4)'; border = '#e53935';
    } else {
      bg = 'rgba(50,30,0,0.8)'; border = '#8b6a3a';
    }

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 16);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Items grid
    const total  = c.count;
    const itemSz = Math.min(40, c.w / (Math.ceil(Math.sqrt(total)) + 0.5));
    const cols   = Math.ceil(Math.sqrt(total));
    const rows   = Math.ceil(total / cols);
    const gridW  = cols * (itemSz + 6) - 6;
    const gridH  = rows * (itemSz + 6) - 6;
    const startX = c.x + (c.w - gridW) / 2;
    const startY = c.y + (c.h - gridH) / 2;

    ctx.font = `${itemSz}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ix  = startX + col * (itemSz + 6) + itemSz / 2;
      const iy  = startY + row * (itemSz + 6) + itemSz / 2;
      ctx.fillText(c.item.emoji, ix, iy);
    }
    ctx.textBaseline = 'alphabetic';
  }
}
