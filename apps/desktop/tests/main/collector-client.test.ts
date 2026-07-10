import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { CollectorClient, type CollectorProcess } from '@/main/collector/client';
import type { CollectorRequestInput } from '@/collector/contracts';

class FakeProcess extends EventEmitter implements CollectorProcess {
  postMessage = vi.fn();
  kill = vi.fn();
}

describe('CollectorClient', () => {
  it('reuses one worker and correlates results by request ID', async () => {
    const worker = new FakeProcess();
    const fork = vi.fn(() => worker);
    const client = new CollectorClient({ fork, workerPath: 'worker.cjs', timeoutMs: 90_000 });
    const request: CollectorRequestInput = { dataDir: 'C:/data', doll: { id: 'd1', name: 'Draculaura' }, knownListings: [], regions: ['amazon_us'] };
    const pending = client.refreshDoll(request);
    const sent = worker.postMessage.mock.calls[0][0];
    worker.emit('message', { type: 'result', requestId: sent.requestId, result: { requestId: sent.requestId, regions: {} } });

    await expect(pending).resolves.toMatchObject({ requestId: sent.requestId });
    expect(fork).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  it('starts a new worker after exit', () => {
    const first = new FakeProcess();
    const second = new FakeProcess();
    const fork = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const client = new CollectorClient({ fork, workerPath: 'worker.cjs' });
    client.start();
    first.emit('exit', 1);
    client.start();
    expect(fork).toHaveBeenCalledTimes(2);
    client.dispose();
  });
});
