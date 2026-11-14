// Shared timed-round rules. Only the dashboard applies transitions; overlays display them.
export const ROUND_BREAK_MS=3000;
export const MATCH_MODES=['single','endless','best3','best5'];
export const matchDefaults=()=>({mode:'single',round:1,blueScore:0,redScore:0,nextRoundAt:0,remainingMs:60000,seriesWinner:null});
export const winsNeeded=mode=>mode==='best3'?2:mode==='best5'?3:mode==='single'?1:Infinity;
export const healthWinner=s=>s.blueHp===s.redHp?'draw':s.blueHp>s.redHp?'blue':'red';
function freshRound(s,now,round,resetScores=false){
 const duration=s.duration;
 return {phase:'running',round,blueScore:resetScores?0:s.blueScore,redScore:resetScores?0:s.redScore,
  blueHp:100,redHp:100,blueVotes:0,redVotes:0,blueCoins:0,redCoins:0,winner:null,seriesWinner:null,action:null,
  remaining:duration,remainingMs:duration*1000,startedAt:now,endsAt:now+duration*1000,nextRoundAt:0};
}
export function startMatch(s,now=Date.now()){
 if(s.phase==='paused'){
  if(s.winner)return freshRound(s,now,s.round+1);
  return {phase:'running',endsAt:now+s.remainingMs,nextRoundAt:0,action:null};
 }
 if(!['ready','finished'].includes(s.phase))return null;
 return freshRound(s,now,1,true);
}
export function resetMatch(s){
 return {...matchDefaults(),mode:s.mode,phase:'ready',blueHp:100,redHp:100,blueVotes:0,redVotes:0,blueCoins:0,redCoins:0,
  remaining:s.duration,remainingMs:s.duration*1000,winner:null,seriesWinner:null,action:null,startedAt:0,endsAt:0};
}
export function settleRound(s,winner,now=Date.now()){
 if(s.phase!=='running'||!['blue','red','draw'].includes(winner))return null;
 const blueScore=s.blueScore+(winner==='blue'?1:0),redScore=s.redScore+(winner==='red'?1:0);
 const seriesWinner=blueScore>=winsNeeded(s.mode)?'blue':redScore>=winsNeeded(s.mode)?'red':null;
 const continueMatch=s.mode==='endless'||(['best3','best5'].includes(s.mode)&&!seriesWinner);
 const remainingMs=Math.max(0,s.endsAt-now);
 return {phase:continueMatch?'intermission':'finished',winner,blueScore,redScore,seriesWinner,
  remaining:Math.ceil(remainingMs/1000),remainingMs,endsAt:0,nextRoundAt:continueMatch?now+ROUND_BREAK_MS:0};
}
export function pauseMatch(s,now=Date.now()){
 if(!['running','intermission'].includes(s.phase))return null;
 // An expired round must settle before it can be paused, so its point cannot disappear.
 const settled=s.phase==='running'&&now>=s.endsAt?settleRound(s,healthWinner(s),now):null;
 if(settled?.phase==='finished')return settled;
 const current={...s,...settled},remainingMs=current.phase==='running'?Math.max(0,current.endsAt-now):current.remainingMs;
 return {...settled,phase:'paused',remainingMs,remaining:Math.ceil(remainingMs/1000),endsAt:0,nextRoundAt:0};
}
export function tickMatch(s,now=Date.now()){
 if(s.phase==='running'&&now>=s.endsAt)return settleRound(s,healthWinner(s),now);
 if(s.phase==='intermission'&&now>=s.nextRoundAt)return freshRound(s,now,s.round+1);
 return null;
}
