// Gift values and images are copied from maxM808s/tiktok-live-battle/catalog.json.
export const giftDefaults=()=>({blueAttackGifts:['5655'],redAttackGifts:['5269'],blueHealGift:'',redHealGift:''});
export function createGiftRules(catalog){
 const gifts=new Map(catalog.map(g=>[String(g.id),g]));
 function validate(settings){
  const out={},used=new Set();
  for(const side of ['blue','red']){
   const attacks=settings[side+'AttackGifts'];
   if(!Array.isArray(attacks)||attacks.length>catalog.length||typeof settings[side+'HealGift']!=='string')throw Error('Invalid gift assignment');
   for(const id of [...attacks,settings[side+'HealGift']||'']){
    if(id==='')continue;
    if(typeof id!=='string'||!gifts.has(id)||used.has(id))throw Error('Each gift can have only one assignment');
    used.add(id);
   }
   out[side+'AttackGifts']=[...attacks];out[side+'HealGift']=settings[side+'HealGift']||'';
  }
  return out;
 }
 return {gifts,validate,
  resolve(giftId,count,settings){
   const gift=gifts.get(String(giftId));
   if(!gift)return null;
   if(!Number.isSafeInteger(count)||count<1||count>100000)throw Error('Invalid gift repeat count');
   const power=gift.coins*count;
   if(!Number.isSafeInteger(power)||power<1)throw Error('Invalid gift coin value');
   for(const side of ['blue','red']){
    if(settings[side+'HealGift']===String(giftId))return {side,type:'heal',power,giftId:String(giftId),count,name:gift.name,coins:gift.coins};
    if(settings[side+'AttackGifts'].includes(String(giftId)))return {side,type:'gift',power,giftId:String(giftId),count,name:gift.name,coins:gift.coins};
   }
   return null;
  }
 };
}
