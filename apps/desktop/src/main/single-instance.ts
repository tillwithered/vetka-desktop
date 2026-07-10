type SingleInstanceApp = {
  requestSingleInstanceLock(): boolean;
  quit(): void;
  on(event: 'second-instance', listener: () => void): void;
};

/** Ensures Squirrel always updates one primary app process, never stale duplicates. */
export function acquireSingleInstanceLock(app: SingleInstanceApp, focusPrimaryWindow: () => void): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on('second-instance', focusPrimaryWindow);
  return true;
}
