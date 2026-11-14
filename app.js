let refreshBridge=()=>{},refreshStats=()=>{},publishState=()=>{};
const translationsHe=["מרכז השליטה בשידור","אולפן מקומי","נהלו את הקרב, התאימו את המתמודדים ובדקו אינטראקציות בשידור.","פתיחת מסך השידור 9:16","העתקת קישור לשידור","מצב הקרב","זמן שנותר","חיים — כחול","חיים — אדום","01 / מתמודדים","הגדרת מתמודדים","ניתן להתאמה","בחירת עימות מוכן","ביבי נגד איזנקוט","מסי נגד רונאלדו","עימות מותאם אישית","המתמודד הכחול","המתמודד האדום","קישור לתמונת המתמודד הכחול","קישור לתמונת המתמודד האדום","לביבי ולאיזנקוט יש דמויות מאוירות מובנות. אפשר להחליף אותן באמצעות קישור לתמונה.","02 / חוקי הקרב","הגדרות הקרב","שפת התצוגה","משך הסיבוב (בשניות)","שמירת הגדרות","התחלת סיבוב","איפוס","03 / אירועי שידור","שליטה בקרב","מצב בדיקה","אגרוף של הכחול","אגרוף של האדום","מתקפה מיוחדת — כחול","מתקפה מיוחדת — אדום","תגובה 1","תגובה 2","מתנה לכחול","מתנה לאדום","הצבעות לכחול: 0","הצבעות לאדום: 0","04 / חיבור לשידור","חיבור אירועים","התחברות","מצב הדגמה · אין חיבור לשידור חי","החיבור ל־S2E עדיין לא נבדק. כרגע ניתן לקבל אירועי בדיקה בפורמט JSON בלבד.","אירועים אחרונים","תצוגת שידור","תצוגה מקדימה","התצוגה מתעדכנת בזמן אמת. השאירו את לוח הבקרה פתוח בזמן השידור.","זירת האגרוף בשידור חי · גרסת הדגמה מקומית · החיבור לטיקטוק אינו פעיל כברירת מחדל"];
const originalLabels={};

const KEY="boxing-arena-v1";
const defaults={language:"en",blueName:"BIBI",redName:"EISENKOT",blueImage:"",redImage:"",duration:60,remaining:60,blueHp:100,redHp:100,blueVotes:0,redVotes:0,phase:"ready",winner:null,startedAt:0,endsAt:0,action:null,revision:0};
function read(){try{
 const saved=JSON.parse(localStorage.getItem(KEY)||"{}");
 if(!saved||typeof saved!=="object"||Array.isArray(saved))return {...defaults};
 const next={...defaults,...saved};
 for(const field of ["duration","remaining","blueHp","redHp","blueVotes","redVotes","startedAt","endsAt","revision"])if(!Number.isFinite(next[field])||next[field]<0)next[field]=defaults[field];
 next.duration=Math.min(300,Math.max(15,Math.round(next.duration)));
 next.blueHp=Math.min(100,next.blueHp);next.redHp=Math.min(100,next.redHp);
 next.language=next.language==="he"?"he":"en";
 for(const field of ["blueName","redName","blueImage","redImage"])if(typeof next[field]!=="string")next[field]=defaults[field];
 if(!["ready","running","finished"].includes(next.phase))next.phase="ready";
 if(next.action&&(!["blue","red"].includes(next.action.side)||!Number.isFinite(next.action.at)))next.action=null;
 return next;
 }catch{return {...defaults}}}
let state=read();
const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(KEY):null;
function commit(patch){state={...state,...patch,revision:Math.max(Date.now(),Number(state.revision)+1)};try{localStorage.setItem(KEY,JSON.stringify(state))}catch{log(state.language==="he"?"לא ניתן לשמור בדפדפן":"Browser storage unavailable")}channel?.postMessage(state);publishState(state);renderControls()}
function sync(next){if(next?.revision>=state.revision){state={...defaults,...next};localize();renderControls()}}
channel&&(channel.onmessage=e=>sync(e.data));
window.addEventListener("storage",e=>{if(e.key===KEY)sync(read())});
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function log(message){const el=$("log");if(!el)return;const row=document.createElement("div");row.dir="auto";row.textContent=new Date().toLocaleTimeString(state.language==="he"?"he-IL":"en-US")+" "+message;el.prepend(row);while(el.children.length>60)el.lastChild.remove()}
function action(side,power=6,type="punch"){if(!["blue","red"].includes(side)||state.phase!=="running")return;if(Date.now()>=state.endsAt){finish();return}if(state.action&&Date.now()-state.action.at<660)return;const target=side==="blue"?"redHp":"blueHp";const hp=clamp(state[target]-power,0,100);const patch={[target]:hp,action:{side,type,at:Date.now(),id:crypto.randomUUID()},winner:hp===0?side:null};if(hp===0){patch.phase="finished";patch.remaining=Math.max(0,Math.ceil((state.endsAt-Date.now())/1000))}commit(patch);log((state.language==="he"?(side==="blue"?"כחול":"אדום")+" · "+({punch:"אגרוף",special:"מתקפה מיוחדת",gift:"מתנה"}[type]||type):side+" "+type)+" (-"+power+")")}
function vote(side){if(!["blue","red"].includes(side)||state.phase!=="running")return;if(Date.now()>=state.endsAt){finish();return}const field=side+"Votes";const n=state[field]+1;commit({[field]:n});if(n%3===0)action(side,4,"punch");log(state.language==="he"?"הצבעה ל"+(side==="blue"?"כחול":"אדום"):side+" vote")}
function start(){const duration=clamp(Number(state.duration)||60,15,300);commit({phase:"running",remaining:duration,blueHp:100,redHp:100,blueVotes:0,redVotes:0,winner:null,action:null,startedAt:Date.now(),endsAt:Date.now()+duration*1000});log(state.language==="he"?"הסיבוב התחיל":"Round started")}
function reset(){commit({phase:"ready",blueHp:100,redHp:100,blueVotes:0,redVotes:0,remaining:Number(state.duration)||60,winner:null,action:null,endsAt:0});log(state.language==="he"?"הקרב אופס":"Reset")}
function finish(){if(state.phase!=="running")return;const winner=state.blueHp===state.redHp?(state.blueVotes===state.redVotes?"draw":state.blueVotes>state.redVotes?"blue":"red"):state.blueHp>state.redHp?"blue":"red";commit({phase:"finished",remaining:0,winner});log(state.language==="he"?"הסיבוב הסתיים: "+({blue:state.blueName,red:state.redName,draw:"תיקו"}[winner]):"Round finished: "+winner)}
function renderControls(){if(!$("save"))return;localize();refreshStats();document.querySelectorAll("[data-hit],[data-special],[data-vote],[data-gift]").forEach(b=>b.disabled=state.phase!=="running");$("start").disabled=state.phase==="running";const status=$("status");if(status&&!status.dataset.connected)status.textContent=state.language==="he"?"מצב הדגמה · אין חיבור לשידור חי":"Demo mode · no live connection"}
if($("save")){for(const field of ["language","blueName","redName","blueImage","redImage","duration"]){$(field).value=state[field];}
$("save").onclick=()=>{const patch={};for(const f of ["language","blueName","redName","blueImage","redImage"])patch[f]=$(f).value.trim();patch.duration=clamp(Math.round(Number($("duration").value)||60),15,300);patch.blueName=patch.blueName||"BIBI";patch.redName=patch.redName||"EISENKOT";if(state.phase!=="running")patch.remaining=patch.duration;$("duration").value=patch.duration;$("blueName").value=patch.blueName;$("redName").value=patch.redName;commit(patch);log(state.language==="he"?"ההגדרות נשמרו":"Settings saved")};
$("start").onclick=start;$("reset").onclick=reset;
document.querySelectorAll("[data-hit]").forEach(b=>b.onclick=()=>action(b.dataset.hit));
document.querySelectorAll("[data-special]").forEach(b=>b.onclick=()=>action(b.dataset.special,20,"special"));
document.querySelectorAll("[data-vote]").forEach(b=>b.onclick=()=>vote(b.dataset.vote));
document.querySelectorAll("[data-gift]").forEach(b=>b.onclick=()=>action(b.dataset.gift,12,"gift"));
let ws=null;
const seen=new Set();
refreshBridge=()=>bridgeStatus(ws?.readyState===WebSocket.OPEN);
function bridgeStatus(connected){
 for(const id of ["status","connectionBadge"]){const el=$(id);el.dataset.connected=connected?"1":"";}
 $("status").textContent=state.language==="he"?(connected?"גשר בדיקה מחובר · S2E לא אומת":"מצב הדגמה · אין חיבור לשידור חי"):(connected?"Test bridge connected · S2E unverified":"Demo mode · no live connection");
 $("connectionBadge").textContent=state.language==="he"?(connected?"● גשר בדיקה":"● הדגמה"):(connected?"● TEST BRIDGE":"● DEMO");
 $("connect").querySelector("span").textContent=state.language==="he"?(connected?"ניתוק":"התחברות"):(connected?"Disconnect bridge":"Connect bridge");
}
$("connect").onclick=()=>{
 if(ws){const previous=ws;ws=null;previous.close();bridgeStatus(false);return}
 const url=$("wsUrl").value.trim();
 try{const parsed=new URL(url);if(!["ws:","wss:"].includes(parsed.protocol))throw Error();}catch{log(state.language==="he"?"יש להזין כתובת ws:// או wss://":"Enter a ws:// or wss:// URL");return}
 try{
 const socket=new WebSocket(url);ws=socket;
 socket.onopen=()=>{if(ws===socket){bridgeStatus(true);log("Test bridge connected · S2E unverified")}};
 socket.onclose=()=>{if(ws===socket){ws=null;bridgeStatus(false)}};
 socket.onerror=()=>{if(ws===socket)log("Bridge error")};
 socket.onmessage=e=>{if(ws!==socket)return;try{
 if(typeof e.data!=="string"||e.data.length>4096)throw Error();
 const event=JSON.parse(e.data);
 if(!event||!["vote","comment","like","gift","punch","special"].includes(event.type)||!["blue","red"].includes(event.side))throw Error();
 if(event.id!==undefined){if(typeof event.id!=="string"||event.id.length>128)throw Error();if(seen.has(event.id))return;seen.add(event.id);if(seen.size>1000)seen.delete(seen.values().next().value)}
 if(event.type==="vote"||event.type==="comment"||event.type==="like")vote(event.side);
 else action(event.side,event.type==="special"?20:event.type==="gift"?12:6,event.type);
 }catch{log(state.language==="he"?"אירוע לא תקין נדחה":"Invalid event rejected")}};
 }catch{ws=null;bridgeStatus(false);log("Connection failed")}
};
// Recompute connection text when the UI language changes.
$("language").addEventListener("change",()=>queueMicrotask(()=>bridgeStatus(ws?.readyState===WebSocket.OPEN)));
}



if($("preset")){
$("language").addEventListener("change",()=>{commit({language:$("language").value})});
$("preset").onchange=()=>{const p=$("preset").value;if(p==="bibi"){$("blueName").value="BIBI";$("redName").value="EISENKOT"}else if(p==="football"){$("blueName").value="MESSI";$("redName").value="RONALDO"}if(p!=="custom"){$("blueImage").value="";$("redImage").value=""}log(state.language==="he"?"הקרב נבחר — לחצו על שמירת הגדרות כדי להחיל":"Preset selected — click Save settings to apply")};
$("copyOverlay").onclick=async()=>{const url=new URL("./overlay.html",location.href).href;try{await navigator.clipboard.writeText(url);$("copyOverlay").querySelector("span").textContent=state.language==="he"?"✓ הועתק":"✓ Copied";setTimeout(()=>localize(),1800)}catch{window.prompt("Copy overlay URL:",url)}};
function stats(){const remaining=state.phase==="running"?Math.max(0,Math.ceil((state.endsAt-Date.now())/1000)):state.remaining;$("matchStatus").textContent=state.language==="he"?({ready:"מוכן",running:"מתנהל",finished:"הסתיים"}[state.phase]||state.phase):state.phase.toUpperCase();$("timeStat").textContent=remaining+(state.language==="he"?" שנ׳":"s");$("blueStat").textContent=Math.round(state.blueHp)+"%";$("redStat").textContent=Math.round(state.redHp)+"%";$("blueVotesStat").textContent=(state.language==="he"?"הצבעות לכחול: ":"Blue votes: ")+state.blueVotes;$("redVotesStat").textContent=(state.language==="he"?"הצבעות לאדום: ":"Red votes: ")+state.redVotes}
refreshStats=stats;setInterval(stats,150);stats();
}


function localize(){
const hebrew=state.language==="he";
document.querySelectorAll("[data-tab-en]").forEach(el=>el.textContent=hebrew?el.dataset.tabHe:el.dataset.tabEn);
document.documentElement.lang=hebrew?"he":"en";
document.documentElement.dir=hebrew?"rtl":"ltr";
const arena=$("arena");if(arena)arena.setAttribute("aria-label",state.blueName+": "+state.blueHp+" · "+state.redName+": "+state.redHp);
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

const canvas=$("arena");
if(canvas){
const ctx=canvas.getContext("2d");
const portraits={blue:new Image(),red:new Image()},urls={blue:"",red:""};
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
function portrait(side,url){if(url===urls[side])return;urls[side]=url;portraits[side]=new Image();if(/^https?:\/\//.test(url))portraits[side].src=url}
function burst(x,y,side,special){for(let i=0;i<(special?40:18);i++){const a=rnd(0,Math.PI*2),speed=rnd(2,special?14:9);particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:rnd(16,35),max:35,r:rnd(2,special?8:5),color:i%3===0?"#fff":side==="blue"?"#65d7ff":"#ffb44b"})}}
function limb(a,b,c,color,edge,w){line([a,b,c],edge,w+7);line([a,b,c],color,w)}
function fighter(x,y,side,t){
const blue=side==="blue",dir=blue?1:-1,main=blue?"#2377f7":"#f23e60",light=blue?"#79d7ff":"#ff9a74",dark=blue?"#163c95":"#91243e";
const a=state.action,age=a?Date.now()-a.at:9999,att=a?.side===side&&age<660,hit=!!a&&a.side!==side&&age>=180&&age<650;
const special=att&&a.type==="special",p=att?clamp(age/660,0,1):0,wind=att?Math.sin(Math.PI*Math.min(1,p*1.45)):0;
const punch=att?(p<.27?-.18*Math.sin(Math.PI*p/.27):p<.43?ease((p-.27)/.16):1-ease((p-.43)/.57)):0;
const recoil=hit?Math.sin(Math.PI*clamp((age-180)/470,0,1)):0;
const victory=state.phase==="finished"&&state.winner===side;
const bounce=Math.sin(t/145+(blue?0:1.7))*3.5;
const knock=state.phase==="finished"&&state[side+"Hp"]===0;
const fall=knock?ease((Date.now()-(state.action?.at||Date.now())-180)/650):0;
ctx.save();ctx.translate(x+dir*(punch*31-recoil*22),y+(knock?0:bounce)+fall*76);ctx.scale(dir,1);
if(knock){ctx.rotate(-1.35*fall);ctx.translate(-25*fall,20*fall)}
else ctx.rotate(-recoil*.18+wind*.08);
ellipse(0,143,67,11,"#07102688");
// feet and independently moving legs
const step=(knock?0:1)*Math.sin(t/240+(blue?0:Math.PI))*7;
limb([-22,70],[-31+step,106],[-40+step,137],"#263b60","#0a1731",19);
limb([22,70],[35-step,108],[49-step,137],"#263b60","#0a1731",19);
ellipse(-41+step,139,27,12,main);ellipse(48-step,139,27,12,main);
// Sculpted arcade shoulders, skin shading and singlet panels.
ellipse(-27,-10,24,26,"#bf7d61");ellipse(27,-10,25,26,"#f3bc97");
// torso and shorts
path([[-39,-5],[-26,-37],[22,-37],[42,5],[33,71],[-35,71]],main,"#091832",6);
path([[-35,56],[34,56],[32,80],[-34,80]],dark,"#0c1731",4);
box(-32,51,64,9,"#f5d37d",3);
path([[-22,-26],[0,-17],[13,32],[-12,29]],"#ffffff24");
// Chest panels, piping, belt hardware and fabric folds.
path([[-29,-26],[-20,-35],[-14,24],[-27,47]],light,null);
path([[25,-29],[35,-8],[25,47],[14,33]],dark,null);
line([[-20,4],[-8,11],[12,11]],"#ffffff45",2);
line([[-27,62],[-5,65],[-7,78]],"#080f2855",3);
line([[24,63],[8,65],[11,78]],"#080f2855",3);
box(-9,50,18,11,"#fff0b1",2);
// Neck and larger expressive head, attached to the existing face rig.
ellipse(0,-35,20,16,"#b87c61");
ctx.save();ctx.translate(0,10);ctx.scale(1.12,1.12);
ellipse(0,-56,34,38,"#d89c78");
ellipse(-5,-62,32,30,"#efb58d");
// Distinct caricature presets: Bibi has a full swept silver hairstyle,
// Eisenkot has a short grey buzz cut and a broader, squarer jaw.
const name=String(state[side+"Name"]||"").toLowerCase();
const bibi=/bibi|netanyahu|ביבי|נתניהו/.test(name);
const eisenkot=/eisenkot|איזנקוט|אייזנקוט/.test(name);
const img=portraits[side];
if(img.complete&&img.naturalWidth){
 ctx.save();ctx.beginPath();ctx.ellipse(-2,-59,31,35,0,0,Math.PI*2);ctx.clip();ctx.drawImage(img,-34,-94,64,70);ctx.restore();
}else if(bibi){
 ellipse(-4,-59,32,37,"#e7ad8c");
 // Silver side-swept hair, high forehead, heavy brows and prominent nose
 path([[-35,-70],[-34,-89],[-18,-102],[10,-104],[30,-92],[30,-77],[11,-87],[-5,-83],[-20,-73]],"#b9c2ce","#283248",3);
 path([[-25,-94],[-5,-99],[17,-95],[28,-86]],null,"#eef2f7",4);
 line([[4,-64],[19,-67]],"#44342f",5);ellipse(17,-58,3,3,"#202337");
 path([[22,-58],[29,-43],[20,-41]],"#d28c6e","#8b5549",2);
 line([[7,-32],[23,-33]],"#8c4e47",2);
 line([[0,-73],[19,-74]],"#aa735e",2);
}else if(eisenkot){
 ellipse(-4,-57,35,39,"#c89170");
 // Close-cropped salt-and-pepper hair and pronounced square jaw
 path([[-37,-73],[-31,-94],[-11,-99],[15,-97],[32,-85],[33,-71],[17,-85],[-8,-86],[-27,-78]],"#85888a","#283044",3);
 for(let i=0;i<7;i++)line([[-24+i*7,-88-Math.sin(i)*3],[-21+i*7,-90-Math.sin(i)*3]],"#c7c7c5",2);
 line([[2,-65],[21,-67]],"#4d403c",6);ellipse(19,-57,3,3,"#222331");
 path([[24,-58],[30,-44],[20,-43]],"#c18a6d","#855f50",2);
 line([[6,-32],[26,-32]],"#70463d",3);
 line([[0,-74],[22,-75]],"#8c6253",2);
}else{
 path([[-34,-67],[-25,-91],[0,-99],[24,-91],[31,-72],[10,-79],[-14,-79]],"#1b2037","#11172a",3);
 ellipse(15,-60,3,4,"#202034");line([[13,-39],[23,-40]],"#7b4b41",2);
}
// Ear, cheek planes, brow crease and jaw highlights.
ellipse(-29,-57,6,10,"#ca896c");line([[-30,-61],[-27,-55],[-30,-52]],"#a26753",2);
line([[-17,-44],[-11,-39]],"#bc8066",2);
line([[-12,-27],[4,-24],[17,-27]],"#f5c3a1",2);
ctx.restore();
// rear guard
limb([-27,-13],[-49,-33],[-30,-67],"#e6a37d","#14203a",16);
ellipse(-28,-66,21,20,dark);ellipse(-33,-72,9,6,light);box(-42,-56,29,10,"#e1e8f2",3);
// front arm: shoulder -> elbow -> glove, jab/uppercut
const elbow=[mix(37,62,punch),mix(-10,-42,punch)];
const glove=[mix(53,123,punch),victory?-118:mix(-50,special?-105:-62,punch)];
limb([29,-15],elbow,glove,"#e6a37d","#14203a",17);
ctx.save();ctx.translate(...glove);ctx.rotate(-.18-punch*.35);
ellipse(0,0,23,21,main);box(-18,7,30,12,dark,5);ellipse(7,-7,10,7,light);line([[-13,-11],[-2,-16],[9,-13]],"#ffffff60",2);box(-16,11,26,7,"#e1e8f2",2);ctx.restore();
ctx.restore();
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
for(const side of ["blue","red"]){const left=side==="blue",x=left?22:282,hp=state[side+"Hp"],name=state[side+"Name"];
box(x,169,236,107,"#0b1730",14);box(x+10,218,216,24,"#263754",7);
box(x+10,218,216*hp/100,24,left?"#298fff":"#f34660",7);
txt(name.slice(0,15),x+118,204,20,left?"#a5d8ff":"#ffb0bb");
txt(Math.round(hp)+(state.language==="he"?" חיים":" HP"),x+118,263,15)}
const rem=state.phase==="running"?Math.max(0,Math.ceil((state.endsAt-Date.now())/1000)):state.remaining;
box(204,292,132,62,"#070d1e",17);txt(String(rem).padStart(2,"0"),270,336,38,"#ffe4a1");
fighter(165,590,"blue",t);fighter(377,590,"red",t);
if(state.action&&Date.now()-state.action.at<660){const a=state.action,age=Date.now()-a.at,impact=clamp((age-140)/150,0,1);
if(age>140&&age<440){const x=a.side==="blue"?310:230,y=a.type==="special"?485:524;glow(x,y,110*(1-impact*.5),a.side==="blue"?"#38aaff99":"#ff5b6799");txt(a.type==="special"?"✦ BOOM! ✦":"✦",x,y,age<290?40:25,"#fff0b3")}}
box(20,840,500,91,"#071329",16);
txt("🔵 "+state.blueVotes+(state.language==="he"?"   הצבעות   ":"   VOTES   ")+state.redVotes+" 🔴",270,875,22);
txt(state.language==="he"?"כתבו 1 או 2 כדי להצביע":"COMMENT 1 OR 2 TO VOTE",270,907,18,"#b5d5ff");
if(state.phase!=="running"){box(45,396,450,83,"#071329e8",18);
const result=state.phase==="finished"?(state.winner==="draw"?(state.language==="he"?"תיקו!":"DRAW!"):(state.winner==="blue"?state.blueName:state.redName)+(state.language==="he"?" ניצח!":" WINS!")):(state.language==="he"?"מוכנים לקרב?":"READY TO FIGHT?");
txt(result.slice(0,23),270,449,30,"#ffe69b")}
}
let lastFrame=0;
function draw(t){const dt=Math.min(2.5,(t-lastFrame)/16.67||1);lastFrame=t;
ctx.save();const a=state.action,age=a?Date.now()-a.at:9999;
if(age>150&&age<350){const shake=a.type==="special"?8:3;ctx.translate(rnd(-shake,shake),rnd(-shake,shake))}
arena(t);ctx.restore();
if(a&&age>=180&&age<660&&a.at!==lastAction.at){lastAction.at=a.at;burst(a.side==="blue"?315:225,a.type==="special"?484:522,a.side,a.type==="special")}
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
 async function readRelay(){const response=await fetch("./api/state",{cache:"no-store",signal:AbortSignal.timeout(2000)});if(!response.ok)throw Error();const body=await response.json();if(body.protocol!==KEY)throw Error();return body.state}
 try{
 const remote=await readRelay();available=true;
 if(controller){
 publishState=next=>{const snapshot=JSON.stringify(next);publishing=publishing.catch(()=>{}).then(async()=>{
 const response=await fetch("./api/state",{method:"POST",headers:{"Content-Type":"application/json"},body:snapshot,signal:AbortSignal.timeout(2000)});
 if(!response.ok)throw Error("Relay refused state");
 }).catch(()=>log(state.language==="he"?"סנכרון מקומי נכשל — בדקו שהשרת פתוח":"Local relay sync failed — check the server"))};
 if(remote){state={...defaults,...remote};renderControls();for(const field of ["language","blueName","redName","blueImage","redImage","duration"])$(field).value=state[field];}
 else publishState(state);
 }else if(remote)sync(remote);
 }catch{return}
 if(!controller&&available){
 async function poll(){try{const next=await readRelay();if(next)sync(next)}catch{}setTimeout(poll,120)}
 poll();
 }
})();
