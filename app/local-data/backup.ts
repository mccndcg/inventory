import type { Table } from "dexie";
import { Dexie } from "dexie";
import { LOCAL_SCHEMA_VERSION } from "../domain/constants";
import { projectDrawerCash } from "../domain/cash";
import { projectStock } from "../domain/stock";
import type { Clock, IdSource, UUID } from "../domain/types";
import { canonicalJson, canonicalSha256 } from "./canonical";
import {
  DATABASE_VERSION,
  InventoryDatabase,
  INVENTORY_DATABASE_NAME,
} from "./database";
import { RepositoryError } from "./errors";
import type {
  CashAdjustment,
  DeviceState,
  LocationSettings,
  OpeningBatch,
  OutboxOperation,
  Product,
  Sale,
  SaleItem,
  StockAdjustment,
  SyncState,
} from "./models";
import { APPLICATION_COMMIT } from "./opening";
import {
  parseCashAdjustment,
  parseDeviceState,
  parseLocationSettings,
  parseOpeningBatch,
  parseOutboxOperation,
  parseProduct,
  parseSale,
  parseSaleItem,
  parseStockAdjustment,
  parseSyncState,
} from "./validation";

export const BACKUP_FORMAT_VERSION = 1;
export const RESTORE_DATABASE_PREFIX = "inventory_restore_";

const payloadNames = [
  "deviceState",
  "locationSettings",
  "openingBatches",
  "products",
  "sales",
  "saleItems",
  "stockAdjustments",
  "cashAdjustments",
  "outbox",
  "syncState",
] as const;

type PayloadName = (typeof payloadNames)[number];

export interface BackupPayloads {
  deviceState: DeviceState[];
  locationSettings: LocationSettings[];
  openingBatches: OpeningBatch[];
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
  stockAdjustments: StockAdjustment[];
  cashAdjustments: CashAdjustment[];
  outbox: OutboxOperation[];
  syncState: SyncState[];
}

export interface BackupProjections {
  stockByProduct: Record<UUID, number>;
  cashByDrawer: Record<UUID, number>;
}

export interface BackupManifest {
  backupFormatVersion: 1;
  exportId: UUID;
  createdAt: string;
  applicationCommit: string;
  localSchemaVersion: number;
  databaseVersion: number;
  source: {
    databaseName: typeof INVENTORY_DATABASE_NAME;
    locationId: UUID;
    deviceId: UUID;
    deviceCode: string;
    drawerId: UUID;
    drawerLabel: string;
  };
  recordCounts: Record<PayloadName, number>;
  payloadSha256: Record<PayloadName, string>;
  projections: BackupProjections;
}

export interface BackupDocument {
  manifest: BackupManifest;
  manifestSha256: string;
  payloads: BackupPayloads;
}

export interface BackupDependencies {
  clock: Clock;
  ids: IdSource;
  applicationCommit?: string;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RepositoryError("INVALID_RECORD", `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new RepositoryError(
      "INVALID_RECORD",
      `${label} has missing or unsupported fields.`,
    );
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new RepositoryError("INVALID_RECORD", `${label} must be a non-empty string.`);
  }
  return value;
}

function requiredInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RepositoryError("INVALID_RECORD", `${label} must be a safe integer.`);
  }
  return value as number;
}

function requiredSha256(value: unknown, label: string): string {
  const hash = requiredString(value, label);
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new RepositoryError("INVALID_RECORD", `${label} must be lowercase SHA-256.`);
  }
  return hash;
}

function requiredUuid(value: unknown, label: string): UUID {
  const uuid = requiredString(value, label);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      uuid,
    )
  ) {
    throw new RepositoryError("INVALID_RECORD", `${label} must be a lowercase UUID.`);
  }
  return uuid;
}

function parseArray<T>(
  value: unknown,
  parser: (row: unknown) => T,
  label: string,
): T[] {
  if (!Array.isArray(value)) {
    throw new RepositoryError("INVALID_RECORD", `${label} payload must be an array.`);
  }
  return value.map(parser);
}

function sortRows<T>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) =>
    canonicalJson(left).localeCompare(canonicalJson(right)),
  );
}

async function readSnapshot(db: InventoryDatabase): Promise<BackupPayloads> {
  return db.transaction("r", db.tables, async () => {
    const [
      deviceState,
      locationSettings,
      openingBatches,
      products,
      sales,
      saleItems,
      stockAdjustments,
      cashAdjustments,
      outbox,
      syncState,
    ] = await Promise.all([
      db.deviceState.toArray(),
      db.locationSettings.toArray(),
      db.openingBatches.toArray(),
      db.products.toArray(),
      db.sales.toArray(),
      db.saleItems.toArray(),
      db.stockAdjustments.toArray(),
      db.cashAdjustments.toArray(),
      db.outbox.toArray(),
      db.syncState.toArray(),
    ]);
    return {
      deviceState: sortRows(deviceState.map(parseDeviceState)),
      locationSettings: sortRows(locationSettings.map(parseLocationSettings)),
      openingBatches: sortRows(openingBatches.map(parseOpeningBatch)),
      products: sortRows(products.map(parseProduct)),
      sales: sortRows(sales.map(parseSale)),
      saleItems: sortRows(saleItems.map(parseSaleItem)),
      stockAdjustments: sortRows(stockAdjustments.map(parseStockAdjustment)),
      cashAdjustments: sortRows(cashAdjustments.map(parseCashAdjustment)),
      outbox: sortRows(outbox.map(parseOutboxOperation)),
      syncState: sortRows(syncState.map(parseSyncState)),
    };
  });
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new RepositoryError("INVALID_RECORD", `Backup contains duplicate ${label}.`);
  }
}

function buildProjections(payloads: BackupPayloads): BackupProjections {
  const saleById = new Map(payloads.sales.map((sale) => [sale.id, sale]));
  const saleRows = payloads.sales.map((sale) => ({
    drawerId: sale.drawerId,
    tombstone: sale.tombstone,
    items: payloads.saleItems.filter((item) => item.saleId === sale.id),
  }));
  const stockSaleItems = payloads.saleItems.map((item) => {
    const sale = saleById.get(item.saleId);
    if (!sale) {
      throw new RepositoryError(
        "INVALID_RECORD",
        `Sale item ${item.id} has no parent sale.`,
      );
    }
    return {
      productId: item.productId,
      quantity: item.quantity,
      saleTombstone: sale.tombstone,
    };
  });
  return {
    stockByProduct: Object.fromEntries(
      [...payloads.products]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((product) => [
          product.id,
          projectStock(product.id, payloads.stockAdjustments, stockSaleItems),
        ]),
    ),
    cashByDrawer: Object.fromEntries(
      payloads.deviceState.map((device) => [
        device.drawerId,
        projectDrawerCash(device.drawerId, payloads.cashAdjustments, saleRows),
      ]),
    ),
  };
}

function validateRelationships(payloads: BackupPayloads): BackupProjections {
  if (
    payloads.deviceState.length !== 1 ||
    payloads.locationSettings.length !== 1 ||
    payloads.syncState.length !== 1
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup must contain exactly one installation, location, and sync state.",
    );
  }
  if (payloads.openingBatches.length > 1) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup cannot contain multiple opening batches.",
    );
  }
  const device = payloads.deviceState[0]!;
  const settings = payloads.locationSettings[0]!;
  if (device.locationId !== settings.locationId) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup device and location settings do not match.",
    );
  }
  assertUnique(payloads.products.map(({ id }) => id), "product IDs");
  assertUnique(payloads.sales.map(({ id }) => id), "sale IDs");
  assertUnique(payloads.saleItems.map(({ id }) => id), "sale-item IDs");
  assertUnique(
    payloads.stockAdjustments.map(({ id }) => id),
    "stock-adjustment IDs",
  );
  assertUnique(
    payloads.cashAdjustments.map(({ id }) => id),
    "cash-adjustment IDs",
  );
  assertUnique(payloads.outbox.map(({ operationId }) => operationId), "operation IDs");
  assertUnique(
    payloads.outbox.map(({ deviceId, deviceSequence }) => `${deviceId}:${deviceSequence}`),
    "device operation sequences",
  );
  const products = new Set(payloads.products.map(({ id }) => id));
  const sales = new Set(payloads.sales.map(({ id }) => id));
  for (const product of payloads.products) {
    if (product.locationId !== device.locationId) {
      throw new RepositoryError("INVALID_RECORD", "Product belongs to another location.");
    }
  }
  for (const sale of payloads.sales) {
    if (
      sale.locationId !== device.locationId ||
      sale.deviceId !== device.deviceId ||
      sale.drawerId !== device.drawerId
    ) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Sale identity does not match the backed-up installation.",
      );
    }
  }
  for (const item of payloads.saleItems) {
    if (!sales.has(item.saleId) || !products.has(item.productId)) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Sale item references a missing sale or product.",
      );
    }
  }
  for (const adjustment of payloads.stockAdjustments) {
    if (
      adjustment.locationId !== device.locationId ||
      !products.has(adjustment.productId)
    ) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Stock adjustment references another location or a missing product.",
      );
    }
  }
  for (const adjustment of payloads.cashAdjustments) {
    if (
      adjustment.locationId !== device.locationId ||
      adjustment.deviceId !== device.deviceId ||
      adjustment.drawerId !== device.drawerId
    ) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Cash adjustment identity does not match the backed-up installation.",
      );
    }
  }
  const opening = payloads.openingBatches[0];
  if (
    opening &&
    (opening.locationId !== device.locationId ||
      opening.originDeviceId !== device.deviceId)
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Opening batch identity does not match the backed-up installation.",
    );
  }
  const maxReceipt = payloads.sales.reduce(
    (maximum, sale) => Math.max(maximum, sale.receiptSequence),
    0,
  );
  const maxOperation = payloads.outbox.reduce(
    (maximum, operation) => Math.max(maximum, operation.deviceSequence),
    0,
  );
  if (
    device.nextReceiptSequence <= maxReceipt ||
    device.nextOperationSequence <= maxOperation
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup device sequences do not advance beyond stored records.",
    );
  }
  return buildProjections(payloads);
}

async function validateOpeningIntegrity(payloads: BackupPayloads): Promise<void> {
  const opening = payloads.openingBatches[0];
  if (!opening) return;
  if (
    opening.status !== "draft" &&
    (await canonicalSha256(opening.reportPayload)) !== opening.reportSha256
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Opening report hash does not match its persisted payload.",
    );
  }
  const openingStock = payloads.stockAdjustments.filter(
    ({ openingBatchId }) => openingBatchId === opening.id,
  );
  const openingCash = payloads.cashAdjustments.filter(
    ({ openingBatchId }) => openingBatchId === opening.id,
  );
  if (opening.status !== "finalized") {
    if (openingStock.length || openingCash.length) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Unfinalized opening cannot have authority adjustments.",
      );
    }
    return;
  }
  if (
    openingStock.length !== opening.reportPayload.stockLines.length ||
    openingCash.length !== 1
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Finalized opening adjustment counts do not match its report.",
    );
  }
  for (const line of opening.reportPayload.stockLines) {
    const adjustment = openingStock.find(({ id }) => id === line.adjustmentId);
    if (
      !adjustment ||
      adjustment.productId !== line.productId ||
      adjustment.quantityDelta !== line.countedQuantity ||
      adjustment.kind !== "opening_count" ||
      adjustment.tombstone !== 0
    ) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Opening stock authority does not match its report line.",
      );
    }
  }
  const cashLine = opening.reportPayload.cashLines[0]!;
  const cashAdjustment = openingCash[0]!;
  if (
    cashAdjustment.id !== cashLine.adjustmentId ||
    cashAdjustment.deviceId !== cashLine.deviceId ||
    cashAdjustment.drawerId !== cashLine.drawerId ||
    cashAdjustment.amountMinor !== cashLine.countedAmountMinor ||
    cashAdjustment.kind !== "opening_balance" ||
    cashAdjustment.tombstone !== 0
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Opening cash authority does not match its report line.",
    );
  }
}

async function payloadHashes(
  payloads: BackupPayloads,
): Promise<Record<PayloadName, string>> {
  const entries = await Promise.all(
    payloadNames.map(async (name) => [
      name,
      await canonicalSha256(payloads[name]),
    ] as const),
  );
  return Object.fromEntries(entries) as Record<PayloadName, string>;
}

function recordCounts(
  payloads: BackupPayloads,
): Record<PayloadName, number> {
  return Object.fromEntries(
    payloadNames.map((name) => [name, payloads[name].length]),
  ) as Record<PayloadName, number>;
}

export async function createBackup(
  db: InventoryDatabase,
  dependencies: BackupDependencies,
): Promise<BackupDocument> {
  const payloads = await readSnapshot(db);
  const projections = validateRelationships(payloads);
  await validateOpeningIntegrity(payloads);
  const device = payloads.deviceState[0]!;
  const manifest: BackupManifest = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportId: dependencies.ids.randomUUID(),
    createdAt: dependencies.clock.now().toISOString(),
    applicationCommit: dependencies.applicationCommit ?? APPLICATION_COMMIT,
    localSchemaVersion: LOCAL_SCHEMA_VERSION,
    databaseVersion: DATABASE_VERSION,
    source: {
      databaseName: INVENTORY_DATABASE_NAME,
      locationId: device.locationId,
      deviceId: device.deviceId,
      deviceCode: device.deviceCode,
      drawerId: device.drawerId,
      drawerLabel: device.drawerLabel,
    },
    recordCounts: recordCounts(payloads),
    payloadSha256: await payloadHashes(payloads),
    projections,
  };
  return {
    manifest,
    manifestSha256: await canonicalSha256(manifest),
    payloads,
  };
}

function parsePayloads(value: unknown): BackupPayloads {
  const record = asRecord(value, "Backup payloads");
  assertExactKeys(record, payloadNames, "Backup payloads");
  return {
    deviceState: sortRows(
      parseArray(record.deviceState, parseDeviceState, "deviceState"),
    ),
    locationSettings: sortRows(
      parseArray(record.locationSettings, parseLocationSettings, "locationSettings"),
    ),
    openingBatches: sortRows(
      parseArray(record.openingBatches, parseOpeningBatch, "openingBatches"),
    ),
    products: sortRows(parseArray(record.products, parseProduct, "products")),
    sales: sortRows(parseArray(record.sales, parseSale, "sales")),
    saleItems: sortRows(parseArray(record.saleItems, parseSaleItem, "saleItems")),
    stockAdjustments: sortRows(
      parseArray(record.stockAdjustments, parseStockAdjustment, "stockAdjustments"),
    ),
    cashAdjustments: sortRows(
      parseArray(record.cashAdjustments, parseCashAdjustment, "cashAdjustments"),
    ),
    outbox: sortRows(parseArray(record.outbox, parseOutboxOperation, "outbox")),
    syncState: sortRows(parseArray(record.syncState, parseSyncState, "syncState")),
  };
}

function parseNumberRecord(value: unknown, label: string): Record<string, number> {
  const record = asRecord(value, label);
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      requiredUuid(key, `${label} key`),
      requiredInteger(item, `${label} value`),
    ]),
  );
}

function parseManifest(value: unknown): BackupManifest {
  const record = asRecord(value, "Backup manifest");
  assertExactKeys(
    record,
    [
      "backupFormatVersion",
      "exportId",
      "createdAt",
      "applicationCommit",
      "localSchemaVersion",
      "databaseVersion",
      "source",
      "recordCounts",
      "payloadSha256",
      "projections",
    ],
    "Backup manifest",
  );
  if (record.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup format version is not supported.",
    );
  }
  if (
    record.localSchemaVersion !== LOCAL_SCHEMA_VERSION ||
    record.databaseVersion !== DATABASE_VERSION
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup database schema is not supported by this application.",
    );
  }
  const source = asRecord(record.source, "Backup source");
  assertExactKeys(
    source,
    [
      "databaseName",
      "locationId",
      "deviceId",
      "deviceCode",
      "drawerId",
      "drawerLabel",
    ],
    "Backup source",
  );
  if (source.databaseName !== INVENTORY_DATABASE_NAME) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup was not produced by the replacement local database.",
    );
  }
  const counts = asRecord(record.recordCounts, "Backup record counts");
  const hashes = asRecord(record.payloadSha256, "Backup payload hashes");
  assertExactKeys(counts, payloadNames, "Backup record counts");
  assertExactKeys(hashes, payloadNames, "Backup payload hashes");
  const projections = asRecord(record.projections, "Backup projections");
  assertExactKeys(
    projections,
    ["stockByProduct", "cashByDrawer"],
    "Backup projections",
  );
  const createdAt = requiredString(record.createdAt, "Backup creation instant");
  if (Number.isNaN(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup creation instant must be canonical UTC ISO 8601.",
    );
  }
  return {
    backupFormatVersion: 1,
    exportId: requiredUuid(record.exportId, "Backup export ID"),
    createdAt,
    applicationCommit: requiredString(record.applicationCommit, "Application commit"),
    localSchemaVersion: LOCAL_SCHEMA_VERSION,
    databaseVersion: DATABASE_VERSION,
    source: {
      databaseName: INVENTORY_DATABASE_NAME,
      locationId: requiredUuid(source.locationId, "Backup location ID"),
      deviceId: requiredUuid(source.deviceId, "Backup device ID"),
      deviceCode: requiredString(source.deviceCode, "Backup device code"),
      drawerId: requiredUuid(source.drawerId, "Backup drawer ID"),
      drawerLabel: requiredString(source.drawerLabel, "Backup drawer label"),
    },
    recordCounts: Object.fromEntries(
      payloadNames.map((name) => [
        name,
        requiredInteger(counts[name], `${name} record count`),
      ]),
    ) as Record<PayloadName, number>,
    payloadSha256: Object.fromEntries(
      payloadNames.map((name) => [
        name,
        requiredSha256(hashes[name], `${name} payload hash`),
      ]),
    ) as Record<PayloadName, string>,
    projections: {
      stockByProduct: parseNumberRecord(
        projections.stockByProduct,
        "Stock projection",
      ),
      cashByDrawer: parseNumberRecord(
        projections.cashByDrawer,
        "Cash projection",
      ),
    },
  };
}

export async function validateBackup(
  value: unknown,
): Promise<BackupDocument> {
  const record = asRecord(value, "Backup");
  assertExactKeys(record, ["manifest", "manifestSha256", "payloads"], "Backup");
  const manifest = parseManifest(record.manifest);
  const manifestSha256 = requiredSha256(
    record.manifestSha256,
    "Backup manifest hash",
  );
  if ((await canonicalSha256(manifest)) !== manifestSha256) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup manifest hash does not match.",
    );
  }
  const payloads = parsePayloads(record.payloads);
  const hashes = await payloadHashes(payloads);
  for (const name of payloadNames) {
    if (
      payloads[name].length !== manifest.recordCounts[name] ||
      hashes[name] !== manifest.payloadSha256[name]
    ) {
      throw new RepositoryError(
        "INVALID_RECORD",
        `Backup ${name} count or hash does not match its manifest.`,
      );
    }
  }
  const projections = validateRelationships(payloads);
  await validateOpeningIntegrity(payloads);
  if (canonicalJson(projections) !== canonicalJson(manifest.projections)) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup projections do not rebuild to the manifest values.",
    );
  }
  const device = payloads.deviceState[0]!;
  if (
    manifest.source.locationId !== device.locationId ||
    manifest.source.deviceId !== device.deviceId ||
    manifest.source.deviceCode !== device.deviceCode ||
    manifest.source.drawerId !== device.drawerId ||
    manifest.source.drawerLabel !== device.drawerLabel
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Backup source identity does not match its payload.",
    );
  }
  return { manifest, manifestSha256, payloads };
}

async function addPayloads(
  db: InventoryDatabase,
  payloads: BackupPayloads,
): Promise<void> {
  const writes: Array<Promise<unknown>> = [];
  function add<T, TKey>(table: Table<T, TKey, T>, rows: readonly T[]) {
    if (rows.length) writes.push(table.bulkAdd([...rows]));
  }
  add(db.deviceState, payloads.deviceState);
  add(db.locationSettings, payloads.locationSettings);
  add(db.openingBatches, payloads.openingBatches);
  add(db.products, payloads.products);
  add(db.sales, payloads.sales);
  add(db.saleItems, payloads.saleItems);
  add(db.stockAdjustments, payloads.stockAdjustments);
  add(db.cashAdjustments, payloads.cashAdjustments);
  add(db.outbox, payloads.outbox);
  add(db.syncState, payloads.syncState);
  await Promise.all(writes);
}

async function assertDatabaseMatches(
  db: InventoryDatabase,
  expected: BackupPayloads,
): Promise<void> {
  const actual = await readSnapshot(db);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Restored database does not exactly match the validated backup.",
    );
  }
  validateRelationships(actual);
}

export async function restoreBackupToIsolatedDatabase(
  value: unknown,
  targetName?: string,
): Promise<{ databaseName: string; backup: BackupDocument }> {
  const backup = await validateBackup(value);
  const databaseName =
    targetName ?? `${RESTORE_DATABASE_PREFIX}${backup.manifest.exportId}`;
  if (
    !databaseName.startsWith(RESTORE_DATABASE_PREFIX) ||
    databaseName === INVENTORY_DATABASE_NAME
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Isolated restore database name is not allowed.",
    );
  }
  if (await Dexie.exists(databaseName)) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Isolated restore target already exists; choose a new target.",
    );
  }
  const target = new InventoryDatabase(databaseName);
  try {
    await target.transaction("rw", target.tables, () =>
      addPayloads(target, backup.payloads),
    );
    await assertDatabaseMatches(target, backup.payloads);
    return { databaseName, backup };
  } catch (error) {
    target.close();
    await Dexie.delete(databaseName);
    throw error;
  } finally {
    target.close();
  }
}

export async function restoreSameDeviceBackup(
  db: InventoryDatabase,
  value: unknown,
  options: {
    confirmation: string;
    originalDeviceUnavailable: boolean;
  },
): Promise<BackupDocument> {
  const backup = await validateBackup(value);
  const backedUpDevice = backup.payloads.deviceState[0]!;
  if (
    !options.originalDeviceUnavailable ||
    options.confirmation !== `RESTORE ${backedUpDevice.deviceCode}`
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      `Confirm the original device cannot write and type RESTORE ${backedUpDevice.deviceCode}.`,
    );
  }
  const current = await db.deviceState.get("current");
  if (current && current.deviceId !== backedUpDevice.deviceId) {
    throw new RepositoryError(
      "OWNERSHIP_MISMATCH",
      "A backup from another device cannot replace this installation.",
    );
  }
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await addPayloads(db, backup.payloads);
  });
  await assertDatabaseMatches(db, backup.payloads);
  return backup;
}

export async function resetLocalDatabase(
  db: InventoryDatabase,
  options: {
    confirmation: string;
    backupManifestSha256: string;
  },
): Promise<void> {
  const device = await db.deviceState.get("current");
  if (!device) {
    throw new RepositoryError("NOT_FOUND", "Local installation is already empty.");
  }
  requiredSha256(options.backupManifestSha256, "Backup manifest hash");
  if (options.confirmation !== `RESET ${device.deviceCode}`) {
    throw new RepositoryError(
      "INVALID_RECORD",
      `Type RESET ${device.deviceCode} to clear this local database.`,
    );
  }
  await db.transaction("rw", db.tables, () =>
    Promise.all(db.tables.map((table) => table.clear())),
  );
}

export function backupFileName(backup: BackupDocument): string {
  return `inventory-${backup.manifest.source.deviceCode}-${backup.manifest.createdAt
    .replace(/[:.]/g, "-")}-${backup.manifest.exportId}.json`;
}
