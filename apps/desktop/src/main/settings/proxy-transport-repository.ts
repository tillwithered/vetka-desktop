import {
  parseAmazonProxyTransport,
  publicProxyTransportState,
  type AmazonProxyTransport,
  type AmazonProxyTransportInput,
  type PublicAmazonProxyTransport,
} from '@/main/collector/proxy-transport';
import type { AmazonRegion } from '@/shared/contracts';

import type { SettingsRepository } from './repository';

const privateKey = '_private.amazonProxyTransport';

export type SecretStorage = {
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

export class ProxyTransportRepository {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly secrets: SecretStorage,
  ) {}

  getResolved(): AmazonProxyTransport {
    const encrypted = this.settings.get<string>(privateKey);
    if (!encrypted) return parseAmazonProxyTransport({ mode: 'direct' });
    const decrypted = this.secrets.decryptString(Buffer.from(encrypted, 'base64'));
    return JSON.parse(decrypted) as AmazonProxyTransport;
  }

  getPublic(): PublicAmazonProxyTransport {
    return publicProxyTransportState(this.getResolved());
  }

  replace(input: AmazonProxyTransportInput): PublicAmazonProxyTransport {
    const current = this.getResolved();
    const parsed = parseAmazonProxyTransport(input);
    const regions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'];
    const transport: AmazonProxyTransport = {
      mode: input.mode,
      routes: Object.fromEntries(regions.map((region) => [
        region,
        input.routes && Object.hasOwn(input.routes, region) ? parsed.routes[region] : current.routes[region] ?? [],
      ])) as AmazonProxyTransport['routes'],
    };
    const encrypted = this.secrets.encryptString(JSON.stringify(transport)).toString('base64');
    this.settings.set(privateKey, encrypted);
    return publicProxyTransportState(transport);
  }
}
