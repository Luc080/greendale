// ============================================================
// DATA.JS – Phase 5
// Neu: i18n DE/EN, verlangsamte Bewegung, smarte Aufträge
// ============================================================

// ============================================================
// ÜBERSETZUNGEN (i18n)
// ============================================================
var LANG = 'de';

var I18N = {
  de: {
    online: '🟢 Online', connecting: '🟡 Verbinde...', offline: '🔴 Offline',
    save: '💾 Speichern', saved: '💾 Gespeichert!',
    saveFail: '⚠️ Speichern fehlgeschlagen: ',
    day: '⏱ Tag ',
    levelUp: '🏅 LEVEL UP! 🎉',
    hired: ' ist beigetreten! 🎉',
    hiredTitle: '🎉 Neuer Mitarbeiter!',
    hiredDesc: ' möchte deinem Dorf beitreten!\nIn der Sidebar "Einstellen" klicken.',
    alreadyHere: ' ist schon da!',
    notEnoughXP: 'Zu wenig XP!',
    notEnoughCoins: 'Zu wenig Coins!',
    notEnoughRes: 'Nicht genug Ressourcen! 🪵',
    notEnough: 'Nicht genug ',
    alreadyOccupied: 'Bereits belegt!',
    outsideBounds: 'Ausserhalb!',
    noWater: 'Nicht auf Wasser!',
    built: ' gebaut! ✅',
    reqLevel: ' erfordert Level ',
    reqXP: 'Benötigt ⭐',
    tabVillagers: '👤 Villager',
    tabBuild: '🏗 Bauen',
    tabChains: '⛓ Ketten',
    tabCasino: '🎰 Casino',
    tabTrade: '🤝 Handel',
    tabChat: '💬 Chat',
    tabLeaderboard: '🏆 Rangliste',
    sidebarValley: '🏔 Valley',
    sidebarOrders: '📋 Aufträge',
    sidebarVillagers: '👥 Dorfbewohner',
    sidebarPlayers: '🌐 Mitspieler',
    sidebarResources: '📦 Lager',
    waitOrders: 'Warte auf Server...',
    noPlayers: 'Keine Mitspieler',
    noVillagers: 'Keine Villager.',
    idle: '😴 Idle', working: '🔨 arbeitet',
    deliver: '✓ Liefern', wait: 'warten',
    assignBtn: ' zuweisen', removeBtn: ' abziehen',
    openCasino: '🎰 Casino öffnen',
    cancelBuild: 'abbrechen',
    buildHint: '📍 Klick auf Karte — ',
    casinoLocked: '🎰 Casino freischaltbar ab <strong>Level 5</strong><br>Aktuell: Level ',
    casinoXPMissing: ' – noch ', casinoXPSuffix: ' XP fehlen',
    casinoBuildFirst: '🎰 Baue zuerst ein <strong>Casino</strong> (🪵20 🪨20)<br>',
    casinoBuildNow: '→ Jetzt bauen',
    noTradePartners: 'Keine Mitspieler online zum Handeln.',
    tradeTitle: '🤝 Ressourcen tauschen',
    tradeChoose: 'Wähle einen Mitspieler:',
    tradeOffer: 'Ich biete', tradeRequest: 'Ich möchte',
    tradeSend: '🤝 Angebot senden',
    tradeEmpty: 'Kein Angebot eingetragen!',
    tradeSent: 'Angebot an ', tradeSentSuffix: ' gesendet!',
    tradeFrom: '🤝 Handelsangebot von ',
    tradeOffers: 'Bietet dir: ', tradeWants: 'Möchte: ',
    tradeAccept: '✅ Annehmen', tradeDecline: '❌ Ablehnen',
    tradeCompleted: '✅ Handel mit ', tradeCompletedSuffix: ' abgeschlossen!',
    chatPlaceholder: 'Nachricht...',
    cloudLoaded: '☁️ Cloud-Spielstand geladen!',
    joined: 'Du bist Valley "', joinedSuffix: '" beigetreten!',
    playerJoined: ' ist beigetreten 👋',
    playerJoinedNotif: '👋 ', playerJoinedSuffix: ' ist dabei!',
    playerLeft: ' hat das Valley verlassen',
    eventStarted: '🎉 ', eventStartedSuffix: ' gestartet!',
    eventCompleted: '🎉 Event abgeschlossen!',
    leaderboardTitle: '🏆 Valley-Rangliste',
    leaderboardEmpty: 'Keine Spieler online.',
    leaderboardYou: ' (du)',
    settingsTitle: '⚙️ Einstellungen',
    settingsLang: 'Sprache / Language:',
    settingsSounds: '🔊 Sounds:',
    settingsOn: 'An', settingsOff: 'Aus',
    settingsClose: 'Schliessen',
    upgradeBtn: '⬆️ Upgrade (Lvl ',
    upgradeSuffix: ')',
    upgradeNotEnough: 'Nicht genug Ressourcen für Upgrade!',
    upgradeSuccess: ' auf Level ',
    upgradeMax: ' ist bereits maximal aufgerüstet!',
    levelLabel: 'Lvl',
    noOrders: '(Baue zuerst passende Gebäude)',
    hjoin: ' geladen – Tag ',
  },
  en: {
    online: '🟢 Online', connecting: '🟡 Connecting...', offline: '🔴 Offline',
    save: '💾 Save', saved: '💾 Saved!',
    saveFail: '⚠️ Save failed: ',
    day: '⏱ Day ',
    levelUp: '🏅 LEVEL UP! 🎉',
    hired: ' joined! 🎉',
    hiredTitle: '🎉 New Villager!',
    hiredDesc: ' wants to join your village!\nClick "Hire" in the sidebar.',
    alreadyHere: ' is already here!',
    notEnoughXP: 'Not enough XP!',
    notEnoughCoins: 'Not enough Coins!',
    notEnoughRes: 'Not enough resources! 🪵',
    notEnough: 'Not enough ',
    alreadyOccupied: 'Already occupied!',
    outsideBounds: 'Out of bounds!',
    noWater: 'Cannot build on water!',
    built: ' built! ✅',
    reqLevel: ' requires Level ',
    reqXP: 'Requires ⭐',
    tabVillagers: '👤 Villagers',
    tabBuild: '🏗 Build',
    tabChains: '⛓ Chains',
    tabCasino: '🎰 Casino',
    tabTrade: '🤝 Trade',
    tabChat: '💬 Chat',
    tabLeaderboard: '🏆 Leaderboard',
    sidebarValley: '🏔 Valley',
    sidebarOrders: '📋 Orders',
    sidebarVillagers: '👥 Villagers',
    sidebarPlayers: '🌐 Players',
    sidebarResources: '📦 Storage',
    waitOrders: 'Waiting for server...',
    noPlayers: 'No players online',
    noVillagers: 'No villagers.',
    idle: '😴 Idle', working: '🔨 working',
    deliver: '✓ Deliver', wait: 'wait',
    assignBtn: ' assign', removeBtn: ' remove',
    openCasino: '🎰 Open Casino',
    cancelBuild: 'cancel',
    buildHint: '📍 Click on map — ',
    casinoLocked: '🎰 Casino unlocks at <strong>Level 5</strong><br>Current: Level ',
    casinoXPMissing: ' – ', casinoXPSuffix: ' XP missing',
    casinoBuildFirst: '🎰 First build a <strong>Casino</strong> (🪵20 🪨20)<br>',
    casinoBuildNow: '→ Build now',
    noTradePartners: 'No players online to trade.',
    tradeTitle: '🤝 Trade Resources',
    tradeChoose: 'Choose a player:',
    tradeOffer: 'I offer', tradeRequest: 'I want',
    tradeSend: '🤝 Send offer',
    tradeEmpty: 'No offer entered!',
    tradeSent: 'Offer sent to ', tradeSentSuffix: '!',
    tradeFrom: '🤝 Trade offer from ',
    tradeOffers: 'Offers you: ', tradeWants: 'Wants: ',
    tradeAccept: '✅ Accept', tradeDecline: '❌ Decline',
    tradeCompleted: '✅ Trade with ', tradeCompletedSuffix: ' completed!',
    chatPlaceholder: 'Message...',
    cloudLoaded: '☁️ Cloud save loaded!',
    joined: 'You joined Valley "', joinedSuffix: '"!',
    playerJoined: ' joined 👋',
    playerJoinedNotif: '👋 ', playerJoinedSuffix: ' joined!',
    playerLeft: ' left the valley',
    eventStarted: '🎉 ', eventStartedSuffix: ' started!',
    eventCompleted: '🎉 Event completed!',
    leaderboardTitle: '🏆 Valley Leaderboard',
    leaderboardEmpty: 'No players online.',
    leaderboardYou: ' (you)',
    settingsTitle: '⚙️ Settings',
    settingsLang: 'Language / Sprache:',
    settingsSounds: '🔊 Sounds:',
    settingsOn: 'On', settingsOff: 'Off',
    settingsClose: 'Close',
    upgradeBtn: '⬆️ Upgrade (Lvl ',
    upgradeSuffix: ')',
    upgradeNotEnough: 'Not enough resources for upgrade!',
    upgradeSuccess: ' upgraded to Level ',
    upgradeMax: ' is already fully upgraded!',
    levelLabel: 'Lvl',
    noOrders: '(Build matching buildings first)',
    hjoin: ' loaded – Day ',
  }
};

function t(key) {
  return (I18N[LANG] && I18N[LANG][key] !== undefined) ? I18N[LANG][key] : (I18N['de'][key] || key);
}

// ============================================================
// PRODUKTIONS-KETTEN
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

// Upgrade-Kosten pro Gebäude-Typ (auf Level 2)
var UPGRADE_COSTS = {
  sawmill:   { wood: 8,  stone: 10 },
  quarry:    { wood: 10, stone: 8  },
  farm:      { wood: 10, stone: 5  },
  kitchen:   { wood: 12, stone: 8  },
  carpentry: { wood: 15, stone: 10 },
  brickyard: { wood: 10, stone: 15 },
  bakery:    { wood: 14, stone: 10 },
  well:      { wood: 8,  stone: 12 },
  smithy:    { wood: 18, stone: 20 }
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
// AUFTRAGS-TEMPLATES mit Gebäude-Mapping
// ============================================================
var ORDER_TEMPLATES = [
  { items: { wood: 5 },               xp: 10,  coins: 5,  label: '5x Holz',             needs: ['sawmill']              },
  { items: { stone: 5 },              xp: 10,  coins: 5,  label: '5x Stein',             needs: ['quarry']               },
  { items: { wheat: 6 },              xp: 12,  coins: 6,  label: '6x Weizen',            needs: ['farm']                 },
  { items: { soup: 3 },               xp: 20,  coins: 10, label: '3x Suppe',             needs: ['kitchen']              },
  { items: { wood: 4, stone: 4 },     xp: 18,  coins: 9,  label: '4x Holz + 4x Stein',  needs: ['sawmill','quarry']     },
  { items: { furniture: 2 },          xp: 30,  coins: 15, label: '2x Möbel',             needs: ['carpentry']            },
  { items: { brick: 3 },              xp: 28,  coins: 14, label: '3x Ziegel',            needs: ['brickyard']            },
  { items: { soup: 2, furniture: 1 }, xp: 40,  coins: 20, label: '2x Suppe + 1x Möbel', needs: ['kitchen','carpentry']  },
  { items: { wood: 8 },               xp: 22,  coins: 11, label: '8x Holz',              needs: ['sawmill']              },
  { items: { stone: 6, brick: 2 },    xp: 35,  coins: 18, label: '6x Stein + 2x Ziegel',needs: ['quarry','brickyard']   },
  { items: { bread: 4 },              xp: 32,  coins: 16, label: '4x Brot',              needs: ['bakery']               },
  { items: { tool: 2 },               xp: 50,  coins: 25, label: '2x Werkzeug',          needs: ['smithy']               },
];

// Gibt verfügbare Templates zurück (nur wenn Gebäude gebaut)
function getAvailableTemplates(buildings) {
  var builtTypes = {};
  for (var i = 0; i < buildings.length; i++) builtTypes[buildings[i].type] = true;
  var available = ORDER_TEMPLATES.filter(function(t) {
    if (!t.needs) return true;
    for (var j = 0; j < t.needs.length; j++)
      if (!builtTypes[t.needs[j]]) return false;
    return true;
  });
  // Fallback: wenn noch zu wenig Gebäude → Basis-Templates
  if (available.length < 3) {
    return [ORDER_TEMPLATES[0], ORDER_TEMPLATES[1], ORDER_TEMPLATES[2]];
  }
  return available;
}

function makeOrder(i, buildings) {
  var pool = buildings ? getAvailableTemplates(buildings) : ORDER_TEMPLATES;
  var t = pool[Math.floor(Math.random() * pool.length)];
  return { id: Date.now() + i, items: JSON.parse(JSON.stringify(t.items)), xp: t.xp, coins: t.coins || 5, label: t.label };
}
function generateOrders(buildings) {
  return [makeOrder(0, buildings), makeOrder(1, buildings), makeOrder(2, buildings), makeOrder(3, buildings)];
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
// BEWEGUNGS-PHYSIK – Phase 5: deutlich verlangsamt
// ============================================================
var FRICTION    = 0.88;
var ACCEL       = 0.003;   // war 0.006
var ARRIVE_DIST = 0.15;
var MAX_SPEED   = 0.018;   // war 0.035

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
