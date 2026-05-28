// ============================================================
// NETWORK.JS – WebSocket Verbindung zum Server
// Abhängig von: data.js, state.js, ui.js
// ============================================================

var ws = null;
var onlinePlayers    = [];
var myPlayerId       = null;
var myValleyId       = null;
var reconnectTimer   = null;
var connectionStatus = 'disconnected';

// ============================================================
// VERBINDUNG AUFBAUEN
// ============================================================
function connectToServer(playerName, valleyId) {
  var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl    = protocol + '//' + window.location.host;

  setConnectionStatus('connecting');
  ws = new WebSocket(wsUrl);

  ws.onopen = function() {
    setConnectionStatus('connected');
    clearTimeout(reconnectTimer);
    console.log('Verbunden mit Server');
    wsSend({
      type:       'join',
      valleyId:   valleyId,
      playerName: playerName,
      state:      getStateSummary()
    });
  };

  ws.onmessage = function(event) {
    var msg;
    try { msg = JSON.parse(event.data); }
    catch(e) { return; }
    handleServerMessage(msg);
  };

  ws.onclose = function() {
    setConnectionStatus('disconnected');
    console.log('Verbindung getrennt – Reconnect in 3s...');
    reconnectTimer = setTimeout(function() {
      if (myValleyId && state.playerName) {
        connectToServer(state.playerName, myValleyId);
      }
    }, 3000);
  };

  ws.onerror = function(e) {
    console.error('WebSocket Fehler:', e);
    setConnectionStatus('disconnected');
  };
}

// ============================================================
// NACHRICHTEN VOM SERVER VERARBEITEN
// ============================================================
function handleServerMessage(msg) {
  switch (msg.type) {

    case 'joined':
      myPlayerId  = msg.playerId;
      myValleyId  = msg.valleyId;
      state.orders = msg.valleyOrders || [];

      // XP aus Spielerliste sauber übernehmen (kein optional chaining)
      onlinePlayers = (msg.players || []).map(function(p) {
        return {
          id:   p.id   || '',
          name: p.name || 'Anonym',
          xp:   typeof p.xp === 'number' ? p.xp : 0
        };
      });

      document.getElementById('valley-name-display').textContent = msg.valleyId;
      document.getElementById('online-count').textContent        = onlinePlayers.length;

      // Canvas nach dem Einblenden neu zentrieren
      resizeCanvas();

      renderSidebarOrders();
      renderSidebarPlayers();
      updateResourceDisplay();
      addChatMessage('System', 'Du bist Valley "' + msg.valleyId + '" beigetreten!', true);
      break;

    case 'player_joined':
      onlinePlayers = (msg.players || []).map(function(p) {
        return {
          id:   p.id   || '',
          name: p.name || 'Anonym',
          xp:   typeof p.xp === 'number' ? p.xp : 0
        };
      });
      document.getElementById('online-count').textContent = onlinePlayers.length;
      renderSidebarPlayers();
      addChatMessage('System', msg.playerName + ' ist dem Valley beigetreten 👋', true);
      showNotif('👋 ' + msg.playerName + ' ist dabei!');
      break;

    case 'player_left':
      onlinePlayers = (msg.players || []).map(function(p) {
        return {
          id:   p.id   || '',
          name: p.name || 'Anonym',
          xp:   typeof p.xp === 'number' ? p.xp : 0
        };
      });
      document.getElementById('online-count').textContent = onlinePlayers.length;
      renderSidebarPlayers();
      addChatMessage('System', msg.playerName + ' hat das Valley verlassen', true);
      break;

    case 'player_state':
      // XP sauber auslesen – KEIN optional chaining (?.)
      var incomingXP = 0;
      if (msg.summary && typeof msg.summary.xp === 'number') {
        incomingXP = msg.summary.xp;
      } else if (msg.state && typeof msg.state.xp === 'number') {
        // Fallback: manche Clients senden xp direkt in state
        incomingXP = msg.state.xp;
      }

      var found = false;
      for (var i = 0; i < onlinePlayers.length; i++) {
        if (onlinePlayers[i].id === msg.playerId) {
          onlinePlayers[i].xp   = incomingXP;
          onlinePlayers[i].name = msg.playerName || onlinePlayers[i].name;
          found = true;
          break;
        }
      }

      // Spieler noch nicht in der Liste → hinzufügen
      if (!found && msg.playerId) {
        onlinePlayers.push({
          id:   msg.playerId,
          name: msg.playerName || 'Anonym',
          xp:   incomingXP
        });
      }

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
      if (msg.message) {
        showNotif(msg.message);
        addChatMessage('System', msg.message, true);
      }
      renderSidebarOrders();
      break;

    case 'chat':
      addChatMessage(msg.playerName, msg.text, false);
      if (state.activeTab !== 'chat')
        showNotif('💬 ' + msg.playerName + ': ' + msg.text.slice(0, 30));
      break;

    case 'error':
      alert('Server-Fehler: ' + msg.message);
      break;

    case 'pong':
      break;
  }
}

// ============================================================
// NACHRICHTEN AN SERVER SENDEN
// ============================================================
function wsSend(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function sendStateUpdate() {
  wsSend({
    type:    'state_update',
    state:   { playerName: state.playerName, xp: state.xp },
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

function getStateSummary() {
  return {
    playerName:    state.playerName,
    xp:            state.xp,
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
  el.textContent = status === 'connected'    ? '🟢 Online'      :
                   status === 'connecting'   ? '🟡 Verbinde...' : '🔴 Offline';
}

// Ping alle 30s
setInterval(function() {
  if (ws && ws.readyState === WebSocket.OPEN) wsSend({ type: 'ping' });
}, 30000);

// ============================================================
// JOIN SCREEN
// ============================================================
function joinValley() {
  var nameInput  = document.getElementById('player-name-input');
  var valleyInput = document.getElementById('valley-input');
  var errorEl    = document.getElementById('join-error');

  var playerName = nameInput.value.trim();
  var valleyId   = valleyInput.value.trim().toLowerCase().replace(/\s+/g, '-') || 'default';

  if (!playerName) {
    errorEl.textContent = 'Bitte gib deinen Namen ein!'; return;
  }
  if (playerName.length < 2) {
    errorEl.textContent = 'Name muss mindestens 2 Zeichen haben'; return;
  }

  state.playerName = playerName;
  myValleyId       = valleyId;

  loadGame(playerName);

  // Join-Screen ausblenden
  document.getElementById('join-screen').style.display        = 'none';
  document.getElementById('game-container').style.display     = 'flex';
  document.getElementById('game-container').style.flexDirection = 'column';

  // Canvas JETZT neu berechnen – container ist ab hier sichtbar
  // (vorher war clientWidth/Height = 0 wegen display:none)
  setTimeout(function() { resizeCanvas(); }, 50);

  connectToServer(playerName, valleyId);

  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, '', '?valley=' + valleyId);
  }
}

// Valley-Name aus URL vorausfüllen
(function() {
  var params = new URLSearchParams(window.location.search);
  var valley = params.get('valley');
  if (valley) {
    var el = document.getElementById('valley-input');
    if (el) el.value = valley;
  }
})();