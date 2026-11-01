import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WeaponSkillChoices} from './weapon-skill-choices';
const options=[{id:'one',name:{en:'One',ru:'Первый'},icon:'',description:{en:'First effect',ru:'Первый эффект'}},{id:'two',name:{en:'Two',ru:'Второй'},icon:'',description:{en:'Second effect',ru:'Второй эффект'}}];
afterEach(cleanup);
it('keeps two independently ordered Scatter selections',()=>{
  const change=vi.fn();
  render(<WeaponSkillChoices options={options} value={['two','one']} onChange={change} locale="en"/>);
  const controls=screen.getAllByRole('combobox');expect(controls).toHaveLength(2);
  expect((controls[0] as HTMLSelectElement).value).toBe('two');
  fireEvent.change(controls[1],{target:{value:'two'}});expect(change).toHaveBeenCalledWith(1,'two');
});
it('edits one localized mode and can clear the selection',()=>{
  const change=vi.fn();
  render(<WeaponSkillChoices kind="mode" options={options} value={['one']} onChange={change} locale="ru"/>);
  const control=screen.getByRole('combobox',{name:'Режим оружия'});
  expect(screen.getAllByRole('combobox')).toHaveLength(1);
  fireEvent.change(control,{target:{value:'two'}});expect(change).toHaveBeenCalledWith(0,'two');
  fireEvent.change(control,{target:{value:''}});expect(change).toHaveBeenCalledWith(0,'');
});
