// ===== CAMPAIGN MODE =====
// Guided RPG narrative that takes the child through a structured adventure:
// Intro story → game → Bible story → lesson → reward → next chapter
// Calm, unhurried pacing. Child drives the pace. No time pressure.

const Campaign = {
  chapterIndex: 0,
  stepIndex: 0,
  running: false,

  // ---- CHAPTER DATA ----
  // Each chapter has a narrative arc: intro scenes, a game, a story, a lesson
  chapters: [
    {
      id: 1,
      title: 'Chapter 1: The Call to Adventure',
      bgColor: 'linear-gradient(180deg, #1a0538 0%, #3d1278 100%)',
      steps: [
        {
          type: 'scene',
          art: '🏰',
          text: 'Long ago, in a magical Kingdom of Learning, a wise old sage appeared at your door.',
          bg: 'linear-gradient(180deg, #1a0538 0%, #3d1278 100%)'
        },
        {
          type: 'scene',
          art: '🧙‍♂️',
          text: '"Young hero!" said the sage. "The kingdom needs your help! Letters and numbers have been scattered by the thief. Only YOU can put them back!"',
          bg: 'linear-gradient(180deg, #2d0a6e 0%, #4a1a8a 100%)'
        },
        {
          type: 'scene',
          art: '⚔️',
          text: '"But first," he said, "you must learn to read the ancient scrolls." He handed you a glowing scroll with the letter A...',
          bg: 'linear-gradient(180deg, #2d1b0e 0%, #5a3a0a 100%)'
        },
        {
          type: 'game',
          game: 'trace',
          intro: 'Trace the letters on the ancient scroll! The sage watches proudly.',
          art: '📜'
        },
        {
          type: 'scene',
          art: '✨',
          text: '"Wonderful!" said the sage. "You have the gift of wisdom. Now let me tell you about a young hero just like you — a boy named David."',
          bg: 'linear-gradient(180deg, #1a3a6a 0%, #2d5a8a 100%)'
        },
        {
          type: 'story',
          storyId: 'david_goliath',
          intro: 'Gather around the campfire for the story of David and the Giant!'
        },
        {
          type: 'lesson',
          art: '💪',
          text: 'David was small — just like you! But he was BRAVE because he trusted God. You are brave too! God is always with you.',
          verse: '"Be strong and courageous!" — Joshua 1:9',
          bg: 'linear-gradient(180deg, #1a4a1a 0%, #2d7a2d 100%)'
        },
        {
          type: 'reward',
          art: '⭐',
          text: 'Chapter 1 Complete! You earned your first Hero Badge!',
          badge: '🏅'
        }
      ]
    },

    {
      id: 2,
      title: 'Chapter 2: The Forest of Numbers',
      bgColor: 'linear-gradient(180deg, #1a4a1a 0%, #2d6a2d 100%)',
      steps: [
        {
          type: 'scene',
          art: '🌲',
          text: 'The sage led you to the Forest of Numbers. "Hidden among the trees are magical treasures," he whispered. "Count them carefully!"',
          bg: 'linear-gradient(180deg, #1a4a1a 0%, #2d6a2d 100%)'
        },
        {
          type: 'scene',
          art: '💰',
          text: 'A little squirrel appeared. "I need 5 acorns for winter," she said, "but I can only count to 3! Can you help me?"',
          bg: 'linear-gradient(180deg, #2d5a1b 0%, #4a8a2a 100%)'
        },
        {
          type: 'game',
          game: 'number',
          intro: 'Help count the treasures in the forest! Take your time.',
          art: '💰'
        },
        {
          type: 'scene',
          art: '🐑',
          text: '"You are SO good at counting!" said the sage. "Did you know God counts everything too? There is even a story about a shepherd who counted his sheep..."',
          bg: 'linear-gradient(180deg, #3a7a3a 0%, #1a4a1a 100%)'
        },
        {
          type: 'story',
          storyId: 'lost_sheep',
          intro: 'Hear the story of the shepherd who never gave up searching!'
        },
        {
          type: 'lesson',
          art: '🙏',
          text: 'God loves you SO much — even more than a shepherd loves his sheep. No matter where you go, God always knows where you are. You are never forgotten!',
          verse: '"God loves you very much!" — John 3:16',
          bg: 'linear-gradient(180deg, #3a7a3a 0%, #1a4a1a 100%)'
        },
        {
          type: 'scene',
          art: '🌳',
          text: 'The forest glowed with golden light. You could feel God\'s love surrounding you like warm sunlight through the trees.',
          bg: 'linear-gradient(180deg, #4a7a2a 0%, #2a4a1a 100%)'
        },
        {
          type: 'reward',
          art: '🌟',
          text: 'Chapter 2 Complete! You are a master of numbers!',
          badge: '🌿'
        }
      ]
    },

    {
      id: 3,
      title: 'Chapter 3: The Kingdom Letters',
      bgColor: 'linear-gradient(180deg, #0d0020 0%, #2d1060 100%)',
      steps: [
        {
          type: 'scene',
          art: '🏰',
          text: 'Back at the castle, the sage unrolled a giant scroll covered in letters. "These are the letters of the Kingdom Alphabet," he said. "Each one is magical!"',
          bg: 'linear-gradient(180deg, #2d1060 0%, #4a2090 100%)'
        },
        {
          type: 'scene',
          art: '⚔️',
          text: 'Suddenly — the thief appeared! He grabbed a handful of letters and threw them into the air! They scattered everywhere!',
          bg: 'linear-gradient(180deg, #3d0808 0%, #6a1010 100%)'
        },
        {
          type: 'game',
          game: 'slicer',
          intro: 'The letters are flying everywhere! Slice the right ones out of the air!',
          art: '⚔️'
        },
        {
          type: 'game',
          game: 'chase',
          intro: 'The thief is running! Follow the right path to catch him!',
          art: '🏃'
        },
        {
          type: 'scene',
          art: '😤',
          text: 'You caught many of the letters! The sage smiled. "Well done! You know, there was once a man who trusted God even in a VERY scary place — a den with real lions!"',
          bg: 'linear-gradient(180deg, #4a1a00 0%, #2a0d00 100%)'
        },
        {
          type: 'story',
          storyId: 'daniel_lions',
          intro: 'Hear the amazing story of Daniel and the Lions!'
        },
        {
          type: 'lesson',
          art: '🦁',
          text: 'Daniel was not afraid because he knew God was with him. The next time YOU feel scared, remember: God is right there with you, just like He was with Daniel!',
          verse: '"With God, all things are possible!" — Matthew 19:26',
          bg: 'linear-gradient(180deg, #4a1a00 0%, #1a0d00 100%)'
        },
        {
          type: 'reward',
          art: '👑',
          text: 'Chapter 3 Complete! You are a true Kingdom Knight!',
          badge: '👑'
        }
      ]
    },

    {
      id: 4,
      title: 'Chapter 4: The Beginning of Everything',
      bgColor: 'linear-gradient(180deg, #000000 0%, #1a1a8a 100%)',
      steps: [
        {
          type: 'scene',
          art: '🌌',
          text: 'The sage climbed to the top of the tower and pointed at the night sky. "Look at all those stars!" he said. "Did you know God made every single one?"',
          bg: 'linear-gradient(180deg, #000010 0%, #1a1a8a 100%)'
        },
        {
          type: 'scene',
          art: '🌍',
          text: '"Before anything existed, God was there. And then He started creating — and it was WONDERFUL!" The sage\'s eyes sparkled. "Shall I tell you the story?"',
          bg: 'linear-gradient(180deg, #000010 0%, #0a2060 100%)'
        },
        {
          type: 'story',
          storyId: 'creation',
          intro: 'The greatest story ever told — how God made the whole world!'
        },
        {
          type: 'scene',
          art: '👦',
          text: 'The sage looked at you with kind eyes. "And on the last day, God made His most special creation — PEOPLE. He made you! You are no accident. You were planned with love."',
          bg: 'linear-gradient(180deg, #1a3a6a 0%, #2d5a8a 100%)'
        },
        {
          type: 'game',
          game: 'maze',
          intro: 'Now navigate through the great creation maze! God made all these wonderful things.',
          art: '🌿'
        },
        {
          type: 'lesson',
          art: '🌟',
          text: 'God made the sun, the moon, the stars, the animals, and YOU. Out of all of creation, YOU are His favorite. He knows your name and loves you forever.',
          verse: '"Children are a gift from God." — Psalm 127:3',
          bg: 'linear-gradient(180deg, #1a1a8a 0%, #000010 100%)'
        },
        {
          type: 'reward',
          art: '🌍',
          text: 'Chapter 4 Complete! You are a wonder of God\'s creation!',
          badge: '🌍'
        }
      ]
    }
  ],

  // ---- PUBLIC API ----

  start() {
    // Resume from saved progress
    this.chapterIndex = parseInt(localStorage.getItem('kq_campaign_chapter') || '0') % this.chapters.length;
    this.stepIndex    = 0;
    this.running      = true;
    App.showScreen('campaign');
    this._runStep();
  },

  next() {
    if (!this.running) return;
    Audio.stopSpeech();
    this.stepIndex++;

    const chapter = this.chapters[this.chapterIndex];
    if (this.stepIndex >= chapter.steps.length) {
      // Chapter complete
      this._completeChapter();
    } else {
      this._runStep();
    }
  },

  _runStep() {
    const chapter = this.chapters[this.chapterIndex];
    const step    = chapter.steps[this.stepIndex];
    if (!step) return;

    const bgEl    = document.getElementById('campaign-bg');
    const artEl   = document.getElementById('campaign-art');
    const textEl  = document.getElementById('campaign-text');
    const nextBtn = document.getElementById('campaign-next-btn');
    const chapEl  = document.getElementById('campaign-chapter');

    chapEl.textContent = chapter.title;

    if (step.type === 'scene' || step.type === 'lesson') {
      // Show narrative text
      if (step.bg) bgEl.style.background = step.bg;
      artEl.textContent = step.art || '✨';
      nextBtn.textContent = 'Continue ➡️';
      nextBtn.style.display = '';

      if (step.type === 'lesson') {
        textEl.innerHTML = `
          <p>${step.text}</p>
          <div class="campaign-verse">${step.verse || ''}</div>
        `;
      } else {
        textEl.textContent = step.text;
      }
      Audio.speak(step.text, { rate: 0.85, pitch: 1.0 });

    } else if (step.type === 'game') {
      // Launch game, then return to campaign
      artEl.textContent = step.art || '⚔️';
      textEl.textContent = step.intro;
      nextBtn.textContent = '▶️ Play Now!';
      nextBtn.style.display = '';
      nextBtn.onclick = () => this._launchCampaignGame(step.game);
      Audio.speak(step.intro, { rate: 0.85 });

    } else if (step.type === 'story') {
      // Launch Bible story, then return
      artEl.textContent = STORIES[step.storyId]?.icon || '📖';
      textEl.textContent = step.intro;
      nextBtn.textContent = '📖 Begin Story!';
      nextBtn.style.display = '';
      nextBtn.onclick = () => this._launchCampaignStory(step.storyId);
      Audio.speak(step.intro, { rate: 0.85 });

    } else if (step.type === 'reward') {
      // Show chapter reward
      bgEl.style.background = 'radial-gradient(ellipse at center, #3d1278 0%, #1a0538 70%)';
      artEl.textContent = step.art;
      textEl.innerHTML = `
        <div class="campaign-reward-badge">${step.badge}</div>
        <p>${step.text}</p>
      `;
      nextBtn.textContent = '🗺️ Continue Quest!';
      nextBtn.style.display = '';
      nextBtn.onclick = () => Campaign.next();
      Audio.playVictory();
      Audio.speak(step.text, { rate: 0.9 });
    }

    // Reset next button to default if not overridden
    if (step.type === 'scene' || step.type === 'lesson') {
      nextBtn.onclick = () => Campaign.next();
    }
  },

  _launchCampaignGame(gameName) {
    // Launch game, and when complete, return to campaign
    this.running = false;
    const originalOnComplete = (stars) => {
      App.onGameComplete(gameName, stars);
      // Override reward screen to return to campaign
      setTimeout(() => {
        this.running = true;
        this.stepIndex++;
        App.showScreen('campaign');
        this._runStep();
      }, 3500);
    };

    App.showScreen('game');
    const canvas = document.getElementById('game-canvas');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    switch (gameName) {
      case 'maze':  App.currentGame = new MazeGame(canvas, ctx, originalOnComplete);  App.currentGame.start(); break;
      case 'slicer':App.currentGame = new SlicerGame(canvas, ctx, originalOnComplete); App.currentGame.start(); break;
      case 'number':App.currentGame = new NumberMatchGame(canvas, ctx, originalOnComplete); App.currentGame.start(); break;
      case 'trace': App.currentGame = new LetterTraceGame(canvas, ctx, originalOnComplete); App.currentGame.start(); break;
      case 'chase': App.currentGame = new PathChaseGame(canvas, ctx, originalOnComplete); App.currentGame.start(); break;
    }
    App.hideOverlay();
  },

  _launchCampaignStory(storyId) {
    this.running = false;

    // Override AdventureGame to return to campaign after finish
    const originalFinish = AdventureGame._finishStory.bind(AdventureGame);
    AdventureGame._finishStory = () => {
      Audio.playVictory();
      App.stars += 3;
      localStorage.setItem('kq_stars', App.stars);
      // Return to campaign
      setTimeout(() => {
        this.running = true;
        this.stepIndex++;
        App.showScreen('campaign');
        AdventureGame._finishStory = originalFinish; // Restore
        this._runStep();
      }, 1500);
    };

    App.showScreen('adventure');
    AdventureGame.start(storyId);
  },

  _completeChapter() {
    this.chapterIndex = (this.chapterIndex + 1) % this.chapters.length;
    this.stepIndex    = 0;
    localStorage.setItem('kq_campaign_chapter', this.chapterIndex);

    if (this.chapterIndex === 0) {
      // Finished all chapters — back to free play
      Audio.playVictory();
      Audio.speak('You have completed all the chapters of Kingdom Quest! You are a true hero of the Kingdom! Now explore the free play map!', { rate: 0.85 });
      setTimeout(() => App.showScreen('map'), 2500);
      return;
    }

    // Continue to next chapter
    this._runStep();
  }
};
