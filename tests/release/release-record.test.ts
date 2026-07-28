import { describe, expect, it } from "vitest";
import { validateReleaseRecord } from "../../scripts/verify-release-record.mjs";

const routes = ["/", "/inventory", "/sales", "/cash", "/opening", "/recovery"];
const hash = "a".repeat(64);

function completeRecord() {
  return {
    recordFormatVersion: 1,
    application: {
      commit: "b".repeat(40),
      localSchemaVersion: 1,
      databaseVersion: 1,
      hostUrl: "https://inventory.example",
    },
    installation: {
      locationName: "Sanitized Store",
      locationCode: "MAIN",
      deviceCode: "POS-A",
      drawerLabel: "Front",
      onlyAuthoritativePreSyncDevice: true,
    },
    catalog: { method: "manual" },
    opening: {
      reportSha256: hash,
      physicalStockParity: true,
      physicalCashParity: true,
      reopenedProjectionParity: true,
      firstSaleAfterApproval: true,
    },
    backup: {
      manifestSha256: hash,
      encryptedDestinationLabel: "Approved encrypted volume",
      custodian: "Store owner",
      isolatedRestorePassed: true,
      restoredAt: "2026-07-28T01:02:03.000Z",
    },
    offline: {
      chrome: {
        version: "stable",
        warmOfflineStart: true,
        coldOfflineStart: true,
        routesPassed: routes,
      },
      edge: {
        version: "stable",
        warmOfflineStart: true,
        coldOfflineStart: true,
        routesPassed: routes,
      },
    },
    workflows: {
      sale: true,
      oversell: true,
      edit: true,
      void: true,
      stockAdjustment: true,
      cashAdjustment: true,
      drawerCoh: true,
      reload: true,
      failedUpdateRollback: true,
    },
    dexieCloudDecommission: {
      remoteArchivesVerified: true,
      localArchivesVerified: true,
      credentialsAndSessionsRevoked: true,
      observationCompleted: true,
      retentionDecision: "Retain according to approved business policy.",
      providerShutdownRecorded: true,
    },
    signoff: {
      recorder: "Recorder",
      verifier: "Verifier",
      approver: "Approver",
      tester: "Tester",
      decision: "go",
      signedAt: "2026-07-28T01:02:03.000Z",
      evidenceLocation: "External controlled acceptance archive",
    },
  };
}

describe("release acceptance record", () => {
  it("accepts a complete sanitized record", () => {
    expect(validateReleaseRecord(completeRecord())).toEqual([]);
  });

  it("rejects an incomplete or unsafe go-live claim", () => {
    const record = completeRecord();
    record.application.hostUrl = "http://inventory.example";
    record.opening.physicalCashParity = false;
    record.offline.edge.routesPassed = ["/"];
    record.signoff.decision = "no-go";

    expect(validateReleaseRecord(record)).toEqual(
      expect.arrayContaining([
        "application.hostUrl must be an HTTPS URL.",
        "opening.physicalCashParity must be true.",
        "offline.edge.routesPassed is missing /sales.",
        "signoff.decision must be go.",
      ]),
    );
  });
});
