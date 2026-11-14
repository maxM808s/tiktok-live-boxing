// Verify the actual HTTP relay across isolated Chromium storage contexts.
import assert from 'node:assert/strict';
const root='http://127.0.0.1:8767';
const target=await(await fetch('http://127.0.0.1:9222/json/version')).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const mid=++id;pending.set(mid,m=>m.error?reject(m.error):resolve(m.result));ws.send(JSON.stringify({id:mid,method,params,sessionId}))});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function isolated(path){const {browserContextId}=await call('Target.createBrowserContext');const {targetId}=await call('Target.createTarget',{url:root+path,browserContextId});const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});await call('Runtime.enable',{},sessionId);return {sessionId,browserContextId};}
async function evaluate(p,expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},p.sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const dashboard=await isolated('/index.html');const overlay=await isolated('/overlay.html');await delay(1000);
await evaluate(dashboard,'document.querySelector("#reset").click();document.querySelector("#language").value="he";document.querySelector("#language").dispatchEvent(new Event("change"));document.querySelector("#start").click();document.querySelector("[data-hit=blue]").click()');await delay(500);
assert.equal(await evaluate(overlay,'localStorage.getItem("boxing-arena-v1")'),null,'isolated overlay cannot share dashboard storage');
assert.equal(await evaluate(overlay,'document.documentElement.lang'),'he','language reached isolated overlay via HTTP');
assert.match(await evaluate(overlay,'document.querySelector("canvas").getAttribute("aria-label")'),/94/,'health reached isolated overlay');
const shared=await(await fetch(root+'/api/state')).json();assert.equal(shared.state.redHp,94);assert.equal(shared.state.phase,'running');
assert.equal((await fetch(root+'/api/state',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.com'},body:JSON.stringify(shared.state)})).status,403);
assert.equal((await fetch(root+'/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(shared.state)})).status,409);
assert.equal((await fetch(root+'/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:'null'})).status,400);
assert.deepEqual(errors,[]);
for(const p of [dashboard,overlay])await call('Target.disposeBrowserContext',{browserContextId:p.browserContextId});
ws.close();console.log('PASS: isolated overlay receives relay state; cross-site, stale and invalid writes rejected.');
