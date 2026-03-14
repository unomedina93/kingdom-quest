// ===== AUDIO MODULE =====
// Multi-provider TTS: Browser Web Speech API, ElevenLabs, or OpenAI
// Sound effects via Web Audio API (procedural, no files needed)
// Audio cache prevents redundant API calls for repeated phrases

const Audio = {
  // ---- State ----
  ctx: null,
  volume: 0.7,
  speechRate: 0.9,
  speaking: false,

  // ---- TTS provider: 'browser' | 'elevenlabs' | 'openai' ----
  provider: 'browser',

  // ---- Browser voice ----
  browserVoice: null,
  allBrowserVoices: [],

  // ---- ElevenLabs ----
  elevenLabsKey: '',
  elevenLabsVoiceId: 'XrExE9yKIg1WjnnlVkGX', // Matilda — warm, calm narrator

  // ---- OpenAI ----
  openAIKey: '',
  openAIVoice: 'nova', // nova | shimmer | fable | alloy | echo | onyx

  // ---- Audio cache: text → decoded audio buffer ----
  _cache: new Map(),
  _MAX_CACHE: 80,

  // ---- Current audio source (for stopping) ----
  _currentSource: null,

  // ---- Speech queue (max depth 1: current + one pending) ----
  // Prevents backlog while still letting the current utterance finish.
  _speechQueue: [],

  // ---- Background Music ----
  musicEnabled: false,
  _musicGain: null,
  _musicNextNoteTime: 0,
  _musicCurrentNote: 0,
  _musicTimer: null,
  _MUSIC_BPM: 100, // Calm but lively — 8th note = 0.3s

  // Happy adventure tune in G major, 16 eighth notes (~4.8s loop)
  // [melody_hz, bass_hz] — triangle melody + sine bass
  _MUSIC: [
    [392, 196], // G4 / G3 — opening climb
    [440, 196], // A4 / G3
    [494, 196], // B4 / G3
    [523, 196], // C5 / G3
    [587, 147], // D5 / D3 — peak
    [659, 147], // E5 / D3
    [587, 147], // D5 / D3
    [494, 147], // B4 / D3
    [523, 196], // C5 / G3 — descent
    [494, 196], // B4 / G3
    [440, 196], // A4 / G3
    [392, 196], // G4 / G3
    [440, 147], // A4 / D3 — cadence
    [494, 147], // B4 / D3
    [523, 196], // C5 / G3
    [392, 196], // G4 / G3 — home
  ],

  // ---- Curated voice lists ----
  ELEVENLABS_VOICES: [
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda (Warm Storyteller)' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Calm & Clear)' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Friendly & Bright)' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (Young & Cheerful)' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (Warm Male)' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (Young Male)' },
  ],

  OPENAI_VOICES: [
    { id: 'nova',    name: 'Nova (Bright & Friendly — great for kids)' },
    { id: 'shimmer', name: 'Shimmer (Soft & Gentle)' },
    { id: 'fable',   name: 'Fable (Warm Storyteller)' },
    { id: 'alloy',   name: 'Alloy (Clear & Balanced)' },
    { id: 'echo',    name: 'Echo (Clear Male)' },
    { id: 'onyx',    name: 'Onyx (Deep Narrator)' },
  ],

  // ---- INIT ----

  init() {
    // Load saved preferences — always use browser TTS (no API keys required)
    this.provider        = 'browser';
    this.elevenLabsKey   = localStorage.getItem('kq_el_key')          || '';
    this.elevenLabsVoiceId = localStorage.getItem('kq_el_voice')      || 'XrExE9yKIg1WjnnlVkGX';
    this.openAIKey       = localStorage.getItem('kq_oai_key')         || '';
    this.openAIVoice     = localStorage.getItem('kq_oai_voice')       || 'nova';
    this.volume          = parseFloat(localStorage.getItem('kq_vol')  || '0.7');
    this.speechRate      = parseFloat(localStorage.getItem('kq_rate') || '0.9');

    // Web Audio context + speechSynthesis unlock — both require a user gesture in Chrome
    this._speechUnlocked = false;
    const unlockAudio = () => {
      // Unlock AudioContext
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (localStorage.getItem('kq_music') === 'on') {
          setTimeout(() => this.startMusic(), 200);
        }
      } else if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      // Unlock speechSynthesis — Chrome silently drops speak() before a user gesture
      if (!this._speechUnlocked) {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        speechSynthesis.speak(silent);
        this._speechUnlocked = true;
        // Fire the welcome speech now that speechSynthesis is unlocked
        if (typeof App !== 'undefined' && App._pendingWelcome) {
          App._pendingWelcome = false;
          setTimeout(() => {
            this.speak("Welcome to Kingdom Quest! Choose your hero and begin your adventure!", { rate: 0.9 });
          }, 200);
        }
      }
    };
    document.addEventListener('click',      unlockAudio, { once: false });
    document.addEventListener('touchstart', unlockAudio, { once: false });
    document.addEventListener('keydown',    unlockAudio, { once: false });

    // Load browser voices
    const loadVoices = () => {
      this.allBrowserVoices = speechSynthesis.getVoices()
        .filter(v => v.lang.startsWith('en'));
      // Default: prefer any local/enhanced voice over network voices
      const saved = localStorage.getItem('kq_browser_voice');
      if (saved) {
        this.browserVoice = this.allBrowserVoices.find(v => v.name === saved)
          || this._pickBestBrowserVoice();
      } else {
        this.browserVoice = this._pickBestBrowserVoice();
      }
    };
    speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  },

  _pickBestBrowserVoice() {
    const voices = this.allBrowserVoices;
    if (!voices.length) return null;
    // Ranked preference: macOS Enhanced/Premium > named good voices > any local en-US > Google > fallback
    return (
      voices.find(v => v.name === 'Ava (Enhanced)')             ||
      voices.find(v => v.name === 'Samantha (Enhanced)')        ||
      voices.find(v => v.name === 'Allison (Enhanced)')         ||
      voices.find(v => v.name === 'Susan (Enhanced)')           ||
      voices.find(v => v.name === 'Zoe (Enhanced)')             ||
      voices.find(v => v.name.includes('(Enhanced)'))           ||
      voices.find(v => v.name.includes('(Premium)'))            ||
      voices.find(v => v.name === 'Samantha')                   ||
      voices.find(v => v.name === 'Ava')                        ||
      voices.find(v => v.lang === 'en-US' && v.localService)    ||
      voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
      voices.find(v => v.lang === 'en-US')                      ||
      voices[0]
    );
  },

  // ---- SETTINGS HELPERS ----

  setSpeed(val)  {
    this.speechRate = parseFloat(val);
    localStorage.setItem('kq_rate', val);
  },
  setVolume(val) {
    this.volume = parseFloat(val);
    localStorage.setItem('kq_vol', val);
  },
  setProvider(val) {
    this.provider = val;
    localStorage.setItem('kq_tts_provider', val);
    this._cache.clear(); // Clear cache when switching providers
  },
  setElevenLabsKey(key) {
    this.elevenLabsKey = key.trim();
    localStorage.setItem('kq_el_key', this.elevenLabsKey);
    this._cache.clear();
  },
  setElevenLabsVoice(id) {
    this.elevenLabsVoiceId = id;
    localStorage.setItem('kq_el_voice', id);
    this._cache.clear();
  },
  setOpenAIKey(key) {
    this.openAIKey = key.trim();
    localStorage.setItem('kq_oai_key', this.openAIKey);
    this._cache.clear();
  },
  setOpenAIVoice(id) {
    this.openAIVoice = id;
    localStorage.setItem('kq_oai_voice', id);
    this._cache.clear();
  },
  setBrowserVoice(name) {
    this.browserVoice = this.allBrowserVoices.find(v => v.name === name) || this.browserVoice;
    localStorage.setItem('kq_browser_voice', name);
  },

  // ---- MAIN SPEAK METHOD ----
  //
  // Default behaviour: let the current utterance finish, then speak this one.
  // Only one item can sit in the queue at a time — newer messages replace older
  // pending ones so the queue never builds up into a backlog.
  //
  // Pass { interrupt: true } for level transitions / new-round prompts that
  // should cancel whatever is playing and start immediately.

  speak(text, options = {}) {
    if (!text) return;

    if (options.interrupt) {
      // Hard interrupt: clear queue, kill current speech, play immediately.
      this._speechQueue = [];
      this.stopSpeech();
      this._speakNow(text, options);
    } else if (!this.speaking) {
      // Nothing playing — cancel any stale browser state and speak now.
      speechSynthesis.cancel();
      this._speechQueue = [];
      this._speakNow(text, options);
    } else {
      // Currently speaking — replace queue slot with this latest message.
      // (Old pending item is discarded so the queue never grows.)
      this._speechQueue = [{ text, options }];
    }
  },

  _speakNow(text, options) {
    switch (this.provider) {
      case 'elevenlabs': this._speakElevenLabs(text, options); break;
      case 'openai':     this._speakOpenAI(text, options);     break;
      default:           this._speakBrowser(text, options);    break;
    }
  },

  stopSpeech() {
    this._speechQueue = [];
    speechSynthesis.cancel();
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch (e) {}
      this._currentSource = null;
    }
    this.speaking = false;
  },

  // ---- BROWSER TTS ----

  _speakBrowser(text, options = {}) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate   = options.rate  || this.speechRate;
    utter.volume = this.volume;
    utter.pitch  = options.pitch || 1.05;
    if (this.browserVoice) utter.voice = this.browserVoice;
    utter.onstart = () => { this.speaking = true; };
    utter.onend   = () => {
      this.speaking = false;
      if (options.onEnd) options.onEnd();
      // Play the next queued item, if any
      if (this._speechQueue.length > 0) {
        const next = this._speechQueue.shift();
        this._speakNow(next.text, next.options);
      }
    };
    speechSynthesis.speak(utter);
  },

  // ---- ELEVENLABS TTS ----

  async _speakElevenLabs(text, options = {}) {
    if (!this.elevenLabsKey) {
      console.warn('[Audio] ElevenLabs key not set — falling back to browser TTS');
      this._speakBrowser(text, options);
      return;
    }

    const cacheKey = `el:${this.elevenLabsVoiceId}:${text}`;
    if (this._cache.has(cacheKey)) {
      await this._playBuffer(this._cache.get(cacheKey), options);
      return;
    }

    try {
      this.speaking = true;
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsKey
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2',  // Fast + high quality
            voice_settings: {
              stability: 0.65,       // Consistent but expressive
              similarity_boost: 0.8,
              style: 0.3,            // A bit of expression for kids
              use_speaker_boost: true
            }
          })
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail?.message || `HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this._addToCache(cacheKey, audioBuffer);
      await this._playBuffer(audioBuffer, options);

    } catch (err) {
      console.error('[Audio] ElevenLabs error:', err.message);
      this._speakBrowser(text, options); // Graceful fallback
    }
  },

  // ---- OPENAI TTS ----

  async _speakOpenAI(text, options = {}) {
    if (!this.openAIKey) {
      console.warn('[Audio] OpenAI key not set — falling back to browser TTS');
      this._speakBrowser(text, options);
      return;
    }

    const cacheKey = `oai:${this.openAIVoice}:${text}`;
    if (this._cache.has(cacheKey)) {
      await this._playBuffer(this._cache.get(cacheKey), options);
      return;
    }

    // Make sure AudioContext is active
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    try {
      this.speaking = true;
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openAIKey}`
        },
        body: JSON.stringify({
          model: 'tts-1',        // tts-1 = fast; tts-1-hd = slower but higher quality
          input: text,
          voice: this.openAIVoice,
          speed: Math.max(0.25, Math.min(4.0, this.speechRate)) // OpenAI's accepted range
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this._addToCache(cacheKey, audioBuffer);
      await this._playBuffer(audioBuffer, options);

    } catch (err) {
      console.error('[Audio] OpenAI TTS error:', err.message);
      this._speakBrowser(text, options); // Graceful fallback
    }
  },

  // ---- AUDIO BUFFER PLAYBACK ----

  async _playBuffer(audioBuffer, options = {}) {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const source = this.ctx.createBufferSource();
    const gain   = this.ctx.createGain();
    source.buffer = audioBuffer;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.value = this.volume;

    this._currentSource = source;
    this.speaking = true;

    source.onended = () => {
      this.speaking = false;
      this._currentSource = null;
      if (options.onEnd) options.onEnd();
    };

    source.start(0);
  },

  // ---- CACHE MANAGEMENT ----

  _addToCache(key, buffer) {
    if (this._cache.size >= this._MAX_CACHE) {
      // Evict oldest entry
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, buffer);
  },

  // ---- TEST CONNECTION (used by settings UI) ----

  async testVoice(onResult) {
    const testText = "Hello! I am your Kingdom Quest narrator. How does my voice sound?";
    const prevOnEnd = null;

    if (this.provider === 'elevenlabs') {
      if (!this.elevenLabsKey) {
        onResult(false, 'No API key entered. Please enter your ElevenLabs API key.');
        return;
      }
      try {
        // Quick validation call
        const r = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': this.elevenLabsKey }
        });
        if (!r.ok) throw new Error('Invalid API key or quota exceeded');
        const data = await r.json();
        const charsLeft = data.subscription?.character_limit - data.subscription?.character_count;
        onResult(true, `✅ Connected! Characters remaining: ${charsLeft?.toLocaleString() ?? 'unknown'}`);
        this.speak(testText);
      } catch (err) {
        onResult(false, `❌ ${err.message}`);
      }

    } else if (this.provider === 'openai') {
      if (!this.openAIKey) {
        onResult(false, 'No API key entered. Please enter your OpenAI API key.');
        return;
      }
      // OpenAI has no free validation endpoint — just try to speak and see
      try {
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${this.openAIKey}` }
        });
        if (!r.ok) throw new Error('Invalid API key');
        onResult(true, '✅ Connected to OpenAI! Playing test voice...');
        this.speak(testText);
      } catch (err) {
        onResult(false, `❌ ${err.message}`);
      }

    } else {
      // Browser — just speak
      onResult(true, `✅ Using browser voice: ${this.browserVoice?.name || 'default'}`);
      this.speak(testText);
    }
  },

  // ---- BACKGROUND MUSIC ----

  startMusic() {
    if (this.musicEnabled) return;
    if (!this.ctx) return; // Wait for first user click
    this.musicEnabled = true;
    localStorage.setItem('kq_music', 'on');

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => this._beginMusicLoop());
      return;
    }
    this._beginMusicLoop();
  },

  _beginMusicLoop() {
    this._musicGain = this.ctx.createGain();
    this._musicGain.gain.value = 0.07; // Soft background level
    this._musicGain.connect(this.ctx.destination);
    this._musicCurrentNote = 0;
    this._musicNextNoteTime = this.ctx.currentTime + 0.1;
    this._scheduleMusicLoop();
  },

  stopMusic() {
    if (!this.musicEnabled) return;
    this.musicEnabled = false;
    localStorage.setItem('kq_music', 'off');
    clearTimeout(this._musicTimer);
    if (this._musicGain) {
      const now = this.ctx.currentTime;
      this._musicGain.gain.setTargetAtTime(0, now, 0.4);
      const node = this._musicGain;
      setTimeout(() => { try { node.disconnect(); } catch(e){} }, 800);
      this._musicGain = null;
    }
  },

  toggleMusic() {
    if (this.musicEnabled) {
      this.stopMusic();
    } else {
      if (!this.ctx) {
        // AudioContext not yet created — save pref, will start on next click
        localStorage.setItem('kq_music', 'on');
      } else {
        this.startMusic();
      }
    }
  },

  _scheduleMusicLoop() {
    if (!this.musicEnabled || !this.ctx || !this._musicGain) return;
    const beatDur = 60 / this._MUSIC_BPM / 2; // 8th note
    const lookAhead = 0.25;

    while (this._musicNextNoteTime < this.ctx.currentTime + lookAhead) {
      this._scheduleMusicNote(this._musicCurrentNote, this._musicNextNoteTime);
      this._musicCurrentNote = (this._musicCurrentNote + 1) % this._MUSIC.length;
      this._musicNextNoteTime += beatDur;
    }
    this._musicTimer = setTimeout(() => this._scheduleMusicLoop(), 80);
  },

  _scheduleMusicNote(idx, startTime) {
    if (!this._musicGain) return;
    const [melHz, bassHz] = this._MUSIC[idx];
    const beatDur = 60 / this._MUSIC_BPM / 2;
    const noteDur = beatDur * 0.72; // slight staccato for clarity

    // Melody — triangle wave (soft, warm)
    if (melHz > 0) {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = melHz;
      osc.connect(gain);
      gain.connect(this._musicGain);
      gain.gain.setValueAtTime(0.65, startTime);
      gain.gain.setTargetAtTime(0.001, startTime + noteDur * 0.55, 0.04);
      osc.start(startTime);
      osc.stop(startTime + noteDur);
    }

    // Bass — sine on every 2nd note (quarter notes), softer
    if (idx % 2 === 0 && bassHz > 0) {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = bassHz;
      osc.connect(gain);
      gain.connect(this._musicGain);
      gain.gain.setValueAtTime(0.38, startTime);
      gain.gain.setTargetAtTime(0.001, startTime + beatDur * 1.6, 0.1);
      osc.start(startTime);
      osc.stop(startTime + beatDur * 2);
    }
  },

  // ---- SOUND EFFECTS (Web Audio API — procedural, no files) ----

  _play(freq, duration, shape = 'sine', vol = 0.3) {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = shape;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(this.volume * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  },

  playSuccess() {
    this._play(523, 0.15, 'square');
    setTimeout(() => this._play(659, 0.15, 'square'), 120);
    setTimeout(() => this._play(784, 0.15, 'square'), 240);
    setTimeout(() => this._play(1047,0.3,  'square'), 360);
  },

  playWrong() {
    // Soft, gentle — a low warm bell, not a harsh buzz
    this._play(330, 0.3, 'sine', 0.2);
    setTimeout(() => this._play(280, 0.35, 'sine', 0.15), 200);
  },

  playSlice() {
    if (!this.ctx) return;
    const buf  = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src    = this.ctx.createBufferSource();
    const gain   = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    src.buffer = buf;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.5, this.ctx.currentTime);
    src.start();
  },

  playStep()    { this._play(120, 0.08, 'sine', 0.2); },
  playCoin()    {
    this._play(1200, 0.12, 'sine', 0.25);
    setTimeout(() => this._play(1600, 0.12, 'sine', 0.2), 80);
  },
  playPop()     {
    this._play(600, 0.1, 'sine', 0.25);
    setTimeout(() => this._play(400, 0.1, 'sine', 0.2), 80);
  },
  playBoing()   {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(this.volume * 0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.4);
  },
  playVictory() {
    const notes = [523, 659, 784, 1047, 784, 880, 1047];
    const times = [0,  120, 240, 360,  500, 600, 700];
    notes.forEach((freq, i) => {
      setTimeout(() => this._play(freq, 0.2, 'square', 0.3), times[i]);
    });
  },
};
