// ===== BUTTON BLAST =====
// Cute PS-button shaped enemies roam the arena.
// Walk up to one and press the matching button to POP it!
// Clear all enemies to win. Multiple rounds with growing difficulty.
//
// Keyboard:  Arrow keys / WASD = move     T = Triangle  C = Circle  Q = Square  X/Space = Cross
// Gamepad:   D-pad / Left stick = move     △ ○ □ ✕ face buttons = pop
// Touch:     On-screen D-pad (bottom left) + face buttons (bottom right)

class ButtonBlastGame {

  // ---- Static data ----

  static BUTTON_TYPES = ['triangle', 'circle', 'square', 'cross'];

  static BEHAVIORS = ['still', 'wander', 'patrol', 'bounce', 'zigzag', 'orbit'];

  static BUTTON_COLORS = {
    triangle: { fill: '#43a047', outline: '#1b5e20', label: '△', key: 'T' },
    circle:   { fill: '#e53935', outline: '#b71c1c', label: '○', key: 'C' },
    square:   { fill: '#8e24aa', outline: '#4a148c', label: '□', key: 'Q' },
    cross:    { fill: '#1e88e5', outline: '#0d47a1', label: '✕', key: 'X' },
  };

  // Each round: count = # enemies, behaviors = assigned movement types (extras randomised),
  // speedMul = multiplier on base enemy speed
  static ROUNDS = [
    { count: 3,  behaviors: ['still','still','still'],                               speedMul: 0.10 },
    { count: 4,  behaviors: ['still','still','still','wander'],                      speedMul: 0.12 },
    { count: 5,  behaviors: ['still','still','wander','wander','patrol'],            speedMul: 0.15 },
    { count: 6,  behaviors: ['still','wander','wander','patrol','patrol','bounce'],  speedMul: 0.18 },
    { count: 7,  behaviors: ['wander','wander','patrol','patrol','bounce','bounce','zigzag'], speedMul: 0.22 },
    { count: 8,  behaviors: ['wander','patrol','bounce','bounce','zigzag','zigzag','orbit','wander'], speedMul: 0.27 },
    { count: 9,  behaviors: [],                                                       speedMul: 0.32 },
    { count: 10, behaviors: [],                                                       speedMul: 0.38 },
    { count: 12, behaviors: [],                                                       speedMul: 0.44 },
    { count: 12, behaviors: [],                                                       speedMul: 0.50 }, // endless loop from here
  ];

  // ---- Constructor ----

  constructor(canvas, ctx, onComplete) {
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.onComplete = onComplete;

    this._running   = false;
    this._raf       = null;
    this._lastTs    = 0;

    // Hero
    this.hero = {
      x: 0, y: 0,
      speed: 210, // px/s
      dir: 'down',
      animFrame: 0,
      animTimer: 0,
    };

    // Game objects
    this.enemies   = [];
    this.particles = [];
    this.flashes   = [];   // screen flash effects [{x,y,r,alpha,color}]
    this.floatTexts = [];  // floating "+POP!" labels [{x,y,vy,alpha,text,color}]
    this.round     = 0;
    this.popCount  = 0;

    // Input – keyboard
    this.keys = {};

    // Input – on-screen D-pad state (set by UI buttons)
    this._dpad = { up: false, down: false, left: false, right: false };

    // Input – action button debounce
    this._btnLock = {}; // type → true means already handled this press

    // Gamepad rising-edge tracking
    this._gpPrev = {};

    // Game state
    this.state      = 'playing'; // 'playing' | 'round-clear' | 'done'
    this.stateTimer = 0;

    // The enemy the hero is currently close enough to pop
    this.nearEnemy = null;

    // Bound handlers (for add/removeEventListener)
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp   = this._handleKeyUp.bind(this);

    // DOM UI element
    this._uiEl = null;
  }

  // ---- Public API ----

  start(roundIndex = 0) {
    this.round    = roundIndex;
    this._running = true;
    this.state    = 'playing';

    // Place hero in centre
    this.hero.x = this.canvas.width  / 2;
    this.hero.y = this.canvas.height / 2;

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup',   this._onKeyUp);

    this._buildUI();

    App.setHUDTitle('Button Blast!');
    Audio.speak(
      "Pop the button enemies! Walk up to one and press the matching button!",
      { rate: 0.9 }
    );

    this._spawnRound();
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup',   this._onKeyUp);
    if (this._uiEl) { this._uiEl.remove(); this._uiEl = null; }
  }

  // ---- Round spawning ----

  _spawnRound() {
    const def = ButtonBlastGame.ROUNDS[Math.min(this.round, ButtonBlastGame.ROUNDS.length - 1)];
    const count = def.count;

    // Build behaviour list: start with predefined, fill rest randomly
    const behaviors = [...def.behaviors];
    const allB = ButtonBlastGame.BEHAVIORS;
    while (behaviors.length < count) {
      behaviors.push(allB[Math.floor(Math.random() * allB.length)]);
    }
    // Shuffle
    for (let i = behaviors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [behaviors[i], behaviors[j]] = [behaviors[j], behaviors[i]];
    }

    const margin = 80;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const UI_BAND = 110; // bottom UI area height

    this.enemies   = [];
    this.particles = [];
    this.popCount  = 0;
    this.state     = 'playing';

    for (let i = 0; i < count; i++) {
      const type     = ButtonBlastGame.BUTTON_TYPES[Math.floor(Math.random() * 4)];
      const behavior = behaviors[i];
      const baseSpd  = 55 + Math.random() * 40;
      const speed    = baseSpd * def.speedMul;

      // Avoid spawning on top of hero
      let x, y, attempts = 0;
      do {
        x = margin + Math.random() * (W - margin * 2);
        y = margin + Math.random() * (H - margin * 2 - UI_BAND);
        attempts++;
      } while (Math.hypot(x - this.hero.x, y - this.hero.y) < 130 && attempts < 25);

      // Starting velocity for wander/bounce/zigzag
      const angle = Math.random() * Math.PI * 2;

      this.enemies.push({
        id:       i,
        type,
        behavior,
        x, y,
        r:        30,      // collision/draw radius
        speed,
        // Movement sub-state
        vx:       Math.cos(angle) * speed,
        vy:       Math.sin(angle) * speed,
        patrolOriX: x,
        patrolDist: 80 + Math.random() * 100,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitRadius: 65 + Math.random() * 65,
        orbitCX: x, orbitCY: y,
        wanderTimer: 0,
        patrolDir: 1,
        zigSpeed: speed * (Math.random() < 0.5 ? 1 : -1),
        zigTimer: 0,
        // Animation
        phase:    Math.random() * Math.PI * 2,
        wobble:   0,
        wobbleTimer: 0,
        // Status
        alive:    true,
        popping:  false,
        popTimer: 0,
        popScale: 1,
      });
    }

    App.updateHUDScore(0);

    if (this.round > 0) {
      Audio.speak(`Round ${this.round + 1}! Pop 'em all!`, { rate: 1.0, interrupt: true });
    }
  }

  // ---- Game loop ----

  _loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.05);
    this._lastTs = ts;

    this._pollGamepad();
    this._update(dt);
    this._render();

    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    // Round-clear pause
    if (this.state === 'round-clear') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.round++;
        if (this.round >= ButtonBlastGame.ROUNDS.length) {
          this._onVictory();
        } else {
          this._spawnRound();
        }
      }
      return;
    }

    if (this.state !== 'playing') return;

    // ---- Hero movement ----
    let mx = 0, my = 0;
    if (this.keys['ArrowLeft']  || this.keys['a'] || this.keys['A'] || this._dpad.left)  mx -= 1;
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D'] || this._dpad.right) mx += 1;
    if (this.keys['ArrowUp']    || this.keys['w'] || this.keys['W'] || this._dpad.up)    my -= 1;
    if (this.keys['ArrowDown']  || this.keys['s'] || this.keys['S'] || this._dpad.down)  my += 1;

    // Normalise diagonal
    if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }

    this.hero.x += mx * this.hero.speed * dt;
    this.hero.y += my * this.hero.speed * dt;

    // Clamp hero to safe area
    const HM    = 24;
    const UI_H  = 110;
    this.hero.x = Math.max(HM, Math.min(this.canvas.width  - HM, this.hero.x));
    this.hero.y = Math.max(HM + 44, Math.min(this.canvas.height - UI_H - HM, this.hero.y));

    // Update facing direction
    if      (mx < 0) this.hero.dir = 'left';
    else if (mx > 0) this.hero.dir = 'right';
    else if (my < 0) this.hero.dir = 'up';
    else if (my > 0) this.hero.dir = 'down';

    // Walk cycle
    if (mx !== 0 || my !== 0) {
      this.hero.animTimer += dt;
      if (this.hero.animTimer > 0.13) {
        this.hero.animFrame = (this.hero.animFrame + 1) % 4;
        this.hero.animTimer = 0;
      }
    } else {
      this.hero.animFrame = 0;
    }

    // ---- Enemies ----
    const W = this.canvas.width;
    const H = this.canvas.height - UI_H;

    let nearEnemy = null;
    let nearDist  = Infinity;

    for (const e of this.enemies) {
      // Pop animation settling
      if (e.popping) {
        e.popTimer -= dt;
        e.popScale += dt * 3;
        if (e.popTimer <= 0) e.alive = false;
        continue;
      }
      if (!e.alive) continue;

      // Idle bobble
      e.wobbleTimer += dt;
      e.wobble = Math.sin(e.wobbleTimer * 2.2 + e.phase) * 2.5;

      // Movement
      this._moveEnemy(e, dt, W, H);

      // Wall bounce clamping
      const pad = e.r + 10;
      if (e.x < pad)      { e.x = pad;      if (e.vx < 0) e.vx = Math.abs(e.vx); }
      if (e.x > W - pad)  { e.x = W - pad;  if (e.vx > 0) e.vx = -Math.abs(e.vx); }
      if (e.y < pad + 44) { e.y = pad + 44; if (e.vy < 0) e.vy = Math.abs(e.vy); }
      if (e.y > H - pad)  { e.y = H - pad;  if (e.vy > 0) e.vy = -Math.abs(e.vy); }

      // Proximity to hero
      const dist = Math.hypot(e.x - this.hero.x, e.y - this.hero.y);
      if (dist < e.r + 55 && dist < nearDist) {
        nearDist  = dist;
        nearEnemy = e;
      }
    }

    this.nearEnemy = nearEnemy;

    // ---- Particles ----
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 220 * dt;  // gravity
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // ---- Flash rings ----
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.r     += (f.maxR - f.r) * dt * 8;
      f.alpha -= dt * 3.5;
      if (f.alpha <= 0) this.flashes.splice(i, 1);
    }

    // ---- Floating texts ----
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const t = this.floatTexts[i];
      t.y    += t.vy * dt;
      t.vy   *= 0.92;
      t.life -= dt;
      t.alpha = Math.max(0, t.life / 0.9);
      if (t.life <= 0) this.floatTexts.splice(i, 1);
    }

    // ---- Check action button press ----
    this._checkPop();
  }

  _moveEnemy(e, dt, W, H) {
    switch (e.behavior) {
      case 'still':
        // Stationary — just wobble handled above
        break;

      case 'wander':
        e.wanderTimer -= dt;
        if (e.wanderTimer <= 0) {
          const a = Math.random() * Math.PI * 2;
          e.vx = Math.cos(a) * e.speed;
          e.vy = Math.sin(a) * e.speed;
          e.wanderTimer = 1.0 + Math.random() * 1.5;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        break;

      case 'patrol':
        // Horizontal back-and-forth
        e.x += e.speed * e.patrolDir * dt;
        if (Math.abs(e.x - e.patrolOriX) > e.patrolDist) {
          e.patrolDir *= -1;
        }
        break;

      case 'bounce':
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        break;

      case 'zigzag':
        e.zigTimer += dt;
        e.x += e.zigSpeed * dt;
        e.y += Math.sin(e.zigTimer * 2.8) * e.speed * 0.65 * dt;
        if (e.x > W - 60 || e.x < 60) e.zigSpeed *= -1;
        break;

      case 'orbit':
        e.orbitAngle += (e.speed / e.orbitRadius) * dt;
        e.x = e.orbitCX + Math.cos(e.orbitAngle) * e.orbitRadius;
        e.y = e.orbitCY + Math.sin(e.orbitAngle) * e.orbitRadius;
        break;
    }
  }

  // ---- Pop logic ----

  _checkPop() {
    // Determine which action button is freshly pressed this frame
    let pressedType = null;
    if (this._isFreshPress('triangle')) pressedType = 'triangle';
    else if (this._isFreshPress('circle'))   pressedType = 'circle';
    else if (this._isFreshPress('square'))   pressedType = 'square';
    else if (this._isFreshPress('cross'))    pressedType = 'cross';

    if (!pressedType) return;

    if (!this.nearEnemy || !this.nearEnemy.alive || this.nearEnemy.popping) {
      // Pressed a button but nothing nearby — no feedback
      return;
    }

    if (this.nearEnemy.type === pressedType) {
      this._popEnemy(this.nearEnemy);
    } else {
      // Wrong button
      Audio.playWrong();
      // Visual shake — done by _btnLock already
    }
  }

  _isFreshPress(type) {
    // Returns true only on the first frame a key/button is detected as down
    if (this._btnLock[type]) return false;

    let down = false;
    switch (type) {
      case 'triangle': down = !!(this.keys['t'] || this.keys['T'] || this._gpButtons?.triangle); break;
      case 'circle':   down = !!(this.keys['c'] || this.keys['C'] || this._gpButtons?.circle);   break;
      case 'square':   down = !!(this.keys['q'] || this.keys['Q'] || this._gpButtons?.square);   break;
      case 'cross':    down = !!(this.keys['x'] || this.keys['X'] || this.keys[' '] || this._gpButtons?.cross); break;
    }

    if (down) {
      // Lock this type for 300ms to avoid repeat-fire while key is held
      this._btnLock[type] = true;
      setTimeout(() => { this._btnLock[type] = false; }, 300);
      return true;
    }
    return false;
  }

  _popEnemy(e) {
    e.popping  = true;
    e.popTimer = 0.5;
    e.popScale = 1;

    const col = ButtonBlastGame.BUTTON_COLORS[e.type];

    // 1. Confetti burst — many small colourful pieces
    const confettiColors = [col.fill, '#ffd700', '#ffffff', '#ff69b4', '#00e5ff'];
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 80 + Math.random() * 200;
      this.particles.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 100,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        r: 4 + Math.random() * 7,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        star: Math.random() > 0.5, // half particles are star-shaped
      });
    }

    // 2. Bright flash ring at pop position
    this.flashes.push({ x: e.x, y: e.y, r: e.r, maxR: e.r * 5, alpha: 1, color: col.fill });

    // 3. Floating "POP!" text
    const popWords = ['POP!', 'BOOM!', 'YAY!', 'WOW!', '⭐'];
    this.floatTexts.push({
      x: e.x, y: e.y - e.r - 10,
      vy: -90,
      alpha: 1,
      text: popWords[Math.floor(Math.random() * popWords.length)],
      color: col.fill,
      life: 0.9,
    });

    Audio.playSuccess();
    this.popCount++;
    App.updateHUDScore(this.popCount);

    const exclaims = ['Pop!', 'Boom!', 'Nice!', 'Yay!', 'Got it!', 'Great!', 'Woohoo!'];
    const msg = exclaims[Math.floor(Math.random() * exclaims.length)];
    const name = { triangle: 'Triangle', circle: 'Circle', square: 'Square', cross: 'Cross' }[e.type];
    Audio.speak(`${msg} ${name}!`, { rate: 1.1, interrupt: true });

    // Check win after pop animation settles
    setTimeout(() => {
      if (this.state !== 'playing') return;
      const remaining = this.enemies.filter(en => en.alive && !en.popping).length;
      if (remaining === 0) {
        const isLast = this.round >= ButtonBlastGame.ROUNDS.length - 1;
        if (isLast) {
          this._onVictory();
        } else {
          this.state      = 'round-clear';
          this.stateTimer = 2.8;
          Audio.speak('Round clear! Amazing! Get ready!', { interrupt: true });
        }
      }
    }, 550);
  }

  _onVictory() {
    if (this.state === 'done') return;
    this.state = 'done';
    Audio.speak(
      "You did it! All button enemies are gone! You're a superstar!",
      { rate: 0.9, interrupt: true }
    );
    setTimeout(() => { this.onComplete(3); }, 2800);
  }

  // ---- Gamepad polling (ButtonBlast owns its own controller handling) ----

  _gpButtons = { triangle: false, circle: false, square: false, cross: false };

  _pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;

      // D-pad movement
      this._dpad.up    = !!(pad.buttons[12]?.pressed);
      this._dpad.down  = !!(pad.buttons[13]?.pressed);
      this._dpad.left  = !!(pad.buttons[14]?.pressed);
      this._dpad.right = !!(pad.buttons[15]?.pressed);

      // Left stick also drives movement
      const DEAD = 0.22;
      if (!this._dpad.left  && !this._dpad.right) {
        this._dpad.left  = (pad.axes[0] ?? 0) < -DEAD;
        this._dpad.right = (pad.axes[0] ?? 0) >  DEAD;
      }
      if (!this._dpad.up && !this._dpad.down) {
        this._dpad.up   = (pad.axes[1] ?? 0) < -DEAD;
        this._dpad.down = (pad.axes[1] ?? 0) >  DEAD;
      }

      // Face buttons — rising edge only (so held buttons don't fire every frame)
      this._gpButtons.cross    = this._risingEdge(pad, 0, 'gp0');
      this._gpButtons.circle   = this._risingEdge(pad, 1, 'gp1');
      this._gpButtons.square   = this._risingEdge(pad, 2, 'gp2');
      this._gpButtons.triangle = this._risingEdge(pad, 3, 'gp3');

      // Options/Start → home
      if (this._risingEdge(pad, 9, 'gp9') || this._risingEdge(pad, 8, 'gp8')) {
        App.showScreen('map');
        return;
      }
      // Circle → back to map
      // (handled via _gpButtons.circle → wrong button, not back — use a separate check)
    }
  }

  _risingEdge(pad, idx, key) {
    const cur  = pad.buttons[idx]?.pressed ?? false;
    const prev = this._gpPrev[key] ?? false;
    this._gpPrev[key] = cur;
    return cur && !prev;
  }

  // ---- Input event handlers ----

  _handleKeyDown(e) {
    this.keys[e.key] = true;
    // Prevent arrow keys scrolling the page
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
      e.preventDefault();
    }
  }

  _handleKeyUp(e) {
    this.keys[e.key] = false;
  }

  // ---- On-screen UI ----

  _buildUI() {
    if (this._uiEl) this._uiEl.remove();

    const ui = document.createElement('div');
    ui.id = 'bb-ui';
    ui.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 110px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px 8px;
      pointer-events: none;
      z-index: 1000;
    `;

    ui.appendChild(this._buildDpad());
    ui.appendChild(this._buildFaceButtons());

    document.body.appendChild(ui);
    this._uiEl = ui;
  }

  _buildDpad() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:108px;height:108px;pointer-events:all;';

    const dBtns = [
      { id:'up',    sym:'▲', top:'0',    left:'36px' },
      { id:'down',  sym:'▼', top:'72px', left:'36px' },
      { id:'left',  sym:'◀', top:'36px', left:'0'    },
      { id:'right', sym:'▶', top:'36px', left:'72px' },
    ];
    for (const d of dBtns) {
      const btn = document.createElement('div');
      btn.style.cssText = `
        position:absolute; top:${d.top}; left:${d.left};
        width:36px; height:36px;
        background:rgba(255,255,255,0.22);
        border:2px solid rgba(255,255,255,0.4);
        border-radius:7px;
        display:flex;align-items:center;justify-content:center;
        font-size:17px;color:white;
        user-select:none;touch-action:none;
      `;
      btn.textContent = d.sym;
      const set = (v) => { this._dpad[d.id] = v; };
      btn.addEventListener('touchstart', (ev) => { ev.preventDefault(); set(true);  }, { passive: false });
      btn.addEventListener('touchend',   (ev) => { ev.preventDefault(); set(false); }, { passive: false });
      btn.addEventListener('mousedown',  () => set(true));
      btn.addEventListener('mouseup',    () => set(false));
      btn.addEventListener('mouseleave', () => set(false));
      wrap.appendChild(btn);
    }
    return wrap;
  }

  _buildFaceButtons() {
    // PS layout: △ top-center, ○ right, □ left, ✕ bottom-center
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:108px;height:108px;pointer-events:all;';

    const fBtns = [
      { type:'triangle', sym:'△', color:'#43a047', top:'0',    left:'37px' },
      { type:'circle',   sym:'○', color:'#e53935', top:'37px', left:'74px' },
      { type:'square',   sym:'□', color:'#8e24aa', top:'37px', left:'0'    },
      { type:'cross',    sym:'✕', color:'#1e88e5', top:'74px', left:'37px' },
    ];
    for (const fb of fBtns) {
      const btn = document.createElement('div');
      btn.style.cssText = `
        position:absolute; top:${fb.top}; left:${fb.left};
        width:34px; height:34px;
        background:${fb.color};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;color:white;font-weight:bold;
        box-shadow:0 3px 8px rgba(0,0,0,0.4);
        user-select:none;touch-action:none;
      `;
      btn.textContent = fb.sym;

      const fire = (ev) => {
        if (ev) ev.preventDefault();
        // Trigger via _btnLock so it funnels through _isFreshPress
        if (this._btnLock[fb.type]) return;
        this._btnLock[fb.type] = true;
        setTimeout(() => { this._btnLock[fb.type] = false; }, 300);
        // Attempt pop immediately
        if (this.nearEnemy && this.nearEnemy.alive && !this.nearEnemy.popping) {
          if (this.nearEnemy.type === fb.type) {
            this._popEnemy(this.nearEnemy);
          } else {
            Audio.playWrong();
          }
        }
      };
      btn.addEventListener('touchstart', fire, { passive: false });
      btn.addEventListener('mousedown',  fire);
      wrap.appendChild(btn);
    }
    return wrap;
  }

  // ---- Rendering ----

  _render() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;

    // ── Background ──────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d1b3e');
    bg.addColorStop(1, '#1a1a4e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Flash rings ─────────────────────────────────────────────────────
    for (const f of this.flashes) {
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.strokeStyle = f.color;
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Particles ───────────────────────────────────────────────────────
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / (p.maxLife || 0.75));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.star) {
        this._drawStar(ctx, p.x, p.y, p.r * 0.5, p.r, 5);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.r * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ── Enemies ─────────────────────────────────────────────────────────
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this._drawEnemy(e);
    }

    // Proximity ring around the nearest enemy
    if (this.nearEnemy?.alive && !this.nearEnemy.popping) {
      const e   = this.nearEnemy;
      const col = ButtonBlastGame.BUTTON_COLORS[e.type];
      const pulse = 1 + Math.sin(Date.now() / 180) * 0.12;
      ctx.strokeStyle = col.fill + 'cc';
      ctx.lineWidth   = 3;
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, (e.r + 22) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Hero ────────────────────────────────────────────────────────────
    this._drawHero();

    // ── Button prompt above near enemy ──────────────────────────────────
    if (this.nearEnemy?.alive && !this.nearEnemy.popping) {
      this._drawPrompt(this.nearEnemy);
    }

    // ── Round-clear overlay ─────────────────────────────────────────────
    if (this.state === 'round-clear') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.11)}px "Fredoka One","Nunito",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ROUND CLEAR! 🎉', W / 2, H / 2 - 24);

      ctx.fillStyle = 'white';
      ctx.font = `${Math.floor(Math.min(W, H) * 0.055)}px "Fredoka One","Nunito",sans-serif`;
      ctx.fillText('Get ready for more!', W / 2, H / 2 + 30);
      ctx.textBaseline = 'alphabetic';
    }

    // ── Counter HUD ─────────────────────────────────────────────────────
    const alive = this.enemies.filter(e => e.alive && !e.popping).length;
    const total = this.enemies.length;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 90, 8, 180, 42, 10);
    ctx.fill();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px "Fredoka One","Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${total - alive} / ${total} popped`, W / 2, 29);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // ── Floating pop texts ───────────────────────────────────────────────
    for (const t of this.floatTexts) {
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle   = t.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth   = 4;
      ctx.font = `bold 34px "Fredoka One","Nunito",sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    // ── Keyboard hint (small, bottom-centre above UI) ────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '13px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('T=△  C=○  Q=□  X=✕   Move: Arrow Keys / WASD', W / 2, H - 118);
    ctx.textAlign = 'left';
  }

  // ── Star shape helper ────────────────────────────────────────────────
  _drawStar(ctx, cx, cy, innerR, outerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r     = i % 2 === 0 ? outerR : innerR;
      if (i === 0) ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      else         ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Draw one enemy shape ─────────────────────────────────────────────

  _drawEnemy(e) {
    const ctx = this.ctx;
    const col = ButtonBlastGame.BUTTON_COLORS[e.type];
    const r   = e.r;

    ctx.save();
    ctx.translate(e.x, e.y + e.wobble);

    if (e.popping) {
      const t = Math.max(0, e.popTimer / 0.45);
      ctx.globalAlpha = t;
      ctx.scale(e.popScale, e.popScale);
    }

    // Soft drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(3, r * 0.75, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (e.type) {

      case 'triangle': {
        const tip  = -r * 1.1;
        const base =  r * 0.95;
        const hw   =  r * 1.0;
        ctx.fillStyle   = col.fill;
        ctx.strokeStyle = col.outline;
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.moveTo(0, tip);
        ctx.lineTo( hw, base);
        ctx.lineTo(-hw, base);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.moveTo(0, tip + 10);
        ctx.lineTo(hw * 0.45, base - 14);
        ctx.lineTo(-hw * 0.45, base - 14);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'circle': {
        ctx.fillStyle   = col.fill;
        ctx.strokeStyle = col.outline;
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Ring
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.lineWidth   = r * 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'square': {
        const sq = r * 1.25;
        ctx.fillStyle   = col.fill;
        ctx.strokeStyle = col.outline;
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.roundRect(-sq, -sq, sq * 2, sq * 2, 9);
        ctx.fill(); ctx.stroke();
        // Inner hollow square
        const is = sq * 0.52;
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.roundRect(-is, -is, is * 2, is * 2, 5);
        ctx.fill();
        break;
      }

      case 'cross': {
        const arm = r * 0.42;
        const len = r * 1.1;
        ctx.fillStyle   = col.fill;
        ctx.strokeStyle = col.outline;
        ctx.lineWidth   = 3;
        // Vertical
        ctx.beginPath();
        ctx.roundRect(-arm, -len, arm * 2, len * 2, 7);
        ctx.fill(); ctx.stroke();
        // Horizontal
        ctx.beginPath();
        ctx.roundRect(-len, -arm, len * 2, arm * 2, 7);
        ctx.fill(); ctx.stroke();
        break;
      }
    }

    // Symbol label
    ctx.fillStyle     = 'rgba(255,255,255,0.92)';
    ctx.font          = `bold ${Math.floor(r * 0.72)}px "Fredoka One","Nunito",sans-serif`;
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    // Triangle symbol sits a bit lower in its shape
    const yOff = e.type === 'triangle' ? r * 0.12 : 0;
    ctx.fillText(col.label, 0, yOff);
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  // ── Draw hero character ──────────────────────────────────────────────

  _drawHero() {
    const ctx = this.ctx;
    const h   = this.hero;
    const bob = (h.animFrame === 1 || h.animFrame === 3) ? -2 : 0;

    ctx.save();
    ctx.translate(h.x, h.y + bob);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 24, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#3a5fc0';
    const legLift = h.animFrame % 2;
    ctx.fillRect(-12, 18, 10, 12 + (legLift ? 3 : 0));
    ctx.fillRect(  2, 18, 10, 12 + (legLift ? 0 : 3));

    // Shoes
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(-14, 29 + (legLift ? 3 : 0), 13, 5, 3);
    ctx.roundRect(  1, 29 + (legLift ? 0 : 3), 13, 5, 3);
    ctx.fill();

    // Body
    ctx.fillStyle = '#5c8df5';
    ctx.beginPath();
    ctx.roundRect(-14, -6, 28, 28, 6);
    ctx.fill();

    // Arms
    ctx.fillStyle = '#ffd5a8';
    const armSwL = h.animFrame < 2 ? -6 : 6;
    const armSwR = -armSwL;
    ctx.fillRect(-22, -2 + armSwL * 0.3, 8, 16);
    ctx.fillRect( 14, -2 + armSwR * 0.3, 8, 16);

    // Head
    ctx.fillStyle = '#ffd5a8';
    ctx.beginPath();
    ctx.arc(0, -20, 15, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#6d3a1a';
    ctx.beginPath();
    ctx.ellipse(0, -29, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const ex = h.dir === 'left' ? -3 : h.dir === 'right' ? 3 : 0;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-5 + ex, -21, 2.2, 0, Math.PI * 2);
    ctx.arc( 5 + ex, -21, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(-4 + ex, -22.5, 0.9, 0, Math.PI * 2);
    ctx.arc( 6 + ex, -22.5, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(ex, -16, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();
  }

  // ── Button prompt above near enemy ──────────────────────────────────

  _drawPrompt(e) {
    const ctx = this.ctx;
    const col = ButtonBlastGame.BUTTON_COLORS[e.type];

    // Blink at 5 Hz
    if (Math.floor(Date.now() / 100) % 2 === 0) return;

    const px = e.x;
    const py = e.y - e.r - 52;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.beginPath();
    ctx.roundRect(px - 56, py - 20, 112, 36, 10);
    ctx.fill();

    ctx.fillStyle = col.fill;
    ctx.font = 'bold 20px "Fredoka One","Nunito",sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Press ${col.label}! [${col.key}]`, px, py - 2);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}
