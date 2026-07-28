import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export interface SyncHostConfig {
  databasePath: string;
  allowedOrigin: string;
  port: number;
  enrollmentPassword: string;
}

interface ConfigDocument {
  databasePath?: unknown;
  allowedOrigin?: unknown;
  port?: unknown;
  passwordFile?: unknown;
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function validPort(value: unknown): number {
  const port = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Sync host port must be a valid TCP port.");
  }
  return port;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function pathFrom(base: string, value: unknown, label: string): string {
  const path = requiredString(value, label);
  return isAbsolute(path) ? path : resolve(base, path);
}

export function loadSyncHostConfig(
  args: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): SyncHostConfig {
  const configPath = argumentValue(args, "--config");
  if (configPath) {
    const absoluteConfig = resolve(configPath);
    const base = dirname(absoluteConfig);
    const document = JSON.parse(
      readFileSync(absoluteConfig, "utf8"),
    ) as ConfigDocument;
    const passwordFile = pathFrom(
      base,
      document.passwordFile,
      "passwordFile",
    );
    const enrollmentPassword = readFileSync(passwordFile, "utf8").trimEnd();
    if (!enrollmentPassword) throw new Error("Password file is empty.");
    return {
      databasePath: pathFrom(base, document.databasePath, "databasePath"),
      allowedOrigin: requiredString(document.allowedOrigin, "allowedOrigin"),
      port: validPort(document.port ?? 8787),
      enrollmentPassword,
    };
  }

  const passwordFile = environment.SYNC_ENROLLMENT_PASSWORD_FILE;
  const enrollmentPassword = passwordFile
    ? readFileSync(resolve(passwordFile), "utf8").trimEnd()
    : environment.SYNC_ENROLLMENT_PASSWORD;
  if (!enrollmentPassword) {
    throw new Error(
      "SYNC_ENROLLMENT_PASSWORD or SYNC_ENROLLMENT_PASSWORD_FILE is required.",
    );
  }
  return {
    databasePath: resolve(
      environment.SYNC_DATABASE_PATH ?? "./data/inventory-sync.sqlite",
    ),
    allowedOrigin: requiredString(
      environment.SYNC_ALLOWED_ORIGIN,
      "SYNC_ALLOWED_ORIGIN",
    ),
    port: validPort(environment.SYNC_PORT ?? 8787),
    enrollmentPassword,
  };
}

export function commandArgument(
  name: string,
  args: readonly string[] = process.argv.slice(2),
): string | undefined {
  return argumentValue(args, name);
}
