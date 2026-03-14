// ===== SPOT THE DIFFERENCE GAME =====
// Two side-by-side emoji grids — find the 3 differences in the right panel!

const SPOT_DIFF_SCENES = [
  {
    title: 'The Royal Forest',
    left:  ['🌲','🦁','🌸','🐑','⭐','🌙','🕊️','🍄','🌈'],
    diffs: [
      { index: 1, emoji: '🐺' },  // 🦁 → 🐺
      { index: 4, emoji: '💫' },  // ⭐ → 💫
      { index: 7, emoji: '🌻' },  // 🍄 → 🌻
    ],
  },
  {
    title: 'The Castle Courtyard',
    left:  ['🏰','⚔️','🛡️','👑','🔑','🐉','🌟','🎺','💎'],
    diffs: [
      { index: 0, emoji: '🏯' },  // 🏰 → 🏯
      { index: 5, emoji: '🦕' },  // 🐉 → 🦕
      { index: 8, emoji: '💍' },  // 💎 → 💍
    ],
  },
  {
    title: 'The Magic Garden',
    left:  ['🌷','🐝','🦋','🌿','🍎','🌺','🐸','🌾','🌙'],
    diffs: [
      { index: 2, emoji: '🐛' },  // 🦋 → 🐛
      { index: 4, emoji: '🍊' },  // 🍎 → 🍊
      { index: 6, emoji: '🐢' },  // 🐸 → 🐢
    ],
  },
  {
    title: 'The Night Sky',
    left:  ['⭐','🌙','☁️','🦉','🌟','🔮','💫','🕊️','🌠'],
    diffs: [
      { index: 2, emoji: '⛅' },  // ☁️ → ⛅
      { index: 3, emoji: '🦇' },  // 🦉 → 🦇
      { index: 5, emoji: '🪄' },  // 🔮 → 🪄
    ],
  },
  {
    title: 'The Kingdom Market',
    left:  ['🍞','🍯','🌰','🥕','🫙','🍇','🐓','🪣','🌿'],
    diffs: [
      { index: 0, emoji: '🥐' },  // 🍞 → 🥐
      { index: 5, emoji: '🍓' },  // 🍇 → 🍓
      { index: 7, emoji: '🏺' },  // 🪣 → 🏺
    ],
  },
];

class SpotDiffGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this.running    = false;
    this.particles  = [];

    this.sceneIndex = 0;
    this.scene      = null;
    this.rightGrid  = [];   // array of {emoji, isDiff, found, x, y, size}
    this.leftGrid   = [];   // array of {emoji, x, y, size}
    this.found      = 0;
    this.totalDiffs = 3;
    this.locked     = false;
    this.wrongTimer = 0;
    this.wrongCell  = -1;

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

  start(sceneIndex = 0) {
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this._layout(); });
    this.running    = true;
    this.particles  = [];
    this.sceneIndex = sceneIndex % SPOT_DIFF_SCENES.length;

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });

    App.setHUDTitle('Spot the Difference! 🔍');
    App.updateHUDScore(0);
    App.updateHUDHearts(3);

    this._loadScene();
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
  //  SCENE LOGIC
  // =====================================================================

  _loadScene() {
    this.scene      = SPOT_DIFF_SCENES[this.sceneIndex];
    this.found      = 0;
    this.locked     = false;
    this.wrongTimer = 0;
    this.wrongCell  = -1;

    // Build left grid (original)
    this.leftGrid = this.scene.left.map(emoji => ({ emoji, x: 0, y: 0, size: 0 }));

    // Build right grid (with diffs swapped in)
    const rightEmojis = [...this.scene.left];
    this.scene.diffs.forEach(d => { rightEmojis[d.index] = d.emoji; });
    const diffIndices = new Set(this.scene.diffs.map(d => d.index));
    this.rightGrid = rightEmojis.map((emoji, i) => ({
      emoji, isDiff: diffIndices.has(i), found: false,
      x: 0, y: 0, size: 0,
    }));

    this._layout();
    App.setHUDTitle(`${this.scene.title} 🔍`);
    Audio.speak(`Find 3 differences! Look at both pictures carefully!`, { interrupt: true });
  }

  _layout() {
    const { canvas } = this;
    const W = canvas.width, H = canvas.height;
    const hudH  = 70;
    const cols  = 3, rows = 3;
    const padT  = hudH + 44;
    const padB  = 44;
    const gap   = 8;
    const dividerW = 6;

    // Each panel occupies ~45% of width
    const panelW = (W - dividerW - 20) / 2;
    const cellSz = Math.min(
      Math.floor((panelW - gap * (cols + 1)) / cols),
      Math.floor((H - padT - padB - gap * (rows + 1)) / rows),
      100
    );
    const gridW  = cols * cellSz + (cols - 1) * gap;
    const gridH  = rows * cellSz + (rows - 1) * gap;
    const topY   = padT + (H - padT - padB - gridH) / 2;

    // Left panel starts at center - divider/2 - panelW
    const leftX  = W / 2 - dividerW / 2 - gridW - 16;
    const rightX = W / 2 + dividerW / 2 + 16;

    for (let i = 0; i < 9; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const cx  = col * (cellSz + gap);
      const cy  = row * (cellSz + gap);
      this.leftGrid[i].x    = leftX  + cx;
      this.leftGrid[i].y    = topY   + cy;
      this.leftGrid[i].size = cellSz;
      this.rightGrid[i].x   = rightX + cx;
      this.rightGrid[i].y   = topY   + cy;
      this.rightGrid[i].size = cellSz;
    }
  }

  _handleClick(x, y) {
    if (this.locked) return;
    for (let i = 0; i < this.rightGrid.length; i++) {
      const cell = this.rightGrid[i];
      if (cell.found) continue;
      if (x >= cell.x && x <= cell.x + cell.size &&
          y >= cell.y && y <= cell.y + cell.size) {

        if (cell.isDiff) {
          cell.found = true;
          this.found++;
          App.updateHUDScore(this.found);
          Audio.playSuccess();
          this._burst(cell.x + cell.size / 2, cell.y + cell.size / 2);

          if (this.found >= this.totalDiffs) {
            Audio.speak(`You found all 3 differences! Amazing eyes!`, {
              interrupt: true,
              onEnd: () => this._endGame(),
            });
          } else {
            Audio.speak(`Found one! Keep looking!`);
          }
        } else {
          this.wrongTimer = 0.5;
          this.wrongCell  = i;
          Audio.playWrong();
          setTimeout(() => { this.wrongCell = -1; }, 500);
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
        size: 5 + Math.random() * 8,
      });
    }
  }

  _endGame() {
    this.running = false;
    this.stop();
    App.showOverlay('🔍', 'Great Eyes!', 'Claim Stars! ⭐', () => {
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

    // Parchment/warm background
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#fffde7');
    grd.addColorStop(1, '#f5e6c8');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Paper lines
    ctx.strokeStyle = 'rgba(139,94,60,0.07)';
    ctx.lineWidth = 1;
    for (let y = 64; y < H; y += 30) {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke();
    }

    // Title
    ctx.fillStyle = '#6a3a10';
    ctx.font = `bold ${Math.min(20, W / 24)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Find 3 differences! 🔍', W / 2, 52);

    // Panel labels
    const labelY = this.leftGrid[0] ? this.leftGrid[0].y - 18 : 100;
    ctx.font = `bold ${Math.min(14, W / 30)}px Nunito, sans-serif`;
    ctx.fillStyle = '#8b5e3c';
    if (this.leftGrid.length) {
      const lc = this.leftGrid[4]; // center cell
      ctx.fillText('Picture 1', lc.x + lc.size / 2, labelY);
    }
    if (this.rightGrid.length) {
      const rc = this.rightGrid[4];
      ctx.fillText('Picture 2', rc.x + rc.size / 2, labelY);
    }

    // Center divider
    ctx.fillStyle = 'rgba(139,94,60,0.25)';
    ctx.fillRect(W / 2 - 2, 70, 4, H - 70);

    // Draw left grid
    this.leftGrid.forEach(cell => {
      this._drawCell(ctx, cell.x, cell.y, cell.size, cell.emoji, 'normal', false);
    });

    // Draw right grid
    this.rightGrid.forEach((cell, i) => {
      const isWrong = i === this.wrongCell && this.wrongTimer > 0;
      const state   = cell.found ? 'found' : isWrong ? 'wrong' : 'normal';
      const shk     = isWrong ? Math.sin(this.wrongTimer * 46) * 6 : 0;
      this._drawCell(ctx, cell.x + shk, cell.y, cell.size, cell.emoji, state, cell.isDiff && cell.found);
    });

    // Progress circles at bottom
    ctx.fillStyle = '#6a3a10';
    ctx.font = `bold ${Math.min(15, W / 26)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Found: ${this.found} / ${this.totalDiffs}`, W / 2, H - 22);

    // Particles
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  _drawCell(ctx, x, y, sz, emoji, state, showCircle) {
    ctx.save();

    // Cell background
    let bg = 'rgba(255,248,220,0.8)';
    if (state === 'found')  bg = 'rgba(187,247,208,0.85)';
    if (state === 'wrong')  bg = 'rgba(254,202,202,0.85)';
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 8); ctx.fill();

    // Cell border
    ctx.strokeStyle = state === 'found' ? '#16a34a'
                    : state === 'wrong' ? '#dc2626'
                    : 'rgba(139,94,60,0.3)';
    ctx.lineWidth = state === 'found' ? 2.5 : 1.5;
    if (state === 'found') { ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 12; }
    ctx.stroke(); ctx.shadowBlur = 0;

    // Emoji
    const eSz = sz * 0.60;
    ctx.font = `${eSz}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x + sz / 2, y + sz / 2);

    // Found checkmark
    if (showCircle) {
      ctx.fillStyle = 'rgba(22,163,74,0.9)';
      ctx.beginPath(); ctx.arc(x + sz - 10, y + 10, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = `bold 11px Nunito, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', x + sz - 10, y + 10);
    }

    ctx.restore();
  }
}
