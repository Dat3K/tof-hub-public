import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueueView} from './queue-view';
import {I18nProvider} from '@/lib/i18n';
import type {QueueBoard,QueueJob} from './client';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});

const mockData=(board:QueueBoard,jobs:QueueJob[])=>{
  vi.stubGlobal('localStorage',{
    getItem:vi.fn(()=>JSON.stringify(jobs.map(j=>({id:j.id,kind:j.kind,createdAt:j.createdAt})))),
    setItem:vi.fn(),
  });
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url.includes('/api/v1/queue/jobs/')) {
      const id=url.split('/').pop();
      const matched=jobs.find(j=>j.id===id);
      return {ok:true,status:200,json:async()=>matched} as Response;
    }
    return {ok:true,status:200,json:async()=>board} as Response;
  }));
};

describe('QueueView results rendering',()=>{
  const sampleBoard:QueueBoard={
    active:[],
    recent:[],
    averageMs:{'players-import':5000},
    limits:{maxWaiting:20,perIp:1},
  };

  it('renders players-import in Russian with region, counters, and expandable player list',async()=>{
    const job:QueueJob={
      id:'job-players',
      seq:120,
      kind:'players-import',
      state:'complete',
      position:0,
      estimateMs:null,
      createdAt:new Date().toISOString(),
      startedAt:null,
      finishedAt:new Date().toISOString(),
      result:{
        files:2,
        stored:1,
        duplicates:1,
        rejected:0,
        region:'EU',
        server:'Aida',
        players:[
          {uid:'13010001',name:'PlayerAlpha',gear:8,status:'new'},
          {uid:'13010002',name:'PlayerBeta',gear:4,status:'repeated'},
        ],
      },
    };

    mockData(sampleBoard,[job]);
    render(<I18nProvider initialLocale="ru" initialSource="tof_locale"><QueueView/></I18nProvider>);

    expect(await screen.findByText('EU')).toBeTruthy();
    expect(screen.getByText('Сервер: Aida')).toBeTruthy();
    expect(screen.getByText('В среднем')).toBeTruthy();
    expect(screen.getByText(/Игроки: всего 2, новых 1, обновлено 1, отклонено 0/)).toBeTruthy();

    const toggleBtn=screen.getByRole('button',{name:/Показать список игроков/});
    expect(toggleBtn).toBeTruthy();

    fireEvent.click(toggleBtn);
    expect(screen.getByText('PlayerAlpha')).toBeTruthy();
    expect(screen.getByText('UID 13010001')).toBeTruthy();
    expect(screen.getByText('новый')).toBeTruthy();
    expect(screen.getByText('8 предметов снаряжения')).toBeTruthy();
    expect(screen.getByText('PlayerBeta')).toBeTruthy();
    expect(screen.getByText('UID 13010002')).toBeTruthy();
    expect(screen.getByText('обновлён')).toBeTruthy();
  });

  it('renders players-import in English with region, counters, and expandable player list',async()=>{
    const job:QueueJob={
      id:'job-players-en',
      seq:120,
      kind:'players-import',
      state:'complete',
      position:0,
      estimateMs:null,
      createdAt:new Date().toISOString(),
      startedAt:null,
      finishedAt:new Date().toISOString(),
      result:{
        files:2,
        stored:1,
        duplicates:1,
        rejected:0,
        region:'EU',
        server:'Aida',
        players:[
          {uid:'13010001',name:'PlayerAlpha',gear:8,status:'new'},
        ],
      },
    };

    mockData(sampleBoard,[job]);
    render(<I18nProvider initialLocale="en" initialSource="tof_locale"><QueueView/></I18nProvider>);

    expect(await screen.findByText('EU')).toBeTruthy();
    expect(screen.getByText('Server: Aida')).toBeTruthy();
    expect(screen.getByText('Average time')).toBeTruthy();
    expect(screen.getByText(/Players: 2 total, 1 new, 1 updated, 0 rejected/)).toBeTruthy();

    const toggleBtn=screen.getByRole('button',{name:/Show player list/});
    expect(toggleBtn).toBeTruthy();

    fireEvent.click(toggleBtn);
    expect(screen.getByText('PlayerAlpha')).toBeTruthy();
    expect(screen.getByText('new')).toBeTruthy();
    expect(screen.getByText('8 gear items')).toBeTruthy();
  });

  it('renders wish-import with region, nickname and UID in Russian and English',async()=>{
    const job:QueueJob={
      id:'job-wish',
      seq:121,
      kind:'wish-import',
      state:'complete',
      position:0,
      estimateMs:null,
      createdAt:new Date().toISOString(),
      startedAt:null,
      finishedAt:new Date().toISOString(),
      result:{
        profileId:'prof-123',
        inserted:15,
        duplicates:3,
        unresolved:0,
        nickname:'Lilou',
        uid:'1301564092',
        region:'EU',
      },
    };

    mockData(sampleBoard,[job]);
    render(<I18nProvider initialLocale="ru" initialSource="tof_locale"><QueueView/></I18nProvider>);

    expect(await screen.findByText('EU')).toBeTruthy();
    expect(screen.getByText('Lilou (UID 1301564092)')).toBeTruthy();
    expect(screen.getByText(/Новых круток: 15, уже были: 3/)).toBeTruthy();
  });

  it('renders build-import with region, nickname and UID in Russian',async()=>{
    const job:QueueJob={
      id:'job-build',
      seq:122,
      kind:'build-import',
      state:'complete',
      position:0,
      estimateMs:null,
      createdAt:new Date().toISOString(),
      startedAt:null,
      finishedAt:new Date().toISOString(),
      result:{
        success:true,
        name:'Ehoklon',
        uid:'1302104471',
        region:'EU',
        server:'Aida',
        gear:8,
      },
    };

    mockData(sampleBoard,[job]);
    render(<I18nProvider initialLocale="ru" initialSource="tof_locale"><QueueView/></I18nProvider>);

    expect(await screen.findByText('EU')).toBeTruthy();
    expect(screen.getByText('Сервер: Aida')).toBeTruthy();
    expect(screen.getByText('Ehoklon (UID 1302104471)')).toBeTruthy();
    expect(screen.getByText('Предметов экипировки: 8.')).toBeTruthy();
    expect(screen.getByRole('link',{name:'Профиль →'}).getAttribute('href')).toBe('/tools/build/1302104471');
  });

  it('leaves incomplete legacy results as a plain action row without invented counts',async()=>{
    const jobs:QueueJob[]=[
      {id:'old-players',seq:124,kind:'players-import',state:'complete',position:0,estimateMs:null,createdAt:new Date().toISOString(),startedAt:null,finishedAt:new Date().toISOString(),result:{region:'EU'}},
      {id:'old-build',seq:125,kind:'build-import',state:'complete',position:0,estimateMs:null,createdAt:new Date().toISOString(),startedAt:null,finishedAt:new Date().toISOString(),result:{name:'Old player',uid:'1302104471',region:'EU'}},
    ];
    mockData(sampleBoard,jobs);
    render(<I18nProvider initialLocale="ru" initialSource="tof_locale"><QueueView/></I18nProvider>);
    expect(await screen.findByText('№124 · Загрузка игроков')).toBeTruthy();
    expect(screen.getByText('№125 · Импорт билда')).toBeTruthy();
    expect(screen.queryByText(/Игроки 0:/)).toBeNull();
    expect(screen.queryByText(/Предметов экипировки:/)).toBeNull();
  });

  it('reconstructs a build-import summary from a legacy saved capture',async()=>{
    const job:QueueJob={id:'legacy-build',seq:126,kind:'build-import',state:'complete',position:0,estimateMs:null,
      createdAt:new Date().toISOString(),startedAt:null,finishedAt:new Date().toISOString(),result:{
        data:{profile:{name:'Legacy player'},capture:{subject:{uid:'1302104471'}},gear:[{},{}]},region:'EU',server:'Aida',
      }};
    mockData(sampleBoard,[job]);
    render(<I18nProvider initialLocale="ru" initialSource="tof_locale"><QueueView/></I18nProvider>);
    expect(await screen.findByText('Legacy player (UID 1302104471)')).toBeTruthy();
    expect(screen.getByText('Предметов экипировки: 2.')).toBeTruthy();
    expect(screen.getByRole('link',{name:'Профиль →'})).toBeTruthy();
  });

  it('renders build-profile with region, nickname and UID in Russian',async()=>{
    const job:QueueJob={
      id:'job-build-prof',
      seq:123,
      kind:'build-profile',
      state:'complete',
      position:0,
      estimateMs:null,
      createdAt:new Date().toISOString(),
      startedAt:null,
      finishedAt:new Date().toISOString(),
      result:{
        uid:'1302104471',
        name:'Ehoklon',
        slot:'dps-frost',
        region:'EU',
      },
    };

    mockData(sampleBoard,[job]);
    render(<I18nProvider initialLocale="ru" initialSource="tof_locale"><QueueView/></I18nProvider>);

    expect(await screen.findByText('EU')).toBeTruthy();
    expect(screen.getByText('Ehoklon (UID 1302104471)')).toBeTruthy();
    expect(screen.getByText(/Профиль сохранён/)).toBeTruthy();
    expect(screen.getByRole('link',{name:/Открыть/})).toBeTruthy();
  });
});
