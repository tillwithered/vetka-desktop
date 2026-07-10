import type { AmazonRegion } from '@/shared/contracts';

import type { CatalogEntry, CatalogRepository } from './repository';

const regions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es'];
const storeRegions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'];
const intervalMs = 120 * 60 * 1000;

export type CatalogScanState = {
  status: 'idle' | 'running';
  startedAt: string | null;
  completedAt: string | null;
  nextRunAt: string | null;
  processed: number;
  total: number;
  lastError?: string | null;
};

type Dependencies = {
  catalog: Pick<CatalogRepository, 'listActive'>;
  priceService: { refreshCatalogEntry(entry: CatalogEntry, regions: AmazonRegion[]): Promise<unknown> };
  officialStoreImport?: { run(regions: readonly AmazonRegion[]): Promise<unknown> };
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearSchedule?: (timer: ReturnType<typeof setTimeout>) => void;
  now?: () => Date;
  onStateChanged?: (state: CatalogScanState) => void;
};

export class CatalogScanService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<CatalogScanState> | null = null;
  private disposed = false;
  private state: CatalogScanState = { status: 'idle', startedAt: null, completedAt: null, nextRunAt: null, processed: 0, total: 0, lastError: null };
  private readonly schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearSchedule: (timer: ReturnType<typeof setTimeout>) => void;
  private readonly now: () => Date;

  constructor(private readonly dependencies: Dependencies) {
    this.schedule = dependencies.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.clearSchedule = dependencies.clearSchedule ?? ((timer) => clearTimeout(timer));
    this.now = dependencies.now ?? (() => new Date());
  }

  start(): void {
    void this.runNow();
  }

  getState(): CatalogScanState {
    return { ...this.state };
  }

  async runNow(options: { includeOfficialStore?: boolean } = {}): Promise<CatalogScanState> {
    if (this.running) return this.getState();
    if (this.timer) {
      this.clearSchedule(this.timer);
      this.timer = null;
    }
    this.running = this.run(options.includeOfficialStore === true);
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) this.clearSchedule(this.timer);
    this.timer = null;
  }

  private async run(includeOfficialStore: boolean): Promise<CatalogScanState> {
    if (includeOfficialStore) await this.dependencies.officialStoreImport?.run(storeRegions);
    const entries = this.dependencies.catalog.listActive();
    this.setState({ status: 'running', startedAt: this.now().toISOString(), completedAt: null, nextRunAt: null, processed: 0, total: entries.length, lastError: null });
    for (const entry of entries) {
      try {
        await this.dependencies.priceService.refreshCatalogEntry(entry, regions);
      } catch (error) {
        const message = error instanceof Error ? error.message.replace(/\s+/g, ' ').trim() : 'Не удалось проверить Amazon';
        this.setState({ ...this.state, lastError: message.slice(0, 240) || 'Не удалось проверить Amazon' });
      }
      this.setState({ ...this.state, processed: this.state.processed + 1 });
    }
    const completedAt = this.now().toISOString();
    const nextRunAt = new Date(this.now().getTime() + intervalMs).toISOString();
    this.setState({ ...this.state, status: 'idle', completedAt, nextRunAt });
    if (!this.disposed) this.timer = this.schedule(() => { void this.runNow(); }, intervalMs);
    return this.getState();
  }

  private setState(state: CatalogScanState): void {
    this.state = state;
    this.dependencies.onStateChanged?.(this.getState());
  }
}
