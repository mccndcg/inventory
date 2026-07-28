import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { normalizeDeviceCode } from "../app/domain/identity";
import { projectDrawerCash } from "../app/domain/cash";
import { businessDateFor } from "../app/domain/time";
import { canonicalJson } from "../app/local-data/canonical";
import type {
  AggregateType,
  CashAdjustment,
  DeviceDirectoryEntry,
  LocationSettings,
  OutboxOperation,
} from "../app/local-data/models";
import {
  parseCashAdjustment,
  parseOpeningBatch,
  parseProduct,
  parseSale,
  parseSaleItem,
  parseStockAdjustment,
} from "../app/local-data/validation";
import {
  enrollmentRequestSchema,
  MAX_PULL_CHANGES,
  MAX_PUSH_OPERATIONS,
  type EnrollmentRequest,
  type EnrollmentResponse,
  type OperationReceipt,
  type PullResponse,
  type PushResponse,
  SyncProtocolError,
} from "../app/sync/protocol";

interface ConfigRow {
  password_salt: string;
  password_hash: string;
  location_id: string | null;
  location_code: string | null;
  location_name: string | null;
  currency_code: string;
  business_timezone: string;
}

interface DeviceRow {
  device_id: string;
  device_code: string;
  location_id: string;
  drawer_id: string;
  drawer_label: string;
  token_hash: string;
  status: "active" | "revoked" | "decommissioned";
  next_sequence: number;
  provisioned_at: string;
  decommissioned_at: string | null;
  server_version: string;
}

interface AggregateRow {
  aggregate_type: AggregateType;
  aggregate_id: string;
  origin_device_id: string;
  revision: number;
  server_version: string;
  tombstone: number;
  payload_json: string;
}

interface ReceiptRow {
  operation_id: string;
  device_id: string;
  device_sequence: number;
  request_hash: string;
  status: "accepted" | "rejected";
  server_version: string | null;
  error_code: string | null;
  canonical_json: string | null;
}

const PASSWORD_KEY_BYTES = 64;
const TOKEN_BYTES = 32;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function passwordHash(password: string, salt: Buffer): Buffer {
  return scryptSync(password.normalize("NFC"), salt, PASSWORD_KEY_BYTES, {
    N: 16_384,
    r: 8,
    p: 1,
  });
}

function normalizedLabel(value: string, label: string): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized) throw new SyncProtocolError("INVALID_ENROLLMENT", `${label} is required.`);
  return normalized;
}

function directoryEntry(row: DeviceRow): DeviceDirectoryEntry {
  return {
    deviceId: row.device_id,
    deviceCode: row.device_code,
    locationId: row.location_id,
    drawerId: row.drawer_id,
    drawerLabel: row.drawer_label,
    status: row.status,
    provisionedAt: row.provisioned_at,
    ...(row.decommissioned_at ? { decommissionedAt: row.decommissioned_at } : {}),
    serverVersion: row.server_version,
  };
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function receipt(row: ReceiptRow): OperationReceipt {
  return {
    operationId: row.operation_id,
    deviceSequence: row.device_sequence,
    status: row.status,
    ...(row.server_version ? { serverVersion: row.server_version } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.canonical_json ? { canonicalPayload: parseJson(row.canonical_json) } : {}),
  };
}

function operationPayload(operation: OutboxOperation): {
  originDeviceId: string;
  locationId: string;
  revision: number;
  tombstone: number;
  payload: unknown;
} {
  switch (operation.aggregateType) {
    case "product": {
      const value = parseProduct(operation.payload);
      return {
        originDeviceId: value.originDeviceId,
        locationId: value.locationId,
        revision: value.revision,
        tombstone: value.tombstone,
        payload: value,
      };
    }
    case "sale": {
      const candidate = operation.payload as { sale?: unknown; items?: unknown };
      const sale = parseSale(candidate?.sale);
      const items = Array.isArray(candidate?.items)
        ? candidate.items.map(parseSaleItem)
        : (() => { throw new SyncProtocolError("INVALID_PAYLOAD", "Sale items are required."); })();
      if (items.length === 0 || items.some((item) => item.saleId !== sale.id)) {
        throw new SyncProtocolError("INVALID_PAYLOAD", "Sale items must belong to the sale.");
      }
      const positions = items.map(({ position }) => position);
      if (new Set(positions).size !== positions.length) {
        throw new SyncProtocolError("INVALID_PAYLOAD", "Sale item positions must be unique.");
      }
      return {
        originDeviceId: sale.originDeviceId,
        locationId: sale.locationId,
        revision: sale.revision,
        tombstone: sale.tombstone,
        payload: { sale, items },
      };
    }
    case "stock_adjustment": {
      const value = parseStockAdjustment(operation.payload);
      return {
        originDeviceId: value.originDeviceId,
        locationId: value.locationId,
        revision: value.revision,
        tombstone: value.tombstone,
        payload: value,
      };
    }
    case "cash_adjustment": {
      const value = parseCashAdjustment(operation.payload);
      return {
        originDeviceId: value.originDeviceId,
        locationId: value.locationId,
        revision: value.revision,
        tombstone: value.tombstone,
        payload: value,
      };
    }
    case "opening_batch": {
      const candidate = operation.payload as {
        batch?: unknown;
        stockAdjustments?: unknown;
        cashAdjustments?: unknown;
      };
      const batch = parseOpeningBatch(candidate?.batch);
      const stockAdjustments = Array.isArray(candidate?.stockAdjustments)
        ? candidate.stockAdjustments.map(parseStockAdjustment)
        : [];
      const cashAdjustments = Array.isArray(candidate?.cashAdjustments)
        ? candidate.cashAdjustments.map(parseCashAdjustment)
        : [];
      if (
        batch.status !== "finalized" ||
        stockAdjustments.some((row) => row.openingBatchId !== batch.id) ||
        cashAdjustments.some((row) => row.openingBatchId !== batch.id)
      ) {
        throw new SyncProtocolError("INVALID_OPENING", "Opening batch is incomplete.");
      }
      const report = batch.reportPayload;
      const stockById = new Map(
        stockAdjustments.map((row) => [row.id, row]),
      );
      const cashById = new Map(cashAdjustments.map((row) => [row.id, row]));
      const stockMatches =
        stockAdjustments.length === report.stockLines.length &&
        report.stockLines.every((line) => {
          const row = stockById.get(line.adjustmentId);
          return (
            row?.productId === line.productId &&
            row.quantityDelta === line.countedQuantity &&
            row.kind === "opening_count" &&
            row.openingKey ===
              `opening:${batch.id}:product:${line.productId}`
          );
        });
      const cashMatches =
        cashAdjustments.length === report.cashLines.length &&
        report.cashLines.every((line) => {
          const row = cashById.get(line.adjustmentId);
          return (
            row?.deviceId === line.deviceId &&
            row.drawerId === line.drawerId &&
            row.amountMinor === line.countedAmountMinor &&
            row.kind === "opening_balance" &&
            row.openingKey ===
              `location:${batch.locationId}:drawer:${line.drawerId}`
          );
        });
      if (
        batch.locationOpeningKey !== `location:${batch.locationId}` ||
        batch.reportSha256 !== sha256(canonicalJson(report)) ||
        report.authoritativeDevice.deviceId !== batch.originDeviceId ||
        !stockMatches ||
        !cashMatches
      ) {
        throw new SyncProtocolError(
          "INVALID_OPENING",
          "Opening report hash or normalized records do not match.",
        );
      }
      return {
        originDeviceId: batch.originDeviceId,
        locationId: batch.locationId,
        revision: batch.revision,
        tombstone: 0,
        payload: { batch, stockAdjustments, cashAdjustments },
      };
    }
  }
}

function withServerVersion(
  aggregateType: AggregateType,
  payload: unknown,
  serverVersion: string,
): unknown {
  if (aggregateType === "sale") {
    const value = payload as { sale: Record<string, unknown>; items: unknown[] };
    return { ...value, sale: { ...value.sale, lastServerVersion: serverVersion } };
  }
  if (aggregateType === "opening_batch") {
    const value = payload as {
      batch: Record<string, unknown>;
      stockAdjustments: Array<Record<string, unknown>>;
      cashAdjustments: Array<Record<string, unknown>>;
    };
    return {
      ...value,
      batch: { ...value.batch, lastServerVersion: serverVersion },
      stockAdjustments: value.stockAdjustments.map((row) => ({
        ...row,
        lastServerVersion: serverVersion,
      })),
      cashAdjustments: value.cashAdjustments.map((row) => ({
        ...row,
        lastServerVersion: serverVersion,
      })),
    };
  }
  return { ...(payload as Record<string, unknown>), lastServerVersion: serverVersion };
}

export class SyncStore {
  readonly db: DatabaseSync;

  constructor(filename: string, enrollmentPassword: string) {
    if (!enrollmentPassword) {
      throw new Error("SYNC_ENROLLMENT_PASSWORD is required.");
    }
    this.db = new DatabaseSync(filename);
    try {
      this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
      this.migrate();
      this.initializePassword(enrollmentPassword);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        location_id TEXT,
        location_code TEXT,
        location_name TEXT,
        currency_code TEXT NOT NULL DEFAULT 'PHP',
        business_timezone TEXT NOT NULL DEFAULT 'Asia/Manila'
      );
      CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        device_code TEXT NOT NULL UNIQUE,
        location_id TEXT NOT NULL,
        drawer_id TEXT NOT NULL UNIQUE,
        drawer_label TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('active','revoked','decommissioned')),
        next_sequence INTEGER NOT NULL DEFAULT 1,
        provisioned_at TEXT NOT NULL,
        decommissioned_at TEXT,
        server_version TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS aggregates (
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        origin_device_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        server_version TEXT NOT NULL,
        tombstone INTEGER NOT NULL CHECK (tombstone IN (0,1)),
        payload_json TEXT NOT NULL,
        PRIMARY KEY (aggregate_type, aggregate_id)
      );
      CREATE TABLE IF NOT EXISTS changes (
        cursor INTEGER PRIMARY KEY,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        server_version TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS operation_receipts (
        operation_id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_sequence INTEGER NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('accepted','rejected')),
        server_version TEXT,
        error_code TEXT,
        canonical_json TEXT,
        UNIQUE (device_id, device_sequence)
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        occurred_at TEXT NOT NULL,
        event_type TEXT NOT NULL,
        device_id TEXT,
        detail_code TEXT
      );
    `);
  }

  private initializePassword(password: string): void {
    const row = this.db.prepare("SELECT * FROM config WHERE id = 1").get() as
      | ConfigRow
      | undefined;
    if (!row) {
      const salt = randomBytes(16);
      this.db.prepare(`
        INSERT INTO config (id, password_salt, password_hash)
        VALUES (1, ?, ?)
      `).run(salt.toString("hex"), passwordHash(password, salt).toString("hex"));
      return;
    }
    if (!this.verifyPassword(password, row)) {
      throw new Error("Configured enrollment password does not match this sync database.");
    }
  }

  private verifyPassword(password: string, config?: ConfigRow): boolean {
    const row = config ?? this.config();
    const actual = passwordHash(password, Buffer.from(row.password_salt, "hex"));
    const expected = Buffer.from(row.password_hash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private config(): ConfigRow {
    const row = this.db.prepare("SELECT * FROM config WHERE id = 1").get() as
      | ConfigRow
      | undefined;
    if (!row) throw new Error("Sync configuration is missing.");
    return row;
  }

  private settings(): LocationSettings {
    const config = this.config();
    if (!config.location_id || !config.location_code || !config.location_name) {
      throw new SyncProtocolError("LOCATION_NOT_INITIALIZED", "First device must initialize the location.");
    }
    return {
      key: "location",
      locationId: config.location_id,
      locationCode: config.location_code,
      locationName: config.location_name,
      currencyCode: "PHP",
      businessTimezone: "Asia/Manila",
      settingsVersion: 1,
    };
  }

  enroll(inputValue: EnrollmentRequest): EnrollmentResponse {
    const parsed = enrollmentRequestSchema.safeParse(inputValue);
    if (!parsed.success) {
      throw new SyncProtocolError("INVALID_ENROLLMENT", parsed.error.issues[0]?.message ?? "Invalid enrollment.");
    }
    const input = parsed.data;
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentFailures = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM audit_log
      WHERE event_type = 'enrollment_rejected' AND occurred_at >= ?
    `).get(cutoff) as { count: number };
    if (recentFailures.count >= 5) {
      throw new SyncProtocolError(
        "ENROLLMENT_RATE_LIMITED",
        "Too many incorrect password attempts. Try again later.",
        429,
      );
    }
    if (!this.verifyPassword(input.password)) {
      this.audit("enrollment_rejected", undefined, "INVALID_PASSWORD");
      throw new SyncProtocolError("INVALID_PASSWORD", "The shop password is incorrect.", 401);
    }
    return this.transaction(() => this.enrollVerified(input));
  }

  private enrollVerified(input: EnrollmentRequest): EnrollmentResponse {
    const config = this.config();
    const locationWasInitialized = Boolean(config.location_id);
    let locationId = config.location_id;
    if (!locationId) {
      if (!input.existingIdentity || !input.initialSettings) {
        throw new SyncProtocolError(
          "LOCATION_NOT_INITIALIZED",
          "The first device must provide its existing identity and location settings.",
        );
      }
      if (input.existingIdentity.locationId !== input.initialSettings.locationId) {
        throw new SyncProtocolError("INVALID_ENROLLMENT", "Identity and settings locations differ.");
      }
      locationId = input.existingIdentity.locationId;
      this.db.prepare(`
        UPDATE config
        SET location_id = ?, location_code = ?, location_name = ?
        WHERE id = 1
      `).run(
        locationId,
        normalizedLabel(input.initialSettings.locationCode, "Location code"),
        normalizedLabel(input.initialSettings.locationName, "Location name"),
      );
    }
    if (input.existingIdentity && input.existingIdentity.locationId !== locationId) {
      throw new SyncProtocolError("LOCATION_MISMATCH", "Device belongs to another location.");
    }

    const deviceId = input.existingIdentity?.deviceId ?? randomUUID();
    const drawerId = input.existingIdentity?.drawerId ?? randomUUID();
    const deviceCode = normalizeDeviceCode(input.deviceCode);
    const drawerLabel = normalizedLabel(input.drawerLabel, "Drawer label");
    const credential = randomBytes(TOKEN_BYTES).toString("base64url");
    const provisionedAt = new Date().toISOString();
    const cursor = this.nextCursor();
    const serverVersion = `v${cursor}`;
    const matchingRows = this.db.prepare(`
      SELECT * FROM devices
      WHERE device_id = ? OR device_code = ? OR drawer_id = ?
    `).all(deviceId, deviceCode, drawerId) as DeviceRow[];
    if (matchingRows.length) {
      const exact = matchingRows.find(
        (row) =>
          row.device_id === deviceId &&
          row.device_code === deviceCode &&
          row.drawer_id === drawerId &&
          row.location_id === locationId,
      );
      if (!exact || exact.status !== "active") {
        throw new SyncProtocolError(
          "DEVICE_ALREADY_EXISTS",
          "Device code or identity is already assigned.",
          409,
        );
      }
      this.db.prepare(
        "UPDATE devices SET token_hash = ? WHERE device_id = ?",
      ).run(sha256(credential), deviceId);
      this.audit("device_credential_rotated", deviceId);
      return {
        credential,
        device: directoryEntry({ ...exact, token_hash: sha256(credential) }),
        settings: this.settings(),
        cursor: "0",
      };
    }
    try {
      this.db.prepare(`
        INSERT INTO devices (
          device_id, device_code, location_id, drawer_id, drawer_label,
          token_hash, status, next_sequence, provisioned_at, server_version
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)
      `).run(
        deviceId,
        deviceCode,
        locationId,
        drawerId,
        drawerLabel,
        sha256(credential),
        provisionedAt,
        serverVersion,
      );
    } catch (error) {
      throw new SyncProtocolError(
        "DEVICE_ALREADY_EXISTS",
        error instanceof Error ? error.message : "Device identity is already enrolled.",
        409,
      );
    }
    if (locationWasInitialized) {
      this.commissionZeroDrawer({
        deviceId,
        deviceCode,
        drawerId,
        drawerLabel,
        locationId,
        occurredAt: provisionedAt,
      });
    }
    this.audit("device_enrolled", deviceId);
    const device = this.deviceById(deviceId);
    return {
      credential,
      device: directoryEntry(device),
      settings: this.settings(),
      cursor: "0",
    };
  }

  private commissionZeroDrawer(input: {
    deviceId: string;
    deviceCode: string;
    drawerId: string;
    drawerLabel: string;
    locationId: string;
    occurredAt: string;
  }): void {
    const adjustmentId = randomUUID();
    const reportPayload = {
      reportFormatVersion: 1,
      cashAdjustmentId: adjustmentId,
      applicationCommit: "server-generated",
      localSchemaVersion: 2,
      locationId: input.locationId,
      deviceId: input.deviceId,
      deviceCode: input.deviceCode,
      drawerId: input.drawerId,
      drawerLabel: input.drawerLabel,
      currencyCode: "PHP",
      countedAt: input.occurredAt,
      businessDate: businessDateFor(new Date(input.occurredAt)),
      countedAmountMinor: 0,
      oldDrawerClosureAdjustmentIds: [],
      recorder: {
        displayName: "Shop-password enrollment",
        recordedAt: input.occurredAt,
      },
      verifier: {
        displayName: "Shop-password enrollment",
        verifiedAt: input.occurredAt,
      },
      notes: ["New synchronized drawer commissioned at zero cash."],
    };
    const cursor = this.nextCursor();
    const serverVersion = `v${cursor}`;
    const adjustment: CashAdjustment = parseCashAdjustment({
      id: adjustmentId,
      locationId: input.locationId,
      deviceId: input.deviceId,
      drawerId: input.drawerId,
      openingKey: `location:${input.locationId}:drawer:${input.drawerId}`,
      commissioningReportPayload: reportPayload,
      commissioningReportSha256: sha256(canonicalJson(reportPayload)),
      commissioningApprovedBy: "Shop-password enrollment",
      commissioningApprovedAt: input.occurredAt,
      kind: "drawer_opening",
      amountMinor: 0,
      currencyCode: "PHP",
      businessDate: reportPayload.businessDate,
      occurredAt: input.occurredAt,
      notes: "Automatically commissioned at zero cash.",
      originDeviceId: input.deviceId,
      revision: 1,
      recordSchemaVersion: 1,
      tombstone: 0,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
      lastServerVersion: serverVersion,
    });
    const payloadJson = canonicalJson(adjustment);
    this.db.prepare(`
      INSERT INTO aggregates (
        aggregate_type, aggregate_id, location_id, origin_device_id,
        revision, server_version, tombstone, payload_json
      ) VALUES ('cash_adjustment', ?, ?, ?, 1, ?, 0, ?)
    `).run(
      adjustment.id,
      input.locationId,
      input.deviceId,
      serverVersion,
      payloadJson,
    );
    this.db.prepare(`
      INSERT INTO changes (
        cursor, aggregate_type, aggregate_id, server_version, payload_json
      ) VALUES (?, 'cash_adjustment', ?, ?, ?)
    `).run(cursor, adjustment.id, serverVersion, payloadJson);
    this.audit("drawer_commissioned_zero", input.deviceId);
  }

  authenticate(credential: string): DeviceRow {
    const row = this.db.prepare(
      "SELECT * FROM devices WHERE token_hash = ?",
    ).get(sha256(credential)) as DeviceRow | undefined;
    if (!row || row.status !== "active") {
      throw new SyncProtocolError("UNAUTHORIZED_DEVICE", "Device credential is invalid or revoked.", 401);
    }
    return row;
  }

  push(credential: string, operations: OutboxOperation[]): PushResponse {
    const device = this.authenticate(credential);
    if (operations.length > MAX_PUSH_OPERATIONS) {
      throw new SyncProtocolError("BATCH_TOO_LARGE", "Push exceeds 100 operations.", 413);
    }
    return this.transaction(() => {
      const currentDevice = this.deviceById(device.device_id);
      let expected = currentDevice.next_sequence;
      const receipts: OperationReceipt[] = [];
      for (const operation of operations) {
        const requestHash = sha256(canonicalJson(operation));
        const prior = this.db.prepare(
          "SELECT * FROM operation_receipts WHERE operation_id = ?",
        ).get(operation.operationId) as ReceiptRow | undefined;
        if (prior) {
          if (prior.request_hash !== requestHash || prior.device_id !== device.device_id) {
            throw new SyncProtocolError("OPERATION_ID_REUSED", "Operation ID was reused.", 409);
          }
          receipts.push(receipt(prior));
          continue;
        }
        const priorSequence = this.db.prepare(`
          SELECT * FROM operation_receipts
          WHERE device_id = ? AND device_sequence = ?
        `).get(device.device_id, operation.deviceSequence) as ReceiptRow | undefined;
        if (priorSequence) {
          throw new SyncProtocolError("DEVICE_SEQUENCE_REUSED", "Device sequence was reused.", 409);
        }
        if (operation.deviceSequence !== expected) {
          throw new SyncProtocolError("DEVICE_SEQUENCE_GAP", `Expected device sequence ${expected}.`, 409);
        }
        if (operation.deviceId !== device.device_id) {
          throw new SyncProtocolError("DEVICE_MISMATCH", "Operation belongs to another device.", 403);
        }

        let result: OperationReceipt;
        try {
          result = this.acceptOperation(device, operation, requestHash);
        } catch (error) {
          const permanent =
            error instanceof SyncProtocolError ||
            (error instanceof Error &&
              (error.name === "RepositoryError" ||
                error.name === "DomainError"));
          if (!permanent) throw error;
          const code = error instanceof SyncProtocolError
            ? error.code
            : "INVALID_PAYLOAD";
          this.db.prepare(`
            INSERT INTO operation_receipts (
              operation_id, device_id, device_sequence, request_hash,
              status, error_code
            ) VALUES (?, ?, ?, ?, 'rejected', ?)
          `).run(
            operation.operationId,
            device.device_id,
            operation.deviceSequence,
            requestHash,
            code,
          );
          result = {
            operationId: operation.operationId,
            deviceSequence: operation.deviceSequence,
            status: "rejected",
            errorCode: code,
          };
        }
        expected += 1;
        receipts.push(result);
      }
      this.db.prepare("UPDATE devices SET next_sequence = ? WHERE device_id = ?")
        .run(expected, device.device_id);
      return { receipts };
    });
  }

  private acceptOperation(
    device: DeviceRow,
    operation: OutboxOperation,
    requestHash: string,
  ): OperationReceipt {
    if (operation.operationSchemaVersion !== 1) {
      throw new SyncProtocolError("UNSUPPORTED_SCHEMA", "Operation schema is unsupported.");
    }
    if (
      operation.aggregateId !==
      (operation.aggregateType === "sale"
        ? (operation.payload as { sale?: { id?: string } })?.sale?.id
        : operation.aggregateType === "opening_batch"
          ? (operation.payload as { batch?: { id?: string } })?.batch?.id
          : (operation.payload as { id?: string })?.id)
    ) {
      throw new SyncProtocolError("AGGREGATE_ID_MISMATCH", "Envelope and payload IDs differ.");
    }
    const parsed = operationPayload(operation);
    if (
      (operation.aggregateType !== "product" &&
        parsed.originDeviceId !== device.device_id) ||
      parsed.locationId !== device.location_id ||
      parsed.revision !== operation.aggregateRevision
    ) {
      throw new SyncProtocolError("OWNERSHIP_MISMATCH", "Aggregate identity or revision is invalid.");
    }
    const existing = this.db.prepare(`
      SELECT * FROM aggregates WHERE aggregate_type = ? AND aggregate_id = ?
    `).get(operation.aggregateType, operation.aggregateId) as AggregateRow | undefined;
    if (existing && operation.aggregateType === "opening_batch") {
      throw new SyncProtocolError(
        "IMMUTABLE_OPENING",
        "The finalized location opening is immutable.",
        409,
      );
    }
    if (
      existing?.tombstone === 1 &&
      parsed.tombstone === 0 &&
      operation.aggregateType !== "product"
    ) {
      throw new SyncProtocolError(
        "INVALID_RESTORE",
        "Voided sales and adjustments cannot be restored.",
        409,
      );
    }
    if (operation.aggregateType === "cash_adjustment") {
      const incoming = parsed.payload as CashAdjustment;
      const prior = existing
        ? parseCashAdjustment(parseJson(existing.payload_json))
        : undefined;
      if (
        incoming.kind === "opening_balance" ||
        incoming.kind === "drawer_opening" ||
        prior?.kind === "opening_balance" ||
        prior?.kind === "drawer_opening"
      ) {
        throw new SyncProtocolError(
          "IMMUTABLE_OPENING",
          "Opening cash records are server-managed and immutable.",
          409,
        );
      }
    }
    if (existing) {
      if (
        operation.aggregateType !== "product" &&
        existing.origin_device_id !== device.device_id
      ) {
        throw new SyncProtocolError("ORIGIN_DEVICE_CONFLICT", "Only the origin device may change this aggregate.");
      }
      if (
        operation.aggregateType === "product" &&
        operation.baseServerVersion !== existing.server_version
      ) {
        throw new SyncProtocolError("PRODUCT_CONFLICT", "Product changed on another device.");
      }
      if (parsed.revision !== existing.revision + 1) {
        throw new SyncProtocolError("REVISION_CONFLICT", "Aggregate revision is stale.");
      }
    } else if (parsed.revision !== 1) {
      throw new SyncProtocolError("REVISION_CONFLICT", "New aggregate must start at revision 1.");
    }
    if (operation.aggregateType === "opening_batch") {
      const opening = this.db.prepare(
        "SELECT aggregate_id FROM aggregates WHERE aggregate_type = 'opening_batch'",
      ).get();
      if (opening && !existing) {
        throw new SyncProtocolError("OPENING_ALREADY_EXISTS", "Location opening already exists.");
      }
    }

    const cursor = this.nextCursor();
    const serverVersion = `v${cursor}`;
    const canonicalPayload = withServerVersion(
      operation.aggregateType,
      parsed.payload,
      serverVersion,
    );
    const payloadJson = canonicalJson(canonicalPayload);
    this.db.prepare(`
      INSERT INTO aggregates (
        aggregate_type, aggregate_id, location_id, origin_device_id,
        revision, server_version, tombstone, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(aggregate_type, aggregate_id) DO UPDATE SET
        revision = excluded.revision,
        server_version = excluded.server_version,
        tombstone = excluded.tombstone,
        payload_json = excluded.payload_json
    `).run(
      operation.aggregateType,
      operation.aggregateId,
      parsed.locationId,
      existing?.origin_device_id ?? parsed.originDeviceId,
      parsed.revision,
      serverVersion,
      parsed.tombstone,
      payloadJson,
    );
    this.db.prepare(`
      INSERT INTO changes (
        cursor, aggregate_type, aggregate_id, server_version, payload_json
      ) VALUES (?, ?, ?, ?, ?)
    `).run(cursor, operation.aggregateType, operation.aggregateId, serverVersion, payloadJson);
    this.db.prepare(`
      INSERT INTO operation_receipts (
        operation_id, device_id, device_sequence, request_hash,
        status, server_version, canonical_json
      ) VALUES (?, ?, ?, ?, 'accepted', ?, ?)
    `).run(
      operation.operationId,
      device.device_id,
      operation.deviceSequence,
      requestHash,
      serverVersion,
      payloadJson,
    );
    this.audit("operation_accepted", device.device_id);
    return {
      operationId: operation.operationId,
      deviceSequence: operation.deviceSequence,
      status: "accepted",
      serverVersion,
      canonicalPayload,
    };
  }

  pull(credential: string, cursorValue = "0", limit = MAX_PULL_CHANGES): PullResponse {
    const device = this.authenticate(credential);
    const cursor = Number(cursorValue);
    if (!Number.isSafeInteger(cursor) || cursor < 0) {
      throw new SyncProtocolError("INVALID_CURSOR", "Cursor is invalid.");
    }
    const boundedLimit = Math.max(1, Math.min(limit, MAX_PULL_CHANGES));
    const rows = this.db.prepare(`
      SELECT * FROM changes
      WHERE cursor > ?
      ORDER BY cursor
      LIMIT ?
    `).all(cursor, boundedLimit + 1) as Array<{
      cursor: number;
      aggregate_type: AggregateType;
      aggregate_id: string;
      server_version: string;
      payload_json: string;
    }>;
    const selected = rows.slice(0, boundedLimit);
    const nextCursor = selected.at(-1)?.cursor ?? cursor;
    return {
      changes: selected.map((row) => ({
        cursor: String(row.cursor),
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        serverVersion: row.server_version,
        payload: parseJson(row.payload_json),
      })),
      cursor: String(nextCursor),
      hasMore: rows.length > boundedLimit,
      settings: this.settings(),
      devices: this.listDevices(device.location_id),
    };
  }

  revoke(password: string, deviceId: string): void {
    if (!this.verifyPassword(password)) {
      throw new SyncProtocolError("INVALID_PASSWORD", "The shop password is incorrect.", 401);
    }
    const changed = this.db.prepare(`
      UPDATE devices
      SET status = 'revoked', decommissioned_at = ?
      WHERE device_id = ? AND status = 'active'
    `).run(new Date().toISOString(), deviceId);
    if (Number(changed.changes) !== 1) {
      throw new SyncProtocolError("DEVICE_NOT_FOUND", "Active device was not found.", 404);
    }
    this.audit("device_revoked", deviceId);
  }

  decommission(password: string, deviceId: string): void {
    if (!this.verifyPassword(password)) {
      throw new SyncProtocolError(
        "INVALID_PASSWORD",
        "The shop password is incorrect.",
        401,
      );
    }
    this.transaction(() => {
      const device = this.deviceById(deviceId);
      if (device.status !== "active") {
        throw new SyncProtocolError(
          "DEVICE_NOT_FOUND",
          "Active device was not found.",
          404,
        );
      }
      if (this.drawerCash(device.drawer_id) !== 0) {
        throw new SyncProtocolError(
          "DRAWER_NOT_ZERO",
          "The drawer must synchronize a zero cash balance before planned decommissioning.",
          409,
        );
      }
      this.db.prepare(`
        UPDATE devices
        SET status = 'decommissioned', decommissioned_at = ?
        WHERE device_id = ?
      `).run(new Date().toISOString(), deviceId);
      this.audit("device_decommissioned", deviceId);
    });
  }

  private drawerCash(drawerId: string): number {
    const rows = this.db.prepare(`
      SELECT aggregate_type, payload_json
      FROM aggregates
      WHERE aggregate_type IN ('cash_adjustment', 'sale') AND tombstone = 0
    `).all() as Array<{
      aggregate_type: "cash_adjustment" | "sale";
      payload_json: string;
    }>;
    const adjustments = rows
      .filter((row) => row.aggregate_type === "cash_adjustment")
      .map((row) => parseCashAdjustment(parseJson(row.payload_json)));
    const sales = rows
      .filter((row) => row.aggregate_type === "sale")
      .map((row) => {
        const payload = parseJson(row.payload_json) as {
          sale?: unknown;
          items?: unknown;
        };
        const sale = parseSale(payload.sale);
        const items = Array.isArray(payload.items)
          ? payload.items.map(parseSaleItem)
          : [];
        return {
          drawerId: sale.drawerId,
          tombstone: sale.tombstone,
          items,
        };
      });
    return projectDrawerCash(drawerId, adjustments, sales);
  }

  listDevices(locationId?: string): DeviceDirectoryEntry[] {
    const rows = (
      locationId
        ? this.db.prepare("SELECT * FROM devices WHERE location_id = ? ORDER BY device_code").all(locationId)
        : this.db.prepare("SELECT * FROM devices ORDER BY device_code").all()
    ) as DeviceRow[];
    return rows.map(directoryEntry);
  }

  private deviceById(deviceId: string): DeviceRow {
    const row = this.db.prepare("SELECT * FROM devices WHERE device_id = ?").get(deviceId) as
      | DeviceRow
      | undefined;
    if (!row) throw new SyncProtocolError("DEVICE_NOT_FOUND", "Device was not found.", 404);
    return row;
  }

  private nextCursor(): number {
    const row = this.db.prepare(
      "SELECT COALESCE(MAX(cursor), 0) + 1 AS cursor FROM changes",
    ).get() as { cursor: number };
    return row.cursor;
  }

  private audit(eventType: string, deviceId?: string, detailCode?: string): void {
    this.db.prepare(`
      INSERT INTO audit_log (occurred_at, event_type, device_id, detail_code)
      VALUES (?, ?, ?, ?)
    `).run(new Date().toISOString(), eventType, deviceId ?? null, detailCode ?? null);
  }

  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
