import { describe, expect, it } from 'vitest';

import { SerialQueue } from '@/collector/queue';

describe('SerialQueue', () => {
  it('runs jobs strictly in order and continues after a rejection', async () => {
    const queue = new SerialQueue();
    const events: string[] = [];
    const first = queue.enqueue('one', async () => { events.push('one:start'); await Promise.resolve(); events.push('one:end'); });
    const second = queue.enqueue('two', async () => { events.push('two'); throw new Error('boom'); });
    const third = queue.enqueue('three', async () => { events.push('three'); return 3; });

    await first;
    await expect(second).rejects.toThrow('boom');
    await expect(third).resolves.toBe(3);
    expect(events).toEqual(['one:start', 'one:end', 'two', 'three']);
  });

  it('cancels a queued request without cancelling the active request', async () => {
    const queue = new SerialQueue();
    let release!: () => void;
    const active = queue.enqueue('active', () => new Promise<void>((resolve) => { release = resolve; }));
    const queued = queue.enqueue('queued', async () => 'never');

    expect(queue.cancel('queued')).toBe(true);
    release();
    await active;
    await expect(queued).rejects.toMatchObject({ code: 'cancelled' });
  });
});
