import type {BuildCatalog,BuildDraft} from './types';

/** Element-specific ATK inside DisplayBase, retained once before ATK% on inheritance. */
export function supportAttack(draft:BuildDraft,catalog:BuildCatalog,element:string):number {
  return (draft.support??[]).reduce((sum,chosen)=>{
    const module=catalog.support?.modules.find(item=>item.id===chosen.id);
    const bonus=module?.levels.find(item=>item.level===chosen.level);
    return sum+(module?.attackStat===`${element} Attack`&&bonus&&!bonus.percentage?bonus.value:0);
  },0);
}
