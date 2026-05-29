// ============================================================
// DRAW.JS – v6.5 THREE.JS
// Echtes Web-3D: Stylized Isometric, Cozy Fantasy Storybook
//  - Three.js OrthographicCamera (isometrisch)
//  - Chunky Low-Poly Gebäude mit 4 Wänden + Dach
//  - Bäume als 3D-Meshes (Pine + Round)
//  - Villager als animierte 3D-Figuren
//  - Tageszyklus via Lichtfarben
//  - Raycaster für Gebäude-Klick
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

// Tageszyklus
var DAY_PHASES = [
  { name:'🌅 Morgen', skyTop:'#f7c86a', skyBot:'#f0a840',
    sunColor:'#ffdd88', sunIntens:1.1, ambIntens:0.55, sx:-1, sy:2, sz:0.5 },
  { name:'🌤 Mittag', skyTop:'#87ceeb', skyBot:'#c8e8f8',
    sunColor:'#ffffff', sunIntens:1.4, ambIntens:0.70, sx:0,  sy:3, sz:0 },
  { name:'🌇 Abend',  skyTop:'#f0785a', skyBot:'#c05030',
    sunColor:'#ff9955', sunIntens:0.9, ambIntens:0.40, sx:1,  sy:1.5, sz:0.5 },
  { name:'🌙 Nacht',  skyTop:'#1a2040', skyBot:'#0d1228',
    sunColor:'#6677cc', sunIntens:0.45, ambIntens:0.55, sx:0,  sy:2,   sz:-1 }
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
  // ---- UNENDLICHER BODEN (Infinite Ground Plane) ----
  // Liegt bei y=-0.1 unter dem Spielfeld → kein Z-Fighting, kein CSS-Parallax
  var groundMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#c8b87a') });
  var groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(COLS*TSCALE/2, -0.10, ROWS*TSCALE/2);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
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
  if (b.type==='well')   _makeWell3D(g,sz.W,sz.H,sz.D,ms);
  else if (b.type==='casino') _makeCasino3D(g,sz.W,sz.H,sz.D,ms);
  else                   _makeStdBuilding3D(g,sz.W,sz.H,sz.D,ms,b.type);
  g.position.set(wp.x,0,wp.z);
  return g;
}

function _makeStdBuilding3D(g,W,H,D,ms,type) {
  // Körper
  var body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),ms.wall.clone());
  body.position.set(0,H/2+.09,0); body.castShadow=true; body.receiveShadow=true; g.add(body);

  // ---- DACH: je nach Gebäudetyp andere Form ----
  var roofH=H*.55;
  if (type==='townhall'||type==='bakery'||type==='well') {
    // Hohe Pyramide mit Dachspitze-Aufsatz (Rathaus-Charakter)
    var roof=new THREE.Mesh(new THREE.ConeGeometry(W*.78,roofH*1.1,4),ms.roof.clone());
    roof.rotation.y=Math.PI/4; roof.position.set(0,H+.09+roofH*.55,0); roof.castShadow=true; g.add(roof);
    // Kleines Türmchen oben
    var spire=new THREE.Mesh(new THREE.ConeGeometry(W*.12,H*.45,6),ms.roof.clone());
    spire.position.set(0,H+.09+roofH*1.1+H*.22,0); spire.castShadow=true; g.add(spire);
  } else if (type==='farm'||type==='warehouse'||type==='carpentry') {
    // Satteldach (Scheune-Style): langer First
    var roofBox=new THREE.Mesh(new THREE.BoxGeometry(W*1.08,roofH*.28,D*1.08),ms.roof.clone());
    roofBox.position.set(0,H+.09+roofH*.14,0); g.add(roofBox);
    // Giebel links/rechts
    var gL=new THREE.Mesh(new THREE.ConeGeometry(D*.62,roofH*.9,4),ms.roof.clone());
    gL.rotation.y=Math.PI/4; gL.position.set(-W*.36,H+.09+roofH*.45,0); gL.castShadow=true; g.add(gL);
    var gR=new THREE.Mesh(new THREE.ConeGeometry(D*.62,roofH*.9,4),ms.roof.clone());
    gR.rotation.y=Math.PI/4; gR.position.set(W*.36,H+.09+roofH*.45,0); gR.castShadow=true; g.add(gR);
  } else if (type==='smithy'||type==='quarry'||type==='brickyard') {
    // Flaches Walmdach mit Überhang (Industrie-Style)
    var roofFlat=new THREE.Mesh(new THREE.BoxGeometry(W*1.18,roofH*.18,D*1.18),ms.roof.clone());
    roofFlat.position.set(0,H+.09+roofH*.09,0); roofFlat.castShadow=true; g.add(roofFlat);
    var roofPyra=new THREE.Mesh(new THREE.ConeGeometry(W*.65,roofH*.55,4),ms.roof.clone());
    roofPyra.rotation.y=Math.PI/4; roofPyra.position.set(0,H+.09+roofH*.18+roofH*.275,0); g.add(roofPyra);
  } else if (type==='sawmill') {
    // Offenes Scheddach (Sägezahn-Fabrik)
    for (var si=0;si<2;si++) {
      var shed=new THREE.Mesh(new THREE.ConeGeometry(W*.42,roofH*.75,3),ms.roof.clone());
      shed.rotation.y=Math.PI/6; shed.position.set(-W*.22+si*W*.44,H+.09+roofH*.375,0); shed.castShadow=true; g.add(shed);
    }
  } else if (type==='kitchen') {
    // Klassische Pyramide mit breitem Dachüberstand
    var roofOvr=new THREE.Mesh(new THREE.ConeGeometry(W*.85,roofH,4),ms.roof.clone());
    roofOvr.rotation.y=Math.PI/4; roofOvr.position.set(0,H+.09+roofH/2,0); roofOvr.castShadow=true; g.add(roofOvr);
  } else {
    // Fallback: Standard Pyramide
    var roofStd=new THREE.Mesh(new THREE.ConeGeometry(W*.72,roofH,4),ms.roof.clone());
    roofStd.rotation.y=Math.PI/4; roofStd.position.set(0,H+.09+roofH/2,0); roofStd.castShadow=true; g.add(roofStd);
  }

  // ---- FENSTER (mit isWindow-Flag für Nacht-Glow) ----
  var wM=new THREE.MeshLambertMaterial({color:new THREE.Color('#d4eeff'),emissive:new THREE.Color(0x000000)});
  var wG=new THREE.BoxGeometry(W*.18,H*.22,.04);
  var w1=new THREE.Mesh(wG,wM.clone()); w1.position.set(-W*.22,H*.56+.09,D/2+.02); w1.userData.isWindow=true; g.add(w1);
  var w2=new THREE.Mesh(wG,wM.clone()); w2.position.set(W*.22,H*.56+.09,D/2+.02); w2.userData.isWindow=true; g.add(w2);
  // Fenster Seite
  var wGS=new THREE.BoxGeometry(.04,H*.22,D*.18);
  var w3=new THREE.Mesh(wGS,wM.clone()); w3.position.set(W/2+.02,H*.56+.09,0); w3.userData.isWindow=true; g.add(w3);
  // Tür
  var dr=new THREE.Mesh(new THREE.BoxGeometry(W*.22,H*.42,.05),M.door.clone());
  dr.position.set(0,H*.21+.09,D/2+.025); g.add(dr);
  // Details
  _addDetails3D(g,type,W,H,D);
  // Hitbox
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,H*1.6,D*1.1),M.hit.clone());
  hb.position.set(0,H/2+.09,0); hb.userData.isHitBox=true; g.add(hb);
}

function _addDetails3D(g,type,W,H,D) {
  // Schornstein (mehr Gebäudetypen)
  if (type==='kitchen'||type==='bakery'||type==='smithy'||type==='brickyard'||type==='carpentry') {
    var chW=type==='smithy'?W*.16:W*.12;
    var chH=type==='smithy'?H*.65:H*.5;
    var ch=new THREE.Mesh(new THREE.BoxGeometry(chW,chH,chW),M.chimney.clone());
    ch.position.set(W*.28,H+.09,D*.15*-1); ch.castShadow=true; g.add(ch);
    // Schornstein-Kappe
    var cap=new THREE.Mesh(new THREE.BoxGeometry(chW*1.4,chH*.08,chW*1.4),M.chimney.clone());
    cap.position.set(W*.28,H+.09+chH*.54,D*.15*-1); g.add(cap);
    var sm=new THREE.Mesh(new THREE.SphereGeometry(.09,6,4),mLamb('#aaaaaa'));
    sm.material.transparent=true; sm.material.opacity=0.35;
    sm.position.set(W*.28,H+.09+chH*.58,-D*.15); sm.userData.isSmoke=true; g.add(sm);
  }
  // Sägeblatt
  if (type==='sawmill') {
    var bl=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.04,12),M.blade.clone());
    bl.rotation.z=Math.PI/2; bl.position.set(W/2+.08,H*.55+.09,0); bl.userData.isBlade=true; g.add(bl);
  }
  // Fässer (Lager)
  if (type==='warehouse') {
    var bM=M.barrel.clone();
    for (var bi=0;bi<3;bi++) {
      var bar=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.28,8),bM.clone());
      bar.position.set(-W*.35+bi*.22,.23,D*.52); g.add(bar);
    }
    // Kleines Schild
    var sign=new THREE.Mesh(new THREE.BoxGeometry(W*.35,H*.18,.05),mLamb('#c8a060'));
    sign.position.set(0,H*.78+.09,D/2+.03); g.add(sign);
  }
  // Stein (Steinbruch)
  if (type==='quarry') {
    var st=new THREE.Mesh(new THREE.BoxGeometry(.4,.15,.4),M.stone.clone());
    st.position.set(0,.17,D*.52); g.add(st);
    var st2=new THREE.Mesh(new THREE.BoxGeometry(.22,.20,.22),M.stone.clone());
    st2.position.set(.28,.19,D*.35); g.add(st2);
  }
  // Heu (Farm)
  if (type==='farm') {
    var hay=new THREE.Mesh(new THREE.CylinderGeometry(.22,.28,.35,8),mLamb('#e8c840'));
    hay.position.set(W*.42,.26,-D*.35); g.add(hay);
    // Zaun-Pfosten
    for (var fi=0;fi<3;fi++) {
      var fp=new THREE.Mesh(new THREE.BoxGeometry(.05,.22,.05),mLamb('#c8a070'));
      fp.position.set(-W*.5+fi*W*.3,.11,D*.52); g.add(fp);
    }
  }
  // Amboss (Schmiede)
  if (type==='smithy') {
    var anv=new THREE.Mesh(new THREE.BoxGeometry(.28,.18,.18),M.stone.clone());
    anv.position.set(-W*.3,.23,D*.52); g.add(anv);
  }
  // Mehlsäcke (Bäckerei)
  if (type==='bakery') {
    var sack=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),mLamb('#e8e0c8'));
    sack.scale.set(1,.75,1); sack.position.set(W*.42,.17,D*.52); g.add(sack);
  }
  // Holzstapel (Zimmerei)
  if (type==='carpentry') {
    for (var li=0;li<3;li++) {
      var log=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.38,7),M.trunk.clone());
      log.rotation.z=Math.PI/2; log.position.set(-W*.3+li*.16,.09+li*.07,D*.52); g.add(log);
    }
  }
  // Ziegelstapel (Ziegelei)
  if (type==='brickyard') {
    for (var bri=0;bri<4;bri++) {
      var brick=new THREE.Mesh(new THREE.BoxGeometry(.20,.07,.09),mLamb('#c06040'));
      brick.position.set(-W*.28+bri*.16,.09,D*.52); g.add(brick);
    }
  }
}

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

function animateVillagers(dt) {
  for (var i=0;i<state.villagers.length;i++) {
    var v=state.villagers[i], vg=villagerMeshes[v.id]; if(!vg) continue;
    var wp=tileToWorld(v.x,v.y); vg.position.set(wp.x,0,wp.z);
    var spd=Math.sqrt(v.vx*v.vx+v.vy*v.vy);
    v.anim=(v.anim||0)+(spd>.005?.055:.012);
    if(spd>.005){var ang=Math.atan2(v.vx,v.vy);vg.rotation.y=ang;}
    var ud=vg.userData;
    var isWorking = v.buildingId!==null && spd<=0.005;
    if(spd>.005){
      // Lauf-Animation
      var sw=Math.sin(v.anim*Math.PI*2)*.35;
      if(ud.legL)ud.legL.rotation.x=sw; if(ud.legR)ud.legR.rotation.x=-sw;
      if(ud.aL)ud.aL.rotation.x=-sw*.7; if(ud.aR)ud.aR.rotation.x=sw*.7;
      var bob=Math.sin(v.anim*Math.PI*2)*.022;
      if(ud.body)ud.body.position.y=.44+bob; if(ud.head)ud.head.position.y=.78+bob;
      if(ud.body)ud.body.rotation.x=0;
    } else if(isWorking) {
      // Arbeits-Animation: sanftes Hacken/Bauen (~1 Schlag/Sek)
      var wt=Math.sin(v.anim*Math.PI*1.4); // langsame Frequenz
      var armSwing=wt*.45;
      if(ud.aR)ud.aR.rotation.x=armSwing;      // rechter Arm schlägt vor/zurück
      if(ud.aL)ud.aL.rotation.x=-armSwing*.35; // linker Arm gegenläufig leicht
      if(ud.legL)ud.legL.rotation.x=0; if(ud.legR)ud.legR.rotation.x=0;
      // Leichtes Vorbeugen beim Arbeiten
      var lean=0.12+wt*.06;
      if(ud.body)ud.body.rotation.x=lean; if(ud.head)ud.head.rotation.x=lean*.5;
      if(ud.body)ud.body.position.y=.44; if(ud.head)ud.head.position.y=.78;
    } else {
      // Idle: sanftes Atmen
      var breathe=Math.sin(v.anim*.5)*.018;
      if(ud.aL)ud.aL.rotation.x=Math.sin(v.anim*.5)*.04;
      if(ud.aR)ud.aR.rotation.x=-Math.sin(v.anim*.5)*.04;
      if(ud.legL)ud.legL.rotation.x=0; if(ud.legR)ud.legR.rotation.x=0;
      if(ud.body){ud.body.rotation.x=0; ud.body.position.y=.44+breathe;}
      if(ud.head){ud.head.rotation.x=0; ud.head.position.y=.78+breathe;}
    }
    var isSel=state.selectedVillager===v.id;
    vg.traverse(function(o){
      if(o.isMesh&&o.material)
        o.material.emissive=isSel?new THREE.Color(0x443300):new THREE.Color(0x000000);
    });
  }
}

// ---- SYNC BUILDINGS ----
function syncBuildings() {
  if(state.buildings.length!==_lastBuildingCount){rebuildAllBuildings();updateSelectionRing();}
  for(var bid in buildingMeshes){
    var bg=buildingMeshes[bid];
    var isSel=state.selectedBuilding===parseInt(bid);
    bg.traverse(function(o){
      if(o.isMesh&&o.material&&!o.userData.isHitBox&&!o.userData.isWindow)
        o.material.emissive=isSel?new THREE.Color(0x443300):new THREE.Color(0x000000);
    });
  }
}

// ---- WASSER ----
function animateWater(dt) {
  waterAnim+=dt*.6;
  for(var i=0;i<waterTiles.length;i++){
    var t=waterTiles[i];
    var hue=(198+Math.sin(waterAnim+i*.4)*4)/360;
    t.material.color.setHSL(hue,.65,.56);
    t.position.y=-.05+Math.sin(waterAnim*.7+i*.3)*.012;
  }
}

// ---- GEBÄUDE-ANIMATION ----
function animateBuildings(dt) {
  for(var bid in buildingMeshes){
    var bg=buildingMeshes[bid];
    bg.traverse(function(o){
      if(o.userData.isBlade){
        var hw=state.villagers.some(function(v){return v.buildingId===parseInt(bid);});
        if(hw) o.rotation.x+=dt*3.5;
      }
      if(o.userData.isSmoke){
        var sc=.7+Math.sin(waterAnim*1.5+parseInt(bid))*.3;
        o.scale.setScalar(sc); o.material.opacity=.22+Math.sin(waterAnim+parseInt(bid))*.12;
      }
      if(o.userData.isNeonLight){
        var on=Math.sin(waterAnim*2+o.userData.lightIdx*1.1)>0;
        o.material.emissive.setScalar(on?.7:.08);
      }
      if(o.userData.isNeon){o.material.emissive.setScalar(.3+Math.sin(waterAnim*1.5)*.25);}
    });
  }
}

// ---- TAGESLICHT ----
function updateDayLight() {
  var dp=getDayPhaseInfo();
  var sc=lerpHexColor(dp.cur.sunColor,dp.next.sunColor,dp.t);
  var si=lN(dp.cur.sunIntens,dp.next.sunIntens,dp.t);
  var ai=lN(dp.cur.ambIntens,dp.next.ambIntens,dp.t);
  if(sunLight){sunLight.color.set(sc);sunLight.intensity=si;
    sunLight.position.set(lN(dp.cur.sx,dp.next.sx,dp.t)*15,lN(dp.cur.sy,dp.next.sy,dp.t)*15,lN(dp.cur.sz,dp.next.sz,dp.t)*15);}
  if(ambLight)ambLight.intensity=ai;
  if(hemiLight){hemiLight.intensity=ai*.55;
    hemiLight.color=lerpHexColor(dp.cur.skyTop,dp.next.skyTop,dp.t);
    hemiLight.groundColor=lerpHexColor(dp.cur.skyBot,dp.next.skyBot,dp.t);}
  // Mondlicht: nur nachts einblenden
  var isNight = dp.idx===3 || (dp.idx===2 && dp.t>0);
  var nightT = dp.idx===3 ? 1.0 : (dp.idx===2 ? dp.t : 0);
  if(moonLight) moonLight.intensity = nightT * 0.35;
  // Fog-Farbe dem Himmel anpassen
  var skyC = lerpHexColor(dp.cur.skyTop,dp.next.skyTop,dp.t);
  if(renderer) renderer.setClearColor(skyC);
  if(scene.fog) scene.fog.color.set(skyC);
  // Fenster-Leuchten nachts
  var winGlow = new THREE.Color(0xffcc44).multiplyScalar(nightT * 0.7);
  for(var bid in buildingMeshes){
    buildingMeshes[bid].traverse(function(o){
      if(o.userData.isWindow) o.material.emissive.copy(winGlow);
    });
  }
  var timeEl=document.getElementById('time-chip');
  if(timeEl) timeEl.textContent=DAY_PHASES[dp.idx].name+' · Tag '+state.day;
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
  clock=new THREE.Clock();
  raycaster=new THREE.Raycaster(); mouse=new THREE.Vector2();
  ambLight=new THREE.AmbientLight(0xffffff,.5); scene.add(ambLight);
  hemiLight=new THREE.HemisphereLight(0x87ceeb,0x5a9e50,.4); scene.add(hemiLight);
  sunLight=new THREE.DirectionalLight(0xffffff,1.2);
  sunLight.position.set(15,22,10); sunLight.castShadow=true;
  sunLight.shadow.mapSize.width=sunLight.shadow.mapSize.height=1024;
  sunLight.shadow.camera.left=-30; sunLight.shadow.camera.right=30;
  sunLight.shadow.camera.top=30; sunLight.shadow.camera.bottom=-30;
  sunLight.shadow.camera.far=80; sunLight.shadow.bias=-.001;
  scene.add(sunLight);
  // Mondlicht (blau-weiß, nur nachts aktiv via updateDayLight)
  moonLight=new THREE.DirectionalLight(0x8899dd,0.0);
  moonLight.position.set(-10,18,5); scene.add(moonLight);
  setupCamera(); generateMap(); buildScene();
  window.addEventListener('resize',resizeCanvas);
  initCameraDrag();
}

function resizeCanvas() {
  var wrap=document.getElementById('canvas-wrap');
  var W=wrap.clientWidth||window.innerWidth, H=wrap.clientHeight||window.innerHeight;
  if(!W||!H) return;
  renderer.setSize(W,H);
  var aspect=W/H, frustH=10;
  camera.left=-frustH*aspect; camera.right=frustH*aspect;
  camera.top=frustH; camera.bottom=-frustH;
  camera.updateProjectionMatrix();
}

// ---- INPUT ----
function initCameraDrag() {
  var wrap=document.getElementById('canvas-wrap');
  wrap.addEventListener('mousedown',function(e){
    if(state.buildMode) return;
    camDrag=true; _lastMouseX=e.clientX; _lastMouseY=e.clientY;
    wrap.style.cursor='grabbing';
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
  // Touch
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
    if(e.touches.length<1)camDrag=false;if(e.touches.length<2)_pd=null;
  });
}

// ---- KOORDINATEN (Kompatibilität) ----
function toIso(c,r) {
  var wp=tileToWorld(c,r);
  var v3=new THREE.Vector3(wp.x,0,wp.z); v3.project(camera);
  var wrap=document.getElementById('canvas-wrap');
  var W=wrap.clientWidth,H=wrap.clientHeight;
  return {x:(v3.x+1)/2*W,y:(-v3.y+1)/2*H};
}

function fromIso(sx,sy) {
  var wrap=document.getElementById('canvas-wrap');
  var rect=wrap.getBoundingClientRect();
  mouse.x=((sx-rect.left)/rect.width)*2-1;
  mouse.y=-((sy-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  var plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  var target=new THREE.Vector3();
  raycaster.ray.intersectPlane(plane,target);
  return {col:Math.round(target.x/TSCALE),row:Math.round(target.z/TSCALE)};
}

// Raycaster für game.js
function getClickedBuilding(sx,sy) {
  var wrap=document.getElementById('canvas-wrap');
  var rect=wrap.getBoundingClientRect();
  mouse.x=((sx-rect.left)/rect.width)*2-1;
  mouse.y=-((sy-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  var objs=[]; buildingGroup.traverse(function(o){if(o.isMesh)objs.push(o);});
  var hits=raycaster.intersectObjects(objs,false);
  if(hits.length>0){
    var o=hits[0].object, g=o;
    while(g.parent&&g.parent!==buildingGroup) g=g.parent;
    if(g.userData&&g.userData.buildingId!==undefined){
      for(var i=0;i<state.buildings.length;i++)
        if(state.buildings[i].id===g.userData.buildingId) return state.buildings[i];
    }
  }
  return null;
}

// ---- HAUPT-DRAW ----
function draw() {
  var dt=clock.getDelta();
  animateWater(dt);
  updateDayLight();
  updateCameraTarget();
  syncVillagers(); animateVillagers(dt);
  syncBuildings(); animateBuildings(dt);
  // Hover-Tile
  if(state.buildMode&&state.hoverTile){
    var key=state.hoverTile.col+','+state.hoverTile.row;
    for(var k in tileMeshes)
      tileMeshes[k].material.emissive=k===key?new THREE.Color(0x4a8c00):new THREE.Color(0x000000);
  }
  renderer.render(scene,camera);
}
