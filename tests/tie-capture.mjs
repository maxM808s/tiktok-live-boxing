import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base=process.env.BOXING_TIE_URL||'http://127.0.0.1:8770',pause=ms=>new Promise(r=>setTimeout(r,ms));
for(const target of await(await fetch('http://127.0.0.1:9222/json')).json())if(target.url.startsWith(base))await fetch('http://127.0.0.1:9222/json/close/'+target.id);
async function attach(target){const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,m=>m.error?reject(m.error):resolve(m.result));ws.send(JSON.stringify({id,method,params}))});await call('Runtime.enable');await call('Page.enable');const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value};return {target,ws,call,evaluate,errors}}
const target=await(await fetch('http://127.0.0.1:9222/json/new?'+encodeURIComponent(base+'/index.html'),{method:'PUT'})).json();const dashboard=await attach(target),e=dashboard.evaluate;
const read=async()=> (await(await fetch(base+'/api/state')).json()).state;
async function until(fn,message,timeout=7000){const end=Date.now()+timeout;while(Date.now()<end){const s=await read();if(s&&fn(s))return s;await pause(80)}throw Error(message+': '+JSON.stringify(await read()))}
await until(s=>s.phase,'dashboard did not bootstrap');await pause(300);
await e('document.querySelector("#reset").click()');await until(s=>s.phase==='ready','reset failed');
await e('document.querySelector("#matchMode").value="endless";document.querySelector("#matchMode").dispatchEvent(new Event("change"))');await until(s=>s.mode==='endless','mode must apply without a Save click');
await e('document.querySelector("#duration").value="15";document.querySelector("#save").click()');await until(s=>s.duration===15,'duration did not save');
// The dashboard button must create a separate popup window on non-Windows test hosts.
await e('document.querySelector("#openCapture").click()');let captureTarget;
for(let i=0;i<40;i++){captureTarget=(await(await fetch('http://127.0.0.1:9222/json')).json()).find(t=>t.url.startsWith(base+'/overlay.html?capture=1'));if(captureTarget)break;await pause(100)}
assert(captureTarget,'separate capture window did not open');const capture=await attach(captureTarget),c=capture.evaluate;
const first=await dashboard.call('Browser.getWindowForTarget',{targetId:dashboard.target.id}),second=await capture.call('Browser.getWindowForTarget',{targetId:capture.target.id});assert.notEqual(first.windowId,second.windowId,'capture must be a separate browser window');
await pause(300);assert.equal(await c('document.title'),'Boxing Arena — Game Capture');
// Headless Chromium cannot finish native fullscreen transitions; verify the control calls the API.
await c('window.fullscreenCalls=0;document.documentElement.requestFullscreen=async()=>{window.fullscreenCalls++};document.querySelector("#captureFullscreen").click()');assert.equal(await c('window.fullscreenCalls'),1);
await e('document.querySelector("#start").click()');await until(s=>s.phase==='running','start failed');
// A synthetic command uses catalog values; no real TikTok gift is sent.
const cmd=await fetch(base+'/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-Boxing-Request':'1'},body:JSON.stringify({type:'gift',giftId:'5655',count:100})});assert.equal(cmd.status,200);
let s=await until(s=>s.phase==='intermission'&&s.winner==='blue','winner not displayed');assert.equal(s.blueScore,1);
await capture.call('Page.bringToFront');await dashboard.call('Page.setWebLifecycleState',{state:'frozen'});
await until(s=>s.phase==='running'&&s.round===2,'winner did not auto-advance while dashboard frozen');
// Freeze the controller throughout repeated ties, using a validated deadline fixture.
async function expireTie(){const s=await read(),previous=s.revision;s.blueHp=100;s.redHp=100;s.action=null;s.endsAt=Date.now()-1;s.revision=Math.max(Date.now(),previous+1);const response=await fetch(base+'/api/state',{method:'POST',headers:{'Content-Type':'application/json','X-Boxing-Request':'1','X-Boxing-Revision':String(previous)},body:JSON.stringify(s)});assert.equal(response.status,200)}
await expireTie();s=await until(s=>s.phase==='intermission'&&s.winner==='draw','tie result missing');assert.equal(s.blueScore,1);
for(let i=0;i<30;i++){if(await c('document.querySelector("canvas").dataset.winner')==='draw')break;await pause(60)}
assert.equal(await c('document.querySelector("canvas").dataset.winner'),'draw');assert.equal(await c('document.querySelector("canvas").dataset.clock'),'server');
await capture.call('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});await writeFile('/tmp/boxing-tie-next-round.png',Buffer.from((await capture.call('Page.captureScreenshot')).data,'base64'));
await until(s=>s.phase==='running'&&s.round===3,'tie left the game stuck');
await expireTie();await until(s=>s.phase==='intermission'&&s.winner==='draw','second tie missing');s=await until(s=>s.phase==='running'&&s.round===4,'second tie did not restart');assert.equal(s.blueScore,1);assert.equal(s.redScore,0);assert.equal(s.blueHp,100);assert.equal(s.redHp,100);
await dashboard.call('Page.setWebLifecycleState',{state:'active'});await dashboard.call('Page.bringToFront');
for(let i=0;i<40;i++){if(await e('document.querySelector("#roundStat").textContent.includes("4")'))break;await pause(100)}assert.equal(await e('document.querySelector("#blueScore").textContent'),'1');
// A stale full snapshot cannot overwrite a server transition.
const stale=await read();const response=await fetch(base+'/api/state',{method:'POST',headers:{'Content-Type':'application/json','X-Boxing-Request':'1'},body:JSON.stringify({...stale,revision:stale.revision+1})});assert.equal(response.status,409);
assert.deepEqual(dashboard.errors,[]);assert.deepEqual(capture.errors,[]);
await e('document.querySelector("#pause").click()');await until(s=>s.phase==='paused','pause failed');
for(const p of [capture,dashboard]){await p.call('Page.close');p.ws.close()}
console.log('PASS: winner + repeated tie auto-restart with a frozen dashboard, exactly-once points, immediate mode selection, separate capture window/fullscreen control wiring, restored dashboard sync and stale-snapshot rejection.');
