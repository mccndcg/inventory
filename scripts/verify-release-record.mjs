import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const sha256 = /^[0-9a-f]{64}$/;
const commit = /^[0-9a-f]{40}$/;
const requiredRoutes = [
  "/",
  "/inventory",
  "/sales",
  "/cash",
  "/opening",
  "/recovery",
];

function recordOf(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function requiredText(errors, value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} is required.`);
  }
}

function requiredTrue(errors, value, path) {
  if (value !== true) errors.push(`${path} must be true.`);
}

function requiredInstant(errors, value, path) {
  if (
    typeof value !== "string" ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    errors.push(`${path} must be a canonical UTC ISO 8601 instant.`);
  }
}

function browserErrors(errors, value, path) {
  const browser = recordOf(value);
  requiredText(errors, browser.version, `${path}.version`);
  requiredTrue(errors, browser.warmOfflineStart, `${path}.warmOfflineStart`);
  requiredTrue(errors, browser.coldOfflineStart, `${path}.coldOfflineStart`);
  const routes = Array.isArray(browser.routesPassed) ? browser.routesPassed : [];
  for (const route of requiredRoutes) {
    if (!routes.includes(route)) errors.push(`${path}.routesPassed is missing ${route}.`);
  }
}

export function validateReleaseRecord(value) {
  const errors = [];
  const root = recordOf(value);
  const application = recordOf(root.application);
  const installation = recordOf(root.installation);
  const catalog = recordOf(root.catalog);
  const opening = recordOf(root.opening);
  const backup = recordOf(root.backup);
  const offline = recordOf(root.offline);
  const workflows = recordOf(root.workflows);
  const decommission = recordOf(root.dexieCloudDecommission);
  const signoff = recordOf(root.signoff);

  if (root.recordFormatVersion !== 1) {
    errors.push("recordFormatVersion must be 1.");
  }
  if (application.commit === undefined || !commit.test(application.commit)) {
    errors.push("application.commit must be a lowercase 40-character Git SHA.");
  }
  if (!Number.isSafeInteger(application.localSchemaVersion) ||
      application.localSchemaVersion < 1) {
    errors.push("application.localSchemaVersion must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(application.databaseVersion) ||
      application.databaseVersion < 1) {
    errors.push("application.databaseVersion must be a positive safe integer.");
  }
  try {
    const url = new URL(application.hostUrl);
    if (url.protocol !== "https:") throw new Error();
  } catch {
    errors.push("application.hostUrl must be an HTTPS URL.");
  }

  for (const field of [
    "locationName",
    "locationCode",
    "deviceCode",
    "drawerLabel",
  ]) {
    requiredText(errors, installation[field], `installation.${field}`);
  }
  requiredTrue(
    errors,
    installation.onlyAuthoritativePreSyncDevice,
    "installation.onlyAuthoritativePreSyncDevice",
  );

  if (!["manual", "sanitized_import"].includes(catalog.method)) {
    errors.push("catalog.method must be manual or sanitized_import.");
  }
  if (catalog.method === "sanitized_import" &&
      !sha256.test(catalog.sourceSha256 ?? "")) {
    errors.push("catalog.sourceSha256 is required for sanitized_import.");
  }

  if (!sha256.test(opening.reportSha256 ?? "")) {
    errors.push("opening.reportSha256 must be lowercase SHA-256.");
  }
  for (const field of [
    "physicalStockParity",
    "physicalCashParity",
    "reopenedProjectionParity",
    "firstSaleAfterApproval",
  ]) {
    requiredTrue(errors, opening[field], `opening.${field}`);
  }

  if (!sha256.test(backup.manifestSha256 ?? "")) {
    errors.push("backup.manifestSha256 must be lowercase SHA-256.");
  }
  requiredText(
    errors,
    backup.encryptedDestinationLabel,
    "backup.encryptedDestinationLabel",
  );
  requiredText(errors, backup.custodian, "backup.custodian");
  requiredTrue(errors, backup.isolatedRestorePassed, "backup.isolatedRestorePassed");
  requiredInstant(errors, backup.restoredAt, "backup.restoredAt");

  browserErrors(errors, offline.chrome, "offline.chrome");
  browserErrors(errors, offline.edge, "offline.edge");

  for (const field of [
    "sale",
    "oversell",
    "edit",
    "void",
    "stockAdjustment",
    "cashAdjustment",
    "drawerCoh",
    "reload",
    "failedUpdateRollback",
  ]) {
    requiredTrue(errors, workflows[field], `workflows.${field}`);
  }

  for (const field of [
    "remoteArchivesVerified",
    "localArchivesVerified",
    "credentialsAndSessionsRevoked",
    "observationCompleted",
    "providerShutdownRecorded",
  ]) {
    requiredTrue(errors, decommission[field], `dexieCloudDecommission.${field}`);
  }
  requiredText(
    errors,
    decommission.retentionDecision,
    "dexieCloudDecommission.retentionDecision",
  );

  for (const field of ["recorder", "verifier", "approver", "tester"]) {
    requiredText(errors, signoff[field], `signoff.${field}`);
  }
  if (signoff.decision !== "go") errors.push("signoff.decision must be go.");
  requiredInstant(errors, signoff.signedAt, "signoff.signedAt");
  requiredText(errors, signoff.evidenceLocation, "signoff.evidenceLocation");
  return errors;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    throw new Error(
      "Usage: npm run verify:release -- <external-acceptance-record.json>",
    );
  }
  const value = JSON.parse(await readFile(file, "utf8"));
  const errors = validateReleaseRecord(value);
  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Release acceptance record is complete and internally valid.\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
