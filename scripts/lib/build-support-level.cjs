// Limits and unlock requirements are supplied by the raw-data pipeline.
function selectSupportSystem(systemLevels, modules) {
  const stages=[...systemLevels].sort((a,b)=>a.maxModuleLevel-b.maxModuleLevel);
  if(!stages.length || !modules.length) throw new Error('Missing Space Support progression data');
  return stages.filter(stage=>modules.every(m=>Number.isInteger(m.level) && m.level>=stage.needAllModuleLevel)).at(-1) || stages[0];
}
module.exports={selectSupportSystem};
