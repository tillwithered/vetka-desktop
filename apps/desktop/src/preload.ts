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
  amazon: {
    addListing: (dollId, url) => ipcRenderer.invoke(channels.amazonAddListing, { dollId, url }),
    refreshDoll: (dollId, regions) => ipcRenderer.invoke(channels.amazonRefreshDoll, { dollId, regions }),
    reviewCandidate: (listingId, decision) => ipcRenderer.invoke(channels.amazonReviewCandidate, { listingId, decision }),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, data: Parameters<typeof listener>[0]) => listener(data);
      ipcRenderer.on(channels.collectorProgress, handler);
      return () => ipcRenderer.removeListener(channels.collectorProgress, handler);
    },
  },
  prices: {
    current: (dollId) => ipcRenderer.invoke(channels.pricesCurrent, dollId),
    history: (dollId, range = '30d') => ipcRenderer.invoke(channels.pricesHistory, { dollId, range }),
  },
  orders: {
    list: (filter = {}) => ipcRenderer.invoke(channels.ordersList, filter),
    get: (id) => ipcRenderer.invoke(channels.ordersGet, id),
    create: (input) => ipcRenderer.invoke(channels.ordersCreate, input),
    transition: (id, status, comment = null) => ipcRenderer.invoke(channels.ordersTransition, { id, status, comment }),
    updateTracking: (id, trackingNumber) => ipcRenderer.invoke(channels.ordersTracking, { id, trackingNumber }),
  },
};

contextBridge.exposeInMainWorld('vetka', api);
