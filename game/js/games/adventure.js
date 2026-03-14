// ===== BIBLE ADVENTURE GAME =====
// Choose-your-own-adventure Bible stories with mini-games

const AdventureGame = {
  currentStory: null,
  currentPageId: null,
  miniGameActive: false,
  miniCount: 0,
  miniTarget: 0,
  miniItems: [],
  _activePage: null,      // Tracks which page is currently being narrated
  _controlsShown: false,  // Guards against double-showing controls

  start(storyId) {
    const story = STORIES[storyId];
    if (!story) { console.error('Story not found:', storyId); return; }

    this.currentStory = story;
    this.currentPageId = story.pages[0].id;
    this.miniGameActive = false;

    // Set background
    document.getElementById('story-bg').style.background = story.bgColor;

    this._renderPage(this._getPage(this.currentPageId));

    App.setHUDTitle('');
  },

  _getPage(id) {
    return this.currentStory.pages.find(p => p.id === id);
  },

  _renderPage(page) {
    if (!page) return;

    // Mark which page is active (guards against stale onEnd callbacks)
    this._activePage    = page;
    this._controlsShown = false;

    // Art
    const artEl = document.getElementById('story-art');
    artEl.textContent = page.art || '📖';
    artEl.style.animation = 'none';
    requestAnimationFrame(() => { artEl.style.animation = 'storyFloat 4s ease-in-out infinite'; });

    // Text
    document.getElementById('story-text').textContent = page.text;

    // Build progress dots
    const allPages   = this.currentStory.pages;
    const progressEl = document.getElementById('story-progress');
    progressEl.innerHTML = '';
    allPages.forEach(p => {
      const dot = document.createElement('div');
      dot.className = 'progress-dot';
      if (p.id === this.currentPageId || allPages.indexOf(p) < allPages.findIndex(pp => pp.id === this.currentPageId)) {
        dot.classList.add('active');
      }
      progressEl.appendChild(dot);
    });

    // Hide main controls — show a "Skip narration" button while speaking
    const choicesEl = document.getElementById('story-choices');
    const nextBtn   = document.getElementById('story-next-btn');
    choicesEl.innerHTML = '';
    nextBtn.classList.remove('hidden');
    nextBtn.textContent = '⏭ Skip';
    nextBtn.onclick = () => {
      Audio.stopSpeech();
      this._showPageControls(page);
    };

    // Speak — show controls when speech finishes naturally
    Audio.speak(page.text, {
      rate: 0.85,
      pitch: 1.0,
      onEnd: () => {
        if (this._activePage === page) this._showPageControls(page);
      }
    });
  },

  // Called when narration ends or user taps Skip
  _showPageControls(page) {
    if (this._activePage !== page) return; // Page changed — ignore
    if (this._controlsShown) return;       // Already shown
    this._controlsShown = true;

    const choicesEl = document.getElementById('story-choices');
    const nextBtn   = document.getElementById('story-next-btn');
    choicesEl.innerHTML = '';

    if (page.miniGame) {
      nextBtn.classList.add('hidden');
      this._startMiniGame(page.miniGame, page.next);
      return;
    }

    if (page.isEnd) {
      nextBtn.classList.add('hidden');
      choicesEl.innerHTML = `
        <div style="text-align:center; padding: 12px 0;">
          <div style="font-size:clamp(14px,2vw,18px); color:#8b5e3c; font-style:italic; margin-bottom:12px;">
            📖 <strong>${page.verse}</strong>
          </div>
          <div style="font-size:clamp(14px,2vw,17px); color:#5a3a0a; font-weight:600; margin-bottom:16px;">
            💡 ${page.lesson}
          </div>
          <button class="btn-main" onclick="AdventureGame._finishStory()" style="margin-top:8px;">
            ⭐ Finish Story!
          </button>
        </div>
      `;
    } else if (page.choices && page.choices.length > 0) {
      nextBtn.classList.add('hidden');
      page.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = choice.text;
        btn.onclick = () => {
          this.currentPageId = choice.next;
          this._renderPage(this._getPage(choice.next));
        };
        choicesEl.appendChild(btn);
      });
    } else if (page.next) {
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = 'Next ➡️';
      nextBtn.onclick = () => this.nextPage();
    } else {
      nextBtn.classList.add('hidden');
    }
  },

  nextPage() {
    const page = this._getPage(this.currentPageId);
    if (page && page.next) {
      this.currentPageId = page.next;
      this._renderPage(this._getPage(page.next));
    }
  },

  _startMiniGame(gameData, nextPage) {
    const textEl    = document.getElementById('story-text');
    const choicesEl = document.getElementById('story-choices');
    const nextBtn   = document.getElementById('story-next-btn');

    this.miniGameActive = true;
    this.miniCount  = 0;
    this.miniTarget = gameData.target;

    if (gameData.type === 'count') {
      // Tap N items
      Audio.speak(gameData.prompt, { rate: 0.9 });

      choicesEl.innerHTML = `
        <div style="text-align:center; width:100%;">
          <div id="mini-prompt" style="font-family:'Nunito',sans-serif; font-size:clamp(15px,2vw,20px); color:#4a2f0a; font-weight:700; margin-bottom:12px;">
            ${gameData.prompt}
          </div>
          <div id="mini-items" style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px; margin-bottom:10px;">
          </div>
          <div id="mini-counter" style="font-family:'Fredoka One',cursive; font-size:clamp(28px,5vw,48px); color:#7b3fc4;">
            0 / ${gameData.target}
          </div>
        </div>
      `;
      nextBtn.classList.add('hidden');

      // Create tappable items
      const itemsEl = document.getElementById('mini-items');
      for (let i = 0; i < gameData.target + Math.floor(Math.random() * 3); i++) {
        const btn = document.createElement('button');
        btn.style.cssText = 'font-size:clamp(36px,6vw,52px); background:none; border:3px solid #8b5e3c; border-radius:12px; padding:8px; cursor:pointer; transition:transform 0.1s, opacity 0.2s;';
        btn.textContent = gameData.item;
        btn.onclick = () => this._miniTap(btn, gameData, nextPage);
        itemsEl.appendChild(btn);
      }

    } else if (gameData.type === 'match-pairs') {
      // Match animal pairs
      Audio.speak(gameData.prompt, { rate: 0.9 });
      const items = gameData.items;
      // Shuffle pairs
      const pairs = [...items, ...items].sort(() => Math.random() - 0.5);

      this.miniCount  = 0;
      this.miniTarget = items.length;
      this._miniFirstPick = null;

      choicesEl.innerHTML = `
        <div style="text-align:center; width:100%;">
          <div style="font-family:'Nunito',sans-serif; font-size:clamp(14px,2vw,18px); color:#4a2f0a; font-weight:700; margin-bottom:12px;">
            ${gameData.prompt}
          </div>
          <div id="mini-pairs-grid" style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px;">
          </div>
        </div>
      `;
      nextBtn.classList.add('hidden');

      const grid = document.getElementById('mini-pairs-grid');
      pairs.forEach((emoji, i) => {
        const btn = document.createElement('button');
        btn.dataset.emoji = emoji;
        btn.dataset.idx   = i;
        btn.style.cssText = 'font-size:clamp(32px,5vw,44px); background:rgba(139,94,60,0.1); border:3px solid #8b5e3c; border-radius:12px; padding:10px; cursor:pointer; width:clamp(60px,10vw,80px); height:clamp(60px,10vw,80px); transition:all 0.2s;';
        btn.textContent = '❓';
        btn.onclick = () => this._miniMatchTap(btn, gameData, nextPage);
        grid.appendChild(btn);
      });
    }
  },

  _miniTap(btn, gameData, nextPage) {
    if (btn.disabled) return;
    if (this.miniCount >= this.miniTarget) return;

    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.transform = 'scale(0.8)';
    this.miniCount++;

    const counter = document.getElementById('mini-counter');
    if (counter) counter.textContent = `${this.miniCount} / ${this.miniTarget}`;

    Audio.playCoin();

    if (this.miniCount >= this.miniTarget) {
      Audio.playSuccess();
      Audio.speak(`That's ${this.miniTarget}! Great job!`);
      setTimeout(() => {
        this.miniGameActive = false;
        this.currentPageId  = nextPage;
        this._renderPage(this._getPage(nextPage));
      }, 1200);
    }
  },

  _miniMatchTap(btn, gameData, nextPage) {
    if (btn.dataset.matched) return;
    const emoji = btn.dataset.emoji;
    btn.textContent = emoji; // Reveal

    if (!this._miniFirstPick) {
      this._miniFirstPick = btn;
      btn.style.borderColor = '#7b3fc4';
      return;
    }

    const first = this._miniFirstPick;
    this._miniFirstPick = null;

    if (first === btn) return;

    if (first.dataset.emoji === emoji) {
      // Match!
      first.dataset.matched = btn.dataset.matched = 'true';
      first.style.cssText  += 'opacity:0.5; background:rgba(67,160,71,0.3); border-color:#43a047;';
      btn.style.cssText    += 'opacity:0.5; background:rgba(67,160,71,0.3); border-color:#43a047;';
      this.miniCount++;
      Audio.playSuccess();

      if (this.miniCount >= this.miniTarget) {
        setTimeout(() => {
          this.miniGameActive = false;
          this.currentPageId  = nextPage;
          this._renderPage(this._getPage(nextPage));
        }, 1000);
      }
    } else {
      // No match — flip back
      first.style.borderColor = '#8b5e3c';
      Audio.playWrong();
      setTimeout(() => {
        first.textContent = '❓';
        btn.textContent   = '❓';
        btn.style.borderColor = '#8b5e3c';
      }, 700);
    }
  },

  _finishStory() {
    Audio.playVictory();
    Audio.speak(`Great job! You finished the story! Remember: ${this.currentStory.lesson}`);
    App.onGameComplete('adventure', 3);
  }
};
