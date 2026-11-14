import {createTikFinityAdapter} from "./tikfinity.mjs";
import {createGiftRules,giftDefaults} from "./gift-rules.mjs";
import {createStateValidator,safePortraitURL,safeSocketURL,MAX_STATE_BYTES} from "./security.mjs";
const catalogResponse=await fetch("./catalog.json");
if(!catalogResponse.ok)throw Error("Gift library could not load. Restart Start-Boxing.cmd and refresh.");
const giftCatalog=await catalogResponse.json(),giftRules=createGiftRules(giftCatalog);
let refreshGiftControls=()=>{};
let refreshBridge=()=>{},refreshStats=()=>{},publishState=()=>{};
const translationsHe=["מרכז השליטה בשידור","אולפן מקומי","נהלו את הקרב, התאימו את המתמודדים ובדקו אינטראקציות בשידור.","פתיחת מסך השידור 9:16","העתקת קישור לשידור","מצב הקרב","זמן שנותר","חיים — כחול","חיים — אדום","01 / מתמודדים","הגדרת מתמודדים","ניתן להתאמה","בחירת עימות מוכן","ביבי נגד איזנקוט","מסי נגד רונאלדו","עימות מותאם אישית","המתמודד הכחול","המתמודד האדום","קישור לתמונת המתמודד הכחול","קישור לתמונת המתמודד האדום","לביבי ולאיזנקוט יש דמויות מאוירות מובנות. אפשר להחליף אותן באמצעות קישור לתמונה.","02 / חוקי הקרב","הגדרות הקרב","שפת התצוגה","משך הסיבוב (בשניות)","שמירת הגדרות","התחלת סיבוב","איפוס","03 / אירועי שידור","שליטה בקרב","מצב בדיקה","אגרוף של הכחול","אגרוף של האדום","מתקפה מיוחדת — כחול","מתקפה מיוחדת — אדום","תגובה 1","תגובה 2","מתנה לכחול","מתנה לאדום","הצבעות לכחול: 0","הצבעות לאדום: 0","04 / חיבור לשידור","חיבור TikFinity","התחברות","מצב הדגמה · אין חיבור לשידור חי","יש לפתוח את TikFinity Desktop באותו מחשב ולחבר לשידור. חיבור השקע לבדו אינו מאמת קבלת אירועים חיים.","אירועים אחרונים","תצוגת שידור","תצוגה מקדימה","התצוגה מתעדכנת בזמן אמת. השאירו את לוח הבקרה פתוח בזמן השידור.","זירת האגרוף בשידור חי · גרסת הדגמה מקומית · החיבור לטיקטוק אינו פעיל כברירת מחדל"];
const originalLabels={};

const KEY="boxing-arena-v1";
const defaults={language:"en",blueName:"BIBI",redName:"EISENKOT",blueImage:"",redImage:"",duration:60,remaining:60,giftInfoPosition:"bottom",blueHp:100,redHp:100,blueVotes:0,redVotes:0,blueCoins:0,redCoins:0,...giftDefaults(),phase:"ready",winner:null,startedAt:0,endsAt:0,action:null,revision:0};
const normalizeState=createStateValidator(defaults,giftRules);
function read(){try{
 const raw=localStorage.getItem(KEY)||"{}";if(new TextEncoder().encode(raw).length>MAX_STATE_BYTES)throw Error("State too large");
 const saved=JSON.parse(raw);
 if(!saved||typeof saved!=="object"||Array.isArray(saved))return {...defaults};
 const next={...defaults,...saved};
 for(const field of ["duration","remaining","blueHp","redHp","blueVotes","redVotes","startedAt","endsAt","revision","blueCoins","redCoins"])if(!Number.isFinite(next[field])||next[field]<0)next[field]=defaults[field];
 next.duration=Math.min(300,Math.max(15,Math.round(next.duration)));
 next.blueHp=Math.min(100,next.blueHp);next.redHp=Math.min(100,next.redHp);
 next.language=next.language==="he"?"he":"en";
 for(const field of ["blueName","redName","blueImage","redImage"])if(typeof next[field]!=="string")next[field]=defaults[field];
 if(!["ready","running","finished"].includes(next.phase))next.phase="ready";
 if(next.action&&(!["blue","red"].includes(next.action.side)||!Number.isFinite(next.action.at)))next.action=null;
 try{Object.assign(next,giftRules.validate(next))}catch{Object.assign(next,giftDefaults())}
 next.blueVotes=0;next.redVotes=0;
 if(next.action&&(!Number.isSafeInteger(next.action.power)||!next.action.giftId))next.action=null;
 return normalizeState(next);
 }catch{return {...defaults}}}
let state=read();
let giftDraft=giftRules.validate(state);
const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(KEY):null;
function commit(patch){state=normalizeState({...state,...patch,revision:Math.max(Date.now(),Number(state.revision)+1)});try{localStorage.setItem(KEY,JSON.stringify(state))}catch{log(state.language==="he"?"לא ניתן לשמור בדפדפן":"Browser storage unavailable")}channel?.postMessage(state);publishState(state);renderControls()}
function sync(next){try{const verified=normalizeState(next);if(verified.revision>=state.revision){state=verified;localize();renderControls()}}catch{log(state.language==="he"?"מצב סנכרון לא תקין נדחה":"Invalid synchronized state rejected")}}
channel&&(channel.onmessage=e=>sync(e.data));
window.addEventListener("storage",e=>{if(e.key===KEY)sync(read())});
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function fighterName(side){const name=state[side+"Name"];return state.language==="he"?({BIBI:"ביבי",EISENKOT:"אייזנקוט"}[name.toUpperCase()]||name):name}
function log(message){const el=$("log");if(!el)return;const row=document.createElement("div");row.dir="auto";row.textContent=new Date().toLocaleTimeString(state.language==="he"?"he-IL":"en-US")+" "+message;el.prepend(row);while(el.children.length>60)el.lastChild.remove()}
function action(side,power,type="gift",details={}){
 if(!["blue","red"].includes(side)||!["gift","heal"].includes(type)||!Number.isSafeInteger(power)||power<1||state.phase!=="running")return;
 if(Date.now()>=state.endsAt){finish();return}
 const healing=type==="heal",target=(healing?side:side==="blue"?"red":"blue")+"Hp";
 const hp=clamp(state[target]+(healing?power:-power),0,100),amount=Math.abs(hp-state[target]);
 const patch={[target]:hp,[side+"Coins"]:Math.min(Number.MAX_SAFE_INTEGER,state[side+"Coins"]+power),action:{side,type,power,amount,giftId:details.giftId||"",name:details.name||"",at:Date.now(),id:crypto.randomUUID()}};
 if(!healing&&hp===0){patch.winner=side;patch.phase="finished";patch.remaining=Math.max(0,Math.ceil((state.endsAt-Date.now())/1000))}
 commit(patch);
 log((state.language==="he"?(side==="blue"?"כחול":"אדום"):side)+" · "+(details.name||"gift")+" · "+power+(state.language==="he"?" מטבעות":" coins")+" ("+(healing?"+":"−")+amount+" HP)");
}
function applyGift(giftId,count=1){
 const event=giftRules.resolve(giftId,count,state);
 if(!event){log(state.language==="he"?"מתנה ללא שיוך התעלמה: "+giftId:"Unassigned/unknown gift ignored: "+giftId);return}
 action(event.side,event.power,event.type,event);
}
function start(){const duration=clamp(Number(state.duration)||60,15,300);commit({phase:"running",remaining:duration,blueHp:100,redHp:100,blueVotes:0,redVotes:0,blueCoins:0,redCoins:0,winner:null,action:null,startedAt:Date.now(),endsAt:Date.now()+duration*1000});log(state.language==="he"?"הסיבוב התחיל":"Round started")}
function reset(){commit({phase:"ready",blueHp:100,redHp:100,blueVotes:0,redVotes:0,blueCoins:0,redCoins:0,remaining:Number(state.duration)||60,winner:null,action:null,endsAt:0});log(state.language==="he"?"הקרב אופס":"Reset")}
function finish(){if(state.phase!=="running")return;const winner=state.blueHp===state.redHp?"draw":state.blueHp>state.redHp?"blue":"red";commit({phase:"finished",remaining:0,winner});log(state.language==="he"?"הסיבוב הסתיים: "+({blue:state.blueName,red:state.redName,draw:"תיקו"}[winner]):"Round finished: "+winner)}
function renderControls(){if(!$("save"))return;localize();refreshStats();refreshGiftControls();document.querySelectorAll("[data-test-gift]").forEach(b=>b.disabled=state.phase!=="running");$("start").disabled=state.phase==="running";const status=$("status");if(status&&!status.dataset.connected)status.textContent=state.language==="he"?"מצב הדגמה · אין חיבור לשידור חי":"Demo mode · no live connection"}
if($("save")){for(const field of ["language","blueName","redName","blueImage","redImage","duration","giftInfoPosition"]){$(field).value=state[field];}
$("save").onclick=()=>{const patch={...giftRules.validate(giftDraft),giftInfoPosition:$("giftInfoPosition").value};for(const f of ["language","blueName","redName","blueImage","redImage"])patch[f]=$(f).value.trim();if(!safePortraitURL(patch.blueImage)||!safePortraitURL(patch.redImage)){log(state.language==="he"?"יש להזין כתובת תמונה תקינה מסוג HTTP(S), ללא פרטי כניסה":"Use valid HTTP(S) portrait URLs without embedded credentials");return}patch.duration=clamp(Math.round(Number($("duration").value)||60),15,300);patch.blueName=patch.blueName||"BIBI";patch.redName=patch.redName||"EISENKOT";if(state.phase!=="running")patch.remaining=patch.duration;$("duration").value=patch.duration;$("blueName").value=patch.blueName;$("redName").value=patch.redName;commit(patch);log(state.language==="he"?"ההגדרות נשמרו":"Settings saved")};
$("start").onclick=start;$("reset").onclick=reset;
document.querySelectorAll("[data-test-gift]").forEach(b=>b.onclick=()=>{
 const id=$(b.dataset.testGift+"TestGift").value;if(id)applyGift(id);
});
let ws=null,received=0;
let replayStorage;try{replayStorage=localStorage}catch{}
const adapter=createTikFinityAdapter({storage:replayStorage,requirePersistence:true}),seen=new Set();
$("bridgeMode").value="tikfinity";
$("wsUrl").value="ws://localhost:21213/";
$("bridgeMode").onchange=()=>{if(ws){const previous=ws;ws=null;previous.close()}received=0;$("wsUrl").value=$("bridgeMode").value==="tikfinity"?"ws://localhost:21213/":"ws://127.0.0.1:8765/";bridgeStatus(false)};
refreshBridge=()=>bridgeStatus(ws?.readyState===WebSocket.OPEN);
function bridgeStatus(connected){
 for(const id of ["status","connectionBadge"]){const el=$(id);el.dataset.connected=connected?"1":"";}
 const native=$("bridgeMode").value==="tikfinity";
 $("bridgeMode").disabled=!!ws;
 $("wsUrl").disabled=!!ws;
 $("status").textContent=state.language==="he"?(connected?(native?"שקע TikFinity מחובר · אירועים שהתקבלו: "+received:"גשר בדיקה מחובר"):"מצב הדגמה · אין חיבור לשידור חי"):(connected?(native?"TikFinity socket connected · events received: "+received:"Test bridge connected"):"Demo mode · no live connection");
 $("connectionBadge").textContent=connected?(native?"● TikFinity":"● TEST BRIDGE"):(state.language==="he"?"● הדגמה":"● DEMO");
 $("connect").querySelector("span").textContent=state.language==="he"?(connected?"ניתוק":native?"חיבור TikFinity":"התחברות"):(connected?"Disconnect":native?"Connect TikFinity":"Connect bridge");
}
$("connect").onclick=()=>{
 if(ws){const previous=ws;ws=null;previous.close();bridgeStatus(false);return}
 const url=$("wsUrl").value.trim();
 if(!safeSocketURL(url,{localOnly:$("bridgeMode").value==="tikfinity"})){log(state.language==="he"?"TikFinity דורש כתובת מקומית ללא פרטי כניסה; חיבור מרוחק דורש WSS":"Use a loopback TikFinity URL without credentials; remote test bridges require WSS");return}
 try{
 const socket=new WebSocket(url);ws=socket;received=0;bridgeStatus(false);
 socket.onopen=()=>{if(ws===socket){bridgeStatus(true);log($("bridgeMode").value==="tikfinity"?"TikFinity socket connected — awaiting events":"Test bridge connected")}};
 socket.onclose=()=>{if(ws===socket){ws=null;bridgeStatus(false)}};
 socket.onerror=()=>{if(ws===socket)log("Bridge error")};
 socket.onmessage=e=>{if(ws!==socket)return;try{
 if(typeof e.data!=="string"||new TextEncoder().encode(e.data).length>262144)throw Error();
 const event=JSON.parse(e.data);
 if($("bridgeMode").value==="tikfinity"){
  const actions=adapter.receive(event);received++;bridgeStatus(true);
  for(const item of actions)applyGift(item.giftId,item.count)
  return;
 }
 if(!event||typeof event!=="object")throw Error();
 if(event.type!=="gift")return;
 if(!/^\d{1,20}$/.test(String(event.giftId)))throw Error();
 if(event.id!==undefined){if(typeof event.id!=="string"||event.id.length>128)throw Error();if(seen.has(event.id))return;seen.add(event.id);if(seen.size>1000)seen.delete(seen.values().next().value)}
 applyGift(event.giftId,event.count??1);
 }catch(error){log(error?.code==="REPLAY_STORAGE"?(state.language==="he"?"הגנת שידור חוזר חסומה: אחסון הדפדפן מלא, פגום או לא זמין":"Gift replay protection blocked: browser storage is full, corrupt or unavailable"):(state.language==="he"?"אירוע לא תקין נדחה":"Invalid event rejected"))}};
 }catch{ws=null;bridgeStatus(false);log("Connection failed")}
};
// Recompute connection text when the UI language changes.
$("language").addEventListener("change",()=>queueMicrotask(()=>bridgeStatus(ws?.readyState===WebSocket.OPEN)));
}



if($("preset")){
$("language").addEventListener("change",()=>{commit({language:$("language").value})});
$("preset").onchange=()=>{const p=$("preset").value;if(p==="bibi"){$("blueName").value="BIBI";$("redName").value="EISENKOT"}else if(p==="football"){$("blueName").value="MESSI";$("redName").value="RONALDO"}if(p!=="custom"){$("blueImage").value="";$("redImage").value=""}log(state.language==="he"?"הקרב נבחר — לחצו על שמירת הגדרות כדי להחיל":"Preset selected — click Save settings to apply")};
$("copyOverlay").onclick=async()=>{const url=new URL("./overlay.html",location.href).href;try{await navigator.clipboard.writeText(url);$("copyOverlay").querySelector("span").textContent=state.language==="he"?"✓ הועתק":"✓ Copied";setTimeout(()=>localize(),1800)}catch{window.prompt("Copy overlay URL:",url)}};
function stats(){const remaining=state.phase==="running"?Math.max(0,Math.ceil((state.endsAt-Date.now())/1000)):state.remaining;$("matchStatus").textContent=state.language==="he"?({ready:"מוכן",running:"מתנהל",finished:"הסתיים"}[state.phase]||state.phase):state.phase.toUpperCase();$("timeStat").textContent=remaining+(state.language==="he"?" שנ׳":"s");$("blueStat").textContent=Math.round(state.blueHp)+"%";$("redStat").textContent=Math.round(state.redHp)+"%";$("blueCoinsStat").textContent=(state.language==="he"?"מטבעות לכחול: ":"Blue gift coins: ")+state.blueCoins;$("redCoinsStat").textContent=(state.language==="he"?"מטבעות לאדום: ":"Red gift coins: ")+state.redCoins}
refreshStats=stats;setInterval(stats,150);stats();
}


function localize(){
const hebrew=state.language==="he";
document.querySelectorAll("[data-tab-en]").forEach(el=>el.textContent=hebrew?el.dataset.tabHe:el.dataset.tabEn);
document.documentElement.lang=hebrew?"he":"en";
document.documentElement.dir=hebrew?"rtl":"ltr";
const arena=$("arena");if(arena){arena.setAttribute("aria-label",state.blueName+": "+state.blueHp+" · "+state.redName+": "+state.redHp);arena.dataset.giftInfoPosition=state.giftInfoPosition;arena.setAttribute("aria-description",hebrew?"תוויות אגרוף וריפוי "+(state.giftInfoPosition==="aboveNames"?"מעל שמות המתמודדים":"בתחתית המסך"):"Punch and healing gifts "+(state.giftInfoPosition==="aboveNames"?"above fighter names":"at the bottom"))}
document.querySelectorAll("[data-i18n]").forEach(el=>{const key=el.dataset.i18n;if(!(key in originalLabels))originalLabels[key]=el.textContent;const n=Number(key.slice(1))-1;el.textContent=hebrew?(translationsHe[n]||originalLabels[key]):originalLabels[key]});
const status=$("status");if(status&&!status.dataset.connected)status.textContent=hebrew?"מצב הדגמה · אין חיבור לשידור חי":"Demo mode · no live connection";refreshBridge();
}


if(document.querySelector(".tabs")){
const tabs=[...document.querySelectorAll("[data-tab]")];
function activateTab(name){tabs.forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active));b.tabIndex=active?0:-1});document.querySelectorAll("[data-pane]").forEach(p=>p.hidden=p.dataset.pane!==name)}
tabs.forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.tab)));
tabs.forEach((b,i)=>b.addEventListener("keydown",e=>{let next=i;const rtl=state.language==="he";if(e.key==="ArrowRight")next=(i+(rtl?2:1))%3;else if(e.key==="ArrowLeft")next=(i+(rtl?1:2))%3;else if(e.key==="Home")next=0;else if(e.key==="End")next=2;else return;e.preventDefault();activateTab(tabs[next].dataset.tab);tabs[next].focus()}));
activateTab("live");
const updateTabLabels=()=>{const he=state.language==="he";document.querySelectorAll("[data-tab-en]").forEach(el=>el.textContent=he?el.dataset.tabHe:el.dataset.tabEn);const badge=$("connectionBadge");if(badge&&!badge.dataset.connected)badge.textContent=he?"● הדגמה":"● DEMO"};
const oldLocalize=localize;
localize=function(){oldLocalize();updateTabLabels()};
updateTabLabels();
localize();
}

// Gift assignments are drafted locally until Save settings is pressed.
if($("giftLibrary")){
 let librarySignature="",testSignature="",healingSignature="";
 const slotLabel=(side,type)=>state.language==="he"?(side==="blue"?"כחול":"אדום")+" · "+(type==="heal"?"ריפוי":"נזק"):(side==="blue"?"Blue":"Red")+" · "+(type==="heal"?"Heal":"Damage");
 function route(id){for(const side of ["blue","red"]){if(giftDraft[side+"HealGift"]===id)return [side,"heal"];if(giftDraft[side+"AttackGifts"].includes(id))return [side,"gift"]}return null}
 function choose(id){
  const [side,type]=$("giftSlot").value.split(":"),old=route(id),remove=old?.[0]===side&&old?.[1]===type;
  for(const corner of ["blue","red"]){giftDraft[corner+"AttackGifts"]=giftDraft[corner+"AttackGifts"].filter(x=>x!==id);if(giftDraft[corner+"HealGift"]===id)giftDraft[corner+"HealGift"]=""}
  if(!remove){if(type==="heal")giftDraft[side+"HealGift"]=id;else giftDraft[side+"AttackGifts"].push(id)}
  refreshGiftControls();
 }
 function setHealingGift(side,id){
  giftDraft[side+"HealGift"]="";
  if(id){for(const corner of ["blue","red"]){giftDraft[corner+"AttackGifts"]=giftDraft[corner+"AttackGifts"].filter(x=>x!==id);if(giftDraft[corner+"HealGift"]===id)giftDraft[corner+"HealGift"]=""}giftDraft[side+"HealGift"]=id}
  refreshGiftControls();
 }
 refreshGiftControls=(resetDraft=false)=>{
  if(resetDraft)giftDraft=giftRules.validate(state);
  const he=state.language==="he",query=$("giftSearch").value.trim().toLowerCase(),slot=$("giftSlot").value;
  const healingKey=JSON.stringify([he,state.blueName,state.redName]);
  if(healingKey!==healingSignature){healingSignature=healingKey;for(const side of ["blue","red"]){
   $(side+"HealHeading").textContent=fighterName(side)+(he?" · מתנת ריפוי":" · healing gift");
   const select=$(side+"HealGift");select.replaceChildren();const none=document.createElement("option");none.value="";none.textContent=he?"ללא מתנת ריפוי":"No healing gift";select.append(none);
   for(const gift of giftCatalog){const option=document.createElement("option");option.value=gift.id;option.textContent=gift.name+" · "+gift.coins+(he?" מטבעות":" coins")+" · #"+gift.id;select.append(option)}
  }}
  for(const side of ["blue","red"]){$(side+"HealGift").value=giftDraft[side+"HealGift"];const image=$(side+"HealIcon"),gift=giftRules.gifts.get(giftDraft[side+"HealGift"]);image.hidden=!gift;if(gift){image.src=gift.image;image.alt=gift.name}}
  const signature=JSON.stringify([giftDraft,query,slot,he]);
  if(signature!==librarySignature){librarySignature=signature;const list=$("giftLibrary");list.replaceChildren();
   const matches=giftCatalog.filter(g=>g.name.toLowerCase().includes(query)||g.id.includes(query)||String(g.coins)===query);
   for(const gift of matches){const assigned=route(gift.id),button=document.createElement("button");button.type="button";button.className="gift-card"+(assigned?" assigned-"+assigned[0]+(assigned[1]==="heal"?" healing":""):"");button.dataset.giftId=gift.id;button.setAttribute("aria-pressed",String(assigned?.join(":")===slot));button.onclick=()=>choose(gift.id);
    const image=document.createElement("img");image.src=gift.image;image.alt="";image.loading="lazy";button.append(image);
    for(const [className,value]of [["gift-name",gift.name],["gift-value",gift.coins+(he?" מטבעות":" coins")+" · #"+gift.id],["gift-route",assigned?slotLabel(...assigned):(he?"ללא שיוך":"Unassigned")]]){const span=document.createElement(className==="gift-value"?"small":"span");span.className=className;span.textContent=value;button.append(span)}
    button.setAttribute("aria-label",gift.name+", "+gift.coins+(he?" מטבעות. ":" coins. ")+(assigned?slotLabel(...assigned):(he?"ללא שיוך":"Unassigned")));list.append(button);
   }
   $("giftCount").textContent=he?matches.length+" מתוך "+giftCatalog.length+" מתנות · מספריית TikTok LIVE Battle":matches.length+" of "+giftCatalog.length+" gifts · TikTok LIVE Battle library";
   const summary=$("giftAssignments");summary.replaceChildren();
   for(const side of ["blue","red"]){const row=document.createElement("div"),names=giftDraft[side+"AttackGifts"].map(id=>giftRules.gifts.get(id).name).join(", ")||(he?"ללא":"None"),heal=giftRules.gifts.get(giftDraft[side+"HealGift"]);row.textContent=slotLabel(side,"gift")+": "+names+" | "+(he?"ריפוי: ":"Heal: ")+(heal?heal.name+" ("+heal.coins+")":he?"ללא":"None");summary.append(row)}
  }
  const tests=JSON.stringify([state.blueAttackGifts,state.redAttackGifts,state.blueHealGift,state.redHealGift,he]);
  if(tests!==testSignature){testSignature=tests;for(const side of ["blue","red"]){const select=$(side+"TestGift"),previous=select.value;select.replaceChildren();for(const id of [...state[side+"AttackGifts"],state[side+"HealGift"]].filter(Boolean)){const gift=giftRules.gifts.get(id),option=document.createElement("option");option.value=id;option.textContent=gift.name+" · "+gift.coins+(he?" מטבעות · ":" coins · ")+(id===state[side+"HealGift"]?(he?"ריפוי":"Heal"):(he?"נזק":"Damage"));select.append(option)}if([...select.options].some(o=>o.value===previous))select.value=previous}}
 };
 for(const side of ["blue","red"])$(side+"HealGift").onchange=()=>setHealingGift(side,$(side+"HealGift").value);
 $("giftInfoPosition").onchange=()=>commit({giftInfoPosition:$("giftInfoPosition").value});
 $("giftSearch").oninput=()=>refreshGiftControls();$("giftSlot").onchange=()=>refreshGiftControls();
}

const canvas=$("arena");
if(canvas){
const ctx=canvas.getContext("2d");
const portraits={blue:new Image(),red:new Image()},urls={blue:"",red:""},giftIcons=new Map();
function giftIcon(id,x,y,size=24){const gift=giftRules.gifts.get(id);if(!gift)return;let image=giftIcons.get(id);if(!image){image=new Image();image.src=gift.image;giftIcons.set(id,image)}if(image.complete&&image.naturalWidth)ctx.drawImage(image,x,y,size,size)}
const particles=[],lastAction={at:0},W=540,H=960;
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const rnd=(a,b)=>a+Math.random()*(b-a);
function path(points,fill,stroke,width=2){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
function line(points,color,width=5){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke()}
function box(x,y,w,h,color,r=0){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function txt(t,x,y,size=24,color="#fff",align="center"){const hebrew=/[\u0590-\u05FF]/.test(String(t));ctx.font=(hebrew?"800 ":"900 ")+size+"px "+(hebrew?'"Rubik",Arial,sans-serif':'"Barlow Condensed","Rubik",Arial,sans-serif');ctx.direction=hebrew?"rtl":"ltr";ctx.textAlign=align;ctx.lineWidth=4;ctx.strokeStyle="#071027";ctx.strokeText(String(t),x,y);ctx.fillStyle=color;ctx.fillText(String(t),x,y)}
function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
function portrait(side,url){if(url===urls[side])return;urls[side]=url;portraits[side]=new Image();portraits[side].referrerPolicy="no-referrer";if(safePortraitURL(url)&&url)portraits[side].src=url}
function burst(x,y,side,special){for(let i=0;i<(special?40:18);i++){const a=rnd(0,Math.PI*2),speed=rnd(2,special?14:9);particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:rnd(16,35),max:35,r:rnd(2,special?8:5),color:i%3===0?"#fff":side==="blue"?"#65d7ff":"#ffb44b"})}}
function limb(a,b,c,color,edge,w){line([a,b,c],edge,w+7);line([a,b,c],color,w)}
function boxingBoot(x,eisenkot,rear){
 ctx.save();ctx.translate(x,0);if(rear)ctx.scale(-1,1);
 const upper=eisenkot?"#491d2c":"#102b57",trim=eisenkot?"#d5dce5":"#ebcf83",top=eisenkot?116:106;
 path([[-15,top],[10,top],[13,132],[29,136],[33,144],[29,150],[-20,150],[-21,139]],upper,"#071021",4);
 path([[-11,top+3],[3,top+3],[7,139],[-9,141]],eisenkot?"#9d354b":"#f1eee2",null);
 box(-15,top,26,6,trim,2);
 if(eisenkot){path([[9,126],[22,132],[17,138],[7,133]],"#eceff2",null);line([[-16,134],[-15,143],[7,145]],"#b85366",2)}
 else{path([[10,124],[16,133],[9,141],[4,137]],trim,null);line([[-16,115],[-16,137]],"#6c90bc",2)}
 for(let i=0;i<(eisenkot?3:5);i++){const y=top+10+i*5;line([[-8,y],[4,y+3]],eisenkot?"#eee6da":"#243c5b",2);ellipse(-9,y,1.7,1.7,trim);ellipse(5,y+2,1.7,1.7,trim)}
 line([[-18,147],[27,147]],"#e1e5eb",5);line([[-18,151],[28,151]],"#091426",3);
 ellipse(20,139,7,2,"#ffffff26");ctx.restore();
}
function fighterHead(side,bibi,eisenkot){
 const image=portraits[side],skin=ctx.createLinearGradient(-35,-70,38,-35);
 skin.addColorStop(0,"#bd8166");skin.addColorStop(.5,"#f2c7a6");skin.addColorStop(1,"#d89e7d");
 if(eisenkot){
  // Broad cheeks, a wide jaw and thick neck give Eisenkot a different silhouette.
  ellipse(0,-34,25,20,"#bd866a");
  ctx.beginPath();ctx.moveTo(-33,-82);ctx.bezierCurveTo(-45,-62,-39,-31,-24,-20);ctx.bezierCurveTo(-7,-8,23,-13,34,-30);ctx.bezierCurveTo(48,-45,46,-76,29,-90);ctx.bezierCurveTo(12,-103,-19,-101,-33,-82);ctx.closePath();ctx.fillStyle=skin;ctx.fill();ctx.strokeStyle="#483c38";ctx.lineWidth=3.5;ctx.stroke();
 }else{
  ellipse(0,-34,17,17,"#bf876b");
  path([[-29,-81],[-18,-98],[8,-102],[27,-88],[31,-61],[40,-47],[31,-39],[27,-21],[9,-16],[-14,-22],[-26,-43]],skin,"#493b38",3.5);
 }
 if(image.complete&&image.naturalWidth){ctx.save();ctx.beginPath();ctx.ellipse(0,-58,eisenkot?39:32,39,0,0,Math.PI*2);ctx.clip();ctx.drawImage(image,eisenkot?-39:-32,-97,eisenkot?78:64,78);ctx.restore();return}
 if(bibi){
  // Swept silver hair, high forehead, hooded eyes and long angular nose.
  path([[-32,-74],[-35,-92],[-22,-108],[1,-114],[25,-109],[35,-98],[33,-83],[18,-92],[-2,-88],[-20,-82]],"#929eae","#263245",3);
  path([[-31,-93],[-17,-106],[5,-109],[25,-103],[30,-97],[7,-100],[-11,-95]],"#e3e8ed",null);
  line([[-24,-88],[-8,-95],[17,-96]],"#f6f6ed",3);
  line([[-27,-78],[-26,-63]],"#ced3d9",5);
  line([[-13,-70],[-1,-73],[9,-70]],"#58504b",4);line([[17,-70],[28,-68]],"#62534a",4);
  ellipse(1,-63,8,4,"#f4e9dc");ellipse(23,-61,6,3.5,"#f3e3d2");ellipse(4,-63,2.5,3,"#2c4257");ellipse(25,-61,2,2.5,"#2c4257");
  line([[-6,-67],[7,-67]],"#9c705c",2);line([[18,-65],[28,-64]],"#a4755e",2);
  path([[17,-64],[20,-51],[29,-45],[19,-42],[15,-45]],"#d79e7a","#9c6a53",1.5);
  line([[25,-48],[31,-46]],"#f7ccaa",2);
  line([[-1,-82],[13,-83],[25,-80]],"#ba8a72",1.4);line([[-4,-77],[12,-78]],"#c39077",1.2);
  path([[-17,-48],[-8,-41],[-9,-31],[-19,-38]],"#c28b71",null);
  line([[3,-31],[19,-29],[27,-32]],"#925d52",2.8);line([[8,-25],[22,-25]],"#f3c8ac",2);
  line([[25,-41],[30,-34],[28,-28]],"#b37a63",1.5);
 }else if(eisenkot){
  // Receding close crop, rounded temples, dark straight brows and fuller lower face.
  path([[-39,-66],[-38,-82],[-28,-96],[-9,-104],[16,-102],[34,-92],[42,-74],[36,-66],[30,-83],[14,-90],[-5,-91],[-25,-84],[-31,-65]],"#6c7075","#303740",3);
  path([[-25,-92],[-6,-99],[16,-97],[30,-89],[24,-86],[7,-91],[-12,-91]],"#babdc1",null);
  for(let i=0;i<9;i++){const x=-27+i*7;line([[x,-86-Math.sin(i/2)*8],[x+2,-90-Math.sin(i/2)*7]],"#d0d0cb",1.7)}
  ellipse(-34,-54,7,12,"#bd8569");ellipse(38,-52,6,11,"#cb9476");
  line([[-21,-67],[-8,-70],[2,-68]],"#433b36",5.5);line([[14,-67],[27,-65]],"#433b36",5.5);
  ellipse(-8,-61,8,4,"#f4e5d0");ellipse(22,-59,7,4,"#f4e5d0");ellipse(-5,-61,3,3,"#322f2a");ellipse(24,-59,2.8,3,"#322f2a");
  line([[-17,-55],[-7,-53],[1,-55]],"#bb886f",1.7);line([[17,-53],[28,-53]],"#b37d62",1.7);
  path([[10,-61],[17,-49],[27,-44],[17,-40],[8,-43]],"#d09b79","#986a52",1.6);ellipse(22,-44,3,1.6,"#8d5e48");
  ellipse(-18,-43,12,8,"#e9b190");ellipse(29,-42,8,7,"#dc9e7c");
  line([[-4,-29],[12,-27],[28,-30]],"#81594b",3.5);line([[0,-24],[14,-21],[25,-25]],"#f2c5a5",2);
  path([[-24,-27],[-10,-17],[14,-14],[30,-25],[21,-18],[-3,-14]],"#bd8d73",null);
  line([[-11,-80],[10,-81],[26,-77]],"#b8886c",1.5);
 }else{
  path([[-30,-76],[-27,-96],[0,-108],[27,-93],[29,-76],[5,-86],[-13,-82]],"#252a38","#111a2b",3);
  line([[-10,-67],[2,-69]],"#4b372d",4);line([[17,-66],[28,-65]],"#4b372d",4);
  ellipse(0,-60,3,4,"#202b3d");ellipse(23,-59,3,3,"#202b3d");line([[3,-30],[24,-30]],"#986453",2.5);
 }
 // Ears and jaw outlines remain different from the costume and never cover the eyes.
 if(!eisenkot){ellipse(-28,-55,5,10,"#c78d72");line([[-29,-59],[-26,-53],[-28,-50]],"#94644e",1.8)}
}
function fighter(x,y,side,t){
const blue=side==="blue",dir=blue?1:-1,main=blue?"#2377f7":"#f23e60",light=blue?"#79d7ff":"#ff9a74",dark=blue?"#163c95":"#91243e";
const name=String(state[side+"Name"]||"").toLowerCase(),bibi=/bibi|netanyahu|ביבי|נתניהו/.test(name),eisenkot=/eisenkot|איזנקוט|אייזנקוט/.test(name);
const skin=eisenkot?"#dda780":"#e7b594",outline="#12213a";
const a=state.action,age=a?Date.now()-a.at:9999,att=a?.type!=="heal"&&a?.side===side&&age<660,hit=!!a&&a.type!=="heal"&&a.side!==side&&age>=180&&age<650;
const special=att&&a.power>=20,p=att?clamp(age/660,0,1):0,wind=att?Math.sin(Math.PI*Math.min(1,p*1.45)):0;
const punch=att?(p<.27?-.18*Math.sin(Math.PI*p/.27):p<.43?ease((p-.27)/.16):1-ease((p-.43)/.57)):0;
const recoil=hit?Math.sin(Math.PI*clamp((age-180)/470,0,1)):0;
const victory=state.phase==="finished"&&state.winner===side;
const bounce=Math.sin(t/145+(blue?0:1.7))*3.5;
const knock=state.phase==="finished"&&state[side+"Hp"]===0;
const fall=knock?ease((Date.now()-(state.action?.at||Date.now())-180)/650):0;
ctx.save();ctx.translate(x+dir*(punch*31-recoil*22),y+(eisenkot?6:bibi?-6:0)+(knock?0:bounce)+fall*76);ctx.scale(dir*(eisenkot ? 1.1 : bibi ? 0.96 : 1),eisenkot ? 0.96 : bibi ? 1.03 : 1);
if(knock){ctx.rotate(-1.35*fall);ctx.translate(-25*fall,20*fall)}
else ctx.rotate(-recoil*.18+wind*.08);
ellipse(0,143,67,11,"#07102688");
// feet and independently moving legs
const step=(knock?0:1)*Math.sin(t/240+(blue?0:Math.PI))*7;
limb([-22,70],[-31+step,106],[-40+step,137],"#263b60","#0a1731",19);
limb([22,70],[35-step,108],[49-step,137],"#263b60","#0a1731",19);
boxingBoot(-40+step,eisenkot,true);boxingBoot(49-step,eisenkot,false);
// Sculpted arcade shoulders, skin shading and singlet panels.
ellipse(-27,-10,eisenkot?29:21,eisenkot?28:24,"#bd866a");ellipse(27,-10,eisenkot?29:22,eisenkot?28:24,skin);
// torso and shorts
const jersey=ctx.createLinearGradient(-40,0,42,25);jersey.addColorStop(0,dark);jersey.addColorStop(.55,main);jersey.addColorStop(1,dark);
path(eisenkot?[[-43,-5],[-34,-34],[30,-34],[47,8],[40,71],[-40,71]]:[[-35,-5],[-22,-37],[21,-37],[38,5],[29,71],[-31,71]],jersey,"#091832",5);
if(eisenkot){line([[-31,-25],[-20,-7],[18,-7],[30,-25]],"#e9e5df",3);path([[-39,20],[-30,23],[-27,64],[-38,64]],"#f2dfcf",null);path([[30,17],[41,14],[36,65],[27,65]],"#84263c",null)}
else{line([[-20,-32],[-15,-6],[15,-6],[22,-31]],"#e6ce8c",3);path([[-30,7],[-24,4],[-19,52],[-26,52]],"#d9e7f5",null);line([[25,15],[23,48]],"#79b5e3",2)}
path([[-35,56],[34,56],[32,80],[-34,80]],dark,"#0c1731",4);
box(-32,51,64,9,eisenkot?"#e0e3e8":"#e6c879",3);
path([[-22,-26],[0,-17],[13,32],[-12,29]],"#ffffff24");
// Chest panels, piping, belt hardware and fabric folds.
path([[-29,-26],[-20,-35],[-14,24],[-27,47]],light,null);
path([[25,-29],[35,-8],[25,47],[14,33]],dark,null);
line([[-20,4],[-8,11],[12,11]],"#ffffff45",2);
line([[-27,62],[-5,65],[-7,78]],"#080f2855",3);
line([[24,63],[8,65],[11,78]],"#080f2855",3);
box(-9,50,18,11,eisenkot?"#8b253c":"#fff0b1",2);
// Character-specific face geometry and neck silhouette.
fighterHead(side,bibi,eisenkot);
// Chest-level guard: tucked elbows and gloves in front of the upper torso.
limb([-27,-13],[-33,28],[-6,-9],skin,outline,eisenkot?20:16);
ellipse(-6,-9,21,20,dark);ellipse(-11,-15,9,6,light);box(-20,1,29,10,"#e1e8f2",3);
// front arm: shoulder -> elbow -> glove, jab/uppercut
const elbow=[mix(36,62,punch),victory?-56:mix(30,-42,punch)];
const glove=[mix(43,123,punch),victory?-118:mix(-10,special?-105:-62,punch)];
limb([29,-15],elbow,glove,skin,outline,eisenkot?21:16);
ctx.save();ctx.translate(...glove);ctx.rotate(-.18-punch*.35);
ellipse(0,0,23,21,main);box(-18,7,30,12,dark,5);ellipse(7,-7,10,7,light);line([[-13,-11],[-2,-16],[9,-13]],"#ffffff60",2);box(-16,11,26,7,"#e1e8f2",2);ctx.restore();
ctx.restore();
}
function giftInformation(side,x,y,showName){
 const he=state.language==="he",color=side==="blue"?"#a5d8ff":"#ffb0bb";
 box(x,y,236,showName?104:78,"#09172d",12);
 if(showName)txt(fighterName(side).slice(0,18),x+118,y+21,18,color);
 const top=y+(showName?27:2),attacks=state[side+"AttackGifts"];
 txt(he?"אגרוף":"Punch",x+184,top+23,18,color);
 const visible=attacks.slice(0,3),start=x+151-visible.length*34;visible.forEach((id,i)=>giftIcon(id,start+i*34,top,29));
 if(attacks.length>3)txt("+"+(attacks.length-3),x+26,top+22,13,color);
 if(!attacks.length)txt("—",x+131,top+23,18,"#7185a5");
 const healing=state[side+"HealGift"];
 txt(he?"ריפוי":"Heal",x+184,top+57,18,"#87e9b4");
 if(healing)giftIcon(healing,x+117,top+34,29);else txt("—",x+131,top+57,18,"#7185a5");
}
function arena(t){
const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#060d20");bg.addColorStop(.52,"#162c56");bg.addColorStop(1,"#091126");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
glow(70,310,230,"#1b74ff55");glow(460,300,230,"#fa315b44");
for(let i=0;i<7;i++){const x=40+i*77;glow(x,315,65,"#a7d6ff25");ellipse(x,315,8,8,"#cceaff")}
for(let i=0;i<55;i++){const x=(i*79)%W,y=374+(i%5)*25;ellipse(x,y,9,11,i%4===0?"#526b96":"#101d3b")}
path([[0,523],[W,523],[W,764],[0,764]],"#1b365d","#08152d",7);
for(let i=0;i<3;i++)line([[0,539+i*53],[W,539+i*53]],"#bed7f3",5);
path([[0,754],[W,754],[W,818],[0,818]],"#90a9cb","#162b49",5);
for(let i=0;i<11;i++)line([[i*54,754],[i*54+25,818]],"#b9c9dc44",2);
box(0,0,W,95,"#071127");
txt(state.language==="he"?"🥊 זירת האגרוף":"🥊 LIVE BOXING ARENA",270,58,27,"#f4f7ff");
txt(state.language==="he"?"הקרב הגדול":"MAIN EVENT",270,142,26,"#ffe3a0");
const above=state.giftInfoPosition==="aboveNames";
for(const side of ["blue","red"]){const left=side==="blue",x=left?22:282,hp=state[side+"Hp"],name=fighterName(side);
 const cardY=above?154:169,nameY=above?250:204,barY=above?264:218;
 box(x,cardY,236,above?170:107,"#0b1730",14);
 if(above)giftInformation(side,x,cardY+2,false);
 box(x+10,barY,216,24,"#263754",7);box(x+10,barY,216*hp/100,24,left?"#298fff":"#f34660",7);
 txt(name.slice(0,15),x+118,nameY,20,left?"#a5d8ff":"#ffb0bb");
 txt(Math.round(hp)+(state.language==="he"?" חיים":" HP"),x+118,barY+45,15)}
const rem=state.phase==="running"?Math.max(0,Math.ceil((state.endsAt-Date.now())/1000)):state.remaining;
const clockY=above?340:292;
box(204,clockY,132,62,"#070d1e",17);txt(String(rem).padStart(2,"0"),270,clockY+44,38,"#ffe4a1");
fighter(165,590,"blue",t);fighter(377,590,"red",t);
if(state.action&&Date.now()-state.action.at<660){const a=state.action,age=Date.now()-a.at;
 if(a.type==="heal"){const x=a.side==="blue"?165:377;glow(x,550,120,"#46e7a166");txt("+"+a.amount,x,485-age/15,32,"#83ffc4")}
 else if(age>140&&age<440){const x=a.side==="blue"?310:230;glow(x,524,90,a.side==="blue"?"#38aaff99":"#ff5b6799");txt("−"+a.amount,x,510,32,"#fff0b3")}}
if(!above){giftInformation("blue",22,832,true);giftInformation("red",282,832,true)}
if(state.phase!=="running"){box(45,above?412:397,450,62,"#071329e8",18);
const result=state.phase==="finished"?(state.winner==="draw"?(state.language==="he"?"תיקו!":"DRAW!"):fighterName(state.winner==="blue"?"blue":"red")+(state.language==="he"?" ניצח!":" WINS!")):(state.language==="he"?"מוכנים לקרב?":"READY TO FIGHT?");
txt(result.slice(0,23),270,above?453:438,30,"#ffe69b")}
}
let lastFrame=0;
function draw(t){const dt=Math.min(2.5,(t-lastFrame)/16.67||1);lastFrame=t;
ctx.save();const a=state.action,age=a?Date.now()-a.at:9999;
if(a?.type!=="heal"&&age>150&&age<350){const shake=a.power>=20?8:3;ctx.translate(rnd(-shake,shake),rnd(-shake,shake))}
arena(t);ctx.restore();
if(a&&a.type!=="heal"&&age>=180&&age<660&&a.at!==lastAction.at){lastAction.at=a.at;burst(a.side==="blue"?315:225,a.type==="special"?484:522,a.side,a.type==="special")}
for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.22*dt;p.life-=dt;ctx.globalAlpha=clamp(p.life/p.max,0,1);ellipse(p.x,p.y,p.r,p.r,p.color);ctx.globalAlpha=1;if(p.life<=0)particles.splice(i,1)}
portrait("blue",state.blueImage);portrait("red",state.redImage);
requestAnimationFrame(draw)}
requestAnimationFrame(draw)}

// Only the dashboard tab owns the match timer. This avoids duplicate timeouts.
localize();renderControls();
if($("save"))setInterval(()=>{if(state.phase==="running"&&Date.now()>=state.endsAt)finish()},200);


// The optional local Python relay also reaches isolated Live Studio browser profiles.
// Static hosting still works using the original BroadcastChannel/storage transport.
(async function relay(){
 let available=false,publishing=Promise.resolve();
 const controller=!!$("save");
 async function readRelay(){const response=await fetch("./api/state",{cache:"no-store",signal:AbortSignal.timeout(2000)});if(!response.ok)throw Error();const body=await response.json();if(body.protocol!==KEY)throw Error();return body.state===null?null:normalizeState(body.state)}
 try{
 const remote=await readRelay();available=true;
 if(controller){
 publishState=next=>{const snapshot=JSON.stringify(next);publishing=publishing.catch(()=>{}).then(async()=>{
 const response=await fetch("./api/state",{method:"POST",headers:{"Content-Type":"application/json","X-Boxing-Request":"1"},body:snapshot,signal:AbortSignal.timeout(2000)});
 if(!response.ok)throw Error("Relay refused state");
 }).catch(()=>log(state.language==="he"?"סנכרון מקומי נכשל — בדקו שהשרת פתוח":"Local relay sync failed — check the server"))};
 if(remote){state=normalizeState(remote);renderControls();for(const field of ["language","blueName","redName","blueImage","redImage","duration","giftInfoPosition"])$(field).value=state[field];refreshGiftControls(true);}
 else publishState(state);
 }else if(remote)sync(remote);
 }catch{return}
 if(!controller&&available){
 async function poll(){try{const next=await readRelay();if(next)sync(next)}catch{}setTimeout(poll,120)}
 poll();
 }
})();
