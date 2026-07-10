import { describe, expect, it, vi } from 'vitest';

import {
  broadcastUpdateState,
  buildUpdateFeedUrl,
  isSquirrelFirstRun,
} from '@/main/updates/bootstrap';
import { channels } from '@/shared/channels';

describe('update bootstrap', () => {
  it('builds the exact public Windows x64 feed URL', () => {
    expect(buildUpdateFeedUrl({ platform: 'win32', arch: 'x64', version: '1.0.0' })).toBe(
      'https://update.electronjs.org/tillwithered/vetka-desktop/win32-x64/1.0.0',
    );
  });

  it('encodes the version segment and rejects unsupported targets', () => {
    expect(
      buildUpdateFeedUrl({ platform: 'win32', arch: 'x64', version: '1.0.0 beta' })?.endsWith(
        '/1.0.0%20beta',
      ),
    ).toBe(true);
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
