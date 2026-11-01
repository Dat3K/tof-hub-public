import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {Nickname,RegionCell} from './player-identity';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('shared player identity',()=>{
  it('copies the exact original nickname and selects the whole styled name',async()=>{
    const raw='  Phantom\u200b\u3164',writeText=vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator',{clipboard:{writeText}});
    const {container}=render(<Nickname nickname={raw} uid="13002123" copy={{blankName:'blank',blankNameHint:'Invisible characters:',nicknameCopied:'Nickname copied'}}/>);
    const name=container.querySelector('b')!;
    expect(name.textContent).toBe('blankPhantomblank');
    fireEvent.doubleClick(name);
    await waitFor(()=>expect(writeText).toHaveBeenCalledWith(raw));
    expect(window.getSelection()?.toString()).toBe('blankPhantomblank');
    expect(await screen.findByText('Nickname copied')).toBeTruthy();
    const setData=vi.fn();fireEvent.copy(name,{clipboardData:{setData}});
    expect(setData).toHaveBeenCalledWith('text/plain',raw);
  });
  it('shows player counters in the nickname hover',async()=>{
    render(<Nickname nickname="Phantom" uid="13002123" copy={{blankName:'blank',blankNameHint:'Invisible characters:',nicknameCopied:'Nickname copied'}}
      details={<><div><strong>Packs bought</strong><b>7</b></div><div><strong>TotalRecharge</strong><b>100</b></div></>}/>);
    fireEvent.mouseOver(screen.getByText('Phantom'));
    expect(await screen.findByText('Packs bought')).toBeTruthy();
    expect(await screen.findByText('100')).toBeTruthy();
  });
  it('shows the colored region and server from the existing catalog',()=>{
    const {container}=render(<RegionCell player={{serverId:'13002',region:'EU'}}/>);
    expect(container.querySelector('[data-region="EU"]')?.textContent).toBe('EU');
    expect(screen.getByText('Alintheus')).toBeTruthy();
  });
});
