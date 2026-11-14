// Native TikFinity Event API: https://tikfinity.zerody.one/tiktok/dapi
// Gifts choose a fighter through dashboard assignments, never comments or likes.
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const identifier=v=>(typeof v==='string'&&v.length<=200)||(typeof v==='number'&&Number.isSafeInteger(v))?String(v):'';
export function createTikFinityAdapter(){
 const seen=new Set();
 return {
  reset(){seen.clear()},
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
   const key=group&&group!=='0'&&sender?JSON.stringify(['combo',sender,giftId,group]):msgId?JSON.stringify(['gift',msgId]):'';
   if(!key)throw Error('Gift has no stable event identity');
   if(seen.has(key))return [];
   seen.add(key);if(seen.size>20000)seen.delete(seen.values().next().value);
   return [{giftId,count}];
  }
 };
}
