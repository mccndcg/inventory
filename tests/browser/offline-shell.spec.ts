import { expect, test, chromium, type BrowserContext } from "@playwright/test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const baseURL = "http://127.0.0.1:4173";
const routes = ["/", "/inventory", "/sales", "/cash", "/opening", "/recovery"];

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

test("installs online and supports warm and cold offline starts", async () => {
  const profile = await mkdtemp(join(tmpdir(), "inventory-offline-"));
  let activeContext: BrowserContext | undefined;
  try {
    activeContext = await chromium.launchPersistentContext(profile);
    const page = await waitForControlledShell(activeContext);

    await activeContext.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toContainText(
      /Set up this installation|Corner Store/,
    );
    await activeContext.close();
    activeContext = undefined;

    activeContext = await chromium.launchPersistentContext(profile, {
      offline: true,
    });
    const coldPage = activeContext.pages()[0] ?? await activeContext.newPage();
    for (const route of routes) {
      await coldPage.goto(`${baseURL}${route}`);
      await expect(coldPage.locator("body")).not.toBeEmpty();
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
    await expect(page.locator("body")).toContainText("Set up this installation");
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
