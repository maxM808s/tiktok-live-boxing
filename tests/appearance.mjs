// Direct healing controls, label placement, persistence and visual captures.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:8766',pause=ms=>new Promise(r=>setTimeout(r,ms));
for(const target of await(await fetch('http://127.0.0.1:9222/json')).json())if(target.url.startsWith(base))await fetch('http://127.0.0.1:9222/json/close/'+target.id);
async function page(path){const target=await(await fetch('http://127.0.0.1:9222/json/new?'+encodeURIComponent(base+path),{method:'PUT'})).json();const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,m=>m.error?reject(m.error):resolve(m.result));ws.send(JSON.stringify({id,method,params}))});await call('Runtime.enable');await call('Page.enable');const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};await pause(700);return {call,evaluate,errors,ws};}
const dashboard=await page('/index.html'),d=dashboard.evaluate;
await d('localStorage.clear();location.reload()');await pause(700);
await d('document.querySelector("[data-tab=setup]").click();document.querySelector("#language").value="he";document.querySelector("#language").dispatchEvent(new Event("change"));document.querySelector("#blueName").value="ביבי";document.querySelector("#redName").value="אייזנקוט";document.querySelector("#blueImage").value="";document.querySelector("#redImage").value="";document.querySelector("#duration").value="300";document.querySelector("#save").click()');
assert.equal(await d('document.querySelector("#blueHealGift").options.length'),155);
assert.equal(await d('document.querySelector("#redHealGift").options.length'),155);
await d('document.querySelector("#blueHealGift").value="5487";document.querySelector("#blueHealGift").dispatchEvent(new Event("change"));document.querySelector("#redHealGift").value="6064";document.querySelector("#redHealGift").dispatchEvent(new Event("change"));document.querySelector("#save").click()');
assert.equal(await d('JSON.parse(localStorage.getItem("boxing-arena-v1")).blueHealGift'),'5487');
assert.equal(await d('JSON.parse(localStorage.getItem("boxing-arena-v1")).redHealGift'),'6064');
// Direct selection keeps the one-assignment-per-gift rule.
await d('document.querySelector("#blueHealGift").value="6064";document.querySelector("#blueHealGift").dispatchEvent(new Event("change"))');
assert.equal(await d('document.querySelector("#redHealGift").value'),'');
await d('document.querySelector("#blueHealGift").value="5487";document.querySelector("#blueHealGift").dispatchEvent(new Event("change"));document.querySelector("#redHealGift").value="6064";document.querySelector("#redHealGift").dispatchEvent(new Event("change"));document.querySelector("#save").click()');
await dashboard.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await d('document.querySelector(".healing-settings").scrollIntoView({block:"center"})');await pause(200);
await writeFile('/tmp/boxing-healing-settings.png',Buffer.from((await dashboard.call('Page.captureScreenshot')).data,'base64'));
const overlay=await page('/overlay.html'),o=overlay.evaluate;
await overlay.call('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
await d('document.querySelector("#start").click()');await pause(400);
assert.equal(await o('document.querySelector("canvas").dataset.giftInfoPosition'),'bottom');
await writeFile('/tmp/boxing-overlay-bottom.png',Buffer.from((await overlay.call('Page.captureScreenshot')).data,'base64'));
await d('document.querySelector("#giftInfoPosition").value="aboveNames";document.querySelector("#giftInfoPosition").dispatchEvent(new Event("change"))');await pause(250);
assert.equal(await o('document.querySelector("canvas").dataset.giftInfoPosition'),'aboveNames');
assert.match(await o('document.querySelector("canvas").getAttribute("aria-description")'),/מעל/);
await writeFile('/tmp/boxing-overlay-above.png',Buffer.from((await overlay.call('Page.captureScreenshot')).data,'base64'));
await d('location.reload()');await pause(700);
assert.equal(await d('document.querySelector("#blueHealGift").value'),'5487');
assert.equal(await d('document.querySelector("#redHealGift").value'),'6064');
assert.equal(await d('document.querySelector("#giftInfoPosition").value'),'aboveNames');
await d('document.querySelector("#language").value="en";document.querySelector("#language").dispatchEvent(new Event("change"));document.querySelector("#giftInfoPosition").value="bottom";document.querySelector("#giftInfoPosition").dispatchEvent(new Event("change"))');await pause(200);
assert.equal(await o('document.querySelector("canvas").dataset.giftInfoPosition'),'bottom');
assert.match(await o('document.querySelector("canvas").getAttribute("aria-description")'),/Punch and healing/);
assert.deepEqual(dashboard.errors,[]);assert.deepEqual(overlay.errors,[]);
for(const p of [dashboard,overlay]){await p.call('Page.close');p.ws.close()}
console.log('PASS: visible per-fighter healing controls, exclusive gift assignment, immediate top/bottom layout sync, reload persistence and Hebrew/English; visual captures saved.');
