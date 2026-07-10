import { z } from 'zod';

export const amazonRegionSchema = z.enum([
  'amazon_us',
  'amazon_uk',
  'amazon_de',
  'amazon_es',
  'amazon_it',
]);

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().default(null);

export const dollInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  characterName: nullableText(100),
  lineName: nullableText(100),
  generation: nullableText(40),
  mattelSku: nullableText(40),
  upcEan: z.string().trim().regex(/^\d{8,14}$/).nullable().default(null),
  imagePath: z.string().trim().nullable().default(null),
  notes: nullableText(2000),
});

export const dollUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    characterName: z.string().trim().max(100).nullable().optional(),
    lineName: z.string().trim().max(100).nullable().optional(),
    generation: z.string().trim().max(40).nullable().optional(),
    mattelSku: z.string().trim().max(40).nullable().optional(),
    upcEan: z.string().trim().regex(/^\d{8,14}$/).nullable().optional(),
    imagePath: z.string().trim().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const dollListFilterSchema = z.object({
  query: z.string().trim().max(160).optional(),
  favoritesOnly: z.boolean().optional(),
});

export type AmazonRegion = z.infer<typeof amazonRegionSchema>;
export type DollInput = z.infer<typeof dollInputSchema>;
export type DollUpdate = z.infer<typeof dollUpdateSchema>;
export type DollListFilter = z.infer<typeof dollListFilterSchema>;

export type Doll = DollInput & {
  id: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type VetkaDesktopApi = {
  health(): Promise<ApiResult<{ version: string }>>;
  dolls: {
    list(filter?: DollListFilter): Promise<ApiResult<Doll[]>>;
    get(id: string): Promise<ApiResult<Doll | null>>;
    create(input: DollInput): Promise<ApiResult<Doll>>;
    update(id: string, input: DollUpdate): Promise<ApiResult<Doll>>;
    setFavorite(id: string, favorite: boolean): Promise<ApiResult<Doll>>;
  };
  settings: {
    getAll(): Promise<ApiResult<Record<string, unknown>>>;
    set(key: string, value: unknown): Promise<ApiResult<unknown>>;
  };
};

declare global {
  interface Window {
    vetka: VetkaDesktopApi;
  }
}
