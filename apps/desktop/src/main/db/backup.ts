import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { backup, type DatabaseSync } from 'node:sqlite';

function backupTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

export async function rotateBackups(
  db: DatabaseSync,
  backupDirectory: string,
  keep = 7,
): Promise<string> {
  if (!path.isAbsolute(backupDirectory)) {
    throw new Error('Backup directory must be absolute');
  }
  if (!Number.isSafeInteger(keep) || keep < 1) {
    throw new Error('Backup retention must be a positive integer');
  }

  const resolvedDirectory = path.resolve(backupDirectory);
  await mkdir(resolvedDirectory, { recursive: true });
  const backupPath = path.join(resolvedDirectory, `vetka-${backupTimestamp(new Date())}.sqlite`);
  await backup(db, backupPath);

  const files = (await readdir(resolvedDirectory))
    .filter((file) => /^vetka-.+\.sqlite$/.test(file))
    .sort((left, right) => right.localeCompare(left));

  await Promise.all(
    files.slice(keep).map(async (file) => {
      const candidate = path.resolve(resolvedDirectory, file);
      if (path.dirname(candidate) !== resolvedDirectory) {
        throw new Error('Refusing to remove a backup outside the backup directory');
      }
      await rm(candidate, { force: true });
    }),
  );

  return backupPath;
}
