// ===== MINI PIANO =====
// Colorful big piano keys! Tap to play notes. Free play + guided song mode.
// Uses Web Audio API for tones. Teaches music and color-number association.

class PianoGame {
  // C4 through C5 — 8 white keys
  static NOTES = [
    { note: 'C', freq: 261.63, color: '#e53935', label: 'Do' },
    { note: 'D', freq: 293.66, color: '#fb8c00', label: 'Re' },
    { note: 'E', freq: 329.63, color: '#fdd835', label: 'Mi' },
    { note: 'F', freq: 349.23, color: '#43a047', label: 'Fa' },
    { note: 'G', freq: 392.00, color: '#00acc1', label: 'Sol' },
    { note: 'A', freq: 440.00, color: '#1e88e5', label: 'La' },
    { note: 'B', freq: 493.88, color: '#8e24aa', label: 'Si' },
    { note: 'C5',freq: 523.25, color: '#e91e63', label: 'Do' },
  ];

  // Simple nursery rhymes as note sequences (indices into NOTES)
  static SONGS = [
    { name: 'Twinkle Twinkle', notes: [0,0,4,4,5,5,4, 3,3,2,2,1,1,0, 4,4,3,3,2,2,1, 4,4,3,3,2,2,1, 0,0,4,4,5,5,4, 3,3,2,2,1,1,0] },
    { name: 'Mary Had a Lamb', notes: [2,1,0,1,2,2,2, 1,1,1, 2,4,4, 2,1,0,1,2,2,2, 2,1,1,2,1,0] },
    { name: 'Hot Cross Buns',  notes: [2,1,0, 2,1,0, 0,0,0,0,1,1,1,1, 2,1,0] },
  ];

  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;
    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;

    this._audioCtx  = null;
    this.keys       = [];         // {x, y, w, h, noteIdx, pressed, glow}
    this.particles  = [];
    this.floatTexts = [];

    this.mode       = 'free';     // 'free' | 'song'
    this.song       = null;       // current song
    this.songStep   = 0;
    this.songTimer  = 0;
    this.songPlaying = false;

    this.strokes    = 0;
    this.songsDone  = 0;

    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchEnd   = this._onTouchEnd.bind(this);
    this._boundMouseDown  = this._onMouseDown.bind(this);
    this._boundMouseUp    = this._onMouseUp.bind(this);
  }

  start() {
    this._running = true;
    this.strokes  = 0;
    this.songsDone = 0;
    this.mode     = 'free';
    this.songPlaying = false;
    this.particles  = [];
    this.floatTexts = [];

    App.setHUDTitle('Mini Piano!');
    App.updateHUDScore(0);

    this._buildKeys();

    this.canvas.addEventListener('touchstart', this._boundTouchStart, { passive: false });
    this.canvas.addEventListener('touchend',   this._boundTouchEnd,   { passive: false });
    this.canvas.addEventListener('mousedown',  this._boundMouseDown);
    this.canvas.addEventListener('mouseup',    this._boundMouseUp);

    Audio.speak('Play the colorful piano! Tap any key!', { rate: 0.9 });
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._audioCtx) { this._audioCtx.close(); this._audioCtx = null; }
    this.canvas.removeEventListener('touchstart', this._boundTouchStart);
    this.canvas.removeEventListener('touchend',   this._boundTouchEnd);
    this.canvas.removeEventListener('mousedown',  this._boundMouseDown);
    this.canvas.removeEventListener('mouseup',    this._boundMouseUp);
  }

  _buildKeys() {
    const W = this.canvas.width, H = this.canvas.height;
    const n = PianoGame.NOTES.length;
    const keyW = Math.floor((W - 24) / n);
    const keyH = Math.min(H * 0.45, 220);
    const startY = H - keyH - 14;
    this.keys = PianoGame.NOTES.map((note, i) => ({
      x: 12 + i * keyW,
      y: startY,
      w: keyW - 4,
      h: keyH,
      noteIdx: i,
      pressed: false,
      glow: 0,
    }));

    // Song mode button position
    this._songBtn = { x: W/2, y: 52, w: 180, h: 44 };
    // Done button
    this._doneBtn = { x: W - 80, y: 52, w: 120, h: 44 };
  }

  _getAudioCtx() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._audioCtx;
  }

  _playNote(noteIdx, duration = 0.4) {
    const note = PianoGame.NOTES[noteIdx];
    try {
      const ac = this._getAudioCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, ac.currentTime);
      gain.gain.setValueAtTime(0.5, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + duration + 0.05);
    } catch (e) { /* audio context may be suspended */ }
  }

  _tapKey(noteIdx) {
    const key = this.keys[noteIdx];
    key.pressed = true; key.glow = 1;
    this._playNote(noteIdx);
    this.strokes++;
    App.updateHUDScore(this.strokes);

    // Particles
    const cx = key.x + key.w / 2, cy = key.y + key.h * 0.3;
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80,
        color: PianoGame.NOTES[noteIdx].color,
        r: 4 + Math.random() * 4, life: 0.6, maxLife: 0.6,
      });
    }

    // Float text with note name
    this.floatTexts.push({
      x: cx, y: key.y - 10,
      text: PianoGame.NOTES[noteIdx].label,
      color: PianoGame.NOTES[noteIdx].color,
      life: 0.8, maxLife: 0.8,
    });

    if (this.strokes === 10) Audio.speak('Beautiful music!', { rate: 0.9 });
    if (this.strokes === 30) Audio.speak('You are a great musician!', { rate: 0.9 });
  }

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.05);
    this._lastTs = ts;
    this._update(dt);
    this._render();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    // Key glow fade
    for (const k of this.keys) {
      if (k.glow > 0) k.glow -= dt * 4;
      if (!k.pressed) k.glow = Math.max(0, k.glow);
    }

    // Song playback
    if (this.songPlaying && this.song) {
      this.songTimer -= dt;
      if (this.songTimer <= 0) {
        if (this.songStep >= this.song.notes.length) {
          // Song done
          this.songPlaying = false;
          this.songsDone++;
          App.updateHUDScore(this.songsDone);
          Audio.speak('Beautiful! You played ' + this.song.name + '!', { rate: 0.9, interrupt: true });
          if (this.songsDone >= 3) {
            setTimeout(() => this.onComplete(3), 2000);
          }
        } else {
          const noteIdx = this.song.notes[this.songStep];
          this._tapKey(noteIdx);
          this.songStep++;
          this.songTimer = 0.38;
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Float texts
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const f = this.floatTexts[i];
      f.y -= 50 * dt; f.life -= dt;
      if (f.life <= 0) this.floatTexts.splice(i, 1);
    }
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0a2e'); bg.addColorStop(1, '#0d1b3e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Stars BG
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let s = 0; s < 30; s++) {
      const sx = (s * 97 % W), sy = (s * 43 % (H * 0.5));
      ctx.beginPath(); ctx.arc(sx, sy, 1 + (s % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // Title
    ctx.save();
    ctx.font = 'bold 28px "Fredoka One","Nunito",sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;
    ctx.fillText('🎹 Mini Piano', W / 2, 28);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Song mode button
    const sb = this._songBtn;
    ctx.save();
    ctx.fillStyle = this.songPlaying ? '#e53935' : '#43a047';
    ctx.shadowColor = this.songPlaying ? '#e53935' : '#43a047';
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(sb.x - sb.w/2, sb.y - sb.h/2, sb.w, sb.h, 14); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px "Fredoka One","Nunito",sans-serif';
    ctx.fillText(this.songPlaying ? '⏹ Stop Song' : '🎵 Play Song', sb.x, sb.y);
    ctx.restore();

    // Done button
    const db = this._doneBtn;
    ctx.save();
    ctx.fillStyle = '#1e88e5';
    ctx.shadowColor = '#1e88e5'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.roundRect(db.x - db.w/2, db.y - db.h/2, db.w, db.h, 14); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 15px "Fredoka One","Nunito",sans-serif';
    ctx.fillText('✅ Done!', db.x, db.y);
    ctx.restore();

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Float texts
    for (const f of this.floatTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.font = 'bold 22px "Fredoka One","Nunito",sans-serif';
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'white'; ctx.lineWidth = 3;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // Piano keys
    for (const k of this.keys) {
      const note = PianoGame.NOTES[k.noteIdx];
      const pressed = k.pressed;
      const glow = Math.max(0, k.glow);

      ctx.save();
      // Shadow/glow
      if (glow > 0) {
        ctx.shadowColor = note.color;
        ctx.shadowBlur = 20 * glow;
      }
      // Key body
      ctx.fillStyle = pressed ? 'white' : note.color;
      ctx.beginPath(); ctx.roundRect(k.x, k.y + (pressed ? 4 : 0), k.w, k.h, 8); ctx.fill();
      // Key shine
      if (!pressed) {
        const shine = ctx.createLinearGradient(k.x, k.y, k.x, k.y + k.h * 0.4);
        shine.addColorStop(0, 'rgba(255,255,255,0.35)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h * 0.45, [8, 8, 0, 0]); ctx.fill();
      }
      ctx.shadowBlur = 0;
      // Note label
      ctx.fillStyle = pressed ? note.color : 'white';
      ctx.font = `bold ${Math.floor(k.w * 0.35)}px "Fredoka One","Nunito",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(note.note, k.x + k.w / 2, k.y + k.h * 0.75 + (pressed ? 4 : 0));
      // Solfège below
      ctx.font = `bold ${Math.floor(k.w * 0.22)}px "Fredoka One","Nunito",sans-serif`;
      ctx.fillStyle = pressed ? note.color : 'rgba(255,255,255,0.7)';
      ctx.fillText(note.label, k.x + k.w / 2, k.y + k.h * 0.88 + (pressed ? 4 : 0));

      ctx.restore();

      // Reset pressed state (visual only — cleared after 1 frame)
      if (k.pressed) k.pressed = false;
    }

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  _hitKey(px, py) {
    for (const k of this.keys) {
      if (px >= k.x && px <= k.x + k.w && py >= k.y && py <= k.y + k.h) {
        this._tapKey(k.noteIdx);
        return true;
      }
    }

    // Song button
    const sb = this._songBtn;
    if (Math.abs(px - sb.x) < sb.w / 2 && Math.abs(py - sb.y) < sb.h / 2) {
      if (this.songPlaying) {
        this.songPlaying = false;
      } else {
        const idx = Math.floor(Math.random() * PianoGame.SONGS.length);
        this.song = PianoGame.SONGS[idx];
        this.songStep = 0; this.songTimer = 0;
        this.songPlaying = true;
        Audio.speak('Playing ' + this.song.name + '!', { rate: 0.9, interrupt: true });
      }
      return true;
    }

    // Done button
    const db = this._doneBtn;
    if (Math.abs(px - db.x) < db.w / 2 && Math.abs(py - db.y) < db.h / 2) {
      Audio.speak('What a great musician! Wonderful playing!', { rate: 0.9 });
      setTimeout(() => this.onComplete(3), 2000);
      return true;
    }

    return false;
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  _onMouseDown(e) { const p = this._getPos(e); this._hitKey(p.x, p.y); }
  _onMouseUp()    { /* nothing needed */ }

  _onTouchStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width / rect.width, sy = this.canvas.height / rect.height;
      this._hitKey((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
    }
  }

  _onTouchEnd(e) { e.preventDefault(); }
}
