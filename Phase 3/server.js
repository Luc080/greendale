// ============================================================
// GREENDALE SERVER
// Express (statische Dateien) + WebSockets (Multiplayer)
// ============================================================

const express = require('express');
const http    = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Statische Dateien aus /public ausliefern
app.use(express.static(path.join(__dirname, 'public')));

// Fallback: alle Routen -> index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// VALLEY-VERWALTUNG
// Ein Valley = ein Spielraum mit bis zu 9 Spielern
// ============================================================
const valleys = {}; // { valleyId: { players: {}, orders: [], day: 1 } }

function getOrCreateValley(valleyId) {
  if (!valleys[valleyId]) {
    valleys[valleyId] = {
      id: valleyId,
      players: {},
      orders: generateOrders(),
      day: 1,
      dayTick: 0
    };
    console.log(`Valley erstellt: ${valleyId}`);
  }
  return valleys[valleyId];
}

// Einfache Auftrags-Generierung (spiegelt data.js wider)
const ORDER_TEMPLATES = [
  { items: { wood: 5 },              xp: 10, label: '5x Holz'              },
  { items: { stone: 5 },             xp: 10, label: '5x Stein'             },
  { items: { wheat: 6 },             xp: 12, label: '6x Weizen'            },
  { items: { soup: 3 },              xp: 20, label: '3x Suppe'             },
  { items: { wood: 4, stone: 4 },    xp: 18, label: '4x Holz + 4x Stein'  },
  { items: { furniture: 2 },         xp: 30, label: '2x Moebel'            },
  { items: { brick: 3 },             xp: 28, label: '3x Ziegel'            },
  { items: { soup: 2, furniture: 1 },xp: 40, label: '2x Suppe + 1x Moebel'},
  { items: { wood: 8 },              xp: 22, label: '8x Holz'              },
  { items: { stone: 6, brick: 2 },   xp: 35, label: '6x Stein + 2x Ziegel'}
];

function generateOrders() {
  var orders = [];
  for (var i = 0; i < 4; i++) {
    var t = ORDER_TEMPLATES[Math.floor(Math.random() * ORDER_TEMPLATES.length)];
    orders.push({
      id: uuidv4(),
      items: JSON.parse(JSON.stringify(t.items)),
      xp: t.xp,
      label: t.label
    });
  }
  return orders;
}

// ============================================================
// BROADCAST HILFSFUNKTION
// Sendet eine Nachricht an alle Spieler in einem Valley
// ============================================================
function broadcastToValley(valleyId, message, excludeId) {
  const valley = valleys[valleyId];
  if (!valley) return;

  const msg = JSON.stringify(message);
  Object.values(valley.players).forEach(player => {
    if (player.id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(msg);
    }
  });
}

function sendToPlayer(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// ============================================================
// WEBSOCKET VERBINDUNGEN
// ============================================================
wss.on('connection', (ws) => {
  const playerId = uuidv4();
  let currentValleyId = null;

  console.log(`Spieler verbunden: ${playerId}`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); }
    catch (e) { return; }

    switch (msg.type) {

      // Spieler tritt einem Valley bei
      case 'join': {
        const valleyId = msg.valleyId || 'default';
        const playerName = msg.playerName || 'Anonym';
        currentValleyId = valleyId;

        const valley = getOrCreateValley(valleyId);

        // Prüfen ob Valley voll (max 9 Spieler)
        if (Object.keys(valley.players).length >= 9) {
          sendToPlayer(ws, { type: 'error', message: 'Valley ist voll! (Max. 9 Spieler)' });
          return;
        }

        // Spieler registrieren
        valley.players[playerId] = {
          id: playerId,
          name: playerName,
          ws: ws,
          state: msg.state || null,  // Spielzustand des Clients
          joinedAt: Date.now()
        };

        console.log(`${playerName} tritt Valley '${valleyId}' bei (${Object.keys(valley.players).length}/9)`);

        // Bestätigung + aktueller Valley-Zustand
        sendToPlayer(ws, {
          type: 'joined',
          playerId: playerId,
          valleyId: valleyId,
          valleyOrders: valley.orders,
          valleyDay: valley.day,
          players: getPlayerList(valley)
        });

        // Anderen Spielern mitteilen
        broadcastToValley(valleyId, {
          type: 'player_joined',
          playerId: playerId,
          playerName: playerName,
          players: getPlayerList(valley)
        }, playerId);

        break;
      }

      // Spieler sendet seinen aktuellen Zustand (Gebäude, Ressourcen etc.)
      case 'state_update': {
        if (!currentValleyId || !valleys[currentValleyId]) return;
        const valley = valleys[currentValleyId];
        if (valley.players[playerId]) {
          valley.players[playerId].state = msg.state;
          valley.players[playerId].name = msg.state?.playerName || valley.players[playerId].name;
        }

        // Anderen Spielern den neuen Zustand mitteilen (für Übersicht)
        broadcastToValley(currentValleyId, {
          type: 'player_state',
          playerId: playerId,
          playerName: valley.players[playerId]?.name,
          summary: msg.summary  // Kurzinfo (XP, Villagerzahl, etc.)
        }, playerId);
        break;
      }

      // Spieler erfüllt einen Valley-Auftrag
      case 'fulfill_order': {
        if (!currentValleyId || !valleys[currentValleyId]) return;
        const valley = valleys[currentValleyId];
        const orderIdx = valley.orders.findIndex(o => o.id === msg.orderId);
        if (orderIdx === -1) return;

        const order = valley.orders[orderIdx];
        valley.orders.splice(orderIdx, 1);

        // Neuen Auftrag hinzufügen
        const t = ORDER_TEMPLATES[Math.floor(Math.random() * ORDER_TEMPLATES.length)];
        valley.orders.push({
          id: uuidv4(),
          items: JSON.parse(JSON.stringify(t.items)),
          xp: t.xp,
          label: t.label
        });

        const playerName = valley.players[playerId]?.name || 'Jemand';
        console.log(`${playerName} erfüllt Auftrag: ${order.label}`);

        // Allen Spielern die neuen Aufträge mitteilen
        broadcastToValley(currentValleyId, {
          type: 'orders_updated',
          orders: valley.orders,
          message: `${playerName} hat geliefert: ${order.label} (+${order.xp} XP)`
        }, null);  // null = auch an Sender schicken
        // Auch an Sender
        sendToPlayer(ws, {
          type: 'orders_updated',
          orders: valley.orders,
          xpGained: order.xp,
          message: `Du hast geliefert: ${order.label} (+${order.xp} XP)`
        });
        break;
      }

      // Chat-Nachricht
      case 'chat': {
        if (!currentValleyId || !valleys[currentValleyId]) return;
        const valley = valleys[currentValleyId];
        const playerName = valley.players[playerId]?.name || 'Anonym';
        const chatMsg = String(msg.text || '').slice(0, 200);
        if (!chatMsg.trim()) return;

        broadcastToValley(currentValleyId, {
          type: 'chat',
          playerId: playerId,
          playerName: playerName,
          text: chatMsg,
          timestamp: Date.now()
        }, null);
        break;
      }

      // Ping (Verbindung prüfen)
      case 'ping': {
        sendToPlayer(ws, { type: 'pong' });
        break;
      }
    }
  });

  // Spieler trennt Verbindung
  ws.on('close', () => {
    if (!currentValleyId || !valleys[currentValleyId]) return;
    const valley = valleys[currentValleyId];
    const playerName = valley.players[playerId]?.name || 'Unbekannt';

    delete valley.players[playerId];
    console.log(`${playerName} hat das Spiel verlassen (Valley: ${currentValleyId})`);

    broadcastToValley(currentValleyId, {
      type: 'player_left',
      playerId: playerId,
      playerName: playerName,
      players: getPlayerList(valley)
    }, null);

    // Valley aufräumen wenn leer
    if (Object.keys(valley.players).length === 0) {
      setTimeout(() => {
        if (valleys[currentValleyId] && Object.keys(valleys[currentValleyId].players).length === 0) {
          delete valleys[currentValleyId];
          console.log(`Valley '${currentValleyId}' wurde aufgeräumt (leer)`);
        }
      }, 60000); // 1 Minute warten bevor löschen
    }
  });

  ws.on('error', (err) => {
    console.error(`WebSocket Fehler (${playerId}):`, err.message);
  });
});

// Hilfsfunktion: Spieler-Liste ohne ws-Objekt
function getPlayerList(valley) {
  return Object.values(valley.players).map(p => ({
    id: p.id,
    name: p.name,
    joinedAt: p.joinedAt,
    xp: p.state?.xp || 0
  }));
}

// ============================================================
// SERVER STARTEN
// ============================================================
server.listen(PORT, () => {
  console.log(`\n🌿 Greendale Server läuft!`);
  console.log(`   Lokal:   http://localhost:${PORT}`);
  console.log(`   Valley:  http://localhost:${PORT}?valley=meintal\n`);
});
