import type { Table } from "dexie";
import { makeReceiptIdentity } from "../domain/identity";
import { assertSafeInteger } from "../domain/integers";
import { currentInstant } from "../domain/time";
import type { Clock, IdSource } from "../domain/types";
import type { InventoryDatabase } from "./database";
import { RepositoryError } from "./errors";
import type {
  AggregateType,
  DeviceState,
  OutboxOperation,
} from "./models";

export interface PersistenceDependencies {
  clock: Clock;
  ids: IdSource;
}

export interface PendingOperation {
  aggregateType: AggregateType;
  aggregateId: string;
  action: "upsert" | "delete";
  aggregateRevision: number;
  payload: unknown;
  baseServerVersion?: string;
}

export interface AggregateTransactionContext {
  device: Readonly<DeviceState>;
  allocateReceipt(): {
    receiptSequence: number;
    receiptNumber: string;
  };
}

export interface AggregateMutationResult<T> {
  result: T;
  operation: PendingOperation;
}

function nextSequence(current: number, label: string): number {
  assertSafeInteger(current, label, "INVALID_QUANTITY");
  if (current < 1 || current === Number.MAX_SAFE_INTEGER) {
    throw new RepositoryError("INVALID_RECORD", `${label} cannot advance.`);
  }
  return current + 1;
}

function clonePayload(payload: unknown): unknown {
  try {
    return structuredClone(payload);
  } catch {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Outbox payload must be structured-cloneable.",
    );
  }
}

export async function runAggregateMutation<T>(
  db: InventoryDatabase,
  aggregateTables: readonly Table[],
  dependencies: PersistenceDependencies,
  work: (
    context: AggregateTransactionContext,
  ) => Promise<AggregateMutationResult<T>>,
): Promise<T> {
  const tables = [...new Set([db.deviceState, db.outbox, ...aggregateTables])];
  return db.transaction("rw", tables, async () => {
    const storedDevice = await db.deviceState.get("current");
    if (!storedDevice) {
      throw new RepositoryError(
        "NOT_FOUND",
        "Installation is not initialized.",
      );
    }
    const device = { ...storedDevice };
    let receiptAllocated = false;
    const mutation = await work({
      device,
      allocateReceipt: () => {
        if (receiptAllocated) {
          throw new RepositoryError(
            "INVALID_RECORD",
            "Only one receipt may be allocated per mutation.",
          );
        }
        receiptAllocated = true;
        const receipt = makeReceiptIdentity(
          device.deviceCode,
          device.nextReceiptSequence,
        );
        device.nextReceiptSequence = nextSequence(
          device.nextReceiptSequence,
          "Receipt sequence",
        );
        return receipt;
      },
    });

    assertSafeInteger(
      mutation.operation.aggregateRevision,
      "Aggregate revision",
      "INVALID_QUANTITY",
    );
    if (mutation.operation.aggregateRevision < 1) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Aggregate revision must be positive.",
      );
    }

    const operation: OutboxOperation = {
      operationId: dependencies.ids.randomUUID(),
      deviceId: device.deviceId,
      deviceSequence: device.nextOperationSequence,
      aggregateType: mutation.operation.aggregateType,
      aggregateId: mutation.operation.aggregateId,
      action: mutation.operation.action,
      aggregateRevision: mutation.operation.aggregateRevision,
      operationSchemaVersion: 1,
      payload: clonePayload(mutation.operation.payload),
      createdAt: currentInstant(dependencies.clock),
      status: "pending",
      attemptCount: 0,
      ...(mutation.operation.baseServerVersion
        ? { baseServerVersion: mutation.operation.baseServerVersion }
        : {}),
    };
    device.nextOperationSequence = nextSequence(
      device.nextOperationSequence,
      "Operation sequence",
    );
    await Promise.all([
      db.deviceState.put(device),
      db.outbox.add(operation),
    ]);
    return mutation.result;
  });
}
