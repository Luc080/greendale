// ============================================================
// STATE.JS – Spielzustand, Produktion, Save/Load
// Abhängig von: data.js
// ============================================================

var state = {
  playerName:  'Spieler',
  resources:   { wood: 24, stone: 12, wheat: 8, soup: 4, furniture: 0, brick: 0, bread: 0, water: 0 },
  xp:          0,
  day:         1,
  tick:        0,
  selectedBuilding:  null,
  selectedVillager:  null,
  buildMode:         null,
  activeTab:         'villagers',
  hoverTile:         null,
  orders:            [],     // Valley-Aufträge (vom Server)
  nextVillagerId:    3,
  prevXP:            0,
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
// SAVE / LOAD (localStorage)
// ============================================================
function saveGame() {
  try {
    var toSave = {
      playerName:       state.playerName,
      resources:        state.resources,
      xp:               state.xp,
      day:              state.day,
      buildings:        state.buildings,
      villagers:        state.villagers,
      nextVillagerId:   state.nextVillagerId
    };
    localStorage.setItem('greendale_v5_' + state.playerName, JSON.stringify(toSave));
    showNotif('💾 Gespeichert!');
  } catch(e) {
    showNotif('Speichern fehlgeschlagen');
  }
}

function loadGame(playerName) {
  try {
    var key  = 'greendale_v5_' + playerName;
    var s    = localStorage.getItem(key);
    if (s) {
      var d = JSON.parse(s);
      state.playerName      = d.playerName      || playerName;
      state.resources       = d.resources       || state.resources;
      state.xp              = d.xp              || 0;
      state.day             = d.day             || 1;
      state.buildings       = d.buildings       || state.buildings;
      state.villagers       = d.villagers       || state.villagers;
      state.nextVillagerId  = d.nextVillagerId  || state.villagers.length;
      showNotif('✅ Spielstand von ' + playerName + ' geladen!');
      return true;
    }
  } catch(e) {}
  return false;
}

// ============================================================
// PRODUKTION
// ============================================================
function tickProduction() {
  state.tick++;

  // Fortschrittsbalken
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    if (v.buildingId !== null) {
      var spd = v.hunger >= 4 ? 1.0 : v.hunger >= 3 ? 0.85 : v.hunger >= 2 ? 0.6 : v.hunger >= 1 ? 0.35 : 0.1;
      v.progress = Math.min(100, v.progress + (100 / PRODUCE_INTERVAL) * spd);
    }
  }

  if (state.tick % PRODUCE_INTERVAL === 0) {
    var cc = Math.floor(state.tick / PRODUCE_INTERVAL);

    // Ressourcen produzieren
    for (var i = 0; i < state.villagers.length; i++) {
      var v = state.villagers[i];
      if (v.buildingId === null) continue;

      var bld = null;
      for (var j = 0; j < state.buildings.length; j++) {
        if (state.buildings[j].id === v.buildingId) { bld = state.buildings[j]; break; }
      }
      if (!bld) continue;

      var ch = CHAINS[bld.type];
      if (!ch || !ch.output) continue;

      if (ch.input && state.resources[ch.input] < ch.inputAmt) {
        v.progress = 0;
        continue;
      }
      if (ch.input) state.resources[ch.input] = Math.max(0, state.resources[ch.input] - ch.inputAmt);
      state.resources[ch.output] = Math.min(99, state.resources[ch.output] + ch.outputAmt);
      v.progress = 0;
    }

    // Hunger (nur alle HUNGER_INTERVAL Zyklen)
    if (cc % HUNGER_INTERVAL === 0) {
      for (var i = 0; i < state.villagers.length; i++) {
        var v = state.villagers[i];
        if (v.hunger > 0) v.hunger--;
        if (v.hunger <= 1 && state.resources.soup > 0) {
          state.resources.soup--;
          v.hunger = MAX_HUNGER;
        }
      }
    }

    // Tag zählen
    if (state.tick % (PRODUCE_INTERVAL * 8) === 0) {
      state.day++;
      document.getElementById('time-chip').textContent = '⏱ Tag ' + state.day;
    }

    // Neuer Villager verfügbar?
    checkNewVillager();
    updateResourceDisplay();
    renderSidebar();
    renderActiveTab();

    // Zustand an Server senden
    sendStateUpdate();
  }
}

function checkNewVillager() {
  for (var i = 0; i < VILLAGER_POOL.length; i++) {
    var vp = VILLAGER_POOL[i];
    if (vp.reqXP > 0 && state.prevXP < vp.reqXP && state.xp >= vp.reqXP) {
      var hired = false;
      for (var j = 0; j < state.villagers.length; j++) {
        if (state.villagers[j].name === vp.name) { hired = true; break; }
      }
      if (!hired) {
        document.getElementById('hire-popup-title').textContent = '🎉 Neuer Mitarbeiter!';
        document.getElementById('hire-popup-desc').textContent = vp.emoji + ' ' + vp.name + ' moechte deinem Dorf beitreten!\nIn der Sidebar "Einstellen" klicken.';
        document.getElementById('hire-popup').style.display = 'block';
      }
    }
  }
  state.prevXP = state.xp;
}

function closeHirePopup() {
  document.getElementById('hire-popup').style.display = 'none';
}

function hireVillager(idx) {
  var vp = VILLAGER_POOL[idx];
  if (state.xp < vp.reqXP) { showNotif('Zu wenig XP!'); return; }
  state.villagers.push({
    id: state.nextVillagerId++, name: vp.name, emoji: vp.emoji,
    skin: vp.skin, hair: vp.hair, shirt: vp.shirt, pants: vp.pants,
    task: 'Idle', hunger: MAX_HUNGER,
    x: 5, y: 5, tx: 5, ty: 5, vx: 0, vy: 0,
    buildingId: null, progress: 0, anim: 0
  });
  showNotif(vp.name + ' ist beigetreten! 🎉');
  renderSidebar();
  renderActiveTab();
}

// ============================================================
// BEWEGUNG (Physik-basiert)
// ============================================================
function moveVillagers() {
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];

    // Ziel setzen
    if (v.buildingId !== null) {
      for (var j = 0; j < state.buildings.length; j++) {
        if (state.buildings[j].id === v.buildingId) {
          v.tx = state.buildings[j].col;
          v.ty = state.buildings[j].row;
          break;
        }
      }
    } else {
      var dx = v.x - v.tx, dy = v.y - v.ty;
      if (Math.sqrt(dx*dx + dy*dy) < ARRIVE_DIST) {
        v.tx = 3.5 + Math.random() * 4;
        v.ty = 3.5 + Math.random() * 4;
      }
    }

    // Beschleunigung
    var ex = v.tx - v.x, ey = v.ty - v.y;
    var d  = Math.sqrt(ex*ex + ey*ey);
    var speed = v.buildingId !== null ? ACCEL * 1.4 : ACCEL;
    var slowF = Math.min(1, d * 2);
    if (d > ARRIVE_DIST) {
      v.vx += (ex/d) * speed * slowF;
      v.vy += (ey/d) * speed * slowF;
    }

    // Reibung + Max-Speed
    v.vx *= FRICTION;
    v.vy *= FRICTION;
    var vm = Math.sqrt(v.vx*v.vx + v.vy*v.vy);
    if (vm > 0.06) { v.vx = (v.vx/vm)*0.06; v.vy = (v.vy/vm)*0.06; }

    v.x += v.vx;
    v.y += v.vy;
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
    showNotif('Benoetigt ⭐' + bt.reqXP);
    state.buildMode = null; state.hoverTile = null; renderActiveTab(); return;
  }
  if (state.resources.wood < bt.costWood || state.resources.stone < bt.costStone) {
    showNotif('Nicht genug Ressourcen!');
    state.buildMode = null; state.hoverTile = null; renderActiveTab(); return;
  }
  for (var i = 0; i < state.buildings.length; i++) {
    if (state.buildings[i].col === col && state.buildings[i].row === row) {
      showNotif('Bereits belegt!'); return;
    }
  }
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) {
    showNotif('Ausserhalb!'); return;
  }

  state.resources.wood  -= bt.costWood;
  state.resources.stone -= bt.costStone;
  var mx = 0;
  for (var i = 0; i < state.buildings.length; i++) if (state.buildings[i].id > mx) mx = state.buildings[i].id;
  state.buildings.push({ id: mx + 1, type: type, col: col, row: row });
  state.buildMode = null; state.hoverTile = null;
  updateResourceDisplay();
  renderActiveTab();
  showNotif(bt.name + ' gebaut! ✅');
}

// ============================================================
// AUFTRAG ERFÜLLEN (via Server)
// ============================================================
function fulfillOrder(orderId) {
  // Prüfen ob Ressourcen reichen
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

  // Ressourcen abziehen
  for (var res in order.items) {
    state.resources[res] = Math.max(0, state.resources[res] - order.items[res]);
  }

  // An Server melden (der updatet die Valley-Aufträge für alle)
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
}
