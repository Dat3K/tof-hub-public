import {describe,it,expect} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {ToastProvider} from '@tof-hub/ui';
import {CaptureOriginNotice,captureOriginLabel,restrictedCaptureOrigin} from './capture-origin';
import {scanFixture} from '../../../../../packages/contracts/src/__fixtures__/scan-session';
import type {BuildDraft} from './types';
describe('capture origin presentation',()=>{
  it('allows unfinished gear into Ranking without claiming card verification',()=>{
    const draft={captureSource:{capture:{capture:{scan:{...scanFixture('live'),status:'capturing',finishedAt:null}}}}} as BuildDraft;
    expect(restrictedCaptureOrigin(draft)).toBe('incomplete-capture');
    for(const locale of ['en','ru'] as const) {
      render(<ToastProvider><CaptureOriginNotice draft={draft} locale={locale}/></ToastProvider>);
      expect(screen.getByRole('status').textContent).toContain(locale==='en'?'Gear is included in Ranking':'Гир учтён в рейтинге');
      expect(screen.getByRole('status').textContent).toContain(locale==='en'?'Incomplete capture':'Незавершённый скан');
      cleanup();
    }
  });
  it.each(['test','unknown'] as const)('hides %s scan dates in EN and RU, with unresolved labels only at export',environment=>{
    const draft={captureSource:{capture:{capture:{scan:scanFixture(environment)}}}} as BuildDraft;
    for(const locale of ['en','ru'] as const) {
      render(<ToastProvider><CaptureOriginNotice draft={draft} locale={locale}/></ToastProvider>);
      if(environment==='test')expect(screen.getByRole('status').textContent).toContain(locale==='en'?'Test server · DEV':'Тестовый сервер · DEV');
      else {
        expect(screen.getByRole('status').textContent).not.toContain(locale==='en'?'Unresolved capture':'Среда скана не подтверждена');
        expect(captureOriginLabel('unknown-server',locale)).toBe(locale==='en'?'Unresolved capture':'Среда скана не подтверждена');
      }
      expect(document.querySelectorAll('.tof-toast time')).toHaveLength(0);
      expect(screen.getByRole('status').textContent).not.toContain(scanFixture().startedAt);
      cleanup();
    }
    expect(restrictedCaptureOrigin(draft)).toBe(environment==='test'?'test-server':'unknown-server');
  });
});
