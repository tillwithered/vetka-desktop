import { z, ZodError, type ZodType } from 'zod';

import type { DollRepository } from '@/main/dolls/repository';
import type { SettingsRepository } from '@/main/settings/repository';
import type { ProxyTransportRepository } from '@/main/settings/proxy-transport-repository';
import type { PriceRepository } from '@/main/prices/repository';
import type { PriceService } from '@/main/prices/service';
import type { OrderRepository } from '@/main/orders/repository';
import type { CollectorClient } from '@/main/collector/client';
import type { CatalogScanService } from '@/main/catalog/scan-service';
import type { CollectiblesService } from '@/main/collectibles/service';
import { UpdateNotReadyError, type UpdateService } from '@/main/updates/service';
import { normalizeAmazonUrl } from '@/collector/amazon/url';
import { channels } from '@/shared/channels';
import {
  dollInputSchema,
  dollListFilterSchema,
  dollUpdateSchema,
  amazonProxyTransportInputSchema,
  type ApiResult,
} from '@/shared/contracts';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

export type IpcRegistrar = {
  handle(channel: string, handler: Handler): unknown;
};

type Dependencies = {
  dolls: DollRepository;
  settings: SettingsRepository;
  version: () => string;
  prices?: PriceRepository;
  priceService?: PriceService;
  orders?: OrderRepository;
  collector?: CollectorClient;
  updates?: Pick<UpdateService, 'getState' | 'check' | 'restartAndInstall'>;
  scanService?: Pick<CatalogScanService, 'getState' | 'runNow'>;
  refreshRates?: () => Promise<unknown>;
  proxyTransport?: ProxyTransportRepository;
  collectibles?: Pick<CollectiblesService, 'list' | 'getState' | 'runNow'>;
};

const idSchema = z.string().trim().min(1).max(100);
const favoriteSchema = z.object({ id: idSchema, favorite: z.boolean() });
const updateSchema = z.object({ id: idSchema, input: dollUpdateSchema });
const settingSchema = z.object({ key: z.string().trim().min(1).max(120), value: z.unknown() });
const refreshSchema = z.object({ dollId: idSchema, regions: z.array(z.enum(['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'])).min(1) });
const listingSchema = z.object({ dollId: idSchema, url: z.string().url().max(2048) });
const reviewSchema = z.object({ listingId: idSchema, decision: z.enum(['confirm', 'reject']) });
const resumeSchema = z.object({ requestId: idSchema, region: z.enum(['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it']) });
const historySchema = z.object({ dollId: idSchema, range: z.enum(['7d', '30d', '90d', 'all']).default('30d') });
const orderStatusSchema = z.enum(['new', 'awaiting_payment', 'ordered', 'shipped', 'warehouse', 'in_transit', 'received', 'delivered']);
const orderCreateSchema = z.object({ snapshotId: idSchema, customerContact: z.string().trim().min(1).max(160), localShippingMinor: z.number().int().nonnegative(), localShippingRateToKztMicros: z.number().int().positive(), weightGrams: z.number().int().positive(), internationalRateMinorPerKg: z.number().int().nonnegative(), internationalRateCurrency: z.string().trim().min(3).max(3), internationalRateToKztMicros: z.number().int().positive(), extraCostsKztMinor: z.number().int().nonnegative(), customerPriceKztMinor: z.number().int().nonnegative(), notes: z.string().trim().max(2000).nullable().default(null) });
const orderListSchema = z.object({ query: z.string().trim().max(160).optional(), status: orderStatusSchema.optional() });
const transitionSchema = z.object({ id: idSchema, status: orderStatusSchema, comment: z.string().trim().max(500).nullable().default(null) });
const trackingSchema = z.object({ id: idSchema, trackingNumber: z.string().trim().max(160).nullable() });
const collectiblesListSchema = z.object({ archived: z.boolean().default(false), query: z.string().trim().max(160).optional() }).default({ archived: false });

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function failure(error: unknown): ApiResult<never> {
  if (error instanceof ZodError) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Проверьте заполненные поля' } };
  }
  const rawMessage = error instanceof Error ? error.message.replace(/\s+/g, ' ').trim() : '';
  const diagnosticMessage = rawMessage
    && rawMessage.length <= 240
    && !/(?:https?:\/\/|token|password|stack)/i.test(rawMessage)
    ? rawMessage
    : null;
  const message = error instanceof Error && error.message === 'Doll not found'
    ? 'Кукла не найдена'
    : diagnosticMessage ?? 'Не удалось выполнить операцию';
  const code = error instanceof Error && error.message === 'Doll not found' ? 'NOT_FOUND' : 'INTERNAL_ERROR';
  return { ok: false, error: { code, message } };
}

function validated<TInput, TOutput>(
  schema: ZodType<TInput>,
  operation: (input: TInput) => TOutput | Promise<TOutput>,
): Handler {
  return async (_event, input) => {
    try {
      return success(await operation(schema.parse(input)));
    } catch (error) {
      return failure(error);
    }
  };
}

export function registerIpcHandlers(registrar: IpcRegistrar, dependencies: Dependencies): void {
  registrar.handle(channels.health, () => success({ version: dependencies.version() }));
  registrar.handle(channels.updatesGetState, () => {
    try {
      if (!dependencies.updates) throw new Error('Updates are unavailable');
      return success(dependencies.updates.getState());
    } catch {
      return { ok: false, error: { code: 'UPDATE_ERROR', message: 'Не удалось проверить обновления' } };
    }
  });
  registrar.handle(channels.updatesCheck, async () => {
    try {
      if (!dependencies.updates) throw new Error('Updates are unavailable');
      return success(await dependencies.updates.check());
    } catch {
      return { ok: false, error: { code: 'UPDATE_ERROR', message: 'Не удалось проверить обновления' } };
    }
  });
  registrar.handle(channels.updatesRestartAndInstall, () => {
    try {
      if (!dependencies.updates) throw new Error('Updates are unavailable');
      dependencies.updates.restartAndInstall();
      return success(null);
    } catch (error) {
      if (error instanceof UpdateNotReadyError) {
        return { ok: false, error: { code: 'UPDATE_NOT_READY', message: 'Обновление ещё не готово к установке' } };
      }
      return { ok: false, error: { code: 'UPDATE_ERROR', message: 'Не удалось установить обновление' } };
    }
  });
  registrar.handle(
    channels.dollsList,
    validated(dollListFilterSchema.default({}), (filter) => dependencies.dolls.list(filter)),
  );
  registrar.handle(channels.catalogGetScanState, () => {
    if (!dependencies.scanService) return failure(new Error('Catalog scanner is unavailable'));
    return success(dependencies.scanService.getState());
  });
  registrar.handle(channels.catalogRefreshNow, async () => {
    try {
      if (!dependencies.scanService) throw new Error('Catalog scanner is unavailable');
      return success(await dependencies.scanService.runNow());
    } catch (error) {
      return failure(error);
    }
  });
  registrar.handle(channels.collectiblesList, validated(collectiblesListSchema, (filter) => {
    if (!dependencies.collectibles) throw new Error('Collectibles catalog is unavailable');
    return dependencies.collectibles.list(filter);
  }));
  registrar.handle(channels.collectiblesGetScanState, () => {
    if (!dependencies.collectibles) return failure(new Error('Collectibles catalog is unavailable'));
    return success(dependencies.collectibles.getState());
  });
  registrar.handle(channels.collectiblesRefreshNow, async () => {
    try {
      if (!dependencies.collectibles) throw new Error('Collectibles catalog is unavailable');
      return success(await dependencies.collectibles.runNow());
    } catch (error) {
      return failure(error);
    }
  });
  registrar.handle(channels.dollsGet, validated(idSchema, (id) => dependencies.dolls.get(id)));
  registrar.handle(
    channels.dollsCreate,
    validated(dollInputSchema, (input) => dependencies.dolls.create(input)),
  );
  registrar.handle(
    channels.dollsUpdate,
    validated(updateSchema, ({ id, input }) => dependencies.dolls.update(id, input)),
  );
  registrar.handle(
    channels.dollsFavorite,
    validated(favoriteSchema, ({ id, favorite }) => dependencies.dolls.setFavorite(id, favorite)),
  );
  registrar.handle(channels.settingsGetAll, () => {
    try {
      return success(dependencies.settings.getAll());
    } catch (error) {
      return failure(error);
    }
  });
  registrar.handle(channels.settingsSet, validated(settingSchema, async ({ key, value }) => {
    const saved = dependencies.settings.set(key, value);
    if (key === 'exchangeRatesMode' && value === 'auto') await dependencies.refreshRates?.();
    return saved;
  }));
  registrar.handle(channels.collectorTransportGet, () => {
    if (!dependencies.proxyTransport) return failure(new Error('Collector transport is unavailable'));
    return success(dependencies.proxyTransport.getPublic());
  });
  registrar.handle(channels.collectorTransportSet, validated(amazonProxyTransportInputSchema, (input) => {
    if (!dependencies.proxyTransport) throw new Error('Collector transport is unavailable');
    return dependencies.proxyTransport.replace(input);
  }));
  registrar.handle(channels.amazonAddListing, validated(listingSchema, ({ dollId, url }) => {
    if (!dependencies.prices) throw new Error('Price workspace is unavailable');
    if (!dependencies.dolls.get(dollId)) throw new Error('Doll not found');
    const normalized = normalizeAmazonUrl(url);
    return dependencies.prices.ensureListing({
      dollId,
      region: normalized.region,
      asin: normalized.asin,
      url: normalized.canonicalUrl,
      status: 'confirmed',
      confirmationSource: 'manual',
    });
  }));
  registrar.handle(channels.amazonRefreshDoll, validated(refreshSchema, async ({ dollId, regions }) => {
    if (!dependencies.priceService) throw new Error('Price workspace is unavailable');
    return dependencies.priceService.refreshDoll(dollId, regions);
  }));
  registrar.handle(channels.amazonReviewCandidate, validated(reviewSchema, ({ listingId, decision }) => {
    if (!dependencies.prices) throw new Error('Price workspace is unavailable');
    return dependencies.prices.reviewCandidate(listingId, decision);
  }));
  registrar.handle(channels.amazonResumeRegion, validated(resumeSchema, ({ requestId, region }): null => {
    if (!dependencies.collector) throw new Error('Collector is unavailable');
    dependencies.collector.resume(requestId, region);
    return null;
  }));
  registrar.handle(channels.pricesCurrent, validated(idSchema, (id) => {
    if (!dependencies.prices) throw new Error('Price workspace is unavailable');
    return dependencies.prices.current(id);
  }));
  registrar.handle(channels.pricesCurrentForDolls, validated(z.array(idSchema).max(200), (ids) => {
    if (!dependencies.prices) throw new Error('Price workspace is unavailable');
    return dependencies.prices.currentForDolls(ids);
  }));
  registrar.handle(channels.pricesHistory, validated(historySchema, ({ dollId, range }) => {
    if (!dependencies.prices) throw new Error('Price workspace is unavailable');
    return dependencies.prices.history(dollId, range);
  }));
  registrar.handle(channels.ordersList, validated(orderListSchema.default({}), (filter) => {
    if (!dependencies.orders) throw new Error('Orders workspace is unavailable');
    return dependencies.orders.list(filter);
  }));
  registrar.handle(channels.ordersGet, validated(idSchema, (id) => {
    if (!dependencies.orders) throw new Error('Orders workspace is unavailable');
    return dependencies.orders.get(id);
  }));
  registrar.handle(channels.ordersCreate, validated(orderCreateSchema, (input) => {
    if (!dependencies.orders) throw new Error('Orders workspace is unavailable');
    return dependencies.orders.create(input);
  }));
  registrar.handle(channels.ordersTransition, validated(transitionSchema, ({ id, status, comment }) => {
    if (!dependencies.orders) throw new Error('Orders workspace is unavailable');
    return dependencies.orders.transition(id, status, comment);
  }));
  registrar.handle(channels.ordersTracking, validated(trackingSchema, ({ id, trackingNumber }) => {
    if (!dependencies.orders) throw new Error('Orders workspace is unavailable');
    return dependencies.orders.updateTracking(id, trackingNumber);
  }));
}
