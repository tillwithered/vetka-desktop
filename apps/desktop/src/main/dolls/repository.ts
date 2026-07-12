import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import {
  dollInputSchema,
  dollListFilterSchema,
  dollUpdateSchema,
  type Doll,
  type DollInput,
  type DollListFilter,
  type DollUpdate,
} from '@/shared/contracts';

type DollRow = Record<string, unknown>;
export type CatalogDollIdentity = {
  name: string;
  characterName: string | null;
  lineName: string | null;
  mattelSku: string;
  officialName: string | null;
  mattelUrl: string | null;
  mattelImageUrl: string | null;
};

const columns = {
  name: 'name',
  characterName: 'character_name',
  lineName: 'line_name',
  generation: 'generation',
  mattelSku: 'mattel_sku',
  officialName: 'official_name',
  mattelUrl: 'mattel_url',
  upcEan: 'upc_ean',
  imagePath: 'image_path',
  notes: 'notes',
} as const;

function mapDoll(row: DollRow): Doll {
  return {
    id: String(row.id),
    name: String(row.name),
    characterName: row.character_name === null ? null : String(row.character_name),
    lineName: row.line_name === null ? null : String(row.line_name),
    generation: row.generation === null ? null : String(row.generation),
    mattelSku: row.mattel_sku === null ? null : String(row.mattel_sku),
    officialName: row.official_name === null ? null : String(row.official_name),
    mattelUrl: row.mattel_url === null ? null : String(row.mattel_url),
    upcEan: row.upc_ean === null ? null : String(row.upc_ean),
    imagePath: row.image_path === null ? null : String(row.image_path),
    imageSource: row.image_source === null ? null : row.image_source as Doll['imageSource'],
    notes: row.notes === null ? null : String(row.notes),
    isFavorite: Number(row.is_favorite) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class DollRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: DollInput | { name: string; [key: string]: unknown }): Doll {
    const parsed = dollInputSchema.parse(input);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(`
        insert into dolls (
          id, name, character_name, line_name, generation, mattel_sku,
          official_name, mattel_url, upc_ean, image_path, image_source, notes, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        parsed.name,
        parsed.characterName,
        parsed.lineName,
        parsed.generation,
        parsed.mattelSku,
        parsed.officialName,
        parsed.mattelUrl,
        parsed.upcEan,
        parsed.imagePath,
        parsed.imagePath ? 'manual' : null,
        parsed.notes,
        now,
        now,
      );
    return this.getRequired(id);
  }

  get(id: string): Doll | null {
    const row = this.db.prepare('select * from dolls where id = ?').get(id) as DollRow | undefined;
    return row ? mapDoll(row) : null;
  }

  findByMattelSku(mattelSku: string): Doll | null {
    const row = this.db.prepare('select * from dolls where lower(mattel_sku) = lower(?) limit 1').get(mattelSku) as DollRow | undefined;
    return row ? mapDoll(row) : null;
  }

  list(filter: DollListFilter = {}): Doll[] {
    const parsed = dollListFilterSchema.parse(filter);
    const conditions: string[] = [];
    const parameters: Array<string | number> = [];

    if (parsed.query) {
      conditions.push(`(
        lower(name) like ? or lower(coalesce(official_name, '')) like ? or lower(coalesce(character_name, '')) like ?
        or lower(coalesce(line_name, '')) like ?
        or lower(coalesce(mattel_sku, '')) = lower(?) or upc_ean = ?
      )`);
      const like = `%${parsed.query.toLowerCase()}%`;
      parameters.push(like, like, like, like, parsed.query, parsed.query);
    }
    if (parsed.favoritesOnly) {
      conditions.push('is_favorite = 1');
    }

    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    return (this.db.prepare(`select * from dolls ${where} order by updated_at desc, name`).all(
      ...parameters,
    ) as DollRow[]).map(mapDoll);
  }

  update(id: string, input: DollUpdate): Doll {
    const parsed = dollUpdateSchema.parse(input);
    this.getRequired(id);
    const entries = Object.entries(parsed) as Array<[keyof typeof columns, string | null]>;
    const assignments = entries.map(([key]) => `${columns[key]} = ?`);
    const values = entries.map(([, value]) => value);
    if ('imagePath' in parsed) {
      assignments.push('image_source = ?');
      values.push(parsed.imagePath ? 'manual' : null);
    }
    const now = new Date().toISOString();
    this.db
      .prepare(`update dolls set ${assignments.join(', ')}, updated_at = ? where id = ?`)
      .run(...values, now, id);
    return this.getRequired(id);
  }

  setFavorite(id: string, favorite: boolean): Doll {
    this.getRequired(id);
    this.db
      .prepare('update dolls set is_favorite = ?, updated_at = ? where id = ?')
      .run(favorite ? 1 : 0, new Date().toISOString(), id);
    return this.getRequired(id);
  }

  applyCatalogIdentity(id: string, identity: CatalogDollIdentity): Doll {
    this.getRequired(id);
    const now = new Date().toISOString();
    this.db.prepare(`
      update dolls set
        name = ?, character_name = ?, line_name = ?, mattel_sku = ?, official_name = ?, mattel_url = ?,
        image_path = case when ? is not null and (image_source is null or image_source = 'amazon') then ? else image_path end,
        image_source = case when ? is not null and (image_source is null or image_source = 'amazon') then 'mattel' else image_source end,
        updated_at = ?
      where id = ?
    `).run(
      identity.name, identity.characterName, identity.lineName, identity.mattelSku, identity.officialName, identity.mattelUrl,
      identity.mattelImageUrl, identity.mattelImageUrl, identity.mattelImageUrl, now, id,
    );
    return this.getRequired(id);
  }

  private getRequired(id: string): Doll {
    const doll = this.get(id);
    if (!doll) throw new Error('Doll not found');
    return doll;
  }
}
