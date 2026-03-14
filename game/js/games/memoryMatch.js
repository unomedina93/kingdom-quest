// ===== MEMORY MATCH GAME =====
// Three mini-game modes, picked randomly each round:
//   'flip'  — classic card-flip memory match
//   'rope'  — tap left item then matching right item to connect with a rope
//   'spot'  — find the target emoji from 4 choices

// ---- Emoji pairs (16 total for variety) ----
const MATCH_PAIRS = [
  { emoji: '🦁', name: 'Lion'      },
  { emoji: '🐘', name: 'Elephant'  },
  { emoji: '🐸', name: 'Frog'      },
  { emoji: '🐑', name: 'Sheep'     },
  { emoji: '🦋', name: 'Butterfly' },
  { emoji: '🐬', name: 'Dolphin'   },
  { emoji: '🦊', name: 'Fox'       },
  { emoji: '🐧', name: 'Penguin'   },
  { emoji: '⭐', name: 'Star'      },
  { emoji: '👑', name: 'Crown'     },
  { emoji: '🕊️', name: 'Dove'      },
  { emoji: '🌈', name: 'Rainbow'   },
  { emoji: '🍎', name: 'Apple'     },
  { emoji: '🌸', name: 'Flower'    },
  { emoji: '🔥', name: 'Fire'      },
  { emoji: '🌙', name: 'Moon'      },
];

// Flip mode grid (cols × rows = total cards, pairs = matches needed)
const GRID = {
  easy:   { cols: 2, rows: 2, pairs: 2 },
  medium: { cols: 3, rows: 2, pairs: 3 },
  hard:   { cols: 4, rows: 4, pairs: 8 }, // ← extra row
};

// How many pairs to show in rope mode
const ROPE_COUNT  = { easy: 3, medium: 4, hard: 5 };
// How many rounds in spot mode
const SPOT_ROUNDS = { easy: 3, medium: 5, hard: 7 };

class MemoryMatchGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this.running   = false;
    this.mode      = 'flip'; // 'flip' | 'rope' | 'spot'
    this.particles = [];

    // ---- flip state ----
    this.cards   = [];
    this.flipped = [];
    this.locked  = false;
    this.matched = 0;
    this.moves   = 0;

    // ---- rope state ----
    this.ropeItems       = [];
    this.ropeSelected    = null;
    this.ropeConnections = [];
    this.ropeMatched     = 0;
    this.shakingItem     = null;
    this.shakeTimer      = 0;

    // ---- spot state ----
    this.spotPairs    = [];
    this.spotTarget   = null;
    this.spotChoices  = [];
    this.spotRound    = 0;
    this.spotTotal    = 0;
    this.spotCorrect  = 0;
    this.spotAnswered = false;
    this.wrongTimer   = 0;

    this._onClick = (e) => {
      const r = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width  / r.width;
      const sy = this.canvas.height / r.height;
      this._handleClick((e.clientX - r.left) * sx, (e.clientY - r.top) * sy);
    };
    this._onTouch = (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const sx = this.canvas.width  / r.width;
      const sy = this.canvas.height / r.height;
      this._handleClick((t.clientX - r.left) * sx, (t.clientY - r.top) * sy);
    };
    this._motionHandler = (x, y, vel) => { if (vel > 200) this._handleClick(x, y); };

    this._rafId    = null;
    this._lastTime = 0;
  }

  // =====================================================================
  //  LIFECYCLE
  // =====================================================================

  start() {
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this._layout(); });
    this.running   = true;
    this.particles = [];

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });
    Motion.onMove(this._motionHandler);

    // Pick a random mode each round
    const modes = ['flip', 'rope', 'spot'];
    this.mode = modes[Math.floor(Math.random() * modes.length)];

    if      (this.mode === 'flip') this._startFlip();
    else if (this.mode === 'rope') this._startRope();
    else                           this._startSpot();

    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('click',    this._onClick);
    this.canvas.removeEventListener('touchend', this._onTouch);
    Motion.offMove(this._motionHandler);
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  _handleClick(x, y) {
    if      (this.mode === 'flip') this._flipClick(x, y);
    else if (this.mode === 'rope') this._ropeClick(x, y);
    else                           this._spotClick(x, y);
  }

  _layout() {
    if      (this.mode === 'flip') this._layoutCards();
    else if (this.mode === 'rope') this._layoutRope();
    else                           this._layoutSpot();
  }

  // =====================================================================
  //  FLIP MODE
  // =====================================================================

  _startFlip() {
    this.matched = 0;
    this.moves   = 0;
    this.locked  = false;
    this.flipped = [];
    const g = GRID[App.difficulty] || GRID.easy;
    App.setHUDTitle('Memory Match 🃏');
    App.updateHUDScore(0);
    App.updateHUDHearts(g.pairs);
    this._buildCards();
    Audio.speak('Find the matching pictures! Tap two cards!', { interrupt: true });
  }

  _buildCards() {
    const g = GRID[App.difficulty] || GRID.easy;
    // Pick a random subset of pairs each round for variety
    const subset = [...MATCH_PAIRS].sort(() => Math.random() - 0.5).slice(0, g.pairs);
    const deck   = [];
    subset.forEach(p => { deck.push({ ...p }); deck.push({ ...p }); });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.cards = deck.map((d, idx) => ({
      ...d, idx,
      x: 0, y: 0, w: 0, h: 0,
      faceUp: false, matched: false,
      flipping: false, flipT: 0,
      targetFaceUp: false, onFlipComplete: null,
    }));
    this._layoutCards();
  }

  _layoutCards() {
    const g  = GRID[App.difficulty] || GRID.easy;
    const { canvas } = this;
    const cols = g.cols, rows = g.rows;
    const hudH = 70, padX = 14, padY = 12;
    const topY   = hudH + padY;
    const availW = canvas.width  - padX * 2;
    const availH = canvas.height - topY  - padY;
    const cardW  = Math.floor((availW - (cols - 1) * padX) / cols);
    const cardH  = Math.floor((availH - (rows - 1) * padY) / rows);
    this.cards.forEach((c, idx) => {
      c.x = padX + (idx % cols) * (cardW + padX);
      c.y = topY + Math.floor(idx / cols) * (cardH + padY);
      c.w = cardW;
      c.h = cardH;
    });
  }

  _flipClick(x, y) {
    if (this.locked || this.flipped.length >= 2) return;
    for (const card of this.cards) {
      if (card.matched || card.faceUp || card.flipping) continue;
      if (x >= card.x && x <= card.x + card.w &&
          y >= card.y && y <= card.y + card.h) {
        this._flipCard(card); break;
      }
    }
  }

  _flipCard(card) {
    card.flipping = true; card.flipT = 0; card.targetFaceUp = true;
    card.onFlipComplete = () => {
      card.faceUp = true;
      this.flipped.push(card);
      Audio.playCoin();
      if (this.flipped.length === 2) { this.moves++; this._checkFlipMatch(); }
    };
  }

  _flipCardBack(card) {
    card.flipping = true; card.flipT = 0; card.targetFaceUp = false; card.onFlipComplete = null;
  }

  _checkFlipMatch() {
    const [a, b] = this.flipped;
    if (a.emoji === b.emoji) {
      this.locked = true;
      setTimeout(() => {
        a.matched = b.matched = true;
        this.flipped = []; this.locked = false; this.matched++;
        App.updateHUDScore(this.matched);
        Audio.playSuccess();
        this._burst((a.x + a.w / 2 + b.x + b.w / 2) / 2,
                    (a.y + a.h / 2 + b.y + b.h / 2) / 2);
        const g = GRID[App.difficulty] || GRID.easy;
        if (this.matched >= g.pairs) {
          Audio.speak(`You did it! You found all the pairs! Amazing!`, { onEnd: () => this._endGame() });
        } else {
          Audio.speak(`Yes! ${a.name}! Great match!`);
        }
      }, 300);
    } else {
      this.locked = true;
      Audio.playWrong();
      setTimeout(() => {
        this._flipCardBack(a); this._flipCardBack(b);
        setTimeout(() => { a.faceUp = false; b.faceUp = false; }, 300);
        this.flipped = []; this.locked = false;
      }, 900);
    }
  }

  // =====================================================================
  //  ROPE MODE — tap one side, then the matching item on the other side
  // =====================================================================

  _startRope() {
    const diff  = App.difficulty || 'easy';
    const count = ROPE_COUNT[diff] || 3;
    this.ropeMatched     = 0;
    this.ropeSelected    = null;
    this.ropeConnections = [];
    this.shakingItem     = null;
    this.shakeTimer      = 0;

    // Pick random pairs; shuffle right side independently
    const chosen        = [...MATCH_PAIRS].sort(() => Math.random() - 0.5).slice(0, count);
    const rightShuffled = [...chosen].sort(() => Math.random() - 0.5);

    this.ropeItems = [];
    chosen.forEach((p, i) => {
      this.ropeItems.push({ ...p, side: 'L', pairIdx: i, matched: false, x: 0, y: 0, w: 0, h: 0 });
    });
    rightShuffled.forEach(p => {
      const origIdx = chosen.findIndex(c => c.emoji === p.emoji);
      this.ropeItems.push({ ...p, side: 'R', pairIdx: origIdx, matched: false, x: 0, y: 0, w: 0, h: 0 });
    });

    App.setHUDTitle('Rope Match 🪢');
    App.updateHUDScore(0);
    App.updateHUDHearts(count);
    this._layoutRope();
    Audio.speak('Connect the matching pictures with a rope! Tap one, then tap its match!', { interrupt: true });
  }

  _layoutRope() {
    const { canvas } = this;
    const diff   = App.difficulty || 'easy';
    const count  = ROPE_COUNT[diff] || 3;
    const W = canvas.width, H = canvas.height;
    const hudH  = 70;
    const itemW = Math.min(W * 0.30, 160);
    const itemH = Math.min((H - hudH - 80) / count - 14, itemW * 1.1, 130);
    const totalH = count * itemH + (count - 1) * 14;
    const startY = hudH + 44 + (H - hudH - 44 - totalH) / 2;
    const leftX  = W * 0.04;
    const rightX = W - W * 0.04 - itemW;

    let li = 0, ri = 0;
    this.ropeItems.forEach(item => {
      const idx  = item.side === 'L' ? li++ : ri++;
      item.x = item.side === 'L' ? leftX : rightX;
      item.y = startY + idx * (itemH + 14);
      item.w = itemW;
      item.h = itemH;
    });
  }

  _ropeClick(x, y) {
    if (this.locked) return;
    let tapped = null;
    for (const item of this.ropeItems) {
      if (item.matched) continue;
      if (x >= item.x && x <= item.x + item.w &&
          y >= item.y && y <= item.y + item.h) { tapped = item; break; }
    }
    if (!tapped) { this.ropeSelected = null; return; }

    // First tap — select item
    if (!this.ropeSelected) { this.ropeSelected = tapped; return; }

    // Same side — switch selection
    if (tapped.side === this.ropeSelected.side) { this.ropeSelected = tapped; return; }

    // Different sides — check match
    if (tapped.pairIdx === this.ropeSelected.pairIdx) {
      const sel = this.ropeSelected;
      sel.matched = tapped.matched = true;
      this.ropeSelected = null;

      const L = sel.side === 'L' ? sel : tapped;
      const R = sel.side === 'R' ? sel : tapped;
      const ropeColors = ['#ffd700','#ff9800','#4caf50','#e91e63','#2196f3'];
      this.ropeConnections.push({
        lx: L.x + L.w, ly: L.y + L.h / 2,
        rx: R.x,       ry: R.y + R.h / 2,
        color: ropeColors[this.ropeMatched % ropeColors.length],
        progress: 0,
      });
      this.ropeMatched++;
      App.updateHUDScore(this.ropeMatched);
      Audio.playSuccess();
      this._burst(L.x + L.w / 2, L.y + L.h / 2);

      const total = ROPE_COUNT[App.difficulty || 'easy'] || 3;
      if (this.ropeMatched >= total) {
        Audio.speak('You connected them all! Amazing job!', { onEnd: () => this._endGame() });
      } else {
        Audio.speak(`${tapped.name}! Great match!`);
      }
    } else {
      // No match — shake wrong item
      Audio.playWrong();
      this.shakingItem = tapped;
      this.shakeTimer  = 0.4;
      this.ropeSelected = null;
    }
  }

  // =====================================================================
  //  SPOT MODE — find the target from 4 choices
  // =====================================================================

  _startSpot() {
    const diff       = App.difficulty || 'easy';
    this.spotTotal   = SPOT_ROUNDS[diff] || 3;
    this.spotRound   = 0;
    this.spotCorrect = 0;
    this.spotPairs   = [...MATCH_PAIRS].sort(() => Math.random() - 0.5);
    this.wrongTimer  = 0;

    App.setHUDTitle('Find It! 🔍');
    App.updateHUDScore(0);
    App.updateHUDHearts(this.spotTotal);
    this._nextSpotRound();
    Audio.speak('Find the matching picture! Look carefully!', { interrupt: true });
  }

  _nextSpotRound() {
    this.spotAnswered = false;
    this.wrongTimer   = 0;
    const target = this.spotPairs[this.spotRound % this.spotPairs.length];
    this.spotTarget  = target;

    const wrong = MATCH_PAIRS
      .filter(p => p.emoji !== target.emoji)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    this.spotChoices = [...wrong, { ...target, correct: true }]
      .sort(() => Math.random() - 0.5)
      .map(c => ({ ...c, x: 0, y: 0, w: 0, h: 0, wasCorrect: false, wasWrong: false }));

    this._layoutSpot();
    Audio.speak(`Find the ${target.name}!`);
  }

  _layoutSpot() {
    const { canvas } = this;
    const W = canvas.width, H = canvas.height;
    const hudH   = 70;
    const cols   = 2, rows = 2;
    const padX   = 20, padY = 16;
    const topY   = hudH + H * 0.30;
    const availW = W - padX * 2;
    const availH = H - topY - padY - 20;
    const cw = Math.floor((availW - padX) / cols);
    const ch = Math.floor((availH - padY) / rows);
    this.spotChoices.forEach((c, i) => {
      c.x = padX + (i % cols) * (cw + padX);
      c.y = topY + Math.floor(i / cols) * (ch + padY);
      c.w = cw; c.h = ch;
    });
  }

  _spotClick(x, y) {
    if (this.spotAnswered) return;
    for (const choice of this.spotChoices) {
      if (x >= choice.x && x <= choice.x + choice.w &&
          y >= choice.y && y <= choice.y + choice.h) {

        if (choice.correct) {
          choice.wasCorrect  = true;
          this.spotAnswered  = true;
          this.spotCorrect++;
          App.updateHUDScore(this.spotCorrect);
          Audio.playSuccess();
          this._burst(choice.x + choice.w / 2, choice.y + choice.h / 2);

          const last = (this.spotRound + 1) >= this.spotTotal;
          Audio.speak(last
            ? `You found them all! You have great eyes!`
            : `Yes! ${this.spotTarget.name}! Good eyes!`, {
            onEnd: () => {
              if (last) { this._endGame(); }
              else { this.spotRound++; this._nextSpotRound(); }
            }
          });
        } else {
          choice.wasWrong  = true;
          this.wrongTimer  = 0.5;
          Audio.playWrong();
          setTimeout(() => { choice.wasWrong = false; }, 500);
        }
        break;
      }
    }
  }

  // =====================================================================
  //  SHARED — update, particles, end
  // =====================================================================

  _update(dt) {
    // Flip animation
    this.cards.forEach(c => {
      if (!c.flipping) return;
      c.flipT += dt * 4;
      if (c.flipT >= 1) {
        c.flipT = 1; c.flipping = false; c.faceUp = c.targetFaceUp;
        if (c.onFlipComplete) { c.onFlipComplete(); c.onFlipComplete = null; }
      }
    });

    // Rope line draw progress
    this.ropeConnections.forEach(r => {
      if (r.progress < 1) r.progress = Math.min(1, r.progress + dt * 3.5);
    });

    // Shake/wrong timers
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
    if (this.wrongTimer  > 0) this.wrongTimer  -= dt;

    // Particles
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 300 * dt; p.life -= dt;
    });
  }

  _burst(cx, cy) {
    const colors = ['#ffd700','#ff9800','#4caf50','#2196f3','#e91e63'];
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 210;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 160,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.7 + Math.random() * 0.6,
        size: 7 + Math.random() * 11,
      });
    }
  }

  _endGame() {
    this.running = false;
    this.stop();
    Audio.speak('Wonderful! You are so smart!', { interrupt: true });
    App.showOverlay('🎉', 'Amazing Matching!', 'Claim Stars! ⭐', () => {
      this.onComplete(3); // kids always win
    });
  }

  // =====================================================================
  //  RENDER
  // =====================================================================

  _render() {
    const { ctx, canvas } = this;
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, '#1a0040');
    grd.addColorStop(1, '#0a0020');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background stars
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(
        (i * 137 + 30) % canvas.width,
        ((i * 97 + 50) % (canvas.height * 0.35)) + 70,
        2, 0, Math.PI * 2
      );
      ctx.fill();
    }

    if      (this.mode === 'flip') this._renderFlip();
    else if (this.mode === 'rope') this._renderRope();
    else                           this._renderSpot();

    // Particles on top
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // ---- FLIP render ----
  _renderFlip() {
    const { ctx, canvas } = this;
    const g = GRID[App.difficulty] || GRID.easy;
    ctx.fillStyle = '#d8b4fe';
    ctx.font = `bold ${Math.min(20, canvas.width / 22)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Find the matching pictures! 🃏', canvas.width / 2, 55);
    this.cards.forEach(c => this._renderCard(c));
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '14px Nunito, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Pairs found: ${this.matched} / ${g.pairs}`, 16, canvas.height - 14);
  }

  _renderCard(c) {
    const { ctx } = this;
    const { x, y, w, h } = c;
    let scaleX = 1, showFront = c.faceUp;
    if (c.flipping) {
      if (c.flipT < 0.5) { scaleX = 1 - c.flipT * 2; showFront = !c.targetFaceUp; }
      else               { scaleX = (c.flipT - 0.5) * 2; showFront = c.targetFaceUp; }
    }
    const cx = x + w / 2, cy = y + h / 2;
    const hw = (w / 2) * Math.max(0.001, scaleX);
    ctx.save();
    if (c.matched) { ctx.shadowColor = '#43a047'; ctx.shadowBlur = 20; }
    const grad = ctx.createLinearGradient(cx - hw, y, cx + hw, y + h);
    if (showFront) { grad.addColorStop(0, '#fffbe6'); grad.addColorStop(1, '#fff3c4'); }
    else           { grad.addColorStop(0, '#2e1065'); grad.addColorStop(1, '#4c1d95'); }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(cx - hw, y, hw * 2, h, 12); ctx.fill();
    ctx.strokeStyle = c.matched ? '#43a047' : (showFront ? '#f9a825' : '#7c3aed');
    ctx.lineWidth   = c.matched ? 4 : 2.5;
    ctx.stroke(); ctx.shadowBlur = 0;
    if (showFront && hw > 10) {
      const eSz = Math.min(h * 0.52, w * 0.65, 80);
      ctx.font = `${eSz}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.emoji, cx, c.matched ? cy : cy - h * 0.06);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#78350f';
      const lSz = Math.min(15, w / 4.5, h / 5.5);
      ctx.font = `bold ${lSz}px Nunito, sans-serif`;
      ctx.fillText(c.name, cx, y + h - 8);
    } else if (!showFront && hw > 10) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = `${Math.min(h * 0.48, w * 0.52)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✨', cx, cy); ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  // ---- ROPE render ----
  _renderRope() {
    const { ctx, canvas } = this;
    const W = canvas.width;

    ctx.fillStyle = '#d8b4fe';
    ctx.font = `bold ${Math.min(20, W / 20)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Connect the matching pairs! 🪢', W / 2, 55);

    // Draw completed ropes
    this.ropeConnections.forEach(r => {
      const ex  = r.lx + (r.rx - r.lx) * r.progress;
      const ey  = r.ly + (r.ry - r.ly) * r.progress;
      const midX = (r.lx + ex) / 2;
      const midY = Math.min(r.ly, ey) - 35;
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.lineWidth   = 6;
      ctx.lineCap     = 'round';
      ctx.shadowColor = r.color;
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.moveTo(r.lx, r.ly);
      ctx.quadraticCurveTo(midX, midY, ex, ey);
      ctx.stroke();
      // Knot dots at start/end
      [{ x: r.lx, y: r.ly }, { x: ex, y: ey }].forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = r.color; ctx.fill();
      });
      ctx.restore();
    });

    // Draw items
    this.ropeItems.forEach(item => {
      const shk = (this.shakingItem === item && this.shakeTimer > 0)
        ? Math.sin(this.shakeTimer * 40) * 9 : 0;
      const selected = this.ropeSelected === item;
      ctx.save();
      if (item.matched) ctx.globalAlpha = 0.45;

      const grad = ctx.createLinearGradient(item.x + shk, item.y, item.x + item.w + shk, item.y + item.h);
      grad.addColorStop(0, selected ? '#5b21b6' : '#1e0a42');
      grad.addColorStop(1, selected ? '#7c3aed' : '#3b0d8a');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(item.x + shk, item.y, item.w, item.h, 14); ctx.fill();
      ctx.strokeStyle = item.matched ? '#43a047' : (selected ? '#ffd700' : 'rgba(160,100,232,0.6)');
      ctx.lineWidth   = selected ? 3.5 : 2;
      if (selected) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18; }
      ctx.stroke(); ctx.shadowBlur = 0;

      // Emoji
      const eSz = Math.min(item.h * 0.52, item.w * 0.58, 68);
      ctx.font = `${eSz}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji, item.x + item.w / 2 + shk, item.y + item.h * 0.41);
      // Name
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      const lSz = Math.min(14, item.w / 5, item.h / 4.5);
      ctx.font = `bold ${lSz}px Nunito, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(item.name, item.x + item.w / 2 + shk, item.y + item.h - 8);
      // Match checkmark
      if (item.matched) {
        ctx.font = `${eSz * 0.45}px serif`;
        ctx.textBaseline = 'top';
        ctx.fillText('✅', item.x + item.w - 14 + shk, item.y + 6);
      }
      ctx.restore();
    });

    // Hint arrow in center gap
    if (this.ropeSelected) {
      const sel   = this.ropeSelected;
      const arrowX = sel.side === 'L' ? sel.x + sel.w + 12 : sel.x - 14;
      const arrowY = sel.y + sel.h / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(255,215,0,0.7)';
      ctx.font = '22px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sel.side === 'L' ? '→' : '←', arrowX, arrowY);
      ctx.restore();
    }

    const total = ROPE_COUNT[App.difficulty || 'easy'] || 3;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '14px Nunito, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`Connected: ${this.ropeMatched} / ${total}`, 16, canvas.height - 14);
  }

  // ---- SPOT render ----
  _renderSpot() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const hudH = 70;

    // Round counter
    ctx.fillStyle = '#d8b4fe';
    ctx.font = `bold ${Math.min(20, W / 20)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Round ${this.spotRound + 1} of ${this.spotTotal}`, W / 2, 55);

    // Big target
    if (this.spotTarget) {
      const bigSz = Math.min(H * 0.13, W * 0.20, 96);
      ctx.font = `${bigSz}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.spotTarget.emoji, W / 2, hudH + bigSz * 0.72);
      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = '#ffd700';
      const tSz = Math.min(24, W / 14);
      ctx.font = `bold ${tSz}px Nunito, sans-serif`;
      ctx.shadowColor = 'rgba(255,215,0,0.4)'; ctx.shadowBlur = 12;
      ctx.fillText(`Find the ${this.spotTarget.name}!`, W / 2, hudH + bigSz * 1.65);
      ctx.shadowBlur = 0;
    }

    // Choice cards
    this.spotChoices.forEach(c => {
      const shk = c.wasWrong ? Math.sin(this.wrongTimer * 42) * 9 : 0;
      ctx.save();
      const grad = ctx.createLinearGradient(c.x + shk, c.y, c.x + c.w + shk, c.y + c.h);
      if      (c.wasCorrect) { grad.addColorStop(0, '#14532d'); grad.addColorStop(1, '#15803d'); }
      else if (c.wasWrong)   { grad.addColorStop(0, '#7f1d1d'); grad.addColorStop(1, '#991b1b'); }
      else                   { grad.addColorStop(0, '#1e0a42'); grad.addColorStop(1, '#3b0d8a'); }
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(c.x + shk, c.y, c.w, c.h, 16); ctx.fill();
      ctx.strokeStyle = c.wasCorrect ? '#4ade80' : (c.wasWrong ? '#f87171' : 'rgba(160,100,232,0.55)');
      ctx.lineWidth   = 2.5;
      if (c.wasCorrect) { ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 22; }
      ctx.stroke(); ctx.shadowBlur = 0;

      // Emoji
      const eSz = Math.min(c.h * 0.50, c.w * 0.58, 78);
      ctx.font = `${eSz}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.emoji, c.x + c.w / 2 + shk, c.y + c.h * 0.42);
      // Name
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const lSz = Math.min(15, c.w / 5, c.h / 4.2);
      ctx.font = `bold ${lSz}px Nunito, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(c.name, c.x + c.w / 2 + shk, c.y + c.h - 10);
      ctx.restore();
    });

    // Progress dots at bottom
    const dotR = 7, gap = 20, total = this.spotTotal;
    const dotsW = total * dotR * 2 + (total - 1) * (gap - dotR * 2);
    let dx = W / 2 - dotsW / 2 + dotR;
    for (let i = 0; i < total; i++) {
      ctx.beginPath();
      ctx.arc(dx, H - 22, dotR, 0, Math.PI * 2);
      if      (i < this.spotRound)     ctx.fillStyle = '#ffd700';
      else if (i === this.spotRound)   ctx.fillStyle = '#a855f7';
      else                             ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      dx += gap;
    }
  }
}
