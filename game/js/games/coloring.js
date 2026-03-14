// ===== COLORING BOOK GAME =====
// Tap a region, then tap a color to fill it.
// Bible-themed scenes drawn entirely with Canvas 2D paths.
// Calm, open-ended — no score, no timer, pure creative expression.

class ColoringGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas  = canvas;
    this.ctx     = ctx;
    this.onComplete = onComplete;

    this.sceneIndex    = 0;
    this.currentScene  = null;
    this.selectedColor = '#4fc3f7'; // Start with a nice sky blue
    this.running       = false;
    this.doneBtn       = false;

    // Color palette — warm, pleasant, not neon
    this.palette = [
      '#ef9a9a', // soft red
      '#ffcc80', // peach/orange
      '#fff176', // soft yellow
      '#a5d6a7', // sage green
      '#4fc3f7', // sky blue
      '#ce93d8', // lavender
      '#bcaaa4', // warm tan/brown
      '#ffffff',  // white
      '#80cbc4', // teal
      '#f48fb1', // pink
      '#1565c0', // deep blue
      '#2e7d32', // forest green
    ];

    this._onClick  = (e) => {
      const r = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width  / r.width;
      const scaleY = this.canvas.height / r.height;
      this._handleClick((e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY);
    };
    this._onTouch = (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const scaleX = this.canvas.width  / r.width;
      const scaleY = this.canvas.height / r.height;
      this._handleClick((t.clientX - r.left) * scaleX, (t.clientY - r.top) * scaleY);
    };

    this._rafId    = null;
    this._lastTime = 0;

    // Track filled regions for completion
    this.filledCount = 0;
    this.celebrateTimer = 0;
    this.celebrating = false;
    this.particles = [];
  }

  start(sceneIndex = 0) {
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this._buildScene(); });

    this.sceneIndex = sceneIndex % COLORING_SCENES.length;
    this.celebrating = false;
    this.particles   = [];
    this.running     = true;

    this._buildScene();

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });

    App.setHUDTitle(`🎨 ${this.currentScene.title}`);
    App.updateHUDScore('');
    App.updateHUDHearts('');

    Audio.speak(`Welcome to the coloring page! Color ${this.currentScene.title}! Tap a color, then tap the picture to fill it in!`, { rate: 0.85, interrupt: true });

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
    window.removeEventListener('resize', () => {});
    if (this._rafId) cancelAnimationFrame(this._rafId);
    Audio.stopSpeech();
  }

  _buildScene() {
    const scene = COLORING_SCENES[this.sceneIndex];
    // Scale all region points to current canvas size
    const W = this.canvas.width;
    const H = this.canvas.height;
    // Each scene defines points as fractions (0-1) of a reference size
    // We'll scale dynamically in the draw function
    this.currentScene = { ...scene };
    // Reset region colors to default white
    this.currentScene.regions = scene.regions.map(r => ({
      ...r,
      fillColor: '#ffffff',
      filled: false
    }));
    this.filledCount = 0;
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
    if (this.celebrating) {
      this.celebrateTimer -= dt;
      this.particles = this.particles.filter(p => p.life > 0);
      this.particles.forEach(p => {
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.vy += 200 * dt;
        p.life -= dt;
      });
    }
  }

  _handleClick(x, y) {
    if (this.celebrating) return;

    // Check if clicking palette
    const paletteY = this.canvas.height - this._paletteHeight();
    if (y >= paletteY) {
      this._handlePaletteClick(x, y);
      return;
    }

    // Check "I'm Done!" button area
    const btnW = 160, btnH = 44;
    const btnX = this.canvas.width  - btnW - 16;
    const btnY = 60;
    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      this._finish();
      return;
    }

    // Check region hit
    this._hitTestRegion(x, y);
  }

  _handlePaletteClick(x, y) {
    const { canvas } = this;
    const pH     = this._paletteHeight();
    const paletteY = canvas.height - pH;
    const cols   = Math.min(this.palette.length, Math.floor(canvas.width / 60));
    const swatch = Math.floor(canvas.width / cols);
    const col    = Math.floor(x / swatch);
    const idx    = col;
    if (idx >= 0 && idx < this.palette.length) {
      this.selectedColor = this.palette[idx];
      Audio.playPop();
    }
  }

  _hitTestRegion(x, y) {
    const { ctx, currentScene } = this;
    const W = this.canvas.width;
    const H = this.canvas.height - this._paletteHeight() - 10;
    // Scene drawing area
    const sceneH = H * 0.9;
    const sceneY = H * 0.05 + 80; // offset for HUD

    let hit = false;
    // Test regions in reverse order (top-most drawn first in clicking)
    for (let i = currentScene.regions.length - 1; i >= 0; i--) {
      const region = currentScene.regions[i];
      const path   = this._buildPath(region.points, W, sceneH, sceneY);
      if (ctx.isPointInPath(path, x, y)) {
        region.fillColor = this.selectedColor;
        region.filled    = true;
        this.filledCount = currentScene.regions.filter(r => r.filled).length;
        Audio.playCoin();
        Audio.speak(`${region.name}!`, { rate: 1.0 });
        hit = true;

        // If all regions filled, celebrate
        const total = currentScene.regions.length;
        if (this.filledCount >= total) {
          setTimeout(() => this._celebrate(), 400);
        }
        break;
      }
    }
    if (!hit) {
      // Tiny nudge if missed
      Audio.playPop();
    }
  }

  _buildPath(points, W, H, offsetY) {
    const path = new Path2D();
    if (!points || points.length < 2) return path;
    path.moveTo(points[0][0] * W, points[0][1] * H + offsetY);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i][0] * W, points[i][1] * H + offsetY);
    }
    path.closePath();
    return path;
  }

  _celebrate() {
    this.celebrating    = true;
    this.celebrateTimer = 3;
    Audio.playVictory();
    Audio.speak(`Beautiful! You colored the whole picture! Well done, ${App.heroName}!`, { interrupt: true });

    // Burst particles from center
    const cx = this.canvas.width  / 2;
    const cy = this.canvas.height / 2;
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 300;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 200,
        color: this.palette[Math.floor(Math.random() * this.palette.length)],
        life: 1.0 + Math.random() * 1.0,
        size: 6 + Math.random() * 10
      });
    }

    setTimeout(() => {
      App.showOverlay('🎨', 'What a beautiful picture!', 'Keep Coloring! 🖌️', () => {
        this.celebrating = false;
        this._buildScene(); // Reset for another round
        const next = (this.sceneIndex + 1) % COLORING_SCENES.length;
        this.sceneIndex = next;
        this._buildScene();
        Audio.speak(`New picture! Let's color ${this.currentScene.title}!`, { interrupt: true });
      });
    }, 2000);
  }

  _finish() {
    this.stop();
    Audio.playVictory();
    App.showOverlay('🎨', 'Great job coloring!', 'Claim Stars! ⭐', () => {
      this.onComplete(3);
    });
  }

  _paletteHeight() {
    return Math.min(70, this.canvas.height * 0.09);
  }

  _render() {
    const { ctx, canvas, currentScene } = this;
    const W  = canvas.width;
    const H  = canvas.height;
    const pH = this._paletteHeight();
    const drawH = H - pH - 10;
    const sceneH = drawH * 0.9;
    const sceneY = drawH * 0.05 + 75; // below HUD

    // ---- Background ----
    ctx.fillStyle = '#faf6ed';
    ctx.fillRect(0, 0, W, H);

    // ---- Parchment drawing area ----
    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = '#c8a87a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(12, 70, W - 24, drawH - 10, 12);
    ctx.fill();
    ctx.stroke();

    // ---- Draw scene regions (filled colors) ----
    currentScene.regions.forEach(region => {
      const path = this._buildPath(region.points, W, sceneH, sceneY);
      ctx.fillStyle = region.fillColor;
      ctx.fill(path);
    });

    // ---- Draw scene outlines (always on top) ----
    currentScene.regions.forEach(region => {
      const path = this._buildPath(region.points, W, sceneH, sceneY);
      ctx.strokeStyle = '#3a2a10';
      ctx.lineWidth   = Math.max(2, W / 250);
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.stroke(path);
    });

    // ---- Region name labels ----
    currentScene.regions.forEach(region => {
      if (!region.labelPos) return;
      const lx = region.labelPos[0] * W;
      const ly = region.labelPos[1] * sceneH + sceneY;
      ctx.fillStyle = region.filled ? 'rgba(60,40,10,0.4)' : 'rgba(60,40,10,0.6)';
      ctx.font = `${Math.max(11, W / 55)}px Nunito, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(region.name, lx, ly);
      ctx.textBaseline = 'alphabetic';
    });

    // ---- "I'm Done!" button ----
    const btnW = Math.min(160, W * 0.22);
    const btnH = 40;
    const btnX = W - btnW - 16;
    const btnY = 75;
    ctx.fillStyle = '#7b3fc4';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 20);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.min(15, W / 40)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✅ I\'m Done!', btnX + btnW / 2, btnY + btnH / 2 + 5);

    // ---- Progress bar ----
    const total = currentScene.regions.length;
    const pct   = total > 0 ? this.filledCount / total : 0;
    ctx.fillStyle = 'rgba(60,40,10,0.1)';
    ctx.fillRect(12, 65, W - 24, 5);
    ctx.fillStyle = '#7b3fc4';
    ctx.fillRect(12, 65, (W - 24) * pct, 5);

    // ---- Color Palette ----
    this._renderPalette();

    // ---- Celebration particles ----
    if (this.celebrating) {
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
  }

  _renderPalette() {
    const { ctx, canvas, palette, selectedColor } = this;
    const pH     = this._paletteHeight();
    const paletteY = canvas.height - pH;
    const cols   = Math.min(palette.length, Math.floor(canvas.width / 52));
    const swatch = Math.floor(canvas.width / cols);
    const swH    = pH - 8;
    const swY    = paletteY + 4;

    // Palette background
    ctx.fillStyle = '#3a2a10';
    ctx.fillRect(0, paletteY - 2, canvas.width, pH + 2);

    palette.forEach((color, i) => {
      if (i >= cols) return;
      const sx = i * swatch + 4;
      const sw = swatch - 8;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(sx, swY, sw, swH, 8);
      ctx.fill();

      // Selected indicator
      if (color === selectedColor) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth   = 3;
        ctx.stroke();
        // Star indicator
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = `${Math.min(14, swH * 0.5)}px serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', sx + sw / 2, swY + swH / 2);
        ctx.textBaseline = 'alphabetic';
      }
    });
  }
}

// ===== COLORING SCENES =====
// Points are [x, y] as fractions (0-1) of the drawing area width/height
// Regions are drawn bottom-to-top (later = on top)

const COLORING_SCENES = [

  // ---- NOAH'S ARK ----
  {
    id: 'noahs_ark',
    title: "Noah's Ark",
    regions: [
      {
        name: 'Sky',
        labelPos: [0.5, 0.12],
        points: [[0,0],[1,0],[1,0.45],[0,0.45]]
      },
      {
        name: 'Rainbow',
        labelPos: [0.5, 0.15],
        points: [
          [0.15,0.42],[0.2,0.28],[0.3,0.18],[0.5,0.12],[0.7,0.18],[0.8,0.28],[0.85,0.42],
          [0.78,0.42],[0.68,0.3],[0.5,0.2],[0.32,0.3],[0.22,0.42]
        ]
      },
      {
        name: 'Sun',
        labelPos: [0.88, 0.1],
        points: [
          [0.82,0.04],[0.86,0.04],[0.9,0.06],[0.93,0.1],[0.93,0.14],
          [0.9,0.18],[0.86,0.2],[0.82,0.2],[0.78,0.18],[0.75,0.14],
          [0.75,0.1],[0.78,0.06]
        ]
      },
      {
        name: 'Cloud',
        labelPos: [0.25, 0.1],
        points: [
          [0.1,0.15],[0.14,0.1],[0.2,0.08],[0.27,0.1],[0.32,0.08],
          [0.38,0.1],[0.41,0.15],[0.41,0.2],[0.1,0.2]
        ]
      },
      {
        name: 'Water',
        labelPos: [0.5, 0.8],
        points: [
          [0,0.55],[1,0.55],
          [1,0.72],[0.9,0.68],[0.7,0.72],[0.5,0.68],[0.3,0.72],[0.1,0.68],[0,0.72]
        ]
      },
      {
        name: 'Deep Water',
        labelPos: [0.5, 0.9],
        points: [[0,0.7],[1,0.7],[1,1],[0,1]]
      },
      {
        name: 'Ark Body',
        labelPos: [0.5, 0.65],
        points: [
          [0.15,0.72],[0.85,0.72],[0.88,0.65],[0.12,0.65]
        ]
      },
      {
        name: 'Ark Roof',
        labelPos: [0.5, 0.52],
        points: [
          [0.25,0.65],[0.75,0.65],[0.72,0.55],[0.5,0.48],[0.28,0.55]
        ]
      },
      {
        name: 'Ark Window',
        labelPos: [0.5, 0.59],
        points: [
          [0.44,0.63],[0.56,0.63],[0.56,0.57],[0.44,0.57]
        ]
      },
      {
        name: 'Dove',
        labelPos: [0.65, 0.44],
        points: [
          [0.6,0.47],[0.65,0.43],[0.72,0.43],[0.7,0.47],[0.72,0.49],
          [0.68,0.48],[0.65,0.5],[0.62,0.49]
        ]
      }
    ]
  },

  // ---- DAVID AND GOLIATH ----
  {
    id: 'david_goliath',
    title: 'David and the Giant',
    regions: [
      {
        name: 'Sky',
        labelPos: [0.5, 0.08],
        points: [[0,0],[1,0],[1,0.5],[0,0.5]]
      },
      {
        name: 'Sun',
        labelPos: [0.88, 0.08],
        points: [
          [0.82,0.02],[0.87,0.02],[0.92,0.05],[0.95,0.1],[0.95,0.15],
          [0.92,0.19],[0.87,0.22],[0.82,0.22],[0.77,0.19],[0.74,0.14],
          [0.74,0.09],[0.77,0.05]
        ]
      },
      {
        name: 'Cloud',
        labelPos: [0.22, 0.09],
        points: [
          [0.08,0.14],[0.12,0.09],[0.18,0.07],[0.25,0.09],[0.31,0.07],
          [0.37,0.09],[0.4,0.14],[0.4,0.2],[0.08,0.2]
        ]
      },
      {
        name: 'Hills',
        labelPos: [0.5, 0.45],
        points: [
          [0,0.5],[0.15,0.38],[0.35,0.32],[0.5,0.35],[0.65,0.28],
          [0.85,0.35],[1,0.42],[1,0.55],[0,0.55]
        ]
      },
      {
        name: 'Ground',
        labelPos: [0.5, 0.78],
        points: [[0,0.55],[1,0.55],[1,1],[0,1]]
      },
      // Goliath — big figure on right
      {
        name: 'Goliath Body',
        labelPos: [0.76, 0.7],
        points: [
          [0.68,0.55],[0.85,0.55],[0.87,0.65],[0.84,0.78],[0.83,0.92],
          [0.79,0.92],[0.78,0.78],[0.75,0.78],[0.74,0.92],[0.7,0.92],
          [0.69,0.78],[0.66,0.65]
        ]
      },
      {
        name: 'Goliath Head',
        labelPos: [0.765, 0.52],
        points: [
          [0.72,0.55],[0.73,0.49],[0.76,0.46],[0.8,0.46],[0.83,0.49],
          [0.84,0.55]
        ]
      },
      {
        name: 'Goliath Helmet',
        labelPos: [0.765, 0.44],
        points: [
          [0.71,0.52],[0.73,0.47],[0.76,0.44],[0.8,0.44],[0.83,0.47],
          [0.85,0.52]
        ]
      },
      {
        name: 'Goliath Sword',
        labelPos: [0.9, 0.72],
        points: [
          [0.85,0.58],[0.9,0.58],[0.92,0.88],[0.87,0.88]
        ]
      },
      // David — small figure on left
      {
        name: 'David Body',
        labelPos: [0.2, 0.75],
        points: [
          [0.15,0.68],[0.27,0.68],[0.28,0.76],[0.26,0.88],
          [0.24,0.92],[0.21,0.92],[0.2,0.88],[0.19,0.88],
          [0.18,0.92],[0.15,0.92],[0.14,0.78]
        ]
      },
      {
        name: 'David Head',
        labelPos: [0.21, 0.63],
        points: [
          [0.17,0.68],[0.18,0.63],[0.21,0.6],[0.25,0.6],[0.27,0.63],
          [0.28,0.68]
        ]
      },
      {
        name: 'Sling',
        labelPos: [0.1, 0.65],
        points: [
          [0.14,0.68],[0.07,0.62],[0.05,0.65],[0.12,0.72]
        ]
      },
      {
        name: 'Stone',
        labelPos: [0.06, 0.6],
        points: [
          [0.03,0.6],[0.06,0.57],[0.09,0.58],[0.1,0.62],[0.07,0.65],[0.04,0.64]
        ]
      }
    ]
  },

  // ---- CREATION ----
  {
    id: 'creation',
    title: 'God Creates the World',
    regions: [
      {
        name: 'Night Sky',
        labelPos: [0.25, 0.12],
        points: [[0,0],[0.5,0],[0.5,0.5],[0,0.5]]
      },
      {
        name: 'Day Sky',
        labelPos: [0.75, 0.12],
        points: [[0.5,0],[1,0],[1,0.5],[0.5,0.5]]
      },
      {
        name: 'Moon',
        labelPos: [0.12, 0.1],
        points: [
          [0.08,0.18],[0.1,0.12],[0.14,0.08],[0.2,0.08],
          [0.16,0.12],[0.14,0.18],[0.16,0.24],[0.2,0.28],
          [0.14,0.26],[0.1,0.22]
        ]
      },
      {
        name: 'Star 1', labelPos: [0.32, 0.1],
        points: [[0.3,0.06],[0.32,0.02],[0.34,0.06],[0.38,0.07],[0.35,0.1],[0.36,0.14],[0.32,0.12],[0.28,0.14],[0.29,0.1],[0.26,0.07]]
      },
      {
        name: 'Star 2', labelPos: [0.22, 0.25],
        points: [[0.2,0.21],[0.22,0.17],[0.24,0.21],[0.28,0.22],[0.25,0.25],[0.26,0.29],[0.22,0.27],[0.18,0.29],[0.19,0.25],[0.16,0.22]]
      },
      {
        name: 'Sun',
        labelPos: [0.82, 0.12],
        points: [
          [0.75,0.04],[0.8,0.02],[0.85,0.02],[0.9,0.04],[0.93,0.09],
          [0.93,0.15],[0.9,0.2],[0.85,0.22],[0.8,0.22],
          [0.75,0.2],[0.72,0.15],[0.72,0.09]
        ]
      },
      {
        name: 'Ocean',
        labelPos: [0.5, 0.62],
        points: [
          [0,0.5],[1,0.5],[1,0.68],
          [0.9,0.65],[0.7,0.7],[0.5,0.65],[0.3,0.7],[0.1,0.65],[0,0.68]
        ]
      },
      {
        name: 'Deep Ocean',
        labelPos: [0.5, 0.78],
        points: [[0,0.66],[1,0.66],[1,1],[0,1]]
      },
      {
        name: 'Land',
        labelPos: [0.5, 0.58],
        points: [
          [0.15,0.5],[0.85,0.5],[0.88,0.56],[0.85,0.62],[0.5,0.65],
          [0.15,0.62],[0.12,0.56]
        ]
      },
      // Big Tree
      {
        name: 'Tree Trunk',
        labelPos: [0.5, 0.74],
        points: [
          [0.47,0.62],[0.53,0.62],[0.54,0.75],[0.46,0.75]
        ]
      },
      {
        name: 'Tree Top',
        labelPos: [0.5, 0.5],
        points: [
          [0.38,0.62],[0.62,0.62],[0.65,0.55],[0.6,0.48],
          [0.5,0.44],[0.4,0.48],[0.35,0.55]
        ]
      },
      // Flower left
      {
        name: 'Flower',
        labelPos: [0.25, 0.55],
        points: [
          [0.2,0.62],[0.22,0.58],[0.25,0.56],[0.28,0.58],[0.3,0.62],
          [0.28,0.65],[0.25,0.66],[0.22,0.65]
        ]
      },
      // Animal (simple bird in sky)
      {
        name: 'Bird',
        labelPos: [0.62, 0.3],
        points: [
          [0.58,0.34],[0.62,0.28],[0.67,0.28],[0.7,0.32],[0.67,0.36],
          [0.65,0.38],[0.62,0.38],[0.59,0.36]
        ]
      }
    ]
  }
];
