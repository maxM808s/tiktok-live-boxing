// Native TikFinity Event API: https://tikfinity.zerody.one/tiktok/dapi
// Gifts choose a fighter through dashboard assignments, never comments or likes.
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const identifier=v=>(typeof v==='string'&&v.length<=200)||(typeof v==='number'&&Number.isSafeInteger(v))?String(v):'';
export function createTikFinityAdapter({storage,requirePersistence=false}={}){
 const replayError=message=>Object.assign(new Error(message),{code:'REPLAY_STORAGE'});
 const storageKey='boxing-gift-replay-v1',seen=new Set();let storageError=false;
 try{const raw=storage?.getItem(storageKey);if(raw){if(raw.length>1500000)throw Error();const entries=JSON.parse(raw);if(!Array.isArray(entries)||entries.length>40000||entries.some(x=>typeof x!=='string'||x.length>1000))throw Error();entries.forEach(x=>seen.add(x))}}catch{storageError=true}
 function remember(keys){
  if(storageError||requirePersistence&&!storage)throw replayError('Gift replay storage unavailable');
  const duplicate=keys.some(key=>seen.has(key)),additions=keys.filter(key=>!seen.has(key));
  if(!additions.length)return false;
  if(seen.size+additions.length>40000)throw replayError('Gift replay storage full');
  const next=[...seen,...additions],encoded=JSON.stringify(next);
  if(encoded.length>1500000)throw replayError('Gift replay storage full');
  // Persist before awarding health changes. Never silently discard old identities.
  if(storage){try{storage.setItem(storageKey,encoded)}catch{throw replayError('Gift replay storage unavailable')}}
  additions.forEach(key=>seen.add(key));return !duplicate;
 }
 return {
  reset(){if(storage)storage.removeItem(storageKey);seen.clear();storageError=false},
  receive(message){
   if(!object(message)||typeof message.event!=='string')throw Error('Invalid TikFinity envelope');
   if(message.event!=='gift')return [];
   const d=message.data;if(!object(d))throw Error('Invalid gift payload');
   const giftId=identifier(d.giftId??d.gift?.id??d.gift?.gift_id);
   if(!/^\d{1,20}$/.test(giftId))throw Error('Invalid gift ID');
   const giftType=Number(d.giftType??d.gift?.giftType??d.gift?.type??d.gift?.gift_type);
   if(!Number.isInteger(giftType)||giftType<0)throw Error('Gift type missing');
   const end=d.repeatEnd??d.gift?.repeatEnd??d.gift?.repeat_end;
   if(giftType===1&&![true,1,'1'].includes(end))return [];
   const count=d.repeatCount??d.gift?.repeatCount??1;
   if(!Number.isSafeInteger(count)||count<1||count>100000)throw Error('Invalid gift count');
   const msgId=identifier(d.msgId??d.common?.msgId);
   const sender=identifier(d.userId??d.user?.userId??d.user?.id??d.uniqueId??d.user?.uniqueId);
   const group=giftType===1?identifier(d.groupId):'';
   const keys=[];
   if(msgId)keys.push(JSON.stringify(['gift',msgId]));
   if(group&&group!=='0'&&sender)keys.push(JSON.stringify(['combo',sender,giftId,group]));
   if(!keys.length)throw Error('Gift has no stable event identity');
   if(!remember(keys))return [];
   return [{giftId,count}];
  }
 };
}
