import type { AmazonRegion } from '@/shared/contracts';

const amazonRegions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'];

export type ProxyRoute = {
  server: string;
  username?: string;
  password?: string;
  label: string;
};

export type AmazonProxyTransport = {
  mode: 'direct' | 'proxy';
  routes: Partial<Record<AmazonRegion, ProxyRoute[]>>;
};

export type AmazonProxyTransportInput = {
  mode: 'direct' | 'proxy';
  routes?: Partial<Record<AmazonRegion, string[]>>;
};

export type PublicAmazonProxyTransport = {
  mode: 'direct' | 'proxy';
  regions: Record<AmazonRegion, { configured: boolean; routeCount: number; labels: string[] }>;
};

export function parseProxyRoute(raw: string): ProxyRoute {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('Proxy URL is invalid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Proxy must use HTTP(S)');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Proxy must be a base URL');
  if (!url.hostname) throw new Error('Proxy host is required');

  const server = `${url.protocol}//${url.host}`;
  const username = url.username ? decodeURIComponent(url.username) : undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  return { server, ...(username ? { username } : {}), ...(password ? { password } : {}), label: url.host };
}

export function parseAmazonProxyTransport(input: AmazonProxyTransportInput): AmazonProxyTransport {
  const routes = Object.fromEntries(
    amazonRegions.map((region) => [
      region,
      (input.routes?.[region] ?? []).map((route) => parseProxyRoute(route)),
    ]),
  ) as Record<AmazonRegion, ProxyRoute[]>;
  return { mode: input.mode, routes };
}

export function publicProxyTransportState(transport: AmazonProxyTransport): PublicAmazonProxyTransport {
  return {
    mode: transport.mode,
    regions: Object.fromEntries(amazonRegions.map((region) => {
      const routes = transport.routes[region] ?? [];
      return [region, { configured: routes.length > 0, routeCount: routes.length, labels: routes.map((route) => route.label) }];
    })) as PublicAmazonProxyTransport['regions'],
  };
}

export class ProxyRouteSelector {
  private readonly indexes = new Map<AmazonRegion, number>();

  constructor(private readonly transport: AmazonProxyTransport) {}

  current(region: AmazonRegion): ProxyRoute | null {
    if (this.transport.mode !== 'proxy') return null;
    const routes = this.transport.routes[region] ?? [];
    return routes[this.indexes.get(region) ?? 0] ?? null;
  }

  advance(region: AmazonRegion): ProxyRoute | null {
    const routes = this.transport.routes[region] ?? [];
    const next = (this.indexes.get(region) ?? 0) + 1;
    if (this.transport.mode !== 'proxy' || next >= routes.length) return null;
    this.indexes.set(region, next);
    return routes[next] ?? null;
  }
}
