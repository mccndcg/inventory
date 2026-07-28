import { afterEach, describe, expect, it } from "vitest";
import { createSyncHttpServer } from "./http";
import { SyncStore } from "./store";

describe("sync HTTP boundary", () => {
  let store: SyncStore | undefined;
  let server: ReturnType<typeof createSyncHttpServer> | undefined;

  afterEach(async () => {
    await server?.close();
    store?.close();
  });

  it("enforces the origin, enrollment password, and bearer credential", async () => {
    store = new SyncStore(":memory:", "shop-password");
    server = createSyncHttpServer(store, {
      allowedOrigin: "https://inventory.example.com",
    });

    const deniedOrigin = await server.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://attacker.example" },
    });
    expect(deniedOrigin.statusCode).toBe(403);

    const wrongPassword = await server.inject({
      method: "POST",
      url: "/sync/v1/enroll",
      headers: { origin: "https://inventory.example.com" },
      payload: {
        password: "wrong",
        deviceCode: "POS-A",
        drawerLabel: "Front",
      },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json()).toMatchObject({
      error: { code: "INVALID_PASSWORD" },
    });

    const enrolled = await server.inject({
      method: "POST",
      url: "/sync/v1/enroll",
      headers: { origin: "https://inventory.example.com" },
      payload: {
        password: "shop-password",
        deviceCode: "POS-A",
        drawerLabel: "Front",
        existingIdentity: {
          deviceId: "20000000-0000-4000-8000-000000000001",
          drawerId: "20000000-0000-4000-8000-000000000002",
          locationId: "20000000-0000-4000-8000-000000000003",
        },
        initialSettings: {
          locationId: "20000000-0000-4000-8000-000000000003",
          locationCode: "SHOP",
          locationName: "Main",
          currencyCode: "PHP",
          businessTimezone: "Asia/Manila",
        },
      },
    });
    expect(enrolled.statusCode).toBe(200);
    expect(enrolled.headers["access-control-allow-origin"]).toBe(
      "https://inventory.example.com",
    );
    const credential = enrolled.json<{ credential: string }>().credential;

    const unauthorized = await server.inject({
      method: "GET",
      url: "/sync/v1/pull?cursor=0",
      headers: { origin: "https://inventory.example.com" },
    });
    expect(unauthorized.statusCode).toBe(401);

    const pulled = await server.inject({
      method: "GET",
      url: "/sync/v1/pull?cursor=0",
      headers: {
        origin: "https://inventory.example.com",
        authorization: `Bearer ${credential}`,
      },
    });
    expect(pulled.statusCode).toBe(200);
    expect(pulled.json()).toMatchObject({
      cursor: "0",
      settings: { currencyCode: "PHP", businessTimezone: "Asia/Manila" },
    });
  });
});
