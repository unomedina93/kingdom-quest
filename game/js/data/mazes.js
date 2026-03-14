// ===== MAZE LEVEL DATA + PROCEDURAL GENERATOR =====
// Mazes are generated fresh each play using recursive-backtracker (DFS),
// so the layout is always different. Only the theme (art, colors, story) is fixed.

// ---- Recursive-backtracker maze generator ----
// Returns an array of cell objects: { r, c, open: ['N','S','E','W'], start?, goal? }
function generateMazeCells(rows, cols) {
  // Create grid — all walls closed
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ r, c, open: [] });
    }
  }

  const get = (r, c) =>
    (r >= 0 && r < rows && c >= 0 && c < cols) ? cells[r * cols + c] : null;

  const DIRS = [
    { dir: 'N', dr: -1, dc:  0, opp: 'S' },
    { dir: 'S', dr:  1, dc:  0, opp: 'N' },
    { dir: 'E', dr:  0, dc:  1, opp: 'W' },
    { dir: 'W', dr:  0, dc: -1, opp: 'E' },
  ];

  const visited = new Set();
  const stack   = [];
  visited.add('0,0');
  stack.push(get(0, 0));

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const unvisited = DIRS
      .map(d => ({ ...d, nb: get(cur.r + d.dr, cur.c + d.dc) }))
      .filter(d => d.nb && !visited.has(`${d.nb.r},${d.nb.c}`));

    if (unvisited.length > 0) {
      const chosen = unvisited[Math.floor(Math.random() * unvisited.length)];
      cur.open.push(chosen.dir);
      chosen.nb.open.push(chosen.opp);
      visited.add(`${chosen.nb.r},${chosen.nb.c}`);
      stack.push(chosen.nb);
    } else {
      stack.pop();
    }
  }

  // Start = top-left, Goal = bottom-right
  get(0,        0       ).start = true;
  get(rows - 1, cols - 1).goal  = true;

  return cells;
}

// ---- Level themes ----
// `rows`/`cols` define the maze size; cells are generated fresh on each play.
// 20 themes means kids cycle through many different stories and colors
// before repeating — and since the layout is random each time, even the
// same theme feels new every play.
const MAZES = [
  {
    id: 1,
    title: "Moses & the Burning Bush",
    heroPrompt: "Help Moses find the burning bush!",
    startArt: '🧔', goalArt: '🔥',
    goalText: "The burning bush! God speaks to Moses!",
    rows: 5, cols: 5,
    bgColor: '#2a1a0a', floorColor: '#5a7a3a', wallColor: '#c8903a',
  },
  {
    id: 2,
    title: "Noah's Ark",
    heroPrompt: "Help Noah reach his big boat!",
    startArt: '👨‍🦳', goalArt: '🚢',
    goalText: "The ark! Noah and the animals are safe!",
    rows: 5, cols: 6,
    bgColor: '#0a1a2a', floorColor: '#1a4a6a', wallColor: '#5c3d1e',
  },
  {
    id: 3,
    title: "Baby Moses",
    heroPrompt: "Help find baby Moses in the basket!",
    startArt: '👩', goalArt: '🧺',
    goalText: "Baby Moses is found! God protects him!",
    rows: 6, cols: 5,
    bgColor: '#0a1e10', floorColor: '#1a5a3a', wallColor: '#5a8a40',
  },
  {
    id: 4,
    title: "David & Goliath",
    heroPrompt: "Help David find his sling and stone!",
    startArt: '🤴', goalArt: '⚔️',
    goalText: "David is brave! With God all things are possible!",
    rows: 6, cols: 7,
    bgColor: '#1a1200', floorColor: '#6a5a3a', wallColor: '#7a5030',
  },
  {
    id: 5,
    title: "Daniel's Courage",
    heroPrompt: "Help Daniel reach his prayer room!",
    startArt: '🙏', goalArt: '⭐',
    goalText: "Daniel prays to God — brave and strong!",
    rows: 7, cols: 6,
    bgColor: '#0a0a1e', floorColor: '#2a2a5a', wallColor: '#7a6040',
  },
  {
    id: 6,
    title: "Joseph's Journey",
    heroPrompt: "Help Joseph find his colorful coat!",
    startArt: '👦', goalArt: '🌈',
    goalText: "Joseph's colorful coat! God's plan is perfect!",
    rows: 7, cols: 7,
    bgColor: '#1a001a', floorColor: '#4a2a5a', wallColor: '#8a5040',
  },
  {
    id: 7,
    title: "Jonah & the Whale",
    heroPrompt: "Help Jonah find his way to the sea!",
    startArt: '🧑', goalArt: '🐳',
    goalText: "Jonah obeys God and is free!",
    rows: 7, cols: 8,
    bgColor: '#001020', floorColor: '#0a2a4a', wallColor: '#2a5a7a',
  },
  {
    id: 8,
    title: "Esther's Courage",
    heroPrompt: "Help Queen Esther reach the throne room!",
    startArt: '👸', goalArt: '👑',
    goalText: "Esther is brave! She saves her people!",
    rows: 8, cols: 7,
    bgColor: '#1a0a20', floorColor: '#3a1a4a', wallColor: '#c0508a',
  },
  {
    id: 9,
    title: "Jesus Feeds Everyone",
    heroPrompt: "Find the loaves and the fishes!",
    startArt: '🕊️', goalArt: '🐟',
    goalText: "Jesus feeds 5000 with 5 loaves and 2 fish!",
    rows: 8, cols: 8,
    bgColor: '#1a1000', floorColor: '#5a4520', wallColor: '#9a7040',
  },
  {
    id: 10,
    title: "Ruth & Naomi",
    heroPrompt: "Help Ruth find the wheat field!",
    startArt: '👩‍🦰', goalArt: '🌾',
    goalText: "Ruth is kind and loyal! God blesses her!",
    rows: 6, cols: 6,
    bgColor: '#1a1500', floorColor: '#6a6a20', wallColor: '#8a7030',
  },
  {
    id: 11,
    title: "Joshua & Jericho",
    heroPrompt: "Help Joshua march around Jericho!",
    startArt: '⚔️', goalArt: '🏰',
    goalText: "The walls fell down! God gives the victory!",
    rows: 8, cols: 7,
    bgColor: '#1e1005', floorColor: '#5a4010', wallColor: '#b07030',
  },
  {
    id: 12,
    title: "Adam & Eve Garden",
    heroPrompt: "Explore the beautiful Garden of Eden!",
    startArt: '🧑', goalArt: '🌳',
    goalText: "The Tree of Life! God made everything good!",
    rows: 6, cols: 7,
    bgColor: '#051a05', floorColor: '#1a6a1a', wallColor: '#3a9a3a',
  },
  {
    id: 13,
    title: "Elijah & the Ravens",
    heroPrompt: "Help Elijah find food in the wilderness!",
    startArt: '🧙', goalArt: '🐦',
    goalText: "Ravens bring Elijah food! God provides!",
    rows: 8, cols: 9,
    bgColor: '#150a00', floorColor: '#4a3010', wallColor: '#8a6020',
  },
  {
    id: 14,
    title: "Solomon's Temple",
    heroPrompt: "Help Solomon find the altar!",
    startArt: '🤴', goalArt: '🕍',
    goalText: "Solomon builds God a beautiful temple!",
    rows: 9, cols: 8,
    bgColor: '#0a0a05', floorColor: '#3a3010', wallColor: '#c0a040',
  },
  {
    id: 15,
    title: "Peter's Fishing",
    heroPrompt: "Help Peter reach his fishing boat!",
    startArt: '🎣', goalArt: '⛵',
    goalText: "A huge catch of fish! Jesus is amazing!",
    rows: 7, cols: 8,
    bgColor: '#000a1a', floorColor: '#0a3050', wallColor: '#3070a0',
  },
  {
    id: 16,
    title: "Zacchaeus in the Tree",
    heroPrompt: "Help Zacchaeus climb to see Jesus!",
    startArt: '🧍', goalArt: '🌲',
    goalText: "Jesus sees Zacchaeus! Everyone is loved!",
    rows: 8, cols: 8,
    bgColor: '#051505', floorColor: '#205a20', wallColor: '#508a30',
  },
  {
    id: 17,
    title: "Paul's Journey",
    heroPrompt: "Help Paul sail to spread the good news!",
    startArt: '🚶', goalArt: '⚓',
    goalText: "Paul spreads God's love everywhere!",
    rows: 9, cols: 9,
    bgColor: '#001530', floorColor: '#0a3060', wallColor: '#2060a0',
  },
  {
    id: 18,
    title: "Nehemiah Rebuilds",
    heroPrompt: "Help Nehemiah rebuild the city walls!",
    startArt: '🔨', goalArt: '🏯',
    goalText: "The walls are rebuilt! God's people are home!",
    rows: 9, cols: 10,
    bgColor: '#1a1000', floorColor: '#4a3a10', wallColor: '#9a7020',
  },
  {
    id: 19,
    title: "Abraham's Star Journey",
    heroPrompt: "Help Abraham follow the stars God showed him!",
    startArt: '🌟', goalArt: '🏕️',
    goalText: "Abraham trusted God! He found the promised land!",
    rows: 10, cols: 9,
    bgColor: '#000010', floorColor: '#10103a', wallColor: '#6060c0',
  },
  {
    id: 20,
    title: "Jesus & the Disciples",
    heroPrompt: "Help the disciples find Jesus on the shore!",
    startArt: '🚣', goalArt: '✝️',
    goalText: "Jesus is risen! He is with us always!",
    rows: 10, cols: 10,
    bgColor: '#0a0505', floorColor: '#2a1a0a', wallColor: '#c0802a',
  },
];

// Helper: build a fast-lookup map from generated cells
function buildMazeLookup(maze) {
  const map = {};
  maze.cells.forEach(cell => { map[`${cell.r},${cell.c}`] = cell; });
  return map;
}

// Helper: can the hero move from (r,c) in direction dir?
function canMove(mazeMap, r, c, dir) {
  const cell = mazeMap[`${r},${c}`];
  return cell && cell.open.includes(dir);
}
