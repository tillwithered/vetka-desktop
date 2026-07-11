import type { AmazonRegion } from '@/shared/contracts';

const storeRegions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'];
const intervalMs = 120 * 60 * 1000;

export type CatalogScanState = {
  status: 'idle' | 'running';
  phase?: 'official_store' | 'catalog_scan' | null;
  region?: AmazonRegion | null;
  startedAt: string | null;
  completedAt: string | null;
  nextRunAt: string | null;
  processed: number;
  total: number;
  lastError?: string | null;
};

type Dependencies = {
  officialStoreImport: { run(regions: readonly AmazonRegion[], onProgress?: (event: { region: AmazonRegion; processed: number; total: number }) => void): Promise<{ errors?: string[] }> };
  regions?: () => readonly AmazonRegion[];
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearSchedule?: (timer: ReturnType<typeof setTimeout>) => void;
  now?: () => Date;
  onStateChanged?: (state: CatalogScanState) => void;
};

export class CatalogScanService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<CatalogScanState> | null = null;
  private disposed = false;
  private state: CatalogScanState = { status: 'idle', phase: null, region: null, startedAt: null, completedAt: null, nextRunAt: null, processed: 0, total: 0, lastError: null };
  private readonly schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearSchedule: (timer: ReturnType<typeof setTimeout>) => void;
  private readonly now: () => Date;

  constructor(private readonly dependencies: Dependencies) {
    this.schedule = dependencies.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.clearSchedule = dependencies.clearSchedule ?? ((timer) => clearTimeout(timer));
    this.now = dependencies.now ?? (() => new Date());
  }

  /** Store polling starts only after the operator has requested a manual refresh. */
  start(): void {}

  getState(): CatalogScanState {
    return { ...this.state };
  }

  async runNow(): Promise<CatalogScanState> {
    if (this.running) return this.getState();
    if (this.timer) {
      this.clearSchedule(this.timer);
      this.timer = null;
    }
    this.running = this.runStoreImport();
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

  private async runStoreImport(): Promise<CatalogScanState> {
    this.setState({ status: 'running', phase: 'official_store', region: null, startedAt: this.now().toISOString(), completedAt: null, nextRunAt: null, processed: 0, total: 0, lastError: null });
    let lastError: string | null = null;
    try {
      const regions = [...(this.dependencies.regions?.() ?? storeRegions)];
      if (regions.length === 0) {
        lastError = 'No Amazon proxy regions are configured';
      } else {
        const result = await this.dependencies.officialStoreImport.run(regions, (event) => {
          this.setState({ ...this.state, region: event.region, processed: event.processed, total: event.total });
        });
        lastError = result.errors?.join(' · ') ?? null;
      }
    } catch {
      lastError = 'Official Store import failed';
    }
    const completedAt = this.now().toISOString();
    const nextRunAt = new Date(this.now().getTime() + intervalMs).toISOString();
    this.setState({ ...this.state, status: 'idle', phase: 'official_store', completedAt, nextRunAt, lastError });
    if (!this.disposed) this.timer = this.schedule(() => { void this.runNow(); }, intervalMs);
    return this.getState();
  }

  private setState(state: CatalogScanState): void {
    this.state = state;
    this.dependencies.onStateChanged?.(this.getState());
  }
}
