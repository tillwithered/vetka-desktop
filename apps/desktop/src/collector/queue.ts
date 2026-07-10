type QueueJob<T> = {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  cancelled: boolean;
};

export class QueueCancellationError extends Error {
  readonly code = 'cancelled';
  constructor() {
    super('Request cancelled');
  }
}

export class SerialQueue {
  private jobs: QueueJob<unknown>[] = [];
  private running = false;

  enqueue<T>(id: string, task: () => Promise<T>): Promise<T> {
    const promise = new Promise<T>((resolve, reject) => {
      this.jobs.push({ id, task, resolve: resolve as (value: unknown) => void, reject, cancelled: false });
    });
    void this.drain();
    return promise;
  }

  cancel(id: string): boolean {
    const job = this.jobs.find((candidate) => candidate.id === id);
    if (!job) return false;
    job.cancelled = true;
    return true;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift();
        if (!job) continue;
        if (job.cancelled) {
          job.reject(new QueueCancellationError());
          continue;
        }
        try {
          job.resolve(await job.task());
        } catch (error) {
          job.reject(error);
        }
      }
    } finally {
      this.running = false;
      if (this.jobs.length > 0) void this.drain();
    }
  }
}
