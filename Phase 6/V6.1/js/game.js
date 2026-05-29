// ============================================================
// GAME.JS – Phase 6.1
// Neu: 3D-Terrain bewusstes Klick-Picking (Höhen berücksichtigt)
// ============================================================

var DRAG_THRESHOLD = 6;
var _mouseDownX = 0, _mouseDownY = 0, _wasDrag = false;

// Findet das Gebäude das am nächsten zum Klick-Punkt liegt
// (wichtig bei 3D-Terrain: toIso(col, row, height) verschiebt Position)
function pickBuilding(px, py) {
  var best = null, bestDist = 30; // max 30px Trefferradius
  for (var i = 0; i < state.buildings.length; i++) {
    var b   = state.buildings[i];
    var hgt = (typeof HMAP !== 'undefined' && HMAP[b.row]) ? (HMAP[b.row][b.col] || 0) : 0;
    var bp  = toIso(b.col, b.row, hgt);
    // Gebäude-Mittelpunkt (leicht nach oben versetzt wegen Gebäude-Höhe)
    var bCx = bp.x;
    var bCy = bp.y + TH / 2 * camZoom - 20 * camZoom;
    var dx  = px - bCx, dy = py - bCy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) { bestDist = dist; best = b; }
  }
  return best;
}

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
    state.hoverTile = fromIso(e.clientX - rect.left, e.clientY - rect.top);
  });

  c.addEventListener('click', function(e) {
    if (_wasDrag) { _wasDrag = false; return; }
    var rect = c.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;

    if (state.buildMode) {
      var tile = fromIso(px, py);
      placeBuilding(tile.col, tile.row);
      return;
    }

    // Phase 6.1: 3D-Picking — Gebäude zuerst per Nähe prüfen
    var clicked = pickBuilding(px, py);

    // Fallback: exakter Tile-Treffer (flaches Terrain)
    if (!clicked) {
      var tile = fromIso(px, py);
      for (var i = 0; i < state.buildings.length; i++) {
        if (state.buildings[i].col === tile.col && state.buildings[i].row === tile.row) {
          clicked = state.buildings[i]; break;
        }
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
