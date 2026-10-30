// Effets causaux des consignes, sans dépendance : node tests-roles-actions.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
let passed = 0, failed = 0;

function scenario(body) {
  const context = vm.createContext({});
  for (const file of ["data.js", "matchengine-actions.js", "matchchoreo.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  return JSON.parse(vm.runInContext(`
    let randomState = 1, randomCalls = 0;
    const resetRandom = seed => { randomState = seed >>> 0; randomCalls = 0; };
    Math.random = () => { randomCalls++; randomState = (Math.imul(randomState,1664525)+1013904223) >>> 0; return randomState/4294967296; };
    const makePlayer = (id,pos) => ({id,name:id,pos,speed:70,technique:70,physical:70,mental:70,form:70});
    const home = ['GK','DEF','DEF','MID','MID','ATT','ATT'].map((pos,i)=>makePlayer('h'+i,pos));
    const away = ['GK','DEF','DEF','MID','MID','ATT','ATT'].map((pos,i)=>makePlayer('a'+i,pos));
    const setup = (players,style='control') => ({formation:'1-2-2-2',assignments:players.map(p=>p.id),
      attackPlan:'possession',defensePlan:'zone',teamStyle:style,playerRoles:Object.fromEntries(players.map(p=>[p.id,DEFAULT_PLAYER_ROLES[p.pos]]))});
    const homeSetup = setup(home), awaySetup = setup(away,'compact');
    const params = (atkSetup=homeSetup,defSetup=awaySetup) => ({side:'home',attackers:home.slice(1),defenders:away.slice(1),
      ownGK:home[0],gk:away[0],atkSetup,defSetup,
      atkAnchors:computeSideAnchors(atkSetup,home.slice(1).map(p=>p.id),'home',true),
      defAnchors:computeSideAnchors(defSetup,away.slice(1).map(p=>p.id),'away',false),
      attackPlanKey:'possession',attackMod:1,defenseMod:1,earlyPhaseBoost:1,withSequence:true});
    JSON.stringify((()=>{${body}})());
  `, context));
}

function test(name, body) {
  try { body(); passed++; console.log('OK '+name); }
  catch (error) { failed++; console.error('FAIL '+name+': '+error.message); }
}

test('un défenseur offensif gagne de la hauteur et de la largeur sans changer ses attributs', () => {
  const result = scenario(`
    const before=JSON.stringify(home);
    const fixed=computeSideAnchors(homeSetup,home.slice(1).map(p=>p.id),'home',true);
    homeSetup.playerRoles.h1='overlap';
    const attacking=computeSideAnchors(homeSetup,home.slice(1).map(p=>p.id),'home',true);
    const mirrored=computeSideAnchors(homeSetup,home.slice(1).map(p=>p.id),'away',true);
    return {fixed:fixed.h1,attacking:attacking.h1,mirrored:mirrored.h1,unchanged:before===JSON.stringify(home)};
  `);
  assert.ok(result.attacking.y > result.fixed.y + 5);
  assert.ok(result.attacking.x < result.fixed.x);
  assert.ok(Math.abs(result.mirrored.y - (100-result.attacking.y)) < 1e-8);
  assert.equal(result.unchanged, true);
});

test('le rôle est celui du poste assigné et une identité large ouvre réellement le bloc', () => {
  const result = scenario(`
    const compact=computeSideAnchors(setup(home,'compact'),home.slice(1).map(p=>p.id),'home',true);
    const wide=computeSideAnchors(setup(home,'wide'),home.slice(1).map(p=>p.id),'home',true);
    home[1].pos='ATT'; homeSetup.playerRoles.h1='overlap';
    const assigned=computeSideAnchors(homeSetup,home.slice(1).map(p=>p.id),'home',true).h1;
    return {compact:compact.h1,wide:wide.h1,assigned};
  `);
  assert.ok(result.wide.x < result.compact.x);
  assert.equal(result.assigned.pos, 'DEF');
  assert.equal(result.assigned.roleKey, 'overlap');
});

test('créateur et finisseur privilégient des décisions différentes avec les mêmes capacités', () => {
  const result = scenario(`
    const counts=roleKey=>{
      resetRandom(703); const counts={};
      const carrier=makePlayer('p',roleKey==='creator'||roleKey==='box_to_box'?'MID':'ATT');
      for(let i=0;i<6000;i++) { const key=chooseActionType({carrier,slotPos:carrier.pos,roleKey,zone:'final',pressure:.25,
        attackPlanKey:'possession',mentality:'balanced',pos:{x:50,y:78},side:'home',actionsLeft:4,hasPassOptions:true}); counts[key]=(counts[key]||0)+1; }
      return counts;
    };
    return {creator:counts('creator'),relay:counts('box_to_box'),target:counts('target'),poacher:counts('poacher')};
  `);
  const passes = counts => (counts.short||0)+(counts.progressive||0)+(counts.through||0);
  assert.ok(passes(result.creator) > passes(result.relay) + 300);
  assert.ok(result.poacher.shot > result.target.shot + 500);
});

test('les passes courtes cherchent un appui tandis que les passes en profondeur cherchent un appel', () => {
  const result = scenario(`
    homeSetup.playerRoles.h5='runner'; homeSetup.playerRoles.h6='target';
    const anchors={h3:{x:50,y:45},h5:{x:40,y:65},h6:{x:60,y:65}};
    const counts=kind=>{resetRandom(55);let runner=0;for(let i=0;i<5000;i++) {
      if(pickPassTarget(kind,'home',[home[3],home[5],home[6]],home[3],anchors,anchors.h3,[],{},homeSetup).id==='h5') runner++;
    }return runner;}; return {short:counts('short'),through:counts('through')};
  `);
  assert.ok(result.short < 2300);
  assert.ok(result.through > 3000);
});

test('les courses sans ballon suivent le rôle et le pressing change la distance réellement parcourue', () => {
  const result = scenario(`
    MATCH_BALANCE.chain.maxActions=1; chooseActionType=()=> 'carry';
    const movement=role=>{
      const s=setup(home); s.playerRoles.h1=role;
      const p=params(s);p.defenders=[];p.defAnchors={};p.atkAnchors.h1={x:25,y:32};
      p.initialState={carrierId:'h3',ball:{x:50,y:60},positions:{h1:{x:25,y:32},h3:{x:50,y:60}}};
      resetRandom(9);return simulatePossessionChain(p).endState.positions.h1;
    };
    const press=style=>{
      const p=params(homeSetup,setup(away,style));p.attackers=[home[3]];p.defenders=[away[1]];
      p.atkAnchors={h3:{x:50,y:45}};p.defAnchors={a1:{x:50,y:55}};
      p.initialState={carrierId:'h3',ball:{x:50,y:45}};
      resetRandom(9);return simulatePossessionChain(p).beats.find(b=>b.type==='press');
    };
    return {fixed:movement('stay_back'),overlap:movement('overlap'),pressing:press('pressing'),compact:press('compact')};
  `);
  assert.ok(result.overlap.y > result.fixed.y + 3);
  const distance = beat => Math.hypot(beat.to.x-beat.from.x,beat.to.y-beat.from.y);
  assert.ok(distance(result.pressing) > distance(result.compact));
});

test('rôles et identités préservent la continuité, la vitesse et le même hasard sans animation', () => {
  const results = scenario(`
    const styles=Object.keys(TEAM_STYLES), errors=[];
    for(let seed=1;seed<=80;seed++) {
      const p=params(setup(home,styles[seed%styles.length]),setup(away,styles[(seed+2)%styles.length]));
      p.atkSetup.playerRoles.h1=seed%2?'overlap':'stay_back';p.atkSetup.playerRoles.h3='creator';p.atkSetup.playerRoles.h6='poacher';
      resetRandom(seed);const animated=simulatePossessionChain(p), calls=randomCalls;
      resetRandom(seed);const instant=simulatePossessionChain({...p,withSequence:false});
      if(calls!==randomCalls || JSON.stringify({...animated,beats:[]})!==JSON.stringify(instant)) errors.push('animation:'+seed);
      for(const beat of animated.beats) for(const [id,after] of Object.entries(beat.positionsAfter)) {
        const before=beat.positionsBefore[id];
        if(!Number.isFinite(after.x)||!Number.isFinite(after.y)||after.x<0||after.x>100||after.y<0||after.y>100) errors.push('bounds:'+seed);
        if(Math.hypot(after.x-before.x,after.y-before.y)>26*beat.duration+1e-7) errors.push('speed:'+seed+':'+beat.type);
      }
      for(let i=1;i<animated.beats.length;i++) if(JSON.stringify(animated.beats[i].positionsBefore)!==JSON.stringify(animated.beats[i-1].positionsAfter)) errors.push('continuity:'+seed);
    }return errors;
  `);
  assert.deepEqual(results, []);
});

test('le gardien garde sa ligne dans le repli des anciennes animations avec rôles', () => {
  const result = scenario(`
    const samples=[];
    for(const side of ['home','away']) for(const possessing of [true,false]) {
      const keeperY=side==='home'?5:95;
      const opposite=side==='home'?'away':'home';
      const ballSide=possessing?side:opposite;
      const anchors={g:{x:50,y:keeperY,pos:'GK',roleKey:'keeper',teamStyle:'pressing'}};
      const actors={a:{x:50,y:ballSide==='home'?70:30,pos:'MID'},b:{x:80,y:ballSide==='home'?80:20,pos:'ATT'}};
      const own=possessing?{...anchors,...actors}:anchors;
      const other=possessing?{}:actors;
      const c=createChoreographer();
      c.setAnchors(side==='home'?own:other,side==='away'?own:other);
      c.loadSequence([{type:'pass',side:ballSide,playerId:'a',toPlayerId:'b',
        from:{x:50,y:ballSide==='home'?70:30},to:{x:80,y:ballSide==='home'?80:20},duration:3}]);
      for(let i=0;i<20;i++)c.step(.1);
      samples.push({keeperY,keeper:c.getState().players.find(p=>p.id==='g')});
    }
    return samples;
  `);
  for (const sample of result) {
    assert.equal(sample.keeper.targetY, sample.keeperY);
    assert.equal(sample.keeper.y, sample.keeperY);
    assert.ok(sample.keeper.x >= 42 && sample.keeper.x <= 58);
    assert.ok(Math.abs(sample.keeper.x - 50) > 0.1, 'le gardien accompagne latéralement le ballon');
  }
});

console.log(`${passed}/${passed+failed} régressions de rôles et identités réussies`);
process.exitCode = failed ? 1 : 0;
