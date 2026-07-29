import { z } from "zod";
import type {
  AggregateType,
  DeviceDirectoryEntry,
  LocationSettings,
  OutboxOperation,
} from "../local-data/models";

export const SYNC_PROTOCOL_VERSION = 1;
export const SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const MAX_PUSH_OPERATIONS = 100;
export const MAX_PULL_CHANGES = 500;

const uuid = z.string().uuid().refine((value) => value === value.toLowerCase());
const identitySchema = z.object({
  deviceId: uuid,
  drawerId: uuid,
  locationId: uuid,
}).strict();

const settingsSchema = z.object({
  locationId: uuid,
  locationCode: z.string().min(1),
  locationName: z.string().min(1),
  currencyCode: z.literal("PHP"),
  businessTimezone: z.literal("Asia/Manila"),
}).strict();

export const enrollmentRequestSchema = z.object({
  password: z.string().min(1).max(1024),
  deviceCode: z.string().min(2).max(16),
  drawerLabel: z.string().min(1).max(100),
  existingIdentity: identitySchema.optional(),
  initialSettings: settingsSchema.optional(),
}).strict();

export type EnrollmentRequest = z.infer<typeof enrollmentRequestSchema>;

export interface EnrollmentResponse {
  credential: string;
  device: DeviceDirectoryEntry;
  settings: LocationSettings;
  cursor: string;
}

export interface PushRequest {
  protocolVersion: 1;
  operations: OutboxOperation[];
}

export interface OperationReceipt {
  operationId: string;
  deviceSequence: number;
  status: "accepted" | "rejected";
  serverVersion?: string;
  errorCode?: string;
  canonicalPayload?: unknown;
}

export interface PushResponse {
  receipts: OperationReceipt[];
}

export interface ServerChange {
  cursor: string;
  aggregateType: AggregateType;
  aggregateId: string;
  serverVersion: string;
  payload: unknown;
}

export interface PullResponse {
  changes: ServerChange[];
  cursor: string;
  hasMore: boolean;
  settings: LocationSettings;
  devices: DeviceDirectoryEntry[];
}

export class SyncProtocolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "SyncProtocolError";
  }
}
