// ============================================================
// GREENDALE SERVER – Phase 5
// Express + WebSockets + optionale Supabase-Persistenz
// ============================================================

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path      = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const PORT   = process.env.PORT || 3000;

// Unterstützt sowohl /public als auch Root-Verzeichnis
const fs = require('fs');
const publicDir = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : __dirname;
app.use(express.static(publicDir));
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// ============================================================
// SUPABASE (optional – nur wenn Env-Variablen gesetzt)
// ============================================================
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('✅ Supabase verbunden');
  } catch(e) {
    console.warn('⚠️  Supabase nicht verfügbar:', e.message);
  }
}

// ============================================================
// AUFTRAGS-TEMPLATES
// ============================================================
const ORDER_TEMPLATES = [
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
  { items: { water: 6, soup: 2 },     xp: 38,  coins: 19, label: '6x Wasser + 2x Suppe'},
  { items: { tool: 2 },               xp: 50,  coins: 25, label: '2x Werkzeug'          },
  { items: { furniture: 3, brick: 2 },xp: 58,  coins: 29, label: '3x Möbel + 2x Ziegel'},
];

// ============================================================
// VALLEY-EVENT-TEMPLATES
// ============================================================
const EVENT_TEMPLATES = [
  { id: 'harvest', title: '🌾 Ernte-Festival', desc: 'Liefert gemeinsam 20x Weizen in 10 Minuten!', goal: { wheat: 20 }, duration: 600, reward: { xp: 100, coins: 50 } },
  { id: 'build',   title: '🔨 Bau-Wettbewerb', desc: 'Liefert gemeinsam 15x Holz + 10x Stein!',   goal: { wood: 15, stone: 10 }, duration: 480, reward: { xp: 80, coins: 40 } },
  { id: 'feast',   title: '🍲 Dorffest',        desc: 'Liefert gemeinsam 10x Suppe + 5x Brot!',    goal: { soup: 10, bread: 5 },  duration: 720, reward: { xp: 120, coins: 60 } },
];

function generateOrders(count = 4, activeEvent = null) {
  const orders = [];
  for (let i = 0; i < count; i++) {
    let pool = ORDER_TEMPLATES;
    // Während Event: 60% Chance auf Event-relevante Aufträge
    if (activeEvent && Math.random() < 0.6) {
      const eventRes = Object.keys(activeEvent.goal);
      const relevant = ORDER_TEMPLATES.filter(t =>
        eventRes.some(r => t.items[r])
      );
      if (relevant.length > 0) pool = relevant;
    }
    const t = pool[Math.floor(Math.random() * pool.length)];
    orders.push({ id: uuidv4(), items: { ...t.items }, xp: t.xp, coins: t.coins || 5, label: t.label });
  }
  return orders;
}

function startRandomEvent(valley) {
  if (valley.activeEvent) return;
  const t = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const progress = {};
  for (const k in t.goal) progress[k] = 0;
  valley.activeEvent = {
    ...t, progress,
    startedAt: Date.now(),
    endsAt: Date.now() + t.duration * 1000,
    completed: false
  };
  broadcastToValley(valley.id, { type: 'event_started', event: getEventSummary(valley.activeEvent) }, null);
  setTimeout(() => {
    if (valley.activeEvent && !valley.activeEvent.completed) {
      valley.activeEvent = null;
      broadcastToValley(valley.id, { type: 'event_ended', reason: 'timeout', message: '⏰ Event abgelaufen!' }, null);
    }
  }, t.duration * 1000);
}

function getEventSummary(ev) {
  if (!ev) return null;
  return { id: ev.id, title: ev.title, desc: ev.desc, goal: ev.goal, progress: ev.progress, endsAt: ev.endsAt, completed: ev.completed, reward: ev.reward };
}

// ============================================================
// VALLEY-VERWALTUNG
// ============================================================
const valleys = {};

function getOrCreateValley(valleyId) {
  if (!valleys[valleyId]) {
    valleys[valleyId] = { id: valleyId, players: {}, orders: generateOrders(), day: 1, dayTick: 0, activeEvent: null };
    setTimeout(() => {
      if (valleys[valleyId] && Object.keys(valleys[valleyId].players).length > 0)
        startRandomEvent(valleys[valleyId]);
    }, 5 * 60 * 1000);
    console.log(`Valley erstellt: ${valleyId}`);
  }
  return valleys[valleyId];
}

function broadcastToValley(valleyId, message, excludeId) {
  const valley = valleys[valleyId];
  if (!valley) return;
  const msg = JSON.stringify(message);
  Object.values(valley.players).forEach(p => {
    if (p.id !== excludeId && p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  });
}
function sendToPlayer(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

// ============================================================
// SUPABASE HILFSFUNKTIONEN
// ============================================================
async function dbLoadPlayer(playerName) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('name', playerName)
      .single();
    if (error && error.code !== 'PGRST116') console.warn('DB load error:', error.message);
    return data || null;
  } catch(e) { return null; }
}

async function dbSavePlayer(playerName, stateData) {
  if (!supabase) return;
  console.log('💾 Speichere:', playerName);
  try {
    const { error } = await supabase.from('players').upsert(
      { name: playerName, state: stateData, updated_at: new Date().toISOString() },
      { onConflict: 'name' }
    );
    if (error) console.error('❌ DB Fehler:', JSON.stringify(error));
    else console.log('✅ DB gespeichert:', playerName);
  } catch(e) {
    console.warn('DB save error:', e.message);
  }
}

// ============================================================
// WEBSOCKET
// ============================================================
wss.on('connection', (ws) => {
  const playerId = uuidv4();
  let currentValleyId = null;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'join': {
        const valleyId   = msg.valleyId || 'default';
        const playerName = msg.playerName || 'Anonym';
        currentValleyId  = valleyId;
        const valley     = getOrCreateValley(valleyId);

        if (Object.keys(valley.players).length >= 9) {
          sendToPlayer(ws, { type: 'error', message: 'Valley ist voll! (Max. 9 Spieler)' });
          return;
        }

        valley.players[playerId] = { id: playerId, name: playerName, ws, state: msg.state || null, joinedAt: Date.now() };

        let dbState = null;
        if (supabase) dbState = await dbLoadPlayer(playerName);

        sendToPlayer(ws, {
          type: 'joined', playerId, valleyId,
          valleyOrders: valley.orders,
          valleyDay: valley.day,
          players: getPlayerList(valley),
          dbState: dbState ? dbState.state : null,
          activeEvent: getEventSummary(valley.activeEvent)
        });

        broadcastToValley(valleyId, { type: 'player_joined', playerId, playerName, players: getPlayerList(valley) }, playerId);
        console.log(`${playerName} → Valley '${valleyId}' (${Object.keys(valley.players).length}/9)`);
        break;
      }

      case 'state_update': {
        if (!currentValleyId || !valleys[currentValleyId]) return;
        const valley = valleys[currentValleyId];
        if (valley.players[playerId]) {
          valley.players[playerId].state = msg.state;
          valley.players[playerId].name  = msg.state?.playerName || valley.players[playerId].name;
        }
        if (msg.persist && supabase) {
          dbSavePlayer(msg.state.playerName, msg.state);
        }
        broadcastToValley(currentValleyId, {
          type: 'player_state', playerId,
          playerName: valley.players[playerId]?.name,
          summary: msg.summary
        }, playerId);
        break;
      }

      case 'fulfill_order': {
        if (!currentValleyId || !valleys[currentValleyId]) return;
        const valley   = valleys[currentValleyId];
        const orderIdx = valley.orders.findIndex(o => o.id === msg.orderId);
        if (orderIdx === -1) return;
        const order = valley.orders[orderIdx];
        valley.orders.splice(orderIdx, 1);
        // Neuer Auftrag – bei aktivem Event bevorzugt passende Ressourcen
        const newOrders = generateOrders(1, valley.activeEvent);
        valley.orders.push(newOrders[0]);

        const playerName  = valley.players[playerId]?.name || 'Jemand';
        const coinsEarned = order.coins || 5;

        if (valley.activeEvent && !valley.activeEvent.completed) {
          const ev = valley.activeEvent;
          for (const res in ev.goal) {
            if (order.items[res]) {
              ev.progress[res] = Math.min(ev.goal[res], (ev.progress[res] || 0) + order.items[res]);
            }
          }
          const done = Object.keys(ev.goal).every(k => (ev.progress[k] || 0) >= ev.goal[k]);
          if (done) {
            ev.completed = true;
            broadcastToValley(currentValleyId, { type: 'event_completed', reward: ev.reward, message: `🎉 ${ev.title} abgeschlossen! +${ev.reward.xp} XP +${ev.reward.coins} Coins!` }, null);
            valley.activeEvent = null;
            setTimeout(() => { if (valleys[currentValleyId]) startRandomEvent(valleys[currentValleyId]); }, 10 * 60 * 1000);
          } else {
            broadcastToValley(currentValleyId, { type: 'event_progress', event: getEventSummary(ev) }, null);
          }
        }

        broadcastToValley(currentValleyId, { type: 'orders_updated', orders: valley.orders, message: `${playerName} hat geliefert: ${order.label} (+${order.xp} XP, +${coinsEarned} 🪙)` }, null);
        sendToPlayer(ws, { type: 'orders_updated', orders: valley.orders, xpGained: order.xp, coinsGained: coinsEarned, message: `Du hast geliefert: ${order.label} (+${order.xp} XP, +${coinsEarned} 🪙)` });
        break;
      }

      case 'trade_offer': {
        if (!currentValleyId || !valleys[currentValleyId]) return;
        const valley = valleys[currentValleyId];
        const target = Object.values(valley.players).find(p => p.name === msg.targetName);
        if (!target) { sendToPlayer(ws, { type: 'error', message: `Spieler "${msg.targetName}" nicht gefunden` }); return; }
        sendToPlayer(target.ws, { type: 'trade_incoming', fromId: playerId, fromName: valley.players[playerId]?.name, offer: msg.offer, request: msg.request });
        break;
      }

      case 'trade_accept': {
        if (!currentValleyId || !valleys[currentValleyId]) return;
        const valley  = valleys[currentValleyId];
        const partner = valley.players[msg.partnerId];
        if (!partner) return;
        sendToPlayer(ws,         { type: 'trade_completed', role: 'receiver', receive: msg.offer,   give: msg.request, partnerName: partner.name });
        sendToPlayer(partner.ws, { type: 'trade_completed', role: 'sender',   receive: msg.request, give: msg.offer,   partnerName: valley.players[playerId]?.name });
        break;
      }

      case 'chat': {
        if (!currentValleyId || !valleys[currentValleyId]) return;
        const valley     = valleys[currentValleyId];
        const playerName = valley.players[playerId]?.name || 'Anonym';
        const chatMsg    = String(msg.text || '').slice(0, 200);
        if (!chatMsg.trim()) return;
        broadcastToValley(currentValleyId, { type: 'chat', playerId, playerName, text: chatMsg, timestamp: Date.now() }, null);
        break;
      }

      case 'ping':
        sendToPlayer(ws, { type: 'pong' });
        break;
    }
  });

  ws.on('close', () => {
    if (!currentValleyId || !valleys[currentValleyId]) return;
    const valley     = valleys[currentValleyId];
    const playerName = valley.players[playerId]?.name || 'Unbekannt';
    delete valley.players[playerId];
    console.log(`${playerName} verlassen (Valley: ${currentValleyId})`);
    broadcastToValley(currentValleyId, { type: 'player_left', playerId, playerName, players: getPlayerList(valley) }, null);
    if (Object.keys(valley.players).length === 0) {
      setTimeout(() => {
        if (valleys[currentValleyId] && Object.keys(valleys[currentValleyId].players).length === 0) {
          delete valleys[currentValleyId];
          console.log(`Valley '${currentValleyId}' aufgeräumt`);
        }
      }, 60000);
    }
  });

  ws.on('error', err => console.error(`WS Fehler (${playerId}):`, err.message));
});

function getPlayerList(valley) {
  return Object.values(valley.players).map(p => ({ id: p.id, name: p.name, joinedAt: p.joinedAt, xp: p.state?.xp || 0 }));
}

server.listen(PORT, () => {
  console.log(`\n🌿 Greendale Server Phase 5 läuft!`);
  console.log(`   Lokal:   http://localhost:${PORT}`);
  console.log(`   DB:      ${supabase ? '✅ Supabase aktiv' : '⚠️  localStorage (kein Supabase)'}\n`);
});
