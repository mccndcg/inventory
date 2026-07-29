import {
  expect,
  test,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const baseURL = "http://127.0.0.1:4173";
const routes = [
  { path: "/", heading: "Offline Test Shop" },
  { path: "/inventory", heading: "Inventory" },
  { path: "/sales", heading: "Sales" },
  { path: "/cash", heading: "Cash drawer" },
  { path: "/opening", heading: "Fresh opening balances" },
  { path: "/recovery", heading: "Backup and recovery" },
];

async function waitForControlledShell(context: BrowserContext) {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  ).toBe(true);
  return page;
}

async function enrollTestDevice(page: Page) {
  let enrollment:
    | {
      existingIdentity: {
        deviceId: string;
        drawerId: string;
        locationId: string;
      };
      initialSettings: {
        locationId: string;
        locationCode: string;
        locationName: string;
      };
    }
    | undefined;
  await page.route("**/sync/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/enroll")) {
      enrollment = route.request().postDataJSON() as typeof enrollment;
      if (!enrollment) throw new Error("Missing enrollment request.");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          credential: "a".repeat(43),
          cursor: "0",
          device: {
            ...enrollment.existingIdentity,
            deviceCode: "POS-A",
            drawerLabel: "Front",
            status: "active",
            provisionedAt: "2026-07-28T04:00:00.000Z",
            serverVersion: "v1",
          },
          settings: {
            key: "location",
            ...enrollment.initialSettings,
            currencyCode: "PHP",
            businessTimezone: "Asia/Manila",
            settingsVersion: 1,
          },
        }),
      });
      return;
    }
    if (!enrollment) throw new Error("Pull occurred before enrollment.");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        changes: [],
        cursor: "0",
        hasMore: false,
        settings: {
          key: "location",
          ...enrollment.initialSettings,
          currencyCode: "PHP",
          businessTimezone: "Asia/Manila",
          settingsVersion: 1,
        },
        devices: [
          {
            ...enrollment.existingIdentity,
            deviceCode: "POS-A",
            drawerLabel: "Front",
            status: "active",
            provisionedAt: "2026-07-28T04:00:00.000Z",
            serverVersion: "v1",
          },
        ],
      }),
    });
  });
  await page.getByLabel("Sync server address").fill(baseURL);
  await page.getByLabel("Device code").fill("POS-A");
  await page.getByLabel("Drawer label").fill("Front");
  await page.getByLabel("Initialize a brand-new shop").check();
  await page.getByLabel("Shop name").fill("Offline Test Shop");
  await page.getByLabel("Shop code").fill("SHOP");
  await page.getByLabel("Shop password").fill("shop-password");
  await page.getByRole("button", { name: "Unlock this device" }).click();
  await expect(page.getByText("Offline Test Shop", { exact: true })).toBeVisible();
}

test("installs online and supports warm and cold offline starts", async () => {
  const profile = await mkdtemp(join(tmpdir(), "inventory-offline-"));
  let activeContext: BrowserContext | undefined;
  try {
    activeContext = await chromium.launchPersistentContext(profile);
    const page = await waitForControlledShell(activeContext);
    await enrollTestDevice(page);
    await expect(page.locator("h1")).toHaveCSS("font-weight", "700");
    await page.getByRole("link", { name: "Inventory" }).click();
    await expect(page).toHaveURL(`${baseURL}/inventory`);
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(`${baseURL}/`);

    await activeContext.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toContainText("Offline Test Shop");
    await activeContext.close();
    activeContext = undefined;

    activeContext = await chromium.launchPersistentContext(profile, {
      offline: true,
    });
    const coldPage = activeContext.pages()[0] ?? await activeContext.newPage();
    for (const route of routes) {
      await coldPage.goto(`${baseURL}${route.path}`);
      await expect(coldPage.locator("body")).not.toBeEmpty();
      await expect(
        coldPage.getByRole("heading", { name: route.heading }),
      ).toBeVisible();
      await expect(coldPage.locator("body")).not.toContainText(
        "This site can’t be reached",
      );
    }
    await activeContext.close();
    activeContext = undefined;
  } finally {
    await activeContext?.close();
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});

test("keeps the active shell when a replacement install is interrupted", async () => {
  const profile = await mkdtemp(join(tmpdir(), "inventory-update-"));
  const workerPath = resolve("build/client/sw.js");
  const originalWorker = await readFile(workerPath, "utf8");
  const brokenWorker = originalWorker.replace(
    /assets\/[^"]+\.js/,
    "assets/missing-interrupted-update.js",
  );
  expect(brokenWorker).not.toBe(originalWorker);
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(profile);
    const page = await waitForControlledShell(context);
    await writeFile(workerPath, brokenWorker, "utf8");

    const result = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      const candidate = registration.installing;
      if (candidate) {
        await new Promise<void>((resolveState) => {
          if (candidate.state === "redundant") return resolveState();
          candidate.addEventListener("statechange", () => {
            if (
              candidate.state === "redundant" ||
              candidate.state === "installed"
            ) {
              resolveState();
            }
          });
        });
      }
      return {
        active: Boolean(registration.active),
        waiting: Boolean(registration.waiting),
        controlled: Boolean(navigator.serviceWorker.controller),
      };
    });

    expect(result).toEqual({
      active: true,
      waiting: false,
      controlled: true,
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toContainText("Unlock Inventory and Cash");
    await context.close();
    context = undefined;
  } finally {
    await context?.close();
    await writeFile(workerPath, originalWorker, "utf8");
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});
