const fs=require('node:fs');
const path=require('node:path');
module.exports=function buildCSRules({raw}) {
  const source='Hotta/Content/Resources/CoreBlueprints/DataTable/AttributeStaticDataTable.json';
  const rows=JSON.parse(fs.readFileSync(path.join(raw,source),'utf8'))[0].Rows;
  const weights={},attributes={},bases={};
  const add=(type,id,base)=>{
    if(!Number.isFinite(rows[id]?.Value))throw new Error('Missing CS coefficient '+id);
    weights[type]=rows[id].Value*(base==='fixedPercent'?100:1);
    attributes[type]=id;if(base)bases[type]=base;
  };
  add('Attack','CommonAtkAdded');add('HP','MaxHealthAdded');add('Resistance','ElementDef');add('Crit','CritAdded');
  add('HP %','MaxHealthMult','HP');add('Resistance %','ElementDefMult','Resistance');
  add('Crit Rate %','FinalCrit','fixedPercent');
  for(const [element,prefix] of Object.entries({Physical:'Phy',Frost:'Ice',Flame:'Fire',Volt:'Thunder',Altered:'Superpower'})){
    add(element+' Attack',prefix+'AtkAdded');add(element+' Resistance',prefix+'DefAdded');
    add(element+' Attack %',prefix+'AtkMult',element+' Attack');
    add(element+' Resistance %',prefix+'DefMult',element+' Resistance');
    add(element+' Damage %',prefix+'AtkExtraUpMult','fixedPercent');
  }
  const evidence=require('../data/build-cs-observations.json');
  for(const example of [...evidence.flat,...evidence.fixedPercent]){
    if(Math.abs(example.value*weights[example.type]+example.residual-example.observedCS)>1e-6)throw new Error('CS screenshot coefficient mismatch '+example.type);
  }
  const titanEvidence=require('../data/build-titan-observations.json');
  const titan=Object.fromEntries(titanEvidence.items.map(item=>{
    const rawWeight=rows[item.id]?.Value;
    if(!Number.isFinite(rawWeight))throw new Error('Missing Titan CS coefficient '+item.id);
    const weight=item.id==='CommonDamageRecoverHPMult'?item.calculatedCSWeightPerFraction:rawWeight;
    if(weight!==item.calculatedCSWeightPerFraction)throw new Error('Titan CS coefficient mismatch '+item.id);
    return [item.id,{weight,rawWeight,source:item.id==='CommonDamageRecoverHPMult'?'scripts/data/build-titan-observations.json':source}];
  }));
  return {source,weights,attributes,bases,titan,rounding:'Unconfirmed: displayed estimate truncates the total; per-component rounding may differ',scope:'Current equipment stats, including enhancement, unlocked stats and the rare Titan property at its item level'};
};
