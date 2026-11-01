import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Toast,ToastMirror,ToastProvider,useToast} from './toast';

afterEach(()=>{cleanup();vi.useRealTimers();});
describe('shared notifications',()=>{
  it('mirrors an action without duplicate announcements and shares pause, expiry and dismissal',()=>{
    vi.useFakeTimers();
    function Action(){const {notify}=useToast();return <><button onClick={()=>notify('Copied',{id:'share'})}>Share</button><ToastMirror id="share" className="near-share"/></>;}
    render(<ToastProvider><Action/></ToastProvider>);
    const action=screen.getByRole('button',{name:'Share'});
    act(()=>action.focus());fireEvent.click(action);
    expect(screen.getAllByText('Copied')).toHaveLength(2);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(document.activeElement).toBe(action);
    const mirror=document.querySelector('[data-toast-mirror] .tof-toast')!;
    fireEvent.mouseEnter(mirror);act(()=>vi.advanceTimersByTime(10000));
    expect(screen.getAllByText('Copied')).toHaveLength(2);
    fireEvent.mouseLeave(mirror);act(()=>vi.advanceTimersByTime(6000));
    expect(screen.queryByText('Copied')).toBeNull();
    fireEvent.click(action);fireEvent.click(document.querySelector('[data-toast-mirror] button')!);
    expect(screen.queryByText('Copied')).toBeNull();
  });
  it('keeps page content separate, announces a notice and allows keyboard dismissal without moving focus',()=>{
    render(<ToastProvider closeLabel="Закрыть уведомление"><main>Page</main><Toast>Captured</Toast></ToastProvider>);
    const toast=screen.getByRole('status');
    expect(toast.closest('aside')?.parentElement).toBe(document.body);
    expect(screen.getByRole('main').contains(toast)).toBe(false);
    expect(document.activeElement).toBe(document.body);
    const close=screen.getByRole('button',{name:'Закрыть уведомление'});
    act(()=>close.focus());fireEvent.keyDown(close,{key:'Escape'});
    expect(screen.queryByText('Captured')).toBeNull();
  });
  it('expires results and pauses while the user reads or focuses the notice',()=>{
    vi.useFakeTimers();render(<ToastProvider><Toast duration={6000}>Imported</Toast></ToastProvider>);
    fireEvent.mouseEnter(screen.getByRole('status').parentElement!);
    act(()=>vi.advanceTimersByTime(10000));expect(screen.getByText('Imported')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByRole('status').parentElement!);
    act(()=>vi.advanceTimersByTime(6000));expect(screen.queryByText('Imported')).toBeNull();
  });
  it('retains operation progress until completion and removes it when its owner leaves',()=>{
    vi.useFakeTimers();
    const {rerender}=render(<ToastProvider><Toast duration={null} eventKey="queued">Queued</Toast></ToastProvider>);
    act(()=>vi.advanceTimersByTime(60000));expect(screen.getByText('Queued')).toBeTruthy();
    rerender(<ToastProvider><Toast duration={null} eventKey="processing">Processing</Toast></ToastProvider>);
    expect(screen.queryByText('Queued')).toBeNull();expect(screen.getByText('Processing')).toBeTruthy();
    rerender(<ToastProvider><Toast duration={null}>{null}</Toast></ToastProvider>);
    expect(screen.queryByText('Processing')).toBeNull();
  });
  it('does not reopen a dismissed capture when unrelated content rerenders',()=>{
    const {rerender}=render(<ToastProvider><Toast eventKey="scan-1">Captured</Toast></ToastProvider>);
    fireEvent.click(screen.getByRole('button',{name:'Dismiss notification'}));
    rerender(<ToastProvider><Toast eventKey="scan-1">Captured</Toast></ToastProvider>);
    expect(screen.queryByText('Captured')).toBeNull();
    rerender(<ToastProvider><Toast eventKey="scan-2">New scan</Toast></ToastProvider>);
    expect(screen.getByText('New scan')).toBeTruthy();
  });
  it('replaces an action notice with the same id and resets its timeout',()=>{
    vi.useFakeTimers();
    function Action(){const {notify}=useToast();return <button onClick={()=>notify('Done',{id:'action'})}>Run</button>;}
    render(<ToastProvider><Action/></ToastProvider>);
    fireEvent.click(screen.getByRole('button',{name:'Run'}));act(()=>vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByRole('button',{name:'Run'}));act(()=>vi.advanceTimersByTime(5000));
    expect(screen.getAllByText('Done')).toHaveLength(1);act(()=>vi.advanceTimersByTime(1000));expect(screen.queryByText('Done')).toBeNull();
  });
});
