// ===== CURRICULUM DATA =====
// Letters, numbers, words for kindergarten readiness

const CURRICULUM = {
  letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),

  letterSounds: {
    A: 'AH as in Apple',   B: 'BUH as in Banana', C: 'KUH as in Cat',
    D: 'DUH as in Dog',    E: 'EH as in Egg',      F: 'FUH as in Fish',
    G: 'GUH as in Goat',   H: 'HUH as in Hat',     I: 'IH as in Igloo',
    J: 'JUH as in Jump',   K: 'KUH as in King',    L: 'LUH as in Lion',
    M: 'MUH as in Mouse',  N: 'NUH as in Nest',     O: 'OH as in Otter',
    P: 'PUH as in Pan',    Q: 'KWUH as in Queen',  R: 'RUH as in Rain',
    S: 'SUH as in Sun',    T: 'TUH as in Tree',     U: 'UH as in Umbrella',
    V: 'VUH as in Vine',   W: 'WUH as in Water',   X: 'ECKS as in X-ray',
    Y: 'YUH as in Yellow', Z: 'ZUH as in Zebra'
  },

  letterEmoji: {
    A: '🍎', B: '🐝', C: '🐱', D: '🐶', E: '🥚', F: '🐟',
    G: '🐐', H: '🎩', I: '🧊', J: '🕹️', K: '👑', L: '🦁',
    M: '🐭', N: '🐦', O: '🦦', P: '🍳', Q: '👸', R: '🌧️',
    S: '☀️', T: '🌳', U: '☂️', V: '🍇', W: '💧', X: '🩻',
    Y: '💛', Z: '🦓'
  },

  // Letters grouped by difficulty for adaptive learning
  letterGroups: {
    easy:   ['A','B','C','D','E','F','G','H'],
    medium: ['I','J','K','L','M','N','O','P'],
    hard:   ['Q','R','S','T','U','V','W','X','Y','Z']
  },

  numbers: [1,2,3,4,5,6,7,8,9,10],

  numberWords: {
    1:'one', 2:'two', 3:'three', 4:'four', 5:'five',
    6:'six', 7:'seven', 8:'eight', 9:'nine', 10:'ten'
  },

  // Fun objects to count (thematic - treasure, kingdom items)
  countItems: [
    { emoji: '⭐', name: 'stars' },
    { emoji: '💎', name: 'gems' },
    { emoji: '🪙', name: 'coins' },
    { emoji: '🍎', name: 'apples' },
    { emoji: '⚔️', name: 'swords' },
    { emoji: '🛡️', name: 'shields' },
    { emoji: '🌟', name: 'magic stars' },
    { emoji: '🔑', name: 'keys' },
    { emoji: '🐑', name: 'sheep' },
    { emoji: '🕊️', name: 'doves' }
  ],

  // Reward messages
  rewards: [
    "Excellent, young hero! 🌟",
    "God made you SO smart! 🙏",
    "You are mighty and brave! ⚔️",
    "Amazing job, champion! 👑",
    "The kingdom is proud of you! 🏰",
    "Your wisdom grows every day! 📜",
    "Wonderful work, noble one! 🛡️",
    "You shine like a star! ✨"
  ],

  // Short Bible verses for rewards
  verses: [
    { text: "Be strong and courageous!", ref: "Joshua 1:9" },
    { text: "God is with you wherever you go.", ref: "Joshua 1:9" },
    { text: "I can do all things through Christ.", ref: "Philippians 4:13" },
    { text: "Trust in the Lord with all your heart.", ref: "Proverbs 3:5" },
    { text: "God loves you very much!", ref: "John 3:16" },
    { text: "Be kind and loving to each other.", ref: "Ephesians 4:32" },
    { text: "Children are a gift from God.", ref: "Psalm 127:3" },
    { text: "With God, all things are possible!", ref: "Matthew 19:26" }
  ],

  // Difficulty settings — all speeds are calm and unhurried
  difficulty: {
    easy:   { letters: 'easy',   maxNumber: 5,  mazeSize: 3, slicerSpeed: 0.6, tracePrecision: 60 },
    medium: { letters: 'easy',   maxNumber: 8,  mazeSize: 4, slicerSpeed: 0.85, tracePrecision: 50 },
    hard:   { letters: 'medium', maxNumber: 10, mazeSize: 5, slicerSpeed: 1.1, tracePrecision: 40 }
  }
};
