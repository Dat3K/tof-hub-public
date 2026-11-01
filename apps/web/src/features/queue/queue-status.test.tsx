'use client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {QueueStatus} from './queue-status';
import type {QueueBoard,QueueJob} from './client';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
const board=(active:QueueBoard['active'],averageMs:QueueBoard['averageMs']={}):QueueBoard =>
  ({active,recent:[],averageMs,limits:{maxWaiting:20,perIp:1}});
const row=(over:Partial<QueueBoard['active'][number]>):QueueBoard['active'][number] =>
  ({seq:1,kind:'players-import',state:'queued',position:2,createdAt:new Date().toISOString(),startedAt:null,mine:false,...over});
const job=(over:Partial<QueueJob>):QueueJob =>
  ({id:'job-1',seq:3,kind:'players-import',state:'queued',position:3,estimateMs:90000,createdAt:new Date().toISOString(),startedAt:null,result:null,error:null,...over} as QueueJob);
const mockBoard=(value:QueueBoard|Error)=>{
  vi.stubGlobal('fetch',vi.fn(async()=>{if(value instanceof Error)throw value;
    return {ok:true,json:async()=>value} as Response;}));
};

describe('QueueStatus',()=>{
  it('shows the page job place and estimate',async()=>{
    mockBoard(board([]));
    render(<QueueStatus job={job({})} locale="ru"/>);
    expect(await screen.findByText(/Очередь №3/)).toBeTruthy();
    expect(await screen.findByText(/≈ 2 мин/)).toBeTruthy();
  });
  it('shows a running job without a place',async()=>{
    mockBoard(board([]));
    render(<QueueStatus job={job({state:'processing',position:1,estimateMs:null})} locale="en"/>);
    expect(await screen.findByText(/Processing…/)).toBeTruthy();
  });
  it('finds my job from another page through the board',async()=>{
    mockBoard(board([row({seq:7,position:2,mine:true})],{'players-import':60000}));
    render(<QueueStatus job={null} locale="ru"/>);
    expect(await screen.findByText(/Моя очередь №2/)).toBeTruthy();
    expect(await screen.findByText(/≈ 1 мин/)).toBeTruthy();
  });
  it('shows the shared load and degrades to the quiet link offline',async()=>{
    mockBoard(board([row({position:1}),row({position:2})]));
    const {unmount}=render(<QueueStatus job={null} locale="en"/>);
    expect(await screen.findByText('In queue: 2')).toBeTruthy();
    unmount();
    mockBoard(new Error('offline'));
    render(<QueueStatus job={null} locale="en"/>);
    expect(await screen.findByText('Queue')).toBeTruthy();
  });
});
