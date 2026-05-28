// ============================================================
// STATE.JS – Spielzustand, Produktion, Save/Load
// Abhängig von: data.js
// ============================================================

var SAVE_KEY_PREFIX = 'greendale_v6_';

var state = {
  playerName:       'Spieler',
  resources:        { wood: 24, stone: 12, wheat: 8, soup: 4, furniture: 0, brick: 0, bread: 0, water: 0 },
  xp:               0,
  day:              1,
  tick:             0,
  selectedBuilding: null,
  selectedVillager: null,
  buildMode:        null,
  activeTab:        'villagers',
  hoverTile:        null,
  orders:           [],
  nextVillagerId:   3,
  prevXP:           0,
  villagers: [
    { id: 0, name: 'Lena',  skin: '#f4c490', hair: '#8b4a1a', shirt: '#e05a8a', pants: '#5a7abf', emoji: '👧', task: 'Idle', hunger: 5, x: 5, y: 5, tx: 5, ty: 5, vx: 0, vy: 0, buildingId: null, progress: 0, anim: 0 },
    { id: 1, name: 'Tom',   skin: '#e8a870', hair: '#3a2010', shirt: '#4a8adf', pants: '#4a5a70', emoji: '👦', task: 'Idle', hunger: 5, x: 6, y: 5, tx: 6, ty: 5, vx: 0, vy: 0, buildingId: null, progress: 0, anim: 0 },
    { id: 2, name: 'Maria', skin: '#c8906a', hair: '#1a0a00', shirt: '#e06030', pants: '#705040', emoji: '👩', task: 'Idle', hunger: 4, x: 5, y: 6, tx: 5, ty: 6, vx: 0, vy: 0, buildingId: null, progress: 0, anim: 0 }
  ],
  buildings: [
    { id: 0, type: 'townhall',  col: 5, row: 4 },
    { id: 1, type: 'sawmill',   col: 3, row: 2 },
    { id: 2, type: 'quarry',    col: 8, row: 3 },
    { id: 3, type: 'farm',      col: 6, row: 7 },
    { id: 4, type: 'kitchen',   col: 3, row: 6 },
    { id: 5, type: 'warehouse', col: 9, row: 6 }
  ]
};

// ============================================================
// KOLLISIONS-HILFSFUNKTIONEN
// Prüft ob ein Tile begehbar ist (kein Wasser, kein Gebäude)
// TMAP kommt aus draw.js (wird nach generateMap() befüllt)
// ============================================================
function isTileWalkable(col, row) {
  // Kartengrenzen
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;

  // Wasser-Tiles (Typ 3) sind nicht begehbar
  if (TMAP && TMAP[Math.round(row)] && TMAP[Math.round(row)][Math.round(col)] === 3) return false;

  // Gebäude-Tiles sind nicht begehbar
  var rc = Math.round(col), rr = Math.round(row);
  for (var i = 0; i < state.buildings.length; i++) {
    if (state.buildings[i].col === rc && state.buildings[i].row === rr) return false;
  }

  return true;
}

// Gibt ein zufälliges begehbares Wanderziel zurück
function randomWalkTarget() {
  var tries = 0;
  while (tries < 20) {
    var tc = 2 + Math.random() * (COLS - 4);
    var tr = 2 + Math.random() * (ROWS - 4);
    if (isTileWalkable(Math.round(tc), Math.round(tr))) return { x: tc, y: tr };
    tries++;
  }
  // Fallback: Mitte der Karte
  return { x: COLS / 2, y: ROWS / 2 };
}

// ============================================================
// SAVE / LOAD
// ============================================================
function saveGame() {
  try {
    var toSave = {
      version:        6,
      playerName:     state.playerName,
      resources:      state.resources,
      xp:             state.xp,
      day:            state.day,
      tick:           state.tick,
      nextVillagerId: state.nextVillagerId,
      prevXP:         state.prevXP,
      villagers: state.villagers.map(function(v) {
        return {
          id: v.id, name: v.name, emoji: v.emoji,
          skin: v.skin, hair: v.hair, shirt: v.shirt, pants: v.pants,
          task: v.task, hunger: v.hunger, buildingId: v.buildingId,
          progress: v.progress, x: v.x, y: v.y, tx: v.tx, ty: v.ty
        };
      }),
      buildings: state.buildings
    };
    localStorage.setItem(SAVE_KEY_PREFIX + state.playerName, JSON.stringify(toSave));
    showNotif('💾 Gespeichert!');
    return true;
  } catch(e) {
    showNotif('⚠️ Speichern fehlgeschlagen: ' + e.message);
    return false;
  }
}

function loadGame(playerName) {
  try {
    var raw = localStorage.getItem(SAVE_KEY_PREFIX + playerName);
    if (!raw) return false;
    var d = JSON.parse(raw);
    if (!d || !Array.isArray(d.villagers) || !Array.isArray(d.buildings)) return false;

    state.playerName     = d.playerName     || playerName;
    state.xp             = typeof d.xp  === 'number' ? d.xp  : 0;
    state.day            = typeof d.day === 'number'  ? d.day : 1;
    state.tick           = typeof d.tick === 'number' ? d.tick: 0;
    state.nextVillagerId = typeof d.nextVillagerId === 'number' ? d.nextVillagerId : d.villagers.length;
    state.prevXP         = typeof d.prevXP === 'number' ? d.prevXP : state.xp;

    var defaultRes = { wood:0, stone:0, wheat:0, soup:0, furniture:0, brick:0, bread:0, water:0 };
    if (d.resources && typeof d.resources === 'object') {
      for (var k in defaultRes)
        state.resources[k] = typeof d.resources[k] === 'number' ? d.resources[k] : 0;
    }

    state.villagers = d.villagers.map(function(v) {
      return {
        id:         typeof v.id === 'number' ? v.id : 0,
        name:       v.name  || 'Villager',
        emoji:      v.emoji || '🧑',
        skin:       v.skin  || '#f4c490',
        hair:       v.hair  || '#5a3010',
        shirt:      v.shirt || '#4a8adf',
        pants:      v.pants || '#3a4a60',
        task:       v.task  || 'Idle',
        hunger:     typeof v.hunger === 'number' ? v.hunger : MAX_HUNGER,
        buildingId: v.buildingId !== undefined ? v.buildingId : null,
        progress:   typeof v.progress === 'number' ? v.progress : 0,
        x:  typeof v.x  === 'number' ? v.x  : 5,
        y:  typeof v.y  === 'number' ? v.y  : 5,
        tx: typeof v.tx === 'number' ? v.tx : 5,
        ty: typeof v.ty === 'number' ? v.ty : 5,
        vx: 0, vy: 0, anim: 0
      };
    });

    state.buildings = d.buildings.map(function(b) {
      return {
        id:   typeof b.id  === 'number' ? b.id  : 0,
        type: b.type || 'townhall',
        col:  typeof b.col === 'number' ? b.col : 0,
        row:  typeof b.row === 'number' ? b.row : 0
      };
    });

    showNotif('✅ ' + playerName + ' geladen – Tag ' + state.day);
    return true;
  } catch(e) {
    console.warn('loadGame Fehler:', e);
    return false;
  }
}

// Autosave alle 60 Sekunden
var autoSaveTimer = null;
function startAutoSave() {
  clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(function() {
    if (state.playerName && state.playerName !== 'Spieler') saveGame();
  }, 60000);
}

// ============================================================
// PRODUKTION
// ============================================================
function tickProduction() {
  state.tick++;

  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    if (v.buildingId !== null) {
      var spd = v.hunger>=4?1.0:v.hunger>=3?0.85:v.hunger>=2?0.6:v.hunger>=1?0.35:0.1;
      v.progress = Math.min(100, v.progress + (100 / PRODUCE_INTERVAL) * spd);
    }
  }

  if (state.tick % PRODUCE_INTERVAL === 0) {
    var cc = Math.floor(state.tick / PRODUCE_INTERVAL);

    for (var i = 0; i < state.villagers.length; i++) {
      var v = state.villagers[i];
      if (v.buildingId === null) continue;
      var bld = null;
      for (var j = 0; j < state.buildings.length; j++) {
        if (state.buildings[j].id === v.buildingId) { bld = state.buildings[j]; break; }
      }
      if (!bld) { v.buildingId = null; continue; }
      var ch = CHAINS[bld.type];
      if (!ch || !ch.output) continue;
      if (ch.input && state.resources[ch.input] < ch.inputAmt) { v.progress = 0; continue; }
      if (ch.input) state.resources[ch.input] = Math.max(0, state.resources[ch.input] - ch.inputAmt);
      state.resources[ch.output] = Math.min(999, (state.resources[ch.output] || 0) + ch.outputAmt);
      v.progress = 0;
    }

    if (cc % HUNGER_INTERVAL === 0) {
      for (var i = 0; i < state.villagers.length; i++) {
        var v = state.villagers[i];
        if (v.hunger > 0) v.hunger--;
        if (v.hunger <= 1) {
          if (state.resources.soup > 0) {
            state.resources.soup--; v.hunger = MAX_HUNGER;
          } else if (state.resources.bread > 0) {
            state.resources.bread--; v.hunger = MAX_HUNGER - 1;
          }
        }
      }
    }

    if (state.tick % (PRODUCE_INTERVAL * 8) === 0) {
      state.day++;
      document.getElementById('time-chip').textContent = '⏱ Tag ' + state.day;
    }

    checkNewVillager();
    updateResourceDisplay();
    renderSidebar();
    renderActiveTab();
    sendStateUpdate();
  }
}

// ============================================================
// VILLAGER
// ============================================================
function checkNewVillager() {
  for (var i = 0; i < VILLAGER_POOL.length; i++) {
    var vp = VILLAGER_POOL[i];
    if (vp.reqXP > 0 && state.prevXP < vp.reqXP && state.xp >= vp.reqXP) {
      var hired = false;
      for (var j = 0; j < state.villagers.length; j++) {
        if (state.villagers[j].name === vp.name) { hired = true; break; }
      }
      if (!hired) showVillagerPopup(vp.emoji, vp.name);
    }
  }
  if (state.villagers.length >= VILLAGER_POOL.length) {
    var idx       = state.villagers.length;
    var threshold = getExtraVillagerXP(idx);
    if (state.prevXP < threshold && state.xp >= threshold) {
      var extra = generateExtraVillager(idx);
      showVillagerPopup(extra.emoji, extra.name);
    }
  }
  updateLevelDisplay();
  state.prevXP = state.xp;
}

function showVillagerPopup(emoji, name) {
  document.getElementById('hire-popup-title').textContent = '🎉 Neuer Mitarbeiter!';
  document.getElementById('hire-popup-desc').textContent  =
    emoji + ' ' + name + ' moechte deinem Dorf beitreten!\nIn der Sidebar "Einstellen" klicken.';
  document.getElementById('hire-popup').style.display = 'block';
}

function closeHirePopup() {
  document.getElementById('hire-popup').style.display = 'none';
}

function generateExtraVillager(idx) {
  var ni = idx % VILLAGER_NAMES_EXTRA.length;
  var ei = idx % VILLAGER_EMOJIS.length;
  var si = idx % VILLAGER_SHIRTS.length;
  var pi = idx % VILLAGER_PANTS.length;
  var skins = ['#f4c490','#e8a870','#c8906a','#f0d0a0','#f8e0c0','#d0a880','#c09060'];
  var hairs  = ['#8b4a1a','#3a2010','#1a0a00','#c8a030','#e8c840','#202020','#c05020'];
  return {
    name:  VILLAGER_NAMES_EXTRA[ni],
    emoji: VILLAGER_EMOJIS[ei],
    skin:  skins[idx % skins.length],
    hair:  hairs[idx % hairs.length],
    shirt: VILLAGER_SHIRTS[si],
    pants: VILLAGER_PANTS[pi],
    reqXP: getExtraVillagerXP(idx)
  };
}

function hireVillager(idx) {
  var vp = idx < VILLAGER_POOL.length ? VILLAGER_POOL[idx] : generateExtraVillager(idx);
  if (state.xp < vp.reqXP) { showNotif('Zu wenig XP!'); return; }
  for (var i = 0; i < state.villagers.length; i++) {
    if (state.villagers[i].name === vp.name) { showNotif(vp.name + ' ist schon da!'); return; }
  }
  // Startposition: zufälliges begehbares Tile in Kartenmitte
  var start = randomWalkTarget();
  state.villagers.push({
    id: state.nextVillagerId++, name: vp.name, emoji: vp.emoji,
    skin: vp.skin, hair: vp.hair, shirt: vp.shirt, pants: vp.pants,
    task: 'Idle', hunger: MAX_HUNGER,
    x: start.x, y: start.y, tx: start.x, ty: start.y,
    vx: 0, vy: 0, buildingId: null, progress: 0, anim: 0
  });
  showNotif(vp.name + ' ist beigetreten! 🎉');
  renderSidebar();
  renderActiveTab();
}

// ============================================================
// LEVEL-ANZEIGE
// ============================================================
function updateLevelDisplay() {
  var lvl    = getLevel(state.xp);
  var nextXP = getXPForNextLevel(state.xp);
  var prevXP = LEVEL_THRESHOLDS[lvl - 1] || 0;
  var lvlEl  = document.getElementById('level-chip');
  if (lvlEl) lvlEl.textContent = '🏅 Lvl ' + lvl;
  var fillEl = document.getElementById('level-bar-fill');
  if (fillEl) {
    var pct = nextXP ? Math.round(((state.xp - prevXP) / (nextXP - prevXP)) * 100) : 100;
    fillEl.style.width = pct + '%';
  }
}

// ============================================================
// BEWEGUNG MIT KOLLISION
// ============================================================
function moveVillagers() {
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];

    // ── Ziel setzen ───────────────────────────────────────────
    if (v.buildingId !== null) {
      // Ziel = Gebäude-Tile
      for (var j = 0; j < state.buildings.length; j++) {
        if (state.buildings[j].id === v.buildingId) {
          v.tx = state.buildings[j].col;
          v.ty = state.buildings[j].row;
          break;
        }
      }
    } else {
      // Wandern: neues Ziel wenn angekommen
      var dx = v.x - v.tx, dy = v.y - v.ty;
      if (Math.sqrt(dx*dx + dy*dy) < ARRIVE_DIST) {
        var t = randomWalkTarget();
        v.tx  = t.x;
        v.ty  = t.y;
      }
    }

    // ── Beschleunigung ────────────────────────────────────────
    var ex = v.tx - v.x, ey = v.ty - v.y;
    var d  = Math.sqrt(ex*ex + ey*ey);
    var speed = v.buildingId !== null ? ACCEL * 1.2 : ACCEL;
    var slowF = Math.min(1, d * 2);

    if (d > ARRIVE_DIST) {
      v.vx += (ex / d) * speed * slowF;
      v.vy += (ey / d) * speed * slowF;
    }

    // ── Reibung + Max-Speed ───────────────────────────────────
    v.vx *= FRICTION;
    v.vy *= FRICTION;
    var vm = Math.sqrt(v.vx*v.vx + v.vy*v.vy);
    var maxSpd = 0.035; // langsamer als vorher (war 0.06)
    if (vm > maxSpd) { v.vx = (v.vx/vm)*maxSpd; v.vy = (v.vy/vm)*maxSpd; }

    // ── Kollision: neue Position berechnen ────────────────────
    var nx = v.x + v.vx;
    var ny = v.y + v.vy;

    var ncol = Math.round(nx);
    var nrow = Math.round(ny);

    // Vollständige neue Position begehbar?
    if (isTileWalkable(ncol, nrow)) {
      v.x = nx;
      v.y = ny;
    } else {
      // X-Achse einzeln prüfen (Gleiten entlang Hindernissen)
      var nxOnly = Math.round(nx);
      var nyOnly = Math.round(v.y);

      if (isTileWalkable(nxOnly, nyOnly)) {
        // Nur X bewegen, Y stoppen
        v.x  = nx;
        v.vy = 0;
      } else {
        // Nur Y prüfen
        var nxOnly2 = Math.round(v.x);
        var nyOnly2 = Math.round(ny);
        if (isTileWalkable(nxOnly2, nyOnly2)) {
          v.y  = ny;
          v.vx = 0;
        } else {
          // Komplett blockiert → Geschwindigkeit nullen, neues Ziel
          v.vx = 0;
          v.vy = 0;
          var t2 = randomWalkTarget();
          v.tx = t2.x;
          v.ty = t2.y;
        }
      }
    }

    // ── Karte nicht verlassen ─────────────────────────────────
    v.x = Math.max(0.5, Math.min(COLS - 1.5, v.x));
    v.y = Math.max(0.5, Math.min(ROWS - 1.5, v.y));
  }
}

// ============================================================
// GEBÄUDE PLATZIEREN
// ============================================================
function placeBuilding(col, row) {
  var type = state.buildMode;
  var bt   = BUILDING_TYPES[type];
  if (!bt) return;

  if (state.xp < bt.reqXP) {
    showNotif('Benötigt ⭐' + bt.reqXP + ' XP (Level ' + getLevel(bt.reqXP) + ')');
    state.buildMode = null; state.hoverTile = null; renderActiveTab(); return;
  }
  if (state.resources.wood < bt.costWood || state.resources.stone < bt.costStone) {
    showNotif('Nicht genug Ressourcen! 🪵' + bt.costWood + ' 🪨' + bt.costStone);
    state.buildMode = null; state.hoverTile = null; renderActiveTab(); return;
  }
  for (var i = 0; i < state.buildings.length; i++) {
    if (state.buildings[i].col === col && state.buildings[i].row === row) {
      showNotif('Bereits belegt!'); return;
    }
  }
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) {
    showNotif('Ausserhalb der Karte!'); return;
  }
  // Nicht auf Wasser bauen
  if (TMAP && TMAP[row] && TMAP[row][col] === 3) {
    showNotif('Nicht auf Wasser bauen!'); return;
  }

  state.resources.wood  -= bt.costWood;
  state.resources.stone -= bt.costStone;
  var mx = 0;
  for (var i = 0; i < state.buildings.length; i++) if (state.buildings[i].id > mx) mx = state.buildings[i].id;
  state.buildings.push({ id: mx + 1, type: type, col: col, row: row });
  state.buildMode = null; state.hoverTile = null;

  // Villager die auf diesem Tile stehen wegschicken
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    if (Math.round(v.x) === col && Math.round(v.y) === row) {
      var t3 = randomWalkTarget();
      v.tx = t3.x; v.ty = t3.y;
    }
  }

  updateResourceDisplay();
  renderActiveTab();
  showNotif(bt.name + ' gebaut! ✅');
  saveGame();
}

// ============================================================
// AUFTRAG ERFÜLLEN
// ============================================================
function fulfillOrder(orderId) {
  var order = null;
  for (var i = 0; i < state.orders.length; i++) {
    if (state.orders[i].id === orderId) { order = state.orders[i]; break; }
  }
  if (!order) return;
  for (var res in order.items) {
    if ((state.resources[res] || 0) < order.items[res]) {
      showNotif('Nicht genug ' + res + '!'); return;
    }
  }
  for (var res in order.items) {
    state.resources[res] = Math.max(0, state.resources[res] - order.items[res]);
  }
  networkFulfillOrder(orderId);
  updateResourceDisplay();
}

// ============================================================
// DISPLAY UPDATE
// ============================================================
function updateResourceDisplay() {
  document.getElementById('res-wood').textContent      = state.resources.wood;
  document.getElementById('res-stone').textContent     = state.resources.stone;
  document.getElementById('res-wheat').textContent     = state.resources.wheat;
  document.getElementById('res-soup').textContent      = state.resources.soup;
  document.getElementById('res-furniture').textContent = state.resources.furniture;
  document.getElementById('res-brick').textContent     = state.resources.brick;
  document.getElementById('xp-val').textContent        = state.xp;
  updateLevelDisplay();
}