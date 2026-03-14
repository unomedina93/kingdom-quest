// ===== MOTION DETECTION MODULE =====
// Uses MediaPipe Hands for hand tracking
// Falls back gracefully to mouse/touch if camera unavailable

const Motion = {
  enabled: false,
  hands: null,
  camera: null,
  x: 0,    // Normalized 0-1 hand position
  y: 0,
  pixelX: 0,  // Screen pixel position
  pixelY: 0,
  velocity: 0,
  prevX: 0,
  prevY: 0,
  trail: [],   // Last N positions for slash detection
  MAX_TRAIL: 12,
  listeners: [],
  tapListeners: [],

  // Pinch-to-click state
  tapping: false,
  _lastTapTime: 0,

  async init() {
    // Check if MediaPipe is available (loaded from CDN)
    if (typeof Hands === 'undefined') {
      console.log('[Motion] MediaPipe not loaded — camera features disabled');
      return;
    }

    try {
      // Test camera access
      await navigator.mediaDevices.getUserMedia({ video: true });
      this._setup();
    } catch (err) {
      console.log('[Motion] Camera not available:', err.message);
      document.getElementById('toggle-camera').textContent = 'Camera Unavailable';
      document.getElementById('toggle-camera').disabled = true;
    }
  },

  async _setup() {
    const videoEl  = document.getElementById('camera-feed');
    const motionEl = document.getElementById('motion-canvas');

    // Setup MediaPipe Hands
    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults((results) => this._onResults(results));

    // Setup camera utility
    this.camera = new Camera(videoEl, {
      onFrame: async () => {
        if (this.enabled && this.hands) {
          await this.hands.send({ image: videoEl });
        }
      },
      width: 320, height: 240
    });

    console.log('[Motion] MediaPipe ready. Click "Enable Camera" to start.');
  },

  async toggle() {
    const btn        = document.getElementById('toggle-camera');
    const dot        = document.getElementById('status-camera');
    const statusRow  = document.getElementById('camera-status-row');
    const statusText = document.getElementById('camera-status-text');

    if (!this.enabled) {
      // Show "connecting" state
      if (dot) dot.textContent = '🟡';
      if (statusRow) statusRow.style.display = '';
      if (statusText) statusText.textContent = 'Connecting to camera...';

      if (!this.camera) {
        // MediaPipe not loaded (no internet or CDN blocked)
        if (dot) dot.textContent = '🔴';
        if (statusText) statusText.textContent = '❌ Motion library not loaded. Make sure you are connected to the internet on first launch, or use mouse/touch instead.';
        return;
      }

      try {
        await this.camera.start();
        this.enabled = true;
        document.getElementById('camera-feed').classList.add('visible');
        document.getElementById('hand-cursor').classList.add('visible');
        btn.textContent = '🟢 Disable Camera';
        btn.classList.add('active');
        if (dot) dot.textContent = '🟢';
        if (statusText) statusText.textContent = '✅ Camera connected! Wave your hand to control games.';
        Audio.speak("Motion control is on! Wave your hand to play!");
      } catch (err) {
        console.error('[Motion] Failed to start camera:', err);
        if (dot) dot.textContent = '🔴';
        let msg = '❌ Camera could not start. ';
        if (err.name === 'NotAllowedError') {
          msg += 'Permission was denied. Click the camera icon in your browser address bar and allow access, then try again.';
        } else if (err.name === 'NotFoundError') {
          msg += 'No camera found on this device.';
        } else if (err.name === 'NotReadableError') {
          msg += 'Camera is being used by another app. Close other apps and try again.';
        } else {
          msg += `Error: ${err.message}. Try refreshing the page.`;
        }
        if (statusText) statusText.textContent = msg;
        Audio.speak("Camera could not start. Check the status message in settings for details.");
      }
    } else {
      this.camera.stop();
      this.enabled = false;
      document.getElementById('camera-feed').classList.remove('visible');
      document.getElementById('hand-cursor').classList.remove('visible');
      btn.textContent = 'Enable Camera';
      btn.classList.remove('active');
      if (dot) dot.textContent = '⚫';
      if (statusText) statusText.textContent = 'Camera is off.';
    }
  },

  _onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.tapping = false;
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    // Index finger tip = landmark 8, Thumb tip = landmark 4
    const tip   = landmarks[8];
    const thumb = landmarks[4];

    // MediaPipe mirrors, so flip X
    const nx = 1 - tip.x;
    const ny = tip.y;

    this.prevX = this.pixelX;
    this.prevY = this.pixelY;

    this.x = nx;
    this.y = ny;
    this.pixelX = nx * window.innerWidth;
    this.pixelY = ny * window.innerHeight;

    // Update velocity (pixels per frame)
    const dx = this.pixelX - this.prevX;
    const dy = this.pixelY - this.prevY;
    this.velocity = Math.sqrt(dx * dx + dy * dy);

    // Update trail
    this.trail.push({ x: this.pixelX, y: this.pixelY, t: Date.now() });
    if (this.trail.length > this.MAX_TRAIL) this.trail.shift();

    // ---- Pinch-to-click: thumb tip + index tip coming together ----
    const pdx = tip.x - thumb.x;
    const pdy = tip.y - thumb.y;
    const pinchDist = Math.sqrt(pdx * pdx + pdy * pdy);
    const isPinching = pinchDist < 0.07; // normalized coords — ~7% of frame width

    const now = Date.now();
    if (isPinching && !this.tapping && (now - this._lastTapTime) > 600) {
      this.tapping      = true;
      this._lastTapTime = now;

      // Visual feedback: squeeze the cursor emoji
      const cursor = document.getElementById('hand-cursor');
      if (cursor) {
        cursor.textContent = '✊';
        cursor.style.transform = 'translate(-50%, -50%) scale(0.75)';
        setTimeout(() => {
          cursor.textContent = '👆';
          cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 250);
      }

      // Dispatch a real click event at hand position — works for both HTML
      // buttons and canvas elements that listen for 'click' with coordinates
      const target = document.elementFromPoint(this.pixelX, this.pixelY);
      if (target) {
        target.dispatchEvent(new MouseEvent('click', {
          bubbles: true, cancelable: true,
          clientX: this.pixelX, clientY: this.pixelY,
          view: window
        }));
      }

      // Notify any game-specific tap listeners
      this.tapListeners.forEach(fn => fn(this.pixelX, this.pixelY));

    } else if (!isPinching) {
      this.tapping = false;
    }

    // Move hand cursor
    const cursor = document.getElementById('hand-cursor');
    cursor.style.left = this.pixelX + 'px';
    cursor.style.top  = this.pixelY + 'px';

    // Notify move listeners
    this.listeners.forEach(fn => fn(this.pixelX, this.pixelY, this.velocity));
  },

  // Add a listener for hand position updates
  onMove(fn) { this.listeners.push(fn); },

  // Remove a listener
  offMove(fn) { this.listeners = this.listeners.filter(l => l !== fn); },

  // Add/remove a listener for pinch-click gestures
  onTap(fn)  { this.tapListeners.push(fn); },
  offTap(fn) { this.tapListeners = this.tapListeners.filter(l => l !== fn); },

  // Check if current trail constitutes a "slash" gesture
  // Returns { isSlash, p1, p2 } where p1/p2 are start/end of the slash
  getSlash() {
    if (this.trail.length < 3) return { isSlash: false };
    const recent = this.trail.slice(-6);
    const p1 = recent[0];
    const p2 = recent[recent.length - 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = p2.t - p1.t;
    const speed = dt > 0 ? dist / dt * 1000 : 0; // pixels per second
    return {
      isSlash: speed > 500 && dist > 60,
      p1, p2, speed, dist
    };
  },

  // Clear the trail (call after detecting a slash to prevent double-triggering)
  clearTrail() { this.trail = []; }
};
