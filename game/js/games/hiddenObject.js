// ===== HIDDEN OBJECT GAME =====
// A kingdom scene filled with emoji items — find the one called out!
// "Find the Crown!" — tap it in the scene.

const HIDDEN_SCENES = [
  {
    title:   'The Royal Garden',
    bgTop:   '#1a3a2a', bgBot:  '#0d2210',
    // Items scattered across the scene [x, y] in 0-1 normalized coords
    items: [
      { emoji: '👑', x: 0.18, y: 0.28, name: 'Crown'    },
      { emoji: '🔑', x: 0.72, y: 0.42, name: 'Key'      },
      { emoji: '🌟', x: 0.45, y: 0.62, name: 'Star'     },
      { emoji: '💎', x: 0.82, y: 0.24, name: 'Gem'      },
      { emoji: '🏹', x: 0.30, y: 0.55, name: 'Arrow'    },
      // Decoys
      { emoji: '🌸', x: 0.12, y: 0.70, name: 'Flower',  decoy: true },
      { emoji: '🌿', x: 0.60, y: 0.35, name: 'Leaf',    decoy: true },
      { emoji: '🍄', x: 0.50, y: 0.80, name: 'Mushroom',decoy: true },
      { emoji: '🦋', x: 0.78, y: 0.65, name: 'Butterfly',decoy: true },
      { emoji: '🌺', x: 0.25, y: 0.85, name: 'Rose',    decoy: true },
      { emoji: '🐝', x: 0.88, y: 0.50, name: 'Bee',     decoy: true },
      { emoji: '🌱', x: 0.40, y: 0.90, name: 'Sprout',  decoy: true },
    ],
    targetOrder: ['Crown', 'Key', 'Star', 'Gem', 'Arrow'],
  },
  {
    title:   'The Castle Hall',
    bgTop:   '#1a0a30', bgBot:  '#0b0118',
    items: [
      { emoji: '🛡️', x: 0.20, y: 0.30, name: 'Shield'  },
      { emoji: '🗝️', x: 0.65, y: 0.50, name: 'Old Key' },
      { emoji: '🕯️', x: 0.80, y: 0.28, name: 'Candle'  },
      { emoji: '📜', x: 0.38, y: 0.65, name: 'Scroll'  },
      { emoji: '🏆', x: 0.55, y: 0.22, name: 'Trophy'  },
      // Decoys
      { emoji: '🪑', x: 0.10, y: 0.75, name: 'Chair',   decoy: true },
      { emoji: '🏺', x: 0.70, y: 0.70, name: 'Vase',    decoy: true },
      { emoji: '🖼️', x: 0.48, y: 0.40, name: 'Painting',decoy: true },
      { emoji: '🌹', x: 0.28, y: 0.85, name: 'Rose',    decoy: true },
      { emoji: '⭐', x: 0.88, y: 0.58, name: 'Star',    decoy: true },
      { emoji: '🕊️', x: 0.15, y: 0.48, name: 'Dove',   decoy: true },
      { emoji: '🧸', x: 0.60, y: 0.88, name: 'Bear',    decoy: true },
    ],
    targetOrder: ['Shield', 'Old Key', 'Candle', 'Scroll', 'Trophy'],
  },
  {
    title:   'The Dragon Cave',
    bgTop:   '#2a1000', bgBot:  '#0d0500',
    items: [
      { emoji: '💎', x: 0.22, y: 0.35, name: 'Gem'     },
      { emoji: '🔮', x: 0.68, y: 0.45, name: 'Crystal' },
      { emoji: '🐣', x: 0.78, y: 0.22, name: 'Egg'     },
      { emoji: '⚗️', x: 0.35, y: 0.62, name: 'Potion'  },
      { emoji: '🗺️', x: 0.52, y: 0.25, name: 'Map'     },
      // Decoys
      { emoji: '🦇', x: 0.15, y: 0.25, name: 'Bat',      decoy: true },
      { emoji: '🕷️', x: 0.85, y: 0.65, name: 'Spider',   decoy: true },
      { emoji: '🍖', x: 0.45, y: 0.80, name: 'Bone',      decoy: true },
      { emoji: '🪨', x: 0.62, y: 0.72, name: 'Stone',     decoy: true },
      { emoji: '🔥', x: 0.28, y: 0.78, name: 'Fire',      decoy: true },
      { emoji: '💀', x: 0.80, y: 0.40, name: 'Skull',     decoy: true },
      { emoji: '🌋', x: 0.10, y: 0.60, name: 'Volcano',   decoy: true },
    ],
    targetOrder: ['Gem', 'Crystal', 'Egg', 'Potion', 'Map'],
  },
  {
    title:   'The Enchanted Forest',
    bgTop:   '#0d2210', bgBot:  '#061008',
    items: [
      { emoji: '🦁', x: 0.20, y: 0.40, name: 'Lion'   },
      { emoji: '🦉', x: 0.70, y: 0.28, name: 'Owl'    },
      { emoji: '🐇', x: 0.82, y: 0.55, name: 'Rabbit' },
      { emoji: '🦌', x: 0.38, y: 0.25, name: 'Deer'   },
      { emoji: '🐿️', x: 0.55, y: 0.68, name: 'Squirrel'},
      // Decoys
      { emoji: '🌲', x: 0.12, y: 0.55, name: 'Tree',    decoy: true },
      { emoji: '🍀', x: 0.48, y: 0.82, name: 'Clover',  decoy: true },
      { emoji: '🌰', x: 0.65, y: 0.75, name: 'Acorn',   decoy: true },
      { emoji: '🌿', x: 0.30, y: 0.70, name: 'Leaf',    decoy: true },
      { emoji: '🍄', x: 0.78, y: 0.78, name: 'Mushroom',decoy: true },
      { emoji: '🌻', x: 0.88, y: 0.35, name: 'Sunflower',decoy: true },
      { emoji: '🌾', x: 0.18, y: 0.78, name: 'Wheat',   decoy: true },
    ],
    targetOrder: ['Lion', 'Owl', 'Rabbit', 'Deer', 'Squirrel'],
  },
];

class HiddenObjectGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this.running      = false;
    this.particles    = [];

    this.sceneIndex   = 0;
    this.scene        = null;
    this.placedItems  = [];  // [{emoji,name,decoy,px,py,size,found,shake,shakeTimer}]
    this.targetIndex  = 0;   // which target we're looking for now
    this.found        = 0;
    this.totalTargets = 5;
    this.wrongTimer   = 0;
    this.wrongItem    = null;

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
    window.addEventListener('resize', () => { this._resize(); this._buildScene(); });
    this.running    = true;
    this.particles  = [];
    this.sceneIndex = sceneIndex % HIDDEN_SCENES.length;

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });

    App.setHUDTitle('Find It! 🔍');
    App.updateHUDScore(0);
    App.updateHUDHearts('');

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
  //  SCENE SETUP
  // =====================================================================

  _loadScene() {
    this.scene        = HIDDEN_SCENES[this.sceneIndex];
    this.targetIndex  = 0;
    this.found        = 0;
    this.wrongTimer   = 0;
    this.wrongItem    = null;
    this.totalTargets = this.scene.targetOrder.length;

    this._buildScene();
    App.setHUDTitle(`${this.scene.title} 🔍`);
    this._announceTarget();
  }

  _buildScene() {
    const { canvas } = this;
    const W  = canvas.width, H = canvas.height;
    const hudH = 70, bottomH = 120;
    const areaH = H - hudH - bottomH;
    const eSz   = Math.min(W * 0.10, areaH * 0.12, 68);

    this.placedItems = this.scene.items.map(item => ({
      ...item,
      px:         item.x * (W  - eSz * 1.2) + eSz * 0.6,
      py:         hudH + item.y * (areaH - eSz) + eSz * 0.5,
      size:       eSz,
      found:      false,
      shake:      false,
      shakeTimer: 0,
    }));
  }

  _announceTarget() {
    if (this.targetIndex >= this.totalTargets) return;
    const name = this.scene.targetOrder[this.targetIndex];
    Audio.speak(`Find the ${name}!`, { interrupt: true });
  }

  // =====================================================================
  //  CLICK HANDLING
  // =====================================================================

  _handleClick(x, y) {
    if (this.targetIndex >= this.totalTargets) return;
    const targetName = this.scene.targetOrder[this.targetIndex];

    for (const item of this.placedItems) {
      if (item.found) continue;
      const dist = Math.hypot(x - item.px, y - item.py);
      if (dist > item.size * 0.72) continue;

      if (item.name === targetName && !item.decoy) {
        // Correct!
        item.found = true;
        this.found++;
        this.targetIndex++;
        App.updateHUDScore(this.found);
        Audio.playSuccess();
        this._burst(item.px, item.py);

        if (this.targetIndex >= this.totalTargets) {
          Audio.speak(`You found everything! Amazing explorer!`, {
            interrupt: true,
            onEnd: () => this._endGame(),
          });
        } else {
          const next = this.scene.targetOrder[this.targetIndex];
          Audio.speak(`Found it! Now find the ${next}!`, { interrupt: true });
        }
      } else {
        // Wrong item
        item.shake      = true;
        item.shakeTimer = 0.4;
        this.wrongTimer = 0.4;
        Audio.playWrong();
        Audio.speak(`That's a ${item.name}! Find the ${targetName}!`);
      }
      break;
    }
  }

  // =====================================================================
  //  PARTICLES & END
  // =====================================================================

  _burst(cx, cy) {
    const colors = ['#ffd700','#ff9800','#4caf50','#2196f3','#e91e63'];
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.7 + Math.random() * 0.5,
        size: 6 + Math.random() * 9,
      });
    }
  }

  _endGame() {
    this.running = false;
    this.stop();
    App.showOverlay('🔍', 'Super Explorer!', 'Claim Stars! ⭐', () => {
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
    this.placedItems.forEach(item => {
      if (item.shakeTimer > 0) {
        item.shakeTimer -= dt;
        if (item.shakeTimer <= 0) item.shake = false;
      }
    });
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

    // Scene background
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, this.scene ? this.scene.bgTop : '#1a3a2a');
    grd.addColorStop(1, this.scene ? this.scene.bgBot : '#0d2210');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Subtle texture
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let y = 80; y < H - 100; y += 38) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    if (!this.scene) return;

    // HUD instruction — what to find
    const hudH = 70;
    if (this.targetIndex < this.totalTargets) {
      const targetName  = this.scene.targetOrder[this.targetIndex];
      const targetItem  = this.scene.items.find(i => i.name === targetName);
      const targetEmoji = targetItem ? targetItem.emoji : '❓';

      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${Math.min(20, W / 18)}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,215,0,0.4)'; ctx.shadowBlur = 12;
      ctx.fillText(`Find the ${targetName}!`, W / 2, 52);
      ctx.shadowBlur = 0;

      // Small emoji hint beside the text
      ctx.font = `${Math.min(28, W / 14)}px serif`;
      ctx.fillText(targetEmoji, W - 48, 52);
    }

    // Draw all items
    this.placedItems.forEach(item => {
      if (item.found) return; // skip found items (they "disappear")

      const shk = item.shake && item.shakeTimer > 0
        ? Math.sin(item.shakeTimer * 48) * 6 : 0;

      ctx.save();

      // Soft glow for the target item
      const targetName = this.targetIndex < this.totalTargets
        ? this.scene.targetOrder[this.targetIndex] : '';
      const isTarget = item.name === targetName && !item.decoy;

      if (isTarget) {
        const pulse = 1 + Math.sin(Date.now() / 350) * 0.12;
        ctx.shadowColor = 'rgba(255,215,0,0.55)';
        ctx.shadowBlur  = 22 * pulse;
      }

      ctx.font = `${item.size}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji, item.px + shk, item.py);
      ctx.shadowBlur = 0;

      ctx.restore();
    });

    // Found items row at bottom
    const bottomY   = H - 80;
    const foundItems = this.scene.items.filter((item, idx) => {
      // Check if this item's name is in targetOrder and has been found
      const orderIdx = this.scene.targetOrder.indexOf(item.name);
      return orderIdx >= 0 && orderIdx < this.targetIndex;
    });

    if (foundItems.length > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.roundRect(10, bottomY - 14, W - 20, 64, 12); ctx.fill();

      ctx.fillStyle = 'rgba(255,215,0,0.7)';
      ctx.font = `bold ${Math.min(13, W / 28)}px Nunito, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('Found:', 22, bottomY + 8);

      const iconSz = Math.min(30, (W - 80) / (this.totalTargets + 0.5));
      foundItems.forEach((item, i) => {
        ctx.font = `${iconSz}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, 80 + i * (iconSz + 10), bottomY + 20);
      });
    }

    // Progress text
    ctx.fillStyle = 'rgba(255,220,150,0.6)';
    ctx.font = `${Math.min(14, W / 26)}px Nunito, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${this.found} / ${this.totalTargets}`, W - 16, H - 8);

    // Particles
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
}
