// ============================================================
// DRAW.JS – v7.2 – Phase 7 Final
// Fixes:
//  1. Unified Canvas: body-bg = transparent, renderer-bg = skyColor
//  2. Villager-Animationen: echte Pivot-Gruppen (Schulter/Hüfte)
//  3. Dächer: alle Maße exakt relativ zu W/D – kein Überhang
//  4. Typ-spezifische Gebäude: Schmiede, Steinbruch, Casino
//  5. Nacht: höheres Ambient, Mondlicht, Fenster leuchten
// ============================================================

var renderer, scene, camera, clock;
var TMAP = [], TREES = [], TREE_SET = {}, FLOWERS = [];
var camTarget  = { x: 0, z: 0 };
var camZoom    = 1.0;
var MIN_ZOOM   = 0.4;
var MAX_ZOOM   = 2.5;
var CAM_ANGLE  = Math.PI / 4;
var camDrag    = false;
var _lastMouseX = 0, _lastMouseY = 0;
var waterAnim  = 0;
var buildingGroup, treeGroup, villagerGroup;
var sunLight, ambLight, hemiLight, moonLight;
var villagerMeshes  = {};
var buildingMeshes  = {};
var waterTiles      = [];
var raycaster, mouse;
var TILE   = 2.0;
var TSCALE = TILE;
var tileMeshes       = {};
var selectionRing    = null;
var _lastBuildingCount = -1;

// ============================================================
// TAGESZYKLUS  (Nacht deutlich heller als vorher)
// ============================================================
var DAY_PHASES = [
  { name:'🌅 Morgen', skyTop:'#f7c86a', skyBot:'#f0a840',
    sunColor:'#ffdd88', sunIntens:1.1,  ambIntens:0.55, moonIntens:0.00, sx:-1, sy:2,   sz:0.5 },
  { name:'🌤 Mittag', skyTop:'#87ceeb', skyBot:'#c8e8f8',
    sunColor:'#ffffff', sunIntens:1.4,  ambIntens:0.70, moonIntens:0.00, sx:0,  sy:3,   sz:0   },
  { name:'🌇 Abend',  skyTop:'#f0785a', skyBot:'#c05030',
    sunColor:'#ff9955', sunIntens:0.9,  ambIntens:0.45, moonIntens:0.00, sx:1,  sy:1.5, sz:0.5 },
  { name:'🌙 Nacht',  skyTop:'#1a2040', skyBot:'#0d1228',
    sunColor:'#6677cc', sunIntens:0.40, ambIntens:0.55, moonIntens:0.35, sx:0,  sy:2,   sz:-1  }
];

function getDayPhaseInfo() {
  var idx  = Math.floor(state.tick / DAY_PHASE_FRAMES) % DAY_PHASES.length;
  var next = (idx + 1) % DAY_PHASES.length;
  var t    = (state.tick % DAY_PHASE_FRAMES) / DAY_PHASE_FRAMES;
  return { cur: DAY_PHASES[idx], next: DAY_PHASES[next], t: Math.max(0,(t-0.8)/0.2), idx: idx };
}
function lerpHexColor(h1,h2,t) {
  var a=new THREE.Color(h1), b=new THREE.Color(h2);
  return new THREE.Color(a.r+(b.r-a.r)*t, a.g+(b.g-a.g)*t, a.b+(b.b-a.b)*t);
}
function lN(a,b,t){ return a+(b-a)*t; }

// ---- SEEDED RNG ----
function seededRand(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed>>>15, 1|seed);
    t = t + Math.imul(t ^ t>>>7, 61|t) ^ t;
    return ((t ^ t>>>14)>>>0) / 4294967296;
  };
}

// ============================================================
// MATERIALIEN
// ============================================================
function mLamb(hex, emHex) {
  return new THREE.MeshLambertMaterial({
    color:    new THREE.Color(hex),
    emissive: emHex ? new THREE.Color(emHex) : new THREE.Color(0x000000)
  });
}

var M = {
  grass:   mLamb('#5cb84e'), grass2:  mLamb('#4ea044'), dirt:     mLamb('#9a7848'),
  water:   mLamb('#4ab8e8'), path:    mLamb('#c8b07a'), sand:     mLamb('#d4c48a'),
  trunk:   mLamb('#7a5c3a'), pine0:   mLamb('#2a6828'), pine1:    mLamb('#368a32'), pine2: mLamb('#52a840'),
  leaf:    mLamb('#42a83e'), leafHi:  mLamb('#7acc60'),
  door:    mLamb('#6b3a1f'), barrel:  mLamb('#8b5c2a'),
  stone:   mLamb('#a0a0b0'), cobble:  mLamb('#8a8898'), darkStone: mLamb('#555566'),
  chimney: mLamb('#8a6040'), blade:   mLamb('#c0c0c0'),
  casinoNeon: new THREE.MeshLambertMaterial({ color:0xffd700, emissive:new THREE.Color(0x664400) }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
  sel: mLamb('#f0a500','#664400')
};

// Gebäude-Farben
var BWALL = {
  townhall:'#e8d5a3', sawmill:'#c9956b',  quarry:'#7a7888',  farm:'#c8e6a0',
  kitchen:'#f5c87a',  carpentry:'#d4a870', brickyard:'#c8906a', bakery:'#f0d090',
  well:'#b8c8d8',     warehouse:'#d4b896', smithy:'#4a4840',  casino:'#1a0a2a'
};
var BROOF = {
  townhall:'#a05a20', sawmill:'#6b3a1f',  quarry:'#444455',  farm:'#6b8c20',
  kitchen:'#a05a20',  carpentry:'#5a3010', brickyard:'#7a3a20', bakery:'#a06020',
  well:'#607080',     warehouse:'#6b4a2a', smithy:'#2a2820',  casino:'#8b0020'
};
function getBM(t){ return { wall:mLamb(BWALL[t]||'#d4c890'), roof:mLamb(BROOF[t]||'#8b6020') }; }

// Fenstermaterial – userData.isWindow = true für Nacht-Glow
function winMat() {
  var m = new THREE.MeshLambertMaterial({ color:new THREE.Color('#d4eeff'), emissive:new THREE.Color(0x000000) });
  return m;
}
function winMesh(geom) {
  var m = new THREE.Mesh(geom, winMat());
  m.userData.isWindow = true;
  return m;
}

// ============================================================
// TERRAIN
// ============================================================
function generateMap() {
  var rng = seededRand(42);
  TMAP=[]; TREES=[]; TREE_SET={}; FLOWERS=[];
  for (var r=0;r<ROWS;r++) { TMAP[r]=[];
    for (var c=0;c<COLS;c++) { var v=rng(); TMAP[r][c]=v>.88?1:v>.78?2:0; }
  }
  for (var r=ROWS-5;r<ROWS-1;r++) for (var c=COLS-6;c<COLS-1;c++) TMAP[r][c]=3;
  var PATH=[[5,5],[5,4],[5,3],[4,3],[3,3],[3,2],[6,5],[7,5],[7,6],[7,7],[6,6],[8,5],[9,5],[10,5],[10,6],[10,7]];
  for (var i=0;i<PATH.length;i++) TMAP[PATH[i][1]][PATH[i][0]]=4;
  for (var r=ROWS-6;r<ROWS;r++) for (var c=COLS-7;c<COLS;c++) if(TMAP[r][c]===0) TMAP[r][c]=5;
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++)
    if (TMAP[r][c]===0 && rng()<0.06) { TREES.push({col:c,row:r,h:1.2+rng()*.8,type:rng()<.65?'pine':'round'}); TREE_SET[c+','+r]=true; }
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++)
    if (TMAP[r][c]===0 && !TREE_SET[c+','+r] && rng()<.05) FLOWERS.push({col:c,row:r,t:Math.floor(rng()*3)});
}
function tileToWorld(col,row){ return {x:col*TSCALE, z:row*TSCALE}; }

// ============================================================
// SCENE AUFBAUEN
// ============================================================
function buildScene() {
  // ═══════════════════════════════════════════════════════════
  // UNIFIED CANVAS – Infinite Ground Plane
  // Eine einzige Three.js-Scene. Renderer-Hintergrund = Himmel.
  // body-CSS background = transparent (in initCanvas gesetzt).
  // So gibt es keinen CSS-Hintergrund der durchschimmert.
  // Die beige Plane IST der Boden – kein Brett auf Hintergrund.
  // ═══════════════════════════════════════════════════════════
  var gMat = new THREE.MeshLambertMaterial({ color:0xc4b272 });
  var gMesh = new THREE.Mesh(new THREE.PlaneGeometry(800,800), gMat);
  gMesh.rotation.x = -Math.PI/2;
  gMesh.position.set(COLS*TSCALE/2, -0.12, ROWS*TSCALE/2);
  gMesh.receiveShadow = true;
  scene.add(gMesh);

  // Tile-Insel (das Spielfeld – leicht angehoben)
  var tColors = {0:M.grass,1:M.grass2,2:M.dirt,3:M.water,4:M.path,5:M.sand};
  var tGeom = new THREE.BoxGeometry(TSCALE*0.995,0.18,TSCALE*0.995);
  waterTiles=[];
  for (var r=0;r<ROWS;r++) for (var c=0;c<COLS;c++) {
    var tp=TMAP[r][c];
    var tm=new THREE.Mesh(tGeom,(tColors[tp]||M.grass).clone());
    var wp=tileToWorld(c,r);
    tm.position.set(wp.x, tp===3?-0.06:0, wp.z);
    tm.receiveShadow=true; tm.userData={col:c,row:r,type:'tile'};
    scene.add(tm); tileMeshes[c+','+r]=tm;
    if (tp===3) waterTiles.push(tm);
  }
  // Blumen
  var flC=[0xff88cc,0xffdd44,0xff5599];
  var flG=new THREE.CylinderGeometry(.05,.05,.15,6);
  var rng2=seededRand(77);
  for (var i=0;i<FLOWERS.length;i++) {
    var fl=FLOWERS[i], fp=tileToWorld(fl.col,fl.row);
    var fm=new THREE.Mesh(flG,mLamb('#'+flC[fl.t].toString(16).padStart(6,'0')));
    fm.position.set(fp.x+(rng2()-.5)*.5,0.17,fp.z+(rng2()-.5)*.5);
    scene.add(fm);
  }
  treeGroup=new THREE.Group(); scene.add(treeGroup);
  for (var i=0;i<TREES.length;i++) treeGroup.add(makeTree3D(TREES[i]));
  buildingGroup=new THREE.Group(); scene.add(buildingGroup);
  rebuildAllBuildings();
  villagerGroup=new THREE.Group(); scene.add(villagerGroup);
}

// ============================================================
// BAUM
// ============================================================
function makeTree3D(t) {
  var g=new THREE.Group(), wp=tileToWorld(t.col,t.row), h=t.h, trH=h*.38;
  var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,trH,7),M.trunk.clone());
  trunk.position.set(0,trH/2,0); trunk.castShadow=true; g.add(trunk);
  if (t.type==='pine') {
    [{r:.52,y:0,m:M.pine0},{r:.40,y:h*.22,m:M.pine1},{r:.28,y:h*.42,m:M.pine2}].forEach(function(l){
      var c=new THREE.Mesh(new THREE.ConeGeometry(l.r,h*.40,7),l.m.clone());
      c.position.set(0,trH+l.y+h*.20,0); c.castShadow=true; g.add(c);
    });
  } else {
    var cr=new THREE.Mesh(new THREE.SphereGeometry(h*.36,8,7),M.leaf.clone());
    cr.position.set(0,trH+h*.33,0); cr.scale.set(1,.88,1); cr.castShadow=true; g.add(cr);
    var hi=new THREE.Mesh(new THREE.SphereGeometry(h*.20,6,5),M.leafHi.clone());
    hi.position.set(-h*.10,trH+h*.45,-h*.10); g.add(hi);
  }
  g.position.set(wp.x,0,wp.z); return g;
}

// ============================================================
// GEBÄUDE
// ============================================================
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

// Gebäude-Größen
var BSIZES = {
  townhall:{W:1.4,H:1.3,D:1.4}, sawmill:{W:1.2,H:1.0,D:1.2},  quarry:{W:1.3,H:1.0,D:1.3},
  farm:{W:1.5,H:0.9,D:1.5},     kitchen:{W:1.2,H:1.1,D:1.2},  carpentry:{W:1.3,H:1.0,D:1.3},
  brickyard:{W:1.3,H:1.0,D:1.3},bakery:{W:1.2,H:1.1,D:1.2},   well:{W:0.7,H:0.9,D:0.7},
  warehouse:{W:1.5,H:1.1,D:1.4},smithy:{W:1.4,H:1.1,D:1.4},   casino:{W:1.6,H:1.5,D:1.6}
};

function makeBuilding3D(b) {
  var g=new THREE.Group(), wp=tileToWorld(b.col,b.row);
  var ms=getBM(b.type), sz=BSIZES[b.type]||{W:1.2,H:1.0,D:1.2};
  if      (b.type==='well')   _bWell(g,sz.W,sz.H,sz.D,ms);
  else if (b.type==='smithy') _bSmithy(g,sz.W,sz.H,sz.D,ms);
  else if (b.type==='quarry') _bQuarry(g,sz.W,sz.H,sz.D,ms);
  else if (b.type==='casino') _bCasino(g,sz.W,sz.H,sz.D,ms);
  else                        _bStd(g,sz.W,sz.H,sz.D,ms,b.type);
  g.position.set(wp.x,0,wp.z); return g;
}

// ──────────────────────────────────────────────────────────────
// STANDARD GEBÄUDE – Typ-spezifische Dächer
// Regel: Dach-Radius ≤ min(W,D)*0.72 damit er nie übersteht
// ──────────────────────────────────────────────────────────────
function _bStd(g,W,H,D,ms,type) {
  var by=H/2+.09, ty=H+.09;
  // Körper
  var body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),ms.wall.clone());
  body.position.set(0,by,0); body.castShadow=true; body.receiveShadow=true; g.add(body);

  var rH=H*.55;   // Dachhöhe
  var rR=Math.min(W,D)*.72; // max. Dach-Radius – passt immer

  if (type==='townhall') {
    // Steile Pyramide + Turmspitze
    var r=new THREE.Mesh(new THREE.ConeGeometry(rR,rH*1.1,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,ty+rH*.55,0); r.castShadow=true; g.add(r);
    var sp=new THREE.Mesh(new THREE.ConeGeometry(.09,H*.38,5),ms.roof.clone());
    sp.position.set(0,ty+rH*1.1+H*.19,0); g.add(sp);

  } else if (type==='bakery') {
    // Breite Pyramide + Schornstein
    var r=new THREE.Mesh(new THREE.ConeGeometry(rR,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,ty+rH/2,0); r.castShadow=true; g.add(r);
    _chimney(g,W,H,D,.12,.55,true);

  } else if (type==='farm') {
    // Satteldach: gestreckter Kegel + Randplatte
    var r=new THREE.Mesh(new THREE.ConeGeometry(rR,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.scale.z=D/W; r.position.set(0,ty+rH/2,0); r.castShadow=true; g.add(r);
    var edge=new THREE.Mesh(new THREE.BoxGeometry(W*1.06,.06,D*1.06),ms.roof.clone());
    edge.position.set(0,ty+.03,0); g.add(edge);

  } else if (type==='warehouse') {
    // Walmdach: breite Platte + flache Pyramide
    var edge=new THREE.Mesh(new THREE.BoxGeometry(W*1.12,.10,D*1.12),ms.roof.clone());
    edge.position.set(0,ty+.05,0); edge.castShadow=true; g.add(edge);
    var r=new THREE.Mesh(new THREE.ConeGeometry(rR*.78,rH*.60,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,ty+.10+rH*.30,0); g.add(r);

  } else if (type==='carpentry') {
    // Hauptdach + kleiner Seitenanbau
    var r=new THREE.Mesh(new THREE.ConeGeometry(rR,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,ty+rH/2,0); r.castShadow=true; g.add(r);
    var aW=W*.40, aH=H*.65;
    var ab=new THREE.Mesh(new THREE.BoxGeometry(aW,aH,D*.40),ms.wall.clone());
    ab.position.set(-(W*.5+aW*.5),aH/2+.09,0); ab.castShadow=true; g.add(ab);
    var ar=new THREE.Mesh(new THREE.ConeGeometry(aW*.70,aH*.45,4),ms.roof.clone());
    ar.rotation.y=Math.PI/4; ar.position.set(-(W*.5+aW*.5),aH+.09+aH*.225,0); g.add(ar);
    _chimney(g,W,H,D,.10,.48,false);

  } else if (type==='brickyard') {
    // Flache Platte + kleiner Giebel
    var plate=new THREE.Mesh(new THREE.BoxGeometry(W*1.08,.10,D*1.08),ms.roof.clone());
    plate.position.set(0,ty+.05,0); plate.castShadow=true; g.add(plate);
    var r=new THREE.Mesh(new THREE.ConeGeometry(rR*.55,rH*.50,3),ms.roof.clone());
    r.position.set(0,ty+.10+rH*.25,D*.20); g.add(r);
    _chimney(g,W,H,D,.10,.45,false);

  } else if (type==='sawmill') {
    // Zwei Scheddächer nebeneinander
    var hw=W*.52;
    for (var s=-1;s<=1;s+=2) {
      var r=new THREE.Mesh(new THREE.ConeGeometry(Math.min(hw,D)*.70,rH*.80,3),ms.roof.clone());
      r.rotation.y=Math.PI/6; r.position.set(s*W*.26,ty+rH*.40,0); r.castShadow=true; g.add(r);
    }

  } else if (type==='kitchen') {
    // Breites Pyramidendach mit Randplatte + Schornstein
    var edge=new THREE.Mesh(new THREE.BoxGeometry(W*1.08,.07,D*1.08),ms.roof.clone());
    edge.position.set(0,ty+.035,0); g.add(edge);
    var r=new THREE.Mesh(new THREE.ConeGeometry(rR,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,ty+.07+rH/2,0); r.castShadow=true; g.add(r);
    _chimney(g,W,H,D,.11,.50,false);

  } else {
    // Fallback: einfache Pyramide
    var r=new THREE.Mesh(new THREE.ConeGeometry(rR,rH,4),ms.roof.clone());
    r.rotation.y=Math.PI/4; r.position.set(0,ty+rH/2,0); r.castShadow=true; g.add(r);
  }

  // Fenster (userData.isWindow = true)
  var wG=new THREE.BoxGeometry(W*.18,H*.22,.04);
  var wS=new THREE.BoxGeometry(.04,H*.22,D*.18);
  var w1=winMesh(wG); w1.position.set(-W*.22,H*.56+.09,D/2+.02); g.add(w1);
  var w2=winMesh(new THREE.BoxGeometry(W*.18,H*.22,.04));
      w2.position.set( W*.22,H*.56+.09,D/2+.02); g.add(w2);
  var w3=winMesh(wS);  w3.position.set(W/2+.02,H*.56+.09,0); g.add(w3);

  // Tür
  var dr=new THREE.Mesh(new THREE.BoxGeometry(W*.22,H*.42,.05),M.door.clone());
  dr.position.set(0,H*.21+.09,D/2+.025); g.add(dr);

  // Typ-Details
  _bDetails(g,type,W,H,D);

  // Hitbox
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,H*1.6,D*1.1),M.hit.clone());
  hb.position.set(0,H/2+.09,0); hb.userData.isHitBox=true; g.add(hb);
}

// Schornstein-Helper
function _chimney(g,W,H,D,wRel,hRel,big) {
  var cW=W*wRel*(big?1.3:1), cH=H*hRel;
  var ch=new THREE.Mesh(new THREE.BoxGeometry(cW,cH,cW),M.chimney.clone());
  ch.position.set(W*.25, H+.09+cH/2-.08, -D*.18); ch.castShadow=true; g.add(ch);
  var cap=new THREE.Mesh(new THREE.BoxGeometry(cW*1.5,.07,cW*1.5),M.chimney.clone());
  cap.position.set(W*.25, H+.09+cH-.08+.035, -D*.18); g.add(cap);
  var sm=new THREE.Mesh(new THREE.SphereGeometry(.09,6,4),mLamb('#aaaaaa'));
  sm.material.transparent=true; sm.material.opacity=.35;
  sm.position.set(W*.25,H+.09+cH+.05,-D*.18);
  sm.userData.isSmoke=true; g.add(sm);
}

// Gebäude-Details je Typ
function _bDetails(g,type,W,H,D) {
  if (type==='sawmill') {
    var bl=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.04,12),M.blade.clone());
    bl.rotation.z=Math.PI/2; bl.position.set(W/2+.08,H*.55+.09,0);
    bl.userData.isBlade=true; g.add(bl);
  }
  if (type==='warehouse') {
    for (var i=0;i<3;i++) {
      var b=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.28,8),M.barrel.clone());
      b.position.set(-W*.35+i*.22,.23,D*.52); g.add(b);
    }
  }
  if (type==='farm') {
    var hay=new THREE.Mesh(new THREE.CylinderGeometry(.22,.28,.35,8),mLamb('#e8c840'));
    hay.position.set(W*.42,.26,-D*.35); g.add(hay);
    for (var i=0;i<3;i++) {
      var fp=new THREE.Mesh(new THREE.BoxGeometry(.05,.22,.05),mLamb('#c8a070'));
      fp.position.set(-W*.5+i*W*.28,.11,D*.52); g.add(fp);
    }
  }
  if (type==='bakery') {
    var sk=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),mLamb('#e8e0c8'));
    sk.scale.set(1,.75,1); sk.position.set(W*.42,.17,D*.52); g.add(sk);
  }
  if (type==='carpentry') {
    for (var i=0;i<3;i++) {
      var lg=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.38,7),M.trunk.clone());
      lg.rotation.z=Math.PI/2; lg.position.set(-W*.3+i*.16,.09+i*.06,D*.52); g.add(lg);
    }
  }
  if (type==='brickyard') {
    for (var i=0;i<4;i++) {
      var bk=new THREE.Mesh(new THREE.BoxGeometry(.20,.07,.09),mLamb('#c06040'));
      bk.position.set(-W*.28+i*.16,.09,D*.52); g.add(bk);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// SCHMIEDE (Minecraft-Style)
// ──────────────────────────────────────────────────────────────
function _bSmithy(g,W,H,D,ms) {
  // Körper aus dunklem Stein
  var body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),ms.wall.clone());
  body.position.set(0,H/2+.09,0); body.castShadow=true; body.receiveShadow=true; g.add(body);

  // Flache Dachplatte mit Überhang
  var plate=new THREE.Mesh(new THREE.BoxGeometry(W*1.18,.13,D*1.18),ms.roof.clone());
  plate.position.set(0,H+.09+.065,0); plate.castShadow=true; g.add(plate);
  // Kleiner Dachsattel darüber
  var rH=H*.20, rR=Math.min(W,D)*.50;
  var ridg=new THREE.Mesh(new THREE.ConeGeometry(rR,rH,4),ms.roof.clone());
  ridg.rotation.y=Math.PI/4; ridg.position.set(0,H+.09+.13+rH/2,0); g.add(ridg);

  // Kopfsteinpflaster-Fundament
  var fnd=new THREE.Mesh(new THREE.BoxGeometry(W*1.06,.14,D*1.06),M.cobble.clone());
  fnd.position.set(0,.07,0); fnd.receiveShadow=true; g.add(fnd);

  // Dicker Schornstein
  var cW=W*.20, cH=H*.80;
  var ch=new THREE.Mesh(new THREE.BoxGeometry(cW,cH,cW),M.darkStone.clone());
  ch.position.set(W*.26,H+.09+cH/2-.12,-D*.18); ch.castShadow=true; g.add(ch);
  var cap=new THREE.Mesh(new THREE.BoxGeometry(cW*1.55,.09,cW*1.55),M.darkStone.clone());
  cap.position.set(W*.26,H+.09+cH-.12+.045,-D*.18); g.add(cap);
  var sm=new THREE.Mesh(new THREE.SphereGeometry(.10,6,4),mLamb('#999999'));
  sm.material.transparent=true; sm.material.opacity=.40;
  sm.position.set(W*.26,H+.09+cH+.05,-D*.18); sm.userData.isSmoke=true; g.add(sm);

  // Amboss (Basis + Platte)
  var anvB=new THREE.Mesh(new THREE.BoxGeometry(.22,.09,.18),M.stone.clone());
  anvB.position.set(-W*.28,.14,D*.52); g.add(anvB);
  var anvT=new THREE.Mesh(new THREE.BoxGeometry(.30,.08,.14),M.stone.clone());
  anvT.position.set(-W*.28,.225,D*.52); g.add(anvT);

  // Feuerstelle
  var fp=new THREE.Mesh(new THREE.BoxGeometry(.26,.13,.26),M.darkStone.clone());
  fp.position.set(W*.26,.155,D*.52); g.add(fp);
  var fire=new THREE.Mesh(new THREE.BoxGeometry(.14,.09,.14),
    new THREE.MeshLambertMaterial({color:0xff6600,emissive:new THREE.Color(0x882200)}));
  fire.position.set(W*.26,.25,D*.52); fire.userData.isFire=true; g.add(fire);

  // Fenster + Tür
  var wm=winMesh(new THREE.BoxGeometry(W*.17,H*.22,.04));
  wm.position.set(-W*.22,H*.56+.09,D/2+.02); g.add(wm);
  var dr=new THREE.Mesh(new THREE.BoxGeometry(W*.22,H*.43,.05),M.door.clone());
  dr.position.set(W*.22,H*.215+.09,D/2+.025); g.add(dr);

  // Hitbox
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,H*1.6,D*1.1),M.hit.clone());
  hb.position.set(0,H/2+.09,0); hb.userData.isHitBox=true; g.add(hb);
}

// ──────────────────────────────────────────────────────────────
// STEINBRUCH (Höhleneingang)
// ──────────────────────────────────────────────────────────────
function _bQuarry(g,W,H,D,ms) {
  // Felsboden
  var base=new THREE.Mesh(new THREE.BoxGeometry(W*1.10,.20,D*1.10),M.stone.clone());
  base.position.set(0,.10,0); base.receiveShadow=true; g.add(base);

  // Linke Felswand
  var wL=new THREE.Mesh(new THREE.BoxGeometry(W*.33,H*.92,D),M.cobble.clone());
  wL.position.set(-W*.335,H*.46+.20,0); wL.castShadow=true; g.add(wL);
  // Rechte Felswand (etwas niedriger)
  var wR=new THREE.Mesh(new THREE.BoxGeometry(W*.30,H*.78,D),M.stone.clone());
  wR.position.set(W*.35,H*.39+.20,0); wR.castShadow=true; g.add(wR);

  // Überdachungs-Balken
  var beam=new THREE.Mesh(new THREE.BoxGeometry(W*1.05,.11,D),ms.roof.clone());
  beam.position.set(0,H+.20,0); beam.castShadow=true; g.add(beam);

  // Höhlenöffnung (dunkles Rechteck in der Mitte)
  var cW=W*.40, cH=H*.62;
  var cave=new THREE.Mesh(new THREE.BoxGeometry(cW,cH,.07),
    new THREE.MeshLambertMaterial({color:0x111118}));
  cave.position.set(0,cH/2+.20,-D*.49); g.add(cave);

  // Felsgeröll vorne
  [[-.18,.22,.48,.34,.18,.22],[.28,.26,.44,.24,.28,.22]].forEach(function(s,i){
    var st=new THREE.Mesh(new THREE.BoxGeometry(s[0],s[1],s[2]),i===0?M.stone.clone():M.cobble.clone());
    st.position.set(s[3]*(i===0?-1:1),s[4],D*s[5]); g.add(st);
  });

  // Minenlore
  var lore=new THREE.Mesh(new THREE.BoxGeometry(.24,.15,.30),mLamb('#8a6030'));
  lore.position.set(W*.10,.27,D*.50); g.add(lore);
  // Lorräder
  for (var ri=0;ri<2;ri++) {
    var rad=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.06,8),M.stone.clone());
    rad.rotation.z=Math.PI/2; rad.position.set(ri===0?W*.00:W*.20,.19,D*.50); g.add(rad);
  }

  // Hitbox
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.1,H*1.4,D*1.1),M.hit.clone());
  hb.position.set(0,H*.5,0); hb.userData.isHitBox=true; g.add(hb);
}

// ──────────────────────────────────────────────────────────────
// BRUNNEN
// ──────────────────────────────────────────────────────────────
function _bWell(g,W,H,D,ms) {
  var base=new THREE.Mesh(new THREE.CylinderGeometry(W*.5,W*.55,H*.35,10),ms.wall.clone());
  base.position.set(0,H*.175+.09,0); base.castShadow=true; g.add(base);
  var wtr=new THREE.Mesh(new THREE.CylinderGeometry(W*.32,W*.32,.04,10),mLamb('#38a8d8'));
  wtr.position.set(0,H*.36+.09,0); g.add(wtr);
  var pM=ms.roof.clone(), pG=new THREE.CylinderGeometry(.055,.055,H*.75,6);
  var p1=new THREE.Mesh(pG,pM); p1.position.set(-W*.3,H*.52+.09,0); g.add(p1);
  var p2=new THREE.Mesh(pG,pM.clone()); p2.position.set(W*.3,H*.52+.09,0); g.add(p2);
  var bm=new THREE.Mesh(new THREE.BoxGeometry(W*.7,H*.09,H*.09),pM.clone());
  bm.position.set(0,H*.93+.09,0); g.add(bm);
  var bkt=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.12,7),mLamb('#8b6040'));
  bkt.position.set(0,H*.72+.09,0); g.add(bkt);
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.2,H*1.1,D*1.2),M.hit.clone());
  hb.position.set(0,H*.5,0); hb.userData.isHitBox=true; g.add(hb);
}

// ──────────────────────────────────────────────────────────────
// CASINO (aufgewertet)
// ──────────────────────────────────────────────────────────────
function _bCasino(g,W,H,D,ms) {
  // Körper
  var body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),ms.wall.clone());
  body.position.set(0,H/2+.09,0); body.castShadow=true; g.add(body);

  // Flaches Dach
  var roof=new THREE.Mesh(new THREE.BoxGeometry(W*1.06,H*.09,D*1.06),ms.roof.clone());
  roof.position.set(0,H+.09+H*.045,0); g.add(roof);

  // 4 Ecktürme
  for (var ex=-1;ex<=1;ex+=2) for (var ez=-1;ez<=1;ez+=2) {
    var tC=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,H*.55,8),ms.roof.clone());
    tC.position.set(ex*(W*.52+.06),H+.09+H*.275,ez*(D*.52+.06)); tC.castShadow=true; g.add(tC);
    var tT=new THREE.Mesh(new THREE.ConeGeometry(.14,H*.20,8),ms.roof.clone());
    tT.position.set(ex*(W*.52+.06),H+.09+H*.55+H*.10,ez*(D*.52+.06)); g.add(tT);
  }
  // Mittlerer Turm
  var mT=new THREE.Mesh(new THREE.CylinderGeometry(W*.17,W*.21,H*.68,8),ms.roof.clone());
  mT.position.set(0,H+.09+H*.34,0); mT.castShadow=true; g.add(mT);
  var mTop=new THREE.Mesh(new THREE.ConeGeometry(W*.21,H*.28,8),
    new THREE.MeshLambertMaterial({color:0xcc2020,emissive:new THREE.Color(0x440000)}));
  mTop.position.set(0,H+.09+H*.68+H*.14,0); g.add(mTop);

  // Leuchtreklame
  var sign=new THREE.Mesh(new THREE.BoxGeometry(W*.78,H*.21,.07),M.casinoNeon.clone());
  sign.position.set(0,H*.74+.09,D/2+.035); sign.userData.isNeon=true; g.add(sign);

  // Bögen über Eingang
  for (var ai=-1;ai<=1;ai++) {
    var arch=new THREE.Mesh(new THREE.TorusGeometry(.15,.04,6,10,Math.PI),
      new THREE.MeshLambertMaterial({color:0xffd700,emissive:new THREE.Color(0x443300)}));
    arch.rotation.x=Math.PI/2; arch.position.set(ai*.22,H*.38+.09,D/2+.04);
    arch.userData.isNeon=true; g.add(arch);
  }

  // Neon-Kugeln
  var nC=[0xff2020,0x20e0ff,0xffdd00,0xff2020,0x20e0ff,0xffdd00];
  for (var ni=0;ni<6;ni++) {
    var ang=(ni/6)*Math.PI*2;
    var nM=new THREE.MeshLambertMaterial({color:nC[ni],emissive:new THREE.Color(nC[ni]).multiplyScalar(.5)});
    var nL=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),nM);
    nL.position.set(Math.cos(ang)*(W*.54),H*.88+.09,Math.sin(ang)*(D*.54));
    nL.userData.isNeonLight=true; nL.userData.lightIdx=ni; g.add(nL);
  }

  // Fenster + goldene Rahmen
  for (var wi=-1;wi<=1;wi+=2) {
    var wfr=new THREE.Mesh(new THREE.BoxGeometry(W*.16,H*.26,.06),
      new THREE.MeshLambertMaterial({color:0xffd700,emissive:new THREE.Color(0x332200)}));
    wfr.position.set(wi*W*.30,H*.56+.09,D/2+.025); g.add(wfr);
    var win=winMesh(new THREE.BoxGeometry(W*.11,H*.20,.04));
    win.position.set(wi*W*.30,H*.56+.09,D/2+.045); g.add(win);
  }

  // Säulen
  for (var si=-1;si<=1;si+=2) {
    var col=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,H*.85,8),mLamb('#f0e0b0'));
    col.position.set(si*W*.38,H*.425+.09,D/2+.10); col.castShadow=true; g.add(col);
  }

  // Tür
  var dr=new THREE.Mesh(new THREE.BoxGeometry(W*.26,H*.48,.07),
    new THREE.MeshLambertMaterial({color:0xffd700,emissive:new THREE.Color(0x332200)}));
  dr.position.set(0,H*.24+.09,D/2+.035); g.add(dr);

  // Hitbox (groß genug für die Türme)
  var hb=new THREE.Mesh(new THREE.BoxGeometry(W*1.4,H*2.1,D*1.4),M.hit.clone());
  hb.position.set(0,H/2+.09,0); hb.userData.isHitBox=true; g.add(hb);
}

// ============================================================
// SELECTION RING
// ============================================================
function updateSelectionRing() {
  if (selectionRing) { scene.remove(selectionRing); selectionRing=null; }
  if (state.selectedBuilding===null) return;
  var bg=buildingMeshes[state.selectedBuilding]; if(!bg) return;
  var ring=new THREE.Mesh(new THREE.TorusGeometry(.90,.07,8,24),M.sel.clone());
  ring.rotation.x=Math.PI/2; ring.position.set(bg.position.x,.13,bg.position.z);
  scene.add(ring); selectionRing=ring;
}

// ============================================================
// VILLAGER – mit korrekten Pivot-Gruppen
// ============================================================
// Problem vorher: rotation.x wurde auf einem Mesh gesetzt, dessen
// geometrischer Mittelpunkt in der Mitte des Mesh liegt → dreht falsch.
// Fix: Pivot-Gruppe sitzt an Schulter / Hüfte; Mesh hängt nach unten.
function makeVillager3D(v) {
  var g  = new THREE.Group();
  var sk = mLamb(v.skin||'#f4c490'), hr = mLamb(v.hair||'#5a3010');
  var sh = mLamb(v.shirt||'#4a8adf'), pn = mLamb(v.pants||'#3a4a60');
  var eM = mLamb('#1a1008');

  // Körper (kein Pivot nötig – bob via position.y)
  var body=new THREE.Mesh(new THREE.BoxGeometry(.28,.36,.20),sh.clone());
  body.position.set(0,.44,0); body.castShadow=true; g.add(body);

  // Kopf
  var head=new THREE.Mesh(new THREE.BoxGeometry(.26,.26,.24),sk.clone());
  head.position.set(0,.78,0); head.castShadow=true; g.add(head);
  // Haare
  var hTop=new THREE.Mesh(new THREE.BoxGeometry(.27,.10,.25),hr.clone());
  hTop.position.set(0,.94,-.02); g.add(hTop);
  for (var hs=-1;hs<=1;hs+=2) {
    var hSd=new THREE.Mesh(new THREE.BoxGeometry(.06,.16,.24),hr.clone());
    hSd.position.set(hs*.155,.80,-.01); g.add(hSd);
  }
  // Augen
  var eG=new THREE.BoxGeometry(.05,.05,.04);
  for (var es=-1;es<=1;es+=2) {
    var eye=new THREE.Mesh(eG,eM.clone()); eye.position.set(es*.07,.80,.12); g.add(eye);
  }

  // ── BEINE mit Pivot ─────────────────────────────────────
  // pivotLeg.position = Hüfthöhe; Mesh hängt -0.15 nach unten
  var pivLL=new THREE.Group(); pivLL.position.set(-.08,.32,0);
  var mLL=new THREE.Mesh(new THREE.BoxGeometry(.10,.30,.11),pn.clone());
  mLL.position.set(0,-.15,0); pivLL.add(mLL); g.add(pivLL);

  var pivLR=new THREE.Group(); pivLR.position.set(.08,.32,0);
  var mLR=new THREE.Mesh(new THREE.BoxGeometry(.10,.30,.11),pn.clone());
  mLR.position.set(0,-.15,0); pivLR.add(mLR); g.add(pivLR);

  // Füße (folgen den Beinen per Position, nicht per Pivot)
  var fM=mLamb('#3a2510'), fG=new THREE.BoxGeometry(.11,.07,.14);
  var fL=new THREE.Mesh(fG,fM.clone()); fL.position.set(-.08,.035,.02); g.add(fL);
  var fR=new THREE.Mesh(fG,fM.clone()); fR.position.set(.08,.035,.02); g.add(fR);

  // ── ARME mit Pivot ──────────────────────────────────────
  // pivotArm.position = Schulterhöhe (Oberkante Körper ≈ 0.62)
  // Mesh hängt -0.14 nach unten → dreht um Schulter
  var pivAL=new THREE.Group(); pivAL.position.set(-.19,.62,0);
  var mAL=new THREE.Mesh(new THREE.BoxGeometry(.09,.28,.09),sh.clone());
  mAL.position.set(0,-.14,0); pivAL.add(mAL); g.add(pivAL);

  var pivAR=new THREE.Group(); pivAR.position.set(.19,.62,0);
  var mAR=new THREE.Mesh(new THREE.BoxGeometry(.09,.28,.09),sh.clone());
  mAR.position.set(0,-.14,0); pivAR.add(mAR); g.add(pivAR);

  // Hände
  var hndG=new THREE.SphereGeometry(.055,6,4);
  var hndL=new THREE.Mesh(hndG,sk.clone()); hndL.position.set(-.19,.29,0); g.add(hndL);
  var hndR=new THREE.Mesh(hndG,sk.clone()); hndR.position.set(.19,.29,0); g.add(hndR);

  // userData zeigt auf Pivot-Gruppen (nicht Meshes)
  g.userData = {
    id:v.id,
    legL:pivLL, legR:pivLR,
    armL:pivAL, armR:pivAR,
    body:body,  head:head,
    handL:hndL, handR:hndR, footL:fL, footR:fR
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

// ============================================================
// VILLAGER ANIMATIONEN
// ============================================================
function animateVillagers(dt) {
  for (var i=0;i<state.villagers.length;i++) {
    var v=state.villagers[i], vg=villagerMeshes[v.id];
    if (!vg) continue;
    var ud=vg.userData;

    // Position
    var wp=tileToWorld(v.x,v.y);
    vg.position.set(wp.x,0,wp.z);

    var spd=Math.sqrt(v.vx*v.vx+v.vy*v.vy);
    v.anim=(v.anim||0)+(spd>.005?.060:.012);
    if (spd>.005) vg.rotation.y=Math.atan2(v.vx,v.vy);

    var isWorking=(v.buildingId!==null)&&(spd<=.005);

    if (spd>.005) {
      // LAUFEN
      var sw=Math.sin(v.anim*Math.PI*2)*.55;
      ud.legL.rotation.x= sw;  ud.legR.rotation.x=-sw;
      ud.armL.rotation.x=-sw*.65; ud.armR.rotation.x=sw*.65;
      var bob=Math.abs(Math.sin(v.anim*Math.PI*2))*.018;
      ud.body.position.y=.44+bob; ud.head.position.y=.78+bob;
      ud.body.rotation.x=0; ud.head.rotation.x=0;
      // Hände folgen Armen (vereinfacht)
      ud.handL.position.set(-.19,.29+Math.sin(v.anim*Math.PI*2)*.06,0);
      ud.handR.position.set(.19,.29-Math.sin(v.anim*Math.PI*2)*.06,0);

    } else if (isWorking) {
      // ARBEITEN – sanft, ~1 Hub pro Sekunde
      var t=v.anim*Math.PI*1.2;
      var sw=Math.sin(t)*.48;
      ud.armR.rotation.x= sw;       // Hauptarm schwingt
      ud.armL.rotation.x=-sw*.25;   // Gegenarm leicht
      ud.legL.rotation.x=0; ud.legR.rotation.x=0;
      var lean=.08+Math.max(0,Math.sin(t))*.09;
      ud.body.rotation.x=lean; ud.head.rotation.x=lean*.35;
      ud.body.position.y=.44; ud.head.position.y=.78;

    } else {
      // IDLE – Atmen
      var br=Math.sin(v.anim*.5)*.014;
      ud.armL.rotation.x= Math.sin(v.anim*.5)*.05;
      ud.armR.rotation.x=-Math.sin(v.anim*.5)*.05;
      ud.legL.rotation.x=0; ud.legR.rotation.x=0;
      ud.body.rotation.x=0; ud.head.rotation.x=0;
      ud.body.position.y=.44+br; ud.head.position.y=.78+br;
    }

    // Selektion-Highlight
    var isSel=state.selectedVillager===v.id;
    vg.traverse(function(o){
      if (o.isMesh&&o.material&&!o.userData.isWindow)
        o.material.emissive=isSel?new THREE.Color(0x443300):new THREE.Color(0x000000);
    });
  }
}

// ============================================================
// SYNC BUILDINGS
// ============================================================
function syncBuildings() {
  if (state.buildings.length!==_lastBuildingCount){ rebuildAllBuildings(); updateSelectionRing(); }
  for (var bid in buildingMeshes) {
    var bg=buildingMeshes[bid], isSel=state.selectedBuilding===parseInt(bid);
    bg.traverse(function(o){
      if (o.isMesh&&o.material&&!o.userData.isHitBox&&!o.userData.isWindow)
        o.material.emissive=isSel?new THREE.Color(0x443300):new THREE.Color(0x000000);
    });
  }
}

// ============================================================
// WASSER / GEBÄUDE-ANIMATION
// ============================================================
function animateWater(dt) {
  waterAnim+=dt*.6;
  for (var i=0;i<waterTiles.length;i++) {
    var t=waterTiles[i];
    t.material.color.setHSL((198+Math.sin(waterAnim+i*.4)*4)/360,.65,.56);
    t.position.y=-.05+Math.sin(waterAnim*.7+i*.3)*.012;
  }
}
function animateBuildings(dt) {
  for (var bid in buildingMeshes) {
    var bg=buildingMeshes[bid];
    var hw=state.villagers.some(function(v){return v.buildingId===parseInt(bid);});
    bg.traverse(function(o){
      if (o.userData.isBlade&&hw)     o.rotation.x+=dt*3.5;
      if (o.userData.isSmoke) {
        var sc=.7+Math.sin(waterAnim*1.5+parseInt(bid))*.3;
        o.scale.setScalar(sc); o.material.opacity=.22+Math.sin(waterAnim+parseInt(bid))*.12;
      }
      if (o.userData.isFire)
        o.material.emissive.setRGB(.6+Math.sin(waterAnim*4)*.3,.10,.0);
      if (o.userData.isNeonLight) {
        var on=Math.sin(waterAnim*2+o.userData.lightIdx*1.1)>0;
        o.material.emissive.setScalar(on?.7:.08);
      }
      if (o.userData.isNeon) o.material.emissive.setScalar(.3+Math.sin(waterAnim*1.5)*.25);
    });
  }
}

// ============================================================
// TAGESLICHT + FENSTER-GLOW
// ============================================================
function updateDayLight() {
  var dp=getDayPhaseInfo();
  var si=lN(dp.cur.sunIntens,dp.next.sunIntens,dp.t);
  var ai=lN(dp.cur.ambIntens,dp.next.ambIntens,dp.t);
  var mi=lN(dp.cur.moonIntens,dp.next.moonIntens,dp.t);
  if (sunLight){
    sunLight.color.set(lerpHexColor(dp.cur.sunColor,dp.next.sunColor,dp.t));
    sunLight.intensity=si;
    sunLight.position.set(lN(dp.cur.sx,dp.next.sx,dp.t)*15,
                          lN(dp.cur.sy,dp.next.sy,dp.t)*15,
                          lN(dp.cur.sz,dp.next.sz,dp.t)*15);
  }
  if (ambLight)  ambLight.intensity=ai;
  if (moonLight) moonLight.intensity=mi;
  if (hemiLight){
    hemiLight.intensity=ai*.55;
    hemiLight.color=lerpHexColor(dp.cur.skyTop,dp.next.skyTop,dp.t);
    hemiLight.groundColor=lerpHexColor(dp.cur.skyBot,dp.next.skyBot,dp.t);
  }
  var sky=lerpHexColor(dp.cur.skyTop,dp.next.skyTop,dp.t);
  // Renderer-Hintergrund = Himmelfarbe → kein CSS-Brett
  if (renderer) renderer.setClearColor(sky);
  if (scene.fog) scene.fog.color.set(sky);

  // Fenster-Glow
  var nightT=(dp.idx===3)?1.0:(dp.idx===2?dp.t:0.0);
  for (var bid in buildingMeshes)
    buildingMeshes[bid].traverse(function(o){
      if (o.isMesh&&o.userData.isWindow)
        o.material.emissive.setRGB(.55*nightT,.42*nightT,.05*nightT);
    });

  var el=document.getElementById('time-chip');
  if (el) el.textContent=DAY_PHASES[dp.idx].name+' · Tag '+state.day;
}

// ============================================================
// KAMERA
// ============================================================
function setupCamera() {
  var wrap=document.getElementById('canvas-wrap');
  var W=wrap.clientWidth||window.innerWidth, H=wrap.clientHeight||window.innerHeight;
  var aspect=W/H, fH=10;
  camera=new THREE.OrthographicCamera(-fH*aspect,fH*aspect,fH,-fH,.1,300);
  camTarget.x=COLS*TSCALE/2; camTarget.z=ROWS*TSCALE/2;
  var d=25; camera.position.set(camTarget.x+d,d*.82,camTarget.z+d);
  camera.lookAt(new THREE.Vector3(camTarget.x,0,camTarget.z));
  camera.zoom=camZoom; camera.updateProjectionMatrix();
}
function updateCameraTarget() {
  var d=25;
  camera.position.set(camTarget.x+d,d*.82,camTarget.z+d);
  camera.lookAt(new THREE.Vector3(camTarget.x,0,camTarget.z));
  camera.zoom=camZoom; camera.updateProjectionMatrix();
}

// ============================================================
// INIT
// ============================================================
function initCanvas() {
  var wrap=document.getElementById('canvas-wrap');
  renderer=new THREE.WebGLRenderer({antialias:true,canvas:document.getElementById('gameCanvas')});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x87ceeb);
  var W=wrap.clientWidth||window.innerWidth, H=wrap.clientHeight||window.innerHeight;
  renderer.setSize(W,H);

  // ★ body-Hintergrund entfernen → nur noch Renderer-Clearcolor sichtbar
  document.body.style.background='transparent';

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
  if(!W||!H) return;
  renderer.setSize(W,H);
  var aspect=W/H, fH=10;
  camera.left=-fH*aspect; camera.right=fH*aspect;
  camera.top=fH; camera.bottom=-fH;
  camera.updateProjectionMatrix();
}
function initCameraDrag() {
  var wrap=document.getElementById('canvas-wrap');
  wrap.addEventListener('mousedown',function(e){
    if(state.buildMode)return;
    camDrag=true; _lastMouseX=e.clientX; _lastMouseY=e.clientY; wrap.style.cursor='grabbing';
  });
  window.addEventListener('mousemove',function(e){
    if(!camDrag)return;
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
    if(e.touches.length<1)camDrag=false;
    if(e.touches.length<2)_pd=null;
  });
}

// ============================================================
// KOORDINATEN
// ============================================================
function toIso(c,r) {
  var wp=tileToWorld(c,r), v3=new THREE.Vector3(wp.x,0,wp.z); v3.project(camera);
  var wrap=document.getElementById('canvas-wrap');
  return {x:(v3.x+1)/2*wrap.clientWidth, y:(-v3.y+1)/2*wrap.clientHeight};
}
function fromIso(sx,sy) {
  var wrap=document.getElementById('canvas-wrap'), rect=wrap.getBoundingClientRect();
  mouse.x=((sx-rect.left)/rect.width)*2-1;
  mouse.y=-((sy-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  var plane=new THREE.Plane(new THREE.Vector3(0,1,0),0), target=new THREE.Vector3();
  raycaster.ray.intersectPlane(plane,target);
  return {col:Math.round(target.x/TSCALE), row:Math.round(target.z/TSCALE)};
}
function getClickedBuilding(sx,sy) {
  var wrap=document.getElementById('canvas-wrap'), rect=wrap.getBoundingClientRect();
  mouse.x=((sx-rect.left)/rect.width)*2-1;
  mouse.y=-((sy-rect.top)/rect.height)*2+1;
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

// ============================================================
// DRAW-LOOP
// ============================================================
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
