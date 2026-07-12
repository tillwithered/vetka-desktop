import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { DirectMattelBrowser } from '../src/main/collectibles/browser';
import { MattelCreationsClient } from '../src/main/collectibles/client';
import { CollectiblesRepository } from '../src/main/collectibles/repository';
import { runMigrations } from '../src/main/db/migrate';

const dataDir = mkdtempSync(path.join(tmpdir(), 'vetka-mattel-live-'));
const browser = new DirectMattelBrowser(dataDir);
const startedAt = Date.now();
try {
  const result = await new MattelCreationsClient({ browser, minimumDiscoveredProducts: 20 }).collect();
  if (result.products.length === 0) throw new Error(`Mattel returned no collectible dolls (${result.errors.map((error) => error.message).join('; ')})`);
  const db = new DatabaseSync(':memory:');
  try {
    runMigrations(db);
    const repository = new CollectiblesRepository(db);
    for (const product of result.products) repository.upsert(product);
    if (repository.list().length !== result.products.length) throw new Error('Mattel products were not persisted completely');
  } finally {
    db.close();
  }
  process.stdout.write(
    `Verified ${result.products.length} Mattel Creations products, ${result.errors.length} product errors, complete=${result.complete}, ${Date.now() - startedAt}ms\n`
    + `${result.products.slice(0, 3).map((product) => `${product.mattelSku ?? 'no-sku'} ${product.lifecycle} ${product.officialName}`).join('\n')}\n`,
  );
} finally {
  await browser.close();
  rmSync(dataDir, { recursive: true, force: true });
}
