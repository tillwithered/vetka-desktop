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
    super('Не найден Google Chrome или Microsoft Edge. Установите один из браузеров и повторите проверку.');
  }
}

export function findBrowserExecutable(environment: NodeJS.ProcessEnv = process.env): string | null {
  const runtimeManifest = path.join(process.resourcesPath ?? '', 'playwright-chromium.json');
  if (existsSync(runtimeManifest)) {
    const { executable } = JSON.parse(readFileSync(runtimeManifest, 'utf8')) as { executable: string };
    const bundled = path.join(process.resourcesPath, 'playwright-chromium', executable);
    if (existsSync(bundled)) return bundled;
  }
  if (existsSync(path.join(process.resourcesPath ?? '', 'app.asar'))) return null;
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

function loadPlaywright(): typeof import('playwright-core') {
  const packagedManifest = path.join(process.resourcesPath ?? '', 'playwright-core', 'package.json');
  const requirePlaywright = existsSync(packagedManifest)
    ? createRequire(packagedManifest)
    : createRequire(__filename);
  return (existsSync(packagedManifest)
    ? requirePlaywright('./')
    : requirePlaywright('playwright-core')) as typeof import('playwright-core');
}

export class BrowserCollectorDriver implements CollectorDriver {
  private readonly contexts = new Map<AmazonRegion, BrowserContext>();
  private readonly challengePages = new Map<AmazonRegion, Page>();

  constructor(
    private readonly dataDir: string,
    private readonly executablePath = findBrowserExecutable(),
  ) {}

  async openProduct(region: AmazonRegion, url: string): Promise<string> {
    return this.open(region, url);
  }

  async search(region: AmazonRegion, term: string): Promise<string> {
    const config = amazonRegions[region];
    return this.open(region, `https://${config.host}/s?k=${encodeURIComponent(term)}`);
  }

  async closeChallenge(region: AmazonRegion): Promise<void> {
    const page = this.challengePages.get(region);
    if (page) await page.close().catch((): undefined => undefined);
    this.challengePages.delete(region);
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.contexts.values()].map(
        (context): Promise<void> => context.close().catch((): undefined => undefined),
      ),
    );
    this.contexts.clear();
    this.challengePages.clear();
  }

  private async context(region: AmazonRegion): Promise<BrowserContext> {
    const existing = this.contexts.get(region);
    if (existing && canReuseBrowserContext(existing)) return existing;
    if (existing) this.contexts.delete(region);
    if (!this.executablePath) throw new BrowserNotFoundError();
    const config = amazonRegions[region];
    const profileDirectory = path.join(this.dataDir, 'amazon-profiles', region);
    const context = await loadPlaywright().chromium.launchPersistentContext(profileDirectory, {
      executablePath: this.executablePath,
      headless: true,
      locale: config.locale,
      viewport: { width: 1365, height: 900 },
    });
    this.contexts.set(region, context);
    return context;
  }

  private async open(region: AmazonRegion, url: string): Promise<string> {
    return this.openAttempt(region, url, true);
  }

  private async openAttempt(region: AmazonRegion, url: string, mayRetry: boolean): Promise<string> {
    const context = await this.context(region);
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const html = await page.content();
      if (/validateCaptcha|enter the characters you see below|robot check/i.test(html)) {
        await this.closeChallenge(region);
        this.challengePages.set(region, page);
      } else {
        await page.close();
      }
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
