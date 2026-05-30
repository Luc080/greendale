// ============================================================
// GAME.JS – v6.5
// Klick-Handling via Three.js Raycaster (getClickedBuilding)
// ============================================================

var DRAG_THRESHOLD = 6;
var _mouseDownX = 0, _mouseDownY = 0, _wasDrag = false;
var _sidebarRefreshTimer = 0;

function initInput() {
  var wrap = document.getElementById('canvas-wrap');

  wrap.addEventListener('mousedown', function(e) {
    _mouseDownX = e.clientX; _mouseDownY = e.clientY; _wasDrag = false;
  });

  window.addEventListener('mousemove', function(e) {
    var dx = e.clientX - _mouseDownX, dy = e.clientY - _mouseDownY;
    if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) _wasDrag = true;
    if (!state.buildMode) return;
    var rect = wrap.getBoundingClientRect();
    state.hoverTile = fromIso(e.clientX - rect.left, e.clientY - rect.top);
  });

  wrap.addEventListener('click', function(e) {
    if (_wasDrag) { _wasDrag = false; return; }
    var rect = wrap.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;

    if (state.buildMode) {
      var tile = fromIso(px, py);
      placeBuilding(tile.col, tile.row);
      return;
    }

    // Three.js Raycaster für Gebäude
    var clicked = getClickedBuilding(e.clientX, e.clientY);
    if (clicked) {
      state.selectedBuilding = clicked.id;
      state.selectedVillager = null;
      updateSelectionRing();
      showBuildingPopup(clicked, px, py);
      renderVillagerTab();
      return;
    }
    state.selectedBuilding = null;
    updateSelectionRing();
    hidePopup();
    renderActiveTab();
  });

  // Touch-Tap
  var _touchStartX = 0, _touchStartY = 0;
  wrap.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
      _touchStartX = e.touches[0].clientX;
      _touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  wrap.addEventListener('touchend', function(e) {
    if (e.changedTouches.length !== 1) return;
    var tx = e.changedTouches[0].clientX, ty = e.changedTouches[0].clientY;
    var dx = tx - _touchStartX, dy2 = ty - _touchStartY;
    if (Math.sqrt(dx*dx+dy2*dy2) > DRAG_THRESHOLD) return;
    var rect = wrap.getBoundingClientRect();
    var px = tx - rect.left, py = ty - rect.top;

    if (state.buildMode) {
      var tile = fromIso(px, py);
      placeBuilding(tile.col, tile.row);
      return;
    }
    var clicked = getClickedBuilding(tx, ty);
    if (clicked) {
      state.selectedBuilding = clicked.id;
      state.selectedVillager = null;
      updateSelectionRing();
      showBuildingPopup(clicked, px, py);
      renderVillagerTab();
    } else {
      state.selectedBuilding = null;
      updateSelectionRing();
      hidePopup();
      renderActiveTab();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { cancelBuild(); hidePopup(); }
  });
}

function gameLoop() {
  moveVillagers();
  tickProduction();
  draw();

  _sidebarRefreshTimer++;
  if (_sidebarRefreshTimer >= 120) {
    _sidebarRefreshTimer = 0;
    renderSidebarVillagers();
  }

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
