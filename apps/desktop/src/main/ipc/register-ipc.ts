import { z, ZodError, type ZodType } from 'zod';

import type { DollRepository } from '@/main/dolls/repository';
import type { SettingsRepository } from '@/main/settings/repository';
import type { PriceRepository } from '@/main/prices/repository';
import type { PriceService } from '@/main/prices/service';
import { normalizeAmazonUrl } from '@/collector/amazon/url';
import { channels } from '@/shared/channels';
import {
  dollInputSchema,
  dollListFilterSchema,
  dollUpdateSchema,
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
};

const idSchema = z.string().trim().min(1).max(100);
const favoriteSchema = z.object({ id: idSchema, favorite: z.boolean() });
const updateSchema = z.object({ id: idSchema, input: dollUpdateSchema });
const settingSchema = z.object({ key: z.string().trim().min(1).max(120), value: z.unknown() });
const refreshSchema = z.object({ dollId: idSchema, regions: z.array(z.enum(['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'])).min(1) });
const listingSchema = z.object({ dollId: idSchema, url: z.string().url().max(2048) });
const reviewSchema = z.object({ listingId: idSchema, decision: z.enum(['confirm', 'reject']) });
const historySchema = z.object({ dollId: idSchema, range: z.enum(['7d', '30d', '90d', 'all']).default('30d') });

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function failure(error: unknown): ApiResult<never> {
  if (error instanceof ZodError) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Проверьте заполненные поля' } };
  }
  const message = error instanceof Error && error.message === 'Doll not found'
    ? 'Кукла не найдена'
    : 'Не удалось выполнить операцию';
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
  registrar.handle(
    channels.dollsList,
    validated(dollListFilterSchema.default({}), (filter) => dependencies.dolls.list(filter)),
  );
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
  registrar.handle(
    channels.settingsSet,
    validated(settingSchema, ({ key, value }) => dependencies.settings.set(key, value)),
  );
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
  registrar.handle(channels.pricesCurrent, validated(idSchema, (id) => {
    if (!dependencies.prices) throw new Error('Price workspace is unavailable');
    return dependencies.prices.current(id);
  }));
  registrar.handle(channels.pricesHistory, validated(historySchema, ({ dollId, range }) => {
    if (!dependencies.prices) throw new Error('Price workspace is unavailable');
    return dependencies.prices.history(dollId, range);
  }));
}
