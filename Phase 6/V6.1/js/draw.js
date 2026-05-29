// ============================================================
// DRAW.JS – Phase 6.1
// NEU: 3D-Terrain mit Höhenkarte, Seitenflächen, verbesserter Kamera
// ============================================================

var canvas  = null;
var ctx     = null;
var oX = 0, oY = 0;
var camZoom = 1.0;
var CAM_ZOOM_MIN = 0.30;
var CAM_ZOOM_MAX = 2.5;
var waterAnim = 0;

// ── Kamera-Drag ──────────────────────────────────────────────
var camDrag   = false;
var camDragX  = 0, camDragY  = 0;
var camStartX = 0, camStartY = 0;

// ── Zoom-Interpolation (weich) ───────────────────────────────
var camZoomTarget  = 1.0;
var CAM_ZOOM_LERP  = 0.12;

// ── WASD-Kamera ─────────────────────────────────────────────
var CAM_KEYS = {};
var CAM_PAN_SPEED = 5;
window.addEventListener('keydown', function(e) {
  CAM_KEYS[e.key] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', function(e) { CAM_KEYS[e.key] = false; });

// ── Tages-/Nacht-Zyklus ──────────────────────────────────────
var dayNightTick   = 0;
var DAY_CYCLE_LENGTH = 3600;

function getDayNightFactor() {
  var phase = (dayNightTick % DAY_CYCLE_LENGTH) / DAY_CYCLE_LENGTH;
  return Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
}
function getSkyColors() {
  var f = getDayNightFactor();
  if (f > 0.85)       return ['#caeaf8','#8ecef0'];
  else if (f > 0.6)   { var b=(f-0.6)/0.25; return [lerpColor('#f4a460','#caeaf8',b),lerpColor('#e07030','#8ecef0',b)]; }
  else if (f > 0.35)  { var b2=(f-0.35)/0.25; return [lerpColor('#2a1040','#f4a460',b2),lerpColor('#0a0820','#e07030',b2)]; }
  else                 return ['#1a1030','#0a0820'];
}
function getNightOverlayAlpha() {
  var f = getDayNightFactor();
  if (f >= 0.65) return 0;
  if (f <= 0.15) return 0.65;
  return (0.65 - f) / 0.5 * 0.65;
}
function lerpColor(c1, c2, t) {
  var p1=parseInt(c1.replace('#',''),16), p2=parseInt(c2.replace('#',''),16);
  var r=Math.round(((p1>>16)&255)*(1-t)+((p2>>16)&255)*t);
  var g=Math.round(((p1>>8)&255)*(1-t)+((p2>>8)&255)*t);
  var b=Math.round((p1&255)*(1-t)+(p2&255)*t);
  return 'rgb('+r+','+g+','+b+')';
}

// ============================================================
// 3D-TERRAIN: Höhenkarte
// ============================================================
var TMAP   = [];   // Tile-Typ (0=Gras, 1=dunkles Gras, 2=Erde, 3=Wasser, 4=Pfad, 5=Sand)
var HMAP   = [];   // Höhenkarte: 0..3 (Stufen)
var TREES  = [], TREE_SET = {}, FLOWERS = [];

// Tile-Höhe in Pixeln pro Stufe
var TILE_STEP_H = 18;   // Wie hoch eine Höhenstufe in Pixeln ist

// Farbpaletten je Typ – Top / SideHell / SideDunkel
var TILE3D = {
  0: { top:'#5a9e50', sideL:'#3d7038', sideR:'#2a5226' },
  1: { top:'#4e8e46', sideL:'#375f31', sideR:'#274522' },
  2: { top:'#8b7040', sideL:'#6a5230', sideR:'#4a3820' },
  3: { top:'#4fc3f7', sideL:'#2899cc', sideR:'#1a6e99' },  // Wasser hat keine Seiten
  4: { top:'#c8b07a', sideL:'#a08850', sideR:'#806840' },
  5: { top:'#d4c48a', sideL:'#b0a060', sideR:'#8a7848' },
  6: { top:'#b8c8d8', sideL:'#8090a0', sideR:'#607080' },  // Stein/Fels
  7: { top:'#c8e8a0', sideL:'#90b860', sideR:'#688040' },  // Helles Gras (Hügel-Gipfel)
};

function getHeight(c, r) {
  if (!HMAP[r] || HMAP[r][c] === undefined) return 0;
  return HMAP[r][c];
}

function generateMap() {
  // ── Simplex-ähnliche Höhenkarte via geschichteten Sinuswellen ──
  var seed1 = Math.random() * 100, seed2 = Math.random() * 100;
  var seed3 = Math.random() * 100, seed4 = Math.random() * 100;

  for (var r = 0; r < ROWS; r++) {
    TMAP[r] = [];
    HMAP[r] = [];
    for (var c = 0; c < COLS; c++) {
      // Mehrere sin/cos-Wellen für organische Hügel
      var n =  Math.sin((c + seed1) * 0.45) * Math.cos((r + seed2) * 0.38)
             + Math.sin((c + seed3) * 0.22 + r * 0.18) * 0.6
             + Math.cos((r + seed4) * 0.50 + c * 0.12) * 0.4;
      n = (n + 2) / 4; // 0..1

      // Höhenstufe (0=flach, 1=kleiner Hügel, 2=Hügel, 3=Berg)
      var hgt = 0;
      if (n > 0.80) hgt = 3;
      else if (n > 0.65) hgt = 2;
      else if (n > 0.50) hgt = 1;

      HMAP[r][c] = hgt;

      // Tile-Typ aus Höhe + Zufalls-Variation
      var v = Math.random();
      if (hgt >= 3)      TMAP[r][c] = 7;    // Berggipfel: helles Gras / Fels
      else if (hgt >= 2) TMAP[r][c] = v > 0.4 ? 1 : 2;
      else if (hgt >= 1) TMAP[r][c] = v > 0.6 ? 0 : 1;
      else               TMAP[r][c] = v > 0.88 ? 1 : v > 0.78 ? 2 : 0;
    }
  }

  // ── Wassersee rechts unten (Flachland erzwingen) ──
  for (var r = ROWS-5; r < ROWS-1; r++)
    for (var c = COLS-6; c < COLS-1; c++) { TMAP[r][c] = 3; HMAP[r][c] = 0; }
  // Sandstrand um den See
  for (var r = ROWS-6; r < ROWS; r++)
    for (var c = COLS-7; c < COLS; c++)
      if (TMAP[r][c] !== 3) { TMAP[r][c] = 5; HMAP[r][c] = 0; }

  // ── Pfade (flach erzwingen) ──
  var PATH = [[5,5],[5,4],[5,3],[4,3],[3,3],[3,2],[6,5],[7,5],[7,6],[7,7],[6,6],[8,5],[9,5],[10,5],[10,6],[10,7]];
  for (var i = 0; i < PATH.length; i++) { TMAP[PATH[i][1]][PATH[i][0]] = 4; HMAP[PATH[i][1]][PATH[i][0]] = 0; }

  // ── Start-Area um Rathaus flach machen (col 5-12, row 3-10) ──
  for (var r = 3; r <= 10; r++)
    for (var c = 4; c <= 13; c++)
      if (TMAP[r][c] !== 3 && TMAP[r][c] !== 5) HMAP[r][c] = Math.min(HMAP[r][c], 1);

  // ── Bäume (nur auf Hügeln + Ebene, nicht auf Bergen/Wasser/Pfad) ──
  for (var r = 0; r < ROWS; r++)
    for (var c = 0; c < COLS; c++) {
      var tt = TMAP[r][c], hh = HMAP[r][c];
      if ((tt === 0 || tt === 1) && Math.random() < (hh >= 2 ? 0.12 : 0.06))
        { TREES.push({ col:c, row:r, h:24+Math.random()*18, type:Math.random()<.65?'pine':'round', hgt:hh }); TREE_SET[c+','+r] = true; }
    }

  // ── Blumen ──
  for (var r = 0; r < ROWS; r++)
    for (var c = 0; c < COLS; c++)
      if ((TMAP[r][c] === 0 || TMAP[r][c] === 7) && !TREE_SET[c+','+r] && Math.random() < .04)
        FLOWERS.push({ col:c, row:r, t:['🌸','🌼','🌺','🌻'][Math.floor(Math.random()*4)] });
}

// ============================================================
// ISO-KOORDINATEN (mit Höhe)
// ============================================================
function toIso(c, r, h) {
  h = h || 0;
  return {
    x: oX + (c - r) * (TW / 2) * camZoom,
    y: oY + (c + r) * (TH / 2) * camZoom - h * TILE_STEP_H * camZoom
  };
}
function fromIso(px, py) {
  var rx = (px - oX) / camZoom, ry = (py - oY) / camZoom;
  return { col: Math.round((rx/(TW/2) + ry/(TH/2))/2), row: Math.round((ry/(TH/2) - rx/(TW/2))/2) };
}
function shade(hex, p) {
  var n = parseInt(hex.replace('#',''), 16);
  return 'rgb('+Math.min(255,Math.max(0,(n>>16)+p))+','+Math.min(255,Math.max(0,((n>>8)&255)+p))+','+Math.min(255,Math.max(0,(n&255)+p))+')';
}

// ============================================================
// CANVAS INIT
// ============================================================
function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx    = canvas.getContext('2d');
  generateMap();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  initCameraDrag();
}

function resizeCanvas() {
  var wrap = document.getElementById('canvas-wrap');
  var w = wrap.clientWidth, h = wrap.clientHeight;
  if (w === 0 || h === 0) return;
  canvas.width  = w;
  canvas.height = h;
  // Kamera auf Kartenmitte setzen – leicht nach oben versetzt wegen Höhen
  var midC = COLS / 2, midR = ROWS / 2;
  oX = w / 2 - (midC - midR) * (TW / 2);
  oY = h / 2 - (midC + midR) * (TH / 2) + 40;
}

// ============================================================
// KAMERA-DRAG + ZOOM
// ============================================================
function initCameraDrag() {
  canvas.addEventListener('mousedown', function(e) {
    if (state.buildMode) return;
    camDrag = true; camDragX = e.clientX; camDragY = e.clientY;
    camStartX = oX; camStartY = oY;
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', function(e) {
    if (!camDrag) return;
    oX = camStartX + (e.clientX - camDragX);
    oY = camStartY + (e.clientY - camDragY);
  });
  window.addEventListener('mouseup', function() { camDrag = false; canvas.style.cursor = 'default'; });

  // Touch-Drag
  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1 || state.buildMode) return;
    camDrag = true; camDragX = e.touches[0].clientX; camDragY = e.touches[0].clientY;
    camStartX = oX; camStartY = oY;
  }, { passive: true });
  window.addEventListener('touchmove', function(e) {
    if (!camDrag || e.touches.length !== 1) return;
    oX = camStartX + (e.touches[0].clientX - camDragX);
    oY = camStartY + (e.touches[0].clientY - camDragY);
  }, { passive: true });
  window.addEventListener('touchend', function() { camDrag = false; });

  // Mausrad-Zoom (weich)
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    var rect   = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;
    var delta  = e.deltaY > 0 ? 0.88 : 1.13;
    var newZ   = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, camZoomTarget * delta));
    // Pivot um Mausposition
    oX = mouseX - (mouseX - oX) * (newZ / camZoomTarget);
    oY = mouseY - (mouseY - oY) * (newZ / camZoomTarget);
    camZoomTarget = newZ;
  }, { passive: false });

  // Pinch-Zoom
  var _pinchDist = 0;
  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      _pinchDist = Math.sqrt(dx*dx + dy*dy);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      var dist = Math.sqrt(dx*dx + dy*dy);
      if (_pinchDist > 0) {
        var nz = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, camZoomTarget * dist / _pinchDist));
        var cx = (e.touches[0].clientX + e.touches[1].clientX)/2 - canvas.getBoundingClientRect().left;
        var cy = (e.touches[0].clientY + e.touches[1].clientY)/2 - canvas.getBoundingClientRect().top;
        oX = cx - (cx - oX) * (nz / camZoomTarget);
        oY = cy - (cy - oY) * (nz / camZoomTarget);
        camZoomTarget = nz;
      }
      _pinchDist = dist;
    }
  }, { passive: true });
}

// ============================================================
// KAMERA-GRENZEN (damit man nicht ins Leere scrollt)
// ============================================================
function clampCamera() {
  if (!canvas) return;
  var margin = 80 * camZoom;
  // Linke obere Ecke der Karte
  var tl = toIso(0, 0, 0);
  // Rechte untere Ecke
  var br = toIso(COLS-1, ROWS-1, 0);
  var mapW = br.x - tl.x + TW * camZoom;
  var mapH = br.y - tl.y + TH * camZoom;

  // Minimale/maximale Kameraverschiebung
  var minX = canvas.width  - br.x - margin;
  var maxX = -tl.x + margin;
  var minY = canvas.height - br.y - margin;
  var maxY = -tl.y + margin + 80;

  if (maxX > minX) { oX = Math.max(minX, Math.min(maxX, oX)); }
  if (maxY > minY) { oY = Math.max(minY, Math.min(maxY, oY)); }
}

// ============================================================
// 3D-TILE ZEICHNEN (mit Seitenflächen)
// ============================================================
function draw3DTile(c, r) {
  var type = TMAP[r][c];
  var hgt  = getHeight(c, r);
  var col3 = TILE3D[type] || TILE3D[0];

  // Top-Fläche der Kachel auf der aktuellen Höhe
  var p = toIso(c, r, hgt);
  var tw2 = TW / 2 * camZoom;
  var th2 = TH / 2 * camZoom;

  // ── Wasseranimation ──
  var topFill = col3.top;
  if (type === 3) {
    var w = Math.sin(waterAnim + c * .6 + r * .4) * 6;
    topFill = 'hsl(' + (198 + w) + ',65%,58%)';
  }

  // ── Top-Fläche ──
  ctx.beginPath();
  ctx.moveTo(p.x,        p.y);
  ctx.lineTo(p.x + tw2,  p.y + th2);
  ctx.lineTo(p.x,        p.y + TH * camZoom);
  ctx.lineTo(p.x - tw2,  p.y + th2);
  ctx.closePath();
  ctx.fillStyle = topFill; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.7; ctx.stroke();

  // ── Seitenflächen nur wenn Höhe > 0 und Typ != Wasser ──
  if (hgt > 0 && type !== 3) {
    var stepPx = TILE_STEP_H * camZoom;
    var sideH  = hgt * stepPx;

    // Linke Seite (Süd-West)
    ctx.beginPath();
    ctx.moveTo(p.x - tw2, p.y + th2);
    ctx.lineTo(p.x,       p.y + TH * camZoom);
    ctx.lineTo(p.x,       p.y + TH * camZoom + sideH);
    ctx.lineTo(p.x - tw2, p.y + th2 + sideH);
    ctx.closePath();
    ctx.fillStyle = col3.sideL; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();

    // Rechte Seite (Süd-Ost)
    ctx.beginPath();
    ctx.moveTo(p.x,       p.y + TH * camZoom);
    ctx.lineTo(p.x + tw2, p.y + th2);
    ctx.lineTo(p.x + tw2, p.y + th2 + sideH);
    ctx.lineTo(p.x,       p.y + TH * camZoom + sideH);
    ctx.closePath();
    ctx.fillStyle = col3.sideR; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // ── Wasser: Lichtreflexe ──
  if (type === 3) {
    ctx.save(); ctx.globalAlpha = .22 + Math.sin(waterAnim + c + r) * .07;
    ctx.beginPath();
    ctx.moveTo(p.x - 8*camZoom, p.y + th2);
    ctx.lineTo(p.x + 8*camZoom, p.y + th2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 * camZoom; ctx.stroke();
    ctx.restore();
  }
}

// ── Hilfsfunktion: Zeichne-Tiefe einer Kachel ──
function tileDepth(c, r) {
  return c + r + getHeight(c, r) * 0.01; // Höhe leicht in Tiefe einrechnen
}

// ============================================================
// BAUM (an Terrain-Höhe angepasst)
// ============================================================
function drawTree(tree) {
  var hgt = getHeight(tree.col, tree.row);
  var p   = toIso(tree.col, tree.row, hgt);
  var x   = p.x, y = p.y + TH / 2 * camZoom;
  var h   = tree.h * camZoom;

  ctx.save(); ctx.globalAlpha = .13;
  ctx.beginPath(); ctx.ellipse(x, y + 2, 16 * camZoom, 5 * camZoom, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();

  if (tree.type === 'pine') {
    ctx.fillStyle = '#7a5c3a';
    ctx.beginPath(); ctx.roundRect(x - 3 * camZoom, y - h * .32, 6 * camZoom, h * .32, 2); ctx.fill();
    var layers = [{ w: 16, yo: 0 }, { w: 23, yo: h * .2 }, { w: 30, yo: h * .38 }];
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i], ty = y - h + l.yo;
      ctx.beginPath();
      ctx.moveTo(x, ty - 8 * camZoom);
      ctx.lineTo(x + l.w * camZoom, ty + l.w * camZoom * .5);
      ctx.lineTo(x - l.w * camZoom, ty + l.w * camZoom * .5);
      ctx.closePath();
      ctx.fillStyle = i === 0 ? '#2a6828' : i === 1 ? '#368a32' : '#42a83e';
      ctx.fill();
    }
    // Schnee auf Berggipfeln
    if (hgt >= 3) {
      ctx.save(); ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(x, y - h - 2 * camZoom);
      ctx.lineTo(x + 10 * camZoom, y - h + 12 * camZoom);
      ctx.lineTo(x - 10 * camZoom, y - h + 12 * camZoom);
      ctx.closePath();
      ctx.fillStyle = '#f0f4ff'; ctx.fill(); ctx.restore();
    }
  } else {
    ctx.fillStyle = '#7a5c3a';
    ctx.beginPath(); ctx.roundRect(x - 3 * camZoom, y - h * .38, 6 * camZoom, h * .38, 2); ctx.fill();
    var cr = h * .36, cy2 = y - h + cr;
    ctx.beginPath(); ctx.arc(x, cy2, cr, 0, Math.PI * 2); ctx.fillStyle = '#358a30'; ctx.fill();
    ctx.beginPath(); ctx.arc(x - cr * .28, cy2 - cr * .28, cr * .6, 0, Math.PI * 2); ctx.fillStyle = '#42a83e'; ctx.fill();
  }
}

// ============================================================
// GEBÄUDE (an Terrain-Höhe angepasst + 3D-Sockel)
// ============================================================
function drawBuilding(b) {
  var hgt = getHeight(b.col, b.row);
  var p   = toIso(b.col, b.row, hgt);
  var x   = p.x, y = p.y;
  var st  = BSTYLE[b.type] || { wall: '#d4c890', roof: '#8b6020', accent: '#f0e0a0' };
  var bt  = BUILDING_TYPES[b.type];
  var sel = (state.selectedBuilding === b.id);

  var sizes = {
    townhall:{W:66,H:54}, sawmill:{W:58,H:44}, quarry:{W:62,H:46}, farm:{W:70,H:42},
    kitchen:{W:56,H:48}, carpentry:{W:60,H:46}, brickyard:{W:60,H:46},
    bakery:{W:56,H:50}, well:{W:36,H:36}, warehouse:{W:68,H:50},
    smithy:{W:64,H:50}, casino:{W:74,H:60}
  };
  var sz = sizes[b.type] || { W: 58, H: 46 };
  var lvlScale = (b.level >= 2) ? 1.15 : 1.0;
  var W = Math.round(sz.W * lvlScale * camZoom);
  var H = Math.round(sz.H * lvlScale * camZoom);
  var bx = x - W / 2, by = y - H + TH / 2 * camZoom;

  // ── 3D-Sockel (Stein-Fundament sichtbar auf erhöhtem Terrain) ──
  if (hgt > 0) {
    var sockH = Math.round(hgt * TILE_STEP_H * 0.4 * camZoom);
    ctx.beginPath(); ctx.roundRect(bx + 3, by + H - sockH, W - 6, sockH, 3);
    ctx.fillStyle = shade(st.wall, -55); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Schatten-Ellipse
  ctx.save(); ctx.globalAlpha = .18;
  ctx.beginPath(); ctx.ellipse(x, y + TH / 2 * camZoom + 2, W * .52 * camZoom, 11 * camZoom, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();

  // Auswahlring
  if (sel) {
    ctx.beginPath(); ctx.ellipse(x, y + TH / 2 * camZoom + 2, W * .58 * camZoom, 13 * camZoom, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#f0a500'; ctx.lineWidth = 2.5; ctx.stroke();
  }

  if (b.type === 'well') {
    _drawWell(x, by, W, H, st, sel);
    _drawBuildingLabel(b, bt, x, by, H, W);
    _drawProgressBar(b, bx, by, W);
    return;
  }
  if (b.type === 'casino') {
    _drawCasino(x, bx, by, W, H, st, sel);
    _drawBuildingLabel(b, bt, x, by, H, W);
    return;
  }

  // ── Haupt-Körper ──
  var grad = ctx.createLinearGradient(bx, by, bx + W, by + H);
  grad.addColorStop(0, shade(st.wall, 22)); grad.addColorStop(1, shade(st.wall, -15));
  ctx.beginPath(); ctx.roundRect(bx, by, W, H, 10);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = sel ? '#f0a500' : 'rgba(0,0,0,0.2)';
  ctx.lineWidth = sel ? 2.5 : 1.5; ctx.stroke();

  // ── Dach ──
  var roofH = Math.round((b.type==='warehouse'?22:b.type==='townhall'?18:b.type==='smithy'?20:15) * camZoom);
  ctx.beginPath(); ctx.roundRect(bx - 2, by - roofH, W + 4, roofH + 4, 8);
  ctx.fillStyle = st.roof; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.2; ctx.stroke();
  // Dachschatten
  ctx.beginPath(); ctx.roundRect(x, by - roofH, W / 2 + 2, roofH + 4, { upperLeft: 0, upperRight: 8, lowerRight: 8, lowerLeft: 0 });
  ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fill();

  _drawWindows(b.type, bx, by, W, H, st);

  // Tür
  var doorW = Math.round((b.type === 'warehouse' ? 18 : 13) * camZoom);
  ctx.beginPath(); ctx.roundRect(x - doorW / 2, by + H - 20, doorW, 20, { upperLeft: doorW / 2, upperRight: doorW / 2, lowerLeft: 0, lowerRight: 0 });
  ctx.fillStyle = shade(st.wall, -40); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(x + doorW / 2 - 4, by + H - 10, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#f0c040'; ctx.fill();

  _drawBuildingExtras(b, x, bx, by, W, H, st);
  _drawBuildingLabel(b, bt, x, by, H, W);
  _drawProgressBar(b, bx, by, W);

  // Level-2 Goldrahmen
  if (b.level >= 2) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, W + 6, H + 6, 12);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
    ctx.stroke(); ctx.restore();
    // Badge
    ctx.save();
    ctx.beginPath(); ctx.arc(bx + W, by + 2, 10 * camZoom, 0, Math.PI * 2);
    var bg2 = ctx.createRadialGradient(bx+W, by+2, 2, bx+W, by+2, 10*camZoom);
    bg2.addColorStop(0, '#ffe066'); bg2.addColorStop(1, '#f0a500');
    ctx.fillStyle = bg2; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = 'bold ' + Math.round(8 * camZoom) + 'px Nunito,sans-serif';
    ctx.fillStyle = '#5a2a00'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('L2', bx + W, by + 2); ctx.restore();
  }
}

// ── Hilfsfunktionen Gebäude (unverändert, nur camZoom-aware) ──
function _drawCasino(x, bx, by, W, H, st, sel) {
  var grad = ctx.createLinearGradient(bx, by, bx+W, by+H);
  grad.addColorStop(0,'#2a1040'); grad.addColorStop(1,'#0a0018');
  ctx.beginPath(); ctx.roundRect(bx,by,W,H,12); ctx.fillStyle=grad; ctx.fill();
  ctx.strokeStyle=sel?'#f0a500':'#ffd700'; ctx.lineWidth=sel?3:2; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(bx-2,by-22*camZoom,W+4,24*camZoom,10);
  ctx.fillStyle='#8b0020'; ctx.fill(); ctx.strokeStyle='#ffd700'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.save(); ctx.shadowColor='#ff0080'; ctx.shadowBlur=8;
  ctx.font='bold '+Math.round(11*camZoom)+'px Nunito,sans-serif';
  ctx.fillStyle='#ff80ff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('CASINO',x,by+H/2-8); ctx.restore();
  var wc=['#ff0080','#ffff00','#00ffff','#ff8000'];
  for(var i=0;i<4;i++){
    ctx.save(); ctx.shadowColor=wc[i]; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.roundRect(bx+6+i*(W-12)/3.5,by+H-26,10,10,3);
    ctx.fillStyle=wc[i]; ctx.fill(); ctx.restore();
  }
  ctx.beginPath(); ctx.roundRect(x-9,by+H-20,18,20,{upperLeft:9,upperRight:9,lowerLeft:0,lowerRight:0});
  ctx.fillStyle='#3a0060'; ctx.fill(); ctx.strokeStyle='#ffd700'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.font='18px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🎰',x,by+12);
}
function _drawWindows(type,bx,by,W,H,st){
  var winY=by+H-26,winFill='rgba(255,252,180,0.88)';
  if(type==='warehouse'){
    for(var i=0;i<3;i++){var wx=bx+8+i*((W-16)/2.5); ctx.beginPath(); ctx.roundRect(wx,winY,14,10,3); ctx.fillStyle=winFill; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke();}
  }else if(type==='townhall'){
    var pos=[bx+10,bx+W-22];
    for(var i=0;i<pos.length;i++){ctx.beginPath(); ctx.arc(pos[i]+6,winY+2,6,Math.PI,0); ctx.lineTo(pos[i]+12,winY+12); ctx.lineTo(pos[i],winY+12); ctx.closePath(); ctx.fillStyle=winFill; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke();}
  }else if(type==='smithy'){
    var wp=[bx+8,bx+W-20];
    for(var i=0;i<wp.length;i++){ctx.beginPath(); ctx.roundRect(wp[i],winY,12,12,3); ctx.fillStyle='rgba(255,120,40,0.9)'; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke(); ctx.save(); ctx.shadowColor='#ff6020'; ctx.shadowBlur=6; ctx.beginPath(); ctx.roundRect(wp[i]+2,winY+2,8,8,2); ctx.fillStyle='rgba(255,180,50,0.8)'; ctx.fill(); ctx.restore();}
  }else{
    var wp2=[bx+8,bx+W-20];
    for(var i=0;i<wp2.length;i++){ctx.beginPath(); ctx.roundRect(wp2[i],winY,12,12,3); ctx.fillStyle=winFill; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke(); ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(wp2[i]+6,winY); ctx.lineTo(wp2[i]+6,winY+12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(wp2[i],winY+6); ctx.lineTo(wp2[i]+12,winY+6); ctx.stroke();}
  }
}
function _drawBuildingExtras(b,x,bx,by,W,H,st){
  if(b.type==='townhall'){
    ctx.beginPath(); ctx.roundRect(x-8,by-34,16,18,4); ctx.fillStyle=st.accent; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-10,by-34); ctx.lineTo(x,by-48); ctx.lineTo(x+10,by-34); ctx.closePath(); ctx.fillStyle=st.roof; ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#888'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x,by-48); ctx.lineTo(x,by-39); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,by-48); ctx.lineTo(x+10,by-44); ctx.lineTo(x,by-40); ctx.closePath(); ctx.fillStyle='#e05252'; ctx.fill();
    ctx.beginPath(); ctx.arc(x,by-24,5,0,Math.PI*2); ctx.fillStyle='#e8c040'; ctx.fill();
  }else if(b.type==='smithy'){
    ctx.beginPath(); ctx.roundRect(bx+10,by-28,14,22,3); ctx.fillStyle=shade(st.wall,-30); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1; ctx.stroke();
    ctx.save(); ctx.globalAlpha=.45;
    for(var i=0;i<4;i++){var r=5-i*.5; ctx.beginPath(); ctx.arc(bx+17,by-32-i*7,r,0,Math.PI*2); ctx.fillStyle=i<2?'#ff6020':'#aaa'; ctx.fill();}
    ctx.restore();
    ctx.font='16px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⚒️',bx+W-14,by+12);
    ctx.save(); ctx.shadowColor='#ff8000'; ctx.shadowBlur=8; ctx.font='10px serif'; ctx.fillText('✨',bx+W-8,by-5); ctx.restore();
    for(var i=0;i<3;i++){ctx.beginPath(); ctx.roundRect(bx+W+3,by+H-28+i*9,18,7,2); ctx.fillStyle=i%2===0?'#a0a0b0':'#c0c0d0'; ctx.fill(); ctx.strokeStyle='#808090'; ctx.lineWidth=0.7; ctx.stroke();}
  }else if(b.type==='sawmill'){
    for(var i=0;i<3;i++){ctx.beginPath(); ctx.ellipse(bx-4,by+H-10-i*9,10,5,0,0,Math.PI*2); ctx.fillStyle='#8b5c2a'; ctx.fill(); ctx.strokeStyle='#5a3010'; ctx.lineWidth=0.8; ctx.stroke();}
    ctx.save(); ctx.translate(bx+W-10,by+8); ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fillStyle='#d8d8d8'; ctx.fill(); ctx.strokeStyle='#999'; ctx.lineWidth=.8; ctx.stroke();
    for(var i=0;i<8;i++){ctx.save(); ctx.rotate(i*Math.PI/4); ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(10,2); ctx.lineTo(10,-2); ctx.closePath(); ctx.fillStyle='#bbb'; ctx.fill(); ctx.restore();}
    ctx.restore();
  }else if(b.type==='quarry'){
    var rocks=[{x:-18,y:8,r:8},{x:-10,y:14,r:6},{x:12,y:10,r:7},{x:20,y:6,r:5}];
    for(var i=0;i<rocks.length;i++){var rk=rocks[i]; ctx.beginPath(); ctx.ellipse(bx+W/2+rk.x,by+H+rk.y,rk.r,rk.r*.6,0,0,Math.PI*2); ctx.fillStyle='#a0a0b0'; ctx.fill(); ctx.strokeStyle='#707080'; ctx.lineWidth=0.8; ctx.stroke();}
    ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⛏',bx+W-12,by+10);
  }else if(b.type==='farm'){
    var fc=['#a8c860','#90b848','#b8d870'];
    for(var row=0;row<3;row++) for(var col=0;col<4;col++){ctx.beginPath(); ctx.roundRect(bx-4+col*6,by+H+2+row*5,5,4,1); ctx.fillStyle=fc[row%3]; ctx.fill();}
    ctx.font='13px serif'; ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText('🌾',bx+8,by+H+2); ctx.fillText('🌾',bx+W-8,by+H+2);
  }else if(b.type==='kitchen'){
    ctx.beginPath(); ctx.roundRect(bx+8,by-22,10,16,2); ctx.fillStyle=shade(BSTYLE.kitchen.wall,-25); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1; ctx.stroke();
    ctx.save(); ctx.globalAlpha=.3; for(var i=0;i<3;i++){ctx.beginPath(); ctx.arc(bx+13,by-26-i*7,4-i,0,Math.PI*2); ctx.fillStyle='#ccc'; ctx.fill();} ctx.restore();
    ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🍲',bx+W-12,by+12);
  }else if(b.type==='carpentry'){
    for(var i=0;i<3;i++){ctx.beginPath(); ctx.roundRect(bx+W+2,by+H-30+i*10,14,7,2); ctx.fillStyle='#c8a060'; ctx.fill(); ctx.strokeStyle='#8b6020'; ctx.lineWidth=0.7; ctx.stroke();}
    ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🪑',bx+14,by+12);
  }else if(b.type==='brickyard'){
    var bc=['#c85030','#d06040','#b84020'];
    for(var row=0;row<3;row++) for(var col=0;col<3;col++){var off=row%2===0?0:7; ctx.beginPath(); ctx.roundRect(bx+W+3+col*15+off,by+H-20+row*7,13,6,1); ctx.fillStyle=bc[col%3]; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.6; ctx.stroke();}
    ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🔥',bx+W-12,by+12);
  }else if(b.type==='bakery'){
    ctx.beginPath(); ctx.roundRect(bx+W-16,by-24,10,18,2); ctx.fillStyle=shade(BSTYLE.bakery.wall,-20); ctx.fill();
    ctx.save(); ctx.globalAlpha=.35; for(var i=0;i<4;i++){ctx.beginPath(); ctx.arc(bx+W-11,by-28-i*7,5-i*.5,0,Math.PI*2); ctx.fillStyle='#ddd'; ctx.fill();} ctx.restore();
    ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🥖',bx+14,by+12);
  }else if(b.type==='warehouse'){
    ctx.beginPath(); ctx.roundRect(x-14,by+H-24,28,24,3); ctx.fillStyle=shade(BSTYLE.warehouse.wall,-30); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1.2; ctx.stroke();
    ctx.strokeStyle='#888'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x-14,by+H-25); ctx.lineTo(x+14,by+H-25); ctx.stroke();
    ctx.font='16px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('📦',x,by+14);
  }
}
function _drawWell(x,by,W,H,st,sel){
  var cx=x,cy=by+H/2+5;
  ctx.beginPath(); ctx.ellipse(cx,cy+8,16,7,0,0,Math.PI*2); ctx.fillStyle=shade(st.wall,-10); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(cx-16,by+8,32,H-12,4);
  var wg=ctx.createLinearGradient(cx-16,0,cx+16,0); wg.addColorStop(0,shade(st.wall,15)); wg.addColorStop(1,shade(st.wall,-20));
  ctx.fillStyle=wg; ctx.fill(); ctx.strokeStyle=sel?'#f0a500':'rgba(0,0,0,0.2)'; ctx.lineWidth=sel?2:1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx,by+14,10,4,0,0,Math.PI*2); ctx.fillStyle='#4fc3f7'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,by+2,20,Math.PI,0); ctx.strokeStyle=shade(st.roof,-10); ctx.lineWidth=7; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,by+2,20,Math.PI,0); ctx.strokeStyle=st.roof; ctx.lineWidth=5; ctx.stroke();
  ctx.strokeStyle='#a08060'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(cx,by+2); ctx.lineTo(cx,by+12); ctx.stroke();
}
function _drawBuildingLabel(b,bt,x,by,H,W){
  var sz=Math.max(7,Math.round(10*camZoom));
  ctx.font='bold '+sz+'px Nunito,sans-serif'; ctx.fillStyle=b.type==='casino'?'#ffd700':'#3a2a1a';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(bt?bt.name:b.type,x,by+H+4);
}
function _drawProgressBar(b,bx,by,W){
  var workers=state.villagers.filter(function(v){return v.buildingId===b.id;});
  if(!workers.length) return;
  var avg=0; for(var i=0;i<workers.length;i++) avg+=workers[i].progress; avg/=workers.length;
  var bw=W-8,bxb=bx+4,byb=by-18;
  ctx.beginPath(); ctx.roundRect(bxb,byb,bw,5,2); ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(bxb,byb,bw*(avg/100),5,2); ctx.fillStyle='#4aaa42'; ctx.fill();
  ctx.font='13px serif'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText(workers.map(function(v){return v.emoji;}).join(''),bx+W/2,byb-2);
}

// ============================================================
// VILLAGER (an Terrain-Höhe angepasst)
// ============================================================
function drawVillager(v) {
  var hgt = getHeight(Math.round(v.x), Math.round(v.y));
  var p   = toIso(v.x, v.y, hgt);
  var px  = p.x, py = p.y + TH / 2 * camZoom - 4 * camZoom;
  var spd = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
  v.anim  = (v.anim || 0) + (spd > .005 ? .08 : .015);
  var bob      = spd > .005 ? Math.sin(v.anim * Math.PI * 2) * 2.5 : Math.sin(v.anim * .5) * .5;
  var legSwing = spd > .005 ? Math.sin(v.anim * Math.PI * 2) * 6 : 0;
  var armSwing = spd > .005 ? Math.sin(v.anim * Math.PI * 2) * 5 : Math.sin(v.anim * .3) * 1;
  var baseY = py + bob;
  var sk=v.skin||'#f4c490',hr=v.hair||'#5a3010',sh=v.shirt||'#4a8adf',pn=v.pants||'#3a4a60';

  ctx.save(); ctx.translate(px,py); ctx.scale(camZoom,camZoom); ctx.translate(-px,-py);
  ctx.globalAlpha=.15+spd*.05;
  ctx.beginPath(); ctx.ellipse(px,py+18,9+spd*2,4,0,0,Math.PI*2);
  ctx.fillStyle='#000'; ctx.fill(); ctx.restore();

  if(state.selectedVillager===v.id){ctx.beginPath(); ctx.ellipse(px,py+18,13,5,0,0,Math.PI*2); ctx.strokeStyle='#f0a500'; ctx.lineWidth=2; ctx.stroke();}
  ctx.lineCap='round';
  ctx.strokeStyle=pn; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(px-1,baseY+10); ctx.lineTo(px-4+legSwing,baseY+20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+1,baseY+10); ctx.lineTo(px+4-legSwing,baseY+20); ctx.stroke();
  ctx.fillStyle=shade(pn,-40);
  ctx.beginPath(); ctx.ellipse(px-4+legSwing,baseY+20,3.5,2,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px+4-legSwing,baseY+20,3.5,2,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(px-7,baseY-8,14,18,5);
  var bg=ctx.createLinearGradient(px-7,baseY-8,px+7,baseY+10); bg.addColorStop(0,shade(sh,18)); bg.addColorStop(1,shade(sh,-10));
  ctx.fillStyle=bg; ctx.fill(); ctx.strokeStyle=shade(sh,-25); ctx.lineWidth=.8; ctx.stroke();
  ctx.strokeStyle=sh; ctx.lineWidth=4.5;
  ctx.beginPath(); ctx.moveTo(px-7,baseY-3); ctx.lineTo(px-12,baseY-armSwing+5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+7,baseY-3); ctx.lineTo(px+12,baseY+armSwing+5); ctx.stroke();
  ctx.fillStyle=sk;
  ctx.beginPath(); ctx.arc(px-12,baseY-armSwing+5,2.8,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+12,baseY+armSwing+5,2.8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=sk;
  ctx.beginPath(); ctx.rect(px-2.5,baseY-13,5,5); ctx.fill();
  ctx.beginPath(); ctx.arc(px,baseY-18,8.5,0,Math.PI*2); ctx.fillStyle=sk; ctx.fill(); ctx.strokeStyle=shade(sk,-20); ctx.lineWidth=.8; ctx.stroke();
  ctx.beginPath(); ctx.arc(px,baseY-23,7,Math.PI,0,false); ctx.fillStyle=hr; ctx.fill();
  ctx.beginPath(); ctx.arc(px-7,baseY-18,3,Math.PI*1.2,Math.PI*1.8,false); ctx.fillStyle=hr; ctx.fill();
  ctx.beginPath(); ctx.arc(px+7,baseY-18,3,Math.PI*1.2,Math.PI*1.8,false); ctx.fillStyle=hr; ctx.fill();
  ctx.fillStyle='rgba(30,20,10,0.85)';
  ctx.beginPath(); ctx.ellipse(px-3,baseY-19,1.5,1.8,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px+3,baseY-19,1.5,1.8,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(px-2.3,baseY-19.8,.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+3.7,baseY-19.8,.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px,baseY-15.5,2.5,.1,Math.PI-.1); ctx.strokeStyle='rgba(160,70,70,0.8)'; ctx.lineWidth=1.2; ctx.stroke();
  if(v.hunger<=1){ctx.beginPath(); ctx.arc(px+10,baseY-26,5,0,Math.PI*2); ctx.fillStyle='#e05252'; ctx.fill(); ctx.font='bold 7px Nunito,sans-serif'; ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',px+10,baseY-26);}
  var nsz=Math.max(6,Math.round(8*camZoom));
  ctx.font='bold '+nsz+'px Nunito,sans-serif'; ctx.fillStyle='#2a1a0a'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(v.name,px,baseY-30);
}

// ── Wolken ──────────────────────────────────────────────────
function drawCloud(cx, cy, size, alpha) {
  ctx.save(); ctx.globalAlpha=(alpha!==undefined?alpha:.55); ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(cx,cy,size*.4,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+size*.35,cy+size*.08,size*.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx-size*.3,cy+size*.1,size*.28,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawStars() {
  var alpha=Math.max(0,getNightOverlayAlpha()*1.5);
  if(alpha<0.05) return;
  ctx.save(); ctx.globalAlpha=Math.min(1,alpha);
  var sp=[[.05,.02],[.12,.05],[.22,.01],[.31,.06],[.44,.02],[.58,.04],[.67,.01],[.75,.07],[.85,.03],[.92,.05],[.08,.09],[.18,.12],[.35,.08],[.5,.10],[.62,.12],[.78,.09],[.88,.11]];
  ctx.fillStyle='#fffde0';
  for(var i=0;i<sp.length;i++){ctx.beginPath(); ctx.arc(sp[i][0]*canvas.width,sp[i][1]*canvas.height*.4,.8+(i%3)*.4,0,Math.PI*2); ctx.fill();}
  ctx.restore();
}

// ============================================================
// MINIMAP
// ============================================================
function drawMinimap() {
  var mw = 100, mh = 62, mx = canvas.width - mw - 8, my = canvas.height - mh - 8;
  var tw = mw / COLS, th = mh / ROWS;

  // Hintergrund
  ctx.save();
  ctx.fillStyle = 'rgba(20,14,8,0.78)';
  ctx.beginPath(); ctx.roundRect(mx - 3, my - 3, mw + 6, mh + 6, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,100,0.3)'; ctx.lineWidth = 1; ctx.stroke();

  // Kacheln
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var tt = TMAP[r][c], hh = HMAP[r] ? HMAP[r][c] : 0;
      var col;
      if (tt === 3) col = '#4fc3f7';
      else if (tt === 5) col = '#d4c48a';
      else if (tt === 4) col = '#c8b07a';
      else if (hh >= 3) col = '#d0e8b0';
      else if (hh >= 2) col = '#7aaa60';
      else if (hh >= 1) col = '#5a9e50';
      else              col = '#4a8e42';
      ctx.fillStyle = col;
      ctx.fillRect(mx + c * tw, my + r * th, tw + 0.5, th + 0.5);
    }
  }
  // Gebäude auf Minimap
  for (var i = 0; i < state.buildings.length; i++) {
    var b = state.buildings[i];
    ctx.fillStyle = b.type === 'casino' ? '#ffd700' : '#e05252';
    ctx.fillRect(mx + b.col * tw - 1, my + b.row * th - 1, tw + 2, th + 2);
  }
  // Villager
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    ctx.beginPath(); ctx.arc(mx + v.x * tw, my + v.y * th, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
  }
  // Kamera-Viewport Rahmen
  var vpTL = fromIso(0, 0);
  var vpBR = fromIso(canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(
    mx + Math.max(0, vpTL.col) * tw,
    my + Math.max(0, vpTL.row) * th,
    Math.min(COLS, vpBR.col - vpTL.col) * tw,
    Math.min(ROWS, vpBR.row - vpTL.row) * th
  );
  ctx.stroke();
  ctx.restore();
}

// ============================================================
// HAUPTZEICHENFUNKTION
// ============================================================
function draw() {
  waterAnim  += .035;
  dayNightTick++;

  // Kamera-Zoom weich interpolieren
  if (Math.abs(camZoom - camZoomTarget) > 0.001) {
    camZoom += (camZoomTarget - camZoom) * CAM_ZOOM_LERP;
  } else {
    camZoom = camZoomTarget;
  }

  // WASD / Pfeiltasten Kamera-Schwenk
  var spd = CAM_PAN_SPEED;
  if (CAM_KEYS['w'] || CAM_KEYS['ArrowUp'])    oY += spd;
  if (CAM_KEYS['s'] || CAM_KEYS['ArrowDown'])  oY -= spd;
  if (CAM_KEYS['a'] || CAM_KEYS['ArrowLeft'])  oX += spd;
  if (CAM_KEYS['d'] || CAM_KEYS['ArrowRight']) oX -= spd;

  clampCamera();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Himmel ──
  var skyC = getSkyColors();
  var sky  = ctx.createLinearGradient(0, 0, 0, canvas.height * .45);
  sky.addColorStop(0, skyC[0]); sky.addColorStop(1, skyC[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height * .45);

  drawStars();

  // Sonne / Mond
  var f = getDayNightFactor();
  if (f > 0.4) {
    var sa = Math.min(1, (f - 0.4) / 0.3);
    ctx.save(); ctx.globalAlpha = sa * 0.9;
    ctx.beginPath(); ctx.arc(canvas.width * .82, canvas.height * .08, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066'; ctx.fill(); ctx.restore();
  } else {
    var ma = Math.min(1, (0.35 - f) / 0.2);
    if (ma > 0) {
      ctx.save(); ctx.globalAlpha = ma * 0.85;
      ctx.beginPath(); ctx.arc(canvas.width*.82, canvas.height*.08, 14, 0, Math.PI*2); ctx.fillStyle='#fffde0'; ctx.fill();
      ctx.beginPath(); ctx.arc(canvas.width*.82+6, canvas.height*.08-2, 11, 0, Math.PI*2); ctx.fillStyle=skyC[0]; ctx.fill();
      ctx.restore();
    }
  }

  // Wolken
  var ca = Math.max(.15, Math.min(.55, f * .6));
  drawCloud(canvas.width*.15, canvas.height*.07, 70, ca);
  drawCloud(canvas.width*.5,  canvas.height*.04, 90, ca);
  drawCloud(canvas.width*.82, canvas.height*.09, 60, ca);

  // Boden
  var grdBg = ctx.createLinearGradient(0, canvas.height*.4, 0, canvas.height);
  var gc = f > 0.7 ? ['#c0dca0','#5a9e50'] : f > 0.4 ? ['#8aaa70','#3a7030'] : ['#3a4830','#1a2818'];
  grdBg.addColorStop(0, gc[0]); grdBg.addColorStop(1, gc[1]);
  ctx.fillStyle = grdBg; ctx.fillRect(0, canvas.height*.4, canvas.width, canvas.height*.6);

  // ── 3D Kacheln (Sortierung nach Tiefe: c+r aufsteigend, niedrige Höhe zuerst) ──
  // Wichtig: Kacheln mit Höhen müssen in korrekter Reihenfolge gezeichnet werden
  // Wir zeichnen Zeile für Zeile von oben nach unten (isometrisch korrekt)
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      draw3DTile(c, r);
    }
  }

  // ── Blumen ──
  for (var i = 0; i < FLOWERS.length; i++) {
    var fl = FLOWERS[i], bl = false;
    for (var j = 0; j < state.buildings.length; j++)
      if (state.buildings[j].col === fl.col && state.buildings[j].row === fl.row) { bl = true; break; }
    if (!bl && !TREE_SET[fl.col+','+fl.row]) {
      var hgt = getHeight(fl.col, fl.row);
      var fp  = toIso(fl.col, fl.row, hgt);
      ctx.font = '10px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(fl.t, fp.x, fp.y + TH / 2 * camZoom);
    }
  }

  // ── Gebäude + Bäume tiefensortiert ──
  var items = [];
  for (var i = 0; i < state.buildings.length; i++) {
    var b = state.buildings[i];
    items.push({ d: b.col + b.row + getHeight(b.col, b.row) * 0.5, type: 'b', data: b });
  }
  for (var i = 0; i < TREES.length; i++) {
    var tr = TREES[i], bl = false;
    for (var j = 0; j < state.buildings.length; j++)
      if (state.buildings[j].col === tr.col && state.buildings[j].row === tr.row) { bl = true; break; }
    if (!bl) items.push({ d: tr.col + tr.row + getHeight(tr.col, tr.row) * 0.5 - .5, type: 't', data: tr });
  }
  items.sort(function(a, b) { return a.d - b.d; });
  for (var i = 0; i < items.length; i++) {
    if (items[i].type === 'b') drawBuilding(items[i].data);
    else drawTree(items[i].data);
  }

  // ── Villager ──
  for (var i = 0; i < state.villagers.length; i++) drawVillager(state.villagers[i]);

  // ── Build-Mode Vorschau ──
  if (state.buildMode && state.hoverTile && BUILDING_TYPES[state.buildMode]) {
    var hgt = getHeight(state.hoverTile.col, state.hoverTile.row);
    var pp  = toIso(state.hoverTile.col, state.hoverTile.row, hgt);
    ctx.save(); ctx.globalAlpha = .45;
    ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(BUILDING_TYPES[state.buildMode].emoji, pp.x, pp.y + TH / 2 * camZoom + 4);
    ctx.restore();
  }

  // ── Zoom-Anzeige ──
  if (Math.abs(camZoom - 1.0) > 0.08) {
    ctx.save(); ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(canvas.width - 80, 10, 70, 24, 8); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 12px Nunito,sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔍 ' + Math.round(camZoom * 100) + '%', canvas.width - 45, 22);
    ctx.restore();
  }

  // ── Höhen-Legende (eingeblendet wenn vorhanden) ──
  // (bewusst weggelassen um UI sauber zu halten)

  // ── Nacht-Overlay ──
  var na = getNightOverlayAlpha();
  if (na > 0.01) {
    ctx.save(); ctx.globalAlpha = na;
    ctx.fillStyle = '#0a082a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // ── Minimap ──
  drawMinimap();
}
