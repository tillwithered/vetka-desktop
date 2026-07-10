import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright-core';

import type { AmazonRegion } from '@/shared/contracts';
import type { CollectorDriver } from './amazon/collect';
import { amazonRegions } from './amazon/regions';

export class BrowserNotFoundError extends Error {
  readonly code = 'browser_not_found';
  constructor() {
    super('Не найден встроенный Chromium. Переустановите Vetka Desktop.');
  }
}

export function findBrowserExecutable(
  environment: NodeJS.ProcessEnv = process.env,
  resourcesPath: string | undefined = process.resourcesPath,
): string | null {
  const runtimeManifest = path.join(resourcesPath ?? '', 'playwright-chromium.json');
  if (existsSync(runtimeManifest)) {
    const { executable } = JSON.parse(readFileSync(runtimeManifest, 'utf8')) as { executable: string };
    const bundled = path.join(resourcesPath!, 'playwright-chromium', executable);
    if (existsSync(bundled)) return bundled;
  }
  // A packaged app is intentionally independent of Chrome/Edge installed by the user.
  if (existsSync(path.join(resourcesPath ?? '', 'app.asar'))) return null;
  const candidates = [
    [environment.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'],
    [environment['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'],
    [environment.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'],
    [environment.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'],
  ] as const;
  for (const [base, relative] of candidates) {
    if (!base) continue;
    const candidate = path.join(base, relative);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function canReuseBrowserContext(context: Pick<BrowserContext, 'isClosed'>): boolean {
  return !context.isClosed();
}

export function shouldRetryNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ERR_ABORTED|frame was detached|Target page, context or browser has been closed/i.test(message);
}

export function isTransientAmazonResponse(status: number | null | undefined): boolean {
  return status === 202 || status === 429 || (status !== undefined && status >= 500);
}

export function shouldStabilizeSearchPage(url: string): boolean {
  try {
    return new URL(url).pathname === '/s';
  } catch {
    return false;
  }
}

function loadPlaywright(): typeof import('playwright-core') {
  const packagedManifest = path.join(process.resourcesPath ?? '', 'playwright-core', 'package.json');
  const requirePlaywright = existsSync(packagedManifest) ? createRequire(packagedManifest) : createRequire(__filename);
  return (existsSync(packagedManifest) ? requirePlaywright('./') : requirePlaywright('playwright-core')) as typeof import('playwright-core');
}

export class BrowserCollectorDriver implements CollectorDriver {
  private readonly contexts = new Map<AmazonRegion, BrowserContext>();
  private readonly challengeContexts = new Map<AmazonRegion, BrowserContext>();

  constructor(private readonly dataDir: string, private readonly executablePath = findBrowserExecutable()) {}

  async openProduct(region: AmazonRegion, url: string): Promise<string> { return this.open(region, url); }
  async search(region: AmazonRegion, term: string): Promise<string> {
    const config = amazonRegions[region];
    return this.open(region, `https://${config.host}/s?k=${encodeURIComponent(term)}`);
  }

  async closeChallenge(region: AmazonRegion): Promise<void> {
    const context = this.challengeContexts.get(region);
    if (context) await context.close().catch((): undefined => undefined);
    this.challengeContexts.delete(region);
  }

  async close(): Promise<void> {
    const contexts = [...this.contexts.values(), ...this.challengeContexts.values()];
    await Promise.all(contexts.map((context) => context.close().catch((): undefined => undefined)));
    this.contexts.clear();
    this.challengeContexts.clear();
  }

  private async launchContext(region: AmazonRegion, headless: boolean): Promise<BrowserContext> {
    if (!this.executablePath) throw new BrowserNotFoundError();
    const config = amazonRegions[region];
    return loadPlaywright().chromium.launchPersistentContext(path.join(this.dataDir, 'amazon-profiles', region), {
      executablePath: this.executablePath,
      headless,
      locale: config.locale,
      viewport: { width: 1365, height: 900 },
    });
  }

  private async context(region: AmazonRegion): Promise<BrowserContext> {
    const existing = this.contexts.get(region);
    if (existing && canReuseBrowserContext(existing)) return existing;
    if (existing) this.contexts.delete(region);
    const context = await this.launchContext(region, true);
    this.contexts.set(region, context);
    return context;
  }

  private async showCaptcha(region: AmazonRegion, url: string, context: BrowserContext): Promise<void> {
    await context.close().catch((): undefined => undefined);
    this.contexts.delete(region);
    await this.closeChallenge(region);
    const challengeContext = await this.launchContext(region, false);
    this.challengeContexts.set(region, challengeContext);
    const page = await challengeContext.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch((): undefined => undefined);
  }

  private async open(region: AmazonRegion, url: string): Promise<string> {
    return this.openAttempt(region, url, true);
  }

  private async openAttempt(region: AmazonRegion, url: string, mayRetry: boolean): Promise<string> {
    const context = await this.context(region);
    const page: Page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      if (isTransientAmazonResponse(response?.status())) {
        await page.close();
        return '<html data-vetka-collector-status="blocked"></html>';
      }
      if (shouldStabilizeSearchPage(url)) {
        await page.waitForSelector('div[data-component-type="s-search-result"][data-asin] h2', { state: 'attached', timeout: 8_000 }).catch((): undefined => undefined);
        await page.waitForTimeout(650);
      }
      const html = await page.content();
      if (/validateCaptcha|enter the characters you see below|robot check/i.test(html)) await this.showCaptcha(region, url, context);
      else await page.close();
      return html;
    } catch (error) {
      await page.close().catch((): undefined => undefined);
      if (mayRetry && shouldRetryNavigationError(error)) {
        await context.close().catch((): undefined => undefined);
        this.contexts.delete(region);
        return this.openAttempt(region, url, false);
      }
      throw error;
    }
  }
}
