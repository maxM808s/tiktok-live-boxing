// TikFinity Event API: https://tikfinity.zerody.one/tiktok/dapi
// Runs only in the dashboard. No account credentials or external dependencies.
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const identifier=value=>typeof value==='string'||typeof value==='number'?String(value).slice(0,128):'';
const positive=(value,fallback=1)=>{const n=Number(value);return Number.isFinite(n)&&n>0?Math.min(1000,Math.floor(n)):fallback};
export function createTikFinityAdapter(){
 const viewers=new Map(),seen=new Set();
 function duplicate(key){if(!key)return false;if(seen.has(key))return true;seen.add(key);if(seen.size>5000)seen.delete(seen.values().next().value);return false}
 return {
  reset(){viewers.clear();seen.clear()},
  receive(message){
   if(!object(message)||typeof message.event!=='string'||!object(message.data))throw Error('Invalid TikFinity envelope');
   const {event,data}=message;
   if(!['chat','like','gift'].includes(event))return [];
   const user=object(data.user)?data.user:data;
   // Prefer stable numeric IDs over handles. Never identify viewers by display names.
   const id=identifier(user.userId||user.id||data.userId)||identifier(user.uniqueId||data.uniqueId).toLowerCase();
   if(!id)return [];
   const room=identifier(data.roomId||data.common?.roomId);
   const viewerKey=id; // A connection belongs to one LIVE; roomId is absent on some event types.
   const msgId=identifier(data.msgId||data.common?.msgId);
   // Streak updates can share a message ID; dedupe only once the combo finishes.
   let streak=false;
   if(event==='gift'){
    const giftType=Number(data.giftType??data.gift?.giftType??data.gift?.type??data.gift?.gift_type);
    streak=giftType===1;
    const end=data.repeatEnd??data.gift?.repeatEnd??data.gift?.repeat_end;
    if(giftType===1&&!(end===true||end===1||end==='1'))return [];
   }
   const group=streak&&data.groupId&&data.groupId!=='0'?identifier(data.groupId):'';
   const giftId=identifier(data.giftId||data.gift?.id||data.gift?.gift_id);
   const key=group?room+':gift:'+id+':'+giftId+':'+group:msgId?room+':'+event+':'+msgId:'';
   if(duplicate(key))return [];
   let viewer=viewers.get(viewerKey);
   if(event==='chat'){
    const text=typeof data.comment==='string'?data.comment.trim():'';
    const side=text==='1'?'blue':text==='2'?'red':null;
    if(!side)return [];
    if(!viewer){viewer={side,likes:0};viewers.set(viewerKey,viewer);if(viewers.size>10000)viewers.delete(viewers.keys().next().value)}
    if(viewer.side!==side)viewer.likes=0;
    viewer.side=side;
    return [{type:'vote',side,count:1}];
   }
   if(!viewer)return []; // Likes/gifts cannot choose a fighter on their own.
   if(event==='like'){
    viewer.likes+=positive(data.likeCount??data.count,0);
    const count=Math.floor(viewer.likes/10);viewer.likes%=10;
    return count?[{type:'vote',side:viewer.side,count}]:[];
   }
   return [{type:'gift',side:viewer.side,count:positive(data.repeatCount)}];
  }
 };
}
