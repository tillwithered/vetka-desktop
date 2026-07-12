import type { Collectible, CollectiblesScanState } from '@/shared/contracts';

import type { MattelCreationsClient } from './client';
import type { CollectiblesRepository } from './repository';

const dayMs = 86_400_000;

export class CollectiblesService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<CollectiblesScanState> | null = null;
  private readonly now: () => Date;
  private readonly schedule: typeof setTimeout;

  constructor(private readonly dependencies: {
    repository: CollectiblesRepository;
    client: Pick<MattelCreationsClient, 'collect'>;
    now?: () => Date;
    schedule?: typeof setTimeout;
    onStateChanged?: (state: CollectiblesScanState) => void;
  }) {
    this.now = dependencies.now ?? (() => new Date());
    this.schedule = dependencies.schedule ?? setTimeout;
  }

  start(): void {
    if (this.timer) return;
    const state = this.getState();
    const due = state.nextRunAt ? new Date(state.nextRunAt).getTime() : this.now().getTime();
    this.timer = this.schedule(() => {
      this.timer = null;
      void this.runNow();
    }, Math.max(0, due - this.now().getTime()));
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  list(filter: { archived?: boolean; query?: string } = {}): Collectible[] {
    return this.dependencies.repository.list(filter);
  }

  getState(): CollectiblesScanState {
    return this.dependencies.repository.getScanState();
  }

  runNow(): Promise<CollectiblesScanState> {
    if (this.running) return this.running;
    this.running = this.execute().finally(() => { this.running = null; });
    return this.running;
  }

  private async execute(): Promise<CollectiblesScanState> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const startedAt = this.now().toISOString();
    this.publish({ status: 'running', startedAt, completedAt: this.getState().completedAt, nextRunAt: null, processed: 0, total: 0, lastError: null });
    try {
      const result = await this.dependencies.client.collect();
      const checkedAt = this.now().toISOString();
      const total = result.products.length + result.errors.length;

      for (const [index, product] of result.products.entries()) {
        this.dependencies.repository.upsert(product);
        this.publish({ ...this.getState(), status: 'running', processed: index + 1, total });
      }
      for (const error of result.errors) this.dependencies.repository.recordFailure(error.url, checkedAt);
      if (result.complete) {
        this.dependencies.repository.finishCompleteScan([...new Set([
          ...result.products.map((product) => product.canonicalUrl),
          ...result.errors.map((error) => error.url),
        ])]);
      }

      const completedAt = this.now().toISOString();
      const state: CollectiblesScanState = {
        status: 'idle',
        startedAt,
        completedAt,
        nextRunAt: new Date(this.now().getTime() + dayMs).toISOString(),
        processed: total,
        total,
        lastError: result.errors.length > 0
          ? `${result.errors.length} product checks failed`
          : result.complete ? null : 'Mattel collection scan incomplete',
      };
      this.publish(state);
      this.start();
      return state;
    } catch (error) {
      const completedAt = this.now().toISOString();
      const state: CollectiblesScanState = {
        status: 'idle',
        startedAt,
        completedAt,
        nextRunAt: new Date(this.now().getTime() + 3_600_000).toISOString(),
        processed: 0,
        total: 0,
        lastError: error instanceof Error ? error.message.slice(0, 200) : 'Mattel collection failed',
      };
      this.publish(state);
      this.start();
      return state;
    }
  }

  private publish(state: CollectiblesScanState): void {
    this.dependencies.repository.setScanState(state);
    this.dependencies.onStateChanged?.(state);
  }
}
