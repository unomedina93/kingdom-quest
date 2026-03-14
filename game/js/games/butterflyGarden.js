class ButterflyGardenGame {
  constructor(canvas, ctx, onComplete) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.onComplete = onComplete;
    this._rafId = null;
    this._running = false;
    this._lastTs = 0;
    this._boundClick = this._onClick.bind(this);
    this._boundTouch = this._onTouch.bind(this);

    this._round = 0;
    this._colors = [
      { name: 'red',    fill: '#e74c3c', dark: '#c0392b' },
      { name: 'blue',   fill: '#3498db', dark: '#2980b9' },
      { name: 'yellow', fill: '#f1c40f', dark: '#d4ac0d' },
      { name: 'purple', fill: '#9b59b6', dark: '#7d3c98' }
    ];
    this._flowers = [];
    this._butterflies = [];
    this._selected = null;
    this._matchedCount = 0;
    this._celebrating = false;
    this._celebrationTimer = 0;
    this._time = 0;

    this._pointerX = 0;
    this._pointerY = 0;
    this._boundMove = this._onMove.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
  }

  start() {
    this._running = true;
    App.setHUDTitle('Butterfly Garden');
    App.updateHUDScore(0);
    this.canvas.addEventListener('click', this._boundClick);
    this.canvas.addEventListener('touchstart', this._boundTouch, { passive: true });
    this.canvas.addEventListener('mousemove', this._boundMove);
    this.canvas.addEventListener('touchmove', this._boundTouchMove, { passive: true });
    this._startRound();
    Audio.speak('Match each butterfly to its flower!', { rate: 0.85 });
    this._lastTs = performance.now();
    this._rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this.canvas.removeEventListener('click', this._boundClick);
    this.canvas.removeEventListener('touchstart', this._boundTouch);
    this.canvas.removeEventListener('mousemove', this._boundMove);
    this.canvas.removeEventListener('touchmove', this._boundTouchMove);
  }

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.1);
    this._lastTs = ts;
    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(ts2 => this._loop(ts2));
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this._handleTap((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  }

  _onTouch(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    const t = e.changedTouches[0];
    this._handleTap((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
  }

  _onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this._pointerX = (e.clientX - rect.left) * sx;
    this._pointerY = (e.clientY - rect.top) * sy;
  }

  _onTouchMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    const t = e.changedTouches[0];
    this._pointerX = (t.clientX - rect.left) * sx;
    this._pointerY = (t.clientY - rect.top) * sy;
    if (this._selected !== null) {
      const b = this._butterflies[this._selected];
      b.x = this._pointerX;
      b.y = this._pointerY;
    }
  }

  _startRound() {
    this._selected = null;
    this._matchedCount = 0;
    this._celebrating = false;
    this._celebrationTimer = 0;
    this._time = 0;
    App.updateHUDScore(0);

    const W = this.canvas.width;
    const H = this.canvas.height;

    const flowerY = H * 0.82;
    const flowerSpacing = W / 5;
    const shuffledColors = this._shuffleArray([...this._colors]);

    this._flowers = shuffledColors.map((col, i) => ({
      x: flowerSpacing + i * flowerSpacing,
      y: flowerY,
      colorIndex: this._colors.indexOf(col),
      color: col,
      matched: false,
      landedButterfly: null
    }));

    const btColors = this._shuffleArray([...this._colors]);
    const usableH = H * 0.62;
    const marginX = 60;
    const marginTop = 80;

    this._butterflies = btColors.map((col, i) => {
      const baseX = marginX + Math.random() * (W - marginX * 2);
      const baseY = marginTop + Math.random() * (usableH - marginTop);
      return {
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        colorIndex: this._colors.indexOf(col),
        color: col,
        matched: false,
        selected: false,
        driftPhaseX: Math.random() * Math.PI * 2,
        driftPhaseY: Math.random() * Math.PI * 2,
        driftSpeedX: 0.6 + Math.random() * 0.4,
        driftSpeedY: 0.5 + Math.random() * 0.3,
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: 4 + Math.random() * 2,
      };
    });
  }

  _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  _handleTap(x, y) {
    if (this._celebrating) return;

    if (this._selected !== null) {
      const selB = this._butterflies[this._selected];

      for (let fi = 0; fi < this._flowers.length; fi++) {
        const f = this._flowers[fi];
        if (f.matched) continue;
        const dx = x - f.x;
        const dy = y - f.y;
        if (Math.sqrt(dx * dx + dy * dy) < 40) {
          if (f.colorIndex === selB.colorIndex) {
            selB.matched = true;
            selB.selected = false;
            selB.x = f.x;
            selB.y = f.y - 40;
            f.matched = true;
            f.landedButterfly = this._selected;
            this._selected = null;
            this._matchedCount++;
            App.updateHUDScore(this._matchedCount);
            Audio.playSuccess();
            Audio.speak("Perfect match!", { rate: 0.9, interrupt: true });

            if (this._matchedCount === 4) {
              this._celebrating = true;
              this._celebrationTimer = 2.5;
              setTimeout(() => {
                Audio.speak("Beautiful! All butterflies found their flowers!", { rate: 0.9 });
              }, 400);
            }
          } else {
            selB.selected = false;
            selB.x = selB.baseX;
            selB.y = selB.baseY;
            this._selected = null;
            Audio.speak("Oops! Find the matching flower!", { rate: 0.9, interrupt: true });
          }
          return;
        }
      }

      for (let bi = 0; bi < this._butterflies.length; bi++) {
        if (bi === this._selected) continue;
        const b = this._butterflies[bi];
        if (b.matched) continue;
        const dx = x - b.x;
        const dy = y - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < 35) {
          selB.selected = false;
          selB.x = selB.baseX;
          selB.y = selB.baseY;
          this._selected = bi;
          b.selected = true;
          b.x = x;
          b.y = y;
          this._pointerX = x;
          this._pointerY = y;
          Audio.playBoing();
          return;
        }
      }

      selB.selected = false;
      selB.x = selB.baseX;
      selB.y = selB.baseY;
      this._selected = null;
      return;
    }

    for (let bi = 0; bi < this._butterflies.length; bi++) {
      const b = this._butterflies[bi];
      if (b.matched) continue;
      const dx = x - b.x;
      const dy = y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < 35) {
        this._selected = bi;
        b.selected = true;
        b.x = x;
        b.y = y;
        this._pointerX = x;
        this._pointerY = y;
        Audio.playBoing();
        return;
      }
    }
  }

  _update(dt) {
    this._time += dt;

    for (let i = 0; i < this._butterflies.length; i++) {
      const b = this._butterflies[i];
      b.wingPhase += dt * b.wingSpeed;

      if (b.matched) continue;
      if (b.selected) {
        b.x += (this._pointerX - b.x) * Math.min(1, dt * 15);
        b.y += (this._pointerY - b.y) * Math.min(1, dt * 15);
        continue;
      }

      b.x = b.baseX + Math.sin(this._time * b.driftSpeedX + b.driftPhaseX) * 30;
      b.y = b.baseY + Math.sin(this._time * b.driftSpeedY + b.driftPhaseY) * 20;
    }

    if (this._celebrating) {
      this._celebrationTimer -= dt;
      if (this._celebrationTimer <= 0) {
        this._round++;
        if (this._round >= 3) {
          this.stop();
          this.onComplete(3);
          return;
        }
        this._startRound();
      }
    }
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#87ceeb');
    bgGrad.addColorStop(0.55, '#b8e4f7');
    bgGrad.addColorStop(0.72, '#90c060');
    bgGrad.addColorStop(1, '#5a8a30');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#7ab648';
    ctx.fillRect(0, H * 0.75, W, H * 0.25);

    ctx.save();
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#1a3a00';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText('Match each butterfly to its flower!', W / 2, 36);
    ctx.restore();

    ctx.save();
    ctx.font = '16px Arial';
    ctx.fillStyle = '#2a5010';
    ctx.textAlign = 'center';
    ctx.fillText('Round ' + (this._round + 1) + ' of 3', W / 2, 60);
    ctx.restore();

    for (const f of this._flowers) {
      this._drawFlower(ctx, f.x, f.y, f.color, f.matched);
    }

    for (let i = 0; i < this._butterflies.length; i++) {
      const b = this._butterflies[i];
      this._drawButterfly(ctx, b.x, b.y, b.color, b.selected, b.wingPhase, b.matched);
    }

    if (this._celebrating) {
      const elapsed = 2.5 - this._celebrationTimer;
      const fadeIn = Math.min(1, elapsed / 0.5);
      ctx.save();
      ctx.globalAlpha = fadeIn;
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = '#ff69b4';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 16;
      ctx.fillText('All matched! 🦋', W / 2, H / 2 - 20);
      ctx.restore();
    }
  }

  _drawFlower(ctx, x, y, colorObj, matched) {
    const stemH = 55;
    const petalR = 14;
    const centerR = 10;

    ctx.save();
    ctx.strokeStyle = '#2e7d00';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + stemH);
    ctx.stroke();

    if (matched) {
      ctx.shadowColor = colorObj.fill;
      ctx.shadowBlur = 14;
    }

    ctx.fillStyle = colorObj.fill;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * petalR;
      const py = y + Math.sin(angle) * petalR;
      ctx.beginPath();
      ctx.arc(px, py, petalR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f9f3a0';
    ctx.beginPath();
    ctx.arc(x, y, centerR, 0, Math.PI * 2);
    ctx.fill();

    if (matched) {
      ctx.strokeStyle = '#00aa00';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x - 1, y + 5);
      ctx.lineTo(x + 7, y - 5);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawButterfly(ctx, x, y, colorObj, selected, wingPhase, matched) {
    ctx.save();
    ctx.translate(x, y);

    if (selected) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
    } else if (matched) {
      ctx.shadowColor = colorObj.fill;
      ctx.shadowBlur = 10;
    }

    const flapAngle = Math.sin(wingPhase) * 0.5;

    const upperW = 26;
    const upperH = 20;

    ctx.save();
    ctx.rotate(-flapAngle);
    ctx.fillStyle = colorObj.fill;
    ctx.globalAlpha = selected ? 0.9 : 0.85;
    ctx.beginPath();
    ctx.ellipse(-upperW * 0.6, -upperH * 0.5, upperW, upperH, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colorObj.dark;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-upperW, -upperH * 0.3);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(flapAngle);
    ctx.fillStyle = colorObj.fill;
    ctx.globalAlpha = selected ? 0.9 : 0.85;
    ctx.beginPath();
    ctx.ellipse(upperW * 0.6, -upperH * 0.5, upperW, upperH, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colorObj.dark;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(upperW, -upperH * 0.3);
    ctx.stroke();
    ctx.restore();

    const lowerW = 18;
    const lowerH = 13;

    ctx.save();
    ctx.rotate(-flapAngle * 0.7);
    ctx.fillStyle = colorObj.dark;
    ctx.globalAlpha = selected ? 0.85 : 0.78;
    ctx.beginPath();
    ctx.ellipse(-lowerW * 0.5, lowerH * 0.5, lowerW, lowerH, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.rotate(flapAngle * 0.7);
    ctx.fillStyle = colorObj.dark;
    ctx.globalAlpha = selected ? 0.85 : 0.78;
    ctx.beginPath();
    ctx.ellipse(lowerW * 0.5, lowerH * 0.5, lowerW, lowerH, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3a2000';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2a1500';
    ctx.beginPath();
    ctx.arc(0, -13, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2a1500';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -15);
    ctx.quadraticCurveTo(-8, -24, -6, -28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1, -15);
    ctx.quadraticCurveTo(8, -24, 6, -28);
    ctx.stroke();
    ctx.fillStyle = '#2a1500';
    ctx.beginPath();
    ctx.arc(-6, -28, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -28, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
