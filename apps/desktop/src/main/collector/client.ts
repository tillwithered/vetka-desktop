import { randomUUID } from 'node:crypto';
import { utilityProcess } from 'electron';

import type {
  CollectorDollResult,
  CollectorOfficialStoreRequest,
  CollectorOfficialStoreResult,
  CollectorRequest,
  CollectorRequestInput,
  CollectorResponse,
  CollectorStage,
} from '@/collector/contracts';

export type CollectorProcess = {
  postMessage(message: unknown): void;
  kill(): unknown;
  on(event: 'message', listener: (message: CollectorResponse) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
};

type PendingRequest = {
  resolve: (result: CollectorDollResult | CollectorOfficialStoreResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  onProgress?: (event: CollectorProgressEvent) => void;
};

export type CollectorProgressEvent = {
  requestId: string;
  stage: CollectorStage;
  region?: string;
  processed?: number;
  total?: number;
};

type CollectorClientOptions = {
  fork?: (workerPath: string) => CollectorProcess;
  workerPath: string;
  timeoutMs?: number;
};

export class CollectorClient {
  private worker: CollectorProcess | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly progressListeners = new Set<(event: CollectorProgressEvent) => void>();
  private readonly fork: (workerPath: string) => CollectorProcess;
  private readonly timeoutMs: number;

  constructor(private readonly options: CollectorClientOptions) {
    this.fork = options.fork ?? ((workerPath) => utilityProcess.fork(workerPath) as CollectorProcess);
    this.timeoutMs = options.timeoutMs ?? 90_000;
  }

  start(): CollectorProcess {
    if (this.worker) return this.worker;
    const worker = this.fork(this.options.workerPath);
    worker.on('message', (message) => this.handleMessage(message));
    worker.on('exit', () => this.handleExit());
    this.worker = worker;
    return worker;
  }

  refreshDoll(input: CollectorRequestInput): Promise<CollectorDollResult> {
    const request: CollectorRequest = {
      ...input,
      regions: [...input.regions],
      type: 'refresh-doll',
      requestId: randomUUID(),
    };
    const worker = this.start();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request.requestId);
        reject(new Error('Collector request timed out'));
      }, this.timeoutMs);
      this.pending.set(request.requestId, { resolve: (result) => resolve(result as CollectorDollResult), reject, timeout });
      worker.postMessage(request);
    });
  }

  importOfficialStore(
    input: Omit<CollectorOfficialStoreRequest, 'type' | 'requestId'>,
    onProgress?: (event: CollectorProgressEvent) => void,
  ): Promise<CollectorOfficialStoreResult> {
    const request: CollectorOfficialStoreRequest = { ...input, regions: [...input.regions], type: 'import-official-store', requestId: randomUUID() };
    const worker = this.start();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(request.requestId); reject(new Error('Collector request timed out')); }, this.timeoutMs * 4);
      this.pending.set(request.requestId, { resolve: (result) => resolve(result as CollectorOfficialStoreResult), reject, timeout, onProgress });
      worker.postMessage(request);
    });
  }

  resume(requestId: string, region: string): void {
    this.start().postMessage({ type: 'resume-region', requestId, region });
  }

  cancel(requestId: string): void {
    this.start().postMessage({ type: 'cancel-request', requestId });
  }

  onProgress(listener: (event: CollectorProgressEvent) => void) {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  dispose(): void {
    this.worker?.kill();
    this.worker = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Collector stopped'));
    }
    this.pending.clear();
  }

  private handleMessage(message: CollectorResponse): void {
    if (message.type === 'progress') {
      for (const listener of this.progressListeners) listener(message);
      this.pending.get(message.requestId)?.onProgress?.(message);
      return;
    }
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(message.requestId);
    if (message.type === 'result' || message.type === 'official-store-result') pending.resolve(message.result);
    else pending.reject(new Error(`${message.code}: ${message.message}`));
  }

  private handleExit(): void {
    this.worker = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Collector worker exited'));
    }
    this.pending.clear();
  }
}
