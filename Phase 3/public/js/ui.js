// ============================================================
// UI.JS – Sidebar, Tabs, Popups, Notifications
// Abhängig von: data.js, state.js
// ============================================================

// ============================================================
// NOTIFICATION
// ============================================================
var notifTimer = null;
function showNotif(msg) {
  var el = document.getElementById('notif');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(function() { el.classList.remove('show'); }, 2500);
}

// ============================================================
// TABS
// ============================================================
function switchTab(tab) {
  state.activeTab = tab;
  var btns = document.querySelectorAll('.tab-btn');
  var tabs = ['villagers', 'build', 'chains', 'chat'];
  for (var i = 0; i < btns.length; i++)
    btns[i].classList.toggle('active', tabs[i] === tab);
  renderActiveTab();
}

function renderActiveTab() {
  if      (state.activeTab === 'villagers') renderVillagerTab();
  else if (state.activeTab === 'build')     renderBuildTab();
  else if (state.activeTab === 'chains')    renderChainsTab();
  else if (state.activeTab === 'chat')      renderChatTab();
}

// ============================================================
// VILLAGER TAB
// ============================================================
function renderVillagerTab() {
  var html = '';
  for (var i = 0; i < state.villagers.length; i++) {
    var v   = state.villagers[i];
    var bg  = ['#ffe0b2','#b2dfdb','#f8bbd0','#c8e6c9','#e1bee7','#fff9c4','#b3e5fc'][v.id % 7];
    var spd = v.hunger>=4?'100%':v.hunger>=3?'85%':v.hunger>=2?'60%':v.hunger>=1?'35%':'10%';
    var tc  = v.buildingId !== null ? 'working' : '';
    var tt  = v.buildingId !== null ? '🔨 ' + v.task : '😴 Idle';
    html += '<div class="villager-row' + (state.selectedVillager === v.id ? ' selected' : '') + '" onclick="selVillager(' + v.id + ')">';
    html += '<div class="v-avatar" style="background:' + bg + '">' + v.emoji + '</div>';
    html += '<span class="v-name">' + v.name + '</span>';
    html += '<span class="v-task ' + tc + '">' + tt + '</span>';
    html += '<span class="v-speed">⚡' + spd + '</span></div>';
  }
  if (html === '') html = '<p style="font-size:12px;color:var(--text-light);padding:4px">Keine Villager vorhanden.</p>';
  document.getElementById('tab-content').innerHTML = html;
}

function selVillager(id) {
  state.selectedVillager = (state.selectedVillager === id) ? null : id;
  renderVillagerTab();
}

// ============================================================
// BUILD TAB
// ============================================================
function renderBuildTab() {
  var html = '<div class="building-grid">';
  var keys = Object.keys(BUILDING_TYPES);
  for (var i = 0; i < keys.length; i++) {
    var k  = keys[i], bt = BUILDING_TYPES[k];
    var locked = state.xp < bt.reqXP;
    var sel    = state.buildMode === k ? ' selected' : '';
    var lk     = locked ? ' locked' : '';
    var oc     = locked ? '' : ' onclick="startBuild(\'' + k + '\')"';
    var lvlNeeded = locked ? ' (Lvl ' + getLevel(bt.reqXP) + ')' : '';
    html += '<div class="build-card' + sel + lk + '"' + oc + '>';
    html += '<span class="build-icon">' + bt.emoji + '</span>';
    html += '<div><div>' + bt.name + '</div>';
    html += '<div class="build-cost">🪵' + bt.costWood + ' 🪨' + bt.costStone;
    if (bt.reqXP > 0) html += ' ⭐' + bt.reqXP + lvlNeeded;
    html += '</div></div></div>';
  }
  html += '</div>';
  if (state.buildMode)
    html += '<p style="margin-top:6px;font-size:12px;color:var(--green-dark);font-weight:700">' +
            '📍 Klick auf Karte zum Platzieren — ' +
            '<span style="cursor:pointer;text-decoration:underline" onclick="cancelBuild()">abbrechen</span></p>';
  document.getElementById('tab-content').innerHTML = html;
}

function startBuild(t) { state.buildMode = (state.buildMode === t) ? null : t; renderBuildTab(); }
function cancelBuild() { state.buildMode = null; state.hoverTile = null; renderBuildTab(); }

// ============================================================
// KETTEN TAB
// ============================================================
function renderChainsTab() {
  var html = '';
  var keys = Object.keys(CHAINS);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], c = CHAINS[k];
    if (!c.output) continue;
    var bt = BUILDING_TYPES[k], nm = bt ? bt.name : k;
    html += '<div class="chain-row"><span>' + nm + '</span>';
    html += '<span style="color:var(--text-light)">→</span>';
    if (c.input) {
      var ok = (state.resources[c.input] || 0) >= c.inputAmt;
      html += '<span class="chain-step ' + (ok ? 'ready' : 'waiting') + '">' + c.inputAmt + 'x ' + c.input + '</span>';
      html += '<span style="color:var(--text-light)">→</span>';
    }
    html += '<span class="chain-step ready">+' + c.outputAmt + ' ' + c.output + '</span></div>';
  }
  document.getElementById('tab-content').innerHTML = html;
}

// ============================================================
// CHAT TAB
// ============================================================
var chatMessages = [];

function renderChatTab() {
  var html = '<div id="chat-messages">';
  for (var i = 0; i < chatMessages.length; i++) {
    var m = chatMessages[i];
    if (m.system) {
      html += '<div class="chat-msg system">' + m.text + '</div>';
    } else {
      html += '<div class="chat-msg"><span class="cm-name">' + m.name + ':</span> ' + m.text + '</div>';
    }
  }
  html += '</div>';
  html += '<div class="chat-input-row">' +
          '<input id="chat-input" type="text" placeholder="Nachricht..." maxlength="100" onkeydown="chatKeydown(event)">' +
          '<button onclick="sendChat()">➤</button></div>';
  document.getElementById('tab-content').innerHTML = html;
  var el = document.getElementById('chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function chatKeydown(e) { if (e.key === 'Enter') sendChat(); }

function sendChat() {
  var input = document.getElementById('chat-input');
  if (!input || !input.value.trim()) return;
  networkSendChat(input.value.trim());
  input.value = '';
}

function addChatMessage(name, text, system) {
  chatMessages.push({ name: name, text: text, system: !!system });
  if (chatMessages.length > 50) chatMessages.shift();
  if (state.activeTab === 'chat') renderChatTab();
}

// ============================================================
// SIDEBAR
// ============================================================
function renderSidebar() {
  renderSidebarOrders();
  renderSidebarVillagers();
  renderSidebarPlayers();
  renderSidebarResources();
}

function renderSidebarOrders() {
  var html = '';
  for (var i = 0; i < state.orders.length; i++) {
    var o  = state.orders[i];
    var ok = canFulfillOrder(o);
    html += '<div class="order-card' + (ok ? ' completable' : '') + '">';
    html += '<div class="order-label">' + o.label + '</div>';
    html += '<div class="order-footer">';
    html += '<span class="order-reward">+' + o.xp + ' XP</span>';
    html += '<button class="order-btn"' + (ok ? '' : ' disabled') +
            ' onclick="fulfillOrder(\'' + o.id + '\')">' +
            (ok ? '✓ Liefern' : 'warten') + '</button>';
    html += '</div></div>';
  }
  if (html === '') html = '<p style="font-size:12px;color:var(--text-light)">Warte auf Server...</p>';
  document.getElementById('sidebar-orders').innerHTML = html;
}

function canFulfillOrder(o) {
  for (var res in o.items) {
    if ((state.resources[res] || 0) < o.items[res]) return false;
  }
  return true;
}

function renderSidebarVillagers() {
  var html = '';

  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    var dots = '';
    for (var d = 0; d < MAX_HUNGER; d++) {
      var cls = d < v.hunger ? (v.hunger <= 1 ? 'l' : 'f') : '';
      dots += '<div class="hd ' + cls + '"></div>';
    }
    var sc  = v.buildingId !== null ? 'working' : '';
    var st2 = v.buildingId !== null ? '🔨 arbeitet' : '😴 idle';
    html += '<div class="vil-mini">';
    html += '<span style="font-size:16px">' + v.emoji + '</span>';
    html += '<span class="v-name">' + v.name + '</span>';
    html += '<span class="v-status ' + sc + '">' + st2 + '</span>';
    html += '<div class="vil-hunger">' + dots + '</div>';
    html += '</div>';
  }

  // Nächsten Villager (Pool oder generiert)
  var nextIdx = state.villagers.length;
  var nextVP;
  if (nextIdx < VILLAGER_POOL.length) {
    nextVP = VILLAGER_POOL[nextIdx];
  } else {
    nextVP = {
      name:  VILLAGER_NAMES_EXTRA[nextIdx % VILLAGER_NAMES_EXTRA.length],
      emoji: VILLAGER_EMOJIS[nextIdx % VILLAGER_EMOJIS.length],
      reqXP: getExtraVillagerXP(nextIdx)
    };
  }

  var alreadyHired = false;
  for (var j = 0; j < state.villagers.length; j++) {
    if (state.villagers[j].name === nextVP.name) { alreadyHired = true; break; }
  }
  if (!alreadyHired) {
    var can = state.xp >= nextVP.reqXP;
    html += '<button class="hire-btn"' + (can ? '' : ' disabled') + ' onclick="hireVillager(' + nextIdx + ')">';
    html += nextVP.emoji + ' ' + nextVP.name + ' einstellen';
    if (!can) html += ' (⭐' + nextVP.reqXP + ' / Lvl ' + getLevel(nextVP.reqXP) + ')';
    html += '</button>';
  }

  document.getElementById('sidebar-villagers').innerHTML = html;
}

// ============================================================
// MITSPIELER – Level wird aus xp berechnet
// xp wird von network.js in onlinePlayers[i].xp gesetzt
// ============================================================
function renderSidebarPlayers() {
  var el = document.getElementById('sidebar-players');
  if (!el) return;
  var html = '';
  for (var i = 0; i < onlinePlayers.length; i++) {
    var p   = onlinePlayers[i];
    // xp sicher auslesen – funktioniert auch wenn summary fehlt
    var xp  = (p.xp !== undefined && p.xp !== null) ? Number(p.xp) : 0;
    var lvl = getLevel(xp);
    html += '<div class="player-card">';
    html += '<div class="p-dot"></div>';
    html += '<span class="p-name">' + p.name + '</span>';
    html += '<span class="p-xp">Lvl ' + lvl + ' · ⭐' + xp + '</span>';
    html += '</div>';
  }
  if (onlinePlayers.length === 0)
    html = '<p style="font-size:12px;color:var(--text-light)">Keine Mitspieler online</p>';
  el.innerHTML = html;
}

function renderSidebarResources() {
  var items = [
    { i: '🪵', k: 'wood',      n: 'Holz'   },
    { i: '🪨', k: 'stone',     n: 'Stein'  },
    { i: '🌾', k: 'wheat',     n: 'Weizen' },
    { i: '🍲', k: 'soup',      n: 'Suppe'  },
    { i: '🪑', k: 'furniture', n: 'Möbel'  },
    { i: '🧱', k: 'brick',     n: 'Ziegel' },
    { i: '🥖', k: 'bread',     n: 'Brot'   },
    { i: '💧', k: 'water',     n: 'Wasser' }
  ];
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    html += '<div class="res-row">' +
            '<span>' + it.i + '</span>' +
            '<span>' + it.n + '</span>' +
            '<span>' + (state.resources[it.k] || 0) + '</span>' +
            '</div>';
  }
  document.getElementById('sidebar-resources').innerHTML = html;
}

// ============================================================
// BUILDING POPUP
// ============================================================
function showBuildingPopup(b, px, py) {
  var pop = document.getElementById('info-popup');
  var bt  = BUILDING_TYPES[b.type];
  document.getElementById('popup-title').textContent =
    bt ? bt.emoji + ' ' + bt.name : b.type;

  var ch = CHAINS[b.type];
  document.getElementById('popup-desc').textContent = ch
    ? (ch.output
        ? (ch.input
            ? ch.inputAmt + 'x ' + ch.input + ' → ' + ch.outputAmt + 'x ' + ch.output
            : 'Produziert ' + ch.outputAmt + 'x ' + ch.output)
        : 'Spezialbau')
    : '';

  var cEl = document.getElementById('popup-chain');
  if (ch && ch.input) {
    var has = (state.resources[ch.input] || 0) >= ch.inputAmt;
    cEl.textContent = ch.input + ': ' + (state.resources[ch.input] || 0) + ' vorhanden';
    cEl.style.color = has ? '#4a8c42' : '#e05252';
  } else {
    cEl.textContent = '';
  }

  var ac = document.getElementById('popup-actions');
  ac.innerHTML = '';

  if (ch && ch.output) {
    var idle = state.villagers.filter(function(v) { return v.buildingId === null; });
    var wrks = state.villagers.filter(function(v) { return v.buildingId === b.id; });

    for (var i = 0; i < idle.length; i++) {
      (function(v, bld, chain) {
        var btn = document.createElement('button');
        btn.className = 'assign-btn';
        btn.textContent = v.emoji + ' ' + v.name + ' zuweisen';
        btn.style.pointerEvents = 'all';
        btn.onclick = function() {
          v.buildingId = bld.id; v.task = chain.output; v.progress = 0;
          hidePopup(); renderSidebar(); renderActiveTab();
          showNotif(v.name + ' → ' + (bt ? bt.name : bld.type));
        };
        ac.appendChild(btn);
      })(idle[i], b, ch);
    }

    for (var i = 0; i < wrks.length; i++) {
      (function(v) {
        var btn = document.createElement('button');
        btn.className = 'remove-btn';
        btn.textContent = v.emoji + ' ' + v.name + ' abziehen';
        btn.style.pointerEvents = 'all';
        btn.onclick = function() {
          v.buildingId = null; v.task = 'Idle'; v.progress = 0;
          hidePopup(); renderSidebar(); renderActiveTab();
          showNotif(v.name + ' ist frei');
        };
        ac.appendChild(btn);
      })(wrks[i]);
    }
  }

  pop.style.display = 'block';
  var wrap = document.getElementById('canvas-wrap');
  var l = px + 14, t = py - 65;
  if (l + 220 > wrap.clientWidth)  l = px - 220;
  if (t < 0)                        t = py + 14;
  pop.style.left = l + 'px';
  pop.style.top  = t + 'px';
}

function hidePopup() {
  document.getElementById('info-popup').style.display = 'none';
}