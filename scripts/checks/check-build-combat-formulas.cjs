// Research audit: compare generated data with raw curves and independent sheet observations.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const rawRoot=sitePaths.rawDir;
const readRaw=name=>JSON.parse(fs.readFileSync(path.join(rawRoot,name),'utf8'));
const critPath='Hotta/Content/Resources/Abilities/DataTables/CritFormula.json';
const defencePath='Hotta/Content/Resources/Abilities/DataTables/DefenceFormula.json';
const crit=readRaw(critPath)[0].Rows;
const defence=readRaw(defencePath)[0].Rows;
const catalog=JSON.parse(fs.readFileSync('apps/web/public/game-data/build-page.json','utf8'));
const observation=JSON.parse(fs.readFileSync('scripts/data/build-combat-formula-observations.json','utf8'));
function coefficient(rows,key,level) {
  const curve=rows[key];
  assert.equal(curve.InterpMode,'RCIM_Linear');
  const keys=curve.Keys;
  const exact=keys.find(k=>k.Time===level);
  if(exact)return exact.Value;
  const left=keys.filter(k=>k.Time<level).at(-1);
  const right=keys.find(k=>k.Time>level);
  assert.ok(left&&right,'Audit only covers levels within raw keys');
  return left.Value+(right.Value-left.Value)*(level-left.Time)/(right.Time-left.Time);
}
function polynomial(rows,level) {
  return coefficient(rows,'ax2',level)*level*level+coefficient(rows,'bx',level)*level+coefficient(rows,'c',level);
}
function near(actual,expected,tolerance=1e-9) {assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);}
for(const key of ['ax2','bx','c']) {
  assert.equal(crit[key].Keys.length,defence[key].Keys.length);
  crit[key].Keys.forEach((k,i)=>{
    assert.equal(k.Time,defence[key].Keys[i].Time);
    assert.equal(k.Value/2,defence[key].Keys[i].Value);
  });
}
const legacyRoundingDifferences=[];
for(let level=1;level<=100;level++) {
  const p=polynomial(crit,level);
  assert.equal(catalog.reference.critFormula.denominators[level],Math.round(p));
  assert.equal(catalog.reference.resistanceFormula.constants[level],Math.floor(polynomial(defence,level)));
  if(Math.floor(Math.round(p)/2)!==Math.floor(polynomial(defence,level)))legacyRoundingDifferences.push(level);
}
const gameData=readRaw('Hotta/Content/Resources/CoreBlueprints/GameMode/BP_GameData.json')
  .find(o=>o.Name==='Default__BP_GameData_C').Properties.FormulaParameterSet;
for(const name of ['CritRate','CritDefRate']) {
  ['ax2','bx','c'].forEach((row,i)=>{
    const param=gameData[name]['Param'+(i+1)];
    assert.equal(param.Curve.RowName,row);
    assert.equal(param.Curve.CurveTable.ObjectPath,critPath.replace('.json','.0'));
    assert.equal(param.Value,1);
  });
}
for(const name of ['ElementalReductionAtk','ActualElementalReductionAtk']) {
  for(const params of gameData[name])['ax2','bx','c'].forEach((row,i)=>{
    assert.equal(params['Param'+(i+1)].Curve.RowName,row);
    assert.equal(params['Param'+(i+1)].Curve.CurveTable.ObjectPath,defencePath.replace('.json','.0'));
  });
}
const cell=id=>observation.cells[id].value;
assert.equal(observation.cells.D9.formula,'$B$9/(ccA*$B$11^2+ccB*$B$11+ccC)');
const level=cell('B11');
const sheetDenom=cell('F36')*level*level+cell('F37')*level+cell('F38');
near(sheetDenom,polynomial(crit,level));
near(cell('B9')/sheetDenom,cell('D9'));
const res=cell('H36'),k=cell('I36'),shred=cell('H39');
assert.equal(k,catalog.reference.resistanceFormula.constants[100]);
near(res/(res+k),cell('H37'));
near(res*(1-shred),cell('H40'));
near(cell('H40')/(cell('H40')+k),cell('H41'));
near((1-cell('H41'))/(1-cell('H37')),cell('H42'));
// Cached flat RES values in this export retain six decimal places.
near(k*cell('L37')/(1-cell('L37')),cell('L38'),5e-7);
near(cell('L38')*(1-cell('L39')),cell('L40'),5e-7);
near(cell('L40')/(k+cell('L40')),cell('L41'));
near((1-cell('L41'))/(1-cell('L37')),cell('L42'));
console.log('PASS: 100 Crit denominators, 100 RES constants, half-coefficients, raw formula bindings and spreadsheet observations.');
console.log('Legacy floor(round(P)/2) differs from current floor(P/2) at '+legacyRoundingDifferences.length+' levels: '+legacyRoundingDifferences.join(', '));
console.log('This audit does not prove native rounding, level argument semantics, or combat hit probability.');
