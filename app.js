const KEY="boxing-arena-v1";
const defaults={language:"en",blueName:"BIBI",redName:"EISENKOT",blueImage:"",redImage:"",duration:60,remaining:60,blueHp:100,redHp:100,blueVotes:0,redVotes:0,phase:"ready",winner:null,startedAt:0,endsAt:0,action:null,revision:0};
function read(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return {...defaults}}}
let state=read();
const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(KEY):null;
function commit(patch){state={...state,...patch,revision:Date.now()};localStorage.setItem(KEY,JSON.stringify(state));channel?.postMessage(state);renderControls()}
function sync(next){if(next?.revision>=state.revision){state=next;renderControls()}}
channel&&(channel.onmessage=e=>sync(e.data));
window.addEventListener("storage",e=>{if(e.key===KEY)sync(read())});
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function log(message){const el=$("log");if(!el)return;const row=document.createElement("div");row.textContent=new Date().toLocaleTimeString()+" "+message;el.prepend(row);while(el.children.length>60)el.lastChild.remove()}
function action(side,power=6,type="punch"){if(state.phase!=="running")return;const target=side==="blue"?"redHp":"blueHp";const hp=clamp(state[target]-power,0,100);const patch={[target]:hp,action:{side,type,at:Date.now()},winner:hp===0?side:null};if(hp===0)patch.phase="finished";commit(patch);log(side+" "+type+" (-"+power+")")}
function vote(side){if(state.phase!=="running")return;const field=side+"Votes";const n=state[field]+1;commit({[field]:n});if(n%3===0)action(side,4,"punch");log(side+" vote")}
function start(){const duration=clamp(Number(state.duration)||60,15,300);commit({phase:"running",remaining:duration,blueHp:100,redHp:100,blueVotes:0,redVotes:0,winner:null,action:null,startedAt:Date.now(),endsAt:Date.now()+duration*1000});log("Round started")}
function reset(){commit({phase:"ready",blueHp:100,redHp:100,blueVotes:0,redVotes:0,remaining:Number(state.duration)||60,winner:null,action:null,endsAt:0});log("Reset")}
function finish(){if(state.phase!=="running")return;const winner=state.blueHp===state.redHp?(state.blueVotes===state.redVotes?"draw":state.blueVotes>state.redVotes?"blue":"red"):state.blueHp>state.redHp?"blue":"red";commit({phase:"finished",remaining:0,winner});log("Round finished: "+winner)}
function renderControls(){if(!$("save"))return;const status=$("status");if(status&&!status.dataset.connected)status.textContent="Demo mode · no live connection"}
if($("save")){for(const field of ["language","blueName","redName","blueImage","redImage","duration"]){$(field).value=state[field];}
$("save").onclick=()=>{const patch={};for(const f of ["language","blueName","redName","blueImage","redImage"])patch[f]=$(f).value.trim();patch.duration=clamp(Number($("duration").value)||60,15,300);commit(patch);log("Settings saved")};
$("start").onclick=start;$("reset").onclick=reset;
document.querySelectorAll("[data-hit]").forEach(b=>b.onclick=()=>action(b.dataset.hit));
document.querySelectorAll("[data-special]").forEach(b=>b.onclick=()=>action(b.dataset.special,20,"special"));
document.querySelectorAll("[data-vote]").forEach(b=>b.onclick=()=>vote(b.dataset.vote));
document.querySelectorAll("[data-gift]").forEach(b=>b.onclick=()=>action(b.dataset.gift,12,"gift"));
let ws=null;$("connect").onclick=()=>{if(ws)ws.close();const url=$("wsUrl").value.trim();if(!/^wss?:\/\//.test(url)){log("Enter a ws:// or wss:// URL");return}try{ws=new WebSocket(url);ws.onopen=()=>{const e=$("status");e.textContent="Bridge connected";e.dataset.connected="1";log("Bridge connected")};ws.onclose=()=>{const e=$("status");e.textContent="Bridge disconnected";delete e.dataset.connected};ws.onerror=()=>log("Bridge error");ws.onmessage=e=>{try{const event=JSON.parse(e.data);if(!["vote","gift","punch","special"].includes(event.type)||!["blue","red"].includes(event.side))return;if(event.type==="vote")vote(event.side);else action(event.side,event.type==="special"?20:event.type==="gift"?12:6,event.type)}catch{log("Invalid event received")}}}catch{log("Connection failed")}}}
const canvas=$("arena");if(canvas){const ctx=canvas.getContext("2d");const portraits={blue:new Image(),red:new Image()};let urls={blue:"",red:""};function portrait(side,url){if(url===urls[side])return;urls[side]=url;portraits[side]=new Image();if(/^https?:\/\//.test(url))portraits[side].src=url}
function text(t,x,y,size=24,color="#fff",align="center"){ctx.fillStyle=color;ctx.font="900 "+size+"px system-ui,Arial";ctx.textAlign=align;ctx.fillText(String(t),x,y)}
function rect(x,y,w,h,color,r=0){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function fighter(x,y,side,t){const blue=side==="blue",direction=blue?1:-1,color=blue?"#2b88ff":"#fa465b",p=state.action,age=p?Date.now()-p.at:9999,attacking=p?.side===side&&age<420,hit=p?.side!==side&&age<420,offset=attacking?Math.sin(age/420*Math.PI)*38:0,bob=Math.sin(t/220+ (blue?0:2))*4;ctx.save();ctx.translate(x+direction*offset+(hit?-direction*15:0),y+bob);ctx.scale(direction,1);ctx.lineCap="round";ctx.strokeStyle="#111c34";ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(-16,65);ctx.lineTo(-24,130);ctx.moveTo(18,65);ctx.lineTo(30,130);ctx.stroke();rect(-42,2,82,76,color,18);rect(-35,55,70,20,blue?"#d5e7ff":"#ffe0e5",5);ctx.fillStyle="#edb98e";ctx.beginPath();ctx.arc(0,-33,35,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#111827";ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,-33,35,Math.PI*1.08,Math.PI*1.92);ctx.stroke();const img=portraits[side];if(img.complete&&img.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(0,-33,32,0,Math.PI*2);ctx.clip();ctx.drawImage(img,-33,-66,66,66);ctx.restore()}else{rect(6,-40,7,5,"#15192c",2);rect(14,-19,13,3,"#6b3e36",2)}ctx.strokeStyle="#edb98e";ctx.lineWidth=17;ctx.beginPath();ctx.moveTo(25,18);ctx.lineTo(attacking?100:51,attacking?-12:-2);ctx.moveTo(-28,18);ctx.lineTo(-55,-6);ctx.stroke();rect(attacking?83:35,attacking?-32:-22,38,35,color,13);rect(-72,-25,38,35,color,13);ctx.restore()}
function draw(t){const w=540,h=960;ctx.clearRect(0,0,w,h);const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#091329");bg.addColorStop(.65,"#263a63");bg.addColorStop(1,"#0d1529");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
for(let i=0;i<26;i++){const x=(i*83)%540,y=340+(i%5)*27;ctx.fillStyle=i%3===0?"#8db9ed":"#172c50";ctx.beginPath();ctx.arc(x,y,10,0,7);ctx.fill()}
rect(0,0,540,100,"#081025");text("🥊 LIVE BOXING ARENA",270,57,27);
text(state.language==="he"?"הקרב הגדול":"THE MAIN EVENT",270,141,24,"#fbd87b");
rect(24,171,232,102,"#111d36",15);rect(284,171,232,102,"#111d36",15);
text(state.blueName.slice(0,14),140,204,20,"#91c8ff");text(state.redName.slice(0,14),400,204,20,"#ff9ca9");
rect(41,222,196,20,"#273651",7);rect(303,222,196,20,"#273651",7);
rect(41,222,196*state.blueHp/100,20,"#338dff",7);rect(303,222,196*state.redHp/100,20,"#ff4b62",7);
text(Math.round(state.blueHp)+" HP",140,261,15);text(Math.round(state.redHp)+" HP",400,261,15);
const remaining=state.phase==="running"?Math.max(0,Math.ceil((state.endsAt-Date.now())/1000)):state.remaining;
rect(201,288,138,61,"#080d1c",18);text(String(remaining).padStart(2,"0"),270,333,36,"#ffe7a4");
ctx.fillStyle="#233e67";ctx.fillRect(0,505,540,260);ctx.strokeStyle="#cfe8ff";ctx.lineWidth=7;for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(0,525+j*45);ctx.lineTo(540,525+j*45);ctx.stroke()}rect(15,715,510,62,"#c7d7ed",10);rect(22,730,496,25,"#8295b7",4);
fighter(163,585,"blue",t);fighter(379,585,"red",t);
if(state.action&&Date.now()-state.action.at<350){const p=state.action;const x=p.side==="blue"?305:235;text(p.type==="special"?"💥":p.type==="gift"?"✨":"✦",x,530,48,"#fff3b2")}
rect(20,809,500,106,"#091329",20);text("🔵 "+state.blueVotes+"   VOTES   "+state.redVotes+" 🔴",270,852,23);text(state.language==="he"?"כתבו 1 או 2 כדי להצביע":"COMMENT 1 OR 2 TO VOTE",270,892,19,"#b7d7ff");
if(state.phase!=="running"){rect(48,380,444,88,"#08132bdd",20);const result=state.phase==="finished"?(state.winner==="draw"?"DRAW!":(state.winner==="blue"?state.blueName:state.redName)+" WINS!"):(state.language==="he"?"מוכנים לקרב?":"READY TO FIGHT?");text(result.slice(0,23),270,435,30,"#ffe59a")}
portrait("blue",state.blueImage);portrait("red",state.redImage);requestAnimationFrame(draw)}
requestAnimationFrame(draw)}
// Only the dashboard tab owns the match timer. This avoids duplicate timeouts.
if($("save"))setInterval(()=>{if(state.phase==="running"&&Date.now()>=state.endsAt)finish()},200);
