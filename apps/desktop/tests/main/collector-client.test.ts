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

  it('sends an official Store import through the collector worker', async () => {
    const worker = new FakeProcess();
    const client = new CollectorClient({ fork: () => worker, workerPath: 'worker.cjs' });
    const progress = vi.fn();
    const pending = client.importOfficialStore({ dataDir: 'C:/data', regions: ['amazon_uk'] }, progress);
    const sent = worker.postMessage.mock.calls[0][0];
    worker.emit('message', { type: 'progress', requestId: sent.requestId, stage: 'checking', region: 'amazon_uk', processed: 3, total: 10 });
    worker.emit('message', { type: 'official-store-result', requestId: sent.requestId, result: { requestId: sent.requestId, products: [], regions: { amazon_uk: { status: 'completed', total: 0 } } } });

    await expect(pending).resolves.toMatchObject({ requestId: sent.requestId });
    expect(sent).toMatchObject({ type: 'import-official-store', regions: ['amazon_uk'] });
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'checking', processed: 3, total: 10 }));
    client.dispose();
  });

  it('passes the private proxy transport to the worker without exposing it to callers', async () => {
    const worker = new FakeProcess();
    const getTransport = vi.fn(() => ({
      mode: 'proxy' as const,
      routes: { amazon_uk: [{ server: 'http://uk.example:10000', username: 'violet', password: 'very-secret', label: 'uk.example:10000' }] },
    }));
    const client = new CollectorClient({ fork: () => worker, workerPath: 'worker.cjs', getTransport });
    const pending = client.importOfficialStore({ dataDir: 'C:/data', regions: ['amazon_uk'] });
    const sent = worker.postMessage.mock.calls[0][0];
    worker.emit('message', { type: 'official-store-result', requestId: sent.requestId, result: { requestId: sent.requestId, products: [], regions: {} } });

    await expect(pending).resolves.toMatchObject({ requestId: sent.requestId });
    expect(getTransport).toHaveBeenCalledOnce();
    expect(sent).toMatchObject({ transport: { mode: 'proxy', routes: { amazon_uk: [expect.objectContaining({ server: 'http://uk.example:10000' })] } } });
  });
});
