import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import { rotateBackups } from '@/main/db/backup';
import { openDatabase } from '@/main/db/database';
import { runMigrations } from '@/main/db/migrate';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('rotateBackups', () => {
  it('creates a readable backup and retains at most seven database files', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vetka-backup-'));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, 'vetka.sqlite');
    const backupDirectory = path.join(directory, 'backups');
    const db = openDatabase(databasePath);
    runMigrations(db);
    db.prepare(
      "insert into dolls (id, name, created_at, updated_at) values ('doll-1', 'Draculaura', '2026-07-10T00:00:00Z', '2026-07-10T00:00:00Z')",
    ).run();

    await mkdir(backupDirectory, { recursive: true });
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        writeFile(path.join(backupDirectory, `vetka-2000-01-0${index + 1}T00-00-00Z.sqlite`), ''),
      ),
    );

    const backupPath = await rotateBackups(db, backupDirectory);
    db.close();

    const backup = new DatabaseSync(backupPath, { readOnly: true });
    expect(backup.prepare('select name from dolls where id = ?').get('doll-1')).toEqual({
      name: 'Draculaura',
    });
    backup.close();

    const backupFiles = (await readdir(backupDirectory)).filter((name) => name.endsWith('.sqlite'));
    expect(backupFiles).toHaveLength(7);
    expect(path.dirname(backupPath)).toBe(path.resolve(backupDirectory));
  });
});
