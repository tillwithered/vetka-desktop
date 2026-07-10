import { z, ZodError, type ZodType } from 'zod';

import type { DollRepository } from '@/main/dolls/repository';
import type { SettingsRepository } from '@/main/settings/repository';
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
};

const idSchema = z.string().trim().min(1).max(100);
const favoriteSchema = z.object({ id: idSchema, favorite: z.boolean() });
const updateSchema = z.object({ id: idSchema, input: dollUpdateSchema });
const settingSchema = z.object({ key: z.string().trim().min(1).max(120), value: z.unknown() });

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
  operation: (input: TInput) => TOutput,
): Handler {
  return (_event, input) => {
    try {
      return success(operation(schema.parse(input)));
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
}
