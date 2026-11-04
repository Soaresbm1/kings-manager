const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function context() {
  const context = vm.createContext({ document: { addEventListener() {} }, localStorage: { getItem() { return null; }, setItem() {} } });
  vm.runInContext('let seed=20261104, randomCalls=0; Math.random=()=>{randomCalls++; return ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);};', context);
  for (const file of ["data.js", "matchengine-actions.js", "engine.js", "recruitment-advisor.js", "player-progress.js", "bench-advisor.js", "app.js", "decision-tools.js"])
    vm.runInContext(fs.readFileSync(require.resolve("./" + file), "utf8"), context, { filename: file });
  vm.runInContext(`
    STATE.leagueKey="france";
    STATE.league={name:LEAGUES.france.name, teams:JSON.parse(JSON.stringify(LEAGUES.france.teams)), results:[]};
    STATE.userTeamId=STATE.league.teams[0].id;
    STATE.currentSlotId="integration";
    STATE.schedule=generateSchedule(STATE.league.teams.map(team=>team.id));
    STATE.otherLeagues=buildOtherLeagues("france");
    STATE.savedTactic=sanitizeTactic(null);
  `, context);
  return context;
}
const plain = value => JSON.parse(JSON.stringify(value));
const first = context();
const before = vm.runInContext("JSON.stringify(STATE.league)", first);
vm.runInContext("capturePlayerProgress()", first);
assert.equal(vm.runInContext("JSON.stringify(STATE.league)", first), before);
const save = plain(vm.runInContext("buildSaveData()", first));
assert(save.playerProgress.players.length > 0);
assert(save.playerProgress.players.every(player => player.samples.length === 1));
assert(save.playerProgress.players.every(player => player.samples[0][0] === 1));
console.log("OK les relevés persistants ne modifient aucun joueur de la carrière réelle");

function replay(withInsights) {
  const target = context();
  return plain(vm.runInContext(`
    (()=>{
      const home=STATE.league.teams[0], away=STATE.league.teams[1];
      const homeSetup=sanitizeTactic(STATE.savedTactic);
      const awaySetup={...JSON.parse(JSON.stringify(homeSetup)), assignments:chooseAiFormation(away).assignments};
      awaySetup.lineup=awaySetup.assignments.filter(Boolean); homeSetup.lineup=homeSetup.assignments.filter(Boolean);
      matchEngine=createMatchEngine(home,homeSetup,away,awaySetup);
      matchState={team:home,homeTeam:home,awayTeam:away,homeSetup,awaySetup,userSide:"home",minute:0,sequenceActive:false};
      const outcomes=[]; let insightRandom=0;
      for(let minute=0;minute<=70;minute++){
        if(minute) outcomes.push(matchEngine.simulateMinute(minute));
        matchState.minute=minute;
        if(${JSON.stringify(withInsights)}){
          const calls=randomCalls;
          captureBenchObservation();
          BenchAdvisor.build({observation:matchState.benchObservation,assignments:homeSetup.assignments,slots:FORMATION_SLOTS[homeSetup.formation]});
          capturePlayerProgress();
          RecruitmentAdvisor.build({team:home,leagueKey:"france",leagues:[{key:"france",teams:STATE.league.teams}],setup:homeSetup,slots:FORMATION_SLOTS[homeSetup.formation]});
          insightRandom+=randomCalls-calls;
        }
        if(matchEngine.isMatchDecided()) break;
      }
      return {outcomes,result:matchEngine.finalize(),randomCalls,insightRandom,homeSetup,awaySetup};
    })()
  `, target));
}
const baseline = replay(false), observed = replay(true);
assert.equal(observed.insightRandom, 0);
assert.deepEqual(observed, baseline);
console.log("OK un match réel produit exactement les mêmes actions, résultat, compositions et tirages avec les trois aides");

const Progress = require("./player-progress.js");
const Storage = require("./career-storage.js");
const players = Array.from({ length: 22 }, (_, index) => ({ id: "tracked" + index, name: "Un joueur " + index,
  overall: 70, speed: 70, technique: 70, physical: 70, mental: 70, form: 75, value: 10000, careerMatches: 0 }));
let ledger = null;
for (let day = 0; day < 130; day++) ledger = Progress.observe(ledger, { season: 1, day, round: day,
  players: players.map((player, index) => ({ ...player, form: 40 + (day + index) % 60, value: day * 1000 + index, careerMatches: day })) });
const disk = new Map(); let peak = 0;
const storage = { getItem: key => disk.get(key) ?? null, setItem(key, value) {
  const next = new Map(disk); next.set(key, value);
  const bytes = [...next].reduce((sum, [key, value]) => sum + 2 * (key.length + value.length), 0);
  if (bytes > 5242880) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
  peak = Math.max(peak, bytes); disk.set(key, value);
} };
const service = Storage.create({ storage });
for (let index = 0; index < 3; index++) {
  const entry = { meta: { teamName: "Carrière " + index }, data: { ...save, playerProgress: ledger } };
  assert.equal(service.write("slot" + index, entry).ok, true);
  entry.meta.updatedAt = 2;
  assert.equal(service.write("slot" + index, entry).ok, true);
}
assert.equal(Object.keys(service.inspect().backups).length, 3);
console.log(`OK trois carrières réelles avec suivis longs et points de restauration tiennent dans 5Mio (${peak} octets)`);
