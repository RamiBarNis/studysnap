const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClock,duration}=require('../js/pomodoro.js');
function setup(initial='{}') {let raw=initial;let time=1000000;const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};return {clock:createClock(storage,()=>time),storage,advance(ms){time+=ms},reload(){return createClock(storage,()=>time)}};}
test('a new task starts at exactly 50 minutes; elapsed wall time survives reload',()=>{const s=setup();assert.equal(duration,3000000);assert.equal(s.clock.get('a').remaining,duration);s.clock.start('a');s.advance(61000);assert.equal(s.reload().get('a').remaining,2939000);});
test('pause preserves remaining time; reset is task scoped',()=>{const s=setup();s.clock.start('a');s.advance(20000);s.clock.pause('a');s.advance(90000);assert.equal(s.reload().get('a').remaining,2980000);s.clock.start('b');s.clock.reset('a');assert.equal(s.clock.get('a').remaining,duration);assert.equal(s.clock.get('b').running,true);});
test('starting a second task pauses the first without losing progress',()=>{const s=setup();s.clock.start('a');s.advance(10000);s.clock.start('b');assert.deepEqual(s.clock.get('a'),{remaining:2990000,running:false});assert.equal(s.clock.runningId(),'b');});
test('background expiry stops at zero and restart gets a fresh 50 minutes',()=>{const s=setup();s.clock.start('a');s.advance(duration+1);assert.deepEqual(s.clock.get('a'),{remaining:0,running:false});assert.equal(s.clock.runningId(),undefined);s.clock.start('a');assert.equal(s.clock.get('a').remaining,duration);});
test('corrupt data cannot create unbounded timers; unavailable storage is reported',()=>{const s=setup('{"a":{"remaining":99999999,"endAt":null}}');assert.equal(s.clock.get('a').remaining,duration);const c=createClock({getItem(){throw Error()},setItem(){throw Error()}});assert.equal(c.start('a'),false);assert.equal(c.get('a').running,true);});

test('custom duration survives pause, reload and reset; invalid changes are rejected',()=>{
  const s=setup();assert.equal(s.clock.setDuration('a',25),true);s.clock.start('a');s.advance(60000);
  assert.equal(s.clock.setDuration('a',10),false);s.clock.pause('a');
  const reloaded=s.reload();assert.equal(reloaded.get('a').remaining,24*60000);assert.equal(reloaded.duration('a'),25*60000);
  reloaded.reset('a');assert.equal(reloaded.get('a').remaining,25*60000);
  for(const invalid of [0,181,1.5,NaN])assert.equal(reloaded.setDuration('a',invalid),false);
});
test('only completed sessions count, once, at their actual completion time, across reloads',()=>{
  const s=setup();s.clock.setDuration('a',1);s.clock.start('a');s.advance(10000);s.clock.pause('a');
  assert.equal(s.clock.sessions().length,0);s.clock.reset('a');assert.equal(s.clock.sessions().length,0);
  s.clock.start('a');s.advance(120000);const c=s.reload();
  assert.equal(c.sessions().length,1);assert.equal(c.sessions()[0].completedAt,1070000);
  c.get('a');assert.equal(s.reload().sessions().length,1);
  c.start('a');s.advance(60000);assert.equal(c.sessions().length,2);
});
