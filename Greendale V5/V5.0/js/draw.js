// ============================================================
// DRAW.JS – Phase 5
// Neu: Tages-/Nacht-Zyklus, verbesserter Hintergrund
// ============================================================

var canvas    = null;
var ctx       = null;
var oX = 0, oY = 0;
var waterAnim = 0;
var camDrag   = false;
var camDragX  = 0, camDragY  = 0;
var camStartX = 0, camStartY = 0;
var TMAP = [], TREES = [], TREE_SET = {}, FLOWERS = [];

// ── Tages-/Nacht-Zyklus ──────────────────────────────────────
var dayNightTick = 0;
var DAY_CYCLE_LENGTH = 7200; // Ticks bis ein voller Tag-Nacht-Zyklus

function getDayNightFactor() {
  // 0 = Mittag (hell), 0.5 = Mitternacht (dunkel), periodisch
  var phase = (dayNightTick % DAY_CYCLE_LENGTH) / DAY_CYCLE_LENGTH;
  return Math.sin(phase * Math.PI * 2) * 0.5 + 0.5; // 0..1
}

function getSkyColors() {
  var f = getDayNightFactor();
  // f=1 = Mittag, f=0 = Mitternacht
  if (f > 0.85) {
    // Tag: helles Blau
    return ['#caeaf8', '#8ecef0'];
  } else if (f > 0.6) {
    // Nachmittag/Morgen: warme Töne
    var blend = (f - 0.6) / 0.25;
    return [lerpColor('#f4a460', '#caeaf8', blend), lerpColor('#e07030', '#8ecef0', blend)];
  } else if (f > 0.35) {
    // Sonnenuntergang/-aufgang: Orange/Rosa
    var blend2 = (f - 0.35) / 0.25;
    return [lerpColor('#2a1040', '#f4a460', blend2), lerpColor('#0a0820', '#e07030', blend2)];
  } else {
    // Nacht: dunkelblau/lila
    return ['#1a1030', '#0a0820'];
  }
}

function getGroundColor() {
  var f = getDayNightFactor();
  if (f > 0.7) return ['#c0dca0', '#5a9e50'];
  if (f > 0.4) return ['#8aaa70', '#3a7030'];
  return ['#3a4830', '#1a2818'];
}

function getNightOverlayAlpha() {
  var f = getDayNightFactor();
  // ab f < 0.6 wird es dunkler
  if (f >= 0.7) return 0;
  if (f <= 0.2) return 0.55;
  return (0.7 - f) / 0.5 * 0.55;
}

function lerpColor(c1, c2, t) {
  var p1 = parseInt(c1.replace('#',''), 16);
  var p2 = parseInt(c2.replace('#',''), 16);
  var r = Math.round(((p1>>16)&255) * (1-t) + ((p2>>16)&255) * t);
  var g = Math.round(((p1>>8)&255)  * (1-t) + ((p2>>8)&255)  * t);
  var b = Math.round((p1&255)       * (1-t) + (p2&255)       * t);
  return 'rgb('+r+','+g+','+b+')';
}

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
  var w    = wrap.clientWidth;
  var h    = wrap.clientHeight;
  if (w === 0 || h === 0) return;
  canvas.width  = w;
  canvas.height = h;
  var midC = COLS / 2, midR = ROWS / 2;
  oX = w / 2 - (midC - midR) * (TW / 2);
  oY = h / 2 - (midC + midR) * (TH / 2);
}

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
}

function generateMap() {
  for (var r = 0; r < ROWS; r++) {
    TMAP[r] = [];
    for (var c = 0; c < COLS; c++) {
      var v = Math.random();
      TMAP[r][c] = v > .88 ? 1 : v > .78 ? 2 : 0;
    }
  }
  // Wassersee rechts unten
  for (var r = ROWS-5; r < ROWS-1; r++)
    for (var c = COLS-6; c < COLS-1; c++) TMAP[r][c] = 3;
  // Sandstrand rund um den See
  for (var r = ROWS-6; r < ROWS; r++)
    for (var c = COLS-7; c < COLS; c++)
      if (TMAP[r][c] === 0) TMAP[r][c] = 5;
  // Pfade
  var PATH = [[5,5],[5,4],[5,3],[4,3],[3,3],[3,2],[6,5],[7,5],[7,6],[7,7],[6,6],[8,5],[9,5],[10,5],[10,6],[10,7]];
  for (var i = 0; i < PATH.length; i++) TMAP[PATH[i][1]][PATH[i][0]] = 4;
  // Bäume
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
    if (TMAP[r][c] === 0 && Math.random() < 0.06) {
      TREES.push({ col:c, row:r, h:24+Math.random()*18, type:Math.random()<.65?'pine':'round' });
      TREE_SET[c+','+r] = true;
    }
  }
  // Blumen
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
    if (TMAP[r][c] === 0 && !TREE_SET[c+','+r] && Math.random() < .05)
      FLOWERS.push({ col:c, row:r, t:['🌸','🌼','🌺'][Math.floor(Math.random()*3)] });
  }
}

function toIso(c, r) { return { x: oX + (c-r)*(TW/2), y: oY + (c+r)*(TH/2) }; }
function fromIso(px, py) {
  var rx = px-oX, ry = py-oY;
  return { col: Math.round((rx/(TW/2) + ry/(TH/2))/2), row: Math.round((ry/(TH/2) - rx/(TW/2))/2) };
}
function shade(hex, p) {
  var n = parseInt(hex.replace('#',''), 16);
  return 'rgb('+Math.min(255,Math.max(0,(n>>16)+p))+','+Math.min(255,Math.max(0,((n>>8)&255)+p))+','+Math.min(255,Math.max(0,(n&255)+p))+')';
}

// Kachel-Farben – werden bei Nacht abgedunkelt über Overlay
var TCOLS   = { 0:'#5a9e50',1:'#4e8e46',2:'#8b7040',3:'#4fc3f7',4:'#c8b07a',5:'#d4c48a' };
var TSTROKE = { 0:'rgba(255,255,255,0.12)',1:'rgba(0,0,0,0.08)',2:'rgba(0,0,0,0.15)',3:'rgba(255,255,255,0.3)',4:'rgba(0,0,0,0.08)',5:'rgba(255,255,255,0.2)' };

function drawTile(c, r) {
  var p = toIso(c, r), type = TMAP[r][c];
  var fill = TCOLS[type] || '#5a9e50';
  if (type === 3) {
    var w = Math.sin(waterAnim + c*.6 + r*.4) * 6;
    fill = 'hsl('+(198+w)+',65%,58%)';
  }
  ctx.beginPath();
  ctx.moveTo(p.x, p.y); ctx.lineTo(p.x+TW/2, p.y+TH/2);
  ctx.lineTo(p.x, p.y+TH); ctx.lineTo(p.x-TW/2, p.y+TH/2);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = TSTROKE[type]; ctx.lineWidth = 0.7; ctx.stroke();
  if (type === 3) {
    ctx.save(); ctx.globalAlpha = .25 + Math.sin(waterAnim+c+r)*.08;
    ctx.beginPath(); ctx.moveTo(p.x-9, p.y+TH/2-1); ctx.lineTo(p.x+9, p.y+TH/2-1);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
  }
}

function drawTree(t) {
  var p = toIso(t.col, t.row), x = p.x, y = p.y+TH/2, h = t.h;
  ctx.save(); ctx.globalAlpha = .15;
  ctx.beginPath(); ctx.ellipse(x, y+2, 16, 6, 0, 0, Math.PI*2);
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  if (t.type === 'pine') {
    ctx.fillStyle = '#7a5c3a';
    ctx.beginPath(); ctx.roundRect(x-3, y-h*.32, 6, h*.32, 2); ctx.fill();
    var layers = [{w:16,yo:0},{w:23,yo:h*.2},{w:30,yo:h*.38}];
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i], ty = y-h+l.yo;
      ctx.beginPath(); ctx.moveTo(x, ty-8); ctx.lineTo(x+l.w, ty+l.w*.5); ctx.lineTo(x-l.w, ty+l.w*.5); ctx.closePath();
      ctx.fillStyle = i===0?'#2a6828':i===1?'#368a32':'#42a83e'; ctx.fill();
    }
  } else {
    ctx.fillStyle = '#7a5c3a';
    ctx.beginPath(); ctx.roundRect(x-3, y-h*.38, 6, h*.38, 2); ctx.fill();
    var cr = h*.36, cy2 = y-h+cr;
    ctx.beginPath(); ctx.arc(x, cy2, cr, 0, Math.PI*2); ctx.fillStyle = '#358a30'; ctx.fill();
    ctx.beginPath(); ctx.arc(x-cr*.28, cy2-cr*.28, cr*.6, 0, Math.PI*2); ctx.fillStyle = '#42a83e'; ctx.fill();
  }
}

function drawBuilding(b) {
  var p  = toIso(b.col, b.row), x = p.x, y = p.y;
  var st = BSTYLE[b.type] || { wall:'#d4c890', roof:'#8b6020', accent:'#f0e0a0' };
  var bt = BUILDING_TYPES[b.type];
  var sel = (state.selectedBuilding === b.id);

  var sizes = {
    townhall:{W:66,H:54}, sawmill:{W:58,H:44}, quarry:{W:62,H:46}, farm:{W:70,H:42},
    kitchen:{W:56,H:48}, carpentry:{W:60,H:46}, brickyard:{W:60,H:46},
    bakery:{W:56,H:50}, well:{W:36,H:36}, warehouse:{W:68,H:50},
    smithy:{W:64,H:50}, casino:{W:74,H:60}
  };
  var sz = sizes[b.type] || {W:58,H:46};
  var W = sz.W, H = sz.H;
  var bx = x-W/2, by = y-H+TH/2;

  ctx.save(); ctx.globalAlpha = .2;
  ctx.beginPath(); ctx.ellipse(x, y+TH/2+2, W*.55, 12, 0, 0, Math.PI*2);
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();

  if (sel) {
    ctx.beginPath(); ctx.ellipse(x, y+TH/2+2, W*.62, 14, 0, 0, Math.PI*2);
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

  var grad = ctx.createLinearGradient(bx, by, bx+W, by+H);
  grad.addColorStop(0, shade(st.wall, 22)); grad.addColorStop(1, shade(st.wall, -15));
  ctx.beginPath(); ctx.roundRect(bx, by, W, H, 10);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = sel ? '#f0a500' : 'rgba(0,0,0,0.2)';
  ctx.lineWidth = sel ? 2.5 : 1.5; ctx.stroke();

  var roofH = b.type==='warehouse'?22:b.type==='townhall'?18:b.type==='smithy'?20:15;
  ctx.beginPath(); ctx.roundRect(bx-2, by-roofH, W+4, roofH+4, 8);
  ctx.fillStyle = st.roof; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(x, by-roofH, W/2+2, roofH+4, {upperLeft:0,upperRight:8,lowerRight:8,lowerLeft:0});
  ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fill();

  _drawWindows(b.type, bx, by, W, H, st);

  var doorW = b.type==='warehouse'?18:13;
  ctx.beginPath(); ctx.roundRect(x-doorW/2, by+H-20, doorW, 20, {upperLeft:doorW/2,upperRight:doorW/2,lowerLeft:0,lowerRight:0});
  ctx.fillStyle = shade(st.wall, -40); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(x+doorW/2-4, by+H-10, 2, 0, Math.PI*2);
  ctx.fillStyle = '#f0c040'; ctx.fill();

  _drawBuildingExtras(b, x, bx, by, W, H, st);
  _drawBuildingLabel(b, bt, x, by, H, W);
  _drawProgressBar(b, bx, by, W);

  // Level-2 Badge
  if (b.level >= 2) {
    ctx.save();
    ctx.beginPath(); ctx.arc(bx+W-2, by+4, 9, 0, Math.PI*2);
    ctx.fillStyle = '#f0a500'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = 'bold 8px Nunito,sans-serif';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('L2', bx+W-2, by+4);
    ctx.restore();
  }
}

function _drawCasino(x, bx, by, W, H, st, sel) {
  var grad = ctx.createLinearGradient(bx, by, bx+W, by+H);
  grad.addColorStop(0, '#2a1040'); grad.addColorStop(1, '#0a0018');
  ctx.beginPath(); ctx.roundRect(bx, by, W, H, 12);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = sel ? '#f0a500' : '#ffd700';
  ctx.lineWidth = sel ? 3 : 2; ctx.stroke();

  ctx.beginPath(); ctx.roundRect(bx-2, by-22, W+4, 24, 10);
  ctx.fillStyle = '#8b0020'; ctx.fill();
  ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.save();
  ctx.shadowColor = '#ff0080'; ctx.shadowBlur = 8;
  ctx.font = 'bold 11px Nunito,sans-serif';
  ctx.fillStyle = '#ff80ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CASINO', x, by + H/2 - 8);
  ctx.restore();

  var winColors = ['#ff0080','#ffff00','#00ffff','#ff8000'];
  for (var i = 0; i < 4; i++) {
    ctx.save(); ctx.shadowColor = winColors[i]; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.roundRect(bx+6+i*(W-12)/3.5, by+H-26, 10, 10, 3);
    ctx.fillStyle = winColors[i]; ctx.fill();
    ctx.restore();
  }

  ctx.beginPath(); ctx.roundRect(x-9, by+H-20, 18, 20, {upperLeft:9,upperRight:9,lowerLeft:0,lowerRight:0});
  ctx.fillStyle = '#3a0060'; ctx.fill();
  ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🎰', x, by + 12);

  ctx.save(); ctx.shadowBlur = 4;
  var sparkPos = [{x:-20,y:-8},{x:20,y:-5},{x:-16,y:H/2},{x:22,y:H/3}];
  for (var i = 0; i < sparkPos.length; i++) {
    var col = winColors[i % winColors.length];
    ctx.shadowColor = col;
    ctx.beginPath(); ctx.arc(x+sparkPos[i].x, by+sparkPos[i].y, 2, 0, Math.PI*2);
    ctx.fillStyle = col; ctx.fill();
  }
  ctx.restore();
}

function _drawWindows(type, bx, by, W, H, st) {
  var winY = by+H-26, winFill = 'rgba(255,252,180,0.88)';
  if (type === 'warehouse') {
    for (var i = 0; i < 3; i++) {
      var wx = bx+8+i*((W-16)/2.5);
      ctx.beginPath(); ctx.roundRect(wx, winY, 14, 10, 3);
      ctx.fillStyle = winFill; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.stroke();
    }
  } else if (type === 'townhall') {
    var positions = [bx+10, bx+W-22];
    for (var i = 0; i < positions.length; i++) {
      ctx.beginPath(); ctx.arc(positions[i]+6, winY+2, 6, Math.PI, 0);
      ctx.lineTo(positions[i]+12, winY+12); ctx.lineTo(positions[i], winY+12); ctx.closePath();
      ctx.fillStyle = winFill; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.stroke();
    }
  } else if (type === 'smithy') {
    var wPos = [bx+8, bx+W-20];
    for (var i = 0; i < wPos.length; i++) {
      ctx.beginPath(); ctx.roundRect(wPos[i], winY, 12, 12, 3);
      ctx.fillStyle = 'rgba(255,120,40,0.9)'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); ctx.shadowColor='#ff6020'; ctx.shadowBlur=6;
      ctx.beginPath(); ctx.roundRect(wPos[i]+2, winY+2, 8, 8, 2);
      ctx.fillStyle = 'rgba(255,180,50,0.8)'; ctx.fill(); ctx.restore();
    }
  } else {
    var wPos2 = [bx+8, bx+W-20];
    for (var i = 0; i < wPos2.length; i++) {
      ctx.beginPath(); ctx.roundRect(wPos2[i], winY, 12, 12, 3);
      ctx.fillStyle = winFill; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(wPos2[i]+6,winY); ctx.lineTo(wPos2[i]+6,winY+12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wPos2[i],winY+6); ctx.lineTo(wPos2[i]+12,winY+6); ctx.stroke();
    }
  }
}

function _drawBuildingExtras(b, x, bx, by, W, H, st) {
  if (b.type === 'townhall') {
    ctx.beginPath(); ctx.roundRect(x-8, by-34, 16, 18, 4);
    ctx.fillStyle = st.accent; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-10,by-34); ctx.lineTo(x,by-48); ctx.lineTo(x+10,by-34); ctx.closePath();
    ctx.fillStyle = st.roof; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x,by-48); ctx.lineTo(x,by-39); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,by-48); ctx.lineTo(x+10,by-44); ctx.lineTo(x,by-40); ctx.closePath();
    ctx.fillStyle = '#e05252'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, by-24, 5, 0, Math.PI*2);
    ctx.fillStyle = '#e8c040'; ctx.fill();
  } else if (b.type === 'smithy') {
    ctx.beginPath(); ctx.roundRect(bx+10, by-28, 14, 22, 3);
    ctx.fillStyle = shade(st.wall, -30); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.globalAlpha = .45;
    for (var i = 0; i < 4; i++) {
      var r = 5-i*.5;
      ctx.beginPath(); ctx.arc(bx+17, by-32-i*7, r, 0, Math.PI*2);
      ctx.fillStyle = i<2?'#ff6020':'#aaa'; ctx.fill();
    }
    ctx.restore();
    ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚒️', bx+W-14, by+12);
    ctx.save(); ctx.shadowColor='#ff8000'; ctx.shadowBlur=8;
    ctx.font = '10px serif';
    ctx.fillText('✨', bx+W-8, by-5);
    ctx.restore();
    for (var i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.roundRect(bx+W+3, by+H-28+i*9, 18, 7, 2);
      ctx.fillStyle = i%2===0?'#a0a0b0':'#c0c0d0'; ctx.fill();
      ctx.strokeStyle = '#808090'; ctx.lineWidth = 0.7; ctx.stroke();
    }
  } else if (b.type === 'sawmill') {
    for (var i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(bx-4, by+H-10-i*9, 10, 5, 0, 0, Math.PI*2);
      ctx.fillStyle = '#8b5c2a'; ctx.fill(); ctx.strokeStyle = '#5a3010'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.save(); ctx.translate(bx+W-10, by+8);
    ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2);
    ctx.fillStyle = '#d8d8d8'; ctx.fill(); ctx.strokeStyle = '#999'; ctx.lineWidth = .8; ctx.stroke();
    for (var i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate(i*Math.PI/4);
      ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(10,2); ctx.lineTo(10,-2); ctx.closePath();
      ctx.fillStyle = '#bbb'; ctx.fill(); ctx.restore();
    }
    ctx.restore();
  } else if (b.type === 'quarry') {
    var rocks = [{x:-18,y:8,r:8},{x:-10,y:14,r:6},{x:12,y:10,r:7},{x:20,y:6,r:5}];
    for (var i = 0; i < rocks.length; i++) {
      var rk = rocks[i];
      ctx.beginPath(); ctx.ellipse(bx+W/2+rk.x, by+H+rk.y, rk.r, rk.r*.6, 0, 0, Math.PI*2);
      ctx.fillStyle = '#a0a0b0'; ctx.fill(); ctx.strokeStyle = '#707080'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⛏', bx+W-12, by+10);
  } else if (b.type === 'farm') {
    var fc = ['#a8c860','#90b848','#b8d870'];
    for (var row = 0; row < 3; row++) for (var col = 0; col < 4; col++) {
      ctx.beginPath(); ctx.roundRect(bx-4+col*6, by+H+2+row*5, 5, 4, 1);
      ctx.fillStyle = fc[row%3]; ctx.fill();
    }
    ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('🌾', bx+8, by+H+2); ctx.fillText('🌾', bx+W-8, by+H+2);
  } else if (b.type === 'kitchen') {
    ctx.beginPath(); ctx.roundRect(bx+8, by-22, 10, 16, 2);
    ctx.fillStyle = shade(BSTYLE.kitchen.wall, -25); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.globalAlpha = .3;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(bx+13, by-26-i*7, 4-i, 0, Math.PI*2);
      ctx.fillStyle = '#ccc'; ctx.fill();
    }
    ctx.restore();
    ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🍲', bx+W-12, by+12);
  } else if (b.type === 'carpentry') {
    for (var i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.roundRect(bx+W+2, by+H-30+i*10, 14, 7, 2);
      ctx.fillStyle = '#c8a060'; ctx.fill(); ctx.strokeStyle = '#8b6020'; ctx.lineWidth = 0.7; ctx.stroke();
    }
    ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🪑', bx+14, by+12);
  } else if (b.type === 'brickyard') {
    var bc = ['#c85030','#d06040','#b84020'];
    for (var row = 0; row < 3; row++) for (var col = 0; col < 3; col++) {
      var off = row%2===0?0:7;
      ctx.beginPath(); ctx.roundRect(bx+W+3+col*15+off, by+H-20+row*7, 13, 6, 1);
      ctx.fillStyle = bc[col%3]; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.6; ctx.stroke();
    }
    ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔥', bx+W-12, by+12);
  } else if (b.type === 'bakery') {
    ctx.beginPath(); ctx.roundRect(bx+W-16, by-24, 10, 18, 2);
    ctx.fillStyle = shade(BSTYLE.bakery.wall, -20); ctx.fill();
    ctx.save(); ctx.globalAlpha = .35;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(bx+W-11, by-28-i*7, 5-i*.5, 0, Math.PI*2);
      ctx.fillStyle = '#ddd'; ctx.fill();
    }
    ctx.restore();
    ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🥖', bx+14, by+12);
  } else if (b.type === 'warehouse') {
    ctx.beginPath(); ctx.roundRect(x-14, by+H-24, 28, 24, 3);
    ctx.fillStyle = shade(BSTYLE.warehouse.wall, -30); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x-14, by+H-25); ctx.lineTo(x+14, by+H-25); ctx.stroke();
    ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('📦', x, by+14);
  }
}

function _drawWell(x, by, W, H, st, sel) {
  var cx = x, cy = by+H/2+5;
  ctx.beginPath(); ctx.ellipse(cx, cy+8, 16, 7, 0, 0, Math.PI*2);
  ctx.fillStyle = shade(st.wall, -10); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(cx-16, by+8, 32, H-12, 4);
  var wg = ctx.createLinearGradient(cx-16,0,cx+16,0);
  wg.addColorStop(0, shade(st.wall,15)); wg.addColorStop(1, shade(st.wall,-20));
  ctx.fillStyle = wg; ctx.fill();
  ctx.strokeStyle = sel?'#f0a500':'rgba(0,0,0,0.2)'; ctx.lineWidth = sel?2:1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, by+14, 10, 4, 0, 0, Math.PI*2);
  ctx.fillStyle = '#4fc3f7'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, by+2, 20, Math.PI, 0);
  ctx.strokeStyle = shade(st.roof,-10); ctx.lineWidth = 7; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, by+2, 20, Math.PI, 0);
  ctx.strokeStyle = st.roof; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = '#a08060'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, by+2); ctx.lineTo(cx, by+12); ctx.stroke();
}

function _drawBuildingLabel(b, bt, x, by, H, W) {
  ctx.font = 'bold 10px Nunito,sans-serif'; ctx.fillStyle = b.type==='casino'?'#ffd700':'#3a2a1a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(bt ? bt.name : b.type, x, by+H+4);
}

function _drawProgressBar(b, bx, by, W) {
  var workers = state.villagers.filter(function(v) { return v.buildingId === b.id; });
  if (!workers.length) return;
  var avg = 0;
  for (var i = 0; i < workers.length; i++) avg += workers[i].progress;
  avg /= workers.length;
  var bw = W-8, bxb = bx+4, byb = by-18;
  ctx.beginPath(); ctx.roundRect(bxb, byb, bw, 5, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(bxb, byb, bw*(avg/100), 5, 2);
  ctx.fillStyle = '#4aaa42'; ctx.fill();
  ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(workers.map(function(v){return v.emoji;}).join(''), bx+W/2, byb-2);
}

function drawVillager(v) {
  var p = toIso(v.x, v.y), px = p.x, py = p.y+TH/2-4;
  var spd = Math.sqrt(v.vx*v.vx + v.vy*v.vy);
  v.anim = (v.anim||0) + (spd>.005?.08:.015);
  var bob = spd>.005?Math.sin(v.anim*Math.PI*2)*2.5:Math.sin(v.anim*.5)*.5;
  var legSwing = spd>.005?Math.sin(v.anim*Math.PI*2)*6:0;
  var armSwing = spd>.005?Math.sin(v.anim*Math.PI*2)*5:Math.sin(v.anim*.3)*1;
  var baseY = py+bob;
  var sk=v.skin||'#f4c490', hr=v.hair||'#5a3010', sh=v.shirt||'#4a8adf', pn=v.pants||'#3a4a60';

  ctx.save(); ctx.globalAlpha = .15+spd*.05;
  ctx.beginPath(); ctx.ellipse(px, py+18, 9+spd*2, 4, 0, 0, Math.PI*2);
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();

  if (state.selectedVillager === v.id) {
    ctx.beginPath(); ctx.ellipse(px, py+18, 13, 5, 0, 0, Math.PI*2);
    ctx.strokeStyle = '#f0a500'; ctx.lineWidth = 2; ctx.stroke();
  }

  ctx.lineCap = 'round';
  ctx.strokeStyle = pn; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(px-1, baseY+10); ctx.lineTo(px-4+legSwing, baseY+20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+1, baseY+10); ctx.lineTo(px+4-legSwing, baseY+20); ctx.stroke();
  ctx.fillStyle = shade(pn, -40);
  ctx.beginPath(); ctx.ellipse(px-4+legSwing, baseY+20, 3.5, 2, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px+4-legSwing, baseY+20, 3.5, 2, 0, 0, Math.PI*2); ctx.fill();

  ctx.beginPath(); ctx.roundRect(px-7, baseY-8, 14, 18, 5);
  var bg = ctx.createLinearGradient(px-7, baseY-8, px+7, baseY+10);
  bg.addColorStop(0, shade(sh,18)); bg.addColorStop(1, shade(sh,-10));
  ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = shade(sh,-25); ctx.lineWidth = .8; ctx.stroke();

  ctx.strokeStyle = sh; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(px-7, baseY-3); ctx.lineTo(px-12, baseY-armSwing+5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+7, baseY-3); ctx.lineTo(px+12, baseY+armSwing+5); ctx.stroke();
  ctx.fillStyle = sk;
  ctx.beginPath(); ctx.arc(px-12, baseY-armSwing+5, 2.8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+12, baseY+armSwing+5, 2.8, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = sk;
  ctx.beginPath(); ctx.rect(px-2.5, baseY-13, 5, 5); ctx.fill();
  ctx.beginPath(); ctx.arc(px, baseY-18, 8.5, 0, Math.PI*2);
  ctx.fillStyle = sk; ctx.fill(); ctx.strokeStyle = shade(sk,-20); ctx.lineWidth = .8; ctx.stroke();
  ctx.beginPath(); ctx.arc(px, baseY-23, 7, Math.PI, 0, false); ctx.fillStyle = hr; ctx.fill();
  ctx.beginPath(); ctx.arc(px-7, baseY-18, 3, Math.PI*1.2, Math.PI*1.8, false); ctx.fillStyle = hr; ctx.fill();
  ctx.beginPath(); ctx.arc(px+7, baseY-18, 3, Math.PI*1.2, Math.PI*1.8, false); ctx.fillStyle = hr; ctx.fill();
  ctx.fillStyle = 'rgba(30,20,10,0.85)';
  ctx.beginPath(); ctx.ellipse(px-3, baseY-19, 1.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px+3, baseY-19, 1.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(px-2.3, baseY-19.8, .6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+3.7, baseY-19.8, .6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px, baseY-15.5, 2.5, .1, Math.PI-.1);
  ctx.strokeStyle = 'rgba(160,70,70,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();

  if (v.hunger <= 1) {
    ctx.beginPath(); ctx.arc(px+10, baseY-26, 5, 0, Math.PI*2);
    ctx.fillStyle = '#e05252'; ctx.fill();
    ctx.font = 'bold 7px Nunito,sans-serif'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', px+10, baseY-26);
  }
  ctx.font = 'bold 8px Nunito,sans-serif'; ctx.fillStyle = '#2a1a0a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(v.name, px, baseY-30);
}

function drawCloud(cx, cy, size, alpha) {
  ctx.save(); ctx.globalAlpha = (alpha !== undefined ? alpha : .55); ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, size*.4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+size*.35, cy+size*.08, size*.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx-size*.3, cy+size*.1, size*.28, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawStars() {
  var alpha = Math.max(0, getNightOverlayAlpha() * 1.5);
  if (alpha < 0.05) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, alpha);
  // Pseudo-zufällige, aber stabile Sterne
  var starPositions = [
    [0.05,0.02],[0.12,0.05],[0.22,0.01],[0.31,0.06],[0.44,0.02],[0.58,0.04],
    [0.67,0.01],[0.75,0.07],[0.85,0.03],[0.92,0.05],[0.08,0.09],[0.18,0.12],
    [0.35,0.08],[0.5,0.10],[0.62,0.12],[0.78,0.09],[0.88,0.11]
  ];
  ctx.fillStyle = '#fffde0';
  for (var i = 0; i < starPositions.length; i++) {
    var sx = starPositions[i][0] * canvas.width;
    var sy = starPositions[i][1] * canvas.height * 0.4;
    var r = 0.8 + (i % 3) * 0.4;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function draw() {
  waterAnim += .035;
  dayNightTick++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Hintergrund – Himmel mit Tages-/Nacht-Farben
  var skyC = getSkyColors();
  var sky = ctx.createLinearGradient(0, 0, 0, canvas.height*.45);
  sky.addColorStop(0, skyC[0]); sky.addColorStop(1, skyC[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height*.45);

  // Sterne bei Nacht
  drawStars();

  // Sonne oder Mond
  var f = getDayNightFactor();
  if (f > 0.4) {
    // Sonne
    var sunAlpha = Math.min(1, (f - 0.4) / 0.3);
    ctx.save(); ctx.globalAlpha = sunAlpha * 0.9;
    ctx.beginPath(); ctx.arc(canvas.width * 0.82, canvas.height * 0.08, 18, 0, Math.PI*2);
    ctx.fillStyle = '#ffe066'; ctx.fill();
    ctx.restore();
  } else {
    // Mond
    var moonAlpha = Math.min(1, (0.35 - f) / 0.2);
    if (moonAlpha > 0) {
      ctx.save(); ctx.globalAlpha = moonAlpha * 0.85;
      ctx.beginPath(); ctx.arc(canvas.width * 0.82, canvas.height * 0.08, 14, 0, Math.PI*2);
      ctx.fillStyle = '#fffde0'; ctx.fill();
      ctx.beginPath(); ctx.arc(canvas.width * 0.82 + 6, canvas.height * 0.08 - 2, 11, 0, Math.PI*2);
      ctx.fillStyle = skyC[0]; ctx.fill();
      ctx.restore();
    }
  }

  // Wolken
  var cloudAlpha = Math.max(0.15, Math.min(0.55, f * 0.6));
  drawCloud(canvas.width*.15, canvas.height*.07, 70, cloudAlpha);
  drawCloud(canvas.width*.5,  canvas.height*.04, 90, cloudAlpha);
  drawCloud(canvas.width*.82, canvas.height*.09, 60, cloudAlpha);

  // Boden
  var gC = getGroundColor();
  var grd = ctx.createLinearGradient(0, canvas.height*.4, 0, canvas.height);
  grd.addColorStop(0, gC[0]); grd.addColorStop(1, gC[1]);
  ctx.fillStyle = grd; ctx.fillRect(0, canvas.height*.4, canvas.width, canvas.height*.6);

  // Kacheln
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) drawTile(c, r);

  // Blumen
  for (var i = 0; i < FLOWERS.length; i++) {
    var fl = FLOWERS[i], bl = false;
    for (var j = 0; j < state.buildings.length; j++) {
      if (state.buildings[j].col===fl.col && state.buildings[j].row===fl.row) { bl=true; break; }
    }
    if (!bl && !TREE_SET[fl.col+','+fl.row]) {
      var fp = toIso(fl.col, fl.row);
      ctx.font = '10px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(fl.t, fp.x, fp.y+TH/2);
    }
  }

  // Gebäude + Bäume (nach Tiefe sortiert)
  var items = [];
  for (var i = 0; i < state.buildings.length; i++)
    items.push({ d: state.buildings[i].col+state.buildings[i].row, type:'b', data:state.buildings[i] });
  for (var i = 0; i < TREES.length; i++) {
    var bl = false;
    for (var j = 0; j < state.buildings.length; j++) {
      if (state.buildings[j].col===TREES[i].col && state.buildings[j].row===TREES[i].row) { bl=true; break; }
    }
    if (!bl) items.push({ d:TREES[i].col+TREES[i].row-.5, type:'t', data:TREES[i] });
  }
  items.sort(function(a,b) { return a.d-b.d; });
  for (var i = 0; i < items.length; i++) {
    if (items[i].type==='b') drawBuilding(items[i].data);
    else drawTree(items[i].data);
  }

  // Villager
  for (var i = 0; i < state.villagers.length; i++) drawVillager(state.villagers[i]);

  // Build-Mode Vorschau
  if (state.buildMode && state.hoverTile && BUILDING_TYPES[state.buildMode]) {
    var pp = toIso(state.hoverTile.col, state.hoverTile.row);
    ctx.save(); ctx.globalAlpha = .45;
    ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(BUILDING_TYPES[state.buildMode].emoji, pp.x, pp.y+TH/2+4);
    ctx.restore();
  }

  // Nacht-Overlay über allem
  var nightAlpha = getNightOverlayAlpha();
  if (nightAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = nightAlpha;
    ctx.fillStyle = '#0a082a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}
