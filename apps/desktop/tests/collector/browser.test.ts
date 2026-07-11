import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { BrowserCollectorDriver, canReuseBrowserContext, findBrowserExecutable, isOfficialStoreUrl, isTransientAmazonResponse, profileForProxyRoute, playwrightProxyOptions, shouldBlockAmazonResource, shouldOpenCaptchaWindow, shouldRetryNavigationError, shouldStabilizeSearchPage } from '@/collector/browser';

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

describe('isTransientAmazonResponse', () => {
  it('recognizes Amazon temporary responses that must not become no-price results', () => {
    expect(isTransientAmazonResponse(202)).toBe(true);
    expect(isTransientAmazonResponse(429)).toBe(true);
    expect(isTransientAmazonResponse(503)).toBe(true);
    expect(isTransientAmazonResponse(200)).toBe(false);
  });
});

describe('isOfficialStoreUrl', () => {
  it('recognizes a Monster High Amazon Store page that needs lazy sections loaded', () => expect(isOfficialStoreUrl('https://www.amazon.co.uk/stores/MonsterHigh/page/F08243CA-36AF-405B-B3CF-BF5EA9644BBE')).toBe(true));
  it('does not scroll individual product pages', () => expect(isOfficialStoreUrl('https://www.amazon.co.uk/dp/B0FK1V67X5')).toBe(false));
});

describe('shouldOpenCaptchaWindow', () => {
  it('never opens an interactive browser window for an official Store request', () => expect(shouldOpenCaptchaWindow('store')).toBe(false));
  it('keeps the interactive CAPTCHA path for an explicit individual product request', () => expect(shouldOpenCaptchaWindow('product')).toBe(true));
});

describe('shouldBlockAmazonResource', () => {
  it('keeps Store HTML and scripts while skipping non-essential bytes', () => {
    expect(shouldBlockAmazonResource('document')).toBe(false);
    expect(shouldBlockAmazonResource('script')).toBe(false);
    expect(shouldBlockAmazonResource('image')).toBe(true);
    expect(shouldBlockAmazonResource('font')).toBe(true);
    expect(shouldBlockAmazonResource('media')).toBe(true);
  });
});

describe('proxy browser isolation', () => {
  const route = { server: 'http://uk.example:10000', username: 'violet', password: 'very-secret', label: 'uk.example:10000' };

  it('passes proxy credentials only to Playwright launch options', () => {
    expect(playwrightProxyOptions(route)).toEqual({ server: 'http://uk.example:10000', username: 'violet', password: 'very-secret' });
    expect(playwrightProxyOptions(null)).toBeUndefined();
  });

  it('uses a proxy-specific profile name without leaking credentials', () => {
    const profile = profileForProxyRoute('amazon_uk', route);
    expect(profile).toMatch(/^amazon_uk[\\/]route-[a-f0-9]{12}$/);
    expect(profile).not.toContain('violet');
    expect(profile).not.toContain('very-secret');
  });

  it('keeps the active route until the collector explicitly advances it', async () => {
    const driver = new BrowserCollectorDriver('C:/data', 'C:/fake-browser.exe');
    await driver.configureTransport({
      mode: 'proxy', routes: { amazon_uk: [
        route,
        { server: 'http://uk-two.example:10000', label: 'uk-two.example:10000' },
      ] },
    });

    expect(driver.currentProxyRoute('amazon_uk')?.label).toBe('uk.example:10000');
    expect(await driver.advanceProxyRoute('amazon_uk')).toBe(true);
    expect(driver.currentProxyRoute('amazon_uk')?.label).toBe('uk-two.example:10000');
    expect(await driver.advanceProxyRoute('amazon_uk')).toBe(false);
  });
});
