import assert from 'node:assert/strict';
import {matchDefaults,ROUND_BREAK_MS,startMatch,resetMatch,settleRound,pauseMatch,tickMatch,healthWinner} from '../match.mjs';
const initial=mode=>({...matchDefaults(),mode,phase:'ready',duration:15,remaining:15,blueHp:100,redHp:100,winner:null,action:null,startedAt:0,endsAt:0});
const patch=(s,p)=>({...s,...p});
let s=patch(initial('endless'),startMatch(initial('endless'),1000));
s=patch(s,{redHp:0});s=patch(s,settleRound(s,'blue',2000));
assert.equal(s.blueScore,1);assert.equal(s.redScore,0);assert.equal(s.phase,'intermission');assert.equal(s.nextRoundAt,2000+ROUND_BREAK_MS);
assert.equal(settleRound(s,'blue',2001),null,'a settled round cannot award another point');
assert.equal(tickMatch(s,s.nextRoundAt-1),null);
s=patch(s,tickMatch(s,s.nextRoundAt));assert.equal(s.round,2);assert.equal(s.blueScore,1);assert.equal(s.blueHp,100);assert.equal(s.redHp,100);assert.equal(s.remaining,15);assert.equal(s.winner,null);
// Deadline wins are based on health; equal health yields no points and still advances.
s.redHp=90;s=patch(s,tickMatch(s,s.endsAt));assert.equal(s.blueScore,2);
s=patch(s,tickMatch(s,s.nextRoundAt));s=patch(s,tickMatch(s,s.endsAt));assert.equal(s.winner,'draw');assert.equal(s.blueScore,2);
const serialized=JSON.parse(JSON.stringify(s));s=patch(serialized,tickMatch(serialized,serialized.nextRoundAt+20000));assert.equal(s.round,4);assert.equal(s.blueScore,2);assert.equal(s.remaining,15,'reload after a break starts one fresh round rather than fabricating skipped results');
// Pause preserves exact remaining milliseconds and health, then resumes the same round.
s.blueHp=75;const at=s.startedAt+1234;s=patch(s,pauseMatch(s,at));assert.equal(s.phase,'paused');assert.equal(s.remainingMs,13766);assert.equal(tickMatch(s,at+100000),null);
s=patch(s,startMatch(s,at+100000));assert.equal(s.round,4);assert.equal(s.blueHp,75);assert.equal(s.endsAt,at+100000+13766);
// Pausing at the deadline still awards the winner once; resuming starts the next round.
s=patch(s,pauseMatch(s,s.endsAt));assert.equal(s.phase,'paused');assert.equal(s.winner,'red');assert.equal(s.redScore,1);
s=patch(s,startMatch(s,s.endsAt+100000));assert.equal(s.round,5);assert.equal(s.blueHp,100);assert.equal(s.redScore,1);
for(const [mode,target]of [['best3',2],['best5',3]]){
 let game=initial(mode),now=1000;game=patch(game,startMatch(game,now));
 for(let i=1;i<=target;i++){
  now+=100;game=patch(game,{redHp:0});game=patch(game,settleRound(game,'blue',now));assert.equal(game.blueScore,i);
  if(i<target){assert.equal(game.phase,'intermission');now=game.nextRoundAt;game=patch(game,tickMatch(game,now))}else{assert.equal(game.phase,'finished');assert.equal(game.seriesWinner,'blue');assert.equal(tickMatch(game,now+100000),null)}
 }
}
let single=initial('single');single=patch(single,startMatch(single,1000));single=patch(single,settleRound(single,'blue',1500));assert.equal(single.phase,'finished');assert.equal(single.blueScore,1);assert.equal(single.nextRoundAt,0);
single=patch(single,startMatch(single,2000));assert.equal(single.blueScore,0);assert.equal(single.round,1);
const reset=resetMatch(s);assert.equal(reset.mode,'endless');assert.equal(reset.phase,'ready');assert.equal(reset.round,1);assert.equal(reset.blueScore,0);assert.equal(reset.redScore,0);
assert.equal(healthWinner({blueHp:90,redHp:90}),'draw');
const recovered=tickMatch({...initial('endless'),phase:'finished',winner:'draw',blueScore:0},1000);assert.equal(recovered.phase,'intermission');assert.equal(recovered.nextRoundAt,1000+ROUND_BREAK_MS);
console.log('PASS: endless KO/time wins, exactly-once scoring, draws, automatic restart/reload, precise pause/resume, best-of series, single-round behavior and full reset.');
