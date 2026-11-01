import {afterEach,describe,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {TestServerBadge} from './test-server-badge';

afterEach(cleanup);
describe('test server badge',()=>{
  const servers=[{distribution:'global-pioneer',firstSeenAt:'2026-10-01T12:00:00Z',lastSeenAt:'2026-10-10T12:00:00Z'},
    {distribution:'korea-dev',firstSeenAt:null,lastSeenAt:null}];
  it('omits absent marks and exposes all client dates through keyboard focus',async()=>{
    const {rerender}=render(<TestServerBadge servers={[]} locale="en"/>);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<TestServerBadge servers={servers} locale="en"/>);
    fireEvent.focus(screen.getByRole('button',{name:'Seen on a test server'}));
    await waitFor(()=>expect(screen.getByRole('tooltip').textContent).toContain('Pioneer'));
    expect(screen.getByRole('tooltip').textContent).toContain('01/10/2026');
    expect(screen.getByRole('tooltip').textContent).toContain('10/10/2026');
    expect(screen.getByRole('tooltip').textContent).toContain('KR DEV');
    expect(screen.getByRole('tooltip').textContent).toContain('Date unknown');
    fireEvent.keyDown(window,{key:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('tooltip')).toBeNull());
  });
  it('opens by touch/click and localizes dates and import fallback in Russian',async()=>{
    render(<TestServerBadge servers={[{...servers[0],lastTimeSource:'import'}]} locale="ru"/>);
    const button=screen.getByRole('button',{name:'Замечен на тестовом сервере'});
    fireEvent.click(button);
    expect(screen.getByRole('tooltip').textContent).toContain('Впервые');
    expect(screen.getByRole('tooltip').textContent).toContain('Последний раз');
    expect(screen.getByRole('tooltip').textContent).toContain('10.10.2026');
    expect(screen.getByRole('tooltip').textContent).toContain('дата импорта');
    fireEvent.blur(button);await waitFor(()=>expect(screen.queryByRole('tooltip')).toBeNull());
  });
});
