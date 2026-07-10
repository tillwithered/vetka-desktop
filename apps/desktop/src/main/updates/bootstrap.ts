import { channels } from '@/shared/channels';
import type { UpdateState } from '@/shared/contracts';

const UPDATE_ORIGIN = 'https://github.com';
const UPDATE_REPOSITORY = 'tillwithered/vetka-desktop';

type FeedTarget = {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
};

type UpdateWindow = {
  webContents: {
    send(channel: string, state: UpdateState): unknown;
  };
};

export function buildUpdateFeedUrl(target: FeedTarget): string | null {
  if (target.platform !== 'win32' || target.arch !== 'x64') return null;
  return `${UPDATE_ORIGIN}/${UPDATE_REPOSITORY}/releases/latest/download`;
}

export function isSquirrelFirstRun(argv: readonly string[]): boolean {
  return argv.includes('--squirrel-firstrun');
}

export function broadcastUpdateState(windows: readonly UpdateWindow[], state: UpdateState): void {
  for (const window of windows) {
    window.webContents.send(channels.updatesStateChanged, state);
  }
}
