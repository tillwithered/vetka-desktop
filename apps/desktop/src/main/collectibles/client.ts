import { parseCollectibleCollection, parseCollectibleLanding, parseCollectibleProduct, type ParsedCollectible } from './parser';

export const mattelCreationsCollectionUrl = 'https://creations.mattel.com/collections/monster-high';
export const mattelCreationsLandingUrl = 'https://creations.mattel.com/pages/monster-high';

export type CollectedProduct = ParsedCollectible & { checkedAt: string };
export type CollectiblesCollectionResult = {
  complete: boolean;
  products: CollectedProduct[];
  errors: Array<{ url: string; message: string }>;
};

type BrowserFallback = { open(url: string): Promise<string> };

async function directFetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Vetka Desktop Mattel catalog/1.0' },
    });
    if (!response.ok) throw new Error(`Mattel returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export class MattelCreationsClient {
  private readonly fetchHtml: (url: string) => Promise<string>;
  private readonly browser: BrowserFallback;
  private readonly now: () => Date;
  private readonly minimumDiscoveredProducts: number;

  constructor(dependencies: {
    fetchHtml?: (url: string) => Promise<string>;
    browser: BrowserFallback;
    now?: () => Date;
    minimumDiscoveredProducts?: number;
  }) {
    this.fetchHtml = dependencies.fetchHtml ?? directFetchHtml;
    this.browser = dependencies.browser;
    this.now = dependencies.now ?? (() => new Date());
    this.minimumDiscoveredProducts = dependencies.minimumDiscoveredProducts ?? 1;
  }

  async collect(): Promise<CollectiblesCollectionResult> {
    const products: CollectedProduct[] = [];
    const errors: CollectiblesCollectionResult['errors'] = [];
    const urls: string[] = [];
    let complete = true;
    for (const source of [
      { url: mattelCreationsLandingUrl, parse: parseCollectibleLanding },
      { url: mattelCreationsCollectionUrl, parse: parseCollectibleCollection },
    ]) {
      try {
        urls.push(...source.parse(await this.fetchHtml(source.url), source.url));
      } catch (directError) {
        try {
          urls.push(...source.parse(await this.browser.open(source.url), source.url));
        } catch (browserError) {
          complete = false;
          errors.push({
            url: source.url,
            message: `${this.message(directError)}; browser fallback: ${this.message(browserError)}`.slice(0, 200),
          });
        }
      }
    }
    const uniqueUrls = [...new Set(urls)];
    if (uniqueUrls.length < this.minimumDiscoveredProducts) {
      complete = false;
      errors.push({
        url: mattelCreationsCollectionUrl,
        message: `Mattel discovery returned only ${uniqueUrls.length} product links; expected at least ${this.minimumDiscoveredProducts}`,
      });
    }
    let nextIndex = 0;
    let browserQueue: Promise<void> = Promise.resolve();
    const openInBrowser = (url: string): Promise<string> => {
      const result = browserQueue.then(() => this.browser.open(url));
      browserQueue = result.then((): void => {}, (): void => {});
      return result;
    };
    const worker = async () => {
      while (nextIndex < uniqueUrls.length) {
        const url = uniqueUrls[nextIndex++]!;
        try {
          let parsed = parseCollectibleProduct(await this.fetchHtml(url), url);
          if (parsed && 'ambiguous' in parsed) parsed = parseCollectibleProduct(await openInBrowser(url), url);
          if (parsed && !('ambiguous' in parsed)) products.push({ ...parsed, checkedAt: this.now().toISOString() });
          else if (parsed && 'ambiguous' in parsed) errors.push({ url, message: 'Mattel product state is ambiguous' });
        } catch (error) {
          errors.push({ url, message: this.message(error) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, uniqueUrls.length) }, () => worker()));
    return { complete, products, errors };
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message.slice(0, 200) : 'Mattel collection failed';
  }
}
