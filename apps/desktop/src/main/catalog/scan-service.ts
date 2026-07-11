import type { AmazonRegion } from '@/shared/contracts';

const catalogRegions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'];
export const DAILY_PRICE_CHECK_MS = 24 * 60 * 60 * 1000;
export const OVERDUE_PRICE_CHECK_DELAY_MS = 60 * 1000;

export type CatalogScanState = {
  status: 'idle' | 'running';
  phase?: 'catalog_scan' | null;
  region?: AmazonRegion | null;
  startedAt: string | null;
  completedAt: string | null;
  nextRunAt: string | null;
  processed: number;
  total: number;
  lastError?: string | null;
};

type Dependencies = {
  asinPriceRefresh: {
    run(regions: readonly AmazonRegion[], onProgress?: (event: { processed: number; total: number }) => void): Promise<{ errors?: string[] }>;
  };
  regions?: () => readonly AmazonRegion[];
  initialState?: CatalogScanState;
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearSchedule?: (timer: ReturnType<typeof setTimeout>) => void;
  now?: () => Date;
  onStateChanged?: (state: CatalogScanState) => void;
};

const idleState = (): CatalogScanState => ({
  status: 'idle', phase: null, region: null, startedAt: null, completedAt: null, nextRunAt: null, processed: 0, total: 0, lastError: null,
});

export class CatalogScanService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<CatalogScanState> | null = null;
  private disposed = false;
  private state: CatalogScanState;
  private readonly schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearSchedule: (timer: ReturnType<typeof setTimeout>) => void;
  private readonly now: () => Date;

  constructor(private readonly dependencies: Dependencies) {
    this.state = { ...idleState(), ...(dependencies.initialState ?? {}) };
    this.schedule = dependencies.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.clearSchedule = dependencies.clearSchedule ?? ((timer) => clearTimeout(timer));
    this.now = dependencies.now ?? (() => new Date());
  }

  /** A fresh app waits a day; an overdue daily check is deferred once after startup. */
  start(): void {
    if (this.disposed || this.timer || this.running) return;
    const nowMs = this.now().getTime();
    const completedMs = this.state.completedAt ? new Date(this.state.completedAt).getTime() : Number.NaN;
    const dueMs = Number.isFinite(completedMs) ? completedMs + DAILY_PRICE_CHECK_MS : nowMs + DAILY_PRICE_CHECK_MS;
    const delayMs = dueMs <= nowMs ? OVERDUE_PRICE_CHECK_DELAY_MS : dueMs - nowMs;
    this.scheduleNext(delayMs);
  }

  getState(): CatalogScanState {
    return { ...this.state };
  }

  async runNow(): Promise<CatalogScanState> {
    if (this.running) return this.getState();
    this.clearTimer();
    this.running = this.runPriceRefresh();
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private async runPriceRefresh(): Promise<CatalogScanState> {
    this.setState({ ...this.state, status: 'running', phase: 'catalog_scan', region: null, startedAt: this.now().toISOString(), completedAt: null, nextRunAt: null, processed: 0, total: 0, lastError: null });
    let lastError: string | null = null;
    try {
      const regions = [...(this.dependencies.regions?.() ?? catalogRegions)];
      if (regions.length === 0) {
        lastError = 'No Amazon regions are configured';
      } else {
        const result = await this.dependencies.asinPriceRefresh.run(regions, (event) => {
          this.setState({ ...this.state, processed: event.processed, total: event.total });
        });
        const errors = result.errors ?? [];
        lastError = errors.length > 0 ? errors.join(' · ') : null;
      }
    } catch {
      lastError = 'Catalog price refresh failed';
    }
    const completedAt = this.now().toISOString();
    this.setState({ ...this.state, status: 'idle', completedAt, nextRunAt: new Date(this.now().getTime() + DAILY_PRICE_CHECK_MS).toISOString(), lastError });
    if (!this.disposed) this.scheduleNext(DAILY_PRICE_CHECK_MS);
    return this.getState();
  }

  private scheduleNext(delayMs: number): void {
    this.clearTimer();
    this.setState({ ...this.state, nextRunAt: new Date(this.now().getTime() + delayMs).toISOString() });
    this.timer = this.schedule(() => {
      this.timer = null;
      void this.runNow();
    }, delayMs);
  }

  private clearTimer(): void {
    if (!this.timer) return;
    this.clearSchedule(this.timer);
    this.timer = null;
  }

  private setState(state: CatalogScanState): void {
    this.state = state;
    this.dependencies.onStateChanged?.(this.getState());
  }
}
