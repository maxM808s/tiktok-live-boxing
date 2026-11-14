// Dependency-free Chromium CDP smoke tests. Start the server and Chromium as in README.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const base=process.env.BOXING_URL||'http://127.0.0.1:8766';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function page(path){
 const target=await (await fetch('http://127.0.0.1:9222/json/new?'+encodeURIComponent(base+path),{method:'PUT'})).json();
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}if(m.method==='Page.javascriptDialogOpening')ws.send(JSON.stringify({id:++seq,method:'Page.handleJavaScriptDialog',params:{accept:false}}));if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,m=>m.error?reject(m.error):resolve(m.result));ws.send(JSON.stringify({id,method,params}))});
 await call('Runtime.enable');await call('Page.enable');
 const evalJS=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 await delay(800);return {call,evalJS,errors,ws};
}
for(const target of await(await fetch('http://127.0.0.1:9222/json')).json())if(target.url.startsWith(base))await fetch('http://127.0.0.1:9222/json/close/'+target.id);
// Minimal WebSocket fixture; all payloads below are synthetic, never real S2E events.
let bridgeSocket;
const bridge=createServer();
bridge.on('upgrade',(req,socket)=>{const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');bridgeSocket=socket;socket.on('data',()=>{});socket.on('error',()=>{});});
await new Promise(r=>bridge.listen(0,'127.0.0.1',r));
const send=event=>{const text=typeof event==='string'?event:JSON.stringify(event);const data=Buffer.from(text);assert(data.length<126);bridgeSocket.write(Buffer.concat([Buffer.from([0x81,data.length]),data]));};
const p=await page('/index.html');
const e=p.evalJS;
await e('localStorage.clear();location.reload()');await delay(600);
assert.equal(await e('document.querySelector("#start").disabled'),false);
await e('document.querySelector("#start").click()');await delay(100);
await e('document.querySelector("[data-hit=blue]").click()');
assert.equal(await e('JSON.parse(localStorage.getItem("boxing-arena-v1")).redHp'),94);
await e('document.querySelector("[data-hit=blue]").click()');
assert.equal(await e('JSON.parse(localStorage.getItem("boxing-arena-v1")).redHp'),94,'recovery blocks spam');
await e('location.reload()');await delay(600);
assert.equal(await e('document.querySelector("#start").disabled'),true,'saved running round reloads');
const o=await page('/overlay.html');
assert.equal(await o.evalJS('document.querySelector("canvas").width'),540);
await e('document.querySelector("#reset").click();document.querySelector("[data-tab=setup]").click();document.querySelector("#language").value="he";document.querySelector("#language").dispatchEvent(new Event("change"));document.querySelector("#blueName").value="ביבי";document.querySelector("#redName").value="איזנקוט";document.querySelector("#duration").value="20";document.querySelector("#save").click()');await delay(200);
assert.equal(await e('document.documentElement.dir'),'rtl');
assert.equal(await o.evalJS('document.documentElement.lang'),'he');
assert.equal(await e('document.querySelector("#timeStat").textContent'),'20 שנ׳');
assert.equal(await e('document.querySelector("#blueName").value'),'ביבי');
await e('document.querySelector("#start").click()');
for(let i=0;i<3;i++)await e('document.querySelector("[data-vote=blue]").click()');
assert.equal(await e('JSON.parse(localStorage.getItem("boxing-arena-v1")).redHp'),96);
await delay(700);
// Clipboard button must retain its translatable label after feedback.
await p.call('Browser.grantPermissions',{origin:base,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});await p.call('Page.bringToFront');
await e('document.querySelector("#copyOverlay").click()');await delay(1900);
assert.equal(await e('!!document.querySelector("#copyOverlay [data-i18n]")'),true);
await e('document.querySelector("[data-tab=live]").click()');
await p.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
await delay(300);
await writeFile('/tmp/boxing-dashboard.png',Buffer.from((await p.call('Page.captureScreenshot')).data,'base64'));
await o.call('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
await writeFile('/tmp/boxing-overlay.png',Buffer.from((await o.call('Page.captureScreenshot')).data,'base64'));
// Expired rounds cannot receive damage; health winner is decided by points.
await e('let s=JSON.parse(localStorage.getItem("boxing-arena-v1"));s.endsAt=Date.now()-100;s.revision=Date.now()+100;localStorage.setItem("boxing-arena-v1",JSON.stringify(s));location.reload()');await delay(1400);
assert.equal(await e('JSON.parse(localStorage.getItem("boxing-arena-v1")).phase'),'finished');
await p.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
assert.equal(await e('document.documentElement.scrollWidth<=innerWidth'),true,'mobile layout fits');
// Connection status, strict payload rejection, deduplication and normalized likes/comments.
await e('document.querySelector("#reset").click();document.querySelector("#start").click();document.querySelector("[data-tab=connection]").click()');
await e(`document.querySelector('#wsUrl').value='ws://127.0.0.1:${bridge.address().port}';document.querySelector('#connect').click()`);await delay(200);
assert.equal(await e('document.querySelector("#connectionBadge").dataset.connected'),'1');
send({type:'like',side:'blue',id:'like-1'});send({type:'like',side:'blue',id:'like-1'});send({type:'comment',side:'blue',id:'comment-1'});send({type:'vote',side:'blue',id:'vote-1'});send('null');send('{broken');send({type:'gift',side:'unknown'});await delay(300);
assert.equal(await e('JSON.parse(localStorage.getItem("boxing-arena-v1")).blueVotes'),3);
assert.equal(await e('JSON.parse(localStorage.getItem("boxing-arena-v1")).redHp'),96);
assert.equal(await e('document.querySelector("#status").dataset.connected'),'1','status survives game updates');
await e('document.querySelector("#connect").click()');await delay(100);
assert.equal(await e('document.querySelector("#connectionBadge").dataset.connected'),'');
bridgeSocket.destroy();await new Promise(r=>bridge.close(r));
// KO and winner; damage cannot continue after the knockout.
await e('document.querySelector("#reset").click();document.querySelector("#start").click()');
for(let i=0;i<5;i++){await e('document.querySelector("[data-special=blue]").click()');await delay(710)}
assert.equal(await e('JSON.parse(localStorage.getItem("boxing-arena-v1")).winner'),'blue');
assert.equal(await e('JSON.parse(localStorage.getItem("boxing-arena-v1")).redHp'),0);
await delay(500);
await writeFile('/tmp/boxing-knockout.png',Buffer.from((await o.call('Page.captureScreenshot')).data,'base64'));
// Customization survives reload, fallback names and duration bounds are applied.
await e('document.querySelector("#reset").click();document.querySelector("[data-tab=setup]").click();document.querySelector("#blueName").value="CUSTOM BLUE";document.querySelector("#redName").value="";document.querySelector("#duration").value="500";document.querySelector("#language").value="en";document.querySelector("#language").dispatchEvent(new Event("change"));document.querySelector("#save").click();location.reload()');await delay(600);
assert.equal(await e('document.querySelector("#blueName").value'),'CUSTOM BLUE');
assert.equal(await e('document.querySelector("#redName").value'),'EISENKOT');
assert.equal(await e('document.querySelector("#duration").value'),'300');
assert.equal(await e('document.documentElement.dir'),'ltr');
assert.deepEqual(p.errors,[]);assert.deepEqual(o.errors,[]);
await p.call('Page.close');await o.call('Page.close');p.ws.close();o.ws.close();console.log('PASS: round controls, recovery, reload, votes, RTL, cross-tab overlay, copy label, expiry, mobile layout, WebSocket validation/deduplication, normalized likes/comments, knockout; no JavaScript exceptions.');
