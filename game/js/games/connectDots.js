// ===== CONNECT THE DOTS GAME =====
// Click numbered dots in order to draw a Bible picture!
// Supports mouse, touch, and camera pinch-to-click.

class ConnectDotsGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx    = ctx;
    this.onComplete = onComplete;

    this.running     = false;
    this.sceneIndex  = 0;
    this.scene       = null;
    this.dots        = [];        // scaled dot positions [{x,y,num}]
    this.nextDot     = 0;         // index of next dot to click
    this.drawnLines  = [];        // [{x1,y1,x2,y2}] lines already drawn
    this.celebration = false;
    this.particles   = [];

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

  start(sceneIndex = 0) {
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this._buildDots(); });

    this.sceneIndex = sceneIndex % DOT_SCENES.length;
    this.running    = true;
    this.particles  = [];

    this.canvas.addEventListener('click',    this._onClick);
    this.canvas.addEventListener('touchend', this._onTouch, { passive: false });

    App.setHUDTitle('Connect the Dots! 🌟');
    App.updateHUDScore(0);
    App.updateHUDHearts('');

    this._loadScene();

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

  _loadScene() {
    this.scene       = DOT_SCENES[this.sceneIndex];
    this.nextDot     = 0;
    this.drawnLines  = [];
    this.celebration = false;
    this._buildDots();

    App.setHUDTitle(`${this.scene.title} ✏️`);
    Audio.speak(`Connect the dots to make the ${this.scene.title}! Start with dot number one!`, { interrupt: true });
  }

  _buildDots() {
    if (!this.scene) return;
    const W     = this.canvas.width;
    const H     = this.canvas.height;
    const padT  = 90;
    const padB  = 60;
    const drawH = H - padT - padB;
    // Use a square drawing area so shapes are proportional — not stretched wide
    // (old problem) or tall-and-skinny (new problem). Both axes scale equally.
    const size = Math.min(W - 80, drawH, 460);
    const offX = (W - size) / 2;
    const offY = padT + (drawH - size) / 2;

    this.dots = this.scene.dots.map((d, i) => ({
      x:   offX + d[0] * size,
      y:   offY + d[1] * size,
      num: i + 1
    }));
  }

  _handleClick(x, y) {
    if (this.celebration || this.nextDot >= this.dots.length) return;

    const target    = this.dots[this.nextDot];
    const hitRadius = Math.max(26, this.canvas.width * 0.044);

    if (Math.hypot(x - target.x, y - target.y) <= hitRadius) {
      // Draw line from previous dot
      if (this.nextDot > 0) {
        const prev = this.dots[this.nextDot - 1];
        this.drawnLines.push({ x1: prev.x, y1: prev.y, x2: target.x, y2: target.y });
      }

      // Sparkle burst on the dot
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 120;
        this.particles.push({
          x: target.x, y: target.y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50,
          life: 0.6 + Math.random() * 0.4,
          size: 4 + Math.random() * 5,
          color: ['#ffd700','#fff','#c77dff','#7bc8ff'][Math.floor(Math.random() * 4)]
        });
      }

      Audio.playCoin();
      this.nextDot++;
      App.updateHUDScore(this.nextDot);

      if (this.nextDot === this.dots.length) {
        // Close the shape
        if (this.scene.closed && this.dots.length > 2) {
          const last  = this.dots[this.dots.length - 1];
          const first = this.dots[0];
          this.drawnLines.push({ x1: last.x, y1: last.y, x2: first.x, y2: first.y });
        }
        this._completeScene();
      } else if (this.nextDot % 3 === 0) {
        Audio.speak(`Great! Now dot ${this.nextDot + 1}!`);
      }
    } else {
      // Missed
      Audio.playWrong();
      Audio.speak(`Find dot number ${this.nextDot + 1}!`);
    }
  }

  _completeScene() {
    this.celebration = true;
    Audio.playVictory();

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 100 + Math.random() * 300;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150,
        life: 1.0 + Math.random(),
        size: 6 + Math.random() * 8,
        color: ['#ffd700','#fff','#c77dff','#43a047','#ff6b6b'][Math.floor(Math.random() * 5)]
      });
    }

    Audio.speak(this.scene.completeText, {
      interrupt: true,
      onEnd: () => {
        App.showOverlay('🌟', this.scene.completeText, 'Claim Stars! ⭐', () => {
          this.onComplete(3);
        });
      }
    });
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
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 280 * dt;
      p.life -= dt * 1.2;
    });
  }

  _render() {
    const { ctx, canvas } = this;
    if (!this.scene) return;

    // Parchment background
    const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grd.addColorStop(0, '#fffde7');
    grd.addColorStop(1, '#f5e6c8');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Paper lines
    ctx.strokeStyle = 'rgba(139,94,60,0.08)';
    ctx.lineWidth = 1;
    for (let y = 64; y < canvas.height; y += 32) {
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(canvas.width - 30, y); ctx.stroke();
    }

    // Prompt text
    ctx.fillStyle = '#6a3a10';
    ctx.font = `bold ${Math.min(20, canvas.width / 28)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(this.scene.prompt, canvas.width / 2, 58);

    // Faint fill shape when done
    if (this.celebration && this.dots.length > 2) {
      ctx.fillStyle = this.scene.fillColor || 'rgba(255,215,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(this.dots[0].x, this.dots[0].y);
      this.dots.forEach(d => ctx.lineTo(d.x, d.y));
      ctx.closePath();
      ctx.fill();
    }

    // Drawn lines
    if (this.drawnLines.length > 0) {
      ctx.strokeStyle = this.scene.strokeColor || '#7b3fc4';
      ctx.lineWidth   = Math.max(5, canvas.width * 0.014);
      ctx.lineCap     = 'round';
      this.drawnLines.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      });
    }

    // Dots — kept small so they don't overwhelm the shape
    const dotR = Math.max(13, Math.min(20, canvas.width * 0.026));
    this.dots.forEach((dot, i) => {
      const isNext = i === this.nextDot;
      const isDone = i < this.nextDot;

      // Glow ring on next dot
      if (isNext) {
        const pulse = 1 + Math.sin(Date.now() / 240) * 0.22;
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dotR * pulse * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle   = isDone ? '#43a047' : isNext ? '#7b3fc4' : '#8b5e3c';
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dotR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isDone ? '#2e7d32' : isNext ? '#4a2a9a' : '#5a3a10';
      ctx.lineWidth   = 3;
      ctx.stroke();

      ctx.fillStyle    = 'white';
      ctx.font         = `bold ${Math.max(13, dotR * 0.88)}px Nunito, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dot.num, dot.x, dot.y);
      ctx.textBaseline = 'alphabetic';
    });

    // Bouncing pointer above next dot
    if (!this.celebration && this.nextDot < this.dots.length) {
      const next  = this.dots[this.nextDot];
      const bob   = Math.sin(Date.now() / 300) * 6;
      ctx.font    = `${Math.min(28, canvas.width / 20)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('👇', next.x, next.y - dotR * 1.9 + bob);
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

    // Progress counter
    ctx.fillStyle = 'rgba(106,58,16,0.5)';
    ctx.font      = '14px Nunito, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.min(this.nextDot, this.dots.length)} / ${this.dots.length} dots`, 16, canvas.height - 16);
  }
}

// ===== DOT SCENES =====
// dots: normalized [x, y] within 0-1 space; listed in click order.
// closed: true → last dot connects back to first dot.

const DOT_SCENES = [
  {
    id: 'star',
    title: 'Star of Bethlehem',
    prompt: 'Connect the dots to make the Christmas Star!',
    completeText: 'The Star of Bethlehem! It led the wise men to baby Jesus!',
    strokeColor: '#f9a825',
    fillColor:   'rgba(255,215,0,0.22)',
    closed: true,
    dots: [
      [0.50, 0.14], // 1 top outer point
      [0.58, 0.38], // 2 inner
      [0.82, 0.38], // 3 upper-right outer
      [0.63, 0.54], // 4 inner
      [0.72, 0.78], // 5 lower-right outer
      [0.50, 0.64], // 6 inner bottom
      [0.28, 0.78], // 7 lower-left outer
      [0.37, 0.54], // 8 inner
      [0.18, 0.38], // 9 upper-left outer
      [0.42, 0.38], // 10 inner
    ]
  },
  {
    id: 'heart',
    title: "God's Love Heart",
    prompt: "Connect the dots to make God's love heart!",
    completeText: "A heart! God loves you so very much! He is always with you!",
    strokeColor: '#e53935',
    fillColor:   'rgba(229,57,53,0.18)',
    closed: true,
    dots: [
      [0.50, 0.82], // 1 bottom tip
      [0.28, 0.62], // 2 lower-left curve
      [0.18, 0.46], // 3 left side
      [0.22, 0.30], // 4 upper-left lobe base
      [0.36, 0.21], // 5 left lobe top
      [0.50, 0.34], // 6 center dip
      [0.64, 0.21], // 7 right lobe top
      [0.78, 0.30], // 8 upper-right lobe base
      [0.82, 0.46], // 9 right side
      [0.72, 0.62], // 10 lower-right curve
    ]
  },
  {
    id: 'fish',
    title: 'The Miracle Fish',
    prompt: 'Connect the dots to make the holy fish!',
    completeText: "A fish! Jesus helped Peter catch so many fish. He can do miracles!",
    strokeColor: '#1565c0',
    fillColor:   'rgba(21,101,192,0.18)',
    closed: false,
    dots: [
      [0.32, 0.50], // 1 tail junction
      [0.18, 0.36], // 2 tail top fin
      [0.18, 0.64], // 3 tail bottom fin
      [0.32, 0.50], // 4 back to junction
      [0.48, 0.60], // 5 lower body
      [0.64, 0.57], // 6
      [0.80, 0.50], // 7 nose
      [0.64, 0.43], // 8
      [0.48, 0.40], // 9 upper body
      [0.32, 0.50], // 10 back to tail
    ]
  },
  {
    id: 'rainbow',
    title: "Noah's Rainbow",
    prompt: "Connect the dots to make Noah's rainbow!",
    completeText: "A rainbow! God put a rainbow in the sky as His promise to Noah!",
    strokeColor: '#8e24aa',
    fillColor:   'rgba(142,36,170,0.10)',
    closed: false,
    dots: [
      [0.08, 0.80], // 1 left ground
      [0.14, 0.58], // 2
      [0.24, 0.38], // 3
      [0.37, 0.25], // 4
      [0.50, 0.20], // 5 top center
      [0.63, 0.25], // 6
      [0.76, 0.38], // 7
      [0.86, 0.58], // 8
      [0.92, 0.80], // 9 right ground
    ]
  },
  {
    id: 'dove',
    title: 'The Holy Dove',
    prompt: 'Connect the dots to make the dove!',
    completeText: "A dove! The Holy Spirit came like a dove when Jesus was baptized. So beautiful!",
    strokeColor: '#7b3fc4',
    fillColor:   'rgba(123,63,196,0.14)',
    closed: true,
    dots: [
      [0.46, 0.23], // 1 head top
      [0.60, 0.26], // 2 neck right
      [0.74, 0.34], // 3 right wing tip
      [0.68, 0.47], // 4 right wing base
      [0.78, 0.63], // 5 tail right
      [0.50, 0.71], // 6 tail bottom center
      [0.22, 0.63], // 7 tail left
      [0.32, 0.47], // 8 left wing base
      [0.26, 0.34], // 9 left wing tip
      [0.40, 0.30], // 10 chest/beak area
    ]
  },
  {
    id: 'ark',
    title: "Noah's Ark",
    prompt: "Connect the dots to draw Noah's big boat!",
    completeText: "Noah's Ark! God kept Noah, his family, and all the animals safe!",
    strokeColor: '#8b5e3c',
    fillColor:   'rgba(139,94,60,0.18)',
    closed: true,
    dots: [
      [0.14, 0.76], // 1 hull bottom-left
      [0.86, 0.76], // 2 hull bottom-right
      [0.86, 0.56], // 3 hull top-right
      [0.70, 0.56], // 4 cabin right base
      [0.70, 0.40], // 5 cabin right wall
      [0.50, 0.26], // 6 roof peak
      [0.30, 0.40], // 7 cabin left wall
      [0.30, 0.56], // 8 cabin left base
      [0.14, 0.56], // 9 hull top-left
    ]
  },
  {
    id: 'cross',
    title: 'The Holy Cross',
    prompt: 'Connect the dots to make the cross!',
    completeText: "The cross! Jesus died on it because He loves us, and then He rose again!",
    strokeColor: '#5c3a8a',
    fillColor:   'rgba(92,58,138,0.15)',
    closed: false,
    dots: [
      [0.50, 0.16], // 1 top
      [0.50, 0.42], // 2 junction
      [0.22, 0.42], // 3 left end
      [0.50, 0.42], // 4 center again
      [0.78, 0.42], // 5 right end
      [0.50, 0.42], // 6 center again
      [0.50, 0.84], // 7 bottom
    ]
  },
  {
    id: 'crown',
    title: "The King's Crown",
    prompt: 'Connect the dots to make the crown!',
    completeText: "A crown! Jesus is the King of Kings and Lord of Lords!",
    strokeColor: '#f9a825',
    fillColor:   'rgba(249,168,37,0.18)',
    closed: true,
    dots: [
      [0.14, 0.78], // 1 bottom-left
      [0.14, 0.46], // 2 left side
      [0.29, 0.27], // 3 left prong tip
      [0.38, 0.48], // 4 left-center valley
      [0.50, 0.22], // 5 center prong tip
      [0.62, 0.48], // 6 right-center valley
      [0.71, 0.27], // 7 right prong tip
      [0.86, 0.46], // 8 right side
      [0.86, 0.78], // 9 bottom-right
    ]
  },
  {
    id: 'angel',
    title: 'The Angel',
    prompt: 'Connect the dots to make the angel!',
    completeText: "An angel! God sends angels to watch over us and bring good news!",
    strokeColor: '#ffa726',
    fillColor:   'rgba(255,167,38,0.15)',
    closed: true,
    dots: [
      [0.50, 0.18], // 1 halo top
      [0.60, 0.28], // 2 halo-right / head
      [0.72, 0.22], // 3 right wing tip
      [0.68, 0.40], // 4 right wing base
      [0.80, 0.58], // 5 right body side
      [0.65, 0.76], // 6 right hem
      [0.50, 0.82], // 7 bottom center
      [0.35, 0.76], // 8 left hem
      [0.20, 0.58], // 9 left body side
      [0.32, 0.40], // 10 left wing base
      [0.28, 0.22], // 11 left wing tip
      [0.40, 0.28], // 12 halo-left / head
    ]
  },
  {
    id: 'lamb',
    title: "The Lamb of God",
    prompt: 'Connect the dots to make the lamb!',
    completeText: "A lamb! Jesus is called the Lamb of God because He is gentle and kind!",
    strokeColor: '#90a4ae',
    fillColor:   'rgba(144,164,174,0.20)',
    closed: true,
    dots: [
      [0.50, 0.20], // 1 head top
      [0.65, 0.26], // 2 ear right
      [0.62, 0.38], // 3 neck right
      [0.74, 0.44], // 4 back
      [0.78, 0.58], // 5 rump
      [0.70, 0.76], // 6 back leg right
      [0.55, 0.80], // 7 belly bottom
      [0.40, 0.76], // 8 front leg left
      [0.26, 0.56], // 9 chest
      [0.30, 0.40], // 10 neck left
      [0.36, 0.28], // 11 chin
      [0.44, 0.22], // 12 muzzle top
    ]
  },
];
