// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

import { channels } from './shared/channels';
import type { VetkaDesktopApi } from './shared/contracts';

const api: VetkaDesktopApi = {
  health: () => ipcRenderer.invoke(channels.health),
  dolls: {
    list: (filter = {}) => ipcRenderer.invoke(channels.dollsList, filter),
    get: (id) => ipcRenderer.invoke(channels.dollsGet, id),
    create: (input) => ipcRenderer.invoke(channels.dollsCreate, input),
    update: (id, input) => ipcRenderer.invoke(channels.dollsUpdate, { id, input }),
    setFavorite: (id, favorite) => ipcRenderer.invoke(channels.dollsFavorite, { id, favorite }),
  },
  settings: {
    getAll: () => ipcRenderer.invoke(channels.settingsGetAll),
    set: (key, value) => ipcRenderer.invoke(channels.settingsSet, { key, value }),
  },
};

contextBridge.exposeInMainWorld('vetka', api);
