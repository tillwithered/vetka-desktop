import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { evaluateCatalogCoverage } from '../src/main/catalog/coverage';
import { CatalogRegionEvidenceRepository } from '../src/main/catalog/region-evidence-repository';
import { catalogAmazonRegions } from '../src/main/catalog/region-state-service';
import { PriceRepository } from '../src/main/prices/repository';

const databasePath = process.env.VETKA_DB_PATH
  ?? path.join(process.env.APPDATA ?? '', 'Vetka Desktop', 'vetka.sqlite');
if (!existsSync(databasePath)) throw new Error(`Vetka database not found: ${databasePath}`);

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (outputIndex >= 0 && !outputPath) throw new Error('--output requires a path');

const db = new DatabaseSync(databasePath, { readOnly: true });
try {
  const entries = db.prepare(`
    select mattel_sku, doll_id from catalog_entries
    where monitor_status = 'active' and doll_id is not null order by mattel_sku
  `).all().map((row) => ({ mattelSku: String(row.mattel_sku), dollId: String(row.doll_id) }));
  const evidenceTableExists = Boolean(db.prepare("select 1 from sqlite_master where type = 'table' and name = 'catalog_region_evidence'").get());
  const evidence = evidenceTableExists ? new CatalogRegionEvidenceRepository(db).listForActiveCatalog() : [];
  const prices = new PriceRepository(db).currentForDolls(entries.map((entry) => entry.dollId));
  const cells = evidence.map((cell) => ({
    ...cell,
    hasCurrentPrice: (prices[cell.dollId] ?? []).some((price) => price.region === cell.region),
  }));
  const report = evaluateCatalogCoverage(entries, cells);
  const byIdentity = new Map(cells.map((cell) => [`${cell.mattelSku}:${cell.region}`, cell]));
  const artifact = {
    generatedAt: new Date().toISOString(), databasePath,
    summary: report,
    dolls: entries.map((entry) => ({
      mattelSku: entry.mattelSku,
      regions: catalogAmazonRegions.map((region) => byIdentity.get(`${entry.mattelSku}:${region}`) ?? ({
        mattelSku: entry.mattelSku, dollId: entry.dollId, region, status: 'missing', evidenceUrl: null as string | null,
        asin: null as string | null, checkedAt: null as string | null, diagnostic: {}, hasCurrentPrice: false,
      })),
    })),
  };
  const json = `${JSON.stringify(artifact, null, 2)}\n`;
  if (outputPath) {
    mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    writeFileSync(outputPath, json, 'utf8');
  }
  process.stdout.write(`Amazon catalog coverage: ${report.terminal}/${report.total} terminal, ${report.issues.length} issues\n`);
  if (outputPath) process.stdout.write(`Evidence report: ${path.resolve(outputPath)}\n`);
  if (!report.complete) {
    process.stdout.write(`${report.issues.slice(0, 30).map((item) => `${item.mattelSku} ${item.region} ${item.code}`).join('\n')}\n`);
    process.exitCode = 1;
  }
} finally {
  db.close();
}
