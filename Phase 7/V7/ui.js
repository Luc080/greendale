// ============================================================
// UI.JS – v6.5
// Änderungen: Ketten-Tab entfernt, Timer in Sidebar,
//             Casino/Events/Handel/Chat unverändert
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

function showCoinsAnimation(text) {
  var el = document.createElement('div');
  el.className   = 'coins-fly';
  el.textContent = text;
  document.getElementById('canvas-wrap').appendChild(el);
  setTimeout(function() { el.remove(); }, 1200);
}

function showLevelUpEffect() {
  var el = document.getElementById('levelup-overlay');
  if (!el) return;
  el.style.display = 'flex';
  setTimeout(function() { el.style.display = 'none'; }, 2500);
}

// ============================================================
// TABS – v6.5: Ketten-Tab entfernt
// ============================================================
function switchTab(tab) {
  state.activeTab = tab;
  var btns = document.querySelectorAll('.tab-btn');
  var tabs = ['villagers', 'build', 'casino', 'trade', 'chat'];
  for (var i = 0; i < btns.length; i++)
    btns[i].classList.toggle('active', tabs[i] === tab);
  renderActiveTab();
}

function renderActiveTab() {
  if      (state.activeTab === 'villagers') renderVillagerTab();
  else if (state.activeTab === 'build')     renderBuildTab();
  else if (state.activeTab === 'casino')    renderCasinoTab();
  else if (state.activeTab === 'trade')     renderTradeTab();
  else if (state.activeTab === 'chat')      renderChatTab();
  else renderVillagerTab();
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

    // Timer für zugewiesenes Gebäude
    var timerStr = '';
    if (v.buildingId !== null && state.buildingTimers && state.buildingTimers[v.buildingId]) {
      var timer = state.buildingTimers[v.buildingId];
      var remaining = Math.max(0, timer.total - timer.elapsed);
      var mins = Math.floor(remaining / 60), secs = Math.floor(remaining % 60);
      timerStr = ' <span class="v-timer">⏱' + (mins>0?mins+':'+('0'+secs).slice(-2):secs+'s') + '</span>';
    }

    html += '<div class="villager-row' + (state.selectedVillager===v.id?' selected':'') + '" onclick="selVillager('+v.id+')">';
    html += '<div class="v-avatar" style="background:'+bg+'">'+v.emoji+'</div>';
    html += '<span class="v-name">'+v.name+'</span>';
    html += '<span class="v-task '+tc+'">'+tt+'</span>';
    html += timerStr;
    html += '<span class="v-speed">⚡'+spd+'</span></div>';
  }
  if (!html) html = '<p style="font-size:12px;color:var(--text-light);padding:4px">Keine Villager.</p>';
  document.getElementById('tab-content').innerHTML = html;
}
function selVillager(id) { state.selectedVillager = (state.selectedVillager===id)?null:id; renderVillagerTab(); }

// ============================================================
// BUILD TAB
// ============================================================
function renderBuildTab() {
  var html = '<div class="building-grid">';
  var keys = Object.keys(BUILDING_TYPES);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], bt = BUILDING_TYPES[k];
    var locked = state.xp < bt.reqXP || (bt.reqLevel && getLevel(state.xp) < bt.reqLevel);
    var sel    = state.buildMode === k ? ' selected' : '';
    var lk     = locked ? ' locked' : '';
    var oc     = locked ? '' : ' onclick="startBuild(\''+k+'\')"';
    var extra  = '';
    if (bt.reqLevel) extra = ' 🎰Lvl'+bt.reqLevel;
    else if (bt.reqXP > 0) extra = ' ⭐'+bt.reqXP;

    // Produktionszeit anzeigen
    var prodTime = PRODUCE_INTERVAL_SEC[k];
    var timeStr = '';
    if (prodTime && prodTime < 999) {
      timeStr = ' ⏱' + (prodTime >= 60 ? Math.round(prodTime/60)+'min' : prodTime+'s');
    }

    html += '<div class="build-card'+sel+lk+'"'+oc+'>';
    html += '<span class="build-icon">'+bt.emoji+'</span>';
    html += '<div><div>'+bt.name+'</div>';
    html += '<div class="build-cost">🪵'+bt.costWood+' 🪨'+bt.costStone+extra+timeStr+'</div></div></div>';
  }
  html += '</div>';
  if (state.buildMode)
    html += '<p style="margin-top:6px;font-size:12px;color:var(--green-dark);font-weight:700">📍 Klick auf Karte — <span style="cursor:pointer;text-decoration:underline" onclick="cancelBuild()">abbrechen</span></p>';
  document.getElementById('tab-content').innerHTML = html;
}
function startBuild(t) { state.buildMode=(state.buildMode===t)?null:t; renderBuildTab(); }
function cancelBuild() { state.buildMode=null; state.hoverTile=null; renderBuildTab(); }

// ============================================================
// CASINO TAB
// ============================================================
var bjState = null;

function renderCasinoTab() {
  var lvl = getLevel(state.xp);
  var hasCasino = false;
  for (var i = 0; i < state.buildings.length; i++) {
    if (state.buildings[i].type === 'casino') { hasCasino = true; break; }
  }

  if (lvl < 5) {
    document.getElementById('tab-content').innerHTML =
      '<div style="padding:10px;text-align:center;color:var(--text-light);font-size:12px">' +
      '🎰 Casino freischaltbar ab <strong>Level 5</strong><br>' +
      'Aktuell: Level ' + lvl + ' – noch ' + (950 - state.xp) + ' XP fehlen' +
      '</div>';
    return;
  }
  if (!hasCasino) {
    document.getElementById('tab-content').innerHTML =
      '<div style="padding:10px;text-align:center;color:var(--text-light);font-size:12px">' +
      '🎰 Baue zuerst ein <strong>Casino</strong> (🪵20 🪨20)<br>' +
      '<button class="tab-action-btn" onclick="startBuild(\'casino\');switchTab(\'build\')">→ Jetzt bauen</button>' +
      '</div>';
    return;
  }

  var html = '<div class="casino-wrap">';
  html += '<div class="casino-coins">🪙 ' + (state.coins||0) + ' Coins</div>';

  // SLOT MACHINE
  html += '<div class="casino-section">';
  html += '<div class="casino-title">🎰 Slot Machine</div>';
  html += '<div id="slot-display" class="slot-display">';
  html += '<div class="slot-reel" id="slot-0">🎰</div>';
  html += '<div class="slot-reel" id="slot-1">🎰</div>';
  html += '<div class="slot-reel" id="slot-2">🎰</div>';
  html += '</div>';
  html += '<div id="slot-result" class="casino-result"></div>';
  html += '<div class="casino-bets">';
  html += '<button class="bet-btn" onclick="playSlot(5)">5🪙</button>';
  html += '<button class="bet-btn" onclick="playSlot(10)">10🪙</button>';
  html += '<button class="bet-btn" onclick="playSlot(25)">25🪙</button>';
  html += '</div></div>';

  // BLACKJACK
  html += '<div class="casino-section">';
  html += '<div class="casino-title">🃏 Blackjack</div>';
  if (!bjState || bjState.finished) {
    html += '<div id="bj-area"><div class="casino-result" id="bj-result">' + (bjState ? bjState.resultMsg : '') + '</div>';
    html += '<div class="casino-bets">';
    html += '<button class="bet-btn" onclick="startBlackjack(5)">5🪙</button>';
    html += '<button class="bet-btn" onclick="startBlackjack(10)">10🪙</button>';
    html += '<button class="bet-btn" onclick="startBlackjack(20)">20🪙</button>';
    html += '</div></div>';
  } else {
    html += renderBlackjackActive();
  }
  html += '</div>';
  html += '</div>';
  document.getElementById('tab-content').innerHTML = html;
}

function renderBlackjackActive() {
  var bj = bjState;
  var html = '<div id="bj-area">';
  html += '<div class="bj-table">';
  html += '<div class="bj-hand"><span class="bj-label">Dealer:</span> ';
  html += renderCard(bj.dealer[0]) + ' <span class="bj-hidden">🂠</span>';
  html += ' <span class="bj-score">(' + bj.dealerValue + '?)</span></div>';
  html += '<div class="bj-hand"><span class="bj-label">Du:</span> ';
  for (var i = 0; i < bj.player.length; i++) html += renderCard(bj.player[i]);
  html += ' <span class="bj-score">(' + bjHandValue(bj.player) + ')</span></div>';
  html += '</div>';
  html += '<div class="bj-result" id="bj-result"></div>';
  html += '<div class="bj-actions">';
  html += '<button class="bet-btn green" onclick="bjHit()">Hit 🃏</button>';
  html += '<button class="bet-btn red" onclick="bjStand()">Stand ✋</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-light);margin-top:2px">Einsatz: '+bj.bet+'🪙</div>';
  html += '</div>';
  return html;
}

function renderCard(card) {
  var isRed = card.suit === '♥' || card.suit === '♦';
  return '<span class="bj-card' + (isRed?' red':'') + '">' + card.rank + card.suit + '</span>';
}

function playSlot(bet) {
  if ((state.coins||0) < bet) { showNotif('Zu wenig Coins!'); return; }
  state.coins -= bet;
  document.getElementById('coins-val').textContent = state.coins;

  var reels = [document.getElementById('slot-0'), document.getElementById('slot-1'), document.getElementById('slot-2')];
  var results = [spinSlot(), spinSlot(), spinSlot()];

  for (var i = 0; i < 3; i++) {
    (function(idx, result) {
      var frames = 0, maxFrames = 14 + idx * 5;
      var ticker = setInterval(function() {
        reels[idx].textContent = SLOT_SYMBOLS[Math.floor(Math.random()*SLOT_SYMBOLS.length)].emoji;
        frames++;
        if (frames >= maxFrames) {
          clearInterval(ticker);
          reels[idx].textContent = result.emoji;
          if (idx === 2) resolveSlot(results, bet);
        }
      }, 90);
    })(i, results[i]);
  }
}

function resolveSlot(results, bet) {
  var resEl = document.getElementById('slot-result');
  if (!resEl) return;
  var a = results[0], b = results[1], c = results[2];
  var win = 0;
  if (a.emoji === b.emoji && b.emoji === c.emoji) {
    win = bet * a.payout;
    resEl.textContent = '🎉 JACKPOT! +' + win + '🪙';
    resEl.style.color = '#f0a500';
  } else if (a.emoji === b.emoji || b.emoji === c.emoji || a.emoji === c.emoji) {
    win = Math.round(bet * 1.5);
    resEl.textContent = '✅ Gewinn! +' + win + '🪙';
    resEl.style.color = '#4a8c42';
  } else {
    resEl.textContent = '❌ Verloren (-' + bet + '🪙)';
    resEl.style.color = '#e05252';
  }
  state.coins += win;
  document.getElementById('coins-val').textContent = state.coins;
}

function startBlackjack(bet) {
  if ((state.coins||0) < bet) { showNotif('Zu wenig Coins!'); return; }
  state.coins -= bet;
  var deck = makeDeck();
  bjState = {
    deck: deck, bet: bet, finished: false,
    player: [deck.pop(), deck.pop()],
    dealer: [deck.pop(), deck.pop()],
    dealerValue: null, resultMsg: ''
  };
  bjState.dealerValue = bjHandValue([bjState.dealer[0]]);
  if (bjHandValue(bjState.player) === 21) { bjStand(); return; }
  renderActiveTab();
}

function bjHit() {
  if (!bjState || bjState.finished) return;
  bjState.player.push(bjState.deck.pop());
  if (bjHandValue(bjState.player) > 21) bjFinish('bust');
  else renderActiveTab();
}

function bjStand() {
  if (!bjState || bjState.finished) return;
  while (bjHandValue(bjState.dealer) < 17) bjState.dealer.push(bjState.deck.pop());
  var pv = bjHandValue(bjState.player), dv = bjHandValue(bjState.dealer);
  if (dv > 21 || pv > dv)       bjFinish('win');
  else if (pv === dv)            bjFinish('push');
  else                           bjFinish('lose');
}

function bjFinish(outcome) {
  bjState.finished = true;
  var win = 0;
  var msgs = { win:'🎉 Gewonnen!', lose:'❌ Verloren!', push:'🤝 Unentschieden', bust:'💥 Bust!' };
  if (outcome === 'win')  win = bjState.bet * 2;
  if (outcome === 'push') win = bjState.bet;
  bjState.resultMsg = msgs[outcome] + (win ? ' +'+win+'🪙' : '');
  state.coins += win;
  document.getElementById('coins-val').textContent = state.coins;
  renderActiveTab();
}

// ============================================================
// HANDEL TAB
// ============================================================
function renderTradeTab() {
  var html = '<div style="padding:4px">';
  if (onlinePlayers.length <= 1) {
    html += '<p style="font-size:12px;color:var(--text-light)">Keine Mitspieler online zum Handeln.</p>';
  } else {
    html += '<div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:5px">🤝 Ressourcen tauschen</div>';
    html += '<div style="font-size:11px;color:var(--text-light);margin-bottom:6px">Wähle einen Mitspieler:</div>';
    html += '<select id="trade-target" style="width:100%;margin-bottom:5px;padding:3px;border-radius:5px;border:1.5px solid var(--ui-border);font-family:Nunito,sans-serif">';
    for (var i = 0; i < onlinePlayers.length; i++) {
      if (onlinePlayers[i].id !== myPlayerId)
        html += '<option value="'+onlinePlayers[i].name+'">'+onlinePlayers[i].name+'</option>';
    }
    html += '</select>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px">';
    html += tradeResInput('Ich biete', 'trade-offer');
    html += tradeResInput('Ich möchte', 'trade-request');
    html += '</div>';
    html += '<button class="order-btn" style="width:100%;padding:5px" onclick="sendTradeOffer()">🤝 Angebot senden</button>';
  }
  html += '</div>';
  document.getElementById('tab-content').innerHTML = html;
}

function tradeResInput(label, prefix) {
  var resources = ['wood','stone','wheat','soup','furniture','brick','bread','tool'];
  var html = '<div style="background:#fff;border:1.5px solid var(--ui-border);border-radius:7px;padding:5px">';
  html += '<div style="font-size:10px;font-weight:800;margin-bottom:3px;color:var(--text-light)">'+label+'</div>';
  for (var i = 0; i < resources.length; i++) {
    var r = resources[i];
    html += '<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px">';
    html += '<span style="font-size:10px;flex:1">'+r+'</span>';
    html += '<input id="'+prefix+'-'+r+'" type="number" min="0" max="50" value="0" style="width:38px;padding:1px 3px;border-radius:4px;border:1px solid #ccc;font-size:10px">';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function sendTradeOffer() {
  var target = document.getElementById('trade-target');
  if (!target) return;
  var resources = ['wood','stone','wheat','soup','furniture','brick','bread','tool'];
  var offer = {}, request = {};
  for (var i = 0; i < resources.length; i++) {
    var r = resources[i];
    var ov = parseInt(document.getElementById('trade-offer-'+r)?.value||0);
    var rv = parseInt(document.getElementById('trade-request-'+r)?.value||0);
    if (ov > 0) offer[r] = ov;
    if (rv > 0) request[r] = rv;
  }
  if (Object.keys(offer).length === 0 && Object.keys(request).length === 0) {
    showNotif('Kein Angebot eingetragen!'); return;
  }
  networkSendTradeOffer(target.value, offer, request);
  showNotif('Angebot an ' + target.value + ' gesendet!');
}

function showTradePopup(msg) {
  var offerStr = Object.entries(msg.offer||{}).map(function(e){return e[1]+'x '+e[0];}).join(', ') || '-';
  var reqStr   = Object.entries(msg.request||{}).map(function(e){return e[1]+'x '+e[0];}).join(', ') || '-';
  var html = '<div style="padding:10px">';
  html += '<div style="font-weight:800;margin-bottom:5px">🤝 Handelsangebot von <strong>'+msg.fromName+'</strong></div>';
  html += '<div style="font-size:12px;margin-bottom:3px">Bietet dir: <strong>'+offerStr+'</strong></div>';
  html += '<div style="font-size:12px;margin-bottom:8px">Möchte: <strong>'+reqStr+'</strong></div>';
  html += '<button class="order-btn" style="margin-right:5px" onclick="acceptTrade(\''+msg.fromId+'\')">✅ Annehmen</button>';
  html += '<button class="order-btn" style="background:#e05252" onclick="hideTradePopup()">❌ Ablehnen</button>';
  html += '</div>';
  var pop = document.getElementById('trade-popup');
  if (pop) { pop.innerHTML = html; pop.style.display = 'block'; }
}

function acceptTrade(partnerId) {
  var t = state.tradeOffer;
  if (!t) return;
  networkAcceptTrade(partnerId, t.offer, t.request);
  hideTradePopup();
}

function hideTradePopup() {
  var pop = document.getElementById('trade-popup');
  if (pop) pop.style.display = 'none';
  state.tradeOffer = null;
}

// ============================================================
// CHAT TAB
// ============================================================
var chatMessages = [];

function renderChatTab() {
  var html = '<div id="chat-messages">';
  for (var i = 0; i < chatMessages.length; i++) {
    var m = chatMessages[i];
    if (m.system) html += '<div class="chat-msg system">'+m.text+'</div>';
    else html += '<div class="chat-msg"><span class="cm-name">'+m.name+':</span> '+m.text+'</div>';
  }
  html += '</div>';
  html += '<div class="chat-input-row"><input id="chat-input" type="text" placeholder="Nachricht..." maxlength="100" onkeydown="chatKeydown(event)"><button onclick="sendChat()">➤</button></div>';
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
  chatMessages.push({ name:name, text:text, system:!!system });
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
    html += '<div class="order-card'+(ok?' completable':'')+'">';
    html += '<div class="order-label">'+o.label+'</div>';
    html += '<div class="order-footer">';
    html += '<span class="order-reward">+'+o.xp+' XP +' + (o.coins||5) + '🪙</span>';
    html += '<button class="order-btn"'+(ok?'':' disabled')+' onclick="fulfillOrder(\''+o.id+'\')">'+(ok?'✓ Liefern':'warten')+'</button>';
    html += '</div></div>';
  }
  if (!html) html = '<p style="font-size:12px;color:var(--text-light)">Warte auf Server...</p>';
  document.getElementById('sidebar-orders').innerHTML = html;
}

function canFulfillOrder(o) {
  for (var res in o.items)
    if ((state.resources[res]||0) < o.items[res]) return false;
  return true;
}

function renderSidebarVillagers() {
  var html = '';
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    var dots = '';
    for (var d = 0; d < MAX_HUNGER; d++) {
      var cls = d < v.hunger ? (v.hunger<=1?'l':'f') : '';
      dots += '<div class="hd '+cls+'"></div>';
    }
    var sc  = v.buildingId !== null ? 'working' : '';
    var st2 = v.buildingId !== null ? '🔨 arbeitet' : '😴 idle';

    // Timer pro Villager
    var timerStr = '';
    if (v.buildingId !== null && state.buildingTimers && state.buildingTimers[v.buildingId]) {
      var timer = state.buildingTimers[v.buildingId];
      var remaining = Math.max(0, timer.total - timer.elapsed);
      var mins = Math.floor(remaining / 60), secs = Math.floor(remaining % 60);
      timerStr = ' <span class="v-timer">⏱'+(mins>0?mins+':'+('0'+secs).slice(-2):secs+'s')+'</span>';
    }

    html += '<div class="vil-mini">';
    html += '<span style="font-size:16px">'+v.emoji+'</span>';
    html += '<span class="v-name">'+v.name+'</span>';
    html += '<span class="v-status '+sc+'">'+st2+'</span>';
    html += timerStr;
    html += '<div class="vil-hunger">'+dots+'</div></div>';
  }

  var nextIdx = state.villagers.length;
  var nextVP;
  if (nextIdx < VILLAGER_POOL.length) nextVP = VILLAGER_POOL[nextIdx];
  else nextVP = {
    name: VILLAGER_NAMES_EXTRA[nextIdx % VILLAGER_NAMES_EXTRA.length],
    emoji: VILLAGER_EMOJIS[nextIdx % VILLAGER_EMOJIS.length],
    reqXP: getExtraVillagerXP(nextIdx)
  };
  var alreadyHired = false;
  for (var j = 0; j < state.villagers.length; j++)
    if (state.villagers[j].name === nextVP.name) { alreadyHired = true; break; }
  if (!alreadyHired) {
    var can = state.xp >= nextVP.reqXP;
    html += '<button class="hire-btn"'+(can?'':' disabled')+' onclick="hireVillager('+nextIdx+')">';
    html += nextVP.emoji+' '+nextVP.name+' einstellen';
    if (!can) html += ' (⭐'+nextVP.reqXP+' / Lvl '+getLevel(nextVP.reqXP)+')';
    html += '</button>';
  }
  document.getElementById('sidebar-villagers').innerHTML = html;
}

function renderSidebarPlayers() {
  var el = document.getElementById('sidebar-players');
  if (!el) return;
  var html = '';
  for (var i = 0; i < onlinePlayers.length; i++) {
    var p   = onlinePlayers[i];
    var xp  = (p.xp !== undefined && p.xp !== null) ? Number(p.xp) : 0;
    var lvl = getLevel(xp);
    html += '<div class="player-card">';
    html += '<div class="p-dot"></div>';
    html += '<span class="p-name">'+p.name+'</span>';
    html += '<span class="p-xp">Lvl '+lvl+' · ⭐'+xp+'</span>';
    html += '</div>';
  }
  if (onlinePlayers.length === 0)
    html = '<p style="font-size:12px;color:var(--text-light)">Keine Mitspieler</p>';
  el.innerHTML = html;
}

function renderSidebarResources() {
  var items = [
    { i:'🪵', k:'wood',      n:'Holz'      },
    { i:'🪨', k:'stone',     n:'Stein'     },
    { i:'🌾', k:'wheat',     n:'Weizen'    },
    { i:'🍲', k:'soup',      n:'Suppe'     },
    { i:'🪑', k:'furniture', n:'Möbel'     },
    { i:'🧱', k:'brick',     n:'Ziegel'    },
    { i:'🥖', k:'bread',     n:'Brot'      },
    { i:'💧', k:'water',     n:'Wasser'    },
    { i:'⚒️', k:'tool',      n:'Werkzeug'  }
  ];
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    html += '<div class="res-row"><span>'+it.i+'</span><span>'+it.n+'</span><span>'+(state.resources[it.k]||0)+'</span></div>';
  }
  document.getElementById('sidebar-resources').innerHTML = html;
}

// ============================================================
// VALLEY EVENT DISPLAY
// ============================================================
function updateEventDisplay() {
  var el = document.getElementById('event-banner');
  if (!el) return;
  if (!state.activeEvent) { el.style.display = 'none'; return; }
  var ev   = state.activeEvent;
  var now  = Date.now();
  var secs = Math.max(0, Math.round((ev.endsAt - now) / 1000));
  var mins = Math.floor(secs / 60);
  var ss   = secs % 60;
  var timeStr = mins + ':' + (ss < 10 ? '0' : '') + ss;
  var progParts = [];
  for (var k in ev.goal) {
    var cur = ev.progress[k] || 0, goal = ev.goal[k];
    progParts.push(cur + '/' + goal + ' ' + k);
  }
  el.style.display = 'flex';
  el.innerHTML =
    '<span class="event-title">' + ev.title + '</span>' +
    '<span class="event-prog">' + progParts.join(' · ') + '</span>' +
    '<span class="event-time">⏰ ' + timeStr + '</span>';
}

setInterval(function() {
  if (state.activeEvent) updateEventDisplay();
}, 10000);

// ============================================================
// BUILDING POPUP
// ============================================================
function showBuildingPopup(b, px, py) {
  var pop = document.getElementById('info-popup');
  var bt  = BUILDING_TYPES[b.type];
  document.getElementById('popup-title').textContent =
    (bt ? bt.emoji + ' ' + bt.name : b.type);

  var ch = CHAINS[b.type];
  var descParts = [];
  if (ch && ch.output) {
    if (ch.input)  descParts.push(ch.inputAmt  + 'x ' + ch.input  + ' →');
    if (ch.inputB) descParts.push(ch.inputAmtB + 'x ' + ch.inputB + ' →');
    descParts.push(ch.outputAmt + 'x ' + ch.output);
    // Produktionszeit anzeigen
    var prodSec = PRODUCE_INTERVAL_SEC[b.type];
    if (prodSec && prodSec < 999) {
      var prodStr = prodSec >= 60 ? Math.round(prodSec/60)+'min' : prodSec+'s';
      descParts.push('(⏱'+prodStr+')');
    }
  }
  document.getElementById('popup-desc').textContent =
    descParts.length ? descParts.join(' ') : (ch ? 'Spezialbau' : '');

  var cEl = document.getElementById('popup-chain');
  if (ch && ch.input) {
    var has  = (state.resources[ch.input]||0)  >= ch.inputAmt;
    var hasB = !ch.inputB || (state.resources[ch.inputB]||0) >= ch.inputAmtB;
    cEl.textContent = ch.input + ': ' + (state.resources[ch.input]||0) + ' vorhanden';
    cEl.style.color = (has && hasB) ? '#4a8c42' : '#e05252';
  } else { cEl.textContent = ''; }

  // Timer-Anzeige im Popup
  var timer = state.buildingTimers && state.buildingTimers[b.id];
  if (timer) {
    var remaining = Math.max(0, timer.total - timer.elapsed);
    var mins = Math.floor(remaining / 60), secs = Math.floor(remaining % 60);
    var pct = Math.round((timer.elapsed / timer.total) * 100);
    var timerEl = document.getElementById('popup-chain');
    if (timerEl) {
      timerEl.textContent += '  ⏱ ' + (mins>0?mins+':'+('0'+secs).slice(-2):secs+'s') + ' (' + pct + '%)';
    }
  }

  var ac = document.getElementById('popup-actions');
  ac.innerHTML = '';

  if (b.type === 'casino') {
    var btn = document.createElement('button');
    btn.className = 'assign-btn';
    btn.textContent = '🎰 Casino öffnen';
    btn.onclick = function() { hidePopup(); switchTab('casino'); };
    ac.appendChild(btn);
  } else if (ch && ch.output) {
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
          // Timer zurücksetzen
          if (state.buildingTimers[bld.id]) state.buildingTimers[bld.id].elapsed = 0;
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
