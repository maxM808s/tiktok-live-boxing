// Validation at every browser input boundary: storage, tab messages and HTTP relay.
export const MAX_STATE_BYTES=16384;
const validText=v=>typeof v==='string'&&!/[\uD800-\uDFFF]/u.test(v);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export function safePortraitURL(value){
 if(value==='')return true;
 if(!validText(value)||value.length>2048||/[\u0000-\u0020]/.test(value))return false;
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password}catch{return false}
}
export function safeSocketURL(value,{localOnly=false}={}){
 if(!validText(value)||value.length>2048||/[\u0000-\u0020]/.test(value))return false;
 try{const url=new URL(value),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);return ['ws:','wss:'].includes(url.protocol)&&!url.username&&!url.password&&(!localOnly||local)&&(url.protocol==='wss:'||local)}catch{return false}
}
export function createStateValidator(defaults,giftRules){
 return function normalize(value,now=Date.now()){
  if(!record(value))throw Error('Invalid state');
  const encoded=JSON.stringify(value);if(new TextEncoder().encode(encoded).length>MAX_STATE_BYTES)throw Error('State too large');
  const out={};for(const key of Object.keys(defaults))out[key]=value[key]??defaults[key];
  if(!['en','he'].includes(out.language)||!['ready','running','finished'].includes(out.phase)||![null,'blue','red','draw'].includes(out.winner))throw Error('Invalid match flags');
  if(!['bottom','aboveNames'].includes(out.giftInfoPosition))throw Error('Invalid gift information position');
  if((out.phase==='finished')!==!!out.winner)throw Error('Invalid winner');
  for(const side of ['blue','red']){
   if(!validText(out[side+'Name'])||out[side+'Name'].length>26||!safePortraitURL(out[side+'Image']))throw Error('Invalid fighter');
   if(!integer(out[side+'Hp'],0,100)||!integer(out[side+'Coins'],0,Number.MAX_SAFE_INTEGER)||out[side+'Votes']!==0)throw Error('Invalid fighter numbers');
  }
  if(!integer(out.duration,15,300)||!integer(out.remaining,0,300)||!integer(out.revision,0,now+60000)||!integer(out.startedAt,0,now+60000)||!integer(out.endsAt,0,now+360000))throw Error('Invalid match numbers');
  if(out.phase==='running'&&(!out.startedAt||!out.endsAt))throw Error('Missing deadline');
  Object.assign(out,giftRules.validate(out));
  if(out.action!==null){
   const a=out.action;
   if(!record(a)||!['blue','red'].includes(a.side)||!['gift','heal'].includes(a.type)||!integer(a.power,1,Number.MAX_SAFE_INTEGER)||!integer(a.amount,0,100)||!integer(a.at,0,now+60000)||!validText(a.id)||!a.id||a.id.length>200||!validText(a.name)||a.name.length>120||typeof a.giftId!=='string'||!giftRules.gifts.has(a.giftId))throw Error('Invalid action');
   out.action=Object.fromEntries(['side','type','power','amount','giftId','name','at','id'].map(key=>[key,a[key]]));
  }
  return out;
 };
}
