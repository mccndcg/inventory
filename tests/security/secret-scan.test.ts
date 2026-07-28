import { describe, expect, it } from "vitest";
import {
  formatFindings,
  scanText,
} from "../../scripts/secret-scan.mjs";

describe("secret scanner", () => {
  it("reports only the filename and rule ID", () => {
    const syntheticSecret =
      ["-----BEGIN", "PRIVATE KEY-----", "\nsynthetic-test-value\n"].join(" ");
    const findings = scanText("fixtures/synthetic.pem", syntheticSecret);
    const output = formatFindings(findings);

    expect(findings).toEqual([
      {
        path: "fixtures/synthetic.pem",
        ruleId: "PRIVATE_KEY_BLOCK",
      },
    ]);
    expect(output).toBe("fixtures/synthetic.pem: PRIVATE_KEY_BLOCK");
    expect(output).not.toContain("synthetic-test-value");
  });

  it("accepts ordinary source text", () => {
    expect(scanText("app/example.ts", "export const value = 42;")).toEqual([]);
  });
});
