// ============================================================
// NETWORK.JS – Phase 4
// Neu: Events, Handel, Coins, Supabase-DB
// ============================================================

var ws = null;
var onlinePlayers    = [];
var myPlayerId       = null;
var myValleyId       = null;
var reconnectTimer   = null;
var connectionStatus = 'disconnected';

function connectToServer(playerName, valleyId) {
  var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl    = protocol + '//' + window.location.host;
  setConnectionStatus('connecting');
  ws = new WebSocket(wsUrl);

  ws.onopen = function() {
    setConnectionStatus('connected');
    clearTimeout(reconnectTimer);
    wsSend({
      type: 'join', valleyId: valleyId,
      playerName: playerName, state: getStateSummary()
    });
  };
  ws.onmessage = function(event) {
    var msg;
    try { msg = JSON.parse(event.data); } catch(e) { return; }
    handleServerMessage(msg);
  };
  ws.onclose = function() {
    setConnectionStatus('disconnected');
    reconnectTimer = setTimeout(function() {
      if (myValleyId && state.playerName) connectToServer(state.playerName, myValleyId);
    }, 3000);
  };
  ws.onerror = function(e) {
    console.error('WS Fehler:', e);
    setConnectionStatus('disconnected');
  };
}

// ============================================================
// SERVER-NACHRICHTEN
// ============================================================
function handleServerMessage(msg) {
  switch (msg.type) {

    case 'joined':
      myPlayerId   = msg.playerId;
      myValleyId   = msg.valleyId;
      state.orders = msg.valleyOrders || [];
      onlinePlayers = (msg.players || []).map(function(p) {
        return { id:p.id||'', name:p.name||'Anonym', xp: typeof p.xp==='number'?p.xp:0 };
      });

      // Supabase-Stand übernehmen wenn vorhanden
      if (msg.dbState) applyDbState(msg.dbState);

      // Valley-Event
      if (msg.activeEvent) {
        state.activeEvent = msg.activeEvent;
        updateEventDisplay();
      }

      document.getElementById('valley-name-display').textContent = msg.valleyId;
      document.getElementById('online-count').textContent        = onlinePlayers.length;
      resizeCanvas();
      renderSidebarOrders();
      renderSidebarPlayers();
      updateResourceDisplay();
      addChatMessage('System', 'Du bist Valley "' + msg.valleyId + '" beigetreten!', true);
      break;

    case 'player_joined':
      onlinePlayers = (msg.players || []).map(function(p) {
        return { id:p.id||'', name:p.name||'Anonym', xp:typeof p.xp==='number'?p.xp:0 };
      });
      document.getElementById('online-count').textContent = onlinePlayers.length;
      renderSidebarPlayers();
      addChatMessage('System', msg.playerName + ' ist beigetreten 👋', true);
      showNotif('👋 ' + msg.playerName + ' ist dabei!');
      break;

    case 'player_left':
      onlinePlayers = (msg.players || []).map(function(p) {
        return { id:p.id||'', name:p.name||'Anonym', xp:typeof p.xp==='number'?p.xp:0 };
      });
      document.getElementById('online-count').textContent = onlinePlayers.length;
      renderSidebarPlayers();
      addChatMessage('System', msg.playerName + ' hat das Valley verlassen', true);
      break;

    case 'player_state':
      var incomingXP = 0;
      if (msg.summary && typeof msg.summary.xp === 'number') incomingXP = msg.summary.xp;
      var found = false;
      for (var i = 0; i < onlinePlayers.length; i++) {
        if (onlinePlayers[i].id === msg.playerId) {
          onlinePlayers[i].xp = incomingXP;
          onlinePlayers[i].name = msg.playerName || onlinePlayers[i].name;
          found = true; break;
        }
      }
      if (!found && msg.playerId) onlinePlayers.push({ id:msg.playerId, name:msg.playerName||'Anonym', xp:incomingXP });
      renderSidebarPlayers();
      break;

    case 'orders_updated':
      state.orders = msg.orders || [];
      if (msg.xpGained) {
        state.xp += msg.xpGained;
        document.getElementById('xp-val').textContent = state.xp;
        checkNewVillager();
        updateLevelDisplay();
      }
      if (msg.coinsGained) {
        state.coins = (state.coins || 0) + msg.coinsGained;
        document.getElementById('coins-val').textContent = state.coins;
        showCoinsAnimation('+' + msg.coinsGained + '🪙');
      }
      if (msg.message) {
        showNotif(msg.message);
        addChatMessage('System', msg.message, true);
      }
      renderSidebarOrders();
      break;

    // ── Valley-Events ─────────────────────────────────────────
    case 'event_started':
      state.activeEvent = msg.event;
      updateEventDisplay();
      showNotif('🎉 ' + msg.event.title + ' gestartet!');
      addChatMessage('System', '🎉 ' + msg.event.title + ': ' + msg.event.desc, true);
      break;

    case 'event_progress':
      state.activeEvent = msg.event;
      updateEventDisplay();
      break;

    case 'event_completed':
      state.activeEvent = null;
      updateEventDisplay();
      if (msg.reward) {
        state.xp    += msg.reward.xp    || 0;
        state.coins += msg.reward.coins || 0;
        updateResourceDisplay();
      }
      showNotif(msg.message || '🎉 Event abgeschlossen!');
      addChatMessage('System', msg.message || '🎉 Event abgeschlossen!', true);
      showLevelUpEffect();
      break;

    case 'event_ended':
      state.activeEvent = null;
      updateEventDisplay();
      if (msg.message) addChatMessage('System', msg.message, true);
      break;

    // ── Handel ────────────────────────────────────────────────
    case 'trade_incoming':
      state.tradeOffer = msg;
      showTradePopup(msg);
      break;

    case 'trade_completed':
      if (msg.role === 'receiver') {
        // Erhalten was offer war
        for (var res in msg.receive) {
          state.resources[res] = (state.resources[res] || 0) + (msg.receive[res] || 0);
        }
        for (var res in msg.give) {
          state.resources[res] = Math.max(0, (state.resources[res] || 0) - (msg.give[res] || 0));
        }
      } else {
        // Sender: gib offer, erhalte request
        for (var res in msg.give) {
          state.resources[res] = Math.max(0, (state.resources[res] || 0) - (msg.give[res] || 0));
        }
        for (var res in msg.receive) {
          state.resources[res] = (state.resources[res] || 0) + (msg.receive[res] || 0);
        }
      }
      updateResourceDisplay();
      showNotif('✅ Handel mit ' + msg.partnerName + ' abgeschlossen!');
      addChatMessage('System', '🤝 Handel mit ' + msg.partnerName + ' abgeschlossen!', true);
      hideTradePopup();
      break;

    case 'chat':
      addChatMessage(msg.playerName, msg.text, false);
      if (state.activeTab !== 'chat')
        showNotif('💬 ' + msg.playerName + ': ' + msg.text.slice(0, 30));
      break;

    case 'error':
      alert('Server: ' + msg.message);
      break;

    case 'pong':
      break;
  }
}

// ============================================================
// SENDEN
// ============================================================
function wsSend(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function sendStateUpdate(persist) {
  wsSend({
    type:    'state_update',
    persist: !!persist,
    state:   {
      playerName: state.playerName, xp: state.xp, coins: state.coins,
      day: state.day, tick: state.tick, resources: state.resources,
      nextVillagerId: state.nextVillagerId, prevXP: state.prevXP,
      villagers: state.villagers, buildings: state.buildings
    },
    summary: getStateSummary()
  });
}

function networkFulfillOrder(orderId) {
  wsSend({ type: 'fulfill_order', orderId: orderId });
}

function networkSendChat(text) {
  wsSend({ type: 'chat', text: text });
  addChatMessage(state.playerName + ' (du)', text, false);
}

function networkSendTradeOffer(targetName, offer, request) {
  wsSend({ type: 'trade_offer', targetName: targetName, offer: offer, request: request });
}

function networkAcceptTrade(partnerId, offer, request) {
  wsSend({ type: 'trade_accept', partnerId: partnerId, offer: offer, request: request });
}

function getStateSummary() {
  return {
    playerName:    state.playerName,
    xp:            state.xp,
    coins:         state.coins,
    villagerCount: state.villagers.length,
    buildingCount: state.buildings.length
  };
}

// ============================================================
// VERBINDUNGSSTATUS
// ============================================================
function setConnectionStatus(status) {
  connectionStatus = status;
  var el = document.getElementById('connection-status');
  if (!el) return;
  el.className   = status;
  el.textContent = status === 'connected'  ? '🟢 Online'      :
                   status === 'connecting' ? '🟡 Verbinde...' : '🔴 Offline';
}

setInterval(function() {
  if (ws && ws.readyState === WebSocket.OPEN) wsSend({ type: 'ping' });
}, 30000);

// ============================================================
// JOIN SCREEN
// ============================================================
function joinValley() {
  var nameInput   = document.getElementById('player-name-input');
  var valleyInput = document.getElementById('valley-input');
  var errorEl     = document.getElementById('join-error');
  var playerName  = nameInput.value.trim();
  var valleyId    = valleyInput.value.trim().toLowerCase().replace(/\s+/g, '-') || 'default';

  if (!playerName)          { errorEl.textContent = 'Bitte gib deinen Namen ein!'; return; }
  if (playerName.length < 2){ errorEl.textContent = 'Name muss min. 2 Zeichen haben'; return; }

  state.playerName = playerName;
  myValleyId       = valleyId;
  loadGame(playerName);

  document.getElementById('join-screen').style.display        = 'none';
  document.getElementById('game-container').style.display     = 'flex';
  document.getElementById('game-container').style.flexDirection = 'column';
  setTimeout(function() { resizeCanvas(); }, 50);
  connectToServer(playerName, valleyId);
  if (window.history && window.history.replaceState)
    window.history.replaceState({}, '', '?valley=' + valleyId);
}

// Valley aus URL vorausfüllen
(function() {
  var params = new URLSearchParams(window.location.search);
  var valley = params.get('valley');
  if (valley) {
    var el = document.getElementById('valley-input');
    if (el) el.value = valley;
  }
})();
