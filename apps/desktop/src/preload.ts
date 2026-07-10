// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

import { channels } from './shared/channels';
import type { VetkaDesktopApi } from './shared/contracts';

const api: VetkaDesktopApi = {
  health: () => ipcRenderer.invoke(channels.health),
};

contextBridge.exposeInMainWorld('vetka', api);
