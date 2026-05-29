// ============================================================
// STATE.JS – Phase 5
// Neu: Startgebäude ohne Überlappung, Upgrade-System
// ============================================================

var SAVE_KEY_PREFIX = 'greendale_v12_';

var state = {
  playerName:       'Spieler',
  resources:        { wood: 24, stone: 12, wheat: 8, soup: 4, furniture: 0, brick: 0, bread: 0, water: 0, tool: 0 },
  coins:            0,
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
  activeEvent:      null,
  tradeOffer:       null,
  villagers: [
    { id:0, name:'Lena',  skin:'#f4c490', hair:'#8b4a1a', shirt:'#e05a8a', pants:'#5a7abf', emoji:'👧', task:'Idle', hunger:5, x:7, y:6, tx:7, ty:6, vx:0, vy:0, buildingId:null, progress:0, anim:0 },
    { id:1, name:'Tom',   skin:'#e8a870', hair:'#3a2010', shirt:'#4a8adf', pants:'#4a5a70', emoji:'👦', task:'Idle', hunger:5, x:9, y:7, tx:9, ty:7, vx:0, vy:0, buildingId:null, progress:0, anim:0 },
    { id:2, name:'Maria', skin:'#c8906a', hair:'#1a0a00', shirt:'#e06030', pants:'#705040', emoji:'👩', task:'Idle', hunger:4, x:7, y:8, tx:7, ty:8, vx:0, vy:0, buildingId:null, progress:0, anim:0 }
  ],
  // Startgebäude mit ausreichend Abstand zueinander (min 2 Tiles)
  buildings: [
    { id:0, type:'townhall',  col:8,  row:5,  level:1 },
    { id:1, type:'sawmill',   col:3,  row:2,  level:1 },
    { id:2, type:'quarry',    col:13, row:3,  level:1 },
    { id:3, type:'farm',      col:5,  row:10, level:1 },
    { id:4, type:'kitchen',   col:11, row:8,  level:1 },
    { id:5, type:'warehouse', col:15, row:6,  level:1 }
  ]
};

// ============================================================
// KOLLISION
// ============================================================
function isTileWalkable(col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
  var rc = Math.round(col), rr = Math.round(row);
  if (TMAP && TMAP[rr] && TMAP[rr][rc] === 3) return false; // Wasser
  // Phase 6.1: Berggipfel (Höhe 3) nicht begehbar
  if (typeof HMAP !== 'undefined' && HMAP[rr] && HMAP[rr][rc] >= 3) return false;
  for (var i = 0; i < state.buildings.length; i++)
    if (state.buildings[i].col === rc && state.buildings[i].row === rr) return false;
  return true;
}

function randomWalkTarget() {
  var tries = 0;
  while (tries < 20) {
    var tc = 2 + Math.random() * (COLS - 4);
    var tr = 2 + Math.random() * (ROWS - 4);
    if (isTileWalkable(Math.round(tc), Math.round(tr))) return { x: tc, y: tr };
    tries++;
  }
  return { x: COLS / 2, y: ROWS / 2 };
}

// ============================================================
// SAVE / LOAD
// ============================================================
function saveGame() {
  try {
    var toSave = {
      version: 12,
      playerName: state.playerName,
      resources:  state.resources,
      coins:      state.coins,
      xp:         state.xp,
      day:        state.day,
      tick:       state.tick,
      nextVillagerId: state.nextVillagerId,
      prevXP:     state.prevXP,
      villagers: state.villagers.map(function(v) {
        return { id:v.id, name:v.name, emoji:v.emoji,
                 skin:v.skin, hair:v.hair, shirt:v.shirt, pants:v.pants,
                 task:v.task, hunger:v.hunger, buildingId:v.buildingId,
                 progress:v.progress, x:v.x, y:v.y, tx:v.tx, ty:v.ty };
      }),
      buildings: state.buildings
    };
    localStorage.setItem(SAVE_KEY_PREFIX + state.playerName, JSON.stringify(toSave));
    showNotif(t('saved'));
    sendStateUpdate(true);
    return true;
  } catch(e) {
    showNotif(t('saveFail') + e.message);
    return false;
  }
}

function loadGame(playerName) {
  try {
    var raw = localStorage.getItem(SAVE_KEY_PREFIX + playerName)
           || localStorage.getItem('greendale_v11_' + playerName)
           || localStorage.getItem('greendale_v6_' + playerName);
    if (!raw) return false;
    var d = JSON.parse(raw);
    if (!d || !Array.isArray(d.villagers) || !Array.isArray(d.buildings)) return false;

    state.playerName     = d.playerName     || playerName;
    state.xp             = typeof d.xp  === 'number' ? d.xp  : 0;
    state.coins          = typeof d.coins === 'number' ? d.coins : 0;
    state.day            = typeof d.day === 'number'  ? d.day : 1;
    state.tick           = typeof d.tick === 'number' ? d.tick : 0;
    state.nextVillagerId = typeof d.nextVillagerId === 'number' ? d.nextVillagerId : d.villagers.length;
    state.prevXP         = typeof d.prevXP === 'number' ? d.prevXP : state.xp;

    var defaultRes = { wood:0, stone:0, wheat:0, soup:0, furniture:0, brick:0, bread:0, water:0, tool:0 };
    if (d.resources && typeof d.resources === 'object') {
      for (var k in defaultRes)
        state.resources[k] = typeof d.resources[k] === 'number' ? d.resources[k] : 0;
    }

    state.villagers = d.villagers.map(function(v) {
      return {
        id: typeof v.id === 'number' ? v.id : 0,
        name: v.name || 'Villager', emoji: v.emoji || '🧑',
        skin: v.skin || '#f4c490', hair: v.hair || '#5a3010',
        shirt: v.shirt || '#4a8adf', pants: v.pants || '#3a4a60',
        task: v.task || 'Idle',
        hunger: typeof v.hunger === 'number' ? v.hunger : MAX_HUNGER,
        buildingId: v.buildingId !== undefined ? v.buildingId : null,
        progress: typeof v.progress === 'number' ? v.progress : 0,
        x:  typeof v.x  === 'number' ? v.x  : 5,
        y:  typeof v.y  === 'number' ? v.y  : 5,
        tx: typeof v.tx === 'number' ? v.tx : 5,
        ty: typeof v.ty === 'number' ? v.ty : 5,
        vx: 0, vy: 0, anim: 0
      };
    });

    state.buildings = d.buildings.map(function(b) {
      return {
        id:    typeof b.id  === 'number' ? b.id  : 0,
        type:  b.type || 'townhall',
        col:   typeof b.col === 'number' ? b.col : 0,
        row:   typeof b.row === 'number' ? b.row : 0,
        level: typeof b.level === 'number' ? b.level : 1
      };
    });

    showNotif('✅ ' + playerName + t('hjoin') + state.day);
    return true;
  } catch(e) {
    console.warn('loadGame Fehler:', e);
    return false;
  }
}

function applyDbState(dbState) {
  if (!dbState) return;
  if ((dbState.xp || 0) > state.xp || (dbState.day || 1) > state.day) {
    showNotif(t('cloudLoaded'));
    loadGameFromObject(dbState);
  }
}

function loadGameFromObject(d) {
  if (!d || !Array.isArray(d.villagers) || !Array.isArray(d.buildings)) return;
  state.xp     = d.xp     || state.xp;
  state.coins  = d.coins  || state.coins;
  state.day    = d.day    || state.day;
  state.tick   = d.tick   || state.tick;
  state.prevXP = d.prevXP || state.prevXP;
  state.nextVillagerId = d.nextVillagerId || state.nextVillagerId;
  if (d.resources) {
    for (var k in state.resources)
      if (typeof d.resources[k] === 'number') state.resources[k] = d.resources[k];
  }
  state.villagers = d.villagers.map(function(v) {
    return {
      id: v.id||0, name:v.name||'V', emoji:v.emoji||'🧑',
      skin:v.skin||'#f4c490', hair:v.hair||'#5a3010',
      shirt:v.shirt||'#4a8adf', pants:v.pants||'#3a4a60',
      task:v.task||'Idle', hunger:v.hunger||MAX_HUNGER,
      buildingId:v.buildingId||null, progress:v.progress||0,
      x:v.x||5, y:v.y||5, tx:v.tx||5, ty:v.ty||5,
      vx:0, vy:0, anim:0
    };
  });
  state.buildings = d.buildings.map(function(b) {
    return { id:b.id||0, type:b.type||'townhall', col:b.col||0, row:b.row||0, level:b.level||1 };
  });
  updateResourceDisplay();
  renderSidebar();
}

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
      // Level-2-Gebäude produzieren 40% schneller
      var bld = null;
      for (var jj = 0; jj < state.buildings.length; jj++) {
        if (state.buildings[jj].id === v.buildingId) { bld = state.buildings[jj]; break; }
      }
      var lvlMult = (bld && bld.level >= 2) ? 1.4 : 1.0;
      v.progress = Math.min(100, v.progress + (100 / PRODUCE_INTERVAL) * spd * lvlMult);
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

      // Level-2: outputAmt verdoppelt
      var outAmt = ch.outputAmt * (bld.level >= 2 ? 2 : 1);

      if (ch.inputB) {
        if (state.resources[ch.input] < ch.inputAmt || state.resources[ch.inputB] < ch.inputAmtB) {
          v.progress = 0; continue;
        }
        state.resources[ch.input]  = Math.max(0, state.resources[ch.input]  - ch.inputAmt);
        state.resources[ch.inputB] = Math.max(0, state.resources[ch.inputB] - ch.inputAmtB);
      } else if (ch.input) {
        if (state.resources[ch.input] < ch.inputAmt) { v.progress = 0; continue; }
        state.resources[ch.input] = Math.max(0, state.resources[ch.input] - ch.inputAmt);
      }

      if (!state.resources[ch.output]) state.resources[ch.output] = 0;
      state.resources[ch.output] = Math.min(999, state.resources[ch.output] + outAmt);
      v.progress = 0;
      // Phase 8: Arbeits-Partikel spawnen
      if (typeof spawnParticle === 'function') {
        var hgt8 = (typeof HMAP !== 'undefined' && HMAP[Math.round(v.y)]) ? (HMAP[Math.round(v.y)][Math.round(v.x)] || 0) : 0;
        var pp8  = toIso(v.x, v.y, hgt8);
        spawnParticle(pp8.x, pp8.y, 'work');
        spawnParticle(pp8.x + (Math.random()-0.5)*20, pp8.y - 10, 'spark');
      }
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
      document.getElementById('time-chip').textContent = t('day') + state.day;
    }

    checkNewVillager();
    updateResourceDisplay();
    renderSidebar();
    renderActiveTab();
    sendStateUpdate(false);
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
      for (var j = 0; j < state.villagers.length; j++)
        if (state.villagers[j].name === vp.name) { hired = true; break; }
      if (!hired) showVillagerPopup(vp.emoji, vp.name);
    }
  }
  if (state.villagers.length >= VILLAGER_POOL.length) {
    var idx = state.villagers.length;
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
  document.getElementById('hire-popup-title').textContent = t('hiredTitle');
  document.getElementById('hire-popup-desc').textContent  = emoji + ' ' + name + t('hiredDesc');
  document.getElementById('hire-popup').style.display = 'block';
}
function closeHirePopup() { document.getElementById('hire-popup').style.display = 'none'; }

function generateExtraVillager(idx) {
  var ni = idx % VILLAGER_NAMES_EXTRA.length;
  var ei = idx % VILLAGER_EMOJIS.length;
  var si = idx % VILLAGER_SHIRTS.length;
  var pi = idx % VILLAGER_PANTS.length;
  var skins = ['#f4c490','#e8a870','#c8906a','#f0d0a0','#f8e0c0','#d0a880','#c09060'];
  var hairs  = ['#8b4a1a','#3a2010','#1a0a00','#c8a030','#e8c840','#202020','#c05020'];
  return {
    name: VILLAGER_NAMES_EXTRA[ni], emoji: VILLAGER_EMOJIS[ei],
    skin: skins[idx % skins.length], hair: hairs[idx % hairs.length],
    shirt: VILLAGER_SHIRTS[si], pants: VILLAGER_PANTS[pi],
    reqXP: getExtraVillagerXP(idx)
  };
}

function hireVillager(idx) {
  var vp = idx < VILLAGER_POOL.length ? VILLAGER_POOL[idx] : generateExtraVillager(idx);
  if (state.xp < vp.reqXP) { showNotif(t('notEnoughXP')); return; }
  for (var i = 0; i < state.villagers.length; i++)
    if (state.villagers[i].name === vp.name) { showNotif(vp.name + t('alreadyHere')); return; }
  var start = randomWalkTarget();
  state.villagers.push({
    id: state.nextVillagerId++, name: vp.name, emoji: vp.emoji,
    skin: vp.skin, hair: vp.hair, shirt: vp.shirt, pants: vp.pants,
    task: 'Idle', hunger: MAX_HUNGER,
    x: start.x, y: start.y, tx: start.x, ty: start.y,
    vx: 0, vy: 0, buildingId: null, progress: 0, anim: 0
  });
  showNotif(vp.name + t('hired'));
  renderSidebar();
  renderActiveTab();
}

// ============================================================
// GEBÄUDE UPGRADEN
// ============================================================
function upgradeBuilding(buildingId) {
  var bld = null;
  for (var i = 0; i < state.buildings.length; i++)
    if (state.buildings[i].id === buildingId) { bld = state.buildings[i]; break; }
  if (!bld) return;
  if (bld.level >= 2) { showNotif(BUILDING_TYPES[bld.type].name + t('upgradeMax')); return; }
  var cost = UPGRADE_COSTS[bld.type];
  if (!cost) return;
  if (state.resources.wood < cost.wood || state.resources.stone < cost.stone) {
    showNotif(t('upgradeNotEnough')); return;
  }
  state.resources.wood  -= cost.wood;
  state.resources.stone -= cost.stone;
  bld.level = 2;
  updateResourceDisplay();
  hidePopup();
  renderSidebar();
  renderActiveTab();
  showNotif(BUILDING_TYPES[bld.type].name + t('upgradeSuccess') + '2 ⬆️');
  saveGame();
}

// ============================================================
// LEVEL-ANZEIGE
// ============================================================
function updateLevelDisplay() {
  var lvl    = getLevel(state.xp);
  var nextXP = getXPForNextLevel(state.xp);
  var prevXP = LEVEL_THRESHOLDS[lvl - 1] || 0;
  var lvlEl  = document.getElementById('level-chip');
  if (lvlEl) lvlEl.textContent = '🏅 ' + t('levelLabel') + ' ' + lvl;
  var fillEl = document.getElementById('level-bar-fill');
  if (fillEl) {
    var pct = nextXP ? Math.round(((state.xp - prevXP) / (nextXP - prevXP)) * 100) : 100;
    fillEl.style.width = pct + '%';
  }
  var casinoEl = document.getElementById('casino-unlock-hint');
  if (casinoEl) casinoEl.style.display = lvl >= 5 ? 'none' : 'block';
}

// ============================================================
// BEWEGUNG – Phase 5: MAX_SPEED aus data.js
// ============================================================
function moveVillagers() {
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];

    if (v.buildingId !== null) {
      // Arbeitet: Ziel = Gebäude-Position (neben dem Gebäude, nicht drauf)
      for (var j = 0; j < state.buildings.length; j++) {
        if (state.buildings[j].id === v.buildingId) {
          // Leicht versetzt neben das Gebäude stellen
          v.tx = state.buildings[j].col + 0.8;
          v.ty = state.buildings[j].row + 0.5;
          break;
        }
      }
    } else {
      // Idle: immer laufen – neues Ziel sobald angekommen
      var dx = v.x - v.tx, dy = v.y - v.ty;
      if (Math.sqrt(dx*dx + dy*dy) < ARRIVE_DIST) {
        var t2 = randomWalkTarget(); v.tx = t2.x; v.ty = t2.y;
      }
      // Anti-Hängen: Timeout-Counter
      v._stuckTick = (v._stuckTick || 0) + 1;
      var spd2 = Math.sqrt(v.vx*v.vx + v.vy*v.vy);
      if (v._stuckTick > 120 && spd2 < 0.001) {
        var t4 = randomWalkTarget(); v.tx = t4.x; v.ty = t4.y;
        v.vx = 0; v.vy = 0; v._stuckTick = 0;
      }
      if (spd2 > 0.005) v._stuckTick = 0;
    }

    var ex = v.tx - v.x, ey = v.ty - v.y;
    var d  = Math.sqrt(ex*ex + ey*ey);
    var speed = v.buildingId !== null ? ACCEL * 1.1 : ACCEL;
    var slowF = Math.min(1, d * 2);
    if (d > ARRIVE_DIST) { v.vx += (ex/d)*speed*slowF; v.vy += (ey/d)*speed*slowF; }
    v.vx *= FRICTION; v.vy *= FRICTION;
    var vm = Math.sqrt(v.vx*v.vx + v.vy*v.vy);
    if (vm > MAX_SPEED) { v.vx = (v.vx/vm)*MAX_SPEED; v.vy = (v.vy/vm)*MAX_SPEED; }
    var nx = v.x + v.vx, ny = v.y + v.vy;
    if (isTileWalkable(Math.round(nx), Math.round(ny))) {
      v.x = nx; v.y = ny;
    } else if (isTileWalkable(Math.round(nx), Math.round(v.y))) {
      v.x = nx; v.vy = 0;
    } else if (isTileWalkable(Math.round(v.x), Math.round(ny))) {
      v.y = ny; v.vx = 0;
    } else {
      // Blockiert: sofort neues Ziel
      v.vx = 0; v.vy = 0; v._stuckTick = 0;
      var t3 = randomWalkTarget(); v.tx = t3.x; v.ty = t3.y;
    }
    v.x = Math.max(0.5, Math.min(COLS-1.5, v.x));
    v.y = Math.max(0.5, Math.min(ROWS-1.5, v.y));
  }
}

// ============================================================
// GEBÄUDE PLATZIEREN
// ============================================================
function placeBuilding(col, row) {
  var type = state.buildMode;
  var bt   = BUILDING_TYPES[type];
  if (!bt) return;

  if (bt.reqLevel && getLevel(state.xp) < bt.reqLevel) {
    showNotif(bt.name + t('reqLevel') + bt.reqLevel + '!');
    state.buildMode = null; state.hoverTile = null; renderActiveTab(); return;
  }
  if (state.xp < bt.reqXP) {
    showNotif(t('reqXP') + bt.reqXP + ' XP');
    state.buildMode = null; state.hoverTile = null; renderActiveTab(); return;
  }
  if (state.resources.wood < bt.costWood || state.resources.stone < bt.costStone) {
    showNotif(t('notEnoughRes') + bt.costWood + ' 🪨' + bt.costStone);
    state.buildMode = null; state.hoverTile = null; renderActiveTab(); return;
  }
  for (var i = 0; i < state.buildings.length; i++) {
    if (state.buildings[i].col === col && state.buildings[i].row === row) {
      showNotif(t('alreadyOccupied')); return;
    }
  }
  if (col<0||row<0||col>=COLS||row>=ROWS) { showNotif(t('outsideBounds')); return; }
  if (TMAP && TMAP[row] && TMAP[row][col] === 3) { showNotif(t('noWater')); return; }
  // Phase 6.1: Berggipfel (Höhe 3) nicht bebaubar
  if (typeof HMAP !== 'undefined' && HMAP[row] && HMAP[row][col] >= 3) { showNotif('⛰️ Zu steil zum Bauen!'); return; }

  state.resources.wood  -= bt.costWood;
  state.resources.stone -= bt.costStone;
  var mx = 0;
  for (var i = 0; i < state.buildings.length; i++) if (state.buildings[i].id > mx) mx = state.buildings[i].id;
  state.buildings.push({ id: mx+1, type: type, col: col, row: row, level: 1 });
  state.buildMode = null; state.hoverTile = null;

  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    if (Math.round(v.x) === col && Math.round(v.y) === row) {
      var tgt = randomWalkTarget(); v.tx = tgt.x; v.ty = tgt.y;
    }
  }

  updateResourceDisplay();
  renderActiveTab();
  showNotif(bt.name + t('built'));
  saveGame();
}

// ============================================================
// AUFTRAG ERFÜLLEN
// ============================================================
function fulfillOrder(orderId) {
  var order = null;
  for (var i = 0; i < state.orders.length; i++)
    if (state.orders[i].id === orderId) { order = state.orders[i]; break; }
  if (!order) return;
  for (var res in order.items) {
    if ((state.resources[res] || 0) < order.items[res]) {
      showNotif(t('notEnough') + res + '!'); return;
    }
  }
  for (var res in order.items)
    state.resources[res] = Math.max(0, state.resources[res] - order.items[res]);
  networkFulfillOrder(orderId);
  // Phase 8: XP + Coin Partikel auf dem Canvas
  if (typeof spawnParticle === 'function' && canvas) {
    var cx8 = canvas.width * 0.5, cy8 = canvas.height * 0.45;
    for (var pi = 0; pi < 4; pi++) spawnParticle(cx8 + (Math.random()-0.5)*80, cy8 + (Math.random()-0.5)*40, pi < 2 ? 'xp' : 'coin');
  }
  updateResourceDisplay();
}

// ============================================================
// DISPLAY UPDATE
// ============================================================
function updateResourceDisplay() {
  var ids = {
    wood:'res-wood', stone:'res-stone', wheat:'res-wheat', soup:'res-soup',
    furniture:'res-furniture', brick:'res-brick', tool:'res-tool'
  };
  for (var k in ids) {
    var el = document.getElementById(ids[k]);
    if (el) el.textContent = state.resources[k] || 0;
  }
  var xpEl = document.getElementById('xp-val');
  if (xpEl) xpEl.textContent = state.xp;
  var coinsEl = document.getElementById('coins-val');
  if (coinsEl) coinsEl.textContent = state.coins;
  updateLevelDisplay();
}
