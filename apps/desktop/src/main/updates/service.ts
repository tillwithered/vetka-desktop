import type { UpdateState } from '@/shared/contracts';

export type UpdateEvent =
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'update-downloaded'
  | 'error';

type UpdateMetadata = { version?: string | null };

export type UpdaterAdapter = {
  on(event: UpdateEvent, listener: (metadata?: UpdateMetadata) => void): void;
  setFeedURL(options: { url: string }): void;
  checkForUpdates(): Promise<unknown> | void;
  quitAndInstall(): void;
};

type Schedule = (callback: () => void, delayMs: number) => unknown;

type UpdateServiceOptions = {
  updater: UpdaterAdapter;
  feedUrl: string;
  packaged: boolean;
  firstRun: boolean;
  schedule: Schedule;
  onStateChanged: (state: UpdateState) => void;
};

const SAFE_UPDATE_ERROR = 'Не удалось проверить обновления. Приложение продолжит работать.';

export class UpdateNotReadyError extends Error {
  constructor() {
    super('Update is not downloaded');
    this.name = 'UpdateNotReadyError';
  }
}

export class UpdateService {
  private state: UpdateState = { status: 'idle' };
  private started = false;

  constructor(private readonly options: UpdateServiceOptions) {}

  start(): void {
    if (!this.options.packaged || this.started) return;
    this.started = true;

    this.bindEvents();
    this.options.updater.setFeedURL({ url: this.options.feedUrl });
    this.options.schedule(
      () => {
        void this.check();
      },
      this.options.firstRun ? 10_000 : 1_000,
    );
  }

  getState(): UpdateState {
    return this.state;
  }

  async check(): Promise<UpdateState> {
    if (!this.options.packaged) return this.state;
    if (this.state.status === 'checking' || this.state.status === 'available') return this.state;

    this.setState({ status: 'checking' });
    try {
      await this.options.updater.checkForUpdates();
    } catch {
      this.setState({ status: 'error', message: SAFE_UPDATE_ERROR });
    }
    return this.state;
  }

  restartAndInstall(): void {
    if (this.state.status !== 'downloaded') throw new UpdateNotReadyError();
    this.options.updater.quitAndInstall();
  }

  private bindEvents(): void {
    this.options.updater.on('checking-for-update', () => this.setState({ status: 'checking' }));
    this.options.updater.on('update-available', (metadata) => {
      this.setState({ status: 'available', version: metadata?.version ?? null });
    });
    this.options.updater.on('update-not-available', () => this.setState({ status: 'idle' }));
    this.options.updater.on('update-downloaded', (metadata) => {
      this.setState({ status: 'downloaded', version: metadata?.version ?? null });
    });
    this.options.updater.on('error', () => {
      this.setState({ status: 'error', message: SAFE_UPDATE_ERROR });
    });
  }

  private setState(state: UpdateState): void {
    this.state = state;
    this.options.onStateChanged(state);
  }
}
