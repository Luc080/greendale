// ============================================================
// DRAW.JS – v7.1
// Phase 7 komplett überarbeitet:
//  - Unified Canvas: Infinite Ground Plane
//  - Villager-Animationen mit korrekten Pivot-Gruppen
//  - Typ-spezifische Gebäude (Schmiede, Steinbruch, etc.)
//  - Nacht-Modus, Fenster-Glow, Mondlicht
// ============================================================

var renderer, scene, camera, clock;
var TMAP = [], TREES = [], TREE_SET = {}, FLOWERS = [];
var camTarget  = { x: 0, z: 0 };
var camZoom    = 1.0;
var MIN_ZOOM   = 0.4;
var MAX_ZOOM   = 2.5;
var CAM_ANGLE  = Math.PI / 4;
var camDrag = false;
var _lastMouseX = 0, _lastMouseY = 0;
var waterAnim = 0;
var buildingGroup, treeGroup, villagerGroup;
var sunLight, ambLight, hemiLight, moonLight;
var villagerMeshes = {};
var buildingMeshes = {};
var waterTiles = [];
var raycaster, mouse;
var TILE = 2.0;
var TSCALE = TILE;
var tileMeshes = {};
var selectionRing = null;
var _lastBuildingCount = -1;

// ---- TAGESZYKLUS ----
var DAY_PHASES = [
  { name:'🌅 Morgen', skyTop:'#f7c86a', skyBot:'#f0a840',
    sunColor:'#ffdd88', sunIntens:1.1,  ambIntens:0.55, moonIntens:0.00, sx:-1, sy:2,   sz:0.5 },
  { name:'🌤 Mittag', skyTop:'#87ceeb', skyBot:'#c8e8f8',
    sunColor:'#ffffff', sunIntens:1.4,  ambIntens:0.70, moonIntens:0.00, sx:0,  sy:3,   sz:0   },
  { name:'🌇 Abend',  skyTop:'#f0785a', skyBot:'#c05030',
    sunColor:'#ff9955', sunIntens:0.9,  ambIntens:0.40, moonIntens:0.00, sx:1,  sy:1.5, sz:0.5 },
  { name:'🌙 Nacht',  skyTop:'#1a2040', skyBot:'#0d1228',
    sunColor:'#6677cc', sunIntens:0.45, ambIntens:0.55, moonIntens:0.35, sx:0,  sy:2,   sz:-1  }
];

function getDayPhaseInfo() {
  var idx  = Math.floor(state.tick / DAY_PHASE_FRAMES) % DAY_PHASES.length;
  var next = (idx + 1) % DAY_PHASES.length;
  var t    = (state.tick % DAY_PHASE_FRAMES) / DAY_PHASE_FRAMES;
  return { cur: DAY_PHASES[idx], next: DAY_PHASES[next], t: Math.max(0, (t-0.8)/0.2), idx: idx };
}

function lerpHexColor(h1, h2, t) {
  var c1 = new THREE.Color(h1), c2 = new THREE.Color(h2);
  return new THREE.Color(c1.r+(c2.r-c1.r)*t, c1.g+(c2.g-c1.g)*t, c1.b+(c2.b-c1.b)*t);
}
function lN(a,b,t){ return a+(b-a)*t; }

// ---- SEEDED RNG ----
function seededRand(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- MATERIALIEN ----
function mLamb(hex, emHex) {
  return new THREE.MeshLambertMaterial({
    color:    new THREE.Color(hex),
    emissive: emHex ? new THREE.Color(emHex) : new THREE.Color(0x000000)
  });
}

var M = {
  grass:  mLamb('#5cb84e'), grass2: mLamb('#4ea044'), dirt:  mLamb('#9a7848'),
  water:  mLamb('#4ab8e8'), path:   mLamb('#c8b07a'), sand:  mLamb('#d4c48a'),
  trunk:  mLamb('#7a5c3a'), pine0:  mLamb('#2a6828'), pine1: mLamb('#368a32'), pine2: mLamb('#52a840'),
  leaf:   mLamb('#42a83e'), leafHi: mLamb('#7acc60'),
  window: mLamb('#d4eeff'), door:   mLamb('#6b3a1f'),
  barrel: mLamb('#8b5c2a'), stone:  mLamb('#a0a0b0'), cobble: mLamb('#8a8898'),
  chimney:mLamb('#8a6040'), blade:  mLamb('#c0c0c0'), darkStone: mLamb('#555566'),
  casinoNeon: new THREE.MeshLambertMaterial({ color:0xffd700, emissive:new THREE.Color(0x664400) }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
  sel: mLamb('#f0a500','#664400')
};

var BWALL = {
  townhall:'#e8d5a3', sawmill:'#c9956b',  quarry:'#7a7888',  farm:'#c8e6a0',
  kitchen:'#f5c87a',  carpentry:'#d4a870', brickyard:'#c8906a', bakery:'#f0d090',
  well:'#b8c8d8',     warehouse:'#d4b896', smithy:'#4a4840',   casino:'#1a0a2a'
};
var BROOF = {
  townhall:'#a05a20', sawmill:'#6b3a1f',  quarry:'#444455',  farm:'#6b8c20',
  kitchen:'#a05a20',  carpentry:'#5a3010', brickyard:'#7a3a20', bakery:'#a06020',
  well:'#607080',     warehouse:'#6b4a2a', smithy:'#2a2820',   casino:'#8b0020'
};

function getBM(type) {
  return { wall: mLamb(BWALL[type]||'#d4c890'), roof: mLamb(BROOF[type]||'#8b6020') };
}

// ---- TERRAIN ----
function generateMap() {
  var rng = seededRand(42);
  TMAP = []; TREES = []; TREE_SET = {}; FLOWERS = [];
  for (var r=0;r<ROWS;r++) { TMAP[r]=[];
    for (var c=0;c<COLS;c++) { var v=rng(); TMAP[r][c]=v>.88?1:v>.78?2:0; }
  }
  for (var r=ROWS-5;r<ROWS-1;r++) for (var c=COLS-6;c<COLS-1;c++) TMAP[r][c]=3;
  var PATH=[[5,5],[5,4],[5,3],[4,3],[3,3],[3,2],[6,5],[7,5],[7,6],[7,7],[6,6],[8,5],[9,5],[10,5],[10,6],[10,7]];
  for (var i=0;i<PATH.length;i++) TMAP[PATH[i][1]][PATH[i][0]]=4;
  for (var r=ROWS-6;r<ROWS;r++) for (var c=COLS-7;c<COLS;c++) if(TMAP[r][c]===0) TMAP[r][c]=5;
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++) {
    if (TMAP[r][c]===0 && rng()<0.06) { TREES.push({col:c,row:r,h:1.2+rng()*.8,type:rng()<.65?'pine':'round'}); TREE_SET[c+','+r]=true; }
  }
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++) {
    if (TMAP[r][c]===0 && !TREE_SET[c+','+r] && rng()<.05) FLOWERS.push({col:c,row:r,t:Math.floor(rng()*3)});
  }
}

function tileToWorld(col,row) { return {x:col*TSCALE, z:row*TSCALE}; }

// ---- SCENE ----
function buildScene() {
  // ==== UNIFIED CANVAS: Infinite Ground Plane ====
  // Eine einzige Three.js-Scene → alles bewegt sich synchron, kein CSS-Parallax
  // Die beige Ebene ist der "unendliche Boden" der Welt, das Tile-Grid ist die Insel
  var groundMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#b8a868') });
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.position.set(COLS*TSCALE/2, -0.12, ROWS*TSCALE/2);
  ground.receiveShadow = true;
  scene.add(ground);

  // Tile-Insel
  var tileColors = {0:M.grass,1:M.grass2,2:M.dirt,3:M.water,4:M.path,5:M.sand};
  var tileGeom = new THREE.BoxGeometry(TSCALE*0.995, 0.18, TSCALE*0.995);
  waterTiles = [];
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++) {
    var tp=TMAP[r][c];
    var tile=new THREE.Mesh(tileGeom, (tileColors[tp]||M.grass).clone());
    var wp=tileToWorld(c,r);
    tile.position.set(wp.x, tp===3?-0.06:0, wp.z);
    tile.receiveShadow=true; tile.userData={col:c,row:r,type:'tile'};
    scene.add(tile); tileMeshes[c+','+r]=tile;
    if (tp===3) waterTiles.push(tile);
  }
  // Blumen
  var flColors=[0xff88cc,0xffdd44,0xff5599];
  var flGeom=new THREE.CylinderGeometry(0.05,0.05,0.15,6);
  var rng2=seededRand(77);
  for (var i=0;i<FLOWERS.length;i++) {
    var fl=FLOWERS[i];
    var fp=tileToWorld(fl.col,fl.row);
    var fm=new THREE.Mesh(flGeom,mLamb('#'+flColors[fl.t].toString(16).padStart(6,'0')));
    fm.position.set(fp.x+(rng2()-.5)*.5, 0.17, fp.z+(rng2()-.5)*.5);
    scene.add(fm);
  }
  treeGroup=new THREE.Group(); scene.add(treeGroup);
  for (var i=0;i<TREES.length;i++) treeGroup.add(makeTree3D(TREES[i]));
  buildingGroup=new THREE.Group(); scene.add(buildingGroup);
  rebuildAllBuildings();
  villagerGroup=new THREE.Group(); scene.add(villagerGroup);
}

// ---- BAUM ----
function makeTree3D(t) {
  var g=new THREE.Group(), wp=tileToWorld(t.col,t.row);
  var h=t.h, trH=h*0.38;
  var trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.12,trH,7),M.trunk.clone());
  trunk.position.set(0,trH/2,0); trunk.castShadow=true; g.add(trunk);
  if (t.type==='pine') {
    [{r:.52,y:0,m:M.pine0},{r:.40,y:h*.22,m:M.pine1},{r:.28,y:h*.42,m:M.pine2}].forEach(function(l){
      var c=new THREE.Mesh(new THREE.ConeGeometry(l.r,h*.40,7),l.m.clone());
      c.position.set(0,trH+l.y+h*.20,0); c.castShadow=true; g.add(c);
    });
  } else {
    var crown=new THREE.Mesh(new THREE.SphereGeometry(h*.36,8,7),M.leaf.clone());
    crown.position.set(0,trH+h*.33,0); crown.scale.set(1,.88,1); crown.castShadow=true; g.add(crown);
    var hi=new THREE.Mesh(new THREE.SphereGeometry(h*.20,6,5),M.leafHi.clone());
    hi.position.set(-h*.10,trH+h*.45,-h*.10); g.add(hi);
  }
  g.position.set(wp.x,0,wp.z); return g;
}

// ---- GEBÄUDE ----
function rebuildAllBuildings() {
  while(buildingGroup.children.length) buildingGroup.remove(buildingGroup.children[0]);
  buildingMeshes={};
  for (var i=0;i<state.buildings.length;i++) {
    var b=state.buildings[i], bg=makeBuilding3D(b);
    bg.userData.buildingId=b.id;
    buildingGroup.add(bg); buildingMeshes[b.id]=bg;
  }
  _lastBuildingCount=state.buildings.length;
}

var BSIZES = {
  townhall:{W:1.4,H:1.3,D:1.4},   sawmill:{W:1.2,H:1.0,D:1.2},  quarry:{W:1.3,H:1.0,D:1.3},
  farm:{W:1.5,H:0.9,D:1.5},       kitchen:{W:1.2,H:1.1,D:1.2},  carpentry:{W:1.3,H:1.0,D:1.3},
  brickyard:{W:1.3,H:1.0,D:1.3},  bakery:{W:1.2,H:1.1,D:1.2},   well:{W:0.7,H:0.9,D:0.7},
  warehouse:{W:1.5,H:1.1,D:1.4},  smithy:{W:1.4,H:1.1,D:1.4},   casino:{W:1.6,H:1.5,D:1.6}
};

function makeBuilding3D(b) {
  var g=new THREE.Group(), wp=tileToWorld(b.col,b.row);
  var ms=getBM(b.type), sz=BSIZES[b.type]||{W:1.2,H:1.0,D:1.2};
  if      (b.type==='well')   _makeWell3D(g,sz.W,sz.H,sz.D,ms);
  else if (b.type==='casino') _makeCasino3D(g,sz.W,sz.H,sz.D,ms);
  else if (b.type==='smithy') _makeSmithy3D(g,sz.W,sz.H,sz.D,ms);
  else if (b.type==='quarry') _makeQuarry3D(g,sz.W,sz.H,sz.D,ms);
  else                        _makeStdBuilding3D(g,sz.W,sz.H,sz.D,ms,b.type);
  g.position.set(wp.x,0,wp.z);
  return g;
}

// ---- FENSTER-MATERIAL (mit isWindow-Flag fürs Nacht-Glow) ----
function _winMesh(wG) {
  var mat = new THREE.MeshLambertMaterial({ color:new THREE.Color('#d4eeff'), emissive:new THREE.Color(0x000000) });
  var m = new THREE.Mesh(wG, mat);
  m.userData.isWindow = true;
  return m;
}

// ---- STANDARD GEBÄUDE – typ-spezifische Dächer ----
function _makeStdBuilding3D(g, W, H, D, ms, type) {
  var baseY = H/2 + 0.09;
  var topY  = H + 0.09;

  // Körper
  var body = new THREE.Mesh(new THREE.BoxGeometry(W,H,D), ms.wall.clone());
  body.position.set(0, baseY, 0); body.castShadow=true; body.receiveShadow=true; g.add(body);

  // Dach – exakt passend auf den Körper gebaut
  // Alle Maße relativ zu W/H/D damit Dach nie vom Haus wegfliegt
  var rH = H * 0.55; // Dachhöhe

  if (type==='townhall') {
    // Rathaus: steile Pyramide + Spitze
    var r=new THREE.Mesh(new THREE.ConeGeometry(W*0.72,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,topY+rH/2,0); r.castShadow=true; g.add(r);
    var spire=new THREE.Mesh(new THREE.ConeGeometry(0.10,H*0.4,5),ms.roof.clone());
    spire.position.set(0,topY+rH+H*0.2,0); g.add(spire);

  } else if (type==='bakery') {
    // Bäckerei: breites Pyramidendach
    var r=new THREE.Mesh(new THREE.ConeGeometry(W*0.76,rH*1.05,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,topY+rH*0.525,0); r.castShadow=true; g.add(r);
    // Schornstein
    _addChimney(g, W, H, D, true);

  } else if (type==='farm') {
    // Farm: Scheunendach – Sattel über der ganzen Breite
    // Dach besteht aus einem gestreckten 4-seitigen Kegel
    var r=new THREE.Mesh(new THREE.ConeGeometry(W*0.72,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.scale.set(1.0,1.0,D/W); r.position.set(0,topY+rH/2,0);
    r.castShadow=true; g.add(r);
    // Dachüberhang-Platte
    var ovr=new THREE.Mesh(new THREE.BoxGeometry(W*1.12,0.06,D*1.12),ms.roof.clone());
    ovr.position.set(0,topY+0.03,0); g.add(ovr);

  } else if (type==='warehouse') {
    // Lager: flaches Walmdach mit breitem Überhang
    var ovr=new THREE.Mesh(new THREE.BoxGeometry(W*1.15,0.10,D*1.15),ms.roof.clone());
    ovr.position.set(0,topY+0.05,0); ovr.castShadow=true; g.add(ovr);
    var r=new THREE.Mesh(new THREE.ConeGeometry(W*0.60,rH*0.65,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,topY+0.10+rH*0.325,0); g.add(r);

  } else if (type==='carpentry') {
    // Zimmerei: Hauptdach + kleiner Anbau
    var r=new THREE.Mesh(new THREE.ConeGeometry(W*0.70,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,topY+rH/2,0); r.castShadow=true; g.add(r);
    // Kleiner Anbau links
    var annexW=W*0.42, annexH=H*0.65, annexD=D*0.42;
    var annexBody=new THREE.Mesh(new THREE.BoxGeometry(annexW,annexH,annexD),ms.wall.clone());
    annexBody.position.set(-(W/2+annexW/2), annexH/2+0.09, 0); annexBody.castShadow=true; g.add(annexBody);
    var annexRoof=new THREE.Mesh(new THREE.ConeGeometry(annexW*0.72,annexH*0.5,4),ms.roof.clone());
    annexRoof.rotation.y=Math.PI/4; annexRoof.position.set(-(W/2+annexW/2), annexH+0.09+annexH*0.25,0); g.add(annexRoof);

  } else if (type==='brickyard') {
    // Ziegelei: flaches Pultdach (eine Seite höher)
    var rTop=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,0.08,D*1.1),ms.roof.clone());
    rTop.position.set(0,topY+0.04,0); rTop.castShadow=true; g.add(rTop);
    // Kleiner Dreieck-Giebel vorne
    var rFront=new THREE.Mesh(new THREE.ConeGeometry(W*0.55,rH*0.55,3),ms.roof.clone());
    rFront.rotation.y=Math.PI; rFront.position.set(0,topY+0.08+rH*0.275,D*0.3); g.add(rFront);
    // Schornstein
    _addChimney(g,W,H,D,false);

  } else if (type==='sawmill') {
    // Sägewerk: Zwei Scheddächer nebeneinander
    var sw=W*0.52;
    for (var si=-1;si<=1;si+=2) {
      var shedR=new THREE.Mesh(new THREE.ConeGeometry(sw*0.72,rH*0.85,3),ms.roof.clone());
      shedR.rotation.y=Math.PI/6; shedR.position.set(si*W*0.26,topY+rH*0.425,0);
      shedR.castShadow=true; g.add(shedR);
    }

  } else if (type==='kitchen') {
    // Küche: warmes Pyramidendach mit Überstand + Schornstein
    var ovr=new THREE.Mesh(new THREE.BoxGeometry(W*1.10,0.07,D*1.10),ms.roof.clone());
    ovr.position.set(0,topY+0.035,0); g.add(ovr);
    var r=new THREE.Mesh(new THREE.ConeGeometry(W*0.70,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,topY+0.07+rH/2,0); r.castShadow=true; g.add(r);
    _addChimney(g,W,H,D,false);

  } else {
    // Fallback
    var r=new THREE.Mesh(new THREE.ConeGeometry(W*0.72,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,topY+rH/2,0); r.castShadow=true; g.add(r);
  }

  // Fenster (isWindow für Nacht-Glow)
  var wF=new THREE.BoxGeometry(W*0.18,H*0.22,0.04);
  var wS=new THREE.BoxGeometry(0.04,H*0.22,D*0.18);
  var w1=_winMesh(wF); w1.position.set(-W*0.22, H*0.56+0.09, D/2+0.02); g.add(w1);
  var w2=_winMesh(new THREE.BoxGeometry(W*0.18,H*0.22,0.04));
      w2.position.set( W*0.22, H*0.56+0.09, D/2+0.02); g.add(w2);
  var w3=_winMesh(wS);  w3.position.set(W/2+0.02, H*0.56+0.09, 0); g.add(w3);

  // Tür
  var dr=new THREE.Mesh(new THREE.BoxGeometry(W*0.22,H*0.42,0.05),M.door.clone());
  dr.position.set(0, H*0.21+0.09, D/2+0.025); g.add(dr);

  // Details
  _addBuildingDetails(g,type,W,H,D);

  // Hitbox
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,H*1.6,D*1.1),M.hit.clone());
  hb.position.set(0,H/2+0.09,0); hb.userData.isHitBox=true; g.add(hb);
}

// Schornstein-Helper
function _addChimney(g,W,H,D,big) {
  var cW=big?W*0.14:W*0.11, cH=big?H*0.60:H*0.48;
  var ch=new THREE.Mesh(new THREE.BoxGeometry(cW,cH,cW),M.chimney.clone());
  ch.position.set(W*0.26, H+0.09+cH/2-0.05, -D*0.18); ch.castShadow=true; g.add(ch);
  var cap=new THREE.Mesh(new THREE.BoxGeometry(cW*1.5,0.07,cW*1.5),M.chimney.clone());
  cap.position.set(W*0.26, H+0.09+cH-0.05+0.035, -D*0.18); g.add(cap);
  var sm=new THREE.Mesh(new THREE.SphereGeometry(0.09,6,4),mLamb('#aaaaaa'));
  sm.material.transparent=true; sm.material.opacity=0.35;
  sm.position.set(W*0.26, H+0.09+cH+0.05, -D*0.18);
  sm.userData.isSmoke=true; g.add(sm);
}

// Gebäude-Details je Typ
function _addBuildingDetails(g,type,W,H,D) {
  if (type==='sawmill') {
    var bl=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.04,12),M.blade.clone());
    bl.rotation.z=Math.PI/2; bl.position.set(W/2+0.08,H*0.55+0.09,0);
    bl.userData.isBlade=true; g.add(bl);
  }
  if (type==='warehouse') {
    for (var bi=0;bi<3;bi++) {
      var bar=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.28,8),M.barrel.clone());
      bar.position.set(-W*0.35+bi*0.22, 0.23, D*0.52); g.add(bar);
    }
  }
  if (type==='farm') {
    var hay=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.35,8),mLamb('#e8c840'));
    hay.position.set(W*0.42,0.26,-D*0.35); g.add(hay);
    for (var fi=0;fi<3;fi++) {
      var fp=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.22,0.05),mLamb('#c8a070'));
      fp.position.set(-W*0.5+fi*W*0.28, 0.11, D*0.52); g.add(fp);
    }
  }
  if (type==='bakery') {
    var sack=new THREE.Mesh(new THREE.SphereGeometry(0.12,7,5),mLamb('#e8e0c8'));
    sack.scale.set(1,0.75,1); sack.position.set(W*0.42,0.17,D*0.52); g.add(sack);
  }
  if (type==='carpentry') {
    for (var li=0;li<3;li++) {
      var log=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.38,7),M.trunk.clone());
      log.rotation.z=Math.PI/2; log.position.set(-W*0.3+li*0.16, 0.09+li*0.06, D*0.52); g.add(log);
    }
  }
  if (type==='brickyard') {
    for (var bri=0;bri<4;bri++) {
      var bk=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.07,0.09),mLamb('#c06040'));
      bk.position.set(-W*0.28+bri*0.16, 0.09, D*0.52); g.add(bk);
    }
  }
}

// ---- SCHMIEDE (Minecraft-Style) ----
function _makeSmithy3D(g,W,H,D,ms) {
  // Hauptgebäude aus dunklem Stein/Kopfsteinpflaster
  var body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),ms.wall.clone());
  body.position.set(0,H/2+0.09,0); body.castShadow=true; body.receiveShadow=true; g.add(body);

  // Flaches Dach mit starkem Überhang (Minecraft-Schmiede hat fast kein Dach)
  var roofPlate=new THREE.Mesh(new THREE.BoxGeometry(W*1.20,0.14,D*1.20),ms.roof.clone());
  roofPlate.position.set(0,H+0.09+0.07,0); roofPlate.castShadow=true; g.add(roofPlate);
  // Kleines Mitteldach
  var rH=H*0.22;
  var midRoof=new THREE.Mesh(new THREE.ConeGeometry(W*0.50,rH,4),ms.roof.clone());
  midRoof.rotation.y=Math.PI/4; midRoof.position.set(0,H+0.09+0.14+rH/2,0); g.add(midRoof);

  // Cobblestone-Fundament
  var found=new THREE.Mesh(new THREE.BoxGeometry(W*1.05,0.14,D*1.05),M.cobble.clone());
  found.position.set(0,0.07,0); found.receiveShadow=true; g.add(found);

  // Schornstein (dicker, wie Minecraft)
  var cW=W*0.22, cH=H*0.85;
  var ch=new THREE.Mesh(new THREE.BoxGeometry(cW,cH,cW),M.darkStone.clone());
  ch.position.set(W*0.25,H+0.09+cH/2-0.1,-D*0.20); ch.castShadow=true; g.add(ch);
  var cap=new THREE.Mesh(new THREE.BoxGeometry(cW*1.6,0.09,cW*1.6),M.darkStone.clone());
  cap.position.set(W*0.25,H+0.09+cH-0.1+0.045,-D*0.20); g.add(cap);
  var sm=new THREE.Mesh(new THREE.SphereGeometry(0.11,6,4),mLamb('#999999'));
  sm.material.transparent=true; sm.material.opacity=0.40;
  sm.position.set(W*0.25,H+0.09+cH+0.08,-D*0.20);
  sm.userData.isSmoke=true; g.add(sm);

  // Amboss draußen (Minecraft-typisch)
  var anvBase=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.10,0.22),M.stone.clone());
  anvBase.position.set(-W*0.28,0.14,D*0.52); g.add(anvBase);
  var anvTop=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.09,0.16),M.stone.clone());
  anvTop.position.set(-W*0.28,0.235,D*0.52); g.add(anvTop);
  anvTop.userData.isAnvil=true;

  // Feuerstelle (glühende Box)
  var firePit=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.14,0.28),M.darkStone.clone());
  firePit.position.set(W*0.25,0.16,D*0.52); g.add(firePit);
  var fire=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.10,0.16),
    new THREE.MeshLambertMaterial({color:0xff6600,emissive:new THREE.Color(0x882200)}));
  fire.position.set(W*0.25,0.27,D*0.52); fire.userData.isFire=true; g.add(fire);

  // Fenster & Tür
  var wm=_winMesh(new THREE.BoxGeometry(W*0.18,H*0.22,0.04));
  wm.position.set(-W*0.22,H*0.56+0.09,D/2+0.02); g.add(wm);
  var dr=new THREE.Mesh(new THREE.BoxGeometry(W*0.24,H*0.44,0.06),M.door.clone());
  dr.position.set(W*0.22,H*0.22+0.09,D/2+0.03); g.add(dr);

  // Hitbox
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,H*1.6,D*1.1),M.hit.clone());
  hb.position.set(0,H/2+0.09,0); hb.userData.isHitBox=true; g.add(hb);
}

// ---- STEINBRUCH (Höhleneingang) ----
function _makeQuarry3D(g,W,H,D,ms) {
  // Felsiger Boden/Fundament
  var base=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,0.22,D*1.1),M.stone.clone());
  base.position.set(0,0.11,0); base.receiveShadow=true; g.add(base);

  // Felswand links
  var wallL=new THREE.Mesh(new THREE.BoxGeometry(W*0.35,H*0.95,D),M.cobble.clone());
  wallL.position.set(-W*0.33,H*0.475+0.22,0); wallL.castShadow=true; g.add(wallL);
  // Felswand rechts (etwas kleiner, unregelmäßig)
  var wallR=new THREE.Mesh(new THREE.BoxGeometry(W*0.28,H*0.80,D),M.stone.clone());
  wallR.position.set(W*0.36,H*0.40+0.22,0); wallR.castShadow=true; g.add(wallR);
  // Dachbalken / Überdachung
  var roof=new THREE.Mesh(new THREE.BoxGeometry(W*1.05,0.12,D),ms.roof.clone());
  roof.position.set(0,H+0.22,0); roof.castShadow=true; g.add(roof);
  // Kleine Steine vorne
  var s1=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.20,0.36),M.stone.clone());
  s1.position.set(-W*0.15,0.32,D*0.48); g.add(s1);
  var s2=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.28,0.22),M.cobble.clone());
  s2.position.set(W*0.25,0.36,D*0.44); g.add(s2);

  // Höhleneingang (dunkles Rechteck in der Mitte)
  var caveH=H*0.65, caveW=W*0.40;
  var caveBack=new THREE.Mesh(new THREE.BoxGeometry(caveW,caveH,0.08),
    new THREE.MeshLambertMaterial({color:0x111118}));
  caveBack.position.set(0, caveH/2+0.22, -D*0.49); g.add(caveBack);
  // Höhleneingang-Rahmen oben
  var caveTopL=new THREE.Mesh(new THREE.BoxGeometry(W*0.20,0.16,D),M.darkStone.clone());
  caveTopL.position.set(-W*0.20, caveH+0.22+0.08, 0); g.add(caveTopL);
  var caveTopR=new THREE.Mesh(new THREE.BoxGeometry(W*0.20,0.16,D),M.darkStone.clone());
  caveTopR.position.set(W*0.20, caveH+0.22+0.08, 0); g.add(caveTopR);

  // Minenlore vorne
  var lore=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.16,0.32),mLamb('#8a6030'));
  lore.position.set(-W*0.10,0.30,D*0.52); g.add(lore);
  var loreRad1=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.06,8),M.stone.clone());
  loreRad1.rotation.z=Math.PI/2; loreRad1.position.set(-W*0.22,0.22,D*0.52); g.add(loreRad1);
  var loreRad2=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.06,8),M.stone.clone());
  loreRad2.rotation.z=Math.PI/2; loreRad2.position.set(W*0.02,0.22,D*0.52); g.add(loreRad2);

  // Hitbox
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,H*1.4,D*1.1),M.hit.clone());
  hb.position.set(0,H*0.5,0); hb.userData.isHitBox=true; g.add(hb);
}

// ---- BRUNNEN ----
function _makeWell3D(g,W,H,D,ms) {
  var base=new THREE.Mesh(new THREE.CylinderGeometry(W*.5,W*.55,H*.35,10),ms.wall.clone());
  base.position.set(0,H*.175+.09,0); base.castShadow=true; g.add(base);
  var water=new THREE.Mesh(new THREE.CylinderGeometry(W*.32,W*.32,.04,10),mLamb('#38a8d8'));
  water.position.set(0,H*.36+.09,0); g.add(water);
  var pM=ms.roof.clone(), pG=new THREE.CylinderGeometry(.055,.055,H*.75,6);
  var p1=new THREE.Mesh(pG,pM); p1.position.set(-W*.3,H*.52+.09,0); g.add(p1);
  var p2=new THREE.Mesh(pG,pM.clone()); p2.position.set(W*.3,H*.52+.09,0); g.add(p2);
  var beam=new THREE.Mesh(new THREE.BoxGeometry(W*.7,H*.09,H*.09),pM.clone());
  beam.position.set(0,H*.93+.09,0); g.add(beam);
  var bkt=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.12,7),mLamb('#8b6040'));
  bkt.position.set(0,H*.72+.09,0); g.add(bkt);
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.2,H*1.1,D*1.2),M.hit.clone());
  hb.position.set(0,H*.5,0); hb.userData.isHitBox=true; g.add(hb);
}

// ---- CASINO (aufgewertet) ----
function _makeCasino3D(g,W,H,D,ms) {
  // Hauptbau
  var body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),ms.wall.clone());
  body.position.set(0,H/2+.09,0); body.castShadow=true; g.add(body);

  // Flaches Dach mit Zinnenkrone
  var roofBase=new THREE.Mesh(new THREE.BoxGeometry(W*1.08,H*0.10,D*1.08),ms.roof.clone());
  roofBase.position.set(0,H+0.09+H*0.05,0); g.add(roofBase);
  // 4 Zinnen-Türme an den Ecken
  for (var cx=-1;cx<=1;cx+=2) for (var cz=-1;cz<=1;cz+=2) {
    var turm=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,H*0.55,8),ms.roof.clone());
    turm.position.set(cx*(W*0.52+0.06), H+0.09+H*0.275, cz*(D*0.52+0.06));
    turm.castShadow=true; g.add(turm);
    var turmTop=new THREE.Mesh(new THREE.ConeGeometry(0.14,H*0.20,8),ms.roof.clone());
    turmTop.position.set(cx*(W*0.52+0.06), H+0.09+H*0.55+H*0.10, cz*(D*0.52+0.06)); g.add(turmTop);
  }
  // Mittlerer Turm
  var mTurm=new THREE.Mesh(new THREE.CylinderGeometry(W*0.18,W*0.22,H*0.70,8),ms.roof.clone());
  mTurm.position.set(0,H+0.09+H*0.35,0); mTurm.castShadow=true; g.add(mTurm);
  var mTop=new THREE.Mesh(new THREE.ConeGeometry(W*0.22,H*0.30,8),
    new THREE.MeshLambertMaterial({color:0xcc2020,emissive:new THREE.Color(0x440000)}));
  mTop.position.set(0,H+0.09+H*0.70+H*0.15,0); g.add(mTop);

  // Leuchtreklame
  var sign=new THREE.Mesh(new THREE.BoxGeometry(W*0.80,H*0.22,0.07),M.casinoNeon.clone());
  sign.position.set(0,H*0.75+.09,D/2+.035); sign.userData.isNeon=true; g.add(sign);

  // Goldene Bögen über dem Eingang
  for (var ai=-1;ai<=1;ai++) {
    var arch=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.04,6,10,Math.PI),
      new THREE.MeshLambertMaterial({color:0xffd700,emissive:new THREE.Color(0x443300)}));
    arch.rotation.x=Math.PI/2; arch.position.set(ai*0.22,H*0.38+0.09,D/2+0.04);
    arch.userData.isNeon=true; g.add(arch);
  }

  // Umlaufende Neon-Kugeln
  var nColors=[0xff2020,0x20e0ff,0xffdd00,0xff2020,0x20e0ff,0xffdd00];
  for (var ni=0;ni<6;ni++) {
    var ang=(ni/6)*Math.PI*2;
    var nM=new THREE.MeshLambertMaterial({color:nColors[ni],emissive:new THREE.Color(nColors[ni]).multiplyScalar(.5)});
    var nL=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),nM);
    nL.position.set(Math.cos(ang)*(W*0.55), H*0.88+.09, Math.sin(ang)*(D*0.55));
    nL.userData.isNeonLight=true; nL.userData.lightIdx=ni; g.add(nL);
  }

  // Fenster mit goldenen Rahmen
  for (var wi=-1;wi<=1;wi+=2) {
    var wfr=new THREE.Mesh(new THREE.BoxGeometry(W*0.16,H*0.26,0.06),
      new THREE.MeshLambertMaterial({color:0xffd700,emissive:new THREE.Color(0x332200)}));
    wfr.position.set(wi*W*0.30, H*0.56+.09, D/2+.025); g.add(wfr);
    var win=_winMesh(new THREE.BoxGeometry(W*0.12,H*0.20,0.04));
    win.position.set(wi*W*0.30, H*0.56+.09, D/2+.045); g.add(win);
  }

  // Säulen am Eingang
  for (var si=-1;si<=1;si+=2) {
    var col=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,H*0.88,8),
      new THREE.MeshLambertMaterial({color:0xf0e0b0}));
    col.position.set(si*W*0.38, H*0.44+0.09, D/2+0.10); col.castShadow=true; g.add(col);
  }

  // Tür
  var dr=new THREE.Mesh(new THREE.BoxGeometry(W*0.26,H*0.48,0.07),
    new THREE.MeshLambertMaterial({color:0xffd700,emissive:new THREE.Color(0x332200)}));
  dr.position.set(0,H*0.24+.09,D/2+.035); g.add(dr);

  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.3,H*2.0,D*1.3),M.hit.clone());
  hb.position.set(0,H/2+.09,0); hb.userData.isHitBox=true; g.add(hb);
}

// ---- SELECTION RING ----
function updateSelectionRing() {
  if (selectionRing) { scene.remove(selectionRing); selectionRing=null; }
  if (state.selectedBuilding===null) return;
  var bg=buildingMeshes[state.selectedBuilding]; if(!bg) return;
  var ring=new THREE.Mesh(new THREE.TorusGeometry(.90,.07,8,24),M.sel.clone());
  ring.rotation.x=Math.PI/2; ring.position.set(bg.position.x,.13,bg.position.z);
  scene.add(ring); selectionRing=ring;
}

// ---- VILLAGER ----
// Pivot-Gruppen für korrekte Rotationsachsen:
// Arme drehen um ihre Schulter (oben), Beine um die Hüfte (oben)
function makeVillager3D(v) {
  var g = new THREE.Group();
  var sk=mLamb(v.skin||'#f4c490'), hr=mLamb(v.hair||'#5a3010');
  var sh=mLamb(v.shirt||'#4a8adf'), pn=mLamb(v.pants||'#3a4a60');

  // Körper
  var body=new THREE.Mesh(new THREE.BoxGeometry(.28,.36,.20),sh.clone());
  body.position.set(0,.44,0); body.castShadow=true; g.add(body);

  // Kopf
  var head=new THREE.Mesh(new THREE.BoxGeometry(.26,.26,.24),sk.clone());
  head.position.set(0,.78,0); head.castShadow=true; g.add(head);
  var hair=new THREE.Mesh(new THREE.BoxGeometry(.27,.10,.25),hr.clone());
  hair.position.set(0,.94,-.02); g.add(hair);
  var hS=new THREE.BoxGeometry(.06,.16,.24);
  var hL=new THREE.Mesh(hS,hr.clone()); hL.position.set(-.155,.80,-.01); g.add(hL);
  var hR2=new THREE.Mesh(hS,hr.clone()); hR2.position.set(.155,.80,-.01); g.add(hR2);
  var eM=mLamb('#1a1008'), eG=new THREE.BoxGeometry(.05,.05,.04);
  var eL=new THREE.Mesh(eG,eM.clone()); eL.position.set(-.07,.80,.12); g.add(eL);
  var eR2=new THREE.Mesh(eG,eM.clone()); eR2.position.set(.07,.80,.12); g.add(eR2);

  // Beine mit Pivot-Gruppen (Drehpunkt = Hüfte oben)
  // pivotLegL ist die Gruppe die dreht; das Mesh hängt um -0.15 (halbe Länge) nach unten
  var pivotLegL = new THREE.Group();
  pivotLegL.position.set(-.08, 0.32, 0); // Hüfthöhe
  var meshLegL = new THREE.Mesh(new THREE.BoxGeometry(.10,.30,.11), pn.clone());
  meshLegL.position.set(0, -0.15, 0); // hängt nach unten
  pivotLegL.add(meshLegL); g.add(pivotLegL);

  var pivotLegR = new THREE.Group();
  pivotLegR.position.set(.08, 0.32, 0);
  var meshLegR = new THREE.Mesh(new THREE.BoxGeometry(.10,.30,.11), pn.clone());
  meshLegR.position.set(0, -0.15, 0);
  pivotLegR.add(meshLegR); g.add(pivotLegR);

  // Füße
  var fM=mLamb('#3a2510'), fG=new THREE.BoxGeometry(.11,.07,.14);
  var fL=new THREE.Mesh(fG,fM.clone()); fL.position.set(-.08,.035,.02); g.add(fL);
  var fR=new THREE.Mesh(fG,fM.clone()); fR.position.set(.08,.035,.02); g.add(fR);

  // Arme mit Pivot-Gruppen (Drehpunkt = Schulter oben)
  var pivotArmL = new THREE.Group();
  pivotArmL.position.set(-.19, 0.60, 0); // Schulter
  var meshArmL = new THREE.Mesh(new THREE.BoxGeometry(.09,.28,.09), sh.clone());
  meshArmL.position.set(0, -0.14, 0);
  pivotArmL.add(meshArmL); g.add(pivotArmL);

  var pivotArmR = new THREE.Group();
  pivotArmR.position.set(.19, 0.60, 0);
  var meshArmR = new THREE.Mesh(new THREE.BoxGeometry(.09,.28,.09), sh.clone());
  meshArmR.position.set(0, -0.14, 0);
  pivotArmR.add(meshArmR); g.add(pivotArmR);

  // Hände
  var hndG=new THREE.SphereGeometry(.055,6,4);
  var hndL=new THREE.Mesh(hndG,sk.clone()); hndL.position.set(-.19,.29,0); g.add(hndL);
  var hndR=new THREE.Mesh(hndG,sk.clone()); hndR.position.set(.19,.29,0); g.add(hndR);

  // userData referenziert die Pivot-Gruppen (nicht die Meshes direkt)
  g.userData = {
    id:v.id,
    legL: pivotLegL, legR: pivotLegR,
    armL: pivotArmL, armR: pivotArmR,
    body: body, head: head,
    footL: fL, footR: fR, handL: hndL, handR: hndR
  };
  return g;
}

function syncVillagers() {
  for (var i=0;i<state.villagers.length;i++) {
    var v=state.villagers[i];
    if (!villagerMeshes[v.id]) {
      var vg=makeVillager3D(v); villagerGroup.add(vg); villagerMeshes[v.id]=vg;
    }
  }
  for (var id in villagerMeshes) {
    var found=false;
    for (var i=0;i<state.villagers.length;i++) if(state.villagers[i].id===parseInt(id)){found=true;break;}
    if (!found) { villagerGroup.remove(villagerMeshes[id]); delete villagerMeshes[id]; }
  }
}

function animateVillagers(dt) {
  for (var i=0;i<state.villagers.length;i++) {
    var v=state.villagers[i], vg=villagerMeshes[v.id];
    if (!vg) continue;

    // Position
    var wp=tileToWorld(v.x,v.y);
    vg.position.set(wp.x, 0, wp.z);

    var spd=Math.sqrt(v.vx*v.vx+v.vy*v.vy);
    v.anim=(v.anim||0)+(spd>0.005 ? 0.060 : 0.012);

    if (spd>0.005) vg.rotation.y=Math.atan2(v.vx,v.vy);

    var ud=vg.userData;
    var isWorking=(v.buildingId!==null)&&(spd<=0.005);

    if (spd>0.005) {
      // LAUFEN: Beine und Arme pendeln
      var sw=Math.sin(v.anim*Math.PI*2)*0.55;
      ud.legL.rotation.x =  sw;
      ud.legR.rotation.x = -sw;
      ud.armL.rotation.x = -sw*0.65;
      ud.armR.rotation.x =  sw*0.65;
      // Bob
      var bob=Math.abs(Math.sin(v.anim*Math.PI*2))*0.018;
      ud.body.position.y=0.44+bob;
      ud.head.position.y=0.78+bob;
      ud.body.rotation.x=0;
      ud.head.rotation.x=0;

    } else if (isWorking) {
      // ARBEITEN: rechter Arm schlägt sanft auf/ab (~1x pro Sekunde)
      var t=v.anim*Math.PI*1.2;
      var swing=Math.sin(t)*0.50;
      ud.armR.rotation.x = swing;          // Hauptschlag
      ud.armL.rotation.x =-swing*0.25;     // Gegenläufig leicht
      ud.legL.rotation.x = 0;
      ud.legR.rotation.x = 0;
      // Körper neigt sich leicht beim Schlag
      var lean=0.08+Math.max(0,Math.sin(t))*0.10;
      ud.body.rotation.x=lean;
      ud.head.rotation.x=lean*0.35;
      ud.body.position.y=0.44;
      ud.head.position.y=0.78;

    } else {
      // IDLE: sanftes Atmen
      var br=Math.sin(v.anim*0.55)*0.014;
      ud.armL.rotation.x= Math.sin(v.anim*0.55)*0.05;
      ud.armR.rotation.x=-Math.sin(v.anim*0.55)*0.05;
      ud.legL.rotation.x=0;
      ud.legR.rotation.x=0;
      ud.body.rotation.x=0;
      ud.head.rotation.x=0;
      ud.body.position.y=0.44+br;
      ud.head.position.y=0.78+br;
    }

    // Selektion-Highlight (Fenster ausgenommen)
    var isSel=state.selectedVillager===v.id;
    vg.traverse(function(o){
      if (o.isMesh&&o.material&&!o.userData.isWindow)
        o.material.emissive=isSel?new THREE.Color(0x443300):new THREE.Color(0x000000);
    });
  }
}

// ---- SYNC BUILDINGS ----
function syncBuildings() {
  if (state.buildings.length!==_lastBuildingCount) { rebuildAllBuildings(); updateSelectionRing(); }
  for (var bid in buildingMeshes) {
    var bg=buildingMeshes[bid], isSel=state.selectedBuilding===parseInt(bid);
    bg.traverse(function(o){
      if (o.isMesh&&o.material&&!o.userData.isHitBox&&!o.userData.isWindow)
        o.material.emissive=isSel?new THREE.Color(0x443300):new THREE.Color(0x000000);
    });
  }
}

// ---- WASSER ----
function animateWater(dt) {
  waterAnim+=dt*0.6;
  for (var i=0;i<waterTiles.length;i++) {
    var t=waterTiles[i];
    t.material.color.setHSL((198+Math.sin(waterAnim+i*.4)*4)/360,.65,.56);
    t.position.y=-0.05+Math.sin(waterAnim*.7+i*.3)*.012;
  }
}

// ---- GEBÄUDE-ANIMATION ----
function animateBuildings(dt) {
  for (var bid in buildingMeshes) {
    var bg=buildingMeshes[bid];
    var hw=state.villagers.some(function(v){return v.buildingId===parseInt(bid);});
    bg.traverse(function(o){
      if (o.userData.isBlade && hw)   o.rotation.x+=dt*3.5;
      if (o.userData.isSmoke) {
        var sc=0.7+Math.sin(waterAnim*1.5+parseInt(bid))*0.3;
        o.scale.setScalar(sc); o.material.opacity=0.22+Math.sin(waterAnim+parseInt(bid))*0.12;
      }
      if (o.userData.isFire) {
        o.material.emissive.setRGB(0.6+Math.sin(waterAnim*4)*0.3, 0.1, 0.0);
      }
      if (o.userData.isNeonLight) {
        var on=Math.sin(waterAnim*2+o.userData.lightIdx*1.1)>0;
        o.material.emissive.setScalar(on?0.7:0.08);
      }
      if (o.userData.isNeon) o.material.emissive.setScalar(0.3+Math.sin(waterAnim*1.5)*0.25);
    });
  }
}

// ---- TAGESLICHT & FENSTER-GLOW ----
function updateDayLight() {
  var dp=getDayPhaseInfo();
  var si=lN(dp.cur.sunIntens,dp.next.sunIntens,dp.t);
  var ai=lN(dp.cur.ambIntens,dp.next.ambIntens,dp.t);
  var mi=lN(dp.cur.moonIntens,dp.next.moonIntens,dp.t);
  if (sunLight) {
    sunLight.color.set(lerpHexColor(dp.cur.sunColor,dp.next.sunColor,dp.t));
    sunLight.intensity=si;
    sunLight.position.set(lN(dp.cur.sx,dp.next.sx,dp.t)*15,lN(dp.cur.sy,dp.next.sy,dp.t)*15,lN(dp.cur.sz,dp.next.sz,dp.t)*15);
  }
  if (ambLight)  ambLight.intensity=ai;
  if (moonLight) moonLight.intensity=mi;
  if (hemiLight) {
    hemiLight.intensity=ai*0.55;
    hemiLight.color=lerpHexColor(dp.cur.skyTop,dp.next.skyTop,dp.t);
    hemiLight.groundColor=lerpHexColor(dp.cur.skyBot,dp.next.skyBot,dp.t);
  }
  var sky=lerpHexColor(dp.cur.skyTop,dp.next.skyTop,dp.t);
  if (renderer) renderer.setClearColor(sky);
  if (scene.fog) scene.fog.color.set(sky);

  // Fenster-Glow nachts
  var nightT=(dp.idx===3)?1.0:(dp.idx===2?dp.t:0.0);
  for (var bid in buildingMeshes) {
    buildingMeshes[bid].traverse(function(o){
      if (o.isMesh&&o.userData.isWindow)
        o.material.emissive.setRGB(0.55*nightT, 0.42*nightT, 0.05*nightT);
    });
  }
  var el=document.getElementById('time-chip');
  if (el) el.textContent=DAY_PHASES[dp.idx].name+' · Tag '+state.day;
}

// ---- KAMERA ----
function setupCamera() {
  var wrap=document.getElementById('canvas-wrap');
  var W=wrap.clientWidth||window.innerWidth, H=wrap.clientHeight||window.innerHeight;
  var aspect=W/H, frustH=10;
  camera=new THREE.OrthographicCamera(-frustH*aspect,frustH*aspect,frustH,-frustH,.1,300);
  camTarget.x=COLS*TSCALE/2; camTarget.z=ROWS*TSCALE/2;
  var dist=25;
  camera.position.set(camTarget.x+dist,dist*.82,camTarget.z+dist);
  camera.lookAt(new THREE.Vector3(camTarget.x,0,camTarget.z));
  camera.zoom=camZoom; camera.updateProjectionMatrix();
}
function updateCameraTarget() {
  var dist=25;
  camera.position.set(camTarget.x+dist,dist*.82,camTarget.z+dist);
  camera.lookAt(new THREE.Vector3(camTarget.x,0,camTarget.z));
  camera.zoom=camZoom; camera.updateProjectionMatrix();
}

// ---- INIT ----
function initCanvas() {
  var wrap=document.getElementById('canvas-wrap');
  renderer=new THREE.WebGLRenderer({antialias:true,canvas:document.getElementById('gameCanvas')});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x87ceeb);
  var W=wrap.clientWidth||window.innerWidth, H=wrap.clientHeight||window.innerHeight;
  renderer.setSize(W,H);
  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x87ceeb,.016);
  clock=new THREE.Clock(); raycaster=new THREE.Raycaster(); mouse=new THREE.Vector2();
  ambLight=new THREE.AmbientLight(0xffffff,.5); scene.add(ambLight);
  hemiLight=new THREE.HemisphereLight(0x87ceeb,0x5a9e50,.4); scene.add(hemiLight);
  sunLight=new THREE.DirectionalLight(0xffffff,1.2);
  sunLight.position.set(15,22,10); sunLight.castShadow=true;
  sunLight.shadow.mapSize.width=sunLight.shadow.mapSize.height=1024;
  sunLight.shadow.camera.left=-30; sunLight.shadow.camera.right=30;
  sunLight.shadow.camera.top=30;   sunLight.shadow.camera.bottom=-30;
  sunLight.shadow.camera.far=80;   sunLight.shadow.bias=-.001;
  scene.add(sunLight);
  moonLight=new THREE.DirectionalLight(0x8899ee,0.0);
  moonLight.position.set(-12,18,6); scene.add(moonLight);
  setupCamera(); generateMap(); buildScene();
  window.addEventListener('resize',resizeCanvas);
  initCameraDrag();
}

function resizeCanvas() {
  var wrap=document.getElementById('canvas-wrap');
  var W=wrap.clientWidth||window.innerWidth, H=wrap.clientHeight||window.innerHeight;
  if (!W||!H) return;
  renderer.setSize(W,H);
  var aspect=W/H, frustH=10;
  camera.left=-frustH*aspect; camera.right=frustH*aspect;
  camera.top=frustH; camera.bottom=-frustH;
  camera.updateProjectionMatrix();
}

function initCameraDrag() {
  var wrap=document.getElementById('canvas-wrap');
  wrap.addEventListener('mousedown',function(e){
    if(state.buildMode) return;
    camDrag=true; _lastMouseX=e.clientX; _lastMouseY=e.clientY; wrap.style.cursor='grabbing';
  });
  window.addEventListener('mousemove',function(e){
    if(!camDrag) return;
    var dx=(e.clientX-_lastMouseX)*.04/camZoom, dy=(e.clientY-_lastMouseY)*.04/camZoom;
    camTarget.x-=dx*Math.cos(CAM_ANGLE)+dy*Math.sin(CAM_ANGLE);
    camTarget.z-=dy*Math.cos(CAM_ANGLE)-dx*Math.sin(CAM_ANGLE);
    _lastMouseX=e.clientX; _lastMouseY=e.clientY;
  });
  window.addEventListener('mouseup',function(){camDrag=false;wrap.style.cursor='default';});
  wrap.addEventListener('wheel',function(e){
    e.preventDefault();
    camZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,camZoom*(e.deltaY<0?1.1:.91)));
  },{passive:false});
  var _tx=0,_ty=0,_pd=null;
  wrap.addEventListener('touchstart',function(e){
    if(e.touches.length===1){camDrag=true;_tx=e.touches[0].clientX;_ty=e.touches[0].clientY;}
    else if(e.touches.length===2){camDrag=false;_pd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
  },{passive:true});
  wrap.addEventListener('touchmove',function(e){
    if(e.touches.length===1&&camDrag){
      var dx=(e.touches[0].clientX-_tx)*.04/camZoom,dy=(e.touches[0].clientY-_ty)*.04/camZoom;
      camTarget.x-=dx*Math.cos(CAM_ANGLE)+dy*Math.sin(CAM_ANGLE);
      camTarget.z-=dy*Math.cos(CAM_ANGLE)-dx*Math.sin(CAM_ANGLE);
      _tx=e.touches[0].clientX;_ty=e.touches[0].clientY;
    } else if(e.touches.length===2&&_pd){
      var nd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      camZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,camZoom*(nd/_pd)));_pd=nd;
    }
  },{passive:true});
  wrap.addEventListener('touchend',function(e){
    if(e.touches.length<1)camDrag=false; if(e.touches.length<2)_pd=null;
  });
}

function toIso(c,r) {
  var wp=tileToWorld(c,r), v3=new THREE.Vector3(wp.x,0,wp.z); v3.project(camera);
  var wrap=document.getElementById('canvas-wrap');
  return {x:(v3.x+1)/2*wrap.clientWidth, y:(-v3.y+1)/2*wrap.clientHeight};
}
function fromIso(sx,sy) {
  var wrap=document.getElementById('canvas-wrap'), rect=wrap.getBoundingClientRect();
  mouse.x=((sx-rect.left)/rect.width)*2-1; mouse.y=-((sy-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  var plane=new THREE.Plane(new THREE.Vector3(0,1,0),0), target=new THREE.Vector3();
  raycaster.ray.intersectPlane(plane,target);
  return {col:Math.round(target.x/TSCALE), row:Math.round(target.z/TSCALE)};
}
function getClickedBuilding(sx,sy) {
  var wrap=document.getElementById('canvas-wrap'), rect=wrap.getBoundingClientRect();
  mouse.x=((sx-rect.left)/rect.width)*2-1; mouse.y=-((sy-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  var objs=[]; buildingGroup.traverse(function(o){if(o.isMesh)objs.push(o);});
  var hits=raycaster.intersectObjects(objs,false);
  if (hits.length>0) {
    var o=hits[0].object, gr=o;
    while(gr.parent&&gr.parent!==buildingGroup) gr=gr.parent;
    if (gr.userData&&gr.userData.buildingId!==undefined)
      for (var i=0;i<state.buildings.length;i++)
        if(state.buildings[i].id===gr.userData.buildingId) return state.buildings[i];
  }
  return null;
}

function draw() {
  var dt=clock.getDelta();
  animateWater(dt); updateDayLight(); updateCameraTarget();
  syncVillagers(); animateVillagers(dt);
  syncBuildings(); animateBuildings(dt);
  if (state.buildMode&&state.hoverTile) {
    var key=state.hoverTile.col+','+state.hoverTile.row;
    for (var k in tileMeshes)
      tileMeshes[k].material.emissive=k===key?new THREE.Color(0x4a8c00):new THREE.Color(0x000000);
  }
  renderer.render(scene,camera);
}
