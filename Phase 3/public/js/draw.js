// ============================================================
// DRAW.JS – Alles was auf dem Canvas gezeichnet wird
// Abhängig von: data.js, state.js
// ============================================================

var canvas   = null;
var ctx      = null;
var oX = 0, oY = 0;
var waterAnim = 0;

// Karten-Tiles und Dekorationen (einmalig generiert)
var TMAP = [], TREES = [], TREE_SET = {}, FLOWERS = [];

function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx    = canvas.getContext('2d');
  generateMap();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  var wrap   = document.getElementById('canvas-wrap');
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  oX = canvas.width / 2 - TW / 2;
  oY = 55;
}

// ============================================================
// KARTE GENERIEREN
// ============================================================
function generateMap() {
  for (var r = 0; r < ROWS; r++) {
    TMAP[r] = [];
    for (var c = 0; c < COLS; c++) {
      var v = Math.random();
      TMAP[r][c] = v > .88 ? 1 : v > .78 ? 2 : 0;
    }
  }
  for (var r = 9; r < 12; r++) for (var c = 10; c < 14; c++) TMAP[r][c] = 3;
  var PATH = [[5,5],[5,4],[5,3],[4,3],[3,3],[3,2],[6,5],[7,5],[7,6],[7,7],[6,6]];
  for (var i = 0; i < PATH.length; i++) TMAP[PATH[i][1]][PATH[i][0]] = 4;
  for (var r = 8; r < 12; r++) for (var c = 9; c < 14; c++) if (TMAP[r][c] === 0) TMAP[r][c] = 5;

  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
    if (TMAP[r][c] === 0 && Math.random() < 0.055) {
      TREES.push({ col: c, row: r, h: 20 + Math.random()*14, type: Math.random() < .65 ? 'pine' : 'round' });
      TREE_SET[c+','+r] = true;
    }
  }
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
    if (TMAP[r][c] === 0 && !TREE_SET[c+','+r] && Math.random() < .05)
      FLOWERS.push({ col: c, row: r, t: ['🌸','🌼','🌺'][Math.floor(Math.random()*3)] });
  }
}

// ============================================================
// HILFS-FUNKTIONEN
// ============================================================
function toIso(c, r) { return { x: oX + (c-r)*(TW/2), y: oY + (c+r)*(TH/2) }; }
function fromIso(px, py) {
  var rx = px-oX, ry = py-oY;
  return { col: Math.round((rx/(TW/2)+ry/(TH/2))/2), row: Math.round((ry/(TH/2)-rx/(TW/2))/2) };
}
function shade(hex, p) {
  var n = parseInt(hex.replace('#',''), 16);
  return 'rgb('+Math.min(255,Math.max(0,(n>>16)+p))+','+Math.min(255,Math.max(0,((n>>8)&255)+p))+','+Math.min(255,Math.max(0,(n&255)+p))+')';
}

// ============================================================
// TILES
// ============================================================
var TCOLS   = { 0:'#5a9e50',1:'#4e8e46',2:'#8b7040',3:'#4fc3f7',4:'#c8b07a',5:'#d4c48a' };
var TSTROKE = { 0:'rgba(255,255,255,0.12)',1:'rgba(0,0,0,0.08)',2:'rgba(0,0,0,0.15)',3:'rgba(255,255,255,0.3)',4:'rgba(0,0,0,0.08)',5:'rgba(255,255,255,0.2)' };

function drawTile(c, r) {
  var p = toIso(c, r), type = TMAP[r][c];
  var fill = TCOLS[type] || '#5a9e50';
  if (type === 3) { var w = Math.sin(waterAnim+c*.6+r*.4)*6; fill = 'hsl('+(198+w)+',65%,58%)'; }
  ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+TW/2,p.y+TH/2); ctx.lineTo(p.x,p.y+TH); ctx.lineTo(p.x-TW/2,p.y+TH/2); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = TSTROKE[type]; ctx.lineWidth = 0.7; ctx.stroke();
  if (type === 3) {
    ctx.save(); ctx.globalAlpha = .25+Math.sin(waterAnim+c+r)*.08;
    ctx.beginPath(); ctx.moveTo(p.x-7,p.y+TH/2-1); ctx.lineTo(p.x+7,p.y+TH/2-1);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
}

// ============================================================
// BÄUME
// ============================================================
function drawTree(t) {
  var p = toIso(t.col, t.row), x = p.x, y = p.y+TH/2, h = t.h;
  ctx.save(); ctx.globalAlpha = .15;
  ctx.beginPath(); ctx.ellipse(x,y+2,14,5,0,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill(); ctx.restore();
  if (t.type === 'pine') {
    ctx.fillStyle='#7a5c3a'; ctx.beginPath(); ctx.roundRect(x-3,y-h*.32,6,h*.32,2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.roundRect(x,y-h*.32,3,h*.32,1); ctx.fill();
    var layers=[{w:14,yo:0},{w:20,yo:h*.2},{w:26,yo:h*.38}];
    for (var i=0;i<layers.length;i++) {
      var l=layers[i],ty=y-h+l.yo;
      ctx.beginPath(); ctx.moveTo(x,ty-7); ctx.lineTo(x+l.w,ty+l.w*.5); ctx.lineTo(x-l.w,ty+l.w*.5); ctx.closePath();
      ctx.fillStyle = i===0?'#2a6828':i===1?'#368a32':'#42a83e'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x,ty-7); ctx.lineTo(x+l.w,ty+l.w*.5); ctx.lineTo(x,ty+l.w*.5); ctx.closePath();
      ctx.fillStyle='rgba(0,0,0,0.1)'; ctx.fill();
    }
  } else {
    ctx.fillStyle='#7a5c3a'; ctx.beginPath(); ctx.roundRect(x-3,y-h*.38,6,h*.38,2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.roundRect(x,y-h*.38,3,h*.38,1); ctx.fill();
    var cr=h*.36,cy=y-h+cr;
    ctx.save(); ctx.globalAlpha=.15; ctx.beginPath(); ctx.arc(x+3,cy+3,cr,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(x,cy,cr,0,Math.PI*2); ctx.fillStyle='#358a30'; ctx.fill();
    ctx.beginPath(); ctx.arc(x-cr*.28,cy-cr*.28,cr*.6,0,Math.PI*2); ctx.fillStyle='#42a83e'; ctx.fill();
    ctx.save(); ctx.globalAlpha=.15; ctx.beginPath(); ctx.arc(x+cr*.22,cy+cr*.22,cr*.6,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill(); ctx.restore();
  }
}

// ============================================================
// GEBÄUDE
// ============================================================
function drawBuilding(b) {
  var p = toIso(b.col, b.row), x = p.x, y = p.y;
  var st = BSTYLE[b.type] || { wall:'#d4c890', roof:'#8b6020', accent:'#f0e0a0' };
  var bt = BUILDING_TYPES[b.type];
  var W=54,H=44,bx=x-W/2,by=y-H+TH/2;
  var sel = (state.selectedBuilding === b.id);

  ctx.save(); ctx.globalAlpha=.2;
  ctx.beginPath(); ctx.ellipse(x,y+TH/2+2,30,11,0,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill(); ctx.restore();

  if (sel) { ctx.beginPath(); ctx.ellipse(x,y+TH/2+2,35,14,0,0,Math.PI*2); ctx.strokeStyle='#f0a500'; ctx.lineWidth=2.5; ctx.stroke(); }

  var grad = ctx.createLinearGradient(bx,by,bx+W,by+H);
  grad.addColorStop(0,shade(st.wall,18)); grad.addColorStop(1,shade(st.wall,-12));
  ctx.beginPath(); ctx.roundRect(bx,by,W,H,10); ctx.fillStyle=grad; ctx.fill();
  ctx.strokeStyle=sel?'#f0a500':'rgba(0,0,0,0.22)'; ctx.lineWidth=sel?2.5:1.5; ctx.stroke();

  ctx.beginPath(); ctx.roundRect(bx-2,by-12,W+4,18,8); ctx.fillStyle=st.roof; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1.2; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(x,by-12,(W/2)+2,18,{upperLeft:0,upperRight:8,lowerRight:8,lowerLeft:0}); ctx.fillStyle='rgba(0,0,0,0.08)'; ctx.fill();

  // Fenster
  ctx.beginPath(); ctx.roundRect(bx+8,by+H-24,11,11,4); ctx.fillStyle='rgba(255,252,180,0.88)'; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(bx+W-19,by+H-24,11,11,4); ctx.fillStyle='rgba(255,252,180,0.88)'; ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(bx+13.5,by+H-24); ctx.lineTo(bx+13.5,by+H-13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx+8,by+H-18.5); ctx.lineTo(bx+19,by+H-18.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx+W-13.5,by+H-24); ctx.lineTo(bx+W-13.5,by+H-13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx+W-19,by+H-18.5); ctx.lineTo(bx+W-8,by+H-18.5); ctx.stroke();

  // Tür
  ctx.beginPath(); ctx.roundRect(x-6,by+H-18,12,18,{upperLeft:6,upperRight:6,lowerLeft:0,lowerRight:0});
  ctx.fillStyle=shade(st.wall,-35); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.arc(x+4,by+H-9,1.8,0,Math.PI*2); ctx.fillStyle='#f0c040'; ctx.fill();

  // Gebäude-spezifische Extras
  if (b.type==='townhall') {
    ctx.beginPath(); ctx.roundRect(x-7,by-26,14,16,4); ctx.fillStyle=st.accent; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-9,by-26); ctx.lineTo(x,by-40); ctx.lineTo(x+9,by-26); ctx.closePath(); ctx.fillStyle=st.roof; ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#888'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x,by-40); ctx.lineTo(x,by-32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,by-40); ctx.lineTo(x+8,by-37); ctx.lineTo(x,by-33); ctx.closePath(); ctx.fillStyle='#e05252'; ctx.fill();
  } else if (b.type==='kitchen'||b.type==='bakery') {
    var cx2 = b.type==='kitchen' ? x+12 : x-12;
    ctx.beginPath(); ctx.roundRect(cx2-4,by-26,9,18,2); ctx.fillStyle=shade(st.wall,-20); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1; ctx.stroke();
    ctx.save(); ctx.globalAlpha=.28;
    ctx.beginPath(); ctx.arc(cx2,by-30,5,0,Math.PI*2); ctx.fillStyle='#ccc'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx2-2,by-36,3.5,0,Math.PI*2); ctx.fill(); ctx.restore();
  } else if (b.type==='sawmill') {
    ctx.save(); ctx.translate(bx+W-10,by+6);
    ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fillStyle='#d0d0d0'; ctx.fill(); ctx.strokeStyle='#999'; ctx.lineWidth=.8; ctx.stroke();
    for (var i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3);ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(8,2);ctx.lineTo(8,-2);ctx.closePath();ctx.fillStyle='#aaa';ctx.fill();ctx.restore();}
    ctx.restore();
  } else if (b.type==='farm') {
    ctx.font='11px serif'; ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('🌾',bx+10,by+H+1); ctx.fillText('🌾',bx+W-10,by+H+1);
  } else if (b.type==='well') {
    ctx.beginPath(); ctx.arc(x,by-2,18,Math.PI,0); ctx.strokeStyle=shade(st.roof,-10); ctx.lineWidth=6; ctx.stroke();
    ctx.beginPath(); ctx.arc(x,by-2,18,Math.PI,0); ctx.strokeStyle=st.roof; ctx.lineWidth=4; ctx.stroke();
    ctx.strokeStyle='#aaa'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x,by-2); ctx.lineTo(x,by+8); ctx.stroke();
    ctx.beginPath(); ctx.arc(x,by+H/2-4,4,0,Math.PI*2); ctx.fillStyle='#4fc3f7'; ctx.fill();
  }

  ctx.font='18px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(bt?bt.emoji:'🏠', x, by+H/2-3);
  ctx.font='bold 9px Nunito,sans-serif'; ctx.fillStyle='#3a2a1a'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(bt?bt.name:b.type, x, by+H+3);

  // Fortschrittsbalken + Arbeiter
  var workers = state.villagers.filter(function(v){return v.buildingId===b.id;});
  if (workers.length > 0) {
    var avg=0; for (var i=0;i<workers.length;i++) avg+=workers[i].progress; avg/=workers.length;
    var bw=W-8,bxb=bx+4,byb=by-16;
    ctx.beginPath(); ctx.roundRect(bxb,byb,bw,4,2); ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fill();
    ctx.beginPath(); ctx.roundRect(bxb,byb,bw*(avg/100),4,2); ctx.fillStyle='#4aaa42'; ctx.fill();
    ctx.font='11px serif'; ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText(workers.map(function(v){return v.emoji;}).join(''), x, byb-2);
  }
}

// ============================================================
// VILLAGER
// ============================================================
function drawVillager(v) {
  var p = toIso(v.x, v.y), px = p.x, py = p.y+TH/2-4;
  var spd = Math.sqrt(v.vx*v.vx+v.vy*v.vy);
  v.anim = (v.anim||0) + (spd>.01?.12:.02);
  var bob     = spd>.01 ? Math.sin(v.anim*Math.PI*2)*2.5 : Math.sin(v.anim*.5)*.5;
  var legSwing= spd>.01 ? Math.sin(v.anim*Math.PI*2)*6 : 0;
  var armSwing= spd>.01 ? Math.sin(v.anim*Math.PI*2)*5 : Math.sin(v.anim*.3)*1;
  var baseY   = py + bob;
  var sk=v.skin||'#f4c490',hr=v.hair||'#5a3010',sh=v.shirt||'#4a8adf',pn=v.pants||'#3a4a60';

  ctx.save(); ctx.globalAlpha=.15+spd*.05;
  ctx.beginPath(); ctx.ellipse(px,py+18,9+spd*2,4,0,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill(); ctx.restore();

  if (state.selectedVillager===v.id) {
    ctx.beginPath(); ctx.ellipse(px,py+18,13,5,0,0,Math.PI*2); ctx.strokeStyle='#f0a500'; ctx.lineWidth=2; ctx.stroke();
  }

  ctx.lineCap='round';
  ctx.strokeStyle=pn; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(px-1,baseY+10); ctx.lineTo(px-4+legSwing,baseY+20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+1,baseY+10); ctx.lineTo(px+4-legSwing,baseY+20); ctx.stroke();
  ctx.fillStyle=shade(pn,-40);
  ctx.beginPath(); ctx.ellipse(px-4+legSwing,baseY+20,3.5,2,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px+4-legSwing,baseY+20,3.5,2,0,0,Math.PI*2); ctx.fill();

  ctx.beginPath(); ctx.roundRect(px-7,baseY-8,14,18,5);
  var bg=ctx.createLinearGradient(px-7,baseY-8,px+7,baseY+10);
  bg.addColorStop(0,shade(sh,18)); bg.addColorStop(1,shade(sh,-10));
  ctx.fillStyle=bg; ctx.fill(); ctx.strokeStyle=shade(sh,-25); ctx.lineWidth=.8; ctx.stroke();

  ctx.strokeStyle=sh; ctx.lineWidth=4.5;
  ctx.beginPath(); ctx.moveTo(px-7,baseY-3); ctx.lineTo(px-12,baseY-armSwing+5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+7,baseY-3); ctx.lineTo(px+12,baseY+armSwing+5); ctx.stroke();
  ctx.fillStyle=sk;
  ctx.beginPath(); ctx.arc(px-12,baseY-armSwing+5,2.8,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+12,baseY+armSwing+5,2.8,0,Math.PI*2); ctx.fill();

  ctx.fillStyle=sk; ctx.beginPath(); ctx.rect(px-2.5,baseY-13,5,5); ctx.fill();

  ctx.beginPath(); ctx.arc(px,baseY-18,8.5,0,Math.PI*2);
  ctx.fillStyle=sk; ctx.fill(); ctx.strokeStyle=shade(sk,-20); ctx.lineWidth=.8; ctx.stroke();

  ctx.beginPath(); ctx.arc(px,baseY-23,7,Math.PI,0,false); ctx.fillStyle=hr; ctx.fill();
  ctx.beginPath(); ctx.arc(px-7,baseY-18,3,Math.PI*1.2,Math.PI*1.8,false); ctx.fillStyle=hr; ctx.fill();
  ctx.beginPath(); ctx.arc(px+7,baseY-18,3,Math.PI*1.2,Math.PI*1.8,false); ctx.fillStyle=hr; ctx.fill();

  ctx.fillStyle='rgba(30,20,10,0.85)';
  ctx.beginPath(); ctx.ellipse(px-3,baseY-19,1.5,1.8,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px+3,baseY-19,1.5,1.8,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(px-2.3,baseY-19.8,.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+3.7,baseY-19.8,.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px,baseY-15.5,2.5,.1,Math.PI-.1);
  ctx.strokeStyle='rgba(160,70,70,0.8)'; ctx.lineWidth=1.2; ctx.stroke();

  if (v.hunger<=1) {
    ctx.beginPath(); ctx.arc(px+10,baseY-26,5,0,Math.PI*2); ctx.fillStyle='#e05252'; ctx.fill();
    ctx.font='bold 7px Nunito,sans-serif'; ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',px+10,baseY-26);
  }
  ctx.font='bold 8px Nunito,sans-serif'; ctx.fillStyle='#2a1a0a';
  ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(v.name, px, baseY-30);
}

// ============================================================
// WOLKEN
// ============================================================
function drawCloud(cx, cy, size) {
  ctx.save(); ctx.globalAlpha=.55; ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(cx,cy,size*.4,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+size*.35,cy+size*.08,size*.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx-size*.3,cy+size*.1,size*.28,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ============================================================
// HAUPT-DRAW FUNKTION
// ============================================================
function draw() {
  waterAnim += .035;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var sky = ctx.createLinearGradient(0,0,0,canvas.height*.42);
  sky.addColorStop(0,'#caeaf8'); sky.addColorStop(1,'#8ecef0');
  ctx.fillStyle=sky; ctx.fillRect(0,0,canvas.width,canvas.height*.42);
  drawCloud(canvas.width*.2,canvas.height*.08,60);
  drawCloud(canvas.width*.6,canvas.height*.05,80);
  drawCloud(canvas.width*.85,canvas.height*.1,50);

  var grd = ctx.createLinearGradient(0,canvas.height*.42,0,canvas.height);
  grd.addColorStop(0,'#c0dca0'); grd.addColorStop(1,'#5a9e50');
  ctx.fillStyle=grd; ctx.fillRect(0,canvas.height*.42,canvas.width,canvas.height*.58);

  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++) drawTile(c,r);

  for (var i=0;i<FLOWERS.length;i++) {
    var fl=FLOWERS[i],bl=false;
    for (var j=0;j<state.buildings.length;j++){if(state.buildings[j].col===fl.col&&state.buildings[j].row===fl.row){bl=true;break;}}
    if (!bl&&!TREE_SET[fl.col+','+fl.row]){var fp=toIso(fl.col,fl.row);ctx.font='9px serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(fl.t,fp.x,fp.y+TH/2);}
  }

  // Gebäude + Bäume nach Tiefe sortiert
  var items=[];
  for (var i=0;i<state.buildings.length;i++) items.push({d:state.buildings[i].col+state.buildings[i].row,type:'b',data:state.buildings[i]});
  for (var i=0;i<TREES.length;i++){
    var bl=false;for(var j=0;j<state.buildings.length;j++){if(state.buildings[j].col===TREES[i].col&&state.buildings[j].row===TREES[i].row){bl=true;break;}}
    if(!bl)items.push({d:TREES[i].col+TREES[i].row-.5,type:'t',data:TREES[i]});
  }
  items.sort(function(a,b){return a.d-b.d;});
  for (var i=0;i<items.length;i++){if(items[i].type==='b')drawBuilding(items[i].data);else drawTree(items[i].data);}

  for (var i=0;i<state.villagers.length;i++) drawVillager(state.villagers[i]);

  if (state.buildMode&&state.hoverTile&&BUILDING_TYPES[state.buildMode]){
    var pp=toIso(state.hoverTile.col,state.hoverTile.row);
    ctx.save();ctx.globalAlpha=.4;ctx.font='26px serif';ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText(BUILDING_TYPES[state.buildMode].emoji,pp.x,pp.y+TH/2+4);ctx.restore();
  }
}
