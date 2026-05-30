// ============================================================
// STATE.JS – v7.2
// Wandering AI für Idle-Villager: randomVillageWander()
// ============================================================

var SAVE_KEY_PREFIX = 'greendale_v7_';

var state = {
  playerName:'Spieler',
  resources:{ wood:24, stone:12, wheat:8, soup:4, furniture:0, brick:0, bread:0, water:0, tool:0 },
  coins:0, xp:0, day:1, tick:0,
  selectedBuilding:null, selectedVillager:null,
  buildMode:null, activeTab:'villagers', hoverTile:null,
  orders:[], nextVillagerId:3, prevXP:0, activeEvent:null, tradeOffer:null,
  buildingTimers:{},
  villagers:[
    {id:0,name:'Lena', skin:'#f4c490',hair:'#8b4a1a',shirt:'#e05a8a',pants:'#5a7abf',emoji:'👧',task:'Idle',hunger:5,x:5,y:5,tx:5,ty:5,vx:0,vy:0,buildingId:null,progress:0,anim:0},
    {id:1,name:'Tom',  skin:'#e8a870',hair:'#3a2010',shirt:'#4a8adf',pants:'#4a5a70',emoji:'👦',task:'Idle',hunger:5,x:6,y:5,tx:6,ty:5,vx:0,vy:0,buildingId:null,progress:0,anim:0},
    {id:2,name:'Maria',skin:'#c8906a',hair:'#1a0a00',shirt:'#e06030',pants:'#705040',emoji:'👩',task:'Idle',hunger:4,x:5,y:6,tx:5,ty:6,vx:0,vy:0,buildingId:null,progress:0,anim:0}
  ],
  buildings:[
    {id:0,type:'townhall', col:5,row:4},
    {id:1,type:'sawmill',  col:3,row:2},
    {id:2,type:'quarry',   col:8,row:3},
    {id:3,type:'farm',     col:6,row:7},
    {id:4,type:'kitchen',  col:3,row:6},
    {id:5,type:'warehouse',col:9,row:6}
  ]
};

// ── SEEDED RNG ─────────────────────────────────────────────
function seededRand(seed) {
  return function() {
    seed|=0; seed=seed+0x6D2B79F5|0;
    var t=Math.imul(seed^seed>>>15,1|seed);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
var MAP_SEED=42, rng=seededRand(MAP_SEED);

// ── KOLLISION ──────────────────────────────────────────────
function isTileWalkable(col,row) {
  if (col<0||row<0||col>=COLS||row>=ROWS) return false;
  if (TMAP&&TMAP[Math.round(row)]&&TMAP[Math.round(row)][Math.round(col)]===3) return false;
  var rc=Math.round(col),rr=Math.round(row);
  for (var i=0;i<state.buildings.length;i++)
    if(state.buildings[i].col===rc&&state.buildings[i].row===rr) return false;
  return true;
}

// Zufälliges Wanderziel irgendwo auf der Karte
function randomWalkTarget() {
  for (var i=0;i<25;i++) {
    var tc=2+Math.random()*(COLS-4), tr=2+Math.random()*(ROWS-4);
    if (isTileWalkable(Math.round(tc),Math.round(tr))) return {x:tc,y:tr};
  }
  return {x:COLS/2,y:ROWS/2};
}

// Wanderziel für Idle-Villager – bevorzugt Dorfzentrum
function randomVillageWander(v) {
  var cx=COLS*.42, cy=ROWS*.42;
  for (var i=0;i<30;i++) {
    var tc, tr;
    if (Math.random()<0.65) {
      // 65 % nahe Dorfzentrum (Radius 5 Tiles)
      tc=cx+(Math.random()-.5)*10;
      tr=cy+(Math.random()-.5)*10;
    } else {
      tc=1.5+Math.random()*(COLS-3);
      tr=1.5+Math.random()*(ROWS-3);
    }
    tc=Math.max(1.5,Math.min(COLS-1.5,tc));
    tr=Math.max(1.5,Math.min(ROWS-1.5,tr));
    var dx=tc-v.x, dy=tr-v.y;
    // Mindest-Distanz 2.5 Tiles damit sie wirklich umherlaufen
    if (Math.sqrt(dx*dx+dy*dy)>2.5&&isTileWalkable(Math.round(tc),Math.round(tr)))
      return {x:tc,y:tr};
  }
  return {x:cx,y:cy};
}

// ── SAVE / LOAD ────────────────────────────────────────────
function saveGame() {
  try {
    var d={version:72,playerName:state.playerName,resources:state.resources,
      coins:state.coins,xp:state.xp,day:state.day,tick:state.tick,
      nextVillagerId:state.nextVillagerId,prevXP:state.prevXP,
      buildingTimers:state.buildingTimers,
      villagers:state.villagers.map(function(v){
        return{id:v.id,name:v.name,emoji:v.emoji,skin:v.skin,hair:v.hair,
               shirt:v.shirt,pants:v.pants,task:v.task,hunger:v.hunger,
               buildingId:v.buildingId,progress:v.progress,
               x:v.x,y:v.y,tx:v.tx,ty:v.ty};
      }),buildings:state.buildings};
    localStorage.setItem(SAVE_KEY_PREFIX+state.playerName,JSON.stringify(d));
    showNotif('💾 Gespeichert!'); sendStateUpdate(true); return true;
  } catch(e){ showNotif('⚠️ '+e.message); return false; }
}
function loadGame(playerName) {
  try {
    var raw=localStorage.getItem(SAVE_KEY_PREFIX+playerName)
          ||localStorage.getItem('greendale_v65_'+playerName)
          ||localStorage.getItem('greendale_v6_'+playerName)
          ||localStorage.getItem('greendale_v5_'+playerName);
    if (!raw) return false;
    var d=JSON.parse(raw);
    if (!d||!Array.isArray(d.villagers)||!Array.isArray(d.buildings)) return false;
    state.playerName=d.playerName||playerName;
    state.xp=+d.xp||0; state.coins=+d.coins||0;
    state.day=+d.day||1; state.tick=+d.tick||0;
    state.nextVillagerId=+d.nextVillagerId||d.villagers.length;
    state.prevXP=+d.prevXP||state.xp;
    state.buildingTimers=d.buildingTimers||{};
    var def={wood:0,stone:0,wheat:0,soup:0,furniture:0,brick:0,bread:0,water:0,tool:0};
    for (var k in def) state.resources[k]=typeof(d.resources||{})[k]==='number'?d.resources[k]:0;
    state.villagers=d.villagers.map(function(v){
      return{id:+v.id||0,name:v.name||'V',emoji:v.emoji||'🧑',
             skin:v.skin||'#f4c490',hair:v.hair||'#5a3010',
             shirt:v.shirt||'#4a8adf',pants:v.pants||'#3a4a60',
             task:v.task||'Idle',hunger:+v.hunger||MAX_HUNGER,
             buildingId:v.buildingId!==undefined?v.buildingId:null,progress:+v.progress||0,
             x:+v.x||5,y:+v.y||5,tx:+v.tx||5,ty:+v.ty||5,
             vx:0,vy:0,anim:0};
    });
    state.buildings=d.buildings.map(function(b){
      return{id:+b.id||0,type:b.type||'townhall',col:+b.col||0,row:+b.row||0};
    });
    showNotif('✅ '+playerName+' geladen – Tag '+state.day); return true;
  } catch(e){ console.warn(e); return false; }
}
function applyDbState(ds) {
  if (!ds) return;
  if ((ds.xp||0)>state.xp||(ds.day||1)>state.day){
    showNotif('☁️ Cloud-Spielstand geladen!'); loadGameFromObject(ds);
  }
}
function loadGameFromObject(d) {
  if (!d||!Array.isArray(d.villagers)||!Array.isArray(d.buildings)) return;
  state.xp=d.xp||state.xp; state.coins=d.coins||state.coins;
  state.day=d.day||state.day; state.tick=d.tick||state.tick;
  state.prevXP=d.prevXP||state.prevXP;
  state.nextVillagerId=d.nextVillagerId||state.nextVillagerId;
  state.buildingTimers=d.buildingTimers||{};
  if (d.resources) for (var k in state.resources)
    if (typeof d.resources[k]==='number') state.resources[k]=d.resources[k];
  state.villagers=d.villagers.map(function(v){
    return{id:v.id||0,name:v.name||'V',emoji:v.emoji||'🧑',
           skin:v.skin||'#f4c490',hair:v.hair||'#5a3010',
           shirt:v.shirt||'#4a8adf',pants:v.pants||'#3a4a60',
           task:v.task||'Idle',hunger:v.hunger||MAX_HUNGER,
           buildingId:v.buildingId||null,progress:v.progress||0,
           x:v.x||5,y:v.y||5,tx:v.tx||5,ty:v.ty||5,vx:0,vy:0,anim:0};
  });
  state.buildings=d.buildings.map(function(b){
    return{id:b.id||0,type:b.type||'townhall',col:b.col||0,row:b.row||0};
  });
  updateResourceDisplay(); renderSidebar();
}
var _autoSave=null;
function startAutoSave(){
  clearInterval(_autoSave);
  _autoSave=setInterval(function(){
    if(state.playerName&&state.playerName!=='Spieler') saveGame();
  },60000);
}

// ── PRODUKTION ─────────────────────────────────────────────
var _lastProd=Date.now();
function tickProduction() {
  state.tick++;
  var now=Date.now(), dtSec=(now-_lastProd)/1000; _lastProd=now;
  if (state.tick%HUNGER_INTERVAL===0) {
    for (var i=0;i<state.villagers.length;i++) {
      var v=state.villagers[i];
      if (state.tick%(HUNGER_INTERVAL*3)===0){
        v.hunger=Math.max(0,v.hunger-1);
        if(v.hunger===0) v.buildingId=null;
      }
    }
  }
  for (var i=0;i<state.buildings.length;i++) {
    var bld=state.buildings[i], ch=CHAINS[bld.type];
    if (!ch||!ch.output) continue;
    var hw=false, wh=0;
    for (var j=0;j<state.villagers.length;j++)
      if(state.villagers[j].buildingId===bld.id){hw=true;wh=state.villagers[j].hunger;break;}
    if (!hw) continue;
    var tot=PRODUCE_INTERVAL_SEC[bld.type]||30;
    if (!state.buildingTimers[bld.id]) state.buildingTimers[bld.id]={elapsed:0,total:tot};
    var tm=state.buildingTimers[bld.id]; tm.total=tot;
    var hm=wh>=4?1.0:wh>=3?.85:wh>=2?.6:wh>=1?.35:.1;
    tm.elapsed=Math.min(tm.total,tm.elapsed+dtSec*hm);
    for (var j=0;j<state.villagers.length;j++)
      if(state.villagers[j].buildingId===bld.id) state.villagers[j].progress=(tm.elapsed/tm.total)*100;
    if (tm.elapsed>=tm.total) {
      var ok=true;
      if(ch.input&&state.resources[ch.input]<ch.inputAmt) ok=false;
      if(ch.inputB&&state.resources[ch.inputB]<ch.inputAmtB) ok=false;
      if (ok) {
        if(ch.input)  state.resources[ch.input]=Math.max(0,state.resources[ch.input]-ch.inputAmt);
        if(ch.inputB) state.resources[ch.inputB]=Math.max(0,state.resources[ch.inputB]-ch.inputAmtB);
        state.resources[ch.output]=Math.min(999,(state.resources[ch.output]||0)+ch.outputAmt);
      }
      tm.elapsed=0;
      for (var j=0;j<state.villagers.length;j++)
        if(state.villagers[j].buildingId===bld.id) state.villagers[j].progress=0;
    }
  }
  if (state.tick%60===0){ updateResourceDisplay(); checkNewVillager(); }
  if (state.tick%(DAY_PHASE_FRAMES*4)===0){
    state.day++;
    var el=document.getElementById('time-chip');
    if(el) el.textContent='🌤 Tag '+state.day;
  }
}

// ── VILLAGER SYSTEM ────────────────────────────────────────
function checkNewVillager() {
  for (var i=0;i<VILLAGER_POOL.length;i++) {
    var vp=VILLAGER_POOL[i];
    if (state.prevXP<vp.reqXP&&state.xp>=vp.reqXP) {
      var hired=false;
      for (var j=0;j<state.villagers.length;j++) if(state.villagers[j].name===vp.name){hired=true;break;}
      if (!hired) showVillagerPopup(vp.emoji,vp.name);
    }
  }
  if (state.villagers.length>=VILLAGER_POOL.length) {
    var idx=state.villagers.length, thr=getExtraVillagerXP(idx);
    if (state.prevXP<thr&&state.xp>=thr) showVillagerPopup(generateExtraVillager(idx).emoji,generateExtraVillager(idx).name);
  }
  updateLevelDisplay(); state.prevXP=state.xp;
}
function showVillagerPopup(emoji,name){
  document.getElementById('hire-popup-title').textContent='🎉 Neuer Mitarbeiter!';
  document.getElementById('hire-popup-desc').textContent=emoji+' '+name+' möchte deinem Dorf beitreten!\nIn der Sidebar "Einstellen" klicken.';
  document.getElementById('hire-popup').style.display='block';
}
function closeHirePopup(){document.getElementById('hire-popup').style.display='none';}
function generateExtraVillager(idx){
  var skins=['#f4c490','#e8a870','#c8906a','#f0d0a0','#f8e0c0','#d0a880','#c09060'];
  var hairs=['#8b4a1a','#3a2010','#1a0a00','#c8a030','#e8c840','#202020','#c05020'];
  return{name:VILLAGER_NAMES_EXTRA[idx%VILLAGER_NAMES_EXTRA.length],
         emoji:VILLAGER_EMOJIS[idx%VILLAGER_EMOJIS.length],
         skin:skins[idx%skins.length],hair:hairs[idx%hairs.length],
         shirt:VILLAGER_SHIRTS[idx%VILLAGER_SHIRTS.length],
         pants:VILLAGER_PANTS[idx%VILLAGER_PANTS.length],
         reqXP:getExtraVillagerXP(idx)};
}
function hireVillager(idx){
  var vp=idx<VILLAGER_POOL.length?VILLAGER_POOL[idx]:generateExtraVillager(idx);
  if(state.xp<vp.reqXP){showNotif('Zu wenig XP!');return;}
  for(var i=0;i<state.villagers.length;i++) if(state.villagers[i].name===vp.name){showNotif(vp.name+' ist schon da!');return;}
  var s=randomWalkTarget();
  state.villagers.push({id:state.nextVillagerId++,name:vp.name,emoji:vp.emoji,
    skin:vp.skin,hair:vp.hair,shirt:vp.shirt,pants:vp.pants,
    task:'Idle',hunger:MAX_HUNGER,x:s.x,y:s.y,tx:s.x,ty:s.y,
    vx:0,vy:0,buildingId:null,progress:0,anim:0});
  showNotif(vp.name+' ist beigetreten! 🎉'); renderSidebar(); renderActiveTab();
}

// ── LEVEL ──────────────────────────────────────────────────
function updateLevelDisplay(){
  var lvl=getLevel(state.xp), nxt=getXPForNextLevel(state.xp), prev=LEVEL_THRESHOLDS[lvl-1]||0;
  var el=document.getElementById('level-chip'); if(el) el.textContent='🏅 Lvl '+lvl;
  var fl=document.getElementById('level-bar-fill');
  if(fl){var p=nxt?Math.round(((state.xp-prev)/(nxt-prev))*100):100;fl.style.width=p+'%';}
  var ce=document.getElementById('casino-unlock-hint'); if(ce) ce.style.display=lvl>=5?'none':'block';
}

// ── BEWEGUNG v7.2 – Wandering AI für Idle-Villager ────────
function moveVillagers() {
  for (var i=0;i<state.villagers.length;i++) {
    var v=state.villagers[i];

    if (v.buildingId!==null) {
      // Arbeitend → zum Gebäude
      for (var j=0;j<state.buildings.length;j++)
        if(state.buildings[j].id===v.buildingId){v.tx=state.buildings[j].col;v.ty=state.buildings[j].row;break;}
    } else {
      // Idle → Wandering AI
      var ddx=v.x-v.tx, ddy=v.y-v.ty;
      if (Math.sqrt(ddx*ddx+ddy*ddy)<ARRIVE_DIST) {
        v._wf=(v._wf||0)+1;
        // Variable Wartezeit 100–280 Frames (~1.7–4.6s) je Villager-ID
        if (v._wf > 100+(v.id*53%180)) {
          var wt=randomVillageWander(v); v.tx=wt.x; v.ty=wt.y; v._wf=0;
        }
      }
    }

    var ex=v.tx-v.x, ey=v.ty-v.y, d=Math.sqrt(ex*ex+ey*ey);
    var slowF=Math.min(1,d*2);
    if (d>ARRIVE_DIST){ v.vx+=(ex/d)*ACCEL*slowF; v.vy+=(ey/d)*ACCEL*slowF; }
    v.vx*=FRICTION; v.vy*=FRICTION;
    var vm=Math.sqrt(v.vx*v.vx+v.vy*v.vy), maxSpd=0.018;
    if (vm>maxSpd){ v.vx=(v.vx/vm)*maxSpd; v.vy=(v.vy/vm)*maxSpd; }
    var nx=v.x+v.vx, ny=v.y+v.vy;
    if      (isTileWalkable(Math.round(nx),Math.round(ny))){v.x=nx;v.y=ny;}
    else if (isTileWalkable(Math.round(nx),Math.round(v.y))){v.x=nx;v.vy=0;}
    else if (isTileWalkable(Math.round(v.x),Math.round(ny))){v.y=ny;v.vx=0;}
    else    {v.vx=0;v.vy=0; var wt2=randomVillageWander(v);v.tx=wt2.x;v.ty=wt2.y;}
    v.x=Math.max(.5,Math.min(COLS-1.5,v.x));
    v.y=Math.max(.5,Math.min(ROWS-1.5,v.y));
  }
}

// ── GEBÄUDE PLATZIEREN ────────────────────────────────────
function placeBuilding(col,row){
  var type=state.buildMode, bt=BUILDING_TYPES[type]; if(!bt) return;
  if(bt.reqLevel&&getLevel(state.xp)<bt.reqLevel){showNotif('Casino erfordert Level '+bt.reqLevel+'!');state.buildMode=null;state.hoverTile=null;renderActiveTab();return;}
  if(state.xp<bt.reqXP){showNotif('Benötigt ⭐'+bt.reqXP+' XP');state.buildMode=null;state.hoverTile=null;renderActiveTab();return;}
  if(state.resources.wood<bt.costWood||state.resources.stone<bt.costStone){showNotif('Nicht genug Ressourcen! 🪵'+bt.costWood+' 🪨'+bt.costStone);state.buildMode=null;state.hoverTile=null;renderActiveTab();return;}
  for(var i=0;i<state.buildings.length;i++) if(state.buildings[i].col===col&&state.buildings[i].row===row){showNotif('Bereits belegt!');return;}
  if(col<0||row<0||col>=COLS||row>=ROWS){showNotif('Ausserhalb!');return;}
  if(TMAP&&TMAP[row]&&TMAP[row][col]===3){showNotif('Nicht auf Wasser!');return;}
  state.resources.wood-=bt.costWood; state.resources.stone-=bt.costStone;
  var mx=0; for(var i=0;i<state.buildings.length;i++) if(state.buildings[i].id>mx) mx=state.buildings[i].id;
  state.buildings.push({id:mx+1,type:type,col:col,row:row});
  state.buildMode=null; state.hoverTile=null;
  for(var i=0;i<state.villagers.length;i++){
    var v=state.villagers[i];
    if(Math.round(v.x)===col&&Math.round(v.y)===row){var wt=randomWalkTarget();v.tx=wt.x;v.ty=wt.y;}
  }
  updateResourceDisplay(); renderActiveTab(); showNotif(bt.name+' gebaut! ✅'); saveGame();
}

// ── AUFTRAG ───────────────────────────────────────────────
function fulfillOrder(orderId){
  var order=null;
  for(var i=0;i<state.orders.length;i++) if(state.orders[i].id===orderId){order=state.orders[i];break;}
  if(!order) return;
  for(var res in order.items) if((state.resources[res]||0)<order.items[res]){showNotif('Nicht genug '+res+'!');return;}
  for(var res in order.items) state.resources[res]=Math.max(0,state.resources[res]-order.items[res]);
  networkFulfillOrder(orderId); updateResourceDisplay();
}

// ── DISPLAY ───────────────────────────────────────────────
function updateResourceDisplay(){
  var ids={wood:'res-wood',stone:'res-stone',wheat:'res-wheat',soup:'res-soup',furniture:'res-furniture',brick:'res-brick',tool:'res-tool'};
  for(var k in ids){var el=document.getElementById(ids[k]);if(el) el.textContent=state.resources[k]||0;}
  var xe=document.getElementById('xp-val'); if(xe) xe.textContent=state.xp;
  var ce=document.getElementById('coins-val'); if(ce) ce.textContent=state.coins;
  updateLevelDisplay();
}
