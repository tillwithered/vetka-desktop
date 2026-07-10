export type VetkaDesktopApi = {
  health(): Promise<{ ok: true; version: string }>;
};

declare global {
  interface Window {
    vetka: VetkaDesktopApi;
  }
}
