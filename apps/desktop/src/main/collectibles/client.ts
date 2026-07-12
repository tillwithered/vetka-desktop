import { parseCollectibleCollection, parseCollectibleProduct, type ParsedCollectible } from './parser';

export const mattelCreationsCollectionUrl = 'https://creations.mattel.com/collections/monster-high';

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

  constructor(dependencies: {
    fetchHtml?: (url: string) => Promise<string>;
    browser: BrowserFallback;
    now?: () => Date;
  }) {
    this.fetchHtml = dependencies.fetchHtml ?? directFetchHtml;
    this.browser = dependencies.browser;
    this.now = dependencies.now ?? (() => new Date());
  }

  async collect(): Promise<CollectiblesCollectionResult> {
    let collectionHtml: string;
    try {
      collectionHtml = await this.fetchHtml(mattelCreationsCollectionUrl);
    } catch (error) {
      return { complete: false, products: [], errors: [{ url: mattelCreationsCollectionUrl, message: this.message(error) }] };
    }

    const urls = parseCollectibleCollection(collectionHtml, mattelCreationsCollectionUrl);
    const products: CollectedProduct[] = [];
    const errors: CollectiblesCollectionResult['errors'] = [];
    for (const url of urls) {
      try {
        let parsed = parseCollectibleProduct(await this.fetchHtml(url), url);
        if (parsed && 'ambiguous' in parsed) parsed = parseCollectibleProduct(await this.browser.open(url), url);
        if (parsed && !('ambiguous' in parsed)) products.push({ ...parsed, checkedAt: this.now().toISOString() });
        else if (parsed && 'ambiguous' in parsed) errors.push({ url, message: 'Mattel product state is ambiguous' });
      } catch (error) {
        errors.push({ url, message: this.message(error) });
      }
    }
    return { complete: true, products, errors };
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message.slice(0, 200) : 'Mattel collection failed';
  }
}
