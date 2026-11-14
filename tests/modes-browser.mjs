// End-to-end timed modes against the hardened relay, with synthetic local fixtures.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base=process.env.BOXING_MODES_URL||'http://127.0.0.1:8769',delay=ms=>new Promise(r=>setTimeout(r,ms));
for(const target of await(await fetch('http://127.0.0.1:9222/json')).json())if(target.url.startsWith(base))await fetch('http://127.0.0.1:9222/json/close/'+target.id);
async function page(path){const target=await(await fetch('http://127.0.0.1:9222/json/new?'+encodeURIComponent(base+path),{method:'PUT'})).json();const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};const call=(method,params={})=>new Promise((resolve,reject)=>{const seq=++id;pending.set(seq,m=>m.error?reject(m.error):resolve(m.result));ws.send(JSON.stringify({id:seq,method,params}))});await call('Runtime.enable');await call('Page.enable');const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};await delay(900);return {ws,call,evaluate,errors};}
const p=await page('/index.html'),e=p.evaluate;
const state=()=>e('JSON.parse(localStorage.getItem("boxing-arena-v1"))');
async function until(predicate,message,timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){const s=await state();if(predicate(s))return s;await delay(80)}throw Error(message+': '+JSON.stringify(await state()))}
await p.call('Page.bringToFront');await e('document.querySelector("#reset").click();document.querySelector("[data-tab=setup]").click();document.querySelector("#language").value="he";document.querySelector("#language").dispatchEvent(new Event("change"));document.querySelector("#matchMode").value="endless";document.querySelector("#duration").value="15"');
const catalog=await e('fetch("./catalog.json").then(r=>r.json())'),ko=catalog.find(g=>g.coins>=100).id;
await e(`document.querySelector('#giftSlot').value='blue:gift';document.querySelector('#giftSlot').dispatchEvent(new Event('change'));document.querySelector('[data-gift-id="${ko}"]').click();document.querySelector('#save').click()`);
assert.equal((await state()).mode,'endless');assert.equal((await state()).round,1);
const overlay=await page('/overlay.html'),o=overlay.evaluate;
await p.call('Page.bringToFront');await e(`document.querySelector('#start').click();document.querySelector('#blueTestGift').value='${ko}';document.querySelector('[data-test-gift=blue]').click()`);
let s=await until(s=>s.phase==='intermission','KO did not settle');assert.equal(s.blueScore,1);assert.equal(s.round,1);
await e('document.querySelector("#pause").click()');s=await until(s=>s.phase==='paused','pause failed');assert.equal(s.blueScore,1);
await delay(3300);assert.equal((await state()).phase,'paused');assert.equal((await state()).blueScore,1);
await e('location.reload()');await delay(1000);s=await state();assert.equal(s.phase,'paused');assert.equal(s.blueScore,1,'reload must not re-award a round');
await e('document.querySelector("#start").click()');s=await until(s=>s.phase==='running'&&s.round===2,'resume must start round 2');assert.equal(s.blueHp,100);assert.equal(s.redHp,100);assert.equal(s.blueScore,1);
await e(`document.querySelector('#blueTestGift').value='${ko}';document.querySelector('[data-test-gift=blue]').click()`);await until(s=>s.phase==='intermission'&&s.blueScore===2,'second KO failed');
s=await until(s=>s.phase==='running'&&s.round===3,'endless mode did not restart automatically');assert.equal(s.blueScore,2);assert.equal(s.redHp,100);assert.equal(s.blueHp,100);
for(let i=0;i<40;i++){if(await o('document.querySelector("canvas").dataset.round')==='3')break;await delay(100)}
assert.equal(await o('document.querySelector("canvas").dataset.blueScore'),'2');assert.equal(await o('document.querySelector("canvas").dataset.round'),'3');
await overlay.call('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});await writeFile('/tmp/boxing-endless-rounds.png',Buffer.from((await overlay.call('Page.captureScreenshot')).data,'base64'));
// Set a short expired-deadline fixture through the same validated HTTP API, then reload.
async function expire(blueHp,redHp){await delay(200);const result=await e(`(async()=>{const response=await fetch('./api/state',{cache:'no-store'});const s=(await response.json()).state;s.blueHp=${blueHp};s.redHp=${redHp};s.endsAt=Date.now()-1;s.action=null;s.revision=Math.max(Date.now(),s.revision+1);const saved=await fetch('./api/state',{method:'POST',headers:{'Content-Type':'application/json','X-Boxing-Request':'1'},body:JSON.stringify(s)});return saved.status})()`);assert.equal(result,200);await e('location.reload()');}
await expire(80,30);s=await until(s=>s.phase==='intermission'&&s.blueScore===3,'time victory did not score');assert.equal(s.winner,'blue');
await until(s=>s.phase==='running'&&s.round===4,'round 4 did not start');await expire(100,100);s=await until(s=>s.phase==='intermission'&&s.winner==='draw','draw did not settle');assert.equal(s.blueScore,3);assert.equal(s.redScore,0);
await until(s=>s.phase==='running'&&s.round===5,'draw did not advance');
await e('document.querySelector("#pause").click()');s=await state();const frozen=s.remainingMs;await delay(1100);assert.equal((await state()).remainingMs,frozen);assert.equal((await state()).round,5);await e('document.querySelector("#start").click()');await until(s=>s.phase==='running'&&s.round===5,'running round did not resume');
await e('document.querySelector("#reset").click()');s=await state();assert.equal(s.blueScore,0);assert.equal(s.redScore,0);assert.equal(s.round,1);assert(s.blueAttackGifts.includes(ko));
// Best-of mode stops on a champion instead of scheduling another round.
await e('document.querySelector("#matchMode").value="best3";document.querySelector("#save").click();document.querySelector("#start").click()');
for(let win=1;win<=2;win++){await e(`document.querySelector('#blueTestGift').value='${ko}';document.querySelector('[data-test-gift=blue]').click()`);if(win===1)await until(s=>s.phase==='running'&&s.round===2,'best-of next round failed');}
s=await until(s=>s.phase==='finished','best-of champion did not end the match');assert.equal(s.seriesWinner,'blue');assert.equal(s.blueScore,2);await delay(3300);assert.equal((await state()).phase,'finished');
await p.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await e('document.querySelector("[data-tab=live]").click();scrollTo(0,0)');await writeFile('/tmp/boxing-modes-dashboard.png',Buffer.from((await p.call('Page.captureScreenshot')).data,'base64'));
assert.deepEqual(p.errors,[]);assert.deepEqual(overlay.errors,[]);for(const item of [p,overlay]){await item.call('Page.close');item.ws.close()}
console.log('PASS: endless KO/time wins, automatic rounds, draw/no point, pause/resume, reload/exactly-once score, overlay sync, reset and best-of champion on the hardened server.');
