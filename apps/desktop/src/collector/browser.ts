import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright-core';

import type { AmazonRegion } from '@/shared/contracts';
import type { CollectorDriver } from './amazon/collect';
import { amazonRegions } from './amazon/regions';
import { parseAmazonProxyTransport, ProxyRouteSelector, type AmazonProxyTransport, type ProxyRoute } from '@/main/collector/proxy-transport';

export type BrowserRequestMode = 'product' | 'store';
type BrowserTransport = 'direct' | 'proxy';

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

export function isOfficialStoreUrl(url: string): boolean {
  try {
    return /\/stores\/(?:MonsterHigh\/)?page\//i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function shouldOpenCaptchaWindow(mode: BrowserRequestMode): boolean {
  return mode === 'product';
}

export function shouldBlockAmazonResource(resourceType: string): boolean {
  return resourceType === 'image' || resourceType === 'font' || resourceType === 'media';
}

export function playwrightProxyOptions(route: ProxyRoute | null): { server: string; username?: string; password?: string } | undefined {
  return route ? {
    server: route.server,
    ...(route.username ? { username: route.username } : {}),
    ...(route.password ? { password: route.password } : {}),
  } : undefined;
}

export function profileForProxyRoute(region: AmazonRegion, route: ProxyRoute | null): string {
  if (!route) return path.join(region, 'direct');
  const fingerprint = createHash('sha256').update(`${route.server}\u0000${route.username ?? ''}`).digest('hex').slice(0, 12);
  return path.join(region, `route-${fingerprint}`);
}

function loadPlaywright(): typeof import('playwright-core') {
  const packagedManifest = path.join(process.resourcesPath ?? '', 'playwright-core', 'package.json');
  const requirePlaywright = existsSync(packagedManifest) ? createRequire(packagedManifest) : createRequire(__filename);
  return (existsSync(packagedManifest) ? requirePlaywright('./') : requirePlaywright('playwright-core')) as typeof import('playwright-core');
}

export class BrowserCollectorDriver implements CollectorDriver {
  private readonly contexts = new Map<string, BrowserContext>();
  private readonly challengeContexts = new Map<string, BrowserContext>();
  private proxyRoutes = new ProxyRouteSelector(parseAmazonProxyTransport({ mode: 'direct' }));
  private transportSignature = JSON.stringify({ mode: 'direct', routes: {} });

  constructor(private readonly dataDir: string, private readonly executablePath = findBrowserExecutable()) {}

  async configureTransport(transport: AmazonProxyTransport | undefined): Promise<void> {
    const effective = transport ?? parseAmazonProxyTransport({ mode: 'direct' });
    const signature = JSON.stringify(effective);
    if (signature === this.transportSignature) return;
    await this.close();
    this.transportSignature = signature;
    this.proxyRoutes = new ProxyRouteSelector(effective);
  }

  currentProxyRoute(region: AmazonRegion): ProxyRoute | null {
    return this.proxyRoutes.current(region);
  }

  hasProxyRoute(region: AmazonRegion): boolean {
    return this.currentProxyRoute(region) !== null;
  }

  async advanceProxyRoute(region: AmazonRegion): Promise<boolean> {
    if (!this.proxyRoutes.advance(region)) return false;
    await this.closeContext(region, 'proxy');
    await this.closeChallenge(region, 'proxy');
    return true;
  }

  async openProduct(region: AmazonRegion, url: string): Promise<string> {
    return this.open(region, url, 'product', null, false);
  }
  async openProductViaProxy(region: AmazonRegion, url: string): Promise<string> {
    const route = this.currentProxyRoute(region);
    if (!route) throw new Error(`No proxy route configured for ${region}`);
    return this.open(region, url, 'product', route, true);
  }
  async openStore(region: AmazonRegion, url: string): Promise<string> {
    await this.closeChallenge(region);
    return this.open(region, url, 'store', this.currentProxyRoute(region), false);
  }
  async openStoreProduct(region: AmazonRegion, url: string): Promise<string> {
    await this.closeChallenge(region);
    return this.open(region, url, 'store', this.currentProxyRoute(region), false);
  }
  async search(region: AmazonRegion, term: string): Promise<string> {
    const config = amazonRegions[region];
    return this.open(region, `https://${config.host}/s?k=${encodeURIComponent(term)}`, 'product', this.currentProxyRoute(region), true);
  }

  async closeChallenge(region: AmazonRegion, transport?: BrowserTransport): Promise<void> {
    const keys = transport ? [this.contextKey(region, transport)] : ['direct', 'proxy'].map((kind) => this.contextKey(region, kind as BrowserTransport));
    await Promise.all(keys.map(async (key) => {
      const context = this.challengeContexts.get(key);
      if (context) await context.close().catch((): undefined => undefined);
      this.challengeContexts.delete(key);
    }));
  }

  async close(): Promise<void> {
    const contexts = [...this.contexts.values(), ...this.challengeContexts.values()];
    await Promise.all(contexts.map((context) => context.close().catch((): undefined => undefined)));
    this.contexts.clear();
    this.challengeContexts.clear();
  }

  private contextKey(region: AmazonRegion, transport: BrowserTransport): string {
    return `${transport}:${region}`;
  }

  private async launchContext(region: AmazonRegion, route: ProxyRoute | null, headless: boolean): Promise<BrowserContext> {
    if (!this.executablePath) throw new BrowserNotFoundError();
    const config = amazonRegions[region];
    const context = await loadPlaywright().chromium.launchPersistentContext(path.join(this.dataDir, 'amazon-profiles', profileForProxyRoute(region, route)), {
      executablePath: this.executablePath,
      headless,
      locale: config.locale,
      viewport: { width: 1365, height: 900 },
      proxy: playwrightProxyOptions(route),
    });
    await context.route('**/*', (route) => (shouldBlockAmazonResource(route.request().resourceType()) ? route.abort() : route.continue()));
    return context;
  }

  private async context(region: AmazonRegion, route: ProxyRoute | null): Promise<BrowserContext> {
    const key = this.contextKey(region, route ? 'proxy' : 'direct');
    const existing = this.contexts.get(key);
    if (existing && canReuseBrowserContext(existing)) return existing;
    if (existing) this.contexts.delete(key);
    const context = await this.launchContext(region, route, true);
    this.contexts.set(key, context);
    return context;
  }

  private async closeContext(region: AmazonRegion, transport: BrowserTransport): Promise<void> {
    const key = this.contextKey(region, transport);
    const context = this.contexts.get(key);
    if (context) await context.close().catch((): undefined => undefined);
    this.contexts.delete(key);
  }

  private async showCaptcha(region: AmazonRegion, url: string, context: BrowserContext, route: ProxyRoute | null): Promise<void> {
    const transport: BrowserTransport = route ? 'proxy' : 'direct';
    const key = this.contextKey(region, transport);
    await context.close().catch((): undefined => undefined);
    this.contexts.delete(key);
    await this.closeChallenge(region, transport);
    const challengeContext = await this.launchContext(region, route, false);
    this.challengeContexts.set(key, challengeContext);
    const page = await challengeContext.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch((): undefined => undefined);
  }

  private async open(region: AmazonRegion, url: string, mode: BrowserRequestMode, route: ProxyRoute | null, openCaptchaWindow: boolean): Promise<string> {
    return this.openAttempt(region, url, true, mode, route, openCaptchaWindow);
  }

  private async openAttempt(region: AmazonRegion, url: string, mayRetry: boolean, mode: BrowserRequestMode, route: ProxyRoute | null, openCaptchaWindow: boolean): Promise<string> {
    const context = await this.context(region, route);
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
      if (isOfficialStoreUrl(url)) {
        let unchangedRounds = 0;
        let previous = 0;
        for (let round = 0; round < 8 && unchangedRounds < 2; round += 1) {
          const current = await page.locator('a[href*="/dp/"]').count();
          unchangedRounds = current > previous ? 0 : unchangedRounds + 1;
          previous = Math.max(previous, current);
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(450);
        }
      }
      const html = await page.content();
      if (/validateCaptcha|enter the characters you see below|robot check/i.test(html) && openCaptchaWindow && shouldOpenCaptchaWindow(mode)) {
        await this.showCaptcha(region, url, context, route);
      } else {
        await page.close();
      }
      return html;
    } catch (error) {
      await page.close().catch((): undefined => undefined);
      if (mayRetry && shouldRetryNavigationError(error)) {
        await context.close().catch((): undefined => undefined);
        this.contexts.delete(this.contextKey(region, route ? 'proxy' : 'direct'));
        return this.openAttempt(region, url, false, mode, route, openCaptchaWindow);
      }
      throw error;
    }
  }
}
