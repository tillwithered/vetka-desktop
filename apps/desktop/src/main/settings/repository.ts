import type { DatabaseSync } from 'node:sqlite';

export class SettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  get<T>(key: string): T | null {
    const row = this.db.prepare('select value_json from settings where key = ?').get(key) as
      | { value_json: string }
      | undefined;
    return row ? (JSON.parse(row.value_json) as T) : null;
  }

  set<T>(key: string, value: T): T {
    const normalizedKey = key.trim();
    if (!normalizedKey) throw new Error('Setting key is required');
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error('Setting value must be JSON serializable');
    this.db
      .prepare(`
        insert into settings (key, value_json, updated_at) values (?, ?, ?)
        on conflict(key) do update set value_json = excluded.value_json, updated_at = excluded.updated_at
      `)
      .run(normalizedKey, serialized, new Date().toISOString());
    return value;
  }

  getAll(): Record<string, unknown> {
    const rows = this.db.prepare('select key, value_json from settings order by key').all() as Array<{
      key: string;
      value_json: string;
    }>;
    return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value_json)]));
  }
}
