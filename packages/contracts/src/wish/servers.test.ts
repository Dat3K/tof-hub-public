import { describe, it, expect } from 'vitest';
import {
  TOWER_OF_FANTASY_SERVERS,
  canonicalPlayerUid,
  resolveServerFromUid,
  playerServerRefusal,
  getServerById,
  getServersByRegion,
  getAllServers,
  formatServerDisplay,
  resolvePlayerServer,
  resolveRegionFromUid,
} from './servers';

describe('Tower of Fantasy Servers & UID Resolution', () => {
  it('removes only leading character-number padding after the complete server id',()=>{
    for(const [input,expected]of [['1300701214','130071214'],['1300506653','130056653'],
      ['999910100095','999910195'],['115000301216','11500031216'],
      ['1300710214','1300710214'],['130071214','130071214'],['99900000012','99900000012'],['not-a-uid','not-a-uid']]) {
      expect(canonicalPlayerUid(input!)).toBe(expected);
      expect(canonicalPlayerUid(canonicalPlayerUid(input!))).toBe(expected);
    }
    // A verified RoleID supplies the prefix even for a server absent from the catalog.
    const roleId=((7777777n<<32n)|12n).toString();
    expect(canonicalPlayerUid('777777700012',{roleId})).toBe('777777712');
  });
  it('contains all regions including Asian Pacific, NA, EU, KR, SA, SEA, and TW', () => {
    const servers = getAllServers();
    expect(servers.length).toBeGreaterThanOrEqual(140);

    const ap = getServersByRegion('Asia-Pacific');
    const na = getServersByRegion('North America');
    const eu = getServersByRegion('Europe');
    const kr = getServersByRegion('Korea');
    const sa = getServersByRegion('South America');
    const sea = getServersByRegion('Southeast Asia');
    const tw = getServersByRegion('Taiwan');

    // Official list (scripts/data/serverlist_ob40.json); the PlayStation tabs form one PS region. KR keeps the legacy
    // 14001–14009 next to Esperia 9999101–9999108.
    expect(ap.length).toBe(35);
    expect(na.length).toBe(25);
    expect(eu.length).toBe(33);
    expect(kr.length).toBe(9 + 8);
    expect(sa.length).toBe(19);
    expect(sea.length).toBe(24);
    const ps = getServersByRegion('PS');
    expect(ps.length).toBe(11 + 5 + 3 + 1);
    expect(ps.every(server => server.platform === 'ps' && server.region === 'PlayStation' && /^PS-/.test(server.tab ?? ''))).toBe(true);
    // The six Taiwan ids observed in profile packets (scripts/data/serverlist_tw.json).
    expect(tw.length).toBe(6);
    expect(getServersByRegion('China').length).toBe(173);
    expect(getServersByRegion('Warp Server').map(server => server.name)).toEqual(['時空折躍', 'WS-Asia-01', 'WS-America-01', 'WS-Europe-01']);
    expect(getServersByRegion('TEST').every(server => server.kind === 'test')).toBe(true);
  });

  it('resolves 7-digit PlayStation and Esperia ids before the 5-digit ones', () => {
    expect(resolveServerFromUid('2001003123456')).toMatchObject({ id: '2001003', name: 'America-3', regionCode: 'PS', platform: 'ps' });
    expect(resolveServerFromUid('9999108123456')).toMatchObject({ id: '9999108', name: '진주', regionCode: 'KR' });
    expect(resolveServerFromUid('1104412345')).toMatchObject({ id: '11044', name: 'The Morning Star' });
    expect(resolveServerFromUid('1203112345')).toMatchObject({ id: '12031', name: 'Rainbow Road' });
    expect(resolveServerFromUid('1602412345')).toMatchObject({ id: '16024', name: 'Tore de Utopia' });
  });

  it('correctly maps Asian Pacific servers (11xxx)', () => {
    const eden = getServerById('11001');
    expect(eden).toBeDefined();
    expect(eden?.name).toBe('Eden');
    expect(eden?.region).toBe('Asia-Pacific');
    expect(eden?.regionCode).toBe('AP');

    const cocokonderu = getServerById('11034');
    expect(cocokonderu?.name).toBe('Cocokonderu');
  });

  it('correctly maps North America servers (12xxx)', () => {
    const theGlades = getServerById('12001');
    expect(theGlades?.name).toBe('The Glades');
    expect(theGlades?.region).toBe('North America');
    expect(theGlades?.regionCode).toBe('NA');

    const solaris = getServerById('12005');
    expect(solaris?.name).toBe('Solaris');

    const oasis = getServerById('12024');
    expect(oasis?.name).toBe('Oasis');
  });

  it('correctly maps Europe servers (13xxx)', () => {
    const alintheus = getServerById('13002');
    expect(alintheus?.name).toBe('Alintheus');
    expect(alintheus?.region).toBe('Europe');
    expect(alintheus?.regionCode).toBe('EU');

    const karstCave = getServerById('13033');
    expect(karstCave?.name).toBe('Karst Cave');
  });

  it('correctly maps Korea servers (14xxx)', () => {
    const astra = getServerById('14001');
    expect(astra?.name).toBe('Astra');
    expect(astra?.nativeName).toBe('아스트라');
    expect(astra?.region).toBe('Korea');
    expect(astra?.regionCode).toBe('KR');

    const banges = getServerById('14002');
    expect(banges?.name).toBe('Banges');
    expect(banges?.nativeName).toBe('뱅기스');
  });

  it('correctly maps South America servers (15xxx)', () => {
    const tiamat = getServerById('15003');
    expect(tiamat?.name).toBe('Tiamat');
    expect(tiamat?.region).toBe('South America');
    expect(tiamat?.regionCode).toBe('SA');

    const pyxis = getServerById('15019');
    expect(pyxis?.name).toBe('Pyxis');
  });

  it('correctly maps Southeast Asia servers (16xxx)', () => {
    const phantasia = getServerById('16001');
    expect(phantasia?.name).toBe('Phantasia');
    expect(phantasia?.region).toBe('Southeast Asia');
    expect(phantasia?.regionCode).toBe('SEA');

    const edenia = getServerById('16023');
    expect(edenia?.name).toBe('Edenia');
  });

  it('maps the observed Taiwan servers (11500NN) and no longer the unsourced 17xxx ids', () => {
    expect(getServerById('1150001')).toMatchObject({ region: 'Taiwan', regionCode: 'TW' });
    expect(getServerById('17001')).toBeNull();
  });

  it('resolves server directly from in-game character UID prefixes', () => {
    // Alintheus (EU)
    const playerEU = resolveServerFromUid('13002491823');
    expect(playerEU?.name).toBe('Alintheus');
    expect(playerEU?.region).toBe('Europe');

    // Solaris (NA)
    const playerNA = resolveServerFromUid('12005882310');
    expect(playerNA?.name).toBe('Solaris');
    expect(playerNA?.regionCode).toBe('NA');

    // Eden (AP)
    const playerAP = resolveServerFromUid('11001402911');
    expect(playerAP?.name).toBe('Eden');
    expect(playerAP?.regionCode).toBe('AP');

    // Tiamat (SA)
    const playerSA = resolveServerFromUid('15003991204');
    expect(playerSA?.name).toBe('Tiamat');
    expect(playerSA?.regionCode).toBe('SA');

    // Phantasia (SEA)
    const playerSEA = resolveServerFromUid('16001004128');
    expect(playerSEA?.name).toBe('Phantasia');
    expect(playerSEA?.regionCode).toBe('SEA');

    // Korea Astra
    const playerKR = resolveServerFromUid('14001099231');
    expect(playerKR?.name).toBe('Astra');
    expect(playerKR?.regionCode).toBe('KR');

    // Taiwan (7-digit server id)
    expect(resolveServerFromUid('115000209231')?.regionCode).toBe('TW');

    // Handles numeric UID
    const numUid = resolveServerFromUid(1300200000);
    expect(numUid?.name).toBe('Alintheus');

    // Invalid or short UIDs
    expect(resolveServerFromUid('123')).toBeNull();
    expect(resolveServerFromUid('99999000')).toBeNull();
    expect(resolveServerFromUid(null)).toBeNull();
    expect(resolveServerFromUid(undefined)).toBeNull();
  });

  it('formats server display strings nicely', () => {
    const alintheus = getServerById('13002');
    expect(formatServerDisplay(alintheus)).toBe('Alintheus (EU)');
    expect(formatServerDisplay(alintheus, true)).toBe('Alintheus (EU) #13002');

    const krAstra = getServerById('14001');
    expect(formatServerDisplay(krAstra)).toBe('Astra [아스트라] (KR)');
    expect(formatServerDisplay(krAstra, true)).toBe('Astra [아스트라] (KR) #14001');

    expect(formatServerDisplay(null)).toBe('Unknown Server');
  });

  it('resolves a player by explicit server id, then UID, then UID region', () => {
    expect(resolvePlayerServer({ uid: '170010001', serverId: '14001' }).server?.id).toBe('14001');
    expect(resolvePlayerServer({ uid: '140010001' })).toMatchObject({ server: { id: '14001' }, regionCode: 'KR' });
    // A server newer than the catalog: no server, the region of its UID prefix.
    expect(resolvePlayerServer({ uid: '110990001', serverId: 'nope' })).toEqual({ server: null, regionCode: resolveRegionFromUid('110990001') });
    expect(resolvePlayerServer({})).toEqual({ server: null, regionCode: null });
  });

  it('resolves Taiwan UIDs by their 7-digit server id (11500NN), not by the AP prefix 11', () => {
    expect(resolveServerFromUid('115000301216')).toMatchObject({ id: '1150003', regionCode: 'TW' });
    expect(resolveServerFromUid('1150001365216')).toMatchObject({ id: '1150001', regionCode: 'TW' });
    expect(resolveRegionFromUid('115000412345')).toBe('TW');
    // Taiwan Warp (unpadded character number, like 888800113).
    expect(resolveServerFromUid('11500136508')).toMatchObject({ id: '1150013', regionCode: 'WS' });
    expect(playerServerRefusal({ uid: '11500136508' })).toBe('unsupported-game');
  });
});

describe('playerServerRefusal', () => {
  it('accepts catalog servers and refuses unknown or Warp (MMO) servers', () => {
    expect(playerServerRefusal({ uid: '1302104471' })).toBeNull();
    expect(playerServerRefusal({ uid: '60832888' })).toBe('unknown-server');
    expect(playerServerRefusal({ uid: null })).toBe('unknown-server');
    expect(playerServerRefusal({ uid: '888810312345' })).toBe('unsupported-game');
    // PlayStation characters play the same global game (also from the PC client) and are imported by UID.
    expect(playerServerRefusal({ uid: '2002004123456' })).toBeNull();
    expect(resolveRegionFromUid('2001099123456')).toBe('PS');
    expect(playerServerRefusal({ uid: '1302104471', serverId: '8888103' })).toBe('unsupported-game');
  });
});
