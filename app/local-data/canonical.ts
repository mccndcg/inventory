import { RepositoryError } from "./errors";

function serialize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Canonical JSON cannot contain a non-finite number.",
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.some((key) => record[key] === undefined)) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Canonical JSON cannot contain undefined values.",
      );
    }
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`)
      .join(",")}}`;
  }
  throw new RepositoryError(
    "INVALID_RECORD",
    "Canonical JSON contains an unsupported value.",
  );
}

export function canonicalJson(value: unknown): string {
  return serialize(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function canonicalSha256(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}
