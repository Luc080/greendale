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
      if (hgt >= 3)      TMAP[r][c] = v > 0.5 ? 7 : 6;   // Berggipfel: Fels (6) oder helles Gras/Schnee (7)
      else if (hgt >= 2) TMAP[r][c] = v > 0.35 ? 1 : v > 0.15 ? 2 : 6;
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
  initWeather();
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
  // Phase 9: Schnee überlagert Gras-Tiles
  if (typeof WEATHER_STATE !== 'undefined' && WEATHER_STATE === 'snow' && type !== 3 && type !== 4) {
    var snowBlend = (hgt >= 2) ? 0.75 : (hgt >= 1) ? 0.55 : 0.38;
    topFill = lerpColor(topFill, '#dce8f4', snowBlend);
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
// GEBÄUDE – Phase 7: Echte isometrische 3D-Boxen
// Jedes Gebäude hat: Dachfläche (Top), Front (Süd), Seite (Ost)
// Level 2: zweites Stockwerk sichtbar, anderes Dach
// ============================================================

// ISO-Box-Koordinaten für ein Gebäude auf Kachel (col, row, terrainhgt)
// bW = halbe Breite in Tiles, bD = halbe Tiefe in Tiles, bH = Höhe in px
function isoBox(col, row, terrH, bW, bD, bH) {
  // Vier Ecken der Grundfläche in Tile-Koordinaten
  var cz = camZoom;
  var tw2 = TW / 2 * cz, th2 = TH / 2 * cz;

  // Basis-Iso-Position (Kachelmitte)
  var base = toIso(col, row, terrH);
  var bx = base.x, by = base.y;

  // Die 8 Ecken der Box im 2D-Bildraum:
  //   Dach: top-left(tl), top-right(tr), bottom-right(br), bottom-left(bl)
  //   Boden: dieselben, aber +bH nach unten
  var halfW = bW * tw2;   // Halb-Breite in Bildpixeln
  var halfD = bD * th2;   // Halb-Tiefe

  // Dach-Eckpunkte (iso-diamond, oben)
  var rtop  = { x: bx,         y: by - bH };           // Norden (oben)
  var rright= { x: bx + halfW, y: by - bH + halfD };   // Osten
  var rbot  = { x: bx,         y: by - bH + halfW/2 + halfD }; // Süden (eigentlich: bx, by+TH/2-bH für 1-Tile)
  var rleft = { x: bx - halfW, y: by - bH + halfD };   // Westen

  // Vereinfacht: Nutze direkte Offset-Berechnung
  // Nord = toIso gibt uns Mitte-Nord der Tile; Box liegt zentriert drauf
  var N  = { x: bx,          y: by - bH };
  var E  = { x: bx + halfW,  y: by - bH + halfD };
  var S  = { x: bx,          y: by - bH + halfD * 2 };
  var W2 = { x: bx - halfW,  y: by - bH + halfD };

  // Gleiche Punkte auf Bodenhöhe (+bH)
  var Nb = { x: N.x,  y: N.y  + bH };
  var Eb = { x: E.x,  y: E.y  + bH };
  var Sb = { x: S.x,  y: S.y  + bH };
  var Wb = { x: W2.x, y: W2.y + bH };

  return { N:N, E:E, S:S, W:W2, Nb:Nb, Eb:Eb, Sb:Sb, Wb:Wb, cx:bx, cy:by, bH:bH };
}

function poly(pts, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill)  { ctx.fillStyle   = fill;  ctx.fill(); }
  if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}

// ── Haupt-Zeichenfunktion ──────────────────────────────────
function drawBuilding(b) {
  var terrH = getHeight(b.col, b.row);
  var st    = BSTYLE[b.type] || { wall: '#d4c890', roof: '#8b6020', accent: '#f0e0a0' };
  var bt    = BUILDING_TYPES[b.type];
  var sel   = (state.selectedBuilding === b.id);
  var lvl2  = (b.level >= 2);
  var cz    = camZoom;

  // Gebäude-Dimensionen in Tile-Einheiten und Pixel-Höhe
  var BDEFS = {
    townhall:  { w: 0.80, d: 0.80, h: 52, roofH: 22, floors: 2 },
    sawmill:   { w: 0.70, d: 0.65, h: 38, roofH: 14, floors: 1 },
    quarry:    { w: 0.75, d: 0.70, h: 36, roofH: 12, floors: 1 },
    farm:      { w: 0.85, d: 0.75, h: 30, roofH: 10, floors: 1 },
    kitchen:   { w: 0.68, d: 0.65, h: 40, roofH: 16, floors: 1 },
    carpentry: { w: 0.72, d: 0.68, h: 40, roofH: 14, floors: 1 },
    brickyard: { w: 0.72, d: 0.68, h: 38, roofH: 12, floors: 1 },
    bakery:    { w: 0.68, d: 0.65, h: 42, roofH: 16, floors: 1 },
    well:      { w: 0.38, d: 0.38, h: 28, roofH:  0, floors: 1 },
    warehouse: { w: 0.82, d: 0.78, h: 34, roofH: 10, floors: 1 },
    smithy:    { w: 0.75, d: 0.70, h: 44, roofH: 18, floors: 1 },
    casino:    { w: 0.88, d: 0.82, h: 58, roofH: 20, floors: 3 }
  };
  var def = BDEFS[b.type] || { w: 0.70, d: 0.65, h: 38, roofH: 14, floors: 1 };

  // Level 2: +30% Höhe, +10% Breite
  var lvlHScale = lvl2 ? 1.30 : 1.0;
  var lvlWScale = lvl2 ? 1.10 : 1.0;
  var bW  = def.w * lvlWScale;
  var bD  = def.d * lvlWScale;
  var bH  = Math.round(def.h * lvlHScale * cz);
  var rH  = Math.round(def.roofH * lvlHScale * cz);

  var box = isoBox(b.col, b.row, terrH, bW, bD, bH);
  var N=box.N, E=box.E, S=box.S, W2=box.W, Nb=box.Nb, Eb=box.Eb, Sb=box.Sb, Wb=box.Wb;
  var cx = box.cx, cy = box.cy;

  // ── Schatten ──
  ctx.save(); ctx.globalAlpha = 0.20;
  poly([Nb, Eb, Sb, Wb], 'rgba(0,0,0,0.8)');
  ctx.globalAlpha = 0.10;
  ctx.shadowColor = '#000'; ctx.shadowBlur = 8 * cz;
  poly([Nb, Eb, Sb, Wb], '#000');
  ctx.restore();

  // ── Auswahlring ──
  if (sel) {
    ctx.save(); ctx.strokeStyle = '#f0a500'; ctx.lineWidth = 2.5;
    ctx.shadowColor = '#f0a500'; ctx.shadowBlur = 10;
    poly([Nb, Eb, Sb, Wb], null, '#f0a500', 2.5);
    ctx.restore();
  }

  // Farben ableiten
  var wallTop   = shade(st.wall, 18);
  var wallFront = st.wall;
  var wallSide  = shade(st.wall, -25);
  var roofTop   = st.roof;
  var roofFront = shade(st.roof, -20);
  var roofSide  = shade(st.roof, -40);
  var edgeCol   = sel ? '#f0a500' : 'rgba(0,0,0,0.22)';

  if (lvl2) {
    // Level-2: wärmere, sattere Farben
    wallTop   = shade(st.accent, 10);
    wallFront = shade(st.wall, 8);
    wallSide  = shade(st.wall, -18);
  }

  // ── KASINO: Spezial ──
  if (b.type === 'casino') {
    _draw3DCasino(box, bW, bD, bH, rH, sel, lvl2, cz);
    _drawBuildingLabel(b, bt, cx, N.y, bH, bW * TW * cz);
    return;
  }

  // ── BRUNNEN: Spezial ──
  if (b.type === 'well') {
    _draw3DWell(box, bH, st, sel, cz);
    _drawBuildingLabel(b, bt, cx, N.y, bH, bW * TW * cz);
    _drawProgressBar(b, cx - bW * TW * cz / 2, N.y, bW * TW * cz);
    return;
  }

  // ── WEST-Seite (linke sichtbare Wand) ──
  poly([N, W2, Wb, Nb], wallSide, edgeCol, 0.8);

  // ── SÜDEN-Seite (rechte sichtbare Wand) ──
  poly([W2, S, Sb, Wb], wallFront, edgeCol, 0.8);

  // ── Level-2: Stockwerks-Linie ──
  if (lvl2) {
    var midH = bH * 0.50;
    // Horizontale Trennlinie (Erdgeschoss / Obergeschoss)
    var floor2_NW = { x: N.x - (N.x - W2.x) * 0.5,  y: N.y + midH - (N.y - W2.y) * 0.5 };
    // Vereinfacht: einfach Linie auf halber Höhe über Wände
    ctx.save();
    ctx.strokeStyle = shade(st.wall, -50); ctx.lineWidth = 1.5 * cz;
    ctx.setLineDash([4 * cz, 3 * cz]);
    // West-Wand Trennlinie
    ctx.beginPath();
    ctx.moveTo(N.x + (N.x - N.x), N.y + midH);
    ctx.lineTo(W2.x, W2.y + midH);
    ctx.lineTo(Wb.x, Wb.y + midH - bH + bH); // bleibt auf selber Höhe
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── DACH ──
  if (rH > 0) {
    // Giebel-Dach: Firstlinie in der Mitte
    var ridge = { x: cx, y: N.y - rH };  // Dachfirst

    // Dach West-Fläche
    poly([N, W2, { x: W2.x, y: W2.y - rH * 0.6 }, ridge], roofSide, edgeCol, 0.7);
    // Dach Süd-Fläche
    poly([W2, S, { x: S.x, y: S.y - rH * 0.6 }, { x: W2.x, y: W2.y - rH * 0.6 }], roofFront, edgeCol, 0.7);
    // Dach Ost-Fläche (schwach sichtbar)
    poly([N, E, { x: E.x, y: E.y - rH * 0.6 }, ridge], shade(roofTop, 5), edgeCol, 0.6);
    // Dach Oben (Top)
    poly([ridge, { x: E.x, y: E.y - rH * 0.6 }, S, { x: W2.x, y: W2.y - rH * 0.6 }], roofTop, edgeCol, 0.8);

    // Level-2: Dach-Aufsatz / Laterne
    if (lvl2 && def.floors >= 2) {
      var lx = cx, ly = ridge.y - 10 * cz;
      ctx.save();
      ctx.fillStyle = st.accent;
      ctx.strokeStyle = shade(st.accent, -30);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(lx - 6 * cz, ly - 8 * cz, 12 * cz, 14 * cz, 2 * cz); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx - 8 * cz, ly - 8 * cz); ctx.lineTo(lx, ly - 16 * cz); ctx.lineTo(lx + 8 * cz, ly - 8 * cz); ctx.closePath();
      ctx.fillStyle = shade(st.roof, 10); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  } else {
    // Flachdach (Farm, Warehouse…)
    poly([N, E, S, W2], wallTop, edgeCol, 0.8);
    if (lvl2) {
      // Brüstung auf Flachdach
      var brusH = 5 * cz;
      poly([N, E, { x: E.x, y: E.y - brusH }, { x: N.x, y: N.y - brusH }], shade(st.wall, -10), edgeCol, 0.7);
      poly([W2, S, { x: S.x, y: S.y - brusH }, { x: W2.x, y: W2.y - brusH }], shade(st.wall, -20), edgeCol, 0.7);
    }
  }

  // ── Fenster auf West-Wand ──
  _draw3DWindows(b.type, box, bH, bW, bD, st, lvl2, cz);

  // ── Tür auf Süd-Wand ──
  _draw3DDoor(box, bH, bD, st, cz);

  // ── Gebäude-Extras (Schornstein, Dekoration) ──
  _draw3DExtras(b, box, bH, rH, st, lvl2, cz);

  // ── Label ──
  _drawBuildingLabel(b, bt, cx, N.y, bH, bW * TW * cz);

  // ── Fortschrittsbalken ──
  _drawProgressBar(b, cx - bW * TW * cz / 2, N.y, bW * TW * cz);
}

// ============================================================
// 3D Fenster – auf West-Wand (sichtbare Seite)
// ============================================================
function _draw3DWindows(type, box, bH, bW, bD, st, lvl2, cz) {
  var N=box.N, W2=box.W, Wb=box.Wb, Nb=box.Nb;
  // West-Wand: Vektor von N nach W2
  var dx = W2.x - N.x, dy = W2.y - N.y;
  // Fenster-Position: 30% und 70% entlang der Wand, 40% Höhe von unten
  var positions = lvl2 ? [0.25, 0.55, 0.78] : [0.30, 0.70];
  var winW = 8 * cz, winH = 10 * cz;
  var yOff = bH * 0.38; // von Boden

  var winFill = type === 'smithy' ? 'rgba(255,140,50,0.9)' : 'rgba(255,252,190,0.88)';
  var glowCol = type === 'smithy' ? '#ff8030' : null;

  for (var i = 0; i < positions.length; i++) {
    var t = positions[i];
    var wx = N.x + dx * t;
    var wy = N.y + dy * t + bH - yOff;
    ctx.save();
    if (glowCol) { ctx.shadowColor = glowCol; ctx.shadowBlur = 6; }
    ctx.fillStyle   = winFill;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath(); ctx.roundRect(wx - winW/2, wy - winH/2, winW, winH, 2); ctx.fill(); ctx.stroke();
    // Fensterkreuz
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(wx, wy - winH/2); ctx.lineTo(wx, wy + winH/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx - winW/2, wy); ctx.lineTo(wx + winW/2, wy); ctx.stroke();
    ctx.restore();
  }

  // Level-2: Balkone auf Süd-Wand
  if (lvl2) {
    var S=box.S, Sb=box.Sb;
    var sdx = S.x - W2.x, sdy = S.y - W2.y;
    var bkW = 14 * cz, bkH = 6 * cz;
    var bkT = 0.45;
    var bkx = W2.x + sdx * bkT, bky = W2.y + sdy * bkT + bH * 0.45;
    ctx.save();
    ctx.fillStyle = shade(st.wall, -30);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(bkx - bkW/2, bky, bkW, bkH, 2); ctx.fill(); ctx.stroke();
    // Geländer
    ctx.strokeStyle = shade(st.accent, -10); ctx.lineWidth = 1.2;
    for (var j = 0; j < 3; j++) {
      ctx.beginPath(); ctx.moveTo(bkx - bkW/2 + j * bkW/2, bky); ctx.lineTo(bkx - bkW/2 + j * bkW/2, bky - 5 * cz); ctx.stroke();
    }
    ctx.restore();
  }
}

// ============================================================
// 3D Tür – auf Süd-Wand
// ============================================================
function _draw3DDoor(box, bH, bD, st, cz) {
  var W2=box.W, S=box.S;
  var sdx = S.x - W2.x, sdy = S.y - W2.y;
  var t = 0.5; // Mitte der Süd-Wand
  var dx = W2.x + sdx * t, dy = W2.y + sdy * t + bH;
  var dW = 9 * cz, dH = 14 * cz;
  ctx.fillStyle = shade(st.wall, -45);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.roundRect(dx - dW/2, dy - dH, dW, dH, { upperLeft: dW/2, upperRight: dW/2, lowerLeft: 0, lowerRight: 0 });
  ctx.fill(); ctx.stroke();
  // Türknauf
  ctx.beginPath(); ctx.arc(dx + dW/2 - 3, dy - dH/2, 1.8, 0, Math.PI*2);
  ctx.fillStyle = '#f0c040'; ctx.fill();
}

// ============================================================
// 3D Extras (Schornstein, Deko) pro Gebäudetyp
// ============================================================
function _draw3DExtras(b, box, bH, rH, st, lvl2, cz) {
  var N=box.N, cx=box.cx, cy=box.cy;
  var chimneyX = N.x - 12 * cz;
  var chimneyBaseY = N.y - rH * 0.5;

  if (b.type === 'smithy' || b.type === 'kitchen' || b.type === 'bakery') {
    // Schornstein
    var cw = 6 * cz, ch = (lvl2 ? 22 : 16) * cz;
    ctx.fillStyle = shade(st.wall, -40);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(chimneyX - cw/2, chimneyBaseY - ch, cw, ch, 2); ctx.fill(); ctx.stroke();
    // Rauch
    ctx.save(); ctx.globalAlpha = 0.30;
    for (var i = 0; i < 3; i++) {
      var r = (4 - i * 0.5) * cz;
      ctx.beginPath(); ctx.arc(chimneyX + i * 1.5, chimneyBaseY - ch - 5 * cz - i * 7 * cz, r, 0, Math.PI*2);
      ctx.fillStyle = '#cccccc'; ctx.fill();
    }
    ctx.restore();
  }

  if (b.type === 'townhall') {
    // Fahne
    var flagX = cx, flagY = N.y - rH - 14 * cz;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(flagX, flagY + 12 * cz); ctx.lineTo(flagX, flagY); ctx.stroke();
    ctx.fillStyle = '#e05252';
    ctx.beginPath(); ctx.moveTo(flagX, flagY); ctx.lineTo(flagX + 10 * cz, flagY + 4 * cz); ctx.lineTo(flagX, flagY + 8 * cz); ctx.closePath();
    ctx.fill();
    // Glocke bei Level 2
    if (lvl2) {
      ctx.font = Math.round(14 * cz) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔔', cx + 14 * cz, N.y - rH + 4 * cz);
    }
  }

  if (b.type === 'farm') {
    // Ernte-Reihen vor dem Gebäude
    var fy = box.Sb.y + 4 * cz;
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#90c858' : '#b8e070';
      ctx.beginPath(); ctx.roundRect(cx - 18 * cz + i * 9 * cz, fy, 7 * cz, 5 * cz, 1); ctx.fill();
    }
    ctx.font = Math.round(12 * cz) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('🌾', cx - 16 * cz, fy); ctx.fillText('🌾', cx + 14 * cz, fy);
    if (lvl2) ctx.fillText('🚜', cx, fy - 2 * cz); // Traktor bei Level 2
  }

  if (b.type === 'sawmill') {
    // Holzstapel
    for (var i = 0; i < (lvl2 ? 4 : 2); i++) {
      ctx.fillStyle = '#8b5c2a';
      ctx.beginPath(); ctx.ellipse(box.Wb.x - 10 * cz, box.Wb.y - i * 7 * cz, 9 * cz, 4 * cz, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#5a3010'; ctx.lineWidth = 0.7; ctx.stroke();
    }
    // Sägeblatt
    ctx.save(); ctx.translate(N.x + 8 * cz, N.y + 4 * cz);
    ctx.beginPath(); ctx.arc(0, 0, 8 * cz, 0, Math.PI*2); ctx.fillStyle='#d0d0d0'; ctx.fill(); ctx.strokeStyle='#888'; ctx.lineWidth=0.8; ctx.stroke();
    for (var i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i*Math.PI/4); ctx.beginPath(); ctx.moveTo(6*cz,0); ctx.lineTo(9*cz,2*cz); ctx.lineTo(9*cz,-2*cz); ctx.closePath(); ctx.fillStyle='#bbb'; ctx.fill(); ctx.restore(); }
    ctx.restore();
  }

  if (b.type === 'quarry') {
    // Steinbrocken
    var rocks = [{dx:-14,dy:6,r:7},{dx:-6,dy:11,r:5},{dx:8,dy:8,r:6},{dx:16,dy:4,r:4}];
    for (var i = 0; i < rocks.length; i++) {
      ctx.fillStyle = '#a0a0b0'; ctx.strokeStyle='#707080'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.ellipse(box.Sb.x + rocks[i].dx * cz, box.Sb.y + rocks[i].dy * cz, rocks[i].r * cz, rocks[i].r * 0.6 * cz, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    }
    ctx.font = Math.round(13 * cz) + 'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⛏', N.x + 10 * cz, N.y + 6 * cz);
  }

  if (b.type === 'warehouse') {
    ctx.font = Math.round(lvl2 ? 18 : 14) * cz + 'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(lvl2 ? '📦📦' : '📦', cx, N.y + 10 * cz);
  }

  if (b.type === 'carpentry') {
    // Holzbretter seitlich
    for (var i = 0; i < (lvl2 ? 4 : 3); i++) {
      ctx.fillStyle = '#c8a060'; ctx.strokeStyle='#8b6020'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.roundRect(box.Eb.x + 2 * cz, box.Eb.y - 22 * cz + i * 9 * cz, 12 * cz, 6 * cz, 1); ctx.fill(); ctx.stroke();
    }
    ctx.font = Math.round(12 * cz) + 'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🪑', N.x + 6 * cz, N.y + 8 * cz);
  }

  if (b.type === 'brickyard') {
    var bc = ['#c85030','#d06040','#b84020'];
    for (var row = 0; row < (lvl2 ? 4 : 3); row++) for (var col = 0; col < 3; col++) {
      var off = row%2===0?0:6*cz;
      ctx.fillStyle = bc[col%3]; ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.roundRect(box.Eb.x + 2*cz + col*13*cz + off, box.Eb.y - 18*cz + row*7*cz, 11*cz, 5*cz, 1); ctx.fill(); ctx.stroke();
    }
  }

  // Level-2: Erweiterungsanbau (kleiner Anbau rechts)
  if (lvl2 && b.type !== 'casino' && b.type !== 'well' && b.type !== 'townhall') {
    var ex = box.E.x, ey = box.E.y;
    var aW = 6 * cz, aH = bH * 0.60;
    ctx.save();
    ctx.fillStyle = shade(st.wall, -10);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(ex - aW/2, ey - aH + bH * 0.1, aW, aH, 3); ctx.fill(); ctx.stroke();
    // Anbau-Dach
    ctx.fillStyle = shade(st.roof, 5);
    ctx.beginPath(); ctx.moveTo(ex - aW, ey - aH + bH*0.1 - 4*cz); ctx.lineTo(ex, ey - aH + bH*0.1 - 9*cz); ctx.lineTo(ex + aW, ey - aH + bH*0.1 - 4*cz); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// 3D KASINO
// ============================================================
function _draw3DCasino(box, bW, bD, bH, rH, sel, lvl2, cz) {
  var N=box.N, E=box.E, S=box.S, W2=box.W, Nb=box.Nb, Eb=box.Eb, Sb=box.Sb, Wb=box.Wb;
  var cx=box.cx;
  var edgeCol = sel ? '#f0a500' : '#ffd700';

  // Wände
  poly([N, W2, Wb, Nb], '#1a0a2a', edgeCol, 1.5);
  poly([W2, S, Sb, Wb], '#120820', edgeCol, 1.5);

  // Flachdach mit Leuchtreklame
  poly([N, E, S, W2], '#2a1040', edgeCol, 1.5);

  // Neon-Schilder auf Dach
  var neonCols = ['#ff0080','#ffff00','#00ffff','#ff8000'];
  for (var i = 0; i < 4; i++) {
    ctx.save(); ctx.shadowColor = neonCols[i]; ctx.shadowBlur = 8;
    var nx = N.x + (S.x - N.x) * (0.15 + i * 0.22);
    var ny = N.y + (S.y - N.y) * (0.15 + i * 0.22) - 4 * cz;
    ctx.beginPath(); ctx.arc(nx, ny, 3 * cz, 0, Math.PI*2);
    ctx.fillStyle = neonCols[i]; ctx.fill(); ctx.restore();
  }

  // CASINO-Text auf Frontfassade
  ctx.save(); ctx.shadowColor = '#ff0080'; ctx.shadowBlur = 10;
  ctx.font = 'bold ' + Math.round(10 * cz) + 'px Nunito,sans-serif';
  ctx.fillStyle = '#ff80ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CASINO', W2.x + (S.x - W2.x) * 0.5, W2.y + bH * 0.45);
  ctx.restore();

  // Türe
  _draw3DDoor(box, bH, bD, { wall: '#2a1040', roof: '#8b0020', accent: '#ffd700' }, cz);

  // Level-2: zweites Neon-Stockwerk
  if (lvl2) {
    ctx.save(); ctx.globalAlpha = 0.7; ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 12;
    ctx.font = 'bold ' + Math.round(7 * cz) + 'px Nunito,sans-serif';
    ctx.fillStyle = '#ffd700'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✨ VIP ✨', cx, N.y + bH * 0.25);
    ctx.restore();
  }
}

// ============================================================
// 3D BRUNNEN
// ============================================================
function _draw3DWell(box, bH, st, sel, cz) {
  var cx = box.cx, cy = box.cy;
  var r = 14 * cz;
  // Basis-Ring
  ctx.beginPath(); ctx.ellipse(cx, cy + 8*cz, r, r * 0.45, 0, 0, Math.PI*2);
  ctx.fillStyle = shade(st.wall, -15); ctx.fill();
  ctx.strokeStyle = sel ? '#f0a500' : 'rgba(0,0,0,0.2)'; ctx.lineWidth = sel ? 2 : 1.2; ctx.stroke();
  // Zylinder
  ctx.beginPath(); ctx.roundRect(cx - r * 0.7, cy + 8*cz - bH * 0.7, r * 1.4, bH * 0.7, 4);
  var wg = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  wg.addColorStop(0, shade(st.wall, 12)); wg.addColorStop(1, shade(st.wall, -22));
  ctx.fillStyle = wg; ctx.fill();
  ctx.strokeStyle = sel ? '#f0a500' : 'rgba(0,0,0,0.18)'; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
  // Wasser innen
  ctx.beginPath(); ctx.ellipse(cx, cy + 8*cz - bH * 0.7 + 4*cz, r * 0.55, r * 0.22, 0, 0, Math.PI*2);
  ctx.fillStyle = '#4fc3f7'; ctx.fill();
  // Bogen
  ctx.beginPath(); ctx.arc(cx, cy + 8*cz - bH * 0.7, r * 0.88, Math.PI, 0);
  ctx.strokeStyle = shade(st.roof, -10); ctx.lineWidth = 6 * cz; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy + 8*cz - bH * 0.7, r * 0.88, Math.PI, 0);
  ctx.strokeStyle = st.roof; ctx.lineWidth = 4.5 * cz; ctx.stroke();
}

// ── Label und Fortschrittsbalken (unverändert) ──────────────
function _drawBuildingLabel(b, bt, cx, topY, bH, W) {
  var sz = Math.max(7, Math.round(10 * camZoom));
  ctx.font = 'bold ' + sz + 'px Nunito,sans-serif';
  ctx.fillStyle = b.type === 'casino' ? '#ffd700' : '#3a2a1a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText((bt ? bt.name : b.type) + (b.level >= 2 ? ' ⬆️' : ''), cx, topY + bH + 6);
}
function _drawProgressBar(b, bxLeft, topY, W) {
  var workers = state.villagers.filter(function(v) { return v.buildingId === b.id; });
  if (!workers.length) return;
  var avg = 0;
  for (var i = 0; i < workers.length; i++) avg += workers[i].progress;
  avg /= workers.length;
  var bxb = bxLeft + 4, byb = topY - 16, bw = W - 8;
  ctx.beginPath(); ctx.roundRect(bxb, byb, bw, 5, 2); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(bxb, byb, bw * (avg / 100), 5, 2); ctx.fillStyle = '#4aaa42'; ctx.fill();
  ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(workers.map(function(v) { return v.emoji; }).join(''), bxLeft + W / 2, byb - 2);
}

// ============================================================
// ============================================================
// VILLAGER – Phase 8: Echte 3D-Figuren mit Animationssystem
// Neu: Lauf-, Idle-, Arbeits-Animationen; Ausrüstung; Emotes
// ============================================================

// ── Globale Animations-Konstanten ──
var ANIM_WALK_SPEED  = 0.12;
var ANIM_IDLE_SPEED  = 0.018;
var ANIM_WORK_SPEED  = 0.09;

// Partikel-Pool für Arbeits-Effekte
var PARTICLES = [];

function spawnParticle(x, y, type) {
  PARTICLES.push({
    x: x, y: y, vx: (Math.random() - 0.5) * 1.2, vy: -1.2 - Math.random() * 0.8,
    life: 1.0, type: type // 'work','xp','coin','heart'
  });
}

function updateParticles() {
  for (var i = PARTICLES.length - 1; i >= 0; i--) {
    var p = PARTICLES[i];
    p.x  += p.vx; p.y += p.vy;
    p.vy += 0.04; // Gravitation
    p.life -= 0.025;
    if (p.life <= 0) PARTICLES.splice(i, 1);
  }
}

function drawParticles() {
  for (var i = 0; i < PARTICLES.length; i++) {
    var p = PARTICLES[i];
    ctx.save(); ctx.globalAlpha = p.life;
    if (p.type === 'work') {
      ctx.fillStyle = '#f0c040';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'xp') {
      ctx.font = 'bold 11px Nunito,sans-serif';
      ctx.fillStyle = '#a0e040'; ctx.textAlign = 'center';
      ctx.fillText('+XP', p.x, p.y);
    } else if (p.type === 'coin') {
      ctx.font = '12px serif'; ctx.textAlign = 'center';
      ctx.fillText('🪙', p.x, p.y);
    } else if (p.type === 'heart') {
      ctx.font = '11px serif'; ctx.textAlign = 'center';
      ctx.fillText('❤️', p.x, p.y);
    } else if (p.type === 'spark') {
      ctx.strokeStyle = '#ff8030'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 3, p.y + p.vy * 3); ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Haupt-Zeichenfunktion ──────────────────────────────────
function drawVillager(v) {
  var hgt = getHeight(Math.round(v.x), Math.round(v.y));
  var p   = toIso(v.x, v.y, hgt);
  var px  = p.x;
  var py  = p.y + TH / 2 * camZoom - 2 * camZoom;
  var cz  = camZoom;

  var spd = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
  var isWorking = v.buildingId !== null;
  var isWalking = spd > 0.004;

  // Animations-Timer
  var animSpd = isWalking ? ANIM_WALK_SPEED : isWorking ? ANIM_WORK_SPEED : ANIM_IDLE_SPEED;
  v.anim = (v.anim || 0) + animSpd;
  var t = v.anim;

  // ── Bewegungsrichtung (für Kopfdrehung) ──
  var facingRight = v.vx >= 0;

  // ── Lauf-Zyklus ──
  var walkPhase = Math.sin(t * Math.PI * 2);
  var bob       = isWalking ? walkPhase * 2.5 : Math.sin(t * 0.7) * 0.6;
  var legL      = isWalking ? walkPhase * 7    : (isWorking ? Math.sin(t * Math.PI * 2) * 3 : 0);
  var legR      = -legL;
  var armL      = isWalking ? -walkPhase * 6   : (isWorking ? Math.sin(t * Math.PI * 2 + 0.5) * 8 : Math.sin(t * 0.5) * 1.5);
  var armR      = -armL;

  // Arbeit: Arme heben/senken
  if (isWorking) {
    armL = -Math.abs(Math.sin(t * Math.PI * 2)) * 12 - 2;
    armR = Math.sin(t * Math.PI * 2) * 6;
    // Arbeits-Partikel spawnen
    if (Math.floor(t * 4) !== Math.floor((t - animSpd) * 4)) {
      spawnParticle(px + (Math.random()-0.5)*16*cz, py - 28*cz, 'spark');
    }
  }

  // ── Körper-Farben ──
  var sk = v.skin  || '#f4c490';
  var hr = v.hair  || '#5a3010';
  var sh = v.shirt || '#4a8adf';
  var pn = v.pants || '#3a4a60';

  // ── Skalierung nach camZoom ──
  // Wir zeichnen alles in "Welt-Einheiten" * cz
  var S = cz;  // Skalierungsfaktor

  // ── Schatten (Ellipse am Boden) ──
  ctx.save();
  ctx.globalAlpha = 0.18 + spd * 0.08;
  ctx.beginPath(); ctx.ellipse(px, py + 20*S, (9 + spd * 18)*S, 4*S, 0, 0, Math.PI*2);
  ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();

  // ── Auswahlring ──
  if (state.selectedVillager === v.id) {
    ctx.save();
    ctx.strokeStyle = '#f0a500'; ctx.lineWidth = 2;
    ctx.shadowColor = '#f0a500'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(px, py + 20*S, 14*S, 5.5*S, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  var baseY = py + bob * S;

  // ── BEINE ──
  ctx.lineCap = 'round';

  // Unterschenkel L
  var kLx = px - 3*S, kLy = baseY + 10*S;
  var fLx = px - 4*S + legL*S, fLy = baseY + 20*S;
  ctx.strokeStyle = shade(pn, -20); ctx.lineWidth = 4.5*S;
  ctx.beginPath(); ctx.moveTo(kLx, kLy); ctx.lineTo(fLx, fLy); ctx.stroke();

  // Unterschenkel R
  var kRx = px + 3*S, kRy = baseY + 10*S;
  var fRx = px + 4*S + legR*S, fRy = baseY + 20*S;
  ctx.strokeStyle = shade(pn, -20); ctx.lineWidth = 4.5*S;
  ctx.beginPath(); ctx.moveTo(kRx, kRy); ctx.lineTo(fRx, fRy); ctx.stroke();

  // Oberschenkel L
  ctx.strokeStyle = pn; ctx.lineWidth = 5.5*S;
  ctx.beginPath(); ctx.moveTo(px - 2*S, baseY + 4*S); ctx.lineTo(kLx, kLy); ctx.stroke();
  // Oberschenkel R
  ctx.beginPath(); ctx.moveTo(px + 2*S, baseY + 4*S); ctx.lineTo(kRx, kRy); ctx.stroke();

  // Füße
  ctx.fillStyle = shade(pn, -40);
  ctx.beginPath(); ctx.ellipse(fLx, fLy, 4*S, 2.2*S, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(fRx, fRy, 4*S, 2.2*S, 0, 0, Math.PI*2); ctx.fill();

  // ── TORSO ──
  var torsoGrad = ctx.createLinearGradient(px - 7*S, baseY - 8*S, px + 7*S, baseY + 10*S);
  torsoGrad.addColorStop(0, shade(sh, 20));
  torsoGrad.addColorStop(0.5, sh);
  torsoGrad.addColorStop(1, shade(sh, -18));
  ctx.beginPath(); ctx.roundRect(px - 7*S, baseY - 10*S, 14*S, 20*S, 4*S);
  ctx.fillStyle = torsoGrad; ctx.fill();
  ctx.strokeStyle = shade(sh, -28); ctx.lineWidth = 0.7*S; ctx.stroke();

  // Knopfreihe (Details)
  for (var btn = 0; btn < 3; btn++) {
    ctx.beginPath(); ctx.arc(px, baseY - 5*S + btn * 4.5*S, 0.9*S, 0, Math.PI*2);
    ctx.fillStyle = shade(sh, -50); ctx.fill();
  }

  // ── ARME ──
  // Oberarm L
  var eLx = px - 10*S + armL*0.3*S, eLy = baseY + armL*S;
  ctx.strokeStyle = sh; ctx.lineWidth = 4.5*S;
  ctx.beginPath(); ctx.moveTo(px - 7*S, baseY - 5*S); ctx.lineTo(eLx, eLy); ctx.stroke();
  // Unterarm L
  var hLx = px - 12*S + armL*0.2*S, hLy = baseY + armL*1.2*S + 4*S;
  ctx.strokeStyle = shade(sh, -10); ctx.lineWidth = 3.8*S;
  ctx.beginPath(); ctx.moveTo(eLx, eLy); ctx.lineTo(hLx, hLy); ctx.stroke();

  // Oberarm R
  var eRx = px + 10*S + armR*0.3*S, eRy = baseY + armR*S;
  ctx.strokeStyle = sh; ctx.lineWidth = 4.5*S;
  ctx.beginPath(); ctx.moveTo(px + 7*S, baseY - 5*S); ctx.lineTo(eRx, eRy); ctx.stroke();
  // Unterarm R
  var hRx = px + 12*S + armR*0.2*S, hRy = baseY + armR*1.2*S + 4*S;
  ctx.strokeStyle = shade(sh, -10); ctx.lineWidth = 3.8*S;
  ctx.beginPath(); ctx.moveTo(eRx, eRy); ctx.lineTo(hRx, hRy); ctx.stroke();

  // Hände
  ctx.fillStyle = sk;
  ctx.beginPath(); ctx.arc(hLx, hLy, 3*S, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hRx, hRy, 3*S, 0, Math.PI*2); ctx.fill();

  // ── WERKZEUG bei Arbeit ──
  if (isWorking) {
    var toolAngle = Math.sin(t * Math.PI * 2) * 0.5 - 0.3;
    ctx.save();
    ctx.translate(hRx, hRy);
    ctx.rotate(toolAngle);
    ctx.strokeStyle = '#8b5c2a'; ctx.lineWidth = 2.5*S;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12*S, -14*S); ctx.stroke();
    // Werkzeugkopf (Hammer / Hacke je nach Gebäude)
    ctx.fillStyle = '#b0b0c0';
    ctx.strokeStyle = '#808090'; ctx.lineWidth = 0.8*S;
    ctx.beginPath(); ctx.roundRect(8*S, -18*S, 10*S, 6*S, 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ── HALS ──
  ctx.fillStyle = sk;
  ctx.beginPath(); ctx.roundRect(px - 2.5*S, baseY - 14*S, 5*S, 6*S, 1); ctx.fill();

  // ── KOPF ──
  var headY = baseY - 22*S;

  // Kopf-Schatten
  ctx.save(); ctx.globalAlpha = 0.08;
  ctx.beginPath(); ctx.ellipse(px + 2*S, headY + 2*S, 10*S, 9*S, 0, 0, Math.PI*2);
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();

  // Kopf-Form (leicht ovaler Kreis)
  var headGrad = ctx.createRadialGradient(px - 2*S, headY - 2*S, 1*S, px, headY, 9*S);
  headGrad.addColorStop(0, shade(sk, 18));
  headGrad.addColorStop(1, shade(sk, -8));
  ctx.beginPath(); ctx.ellipse(px, headY, 9*S, 9.5*S, 0, 0, Math.PI*2);
  ctx.fillStyle = headGrad; ctx.fill();
  ctx.strokeStyle = shade(sk, -22); ctx.lineWidth = 0.7*S; ctx.stroke();

  // ── Haare ──
  // Oben
  ctx.beginPath(); ctx.ellipse(px, headY - 7*S, 8*S, 5*S, 0, Math.PI, 0);
  ctx.fillStyle = hr; ctx.fill();
  // Seiten
  ctx.beginPath(); ctx.ellipse(px - 8*S, headY - 1*S, 3.5*S, 3*S, -0.3, 0, Math.PI*2);
  ctx.fillStyle = hr; ctx.fill();
  ctx.beginPath(); ctx.ellipse(px + 8*S, headY - 1*S, 3.5*S, 3*S, 0.3, 0, Math.PI*2);
  ctx.fillStyle = hr; ctx.fill();

  // ── Augen ──
  var eyeOffX = facingRight ? 1*S : -1*S;
  // Augenhintergrund (Weiss)
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.ellipse(px - 3.2*S + eyeOffX, headY - 1*S, 2.2*S, 2.5*S, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px + 3.2*S + eyeOffX, headY - 1*S, 2.2*S, 2.5*S, 0, 0, Math.PI*2); ctx.fill();
  // Iris
  ctx.fillStyle = 'rgba(30,20,10,0.88)';
  ctx.beginPath(); ctx.ellipse(px - 3*S + eyeOffX, headY - 1*S, 1.5*S, 1.8*S, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px + 3*S + eyeOffX, headY - 1*S, 1.5*S, 1.8*S, 0, 0, Math.PI*2); ctx.fill();
  // Glanzpunkt
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(px - 2.4*S + eyeOffX, headY - 1.8*S, 0.7*S, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 3.6*S + eyeOffX, headY - 1.8*S, 0.7*S, 0, Math.PI*2); ctx.fill();

  // ── Mund ──
  ctx.beginPath();
  if (isWorking) {
    // Konzentrierter Ausdruck: gerade Linie
    ctx.moveTo(px - 2.5*S, headY + 3.5*S); ctx.lineTo(px + 2.5*S, headY + 3.5*S);
    ctx.strokeStyle = 'rgba(140,60,60,0.75)'; ctx.lineWidth = 1.2*S; ctx.stroke();
  } else if (isWalking) {
    // Lächeln
    ctx.arc(px, headY + 2*S, 3*S, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = 'rgba(160,70,70,0.8)'; ctx.lineWidth = 1.2*S; ctx.stroke();
  } else {
    // Neutrales Lächeln
    ctx.arc(px, headY + 2.5*S, 2.2*S, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = 'rgba(150,65,65,0.7)'; ctx.lineWidth = 1*S; ctx.stroke();
  }

  // ── Hunger-Warnung ──
  if (v.hunger <= 1) {
    ctx.save();
    ctx.shadowColor = '#e05252'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(px + 11*S, headY - 14*S, 6*S, 0, Math.PI*2);
    ctx.fillStyle = '#e05252'; ctx.fill();
    ctx.font = 'bold ' + Math.round(8*S) + 'px Nunito,sans-serif';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', px + 11*S, headY - 14*S);
    ctx.restore();
  }

  // ── Arbeitsblasen (Fortschritt-Tooltip) ──
  if (isWorking && v.progress > 0) {
    var bubX = px + 14*S, bubY = headY - 18*S;
    ctx.save();
    ctx.fillStyle = 'rgba(255,252,230,0.92)';
    ctx.strokeStyle = '#c8a020'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(bubX - 12, bubY - 8, 24, 14, 5); ctx.fill(); ctx.stroke();
    ctx.font = 'bold ' + Math.round(7*S) + 'px Nunito,sans-serif';
    ctx.fillStyle = '#5a3010'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(v.progress) + '%', bubX, bubY - 1);
    ctx.restore();
  }

  // ── Idle-Emote (zufällig, selten) ──
  if (!isWalking && !isWorking && v.emote && v.emote.life > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, v.emote.life);
    ctx.font = Math.round(16*S) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(v.emote.icon, px, headY - 20*S - v.emote.rise * S);
    v.emote.life  -= 0.012;
    v.emote.rise  += 0.15;
    ctx.restore();
    if (v.emote.life <= 0) v.emote = null;
  }

  // ── Name ──
  var nsz = Math.max(6, Math.round(8*S));
  ctx.font = 'bold ' + nsz + 'px Nunito,sans-serif';
  ctx.fillStyle = '#2a1a0a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(v.name, px, headY - 30*S);
}

// ── Idle-Emotes zufällig starten ──
var _emoteTimer = 0;
var EMOTES = ['😴','💤','🎵','⭐','❓','💭','😊'];
function tickEmotes() {
  _emoteTimer++;
  if (_emoteTimer % 180 !== 0) return;
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    if (!v.emote && v.buildingId === null && Math.random() < 0.25) {
      v.emote = { icon: EMOTES[Math.floor(Math.random() * EMOTES.length)], life: 1.5, rise: 0 };
    }
  }
}

// ── Wolken ──────────────────────────────────────────────────
// ============================================================
// WETTER & BELEUCHTUNG – Phase 9
// ============================================================

// ── Wetter-Zustände ──────────────────────────────────────────
// 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog'
var WEATHER_STATE    = 'clear';
var WEATHER_TIMER    = 0;          // Ticks bis zum nächsten Wechsel
var WEATHER_TRANS    = 0;          // 0..1 Übergangs-Blend
var WEATHER_PREV     = 'clear';
var WEATHER_NEXT     = 'clear';

// Wetterpartikel (Regen / Schnee)
var WEATHER_PARTICLES = [];
var MAX_WEATHER_PX    = 220;

// Blitz-System
var LIGHTNING_ALPHA  = 0;
var LIGHTNING_TIMER  = 0;
var LIGHTNING_X      = 0;

// Nebel-Wolken (Fog)
var FOG_PUFFS = [];

// Wetter-Wechsel-Tabelle (Wahrscheinlichkeiten)
var WEATHER_TABLE = {
  clear:  { cloudy:0.4, rain:0.2, snow:0.1, fog:0.1, clear:0.2 },
  cloudy: { clear:0.3,  rain:0.3, storm:0.15, fog:0.1, cloudy:0.15 },
  rain:   { clear:0.2,  cloudy:0.3, storm:0.2, rain:0.3 },
  storm:  { rain:0.5,   cloudy:0.3, clear:0.2 },
  snow:   { clear:0.3,  cloudy:0.2, snow:0.5 },
  fog:    { clear:0.4,  cloudy:0.3, fog:0.3 }
};

// Minimale Dauer pro Wetter in Ticks (bei 60fps: 3600=60s)
var WEATHER_MIN_DURATION = 1800;
var WEATHER_MAX_DURATION = 7200;

function initWeather() {
  WEATHER_STATE = 'clear';
  WEATHER_TIMER = WEATHER_MIN_DURATION + Math.floor(Math.random() * WEATHER_MAX_DURATION);
  // Nebel-Puffs initialisieren
  for (var i = 0; i < 8; i++) {
    FOG_PUFFS.push({
      x: Math.random(), y: 0.3 + Math.random() * 0.4,
      r: 60 + Math.random() * 80, spd: 0.00008 + Math.random() * 0.00012
    });
  }
}

function tickWeather() {
  WEATHER_TIMER--;

  // Blitz-System
  if (WEATHER_STATE === 'storm') {
    LIGHTNING_TIMER--;
    if (LIGHTNING_TIMER <= 0) {
      LIGHTNING_TIMER = 80 + Math.floor(Math.random() * 180);
      LIGHTNING_ALPHA = 1.0;
      LIGHTNING_X     = 0.2 + Math.random() * 0.6;
    }
  }
  if (LIGHTNING_ALPHA > 0) LIGHTNING_ALPHA = Math.max(0, LIGHTNING_ALPHA - 0.06);

  // Übergang
  if (WEATHER_TRANS > 0) {
    WEATHER_TRANS = Math.min(1, WEATHER_TRANS + 0.01);
    if (WEATHER_TRANS >= 1) {
      WEATHER_STATE = WEATHER_NEXT;
      WEATHER_TRANS = 0;
    }
  }

  // Wetterwechsel
  if (WEATHER_TIMER <= 0 && WEATHER_TRANS === 0) {
    var table = WEATHER_TABLE[WEATHER_STATE] || WEATHER_TABLE['clear'];
    var roll  = Math.random(), acc = 0, chosen = 'clear';
    for (var k in table) { acc += table[k]; if (roll <= acc) { chosen = k; break; } }
    WEATHER_PREV  = WEATHER_STATE;
    WEATHER_NEXT  = chosen;
    WEATHER_TRANS = 0.001;  // Übergang starten
    WEATHER_TIMER = WEATHER_MIN_DURATION + Math.floor(Math.random() * WEATHER_MAX_DURATION);
    showNotif(WEATHER_ICONS[chosen] + ' ' + WEATHER_NAMES[chosen]);
  }

  // Wetterpartikel (Regen/Schnee)
  var needPx = (WEATHER_STATE === 'rain' || WEATHER_STATE === 'storm') ? MAX_WEATHER_PX
             : (WEATHER_STATE === 'snow') ? Math.floor(MAX_WEATHER_PX * 0.5) : 0;

  while (WEATHER_PARTICLES.length < needPx) {
    WEATHER_PARTICLES.push(makeWeatherParticle());
  }
  // Überschuss entfernen wenn Wetter wechselt
  if (WEATHER_PARTICLES.length > needPx + 20) WEATHER_PARTICLES.splice(0, 5);

  for (var i = WEATHER_PARTICLES.length - 1; i >= 0; i--) {
    var wp = WEATHER_PARTICLES[i];
    wp.x += wp.vx; wp.y += wp.vy;
    if (wp.y > canvas.height + 20 || wp.x < -20 || wp.x > canvas.width + 20) {
      WEATHER_PARTICLES.splice(i, 1);
    }
  }

  // Nebel-Puffs bewegen
  for (var i = 0; i < FOG_PUFFS.length; i++) {
    FOG_PUFFS[i].x += FOG_PUFFS[i].spd;
    if (FOG_PUFFS[i].x > 1.3) FOG_PUFFS[i].x = -0.3;
  }
}

function makeWeatherParticle() {
  var isSnow = WEATHER_STATE === 'snow';
  return {
    x:  Math.random() * (canvas ? canvas.width : 800),
    y:  -10,
    vx: isSnow ? (Math.random() - 0.5) * 0.6 : (WEATHER_STATE === 'storm' ? -2.5 - Math.random() * 1.5 : -0.3 - Math.random() * 0.5),
    vy: isSnow ? 0.8 + Math.random() * 0.6    : 6 + Math.random() * 4,
    r:  isSnow ? 2 + Math.random() * 2         : 0,
    len:isSnow ? 0                              : 8 + Math.random() * 8,
    a:  0.4 + Math.random() * 0.5
  };
}

var WEATHER_ICONS  = { clear:'☀️', cloudy:'⛅', rain:'🌧️', storm:'⛈️', snow:'❄️', fog:'🌫️' };
var WEATHER_NAMES  = { clear:'Sonnig', cloudy:'Bewölkt', rain:'Regen', storm:'Gewitter', snow:'Schneefall', fog:'Nebel' };

// ── Wetter zeichnen ─────────────────────────────────────────
function drawWeather() {
  if (!canvas) return;
  var w = canvas.width, h = canvas.height;
  var f = getDayNightFactor();

  // ── Wolken-Overlay (cloudy/rain/storm) ──
  var cloudCover = WEATHER_STATE === 'storm' ? 0.82
                 : WEATHER_STATE === 'rain'  ? 0.65
                 : WEATHER_STATE === 'cloudy'? 0.42 : 0;
  if (cloudCover > 0) {
    ctx.save(); ctx.globalAlpha = cloudCover * 0.7;
    ctx.fillStyle = '#8a9aaa';
    ctx.fillRect(0, 0, w, h * 0.5);
    ctx.restore();
    // Dynamische Wolken
    drawDynamicClouds(cloudCover);
  }

  // ── Nebel ──
  if (WEATHER_STATE === 'fog' || WEATHER_TRANS > 0 && WEATHER_NEXT === 'fog') {
    var fogA = WEATHER_STATE === 'fog' ? 0.55 : WEATHER_TRANS * 0.55;
    ctx.save();
    for (var i = 0; i < FOG_PUFFS.length; i++) {
      var fp = FOG_PUFFS[i];
      ctx.globalAlpha = fogA * (0.5 + Math.sin(fp.x * 3) * 0.2);
      var fg = ctx.createRadialGradient(fp.x * w, fp.y * h, 0, fp.x * w, fp.y * h, fp.r);
      fg.addColorStop(0, 'rgba(220,225,230,0.9)');
      fg.addColorStop(1, 'rgba(220,225,230,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(fp.x * w, fp.y * h, fp.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Regen / Schnee Partikel ──
  if (WEATHER_PARTICLES.length > 0) {
    ctx.save();
    var isSnow = WEATHER_STATE === 'snow';
    for (var i = 0; i < WEATHER_PARTICLES.length; i++) {
      var wp = WEATHER_PARTICLES[i];
      ctx.globalAlpha = wp.a * (WEATHER_TRANS > 0 ? Math.min(1, WEATHER_TRANS * 3) : 1);
      if (isSnow) {
        // Schneeflocke
        ctx.fillStyle = '#e8f0ff';
        ctx.beginPath(); ctx.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2); ctx.fill();
      } else {
        // Regentropfen
        ctx.strokeStyle = WEATHER_STATE === 'storm' ? 'rgba(160,190,220,0.8)' : 'rgba(130,170,210,0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(wp.x, wp.y); ctx.lineTo(wp.x + wp.vx * 1.5, wp.y + wp.len); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── Blitz ──
  if (LIGHTNING_ALPHA > 0.01) {
    // Flash-Overlay
    ctx.save(); ctx.globalAlpha = LIGHTNING_ALPHA * 0.35;
    ctx.fillStyle = '#e8f0ff'; ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // Blitz-Zickzack
    if (LIGHTNING_ALPHA > 0.5) {
      ctx.save();
      ctx.strokeStyle = '#fffde0'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 18;
      ctx.globalAlpha = LIGHTNING_ALPHA;
      var lx = LIGHTNING_X * w, ly = 0;
      ctx.beginPath(); ctx.moveTo(lx, ly);
      for (var s = 0; s < 6; s++) {
        lx += (Math.random() - 0.5) * 40;
        ly += h * 0.12;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke(); ctx.restore();
    }
  }

  // ── Schnee-Boden Overlay ──
  if (WEATHER_STATE === 'snow') {
    ctx.save(); ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#e8f0ff';
    ctx.fillRect(0, h * 0.42, w, h * 0.58);
    ctx.restore();
  }

  // ── Regen-Pfützen auf dem Boden ──
  if ((WEATHER_STATE === 'rain' || WEATHER_STATE === 'storm') && WEATHER_TIMER < WEATHER_MAX_DURATION * 0.8) {
    ctx.save(); ctx.globalAlpha = 0.18;
    // Dynamische Wellen auf Wasser-Tiles
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (TMAP[r][c] === 3) {
        var pp = toIso(c, r, 0);
        ctx.strokeStyle = 'rgba(130,180,220,0.5)'; ctx.lineWidth = 1;
        var rr = (waterAnim * 3 + c + r) % (Math.PI * 2);
        ctx.beginPath(); ctx.ellipse(pp.x, pp.y + TH / 2 * camZoom, (4 + Math.sin(rr) * 2) * camZoom, (2 + Math.sin(rr) * 1) * camZoom, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ── Dynamische Wolken (bewegen sich) ──────────────────────────
var CLOUD_POSITIONS = null;
function drawDynamicClouds(cover) {
  if (!CLOUD_POSITIONS) {
    CLOUD_POSITIONS = [];
    for (var i = 0; i < 6; i++) CLOUD_POSITIONS.push({ x: Math.random(), y: 0.02 + Math.random() * 0.12, s: 55 + Math.random() * 60, spd: 0.00005 + Math.random() * 0.00008 });
  }
  ctx.save();
  for (var i = 0; i < CLOUD_POSITIONS.length; i++) {
    var cp = CLOUD_POSITIONS[i];
    cp.x += cp.spd;
    if (cp.x > 1.3) cp.x = -0.2;
    ctx.globalAlpha = cover * (0.65 + Math.sin(cp.x * 5) * 0.15);
    var cx2 = cp.x * canvas.width, cy2 = cp.y * canvas.height;
    ctx.fillStyle = WEATHER_STATE === 'storm' ? '#5a6070' : '#c8ccd4';
    ctx.beginPath(); ctx.arc(cx2, cy2, cp.s * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx2 + cp.s * 0.35, cy2 + cp.s * 0.08, cp.s * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx2 - cp.s * 0.28, cy2 + cp.s * 0.1, cp.s * 0.30, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── Beleuchtungs-Overlay basierend auf Tageszeit + Wetter ──
function drawLighting() {
  var f  = getDayNightFactor();

  // Warme Morgen-/Abendröte
  if (f > 0.55 && f < 0.75) {
    var sunsetT = 1 - Math.abs(f - 0.65) / 0.1;
    ctx.save(); ctx.globalAlpha = sunsetT * 0.18;
    ctx.fillStyle = '#ff8030';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Gewitter: Dunkleres, blau-graues Licht
  if (WEATHER_STATE === 'storm') {
    ctx.save(); ctx.globalAlpha = 0.20;
    ctx.fillStyle = '#1a2840';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Regen: leicht abdunkeln
  if (WEATHER_STATE === 'rain') {
    ctx.save(); ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#101820';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Fenster leuchten nachts
  if (f < 0.45) {
    var winAlpha = Math.min(0.8, (0.45 - f) / 0.3 * 0.8);
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (b.type === 'well' || b.type === 'casino') continue;
      var hgt = getHeight(b.col, b.row);
      var bp  = toIso(b.col, b.row, hgt);
      ctx.save();
      ctx.globalAlpha = winAlpha * (0.6 + Math.sin(waterAnim + i) * 0.2);
      var wg = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, 40 * camZoom);
      wg.addColorStop(0, 'rgba(255,200,80,0.55)');
      wg.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.arc(bp.x, bp.y, 40 * camZoom, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

// ── Wetter-Indikator (UI-Chip) ────────────────────────────────
function drawWeatherChip() {
  if (!canvas) return;
  var icon = WEATHER_ICONS[WEATHER_STATE] || '☀️';
  var cx2  = 12, cy2 = canvas.height - 12;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(cx2, cy2 - 20, 52, 22, 8); ctx.fill();
  ctx.font = '13px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(icon, cx2 + 4, cy2 - 9);
  ctx.font = 'bold 9px Nunito,sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText(WEATHER_NAMES[WEATHER_STATE], cx2 + 22, cy2 - 9);
  ctx.restore();
}

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
  tickWeather();

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

  // Wolken (nur bei klarem Wetter statische Wolken, sonst drawWeather)
  if (WEATHER_STATE === 'clear') {
    var ca = Math.max(.12, Math.min(.50, f * .55));
    drawCloud(canvas.width*.15, canvas.height*.07, 70, ca);
    drawCloud(canvas.width*.5,  canvas.height*.04, 90, ca);
    drawCloud(canvas.width*.82, canvas.height*.09, 60, ca);
  }

  // Boden
  var grdBg = ctx.createLinearGradient(0, canvas.height*.4, 0, canvas.height);
  // Wetter beeinflusst Bodenfarbe
  var gc;
  if (WEATHER_STATE === 'snow') gc = ['#dde8f4','#b0c8e0'];
  else if (WEATHER_STATE === 'storm' || WEATHER_STATE === 'rain') gc = f > 0.4 ? ['#7a9a70','#2a5828'] : ['#2a3820','#101808'];
  else gc = f > 0.7 ? ['#c0dca0','#5a9e50'] : f > 0.4 ? ['#8aaa70','#3a7030'] : ['#3a4830','#1a2818'];
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

  // ── Partikel aktualisieren ──
  updateParticles();
  tickEmotes();

  // ── Villager ──
  for (var i = 0; i < state.villagers.length; i++) drawVillager(state.villagers[i]);

  // ── Partikel zeichnen (über Villager) ──
  drawParticles();

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

  // ── Wetter-Effekte (Regen, Schnee, Blitz, Nebel) ──
  drawWeather();

  // ── Beleuchtung (Sonnenuntergang, Nachtlichter, Sturm) ──
  drawLighting();

  // ── Nacht-Overlay ──
  var na = getNightOverlayAlpha();
  if (na > 0.01) {
    ctx.save(); ctx.globalAlpha = na;
    ctx.fillStyle = '#0a082a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // ── Minimap ──
  drawMinimap();

  // ── Wetter-Chip ──
  drawWeatherChip();
}
