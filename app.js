const NUM_PANES=3, LEDS_PER_PANE=16, NUM_PIXELS=48;
const effects=["Wipe","Comet","Gradient","Wave","Flame","Physics Bounce","Fade In","Fade Out","Fade In + Out","Shimmer In","Shimmer Out"];
const dirs=["left_to_right","right_to_left","center_out","edges_in"];
const scopes=["All LEDs","Pane 1","Pane 2","Pane 3"];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blankFrame=(sec=1)=>({leds:Array(NUM_PIXELS).fill("#000000"),duration_sec:sec});
const blankGroup=(name="New Group")=>({name,frames:[blankFrame()]});
const blankSection=(name="Section 1")=>({name,groups:[blankGroup("Scene 1")]});
const deep=x=>structuredClone(x);
const hexRgb=h=>{h=h.replace("#","");return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
const rgbHex=a=>"#"+a.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,"0")).join("").toUpperCase();
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const mix=(a,b,t)=>rgbHex(lerp(hexRgb(a),hexRgb(b),t));
const scale=(c,t)=>rgbHex(hexRgb(c).map(v=>v*t));
const smooth=t=>t*t*(3-2*t);

const state={
  sections:[blankSection()],
  cur:{s:0,g:0,f:0},
  openSection:0, openGroup:"0:0",
  selected:new Set(), paintMode:"brush", brush:"#FF5005",
  undo:[], playing:false, playRAF:null, playStart:0, playIndex:0,
  multiSelect:false, treeSelection:[],
  effect:{
    type:"Wipe", randomMode:"None", mode:"insert", destination:"Start new group",
    groupName:"Wipe", existingGroup:"0:0", newSection:0,
    values:{frames:18,seconds:.07,width:4,tail:6,wavelength:12,gravity:18,ball_size:4,restitution:.78,offset:0,intensity:.85,direction:"left_to_right",scope:"All LEDs",hold_sec:1,color1:"#FFFFFF",color2:"#004CFF",color_transition:false},
    ranges:{}
  }
};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const status=t=>{$("#status").textContent=t||""};
function currentSection(){return state.sections[state.cur.s]}
function currentGroup(){return currentSection().groups[state.cur.g]}
function currentFrame(){return currentGroup().frames[state.cur.f]}
function flatRefs(){
  const out=[]; state.sections.forEach((s,si)=>s.groups.forEach((g,gi)=>g.frames.forEach((f,fi)=>out.push({s:si,g:gi,f:fi,frame:f}))));
  return out;
}
function validate(){
  if(!state.sections.length) state.sections=[blankSection()];
  state.cur.s=clamp(state.cur.s,0,state.sections.length-1);
  let gs=currentSection().groups;if(!gs.length)gs.push(blankGroup());
  state.cur.g=clamp(state.cur.g,0,gs.length-1);
  let fs=currentGroup().frames;if(!fs.length)fs.push(blankFrame());
  state.cur.f=clamp(state.cur.f,0,fs.length-1);
}
function snapshot(label){
  state.undo.push({label,sections:deep(state.sections),cur:{...state.cur},openSection:state.openSection,openGroup:state.openGroup});
  if(state.undo.length>50)state.undo.shift();
  $("#undoBtn").disabled=false;
}
function undo(){
  const u=state.undo.pop(); if(!u)return;
  state.sections=u.sections;state.cur=u.cur;state.openSection=u.openSection;state.openGroup=u.openGroup;state.selected.clear();validate();render();
  $("#undoBtn").disabled=!state.undo.length;status("Undid: "+u.label);
}
function normalizeFrame(f){
  let dur=Number(f.duration_sec??((f.duration??1000)/1000));if(!Number.isFinite(dur))dur=1;dur=clamp(dur,.02,60);
  let leds;
  if(Array.isArray(f.leds)&&f.leds.length===48)leds=[...f.leds];
  else if(Array.isArray(f.colors)&&f.colors.length===3)leds=f.colors.flatMap(c=>Array(16).fill(c));
  else if(Array.isArray(f.colors)&&f.colors.length===48)leds=[...f.colors];
  else leds=Array(48).fill("#000000");
  return {leds,duration_sec:dur};
}
function render(){
  validate();renderStage();renderTree();renderMeta();
}
function renderMeta(){
  const refs=flatRefs(),idx=refs.findIndex(r=>r.s===state.cur.s&&r.g===state.cur.g&&r.f===state.cur.f);
  $("#frameCounter").textContent=`Frame ${idx+1} / ${refs.length}`;
  $("#frameBreadcrumb").textContent=`${currentSection().name} / ${currentGroup().name} / Frame ${state.cur.f+1}`;
  $("#durationInput").value=Number(currentFrame().duration_sec.toFixed(3));
  $("#brushColor").value=state.brush.toLowerCase();
}
function renderStage(override=null){
  const stage=$("#ledStage");stage.innerHTML="";
  const leds=override||currentFrame().leds;
  for(let p=0;p<3;p++){
    const pane=document.createElement("div");pane.className="pane";
    pane.innerHTML=`<div class="pane-title">Pane ${p+1}</div><div class="led-row"></div>`;
    const row=pane.querySelector(".led-row");
    for(let j=0;j<16;j++){
      const i=p*16+j,el=document.createElement("div");el.className="led"+(state.selected.has(i)?" selected":"");
      el.dataset.index=i;el.style.setProperty("--led-color",leds[i]);row.appendChild(el);
    }
    stage.appendChild(pane);
  }
}
function renderTree(){
  const tree=$("#tree");tree.innerHTML="";
  state.sections.forEach((s,si)=>{
    tree.appendChild(treeRow("section",{s:si},s.name,`${s.groups.length} groups`,state.openSection===si));
    if(state.openSection!==si)return;
    s.groups.forEach((g,gi)=>{
      const key=`${si}:${gi}`,open=state.openGroup===key;
      tree.appendChild(treeRow("group",{s:si,g:gi},g.name,`${g.frames.length}`,open));
      if(!open)return;
      g.frames.forEach((f,fi)=>tree.appendChild(treeRow("frame",{s:si,g:gi,f:fi},`Frame ${String(fi+1).padStart(3,"0")}`,`${f.duration_sec.toFixed(3)}s`,false)));
    });
  });
}
function treeRow(type,pos,name,count,open){
  const d=document.createElement("div");d.className=`tree-row ${type}`;
  d.dataset.type=type;Object.entries(pos).forEach(([k,v])=>d.dataset[k]=v);
  const key=treeKey(type,pos);
  const selected=state.multiSelect ? state.treeSelection.includes(key) :
    ((type==="section"&&state.cur.s===pos.s)||(type==="group"&&state.cur.s===pos.s&&state.cur.g===pos.g)||(type==="frame"&&state.cur.s===pos.s&&state.cur.g===pos.g&&state.cur.f===pos.f));
  if(selected)d.classList.add("selected");
  const disc=document.createElement("button");disc.className="disclosure";
  disc.textContent=type==="frame"?"•":(open?"−":"+");
  disc.addEventListener("click",e=>{e.stopPropagation();toggleOpen(type,pos)});
  const nm=document.createElement("div");nm.className="tree-name";nm.textContent=name;
  const ct=document.createElement("span");ct.className="count";ct.textContent=count;
  d.append(disc,nm,ct);
  d.addEventListener("click",()=>state.multiSelect?toggleTreeSelection(type,pos):selectTree(type,pos));
  return d;
}

function treeKey(type,pos){
  if(type==="section")return `s:${pos.s}`;
  if(type==="group")return `g:${pos.s}:${pos.g}`;
  return `f:${pos.s}:${pos.g}:${pos.f}`;
}
function parseTreeKey(key){
  const p=key.split(":");
  if(p[0]==="s")return {type:"section",s:+p[1]};
  if(p[0]==="g")return {type:"group",s:+p[1],g:+p[2]};
  return {type:"frame",s:+p[1],g:+p[2],f:+p[3]};
}
function toggleTreeSelection(type,pos){
  const key=treeKey(type,pos),i=state.treeSelection.indexOf(key);
  if(i>=0)state.treeSelection.splice(i,1);else state.treeSelection.push(key);
  $("#selectionHint").textContent=`${state.treeSelection.length} selected`;
  renderTree();
}
function toggleMultiSelect(){
  state.multiSelect=!state.multiSelect;
  state.treeSelection=[];
  $("#multiSelectBtn").textContent=state.multiSelect?"Done":"Select Multiple";
  $("#selectionHint").textContent=state.multiSelect?"Tap items to add/remove":"tap to select";
  renderTree();
}
function selectedTreeItemsSameType(){
  const items=state.treeSelection.map(parseTreeKey);
  if(!items.length)return [];
  const type=items[0].type;
  return items.filter(x=>x.type===type);
}
function toggleOpen(type,pos){
  if(type==="section"){state.openSection=pos.s;state.openGroup=`${pos.s}:0`;state.cur.s=pos.s;state.cur.g=0;state.cur.f=0}
  else if(type==="group"){state.openSection=pos.s;state.openGroup=`${pos.s}:${pos.g}`;state.cur={s:pos.s,g:pos.g,f:0}}
  render();
}
function selectTree(type,pos){
  if(type==="section"){state.cur={s:pos.s,g:0,f:0};state.openSection=pos.s}
  else if(type==="group"){state.cur={s:pos.s,g:pos.g,f:0};state.openSection=pos.s;state.openGroup=`${pos.s}:${pos.g}`}
  else state.cur={s:pos.s,g:pos.g,f:pos.f};
  state.selected.clear();render();
}
function activeLevel(){
  const active=$("#tree .tree-row.selected");return active?.dataset.type||"frame";
}

function deleteSelectedMulti(){
  if(!state.multiSelect||!state.treeSelection.length){deleteContext();return}
  const items=selectedTreeItemsSameType();if(!items.length)return;
  snapshot("delete selected");
  if(items[0].type==="section"){
    const idx=[...new Set(items.map(x=>x.s))].sort((a,b)=>b-a);
    if(idx.length>=state.sections.length){state.undo.pop();alert("At least one Section must remain.");return}
    idx.forEach(i=>state.sections.splice(i,1));
  }else if(items[0].type==="group"){
    const by={};items.forEach(x=>(by[x.s]??=[]).push(x.g));
    for(const [ss,arr] of Object.entries(by)){
      const s=+ss,a=state.sections[s].groups,idx=[...new Set(arr)].sort((x,y)=>y-x);
      if(idx.length>=a.length){state.undo.pop();alert("At least one Group must remain in each Section.");return}
      idx.forEach(i=>a.splice(i,1));
    }
  }else{
    const by={};items.forEach(x=>{const k=`${x.s}:${x.g}`;(by[k]??=[]).push(x.f)});
    for(const [k,arr] of Object.entries(by)){
      const [s,g]=k.split(":").map(Number),a=state.sections[s].groups[g].frames,idx=[...new Set(arr)].sort((x,y)=>y-x);
      if(idx.length>=a.length){state.undo.pop();alert("At least one Frame must remain in each Group.");return}
      idx.forEach(i=>a.splice(i,1));
    }
  }
  state.multiSelect=false;state.treeSelection=[];
  $("#multiSelectBtn").textContent="Select Multiple";$("#selectionHint").textContent="tap to select";
  state.cur={s:0,g:0,f:0};state.openSection=0;state.openGroup="0:0";
  render();
}
function moveSelected(delta){
  const items=selectedTreeItemsSameType();if(!items.length)return;
  const type=items[0].type;snapshot("move selected "+type);
  if(type==="section"){
    let idx=[...new Set(items.map(x=>x.s))].sort((a,b)=>a-b);
    if(delta<0){
      for(const i of idx){if(i<=0||idx.includes(i-1))continue;[state.sections[i-1],state.sections[i]]=[state.sections[i],state.sections[i-1]]}
      idx=idx.map(i=>Math.max(0,i-1));
    }else{
      for(const i of [...idx].reverse()){if(i>=state.sections.length-1||idx.includes(i+1))continue;[state.sections[i+1],state.sections[i]]=[state.sections[i],state.sections[i+1]]}
      idx=idx.map(i=>Math.min(state.sections.length-1,i+1));
    }
    state.treeSelection=idx.map(i=>`s:${i}`);
  }else if(type==="group"){
    const by={};items.forEach(x=>(by[x.s]??=[]).push(x.g));const next=[];
    for(const [ss,arr] of Object.entries(by)){
      const s=+ss,a=state.sections[s].groups;let idx=[...new Set(arr)].sort((x,y)=>x-y);
      if(delta<0){
        for(const i of idx){if(i<=0||idx.includes(i-1))continue;[a[i-1],a[i]]=[a[i],a[i-1]]}
        idx=idx.map(i=>Math.max(0,i-1));
      }else{
        for(const i of [...idx].reverse()){if(i>=a.length-1||idx.includes(i+1))continue;[a[i+1],a[i]]=[a[i],a[i+1]]}
        idx=idx.map(i=>Math.min(a.length-1,i+1));
      }
      idx.forEach(i=>next.push(`g:${s}:${i}`));
    }
    state.treeSelection=next;
  }else{
    const by={};items.forEach(x=>{const k=`${x.s}:${x.g}`;(by[k]??=[]).push(x.f)});const next=[];
    for(const [k,arr] of Object.entries(by)){
      const [s,g]=k.split(":").map(Number),a=state.sections[s].groups[g].frames;let idx=[...new Set(arr)].sort((x,y)=>x-y);
      if(delta<0){
        for(const i of idx){if(i<=0||idx.includes(i-1))continue;[a[i-1],a[i]]=[a[i],a[i-1]]}
        idx=idx.map(i=>Math.max(0,i-1));
      }else{
        for(const i of [...idx].reverse()){if(i>=a.length-1||idx.includes(i+1))continue;[a[i+1],a[i]]=[a[i],a[i+1]]}
        idx=idx.map(i=>Math.min(a.length-1,i+1));
      }
      idx.forEach(i=>next.push(`f:${s}:${g}:${i}`));
    }
    state.treeSelection=next;
  }
  renderTree();$("#selectionHint").textContent=`${state.treeSelection.length} selected`;
}
function moveCurrent(delta){
  const level=activeLevel();snapshot("move "+level);
  if(level==="section"){
    const i=state.cur.s,j=i+delta;if(j<0||j>=state.sections.length){state.undo.pop();return}
    [state.sections[i],state.sections[j]]=[state.sections[j],state.sections[i]];state.cur.s=j;state.openSection=j;state.openGroup=`${j}:0`;
  }else if(level==="group"){
    const a=currentSection().groups,i=state.cur.g,j=i+delta;if(j<0||j>=a.length){state.undo.pop();return}
    [a[i],a[j]]=[a[j],a[i]];state.cur.g=j;state.openGroup=`${state.cur.s}:${j}`;
  }else{
    const a=currentGroup().frames,i=state.cur.f,j=i+delta;if(j<0||j>=a.length){state.undo.pop();return}
    [a[i],a[j]]=[a[j],a[i]];state.cur.f=j;
  }
  render();
}

let paintPointer=false, selectAdd=true;
$("#ledStage").addEventListener("pointerdown",e=>{
  const led=e.target.closest(".led");if(!led)return;
  e.preventDefault();paintPointer=true;led.setPointerCapture?.(e.pointerId);
  const i=+led.dataset.index,mode=state.paintMode;
  if(mode==="brush"||mode==="erase")snapshot(mode+" stroke");
  if(mode==="select")selectAdd=!state.selected.has(i);
  applyPaint(i);
});
$("#ledStage").addEventListener("pointermove",e=>{
  if(!paintPointer)return;const led=document.elementFromPoint(e.clientX,e.clientY)?.closest(".led");if(led)applyPaint(+led.dataset.index)
});
window.addEventListener("pointerup",()=>paintPointer=false);
function applyPaint(i){
  if(state.paintMode==="brush"){currentFrame().leds[i]=state.brush;state.selected.add(i)}
  else if(state.paintMode==="erase"){currentFrame().leds[i]="#000000";state.selected.add(i)}
  else selectAdd?state.selected.add(i):state.selected.delete(i);
  renderStage();
}

document.addEventListener("click",e=>{
  const b=e.target.closest("[data-action]");if(!b)return;const a=b.dataset.action;
  const actions={
    undo,play,stop,openEffects:openEffects,
    "new-frame":()=>{snapshot("add frame");currentGroup().frames.splice(state.cur.f+1,0,blankFrame());state.cur.f++;render()},
    duplicate:duplicateContext,delete:deleteContext,"new-group":newGroup,"new-section":newSection,rename:renameContext,
    "prev-frame":()=>navigateFrame(-1),"next-frame":()=>navigateFrame(1),
    "color-selected":colorSelected,"select-all":()=>{state.selected=new Set([...Array(48).keys()]);renderStage()},
    "clear-selection":()=>{state.selected.clear();renderStage()},
    effects:openEffects,"close-effects":closeEffects,"generate-effect":generateEffect,
    "move-up":()=>state.multiSelect?moveSelected(-1):moveCurrent(-1),"move-down":()=>state.multiSelect?moveSelected(1):moveCurrent(1),
    "toggle-multiselect":toggleMultiSelect,"delete-selected":deleteSelectedMulti,
    "save-json":saveJSON,"generate-arduino":showArduino,"export-ino":exportINO,
    "close-code":()=>$("#codeSheet").classList.add("hidden"),"copy-code":copyCode
  };
  actions[a]?.();
});
$("#paintModes").addEventListener("click",e=>{
  const b=e.target.closest("[data-mode]");if(!b)return;state.paintMode=b.dataset.mode;
  $$("#paintModes button").forEach(x=>x.classList.toggle("active",x===b))
});
$("#brushColor").addEventListener("input",e=>state.brush=e.target.value.toUpperCase());
$("#durationInput").addEventListener("change",e=>{
  const v=clamp(Number(e.target.value)||1,.02,60);if(Math.abs(v-currentFrame().duration_sec)<1e-9)return;
  snapshot("change duration");currentFrame().duration_sec=v;render();
});
$("#loadJson").addEventListener("change",loadJSONFile);

function duplicateContext(){
  const level=activeLevel();snapshot("duplicate "+level);
  if(level==="section"){state.sections.splice(state.cur.s+1,0,deep(currentSection()));state.cur.s++;state.cur.g=0;state.cur.f=0;state.openSection=state.cur.s;state.openGroup=`${state.cur.s}:0`}
  else if(level==="group"){currentSection().groups.splice(state.cur.g+1,0,deep(currentGroup()));state.cur.g++;state.cur.f=0;state.openGroup=`${state.cur.s}:${state.cur.g}`}
  else{currentGroup().frames.splice(state.cur.f+1,0,deep(currentFrame()));state.cur.f++}
  render();
}
function deleteContext(){
  const level=activeLevel();snapshot("delete "+level);
  if(level==="section"){if(state.sections.length===1){state.undo.pop();return}state.sections.splice(state.cur.s,1);state.cur.s=clamp(state.cur.s,0,state.sections.length-1);state.cur.g=state.cur.f=0}
  else if(level==="group"){const a=currentSection().groups;if(a.length===1){state.undo.pop();return}a.splice(state.cur.g,1);state.cur.g=clamp(state.cur.g,0,a.length-1);state.cur.f=0}
  else{const a=currentGroup().frames;if(a.length===1){state.undo.pop();return}a.splice(state.cur.f,1);state.cur.f=clamp(state.cur.f,0,a.length-1)}
  state.openSection=state.cur.s;state.openGroup=`${state.cur.s}:${state.cur.g}`;render();
}
function newGroup(){const n=prompt("Group name","New Group");if(!n)return;snapshot("new group");currentSection().groups.splice(state.cur.g+1,0,blankGroup(n));state.cur.g++;state.cur.f=0;state.openGroup=`${state.cur.s}:${state.cur.g}`;render()}
function newSection(){const n=prompt("Section name","New Section");if(!n)return;snapshot("new section");state.sections.splice(state.cur.s+1,0,blankSection(n));state.cur.s++;state.cur.g=state.cur.f=0;state.openSection=state.cur.s;state.openGroup=`${state.cur.s}:0`;render()}
function renameContext(){
  const l=activeLevel();if(l==="frame"){alert("Frames are numbered automatically.");return}
  const old=l==="section"?currentSection().name:currentGroup().name,n=prompt(`Rename ${l}`,old);if(!n||n===old)return;snapshot("rename "+l);
  if(l==="section")currentSection().name=n;else currentGroup().name=n;render();
}
function navigateFrame(delta){
  const refs=flatRefs(),idx=refs.findIndex(r=>r.s===state.cur.s&&r.g===state.cur.g&&r.f===state.cur.f),n=clamp(idx+delta,0,refs.length-1),r=refs[n];
  state.cur={s:r.s,g:r.g,f:r.f};state.openSection=r.s;state.openGroup=`${r.s}:${r.g}`;state.selected.clear();render();
}
function colorSelected(){
  if(!state.selected.size)return;const c=prompt("Hex color",state.brush);if(!/^#[0-9a-f]{6}$/i.test(c||""))return;
  snapshot("color selected LEDs");state.brush=c.toUpperCase();for(const i of state.selected)currentFrame().leds[i]=state.brush;render();
}

function flattenStatic(){
  return flatRefs().map(x=>x.frame)
}
function play(){
  if(state.playing)return;state.playing=true;state.playIndex=flatRefs().findIndex(r=>r.s===state.cur.s&&r.g===state.cur.g&&r.f===state.cur.f);state.playStart=performance.now();state.playProgress=0;tick();
}
function stop(){state.playing=false;if(state.playRAF)cancelAnimationFrame(state.playRAF);renderStage()}
function tick(now=performance.now()){
  if(!state.playing)return;const fs=flattenStatic();if(!fs.length)return;
  const dt=(now-state.playStart)/1000;state.playStart=now;let dur=fs[state.playIndex].duration_sec;state.playProgress+=dt/Math.max(.02,dur);
  while(state.playProgress>=1){state.playProgress--;state.playIndex=(state.playIndex+1)%fs.length;dur=fs[state.playIndex].duration_sec}
  const a=fs[state.playIndex],b=fs[(state.playIndex+1)%fs.length],t=smooth(state.playProgress);
  renderStage(a.leds.map((c,i)=>mix(c,b.leds[i],t)));state.playRAF=requestAnimationFrame(tick);
}

/* ---------- Effects ---------- */
const effectType=$("#effectType");effects.forEach(x=>effectType.add(new Option(x,x)));
const randomMode=$("#randomMode"), effectMode=$("#effectMode"), effectDestination=$("#effectDestination");
effectType.addEventListener("change",()=>{state.effect.type=effectType.value;state.effect.groupName=effectType.value;renderEffectFields()});
randomMode.addEventListener("change",()=>{state.effect.randomMode=randomMode.value;renderEffectFields()});
effectMode.addEventListener("change",()=>state.effect.mode=effectMode.value);
effectDestination.addEventListener("change",()=>{state.effect.destination=effectDestination.value;renderDestination()});

function openEffects(){
  effectType.value=state.effect.type;randomMode.value=state.effect.randomMode;effectMode.value=state.effect.mode;effectDestination.value=state.effect.destination;
  state.effect.groupName=state.effect.type;renderDestination();renderEffectFields();$("#effectSheet").classList.remove("hidden");requestAnimationFrame(()=>{$("#effectSheet .sheet-scroll").scrollTop=0});
}
function closeEffects(){$("#effectSheet").classList.add("hidden")}
function groupOptions(){const out=[];state.sections.forEach((s,si)=>s.groups.forEach((g,gi)=>out.push({value:`${si}:${gi}`,label:`${s.name} / ${g.name}`})));return out}
function renderDestination(){
  const d=$("#destinationFields");d.innerHTML=`<div class="form-section"><h3>Destination</h3></div>`;const box=d.firstChild;
  if(state.effect.destination==="Start new group"){
    box.append(field("Group name",input("text",state.effect.groupName,v=>state.effect.groupName=v)));
    const sel=document.createElement("select");state.sections.forEach((s,i)=>sel.add(new Option(s.name,i)));sel.value=state.cur.s;sel.onchange=()=>state.effect.newSection=+sel.value;
    box.append(field("Section",sel));
  }else{
    const sel=document.createElement("select");groupOptions().forEach(o=>sel.add(new Option(o.label,o.value)));sel.value=state.effect.existingGroup||`${state.cur.s}:${state.cur.g}`;sel.onchange=()=>state.effect.existingGroup=sel.value;
    box.append(field("Existing group",sel));
  }
}
function field(label,control){const r=document.createElement("div");r.className="field-row";r.innerHTML=`<label>${label}</label>`;r.append(control);return r}
function input(type,value,onchange,attrs={}){const x=document.createElement("input");x.type=type;x.value=value??"";Object.assign(x,attrs);x.onchange=()=>onchange(x.value);return x}
function select(value,options,onchange){const x=document.createElement("select");options.forEach(o=>x.add(new Option(o,o)));x.value=value;x.onchange=()=>onchange(x.value);return x}
function checkbox(value,onchange){const x=document.createElement("input");x.type="checkbox";x.checked=!!value;x.onchange=()=>onchange(x.checked);return x}
function colorInput(value,onchange){const x=document.createElement("input");x.type="color";x.value=value.toLowerCase();x.oninput=()=>onchange(x.value.toUpperCase());return x}
const applicable={
  Wipe:[["Direction","direction","choice",dirs],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Width","width","number"],["Offset","offset","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  Comet:[["Direction","direction","choice",dirs],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Head width","width","number"],["Tail length","tail","number"],["Offset","offset","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  Gradient:[["Direction","direction","choice",dirs],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Offset","offset","number"],["Color 1","color1","color"],["Color 2","color2","color"]],
  Wave:[["Direction","direction","choice",dirs],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Wavelength","wavelength","number"],["Peak width","width","number"],["Offset","offset","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  Flame:[["Frames","frames","number"],["Seconds/frame","seconds","number"],["Intensity","intensity","number"],["Offset","offset","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  "Physics Bounce":[["Direction","direction","choice",["left_to_right","right_to_left"]],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Gravity","gravity","number"],["Ball size","ball_size","number"],["Restitution","restitution","number"],["Start offset","offset","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  "Fade In":[["Scope","scope","choice",scopes],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  "Fade Out":[["Scope","scope","choice",scopes],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  "Fade In + Out":[["Scope","scope","choice",scopes],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Hold seconds","hold_sec","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  "Shimmer In":[["Scope","scope","choice",scopes],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Intensity","intensity","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]],
  "Shimmer Out":[["Scope","scope","choice",scopes],["Frames","frames","number"],["Seconds/frame","seconds","number"],["Intensity","intensity","number"],["Color transition","color_transition","bool"],["Color 1","color1","color"],["Color 2","color2","color"]]
};
function renderEffectFields(){
  const root=$("#effectFields");root.innerHTML="";const sec=document.createElement("div");sec.className="form-section";sec.innerHTML=`<h3>${state.effect.type}</h3>`;root.append(sec);
  const rmode=state.effect.randomMode;
  if(rmode==="Randomize Everything"){sec.insertAdjacentHTML("beforeend",`<p class="muted">Arduino chooses the effect and all applicable parameters each time it starts. The preview is only a sample.</p>`);return}
  if(rmode==="Randomize Chosen Effect"){
    sec.insertAdjacentHTML("beforeend",`<p class="muted">Blank MIN/MAX = built-in runtime range. One side only = locked value. Both filled = Arduino randomizes between them on every startup.</p>`);
    for(const [label,key,type,opts] of applicable[state.effect.type])sec.append(minMaxRow(label,key,type,opts));
    return;
  }
  for(const [label,key,type,opts] of applicable[state.effect.type]){
    if(rmode==="Random Color"&&(type==="color"||type==="bool"&&key==="color_transition"))continue;
    sec.append(normalRow(label,key,type,opts));
  }
}
function normalRow(label,key,type,opts){
  let c,v=state.effect.values[key];
  if(type==="choice")c=select(v,opts,x=>state.effect.values[key]=x);
  else if(type==="bool")c=checkbox(v,x=>state.effect.values[key]=x);
  else if(type==="color")c=colorInput(v,x=>state.effect.values[key]=x);
  else c=input("number",v,x=>state.effect.values[key]=Number(x),{step:"any"});
  return field(label,c);
}
function minMaxRow(label,key,type,opts){
  const r=document.createElement("div");r.className="field-row";r.innerHTML=`<label>${label}</label>`;const mm=document.createElement("div");mm.className="minmax";
  state.effect.ranges[key]??=["",""];
  for(let i=0;i<2;i++){
    const lab=document.createElement("label");lab.textContent=i?"MAX":"MIN";let c;
    if(type==="choice"){c=select(state.effect.ranges[key][i],["",...opts],x=>state.effect.ranges[key][i]=x)}
    else if(type==="bool"){c=select(state.effect.ranges[key][i],["","Off","On"],x=>state.effect.ranges[key][i]=x)}
    else{c=input(type==="color"?"text":"number",state.effect.ranges[key][i],x=>state.effect.ranges[key][i]=x,{placeholder:type==="color"?"#RRGGBB":"",step:"any"})}
    lab.append(c);mm.append(lab)
  }
  r.append(mm);return r;
}
function effectColor(k,total){
  const v=state.effect.values;if(v.color_transition)return mix(v.color1,v.color2,k/Math.max(1,total-1));return v.color1;
}
function order(direction){
  let a=[...Array(48).keys()];if(direction==="right_to_left")return a.reverse();
  const c=23.5;if(direction==="center_out")return a.sort((x,y)=>Math.abs(x-c)-Math.abs(y-c));
  if(direction==="edges_in")return a.sort((x,y)=>Math.abs(y-c)-Math.abs(x-c));return a;
}
function scopeIdx(s){if(s==="All LEDs")return [...Array(48).keys()];const p=+s.slice(-1)-1;return [...Array(16).keys()].map(i=>p*16+i)}
function generateFrames(type,values=state.effect.values){
  const n=Math.max(2,Math.round(values.frames)),dur=Math.max(.02,Number(values.seconds)),out=[],ord=order(values.direction||"left_to_right");
  if(type==="Wipe"){
    for(let k=0;k<n;k++){const leds=Array(48).fill("#000000"),c=effectColor(k,n),st=Math.round(-values.width+(48+2*values.width)*k/Math.max(1,n-1))+Number(values.offset||0);for(let q=st;q<st+values.width;q++)if(q>=0&&q<48)leds[ord[q]]=c;out.push({leds,duration_sec:dur})}
  }else if(type==="Comet"){
    for(let k=0;k<n;k++){const leds=Array(48).fill("#000000"),c=effectColor(k,n),head=Math.round(-values.tail-values.width+(48+values.tail+2*values.width)*k/Math.max(1,n-1))+Number(values.offset||0);for(let q=head;q<head+values.width;q++)if(q>=0&&q<48)leds[ord[q]]=c;for(let d=1;d<=values.tail;d++){let q=head-d;if(q>=0&&q<48)leds[ord[q]]=scale(c,1-d/(values.tail+1))}out.push({leds,duration_sec:dur})}
  }else if(type==="Gradient"){
    for(let k=0;k<n;k++){const leds=Array(48).fill("#000000"),phase=(k+Number(values.offset||0))/n;for(let i=0;i<48;i++){const x=(i/47+phase)%1,t=.5-.5*Math.cos(2*Math.PI*x);leds[ord[i]]=mix(values.color1,values.color2,t)}out.push({leds,duration_sec:dur})}
  }else if(type==="Wave"){
    const sharp=Math.max(1,7/Math.max(1,values.width));for(let k=0;k<n;k++){const leds=Array(48).fill("#000000"),c=effectColor(k,n),phase=2*Math.PI*(k+Number(values.offset||0))/n;for(let i=0;i<48;i++){const amp=Math.pow((Math.sin(2*Math.PI*i/values.wavelength-phase)+1)/2,sharp);leds[ord[i]]=scale(c,amp)}out.push({leds,duration_sec:dur})}
  }else if(type==="Flame"){
    let prev=Array.from({length:48},()=>Math.random()*.5);for(let k=0;k<n;k++){const c=effectColor(k,n),base=hexRgb(c),leds=[],next=[];for(let i=0;i<48;i++){const nbr=[prev[i],...(i?[prev[i-1]]:[]),...(i<47?[prev[i+1]]:[])],heat=clamp((.68*nbr.reduce((a,b)=>a+b,0)/nbr.length+.32*Math.random())*values.intensity+.05,0,1);next.push(heat);leds.push(scale(c,heat))}prev=next;out.push({leds,duration_sec:dur})}
  }else if(type==="Physics Bounce"){
    let x=clamp(Number(values.offset||0),0,48-values.ball_size),v=Math.max(8,Math.sqrt(2*values.gravity*26));if(values.direction==="right_to_left"){v=-v;x=48-values.ball_size-x}
    for(let k=0;k<n;k++){const leds=Array(48).fill("#000000"),c=effectColor(k,n),s=Math.round(x);for(let q=s;q<s+values.ball_size;q++)if(q>=0&&q<48)leds[q]=c;out.push({leds,duration_sec:dur});v-=values.gravity*dur;x+=v*dur;const hi=48-values.ball_size;if(x<0){x=-x;v=Math.abs(v)*values.restitution}else if(x>hi){x=hi-(x-hi);v=-Math.abs(v)*values.restitution}}
  }else if(["Fade In","Fade Out"].includes(type)){
    const idx=scopeIdx(values.scope);for(let k=0;k<n;k++){let t=k/Math.max(1,n-1);if(type==="Fade Out")t=1-t;const leds=Array(48).fill("#000000"),c=effectColor(k,n);idx.forEach(i=>leds[i]=scale(c,t));out.push({leds,duration_sec:dur})}
  }else if(type==="Fade In + Out"){
    const idx=scopeIdx(values.scope),hold=Math.max(1,Math.round(values.hold_sec/dur)),total=n+hold+n;for(let k=0;k<total;k++){let level=k<n?k/Math.max(1,n-1):(k<n+hold?1:1-(k-n-hold)/Math.max(1,n-1));const leds=Array(48).fill("#000000"),c=values.color_transition?mix(values.color1,values.color2,k/Math.max(1,total-1)):values.color1;idx.forEach(i=>leds[i]=scale(c,clamp(level,0,1)));out.push({leds,duration_sec:dur})}
  }else if(type.startsWith("Shimmer")){
    const idx=scopeIdx(values.scope),inside=type==="Shimmer In";for(let k=0;k<n;k++){const p=k/Math.max(1,n-1),leds=Array(48).fill("#000000"),c=effectColor(k,n);if(inside&&k===n-1)idx.forEach(i=>leds[i]=c);else if(!inside&&k===n-1){}else{const env=inside?p:1-p,settle=inside?Math.pow(p,3):0;idx.forEach(i=>{const rand=clamp(env*(.35+.85*Math.random())*values.intensity,0,1),level=inside?(1-settle)*rand+settle*p:rand;leds[i]=scale(c,level)})}out.push({leds,duration_sec:dur})}
  }
  return out;
}
function sampleRandom(type){
  const v=deep(state.effect.values),fields=applicable[type];for(const [,key,kind,opts] of fields){
    const rr=state.effect.ranges[key]||["",""];let [mn,mx]=rr;if(mn&&!mx)mx=mn;if(mx&&!mn)mn=mx;
    if(!mn&&!mx){
      const defaults={frames:[12,36],seconds:[.04,.22],width:[2,9],tail:[3,13],wavelength:[6,24],gravity:[8,35],ball_size:[2,7],restitution:[.55,.95],offset:[-8,8],intensity:[.55,1],hold_sec:[.5,2]};
      if(kind==="choice")v[key]=opts[Math.floor(Math.random()*opts.length)];
      else if(kind==="bool")v[key]=Math.random()<.5;
      else if(kind==="color")v[key]=randomColor();
      else{const [a,b]=defaults[key]||[0,1];v[key]=a+Math.random()*(b-a);if(["frames","width","tail","ball_size","offset"].includes(key))v[key]=Math.round(v[key])}
    }else{
      if(kind==="choice"){let a=opts.indexOf(mn),b=opts.indexOf(mx);if(a>b)[a,b]=[b,a];v[key]=opts[a+Math.floor(Math.random()*(b-a+1))]}
      else if(kind==="bool"){v[key]=mn===mx?mn==="On":Math.random()<.5}
      else if(kind==="color"){v[key]=randomColorBetween(mn,mx)}
      else{let a=Number(mn),b=Number(mx);if(a>b)[a,b]=[b,a];v[key]=a+Math.random()*(b-a);if(["frames","width","tail","ball_size","offset"].includes(key))v[key]=Math.round(v[key])}
    }
  }return v;
}
function randomColor(){return rgbHex([Math.random()*255,Math.random()*255,Math.random()*255])}
function randomColorBetween(a,b){if(!a&&!b)return randomColor();if(a&&!b)b=a;if(b&&!a)a=b;const ar=hexRgb(a),br=hexRgb(b);return rgbHex(ar.map((v,i)=>Math.min(v,br[i])+Math.random()*Math.abs(br[i]-v)))}
function generateEffect(){
  let type=state.effect.type,values=deep(state.effect.values),preview,rr=null;
  if(state.effect.randomMode==="Randomize Everything"){type=effects[Math.floor(Math.random()*effects.length)];values=sampleRandom(type);preview=generateFrames(type,values);rr={mode:"random_everything",effect:type,params:{...runtimeParams(values),ranges:{}}}}
  else if(state.effect.randomMode==="Randomize Chosen Effect"){values=sampleRandom(type);preview=generateFrames(type,values);rr={mode:"random_effect_params",effect:type,params:{...runtimeParams(state.effect.values),ranges:deep(state.effect.ranges)}}}
  else if(state.effect.randomMode==="Random Color"){values.color1=randomColor();values.color2=values.color1;preview=generateFrames(type,values);rr={mode:"random_color",effect:type,params:{...runtimeParams(state.effect.values),ranges:{}}}}
  else preview=generateFrames(type,values);
  snapshot("generate "+type);
  if(rr){
    const g={name:state.effect.groupName||type,frames:preview,runtime_random:rr};currentSection().groups.splice(state.cur.g+1,0,g);state.cur.g++;state.cur.f=0;state.openGroup=`${state.cur.s}:${state.cur.g}`;
  }else if(state.effect.destination==="Add to existing group"){
    const [s,g]=(state.effect.existingGroup||`${state.cur.s}:${state.cur.g}`).split(":").map(Number),target=state.sections[s].groups[g];
    if(state.effect.mode==="overlay"){target.frames.forEach((f,i)=>preview[i%preview.length].leds.forEach((c,j)=>{if(c!=="#000000")f.leds[j]=c}));state.cur={s,g,f:0}}
    else{target.frames.push(...preview);state.cur={s,g,f:target.frames.length-preview.length}}
    state.openSection=s;state.openGroup=`${s}:${g}`;
  }else{
    const s=Number(state.effect.newSection??state.cur.s),g={name:state.effect.groupName||type,frames:preview};state.sections[s].groups.push(g);state.cur={s,g:state.sections[s].groups.length-1,f:0};state.openSection=s;state.openGroup=`${s}:${state.cur.g}`;
  }
  closeEffects();render();status(`Generated ${type}`);
}
function runtimeParams(v){return {frames:Math.round(v.frames),ms:Math.round(v.seconds*1000),width:Math.round(v.width),tail:Math.round(v.tail),wavelength:v.wavelength,gravity:v.gravity,ball_size:Math.round(v.ball_size),restitution:v.restitution,offset:Math.round(v.offset),intensity:v.intensity,direction:v.direction,scope:v.scope,hold_ms:Math.round(v.hold_sec*1000)}}

/* ---------- Save/load ---------- */
function saveJSON(){download("TV_LED_Project.json",JSON.stringify({version:"pwa-1",sections:state.sections},null,2),"application/json")}
async function loadJSONFile(e){
  const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());snapshot("load project");
    if(data.sections)state.sections=data.sections;
    else if(data.groups)state.sections=[{name:"Imported Section",groups:data.groups.map(g=>({name:g.name||"Group",frames:(g.frames||[]).map(normalizeFrame),...(g.runtime_random?{runtime_random:g.runtime_random}:{})}))}];
    else{const raw=data.frames||data;state.sections=[{name:"Imported Section",groups:[{name:"Imported Frames",frames:raw.map(normalizeFrame)}]}]}
    state.cur={s:0,g:0,f:0};state.openSection=0;state.openGroup="0:0";render();status("Project loaded");
  }catch(err){alert("Could not load project: "+err.message)}finally{e.target.value=""}
}
function download(name,text,type){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

/* ---------- Arduino generation ---------- */
function arduinoCode(){
  // Static groups are exported as frame tables. Runtime-random groups call procedural functions.
  const staticFrames=[],actions=[],runtime=[];
  state.sections.forEach(sec=>sec.groups.forEach(g=>{
    if(g.runtime_random){const i=runtime.length;runtime.push(g.runtime_random);actions.push({kind:"runtime",i})}
    else if(g.frames?.length){const start=staticFrames.length;staticFrames.push(...g.frames);actions.push({kind:"static",start,count:g.frames.length})}
  }));
  const rows=staticFrames.map(f=>{
    const rgb=f.leds.map(c=>`{${hexRgb(c).join(",")}}`).join(",");
    return `  {{${rgb}}, ${Math.max(1,Math.min(65535,Math.round(f.duration_sec*1000)))}}`;
  }).join(",\n")||"  {{{0}}, 1}";
  const runtimeCalls=runtime.map((rr,i)=>runtimeCall(rr,i));
  const actionText=actions.map(a=>a.kind==="static"?`  playStatic(${a.start},${a.count});`:`  ${runtimeCalls[a.i]}`).join("\n")||"  delay(1000);";
  return ARDUINO_TEMPLATE.replace("__FRAME_DATA__",rows).replaceAll("__SEED_COUNT__",String(Math.max(1,runtime.length))).replace("__ACTIONS__",actionText);
}
function rangePair(ranges,key,scale=1,choice=null,bool=false){
  let [a="",b=""]=ranges?.[key]||[];a=String(a).trim();b=String(b).trim();if(a&&!b)b=a;if(b&&!a)a=b;if(!a&&!b)return [-32768,-32768];
  if(choice){const m=Object.fromEntries(choice.map((x,i)=>[x,i]));return [m[a],m[b]]}
  if(bool){const m={Off:0,On:1};return [m[a],m[b]]}
  return [Math.round(Number(a)*scale),Math.round(Number(b)*scale)]
}
function colorPair(ranges,key){
  let [a="",b=""]=ranges?.[key]||[];a=String(a).trim();b=String(b).trim();if(a&&!b)b=a;if(b&&!a)a=b;if(!a&&!b)return ["0xFFFFFFFFUL","0xFFFFFFFFUL"];
  const cv=x=>"0x"+x.replace("#","").toUpperCase()+"UL";return [cv(a),cv(b)]
}
function runtimeCall(rr,i){
  const mode={random_color:0,random_effect_params:1,random_everything:2}[rr.mode]??0,effect=effects.indexOf(rr.effect),p=rr.params||{},r=p.ranges||{};
  const dir=Math.max(0,dirs.indexOf(p.direction)),scope=Math.max(0,scopes.indexOf(p.scope));
  const base=[p.frames??18,p.ms??70,p.width??4,p.tail??6,Math.round((p.wavelength??12)*10),Math.round((p.gravity??18)*10),p.ball_size??4,Math.round((p.restitution??.78)*100),p.offset??0,Math.round((p.intensity??.85)*100),dir,scope,p.hold_ms??1000];
  let bounds=[];[
    ["frames",1],["seconds",1000],["width",1],["tail",1],["wavelength",10],["gravity",10],["ball_size",1],["restitution",100],["offset",1],["intensity",100]
  ].forEach(([k,s])=>bounds.push(...rangePair(r,k,s)));
  bounds.push(...rangePair(r,"direction",1,dirs),...rangePair(r,"scope",1,scopes),...rangePair(r,"hold_sec",1000),...rangePair(r,"color_transition",1,null,true));
  const c1=colorPair(r,"color1"),c2=colorPair(r,"color2");
  return `runRuntimeRandom(${[i,mode,effect,...base,...bounds,...c1,...c2].join(",")});`;
}
function showArduino(){const t=arduinoCode();$("#arduinoOutput").value=t;$("#codeSheet").classList.remove("hidden")}
function exportINO(){download("TV_LED_Generated.ino",arduinoCode(),"text/plain")}
async function copyCode(){try{await navigator.clipboard.writeText($("#arduinoOutput").value);status("Arduino code copied")}catch{alert("Copy failed. Select the code manually.")}}

const ARDUINO_TEMPLATE=String.raw`#include <Adafruit_NeoPixel.h>
#include <math.h>
#define NUM_PIXELS 48
#define PIN 6
Adafruit_NeoPixel pixels(NUM_PIXELS,PIN,NEO_GRB+NEO_KHZ800);
struct Frame { uint8_t rgb[48][3]; uint16_t duration; };
const Frame frames[] = {
__FRAME_DATA__
};
uint32_t runtimeSeeds[__SEED_COUNT__];
uint32_t wheel(byte p){p=255-p;if(p<85)return pixels.Color(255-p*3,0,p*3);if(p<170){p-=85;return pixels.Color(0,p*3,255-p*3);}p-=170;return pixels.Color(p*3,255-p*3,0);}
uint32_t scaleColor(uint32_t c,float s){uint8_t r=(c>>16)&255,g=(c>>8)&255,b=c&255;return pixels.Color((uint8_t)(r*s),(uint8_t)(g*s),(uint8_t)(b*s));}
uint32_t mixColor(uint32_t a,uint32_t b,float t){uint8_t ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;return pixels.Color(ar+(br-ar)*t,ag+(bg-ag)*t,ab+(bb-ab)*t);}
int orderedPos(int q,int dir){q=constrain(q,0,47);if(dir==1)return 47-q;if(dir==2)return(q%2==0)?23-q/2:24+q/2;if(dir==3)return(q%2==0)?q/2:47-q/2;return q;}
void clearPixels(){for(int i=0;i<48;i++)pixels.setPixelColor(i,0);}
void showWait(int ms){pixels.show();delay(max(1,ms));}
void playStatic(int start,int count){for(int n=0;n<count;n++){const Frame &f=frames[start+n];for(int i=0;i<48;i++)pixels.setPixelColor(i,pixels.Color(f.rgb[i][0],f.rgb[i][1],f.rgb[i][2]));pixels.show();delay(f.duration);}}
void fxWipe(int n,int ms,int w,int dir,int off,uint32_t a,uint32_t b,int trans){for(int k=0;k<n;k++){clearPixels();uint32_t c=trans?mixColor(a,b,k/(float)max(1,n-1)):a;int st=-w+(48+2*w)*k/max(1,n-1)+off;for(int q=st;q<st+w;q++)if(q>=0&&q<48)pixels.setPixelColor(orderedPos(q,dir),c);showWait(ms);}}
void fxComet(int n,int ms,int w,int tail,int dir,int off,uint32_t a,uint32_t b,int trans){for(int k=0;k<n;k++){clearPixels();uint32_t c=trans?mixColor(a,b,k/(float)max(1,n-1)):a;int head=-tail-w+(48+tail+2*w)*k/max(1,n-1)+off;for(int q=head;q<head+w;q++)if(q>=0&&q<48)pixels.setPixelColor(orderedPos(q,dir),c);for(int d=1;d<=tail;d++){int q=head-d;if(q>=0&&q<48)pixels.setPixelColor(orderedPos(q,dir),scaleColor(c,1.0-d/(float)(tail+1)));}showWait(ms);}}
void fxGradient(int n,int ms,int dir,int off,uint32_t a,uint32_t b){for(int k=0;k<n;k++){for(int i=0;i<48;i++){float x=fmod(i/47.0+(k+off)/(float)n,1.0),t=.5-.5*cos(2*PI*x);pixels.setPixelColor(orderedPos(i,dir),mixColor(a,b,t));}showWait(ms);}}
void fxWave(int n,int ms,float wave,int w,int dir,int off,uint32_t a,uint32_t b,int trans){float sharp=max(1.0,7.0/max(1,w));for(int k=0;k<n;k++){uint32_t c=trans?mixColor(a,b,k/(float)max(1,n-1)):a;for(int i=0;i<48;i++){float phase=2*PI*(k+off)/(float)n,amp=(sin(2*PI*i/wave-phase)+1)/2;pixels.setPixelColor(orderedPos(i,dir),scaleColor(c,pow(amp,sharp)));}showWait(ms);}}
void fxFlame(int n,int ms,int intensity,uint32_t a,uint32_t b,int trans){for(int k=0;k<n;k++){uint32_t c=trans?mixColor(a,b,k/(float)max(1,n-1)):a;for(int i=0;i<48;i++){float f=(35+random(66))/100.0*(intensity/100.0);pixels.setPixelColor(i,scaleColor(c,constrain(f,0.0,1.0)));}showWait(ms);}}
void fxBounce(int n,int ms,float gravity,int rest,int ball,int dir,int off,uint32_t a,uint32_t b,int trans){float dt=ms/1000.0,x=constrain((float)off,0.0,48.0-ball),v=max(8.0,sqrt(2*gravity*26.0));if(dir==1){v=-v;x=48-ball-x;}for(int k=0;k<n;k++){clearPixels();uint32_t c=trans?mixColor(a,b,k/(float)max(1,n-1)):a;int s=round(x);for(int q=s;q<s+ball;q++)if(q>=0&&q<48)pixels.setPixelColor(q,c);showWait(ms);v-=gravity*dt;x+=v*dt;float hi=48-ball;if(x<0){x=-x;v=abs(v)*(rest/100.0);}else if(x>hi){x=hi-(x-hi);v=-abs(v)*(rest/100.0);}}}
void fxFade(int n,int ms,bool in,int scope,uint32_t a,uint32_t b,int trans){int lo=scope==0?0:(scope-1)*16,hi=scope==0?48:lo+16;for(int k=0;k<n;k++){clearPixels();float t=k/(float)max(1,n-1);if(!in)t=1-t;uint32_t c=trans?mixColor(a,b,k/(float)max(1,n-1)):a;for(int i=lo;i<hi;i++)pixels.setPixelColor(i,scaleColor(c,t));showWait(ms);}}
void fxFadeInOut(int n,int ms,int holdMs,int scope,uint32_t a,uint32_t b,int trans){int lo=scope==0?0:(scope-1)*16,hi=scope==0?48:lo+16;int holdFrames=max(1,holdMs/max(1,ms));int total=n+holdFrames+n;for(int k=0;k<total;k++){clearPixels();float level;if(k<n)level=k/(float)max(1,n-1);else if(k<n+holdFrames)level=1.0;else level=1.0-(k-(n+holdFrames))/(float)max(1,n-1);uint32_t c=trans?mixColor(a,b,k/(float)max(1,total-1)):a;for(int i=lo;i<hi;i++)pixels.setPixelColor(i,scaleColor(c,constrain(level,0.0,1.0)));showWait(ms);}}
void fxShimmer(int n,int ms,bool in,int scope,int intensity,uint32_t a,uint32_t b,int trans){int lo=scope==0?0:(scope-1)*16,hi=scope==0?48:lo+16;for(int k=0;k<n;k++){clearPixels();float p=k/(float)max(1,n-1);uint32_t c=trans?mixColor(a,b,p):a;if(in&&k==n-1){for(int i=lo;i<hi;i++)pixels.setPixelColor(i,c);}else if(!in&&k==n-1){}else{float env=in?p:1-p,settle=in?p*p*p:0;for(int i=lo;i<hi;i++){float sparkle=(35+random(86))/100.0*(intensity/100.0),level=constrain(env*sparkle,0.0,1.0);if(in)level=(1-settle)*level+settle*p;pixels.setPixelColor(i,scaleColor(c,level));}}showWait(ms);}}
void runEffect(int e,int n,int ms,int w,int tail,float wave,float gravity,int ball,int rest,int off,int intensity,int dir,int scope,int holdMs,uint32_t c1,uint32_t c2,int trans){if(e==0)fxWipe(n,ms,w,dir,off,c1,c2,trans);else if(e==1)fxComet(n,ms,w,tail,dir,off,c1,c2,trans);else if(e==2)fxGradient(n,ms,dir,off,c1,c2);else if(e==3)fxWave(n,ms,wave,w,dir,off,c1,c2,trans);else if(e==4)fxFlame(n,ms,intensity,c1,c2,trans);else if(e==5)fxBounce(n,ms,gravity,rest,ball,dir,off,c1,c2,trans);else if(e==6)fxFade(n,ms,true,scope,c1,c2,trans);else if(e==7)fxFade(n,ms,false,scope,c1,c2,trans);else if(e==8)fxShimmer(n,ms,true,scope,intensity,c1,c2,trans);else if(e==9)fxShimmer(n,ms,false,scope,intensity,c1,c2,trans);else fxFadeInOut(n,ms,holdMs,scope,c1,c2,trans);}
long pickR(long a,long b,long da,long db){if(a==-32768&&b==-32768){a=da;b=db;}if(a==-32768)a=b;if(b==-32768)b=a;if(a>b){long t=a;a=b;b=t;}if(a==b)return a;return random(a,b+1);}
uint32_t randomColorBetween(uint32_t a,uint32_t b){if(a==0xFFFFFFFFUL&&b==0xFFFFFFFFUL)return wheel(random(256));if(a==0xFFFFFFFFUL)a=b;if(b==0xFFFFFFFFUL)b=a;uint8_t ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;uint8_t r=random(min(ar,br),max(ar,br)+1),g=random(min(ag,bg),max(ag,bg)+1),bl=random(min(ab,bb),max(ab,bb)+1);return pixels.Color(r,g,bl);}
void runRuntimeRandom(int seedIndex,int mode,int fixedEffect,int n,int ms,int w,int tail,int wave10,int gravity10,int ball,int rest,int off,int intensity,int dir,int scope,int holdMs,long nMin,long nMax,long msMin,long msMax,long wMin,long wMax,long tailMin,long tailMax,long waveMin,long waveMax,long gravMin,long gravMax,long ballMin,long ballMax,long restMin,long restMax,long offMin,long offMax,long intMin,long intMax,long dirMin,long dirMax,long scopeMin,long scopeMax,long holdMin,long holdMax,long transMin,long transMax,uint32_t c1Min,uint32_t c1Max,uint32_t c2Min,uint32_t c2Max){
  randomSeed(runtimeSeeds[seedIndex]);int e=fixedEffect,trans=0;uint32_t c1=wheel(random(256)),c2=wheel(random(256));float wave=wave10/10.0,gravity=gravity10/10.0;
  if(mode==1){n=pickR(nMin,nMax,12,36);ms=pickR(msMin,msMax,40,220);w=pickR(wMin,wMax,2,9);tail=pickR(tailMin,tailMax,3,13);wave=pickR(waveMin,waveMax,60,240)/10.0;gravity=pickR(gravMin,gravMax,80,350)/10.0;ball=pickR(ballMin,ballMax,2,7);rest=pickR(restMin,restMax,55,95);off=pickR(offMin,offMax,-8,8);intensity=pickR(intMin,intMax,55,100);dir=pickR(dirMin,dirMax,0,(fixedEffect==5)?1:3);scope=pickR(scopeMin,scopeMax,0,3);holdMs=pickR(holdMin,holdMax,500,2000);trans=pickR(transMin,transMax,0,1);c1=randomColorBetween(c1Min,c1Max);c2=randomColorBetween(c2Min,c2Max);}
  else if(mode==2){e=random(0,11);n=random(12,37);ms=random(40,221);w=random(2,10);tail=random(3,14);wave=random(60,241)/10.0;gravity=random(80,351)/10.0;ball=random(2,8);rest=random(55,96);off=random(-8,9);intensity=random(55,101);dir=(e==5)?random(0,2):random(0,4);scope=random(0,4);holdMs=random(500,2001);trans=random(0,2);c1=wheel(random(256));c2=wheel(random(256));}
  else{c1=wheel(random(256));c2=c1;trans=0;}
  runEffect(e,n,ms,w,tail,wave,gravity,ball,rest,off,intensity,dir,scope,holdMs,c1,c2,trans);
}
void setup(){pixels.begin();pixels.setBrightness(255);pixels.clear();pixels.show();randomSeed(analogRead(A0)^micros());for(int i=0;i<__SEED_COUNT__;i++)runtimeSeeds[i]=((uint32_t)random(1,65535)<<16)|random(1,65535);}
void loop(){
__ACTIONS__
}`;

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
render();

// iPad: allow the effect sheet itself to scroll without the background page stealing the gesture.
document.addEventListener("touchmove",e=>{
  if(!$("#effectSheet").classList.contains("hidden")&&!e.target.closest(".sheet-scroll"))e.preventDefault();
},{passive:false});
