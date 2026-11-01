// Compatibility API for the approved preview. Runtime and pipeline use the
// same typed game-domain implementation (Node 24 strips its type annotations).
const {getBuildRollCandidates,enumerateBuildRolls,getBuildStatMaximum}=require('../../packages/game-domain/src/build/stats.ts');
function percentOfMaximum(beforeTitan,rolls,type) {
  if(!rolls || !getBuildRollCandidates(beforeTitan,type,rolls).includes(rolls))return null;
  return beforeTitan/getBuildStatMaximum(beforeTitan,rolls,type).roll*100;
}
module.exports={candidates:getBuildRollCandidates,combinations:enumerateBuildRolls,percentOfMaximum};
