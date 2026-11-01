// Reproduce screenshot probabilities from region-specific raw Titan property pools.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=sitePaths.rawDir;
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const folder='Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/';
const overseas=read(folder+'EquipUncommonModifyData_Overseas.json')[0].Rows;
const base=read('Hotta/Content/Resources/CoreBlueprints/DataTable/EquipDataTables/EquipUncommonModifyData.json')[0].Rows;
const gear=read(folder+'EquipmentDataTable_Overseas.json')[0].Rows;
const reference=JSON.parse(fs.readFileSync('apps/web/public/game-data/build-reference.json','utf8')).titanRare;
const binding=read('Hotta/Content/ResourcesOverSea/GameData/BP_OverseaGameData_Base.json')
  .find(x=>x.Name==='Default__BP_OverseaGameData_Base_C').Properties;
for(const name of ['EquipUncommonModifyData','EquipUncommonRateData']) {
  assert.equal(binding[name].AssetPathName,'/Game/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/'+name+'_Overseas.'+name+'_Overseas');
}
const eligible=(entries,count)=>entries.filter(x=>x.TupoCountLimited<=count&&x.Weight>0);
let pairs=0;
for(const [slot,join] of Object.entries(reference.poolRows)) {
  assert.equal(gear[join.baseId].TupoRedItemID,join.titanId);
  const pack=gear[join.titanId].UncommonPackId;
  assert.equal(pack,join.packId);
  const entries=overseas[pack].UncommonModifyInfoList;
  assert.equal(entries.length,30);
  const total=eligible(entries,120).reduce((n,x)=>n+x.Weight,0);
  assert.equal(total,800);
  for(const [count,sum] of [[80,360],[81,360],[100,360],[101,640],[119,640]])assert.equal(eligible(entries,count).reduce((n,x)=>n+x.Weight,0),sum);
  const ids=[...new Set(entries.map(x=>x.ModifyID))];
  assert.deepEqual(ids,reference.pools[slot]);
  let highCount=0;
  for(const id of ids) {
    const values=entries.filter(x=>x.ModifyID===id).sort((a,b)=>a.PropLevel-b.PropLevel);
    const high=values[0].Weight===90;
    if(high)highCount++;
    assert.deepEqual(values.map(x=>x.Weight),high?[90,70,40,0,0]:[45,35,20,0,0]);
    assert.deepEqual(values.map(x=>x.TupoCountLimited),[1,101,120,200,400]);
    assert.deepEqual(values.map(x=>x.PropLevel),[1,2,3,4,5]);
    for(const [i,x] of values.entries()) {
      const baseEntry=base[pack].UncommonModifyInfoList.find(b=>b.SingleID===x.SingleID);
      assert.equal(baseEntry.Weight,x.Weight);
      assert.equal(baseEntry.TupoCountLimited,i===1?81:x.TupoCountLimited);
      assert.equal(x.WeaponTypeLimit,'EWeaponType::None');
      assert.deepEqual(x.UncommonPropKeyArray,[]);
      assert.equal(x.Weight/total*100,(high?[11.25,8.75,5,0,0]:[5.625,4.375,2.5,0,0])[i]);
      pairs++;
    }
  }
  assert.equal(highCount,2);
  assert.equal(eligible(entries,120).filter(x=>x.PropLevel===3).reduce((n,x)=>n+x.Weight,0)/total,.2);
  console.log(slot+' → '+join.titanId+' → '+pack+': total 800; screenshot probabilities match');
}
const rateRows=read(folder+'EquipUncommonRateData_Overseas.json')[0].Rows;
assert.equal(rateRows['80'].UncommonRate,.1328);
for(const count of [84,88,92,96,100,104,108,112,116,119,120])assert.equal(rateRows[count].UncommonRate,.25);
console.log('PASS: '+pairs+' property/level entries, 12 gear bindings, Overseas asset overrides, Lv3 threshold 120 and independent UncommonRate=.25.');
console.log('Native reroll exclusions, unchanged outcomes and post-120 row selection remain unverified.');
