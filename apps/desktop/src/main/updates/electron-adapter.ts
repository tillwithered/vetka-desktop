import { autoUpdater } from 'electron';

import type { UpdateEvent, UpdaterAdapter } from '@/main/updates/service';

function releaseVersion(releaseName: string): string | null {
  return releaseName.match(/v?(\d+\.\d+\.\d+)/)?.[1] ?? null;
}

export class ElectronUpdaterAdapter implements UpdaterAdapter {
  on(event: UpdateEvent, listener: (metadata?: { version?: string | null }) => void): void {
    switch (event) {
      case 'checking-for-update':
        autoUpdater.on(event, () => listener());
        break;
      case 'update-available':
        autoUpdater.on(event, () => listener());
        break;
      case 'update-not-available':
        autoUpdater.on(event, () => listener());
        break;
      case 'update-downloaded':
        autoUpdater.on(event, (_event, _releaseNotes, releaseName) => {
          listener({ version: releaseVersion(releaseName) });
        });
        break;
      case 'error':
        autoUpdater.on(event, () => listener());
        break;
    }
  }

  setFeedURL(options: { url: string }): void {
    autoUpdater.setFeedURL(options);
  }

  checkForUpdates(): void {
    autoUpdater.checkForUpdates();
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }
}
