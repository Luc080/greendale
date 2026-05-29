// ============================================================
// GAME.JS – Phase 4 (Hauptschleife + Input, unverändert)
// ============================================================

var DRAG_THRESHOLD = 6;
var _mouseDownX = 0, _mouseDownY = 0, _wasDrag = false;

function initInput() {
  var c = document.getElementById('gameCanvas');

  c.addEventListener('mousedown', function(e) {
    _mouseDownX = e.clientX; _mouseDownY = e.clientY; _wasDrag = false;
  });

  c.addEventListener('mousemove', function(e) {
    var dx = e.clientX - _mouseDownX, dy = e.clientY - _mouseDownY;
    if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) _wasDrag = true;
    if (!state.buildMode) return;
    var rect = c.getBoundingClientRect();
    state.hoverTile = fromIso(e.clientX-rect.left, e.clientY-rect.top);
  });

  c.addEventListener('click', function(e) {
    if (_wasDrag) { _wasDrag = false; return; }
    var rect = c.getBoundingClientRect();
    var px = e.clientX-rect.left, py = e.clientY-rect.top;
    var tile = fromIso(px, py);

    if (state.buildMode) { placeBuilding(tile.col, tile.row); return; }

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
    state.selectedBuilding = null;
    hidePopup();
    renderActiveTab();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { cancelBuild(); hidePopup(); }
  });
}

function gameLoop() {
  moveVillagers();
  tickProduction();
  draw();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  initCanvas();
  initInput();
  renderSidebar();
  renderVillagerTab();
  startAutoSave();
  gameLoop();
}

document.addEventListener('DOMContentLoaded', function() {
  startGame();
});
