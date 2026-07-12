import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from 'playwright-core';

export function shouldBlockMattelResource(resourceType: string): boolean {
  return resourceType === 'image' || resourceType === 'font' || resourceType === 'media';
}

function findExecutable(environment: NodeJS.ProcessEnv = process.env, resourcesPath: string | undefined = process.resourcesPath): string | null {
  const manifest = path.join(resourcesPath ?? '', 'playwright-chromium.json');
  if (existsSync(manifest)) {
    const { executable } = JSON.parse(readFileSync(manifest, 'utf8')) as { executable: string };
    const bundled = path.join(resourcesPath!, 'playwright-chromium', executable);
    if (existsSync(bundled)) return bundled;
  }
  const candidates = [
    [environment.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'],
    [environment['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'],
    [environment.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'],
    [environment.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'],
  ] as const;
  for (const [base, relative] of candidates) {
    if (base) {
      const candidate = path.join(base, relative);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export class DirectMattelBrowser {
  private context: BrowserContext | null = null;

  constructor(private readonly dataDir: string, private readonly executablePath = findExecutable()) {}

  async open(url: string): Promise<string> {
    if (!this.executablePath) throw new Error('Bundled Chromium is unavailable');
    if (!this.context || this.context.isClosed()) {
      const { chromium } = await import('playwright-core');
      this.context = await chromium.launchPersistentContext(path.join(this.dataDir, 'mattel-creations-profile'), {
        executablePath: this.executablePath,
        headless: true,
        locale: 'en-US',
        viewport: { width: 1365, height: 900 },
      });
      await this.context.route('**/*', (route) => (shouldBlockMattelResource(route.request().resourceType()) ? route.abort() : route.continue()));
    }
    const page = await this.context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(400);
      return await page.content();
    } finally {
      await page.close().catch((): undefined => undefined);
    }
  }

  async close(): Promise<void> {
    await this.context?.close().catch((): undefined => undefined);
    this.context = null;
  }
}
