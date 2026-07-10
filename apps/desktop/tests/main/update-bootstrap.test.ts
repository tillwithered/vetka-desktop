import { describe, expect, it, vi } from 'vitest';

import {
  broadcastUpdateState,
  buildUpdateFeedUrl,
  isSquirrelFirstRun,
} from '@/main/updates/bootstrap';
import { channels } from '@/shared/channels';

describe('update bootstrap', () => {
  it('builds a direct GitHub Releases feed for Windows x64', () => {
    expect(buildUpdateFeedUrl({ platform: 'win32', arch: 'x64', version: '1.0.0' })).toBe(
      'https://github.com/tillwithered/vetka-desktop/releases/latest/download',
    );
  });

  it('uses the same latest-release feed for every installed Windows version and rejects unsupported targets', () => {
    expect(buildUpdateFeedUrl({ platform: 'win32', arch: 'x64', version: '1.0.0 beta' })).toBe(
      'https://github.com/tillwithered/vetka-desktop/releases/latest/download',
    );
    expect(buildUpdateFeedUrl({ platform: 'linux', arch: 'x64', version: '1.0.0' })).toBeNull();
    expect(buildUpdateFeedUrl({ platform: 'win32', arch: 'arm64', version: '1.0.0' })).toBeNull();
  });

  it('detects only the Squirrel first-run flag', () => {
    expect(isSquirrelFirstRun(['Vetka Desktop.exe', '--squirrel-firstrun'])).toBe(true);
    expect(isSquirrelFirstRun(['Vetka Desktop.exe', '--squirrel-install'])).toBe(false);
  });

  it('broadcasts typed state to every current window', () => {
    const firstSend = vi.fn();
    const secondSend = vi.fn();
    const state = { status: 'downloaded' as const, version: '1.0.1' };

    broadcastUpdateState(
      [{ webContents: { send: firstSend } }, { webContents: { send: secondSend } }],
      state,
    );

    expect(firstSend).toHaveBeenCalledWith(channels.updatesStateChanged, state);
    expect(secondSend).toHaveBeenCalledWith(channels.updatesStateChanged, state);
  });
});
