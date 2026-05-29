// ============================================================
// DATA.JS – Phase 4
// Neu: Werkzeug-Kette, Münzen, Casino-Level, Handel
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
  smithy:    { input: 'stone', inputAmt: 2, output: 'tool',      outputAmt: 1, inputB: 'wood', inputAmtB: 1 },
  warehouse: { input: null,    inputAmt: 0, output: null,        outputAmt: 0 },
  townhall:  { input: null,    inputAmt: 0, output: null,        outputAmt: 0 },
  casino:    { input: null,    inputAmt: 0, output: null,        outputAmt: 0 }
};

var BUILDING_TYPES = {
  sawmill:   { name: 'Sägewerk',   emoji: '🪓', costWood: 0,  costStone: 5,  reqXP: 0    },
  quarry:    { name: 'Steinbruch', emoji: '⛏',  costWood: 6,  costStone: 0,  reqXP: 0    },
  farm:      { name: 'Farm',       emoji: '🌾', costWood: 4,  costStone: 0,  reqXP: 0    },
  kitchen:   { name: 'Küche',      emoji: '🍲', costWood: 8,  costStone: 4,  reqXP: 0    },
  carpentry: { name: 'Zimmerei',   emoji: '🪑', costWood: 12, costStone: 6,  reqXP: 80   },
  brickyard: { name: 'Ziegelei',   emoji: '🧱', costWood: 8,  costStone: 12, reqXP: 80   },
  bakery:    { name: 'Bäckerei',   emoji: '🥖', costWood: 10, costStone: 8,  reqXP: 180  },
  well:      { name: 'Brunnen',    emoji: '🪣', costWood: 6,  costStone: 10, reqXP: 40   },
  smithy:    { name: 'Schmiede',   emoji: '⚒️', costWood: 15, costStone: 18, reqXP: 320  },
  warehouse: { name: 'Lager',      emoji: '📦', costWood: 10, costStone: 8,  reqXP: 0    },
  casino:    { name: 'Casino',     emoji: '🎰', costWood: 20, costStone: 20, reqXP: 950, reqLevel: 5 }
};

// Gebäude-Farben (BSTYLE)
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
  warehouse: { wall: '#d4b896', roof: '#6b4a2a', accent: '#f0d4b4' },
  smithy:    { wall: '#9a8878', roof: '#3a2a1a', accent: '#c8a880' },
  casino:    { wall: '#1a0a2a', roof: '#8b0020', accent: '#ffd700' }
};

// ============================================================
// VILLAGER POOL
// ============================================================
var VILLAGER_POOL = [
  { name: 'Lena',   emoji: '👧', skin: '#f4c490', hair: '#8b4a1a', shirt: '#e05a8a', pants: '#5a7abf', reqXP: 0    },
  { name: 'Tom',    emoji: '👦', skin: '#e8a870', hair: '#3a2010', shirt: '#4a8adf', pants: '#4a5a70', reqXP: 0    },
  { name: 'Maria',  emoji: '👩', skin: '#c8906a', hair: '#1a0a00', shirt: '#e06030', pants: '#705040', reqXP: 0    },
  { name: 'Felix',  emoji: '🧑', skin: '#f0d0a0', hair: '#c8a030', shirt: '#40a060', pants: '#304860', reqXP: 80   },
  { name: 'Sara',   emoji: '👱', skin: '#f8e0c0', hair: '#e8c840', shirt: '#c050c0', pants: '#604080', reqXP: 180  },
  { name: 'Max',    emoji: '👨', skin: '#d0a880', hair: '#202020', shirt: '#506080', pants: '#303848', reqXP: 320  },
  { name: 'Klara',  emoji: '🧒', skin: '#f0c8a0', hair: '#c05020', shirt: '#e0a020', pants: '#806020', reqXP: 500  },
  { name: 'Bruno',  emoji: '🧔', skin: '#c8a070', hair: '#2a1a00', shirt: '#7a3a20', pants: '#3a2810', reqXP: 720  },
  { name: 'Hanna',  emoji: '👩', skin: '#f2d0b0', hair: '#d04020', shirt: '#30a0a0', pants: '#205060', reqXP: 1000 },
  { name: 'Lukas',  emoji: '👦', skin: '#e0c090', hair: '#101010', shirt: '#8060c0', pants: '#403060', reqXP: 1350 },
  { name: 'Emma',   emoji: '👧', skin: '#f6dfc0', hair: '#b07030', shirt: '#d06080', pants: '#804060', reqXP: 1760 },
  { name: 'Noah',   emoji: '🧑', skin: '#d8a878', hair: '#181008', shirt: '#206040', pants: '#183828', reqXP: 2250 },
  { name: 'Mia',    emoji: '👩', skin: '#f0c8a8', hair: '#c89030', shirt: '#e08020', pants: '#704010', reqXP: 2820 },
  { name: 'Jonas',  emoji: '👨', skin: '#c89060', hair: '#080808', shirt: '#304870', pants: '#202838', reqXP: 3500 },
  { name: 'Sophia', emoji: '👱', skin: '#fce0c0', hair: '#f0d040', shirt: '#a030d0', pants: '#602080', reqXP: 4300 }
];

var VILLAGER_NAMES_EXTRA = [
  'Alex','Robin','Chris','Sam','Dana','Jordan','Taylor','Morgan',
  'Casey','Quinn','Avery','Reese','Blake','Cameron','Drew',
  'Hayden','Jamie','Kendall','Logan','Riley','Pat','Skye','River',
  'Phoenix','Sage','Indigo','Marlowe','Finley','Rowan','Sloane'
];
var VILLAGER_EMOJIS = ['🧑','👦','👧','👩','👨','👱','🧔','🧒'];
var VILLAGER_SHIRTS = ['#e05a8a','#4a8adf','#e06030','#40a060','#c050c0','#506080','#e0a020','#30a0a0','#8060c0','#206040'];
var VILLAGER_PANTS  = ['#5a7abf','#4a5a70','#705040','#304860','#604080','#303848','#806020','#205060','#403060','#183828'];

function getExtraVillagerXP(index) {
  var base  = 4300;
  var extra = 0;
  for (var i = 15; i < index; i++) extra += 1000 + (i - 15) * 200;
  return base + extra;
}

// ============================================================
// AUFTRAGS-TEMPLATES (Clientseitig für Offline)
// ============================================================
var ORDER_TEMPLATES = [
  { items: { wood: 5 },               xp: 10,  coins: 5,  label: '5x Holz'              },
  { items: { stone: 5 },              xp: 10,  coins: 5,  label: '5x Stein'             },
  { items: { wheat: 6 },              xp: 12,  coins: 6,  label: '6x Weizen'            },
  { items: { soup: 3 },               xp: 20,  coins: 10, label: '3x Suppe'             },
  { items: { wood: 4, stone: 4 },     xp: 18,  coins: 9,  label: '4x Holz + 4x Stein'  },
  { items: { furniture: 2 },          xp: 30,  coins: 15, label: '2x Möbel'             },
  { items: { brick: 3 },              xp: 28,  coins: 14, label: '3x Ziegel'            },
  { items: { soup: 2, furniture: 1 }, xp: 40,  coins: 20, label: '2x Suppe + 1x Möbel' },
  { items: { wood: 8 },               xp: 22,  coins: 11, label: '8x Holz'              },
  { items: { stone: 6, brick: 2 },    xp: 35,  coins: 18, label: '6x Stein + 2x Ziegel'},
  { items: { bread: 4 },              xp: 32,  coins: 16, label: '4x Brot'              },
  { items: { tool: 2 },               xp: 50,  coins: 25, label: '2x Werkzeug'          },
];

function makeOrder(i) {
  var t = ORDER_TEMPLATES[Math.floor(Math.random() * ORDER_TEMPLATES.length)];
  return { id: Date.now() + i, items: JSON.parse(JSON.stringify(t.items)), xp: t.xp, coins: t.coins || 5, label: t.label };
}
function generateOrders() {
  return [makeOrder(0), makeOrder(1), makeOrder(2), makeOrder(3)];
}

// ============================================================
// KARTEN-KONSTANTEN
// ============================================================
var TW   = 80;
var TH   = 40;
var COLS = 20;
var ROWS = 16;

// ============================================================
// PRODUKTIONS-TIMING
// ============================================================
var PRODUCE_INTERVAL = 480;
var HUNGER_INTERVAL  = 20;
var MAX_HUNGER       = 5;

// ============================================================
// BEWEGUNGS-PHYSIK
// ============================================================
var FRICTION    = 0.90;
var ACCEL       = 0.006;
var ARRIVE_DIST = 0.15;

// ============================================================
// LEVEL-SYSTEM
// ============================================================
var LEVEL_THRESHOLDS = [
  0, 50, 130, 250, 420, 650, 950, 1320, 1780, 2350,
  3050, 3900, 4920, 6130, 7550, 9200, 11100, 13300, 15800, 18700
];

function getLevel(xp) {
  var lvl = 1;
  for (var i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

function getXPForNextLevel(xp) {
  var lvl = getLevel(xp);
  if (lvl >= LEVEL_THRESHOLDS.length) return null;
  return LEVEL_THRESHOLDS[lvl];
}

// ============================================================
// CASINO – Slot Machine Symbole & Payouts
// ============================================================
var SLOT_SYMBOLS = [
  { emoji: '🍒', name: 'Kirsche',   weight: 30, payout: 2  },
  { emoji: '🍋', name: 'Zitrone',   weight: 25, payout: 3  },
  { emoji: '🍊', name: 'Orange',    weight: 20, payout: 4  },
  { emoji: '🍇', name: 'Trauben',   weight: 15, payout: 6  },
  { emoji: '🔔', name: 'Glocke',    weight: 7,  payout: 10 },
  { emoji: '⭐', name: 'Stern',     weight: 2,  payout: 20 },
  { emoji: '💎', name: 'Diamant',   weight: 1,  payout: 50 }
];
var SLOT_TOTAL_WEIGHT = SLOT_SYMBOLS.reduce(function(s, x) { return s + x.weight; }, 0);

function spinSlot() {
  var r = Math.random() * SLOT_TOTAL_WEIGHT;
  var acc = 0;
  for (var i = 0; i < SLOT_SYMBOLS.length; i++) {
    acc += SLOT_SYMBOLS[i].weight;
    if (r <= acc) return SLOT_SYMBOLS[i];
  }
  return SLOT_SYMBOLS[0];
}

// Blackjack Karten
var BJ_VALUES = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,
  'J':10,'Q':10,'K':10,'A':11
};
var BJ_SUITS = ['♠','♥','♦','♣'];
var BJ_RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function makeDeck() {
  var deck = [];
  for (var s = 0; s < BJ_SUITS.length; s++)
    for (var r = 0; r < BJ_RANKS.length; r++)
      deck.push({ rank: BJ_RANKS[r], suit: BJ_SUITS[s] });
  // Shuffle
  for (var i = deck.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
  }
  return deck;
}

function bjHandValue(hand) {
  var val = 0, aces = 0;
  for (var i = 0; i < hand.length; i++) {
    val += BJ_VALUES[hand[i].rank];
    if (hand[i].rank === 'A') aces++;
  }
  while (val > 21 && aces > 0) { val -= 10; aces--; }
  return val;
}
