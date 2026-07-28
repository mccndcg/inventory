import { describe, expect, it } from "vitest";

describe("Vitest harness", () => {
  it("executes TypeScript tests in the Node environment", () => {
    const centavos = [100, 250];

    expect(centavos.reduce((total, amount) => total + amount, 0)).toBe(350);
  });
});
