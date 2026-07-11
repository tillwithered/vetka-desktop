import { describe, expect, it } from 'vitest';

import {
  ProxyRouteSelector,
  parseAmazonProxyTransport,
  parseProxyRoute,
  publicProxyTransportState,
} from '@/main/collector/proxy-transport';

describe('Amazon proxy transport', () => {
  it('splits an authenticated proxy URL into a Playwright route without exposing credentials in its label', () => {
    expect(parseProxyRoute('http://violet:very-secret@gateway.example:10000')).toEqual({
      server: 'http://gateway.example:10000', username: 'violet', password: 'very-secret', label: 'gateway.example:10000',
    });
  });

  it('rejects non-HTTP proxy endpoints and proxy URLs with a target path', () => {
    expect(() => parseProxyRoute('socks5://gateway.example:10000')).toThrow('HTTP(S)');
    expect(() => parseProxyRoute('https://gateway.example:10000/some-target')).toThrow('base URL');
  });

  it('keeps one regional route sticky and advances only when told that it failed', () => {
    const transport = parseAmazonProxyTransport({
      mode: 'proxy',
      routes: { amazon_uk: ['http://first:secret@uk-one.example:10000', 'http://second:secret@uk-two.example:10000'] },
    });
    const selector = new ProxyRouteSelector(transport);

    expect(selector.current('amazon_uk')?.label).toBe('uk-one.example:10000');
    expect(selector.current('amazon_uk')?.label).toBe('uk-one.example:10000');
    expect(selector.advance('amazon_uk')?.label).toBe('uk-two.example:10000');
    expect(selector.current('amazon_uk')?.label).toBe('uk-two.example:10000');
    expect(selector.advance('amazon_uk')).toBeNull();
  });

  it('publishes configuration status and redacted route labels only', () => {
    const transport = parseAmazonProxyTransport({
      mode: 'proxy',
      routes: { amazon_es: ['https://user:very-secret@es.example:8443'] },
    });

    expect(publicProxyTransportState(transport)).toEqual({
      mode: 'proxy',
      regions: {
        amazon_us: { configured: false, routeCount: 0, labels: [] },
        amazon_uk: { configured: false, routeCount: 0, labels: [] },
        amazon_de: { configured: false, routeCount: 0, labels: [] },
        amazon_es: { configured: true, routeCount: 1, labels: ['es.example:8443'] },
        amazon_it: { configured: false, routeCount: 0, labels: [] },
      },
    });
    expect(JSON.stringify(publicProxyTransportState(transport))).not.toContain('very-secret');
  });
});
