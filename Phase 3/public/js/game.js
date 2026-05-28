// ============================================================
// GAME.JS – Hauptschleife und Input
// Abhängig von: data.js, state.js, draw.js, ui.js, network.js
// ============================================================

// Schwellwert: ab wie vielen Pixeln gilt es als Drag (kein Klick)
var DRAG_THRESHOLD = 6;
var _mouseDownX = 0, _mouseDownY = 0, _wasDrag = false;

// ============================================================
// CANVAS INPUT
// ============================================================
function initInput() {
  var c = document.getElementById('gameCanvas');

  // Maus-Down: Startposition merken
  c.addEventListener('mousedown', function(e) {
    _mouseDownX = e.clientX;
    _mouseDownY = e.clientY;
    _wasDrag    = false;
  });

  // Maus-Move: prüfen ob Drag
  c.addEventListener('mousemove', function(e) {
    var dx = e.clientX - _mouseDownX;
    var dy = e.clientY - _mouseDownY;
    if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) _wasDrag = true;

    if (!state.buildMode) return;
    var rect = c.getBoundingClientRect();
    state.hoverTile = fromIso(e.clientX - rect.left, e.clientY - rect.top);
  });

  // Klick: nur auslösen wenn kein Drag war
  c.addEventListener('click', function(e) {
    if (_wasDrag) { _wasDrag = false; return; }

    var rect = c.getBoundingClientRect();
    var px   = e.clientX - rect.left;
    var py   = e.clientY - rect.top;
    var tile = fromIso(px, py);

    // Baumodus
    if (state.buildMode) {
      placeBuilding(tile.col, tile.row);
      return;
    }

    // Gebäude angeklickt?
    var clicked = null;
    for (var i = 0; i < state.buildings.length; i++) {
      if (state.buildings[i].col === tile.col && state.buildings[i].row === tile.row) {
        clicked = state.buildings[i]; break;
      }
    }
    if (clicked) {
      state.selectedBuilding = clicked.id;
      state.selectedVillager = null;
      showBuildingPopup(clicked, px, py);
      renderVillagerTab();
      return;
    }

    // Leere Karte geklickt
    state.selectedBuilding = null;
    hidePopup();
    renderActiveTab();
  });

  // ESC bricht Baumodus ab
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      cancelBuild();
      hidePopup();
    }
  });
}

// ============================================================
// HAUPTSCHLEIFE
// ============================================================
function gameLoop() {
  moveVillagers();
  tickProduction();
  draw();
  requestAnimationFrame(gameLoop);
}

// ============================================================
// SPIEL STARTEN
// ============================================================
function startGame() {
  initCanvas();
  initInput();
  renderSidebar();
  renderVillagerTab();
  startAutoSave(); // Autosave aus state.js aktivieren
  gameLoop();
}

// Wenn DOM fertig ist, starten
document.addEventListener('DOMContentLoaded', function() {
  startGame();
});