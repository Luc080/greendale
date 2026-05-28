// ============================================================
// DATA.JS – Alle Spielkonstanten
// Wird als erstes geladen, keine Abhängigkeiten
// ============================================================

var CHAINS = {
  sawmill:   { input: null,    inputAmt: 0, output: 'wood',      outputAmt: 2 },
  quarry:    { input: null,    inputAmt: 0, output: 'stone',     outputAmt: 2 },
  farm:      { input: null,    inputAmt: 0, output: 'wheat',     outputAmt: 3 },
  kitchen:   { input: 'wheat', inputAmt: 2, output: 'soup',      outputAmt: 1 },
  carpentry: { input: 'wood',  inputAmt: 3, output: 'furniture', outputAmt: 1 },
  brickyard: { input: 'stone', inputAmt: 3, output: 'brick',     outputAmt: 2 },
  bakery:    { input: 'wheat', inputAmt: 2, output: 'bread',     outputAmt: 2 },
  well:      { input: null,    inputAmt: 0, output: 'water',     outputAmt: 2 },
  warehouse: { input: null,    inputAmt: 0, output: null,        outputAmt: 0 },
  townhall:  { input: null,    inputAmt: 0, output: null,        outputAmt: 0 }
};

var BUILDING_TYPES = {
  sawmill:   { name: 'Saegewerk',  emoji: '🪓', costWood: 0,  costStone: 5,  reqXP: 0  },
  quarry:    { name: 'Steinbruch', emoji: '⛏',  costWood: 6,  costStone: 0,  reqXP: 0  },
  farm:      { name: 'Farm',       emoji: '🌾', costWood: 4,  costStone: 0,  reqXP: 0  },
  kitchen:   { name: 'Kueche',     emoji: '🍲', costWood: 8,  costStone: 4,  reqXP: 0  },
  carpentry: { name: 'Zimmerei',   emoji: '🪑', costWood: 12, costStone: 6,  reqXP: 20 },
  brickyard: { name: 'Ziegelei',   emoji: '🧱', costWood: 8,  costStone: 12, reqXP: 20 },
  bakery:    { name: 'Baeckerei',  emoji: '🥖', costWood: 10, costStone: 8,  reqXP: 40 },
  well:      { name: 'Brunnen',    emoji: '🪣', costWood: 6,  costStone: 10, reqXP: 10 },
  warehouse: { name: 'Lager',      emoji: '📦', costWood: 10, costStone: 8,  reqXP: 0  }
};

// Gebäude-Farben (gemütlicher Stil)
var BSTYLE = {
  townhall:  { wall: '#e8d5a3', roof: '#a05a20', accent: '#c8b070' },
  sawmill:   { wall: '#c9956b', roof: '#6b3a1f', accent: '#e8b090' },
  quarry:    { wall: '#b8b8c8', roof: '#606878', accent: '#d0d0e0' },
  farm:      { wall: '#c8e6a0', roof: '#6b8c20', accent: '#e8f4c0' },
  kitchen:   { wall: '#f5c87a', roof: '#a05a20', accent: '#fde8a0' },
  carpentry: { wall: '#d4a870', roof: '#5a3010', accent: '#f0c898' },
  brickyard: { wall: '#c8906a', roof: '#7a3a20', accent: '#e8b090' },
  bakery:    { wall: '#f0d090', roof: '#a06020', accent: '#fff0b0' },
  well:      { wall: '#b8c8d8', roof: '#607080', accent: '#d8e8f0' },
  warehouse: { wall: '#d4b896', roof: '#6b4a2a', accent: '#f0d4b4' }
};

// Villager-Pool (Hauttöne, Haare, Kleider)
var VILLAGER_POOL = [
  { name: 'Lena',  emoji: '👧', skin: '#f4c490', hair: '#8b4a1a', shirt: '#e05a8a', pants: '#5a7abf', reqXP: 0   },
  { name: 'Tom',   emoji: '👦', skin: '#e8a870', hair: '#3a2010', shirt: '#4a8adf', pants: '#4a5a70', reqXP: 0   },
  { name: 'Maria', emoji: '👩', skin: '#c8906a', hair: '#1a0a00', shirt: '#e06030', pants: '#705040', reqXP: 0   },
  { name: 'Felix', emoji: '🧑', skin: '#f0d0a0', hair: '#c8a030', shirt: '#40a060', pants: '#304860', reqXP: 30  },
  { name: 'Sara',  emoji: '👱', skin: '#f8e0c0', hair: '#e8c840', shirt: '#c050c0', pants: '#604080', reqXP: 60  },
  { name: 'Max',   emoji: '👨', skin: '#d0a880', hair: '#202020', shirt: '#506080', pants: '#303848', reqXP: 100 },
  { name: 'Klara', emoji: '🧒', skin: '#f0c8a0', hair: '#c05020', shirt: '#e0a020', pants: '#806020', reqXP: 150 }
];

var ORDER_TEMPLATES = [
  { items: { wood: 5 },               xp: 10, label: '5x Holz'              },
  { items: { stone: 5 },              xp: 10, label: '5x Stein'             },
  { items: { wheat: 6 },              xp: 12, label: '6x Weizen'            },
  { items: { soup: 3 },               xp: 20, label: '3x Suppe'             },
  { items: { wood: 4, stone: 4 },     xp: 18, label: '4x Holz + 4x Stein'  },
  { items: { furniture: 2 },          xp: 30, label: '2x Moebel'            },
  { items: { brick: 3 },              xp: 28, label: '3x Ziegel'            },
  { items: { soup: 2, furniture: 1 }, xp: 40, label: '2x Suppe + 1x Moebel'},
  { items: { wood: 8 },               xp: 22, label: '8x Holz'             },
  { items: { stone: 6, brick: 2 },    xp: 35, label: '6x Stein + 2x Ziegel'}
];

function makeOrder(i) {
  var t = ORDER_TEMPLATES[Math.floor(Math.random() * ORDER_TEMPLATES.length)];
  return { id: Date.now() + i, items: JSON.parse(JSON.stringify(t.items)), xp: t.xp, label: t.label };
}
function generateOrders() {
  return [makeOrder(0), makeOrder(1), makeOrder(2), makeOrder(3)];
}

// Karten-Konstanten
var TW = 64, TH = 32, COLS = 14, ROWS = 12;
var PRODUCE_INTERVAL = 220;
var HUNGER_INTERVAL  = 10;
var MAX_HUNGER = 5;
var FRICTION = 0.82, ACCEL = 0.018, ARRIVE_DIST = 0.08;
