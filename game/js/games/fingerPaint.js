// ===== FINGER PAINT =====
// Free painting canvas! Drag to paint, tap color swatches to change color.
// Tap the star button to launch fireworks. Toddler's creative playground.

class FingerPaintGame {
  static PALETTE = ['#e53935','#fb8c00','#fdd835','#43a047','#00acc1','#1e88e5','#8e24aa','#f48fb1','#ffffff','#212121'];

  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;
    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;
    this.color      = '#e53935';
    this.brushSize  = 18;
    this.drawing    = false;
    this.lastX      = 0;
    this.lastY      = 0;
    this.strokes    = 0;
    this.fireworks  = [];
    this._offscreen = null; // persistent drawing layer
    this._uiEl      = null;
    this._onMouseDown = this._mouseDown.bind(this);
    this._onMouseMove = this._mouseMove.bind(this);
    this._onMouseUp   = this._mouseUp.bind(this);
    this._onTouchStart = this._touchStart.bind(this);
    this._onTouchMove  = this._touchMove.bind(this);
    this._onTouchEnd   = this._touchEnd.bind(this);
  }

  start() {
    this._running = true;
    this.strokes  = 0;
    App.setHUDTitle('Finger Paint!');
    App.updateHUDScore(0);

    // Offscreen canvas for persistent strokes
    this._offscreen = document.createElement('canvas');
    this._offscreen.width  = this.canvas.width;
    this._offscreen.height = this.canvas.height;
    const oc = this._offscreen.getContext('2d');
    const bg = oc.createLinearGradient(0,0,0,this.canvas.height);
    bg.addColorStop(0,'#fffde7'); bg.addColorStop(1,'#fff9c4');
    oc.fillStyle = bg; oc.fillRect(0,0,this.canvas.width,this.canvas.height);

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseup',   this._onMouseUp);
    this.canvas.addEventListener('touchstart',this._onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this._onTouchMove,  { passive: false });
    this.canvas.addEventListener('touchend',  this._onTouchEnd,   { passive: false });

    this._buildUI();
    Audio.speak("Draw anything you like! Tap the colors to change!", { rate: 0.9 });
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup',   this._onMouseUp);
    this.canvas.removeEventListener('touchstart',this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend',  this._onTouchEnd);
    if (this._uiEl) { this._uiEl.remove(); this._uiEl = null; }
  }

  _buildUI() {
    if (this._uiEl) this._uiEl.remove();
    const ui = document.createElement('div');
    ui.id = 'fp-ui';
    ui.style.cssText = `position:fixed;bottom:0;left:0;right:0;height:70px;display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(0,0,0,0.6);z-index:1000;padding:0 12px;`;

    // Color swatches
    for (const col of FingerPaintGame.PALETTE) {
      const sw = document.createElement('div');
      sw.style.cssText = `width:36px;height:36px;border-radius:50%;background:${col};border:3px solid ${col===this.color?'#ffd700':'rgba(255,255,255,0.4)'};cursor:pointer;flex-shrink:0;touch-action:none;`;
      sw.addEventListener('click', () => { this.color = col; this._refreshUI(); });
      sw.addEventListener('touchstart', (e) => { e.stopPropagation(); this.color = col; this._refreshUI(); }, { passive: true });
      sw.dataset.col = col;
      ui.appendChild(sw);
    }

    // Fireworks button
    const fw = document.createElement('div');
    fw.style.cssText = `width:44px;height:44px;border-radius:50%;background:#ffd700;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;flex-shrink:0;border:3px solid white;`;
    fw.textContent = '🎆';
    fw.addEventListener('click', () => this._launchFireworks());
    fw.addEventListener('touchstart', (e) => { e.stopPropagation(); this._launchFireworks(); }, { passive: true });
    ui.appendChild(fw);

    // Clear button
    const cl = document.createElement('div');
    cl.style.cssText = `width:44px;height:44px;border-radius:50%;background:#ef5350;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;flex-shrink:0;border:3px solid white;`;
    cl.textContent = '🗑️';
    cl.addEventListener('click', () => this._clearCanvas());
    cl.addEventListener('touchstart', (e) => { e.stopPropagation(); this._clearCanvas(); }, { passive: true });
    ui.appendChild(cl);

    // Done button
    const dn = document.createElement('div');
    dn.style.cssText = `width:44px;height:44px;border-radius:50%;background:#43a047;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;flex-shrink:0;border:3px solid white;`;
    dn.textContent = '✅';
    dn.addEventListener('click', () => { Audio.speak("Beautiful art! What a masterpiece!", { rate: 0.9 }); setTimeout(() => this.onComplete(3), 2000); });
    dn.addEventListener('touchstart', (e) => { e.stopPropagation(); Audio.speak("Beautiful art!", { rate: 0.9 }); setTimeout(() => this.onComplete(3), 2000); }, { passive: true });
    ui.appendChild(dn);

    document.body.appendChild(ui);
    this._uiEl = ui;
  }

  _refreshUI() {
    if (!this._uiEl) return;
    this._uiEl.querySelectorAll('[data-col]').forEach(sw => {
      sw.style.border = `3px solid ${sw.dataset.col === this.color ? '#ffd700' : 'rgba(255,255,255,0.4)'}`;
    });
  }

  _clearCanvas() {
    const oc = this._offscreen.getContext('2d');
    const bg = oc.createLinearGradient(0,0,0,this.canvas.height);
    bg.addColorStop(0,'#fffde7'); bg.addColorStop(1,'#fff9c4');
    oc.fillStyle = bg; oc.fillRect(0,0,this.canvas.width,this.canvas.height);
    Audio.playPop();
  }

  _launchFireworks() {
    const W = this.canvas.width, H = this.canvas.height;
    const cols = ['#e53935','#fdd835','#43a047','#1e88e5','#8e24aa','#ff69b4','#00e5ff'];
    for (let f = 0; f < 5; f++) {
      const cx = W * (0.1 + Math.random() * 0.8);
      const cy = H * (0.1 + Math.random() * 0.5);
      const col = cols[Math.floor(Math.random()*cols.length)];
      for (let i = 0; i < 24; i++) {
        const a = (Math.PI*2*i)/24;
        const spd = 120 + Math.random()*160;
        this.fireworks.push({ x:cx, y:cy, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd-40, color:col, r:4+Math.random()*5, life:0.9+Math.random()*0.4 });
      }
    }
    Audio.playSuccess();
  }

  _paint(x, y) {
    const oc = this._offscreen.getContext('2d');
    oc.strokeStyle = this.color;
    oc.lineWidth   = this.brushSize;
    oc.lineCap     = 'round';
    oc.lineJoin    = 'round';
    if (this.drawing) {
      oc.beginPath(); oc.moveTo(this.lastX, this.lastY); oc.lineTo(x, y); oc.stroke();
    } else {
      oc.beginPath(); oc.arc(x, y, this.brushSize/2, 0, Math.PI*2); oc.fillStyle = this.color; oc.fill();
    }
    this.lastX = x; this.lastY = y; this.drawing = true;
    this.strokes++;
    if (this.strokes === 30) Audio.speak("Looking amazing!", { rate: 0.9 });
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _mouseDown(e) { const p = this._getPos(e); this.drawing = false; this._paint(p.x, p.y); }
  _mouseMove(e) { if (e.buttons) this._paint(this._getPos(e).x, this._getPos(e).y); }
  _mouseUp()    { this.drawing = false; }

  _touchStart(e) { e.preventDefault(); const r=this.canvas.getBoundingClientRect(),t=e.touches[0]; this.drawing=false; this._paint(t.clientX-r.left,t.clientY-r.top); }
  _touchMove(e)  { e.preventDefault(); const r=this.canvas.getBoundingClientRect(),t=e.touches[0]; this._paint(t.clientX-r.left,t.clientY-r.top); }
  _touchEnd()    { this.drawing = false; }

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs)/1000, 0.05);
    this._lastTs = ts;
    for (let i = this.fireworks.length-1; i >= 0; i--) {
      const f = this.fireworks[i];
      f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=180*dt; f.life-=dt;
      if (f.life<=0) this.fireworks.splice(i,1);
    }
    this._render();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.drawImage(this._offscreen, 0, 0);
    for (const f of this.fireworks) {
      ctx.globalAlpha = Math.max(0, f.life/1.3);
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1,f.r*(f.life/1.3)), 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
