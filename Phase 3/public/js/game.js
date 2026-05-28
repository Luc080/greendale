// ============================================================
// GAME.JS – Hauptschleife und Input
// Abhängig von: data.js, state.js, draw.js, ui.js, network.js
// ============================================================

// ============================================================
// CANVAS INPUT
// ============================================================
function initInput() {
  var c = document.getElementById('gameCanvas');

  c.addEventListener('click', function(e) {
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

  c.addEventListener('mousemove', function(e) {
    if (!state.buildMode) return;
    var rect = c.getBoundingClientRect();
    state.hoverTile = fromIso(e.clientX - rect.left, e.clientY - rect.top);
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
  gameLoop();
}

// Wenn DOM fertig ist, starten
document.addEventListener('DOMContentLoaded', function() {
  startGame();
});
