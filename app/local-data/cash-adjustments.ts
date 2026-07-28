import { CURRENCY_CODE, RECORD_SCHEMA_VERSION } from "../domain/constants";
import { projectDrawerCash, validateCashAdjustment } from "../domain/cash";
import { assertBusinessDate, currentInstant, toIsoInstant } from "../domain/time";
import type {
  BusinessDate,
  CashAdjustmentKind,
  UUID,
} from "../domain/types";
import type { InventoryDatabase } from "./database";
import { RepositoryError } from "./errors";
import type { CashAdjustment } from "./models";
import {
  runAggregateMutation,
  type PersistenceDependencies,
} from "./transactions";

export interface CashAdjustmentFields {
  kind: Exclude<
    CashAdjustmentKind,
    "opening_balance" | "drawer_opening"
  >;
  amountMinor: number;
  businessDate: BusinessDate;
  occurredAt?: Date;
  notes?: string;
}

function normalizeNotes(notes?: string): string | undefined {
  const normalized = notes?.normalize("NFC").trim();
  return normalized || undefined;
}

function validateFields(
  fields: CashAdjustmentFields,
  defaultOccurredAt: Date,
) {
  const notes = normalizeNotes(fields.notes);
  validateCashAdjustment(fields.kind, fields.amountMinor, notes);
  return {
    ...fields,
    businessDate: assertBusinessDate(fields.businessDate),
    occurredAt: toIsoInstant(fields.occurredAt ?? defaultOccurredAt),
    ...(notes ? { notes } : {}),
  };
}

async function requiredAdjustment(
  db: InventoryDatabase,
  id: UUID,
): Promise<CashAdjustment> {
  const adjustment = await db.cashAdjustments.get(id);
  if (!adjustment) {
    throw new RepositoryError("NOT_FOUND", "Cash adjustment was not found.");
  }
  return adjustment;
}

function assertMutable(
  adjustment: CashAdjustment,
  deviceId: UUID,
  drawerId: UUID,
  locationId: UUID,
): void {
  if (
    adjustment.kind === "opening_balance" ||
    adjustment.kind === "drawer_opening"
  ) {
    throw new RepositoryError(
      "IMMUTABLE_RECORD",
      "Opening cash is immutable.",
    );
  }
  if (
    adjustment.originDeviceId !== deviceId ||
    adjustment.deviceId !== deviceId ||
    adjustment.drawerId !== drawerId ||
    adjustment.locationId !== locationId
  ) {
    throw new RepositoryError(
      "OWNERSHIP_MISMATCH",
      "Cash adjustment belongs to another device, drawer, or location.",
    );
  }
  if (adjustment.currencyCode !== CURRENCY_CODE) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Cash adjustment currency must be PHP.",
    );
  }
}

export async function createCashAdjustment(
  db: InventoryDatabase,
  fields: CashAdjustmentFields,
  dependencies: PersistenceDependencies,
): Promise<CashAdjustment> {
  const validated = validateFields(fields, dependencies.clock.now());
  return runAggregateMutation(
    db,
    [db.cashAdjustments],
    dependencies,
    async ({ device }) => {
      const instant = currentInstant(dependencies.clock);
      const adjustment: CashAdjustment = {
        id: dependencies.ids.randomUUID(),
        locationId: device.locationId,
        deviceId: device.deviceId,
        drawerId: device.drawerId,
        kind: validated.kind,
        amountMinor: validated.amountMinor,
        currencyCode: CURRENCY_CODE,
        businessDate: validated.businessDate,
        occurredAt: validated.occurredAt,
        ...(validated.notes ? { notes: validated.notes } : {}),
        originDeviceId: device.deviceId,
        revision: 1,
        recordSchemaVersion: RECORD_SCHEMA_VERSION,
        tombstone: 0,
        createdAt: instant,
        updatedAt: instant,
      };
      await db.cashAdjustments.add(adjustment);
      return {
        result: adjustment,
        operation: {
          aggregateType: "cash_adjustment",
          aggregateId: adjustment.id,
          action: "upsert",
          aggregateRevision: adjustment.revision,
          payload: adjustment,
        },
      };
    },
  );
}

export async function updateCashAdjustment(
  db: InventoryDatabase,
  id: UUID,
  fields: CashAdjustmentFields,
  dependencies: PersistenceDependencies,
): Promise<CashAdjustment> {
  const validated = validateFields(fields, dependencies.clock.now());
  return runAggregateMutation(
    db,
    [db.cashAdjustments],
    dependencies,
    async ({ device }) => {
      const existing = await requiredAdjustment(db, id);
      assertMutable(
        existing,
        device.deviceId,
        device.drawerId,
        device.locationId,
      );
      if (existing.tombstone === 1) {
        throw new RepositoryError(
          "IMMUTABLE_RECORD",
          "Voided cash adjustment cannot be edited.",
        );
      }
      const adjustment: CashAdjustment = {
        ...existing,
        kind: validated.kind,
        amountMinor: validated.amountMinor,
        businessDate: validated.businessDate,
        occurredAt: validated.occurredAt,
        revision: existing.revision + 1,
        updatedAt: currentInstant(dependencies.clock),
      };
      delete adjustment.notes;
      if (validated.notes) adjustment.notes = validated.notes;
      await db.cashAdjustments.put(adjustment);
      return {
        result: adjustment,
        operation: {
          aggregateType: "cash_adjustment",
          aggregateId: adjustment.id,
          action: "upsert",
          aggregateRevision: adjustment.revision,
          payload: adjustment,
          baseServerVersion: existing.lastServerVersion,
        },
      };
    },
  );
}

export async function voidCashAdjustment(
  db: InventoryDatabase,
  id: UUID,
  dependencies: PersistenceDependencies,
): Promise<CashAdjustment> {
  return runAggregateMutation(
    db,
    [db.cashAdjustments],
    dependencies,
    async ({ device }) => {
      const existing = await requiredAdjustment(db, id);
      assertMutable(
        existing,
        device.deviceId,
        device.drawerId,
        device.locationId,
      );
      if (existing.tombstone === 1) {
        return {
          result: existing,
          operation: {
            aggregateType: "cash_adjustment",
            aggregateId: existing.id,
            action: "delete",
            aggregateRevision: existing.revision,
            payload: existing,
          },
        };
      }
      const instant = currentInstant(dependencies.clock);
      const adjustment: CashAdjustment = {
        ...existing,
        revision: existing.revision + 1,
        tombstone: 1,
        deletedAt: instant,
        updatedAt: instant,
      };
      await db.cashAdjustments.put(adjustment);
      return {
        result: adjustment,
        operation: {
          aggregateType: "cash_adjustment",
          aggregateId: adjustment.id,
          action: "delete",
          aggregateRevision: adjustment.revision,
          payload: adjustment,
          baseServerVersion: existing.lastServerVersion,
        },
      };
    },
  );
}

export async function rebuildDrawerCash(
  db: InventoryDatabase,
  drawerId: UUID,
): Promise<number> {
  const [adjustments, sales] = await Promise.all([
    db.cashAdjustments.where("drawerId").equals(drawerId).toArray(),
    db.sales.where("drawerId").equals(drawerId).toArray(),
  ]);
  const saleRows = await Promise.all(
    sales.map(async (sale) => ({
      drawerId: sale.drawerId,
      tombstone: sale.tombstone,
      items: await db.saleItems.where("saleId").equals(sale.id).toArray(),
    })),
  );
  return projectDrawerCash(drawerId, adjustments, saleRows);
}
