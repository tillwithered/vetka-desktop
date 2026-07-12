import type { DatabaseSync } from 'node:sqlite';

import migrationV0 from './migrations/0001_v0.sql?raw';
import migrationCatalog from './migrations/0002_catalog.sql?raw';
import migrationKztPrices from './migrations/0003_kzt_prices.sql?raw';
import migrationStoreCardAvailability from './migrations/0004_store_card_availability.sql?raw';
import migrationDollCatalogIdentity from './migrations/0005_doll_catalog_identity.sql?raw';
import migrationCollectorCatalog from './migrations/0006_collector_catalog.sql?raw';
import migrationCatalogRegionEvidence from './migrations/0007_catalog_region_evidence.sql?raw';

export function runMigrations(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('BEGIN IMMEDIATE');

  try {
    db.exec(migrationV0);
    db.prepare(
      'insert or ignore into schema_migrations (version, applied_at) values (?, ?)',
    ).run(1, new Date().toISOString());
    db.exec(migrationCatalog);
    db.prepare(
      'insert or ignore into schema_migrations (version, applied_at) values (?, ?)',
    ).run(2, new Date().toISOString());
    const kztMigrationApplied = db.prepare('select 1 from schema_migrations where version = 3').get();
    if (!kztMigrationApplied) {
      db.exec(migrationKztPrices);
      db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(3, new Date().toISOString());
    }
    const storeCardAvailabilityMigrationApplied = db.prepare('select 1 from schema_migrations where version = 4').get();
    if (!storeCardAvailabilityMigrationApplied) {
      db.exec(migrationStoreCardAvailability);
      db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(4, new Date().toISOString());
    }
    const dollCatalogIdentityApplied = db.prepare('select 1 from schema_migrations where version = 5').get();
    if (!dollCatalogIdentityApplied) {
      db.exec(migrationDollCatalogIdentity);
      db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(5, new Date().toISOString());
    }
    const collectorCatalogApplied = db.prepare('select 1 from schema_migrations where version = 6').get();
    if (!collectorCatalogApplied) {
      db.exec(migrationCollectorCatalog);
      db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(6, new Date().toISOString());
    }
    const catalogRegionEvidenceApplied = db.prepare('select 1 from schema_migrations where version = 7').get();
    if (!catalogRegionEvidenceApplied) {
      db.exec(migrationCatalogRegionEvidence);
      db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(7, new Date().toISOString());
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
