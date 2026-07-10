import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { canReuseBrowserContext, findBrowserExecutable, shouldRetryNavigationError, shouldStabilizeSearchPage } from '@/collector/browser';

const temporaryDirectories: string[] = [];
function temporaryResources() {
  const directory = path.join(os.tmpdir(), `vetka-browser-${Date.now()}-${Math.random()}`);
  mkdirSync(directory, { recursive: true });
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(() => temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe('bundled Chromium runtime', () => {
  it('uses the executable declared in the packaged manifest', () => {
    const resources = temporaryResources();
    const executable = path.join(resources, 'playwright-chromium', 'chrome-win', 'chrome.exe');
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, 'binary');
    writeFileSync(path.join(resources, 'playwright-chromium.json'), JSON.stringify({ executable: 'chrome-win/chrome.exe' }));
    expect(findBrowserExecutable({}, resources)).toBe(executable);
  });

  it('never falls back to system Chrome when packaged manifest is absent', () => {
    const resources = temporaryResources();
    writeFileSync(path.join(resources, 'app.asar'), 'asar');
    const fakeChromeRoot = temporaryResources();
    const chrome = path.join(fakeChromeRoot, 'Google', 'Chrome', 'Application', 'chrome.exe');
    mkdirSync(path.dirname(chrome), { recursive: true });
    writeFileSync(chrome, 'binary');
    expect(existsSync(chrome)).toBe(true);
    expect(findBrowserExecutable({ PROGRAMFILES: fakeChromeRoot }, resources)).toBeNull();
  });
});

describe('browser contexts', () => {
  it('does not reuse a browser context after its browser was closed', () => expect(canReuseBrowserContext({ isClosed: () => true })).toBe(false));
  it('reuses a live browser context', () => expect(canReuseBrowserContext({ isClosed: () => false })).toBe(true));
});

describe('shouldRetryNavigationError', () => {
  it('retries a transient detached-frame navigation once', () => expect(shouldRetryNavigationError(new Error('page.goto: net::ERR_ABORTED; maybe frame was detached?'))).toBe(true));
  it('does not retry an unrelated browser error', () => expect(shouldRetryNavigationError(new Error('page.goto: net::ERR_NAME_NOT_RESOLVED'))).toBe(false));
});

describe('shouldStabilizeSearchPage', () => {
  it('waits for Amazon search cards to replace their initial placeholders', () => expect(shouldStabilizeSearchPage('https://www.amazon.com/s?k=Monster+High+HGC29')).toBe(true));
  it('does not delay a product page after DOM content is ready', () => expect(shouldStabilizeSearchPage('https://www.amazon.com/dp/B0CXYZ1234')).toBe(false));
});
