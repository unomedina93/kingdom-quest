// ===== KINGDOM QUEST — GLOBAL GAMEPAD CONTROLLER =====
// PS5 DualSense / PS4 / Xbox via Web Gamepad API.
//
// Control scheme:
//   D-pad         → navigate menus, move characters in directional games
//   Left stick    → moves an on-screen cursor (mouse substitute for canvas games)
//   Cross / A (0) → confirm / click at cursor position
//   Circle / B (1)→ back
//   Square / X(2) → replay (on reward screen)
//   Options / Start (9) or Share (8) → home / map
//
// Button indices (standard gamepad):
//   0=Cross/A  1=Circle/B  2=Square/X  3=Triangle/Y
//   8=Share/Select  9=Options/Start
//   12=D-Up  13=D-Down  14=D-Left  15=D-Right

const GamepadCtrl = {

  // ---- state ----
  _raf:        null,
  _lastTs:     0,
  _cooldown:   {},       // per-key debounce: key → ms remaining
  _stickDir:   null,
  _stickTimer: 0,
  _seenPads:   new Set(), // pad indices we've already initialised

  // cursor (left stick mouse substitute)
  _cur: { x: 0, y: 0 },   // current cursor position
  _curEl: null,            // DOM element
  _curVisible: false,

  // map focus
  _mapFocus: 0,
  _mapZones: [],
  _mapCols:  3,

  // ---- init ----

  init() {
    window.addEventListener('gamepadconnected',    (e) => this._onConnect(e));
    window.addEventListener('gamepaddisconnected', (e) => this._onDisconnect(e));
    this._buildCursor();
    this._loop(0);
  },

  // ---- RAF loop ----

  _loop(ts) {
    const dt = Math.min(ts - this._lastTs, 80);
    this._lastTs = ts;

    // Decay debounce timers
    for (const k in this._cooldown) {
      this._cooldown[k] = Math.max(0, this._cooldown[k] - dt);
    }
    if (this._stickTimer > 0) this._stickTimer -= dt;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (pad) this._processPad(pad, dt);
    }

    this._raf = requestAnimationFrame((t) => this._loop(t));
  },

  // ---- process one pad ----

  _processPad(pad, dt) {
    // First time seeing this pad — put any already-held buttons on cooldown
    // so they don't fire actions immediately (prevents cancelling the narrator on startup)
    if (!this._seenPads.has(pad.index)) {
      this._seenPads.add(pad.index);
      pad.buttons.forEach((btn, i) => {
        if (btn.pressed) {
          this._cooldown[`btn_${pad.index}_${i}`] = 1500;
        }
      });
      return; // skip this frame entirely for this pad
    }

    // These games manage their own gamepad input — don't interfere
    if (App.currentScreen === 'game' && (
      App.currentGame instanceof CritterQuestGame ||
      App.currentGame instanceof ButtonBlastGame
    )) {
      this._hideCursor();
      return;
    }

    // ---- Left stick → move cursor ----
    const rx = pad.axes[0] ?? 0;
    const ry = pad.axes[1] ?? 0;
    const DEAD = 0.15;
    const SPEED = 10; // px per frame at full deflection

    if (Math.abs(rx) > DEAD || Math.abs(ry) > DEAD) {
      const mx = Math.abs(rx) > DEAD ? rx : 0;
      const my = Math.abs(ry) > DEAD ? ry : 0;
      this._cur.x = Math.max(0, Math.min(window.innerWidth  - 1, this._cur.x + mx * SPEED));
      this._cur.y = Math.max(0, Math.min(window.innerHeight - 1, this._cur.y + my * SPEED));
      this._showCursor();
      this._moveCursor(this._cur.x, this._cur.y);
    }

    // ---- D-pad → directional actions ----
    const dirs = [
      { btn: 12, dir: 'up'    },
      { btn: 13, dir: 'down'  },
      { btn: 14, dir: 'left'  },
      { btn: 15, dir: 'right' },
    ];
    for (const { btn, dir } of dirs) {
      if (this._pressed(pad, btn, 140)) {
        this._dispatch('dir', dir);
        return;
      }
    }

    // Right stick for D-pad-like navigation (optional comfort)
    const rax = pad.axes[2] ?? 0;
    const ray = pad.axes[3] ?? 0;
    const RS_THRESH = 0.6;
    let rsDir = null;
    if      (ray < -RS_THRESH) rsDir = 'up';
    else if (ray >  RS_THRESH) rsDir = 'down';
    else if (rax < -RS_THRESH) rsDir = 'left';
    else if (rax >  RS_THRESH) rsDir = 'right';
    if (rsDir && this._pressed(pad, `rs_${rsDir}`, 180)) {
      this._dispatch('dir', rsDir);
      return;
    }

    // ---- Face buttons ----
    if (this._pressed(pad, 0, 250)) this._dispatch('confirm');  // Cross / A
    if (this._pressed(pad, 1, 250)) this._dispatch('back');     // Circle / B
    if (this._pressed(pad, 2, 250)) this._dispatch('replay');   // Square / X
    if (this._pressed(pad, 9, 500)) this._dispatch('home');     // Options / Start
    if (this._pressed(pad, 8, 500)) this._dispatch('home');     // Share / Select
  },

  // Debounced button check — supports both numeric index and string pseudo-keys
  _pressed(pad, btnIdx, coolMs = 200) {
    const key = typeof btnIdx === 'string' ? `pseudo_${btnIdx}` : `btn_${pad.index}_${btnIdx}`;
    if (this._cooldown[key] > 0) return false;

    let pressed = false;
    if (typeof btnIdx === 'number') {
      pressed = pad.buttons[btnIdx]?.pressed ?? false;
    } else {
      // pseudo-key — caller already checked
      pressed = true;
    }
    if (!pressed) return false;

    this._cooldown[key] = coolMs;
    return true;
  },

  // ---- dispatch to active screen ----

  _dispatch(action, dir) {
    const screen = App.currentScreen;
    switch (screen) {
      case 'title':        return this._onTitle(action);
      case 'hero-select':  return this._onHeroSelect(action, dir);
      case 'map':          return this._onMap(action, dir);
      case 'game':         return this._onGame(action, dir);
      case 'reward':       return this._onReward(action);
      case 'story-select': return this._onStorySelect(action, dir);
      case 'adventure':    return this._onAdventure(action);
      case 'campaign':     return this._onCampaign(action);
      default: break;
    }
  },

  // ---- screen handlers ----

  _onTitle(action) {
    if (action === 'confirm' || action === 'home') {
      document.querySelector('#screen-title .btn-main')?.click();
    }
  },

  _onHeroSelect(action, dir) {
    // Always work within the currently visible step only
    const step = document.querySelector('.setup-step:not(.hidden)');
    if (!step) return;
    const cards = [...step.querySelectorAll('.hero-card')];

    if (action === 'dir' && (dir === 'left' || dir === 'right')) {
      if (!cards.length) return;

      let idx = cards.findIndex(c => c.classList.contains('gp-focus'));
      if (idx === -1) idx = 0;
      idx = dir === 'right'
        ? (idx + 1) % cards.length
        : (idx - 1 + cards.length) % cards.length;

      // Clear ALL hero-card focus across the document (removes stale focus from hidden steps)
      document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('gp-focus'));
      cards[idx].classList.add('gp-focus');
      cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (action === 'confirm') {
      // Only look within the visible step — never in hidden steps
      const focused = step.querySelector('.hero-card.gp-focus');
      if (focused) {
        focused.click();
        return;
      }
      // No card focused yet — auto-click first card in visible step
      if (cards.length) {
        cards[0].click();
        return;
      }
      // Name entry step — confirm the name
      step.querySelector('.btn-main')?.click();
    }

    if (action === 'back') App.showScreen('title');
  },

  _onMap(action, dir) {
    this._cacheMapZones();
    if (action === 'dir') {
      this._mapMove(dir);
    } else if (action === 'confirm') {
      this._mapZones[this._mapFocus]?.click();
    } else if (action === 'back' || action === 'home') {
      App.showScreen('title');
    }
  },

  _mapMove(dir) {
    const total = this._mapZones.length;
    if (!total) return;

    const COLS = this._mapCols;
    const lastIdx     = total - 1;
    const normalCount = total - 1; // all except the final full-width critter tile
    let idx = this._mapFocus;

    if (idx < normalCount) {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      if (dir === 'right') {
        idx = row * COLS + (col + 1) % COLS;
      } else if (dir === 'left') {
        idx = row * COLS + (col - 1 + COLS) % COLS;
      } else if (dir === 'down') {
        const next = idx + COLS;
        idx = next >= normalCount ? lastIdx : next;
      } else if (dir === 'up') {
        idx = idx - COLS >= 0 ? idx - COLS : idx;
      }
    } else {
      // On full-width bottom tile
      if (dir === 'up') idx = normalCount - 2; // middle of last normal row
    }

    idx = Math.max(0, Math.min(idx, total - 1));
    this._setMapFocus(idx);
  },

  _setMapFocus(idx) {
    this._mapFocus = idx;
    this._mapZones.forEach(z => z.classList.remove('gp-focus'));
    const zone = this._mapZones[idx];
    if (zone) {
      zone.classList.add('gp-focus');
      zone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  _cacheMapZones() {
    const zones = [...document.querySelectorAll('#screen-map .map-zone')];
    if (zones.length !== this._mapZones.length) {
      this._mapZones = zones;
      if (this._mapFocus >= this._mapZones.length) this._mapFocus = 0;
    }
  },

  _onGame(action, dir) {
    const game = App.currentGame;
    if (!game) return;

    if (action === 'confirm') {
      // X button = click at cursor position
      this._clickAtCursor();
      return;
    }
    if (action === 'dir') {
      // D-pad passes direction to directional games (maze, slicer, trace, etc.)
      if (typeof game.handleVoice === 'function') {
        game.handleVoice(dir.toUpperCase());
      }
      return;
    }
    if (action === 'back' || action === 'home') {
      App.showScreen('map');
    }
  },

  _onReward(action) {
    if (action === 'confirm' || action === 'home') App.showScreen('map');
    if (action === 'replay') App.replayGame();
    if (action === 'back')   App.showScreen('map');
  },

  _onStorySelect(action, dir) {
    if (action === 'dir') {
      const cards = [...document.querySelectorAll('#screen-story-select .story-card')];
      if (!cards.length) return;
      let idx = cards.findIndex(c => c.classList.contains('gp-focus'));
      if (idx === -1) idx = 0;
      if (dir === 'up')   idx = Math.max(0, idx - 1);
      if (dir === 'down') idx = Math.min(cards.length - 1, idx + 1);
      cards.forEach(c => c.classList.remove('gp-focus'));
      cards[idx].classList.add('gp-focus');
      cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (action === 'confirm') document.querySelector('.story-card.gp-focus')?.click();
    if (action === 'back' || action === 'home') App.showScreen('map');
  },

  _onAdventure(action) {
    if (action === 'confirm') document.getElementById('story-next-btn')?.click();
    if (action === 'back')    App.showScreen('story-select');
    if (action === 'home')    App.showScreen('map');
  },

  _onCampaign(action) {
    if (action === 'confirm') document.getElementById('campaign-next-btn')?.click();
    if (action === 'back' || action === 'home') App.showScreen('map');
  },

  // ---- cursor (left stick mouse) ----

  _buildCursor() {
    const el = document.createElement('div');
    el.id = 'gp-cursor';
    el.style.cssText = `
      position: fixed;
      width: 28px; height: 28px;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.9);
      background: rgba(255,220,50,0.35);
      box-shadow: 0 0 10px rgba(255,220,50,0.7), 0 0 3px rgba(0,0,0,0.6);
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      display: none;
      transition: none;
    `;
    // crosshair lines
    el.innerHTML = `
      <div style="position:absolute;left:50%;top:4px;transform:translateX(-50%);width:2px;height:calc(50%-6px);background:rgba(255,255,255,0.8)"></div>
      <div style="position:absolute;left:50%;bottom:4px;transform:translateX(-50%);width:2px;height:calc(50%-6px);background:rgba(255,255,255,0.8)"></div>
      <div style="position:absolute;top:50%;left:4px;transform:translateY(-50%);height:2px;width:calc(50%-6px);background:rgba(255,255,255,0.8)"></div>
      <div style="position:absolute;top:50%;right:4px;transform:translateY(-50%);height:2px;width:calc(50%-6px);background:rgba(255,255,255,0.8)"></div>
    `;
    document.body.appendChild(el);
    this._curEl = el;
    // Start cursor at screen center
    this._cur.x = window.innerWidth  / 2;
    this._cur.y = window.innerHeight / 2;
  },

  _showCursor() {
    if (!this._curVisible && this._curEl) {
      this._curEl.style.display = 'block';
      this._curVisible = true;
    }
  },

  _hideCursor() {
    if (this._curVisible && this._curEl) {
      this._curEl.style.display = 'none';
      this._curVisible = false;
    }
  },

  _moveCursor(x, y) {
    if (this._curEl) {
      this._curEl.style.left = x + 'px';
      this._curEl.style.top  = y + 'px';
    }
  },

  // Simulate a click at current cursor position — works on canvas and DOM elements
  _clickAtCursor() {
    const x = this._cur.x;
    const y = this._cur.y;

    // Find the element at this point
    const el = document.elementFromPoint(x, y);
    if (!el) return;

    // If it's the game canvas, fire a synthetic touch/click event so canvas games respond
    if (el.id === 'game-canvas') {
      const rect = el.getBoundingClientRect();
      // MouseEvent
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true,
        clientX: x, clientY: y,
      }));
      // Also touchstart for canvas games that listen to touch
      const touch = new Touch({
        identifier: Date.now(),
        target: el,
        clientX: x, clientY: y,
        screenX: x, screenY: y,
        pageX: x, pageY: y,
        radiusX: 1, radiusY: 1,
        rotationAngle: 0, force: 1,
      });
      el.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, cancelable: true,
        touches: [touch], targetTouches: [touch], changedTouches: [touch],
      }));
      // Flash cursor to give visual feedback
      this._flashCursor();
      return;
    }

    // DOM button / clickable element
    el.click();
    this._flashCursor();
  },

  _flashCursor() {
    if (!this._curEl) return;
    this._curEl.style.background = 'rgba(255,255,255,0.7)';
    setTimeout(() => {
      if (this._curEl) this._curEl.style.background = 'rgba(255,220,50,0.35)';
    }, 120);
  },

  // ---- connect / disconnect ----

  _onConnect(e) {
    console.log('[Gamepad] Connected:', e.gamepad.id);
    this._showToast('🎮 Controller connected!');
    this._cur.x = window.innerWidth  / 2;
    this._cur.y = window.innerHeight / 2;
    if (App.currentScreen === 'map') this.onMapShown();
  },

  _onDisconnect(e) {
    console.log('[Gamepad] Disconnected:', e.gamepad.id);
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if (!pads.length) {
      this._hideCursor();
      this._showToast('🎮 Controller disconnected');
    }
  },

  _showToast(msg) {
    let el = document.getElementById('gp-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gp-toast';
      el.style.cssText = `
        position: fixed; bottom: 18px; right: 18px;
        background: rgba(20,20,20,0.88);
        color: #fff;
        border-radius: 12px;
        padding: 8px 16px;
        font-family: 'Fredoka One', 'Nunito', sans-serif;
        font-size: 15px;
        z-index: 99998;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2800);
  },

  // Called by App._updateMap()
  onMapShown() {
    this._cacheMapZones();
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if (pads.length) this._setMapFocus(this._mapFocus);
  },
};
