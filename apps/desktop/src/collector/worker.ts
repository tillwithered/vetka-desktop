import { collectDoll } from './amazon/collect';
import { collectOfficialStore } from './amazon/store-collect';
import { BrowserCollectorDriver } from './browser';
import type { CollectorControlMessage, CollectorRequest, CollectorResponse } from './contracts';
import { SerialQueue } from './queue';

const queue = new SerialQueue();
const drivers = new Map<string, BrowserCollectorDriver>();
const resumeWaiters = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
const parentPort = process.parentPort;

if (!parentPort) throw new Error('Collector worker requires Electron utility-process parentPort');

const send = (message: CollectorResponse) => parentPort.postMessage(message);
const keyFor = (requestId: string, region: string) => `${requestId}:${region}`;

function waitForResume(requestId: string, region: string): Promise<void> {
  return new Promise((resolve, reject) => resumeWaiters.set(keyFor(requestId, region), { resolve, reject }));
}

async function run(request: CollectorRequest) {
  const driver = drivers.get(request.dataDir) ?? new BrowserCollectorDriver(request.dataDir);
  drivers.set(request.dataDir, driver);
  await driver.configureTransport(request.transport);
  const progress = (stage: Parameters<typeof send>[0] extends never ? never : 'queued' | 'searching' | 'checking' | 'captcha_required' | 'completed' | 'failed', region?: typeof request.regions[number]) =>
    send({ type: 'progress', requestId: request.requestId, stage, region });

  let result = await collectDoll(request, driver, progress);
  const challenge = request.regions.find((region) => result.regions[region]?.status === 'captcha_required');
  if (challenge) {
    await waitForResume(request.requestId, challenge);
    await driver.closeChallenge(challenge);
    result = await collectDoll(request, driver, progress);
  }
  return result;
}

async function runOfficialStore(request: Extract<CollectorControlMessage, { type: 'import-official-store' }>) {
  const driver = drivers.get(request.dataDir) ?? new BrowserCollectorDriver(request.dataDir);
  drivers.set(request.dataDir, driver);
  await driver.configureTransport(request.transport);
  return collectOfficialStore({
    requestId: request.requestId,
    regions: request.regions,
    driver,
    onProgress: (event) => send({ type: 'progress', requestId: request.requestId, ...event }),
  });
}

parentPort.on('message', (event) => {
  const message = event.data as CollectorControlMessage;
  if (message.type === 'refresh-doll') {
    send({ type: 'progress', requestId: message.requestId, stage: 'queued' });
    void queue.enqueue(message.requestId, () => run(message)).then(
      (result) => send({ type: 'result', requestId: message.requestId, result }),
      (error: unknown) => send({
        type: 'error',
        requestId: message.requestId,
        code: error instanceof Error && 'code' in error ? String(error.code) : 'collector_failed',
        message: error instanceof Error ? error.message : 'Не удалось проверить Amazon',
      }),
    );
    return;
  }
  if (message.type === 'import-official-store') {
    send({ type: 'progress', requestId: message.requestId, stage: 'queued' });
    void queue.enqueue(message.requestId, () => runOfficialStore(message)).then(
      (result) => send({ type: 'official-store-result', requestId: message.requestId, result }),
      (error: unknown) => send({ type: 'error', requestId: message.requestId, code: 'collector_failed', message: error instanceof Error ? error.message : 'Store import failed' }),
    );
    return;
  }
  if (message.type === 'cancel-request') {
    queue.cancel(message.requestId);
    for (const [key, waiter] of resumeWaiters) {
      if (key.startsWith(`${message.requestId}:`)) {
        waiter.reject(new Error('Request cancelled'));
        resumeWaiters.delete(key);
      }
    }
    return;
  }
  const key = keyFor(message.requestId, message.region);
  resumeWaiters.get(key)?.resolve();
  resumeWaiters.delete(key);
});

process.on('exit', () => {
  for (const driver of drivers.values()) void driver.close();
});
