// ===== CRITTER QUEST WORLD DATA =====
// Tile-based overworld map for the Pokemon-style mini adventure.
// Tile types: 0=grass 1=path 2=tree 3=water 4=mountain 5=building 6=flowers 7=sand

const CW_TILE = { GRASS:0, PATH:1, TREE:2, WATER:3, MOUNTAIN:4, BUILDING:5, FLOWERS:6, SAND:7 };

// 20 wide × 16 tall tile map
// T=tree/blocked, W=water/blocked, M=mountain/blocked, B=building/blocked
// .=grass, P=path, F=flowers, S=sand
const CW_RAW = [
  'MMMMMMMMMMMMMMMMMMMM',
  'M..P...FFF.....TTTM',
  'M..P..FFFFF...TTTTTM',
  'MBBPPP..F..PPPPTTTM',
  'MB.....PP..P....TTM',
  'M......PP..P.....TM',
  'MPPPPPPPP..PPPPPPTM',
  'M.......P..P....WWM',
  'MFFF....P..PSSWWWWM',
  'MFFFFF..P..PSSSWWWM',
  'M..FFF..P..P..SSSM',
  'M.......PPPP.....M',
  'M...B...........BM',
  'M...B.....FFF...BM',
  'M...PPPPPPPPP...PM',
  'MMMMMMMMMMMMMMMMMMMM',
];

// Walkability — false = blocked
const CW_SOLID = {
  [CW_TILE.TREE]: true,
  [CW_TILE.WATER]: true,
  [CW_TILE.MOUNTAIN]: true,
  [CW_TILE.BUILDING]: true,
};

function _parseMap(raw) {
  const map = [];
  const key = {
    'M': CW_TILE.MOUNTAIN,
    'T': CW_TILE.TREE,
    'W': CW_TILE.WATER,
    'B': CW_TILE.BUILDING,
    'P': CW_TILE.PATH,
    'F': CW_TILE.FLOWERS,
    'S': CW_TILE.SAND,
    '.': CW_TILE.GRASS,
  };
  for (const row of raw) {
    const r = [];
    for (const ch of row) r.push(key[ch] ?? CW_TILE.GRASS);
    map.push(r);
  }
  return map;
}

const CW_MAP = _parseMap(CW_RAW);
const CW_ROWS = CW_MAP.length;
const CW_COLS = CW_MAP[0].length;

// ---- NPC / Critter Definitions ----
// Each critter lives at a tile position and guards a mini-game.
// Drawn entirely with canvas primitives — no emojis on the game canvas.

const CW_NPCS = [
  {
    id:       'bunny',
    name:     'Bun-Bun',
    tagline:  'A fluffy bunny who loves sorting colours!',
    game:     'gemsort',       // launches this existing mini-game
    tileX:    10,
    tileY:    2,
    color:    '#f5deb3',       // fur colour
    earColor: '#ffb3c1',
    joined:   false,
  },
  {
    id:       'frog',
    name:     'Hopscotch',
    tagline:  'A cheerful frog who plays memory games!',
    game:     'match',
    tileX:    14,
    tileY:    8,
    color:    '#5dbb63',
    earColor: '#3a8a40',
    joined:   false,
  },
  {
    id:       'bear',
    name:     'Cinnamon',
    tagline:  'A cozy bear who loves spotting differences!',
    game:     'spotdiff',
    tileX:    4,
    tileY:    12,
    color:    '#c68642',
    earColor: '#a0522d',
    joined:   false,
  },
];

// Hero start position (tile coords)
const CW_HERO_START = { x: 9, y: 11 };
