import {describe,expect,it} from 'vitest';
import {QueueError,queueMessage} from './client';
describe('Tools security notices',()=>{
  it('distinguishes warnings, temporary bans, rate limits and active queue jobs in EN/RU',()=>{
    expect(queueMessage(new QueueError('blocked',429,{code:'IP_BLOCKED',retryAfter:3600}),true,'')).toContain('60 мин');
    expect(queueMessage(new QueueError('duplicate',429,{code:'DUPLICATE_UPLOAD'}),false,'')).toContain('already submitted twice');
    expect(queueMessage(new QueueError('limited',429,{code:'RATE_LIMIT'}),true,'')).toContain('много запросов');
    expect(queueMessage(new QueueError('bad',400,{code:'INVALID_UPLOAD',remainingAttempts:3}),true,'')).toContain('3');
    expect(queueMessage(new QueueError('access',403,{code:'WISH_ACCESS_REQUIRED'}),false,'')).toContain('device token');
    expect(queueMessage(new QueueError('One operation at a time',429),true,'')).toContain('действие в очереди');
    expect(queueMessage(new QueueError('HTTP 429',429),true,'')).toContain('много запросов');
  });
});
