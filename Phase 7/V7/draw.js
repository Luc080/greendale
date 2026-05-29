// ============================================================
// DRAW.JS – v7.0 Phase 7: Grafik-Optimierung
//  - Unified Canvas: Infinite Ground Plane (kein CSS-Parallax)
//  - Typ-spezifische Haus-Varianten (Dachform je Gebäudetyp)
//  - Nacht-Modus: höheres Ambientlicht + Mondlicht
//  - Fenster leuchten nachts (isWindow emissive)
//  - Arbeits-Animation für beschäftigte Villager (sanft)
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

// Tageszyklus – Nacht deutlich heller als v6.5
var DAY_PHASES = [
  { name:'🌅 Morgen', skyTop:'#f7c86a', skyBot:'#f0a840',
    sunColor:'#ffdd88', sunIntens:1.1, ambIntens:0.55, moonIntens:0.0, sx:-1, sy:2, sz:0.5 },
  { name:'🌤 Mittag', skyTop:'#87ceeb', skyBot:'#c8e8f8',
    sunColor:'#ffffff', sunIntens:1.4, ambIntens:0.70, moonIntens:0.0, sx:0,  sy:3, sz:0 },
  { name:'🌇 Abend',  skyTop:'#f0785a', skyBot:'#c05030',
    sunColor:'#ff9955', sunIntens:0.9, ambIntens:0.40, moonIntens:0.0, sx:1,  sy:1.5, sz:0.5 },
  { name:'🌙 Nacht',  skyTop:'#1a2040', skyBot:'#0d1228',
    sunColor:'#6677cc', sunIntens:0.45, ambIntens:0.55, moonIntens:0.35, sx:0, sy:2, sz:-1 }
];

function getDayPhaseInfo() {
  var idx    = Math.floor(state.tick / DAY_PHASE_FRAMES) % DAY_PHASES.length;
  var next   = (idx + 1) % DAY_PHASES.length;
  var t      = (state.tick % DAY_PHASE_FRAMES) / DAY_PHASE_FRAMES;
  var smooth = Math.max(0, (t - 0.8) / 0.2);
  return { cur: DAY_PHASES[idx], next: DAY_PHASES[next], t: smooth, idx: idx };
}

function hexToColor(hex) {
  return new THREE.Color(hex);
}

function lerpHexColor(h1, h2, t) {
  var c1 = new THREE.Color(h1), c2 = new THREE.Color(h2);
  return new THREE.Color(
    c1.r + (c2.r-c1.r)*t, c1.g + (c2.g-c1.g)*t, c1.b + (c2.b-c1.b)*t
  );
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
    color: new THREE.Color(hex),
    emissive: emHex ? new THREE.Color(emHex) : new THREE.Color(0x000000)
  });
}

var M = {
  grass:  mLamb('#5cb84e'), grass2: mLamb('#4ea044'), dirt: mLamb('#9a7848'),
  water:  mLamb('#4ab8e8'), path:   mLamb('#c8b07a'), sand: mLamb('#d4c48a'),
  trunk:  mLamb('#7a5c3a'), pine0:  mLamb('#2a6828'), pine1: mLamb('#368a32'), pine2: mLamb('#52a840'),
  leaf:   mLamb('#42a83e'), leafHi: mLamb('#7acc60'),
  window: mLamb('#d4eeff'), door:   mLamb('#6b3a1f'),
  barrel: mLamb('#8b5c2a'), stone:  mLamb('#a0a0b0'),
  chimney:mLamb('#8a6040'), blade:  mLamb('#c0c0c0'),
  casinoNeon: new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: new THREE.Color(0x664400) }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
  sel: mLamb('#f0a500','#664400')
};

var BWALL = {
  townhall:'#e8d5a3', sawmill:'#c9956b', quarry:'#b8b8c8', farm:'#c8e6a0',
  kitchen:'#f5c87a', carpentry:'#d4a870', brickyard:'#c8906a', bakery:'#f0d090',
  well:'#b8c8d8', warehouse:'#d4b896', smithy:'#9a8878', casino:'#1a0a2a'
};
var BROOF = {
  townhall:'#a05a20', sawmill:'#6b3a1f', quarry:'#606878', farm:'#6b8c20',
  kitchen:'#a05a20', carpentry:'#5a3010', brickyard:'#7a3a20', bakery:'#a06020',
  well:'#607080', warehouse:'#6b4a2a', smithy:'#3a2a1a', casino:'#8b0020'
};

function getBM(type) {
  return {
    wall: mLamb(BWALL[type] || '#d4c890'),
    roof: mLamb(BROOF[type] || '#8b6020')
  };
}

// ---- TERRAIN ----
function generateMap() {
  var rng = seededRand(42);
  TMAP = []; TREES = []; TREE_SET = {}; FLOWERS = [];
  for (var r = 0; r < ROWS; r++) {
    TMAP[r] = [];
    for (var c = 0; c < COLS; c++) {
      var v = rng(); TMAP[r][c] = v>.88?1:v>.78?2:0;
    }
  }
  for (var r=ROWS-5;r<ROWS-1;r++) for (var c=COLS-6;c<COLS-1;c++) TMAP[r][c]=3;
  var PATH=[[5,5],[5,4],[5,3],[4,3],[3,3],[3,2],[6,5],[7,5],[7,6],[7,7],[6,6],[8,5],[9,5],[10,5],[10,6],[10,7]];
  for (var i=0;i<PATH.length;i++) TMAP[PATH[i][1]][PATH[i][0]]=4;
  for (var r=ROWS-6;r<ROWS;r++) for (var c=COLS-7;c<COLS;c++) if(TMAP[r][c]===0) TMAP[r][c]=5;
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++) {
    if (TMAP[r][c]===0 && rng()<0.06) {
      TREES.push({col:c,row:r,h:1.2+rng()*.8,type:rng()<.65?'pine':'round'});
      TREE_SET[c+','+r]=true;
    }
  }
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++) {
    if (TMAP[r][c]===0 && !TREE_SET[c+','+r] && rng()<.05)
      FLOWERS.push({col:c,row:r,t:Math.floor(rng()*3)});
  }
}

function tileToWorld(col, row) { return {x: col*TSCALE, z: row*TSCALE}; }

// ---- SCENE AUFBAUEN ----
function buildScene() {
  // ============================================================
  // UNIFIED CANVAS: Infinite Ground Plane
  // Liegt bei y=-0.10 – kein CSS-Hintergrund, kein Parallax.
  // Alles in einer Three.js-Scene = synchrone Bewegung garantiert.
  // ============================================================
  var groundMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#c8b87a') });
  var groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(COLS * TSCALE / 2, -0.10, ROWS * TSCALE / 2);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Tile-Insel (das grüne Spielfeld als angehobene Plattform)
  var tileColors = {0:M.grass,1:M.grass2,2:M.dirt,3:M.water,4:M.path,5:M.sand};
  var tileGeom = new THREE.BoxGeometry(TSCALE*0.995, 0.18, TSCALE*0.995);
  waterTiles = [];
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++) {
    var tp = TMAP[r][c];
    var tileMat = tileColors[tp] ? tileColors[tp].clone() : M.grass.clone();
    var tile = new THREE.Mesh(tileGeom, tileMat);
    var wp = tileToWorld(c,r);
    tile.position.set(wp.x, tp===3?-0.06:0, wp.z);
    tile.receiveShadow = true;
    tile.userData = {col:c, row:r, type:'tile'};
    scene.add(tile);
    tileMeshes[c+','+r] = tile;
    if (tp===3) waterTiles.push(tile);
  }
  // Blumen
  var flColors = [0xff88cc, 0xffdd44, 0xff5599];
  var flGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 6);
  var rng2 = seededRand(77);
  for (var i=0;i<FLOWERS.length;i++) {
    var fl=FLOWERS[i];
    var fMesh = new THREE.Mesh(flGeom, mLamb('#'+flColors[fl.t].toString(16).padStart(6,'0')));
    var fp=tileToWorld(fl.col,fl.row);
    fMesh.position.set(fp.x+(rng2()-.5)*.5, 0.17, fp.z+(rng2()-.5)*.5);
    scene.add(fMesh);
  }
  // Bäume
  treeGroup = new THREE.Group(); scene.add(treeGroup);
  for (var i=0;i<TREES.length;i++) {
    var tg=makeTree3D(TREES[i]); treeGroup.add(tg);
  }
  buildingGroup = new THREE.Group(); scene.add(buildingGroup);
  rebuildAllBuildings();
  villagerGroup = new THREE.Group(); scene.add(villagerGroup);
}

// ---- BAUM ----
function makeTree3D(t) {
  var g = new THREE.Group();
  var wp = tileToWorld(t.col, t.row);
  var h = t.h, trH = h*0.38;
  var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.12,trH,7), M.trunk.clone());
  trunk.position.set(0,trH/2,0); trunk.castShadow=true; g.add(trunk);
  if (t.type==='pine') {
    var layers=[{r:.52,y:0,m:M.pine0},{r:.40,y:h*.22,m:M.pine1},{r:.28,y:h*.42,m:M.pine2}];
    for (var li=0;li<layers.length;li++) {
      var l=layers[li];
      var cone=new THREE.Mesh(new THREE.ConeGeometry(l.r,h*.40,7),l.m.clone());
      cone.position.set(0,trH+l.y+h*.20,0); cone.castShadow=true; g.add(cone);
    }
  } else {
    var crown=new THREE.Mesh(new THREE.SphereGeometry(h*.36,8,7),M.leaf.clone());
    crown.position.set(0,trH+h*.33,0); crown.scale.set(1,.88,1); crown.castShadow=true; g.add(crown);
    var hi=new THREE.Mesh(new THREE.SphereGeometry(h*.20,6,5),M.leafHi.clone());
    hi.position.set(-h*.10,trH+h*.45,-h*.10); g.add(hi);
  }
  g.position.set(wp.x,0,wp.z);
  return g;
}

// ---- GEBÄUDE ----
function rebuildAllBuildings() {
  while(buildingGroup.children.length>0) buildingGroup.remove(buildingGroup.children[0]);
  buildingMeshes={};
  for (var i=0;i<state.buildings.length;i++) {
    var b=state.buildings[i];
    var bg=makeBuilding3D(b);
    bg.userData.buildingId=b.id;
    buildingGroup.add(bg);
    buildingMeshes[b.id]=bg;
  }
  _lastBuildingCount=state.buildings.length;
}

var BSIZES = {
  townhall:{W:1.4,H:1.3,D:1.4}, sawmill:{W:1.2,H:1.0,D:1.2}, quarry:{W:1.3,H:1.0,D:1.3},
  farm:{W:1.5,H:0.9,D:1.5}, kitchen:{W:1.2,H:1.1,D:1.2}, carpentry:{W:1.3,H:1.0,D:1.3},
  brickyard:{W:1.3,H:1.0,D:1.3}, bakery:{W:1.2,H:1.1,D:1.2}, well:{W:0.7,H:0.9,D:0.7},
  warehouse:{W:1.5,H:1.1,D:1.4}, smithy:{W:1.4,H:1.1,D:1.4}, casino:{W:1.6,H:1.5,D:1.6}
};

function makeBuilding3D(b) {
  var g=new THREE.Group(), wp=tileToWorld(b.col,b.row);
  var ms=getBM(b.type), sz=BSIZES[b.type]||{W:1.2,H:1.0,D:1.2};
  if (b.type==='well')        _makeWell3D(g,sz.W,sz.H,sz.D,ms);
  else if (b.type==='casino') _makeCasino3D(g,sz.W,sz.H,sz.D,ms);
  else                        _makeStdBuilding3D(g,sz.W,sz.H,sz.D,ms,b.type);
  g.position.set(wp.x,0,wp.z);
  return g;
}

// ---- STANDARD GEBÄUDE mit typ-spezifischen Dachformen ----
function _makeWinMat() {
  // Fenster-Material mit isWindow-Flag für Nacht-Glow
  var mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color('#d4eeff'),
    emissive: new THREE.Color(0x000000)
  });
  mat.userData = { isWindow: true };
  return mat;
}

function _makeStdBuilding3D(g, W, H, D, ms, type) {
  // --- Körper ---
  var body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), ms.wall.clone());
  body.position.set(0, H/2 + 0.09, 0);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // --- Dach je nach Gebäudetyp ---
  var roofH = H * 0.55;
  var roofMat = ms.roof.clone();

  if (type === 'townhall' || type === 'bakery') {
    // Rathaus / Bäckerei: Hohe steile Pyramide + Türmchen
    var roof = new THREE.Mesh(new THREE.ConeGeometry(W * 0.78, roofH * 1.15, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, H + 0.09 + roofH * 0.575, 0);
    roof.castShadow = true; g.add(roof);
    // Kleines Türmchen oben
    var spire = new THREE.Mesh(new THREE.ConeGeometry(W * 0.11, H * 0.5, 6), roofMat.clone());
    spire.position.set(0, H + 0.09 + roofH * 1.15 + H * 0.25, 0);
    spire.castShadow = true; g.add(spire);

  } else if (type === 'farm' || type === 'warehouse') {
    // Farm / Lager: Breites Satteldach (Scheunenstil)
    // Dachboden-Box als First
    var ridgeBox = new THREE.Mesh(new THREE.BoxGeometry(W * 1.1, roofH * 0.25, D * 1.1), roofMat);
    ridgeBox.position.set(0, H + 0.09 + roofH * 0.125, 0);
    g.add(ridgeBox);
    // Zwei seitliche Giebel-Prismen
    for (var side = -1; side <= 1; side += 2) {
      var gable = new THREE.Mesh(new THREE.ConeGeometry(D * 0.6, roofH * 1.0, 4), roofMat.clone());
      gable.rotation.y = Math.PI / 4;
      gable.position.set(side * W * 0.38, H + 0.09 + roofH * 0.5 + roofH * 0.125, 0);
      gable.castShadow = true; g.add(gable);
    }

  } else if (type === 'carpentry') {
    // Zimmerei: Asymmetrisches Pultdach (eine Seite höher)
    var mainRoof = new THREE.Mesh(new THREE.ConeGeometry(W * 0.72, roofH, 4), roofMat);
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.position.set(0, H + 0.09 + roofH / 2, 0);
    mainRoof.castShadow = true; g.add(mainRoof);
    // Kleiner Anbau
    var annex = new THREE.Mesh(new THREE.BoxGeometry(W * 0.45, H * 0.7, D * 0.45), ms.wall.clone());
    annex.position.set(-W * 0.58, H * 0.35 + 0.09, 0);
    annex.castShadow = true; g.add(annex);
    var annexRoof = new THREE.Mesh(new THREE.ConeGeometry(W * 0.38, roofH * 0.55, 4), roofMat.clone());
    annexRoof.rotation.y = Math.PI / 4;
    annexRoof.position.set(-W * 0.58, H * 0.7 + 0.09 + roofH * 0.275, 0);
    annexRoof.castShadow = true; g.add(annexRoof);

  } else if (type === 'smithy' || type === 'brickyard') {
    // Schmiede / Ziegelei: Schweres Walmdach mit dickem Überhang
    var flatTop = new THREE.Mesh(new THREE.BoxGeometry(W * 1.2, roofH * 0.2, D * 1.2), roofMat);
    flatTop.position.set(0, H + 0.09 + roofH * 0.1, 0);
    flatTop.castShadow = true; g.add(flatTop);
    var heavyPyra = new THREE.Mesh(new THREE.ConeGeometry(W * 0.62, roofH * 0.7, 4), roofMat.clone());
    heavyPyra.rotation.y = Math.PI / 4;
    heavyPyra.position.set(0, H + 0.09 + roofH * 0.2 + roofH * 0.35, 0);
    heavyPyra.castShadow = true; g.add(heavyPyra);

  } else if (type === 'quarry') {
    // Steinbruch: Flaches Pultdach, robuster Look
    var flatRoof = new THREE.Mesh(new THREE.BoxGeometry(W * 1.12, roofH * 0.18, D * 1.12), roofMat);
    flatRoof.position.set(0, H + 0.09 + roofH * 0.09, 0);
    flatRoof.castShadow = true; g.add(flatRoof);

  } else if (type === 'sawmill') {
    // Sägewerk: Zwei versetzt übereinander liegende Scheddächer
    for (var si = 0; si < 2; si++) {
      var shed = new THREE.Mesh(new THREE.ConeGeometry(W * 0.44, roofH * 0.8, 3), roofMat.clone());
      shed.rotation.y = Math.PI / 6;
      shed.position.set(-W * 0.24 + si * W * 0.48, H + 0.09 + roofH * 0.4, 0);
      shed.castShadow = true; g.add(shed);
    }

  } else if (type === 'kitchen') {
    // Küche: Breites Pyramidendach mit Überstand
    var kitRoof = new THREE.Mesh(new THREE.ConeGeometry(W * 0.88, roofH, 4), roofMat);
    kitRoof.rotation.y = Math.PI / 4;
    kitRoof.position.set(0, H + 0.09 + roofH / 2, 0);
    kitRoof.castShadow = true; g.add(kitRoof);

  } else {
    // Fallback: Standard-Pyramide
    var stdRoof = new THREE.Mesh(new THREE.ConeGeometry(W * 0.72, roofH, 4), roofMat);
    stdRoof.rotation.y = Math.PI / 4;
    stdRoof.position.set(0, H + 0.09 + roofH / 2, 0);
    stdRoof.castShadow = true; g.add(stdRoof);
  }

  // --- Fenster (isWindow = true → Nacht-Glow via updateDayLight) ---
  var wG  = new THREE.BoxGeometry(W * 0.18, H * 0.22, 0.04);
  var wGS = new THREE.BoxGeometry(0.04, H * 0.22, D * 0.18);

  var wm1 = _makeWinMat();
  var w1 = new THREE.Mesh(wG, wm1);
  w1.position.set(-W * 0.22, H * 0.56 + 0.09, D / 2 + 0.02);
  w1.userData.isWindow = true; g.add(w1);

  var wm2 = _makeWinMat();
  var w2 = new THREE.Mesh(wG, wm2);
  w2.position.set(W * 0.22, H * 0.56 + 0.09, D / 2 + 0.02);
  w2.userData.isWindow = true; g.add(w2);

  var wm3 = _makeWinMat();
  var w3 = new THREE.Mesh(wGS, wm3);
  w3.position.set(W / 2 + 0.02, H * 0.56 + 0.09, 0);
  w3.userData.isWindow = true; g.add(w3);

  // --- Tür ---
  var dr = new THREE.Mesh(new THREE.BoxGeometry(W * 0.22, H * 0.42, 0.05), M.door.clone());
  dr.position.set(0, H * 0.21 + 0.09, D / 2 + 0.025);
  g.add(dr);

  // --- Typ-spezifische Details ---
  _addDetails3D(g, type, W, H, D);

  // --- Hitbox ---
  var hb = new THREE.Mesh(new THREE.BoxGeometry(W * 1.1, H * 1.6, D * 1.1), M.hit.clone());
  hb.position.set(0, H / 2 + 0.09, 0);
  hb.userData.isHitBox = true;
  g.add(hb);
}

// ---- GEBÄUDE-DETAILS je Typ ----
function _addDetails3D(g, type, W, H, D) {
  // Schornstein (mehrere Gebäudetypen)
  if (type==='kitchen' || type==='bakery' || type==='smithy' || type==='brickyard' || type==='carpentry') {
    var chW = type==='smithy' ? W*0.16 : W*0.12;
    var chH = type==='smithy' ? H*0.65 : H*0.50;
    var ch = new THREE.Mesh(new THREE.BoxGeometry(chW, chH, chW), M.chimney.clone());
    ch.position.set(W*0.28, H + 0.09, -D*0.15);
    ch.castShadow = true; g.add(ch);
    // Schornstein-Kappe
    var cap = new THREE.Mesh(new THREE.BoxGeometry(chW*1.45, chH*0.09, chW*1.45), M.chimney.clone());
    cap.position.set(W*0.28, H + 0.09 + chH*0.545, -D*0.15);
    g.add(cap);
    // Rauch-Puff
    var sm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mLamb('#aaaaaa'));
    sm.material.transparent = true; sm.material.opacity = 0.35;
    sm.position.set(W*0.28, H + 0.09 + chH*0.60, -D*0.15);
    sm.userData.isSmoke = true; g.add(sm);
  }

  // Sägeblatt
  if (type === 'sawmill') {
    var bl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), M.blade.clone());
    bl.rotation.z = Math.PI / 2;
    bl.position.set(W/2 + 0.08, H*0.55 + 0.09, 0);
    bl.userData.isBlade = true; g.add(bl);
  }

  // Fässer (Lager)
  if (type === 'warehouse') {
    for (var bi = 0; bi < 3; bi++) {
      var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.28, 8), M.barrel.clone());
      bar.position.set(-W*0.35 + bi*0.22, 0.23, D*0.52); g.add(bar);
    }
    // Schild
    var sign = new THREE.Mesh(new THREE.BoxGeometry(W*0.35, H*0.18, 0.05), mLamb('#c8a060'));
    sign.position.set(0, H*0.78 + 0.09, D/2 + 0.03); g.add(sign);
  }

  // Steine (Steinbruch)
  if (type === 'quarry') {
    var st1 = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.16, 0.40), M.stone.clone());
    st1.position.set(0, 0.17, D*0.52); g.add(st1);
    var st2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), M.stone.clone());
    st2.position.set(0.28, 0.20, D*0.38); g.add(st2);
  }

  // Heu + Zaun (Farm)
  if (type === 'farm') {
    var hay = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.35, 8), mLamb('#e8c840'));
    hay.position.set(W*0.42, 0.26, -D*0.35); g.add(hay);
    for (var fi = 0; fi < 3; fi++) {
      var fp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), mLamb('#c8a070'));
      fp.position.set(-W*0.5 + fi*W*0.28, 0.11, D*0.52); g.add(fp);
    }
  }

  // Amboss (Schmiede)
  if (type === 'smithy') {
    var anv = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.18), M.stone.clone());
    anv.position.set(-W*0.3, 0.23, D*0.52); g.add(anv);
  }

  // Mehlsäcke (Bäckerei)
  if (type === 'bakery') {
    var sack = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), mLamb('#e8e0c8'));
    sack.scale.set(1, 0.75, 1);
    sack.position.set(W*0.42, 0.17, D*0.52); g.add(sack);
  }

  // Holzstapel (Zimmerei)
  if (type === 'carpentry') {
    for (var li = 0; li < 3; li++) {
      var log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 7), M.trunk.clone());
      log.rotation.z = Math.PI / 2;
      log.position.set(-W*0.3 + li*0.16, 0.09 + li*0.06, D*0.52); g.add(log);
    }
  }

  // Ziegelstapel (Ziegelei)
  if (type === 'brickyard') {
    for (var bri = 0; bri < 4; bri++) {
      var brick = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, 0.09), mLamb('#c06040'));
      brick.position.set(-W*0.28 + bri*0.16, 0.09, D*0.52); g.add(brick);
    }
  }
}

// ---- BRUNNEN ----
function _makeWell3D(g,W,H,D,ms) {
  var base=new THREE.Mesh(new THREE.CylinderGeometry(W*.5,W*.55,H*.35,10),ms.wall.clone());
  base.position.set(0,H*.175+.09,0); base.castShadow=true; g.add(base);
  var water=new THREE.Mesh(new THREE.CylinderGeometry(W*.32,W*.32,.04,10),mLamb('#38a8d8'));
  water.position.set(0,H*.36+.09,0); g.add(water);
  var pM=ms.roof.clone();
  var pG=new THREE.CylinderGeometry(.055,.055,H*.75,6);
  var p1=new THREE.Mesh(pG,pM); p1.position.set(-W*.3,H*.52+.09,0); g.add(p1);
  var p2=new THREE.Mesh(pG,pM.clone()); p2.position.set(W*.3,H*.52+.09,0); g.add(p2);
  var beam=new THREE.Mesh(new THREE.BoxGeometry(W*.7,H*.09,H*.09),pM.clone());
  beam.position.set(0,H*.93+.09,0); g.add(beam);
  var bkt=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.12,7),mLamb('#8b6040'));
  bkt.position.set(0,H*.72+.09,0); g.add(bkt);
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.2,H*1.1,D*1.2),M.hit.clone());
  hb.position.set(0,H*.5,0); hb.userData.isHitBox=true; g.add(hb);
}

// ---- CASINO ----
function _makeCasino3D(g,W,H,D,ms) {
  var body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),ms.wall.clone());
  body.position.set(0,H/2+.09,0); body.castShadow=true; g.add(body);
  var roof=new THREE.Mesh(new THREE.BoxGeometry(W*1.05,H*.08,D*1.05),ms.roof.clone());
  roof.position.set(0,H+.09,0); g.add(roof);
  var tower=new THREE.Mesh(new THREE.CylinderGeometry(W*.15,W*.2,H*.4,8),ms.roof.clone());
  tower.position.set(0,H*1.25+.09,0); g.add(tower);
  var sign=new THREE.Mesh(new THREE.BoxGeometry(W*.7,H*.2,.06),M.casinoNeon.clone());
  sign.position.set(0,H*.72+.09,D/2+.03); sign.userData.isNeon=true; g.add(sign);
  var nColors=[0xff2020,0x20e0ff,0xff2020,0x20e0ff,0xffdd00,0xff2020];
  for (var ni=0;ni<6;ni++) {
    var ang=(ni/6)*Math.PI*2;
    var nM=new THREE.MeshLambertMaterial({color:nColors[ni],emissive:new THREE.Color(nColors[ni]).multiplyScalar(.4)});
    var nL=new THREE.Mesh(new THREE.SphereGeometry(.06,6,4),nM);
    nL.position.set(Math.cos(ang)*W*.52,H*.92+.09,Math.sin(ang)*D*.52);
    nL.userData.isNeonLight=true; nL.userData.lightIdx=ni; g.add(nL);
  }
  var wM=new THREE.MeshLambertMaterial({color:0xffd700,emissive:new THREE.Color(0x443300)});
  for (var wi=-1;wi<=1;wi+=2) {
    var win=new THREE.Mesh(new THREE.BoxGeometry(W*.14,H*.22,.05),wM.clone());
    win.position.set(wi*W*.28,H*.52+.09,D/2+.025); g.add(win);
  }
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,H*1.6,D*1.1),M.hit.clone());
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
function makeVillager3D(v) {
  var g=new THREE.Group();
  var sk=mLamb(v.skin||'#f4c490'), hr=mLamb(v.hair||'#5a3010');
  var sh=mLamb(v.shirt||'#4a8adf'), pn=mLamb(v.pants||'#3a4a60');
  // Körper
  var body=new THREE.Mesh(new THREE.BoxGeometry(.28,.36,.20),sh);
  body.position.set(0,.44,0); body.castShadow=true; g.add(body);
  // Kopf
  var head=new THREE.Mesh(new THREE.BoxGeometry(.26,.26,.24),sk);
  head.position.set(0,.78,0); head.castShadow=true; g.add(head);
  // Haare
  var hair=new THREE.Mesh(new THREE.BoxGeometry(.27,.10,.25),hr);
  hair.position.set(0,.94,-.02); g.add(hair);
  var hS=new THREE.BoxGeometry(.06,.16,.24);
  var hL=new THREE.Mesh(hS,hr.clone()); hL.position.set(-.155,.80,-.01); g.add(hL);
  var hR2=new THREE.Mesh(hS,hr.clone()); hR2.position.set(.155,.80,-.01); g.add(hR2);
  // Augen
  var eM=mLamb('#1a1008');
  var eG=new THREE.BoxGeometry(.05,.05,.04);
  var eL=new THREE.Mesh(eG,eM); eL.position.set(-.07,.80,.12); g.add(eL);
  var eR=new THREE.Mesh(eG,eM.clone()); eR.position.set(.07,.80,.12); g.add(eR);
  // Beine
  var legG=new THREE.BoxGeometry(.10,.30,.11);
  var legL=new THREE.Mesh(legG,pn); legL.position.set(-.08,.17,0); g.add(legL);
  var legR=new THREE.Mesh(legG,pn.clone()); legR.position.set(.08,.17,0); g.add(legR);
  // Füße
  var fM=mLamb('#3a2510'), fG=new THREE.BoxGeometry(.11,.07,.14);
  var fL=new THREE.Mesh(fG,fM); fL.position.set(-.08,.035,.02); g.add(fL);
  var fR=new THREE.Mesh(fG,fM.clone()); fR.position.set(.08,.035,.02); g.add(fR);
  // Arme
  var aG=new THREE.BoxGeometry(.09,.28,.09);
  var aL=new THREE.Mesh(aG,sh.clone()); aL.position.set(-.19,.44,0); g.add(aL);
  var aR=new THREE.Mesh(aG,sh.clone()); aR.position.set(.19,.44,0); g.add(aR);
  // Hände
  var hndG=new THREE.SphereGeometry(.055,6,4);
  var hndL=new THREE.Mesh(hndG,sk.clone()); hndL.position.set(-.19,.29,0); g.add(hndL);
  var hndR=new THREE.Mesh(hndG,sk.clone()); hndR.position.set(.19,.29,0); g.add(hndR);
  g.userData={id:v.id,legL:legL,legR:legR,aL:aL,aR:aR,body:body,head:head};
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
    if(!found){villagerGroup.remove(villagerMeshes[id]);delete villagerMeshes[id];}
  }
}

// ---- VILLAGER ANIMATIONEN ----
function animateVillagers(dt) {
  for (var i = 0; i < state.villagers.length; i++) {
    var v = state.villagers[i];
    var vg = villagerMeshes[v.id];
    if (!vg) continue;

    var wp = tileToWorld(v.x, v.y);
    vg.position.set(wp.x, 0, wp.z);

    var spd = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
    // Animationsgeschwindigkeit: beim Laufen schneller, sonst langsam
    v.anim = (v.anim || 0) + (spd > 0.005 ? 0.055 : 0.010);

    if (spd > 0.005) {
      vg.rotation.y = Math.atan2(v.vx, v.vy);
    }

    var ud = vg.userData;
    var isWorking = (v.buildingId !== null) && (spd <= 0.005);

    if (spd > 0.005) {
      // --- Lauf-Animation ---
      var sw = Math.sin(v.anim * Math.PI * 2) * 0.35;
      if (ud.legL) ud.legL.rotation.x =  sw;
      if (ud.legR) ud.legR.rotation.x = -sw;
      if (ud.aL)   ud.aL.rotation.x   = -sw * 0.7;
      if (ud.aR)   ud.aR.rotation.x   =  sw * 0.7;
      var bob = Math.sin(v.anim * Math.PI * 2) * 0.022;
      if (ud.body) { ud.body.position.y = 0.44 + bob; ud.body.rotation.x = 0; }
      if (ud.head) { ud.head.position.y = 0.78 + bob; ud.head.rotation.x = 0; }

    } else if (isWorking) {
      // --- Arbeits-Animation (sanft, ~1 Hub/Sek) ---
      // Frequenz 1.3 = ca. 1 vollständiger Schlag pro Sekunde
      var wt = Math.sin(v.anim * Math.PI * 1.3);
      var armSwing = wt * 0.42;  // rechter Arm auf/ab
      if (ud.aR)   ud.aR.rotation.x   = armSwing;
      if (ud.aL)   ud.aL.rotation.x   = -armSwing * 0.30;  // linker Arm leicht gegenläufig
      if (ud.legL) ud.legL.rotation.x = 0;
      if (ud.legR) ud.legR.rotation.x = 0;
      // Leichtes Vorbeugen beim Arbeiten
      var lean = 0.10 + Math.max(0, wt) * 0.08;
      if (ud.body) { ud.body.rotation.x = lean; ud.body.position.y = 0.44; }
      if (ud.head) { ud.head.rotation.x = lean * 0.4; ud.head.position.y = 0.78; }

    } else {
      // --- Idle: sanftes Atmen ---
      var breathe = Math.sin(v.anim * 0.5) * 0.016;
      if (ud.aL)   ud.aL.rotation.x   =  Math.sin(v.anim * 0.5) * 0.04;
      if (ud.aR)   ud.aR.rotation.x   = -Math.sin(v.anim * 0.5) * 0.04;
      if (ud.legL) ud.legL.rotation.x = 0;
      if (ud.legR) ud.legR.rotation.x = 0;
      if (ud.body) { ud.body.rotation.x = 0; ud.body.position.y = 0.44 + breathe; }
      if (ud.head) { ud.head.rotation.x = 0; ud.head.position.y = 0.78 + breathe; }
    }

    var isSel = state.selectedVillager === v.id;
    vg.traverse(function(o) {
      if (o.isMesh && o.material)
        o.material.emissive = isSel ? new THREE.Color(0x443300) : new THREE.Color(0x000000);
    });
  }
}

// ---- SYNC BUILDINGS ----
function syncBuildings() {
  if (state.buildings.length !== _lastBuildingCount) {
    rebuildAllBuildings();
    updateSelectionRing();
  }
  for (var bid in buildingMeshes) {
    var bg = buildingMeshes[bid];
    var isSel = state.selectedBuilding === parseInt(bid);
    bg.traverse(function(o) {
      // isWindow-Meshes NICHT mit Selektion-Emissive überschreiben
      // (deren Emissive wird von updateDayLight gesteuert)
      if (o.isMesh && o.material && !o.userData.isHitBox && !o.userData.isWindow) {
        o.material.emissive = isSel ? new THREE.Color(0x443300) : new THREE.Color(0x000000);
      }
    });
  }
}

// ---- WASSER ----
function animateWater(dt) {
  waterAnim += dt * 0.6;
  for (var i = 0; i < waterTiles.length; i++) {
    var t = waterTiles[i];
    var hue = (198 + Math.sin(waterAnim + i * 0.4) * 4) / 360;
    t.material.color.setHSL(hue, 0.65, 0.56);
    t.position.y = -0.05 + Math.sin(waterAnim * 0.7 + i * 0.3) * 0.012;
  }
}

// ---- GEBÄUDE-ANIMATION ----
function animateBuildings(dt) {
  for (var bid in buildingMeshes) {
    var bg = buildingMeshes[bid];
    var hasWorker = state.villagers.some(function(v) { return v.buildingId === parseInt(bid); });
    bg.traverse(function(o) {
      if (o.userData.isBlade) {
        if (hasWorker) o.rotation.x += dt * 3.5;
      }
      if (o.userData.isSmoke) {
        var sc = 0.7 + Math.sin(waterAnim * 1.5 + parseInt(bid)) * 0.3;
        o.scale.setScalar(sc);
        o.material.opacity = 0.22 + Math.sin(waterAnim + parseInt(bid)) * 0.12;
      }
      if (o.userData.isNeonLight) {
        var on = Math.sin(waterAnim * 2 + o.userData.lightIdx * 1.1) > 0;
        o.material.emissive.setScalar(on ? 0.7 : 0.08);
      }
      if (o.userData.isNeon) {
        o.material.emissive.setScalar(0.3 + Math.sin(waterAnim * 1.5) * 0.25);
      }
    });
  }
}

// ---- TAGESLICHT & FENSTER-GLOW ----
function updateDayLight() {
  var dp = getDayPhaseInfo();
  var sc = lerpHexColor(dp.cur.sunColor, dp.next.sunColor, dp.t);
  var si = lN(dp.cur.sunIntens, dp.next.sunIntens, dp.t);
  var ai = lN(dp.cur.ambIntens, dp.next.ambIntens, dp.t);
  var mi = lN(dp.cur.moonIntens, dp.next.moonIntens, dp.t);

  if (sunLight) {
    sunLight.color.set(sc);
    sunLight.intensity = si;
    sunLight.position.set(
      lN(dp.cur.sx, dp.next.sx, dp.t) * 15,
      lN(dp.cur.sy, dp.next.sy, dp.t) * 15,
      lN(dp.cur.sz, dp.next.sz, dp.t) * 15
    );
  }
  if (ambLight)  ambLight.intensity = ai;
  if (moonLight) moonLight.intensity = mi;
  if (hemiLight) {
    hemiLight.intensity = ai * 0.55;
    hemiLight.color      = lerpHexColor(dp.cur.skyTop, dp.next.skyTop, dp.t);
    hemiLight.groundColor= lerpHexColor(dp.cur.skyBot, dp.next.skyBot, dp.t);
  }

  // Hintergrundfarbe + Fog synchron mit Himmel
  var skyColor = lerpHexColor(dp.cur.skyTop, dp.next.skyTop, dp.t);
  if (renderer) renderer.setClearColor(skyColor);
  if (scene.fog) scene.fog.color.set(skyColor);

  // Fenster-Glow: Nacht-Intensität 0..1
  var nightT = (dp.idx === 3) ? 1.0 : (dp.idx === 2 ? dp.t : 0.0);
  var winR = 0.55 * nightT;
  var winG = 0.42 * nightT;
  var winB = 0.05 * nightT;
  for (var bid in buildingMeshes) {
    buildingMeshes[bid].traverse(function(o) {
      if (o.isMesh && o.userData.isWindow) {
        o.material.emissive.setRGB(winR, winG, winB);
      }
    });
  }

  var timeEl = document.getElementById('time-chip');
  if (timeEl) timeEl.textContent = DAY_PHASES[dp.idx].name + ' · Tag ' + state.day;
}

// ---- KAMERA ----
function setupCamera() {
  var wrap = document.getElementById('canvas-wrap');
  var W = wrap.clientWidth || window.innerWidth;
  var H = wrap.clientHeight || window.innerHeight;
  var aspect = W / H, frustH = 10;
  camera = new THREE.OrthographicCamera(-frustH*aspect, frustH*aspect, frustH, -frustH, 0.1, 300);
  camTarget.x = COLS * TSCALE / 2;
  camTarget.z = ROWS * TSCALE / 2;
  var dist = 25;
  camera.position.set(camTarget.x + dist, dist * 0.82, camTarget.z + dist);
  camera.lookAt(new THREE.Vector3(camTarget.x, 0, camTarget.z));
  camera.zoom = camZoom;
  camera.updateProjectionMatrix();
}

function updateCameraTarget() {
  var dist = 25;
  camera.position.set(camTarget.x + dist, dist * 0.82, camTarget.z + dist);
  camera.lookAt(new THREE.Vector3(camTarget.x, 0, camTarget.z));
  camera.zoom = camZoom;
  camera.updateProjectionMatrix();
}

// ---- INIT ----
function initCanvas() {
  var wrap = document.getElementById('canvas-wrap');
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('gameCanvas') });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x87ceeb);

  var W = wrap.clientWidth || window.innerWidth;
  var H = wrap.clientHeight || window.innerHeight;
  renderer.setSize(W, H);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.016);
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Licht-Setup
  ambLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambLight);

  hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x5a9e50, 0.4);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(15, 22, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width  = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.left   = -30;
  sunLight.shadow.camera.right  =  30;
  sunLight.shadow.camera.top    =  30;
  sunLight.shadow.camera.bottom = -30;
  sunLight.shadow.camera.far    =  80;
  sunLight.shadow.bias = -0.001;
  scene.add(sunLight);

  // Mondlicht (blau-weiß, nur nachts aktiv via updateDayLight)
  moonLight = new THREE.DirectionalLight(0x8899ee, 0.0);
  moonLight.position.set(-12, 18, 6);
  scene.add(moonLight);

  setupCamera();
  generateMap();
  buildScene();
  window.addEventListener('resize', resizeCanvas);
  initCameraDrag();
}

function resizeCanvas() {
  var wrap = document.getElementById('canvas-wrap');
  var W = wrap.clientWidth || window.innerWidth;
  var H = wrap.clientHeight || window.innerHeight;
  if (!W || !H) return;
  renderer.setSize(W, H);
  var aspect = W / H, frustH = 10;
  camera.left   = -frustH * aspect;
  camera.right  =  frustH * aspect;
  camera.top    =  frustH;
  camera.bottom = -frustH;
  camera.updateProjectionMatrix();
}

// ---- INPUT ----
function initCameraDrag() {
  var wrap = document.getElementById('canvas-wrap');
  wrap.addEventListener('mousedown', function(e) {
    if (state.buildMode) return;
    camDrag = true; _lastMouseX = e.clientX; _lastMouseY = e.clientY;
    wrap.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', function(e) {
    if (!camDrag) return;
    var dx = (e.clientX - _lastMouseX) * 0.04 / camZoom;
    var dy = (e.clientY - _lastMouseY) * 0.04 / camZoom;
    camTarget.x -= dx * Math.cos(CAM_ANGLE) + dy * Math.sin(CAM_ANGLE);
    camTarget.z -= dy * Math.cos(CAM_ANGLE) - dx * Math.sin(CAM_ANGLE);
    _lastMouseX = e.clientX; _lastMouseY = e.clientY;
  });
  window.addEventListener('mouseup', function() { camDrag = false; wrap.style.cursor = 'default'; });
  wrap.addEventListener('wheel', function(e) {
    e.preventDefault();
    camZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camZoom * (e.deltaY < 0 ? 1.1 : 0.91)));
  }, { passive: false });
  // Touch
  var _tx = 0, _ty = 0, _pd = null;
  wrap.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) { camDrag = true; _tx = e.touches[0].clientX; _ty = e.touches[0].clientY; }
    else if (e.touches.length === 2) { camDrag = false; _pd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
  }, { passive: true });
  wrap.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1 && camDrag) {
      var dx = (e.touches[0].clientX - _tx) * 0.04 / camZoom;
      var dy = (e.touches[0].clientY - _ty) * 0.04 / camZoom;
      camTarget.x -= dx * Math.cos(CAM_ANGLE) + dy * Math.sin(CAM_ANGLE);
      camTarget.z -= dy * Math.cos(CAM_ANGLE) - dx * Math.sin(CAM_ANGLE);
      _tx = e.touches[0].clientX; _ty = e.touches[0].clientY;
    } else if (e.touches.length === 2 && _pd) {
      var nd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      camZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camZoom * (nd / _pd)));
      _pd = nd;
    }
  }, { passive: true });
  wrap.addEventListener('touchend', function(e) {
    if (e.touches.length < 1) camDrag = false;
    if (e.touches.length < 2) _pd = null;
  });
}

// ---- KOORDINATEN (Kompatibilität mit game.js) ----
function toIso(c, r) {
  var wp = tileToWorld(c, r);
  var v3 = new THREE.Vector3(wp.x, 0, wp.z);
  v3.project(camera);
  var wrap = document.getElementById('canvas-wrap');
  var W = wrap.clientWidth, H = wrap.clientHeight;
  return { x: (v3.x + 1) / 2 * W, y: (-v3.y + 1) / 2 * H };
}

function fromIso(sx, sy) {
  var wrap = document.getElementById('canvas-wrap');
  var rect = wrap.getBoundingClientRect();
  mouse.x =  ((sx - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((sy - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  var plane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);
  return { col: Math.round(target.x / TSCALE), row: Math.round(target.z / TSCALE) };
}

function getClickedBuilding(sx, sy) {
  var wrap = document.getElementById('canvas-wrap');
  var rect = wrap.getBoundingClientRect();
  mouse.x =  ((sx - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((sy - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  var objs = [];
  buildingGroup.traverse(function(o) { if (o.isMesh) objs.push(o); });
  var hits = raycaster.intersectObjects(objs, false);
  if (hits.length > 0) {
    var o = hits[0].object, g = o;
    while (g.parent && g.parent !== buildingGroup) g = g.parent;
    if (g.userData && g.userData.buildingId !== undefined) {
      for (var i = 0; i < state.buildings.length; i++)
        if (state.buildings[i].id === g.userData.buildingId) return state.buildings[i];
    }
  }
  return null;
}

// ---- HAUPT-DRAW ----
function draw() {
  var dt = clock.getDelta();
  animateWater(dt);
  updateDayLight();
  updateCameraTarget();
  syncVillagers();
  animateVillagers(dt);
  syncBuildings();
  animateBuildings(dt);
  // Hover-Tile im Build-Modus
  if (state.buildMode && state.hoverTile) {
    var key = state.hoverTile.col + ',' + state.hoverTile.row;
    for (var k in tileMeshes)
      tileMeshes[k].material.emissive = k === key ? new THREE.Color(0x4a8c00) : new THREE.Color(0x000000);
  }
  renderer.render(scene, camera);
}
