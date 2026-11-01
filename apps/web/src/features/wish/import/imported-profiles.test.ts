import {describe,it,expect} from 'vitest';
import {resolveServerFromUid,formatServerDisplay} from '@tof-hub/contracts';
import {toImportedProfileEntry} from './imported-profiles';
describe('imported wish identity',()=>{
  it('uses the Build server resolver and captured cosmetics without a banner-icon substitute',()=>{
    const profile={id:'import-example',uid:'1300506653',name:'Игрок',region:'EU',server:'13005',updatedAt:'2026-10-06T00:00:00Z',
      avatarCosmetic:{icon:'/avatar.webp'},avatarFrameCosmetic:{icon:'/frame.webp'}};
    const player=toImportedProfileEntry({profile,records:[],banners:[]}).player;
    expect(player.server).toBe(formatServerDisplay(resolveServerFromUid(profile.uid)!));
    expect(player.serverRegion).toBe('Europe');expect(player.avatar).toBe('/avatar.webp');
    expect(player.avatarFrameCosmetic?.icon).toBe('/frame.webp');
    expect(toImportedProfileEntry({profile:{...profile,avatarCosmetic:undefined},records:[],banners:[]}).player.avatar).toBe('');
  });
});
