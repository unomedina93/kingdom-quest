// ===== KINGDOM QUEST - MAIN APP =====
// App state machine: manages screens, games, progress

const App = {
  difficulty: 'easy',   // easy | medium | hard
  hero: 'leo',
  heroName: 'Hero',     // Child's actual name
  sidekick: '🐕',
  sidekickName: 'Buddy',
  stars: 0,
  completed: {},
  currentGame: null,
  lastGameName: null,
  voiceEnabled: false,
  voiceRecognition: null,

  HERO_EMOJIS: {
    leo:  '🧙‍♂️',
    ria:  '🧝‍♀️',
    sage: '🧙‍♂️'
  },

  init() {
    // Load saved progress
    this.stars       = parseInt(localStorage.getItem('kq_stars') || '0');
    this.completed   = JSON.parse(localStorage.getItem('kq_completed') || '{}');
    this.difficulty  = localStorage.getItem('kq_diff') || 'easy';
    this.hero        = localStorage.getItem('kq_hero') || 'leo';
    this.heroName    = localStorage.getItem('kq_heroname') || '';
    this.sidekick    = localStorage.getItem('kq_sidekick') || '🐕';
    this.sidekickName = localStorage.getItem('kq_sidekickname') || 'Buddy';

    // Set difficulty selector
    const diffEl = document.getElementById('setting-diff');
    if (diffEl) diffEl.value = this.difficulty;

    // Init audio
    Audio.init();

    // Init gamepad controller
    if (typeof GamepadCtrl !== 'undefined') GamepadCtrl.init();

    // Try to init motion
    Motion.init();

    // Resize canvas on window resize
    window.addEventListener('resize', () => {
      const canvas = document.getElementById('game-canvas');
      if (canvas && this.currentGame) {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });

    // Populate story list on first load
    this._buildStoryList();

    // Init voice commands (optional)
    this._initVoice();

    // Show title screen
    this.showScreen('title');

    // Welcome speech — deferred to first user interaction.
    // Chrome silently blocks speechSynthesis.speak() before a user gesture,
    // so we set a flag here and audio.js fires it inside the unlockAudio handler.
    this._pendingWelcome = true;
  },

  // ---- SCREEN MANAGEMENT ----

  showScreen(name) {
    // Stop any running game
    if (this.currentGame) {
      this.currentGame.stop();
      this.currentGame = null;
    }
    Audio.stopSpeech();

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Show target screen
    const el = document.getElementById(`screen-${name}`);
    if (!el) { console.error('Screen not found:', name); return; }
    el.classList.add('active');
    this.currentScreen = name; // tracked for voice commands

    // Screen-specific setup
    if (name === 'map')      this._updateMap();
    if (name === 'title')    this._onTitleShown();
    if (name === 'settings') this._onSettingsShown();
  },

  _onTitleShown() {
    // Nothing special needed — CSS handles animation
  },

  // ---- SETTINGS UI HELPERS ----

  _onSettingsShown() {
    this._populateSettingsUI();
  },

  _populateSettingsUI() {
    // Sliders
    const vol = document.getElementById('setting-vol');
    if (vol) vol.value = Audio.volume;
    const speed = document.getElementById('setting-speed');
    if (speed) speed.value = Audio.speechRate;

    // Difficulty
    const diff = document.getElementById('setting-diff');
    if (diff) diff.value = this.difficulty;

    // Voice dropdown — voices may not be loaded yet, retry until ready
    this._populateVoiceDropdown(0);

    // Music button
    this._updateMusicBtn();

    // Clear any old test status
    const testStatus = document.getElementById('voice-test-status');
    if (testStatus) { testStatus.style.display = 'none'; testStatus.textContent = ''; }
  },

  _populateVoiceDropdown(attempt) {
    const bv = document.getElementById('setting-browser-voice');
    if (!bv) return;

    // Force a fresh load from speechSynthesis
    Audio.allBrowserVoices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));

    if (!Audio.allBrowserVoices.length && attempt < 8) {
      // Voices not ready yet — retry
      setTimeout(() => this._populateVoiceDropdown(attempt + 1), 300);
      return;
    }

    if (!Audio.allBrowserVoices.length) {
      bv.innerHTML = '<option>No voices found — try reloading</option>';
      return;
    }

    // Re-pick best voice if none set
    if (!Audio.browserVoice) {
      Audio.browserVoice = Audio._pickBestBrowserVoice();
    }

    bv.innerHTML = Audio.allBrowserVoices
      .map(v => `<option value="${v.name}" ${v.name === Audio.browserVoice?.name ? 'selected' : ''}>${v.name}</option>`)
      .join('');
  },

  _updateVoiceSettingsUI() {
    // Kept for compatibility — no provider sections to toggle any more
  },

  _updateMusicBtn() {
    const btn = document.getElementById('toggle-music');
    if (!btn) return;
    const on = Audio.musicEnabled || localStorage.getItem('kq_music') === 'on';
    btn.textContent = on ? '🎵 Music On' : '🔇 Music Off';
    btn.classList.toggle('active', on);
  },

  _testVoiceSettings() {
    const statusEl = document.getElementById('voice-test-status');
    if (statusEl) { statusEl.style.display = ''; statusEl.textContent = '⏳ Testing…'; }
    Audio.testVoice((success, msg) => {
      if (statusEl) statusEl.textContent = msg;
    });
  },

  _updateMap() {
    // Update star count
    document.getElementById('map-star-count').textContent = this.stars;

    // Update hero icon
    document.getElementById('map-hero-icon').textContent = this.getHeroEmoji();

    // Notify gamepad controller that map is visible
    if (typeof GamepadCtrl !== 'undefined') GamepadCtrl.onMapShown();

    // Update completion badges
    const games = ['maze','slicer','number','trace','chase','color','puzzle','adventure','dots','match','shadow','spotdiff','gemsort','hidden','sequence','critter','buttonblast','balloonpop','shapesort','animaltap','fingerpaint','fishfeed','rocketlaunch','bubblepop','whackmole','fruitcatcher','piano','raingarden','lostsheep','starlight','butterflygarden','colordrop'];
    games.forEach(g => {
      const badge = document.getElementById(`badge-${g}`);
      if (badge) badge.textContent = this.completed[g] ? '⭐' : '';
    });
  },

  // ---- HERO SETUP (name → hero → sidekick) ----

  previewName(val) {
    document.getElementById('name-preview').textContent = val || 'Hero';
  },

  confirmName() {
    const input = document.getElementById('hero-name-input');
    const name  = input.value.trim() || 'Hero';
    this.heroName = name;
    localStorage.setItem('kq_heroname', name);

    // Move to hero selection step
    document.getElementById('setup-name').classList.add('hidden');
    document.getElementById('setup-hero').classList.remove('hidden');
    document.getElementById('name-in-hero').textContent = name;

    Audio.speak(`Hello, ${name}! Now choose your hero!`);
  },

  selectHero(heroId) {
    this.hero = heroId;
    localStorage.setItem('kq_hero', heroId);
    Audio.playBoing();

    // Move to sidekick selection
    document.getElementById('setup-hero').classList.add('hidden');
    document.getElementById('setup-sidekick').classList.remove('hidden');

    const heroLabel = heroId === 'leo' ? 'the brave Knight' : heroId === 'ria' ? 'the swift Warrior' : 'the wise Wizard';
    Audio.speak(`${heroLabel}! Wonderful choice, ${this.heroName}! Now choose a sidekick!`);
  },

  selectSidekick(id, emoji) {
    const names = { dog: 'Buddy', lion: 'Brave', owl: 'Wisdom' };
    this.sidekick     = emoji;
    this.sidekickName = names[id] || 'Buddy';
    localStorage.setItem('kq_sidekick', emoji);
    localStorage.setItem('kq_sidekickname', this.sidekickName);

    Audio.playSuccess();
    Audio.speak(`${this.sidekickName} joins your adventure, ${this.heroName}! Let the quest begin!`);
    setTimeout(() => this.showScreen('map'), 1200);
  },

  getHeroEmoji() {
    return this.HERO_EMOJIS[this.hero] || '🧙‍♂️';
  },

  // ---- GAME LAUNCHING ----

  startGame(gameName) {
    this.lastGameName = gameName;
    this.showScreen('game');

    const canvas = document.getElementById('game-canvas');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const onComplete = (stars = 3) => this.onGameComplete(gameName, stars);

    switch (gameName) {
      case 'maze':
        this.currentGame = new MazeGame(canvas, ctx, onComplete);
        this.currentGame.start(
          (this.completed['maze'] || 0) % MAZES.length
        );
        break;
      case 'slicer':
        this.currentGame = new SlicerGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'number':
        this.currentGame = new NumberMatchGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'trace':
        this.currentGame = new LetterTraceGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'chase':
        this.currentGame = new PathChaseGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'color':
        this.currentGame = new ColoringGame(canvas, ctx, onComplete);
        this.currentGame.start(
          (this.completed['color'] || 0) % COLORING_SCENES.length
        );
        break;
      case 'puzzle':
        this.currentGame = new PuzzleGame(canvas, ctx, onComplete);
        this.currentGame.start(
          (this.completed['puzzle'] || 0) % PUZZLE_SCENES.length
        );
        break;
      case 'dots':
        this.currentGame = new ConnectDotsGame(canvas, ctx, onComplete);
        this.currentGame.start(
          (this.completed['dots'] || 0) % DOT_SCENES.length
        );
        break;
      case 'match':
        this.currentGame = new MemoryMatchGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'shadow':
        this.currentGame = new ShadowMatchGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'spotdiff':
        this.currentGame = new SpotDiffGame(canvas, ctx, onComplete);
        this.currentGame.start(
          (this.completed['spotdiff'] || 0) % SPOT_DIFF_SCENES.length
        );
        break;
      case 'gemsort':
        this.currentGame = new GemSortGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'hidden':
        this.currentGame = new HiddenObjectGame(canvas, ctx, onComplete);
        this.currentGame.start(
          (this.completed['hidden'] || 0) % HIDDEN_SCENES.length
        );
        break;
      case 'sequence':
        this.currentGame = new SequenceGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'critter':
        this.currentGame = new CritterQuestGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'buttonblast':
        this.currentGame = new ButtonBlastGame(canvas, ctx, onComplete);
        this.currentGame.start(
          (this.completed['buttonblast'] || 0) % ButtonBlastGame.ROUNDS.length
        );
        break;
      case 'balloonpop':
        this.currentGame = new BalloonPopGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'shapesort':
        this.currentGame = new ShapeSortGame(canvas, ctx, onComplete);
        this.currentGame.start((this.completed['shapesort'] || 0) % 5);
        break;
      case 'animaltap':
        this.currentGame = new AnimalTapGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'fingerpaint':
        this.currentGame = new FingerPaintGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'fishfeed':
        this.currentGame = new FishFeedGame(canvas, ctx, onComplete);
        this.currentGame.start((this.completed['fishfeed'] || 0) % 4);
        break;
      case 'rocketlaunch':
        this.currentGame = new RocketLaunchGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'bubblepop':
        this.currentGame = new BubblePopGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'whackmole':
        this.currentGame = new WhackMoleGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'fruitcatcher':
        this.currentGame = new FruitCatcherGame(canvas, ctx, onComplete);
        this.currentGame.start((this.completed['fruitcatcher'] || 0) % 5);
        break;
      case 'piano':
        this.currentGame = new PianoGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'raingarden':
        this.currentGame = new RainGardenGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'lostsheep':
        this.currentGame = new LostSheepGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'starlight':
        this.currentGame = new StarLightGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'butterflygarden':
        this.currentGame = new ButterflyGardenGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      case 'colordrop':
        this.currentGame = new ColorDropGame(canvas, ctx, onComplete);
        this.currentGame.start();
        break;
      default:
        console.error('Unknown game:', gameName);
    }

    // Hide overlay
    this.hideOverlay();
  },

  // ---- ADVENTURE (Bible Stories) ----

  _buildStoryList() {
    const listEl = document.getElementById('story-list');
    if (!listEl) return;

    STORY_ORDER.forEach(id => {
      const story = STORIES[id];
      if (!story) return;

      const card = document.createElement('div');
      card.className = 'story-card';
      card.innerHTML = `
        <div class="story-card-icon">${story.icon}</div>
        <div class="story-card-info">
          <h3>${story.title}</h3>
          <p>${story.verse}</p>
        </div>
        <div class="story-card-stars">${this.completed['story_' + id] ? '⭐' : ''}</div>
      `;
      card.onclick = () => this._startAdventure(id);
      listEl.appendChild(card);
    });
  },

  _startAdventure(storyId) {
    this.lastGameName = 'adventure';
    this.showScreen('adventure');
    AdventureGame.start(storyId);
  },

  // ---- GAME COMPLETION ----

  onGameComplete(gameName, stars = 3) {
    // Save progress
    this.stars += stars;
    localStorage.setItem('kq_stars', this.stars);
    this.completed[gameName] = (this.completed[gameName] || 0) + 1;
    localStorage.setItem('kq_completed', JSON.stringify(this.completed));

    // Stop game
    if (this.currentGame) {
      this.currentGame.stop();
      this.currentGame = null;
    }

    // Show reward screen
    this._showReward(gameName, stars);
  },

  _showReward(gameName, stars) {
    // Hide all screens, show reward
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-reward').classList.add('active');
    // Track screen so GamepadCtrl routes to _onReward (not _onGame with null game)
    this.currentScreen = 'reward';

    // Populate reward content
    document.getElementById('reward-hero').textContent    = this.getHeroEmoji();
    document.getElementById('reward-stars').textContent   = '⭐'.repeat(stars);
    document.getElementById('reward-total-stars').textContent = this.stars;

    const msgs = CURRICULUM.rewards;
    document.getElementById('reward-msg').textContent = msgs[Math.floor(Math.random() * msgs.length)];

    const verses = CURRICULUM.verses;
    const verse  = verses[Math.floor(Math.random() * verses.length)];
    document.getElementById('reward-verse').textContent = `"${verse.text}" — ${verse.ref}`;

    // Confetti
    this._launchConfetti();

    // Sound
    Audio.playVictory();
    setTimeout(() => {
      const msg = document.getElementById('reward-msg').textContent;
      const v   = verse;
      Audio.speak(`${msg} The Bible says: ${v.text}`, { rate: 0.9 });
    }, 800);
  },

  replayGame() {
    if (this.lastGameName) {
      this.startGame(this.lastGameName);
    }
  },

  // ---- HUD HELPERS ----

  setHUDTitle(text) {
    const el = document.getElementById('hud-title');
    if (el) el.textContent = text;
  },

  updateHUDScore(score) {
    const el = document.getElementById('hud-score');
    if (el) el.textContent = `⭐ ${score}`;
  },

  updateHUDHearts(hearts) {
    const el = document.getElementById('hud-hearts');
    if (el) el.textContent = '❤️'.repeat(Math.max(0, hearts));
  },

  // ---- OVERLAY (in-game popups) ----

  showOverlay(emoji, text, btnText, onAction) {
    const overlay = document.getElementById('game-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    document.getElementById('overlay-emoji').textContent = emoji;
    document.getElementById('overlay-text').textContent  = text;
    const btn = document.getElementById('overlay-btn');
    btn.textContent = btnText;
    this._overlayAction = onAction;
  },

  hideOverlay() {
    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  overlayAction() {
    this.hideOverlay();
    if (this._overlayAction) {
      this._overlayAction();
      this._overlayAction = null;
    }
  },

  overlayNextLevel() {
    // Save stars for completing this round, then launch the same game at its next level
    const gameName = this.lastGameName;
    if (gameName && gameName !== 'adventure') {
      this.stars += 3;
      localStorage.setItem('kq_stars', this.stars);
      this.completed[gameName] = (this.completed[gameName] || 0) + 1;
      localStorage.setItem('kq_completed', JSON.stringify(this.completed));
    }
    this.hideOverlay();
    if (gameName) this.startGame(gameName);
  },

  overlayReplay() {
    // Restart the same game at the same level — no star save
    this.hideOverlay();
    if (this.lastGameName) this.startGame(this.lastGameName);
  },

  overlayHome() {
    this.hideOverlay();
    this.showScreen('map');
  },

  // ---- SETTINGS ----

  setDifficulty(val) {
    this.difficulty = val;
    localStorage.setItem('kq_diff', val);
  },

  resetProgress() {
    if (!confirm('Reset all stars and progress? Your hero will start fresh!')) return;
    this.stars     = 0;
    this.completed = {};
    localStorage.setItem('kq_stars', '0');
    localStorage.setItem('kq_completed', '{}');
    Audio.speak('Progress reset! Time for a new adventure!');
    this._updateMap();
  },

  // ---- VOICE COMMANDS ----
  // Uses Web Speech API SpeechRecognition (browser built-in)
  // Privacy note: In Chrome, recognized speech is processed by Google's servers.
  // Enabled only when parent explicitly turns it on in Settings.
  // Nothing is stored. No data is sent to any of our servers.

  _initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('[Voice] SpeechRecognition not supported in this browser');
      return;
    }
    this.voiceRecognition = new SpeechRecognition();
    this.voiceRecognition.continuous = true;
    this.voiceRecognition.interimResults = false;
    this.voiceRecognition.lang = 'en-US';

    this.voiceRecognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toUpperCase();
      console.log('[Voice]', transcript);
      this._handleVoiceCommand(transcript);
    };

    this.voiceRecognition.onerror = (e) => {
      if (e.error !== 'no-speech') console.log('[Voice] Error:', e.error);
    };

    // Chrome stops recognition after a while — auto-restart while voice is enabled
    this.voiceRecognition.onend = () => {
      if (this.voiceEnabled) {
        try { this.voiceRecognition.start(); } catch (e) {}
      }
    };
  },

  enableVoice() {
    const dot        = document.getElementById('status-voice');
    const statusRow  = document.getElementById('voice-status-row');
    const statusText = document.getElementById('voice-status-text');
    const btn        = document.getElementById('toggle-voice');

    if (statusRow) statusRow.style.display = '';

    if (!this.voiceRecognition) {
      if (dot) dot.textContent = '🔴';
      if (statusText) statusText.textContent = '❌ Voice commands are not supported in this browser. Try Google Chrome or Safari.';
      Audio.speak('Voice commands are not supported in this browser. Try Google Chrome!');
      return;
    }

    try {
      this.voiceEnabled = true;
      this.voiceRecognition.start();
      if (dot) dot.textContent = '🟢';
      if (statusText) statusText.textContent = `✅ Voice is on! Say "home", "back", a game name like "maze" or "memory", directions like "left" / "right", or a letter. (Note: Chrome sends audio to Google for recognition.)`;
      if (btn) { btn.textContent = '🎙️ Disable Voice'; btn.classList.add('active'); }
      Audio.speak(`Voice is on! Say home, back, a game name, or a direction to play!`);
    } catch (err) {
      if (dot) dot.textContent = '🔴';
      if (statusText) statusText.textContent = `❌ Could not start voice: ${err.message}. Make sure microphone permission is allowed.`;
      Audio.speak('Voice could not start. Check that your microphone is allowed in the browser.');
    }
  },

  disableVoice() {
    const dot        = document.getElementById('status-voice');
    const statusText = document.getElementById('voice-status-text');
    const btn        = document.getElementById('toggle-voice');

    this.voiceEnabled = false;
    if (this.voiceRecognition) this.voiceRecognition.stop();
    if (btn) { btn.textContent = 'Enable Voice'; btn.classList.remove('active'); }
    if (dot) dot.textContent = '⚫';
    if (statusText) statusText.textContent = 'Voice commands are off.';
  },

  // Helper: true if `word` appears as a whole word inside `text`
  _hasWord(text, word) {
    return text === word ||
      text.startsWith(word + ' ') ||
      text.endsWith(' ' + word) ||
      text.includes(' ' + word + ' ');
  },

  _handleVoiceCommand(text) {
    const has = (w) => this._hasWord(text, w);

    // ── 1. GLOBAL NAVIGATION ────────────────────────────────────────────
    // "home" / "go home" / "title"
    if (has('HOME') || has('TITLE')) {
      Audio.speak('Going home!');
      this.showScreen('title');
      return;
    }

    // "back" / "map" / "world map" / "quit" / "stop"
    if (has('BACK') || has('MAP') || has('QUIT') || has('STOP') || has('WORLD MAP')) {
      if (this.currentScreen === 'game' || this.currentScreen === 'adventure' ||
          this.currentScreen === 'campaign' || this.currentScreen === 'story-select') {
        Audio.speak('Back to the map!');
        this.showScreen('map');
      } else {
        this.showScreen('map');
      }
      return;
    }

    // "settings"
    if (has('SETTINGS') || has('SETTING')) {
      Audio.speak('Opening settings!');
      this.showScreen('settings');
      return;
    }

    // ── 2. STORY / CAMPAIGN PAGE NAVIGATION ─────────────────────────────
    if (has('NEXT') || has('CONTINUE') || text === 'GO' || has('GO ON')) {
      if (this.currentScreen === 'adventure') {
        document.getElementById('story-next-btn')?.click();
      } else if (this.currentScreen === 'campaign') {
        document.getElementById('campaign-next-btn')?.click();
      }
      return;
    }

    // ── 3. DIRECTIONAL COMMANDS ─────────────────────────────────────────
    // Accepts "up", "go up", "move up", "north", etc.
    let voiceDir = null;
    if (has('UP')    || has('NORTH')) voiceDir = 'UP';
    if (has('DOWN')  || has('SOUTH')) voiceDir = 'DOWN';
    if (has('LEFT')  || has('WEST'))  voiceDir = 'LEFT';
    if (has('RIGHT') || has('EAST'))  voiceDir = 'RIGHT';
    if (voiceDir) {
      if (this.currentGame && typeof this.currentGame.handleVoice === 'function') {
        this.currentGame.handleVoice(voiceDir);
      }
      return;
    }

    // ── 4. GAME LAUNCHING FROM ANY SCREEN ───────────────────────────────
    const GAME_TRIGGERS = [
      { words: ['FOREST MAZE', 'FOREST', 'MAZE'],              game: 'maze'    },
      { words: ['LETTER BATTLE', 'LETTER NINJA', 'NINJA', 'SLICER', 'SLICE'], game: 'slicer'  },
      { words: ['TREASURE COUNT', 'TREASURE', 'COUNTING', 'COUNT', 'NUMBERS'], game: 'number'  },
      { words: ['SCROLL WRITER', 'SCROLL', 'TRACE', 'WRITING', 'WRITE'],       game: 'trace'   },
      { words: ['CHASE THE THIEF', 'THIEF', 'CHASE', 'PATH CHASE'],            game: 'chase'   },
      { words: ['COLORING BOOK', 'COLORING', 'COLOR', 'PAINT'],                game: 'color'   },
      { words: ['BIBLE PUZZLE', 'PUZZLE', 'JIGSAW'],                           game: 'puzzle'  },
      { words: ['CONNECT THE DOTS', 'CONNECT DOTS', 'CONNECT', 'DOTS'],        game: 'dots'    },
      { words: ['MEMORY MATCH', 'MEMORY', 'MATCHING', 'CARDS'],                game: 'match'    },
      { words: ['SHADOW MATCH', 'SHADOW', 'SHADOWS', 'SILHOUETTE'],           game: 'shadow'   },
      { words: ['SPOT THE DIFFERENCE', 'SPOT DIFFERENCE', 'SPOT', 'DIFFERENCES'], game: 'spotdiff' },
      { words: ['GEM SORT', 'GEM', 'GEMS', 'SORT', 'SORTING', 'TREASURE SORT'], game: 'gemsort' },
      { words: ['HIDDEN OBJECT', 'HIDDEN', 'FIND IT', 'EXPLORER'],            game: 'hidden'   },
      { words: ['STORY ORDER', 'SEQUENCE', 'ORDER', 'WHAT COMES NEXT'],       game: 'sequence' },
      { words: ['CRITTER QUEST', 'CRITTER', 'CRITTERS', 'ADVENTURE MAP', 'OVERWORLD'], game: 'critter' },
      { words: ['BUTTON BLAST', 'BUTTON', 'BUTTONS', 'BLAST', 'ENEMIES'], game: 'buttonblast' },
      { words: ['BALLOON POP', 'BALLOON', 'BALLOONS', 'POP'], game: 'balloonpop' },
      { words: ['SHAPE SORT', 'SHAPES', 'SORT SHAPES'], game: 'shapesort' },
      { words: ['ANIMAL TAP', 'ANIMALS', 'ANIMAL'], game: 'animaltap' },
      { words: ['FINGER PAINT', 'PAINTING', 'DRAW', 'DRAWING'], game: 'fingerpaint' },
      { words: ['FISH FEED', 'FISH', 'FISHING', 'FEED'], game: 'fishfeed' },
      { words: ['ROCKET LAUNCH', 'ROCKET', 'LAUNCH', 'COUNTDOWN'], game: 'rocketlaunch' },
      { words: ['BUBBLE POP', 'BUBBLES', 'BUBBLE'], game: 'bubblepop' },
      { words: ['WHACK MOLE', 'WHACK A MOLE', 'WHACK', 'MOLES', 'MOLE'], game: 'whackmole' },
      { words: ['FRUIT CATCHER', 'FRUIT', 'FRUITS', 'CATCH'], game: 'fruitcatcher' },
      { words: ['PIANO', 'MUSIC', 'KEYS', 'KEYBOARD'], game: 'piano' },
      { words: ['RAIN GARDEN', 'RAIN', 'WATER FLOWERS', 'WATERING'], game: 'raingarden' },
      { words: ['LOST SHEEP', 'SHEEP', 'SHEPHERD', 'FLOCK'], game: 'lostsheep' },
      { words: ['STAR LIGHT', 'STARLIGHT', 'STARS', 'LIGHT THE STARS'], game: 'starlight' },
      { words: ['BUTTERFLY GARDEN', 'BUTTERFLY', 'BUTTERFLIES', 'FLOWERS'], game: 'butterflygarden' },
      { words: ['COLOR DROP', 'COLORDROP', 'PAINT DROPS', 'DROPS'], game: 'colordrop' },
    ];
    for (const entry of GAME_TRIGGERS) {
      if (entry.words.some(w => has(w))) {
        this.startGame(entry.game);
        return;
      }
    }

    // "stories" / "bible stories" / "story"
    if (has('STORIES') || has('STORY') || has('BIBLE STORIES')) {
      Audio.speak('Bible Stories!');
      this.showScreen('story-select');
      return;
    }

    // "campaign" / "quest" / "begin quest"
    if (has('CAMPAIGN') || has('QUEST') || has('BEGIN QUEST')) {
      if (typeof Campaign !== 'undefined') Campaign.start();
      return;
    }

    // ── 5. SINGLE LETTER — pass to active game (slicer, trace, path chase) ──
    if (text.length === 1 && text >= 'A' && text <= 'Z') {
      if (this.currentGame && typeof this.currentGame.handleVoice === 'function') {
        this.currentGame.handleVoice(text);
      }
    }
  },

  // ---- CONFETTI ----

  _launchConfetti() {
    const container = document.getElementById('reward-confetti');
    if (!container) return;
    container.innerHTML = '';

    const colors = ['#ffd700','#ff6b6b','#6bff6b','#6b6bff','#ff6bff','#6bffff'];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left  = Math.random() * 100;
      const delay = Math.random() * 1.5;
      const dur   = 1.5 + Math.random() * 1.5;
      const size  = 8 + Math.random() * 10;

      piece.style.cssText = `
        position: absolute;
        left: ${left}%;
        top: -20px;
        width: ${size}px; height: ${size}px;
        background: ${color};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation: confettiFall ${dur}s ${delay}s ease-in forwards;
      `;
      container.appendChild(piece);
    }

    // Add confetti keyframes if not already added
    if (!document.getElementById('confetti-styles')) {
      const style = document.createElement('style');
      style.id = 'confetti-styles';
      style.textContent = `
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }
};

// ---- START THE APP ----
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
